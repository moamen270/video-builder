import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { AlignmentFile, type Manifest, type SceneAlignment, type VoiceFx } from "./schema/index.js";
import { PY_DIR, type ProjectPaths } from "./paths.js";

export type AudioProgress = (msg: string) => void;

type Scene = Manifest["scenes"][number];
const sceneSpeed = (m: Manifest, s: Scene) => s.speed ?? m.speed;
const sceneFx = (m: Manifest, s: Scene): VoiceFx => s.voiceFx ?? m.voiceFx;

export function sceneHash(m: Manifest, s: Scene, p: ProjectPaths): string {
  const parts: unknown[] = [m.voice, sceneSpeed(m, s), sceneFx(m, s), s.speech ?? "", s.pauseAfter, s.silence ?? "", "v3"];
  if (s.clip) {
    const f = path.join(p.clipsDir, s.clip.file);
    const st = existsSync(f) ? statSync(f) : null;
    parts.push("clip", s.clip.file, st?.size ?? 0, st?.mtimeMs ?? 0, s.clip.caption ?? "", s.clip.maxSeconds ?? 0);
  }
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

/** A silent scene: N seconds of nothing so the visuals (and music) carry it. */
async function makeSilence(s: Scene, p: ProjectPaths, hash: string): Promise<SceneAlignment & { hash: string }> {
  const dest = path.join(p.audioDir, `${s.id}.wav`);
  const dur = s.silence!;
  await execa("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", (dur + s.pauseAfter).toFixed(4), dest]);
  return { sceneId: s.id, file: path.basename(dest), duration: dur, sampleRate: 24000, tokens: [], hash };
}

/** Copy a pre-recorded clip into the scene slot: mono 24 kHz, trimmed, padded with pauseAfter. */
async function importClip(m: Manifest, s: Scene, p: ProjectPaths, hash: string): Promise<SceneAlignment & { hash: string }> {
  const clip = s.clip!;
  const src = path.join(p.clipsDir, clip.file);
  if (!existsSync(src)) throw new Error(`scene "${s.id}": clip not found at ${src}`);
  const dest = path.join(p.audioDir, `${s.id}.wav`);
  const trim = clip.maxSeconds ? ["-t", String(clip.maxSeconds)] : [];
  // Measure the speech part first (trimmed), then write it padded with silence.
  const probe = await execa("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]);
  const raw = Number(probe.stdout.trim());
  const duration = clip.maxSeconds ? Math.min(raw, clip.maxSeconds) : raw;
  const fx = sceneFx(m, s);
  const filters = ["aresample=24000", fx !== "none" ? FX_FILTERS[fx] : "", "apad"].filter(Boolean).join(",");
  await execa("ffmpeg", ["-y", "-v", "error", ...trim, "-i", src, "-af", filters, "-t", (duration + s.pauseAfter).toFixed(4), "-ar", "24000", "-ac", "1", dest]);
  const tokens = clip.caption ? [{ text: clip.caption, start: 0, end: Number(duration.toFixed(3)), ws: "" }] : [];
  return { sceneId: s.id, file: path.basename(dest), duration: Number(duration.toFixed(4)), sampleRate: 24000, tokens, hash };
}

/**
 * ffmpeg filter chains for voice post-processing. Pitch is lowered by resampling
 * and the tempo restored with atempo, so word timestamps stay valid.
 */
const FX_FILTERS: Record<Exclude<VoiceFx, "none">, string> = {
  deep: "asetrate=24000*0.88,aresample=24000,atempo=1/0.88,bass=g=4:f=140,aecho=0.7:0.35:28:0.18",
  theatre: "bass=g=2:f=160,aecho=0.75:0.5:55|120:0.22|0.12",
  villain: "asetrate=24000*0.80,aresample=24000,atempo=1/0.80,bass=g=8:f=120,aecho=0.8:0.6:45|95|170:0.42|0.28|0.16,alimiter=limit=0.95",
};

async function applyVoiceFx(file: string, fx: VoiceFx, seconds: number) {
  if (fx === "none") return;
  const tmp = file.replace(/\.wav$/, ".fx.wav");
  // atempo drifts slightly at strong ratios; pin the length so scenes never overlap.
  await execa("ffmpeg", ["-y", "-v", "error", "-i", file, "-af", `${FX_FILTERS[fx]},apad`, "-t", seconds.toFixed(4), "-ar", "24000", "-ac", "1", tmp]);
  rmSync(file, { force: true });
  renameSync(tmp, file);
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

  const pending = m.scenes.filter((s) => !reusable.has(`${s.id}:${sceneHash(m, s, p)}`));
  const clipScenes = pending.filter((s) => s.clip);
  const silentScenes = pending.filter((s) => s.silence !== undefined);
  const todo = pending
    .filter((s) => !s.clip && s.silence === undefined)
    .map((s) => ({ id: s.id, speech: s.speech!, pauseAfter: s.pauseAfter, speed: sceneSpeed(m, s), fx: sceneFx(m, s), hash: sceneHash(m, s, p) }));

  let fresh: (SceneAlignment & { hash: string })[] = [];
  for (const s of clipScenes) {
    log(`importing clip ${s.clip!.file} for ${s.id}`);
    fresh.push(await importClip(m, s, p, sceneHash(m, s, p)));
  }
  for (const s of silentScenes) {
    log(`${s.silence}s of silence for ${s.id}`);
    fresh.push(await makeSilence(s, p, sceneHash(m, s, p)));
  }
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
    fresh.push(...result.scenes);
    for (const sc of todo) {
      if (sc.fx !== "none") {
        const dur = fresh.find((f) => f.sceneId === sc.id)?.duration ?? 0;
        log(`voice fx "${sc.fx}" on ${sc.id}`);
        await applyVoiceFx(path.join(p.audioDir, `${sc.id}.wav`), sc.fx, dur + sc.pauseAfter);
      }
    }
    rmSync(reqPath, { force: true });
    rmSync(outPath, { force: true });
  } else if (clipScenes.length === 0 && silentScenes.length === 0) {
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
