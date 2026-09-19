import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { AlignmentFile, type Engine, type Manifest, type SceneAlignment, type VoiceFx } from "./schema/index.js";
import { ASSETS_DIR, PY_CHATTERBOX_DIR, PY_DIR, type ProjectPaths } from "./paths.js";

export type AudioProgress = (msg: string) => void;

type Scene = Manifest["scenes"][number];
const sceneSpeed = (m: Manifest, s: Scene) => s.speed ?? m.speed;
const sceneVoice = (m: Manifest, s: Scene) => s.voice ?? m.voice;
const sceneFx = (m: Manifest, s: Scene): VoiceFx => s.voiceFx ?? m.voiceFx;
const sceneEngine = (m: Manifest, s: Scene): Engine => s.engine ?? m.engine;
const sceneEmotion = (m: Manifest, s: Scene): number => s.emotion ?? m.emotion ?? 0.5;

/**
 * Chatterbox reference clip: a file name looked up in the project's clips/ first, then the shared assets/voices/.
 * Returns the absolute path, or null when the scene has no voiceRef.
 */
export function resolveVoiceRef(m: Manifest, s: Scene, p: ProjectPaths): string | null {
  const ref = s.voiceRef ?? m.voiceRef;
  if (!ref) return null;
  const candidates = [path.join(p.clipsDir, ref), path.join(ASSETS_DIR, "voices", ref), ref];
  const hit = candidates.find((c) => existsSync(c));
  if (!hit) throw new Error(`scene "${s.id}": voiceRef "${ref}" not found in ${p.clipsDir} or ${path.join(ASSETS_DIR, "voices")}`);
  return path.resolve(hit);
}

export function sceneHash(m: Manifest, s: Scene, p: ProjectPaths): string {
  const parts: unknown[] = [sceneVoice(m, s), sceneSpeed(m, s), sceneFx(m, s), s.speech ?? "", s.pauseAfter, s.silence ?? "", "v4"];
  const engine = sceneEngine(m, s);
  if (engine !== "kokoro") {
    // Engine, acting intensity and the reference clip (by size+mtime) all change the audio.
    const ref = s.speech !== undefined ? resolveVoiceRef(m, s, p) : null;
    const st = ref && existsSync(ref) ? statSync(ref) : null;
    parts.push("engine", engine, "cb3", sceneEmotion(m, s), ref ?? "", st?.size ?? 0, st?.mtimeMs ?? 0);
  }
  if (s.clip) {
    const f = path.join(p.clipsDir, s.clip.file);
    const st = existsSync(f) ? statSync(f) : null;
    parts.push("clip", s.clip.file, st?.size ?? 0, st?.mtimeMs ?? 0, s.clip.caption ?? "", s.clip.maxSeconds ?? 0, s.clip.pitch);
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
  const pitch = clip.pitch !== 1 ? `asetrate=24000*${clip.pitch},aresample=24000,atempo=1/${clip.pitch}` : "";
  const filters = ["aresample=24000", pitch, fx !== "none" ? FX_FILTERS[fx] : "", "apad"].filter(Boolean).join(",");
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
  // Jhin: refined, slightly lifted, speaking from behind porcelain — short metallic reflections + stage room.
  mask: "asetrate=24000*1.04,aresample=24000,atempo=1/1.04,highpass=f=110,equalizer=f=1900:t=q:w=1.3:g=4,equalizer=f=350:t=q:w=1.5:g=-2,aecho=0.8:0.45:9|17:0.3|0.18,aecho=0.7:0.4:70|140:0.2|0.1,alimiter=limit=0.95",
  // Batman: lower, compressed hard, soft-clipped for rasp, highs shaved, tight room.
  young: "asetrate=24000*1.12,aresample=24000,atempo=1/1.12,treble=g=2,aecho=0.6:0.2:14:0.08",
  growl: "asetrate=24000*0.88,aresample=24000,atempo=1/0.88,acompressor=threshold=-20dB:ratio=6:attack=4:release=90:makeup=4,volume=4dB,aeval=tanh(1.7*val(0)),equalizer=f=2200:t=q:w=1.4:g=3,treble=g=-5,bass=g=4:f=130,aecho=0.6:0.25:16:0.12,alimiter=limit=0.92",
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
  const spoken = pending.filter((s) => !s.clip && s.silence === undefined);
  const todo = spoken
    .filter((s) => sceneEngine(m, s) === "kokoro")
    .map((s) => ({ id: s.id, speech: s.speech!, pauseAfter: s.pauseAfter, speed: sceneSpeed(m, s), voice: sceneVoice(m, s), fx: sceneFx(m, s), hash: sceneHash(m, s, p) }));
  const todoChatterbox = spoken
    .filter((s) => sceneEngine(m, s) === "chatterbox")
    .map((s) => ({ id: s.id, speech: s.speech!, pauseAfter: s.pauseAfter, speed: sceneSpeed(m, s), voiceRef: resolveVoiceRef(m, s, p), emotion: sceneEmotion(m, s), seed: 0, fx: sceneFx(m, s), hash: sceneHash(m, s, p) }));

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
  }
  if (todoChatterbox.length > 0) {
    log(`chatterbox: synthesizing ${todoChatterbox.length} scene(s) (GPU model load ~15 s, then ~1 s per second of speech)`);
    const reqPath = path.join(p.build, "chatterbox.request.json");
    const outPath = path.join(p.build, "chatterbox.result.json");
    writeFileSync(reqPath, JSON.stringify({ scenes: todoChatterbox }));
    const proc = execa("uv", ["run", "vb-chatterbox", "synth", "--request", reqPath, "--out-dir", p.audioDir, "--out", outPath], {
      cwd: PY_CHATTERBOX_DIR,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", HF_HUB_DISABLE_PROGRESS_BARS: "1", PYTHONWARNINGS: "ignore" },
      all: true,
    });
    proc.all?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim() && !/it\/s\]|Inference\.\.\./.test(line)) log(line.trim());
    });
    await proc;
    const result = AlignmentFile.pick({ scenes: true }).parse(JSON.parse(readFileSync(outPath, "utf8")));
    fresh.push(...result.scenes);
    for (const sc of todoChatterbox) {
      if (sc.fx !== "none") {
        const dur = fresh.find((f) => f.sceneId === sc.id)?.duration ?? 0;
        log(`voice fx "${sc.fx}" on ${sc.id}`);
        await applyVoiceFx(path.join(p.audioDir, `${sc.id}.wav`), sc.fx, dur + sc.pauseAfter);
      }
    }
    rmSync(reqPath, { force: true });
    rmSync(outPath, { force: true });
  }
  if (todo.length === 0 && todoChatterbox.length === 0 && clipScenes.length === 0 && silentScenes.length === 0) {
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

  const engines = new Set(m.scenes.filter((s) => s.speech !== undefined).map((s) => sceneEngine(m, s)));
  const modelName = [engines.has("kokoro") ? "hexgrad/Kokoro-82M" : "", engines.has("chatterbox") ? "ResembleAI/chatterbox" : ""].filter(Boolean).join("+") || "hexgrad/Kokoro-82M";
  const alignment: AlignmentFile = {
    model: modelName,
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
