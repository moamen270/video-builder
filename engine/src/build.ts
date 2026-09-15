import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ensureAudio } from "./audio.js";
import { loadManifest, updateMeta } from "./project.js";
import { renderProject, type RenderOptions } from "./render.js";
import { resolveManifest, type ResolveWarning } from "./resolver/resolve.js";
import { runQa, type QaReport } from "./qa.js";
import { ResolvedManifest, type Manifest } from "./schema/index.js";
import type { ProjectPaths } from "./paths.js";

export type Log = (line: string) => void;

export interface CompileResult {
  manifest: Manifest;
  resolved: ResolvedManifest;
  warnings: ResolveWarning[];
  paths: ProjectPaths;
}

/** validate → TTS/alignment → resolve. Writes build/manifest.resolved.json. No rendering. */
export async function compileProject(slug: string, opts: { forceAudio?: boolean; log?: Log } = {}): Promise<CompileResult> {
  const log = opts.log ?? (() => {});
  const { manifest, paths } = loadManifest(slug);
  log(`manifest ok: ${manifest.scenes.length} scenes`);
  const alignment = await ensureAudio(manifest, paths, { force: opts.forceAudio, log });
  updateMeta(paths, { status: "audio" });
  const { resolved, warnings } = resolveManifest(manifest, alignment, paths);
  writeFileSync(paths.resolved, JSON.stringify(resolved, null, 2));
  updateMeta(paths, { status: "resolved" });
  log(`resolved: ${resolved.durationInFrames} frames = ${(resolved.durationInFrames / resolved.fps).toFixed(1)}s`);
  for (const w of warnings) log(`warn ${w.path}: ${w.message}`);
  return { manifest, resolved, warnings, paths };
}

export interface BuildResult extends CompileResult {
  renderMs: number;
  qa: QaReport;
}

/** Full pipeline: compile → render → QA. */
export async function buildProject(slug: string, opts: RenderOptions & { forceAudio?: boolean; skipQa?: boolean } = {}): Promise<BuildResult> {
  const log = opts.log ?? (() => {});
  const compiled = await compileProject(slug, { forceAudio: opts.forceAudio, log });
  const r = await renderProject(compiled.resolved, compiled.paths, opts);
  updateMeta(compiled.paths, { status: "rendered", lastRenderMs: r.ms });
  let qa: QaReport;
  if (opts.skipQa || opts.frames) {
    qa = { ok: true, checks: [{ name: "skipped", ok: true, detail: "partial render or --skip-qa" }] } as QaReport;
  } else {
    qa = await runQa(compiled.resolved, compiled.paths);
    updateMeta(compiled.paths, { status: qa.ok ? "qa_passed" : "qa_failed" });
    for (const c of qa.checks) log(`${c.ok ? "pass" : "FAIL"} ${c.name}: ${c.detail}`);
  }
  return { ...compiled, renderMs: r.ms, qa };
}

export function loadResolved(paths: ProjectPaths): ResolvedManifest | null {
  if (!existsSync(paths.resolved)) return null;
  return ResolvedManifest.parse(JSON.parse(readFileSync(paths.resolved, "utf8")));
}
