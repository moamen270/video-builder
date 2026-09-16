import pathlib


def patch(f, pairs):
    p = pathlib.Path(f); s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        assert a in s, (f, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")


# ---------- catalog / schema ----------
patch("engine/src/schema/catalog.ts", [
('export const CAMERA_MOVES = ["none", "punch_in", "slow_zoom", "shake"] as const;',
 'export const CAMERA_MOVES = ["none", "punch_in", "slow_zoom", "shake", "dolly_in"] as const; // dolly_in: fast 2.3x push toward the character (looming at the viewer)\n\n/** Full-frame effects drawn on top of everything — on the "viewer\'s screen", not in the scene. */\nexport const OVERLAYS = ["claw_marks", "flash", "blackout"] as const;\nexport type OverlayKind = (typeof OVERLAYS)[number];'),
])

patch("engine/src/schema/manifest.ts", [
('''  THEMES,
  TRANSITIONS,
  TRAVEL_STOPS,''', '''  THEMES,
  TRANSITIONS,
  TRAVEL_STOPS,
  OVERLAYS,'''),
('''export const CameraCue = z.object({
  move: z.enum(CAMERA_MOVES),
  at: Anchor,
});''', '''export const CameraCue = z.object({
  move: z.enum(CAMERA_MOVES),
  at: Anchor,
});

export const OverlayCue = z.object({
  /** claw_marks: three slashes torn across the frame + flash + dim. flash: white hit. blackout: fade to black. */
  kind: z.enum(OVERLAYS),
  at: Anchor,
  /** Default: end of scene. */
  until: Anchor.optional(),
});'''),
('''  camera: z.array(CameraCue).max(2).default([]),
});
export type Scene''', '''  camera: z.array(CameraCue).max(2).default([]),
  overlays: z.array(OverlayCue).max(3).default([]),
});
export type Scene'''),
])

patch("engine/src/schema/resolved.ts", [
('''  TRANSITIONS,
  VOICES,
} from "./catalog.js";''', '''  TRANSITIONS,
  VOICES,
  OVERLAYS,
} from "./catalog.js";'''),
('''export const ResolvedCamera = z.object({
  move: z.enum(CAMERA_MOVES),
  atFrame: z.number().int(),
});''', '''export const ResolvedCamera = z.object({
  move: z.enum(CAMERA_MOVES),
  atFrame: z.number().int(),
});

export const ResolvedOverlay = z.object({
  kind: z.enum(OVERLAYS),
  atFrame: z.number().int(),
  untilFrame: z.number().int(),
});'''),
('''  bubbles: z.array(ResolvedBubble),
  camera: z.array(ResolvedCamera),
});
export type ResolvedScene''', '''  bubbles: z.array(ResolvedBubble),
  camera: z.array(ResolvedCamera),
  overlays: z.array(ResolvedOverlay).default([]),
});
export type ResolvedScene'''),
])

patch("engine/src/resolver/resolve.ts", [
('''    const camera = s.camera.map((c, i) => ({ move: c.move, atFrame: at(c.at, `camera[${i}]`) }));''',
 '''    const camera = s.camera.map((c, i) => ({ move: c.move, atFrame: at(c.at, `camera[${i}]`) }));
    const overlays = s.overlays.map((o, i) => ({ kind: o.kind, atFrame: at(o.at, `overlays[${i}].at`), untilFrame: o.until ? at(o.until, `overlays[${i}].until`) : endFrame }));'''),
('''      bubbles,
      camera,
    };
  });''', '''      bubbles,
      camera,
      overlays,
    };
  });'''),
])

# ---------- renderer: strike hop ----------
patch("renderer/src/characters/Stickman.tsx", [
('''): { armDeg: number; useLeft: boolean; w: number; lungeX: number; torsoAdd: number; nodAdd: number } | null {''',
 '''): { armDeg: number; useLeft: boolean; w: number; lungeX: number; hopY: number; torsoAdd: number; nodAdd: number } | null {'''),
('''  const lungeFull = Math.min(520, Math.max(0, dist0 - reach)) * sign * (st.big ? 1.05 : 1);
  const lunge = ip(t, [-3, 0, 6, 20], [0, lungeFull, lungeFull, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dx = cx - (shX + lunge);
  const hit = (Math.atan2(dx, dy) * 180) / Math.PI; // rig convention: 0 = down, + = screen-right''',
 '''  // Close the gap along the line to the target: horizontally as a lunge, vertically as a hop.
  const excess = Math.max(0, dist0 - reach);
  const ux = dist0 > 0 ? dx0 / dist0 : 0;
  const uy = dist0 > 0 ? dy / dist0 : 0;
  const lungeFull = Math.min(520, excess * Math.abs(ux)) * sign * (st.big ? 1.05 : 1);
  const hopFull = Math.min(420, Math.max(0, -uy) * excess); // only when the target is above the shoulder
  const lunge = ip(t, [-3, 0, 6, 20], [0, lungeFull, lungeFull, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hopK = ip(t, [-4, 0, 6], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hopY = -hopFull * Math.sin((hopK * Math.PI) / 2); // up at contact, back down after
  const dx = cx - (shX + lunge);
  const dyNow = cy - (shY + hopY);
  const hit = (Math.atan2(dx, dyNow) * 180) / Math.PI; // rig convention: 0 = down, + = screen-right'''),
('''  return flip ? { armDeg: -armDeg, useLeft: sign > 0, w, lungeX: lunge, torsoAdd: -torsoAdd, nodAdd } : { armDeg, useLeft: sign < 0, w, lungeX: lunge, torsoAdd, nodAdd };''',
 '''  return flip ? { armDeg: -armDeg, useLeft: sign > 0, w, lungeX: lunge, hopY, torsoAdd: -torsoAdd, nodAdd } : { armDeg, useLeft: sign < 0, w, lungeX: lunge, hopY, torsoAdd, nodAdd };'''),
('''  const lungeX = strike?.lungeX ?? 0;''', '''  const lungeX = strike?.lungeX ?? 0;
  const hopY = strike?.hopY ?? 0;'''),
('''    <div style={{ position: "absolute", left: rect.x + lungeX, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>''',
 '''    <div style={{ position: "absolute", left: rect.x + lungeX, top: rect.y + hopY, width: rect.w, height: rect.h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>'''),
# legs tuck a little while hopping: reuse lift for the shadow
('''  const lift = rig.lift + bob + laughLift - kick * 4;''', '''  const lift = rig.lift + bob + laughLift - kick * 4 + hopY / scale;'''),
])

# ---------- renderer: camera dolly + overlays ----------
patch("renderer/src/scenes/SceneView.tsx", [
('''import { Bubble } from "./Bubble";''', '''import { Bubble } from "./Bubble";
import { Overlay } from "./Overlay";'''),
('''    if (c.move === "punch_in") camScale *= interpolate(spring({ frame: t, fps, config: { damping: 14, stiffness: 200 } }), [0, 1], [1, 1.09]);''',
 '''    if (c.move === "punch_in") camScale *= interpolate(spring({ frame: t, fps, config: { damping: 14, stiffness: 200 } }), [0, 1], [1, 1.09]);
    else if (c.move === "dolly_in") camScale *= interpolate(spring({ frame: t, fps, config: { damping: 18, stiffness: 90 } }), [0, 1], [1, 2.3]);'''),
('''        <KineticCaption words={scene.words} sceneStart={scene.startFrame} rect={spec.caption} palette={palette} fontPx={spec.captionFontPx} />
      </AbsoluteFill>
    </AbsoluteFill>''', '''        <KineticCaption words={scene.words} sceneStart={scene.startFrame} rect={spec.caption} palette={palette} fontPx={spec.captionFontPx} />
      </AbsoluteFill>
      {/* Screen-space effects: outside the camera transform, on the viewer's glass. */}
      {scene.overlays.map((o, i) => (
        <Overlay key={i} overlay={o} abs={abs} />
      ))}
    </AbsoluteFill>'''),
])

pathlib.Path("renderer/src/scenes/Overlay.tsx").write_text('''import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";

type Cue = ResolvedScene["overlays"][number];

/**
 * Full-frame effects on the viewer's screen. Deterministic per frame.
 * claw_marks: three diagonal gashes torn across the glass over ~6 frames, a
 * white hit-flash, then the picture behind dims and stays scarred.
 */
export const Overlay: React.FC<{ overlay: Cue; abs: number }> = ({ overlay, abs }) => {
  if (abs < overlay.atFrame || abs >= overlay.untilFrame) return null;
  const t = abs - overlay.atFrame;
  switch (overlay.kind) {
    case "flash":
      return <AbsoluteFill style={{ background: "#ffffff", opacity: interpolate(t, [0, 1, 8], [0, 0.9, 0], { extrapolateRight: "clamp" }) }} />;
    case "blackout":
      return <AbsoluteFill style={{ background: "#000000", opacity: interpolate(t, [0, 18], [0, 1], { extrapolateRight: "clamp" }) }} />;
    case "claw_marks":
      return <ClawMarks t={t} />;
  }
};

const MARKS = [
  { x1: 300, y1: 320, x2: 900, y2: 1520, delay: 0 },
  { x1: 470, y1: 260, x2: 1070, y2: 1460, delay: 2 },
  { x1: 140, y1: 400, x2: 740, y2: 1600, delay: 4 },
];

const ClawMarks: React.FC<{ t: number }> = ({ t }) => {
  const flash = interpolate(t, [0, 1, 7], [0, 0.85, 0], { extrapolateRight: "clamp" });
  const dim = interpolate(t, [10, 34], [0, 0.62], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = t < 8 ? Math.sin(t * 2.7) * (8 - t) * 1.6 : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000000", opacity: dim }} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
        <defs>
          <filter id="tear" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={14} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {MARKS.map((m, i) => {
          const len = Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
          const prog = interpolate(t - m.delay, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (prog <= 0) return null;
          const dash = `${len * prog} ${len}`;
          const common = { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, strokeLinecap: "round" as const, strokeDasharray: dash };
          return (
            <g key={i} filter="url(#tear)">
              <line {...common} stroke="#050608" strokeWidth={46} />
              <line {...common} stroke="#1c2230" strokeWidth={30} />
              <line {...common} stroke="#e8edf7" strokeWidth={9} opacity={0.9} />
              {/* glass splinters at the entry point */}
              {prog > 0.6 &&
                [-1, 1].map((s) => (
                  <line key={s} x1={m.x1} y1={m.y1} x2={m.x1 + s * 90} y2={m.y1 - 60 + s * 30} stroke="#e8edf7" strokeWidth={3} opacity={0.6} />
                ))}
            </g>
          );
        })}
      </svg>
      <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />
    </AbsoluteFill>
  );
};
''', encoding="utf-8")

# sample.ts overlays
p = pathlib.Path("renderer/src/sample.ts"); s = p.read_text(encoding="utf-8")
s = s.replace('      camera: [{ move: "punch_in", atFrame: 30 }],\n    },', '      camera: [{ move: "punch_in", atFrame: 30 }],\n      overlays: [],\n    },')
p.write_text(s, encoding="utf-8")
print("ok")
