import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Palette } from "./theme";

/** Gradient + slowly drifting soft blobs so the frame is never static. Cheap to paint. */
export const Background: React.FC<{ palette: Palette }> = ({ palette }) => {
  const f = useCurrentFrame();
  const blobs = [
    { x: 200 + Math.sin(f / 90) * 60, y: 400 + Math.cos(f / 110) * 50, r: 420 },
    { x: 900 + Math.cos(f / 130) * 70, y: 1300 + Math.sin(f / 100) * 60, r: 520 },
    { x: 540 + Math.sin(f / 150) * 40, y: 1750 + Math.cos(f / 95) * 30, r: 360 },
  ];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${palette.bg[0]} 0%, ${palette.bg[1]} 100%)` }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="blob">
            <stop offset="0%" stopColor={palette.accent2} stopOpacity={0.16} />
            <stop offset="100%" stopColor={palette.accent2} stopOpacity={0} />
          </radialGradient>
          <pattern id="dots" width={48} height={48} patternUnits="userSpaceOnUse" patternTransform={`translate(${(f * 0.4) % 48} ${(f * 0.25) % 48})`}>
            <circle cx={2} cy={2} r={2} fill={palette.fg} fillOpacity={0.07} />
          </pattern>
        </defs>
        <rect width={1080} height={1920} fill="url(#dots)" />
        {blobs.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="url(#blob)" />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
