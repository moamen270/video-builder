import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  VIDEO,
  type AlignmentFile,
  type Manifest,
  type ResolvedManifest,
  type ResolvedScene,
  type Word,
} from "../schema/index.js";
import { ASSETS_DIR, ENGINE_VERSION, type ProjectPaths } from "../paths.js";
import { ResolveError, applyEmphasis, resolveAnchor, type SceneTimeline } from "./anchors.js";

export interface ResolveWarning {
  path: string;
  message: string;
}

export interface ResolveResult {
  resolved: ResolvedManifest;
  warnings: ResolveWarning[];
}

/**
 * Compile an authored manifest + alignment into the frame-exact document the
 * renderer consumes. Pure apart from copying the referenced SFX/music files into
 * build/assets so the project's Remotion public dir is self-contained.
 */
export function resolveManifest(m: Manifest, align: AlignmentFile, p: ProjectPaths): ResolveResult {
  const fps = VIDEO.fps;
  const warnings: ResolveWarning[] = [];
  const byId = new Map(align.scenes.map((s) => [s.sceneId, s]));
  mkdirSync(p.buildAssets, { recursive: true });

  let cursor = 0;
  const scenes: ResolvedScene[] = m.scenes.map((s, si) => {
    const a = byId.get(s.id);
    if (!a) throw new ResolveError(`missing audio for scene`, `scenes[${si}] (${s.id})`);
    const where = `scenes[${si}] (${s.id})`;

    const speechFrames = Math.ceil(a.duration * fps);
    const durationInFrames = Math.ceil((a.duration + s.pauseAfter) * fps);
    const startFrame = cursor;
    const endFrame = startFrame + durationInFrames;
    cursor = endFrame;

    const words: Word[] = a.tokens.map((t, i) => ({
      text: t.text,
      i,
      start: t.start,
      end: t.end,
      startFrame: startFrame + Math.round(t.start * fps),
      endFrame: startFrame + Math.max(Math.round(t.start * fps) + 1, Math.round(t.end * fps)),
      emphasis: false,
    }));
    applyEmphasis(words, s.emphasis);

    const tl: SceneTimeline = { startFrame, endFrame, words, fps };
    const at = (anchor: string, sub: string) => resolveAnchor(anchor, tl, `${where}.${sub}`);

    const charDef = s.character ? m.characters.find((c) => c.id === s.character!.id) : undefined;
    const character = s.character
      ? {
          id: s.character.id,
          style: charDef?.style ?? "stickman",
          color: charDef?.color,
          pose: s.character.pose,
          expression: s.character.expression,
          position: s.character.position,
          poseChanges: s.character.poseChanges
            .map((pc, i) => ({ pose: pc.pose, expression: pc.expression, atFrame: at(pc.at, `character.poseChanges[${i}]`) }))
            .sort((x, y) => x.atFrame - y.atFrame),
          shots: s.character.shots.map((sh, i) => ({ atFrame: at(sh.at, `character.shots[${i}]`), big: sh.big })),
          throws: [] as { atFrame: number; item: "batarang"; hops: { target: string; hitFrame: number }[] }[],
          entrance: null as null | { atFrame: number; landFrame: number },
          exit: null as null | { atFrame: number; endFrame: number },
          strikes: s.character.strikes
            .map((st, i) => ({ atFrame: at(st.at, `character.strikes[${i}]`), target: st.target, big: st.big }))
            .sort((x, y) => x.atFrame - y.atFrame),
          travel: s.character.travel
            ? {
                fromX: travelX(s.layout, s.character.travel.from),
                toX: travelX(s.layout, s.character.travel.to),
                startFrame: at(s.character.travel.start, "character.travel.start"),
                endFrame: at(s.character.travel.end, "character.travel.end"),
              }
            : null,
          jump: null as null | {
            atFrame: number; crouchFrames: number; airFrames: number; landFrames: number; settleFrames: number; fromX: number; toX: number; height: number;
          },
        }
      : null;
    // Hero actions: entrance, throws (which also KO extras), exit.
    const extraKo = new Map<string, number>();
    if (character && s.character) {
      const c = s.character;
      if (c.entrance) {
        const atFrame = at(c.entrance.at, "character.entrance.at");
        character.entrance = { atFrame, landFrame: atFrame + Math.round(c.entrance.duration * fps) };
      }
      character.throws = c.throws.map((th, i) => {
        const atFrame = at(th.at, `character.throws[${i}].at`);
        const hopFrames = Math.max(3, Math.round(th.flight * fps));
        const hops = th.targets.map((target, k) => {
          if (target !== "camera" && !s.extras.some((e) => e.id === target)) {
            throw new ResolveError(`throw target "${target}" is not an extra in this scene`, `${where}.character.throws[${i}].targets[${k}]`);
          }
          const hitFrame = atFrame + hopFrames * (k + 1);
          if (target !== "camera" && !extraKo.has(target)) extraKo.set(target, hitFrame);
          return { target, hitFrame };
        });
        return { atFrame, item: th.item, hops };
      });
      if (c.exit) {
        const atFrame = at(c.exit.at, "character.exit.at");
        character.exit = { atFrame, endFrame: atFrame + Math.round(c.exit.duration * fps) };
      }
    }
    const extras = s.extras.map((e, i) => {
      const ko = e.knockedOutAt ? at(e.knockedOutAt, `extras[${i}].knockedOutAt`) : (extraKo.get(e.id) ?? null);
      return {
        id: e.id,
        style: e.style,
        color: e.color,
        pose: e.pose,
        expression: e.expression,
        x: e.x * VIDEO.width,
        scale: e.scale,
        travel: e.travel
          ? { fromX: e.travel.fromX * VIDEO.width, toX: e.travel.toX * VIDEO.width, startFrame: at(e.travel.start, `extras[${i}].travel.start`), endFrame: at(e.travel.end, `extras[${i}].travel.end`) }
          : null,
        poseChanges: e.poseChanges.map((pc, k) => ({ pose: pc.pose, expression: pc.expression, atFrame: at(pc.at, `extras[${i}].poseChanges[${k}]`) })).sort((a, b) => a.atFrame - b.atFrame),
        koFrame: ko,
      };
    });

    if (character && s.character?.jump) {
      const j = s.character.jump;
      const atFrame = at(j.at, "character.jump.at");
      // Where is he when the jump starts? Wherever travel has carried him (clamped), else his stop.
      let fromX = travelX(s.layout, s.character.position);
      if (character.travel) {
        const tr = character.travel;
        const k = Math.max(0, Math.min(1, (atFrame - tr.startFrame) / Math.max(1, tr.endFrame - tr.startFrame)));
        fromX = tr.fromX + (tr.toX - tr.fromX) * k;
      }
      character.jump = {
        atFrame,
        crouchFrames: Math.round(0.3 * fps),
        airFrames: Math.round(j.air * fps),
        landFrames: Math.round(0.25 * fps),
        settleFrames: Math.round(1.1 * fps),
        fromX,
        toX: travelX(s.layout, j.to),
        height: j.height,
      };
      if (!character.pose.startsWith("walk_")) warnings.push({ path: where, message: `jump only animates on walk_* poses (pose is "${character.pose}")` });
    }
    if (character && character.shots.length && character.style !== "gunslinger") {
      warnings.push({ path: where, message: `shots only render for style "gunslinger" (character is "${character.style}")` });
    }

    if (s.layout !== "caption_only" && !character) {
      warnings.push({ path: where, message: `layout "${s.layout}" but character is null; nothing will be drawn there` });
    }
    if (character && s.speech && a.duration > 3 && character.poseChanges.length === 0 && !character.pose.startsWith("walk_")) {
      warnings.push({ path: where, message: `${a.duration.toFixed(1)}s scene with no poseChanges — add a switch every ~1.5s` });
    }

    const props = s.props.map((pr, i) => {
      const atFrame = at(pr.at, `props[${i}].at`);
      const untilFrame = pr.until ? at(pr.until, `props[${i}].until`) : endFrame;
      if (untilFrame <= atFrame) warnings.push({ path: `${where}.props[${i}]`, message: `"until" is not after "at"; prop never visible` });
      return { name: pr.name, atFrame, untilFrame, anim: pr.anim, position: pr.position, scale: pr.scale, exit: pr.exit };
    });

    const sfx = s.sfx.map((fx, i) => ({
      name: fx.name,
      atFrame: at(fx.at, `sfx[${i}].at`),
      volume: fx.volume,
      src: stageAsset("sfx", fx.name, p, `${where}.sfx[${i}]`),
    }));

    const bubbles = s.bubbles.map((b, i) => ({
      text: b.text,
      atFrame: at(b.at, `bubbles[${i}].at`),
      untilFrame: b.until ? at(b.until, `bubbles[${i}].until`) : endFrame,
      side: b.side,
      on: b.on,
    }));

    const camera = s.camera.map((c, i) => ({ move: c.move, atFrame: at(c.at, `camera[${i}].at`) }));
    const overlays = s.overlays.map((o, i) => ({ kind: o.kind, atFrame: at(o.at, `overlays[${i}].at`), untilFrame: o.until ? at(o.until, `overlays[${i}].until`) : endFrame }));

    return {
      id: s.id,
      speech: s.speech ?? s.clip?.caption ?? "",
      isClip: Boolean(s.clip),
      clipVolume: s.clip?.volume ?? 1,
      startFrame,
      durationInFrames,
      speechFrames,
      audioSrc: `audio/${a.file}`,
      words,
      layout: s.layout,
      transition: s.transition,
      character,
      extras,
      props,
      sfx,
      bubbles,
      camera,
      overlays,
    };
  });

  const durationInFrames = cursor;
  const totalSec = durationInFrames / fps;
  if (totalSec > VIDEO.maxDurationSec) {
    throw new ResolveError(
      `video is ${totalSec.toFixed(1)}s; platform cap is ${VIDEO.maxDurationSec}s. Cut ~${Math.ceil((totalSec - VIDEO.maxDurationSec) * 2.6)} words.`,
      "scenes",
    );
  }
  if (totalSec > VIDEO.warnDurationSec) {
    warnings.push({ path: "scenes", message: `video is ${totalSec.toFixed(1)}s; Shorts retention drops past ${VIDEO.warnDurationSec}s` });
  }

  const music = m.music
    ? { src: stageAsset("music", m.music.track, p, "music.track"), volume: m.music.volume }
    : null;

  const resolved: ResolvedManifest = {
    version: 1,
    slug: m.slug,
    title: m.title,
    fps,
    width: VIDEO.width,
    height: VIDEO.height,
    durationInFrames,
    theme: m.theme,
    voice: m.voice,
    music,
    scenes,
    meta: {
      resolvedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      ttsModel: align.model,
      manifestHash: createHash("sha256").update(JSON.stringify(m)).digest("hex").slice(0, 16),
    },
  };
  return { resolved, warnings };
}

