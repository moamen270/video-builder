import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";
import { Stickman, cameraSlashGeometry, muzzlePoint } from "../characters/Stickman";
import { Shots } from "./Shots";
import { Projectiles } from "./Projectiles";
import { extraMotionAt, heroEntranceExit, motionAt, type MotionState } from "../characters/motion";
import { Batarang, FlyingMic, alongHop, type HopPath } from "./Batarang";
import { KineticCaption } from "../captions/KineticCaption";
import { Prop } from "../props/Prop";
import { Bubble } from "./Bubble";
import { Overlay } from "./Overlay";
import { LAYOUTS, type Palette } from "../theme";

interface Props {
  scene: ResolvedScene;
  palette: Palette;
  brand: { handle: string; name: string } | null;
}

/** Pose the hero holds at an absolute frame (for aiming tracers from the right arm). */
function poseAtFrame(scene: ResolvedScene, frame: number) {
  const c = scene.character!;
  let pose = c.pose;
  for (const pc of c.poseChanges) if (pc.atFrame <= frame) pose = pc.pose;
  return pose;
}

/** Everything inside one scene's <Sequence>. Frame 0 here == scene.startFrame in the composition. */
export const SceneView: React.FC<Props> = ({ scene, palette, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = frame + scene.startFrame;
  const spec = LAYOUTS[scene.layout];

  // Extras: same rig, smaller, placed by centre x on the hero's ground line.
  const extraRectsAt = (frame: number) =>
    scene.extras.map((e) => {
      const base = spec.character?.center ?? { x: 320, y: 1080, w: 440, h: 700 };
      const m = extraMotionAt(e, frame);
      const w = base.w * e.scale;
      const h = base.h * e.scale;
      return { e, m, rect: { x: m.cx - w / 2, y: base.y + base.h - h, w, h } };
    });
  const extraRects = extraRectsAt(abs);

  // --- camera -------------------------------------------------------------
  let camScale = 1;
  let camX = 0;
  let camY = 0;
  for (const c of scene.camera) {
    if (abs < c.atFrame) continue;
    const t = abs - c.atFrame;
    if (c.move === "punch_in") camScale *= interpolate(spring({ frame: t, fps, config: { damping: 14, stiffness: 200 } }), [0, 1], [1, 1.09]);
    else if (c.move === "dolly_in") camScale *= interpolate(spring({ frame: t, fps, config: { damping: 18, stiffness: 90 } }), [0, 1], [1, 1.45]);
    else if (c.move === "slow_zoom") camScale *= interpolate(t, [0, scene.durationInFrames], [1, 1.06], { extrapolateRight: "clamp" });
    else if (c.move === "focus" && c.on) {
      // Zoom onto one figure and slide him to the middle: scale about the frame origin, then translate.
      const r = extraRects.find((x) => x.e.id === c.on)?.rect;
      if (r) {
        // Zoom so the figure fills ~55 % of the frame height (small kid → closer), capped so nothing important leaves the frame.
        const target = Math.min(2.2, Math.max(1.25, (0.55 * 1920) / r.h));
        // At scene start the focus is a hard cut to the close-up; mid-scene it eases in.
        const k = c.atFrame <= scene.startFrame ? target : interpolate(spring({ frame: t, fps, config: { damping: 16, stiffness: 140 } }), [0, 1], [1, target]);
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h * 0.45;
        camScale *= k;
        // origin is (540, 864); after scaling about it, the figure sits at origin + (cx-origin)*k → shift so it lands at the origin
        camX += -(cx - 540) * k;
        camY += -(cy - 864) * k * 0.6;
      }
    } else if (c.move === "pan_left") camX += interpolate(spring({ frame: t, fps, config: { damping: 16, stiffness: 240 } }), [0, 1], [0, 130]);
    else if (c.move === "pan_right") camX -= interpolate(spring({ frame: t, fps, config: { damping: 16, stiffness: 240 } }), [0, 1], [0, 130]);
    else if (c.move === "zoom_out") camScale *= interpolate(spring({ frame: t, fps, config: { damping: 18, stiffness: 120 } }), [0, 1], [1, 0.9]);
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

  let charRect = scene.character && spec.character ? spec.character[scene.character.position] : null;
  const groundRect = charRect;
  let motion: MotionState | null = null;
  if (charRect && scene.character && (scene.character.travel || scene.character.jump)) {
    motion = motionAt(scene, charRect.x, abs);
    charRect = { ...charRect, x: motion.x, y: charRect.y - motion.lift };
  }
  // Hero scale: shrink about the feet centre AFTER travel so walks and static scenes line up.
  if (charRect && scene.character && scene.character.scale !== 1) {
    const k = scene.character.scale;
    charRect = { x: charRect.x + (charRect.w * (1 - k)) / 2, y: charRect.y + charRect.h * (1 - k), w: charRect.w * k, h: charRect.h * k };
  }
  let heroSquash = 0;
  let heroHidden = false;
  let cable: { x: number; y: number } | null = null;
  if (charRect && scene.character && (scene.character.entrance || scene.character.exit)) {
    const ee = heroEntranceExit(scene, abs, charRect);
    charRect = { ...charRect, x: charRect.x + ee.dx, y: charRect.y - ee.lift };
    heroSquash = ee.squash;
    heroHidden = ee.hidden;
    cable = ee.cable;
  }

  const extraCenter = (id: string) => {
    const r = extraRects.find((x) => x.e.id === id);
    return r ? { x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h * 0.45 } : null;
  };

  // Throws: build hop paths hero-hand → target → target …; last hop returns to the hero unless it hit the camera.
  const hops: { path: HopPath; toCamera: boolean; item: "batarang" | "mic" }[] = [];
  if (scene.character && charRect) {
    const hand = { x: charRect.x + charRect.w * 0.68, y: charRect.y + charRect.h * 0.42 };
    for (const th of scene.character.throws) {
      let from = hand;
      let start = th.atFrame;
      for (const hop of th.hops) {
        const toCamera = hop.target === "camera";
        const to = toCamera ? { x: 540, y: 900 } : (extraCenter(hop.target) ?? hand);
        hops.push({ path: { from, to, startFrame: start, endFrame: hop.hitFrame }, toCamera, item: th.item });
        from = to;
        start = hop.hitFrame;
      }
      const last = th.hops[th.hops.length - 1];
      if (last && last.target !== "camera") {
        hops.push({ path: { from, to: hand, startFrame: last.hitFrame, endFrame: last.hitFrame + Math.round(fps * 0.3) }, toCamera: false, item: th.item });
      }
    }
  }
  const speakingNear = (f: number) => scene.words.some((w) => f >= w.startFrame - 3 && f < w.endFrame + 3);

  return (
    <AbsoluteFill style={trans}>
      {/* Clips (laughs) fade in/out over a few frames so the cut from TTS to a recording is not a click. */}
      {scene.audioSrc && <Audio src={staticFile(scene.audioSrc)} volume={(f) => (scene.isClip ? scene.clipVolume * Math.min(1, f / 5, Math.max(0, (scene.speechFrames - f) / 8)) : scene.clipVolume)} />}
      {scene.sfx.map((fx, i) => (
        <Sequence key={i} from={fx.atFrame - scene.startFrame} durationInFrames={Math.max(1, scene.startFrame + scene.durationInFrames - fx.atFrame)}>
          {/* Effects duck under the voice so a boom never buries a line. */}
          <Audio src={staticFile(fx.src)} volume={(f) => fx.volume * (speakingNear(fx.atFrame + f) ? 0.38 : 1)} />
        </Sequence>
      ))}

      <AbsoluteFill style={{ transform: `translate(${camX}px, ${camY}px) scale(${camScale})`, transformOrigin: "50% 45%" }}>
        {scene.props.map((p, i) => {
          if (abs < p.atFrame || abs >= p.untilFrame) return null;
          if (p.on) return null; // attached props are drawn after the figures
          const slot = zoneSeen.get(p.position) ?? 0;
          zoneSeen.set(p.position, slot + 1);
          return <Prop key={i} prop={p} sceneStart={scene.startFrame} zone={spec.props[p.position]} palette={palette} slot={slot} slots={zoneCounts.get(p.position) ?? 1} />;
        })}

        {extraRects.map(({ e, m, rect }) => (
          <Stickman
            key={e.id}
            scene={scene}
            sceneStart={scene.startFrame}
            rect={rect}
            ink={e.color ?? (e.style === "thug" ? "#b9c0d4" : palette.ink)}
            accent={palette.accent}
            headFill={palette.propFill}
            style={e.style}
            actor={e}
            speaking={scene.speaker === e.id}
            held={abs >= e.heldFrame && !(e.held === "ball" && scene.projectiles.some((p) => p.from === e.id && p.atFrame <= abs)) ? e.held : null}
            label={e.label}
            hat={abs >= e.hatFrame && abs < e.hatUntilFrame ? e.hat : null}
            seated={e.seated}
            labelUp={scene.props.some((p) => p.on === e.id && p.position === "above_character" && abs >= p.atFrame && abs < p.untilFrame)}
            walker={{ action: m.action, shadow: 1 }}
            ko={e.koFrame !== null ? { frame: e.koFrame, dir: e.fallDir ? (e.fallDir === "right" ? 1 : -1) : m.cx < 540 ? 1 : -1 } : null}
          />
        ))}

        {cable && charRect && (
          <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <line x1={charRect.x + charRect.w * 0.7} y1={charRect.y + charRect.h * 0.3} x2={cable.x} y2={cable.y} stroke={palette.ink} strokeWidth={5} strokeLinecap="round" />
          </svg>
        )}

        {scene.character && charRect && !heroHidden && (
          <Stickman
            scene={scene}
            sceneStart={scene.startFrame}
            rect={charRect}
            ink={scene.character.color ?? palette.ink}
            accent={palette.accent}
            headFill={palette.propFill}
            style={scene.character.style}
            flip={scene.character.position === "right"}
            walker={motion ? { action: motion.action, shadow: motion.shadow } : undefined}
            zones={spec.props}
            squash={heroSquash}
            speaking={scene.speaker === null || scene.speaker === scene.character.id}
            held={scene.character.held}
            micTaken={scene.character.throws.some((th) => th.item === "mic" && th.atFrame <= abs)}
          />
        )}

        {scene.projectiles.length > 0 && <Projectiles scene={scene} abs={abs} rects={extraRects.map(({ e, rect }) => ({ id: e.id, rect, flip: false }))} rectAt={(id, frame) => extraRectsAt(frame).find((x) => x.e.id === id)?.rect ?? null} palette={palette} />}

        {scene.character && charRect && !heroHidden && scene.character.shots.length > 0 && (
          <Shots shots={scene.character.shots} abs={abs} poseAt={(f) => poseAtFrame(scene, f)} rect={charRect} flip={scene.character.position === "right"} zones={spec.props} magenta={scene.character.style === "jhin"} palette={palette} />
        )}

        {/* Props worn/held by an extra: on top of him (medal on the chest, trophy in the hand). */}
        {scene.props.map((p, i) => {
          if (!p.on || abs < p.atFrame || abs >= p.untilFrame) return null;
            const r = extraRects.find((x) => x.e.id === p.on)?.rect;
            if (!r) return null;
            const size = r.h * 0.26;
            const head = { x: r.x + r.w / 2, y: r.y + r.h * 0.12 };
            const zone =
              p.position === "above_character"
                ? { x: head.x - size / 2, y: head.y - size * 0.95, w: size, h: size }
                : p.position === "center"
                  ? { x: head.x - size / 2, y: r.y + r.h * 0.36, w: size, h: size }
                  : { x: (p.position === "left" ? r.x - size * 0.45 : r.x + r.w - size * 0.55), y: r.y + r.h * 0.28, w: size, h: size };
            return <Prop key={i} prop={{ ...p, position: "center" }} sceneStart={scene.startFrame} zone={zone} palette={palette} slot={0} slots={1} />;
        })}

        {charRect &&
          scene.bubbles.map((b, i) => {
            const anchor = b.on ? extraRects.find((x) => x.e.id === b.on)?.rect : charRect;
            return anchor ? <Bubble key={i} bubble={b} sceneStart={scene.startFrame} anchor={anchor} palette={palette} /> : null;
          })}

        {hops.map(({ path, toCamera, item }, i) => {
          const p = alongHop(path, abs);
          if (!p) return null;
          const size = toCamera ? interpolate(p.t, [0, 1], [130, 900]) : 130;
          if (item === "mic") return <FlyingMic key={i} x={p.x} y={p.y} frame={abs} size={size * 0.7} ink={palette.ink} />;
          return <Batarang key={i} x={p.x} y={p.y} frame={abs} size={size} ink={palette.ink} />;
        })}

      </AbsoluteFill>

      {/* Captions sit OUTSIDE the camera so zooms, pans and focus never crop or scale the text. */}
      {scene.captions && <KineticCaption words={scene.words} sceneStart={scene.startFrame} rect={spec.caption} palette={palette} fontPx={spec.captionFontPx} beat={scene.captionStyle === "beat"} chunkSize={scene.captionStyle === "beat" ? 6 : undefined} />}
      {/* Screen-space effects: outside the camera transform, on the viewer's glass. */}
      {scene.overlays.map((o, i) => {
        // Claw marks follow the claws: take the camera-strike geometry and map it through the camera.
        const cs = scene.character?.strikes.find((s) => s.target === "camera");
        const flip = scene.character?.position === "right";
        const geom = cs && charRect ? cameraSlashGeometry(charRect, Boolean(flip)) : null;
        const cam = { scale: camScale, x: camX, y: camY, ox: 540, oy: 1920 * 0.45 };
        const focus = charRect ? { x: charRect.x + charRect.w / 2, y: charRect.y + charRect.h * 0.5 } : { x: 540, y: 1100 };
        return <Overlay key={i} overlay={o} abs={abs} slash={geom ? { ...geom, atFrame: cs!.atFrame } : null} camera={cam} palette={palette} brand={brand} captionRect={spec.caption} focus={focus} />;
      })}
    </AbsoluteFill>
  );
};
