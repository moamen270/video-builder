import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";

type Cue = ResolvedScene["overlays"][number];

export interface SlashGeom {
  shX: number;
  shY: number;
  tipR: number;
  handR: number;
  windup: number;
  hit: number;
  follow: number;
  fan: number;
  atFrame: number;
}
export interface CameraMap {
  scale: number;
  x: number;
  y: number;
  ox: number;
  oy: number;
}

/** Scene px → screen px through the scene's camera transform (scale about origin, then offset). */
const toScreen = (cam: CameraMap, x: number, y: number) => ({ x: cam.ox + (x - cam.ox) * cam.scale + cam.x, y: cam.oy + (y - cam.oy) * cam.scale + cam.y });

/**
 * Full-frame effects on the viewer's screen. Deterministic per frame.
 * claw_marks: three gashes torn along the claw-tip path over the swing, a white
 * hit-flash, then the picture behind dims and stays scarred.
 */
export const Overlay: React.FC<{ overlay: Cue; abs: number; slash: SlashGeom | null; camera: CameraMap }> = ({ overlay, abs, slash, camera }) => {
  if (abs < overlay.atFrame || abs >= overlay.untilFrame) return null;
  const t = abs - overlay.atFrame;
  switch (overlay.kind) {
    case "flash":
      return <AbsoluteFill style={{ background: "#ffffff", opacity: interpolate(t, [0, 1, 8], [0, 0.9, 0], { extrapolateRight: "clamp" }) }} />;
    case "blackout":
      return <AbsoluteFill style={{ background: "#000000", opacity: interpolate(t, [0, 18], [0, 1], { extrapolateRight: "clamp" }) }} />;
    case "claw_marks":
      return <ClawMarks t={t} abs={abs} slash={slash} camera={camera} />;
  }
};

/** Fallback marks when there is no camera strike in the scene. */
const FALLBACK: SlashGeom = { shX: 540, shY: 900, tipR: 900, handR: 700, windup: 150, hit: 55, follow: -55, fan: 30, atFrame: 0 };

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180; // rig convention: 0 = down, + = screen-right
  return { x: cx + Math.sin(a) * r, y: cy + Math.cos(a) * r };
};

const ClawMarks: React.FC<{ t: number; abs: number; slash: SlashGeom | null; camera: CameraMap }> = ({ t, abs, slash, camera }) => {
  const g = slash ?? FALLBACK;
  // The swing runs from strike-3 (windup) to strike+4 (follow-through); marks are revealed as the tips pass.
  const swingT = slash ? abs - slash.atFrame : t - 3;
  const reveal = interpolate(swingT, [-3, 0, 4], [0, 0.45, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flash = interpolate(swingT, [0, 1, 7], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dim = interpolate(swingT, [10, 34], [0, 0.62], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = swingT >= 0 && swingT < 8 ? Math.sin(swingT * 2.7) * (8 - swingT) * 1.6 : 0;
  if (reveal <= 0) return null;

  const pivot = toScreen(camera, g.shX, g.shY);
  const R = g.tipR * camera.scale;
  // Fanned claws physically trace the same circle (one groove); the cartoon convention is
  // three parallel gashes, so stagger them radially and let each lag a hair behind the last.
  const gap = 4.2 * g.fan * camera.scale;
  const claws = [
    { dr: -gap, lagDeg: 0 },
    { dr: 0, lagDeg: 3 },
    { dr: gap, lagDeg: 6 },
  ];
  const a0 = g.windup;
  const a1 = g.follow;
  const aEnd = a0 + (a1 - a0) * reveal;
  const arc = (offsetDeg: number, radius: number) => {
    const N = 24;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + (aEnd - a0) * (i / N) + offsetDeg;
      const p = polar(pivot.x, pivot.y, radius, a);
      pts.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
    return pts.join(" ");
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000000", opacity: dim }} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, overflow: "visible", transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
        <defs>
          <filter id="tear" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={12} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {claws.map((c, i) => {
          const d = arc(c.lagDeg, R - 12 + c.dr);
          return (
            <g key={i} filter="url(#tear)">
              <path d={d} fill="none" stroke="#050608" strokeWidth={40} strokeLinecap="round" />
              <path d={d} fill="none" stroke="#1c2230" strokeWidth={24} strokeLinecap="round" />
              <path d={d} fill="none" stroke="#e8edf7" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
            </g>
          );
        })}
      </svg>
      <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />
    </AbsoluteFill>
  );
};
