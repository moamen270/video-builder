import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Expression, Pose, ResolvedScene, Word } from "@vb/engine/schema";
import { RIGS, lerpRig, type Rig } from "./poses";
import type { Rect } from "../theme";

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
  flip?: boolean;
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

export const Stickman: React.FC<Props> = ({ scene, rect, ink, accent, headFill, flip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = frame + scene.startFrame;
  const st = poseAt(scene, abs);

  // Spring between previous and current pose.
  const t = spring({ frame: abs - st.since, fps, config: { damping: 13, stiffness: 140, mass: 0.9 } });
  const rig: Rig = lerpRig(RIGS[st.prev], RIGS[st.pose], t);

  // Idle life: breathing bob, subtle arm sway, micro head motion.
  const bob = Math.sin(abs / 9) * 2.2;
  const sway = Math.sin(abs / 13) * 2.5;
  const talking = isTalking(scene.words, abs);
  const nodTalk = talking ? Math.sin(abs / 2.3) * 2.5 : 0;

  // Waving/celebrating get an extra oscillation on the forearm.
  const wiggle = st.pose === "waving" ? Math.sin(abs / 2.5) * 22 : st.pose === "celebrating" ? Math.sin(abs / 3) * 10 : 0;

  // Blink: ~every 2.7s, 4 frames long, deterministic.
  const blinkPeriod = Math.round(fps * 2.7);
  const blink = abs % blinkPeriod < 4;

  const lift = rig.lift + bob;
  const torso = rig.torso + sway * 0.4;

  // Torso: shoulder→hip rotates around hip by torso lean.
  const shoulder = polar(HIP.x, HIP.y, HIP.y - SHOULDER.y, 180 + torso);
  const neck = polar(HIP.x, HIP.y, HIP.y - NECK.y, 180 + torso);
  const headC = polar(neck.x, neck.y, HEAD_R + 6, 180 + torso + rig.head);

  const lElbow = polar(shoulder.x, shoulder.y, UPPER_ARM, rig.lUpper + torso + sway * 0.6);
  const lHand = polar(lElbow.x, lElbow.y, FORE_ARM, rig.lUpper + rig.lLower + torso + sway * 0.6);
  const rElbow = polar(shoulder.x, shoulder.y, UPPER_ARM, rig.rUpper + torso - sway * 0.6);
  const rHand = polar(rElbow.x, rElbow.y, FORE_ARM, rig.rUpper + rig.rLower + wiggle + torso - sway * 0.6);

  const lKnee = polar(HIP.x, HIP.y, THIGH, rig.lThigh);
  const lFoot = polar(lKnee.x, lKnee.y, SHIN, rig.lThigh + rig.lShin);
  const rKnee = polar(HIP.x, HIP.y, THIGH, rig.rThigh);
  const rFoot = polar(rKnee.x, rKnee.y, SHIN, rig.rThigh + rig.rShin);

  const scale = Math.min(rect.w / RW, rect.h / RH);
  const face = useMemo(() => faceFor(st.expression), [st.expression]);
  const mouthOpen = talking ? 0.5 + 0.5 * Math.abs(Math.sin(abs / 1.7)) : 0;

  const line = { stroke: ink, strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
        <circle cx={lHand.x} cy={lHand.y} r={7} fill={ink} />
        <circle cx={rHand.x} cy={rHand.y} r={7} fill={ink} />
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
                <circle cx={-10} cy={-6} r={face.eyeR} fill={ink} />
                <circle cx={10} cy={-6} r={face.eyeR} fill={ink} />
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

type MouthKind = "smile" | "flat" | "o" | "frown" | "wavy" | "smirk";

interface Face {
  eyeR: number;
  browL: [number, number];
  browR: [number, number];
  mouth: MouthKind;
}

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
    default:
      return { eyeR: 3.5, browL: [-2, -2], browR: [-2, -2], mouth: "flat" };
  }
}

const Mouth: React.FC<{ kind: MouthKind; open: number; ink: string; accent: string }> = ({ kind, open, ink }) => {
  const y = 12;
  const h = interpolate(open, [0, 1], [0, 9]);
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
    default:
      return <line x1={-10} y1={y + 2} x2={10} y2={y + 2} {...s} />;
  }
};
