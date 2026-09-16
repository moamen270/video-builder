import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { Manifest, type ManifestInput } from "./schema/index.js";
import { projectPaths, type ProjectPaths } from "./paths.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ManifestError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(`manifest invalid:\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n")}`);
    this.name = "ManifestError";
  }
}

export function validateManifest(input: unknown): { manifest: Manifest; issues: ValidationIssue[] } {
  const r = Manifest.safeParse(input);
  if (r.success) return { manifest: r.data, issues: [] };
  const issues = r.error.issues.map((i) => ({
    path: i.path.length ? i.path.map((k) => (typeof k === "number" ? `[${k}]` : `.${String(k)}`)).join("").replace(/^\./, "") : "(root)",
    message: i.message,
  }));
  throw new ManifestError(issues);
}

export function loadManifest(slug: string): { manifest: Manifest; paths: ProjectPaths } {
  const paths = projectPaths(slug);
  if (!existsSync(paths.manifest)) throw new Error(`project "${slug}" has no manifest.json at ${paths.manifest}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(paths.manifest, "utf8"));
  } catch (e) {
    throw new ManifestError([{ path: "(file)", message: `manifest.json is not valid JSON: ${(e as Error).message}` }]);
  }
  const { manifest } = validateManifest(raw);
  if (manifest.slug !== slug) {
    throw new ManifestError([{ path: "slug", message: `slug "${manifest.slug}" does not match folder "${slug}"` }]);
  }
  return { manifest, paths };
}

export const VersionRecord = z.object({
  n: z.number().int(),
  at: z.string(),
  seconds: z.number(),
  renderMs: z.number(),
  qaOk: z.boolean().nullable(),
  manifestHash: z.string(),
  note: z.string().optional(),
});
export type VersionRecord = z.infer<typeof VersionRecord>;

export const ProjectMeta = z.object({
  slug: z.string(),
  topic: z.string(),
  createdAt: z.string(),
  targetSeconds: z.number().int().min(10).max(60),
  status: z.enum(["draft", "audio", "resolved", "rendered", "qa_passed", "qa_failed"]),
  lastRenderMs: z.number().optional(),
  /** Append-only history; one entry per output/v<N>/. */
  versions: z.array(VersionRecord).default([]),
});
export type ProjectMeta = z.infer<typeof ProjectMeta>;

export function readMeta(p: ProjectPaths): ProjectMeta | null {
  if (!existsSync(p.projectJson)) return null;
  const r = ProjectMeta.safeParse(JSON.parse(readFileSync(p.projectJson, "utf8")));
  return r.success ? r.data : null;
}

export function updateMeta(p: ProjectPaths, patch: Partial<ProjectMeta>): ProjectMeta {
  const cur = readMeta(p);
  if (!cur) throw new Error(`no project.json in ${p.root}`);
  const next = { ...cur, ...patch };
  writeFileSync(p.projectJson, JSON.stringify(next, null, 2));
  return next;
}

/**
 * Scaffold projects/<slug>/ with project.json and a starter manifest the agent
 * then rewrites. The starter is valid and renderable so `vb build` works immediately.
 */
export function createProject(opts: { slug: string; topic: string; targetSeconds?: number }): ProjectPaths {
  const slug = opts.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug "${slug}" must be lowercase letters, digits and dashes`);
  const p = projectPaths(slug);
  if (existsSync(p.manifest)) throw new Error(`project "${slug}" already exists`);
  mkdirSync(p.build, { recursive: true });
  mkdirSync(p.outputDir, { recursive: true });

  const meta: ProjectMeta = {
    slug,
    topic: opts.topic,
    createdAt: new Date().toISOString(),
    targetSeconds: opts.targetSeconds ?? 40,
    status: "draft",
    versions: [],
  };
  writeFileSync(p.projectJson, JSON.stringify(meta, null, 2));

  const starter: ManifestInput = {
    version: 1,
    slug,
    title: opts.topic,
    notes: "STARTER — replace every scene. Read skills/2d-storytelling/SKILL.md first.",
    scenes: [
      {
        id: "hook",
        speech: `Here's something about ${opts.topic} nobody tells you.`,
        emphasis: ["nobody tells you"],
        layout: "character_center",
        character: { pose: "pointing_up", expression: "surprised", poseChanges: [{ pose: "explaining", at: "word:nobody" }] },
        props: [{ name: "lightbulb", at: "word:something", anim: "pop", position: "above_character" }],
        sfx: [{ name: "pop", at: "word:something" }],
      },
    ],
  };
  writeFileSync(p.manifest, JSON.stringify(starter, null, 2));
  return p;
}

export function slugify(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "video";
}
