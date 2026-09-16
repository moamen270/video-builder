import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { RENDERER_DIR, type ProjectPaths, type VersionPaths } from "./paths.js";
import type { ResolvedManifest } from "./schema/index.js";

export interface RenderOptions {
  /** Chrome tabs rendering in parallel. Default: cores - 1, capped at 8. */
  concurrency?: number;
  /** Render only these frames (e.g. "0-90") — for quick previews. */
  frames?: string;
  /** Downscale for previews (0.25–1). */
  scale?: number;
  /** Encode via ffmpeg h264_nvenc from an image sequence instead of Remotion's x264. */
  nvenc?: boolean;
  log?: (line: string) => void;
}

export interface RenderResult {
  file: string;
  ms: number;
  frames: number;
  /** Version number, or null for previews. */
  version: number | null;
}

export const COMPOSITION_ID = "Short";

/**
 * Render the resolved manifest with the Remotion CLI into a version folder
 * (`target`), or into output/preview when `target` is null.
 * The project's build/ dir is the public dir, so `staticFile("audio/hook.wav")`
 * resolves inside the project.
 */
export async function renderProject(resolved: ResolvedManifest, p: ProjectPaths, target: VersionPaths | null, opts: RenderOptions = {}): Promise<RenderResult> {
  const log = opts.log ?? (() => {});
  const isPreview = target === null;
  const outDir = isPreview ? p.previewDir : target.dir;
  const outFile = isPreview ? path.join(p.previewDir, "preview.mp4") : target.finalMp4;
  if (!isPreview && existsSync(outFile)) throw new Error(`refusing to overwrite ${outFile} — versions are immutable`);
  mkdirSync(outDir, { recursive: true });
  const concurrency = opts.concurrency ?? Math.min(8, Math.max(1, os.cpus().length - 1));
  const t0 = performance.now();

  const propsPath = path.join(p.build, "render.props.json");
  writeFileSync(propsPath, JSON.stringify(resolved));

  const common = [
    "remotion",
    "render",
    "src/index.ts",
    COMPOSITION_ID,
    `--props=${propsPath}`,
    `--public-dir=${p.build}`,
    `--concurrency=${concurrency}`,
    "--log=warn",
  ];
  if (opts.frames) common.push(`--frames=${opts.frames}`);
  if (opts.scale && opts.scale !== 1) common.push(`--scale=${opts.scale}`);

  if (opts.nvenc) {
    const seqDir = path.join(outDir, "frames");
    const mixWav = path.join(outDir, "mix.wav");
    mkdirSync(seqDir, { recursive: true });
    log(`rendering image sequence (concurrency ${concurrency})…`);
    await run(["npx", ...common, "--sequence", "--image-format=jpeg", "--jpeg-quality=95", seqDir], log);
    log("rendering mixed audio track…");
    await run(["npx", ...common.filter((a) => !a.startsWith("--scale")), "--codec=wav", mixWav], log);
    log("encoding with h264_nvenc…");
    await encodeNvenc(seqDir, mixWav, resolved.fps, outFile, log);
    rmSync(seqDir, { recursive: true, force: true });
    rmSync(mixWav, { force: true });
  } else {
    log(`rendering ${resolved.durationInFrames} frames (concurrency ${concurrency})…`);
    await run(["npx", ...common, "--codec=h264", "--crf=18", "--pixel-format=yuv420p", outFile], log);
  }

  if (!isPreview) {
    log("mastering audio to -14 LUFS…");
    await masterLoudness(outFile, log);
  }

  const ms = Math.round(performance.now() - t0);
  log(`done in ${(ms / 1000).toFixed(1)}s → ${outFile}`);
  return { file: outFile, ms, frames: resolved.durationInFrames, version: isPreview ? null : target.n };
}

async function run(argv: string[], log: (l: string) => void) {
  const [cmd, ...args] = argv as [string, ...string[]];
  const proc = execa(cmd, args, { cwd: RENDERER_DIR, all: true, shell: process.platform === "win32" });
  proc.all?.on("data", (c: Buffer) => {
    for (const line of c.toString().split(/\r?\n/)) if (line.trim()) log(line.trim());
  });
  await proc;
}

/**
 * NVENC path: mux Remotion's JPEG sequence with its own mixed audio via ffmpeg on
 * the GPU. Falls back to libx264 (same inputs) if the driver rejects NVENC —
 * FFmpeg 9 needs NVIDIA driver ≥ 610.
 */
async function encodeNvenc(seqDir: string, mixWav: string, fps: number, out: string, log: (l: string) => void) {
  const inputs = ["-y", "-v", "error", "-framerate", String(fps), "-i", path.join(seqDir, "element-%04d.jpeg"), "-i", mixWav, "-map", "0:v", "-map", "1:a"];
  const tail = ["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out];
  const nvenc = ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", "19", "-b:v", "0"];
  const x264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "18"];
  const r = await execa("ffmpeg", [...inputs, ...nvenc, ...tail], { all: true, reject: false });
  if (r.exitCode === 0) return;
  const reason = (r.all ?? "").split(/\r?\n/).find((l) => /nvenc|driver/i.test(l)) ?? "unknown error";
  log(`warn: h264_nvenc unavailable (${reason.trim()}); encoding with libx264 instead`);
  await execa("ffmpeg", [...inputs, ...x264, ...tail]);
}
/**
 * Two-pass-free loudness normalisation to the Shorts/TikTok target (-14 LUFS,
 * -1.5 dBTP). Video stream is copied, so this costs ~1 s.
 */
async function masterLoudness(file: string, log: (l: string) => void) {
  const tmp = file.replace(/\.mp4$/, ".master.mp4");
  try {
    await execa("ffmpeg", ["-y", "-v", "error", "-i", file, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", tmp]);
    renameSync(tmp, file);
  } catch (e) {
    log(`warn: loudness master skipped (${(e as Error).message.split("\n")[0]})`);
    rmSync(tmp, { force: true });
  }
}
