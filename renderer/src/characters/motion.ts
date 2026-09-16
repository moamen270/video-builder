import { interpolate } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";
import type { WalkerAction } from "./Walker";

export interface MotionState {
  /** Left edge of the character rect. */
  x: number;
  /** Pixels above the layout ground line. */
  lift: number;
  action: WalkerAction;
  shadow: number;
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

  if (!j || abs < j.atFrame) {
    const x = travelX(abs);
    const moving = tr ? Math.abs(travelX(abs + 1) - x) > 0.05 : false;
    return { x, lift: 0, action: moving ? { kind: "walk" } : { kind: "stand" }, shadow: 1 };
  }

  const crouchEnd = j.atFrame + j.crouchFrames;
  const airEnd = crouchEnd + j.airFrames;
  const landEnd = airEnd + j.landFrames;
  const settleEnd = landEnd + j.settleFrames;

  if (abs < crouchEnd) return { x: j.fromX, lift: 0, action: { kind: "crouch", t: (abs - j.atFrame) / j.crouchFrames }, shadow: 1 };
  if (abs < airEnd) {
    const t = (abs - crouchEnd) / j.airFrames;
    const apex = 90 + j.height * 0.35; // clearance above the straight line from take-off to landing
    const lift = j.height * t + apex * 4 * t * (1 - t);
    const x = j.fromX + (j.toX - j.fromX) * t; // constant horizontal velocity, like a real projectile
    return { x, lift, action: { kind: "air", t }, shadow: 1 - 0.55 * 4 * t * (1 - t) };
  }
  if (abs < landEnd) return { x: j.toX, lift: j.height, action: { kind: "land", t: (abs - airEnd) / j.landFrames }, shadow: 1 };
  if (abs < settleEnd) return { x: j.toX, lift: j.height, action: { kind: "settle", t: (abs - landEnd) / j.settleFrames }, shadow: 1 };
  return { x: j.toX, lift: j.height, action: { kind: "stand" }, shadow: 1 };
}
