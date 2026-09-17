import React from "react";
import { interpolate } from "remotion";

/**
 * Spinning batarang flying between points. `t` 0–1 along the current hop,
 * `size` px. For the camera hop it grows toward the viewer.
 */
export const Batarang: React.FC<{ x: number; y: number; frame: number; size: number; ink: string }> = ({ x, y, frame, size, ink }) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ position: "absolute", left: x - size / 2, top: y - size / 2, transform: `rotate(${(frame * 47) % 360}deg)`, overflow: "visible" }}>
    <path
      d="M 0 -6 C -10 -22 -30 -26 -46 -14 C -36 -10 -30 -2 -30 8 C -20 4 -8 8 0 18 C 8 8 20 4 30 8 C 30 -2 36 -10 46 -14 C 30 -26 10 -22 0 -6 Z"
      fill="#0b0d14"
      stroke={ink}
      strokeWidth={3}
      strokeLinejoin="round"
    />
  </svg>
);

export interface HopPath {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startFrame: number;
  endFrame: number;
}

/** Position along a hop with a shallow arc; returns null when outside the hop. */
export function alongHop(h: HopPath, abs: number): { x: number; y: number; t: number } | null {
  if (abs < h.startFrame || abs > h.endFrame) return null;
  const t = (abs - h.startFrame) / Math.max(1, h.endFrame - h.startFrame);
  const x = h.from.x + (h.to.x - h.from.x) * t;
  const y = h.from.y + (h.to.y - h.from.y) * t - Math.sin(Math.PI * t) * 80;
  return { x, y, t: interpolate(t, [0, 1], [0, 1]) };
}
