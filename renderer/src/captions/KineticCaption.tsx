import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "@vb/engine/schema";
import { FONT, type Palette, type Rect } from "../theme";

interface Props {
  words: Word[];
  sceneStart: number;
  rect: Rect;
  palette: Palette;
  fontPx: number;
  /** Max words shown at once. */
  chunkSize?: number;
  /** Every word is a beat: the active one jumps to 1.45× in the accent colour, others sit dim. */
  beat?: boolean;
}

interface Chunk {
  words: Word[];
  startFrame: number;
  endFrame: number;
}

/**
 * Split words into caption cards. A card ends when it holds `size` words, or on
 * strong punctuation, or when the total characters would overflow ~2 lines.
 */
function chunk(words: Word[], size: number, maxChars: number): Chunk[] {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  let chars = 0;
  const flush = () => {
    if (cur.length) out.push({ words: cur, startFrame: cur[0]!.startFrame, endFrame: cur[cur.length - 1]!.endFrame });
    cur = [];
    chars = 0;
  };
  for (const w of words) {
    if (cur.length && (cur.length >= size || chars + w.text.length > maxChars)) flush();
    cur.push(w);
    chars += w.text.length + 1;
    if (/[.!?…]$/.test(w.text) || (w.text.endsWith(",") && cur.length >= 2)) flush();
  }
  flush();
  // Each card stays until the next one starts (no gaps while the speaker breathes).
  for (let i = 0; i < out.length - 1; i++) out[i]!.endFrame = out[i + 1]!.startFrame;
  return out;
}

export const KineticCaption: React.FC<Props> = ({ words, sceneStart, rect, palette, fontPx, chunkSize = 4, beat = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = frame + sceneStart;
  const maxChars = Math.floor((rect.w / (fontPx * 0.58)) * 1.8);
  const chunks = useMemo(() => chunk(words, chunkSize, maxChars), [words, chunkSize, maxChars]);

  const current = chunks.find((c) => abs >= c.startFrame && abs < c.endFrame) ?? (abs >= (chunks.at(-1)?.startFrame ?? 0) ? chunks.at(-1) : undefined);
  if (!current) return null;

  const cardIn = spring({ frame: abs - current.startFrame, fps, config: { damping: 16, stiffness: 220 } });
  const cardScale = interpolate(cardIn, [0, 1], [0.9, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${cardScale})`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: fontPx,
          lineHeight: 1.12,
          textAlign: "center",
          letterSpacing: -1,
          textTransform: "uppercase",
        }}
      >
        {current.words.map((w) => {
          const active = abs >= w.startFrame && abs < w.endFrame;
          const past = abs >= w.endFrame;
          const pop = spring({ frame: abs - w.startFrame, fps, config: { damping: 12, stiffness: 260 } });
          const scale = beat ? (active ? interpolate(pop, [0, 1], [1, 1.45]) : 1) : active ? interpolate(pop, [0, 1], [1, 1.09]) : 1;
          const color = beat ? (active ? palette.accent : palette.fgDim) : w.emphasis ? palette.accent : active ? palette.accent2 : past ? palette.fgDim : palette.fg;
          return (
            <span
              key={w.i}
              style={{
                display: "inline-block",
                color,
                transform: `scale(${scale}) translateY(${active ? -fontPx * (beat ? 0.12 : 0.04) : 0}px) rotate(${beat && active ? (w.i % 2 ? 6 : -6) : 0}deg)`,
                WebkitTextStroke: `${Math.max(2, fontPx * 0.09)}px ${palette.stroke}`,
                paintOrder: "stroke fill",
                textShadow: `0 ${fontPx * 0.06}px ${fontPx * 0.12}px rgba(0,0,0,0.45)`,
                whiteSpace: "nowrap",
                margin: `${fontPx * 0.06}px ${fontPx * 0.2}px`,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
