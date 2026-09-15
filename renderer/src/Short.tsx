import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import type { ResolvedManifest } from "@vb/engine/schema";
import { Background } from "./Background";
import { Music } from "./audio/Music";
import { SceneView } from "./scenes/SceneView";
import { PALETTES, SAFE } from "./theme";

export const Short: React.FC<ResolvedManifest> = (manifest) => {
  const palette = PALETTES[manifest.theme];
  const frame = useCurrentFrame();
  const progress = frame / Math.max(1, manifest.durationInFrames);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg[0] }}>
      <Background palette={palette} />
      <Music manifest={manifest} />
      {manifest.scenes.map((s) => (
        <Sequence key={s.id} from={s.startFrame} durationInFrames={s.durationInFrames} name={s.id}>
          <SceneView scene={s} palette={palette} />
        </Sequence>
      ))}
      {/* Thin progress bar at the top edge of the safe zone: a cheap retention cue. */}
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: SAFE.top - 50, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.15)" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 4, background: palette.accent }} />
      </div>
    </AbsoluteFill>
  );
};
