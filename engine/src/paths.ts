import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root = two levels above engine/src. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PROJECTS_DIR = path.join(ROOT, "projects");
export const ASSETS_DIR = path.join(ROOT, "assets");
export const RENDERER_DIR = path.join(ROOT, "renderer");
export const PY_DIR = path.join(ROOT, "py");
export const SKILLS_DIR = path.join(ROOT, ".claude", "skills");

export const ENGINE_VERSION: string = JSON.parse(
  readFileSync(path.join(ROOT, "engine", "package.json"), "utf8"),
).version;

/**
 * Layout of one video project. `build/` is the Remotion public dir, so everything
 * the renderer needs at render time lives under it and nothing else does.
 */
export function projectPaths(slug: string) {
  const root = path.join(PROJECTS_DIR, slug);
  const build = path.join(root, "build");
  return {
    root,
    manifest: path.join(root, "manifest.json"),
    projectJson: path.join(root, "project.json"),
    build,
    audioDir: path.join(build, "audio"),
    alignment: path.join(build, "alignment.json"),
    resolved: path.join(build, "manifest.resolved.json"),
    buildAssets: path.join(build, "assets"),
    /** Pre-recorded audio referenced by `scene.clip.file` (laughs, stingers). */
    clipsDir: path.join(root, "clips"),
    outputDir: path.join(root, "output"),
    /** Non-versioned scratch output for --frames/--scale previews. */
    previewDir: path.join(root, "output", "preview"),
  };
}
export type ProjectPaths = ReturnType<typeof projectPaths>;

/**
 * Renders are immutable: each one lives in output/v<N>/ with everything needed
 * to judge and reproduce it. Nothing here is ever overwritten.
 */
export function versionPaths(p: ProjectPaths, n: number) {
  const dir = path.join(p.outputDir, `v${n}`);
  return {
    n,
    dir,
    finalMp4: path.join(dir, "final.mp4"),
    qaReport: path.join(dir, "qa.json"),
    contactSheet: path.join(dir, "contact.png"),
    manifestSnapshot: path.join(dir, "manifest.json"),
    resolvedSnapshot: path.join(dir, "manifest.resolved.json"),
    /** Ready-to-paste title/description/tags per platform. */
    social: path.join(dir, "social.md"),
    /** Reviewer pack: frame strips per scene, facts, checklist, report. */
    reviewDir: path.join(dir, "review"),
  };
}
export type VersionPaths = ReturnType<typeof versionPaths>;

export function listVersions(p: ProjectPaths): number[] {
  if (!existsSync(p.outputDir)) return [];
  return readdirSync(p.outputDir)
    .map((d) => /^v(\d+)$/.exec(d)?.[1])
    .filter((x): x is string => Boolean(x))
    .map(Number)
    .sort((a, b) => a - b);
}

export function latestVersion(p: ProjectPaths): VersionPaths | null {
  const vs = listVersions(p);
  return vs.length ? versionPaths(p, vs[vs.length - 1]!) : null;
}

export function nextVersion(p: ProjectPaths): VersionPaths {
  const vs = listVersions(p);
  return versionPaths(p, (vs[vs.length - 1] ?? 0) + 1);
}

export function projectExists(slug: string): boolean {
  return existsSync(projectPaths(slug).manifest);
}
