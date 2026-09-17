import { interpolate } from "remotion";
import type { ResolvedExtra, ResolvedScene } from "@vb/engine/schema";
import type { WalkerAction } from "./Walker";

export interface MotionState {
  /** Left edge of the character rect. */
  x: number;
  /** Pixels above the layout ground line. */
  lift: number;
  action: WalkerAction;
  shadow: number;
  /** Landing impact 0–1 (front rig squash). */
  squash: number;
  /** Hidden entirely (before a drop-in, after a grapple exit). */
  hidden: boolean;
  /** Grapple cable anchor in scene px while swinging out. */
  cable: { x: number; y: number } | null;
}

/**
 * Hero entrance (drop from above) and exit (grapple swing to the top corner).
 * Returned offsets are added to whatever travel/jump produced.
 */
export function heroEntranceExit(scene: ResolvedScene, abs: number, rect: { x: number; y: number; w: number; h: number }): Pick<MotionState, "lift" | "squash" | "hidden" | "cable"> & { dx: number } {
  const c = scene.character!;
  let lift = 0;
  let squash = 0;
  let hidden = false;
  let dx = 0;
  let cable: { x: number; y: number } | null = null;
  const en = c.entrance;
  if (en) {
    if (abs < en.atFrame) hidden = true;
    else if (abs < en.landFrame) {
      const t = (abs - en.atFrame) / Math.max(1, en.landFrame - en.atFrame);
      lift = (rect.y + rect.h + 200) * (1 - t * t); // gravity: accelerates into the ground
    } else {
      const k = abs - en.landFrame;
      squash = interpolate(k, [0, 2, 9], [0, 1, 0], { extrapolateRight: "clamp" });
    }
  }
  const ex = c.exit;
  if (ex && abs >= ex.atFrame) {
    const t = Math.min(1, (abs - ex.atFrame) / Math.max(1, ex.endFrame - ex.atFrame));
    const e = t * t; // accelerate away
    cable = { x: 1080 + 140, y: -160 };
    dx = (cable.x - (rect.x + rect.w / 2)) * e;
    lift = (rect.y + rect.h + 300) * e; // arc up and out
    if (t >= 1) hidden = true;
  }
  return { lift, squash, hidden, dx, cable };
}

/** Extras: centre x in px from travel (frozen once knocked out), plus walk/stand action. */
export function extraMotionAt(e: ResolvedExtra, abs: number): { cx: number; action: WalkerAction } {
  const tr = e.travel;
  const f = e.koFrame !== null && abs > e.koFrame ? e.koFrame : abs;
  const xAt = (fr: number) => (tr ? interpolate(fr, [tr.startFrame, Math.max(tr.startFrame + 1, tr.endFrame)], [tr.fromX, tr.toX], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : e.x);
  const cx = xAt(f);
  const moving = tr ? Math.abs(xAt(f + 1) - cx) > 0.05 : false;
  return { cx, action: moving ? { kind: "walk" } : { kind: "stand" } };
}

/**
 * Resolve travel + jump cues into a position and a Walker action for one frame.
 * Walking is inferred from horizontal velocity, so he stands still when travel
 * has finished and before the jump begins.
 */
export function motionAt(scene: ResolvedScene, baseX: number, abs: number): MotionState {
  const c = scene.character!;
  const tr = c.travel;
  const j = c.jump;

  const travelX = (f: number) =>
    tr ? interpolate(f, [tr.startFrame, Math.max(tr.startFrame + 1, tr.endFrame)], [tr.fromX, tr.toX], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : baseX;

  const base = { squash: 0, hidden: false, cable: null };
  if (!j || abs < j.atFrame) {
    const x = travelX(abs);
    const moving = tr ? Math.abs(travelX(abs + 1) - x) > 0.05 : false;
    return { ...base, x, lift: 0, action: moving ? { kind: "walk" } : { kind: "stand" }, shadow: 1 };
  }

  const crouchEnd = j.atFrame + j.crouchFrames;
  const airEnd = crouchEnd + j.airFrames;
  const landEnd = airEnd + j.landFrames;
  const settleEnd = landEnd + j.settleFrames;

  if (abs < crouchEnd) return { ...base, x: j.fromX, lift: 0, action: { kind: "crouch", t: (abs - j.atFrame) / j.crouchFrames }, shadow: 1 };
  if (abs < airEnd) {
    const t = (abs - crouchEnd) / j.airFrames;
    const apex = 90 + j.height * 0.35; // clearance above the straight line from take-off to landing
    const lift = j.height * t + apex * 4 * t * (1 - t);
    const x = j.fromX + (j.toX - j.fromX) * t; // constant horizontal velocity, like a real projectile
    return { ...base, x, lift, action: { kind: "air", t }, shadow: 1 - 0.55 * 4 * t * (1 - t) };
  }
  if (abs < landEnd) return { ...base, x: j.toX, lift: j.height, action: { kind: "land", t: (abs - airEnd) / j.landFrames }, shadow: 1 };
  if (abs < settleEnd) return { ...base, x: j.toX, lift: j.height, action: { kind: "settle", t: (abs - landEnd) / j.settleFrames }, shadow: 1 };
  return { ...base, x: j.toX, lift: j.height, action: { kind: "stand" }, shadow: 1 };
}
