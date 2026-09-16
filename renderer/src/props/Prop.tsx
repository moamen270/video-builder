import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";
import { ICONS } from "./icons";
import type { Palette, Rect } from "../theme";

type ResolvedProp = ResolvedScene["props"][number];

interface Props {
  prop: ResolvedProp;
  sceneStart: number;
  zone: Rect;
  palette: Palette;
  /** Index among simultaneously visible props in the same zone, for fanning out. */
  slot: number;
  slots: number;
}

const EXIT_FRAMES = 6;

export const Prop: React.FC<Props> = ({ prop, sceneStart, zone, palette, slot, slots }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = frame + sceneStart;
  if (abs < prop.atFrame || abs >= prop.untilFrame) return null;

  const local = abs - prop.atFrame;
  const ground = prop.position.startsWith("ground_");
  // Ground slots: exact height (300 px × scale) and bottom-aligned so characters can stand on them.
  const size = ground ? zone.h * prop.scale : Math.min(zone.w / Math.max(1, slots * 0.78), zone.h) * 0.86 * prop.scale;
  // Fan multiple props across the zone horizontally.
  const cx = zone.x + (zone.w / (slots + 1)) * (slot + 1);
  const cy = ground ? zone.y + zone.h - size / 2 : zone.y + zone.h / 2;

  const enter = spring({ frame: local, fps, config: { damping: 11, stiffness: 190, mass: 0.8 } });
  const exit = interpolate(abs, [prop.untilFrame - EXIT_FRAMES, prop.untilFrame], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  let tx = 0;
  let ty = 0;
  let sc = 1;
  let rot = 0;
  let op = 1;
  switch (prop.anim) {
    case "pop":
      sc = interpolate(enter, [0, 1], [0.2, 1]);
      break;
    case "bounce": {
      const drop = spring({ frame: local, fps, config: { damping: 7, stiffness: 120, mass: 1 } });
      ty = interpolate(drop, [0, 1], [-zone.h * 0.9, 0]);
      sc = interpolate(enter, [0, 1], [0.7, 1]);
      break;
    }
    case "drop":
      ty = interpolate(enter, [0, 1], [-400, 0]);
      break;
    case "slide_left":
      tx = interpolate(enter, [0, 1], [-700, 0]);
      break;
    case "slide_right":
      tx = interpolate(enter, [0, 1], [700, 0]);
      break;
    case "fade":
      op = interpolate(local, [0, 10], [0, 1], { extrapolateRight: "clamp" });
      sc = interpolate(enter, [0, 1], [0.95, 1]);
      break;
    case "shake":
      sc = interpolate(enter, [0, 1], [0.3, 1]);
      rot = local < 24 ? Math.sin(local * 1.6) * interpolate(local, [0, 24], [14, 0]) : 0;
      break;
    case "burst":
      // Appears instantly at full size and kicks outward; the icon's own `t` does the splitting.
      sc = interpolate(local, [0, 4, 10], [1.0, 1.25, 1.1], { extrapolateRight: "clamp" });
      break;
    case "bloom":
      // Grows gently; the icon's `t` unfolds petals over ~0.6 s.
      sc = interpolate(enter, [0, 1], [0.6, 1]);
      break;
    case "stamp":
      // Slams in from large to normal with a hard settle — for numbers.
      sc = interpolate(local, [0, 3, 6], [2.2, 0.92, 1], { extrapolateRight: "clamp" });
      op = interpolate(local, [0, 2], [0, 1], { extrapolateRight: "clamp" });
      break;
  }
  const iconT = interpolate(local, [0, prop.anim === "bloom" ? 18 : 14], [0, 1], { extrapolateRight: "clamp" });
  // Gentle hover so props never sit dead still — except things standing on the ground.
  if (!ground) {
    ty += Math.sin((abs + slot * 7) / 11) * 5;
    rot += Math.sin((abs + slot * 5) / 17) * 2;
  }

  const Icon = ICONS[prop.name];
  return (
    <div
      style={{
        position: "absolute",
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        opacity: op * exit,
        transform: `translate(${tx}px, ${ty}px) scale(${sc * (0.85 + 0.15 * exit)}) rotate(${rot}deg)`,
        filter: `drop-shadow(0 ${size * 0.04}px ${size * 0.06}px rgba(0,0,0,0.35))`,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
        <Icon line={palette.ink} fill={palette.propFill} accent={palette.accent} t={iconT} />
      </svg>
    </div>
  );
};
