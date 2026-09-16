import React from "react";
import type { Rect } from "../theme";

/**
 * Side-view stickman with a procedural walk cycle. Drawn facing screen-right in
 * the same 240×420 rig space as the front rig; `facingLeft` mirrors it.
 * No face toward the camera — one eye and a nose bump looking where he walks.
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

/** 0° = straight down, positive = forward (+x). */
const polar = (x: number, y: number, len: number, deg: number) => {
  const r = (deg * Math.PI) / 180;
  return { x: x + Math.sin(r) * len, y: y + Math.cos(r) * len };
};

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
}

export const Walker: React.FC<Props> = ({ rect, frame, fps, ink, headFill, facingLeft, cadence = 1.9 }) => {
  // One full cycle = two steps.
  const ph = (frame / fps) * cadence * Math.PI;
  const lean = 6; // forward torso lean

  const leg = (p: number) => {
    const thigh = 32 * Math.sin(p);
    // Knee bends while the leg swings forward (cos > 0), straight in stance.
    const bend = 58 * Math.max(0, Math.cos(p)) * (0.35 + 0.65 * (1 - Math.sin(p)) * 0.5);
    const knee = polar(HIP.x, HIP.y, THIGH, thigh);
    const foot = polar(knee.x, knee.y, SHIN, thigh - bend);
    return { knee, foot };
  };
  const arm = (p: number, sx: number, sy: number) => {
    const upper = -26 * Math.sin(p); // opposite to the same-side leg
    const elbow = polar(sx, sy, UPPER_ARM, upper);
    const hand = polar(elbow.x, elbow.y, FORE_ARM, upper + 28);
    return { elbow, hand };
  };

  // Torso leans forward around the hip.
  const shoulder = polar(HIP.x, HIP.y, HIP.y - SHOULDER_Y, 180 + lean);
  const neck = polar(HIP.x, HIP.y, HIP.y - NECK_Y, 180 + lean);
  const head = polar(neck.x, neck.y, HEAD_R + 4, 180 + lean * 0.6);

  const near = leg(ph); // leg nearer the camera
  const far = leg(ph + Math.PI);
  const nearArm = arm(ph + Math.PI, shoulder.x, shoulder.y); // arm on the near side swings opposite the near leg
  const farArm = arm(ph, shoulder.x, shoulder.y);

  // Body bobs twice per cycle, lowest mid-stance.
  const bob = -4 * Math.abs(Math.cos(ph));
  const scale = Math.min(rect.w / RW, rect.h / RH);
  const line = { stroke: ink, strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <svg width={RW * scale} height={RH * scale} viewBox={`0 0 ${RW} ${RH}`} style={{ transform: `translateY(${bob * scale}px) ${facingLeft ? "scaleX(-1)" : ""}`, overflow: "visible" }}>
        <ellipse cx={HIP.x + 4} cy={404} rx={46} ry={7} fill="rgba(0,0,0,0.25)" />
        {/* far limbs first, slightly faded for depth */}
        <g opacity={0.7}>
          <polyline points={`${HIP.x},${HIP.y} ${far.knee.x},${far.knee.y} ${far.foot.x},${far.foot.y}`} {...line} />
          <polyline points={`${shoulder.x},${shoulder.y} ${farArm.elbow.x},${farArm.elbow.y} ${farArm.hand.x},${farArm.hand.y}`} {...line} />
          <circle cx={farArm.hand.x} cy={farArm.hand.y} r={7} fill={ink} />
        </g>
        {/* torso */}
        <line x1={HIP.x} y1={HIP.y} x2={neck.x} y2={neck.y} {...line} strokeWidth={STROKE + 1} />
        {/* near limbs */}
        <polyline points={`${HIP.x},${HIP.y} ${near.knee.x},${near.knee.y} ${near.foot.x},${near.foot.y}`} {...line} />
        <polyline points={`${shoulder.x},${shoulder.y} ${nearArm.elbow.x},${nearArm.elbow.y} ${nearArm.hand.x},${nearArm.hand.y}`} {...line} />
        <circle cx={nearArm.hand.x} cy={nearArm.hand.y} r={7} fill={ink} />
        {/* head in profile: eye + nose toward travel direction */}
        <g transform={`translate(${head.x} ${head.y})`}>
          <circle r={HEAD_R} fill={headFill} stroke={ink} strokeWidth={STROKE} />
          <path d={`M ${HEAD_R - 4} -4 q 10 4 0 12`} stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={14} cy={-8} r={3.5} fill={ink} />
        </g>
      </svg>
    </div>
  );
};
