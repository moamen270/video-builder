import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";

type Cue = ResolvedScene["overlays"][number];

/**
 * Full-frame effects on the viewer's screen. Deterministic per frame.
 * claw_marks: three diagonal gashes torn across the glass over ~6 frames, a
 * white hit-flash, then the picture behind dims and stays scarred.
 */
export const Overlay: React.FC<{ overlay: Cue; abs: number }> = ({ overlay, abs }) => {
  if (abs < overlay.atFrame || abs >= overlay.untilFrame) return null;
  const t = abs - overlay.atFrame;
  switch (overlay.kind) {
    case "flash":
      return <AbsoluteFill style={{ background: "#ffffff", opacity: interpolate(t, [0, 1, 8], [0, 0.9, 0], { extrapolateRight: "clamp" }) }} />;
    case "blackout":
      return <AbsoluteFill style={{ background: "#000000", opacity: interpolate(t, [0, 18], [0, 1], { extrapolateRight: "clamp" }) }} />;
    case "claw_marks":
      return <ClawMarks t={t} />;
  }
};

const MARKS = [
  { x1: 300, y1: 320, x2: 900, y2: 1520, delay: 0 },
  { x1: 470, y1: 260, x2: 1070, y2: 1460, delay: 2 },
  { x1: 140, y1: 400, x2: 740, y2: 1600, delay: 4 },
];

const ClawMarks: React.FC<{ t: number }> = ({ t }) => {
  const flash = interpolate(t, [0, 1, 7], [0, 0.85, 0], { extrapolateRight: "clamp" });
  const dim = interpolate(t, [10, 34], [0, 0.62], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = t < 8 ? Math.sin(t * 2.7) * (8 - t) * 1.6 : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000000", opacity: dim }} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
        <defs>
          <filter id="tear" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={14} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {MARKS.map((m, i) => {
          const len = Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
          const prog = interpolate(t - m.delay, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (prog <= 0) return null;
          const dash = `${len * prog} ${len}`;
          const common = { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, strokeLinecap: "round" as const, strokeDasharray: dash };
          return (
            <g key={i} filter="url(#tear)">
              <line {...common} stroke="#050608" strokeWidth={46} />
              <line {...common} stroke="#1c2230" strokeWidth={30} />
              <line {...common} stroke="#e8edf7" strokeWidth={9} opacity={0.9} />
              {/* glass splinters at the entry point */}
              {prog > 0.6 &&
                [-1, 1].map((s) => (
                  <line key={s} x1={m.x1} y1={m.y1} x2={m.x1 + s * 90} y2={m.y1 - 60 + s * 30} stroke="#e8edf7" strokeWidth={3} opacity={0.6} />
                ))}
            </g>
          );
        })}
      </svg>
      <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />
    </AbsoluteFill>
  );
};
