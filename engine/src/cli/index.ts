#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { buildProject, compileProject } from "../build.js";
import { doctor } from "../doctor.js";
import { PROJECTS_DIR, projectPaths } from "../paths.js";
import { createProject, loadManifest, readMeta, slugify, validateManifest, ManifestError } from "../project.js";
import { renderProject } from "../render.js";
import { loadResolved } from "../build.js";
import { runQa } from "../qa.js";
import { ResolveError } from "../resolver/anchors.js";
import { catalogSummary } from "../catalog-info.js";

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
  .description("render an already-compiled project")
  .action(async (slug: string, o: { concurrency?: string; frames?: string; scale?: number; nvenc?: boolean }) => {
    try {
      const p = projectPaths(slug);
      const resolved = loadResolved(p);
      if (!resolved) throw new Error(`run "vb compile ${slug}" first`);
      const r = await renderProject(resolved, p, { ...o, concurrency: o.concurrency ? Number(o.concurrency) : undefined, log });
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
  .description("compile + render + QA in one go")
  .action(async (slug: string, o: { concurrency?: string; frames?: string; scale?: number; nvenc?: boolean; forceAudio?: boolean; skipQa?: boolean }) => {
    try {
      const r = await buildProject(slug, { ...o, concurrency: o.concurrency ? Number(o.concurrency) : undefined, log });
      console.log(JSON.stringify({ file: r.paths.finalMp4, seconds: r.resolved.durationInFrames / r.resolved.fps, renderMs: r.renderMs, qa: r.qa.ok, warnings: r.warnings }, null, 2));
      process.exit(r.qa.ok ? 0 : 2);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("qa")
  .argument("<slug>")
  .description("re-run technical QA on output/final.mp4")
  .action(async (slug: string) => {
    const p = projectPaths(slug);
    const resolved = loadResolved(p);
    if (!resolved) fail(new Error("not compiled"));
    const r = await runQa(resolved!, p);
    for (const c of r.checks) console.log(`${c.ok ? "pass" : "FAIL"} ${c.name}: ${c.detail}`);
    process.exit(r.ok ? 0 : 2);
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
