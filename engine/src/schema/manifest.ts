import { z } from "zod";
import {
  CAMERA_MOVES,
  EXPRESSIONS,
  LAYOUTS,
  POSES,
  POSITIONS,
  PROPS,
  PROP_ANIMS,
  PROP_POSITIONS,
  SFX,
  THEMES,
  TRANSITIONS,
  VIDEO,
  VOICES,
} from "./catalog.js";

/**
 * Time anchor — the ONLY way the agent expresses timing. Resolved to a frame by
 * the resolver after TTS. Grammar:
 *   start | end | word:<text> | word:<text>#<n>   optionally followed by  +<sec> | -<sec>
 * Examples: "start", "end-0.4", "word:slow", "word:the#2+0.15"
 */
export const ANCHOR_RE = /^(start|end|word:[^#+\-\s]+(?:#\d+)?)([+-]\d+(?:\.\d+)?)?$/;
export const Anchor = z
  .string()
  .regex(ANCHOR_RE, "anchor must be start | end | word:<text>[#n] with optional +/-seconds");
export type Anchor = z.infer<typeof Anchor>;

export const PoseChange = z.object({
  pose: z.enum(POSES),
  expression: z.enum(EXPRESSIONS).optional(),
  at: Anchor,
});

export const CharacterState = z.object({
  id: z.string().default("narrator"),
  pose: z.enum(POSES).default("explaining"),
  expression: z.enum(EXPRESSIONS).default("neutral"),
  position: z.enum(POSITIONS).default("center"),
  /** Mid-scene pose switches. Storytelling rule of thumb: one every ~1.5 s. */
  poseChanges: z.array(PoseChange).default([]),
});

export const PropCue = z.object({
  name: z.enum(PROPS),
  at: Anchor,
  /** When the prop leaves. Default: end of scene. */
  until: Anchor.optional(),
  anim: z.enum(PROP_ANIMS).default("pop"),
  position: z.enum(PROP_POSITIONS).default("top"),
  /** 0.5–2, relative to the default prop size. */
  scale: z.number().min(0.4).max(2.5).default(1),
});

export const SfxCue = z.object({
  name: z.enum(SFX),
  at: Anchor,
  volume: z.number().min(0).max(1).default(0.8),
});

export const Bubble = z.object({
  /** Short: "?!", "WAIT", "10x". Not narration. */
  text: z.string().min(1).max(24),
  at: Anchor,
  until: Anchor.optional(),
});

export const CameraCue = z.object({
  move: z.enum(CAMERA_MOVES),
  at: Anchor,
});

export const Scene = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9_-]+$/, "scene id: lowercase letters, digits, - or _"),
  /** Exactly what the narrator says. Captions are derived from this — never a separate string. */
  speech: z.string().min(1).max(400),
  /** Phrases (verbatim substrings of `speech`) to highlight in the accent colour. */
  emphasis: z.array(z.string().min(1)).default([]),
  /** Silence appended after this scene's speech, seconds. */
  pauseAfter: z.number().min(0).max(2).default(0.25),
  layout: z.enum(LAYOUTS).default("character_bottom"),
  transition: z.enum(TRANSITIONS).default("cut"),
  character: CharacterState.nullable().prefault({}),
  props: z.array(PropCue).max(4).default([]),
  sfx: z.array(SfxCue).max(6).default([]),
  bubbles: z.array(Bubble).max(2).default([]),
  camera: z.array(CameraCue).max(2).default([]),
});
export type Scene = z.infer<typeof Scene>;

export const CharacterDef = z.object({
  id: z.string().min(1),
  style: z.literal("stickman").default("stickman"),
  /** Line colour; defaults to theme foreground. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const Manifest = z.object({
  version: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug: lowercase letters, digits and dashes"),
  title: z.string().min(1).max(100),
  /** BCP-47. Only "en" is wired to a TTS today. */
  language: z.literal("en").default("en"),
  voice: z.enum(VOICES).default("af_heart"),
  /** Kokoro speed multiplier. Shorts usually want 1.05–1.15. */
  speed: z.number().min(0.8).max(1.3).default(1.05),
  theme: z.enum(THEMES).default("midnight"),
  music: z
    .object({
      track: z.string().min(1),
      volume: z.number().min(0).max(1).default(0.18),
    })
    .nullable()
    .default(null),
  characters: z.array(CharacterDef).min(1).default([{ id: "narrator", style: "stickman" }]),
  scenes: z.array(Scene).min(1).max(40),
  /** Free-form notes for humans/agents; ignored by the engine. */
  notes: z.string().optional(),
}).superRefine((m, ctx) => {
  const ids = new Set<string>();
  for (const [i, s] of m.scenes.entries()) {
    if (ids.has(s.id)) {
      ctx.addIssue({ code: "custom", path: ["scenes", i, "id"], message: `duplicate scene id "${s.id}"` });
    }
    ids.add(s.id);
    for (const [j, e] of s.emphasis.entries()) {
      if (!s.speech.toLowerCase().includes(e.toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "emphasis", j],
          message: `emphasis "${e}" is not a substring of speech`,
        });
      }
    }
    if (s.character && !m.characters.some((c) => c.id === s.character!.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", i, "character", "id"],
        message: `unknown character "${s.character.id}"`,
      });
    }
  }
  // Rough pre-TTS length check: ~2.6 words/sec at speed 1.0 for Kokoro.
  const words = m.scenes.reduce((n, s) => n + s.speech.split(/\s+/).length, 0);
  const pauses = m.scenes.reduce((n, s) => n + s.pauseAfter, 0);
  const estSec = words / (2.6 * m.speed) + pauses;
  if (estSec > VIDEO.maxDurationSec * 1.15) {
    ctx.addIssue({
      code: "custom",
      path: ["scenes"],
      message: `script is ~${estSec.toFixed(0)}s of speech; hard cap is ${VIDEO.maxDurationSec}s. Cut words.`,
    });
  }
});
export type Manifest = z.infer<typeof Manifest>;
export type ManifestInput = z.input<typeof Manifest>;
