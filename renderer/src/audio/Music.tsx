import React from "react";
import { Audio, interpolate, staticFile } from "remotion";
import type { ResolvedManifest } from "@vb/engine/schema";

/**
 * Background music with sidechain-style ducking: full level only in the gaps
 * between words, dipping while the narrator speaks. Fades in/out at the edges.
 */
export const Music: React.FC<{ manifest: ResolvedManifest }> = ({ manifest }) => {
  const m = manifest.music;
  if (!m) return null;
  const words = manifest.scenes.flatMap((s) => s.words);
  const total = manifest.durationInFrames;
  const DUCK = 0.38;
  const PAD = 5; // frames of look-ahead/behind so the dip isn't choppy

  const volume = (f: number) => {
    const speaking = words.some((w) => f >= w.startFrame - PAD && f < w.endFrame + PAD);
    const edge = interpolate(f, [0, 20, total - 30, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return m.volume * (speaking ? DUCK : 1) * edge;
  };
  return <Audio src={staticFile(m.src)} volume={volume} loop />;
};
