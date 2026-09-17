import React from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";
import { FONT, SAFE, type Palette } from "../theme";

type Cue = ResolvedScene["overlays"][number];

export interface SlashGeom {
  shX: number;
  shY: number;
  tipR: number;
  handR: number;
  windup: number;
  hit: number;
  follow: number;
  fan: number;
  atFrame: number;
}
export interface CameraMap {
  scale: number;
  x: number;
  y: number;
  ox: number;
  oy: number;
}

/** Scene px → screen px through the scene's camera transform (scale about origin, then offset). */
const toScreen = (cam: CameraMap, x: number, y: number) => ({ x: cam.ox + (x - cam.ox) * cam.scale + cam.x, y: cam.oy + (y - cam.oy) * cam.scale + cam.y });

/**
 * Full-frame effects on the viewer's screen. Deterministic per frame.
 * claw_marks: three gashes torn along the claw-tip path over the swing, a white
 * hit-flash, then the picture behind dims and stays scarred.
 */
export const Overlay: React.FC<{ overlay: Cue; abs: number; slash: SlashGeom | null; camera: CameraMap; palette: Palette; brand: { handle: string; name: string } | null; captionRect: { x: number; y: number; w: number; h: number } }> = ({ overlay, abs, slash, camera, palette, brand, captionRect }) => {
  if (abs < overlay.atFrame || abs >= overlay.untilFrame) return null;
  const t = abs - overlay.atFrame;
  switch (overlay.kind) {
    case "flash":
      return <AbsoluteFill style={{ background: "#ffffff", opacity: interpolate(t, [0, 1, 8], [0, 0.9, 0], { extrapolateRight: "clamp" }) }} />;
    case "blackout":
      return <AbsoluteFill style={{ background: "#000000", opacity: interpolate(t, [0, 18], [0, 1], { extrapolateRight: "clamp" }) }} />;
    case "claw_marks":
      return <ClawMarks t={t} abs={abs} slash={slash} camera={camera} />;
    case "bat_signal":
      return <BatSignal t={t} />;
    case "batarang_stuck":
      return <BatarangStuck t={t} />;
    case "hook_card":
      return <HookCard t={t} out={overlay.untilFrame - abs} text={overlay.text ?? ""} palette={palette} />;
    case "follow_card":
      return <FollowCard t={t} handle={brand?.handle ?? "@DummySticky"} palette={palette} rect={captionRect} />;
  }
};

/**
 * Text hook for the first ~1.5 s: huge, top of the safe area, slams in and
 * pops out. Sits above the top prop slots (y 300+) so it never covers the action.
 */
