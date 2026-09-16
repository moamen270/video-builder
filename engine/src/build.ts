import { copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { ensureAudio } from "./audio.js";
import { loadManifest, readMeta, updateMeta } from "./project.js";
import { renderProject, type RenderOptions } from "./render.js";
import { resolveManifest, type ResolveWarning } from "./resolver/resolve.js";
import { runQa, type QaReport } from "./qa.js";
import { ResolvedManifest, type Manifest } from "./schema/index.js";
import { nextVersion, type ProjectPaths, type VersionPaths } from "./paths.js";

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
  /** null for previews */
  version: VersionPaths | null;
  file: string;
}

const isPreview = (o: RenderOptions) => Boolean(o.frames) || (o.scale !== undefined && o.scale !== 1);

/**
 * Render an already-compiled project into a NEW version folder (or the preview
 * scratch dir), snapshot the inputs, run QA and record the version in project.json.
 */
export async function renderVersion(compiled: CompileResult, opts: RenderOptions & { skipQa?: boolean; note?: string } = {}): Promise<BuildResult> {
  const log = opts.log ?? (() => {});
  const { paths, resolved } = compiled;
  const target = isPreview(opts) ? null : nextVersion(paths);
  const r = await renderProject(resolved, paths, target, opts);
  if (!target) {
    const qa = { ok: true, checks: [{ name: "skipped", ok: true, detail: "preview render" }] } as QaReport;
    return { ...compiled, renderMs: r.ms, qa, version: null, file: r.file };
  }
  copyFileSync(paths.manifest, target.manifestSnapshot);
  writeFileSync(target.resolvedSnapshot, JSON.stringify(resolved, null, 2));
  updateMeta(paths, { status: "rendered", lastRenderMs: r.ms });

  let qa: QaReport;
  if (opts.skipQa) {
    qa = { ok: true, checks: [{ name: "skipped", ok: true, detail: "--skip-qa" }] } as QaReport;
  } else {
    qa = await runQa(resolved, target);
    updateMeta(paths, { status: qa.ok ? "qa_passed" : "qa_failed" });
    for (const c of qa.checks) log(`${c.ok ? "pass" : "FAIL"} ${c.name}: ${c.detail}`);
  }
  const meta = readMeta(paths)!;
  updateMeta(paths, {
    versions: [
      ...meta.versions,
      { n: target.n, at: new Date().toISOString(), seconds: resolved.durationInFrames / resolved.fps, renderMs: r.ms, qaOk: opts.skipQa ? null : qa.ok, manifestHash: resolved.meta.manifestHash, note: opts.note },
    ],
  });
  log(`version v${target.n} recorded`);
  return { ...compiled, renderMs: r.ms, qa, version: target, file: r.file };
}

/** Full pipeline: compile → render new version → QA. */
export async function buildProject(slug: string, opts: RenderOptions & { forceAudio?: boolean; skipQa?: boolean; note?: string } = {}): Promise<BuildResult> {
  const compiled = await compileProject(slug, { forceAudio: opts.forceAudio, log: opts.log });
  return renderVersion(compiled, opts);
}

export function loadResolved(paths: ProjectPaths): ResolvedManifest | null {
  if (!existsSync(paths.resolved)) return null;
  return ResolvedManifest.parse(JSON.parse(readFileSync(paths.resolved, "utf8")));
}
