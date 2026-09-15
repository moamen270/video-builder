import { existsSync, readFileSync } from "node:fs";
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
    outputDir: path.join(root, "output"),
    finalMp4: path.join(root, "output", "final.mp4"),
    qaReport: path.join(root, "output", "qa.json"),
    contactSheet: path.join(root, "output", "contact.png"),
  };
}
export type ProjectPaths = ReturnType<typeof projectPaths>;

export function projectExists(slug: string): boolean {
  return existsSync(projectPaths(slug).manifest);
}