const HookCard: React.FC<{ t: number; out: number; text: string; palette: Palette }> = ({ t, out, text, palette }) => {
  const enter = spring({ frame: t, fps: 30, config: { damping: 12, stiffness: 260, mass: 0.7 } });
  const leave = interpolate(out, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(enter, [0, 1], [1.6, 1]) * interpolate(leave, [0, 1], [0.85, 1]);
  const size = text.length > 26 ? 84 : text.length > 16 ? 100 : 118;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          right: SAFE.right,
          top: SAFE.top + 10,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.02,
          letterSpacing: -1,
          color: palette.fg,
          textTransform: "uppercase",
          transform: `scale(${scale}) rotate(${interpolate(enter, [0, 1], [-4, -1.5])}deg)`,
          opacity: leave,
          textShadow: `0 6px 0 ${palette.accent}, 0 10px 30px rgba(0,0,0,0.55)`,
          WebkitTextStroke: `3px ${palette.stroke}`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** CTA card in the caption slot (turn the scene's captions off): handle + a pulsing "Follow" pill on a dark panel. */
const FollowCard: React.FC<{ t: number; handle: string; palette: Palette; rect: { x: number; y: number; w: number; h: number } }> = ({ t, handle, palette, rect }) => {
  const enter = spring({ frame: t, fps: 30, config: { damping: 14, stiffness: 180 } });
  const pulse = 1 + 0.05 * Math.max(0, Math.sin(t / 4));
  const tap = interpolate(t, [24, 28, 34], [1, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); // a "tap" on the button
  const followed = t >= 28;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: rect.x + 60,
          width: rect.w - 120,
          top: rect.y - 30,
          padding: "26px 0 30px",
          borderRadius: 40,
          background: "rgba(0,0,0,0.78)",
          boxShadow: "0 12px 50px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          fontFamily: FONT,
          transform: `translateY(${interpolate(enter, [0, 1], [160, 0])}px)`,
          opacity: enter,
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 900, color: palette.fg, textShadow: `0 4px 0 ${palette.stroke}` }}>{handle}</div>
        <div
          style={{
            padding: "18px 64px",
            borderRadius: 999,
            fontSize: 54,
            fontWeight: 900,
            letterSpacing: 1,
            color: followed ? palette.fg : palette.bg[0],
            background: followed ? "transparent" : palette.accent,
            border: `6px solid ${palette.accent}`,
            transform: `scale(${pulse * tap})`,
            boxShadow: followed ? "none" : `0 0 40px ${palette.accent}88`,
          }}
        >
          {followed ? "✓ FOLLOWING" : "+ FOLLOW"}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const BAT_PATH =
  "M 0 -12 C -8 -28 -28 -34 -44 -26 C -36 -22 -32 -14 -34 -6 C -24 -10 -14 -8 -6 0 L 0 14 L 6 0 C 14 -8 24 -10 34 -6 C 32 -14 36 -22 44 -26 C 28 -34 8 -28 0 -12 Z";

/** The signal on the clouds: a warm disc that fades in with a soft beam, bat silhouette in the middle. */
const BatSignal: React.FC<{ t: number }> = ({ t }) => {
  const k = interpolate(t, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + 0.02 * Math.sin(t / 5);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#03040a", opacity: 0.55 * k }} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, opacity: k }}>
        <defs>
          <radialGradient id="beam" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff4c2" stopOpacity={0.95} />
            <stop offset="60%" stopColor="#ffe066" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ffe066" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g transform={`translate(540 880) scale(${pulse * k})`}>
          <circle r={520} fill="url(#beam)" />
          <circle r={300} fill="#ffe066" />
          <circle r={300} fill="none" stroke="#fff7d6" strokeWidth={10} />
          <g transform="scale(6.2)">
            <path d={BAT_PATH} fill="#0b0d14" />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** Batarang embedded in the viewer's screen with cracks radiating from the hit. */
const BatarangStuck: React.FC<{ t: number }> = ({ t }) => {
  const flash = interpolate(t, [0, 1, 7], [0, 0.9, 0], { extrapolateRight: "clamp" });
  const settle = interpolate(t, [0, 4], [1.15, 1], { extrapolateRight: "clamp" });
  const shake = t < 8 ? Math.sin(t * 2.9) * (8 - t) * 1.8 : 0;
  const cracks = [
    [0, -330], [250, -220], [340, 60], [200, 300], [-120, 340], [-320, 160], [-330, -140], [-170, -300],
  ] as const;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${-shake * 0.7}px)` }}>
        <g transform={`translate(540 900) scale(${settle})`}>
          {cracks.map(([dx, dy], i) => {
            const grow = interpolate(t, [i * 0.4, i * 0.4 + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const mx = dx * 0.55 + (i % 2 ? 40 : -40);
            const my = dy * 0.55 + (i % 2 ? -30 : 30);
            return (
              <g key={i} opacity={0.9}>
                <path d={`M 0 0 L ${mx * grow} ${my * grow} L ${dx * grow} ${dy * grow}`} fill="none" stroke="#050608" strokeWidth={9} strokeLinecap="round" />
                <path d={`M 0 0 L ${mx * grow} ${my * grow} L ${dx * grow} ${dy * grow}`} fill="none" stroke="#e8edf7" strokeWidth={3} strokeLinecap="round" />
              </g>
            );
          })}
          <circle r={70} fill="#050608" opacity={0.7} />
          <g transform="scale(6.8) rotate(-18)">
            <path d={BAT_PATH} fill="#0b0d14" stroke="#e8edf7" strokeWidth={0.8} strokeLinejoin="round" />
          </g>
        </g>
      </svg>
      <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />
    </AbsoluteFill>
  );
};

/** Fallback marks when there is no camera strike in the scene. */
const FALLBACK: SlashGeom = { shX: 540, shY: 900, tipR: 900, handR: 700, windup: 150, hit: 55, follow: -55, fan: 30, atFrame: 0 };

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180; // rig convention: 0 = down, + = screen-right
  return { x: cx + Math.sin(a) * r, y: cy + Math.cos(a) * r };
};

const ClawMarks: React.FC<{ t: number; abs: number; slash: SlashGeom | null; camera: CameraMap }> = ({ t, abs, slash, camera }) => {
  const g = slash ?? FALLBACK;
  // The swing runs from strike-3 (windup) to strike+4 (follow-through); marks are revealed as the tips pass.
  const swingT = slash ? abs - slash.atFrame : t - 3;
  const reveal = interpolate(swingT, [-3, 0, 4], [0, 0.45, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flash = interpolate(swingT, [0, 1, 7], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dim = interpolate(swingT, [10, 34], [0, 0.62], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = swingT >= 0 && swingT < 8 ? Math.sin(swingT * 2.7) * (8 - swingT) * 1.6 : 0;
  if (reveal <= 0) return null;

  const pivot = toScreen(camera, g.shX, g.shY);
  const R = g.tipR * camera.scale;
  // Fanned claws physically trace the same circle (one groove); the cartoon convention is
  // three parallel gashes, so stagger them radially and let each lag a hair behind the last.
  const gap = 4.2 * g.fan * camera.scale;
  const claws = [
    { dr: -gap, lagDeg: 0 },
    { dr: 0, lagDeg: 3 },
    { dr: gap, lagDeg: 6 },
  ];
  const a0 = g.windup;
  const a1 = g.follow;
  const aEnd = a0 + (a1 - a0) * reveal;
  const arc = (offsetDeg: number, radius: number) => {
    const N = 24;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + (aEnd - a0) * (i / N) + offsetDeg;
      const p = polar(pivot.x, pivot.y, radius, a);
      pts.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
    return pts.join(" ");
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000000", opacity: dim }} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, overflow: "visible", transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
        <defs>
          <filter id="tear" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={12} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {claws.map((c, i) => {
          const d = arc(c.lagDeg, R - 12 + c.dr);
          return (
            <g key={i} filter="url(#tear)">
              <path d={d} fill="none" stroke="#050608" strokeWidth={40} strokeLinecap="round" />
              <path d={d} fill="none" stroke="#1c2230" strokeWidth={24} strokeLinecap="round" />
              <path d={d} fill="none" stroke="#e8edf7" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
            </g>
          );
        })}
      </svg>
      <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />
    </AbsoluteFill>
  );
};
