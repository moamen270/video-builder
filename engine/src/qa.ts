import { existsSync, statSync, writeFileSync } from "node:fs";
import { execa } from "execa";
import { VIDEO, type ResolvedManifest } from "./schema/index.js";
import type { ProjectPaths } from "./paths.js";

export interface QaCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface QaReport {
  ok: boolean;
  file: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
  expectedSec: number;
  fps: number;
  hasAudio: boolean;
  /** Mean luminance (0–255) sampled every 5 s; flags black/white frames. */
  luminance: number[];
  contactSheet: string | null;
  checks: QaCheck[];
}

/**
 * Deterministic technical QA on the rendered MP4. No taste judgments — that's
 * for the agent looking at the contact sheet.
 */
export async function runQa(resolved: ResolvedManifest, p: ProjectPaths): Promise<QaReport> {
  const checks: QaCheck[] = [];
  const file = p.finalMp4;
  if (!existsSync(file)) {
    const report: QaReport = {
      ok: false, file, sizeBytes: 0, width: 0, height: 0, durationSec: 0,
      expectedSec: resolved.durationInFrames / resolved.fps, fps: 0, hasAudio: false,
      luminance: [], contactSheet: null,
      checks: [{ name: "file_exists", ok: false, detail: `missing ${file}` }],
    };
    writeFileSync(p.qaReport, JSON.stringify(report, null, 2));
    return report;
  }

  const probe = await ffprobe(file);
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  const width = v?.width ?? 0;
  const height = v?.height ?? 0;
  const durationSec = Number(probe.format.duration ?? 0);
  const expectedSec = resolved.durationInFrames / resolved.fps;
  const fps = v ? evalRatio(v.r_frame_rate) : 0;
  const sizeBytes = statSync(file).size;

  checks.push({ name: "dimensions", ok: width === VIDEO.width && height === VIDEO.height, detail: `${width}x${height}` });
  checks.push({ name: "fps", ok: Math.abs(fps - VIDEO.fps) < 0.01, detail: `${fps.toFixed(2)}` });
  checks.push({
    name: "duration_matches_manifest",
    ok: Math.abs(durationSec - expectedSec) <= 2 / VIDEO.fps + 0.05,
    detail: `got ${durationSec.toFixed(2)}s, expected ${expectedSec.toFixed(2)}s`,
  });
  checks.push({ name: "under_platform_cap", ok: durationSec <= VIDEO.maxDurationSec, detail: `${durationSec.toFixed(1)}s ≤ ${VIDEO.maxDurationSec}s` });
  checks.push({ name: "audio_stream", ok: Boolean(a), detail: a ? `${a.codec_name} ${a.sample_rate}Hz` : "none" });
  checks.push({ name: "h264_yuv420p", ok: v?.codec_name === "h264" && (v?.pix_fmt === "yuv420p" || v?.pix_fmt === "yuvj420p"), detail: `${v?.codec_name} ${v?.pix_fmt}` });
  checks.push({ name: "file_size_sane", ok: sizeBytes > 200_000, detail: `${(sizeBytes / 1e6).toFixed(2)} MB` });

  const luminance = await sampleLuminance(file);
  const dead = luminance.filter((l) => l < 8 || l > 247).length;
  checks.push({ name: "no_blank_frames", ok: dead === 0, detail: `${dead}/${luminance.length} samples are black/white` });

  const loud = await measureLoudness(file);
  checks.push({
    name: "voice_audible",
    ok: loud !== null && loud > -30,
    detail: loud === null ? "could not measure" : `mean volume ${loud.toFixed(1)} dB`,
  });

  let contactSheet: string | null = null;
  try {
    await contactSheetPng(file, p.contactSheet, durationSec);
    contactSheet = p.contactSheet;
  } catch (e) {
    checks.push({ name: "contact_sheet", ok: false, detail: (e as Error).message.split("\n")[0] ?? "failed" });
  }

  const report: QaReport = {
    ok: checks.every((c) => c.ok), file, sizeBytes, width, height, durationSec, expectedSec, fps,
    hasAudio: Boolean(a), luminance, contactSheet, checks,
  };
  writeFileSync(p.qaReport, JSON.stringify(report, null, 2));
  return report;
}

interface ProbeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate: string;
  sample_rate?: string;
}

async function ffprobe(file: string): Promise<{ streams: ProbeStream[]; format: { duration?: string } }> {
  const { stdout } = await execa("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  return JSON.parse(stdout);
}

const evalRatio = (r: string) => {
  const [n, d] = r.split("/").map(Number);
  return d ? n! / d : n!;
};

/** Grab one 8x8 grayscale thumbnail every 5 s and average it. 64 bytes per sample. */
async function sampleLuminance(file: string): Promise<number[]> {
  const { stdout } = await execa(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vf", "fps=1/5,scale=8:8,format=gray", "-f", "rawvideo", "-"],
    { encoding: "buffer" },
  );
  const out: number[] = [];
  for (let i = 0; i + 64 <= stdout.length; i += 64) {
    let sum = 0;
    for (let j = 0; j < 64; j++) sum += stdout[i + j]!;
    out.push(Math.round(sum / 64));
  }
  return out;
}

async function measureLoudness(file: string): Promise<number | null> {
  const { all } = await execa("ffmpeg", ["-i", file, "-af", "volumedetect", "-vn", "-f", "null", "-"], { all: true, reject: false });
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(all ?? "");
  return m ? Number(m[1]) : null;
}

/** 4x3 grid of 270x480 frames (1080x1440) for an agent's vision pass. */
async function contactSheetPng(file: string, out: string, durationSec: number) {
  const every = Math.max(0.5, durationSec / 12);
  await execa("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `fps=1/${every.toFixed(3)},scale=270:480,tile=4x3`, "-frames:v", "1", out]);
}
