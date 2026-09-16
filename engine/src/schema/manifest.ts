import { z } from "zod";
import {
  CAMERA_MOVES,
  CHARACTER_STYLES,
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
  TRAVEL_STOPS,
  OVERLAYS,
  VIDEO,
  VOICES,
  VOICE_FX,
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
  /**
   * Melee strikes (front rig): wind-up, then the hand swings THROUGH the centre of the
   * `target` prop zone at `at` (lunging closer if out of reach), follow-through, recover.
   * Put the prop swap (e.g. watermelon → watermelon_split) at the same anchor +0.03.
   */
  strikes: z
    .array(z.object({ at: Anchor, target: z.enum([...PROP_POSITIONS, "camera"]), big: z.boolean().default(false) }))
    .max(8)
    .default([]),
  /** Gunslinger only: muzzle flash + recoil at these anchors. `big` = the dramatic final shot. */
  shots: z.array(z.object({ at: Anchor, big: z.boolean().default(false) })).max(8).default([]),
  /**
   * Side-view jump (walk_* poses): crouch → flight → landing absorb → rebound/balance → stand.
   * `to` is the landing stop; `height` is the landing surface above ground in px
   * (a `crate` at scale 1 in a ground_* slot is 300 px tall). Walking stops when the jump starts.
   */
  jump: z
    .object({
      at: Anchor,
      to: z.enum(TRAVEL_STOPS),
      height: z.number().min(0).max(600).default(0),
      /** Seconds in the air. */
      air: z.number().min(0.3).max(1.2).default(0.55),
    })
    .optional(),
  /** Move the character horizontally between two stops. Use with walk_* poses. Defaults: whole scene. */
  travel: z
    .object({
      from: z.enum(TRAVEL_STOPS),
      to: z.enum(TRAVEL_STOPS),
      start: Anchor.default("start"),
      end: Anchor.default("end"),
    })
    .optional(),
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
  /** How the prop leaves at `until`: short fade (default) or an instant cut (use when it gets struck/replaced). */
  exit: z.enum(["fade", "cut"]).default("fade"),
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
  /** Which side of the head. Use "left" when the right arm is raised (aim_high, pointing_up). */
  side: z.enum(["left", "right"]).default("right"),
});

export const CameraCue = z.object({
  move: z.enum(CAMERA_MOVES),
  at: Anchor,
});

export const OverlayCue = z.object({
  /** claw_marks: three slashes torn across the frame + flash + dim. flash: white hit. blackout: fade to black. */
  kind: z.enum(OVERLAYS),
  at: Anchor,
  /** Default: end of scene. */
  until: Anchor.optional(),
});

export const Scene = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9_-]+$/, "scene id: lowercase letters, digits, - or _"),
  /** Exactly what the narrator says. Captions are derived from this — never a separate string. Omit when using `clip`. */
  speech: z.string().min(1).max(400).optional(),
  /**
   * Pre-recorded audio instead of TTS (laughs, screams, sung lines). `file` is
   * relative to projects/<slug>/clips/. `caption` is shown as one caption word
   * for the whole clip. Anchors in a clip scene: start, end, or word:<caption>.
   */
  clip: z
    .object({
      file: z.string().min(1),
      caption: z.string().max(40).optional(),
      /** Trim the clip to this many seconds. */
      maxSeconds: z.number().min(0.5).max(20).optional(),
      volume: z.number().min(0).max(2).default(1),
    })
    .optional(),
  /** A silent scene of this many seconds (music only, no captions). Third alternative to speech/clip. */
  silence: z.number().min(0.5).max(30).optional(),
  /** Phrases (verbatim substrings of `speech`) to highlight in the accent colour. */
  emphasis: z.array(z.string().min(1)).default([]),
  /** Silence appended after this scene's speech, seconds. */
  pauseAfter: z.number().min(0).max(4).default(0.25),
  /** Override the manifest speed for this scene (slower for menace, faster for lists). */
  speed: z.number().min(0.7).max(1.4).optional(),
  /** Override the manifest voiceFx for this scene (e.g. "villain" on the evil laugh). */
  voiceFx: z.enum(VOICE_FX).optional(),
  layout: z.enum(LAYOUTS).default("character_bottom"),
  transition: z.enum(TRANSITIONS).default("cut"),
  character: CharacterState.nullable().prefault({}),
  props: z.array(PropCue).max(8).default([]),
  sfx: z.array(SfxCue).max(8).default([]),
  bubbles: z.array(Bubble).max(2).default([]),
  camera: z.array(CameraCue).max(2).default([]),
  overlays: z.array(OverlayCue).max(3).default([]),
});
export type Scene = z.infer<typeof Scene>;

export const CharacterDef = z.object({
  id: z.string().min(1),
  style: z.enum(CHARACTER_STYLES).default("stickman"),
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
  /** Voice post-processing applied to every scene unless the scene overrides it. */
  voiceFx: z.enum(VOICE_FX).default("none"),
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
    const sources = [s.speech, s.clip, s.silence].filter((x) => x !== undefined).length;
    if (sources === 0) ctx.addIssue({ code: "custom", path: ["scenes", i], message: "scene needs `speech`, `clip` or `silence`" });
    if (sources > 1) ctx.addIssue({ code: "custom", path: ["scenes", i], message: "scene has more than one of `speech`/`clip`/`silence`; pick one" });
    if (ids.has(s.id)) {
      ctx.addIssue({ code: "custom", path: ["scenes", i, "id"], message: `duplicate scene id "${s.id}"` });
    }
    ids.add(s.id);
    for (const [j, e] of s.emphasis.entries()) {
      if (s.speech && !s.speech.toLowerCase().includes(e.toLowerCase())) {
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
  const words = m.scenes.reduce((n, s) => n + (s.speech?.split(/\s+/).length ?? 0), 0);
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
