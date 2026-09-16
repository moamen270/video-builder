import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CharacterStyle, Expression, Pose, PropPosition, ResolvedScene, Word } from "@vb/engine/schema";
import { LEFT_HAND_POSES, RIGS, SNAP_POSES, WALK_POSES, lerpRig, type Rig } from "./poses";
import { Walker, type WalkerAction } from "./Walker";
import type { Rect } from "../theme";
import { interpolate as ip } from "remotion";

/** Rig space: 240 wide × 420 tall, feet at y≈400. */
const RW = 240;
const RH = 420;
const HEAD_R = 34;
const NECK = { x: 120, y: 96 };
const SHOULDER = { x: 120, y: 118 };
const HIP = { x: 120, y: 240 };
const UPPER_ARM = 62;
const FORE_ARM = 56;
const THIGH = 78;
const SHIN = 76;
const STROKE = 11;

interface Props {
  scene: ResolvedScene;
  /** Composition-absolute frame of scene start. */
  sceneStart: number;
  rect: Rect;
  ink: string;
  accent: string;
  /** Head fill so limbs passing behind the head are hidden. */
  headFill: string;
  style: CharacterStyle;
  flip?: boolean;
  /** For walk_* poses: what the side-view rig is doing this frame. */
  walker?: { action: WalkerAction; shadow: number };
  /** Prop zones of the current layout — strike targets are aimed at their centres. */
  zones?: Record<PropPosition, Rect>;
}

/**
 * Melee strike state for one frame. The hand is driven to pass through the
 * target zone centre exactly at `atFrame`; if the target is out of reach the
 * whole body lunges toward it. Returns null when no strike is active.
 */