const AUDIO_EXTS = [".mp3", ".wav", ".ogg"];

/**
 * Left edge (px) of the character rect for a travel stop. Mirrors the layout
 * rects in renderer/src/theme.ts: on-screen stops use the layout's left/center/
 * right rects; offscreen stops sit one rect-width outside the 1080 px frame.
 */
const CHAR_RECT_X: Record<string, { left: number; center: number; right: number; w: number }> = {
  character_bottom: { left: 40, center: 320, right: 600, w: 440 },
  character_left: { left: 30, center: 30, right: 30, w: 400 },
  character_center: { left: 80, center: 280, right: 480, w: 520 },
  caption_only: { left: 40, center: 320, right: 600, w: 440 },
};
function travelX(layout: string, stop: string): number {
  const r = CHAR_RECT_X[layout] ?? CHAR_RECT_X.character_bottom!;
  switch (stop) {
    case "offscreen_left":
      return -r.w;
    case "offscreen_right":
      return VIDEO.width;
    case "left":
      return r.left;
    case "right":
      return r.right;
    default:
      return r.center;
  }
}

/** Copy assets/<kind>/<name>.<ext> into build/assets/<kind>/ and return the public-relative path. */
function stageAsset(kind: "sfx" | "music", name: string, p: ProjectPaths, where: string): string {
  const dir = path.join(ASSETS_DIR, kind);
  const file = existsSync(dir) ? readdirSync(dir).find((f) => AUDIO_EXTS.includes(path.extname(f)) && path.parse(f).name === name) : undefined;
  if (!file) {
    const have = existsSync(dir) ? readdirSync(dir).map((f) => path.parse(f).name).join(", ") : "(none)";
    throw new ResolveError(`unknown ${kind} "${name}". Available: ${have}`, where);
  }
  const destDir = path.join(p.buildAssets, kind);
  mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, file);
  if (!existsSync(dest)) copyFileSync(path.join(dir, file), dest);
  return `assets/${kind}/${file}`;
}
