import os from "node:os";
import { execa } from "execa";
import { PY_DIR, RENDERER_DIR } from "./paths.js";

export interface DoctorCheck { name: string; ok: boolean; detail: string }

async function probe(cmd: string, args: string[], cwd?: string): Promise<{ ok: boolean; out: string }> {
  try {
    const r = await execa(cmd, args, { cwd, all: true, reject: false, timeout: 120_000, shell: process.platform === "win32" });
    return { ok: r.exitCode === 0, out: (r.all ?? "").toString().trim() };
  } catch (e) {
    return { ok: false, out: (e as Error).message };
  }
}

export async function doctor(): Promise<{ ok: boolean; checks: DoctorCheck[] }> {
  const checks: DoctorCheck[] = [];
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "node", ok: major >= 22, detail: `v${process.versions.node}, ${os.cpus().length} cores` });

  const ff = await probe("ffmpeg", ["-version"]);
  checks.push({ name: "ffmpeg", ok: ff.ok, detail: ff.ok ? ff.out.split("\n")[0]!.slice(0, 60) : "not on PATH (winget install Gyan.FFmpeg)" });
  // A real 3-frame test encode: the encoder can be compiled in but rejected by the driver.
  const enc = await probe("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=256x256:d=0.1", "-c:v", "h264_nvenc", "-f", "null", "-"]);
  const why = enc.out.split(/\r?\n/).find((l) => /driver|nvenc/i.test(l))?.trim();
  checks.push({ name: "nvenc", ok: true, detail: enc.ok ? "h264_nvenc works" : `unavailable — ${why ?? "encoder failed"}; --nvenc falls back to x264` });

  const gpu = await probe("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader"]);
  checks.push({ name: "gpu", ok: true, detail: gpu.ok ? gpu.out : "no nvidia-smi" });

  const uv = await probe("uv", ["--version"]);
  checks.push({ name: "uv", ok: uv.ok, detail: uv.ok ? uv.out : "not on PATH (winget install astral-sh.uv)" });

  const py = await probe("uv", ["run", "vb-audio", "doctor"], PY_DIR);
  checks.push({ name: "vb-audio", ok: py.ok, detail: py.ok ? py.out.split("\n").filter((l) => !l.startsWith("{")).join("; ") : py.out.slice(-300) });

  const rem = await probe("npx", ["remotion", "versions"], RENDERER_DIR);
  checks.push({ name: "remotion", ok: rem.ok, detail: rem.ok ? rem.out.split("\n").find((l) => /remotion/i.test(l))?.trim() ?? "ok" : "npm install needed" });

  return { ok: checks.every((c) => c.ok), checks };
}
