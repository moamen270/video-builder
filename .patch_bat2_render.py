import pathlib


def patch(f, pairs):
    p = pathlib.Path(f); s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        assert a in s, (f, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")


# ---------------- poses ----------------
patch("renderer/src/characters/poses.ts", [
('''  walk_right: {''', '''  run_right: { lUpper: -8, lLower: -6, rUpper: 8, rLower: 6, lThigh: -7, lShin: 0, rThigh: 7, rShin: 0, head: 0, torso: 0, lift: 0, nod: 0 },
  run_left: { lUpper: -8, lLower: -6, rUpper: 8, rLower: 6, lThigh: -7, lShin: 0, rThigh: 7, rShin: 0, head: 0, torso: 0, lift: 0, nod: 0 },
  knocked_out: { lUpper: -30, lLower: -20, rUpper: 40, rLower: 30, lThigh: -12, lShin: 0, rThigh: 16, rShin: -10, head: 8, torso: 0, lift: 0, nod: 0 },
  walk_right: {'''),
('export const WALK_POSES: ReadonlySet<Pose> = new Set<Pose>(["walk_right", "walk_left"]);',
 'export const WALK_POSES: ReadonlySet<Pose> = new Set<Pose>(["walk_right", "walk_left", "run_right", "run_left"]);\nexport const RUN_POSES: ReadonlySet<Pose> = new Set<Pose>(["run_right", "run_left"]);'),
])

# ---------------- Walker: run variant ----------------
patch("renderer/src/characters/Walker.tsx", [
('''  action?: WalkerAction;
  /** Skip the ground shadow (e.g. mid-air). */
  shadow?: number;
}''', '''  action?: WalkerAction;
  /** Skip the ground shadow (e.g. mid-air). */
  shadow?: number;
  /** Sprint: faster cadence, longer stride, forward lean. */
  run?: boolean;
  /** Extra decoration drawn on the head (e.g. a thug's beanie). */
  headDecor?: React.ReactNode;
}'''),
('''function limbsFor(action: WalkerAction, ph: number): Limbs {
  switch (action.kind) {
    case "walk": {
      const legN = 32 * Math.sin(ph);
      const legF = 32 * Math.sin(ph + Math.PI);
      const bendN = 58 * Math.max(0, Math.cos(ph)) * (0.35 + 0.65 * (1 - Math.sin(ph)) * 0.5);
      const bendF = 58 * Math.max(0, Math.cos(ph + Math.PI)) * (0.35 + 0.65 * (1 - Math.sin(ph + Math.PI)) * 0.5);
      return {
        thighN: legN,
        shinN: -bendN,
        thighF: legF,
        shinF: -bendF,
        armN: -26 * Math.sin(ph + Math.PI),
        foreN: 28,
        armF: -26 * Math.sin(ph),
        foreF: 28,
        lean: 6,
        nod: 0,
      };
    }''', '''function limbsFor(action: WalkerAction, ph: number, run = false): Limbs {
  switch (action.kind) {
    case "walk": {
      const stride = run ? 44 : 32;
      const legN = stride * Math.sin(ph);
      const legF = stride * Math.sin(ph + Math.PI);
      const bendN = (run ? 78 : 58) * Math.max(0, Math.cos(ph)) * (0.35 + 0.65 * (1 - Math.sin(ph)) * 0.5);
      const bendF = (run ? 78 : 58) * Math.max(0, Math.cos(ph + Math.PI)) * (0.35 + 0.65 * (1 - Math.sin(ph + Math.PI)) * 0.5);
      return {
        thighN: legN,
        shinN: -bendN,
        thighF: legF,
        shinF: -bendF,
        armN: (run ? -40 : -26) * Math.sin(ph + Math.PI),
        foreN: run ? 70 : 28,
        armF: (run ? -40 : -26) * Math.sin(ph),
        foreF: run ? 70 : 28,
        lean: run ? 16 : 6,
        nod: 0,
      };
    }'''),
('''export const Walker: React.FC<Props> = ({ rect, frame, fps, ink, headFill, facingLeft, cadence = 1.9, action = { kind: "walk" }, shadow = 1 }) => {
  const ph = (frame / fps) * cadence * Math.PI; // one full cycle = two steps
  const L = limbsFor(action, ph);''', '''export const Walker: React.FC<Props> = ({ rect, frame, fps, ink, headFill, facingLeft, cadence, action = { kind: "walk" }, shadow = 1, run = false, headDecor }) => {
  const cad = cadence ?? (run ? 3.4 : 1.9);
  const ph = (frame / fps) * cad * Math.PI; // one full cycle = two steps
  const L = limbsFor(action, ph, run);'''),
('''  const bob = action.kind === "walk" ? -4 * Math.abs(Math.cos(ph)) : action.kind === "stand" ? -1.5 * Math.sin(frame / 12) : 0;''',
 '''  const bob = action.kind === "walk" ? -(run ? 7 : 4) * Math.abs(Math.cos(ph)) : action.kind === "stand" ? -1.5 * Math.sin(frame / 12) : 0;'''),
('''            <circle r={HEAD_R} fill={headFill} stroke={ink} strokeWidth={STROKE} />
            <path d={`M ${HEAD_R - 4} -4 q 10 4 0 12`} stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />''',
 '''            <circle r={HEAD_R} fill={headFill} stroke={ink} strokeWidth={STROKE} />
            {headDecor}
            <path d={`M ${HEAD_R - 4} -4 q 10 4 0 12`} stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />'''),
])

# ---------------- Stickman: actors, thug, KO, squash ----------------
patch("renderer/src/characters/Stickman.tsx", [
('import type { CharacterStyle, Expression, Pose, PropPosition, ResolvedScene, Word } from "@vb/engine/schema";',
 'import type { CharacterStyle, Expression, Pose, PropPosition, ResolvedExtra, ResolvedScene, Word } from "@vb/engine/schema";'),
('import { LEFT_HAND_POSES, RIGS, SNAP_POSES, WALK_POSES, lerpRig, type Rig } from "./poses";',
 'import { LEFT_HAND_POSES, RIGS, RUN_POSES, SNAP_POSES, WALK_POSES, lerpRig, type Rig } from "./poses";'),
('''  /** Prop zones of the current layout — strike targets are aimed at their centres. */
  zones?: Record<PropPosition, Rect>;
}''', '''  /** Prop zones of the current layout — strike targets are aimed at their centres. */
  zones?: Record<PropPosition, Rect>;
  /** Draw a secondary character instead of the scene's hero. */
  actor?: ResolvedExtra;
  /** Knocked flat: the frame it happens and which way he falls (+1 = head to screen-right). */
  ko?: { frame: number; dir: 1 | -1 } | null;
  /** Vertical squash 0–1 (landing impact), scaled about the feet. */
  squash?: number;
}

interface PoseSource {
  pose: Pose;
  expression: Expression;
  poseChanges: { pose: Pose; expression?: Expression; atFrame: number }[];
}'''),
('''function poseAt(scene: ResolvedScene, frame: number): PoseState {
  const c = scene.character!;
  let pose: Pose = c.pose;
  let expression: Expression = c.expression;
  let since = scene.startFrame;''', '''function poseAt(c: PoseSource, sceneStart: number, frame: number): PoseState {
  let pose: Pose = c.pose;
  let expression: Expression = c.expression;
  let since = sceneStart;'''),
('export const Stickman: React.FC<Props> = ({ scene, rect, ink, accent, headFill, style, flip, walker, zones }) => {',
 'export const Stickman: React.FC<Props> = ({ scene, rect, ink, accent, headFill, style, flip, walker, zones, actor, ko, squash = 0 }) => {'),
('''  const abs = frame + scene.startFrame;
  const st = poseAt(scene, abs);
  if (WALK_POSES.has(st.pose)) {
    return <Walker rect={rect} frame={abs} fps={fps} ink={ink} headFill={headFill} facingLeft={st.pose === "walk_left"} action={walker?.action} shadow={walker?.shadow} />;
  }''', '''  const abs = frame + scene.startFrame;
  const source: PoseSource = actor ?? scene.character!;
  const st0 = poseAt(source, scene.startFrame, abs);
  // Knock-out overrides everything from its frame on.
  const koActive = ko && abs >= ko.frame;
  const st: PoseState = koActive ? { pose: "knocked_out", expression: "ko", since: ko!.frame, prev: st0.pose } : st0;
  const thug = style === "thug";
  const beanie = thug ? (
    <g>
      <path d={`M -${HEAD_R - 2} -12 A ${HEAD_R - 2} ${HEAD_R - 2} 0 0 1 ${HEAD_R - 2} -12 Z`} fill="#3a3f52" />
      <rect x={-HEAD_R} y={-16} width={HEAD_R * 2} height={11} rx={4} fill="#4b5168" />
    </g>
  ) : null;
  if (WALK_POSES.has(st.pose)) {
    return (
      <Walker rect={rect} frame={abs} fps={fps} ink={ink} headFill={headFill} facingLeft={st.pose === "walk_left" || st.pose === "run_left"} action={walker?.action} shadow={walker?.shadow} run={RUN_POSES.has(st.pose)} headDecor={beanie} />
    );
  }'''),
('''  const snap = SNAP_POSES.has(st.pose);
  const t = spring({ frame: abs - st.since, fps, config: snap ? { damping: 20, stiffness: 420, mass: 0.6 } : { damping: 13, stiffness: 140, mass: 0.9 } });''',
 '''  const snap = SNAP_POSES.has(st.pose);
  const t = spring({ frame: abs - st.since, fps, config: snap ? { damping: 20, stiffness: 420, mass: 0.6 } : { damping: 13, stiffness: 140, mass: 0.9 } });
  // Fall: rotate about the feet with a little overshoot, hop up briefly at the impact.
  const koT = koActive ? abs - ko!.frame : -1;
  const fallDeg = koActive ? ko!.dir * ip(koT, [0, 6, 9, 12], [0, 96, 82, 86], { extrapolateRight: "clamp" }) : 0;
  const koHop = koActive ? ip(koT, [0, 2, 6], [0, -18, 0], { extrapolateRight: "clamp" }) : 0;'''),
('''  const strike = strikeAt(scene.character?.strikes ?? [], abs, zones, rect, scale, Boolean(flip));''',
 '''  const strike = actor ? null : strikeAt(scene.character?.strikes ?? [], abs, zones, rect, scale, Boolean(flip));'''),
('''  const shots = scene.character?.shots ?? [];''', '''  const shots = actor ? [] : (scene.character?.shots ?? []);'''),
('''  const lift = rig.lift + bob + laughLift - kick * 4 + hopY / scale;''', '''  const lift = rig.lift + bob + laughLift - kick * 4 + hopY / scale + koHop;'''),
# svg transform: add squash + fall rotation about the feet
('''        style={{ transform: `translateY(${lift * scale}px) ${flip ? "scaleX(-1)" : ""}`, overflow: "visible" }}
      >''', '''        style={{
          transform: `translateY(${lift * scale}px) ${flip ? "scaleX(-1)" : ""} rotate(${fallDeg}deg) scaleY(${1 - squash * 0.22}) scaleX(${1 + squash * 0.12})`,
          transformOrigin: "50% 96%",
          overflow: "visible",
        }}
      >'''),
# ko face + thug beanie in head group
('''          <circle r={HEAD_R} fill={headFill} stroke={ink} strokeWidth={STROKE} />
          <g transform={`translate(0 ${rig.nod * 0.25 + nodTalk * 0.4})`}>''', '''          <circle r={HEAD_R} fill={headFill} stroke={ink} strokeWidth={STROKE} />
          {beanie}
          <g transform={`translate(0 ${rig.nod * 0.25 + nodTalk * 0.4})`}>'''),
('''                {face.eyes === "closed" ? (''', '''                {face.eyes === "x" ? (
                  <>
                    <path d="M -15 -9 L -5 1 M -5 -9 L -15 1" stroke={ink} strokeWidth={4} strokeLinecap="round" />
                    <path d="M 5 -9 L 15 1 M 15 -9 L 5 1" stroke={ink} strokeWidth={4} strokeLinecap="round" />
                  </>
                ) : face.eyes === "closed" ? ('''),
('''interface Face {
  eyeR: number;
  eyes?: "open" | "closed";''', '''interface Face {
  eyeR: number;
  eyes?: "open" | "closed" | "x";'''),
('''    case "fierce":
      return { eyeR: 3, browL: [-8, 0], browR: [0, -8], mouth: "grin" };''', '''    case "fierce":
      return { eyeR: 3, browL: [-8, 0], browR: [0, -8], mouth: "grin" };
    case "ko":
      return { eyeR: 3, eyes: "x", browL: [-2, 2], browR: [2, -2], mouth: "wavy" };'''),
# talking only for the hero
('''  const talking = isTalking(scene.words, abs);''', '''  const talking = actor ? false : isTalking(scene.words, abs);'''),
])

# ---------------- motion for extras ----------------
patch("renderer/src/characters/motion.ts", [
('''import type { ResolvedScene } from "@vb/engine/schema";''', '''import type { ResolvedExtra, ResolvedScene } from "@vb/engine/schema";'''),
('''/**
 * Resolve travel + jump cues into a position and a Walker action for one frame.''', '''/** Extras: centre x in px from travel (frozen once knocked out), plus walk/stand action. */
export function extraMotionAt(e: ResolvedExtra, abs: number): { cx: number; action: WalkerAction } {
  const tr = e.travel;
  const f = e.koFrame !== null && abs > e.koFrame ? e.koFrame : abs;
  const xAt = (fr: number) => (tr ? interpolate(fr, [tr.startFrame, Math.max(tr.startFrame + 1, tr.endFrame)], [tr.fromX, tr.toX], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : e.x);
  const cx = xAt(f);
  const moving = tr ? Math.abs(xAt(f + 1) - cx) > 0.05 : false;
  return { cx, action: moving ? { kind: "walk" } : { kind: "stand" } };
}

/**
 * Resolve travel + jump cues into a position and a Walker action for one frame.'''),
])
print("ok")
