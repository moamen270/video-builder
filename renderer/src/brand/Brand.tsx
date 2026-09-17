import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { FONT } from "../theme";
import { Figure, StillBackground, StillProp, midnight, type FigureSpec, type PropSpec } from "./still";

/** Square profile picture: Batman stickman, fierce, pointing at the viewer's left — the frame Moamen picked from alley v3. */
export const Avatar: React.FC = () => {
  const S = 2048;
  const p = midnight;
  return (
    <AbsoluteFill>
      <StillBackground w={S} h={S} palette={p} blobs={[{ x: S * 0.55, y: S * 0.4, r: S * 0.55 }]} />
      {/* Soft halo behind the head so the face pops in a tiny circular crop. */}
      <svg width={S} height={S} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="halo">
            <stop offset="0%" stopColor={p.accent} stopOpacity={0.22} />
            <stop offset="100%" stopColor={p.accent} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={S * 0.5} cy={S * 0.4} r={S * 0.36} fill="url(#halo)" />
      </svg>
      {/* Rig is 240×420; head centre sits ~14 % down the rect. Feet run off the bottom on purpose. */}
      <Figure pose="pointing_left" expression="fierce" style="batman" talking x={S * 0.5} y={S * 0.4 - 0.143 * 2300 + 1150} h={2300} palette={p} />
    </AbsoluteFill>
  );
};

export const CoverProps = z.object({
  width: z.number().int().default(2560),
  height: z.number().int().default(1440),
  /** Draw the platform's safe-area box (for checking, never for export). */
  guides: z.boolean().default(false),
});
export type CoverProps = z.infer<typeof CoverProps>;

// Designed in 2560×1440 units (YouTube banner); Facebook's 1640×924 has the same aspect and is scaled.
const D_W = 2560;
const D_H = 1440;
/** YouTube's "visible on all devices" box. */
const SAFE = { x: 507, y: 508, w: 1546, h: 423 };

const FIGURES: FigureSpec[] = [
  // top band
  { pose: "walk_right", x: 330, y: 300, h: 400 },
  { pose: "laughing", expression: "laughing", style: "joker", x: 700, y: 280, h: 420 },
  { pose: "arms_crossed", expression: "fierce", style: "batman", x: 1280, y: 250, h: 480 },
  { pose: "waving", expression: "happy", style: "robin", x: 1560, y: 310, h: 340 },
  { pose: "thinking", expression: "confused", style: "riddler", x: 1900, y: 290, h: 420 },
  { pose: "shrugging", expression: "smug", style: "penguin", x: 2300, y: 300, h: 400 },
  // sides
  { pose: "bow", expression: "happy", x: 250, y: 720, h: 400 },
  { pose: "presenting", expression: "smug", x: 2330, y: 720, h: 400, flip: true },
  // bottom band
  { pose: "claws_out", expression: "fierce", style: "wolverine", x: 330, y: 1170, h: 500 },
  { pose: "aim_right", expression: "smug", style: "gunslinger", x: 1000, y: 1180, h: 480 },
  { pose: "idle", expression: "ko", x: 1650, y: 1330, h: 380, rotate: 88 },
  { pose: "celebrating", expression: "happy", x: 2000, y: 1180, h: 460 },
  { pose: "facepalm", expression: "worried", x: 2360, y: 1190, h: 440 },
];

const PROPS: PropSpec[] = [
  { name: "question", x: 1990, y: 70, size: 140 },
  { name: "watermelon", x: 600, y: 1300, size: 210 },
  { name: "watermelon_split", x: 110, y: 1320, size: 230 },
  { name: "lotus", x: 1330, y: 1130, size: 170 },
  { name: "heart", x: 2160, y: 1000, size: 120 },
];

/** Channel cover: the whole cast doing their own thing around the wordmark. */
export const Cover: React.FC<CoverProps> = ({ width, height, guides }) => {
  const p = midnight;
  const k = width / D_W;
  return (
    <AbsoluteFill>
      <StillBackground w={width} h={height} palette={p} />
      <div style={{ position: "absolute", left: 0, top: 0, width: D_W, height: D_H, transform: `scale(${k})`, transformOrigin: "0 0" }}>
        {PROPS.map((pr, i) => (
          <StillProp key={i} {...pr} palette={p} />
        ))}
        {FIGURES.map((f, i) => (
          <Figure key={i} {...f} palette={p} />
        ))}
        {/* Wordmark inside the YouTube safe box. */}
        <div style={{ position: "absolute", left: SAFE.x, top: SAFE.y, width: SAFE.w, height: SAFE.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: p.fg, textAlign: "center" }}>
          <div style={{ fontSize: 172, fontWeight: 900, lineHeight: 1, letterSpacing: -3, textShadow: `0 10px 0 ${p.accent}, 0 14px 40px rgba(0,0,0,0.5)` }}>DUMMY STICKY</div>
          <div style={{ marginTop: 34, fontSize: 54, fontWeight: 700, color: p.fgDim }}>Stickmen with too much attitude.</div>
          <div style={{ marginTop: 14, fontSize: 46, fontWeight: 800, color: p.accent }}>@DummySticky</div>
        </div>
        {guides && <div style={{ position: "absolute", left: SAFE.x, top: SAFE.y, width: SAFE.w, height: SAFE.h, border: "4px dashed #ff3b3b" }} />}
      </div>
    </AbsoluteFill>
  );
};
