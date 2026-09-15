import { ANCHOR_RE, type Word } from "../schema/index.js";

export class ResolveError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "ResolveError";
  }
}

export interface SceneTimeline {
  startFrame: number;
  /** Exclusive end (startFrame + durationInFrames). */
  endFrame: number;
  words: Word[];
  fps: number;
}

export const normalizeWord = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * Resolve an authored anchor to an absolute frame.
 *   start | end | word:<text>[#n]   with optional  +sec | -sec
 * `word:` accepts multi-word phrases joined by `_` ("word:every_single_row") and
 * matches the first (or n-th) occurrence of that consecutive word sequence.
 */
export function resolveAnchor(anchor: string, tl: SceneTimeline, where: string): number {
  const m = ANCHOR_RE.exec(anchor);
  if (!m) throw new ResolveError(`invalid anchor "${anchor}"`, where);
  const base = m[1]!;
  const offsetSec = m[2] ? Number(m[2]) : 0;

  let frame: number;
  if (base === "start") frame = tl.startFrame;
  else if (base === "end") frame = tl.endFrame;
  else {
    const [, spec] = base.split(":", 2) as [string, string];
    const [phrase, nth] = spec.split("#") as [string, string | undefined];
    const occurrence = nth ? Number(nth) : 1;
    frame = findPhraseFrame(phrase, occurrence, tl, where, anchor);
  }

  frame += Math.round(offsetSec * tl.fps);
  return Math.max(tl.startFrame, Math.min(tl.endFrame, frame));
}

function findPhraseFrame(phrase: string, occurrence: number, tl: SceneTimeline, where: string, anchor: string): number {
  const target = phrase.split("_").map(normalizeWord).filter(Boolean);
  if (target.length === 0) throw new ResolveError(`empty word in anchor "${anchor}"`, where);
  const words = tl.words.map((w) => normalizeWord(w.text));

  let seen = 0;
  for (let i = 0; i + target.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      if (words[i + j] !== target[j]) {
        ok = false;
        break;
      }
    }
    if (ok && ++seen === occurrence) return tl.words[i]!.startFrame;
  }
  const available = tl.words.map((w) => w.text).join(" ");
  throw new ResolveError(
    `anchor "${anchor}" not found${occurrence > 1 ? ` (occurrence #${occurrence})` : ""}. Scene words: "${available}"`,
    where,
  );
}

/** Mark words that belong to any emphasis phrase (consecutive-word match, case/punct-insensitive). */
export function applyEmphasis(words: Word[], phrases: string[]): void {
  const norm = words.map((w) => normalizeWord(w.text));
  for (const phrase of phrases) {
    const target = phrase.split(/\s+/).map(normalizeWord).filter(Boolean);
    for (let i = 0; i + target.length <= norm.length; i++) {
      if (target.every((t, j) => norm[i + j] === t)) {
        for (let j = 0; j < target.length; j++) words[i + j]!.emphasis = true;
      }
    }
  }
}
