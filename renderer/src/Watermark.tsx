import React from "react";
import type { Palette } from "./theme";
import { FONT, SAFE, W } from "./theme";

/**
 * Channel handle on every frame so reposts still say where the video came
 * from. Sits right-aligned in the gap between the progress bar and the safe
 * area (y 214–246): above every layout's top prop slots, below the platform
 * UI icons. Semi-transparent so it reads without competing with the caption.
 */
export const Watermark: React.FC<{ handle: string; palette: Palette }> = ({ handle, palette }) => (
  <div
    style={{
      position: "absolute",
      top: SAFE.top - 36,
      right: W - (W - SAFE.right),
      display: "flex",
      alignItems: "center",
      gap: 8,
      opacity: 0.6,
      fontFamily: FONT,
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: 0.5,
      color: palette.fg,
      textShadow: `0 1px 2px ${palette.stroke}`,
    }}
  >
    {/* Stick figure glyph: head + body + arms, 32 px tall. */}
    <svg width={22} height={32} viewBox="0 0 22 32" fill="none" stroke={palette.fg} strokeWidth={2.6} strokeLinecap="round">
      <circle cx={11} cy={5} r={4} fill={palette.fg} stroke="none" />
      <path d="M11 9v11M11 20l-5 10M11 20l5 10M3 14l8-2 8 2" />
    </svg>
    <span>{handle}</span>
  </div>
);
