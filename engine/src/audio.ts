import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { AlignmentFile, type Manifest, type SceneAlignment } from "./schema/index.js";
import { PY_DIR, type ProjectPaths } from "./paths.js";

export type AudioProgress = (msg: string) => void;

export function sceneHash(m: Manifest, s: Manifest["scenes"][number]): string {
  return createHash("sha256")
    .update([m.voice, m.speed, s.speech, s.pauseAfter].join("|"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Synthesize voice + word timings for every scene whose text/voice/speed changed.
 * Unchanged scenes are reused from the existing alignment.json, so editing one
 * line of narration only re-synthesizes that scene.
 */
export async function ensureAudio(
  m: Manifest,
  p: ProjectPaths,
  opts: { force?: boolean; log?: AudioProgress } = {},
): Promise<AlignmentFile> {
  const log = opts.log ?? (() => {});
  mkdirSync(p.audioDir, { recursive: true });

  const previous = loadAlignment(p);
  const reusable = new Map<string, SceneAlignment & { hash: string }>();
  if (previous && !opts.force && previous.voice === m.voice && previous.speed === m.speed) {
    for (const s of previous.scenes) {
      if (existsSync(path.join(p.audioDir, s.file))) reusable.set(`${s.sceneId}:${s.hash}`, s);
    }
  }

  const todo = m.scenes
    .map((s) => ({ id: s.id, speech: s.speech, pauseAfter: s.pauseAfter, hash: sceneHash(m, s) }))
    .filter((s) => !reusable.has(`${s.id}:${s.hash}`));

  let fresh: (SceneAlignment & { hash: string })[] = [];
  if (todo.length > 0) {
    log(`synthesizing ${todo.length}/${m.scenes.length} scene(s) with ${m.voice} @ ${m.speed}x`);
    const reqPath = path.join(p.build, "tts.request.json");
    const outPath = path.join(p.build, "tts.result.json");
    writeFileSync(reqPath, JSON.stringify({ voice: m.voice, speed: m.speed, scenes: todo }));
    const proc = execa("uv", ["run", "vb-audio", "synth", "--request", reqPath, "--out-dir", p.audioDir, "--out", outPath], {
      cwd: PY_DIR,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", HF_HUB_DISABLE_PROGRESS_BARS: "1" },
      all: true,
    });
    proc.all?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) log(line.trim());
    });
    await proc;
    const result = AlignmentFile.parse(JSON.parse(readFileSync(outPath, "utf8")));
    fresh = result.scenes;
    rmSync(reqPath, { force: true });
    rmSync(outPath, { force: true });
  } else {
    log("audio up to date, nothing to synthesize");
  }

  const byId = new Map<string, SceneAlignment & { hash: string }>();
  for (const s of reusable.values()) byId.set(s.sceneId, s);
  for (const s of fresh) byId.set(s.sceneId, s);

  // Keep manifest order; drop scenes that no longer exist.
  const scenes = m.scenes.map((s) => {
    const a = byId.get(s.id);
    if (!a) throw new Error(`no alignment produced for scene "${s.id}"`);
    return a;
  });

  const alignment: AlignmentFile = {
    model: fresh.length > 0 ? "hexgrad/Kokoro-82M" : (previous?.model ?? "hexgrad/Kokoro-82M"),
    voice: m.voice,
    speed: m.speed,
    scenes,
  };
  writeFileSync(p.alignment, JSON.stringify(alignment, null, 2));
  return alignment;
}

export function loadAlignment(p: ProjectPaths): AlignmentFile | null {
  if (!existsSync(p.alignment)) return null;
  const parsed = AlignmentFile.safeParse(JSON.parse(readFileSync(p.alignment, "utf8")));
  return parsed.success ? parsed.data : null;
}