function strikeAt(
  strikes: { atFrame: number; target: PropPosition; big: boolean }[],
  abs: number,
  zones: Record<PropPosition, Rect> | undefined,
  rect: Rect,
  scale: number,
  flip: boolean,
): { armDeg: number; useLeft: boolean; w: number; lungeX: number; torsoAdd: number; nodAdd: number } | null {
  if (!zones) return null;
  const st = strikes.find((s) => abs >= s.atFrame - 8 && abs <= s.atFrame + 20);
  if (!st) return null;
  const t = abs - st.atFrame;
  const zone = zones[st.target];
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  // Shoulder in screen space (svg is bottom-aligned and centred in the rect).
  const svgLeft = rect.x + (rect.w - RW * scale) / 2;
  const svgTop = rect.y + rect.h - RH * scale;
  const shX = svgLeft + SHOULDER.x * scale;
  const shY = svgTop + SHOULDER.y * scale;
  const dx0 = cx - shX;
  const dy = cy - shY;
  const sign = dx0 >= 0 ? 1 : -1;
  const reach = (UPPER_ARM + FORE_ARM) * scale * 0.92;
  const dist0 = Math.hypot(dx0, dy);
  const lungeFull = Math.min(520, Math.max(0, dist0 - reach)) * sign * (st.big ? 1.05 : 1);
  const lunge = ip(t, [-3, 0, 6, 20], [0, lungeFull, lungeFull, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dx = cx - (shX + lunge);
  const hit = (Math.atan2(dx, dy) * 180) / Math.PI; // rig convention: 0 = down, + = screen-right
  // Over-the-top chop: wind up high and back, come down through the target, follow through below it.
  const windup = hit + sign * 125;
  const follow = hit - sign * (st.big ? 60 : 45);
  const armDeg = t < -3 ? ip(t, [-8, -3], [hit + sign * 70, windup], { extrapolateLeft: "clamp" }) : t < 0 ? ip(t, [-3, 0], [windup, hit]) : ip(t, [0, 4, 20], [hit, follow, follow], { extrapolateRight: "clamp" });
  const w = ip(t, [-8, -3, 4, 20], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const torsoAdd = sign * ip(t, [-8, -3, 0, 4, 20], [0, -8, 14, 16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const nodAdd = ip(t, [-3, 0, 4, 20], [-6, 10, 12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // A mirrored rig (position right) swaps screen-left/right for the rig's own arms and angles.
  return flip ? { armDeg: -armDeg, useLeft: sign > 0, w, lungeX: lunge, torsoAdd: -torsoAdd, nodAdd } : { armDeg, useLeft: sign < 0, w, lungeX: lunge, torsoAdd, nodAdd };
}

interface PoseState {
  pose: Pose;
  expression: Expression;
  since: number; // absolute frame the pose started
  prev: Pose;
}

function poseAt(scene: ResolvedScene, frame: number): PoseState {
  const c = scene.character!;
  let pose: Pose = c.pose;
  let expression: Expression = c.expression;
  let since = scene.startFrame;
  let prev: Pose = c.pose;
  for (const pc of c.poseChanges) {
    if (pc.atFrame <= frame) {
      prev = pose;
      pose = pc.pose;
      if (pc.expression) expression = pc.expression;
      since = pc.atFrame;
    } else break;
  }
  return { pose, expression, since, prev };
}

const isTalking = (words: Word[], frame: number) => words.some((w) => frame >= w.startFrame && frame < w.endFrame);


/** 0° = straight down, 90° = screen-right, 180° = straight up. */
const polar = (x: number, y: number, len: number, deg: number) => {
  const r = (deg * Math.PI) / 180;
  return { x: x + Math.sin(r) * len, y: y + Math.cos(r) * len };
};

export const Stickman: React.FC<Props> = ({ scene, rect, ink, accent, headFill, style, flip, walker, zones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = frame + scene.startFrame;
  const st = poseAt(scene, abs);
  if (WALK_POSES.has(st.pose)) {
    return <Walker rect={rect} frame={abs} fps={fps} ink={ink} headFill={headFill} facingLeft={st.pose === "walk_left"} action={walker?.action} shadow={walker?.shadow} />;
  }

  // Spring between previous and current pose.
  const snap = SNAP_POSES.has(st.pose);
  const t = spring({ frame: abs - st.since, fps, config: snap ? { damping: 20, stiffness: 420, mass: 0.6 } : { damping: 13, stiffness: 140, mass: 0.9 } });
  const rigBase: Rig = lerpRig(RIGS[st.prev], RIGS[st.pose], t);
  const scale = Math.min(rect.w / RW, rect.h / RH);
  const strike = strikeAt(scene.character?.strikes ?? [], abs, zones, rect, scale, Boolean(flip));
  const rig: Rig = { ...rigBase };
  if (strike) {
    const k = strike.w;
    if (strike.useLeft) {
      rig.lUpper = rigBase.lUpper + (strike.armDeg - rigBase.lUpper) * k;
      rig.lLower = rigBase.lLower * (1 - k);
      rig.rUpper = rigBase.rUpper + (-strike.armDeg * 0.35 - rigBase.rUpper) * k; // other arm counter-swings
    } else {
      rig.rUpper = rigBase.rUpper + (strike.armDeg - rigBase.rUpper) * k;
      rig.rLower = rigBase.rLower * (1 - k);
      rig.lUpper = rigBase.lUpper + (-strike.armDeg * 0.35 - rigBase.lUpper) * k;
    }
    rig.torso = rigBase.torso + strike.torsoAdd * k;
    rig.nod = rigBase.nod + strike.nodAdd * k;
  }
  const lungeX = strike?.lungeX ?? 0;

  // Idle life: breathing bob, subtle arm sway, micro head motion.
  const bob = Math.sin(abs / 9) * 2.2;
  const sway = Math.sin(abs / 13) * 2.5;
  const talking = isTalking(scene.words, abs);
  const nodTalk = talking ? Math.sin(abs / 2.3) * 2.5 : 0;

  // Waving/celebrating get an extra oscillation on the forearm.
  const wiggle = st.pose === "waving" ? Math.sin(abs / 2.5) * 22 : st.pose === "celebrating" ? Math.sin(abs / 3) * 10 : 0;
  // Laughing: whole body bounces on every spoken beat ("ha"), head rocks back.
  const laughing = st.pose === "laughing";
  const laughBeat = laughing && talking ? Math.abs(Math.sin(abs / 1.6)) : 0;
  const laughLift = laughing ? -laughBeat * 10 : 0;
  const laughNod = laughing ? laughBeat * 8 : 0;

  // Blink: ~every 2.7s, 4 frames long, deterministic.
  const blinkPeriod = Math.round(fps * 2.7);
  const blink = abs % blinkPeriod < 4;

  // "wolverine" = the plain stickman with claws. No costume: the claws carry the aura.
  const wolv = style === "wolverine";
  // "gunslinger" = pistol in the right hand; `shots` add a muzzle flash + recoil.
  const gun = style === "gunslinger";
  const shots = scene.character?.shots ?? [];
  const lastShot = shots.filter((sh) => sh.atFrame <= abs).at(-1);
  const sinceShot = lastShot ? abs - lastShot.atFrame : Infinity;
  const kick = sinceShot < 7 ? (1 - sinceShot / 7) * (lastShot?.big ? 1.6 : 1) : 0;
  const gunLeft = gun && LEFT_HAND_POSES.has(st.pose);
  const flash = sinceShot < (lastShot?.big ? 6 : 4) ? 1 - sinceShot / (lastShot?.big ? 6 : 4) : 0;
  const lift = rig.lift + bob + laughLift - kick * 4;
  const torso = rig.torso + sway * 0.4 - laughNod * 0.4;

  // Torso: shoulder→hip rotates around hip by torso lean.
  const shoulder = polar(HIP.x, HIP.y, HIP.y - SHOULDER.y, 180 + torso);
  const neck = polar(HIP.x, HIP.y, HIP.y - NECK.y, 180 + torso);
  const headC = polar(neck.x, neck.y, HEAD_R + 6, 180 + torso + rig.head);

  const recoil = kick * 14;
  const lRecoil = gunLeft ? -recoil : 0;
  const rRecoil = gunLeft ? 0 : recoil;
  const lArmDeg = rig.lUpper + torso + sway * 0.6 + lRecoil;
  const lElbow = polar(shoulder.x, shoulder.y, UPPER_ARM, lArmDeg);
  const lForeDeg = rig.lUpper + rig.lLower + torso + sway * 0.6 + lRecoil * 1.4;
  const lHand = polar(lElbow.x, lElbow.y, FORE_ARM, lForeDeg);
  const rArmDeg = rig.rUpper + torso - sway * 0.6 + rRecoil;
  const rElbow = polar(shoulder.x, shoulder.y, UPPER_ARM, rArmDeg);
  const rForeDeg = rig.rUpper + rig.rLower + wiggle + torso - sway * 0.6 + rRecoil * 1.4;
  const rHand = polar(rElbow.x, rElbow.y, FORE_ARM, rForeDeg);

  const lKnee = polar(HIP.x, HIP.y, THIGH, rig.lThigh);
  const lFoot = polar(lKnee.x, lKnee.y, SHIN, rig.lThigh + rig.lShin);
  const rKnee = polar(HIP.x, HIP.y, THIGH, rig.rThigh);
  const rFoot = polar(rKnee.x, rKnee.y, SHIN, rig.rThigh + rig.rShin);

  const face = useMemo(() => faceFor(st.expression), [st.expression]);
  const mouthOpen = talking ? (laughing ? 0.7 + 0.3 * laughBeat : 0.5 + 0.5 * Math.abs(Math.sin(abs / 1.7))) : 0;

  const line = { stroke: ink, strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <div style={{ position: "absolute", left: rect.x + lungeX, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <svg
        width={RW * scale}
        height={RH * scale}
        viewBox={`0 0 ${RW} ${RH}`}
        style={{ transform: `translateY(${lift * scale}px) ${flip ? "scaleX(-1)" : ""}`, overflow: "visible" }}
      >
        {/* shadow */}
        <ellipse cx={120} cy={404} rx={58 + Math.abs(lift) * 0.4} ry={7} fill="rgba(0,0,0,0.25)" />
        {/* legs */}
        <polyline points={`${HIP.x},${HIP.y} ${lKnee.x},${lKnee.y} ${lFoot.x},${lFoot.y}`} {...line} />
        <polyline points={`${HIP.x},${HIP.y} ${rKnee.x},${rKnee.y} ${rFoot.x},${rFoot.y}`} {...line} />
        {/* torso */}
        <line x1={HIP.x} y1={HIP.y} x2={neck.x} y2={neck.y} {...line} strokeWidth={STROKE + 1} />
        {/* arms */}
        <polyline points={`${shoulder.x},${shoulder.y} ${lElbow.x},${lElbow.y} ${lHand.x},${lHand.y}`} {...line} />
        <polyline points={`${shoulder.x},${shoulder.y} ${rElbow.x},${rElbow.y} ${rHand.x},${rHand.y}`} {...line} />
        {/* hands */}
        {wolv && <Claws x={lHand.x} y={lHand.y} deg={rig.lUpper + rig.lLower + torso} />}
        {wolv && <Claws x={rHand.x} y={rHand.y} deg={rig.rUpper + rig.rLower + wiggle + torso} />}
        {gun && !gunLeft && <Pistol x={rHand.x} y={rHand.y} deg={rForeDeg} flash={flash} big={Boolean(lastShot?.big)} accent={accent} />}
        {gun && gunLeft && <Pistol x={lHand.x} y={lHand.y} deg={lForeDeg} flash={flash} big={Boolean(lastShot?.big)} accent={accent} />}
        <circle cx={lHand.x} cy={lHand.y} r={wolv ? 9 : 7} fill={ink} />
        <circle cx={rHand.x} cy={rHand.y} r={wolv ? 9 : 7} fill={ink} />
        {/* head */}
        <g transform={`translate(${headC.x} ${headC.y}) rotate(${rig.head + torso * 0.5 + nodTalk * 0.3})`}>
          <circle r={HEAD_R} fill={headFill} stroke={ink} strokeWidth={STROKE} />
          <g transform={`translate(0 ${rig.nod * 0.25 + nodTalk * 0.4})`}>
            {/* eyes */}
            {blink ? (
              <>
                <line x1={-14} y1={-6} x2={-6} y2={-6} {...line} strokeWidth={4} />
                <line x1={6} y1={-6} x2={14} y2={-6} {...line} strokeWidth={4} />
              </>
            ) : (
              <>
                {face.eyes === "closed" ? (
                  <>
                    <path d="M -17 -4 Q -10 -12 -3 -4" stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />
                    <path d="M 3 -4 Q 10 -12 17 -4" stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <circle cx={-10} cy={-4} r={face.eyeR} fill={ink} />
                    <circle cx={10} cy={-4} r={face.eyeR} fill={ink} />
                  </>
                )}
              </>
            )}
            {/* brows */}
            <line x1={-17} y1={-16 + face.browL[0]} x2={-4} y2={-16 + face.browL[1]} {...line} strokeWidth={4} />
            <line x1={4} y1={-16 + face.browR[0]} x2={17} y2={-16 + face.browR[1]} {...line} strokeWidth={4} />
            {/* mouth */}
            <Mouth kind={face.mouth} open={mouthOpen} ink={ink} accent={accent} />
          </g>
        </g>
      </svg>
    </div>
  );
};

type MouthKind = "smile" | "flat" | "o" | "frown" | "wavy" | "smirk" | "grin" | "laugh";

interface Face {
  eyeR: number;
  eyes?: "open" | "closed";
  browL: [number, number];
  browR: [number, number];
  mouth: MouthKind;
}

/**
 * Long-barrelled pistol held along the forearm direction (`deg`, 0 = down).
 * Local +y runs out along the barrel; the grip hangs toward screen-down, so the
 * silhouette stays upright whether he aims left or right. `flash` 0–1 draws
 * the muzzle flash at the tip.
 */
const Pistol: React.FC<{ x: number; y: number; deg: number; flash: number; big: boolean; accent: string }> = ({ x, y, deg, flash, big, accent }) => {
  const L = 74; // barrel length in rig units
  // Rig angles are 0 = down, positive = screen-right (x = sin, y = cos). SVG rotate() is
  // clockwise, so rotate(-deg) maps local +y onto that direction.
  const d = ((deg % 360) + 540) % 360 - 180; // -180..180
  const mirror = d > 0 ? -1 : 1; // keep the grip hanging toward screen-down on either side
  const dark = "#171a26";
  const steel = "#9aa3b8";
  return (
    <g transform={`translate(${x} ${y}) rotate(${-deg}) scale(${mirror} 1)`}>
      {/* grip: hangs below the hand, angled back */}
      <path d="M -2 -14 L 14 -14 L 26 -32 L 12 -38 Z" fill={dark} />
      <rect x={4} y={-36} width={10} height={8} rx={2} fill={accent} transform="rotate(-30 9 -32)" />
      {/* frame / body over the hand */}
      <rect x={-12} y={-14} width={26} height={22} rx={5} fill={dark} />
      <rect x={-9} y={-11} width={20} height={16} rx={4} fill="#2c3145" />
      <circle cx={2} cy={-3} r={4} fill={accent} />
      {/* cylinder + long barrel */}
      <rect x={-13} y={8} width={26} height={16} rx={6} fill="#3a4157" />
      <rect x={-7} y={22} width={14} height={L - 22} rx={3} fill="#2c3145" />
      <rect x={-4} y={24} width={8} height={L - 26} rx={2} fill={steel} />
      <rect x={-9} y={L - 14} width={18} height={12} rx={3} fill={dark} />
      <rect x={-2} y={L - 4} width={4} height={6} fill={steel} />
      {flash > 0 && (
        <g transform={`translate(0 ${L + 8})`} opacity={flash}>
          <path
            d={`M 0 ${-8 * flash} L ${10 * flash} ${8 * flash} L ${28 * flash * (big ? 1.6 : 1)} ${16 * flash} L ${8 * flash} ${24 * flash} L 0 ${46 * flash * (big ? 1.8 : 1)} L ${-8 * flash} ${24 * flash} L ${-28 * flash * (big ? 1.6 : 1)} ${16 * flash} L ${-10 * flash} ${8 * flash} Z`}
            fill="#ffd166"
          />
          <circle r={9 * flash * (big ? 1.5 : 1)} cy={10} fill="#ffffff" />
        </g>
      )}
    </g>
  );
};

/** Three adamantium claws fanning out of a hand, along the forearm direction. */
const Claws: React.FC<{ x: number; y: number; deg: number }> = ({ x, y, deg }) => (
  <g transform={`translate(${x} ${y}) rotate(${-deg})`}>
    {[-16, 0, 16].map((dx) => (
      <g key={dx}>
        <path d={`M ${dx * 0.45 - 4} 2 L ${dx * 0.45 + 4} 2 L ${dx} 58 Z`} fill="#0b0d14" />
        <path d={`M ${dx * 0.45 - 2} 4 L ${dx * 0.45 + 2} 4 L ${dx} 54 Z`} fill="#e6ecf7" />
        <path d={`M ${dx * 0.45 - 1} 6 L ${dx * 0.45} 6 L ${dx * 0.85} 40 Z`} fill="#ffffff" opacity={0.7} />
      </g>
    ))}
  </g>
);

function faceFor(e: Expression): Face {
  switch (e) {
    case "happy":
      return { eyeR: 3.5, browL: [-2, -4], browR: [-4, -2], mouth: "smile" };
    case "surprised":
      return { eyeR: 5.5, browL: [-8, -9], browR: [-9, -8], mouth: "o" };
    case "worried":
      return { eyeR: 3.5, browL: [-6, 0], browR: [0, -6], mouth: "frown" };
    case "confused":
      return { eyeR: 3.5, browL: [-2, 0], browR: [-8, -3], mouth: "wavy" };
    case "smug":
      return { eyeR: 3, browL: [0, -3], browR: [-6, -2], mouth: "smirk" };
    case "laughing":
      return { eyeR: 3, eyes: "closed", browL: [-4, -6], browR: [-6, -4], mouth: "laugh" };
    case "fierce":
      return { eyeR: 3, browL: [-8, 0], browR: [0, -8], mouth: "grin" };
    default:
      return { eyeR: 3.5, browL: [-2, -2], browR: [-2, -2], mouth: "flat" };
  }
}

const Mouth: React.FC<{ kind: MouthKind; open: number; ink: string; accent: string }> = ({ kind, open, ink }) => {
  const y = 12;
  const h = interpolate(open, [0, 1], [0, 9]);
  if (kind === "laugh") {
    // Big D-shaped laugh, jaw following the beat.
    const hh = 8 + h * 1.4;
    return (
      <g>
        <path d={`M -14 ${y - 2} H 14 Q 14 ${y + hh} 0 ${y + hh} Q -14 ${y + hh} -14 ${y - 2} Z`} fill={ink} />
        <path d={`M -11 ${y - 1} H 11 V ${y + 3} H -11 Z`} fill="#ffffff" />
      </g>
    );
  }
  if (open > 0.05) {
    // Talking: an ellipse whose height follows the jaw.
    return <ellipse cx={0} cy={y + h / 2} rx={kind === "o" ? 6 : 9} ry={Math.max(1.5, h)} fill={ink} />;
  }
  const s = { stroke: ink, strokeWidth: 4, fill: "none", strokeLinecap: "round" as const };
  switch (kind) {
    case "smile":
      return <path d={`M -12 ${y - 2} Q 0 ${y + 12} 12 ${y - 2}`} {...s} />;
    case "frown":
      return <path d={`M -10 ${y + 6} Q 0 ${y - 4} 10 ${y + 6}`} {...s} />;
    case "o":
      return <circle cx={0} cy={y + 2} r={5} {...s} />;
    case "wavy":
      return <path d={`M -12 ${y + 2} Q -6 ${y - 4} 0 ${y + 2} T 12 ${y + 2}`} {...s} />;
    case "smirk":
      return <path d={`M -10 ${y + 2} Q 2 ${y + 6} 12 ${y - 4}`} {...s} />;
    case "grin":
      return (
        <g>
          <path d={`M -14 ${y} Q 0 ${y + 14} 14 ${y} Z`} fill={ink} />
          <path d={`M -11 ${y + 1} H 11 V ${y + 4} H -11 Z`} fill="#ffffff" />
        </g>
      );
    default:
      return <line x1={-10} y1={y + 2} x2={10} y2={y + 2} {...s} />;
  }
};
