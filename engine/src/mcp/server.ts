#!/usr/bin/env node
/**
 * MCP server exposing the video-builder pipeline. This is the ONLY interface an
 * agent needs: Claude Code, Codex or anything else that speaks MCP over stdio.
 *
 * Register in Claude Code via the repo's .mcp.json (already present) or:
 *   claude mcp add video-builder -- node --import tsx engine/src/mcp/server.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildProject, compileProject, loadResolved, renderVersion } from "../build.js";
import { catalogSummary } from "../catalog-info.js";
import { doctor } from "../doctor.js";
import { PROJECTS_DIR, SKILLS_DIR, latestVersion, projectPaths, versionPaths } from "../paths.js";
import { ManifestError, createProject, loadManifest, readMeta, slugify, validateManifest } from "../project.js";
import { runQa } from "../qa.js";
import { publishVersion } from "../publish.js";
import { writeSocial } from "../social.js";
import { ResolveError } from "../resolver/anchors.js";
import { VIDEO } from "../schema/index.js";

const server = new McpServer({ name: "video-builder", version: "0.1.0" });

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
const text = (v: unknown): { content: Content[] } => ({
  content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }],
});
const errText = (e: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: e instanceof ManifestError || e instanceof ResolveError ? e.message : ((e as Error).stack ?? String(e)) }],
});

const logs: string[] = [];
const log = (l: string) => {
  logs.push(l);
  if (logs.length > 200) logs.shift();
};

server.registerTool(
  "video_catalog",
  {
    description:
      "The complete vocabulary a manifest may use: poses, expressions, layouts, props, SFX, music tracks, voices, themes, anchor grammar and platform limits. Call this before writing a manifest.",
    inputSchema: {},
  },
  async () => text(catalogSummary()),
);

server.registerTool(
  "video_read_skill",
  {
    description: "Read a SKILL.md with authoring guidance. Names: 2d-storytelling (hooks, pacing, structure), stickman-animation (poses/props/sfx per beat).",
    inputSchema: { name: z.enum(["2d-storytelling", "stickman-animation"]) },
  },
  async ({ name }) => {
    const f = path.join(SKILLS_DIR, name, "SKILL.md");
    return existsSync(f) ? text(readFileSync(f, "utf8")) : errText(new Error(`no skill ${name}`));
  },
);

server.registerTool(
  "video_create_project",
  {
    description: "Scaffold projects/<slug>/ with project.json and a starter manifest. Returns the paths and the manifest to replace. Then write your own manifest with video_write_manifest.",
    inputSchema: {
      topic: z.string().min(3).describe("What the video explains, e.g. 'Why databases use indexes'"),
      slug: z.string().regex(/^[a-z0-9-]+$/).optional().describe("Folder name; defaults to slugified topic"),
      targetSeconds: z.number().int().min(15).max(VIDEO.maxDurationSec).optional().describe("Desired length (default 40)"),
    },
  },
  async ({ topic, slug, targetSeconds }) => {
    try {
      const p = createProject({ slug: slug ?? slugify(topic), topic, targetSeconds });
      return text({ slug: path.basename(p.root), paths: p, starterManifest: JSON.parse(readFileSync(p.manifest, "utf8")), next: "Read video_read_skill('2d-storytelling'), then video_write_manifest." });
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_list_projects",
  { description: "List all projects with status (draft → audio → resolved → rendered → qa_passed/qa_failed).", inputSchema: {} },
  async () => {
    if (!existsSync(PROJECTS_DIR)) return text([]);
    return text(readdirSync(PROJECTS_DIR).map((s) => readMeta(projectPaths(s))).filter(Boolean));
  },
);

server.registerTool(
  "video_get_project",
  { description: "Project metadata, current manifest, resolved timing summary (if compiled) and last QA report (if rendered).", inputSchema: { slug: z.string() } },
  async ({ slug }) => {
    try {
      const p = projectPaths(slug);
      const meta = readMeta(p);
      if (!meta) return errText(new Error(`no project "${slug}"`));
      const manifest = existsSync(p.manifest) ? JSON.parse(readFileSync(p.manifest, "utf8")) : null;
      const resolved = loadResolved(p);
      const latest = latestVersion(p);
      const qa = latest && existsSync(latest.qaReport) ? JSON.parse(readFileSync(latest.qaReport, "utf8")) : null;
      return text({ meta, manifest, timing: resolved ? timingSummary(resolved) : null, latestVersion: latest ? { n: latest.n, file: latest.finalMp4, qa } : null });
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_validate_manifest",
  {
    description: "Schema-validate a manifest object WITHOUT touching disk or running TTS. Returns 'valid' or a list of path→message issues. Cheap; call it before video_write_manifest.",
    inputSchema: { manifest: z.record(z.string(), z.unknown()).describe("The manifest JSON object") },
  },
  async ({ manifest }) => {
    try {
      validateManifest(manifest);
      return text("valid");
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_write_manifest",
  {
    description: "Validate and save a manifest to projects/<slug>/manifest.json (slug in manifest must match). Does not synthesize audio; call video_compile next.",
    inputSchema: { slug: z.string(), manifest: z.record(z.string(), z.unknown()) },
  },
  async ({ slug, manifest }) => {
    try {
      const { manifest: m } = validateManifest(manifest);
      if (m.slug !== slug) return errText(new Error(`manifest.slug "${m.slug}" != "${slug}"`));
      const p = projectPaths(slug);
      if (!readMeta(p)) return errText(new Error(`no project "${slug}" — call video_create_project first`));
      writeFileSync(p.manifest, JSON.stringify(manifest, null, 2));
      return text({ saved: p.manifest, scenes: m.scenes.length, estimatedSeconds: estimate(m) });
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_compile",
  {
    description:
      "TTS + word alignment + anchor resolution. Returns exact per-scene durations, the word list per scene (use these exact words in anchors), and warnings. Unchanged scenes reuse cached audio. Fails with a precise path if an anchor word is not found.",
    inputSchema: { slug: z.string(), forceAudio: z.boolean().optional().describe("Re-synthesize every scene even if unchanged") },
  },
  async ({ slug, forceAudio }) => {
    try {
      const r = await compileProject(slug, { forceAudio, log });
      return text({ ...timingSummary(r.resolved), warnings: r.warnings });
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_render",
  {
    description:
      "Render the compiled project into a NEW immutable version folder output/v<N>/ (earlier versions are never touched) and run technical QA. ~1–2 min for a 40 s video. preview=true renders half-res to output/preview (no version, no QA). Returns QA checks and the contact-sheet image so you can review the visuals.",
    inputSchema: {
      slug: z.string(),
      preview: z.boolean().optional(),
      nvenc: z.boolean().optional().describe("Encode with the GPU via image sequence (needs h264_nvenc)"),
      compileFirst: z.boolean().optional().describe("Run video_compile first (default true)"),
      note: z.string().optional().describe("Why this version exists, e.g. 'slower laugh, new outro'"),
    },
  },
  async ({ slug, preview, nvenc, compileFirst = true, note }) => {
    try {
      const p = projectPaths(slug);
      const { manifest } = loadManifest(slug);
      let resolved = loadResolved(p);
      if (compileFirst || !resolved) resolved = (await compileProject(slug, { log })).resolved;
      if (preview) {
        const r = await renderVersion({ manifest, resolved, warnings: [], paths: p }, { scale: 0.5, log });
        return text({ file: r.file, renderMs: r.renderMs, note: "preview — half resolution, no QA, not a version" });
      }
      const r = await buildProject(slug, { nvenc, log, note });
      return withContactSheet({ version: r.version?.n, file: r.file, seconds: r.resolved.durationInFrames / r.resolved.fps, renderMs: r.renderMs, qa: r.qa.checks, qaOk: r.qa.ok, warnings: r.warnings, social: r.version!.social }, r.version!.contactSheet);
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_qa",
  { description: "Re-run technical QA on a rendered version (default latest) and return the report plus contact sheet image.", inputSchema: { slug: z.string(), version: z.number().int().optional() } },
  async ({ slug, version }) => {
    try {
      const p = projectPaths(slug);
      const v = version ? versionPaths(p, version) : latestVersion(p);
      if (!v || !existsSync(v.finalMp4)) return errText(new Error("no rendered version"));
      const resolved = existsSync(v.resolvedSnapshot) ? JSON.parse(readFileSync(v.resolvedSnapshot, "utf8")) : loadResolved(p);
      if (!resolved) return errText(new Error("not compiled"));
      const qa = await runQa(resolved, v);
      return withContactSheet(qa, v.contactSheet);
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_contact_sheet",
  { description: "Return the 4x3 frame grid of a rendered version (default latest) as an image, for visual review.", inputSchema: { slug: z.string(), version: z.number().int().optional() } },
  async ({ slug, version }) => {
    const p = projectPaths(slug);
    const v = version ? versionPaths(p, version) : latestVersion(p);
    if (!v || !existsSync(v.contactSheet)) return errText(new Error("no contact sheet yet — render first"));
    return withContactSheet({ version: v.n, file: v.contactSheet }, v.contactSheet);
  },
);

server.registerTool(
  "video_publish",
  {
    description: "Upload a rendered version to GitHub Releases (tag <slug>-vN; assets: final.mp4, contact.png, qa.json, manifest.json). Returns the public download URL. Default: latest version.",
    inputSchema: { slug: z.string(), version: z.number().int().optional() },
  },
  async ({ slug, version }) => {
    try {
      return text(await publishVersion(slug, version, { log }));
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool(
  "video_social",
  {
    description: "Upload copy for a rendered version (default latest): YouTube title/description/tags and TikTok/Instagram/Facebook captions, formatted from manifest.social + brand.json. Also writes output/v<N>/social.md. Edit manifest.social and call again to regenerate.",
    inputSchema: { slug: z.string(), version: z.number().int().optional() },
  },
  async ({ slug, version }) => {
    try {
      const r = writeSocial(slug, version);
      return { content: [{ type: "text" as const, text: r.text }] };
    } catch (e) {
      return errText(e);
    }
  },
);

server.registerTool("video_doctor", { description: "Check node, ffmpeg, NVENC, GPU, uv, Kokoro and Remotion availability.", inputSchema: {} }, async () => text(await doctor()));

server.registerTool("video_logs", { description: "Last 200 log lines from compile/render (progress, TTS timings, Remotion output).", inputSchema: {} }, async () => text(logs.join("\n")));

function withContactSheet(payload: unknown, sheet: string) {
  const content: Content[] = [{ type: "text", text: JSON.stringify(payload, null, 2) }];
  if (existsSync(sheet)) content.push({ type: "image", data: readFileSync(sheet).toString("base64"), mimeType: "image/png" });
  return { content };
}

function timingSummary(r: NonNullable<ReturnType<typeof loadResolved>>) {
  return {
    totalSeconds: +(r.durationInFrames / r.fps).toFixed(2),
    durationInFrames: r.durationInFrames,
    overWarnThreshold: r.durationInFrames / r.fps > VIDEO.warnDurationSec,
    scenes: r.scenes.map((s) => ({
      id: s.id,
      startSec: +(s.startFrame / r.fps).toFixed(2),
      seconds: +(s.durationInFrames / r.fps).toFixed(2),
      words: s.words.map((w) => w.text),
      poseChanges: s.character?.poseChanges.length ?? 0,
      props: s.props.length,
      sfx: s.sfx.length,
    })),
  };
}

function estimate(m: ReturnType<typeof loadManifest>["manifest"]) {
  const words = m.scenes.reduce((n, s) => n + (s.speech?.split(/\s+/).length ?? 0), 0);
  return +(words / (2.6 * m.speed) + m.scenes.reduce((n, s) => n + s.pauseAfter, 0)).toFixed(1);
}

const transport = new StdioServerTransport();
await server.connect(transport);
