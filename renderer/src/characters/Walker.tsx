import React from "react";
import type { Rect } from "../theme";

/**
 * Side-view stickman: procedural walk cycle plus a jump state machine
 * (crouch → air → land → settle → stand). Drawn facing screen-right in the same
 * 240×420 rig space as the front rig; `facingLeft` mirrors it. No face toward
 * the camera — one eye and a nose bump looking where he goes.
 *
 * Leg poses are given as joint angles; the body is then dropped so the stance
 * foot stays on the ground line. That single rule gives free squash on crouch,
 * landing absorb and rebound.
 */
const RW = 240;
const RH = 420;
const HEAD_R = 34;
const HIP = { x: 120, y: 240 };
const SHOULDER_Y = 118;
const NECK_Y = 96;
const UPPER_ARM = 62;
const FORE_ARM = 56;
const THIGH = 78;
const SHIN = 76;
const STROKE = 11;
const GROUND_Y = HIP.y + THIGH + SHIN; // 394: foot y with straight legs

/** 0° = straight down, positive = forward (+x). */
const polar = (x: number, y: number, len: number, deg: number) => {
  const r = (deg * Math.PI) / 180;
  return { x: x + Math.sin(r) * len, y: y + Math.cos(r) * len };
};

export type WalkerAction =
  | { kind: "walk" }
  | { kind: "stand" }
  | { kind: "crouch"; t: number }
  | { kind: "air"; t: number }
  | { kind: "land"; t: number }
  | { kind: "settle"; t: number };

interface Props {
  rect: Rect;
  /** Absolute frame — drives the gait so it never restarts at scene cuts. */
  frame: number;
  fps: number;
  ink: string;
  headFill: string;
  facingLeft?: boolean;
  /** Steps per second. */
  cadence?: number;
  action?: WalkerAction;
  /** Skip the ground shadow (e.g. mid-air). */
  shadow?: number;
}

