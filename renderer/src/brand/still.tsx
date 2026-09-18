import React from "react";
import { AbsoluteFill } from "remotion";
import type { CharacterStyle, Expression, Pose, PropName, ResolvedScene } from "@vb/engine/schema";
import { Stickman } from "../characters/Stickman";
import { Prop } from "../props/Prop";
type ResolvedProp = React.ComponentProps<typeof Prop>["prop"];
import { PALETTES, type Palette, type Rect } from "../theme";

/**
 * Building blocks for brand stills (avatar, channel covers). They reuse the
 * real rig and props so the artwork is always the same stickman viewers see
 * in the videos. Stills are rendered at frame 60 so springs have settled and
 * the blink is closed.
 */

const posedScene = (pose: Pose, expression: Expression, style: CharacterStyle, talking = false): ResolvedScene =>
  ({
    id: "still",
    startFrame: 0,
    durationInFrames: 9999,
    speechFrames: 0,
    layout: "character_center",
    transition: "cut",
    audio: null,
    // A fake word spanning the still makes the mouth open (mid-line), like a frame grabbed from a video.
    words: talking ? [{ text: "…", i: 0, start: 0, end: 999, startFrame: 0, endFrame: 99999, emphasis: false }] : [],
    character: { id: "c", style, pose, expression, position: "center", poseChanges: [], shots: [], throws: [], strikes: [], entrance: null, exit: null, travel: null, jump: null },
    extras: [],
    props: [],
    sfx: [],
    bubbles: [],
    camera: [],
    overlays: [],
  }) as unknown as ResolvedScene;

export interface FigureSpec {
  pose: Pose;
  expression?: Expression;
  style?: CharacterStyle;
  /** Centre x/y in composition px and rig height in px. */
  x: number;
  y: number;
  h: number;
  flip?: boolean;
  color?: string;
  /** Extra rotation in degrees (for a knocked-out figure or a tumble). */
  rotate?: number;
  /** Mouth open as if mid-sentence. */
  talking?: boolean;
}

export const Figure: React.FC<FigureSpec & { palette: Palette }> = ({ pose, expression = "neutral", style = "stickman", x, y, h, flip, color, rotate = 0, talking = false, palette }) => {
  const w = (h * 240) / 420;
  const rect: Rect = { x: x - w / 2, y: y - h / 2, w, h };
  return (
    <div style={{ position: "absolute", inset: 0, transform: rotate ? `rotate(${rotate}deg)` : undefined, transformOrigin: `${x}px ${y}px` }}>
      <Stickman scene={posedScene(pose, expression, style, talking)} sceneStart={0} rect={rect} ink={color ?? palette.ink} accent={palette.accent} headFill={palette.propFill} style={style} flip={flip} />
    </div>
  );
};

export interface PropSpec {
  name: PropName;
  x: number;
  y: number;
  size: number;
}

export const StillProp: React.FC<PropSpec & { palette: Palette }> = ({ name, x, y, size, palette }) => {
  const prop: ResolvedProp = { name, atFrame: 0, untilFrame: 9999, anim: "pop", position: "center", scale: 1, exit: "fade", on: null };
  // Prop sizes itself as min(zone.w/0.78, zone.h) * 0.86 for a single slot; invert that so `size` is the drawn size.
  const zone: Rect = { x: x - size / 2 / 0.86, y: y - size / 2 / 0.86, w: size / 0.86, h: size / 0.86 };
  return <Prop prop={prop} sceneStart={0} zone={zone} palette={palette} slot={0} slots={1} />;
};

/** Static version of the video background (gradient, dot grid, soft blobs) at any size. */
export const StillBackground: React.FC<{ w: number; h: number; palette: Palette; blobs?: { x: number; y: number; r: number }[] }> = ({ w, h, palette, blobs }) => {
  const bl = blobs ?? [
    { x: w * 0.2, y: h * 0.25, r: Math.min(w, h) * 0.45 },
    { x: w * 0.8, y: h * 0.7, r: Math.min(w, h) * 0.5 },
  ];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${palette.bg[0]} 0%, ${palette.bg[1]} 100%)` }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="still-blob">
            <stop offset="0%" stopColor={palette.accent2} stopOpacity={0.16} />
            <stop offset="100%" stopColor={palette.accent2} stopOpacity={0} />
          </radialGradient>
          <pattern id="still-dots" width={48} height={48} patternUnits="userSpaceOnUse">
            <circle cx={2} cy={2} r={2} fill={palette.fg} fillOpacity={0.07} />
          </pattern>
        </defs>
        <rect width={w} height={h} fill="url(#still-dots)" />
        {bl.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="url(#still-blob)" />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const midnight = PALETTES.midnight;
