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

    const character = s.character
      ? {
          id: s.character.id,
          color: m.characters.find((c) => c.id === s.character!.id)?.color,
          pose: s.character.pose,
          expression: s.character.expression,
          position: s.character.position,
          poseChanges: s.character.poseChanges
            .map((pc, i) => ({ pose: pc.pose, expression: pc.expression, atFrame: at(pc.at, `character.poseChanges[${i}]`) }))
            .sort((x, y) => x.atFrame - y.atFrame),
        }
      : null;

    if (s.layout !== "caption_only" && !character) {
      warnings.push({ path: where, message: `layout "${s.layout}" but character is null; nothing will be drawn there` });
    }
    if (character && a.duration > 3 && character.poseChanges.length === 0) {
      warnings.push({ path: where, message: `${a.duration.toFixed(1)}s scene with no poseChanges — add a switch every ~1.5s` });
    }

    const props = s.props.map((pr, i) => {
      const atFrame = at(pr.at, `props[${i}].at`);
      const untilFrame = pr.until ? at(pr.until, `props[${i}].until`) : endFrame;
      if (untilFrame <= atFrame) warnings.push({ path: `${where}.props[${i}]`, message: `"until" is not after "at"; prop never visible` });
      return { name: pr.name, atFrame, untilFrame, anim: pr.anim, position: pr.position, scale: pr.scale };
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
    }));

    const camera = s.camera.map((c, i) => ({ move: c.move, atFrame: at(c.at, `camera[${i}].at`) }));

    return {
      id: s.id,
      speech: s.speech,
      startFrame,
      durationInFrames,
      speechFrames,
      audioSrc: `audio/${a.file}`,
      words,
      layout: s.layout,
      transition: s.transition,
      character,
      props,
      sfx,
      bubbles,
      camera,
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
