import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";
import { Stickman } from "../characters/Stickman";
import { KineticCaption } from "../captions/KineticCaption";
import { Prop } from "../props/Prop";
import { Bubble } from "./Bubble";
import { LAYOUTS, type Palette } from "../theme";

interface Props {
  scene: ResolvedScene;
  palette: Palette;
}

/** Everything inside one scene's <Sequence>. Frame 0 here == scene.startFrame in the composition. */
export const SceneView: React.FC<Props> = ({ scene, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = frame + scene.startFrame;
  const spec = LAYOUTS[scene.layout];

  // --- camera -------------------------------------------------------------
  let camScale = 1;
  let camX = 0;
  let camY = 0;
  for (const c of scene.camera) {
    if (abs < c.atFrame) continue;
    const t = abs - c.atFrame;
    if (c.move === "punch_in") camScale *= interpolate(spring({ frame: t, fps, config: { damping: 14, stiffness: 200 } }), [0, 1], [1, 1.09]);
    else if (c.move === "slow_zoom") camScale *= interpolate(t, [0, scene.durationInFrames], [1, 1.06], { extrapolateRight: "clamp" });
    else if (c.move === "shake" && t < 12) {
      const k = interpolate(t, [0, 12], [1, 0]);
      camX += Math.sin(t * 2.9) * 14 * k;
      camY += Math.cos(t * 2.3) * 10 * k;
    }
  }

  // --- transition in ------------------------------------------------------
  const tIn = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  let trans: React.CSSProperties = {};
  if (scene.transition === "slide") trans = { transform: `translateX(${interpolate(tIn, [0, 1], [1080, 0])}px)` };
  else if (scene.transition === "zoom") trans = { transform: `scale(${interpolate(tIn, [0, 1], [1.35, 1])})`, opacity: interpolate(tIn, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }) };
  else if (scene.transition === "wipe") trans = { clipPath: `inset(0 ${interpolate(tIn, [0, 1], [100, 0])}% 0 0)` };

  // Props sharing a zone fan out; compute slot indices among visible props.
  const visible = scene.props.filter((p) => abs >= p.atFrame && abs < p.untilFrame);
  const zoneCounts = new Map<string, number>();
  for (const p of visible) zoneCounts.set(p.position, (zoneCounts.get(p.position) ?? 0) + 1);
  const zoneSeen = new Map<string, number>();

  const charRect = scene.character && spec.character ? spec.character[scene.character.position] : null;

  return (
    <AbsoluteFill style={trans}>
      {scene.audioSrc && <Audio src={staticFile(scene.audioSrc)} />}
      {scene.sfx.map((fx, i) => (
        <Sequence key={i} from={fx.atFrame - scene.startFrame} durationInFrames={Math.max(1, scene.startFrame + scene.durationInFrames - fx.atFrame)}>
          <Audio src={staticFile(fx.src)} volume={fx.volume} />
        </Sequence>
      ))}

      <AbsoluteFill style={{ transform: `translate(${camX}px, ${camY}px) scale(${camScale})`, transformOrigin: "50% 45%" }}>
        {scene.props.map((p, i) => {
          if (abs < p.atFrame || abs >= p.untilFrame) return null;
          const slot = zoneSeen.get(p.position) ?? 0;
          zoneSeen.set(p.position, slot + 1);
          return <Prop key={i} prop={p} sceneStart={scene.startFrame} zone={spec.props[p.position]} palette={palette} slot={slot} slots={zoneCounts.get(p.position) ?? 1} />;
        })}

        {scene.character && charRect && (
          <Stickman
            scene={scene}
            sceneStart={scene.startFrame}
            rect={charRect}
            ink={scene.character.color ?? palette.ink}
            accent={palette.accent}
            headFill={palette.propFill}
            style={scene.character.style}
            flip={scene.character.position === "right"}
          />
        )}

        {scene.character && charRect && scene.bubbles.map((b, i) => <Bubble key={i} bubble={b} sceneStart={scene.startFrame} anchor={charRect} palette={palette} />)}

        <KineticCaption words={scene.words} sceneStart={scene.startFrame} rect={spec.caption} palette={palette} fontPx={spec.captionFontPx} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
