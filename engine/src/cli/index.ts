#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { buildProject, compileProject, loadResolved, renderVersion } from "../build.js";
import { doctor } from "../doctor.js";
import { PROJECTS_DIR, latestVersion, listVersions, projectPaths, versionPaths } from "../paths.js";
import { createProject, loadManifest, readMeta, slugify, validateManifest, ManifestError } from "../project.js";
import { runQa } from "../qa.js";
import { ResolveError } from "../resolver/anchors.js";
import { catalogSummary } from "../catalog-info.js";
import { publishAll, publishVersion } from "../publish.js";

const log = (l: string) => console.error(l);

const program = new Command()
  .name("vb")
  .description("video-builder: compile a JSON manifest into a 1080x1920 Short")
  .showHelpAfterError();

program
  .command("doctor")
  .description("check node/python/ffmpeg/GPU prerequisites")
  .action(async () => {
    const r = await doctor();
    for (const c of r.checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.name.padEnd(14)} ${c.detail}`);
    process.exit(r.ok ? 0 : 1);
  });

program
  .command("create")
  .argument("<topic>", "what the video is about")
  .option("-s, --slug <slug>", "folder name (default: slugified topic)")
  .option("-t, --target <seconds>", "target length", "40")
  .description("scaffold projects/<slug>/ with a starter manifest")
  .action((topic: string, o: { slug?: string; target: string }) => {
    const p = createProject({ slug: o.slug ?? slugify(topic), topic, targetSeconds: Number(o.target) });
    console.log(p.manifest);
  });

program
  .command("list")
  .description("list projects and their status")
  .action(() => {
    if (!existsSync(PROJECTS_DIR)) return;
    for (const slug of readdirSync(PROJECTS_DIR)) {
      const meta = readMeta(projectPaths(slug));
      if (meta) console.log(`${slug.padEnd(32)} ${meta.status.padEnd(10)} ${meta.topic}`);
    }
  });

program
  .command("validate")
  .argument("<slug-or-file>", "project slug or path to a manifest.json")
  .description("validate a manifest against the schema (no TTS)")
  .action((arg: string) => {
    try {
      if (arg.endsWith(".json")) validateManifest(JSON.parse(readFileSync(arg, "utf8")));
      else loadManifest(arg);
      console.log("valid");
    } catch (e) {
      fail(e);
    }
  });

program
  .command("compile")
  .argument("<slug>")
  .option("--force-audio", "re-synthesize every scene")
  .description("validate → TTS + alignment → resolved manifest (no render)")
  .action(async (slug: string, o: { forceAudio?: boolean }) => {
    try {
      const r = await compileProject(slug, { forceAudio: o.forceAudio, log });
      console.log(r.paths.resolved);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("render")
  .argument("<slug>")
  .option("-c, --concurrency <n>", "parallel Chrome tabs")
  .option("--frames <range>", "e.g. 0-90 for a preview")
  .option("--scale <f>", "0.25–1", parseFloat)
  .option("--nvenc", "encode with h264_nvenc via image sequence")
  .option("--note <text>", "why this version exists (stored in project.json)")
  .description("render an already-compiled project into a NEW output/vN folder (previews go to output/preview)")
  .action(async (slug: string, o: { concurrency?: string; frames?: string; scale?: number; nvenc?: boolean; note?: string }) => {
    try {
      const { manifest, paths } = loadManifest(slug);
      const resolved = loadResolved(paths);
      if (!resolved) throw new Error(`run "vb compile ${slug}" first`);
      const r = await renderVersion({ manifest, resolved, warnings: [], paths }, { ...o, concurrency: o.concurrency ? Number(o.concurrency) : undefined, log });
      console.log(r.file);
    } catch (e) {
      fail(e);
    }
  });



program
  .command("build")
  .argument("<slug>")
  .option("-c, --concurrency <n>")
  .option("--frames <range>")
  .option("--scale <f>", "0.25–1", parseFloat)
  .option("--nvenc")
  .option("--force-audio")
  .option("--skip-qa")
  .option("--note <text>", "why this version exists")
  .description("compile + render a NEW version + QA in one go")
  .action(async (slug: string, o: { concurrency?: string; frames?: string; scale?: number; nvenc?: boolean; forceAudio?: boolean; skipQa?: boolean; note?: string }) => {
    try {
      const r = await buildProject(slug, { ...o, concurrency: o.concurrency ? Number(o.concurrency) : undefined, log });
      console.log(JSON.stringify({ version: r.version?.n ?? "preview", file: r.file, seconds: r.resolved.durationInFrames / r.resolved.fps, renderMs: r.renderMs, qa: r.qa.ok, warnings: r.warnings }, null, 2));
      process.exit(r.qa.ok ? 0 : 2);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("qa")
  .argument("<slug>")
  .option("-v, --version <n>", "version to check (default: latest)")
  .description("re-run technical QA on a rendered version")
  .action(async (slug: string, o: { version?: string }) => {
    const p = projectPaths(slug);
    const v = o.version ? versionPaths(p, Number(o.version)) : latestVersion(p);
    if (!v || !existsSync(v.finalMp4)) fail(new Error(`no rendered version${o.version ? ` v${o.version}` : ""} for ${slug} (have: ${listVersions(p).join(", ") || "none"})`));
    const resolved = existsSync(v!.resolvedSnapshot) ? JSON.parse(readFileSync(v!.resolvedSnapshot, "utf8")) : loadResolved(p);
    if (!resolved) fail(new Error("not compiled"));
    const r = await runQa(resolved!, v!);
    for (const c of r.checks) console.log(`${c.ok ? "pass" : "FAIL"} ${c.name}: ${c.detail}`);
    process.exit(r.ok ? 0 : 2);
  });

program
  .command("publish")
  .argument("[slug]", "project to publish (omit with --all)")
  .option("-v, --version <n>", "version (default: latest)")
  .option("--all", "publish every unpublished version of every project")
  .description("upload a rendered version to GitHub Releases (tag <slug>-vN) and print its URL")
  .action(async (slug: string | undefined, o: { version?: string; all?: boolean }) => {
    try {
      if (o.all) {
        const r = await publishAll({ log });
        for (const x of r) console.log(`${x.tag.padEnd(28)} ${x.videoUrl}`);
        if (!r.length) console.log("everything already published");
        return;
      }
      if (!slug) fail(new Error("slug required (or --all)"));
      const r = await publishVersion(slug!, o.version ? Number(o.version) : undefined, { log });
      console.log(r.videoUrl);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("versions")
  .argument("<slug>")
  .description("list rendered versions of a project")
  .action((slug: string) => {
    const meta = readMeta(projectPaths(slug));
    if (!meta) fail(new Error(`no project "${slug}"`));
    for (const v of meta!.versions) console.log(`v${v.n}  ${v.at.slice(0, 16)}  ${v.seconds.toFixed(1)}s  qa=${v.qaOk ?? "skipped"}  ${v.note ?? ""}${v.publishedUrl ? `\n      ${v.publishedUrl}` : ""}`);
    if (!meta!.versions.length) console.log("(no versions rendered yet)");
  });

program
  .command("catalog")
  .description("print the vocabulary the manifest accepts (poses, props, sfx, voices…)")
  .action(() => console.log(JSON.stringify(catalogSummary(), null, 2)));

function fail(e: unknown): never {
  if (e instanceof ManifestError || e instanceof ResolveError) console.error(e.message);
  else console.error((e as Error).stack ?? String(e));
  process.exit(1);
}

program.parseAsync(process.argv);