/** Joint angles for one side. thigh/shin absolute-ish (shin relative to thigh), arm upper + forearm (relative). */
interface Limbs {
  thighN: number;
  shinN: number;
  thighF: number;
  shinF: number;
  armN: number;
  foreN: number;
  armF: number;
  foreF: number;
  lean: number;
  nod: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
const mix = (a: Limbs, b: Limbs, t: number): Limbs => {
  const o = {} as Limbs;
  for (const k of Object.keys(a) as (keyof Limbs)[]) o[k] = lerp(a[k], b[k], t);
  return o;
};
const ease = (t: number) => t * t * (3 - 2 * t);

const STAND: Limbs = { thighN: 3, shinN: -3, thighF: -3, shinF: 3, armN: -6, foreN: 14, armF: 6, foreF: 14, lean: 2, nod: 0 };
// Anticipation: knees deep, torso forward, arms swung back.
const CROUCH: Limbs = { thighN: 42, shinN: -92, thighF: 40, shinF: -90, armN: -55, foreN: 10, armF: -50, foreF: 10, lean: 28, nod: 8 };
// Take-off: legs fully extended and trailing, arms thrown up-forward.
const TAKEOFF: Limbs = { thighN: -18, shinN: 6, thighF: -12, shinF: 4, armN: 140, foreN: 20, armF: 130, foreF: 20, lean: 14, nod: -6 };
// Mid-air tuck.
const TUCK: Limbs = { thighN: 62, shinN: -100, thighF: 55, shinF: -95, armN: 120, foreN: 40, armF: 105, foreF: 40, lean: 10, nod: -4 };
// Reaching for the surface: legs forward-down, arms coming forward for balance.
const REACH: Limbs = { thighN: 28, shinN: -18, thighF: 22, shinF: -14, armN: 60, foreN: 30, armF: 50, foreF: 30, lean: 12, nod: 4 };
// Landing absorb: deepest squash.
const ABSORB: Limbs = { thighN: 48, shinN: -98, thighF: 44, shinF: -94, armN: 70, foreN: 20, armF: 60, foreF: 20, lean: 32, nod: 14 };
// Half-recovered after the absorb.
const RECOVER: Limbs = { thighN: 20, shinN: -40, thighF: 16, shinF: -34, armN: 35, foreN: 25, armF: 28, foreF: 25, lean: 12, nod: 4 };

function limbsFor(action: WalkerAction, ph: number): Limbs {
  switch (action.kind) {
    case "walk": {
      const legN = 32 * Math.sin(ph);
      const legF = 32 * Math.sin(ph + Math.PI);
      const bendN = 58 * Math.max(0, Math.cos(ph)) * (0.35 + 0.65 * (1 - Math.sin(ph)) * 0.5);
      const bendF = 58 * Math.max(0, Math.cos(ph + Math.PI)) * (0.35 + 0.65 * (1 - Math.sin(ph + Math.PI)) * 0.5);
      return {
        thighN: legN,
        shinN: -bendN,
        thighF: legF,
        shinF: -bendF,
        armN: -26 * Math.sin(ph + Math.PI),
        foreN: 28,
        armF: -26 * Math.sin(ph),
        foreF: 28,
        lean: 6,
        nod: 0,
      };
    }
    case "stand":
      return STAND;
    case "crouch":
      return mix(STAND, CROUCH, ease(action.t));
    case "air": {
      const t = action.t;
      if (t < 0.22) return mix(CROUCH, TAKEOFF, ease(t / 0.22));
      if (t < 0.62) return mix(TAKEOFF, TUCK, ease((t - 0.22) / 0.4));
      return mix(TUCK, REACH, ease((t - 0.62) / 0.38));
    }
    case "land": {
      const t = action.t;
      return t < 0.45 ? mix(REACH, ABSORB, ease(t / 0.45)) : mix(ABSORB, RECOVER, ease((t - 0.45) / 0.55));
    }
    case "settle": {
      // Damped rebound around the standing pose: knees, torso and arms all oscillate and die out.
      const t = action.t;
      const decay = Math.exp(-3.2 * t);
      const osc = Math.cos(2 * Math.PI * 2.4 * t) * decay;
      const base = mix(RECOVER, STAND, ease(Math.min(1, t * 1.6)));
      return {
        ...base,
        thighN: base.thighN + 14 * osc,
        shinN: base.shinN - 30 * osc,
        thighF: base.thighF + 12 * osc,
        shinF: base.shinF - 26 * osc,
        lean: base.lean + 9 * osc,
        nod: base.nod + 5 * osc,
        // arms flap out for balance, slightly out of phase
        armN: base.armN + 40 * Math.cos(2 * Math.PI * 2.4 * t + 0.6) * decay,
        armF: base.armF + 34 * Math.cos(2 * Math.PI * 2.4 * t + 1.1) * decay,
      };
    }
  }
}

export const Walker: React.FC<Props> = ({ rect, frame, fps, ink, headFill, facingLeft, cadence = 1.9, action = { kind: "walk" }, shadow = 1 }) => {
  const ph = (frame / fps) * cadence * Math.PI; // one full cycle = two steps
  const L = limbsFor(action, ph);

  const kneeN = polar(HIP.x, HIP.y, THIGH, L.thighN);
  const footN = polar(kneeN.x, kneeN.y, SHIN, L.thighN + L.shinN);
  const kneeF = polar(HIP.x, HIP.y, THIGH, L.thighF);
  const footF = polar(kneeF.x, kneeF.y, SHIN, L.thighF + L.shinF);

  // Keep the lower foot on the ground line (except in the air, where the body is placed by the caller).
  const lowest = Math.max(footN.y, footF.y);
  const drop = action.kind === "air" ? 0 : GROUND_Y - lowest;
  // Walking bob on top of the planted-foot rule.
  const bob = action.kind === "walk" ? -4 * Math.abs(Math.cos(ph)) : action.kind === "stand" ? -1.5 * Math.sin(frame / 12) : 0;

  const shoulder = polar(HIP.x, HIP.y, HIP.y - SHOULDER_Y, 180 + L.lean);
  const neck = polar(HIP.x, HIP.y, HIP.y - NECK_Y, 180 + L.lean);
  const head = polar(neck.x, neck.y, HEAD_R + 4, 180 + L.lean * 0.6 + L.nod);

  const elbowN = polar(shoulder.x, shoulder.y, UPPER_ARM, L.armN);
  const handN = polar(elbowN.x, elbowN.y, FORE_ARM, L.armN + L.foreN);
  const elbowF = polar(shoulder.x, shoulder.y, UPPER_ARM, L.armF);
  const handF = polar(elbowF.x, elbowF.y, FORE_ARM, L.armF + L.foreF);

  const scale = Math.min(rect.w / RW, rect.h / RH);
  const line = { stroke: ink, strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <svg width={RW * scale} height={RH * scale} viewBox={`0 0 ${RW} ${RH}`} style={{ transform: `${facingLeft ? "scaleX(-1)" : ""}`, overflow: "visible" }}>
        {shadow > 0 && <ellipse cx={HIP.x + 4} cy={GROUND_Y + 10} rx={46 * shadow} ry={7 * shadow} fill={`rgba(0,0,0,${0.25 * shadow})`} />}
        <g transform={`translate(0 ${drop + bob})`}>
          {/* far limbs first, slightly faded for depth */}
          <g opacity={0.7}>
            <polyline points={`${HIP.x},${HIP.y} ${kneeF.x},${kneeF.y} ${footF.x},${footF.y}`} {...line} />
            <polyline points={`${shoulder.x},${shoulder.y} ${elbowF.x},${elbowF.y} ${handF.x},${handF.y}`} {...line} />
            <circle cx={handF.x} cy={handF.y} r={7} fill={ink} />
          </g>
          <line x1={HIP.x} y1={HIP.y} x2={neck.x} y2={neck.y} {...line} strokeWidth={STROKE + 1} />
          <polyline points={`${HIP.x},${HIP.y} ${kneeN.x},${kneeN.y} ${footN.x},${footN.y}`} {...line} />
          <polyline points={`${shoulder.x},${shoulder.y} ${elbowN.x},${elbowN.y} ${handN.x},${handN.y}`} {...line} />
          <circle cx={handN.x} cy={handN.y} r={7} fill={ink} />
          <g transform={`translate(${head.x} ${head.y}) rotate(${L.nod * 0.8})`}>
            <circle r={HEAD_R} fill={headFill} stroke={ink} strokeWidth={STROKE} />
            <path d={`M ${HEAD_R - 4} -4 q 10 4 0 12`} stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />
            <circle cx={14} cy={-8} r={3.5} fill={ink} />
          </g>
        </g>
      </svg>
    </div>
  );
};
