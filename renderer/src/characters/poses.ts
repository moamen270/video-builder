import type { Pose } from "@vb/engine/schema";

/**
 * Joint angles in degrees. Arms: 0 = hanging straight down, positive swings the
 * limb toward screen-right, so the left arm (screen-left) uses negative values to
 * move outward. Lower joints are relative to their parent. Head/torso: positive = tilt right.
 */
export interface Rig {
  lUpper: number;
  lLower: number;
  rUpper: number;
  rLower: number;
  lThigh: number;
  lShin: number;
  rThigh: number;
  rShin: number;
  head: number;
  torso: number;
  /** Vertical offset of the whole body (px in rig space, negative = up). */
  lift: number;
  /** Head nod forward/back — positive = chin down. */
  nod: number;
}

export const RIGS: Record<Pose, Rig> = {
  idle: { lUpper: -8, lLower: -6, rUpper: 8, rLower: 6, lThigh: -7, lShin: 0, rThigh: 7, rShin: 0, head: 0, torso: 0, lift: 0, nod: 0 },
  explaining: { lUpper: -55, lLower: -55, rUpper: 55, rLower: 55, lThigh: -8, lShin: 0, rThigh: 8, rShin: 0, head: 3, torso: 0, lift: 0, nod: 2 },
  pointing_left: { lUpper: -98, lLower: 0, rUpper: 12, rLower: 10, lThigh: -10, lShin: 0, rThigh: 6, rShin: 0, head: -8, torso: -4, lift: 0, nod: 0 },
  pointing_right: { lUpper: -12, lLower: -10, rUpper: 98, rLower: 0, lThigh: -6, lShin: 0, rThigh: 10, rShin: 0, head: 8, torso: 4, lift: 0, nod: 0 },
  pointing_up: { lUpper: -10, lLower: -8, rUpper: 118, rLower: 42, lThigh: -7, lShin: 0, rThigh: 7, rShin: 0, head: -6, torso: 0, lift: -4, nod: -8 },
  shocked: { lUpper: -122, lLower: -38, rUpper: 122, rLower: 38, lThigh: -18, lShin: 4, rThigh: 18, rShin: -4, head: 0, torso: -2, lift: -14, nod: -12 },
  thinking: { lUpper: -10, lLower: -8, rUpper: 28, rLower: 128, lThigh: -6, lShin: 0, rThigh: 8, rShin: 0, head: 10, torso: 2, lift: 0, nod: 6 },
  facepalm: { lUpper: -12, lLower: -8, rUpper: 22, rLower: 150, lThigh: -7, lShin: 0, rThigh: 7, rShin: 0, head: 4, torso: 3, lift: 2, nod: 22 },
  celebrating: { lUpper: -148, lLower: -18, rUpper: 148, rLower: 18, lThigh: -22, lShin: 6, rThigh: 22, rShin: -6, head: 0, torso: 0, lift: -22, nod: -10 },
  typing: { lUpper: -35, lLower: -70, rUpper: 35, rLower: 70, lThigh: -8, lShin: 0, rThigh: 8, rShin: 0, head: 0, torso: 0, lift: 0, nod: 12 },
  shrugging: { lUpper: -70, lLower: -110, rUpper: 70, rLower: 110, lThigh: -8, lShin: 0, rThigh: 8, rShin: 0, head: 12, torso: 0, lift: -4, nod: 0 },
  waving: { lUpper: -10, lLower: -8, rUpper: 150, rLower: 35, lThigh: -7, lShin: 0, rThigh: 7, rShin: 0, head: -5, torso: 0, lift: 0, nod: 0 },
  presenting: { lUpper: -85, lLower: -30, rUpper: 10, rLower: 8, lThigh: -8, lShin: 0, rThigh: 8, rShin: 0, head: -6, torso: -3, lift: 0, nod: 0 },
  leaning: { lUpper: -14, lLower: -10, rUpper: 30, rLower: 20, lThigh: -14, lShin: 6, rThigh: 4, rShin: 0, head: -6, torso: 12, lift: 4, nod: 0 },
  claws_out: { lUpper: -42, lLower: -30, rUpper: 42, rLower: 30, lThigh: -20, lShin: 8, rThigh: 20, rShin: -8, head: 0, torso: 0, lift: 6, nod: 14 },
  slash_left: { lUpper: -96, lLower: 12, rUpper: 55, rLower: 60, lThigh: -26, lShin: 10, rThigh: 8, rShin: 0, head: -10, torso: -12, lift: 2, nod: 6 },
  slash_right: { lUpper: -55, lLower: -60, rUpper: 96, rLower: -12, lThigh: -8, lShin: 0, rThigh: 26, rShin: -10, head: 10, torso: 12, lift: 2, nod: 6 },
  laughing: { lUpper: -28, lLower: -118, rUpper: 28, rLower: 118, lThigh: -12, lShin: 0, rThigh: 12, rShin: 0, head: 0, torso: -6, lift: -2, nod: -24 },
};

/** Poses that should snap rather than ease (attacks). */
export const SNAP_POSES: ReadonlySet<Pose> = new Set<Pose>(["slash_left", "slash_right", "claws_out"]);

export const RIG_KEYS = Object.keys(RIGS.idle) as (keyof Rig)[];

export function lerpRig(a: Rig, b: Rig, t: number): Rig {
  const out = {} as Rig;
  for (const k of RIG_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}
