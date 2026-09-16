import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";
import { FONT, type Palette, type Rect } from "../theme";

interface Props {
  bubble: ResolvedScene["bubbles"][number];
  sceneStart: number;
  /** Character rect; the bubble hangs off its top-right. */
  anchor: Rect;
  palette: Palette;
}

/** Short comic-style speech bubble ("?!", "WAIT") popping off the character's head. */
export const Bubble: React.FC<Props> = ({ bubble, sceneStart, anchor, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = frame + sceneStart;
  if (abs < bubble.atFrame || abs >= bubble.untilFrame) return null;
  const s = spring({ frame: abs - bubble.atFrame, fps, config: { damping: 9, stiffness: 240 } });
  const out = interpolate(abs, [bubble.untilFrame - 5, bubble.untilFrame], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fontPx = bubble.text.length <= 3 ? 110 : bubble.text.length <= 8 ? 76 : 56;
  const w = Math.max(200, bubble.text.length * fontPx * 0.62 + 80);
  const h = fontPx + 70;
  // Beside the head (head sits ~10% down the character rect), never over the caption zone above.
  const left = bubble.side === "left";
  const x = left ? Math.max(30, anchor.x + anchor.w * 0.32 - w) : Math.min(1080 - w - 30, anchor.x + anchor.w * 0.68);
  const y = anchor.y + anchor.h * 0.08 - h * 0.35;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `scale(${interpolate(s, [0, 1], [0.3, 1]) * out}) rotate(${(left ? -1 : 1) * interpolate(s, [0, 1], [-12, -4])}deg)`,
        transformOrigin: left ? "80% 100%" : "20% 100%",
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, overflow: "visible", transform: left ? "scaleX(-1)" : undefined }}>
        <path
          d={`M20 0 H${w - 20} Q${w} 0 ${w} 20 V${h - 44} Q${w} ${h - 24} ${w - 20} ${h - 24} H70 L40 ${h} L48 ${h - 24} H20 Q0 ${h - 24} 0 ${h - 44} V20 Q0 0 20 0 Z`}
          fill="#ffffff"
          stroke={palette.stroke}
          strokeWidth={6}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: "0 0 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: fontPx,
          color: "#111111",
          letterSpacing: -1,
        }}
      >
        {bubble.text}
      </div>
    </div>
  );
};
