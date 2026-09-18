import React from "react";
import { interpolate } from "remotion";
import type { Pose, PropPosition, ResolvedScene } from "@vb/engine/schema";
import { muzzlePoint } from "../characters/Stickman";
import type { Palette, Rect } from "../theme";

type Shot = NonNullable<ResolvedScene["character"]>["shots"][number];

const TRAVEL = 5; // frames muzzle → target
const CAMERA_TRAVEL = 9; // frames muzzle → viewer
const SMOKE = 26; // frames the muzzle smoke lingers

/** Which prop zone an aim pose points at. */
const ZONE_FOR: Partial<Record<Pose, PropPosition>> = { aim_right: "right", aim_left: "left", aim_high: "top_right", aim_up: "top" };

/**
 * Per-shot FX drawn in scene space over the character: a glowing tracer that
 * travels muzzle → target (or grows toward the viewer for camera shots) and a
 * curl of smoke rising from the muzzle afterwards. Deterministic per frame.
 */
export const Shots: React.FC<{ shots: Shot[]; abs: number; poseAt: (frame: number) => Pose; rect: Rect; flip: boolean; zones: Record<PropPosition, Rect>; magenta: boolean; palette: Palette }> = ({ shots, abs, poseAt, rect, flip, zones, magenta, palette }) => {
  const color = magenta ? "#ff2bd6" : "#ffd166";
  const glow = magenta ? "#ff9af0" : "#fff1b8";
  const els: React.ReactNode[] = [];
  shots.forEach((sh, i) => {
    const t = abs - sh.atFrame;
    if (t < 0 || t > SMOKE) return;
    const pose = poseAt(sh.atFrame);
    const m = muzzlePoint(rect, pose, flip);
    const big = sh.big;

    if (sh.camera) {
      // Toward the viewer: the bolt grows from the muzzle to a large disc at frame centre, then the impact takes over.
      if (t <= CAMERA_TRAVEL) {
        const k = t / CAMERA_TRAVEL;
        const x = interpolate(k, [0, 1], [m.x, 540]);
        const y = interpolate(k, [0, 1], [m.y, 860]);
        const r = interpolate(k * k, [0, 1], [10, big ? 260 : 150]);
        els.push(
          <g key={`c${i}`}>
            <circle cx={x} cy={y} r={r * 1.5} fill={color} opacity={0.18} />
            <circle cx={x} cy={y} r={r} fill={color} opacity={0.75} />
            <circle cx={x} cy={y} r={r * 0.45} fill="#ffffff" />
          </g>,
        );
      }
    } else {
      const zone = ZONE_FOR[pose] ? zones[ZONE_FOR[pose]!] : null;
      if (zone && t <= TRAVEL + 2) {
        const tx = zone.x + zone.w / 2;
        const ty = zone.y + zone.h / 2;
        const k = Math.min(1, t / TRAVEL);
        const hx = interpolate(k, [0, 1], [m.x, tx]);
        const hy = interpolate(k, [0, 1], [m.y, ty]);
        const len = Math.min(140 * (big ? 1.6 : 1), Math.hypot(hx - m.x, hy - m.y));
        const ang = Math.atan2(ty - m.y, tx - m.x);
        const tailX = hx - Math.cos(ang) * len;
        const tailY = hy - Math.sin(ang) * len;
        const fade = t > TRAVEL ? 1 - (t - TRAVEL) / 2 : 1;
        els.push(
          <g key={`t${i}`} opacity={fade}>
            <line x1={tailX} y1={tailY} x2={hx} y2={hy} stroke={color} strokeWidth={big ? 26 : 16} strokeLinecap="round" opacity={0.35} />
            <line x1={tailX} y1={tailY} x2={hx} y2={hy} stroke={color} strokeWidth={big ? 12 : 7} strokeLinecap="round" />
            <line x1={(tailX + hx) / 2} y1={(tailY + hy) / 2} x2={hx} y2={hy} stroke="#ffffff" strokeWidth={big ? 5 : 3} strokeLinecap="round" />
            <circle cx={hx} cy={hy} r={big ? 14 : 9} fill={glow} />
          </g>,
        );
      }
    }

    // Muzzle smoke: three puffs drifting up and apart, growing and fading.
    if (t >= 2) {
      const k = (t - 2) / (SMOKE - 2);
      for (let p = 0; p < 3; p++) {
        const ph = p * 2.1 + i;
        const dx = Math.sin(ph) * 18 * k + (p - 1) * 14 * k;
        const dy = -(30 + p * 12) * k;
        const r = (8 + p * 3) * (0.6 + k * 1.4) * (big ? 1.4 : 1);
        els.push(<circle key={`s${i}-${p}`} cx={m.x + dx} cy={m.y + dy} r={r} fill={palette.fg} opacity={0.28 * (1 - k)} />);
      }
    }
  });
  if (!els.length) return null;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      {els}
    </svg>
  );
};
