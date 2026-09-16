/**
 * The closed vocabulary the LLM may use. Everything here maps 1:1 to something
 * the renderer knows how to draw or play. Extending the engine = extend this
 * list AND add the matching component/asset; the schema refuses anything else.
 */

export const POSES = [
  "idle",
  "explaining",
  "pointing_left",
  "pointing_right",
  "pointing_up",
  "shocked",
  "thinking",
  "facepalm",
  "celebrating",
  "typing",
  "shrugging",
  "waving",
  "presenting",
  "leaning",
  "claws_out", // hero stance: fists low and wide, chin down
  "slash_left", // fast horizontal swipe, ends with the arm across to screen-left
  "slash_right",
  "laughing", // head back, hands on belly, body shakes while words are spoken
] as const;
export type Pose = (typeof POSES)[number];

export const EXPRESSIONS = ["neutral", "happy", "surprised", "worried", "confused", "smug", "laughing", "fierce"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const POSITIONS = ["left", "center", "right"] as const;
export type Position = (typeof POSITIONS)[number];

/** Screen layouts. Captions always stay inside the platform-safe zone (see LAYOUT_SAFE_AREA). */
export const LAYOUTS = [
  "character_bottom", // stickman lower third, caption mid, props top  (default)
  "character_left", // stickman left, props/caption right
  "character_center", // stickman big & centered, caption below (hooks, punchlines)
  "caption_only", // no stickman; big text card (pattern interrupt)
] as const;
export type Layout = (typeof LAYOUTS)[number];

export const PROPS = [
  "database",
  "lightbulb",
  "brain",
  "warning",
  "computer",
  "clock",
  "money",
  "chart_up",
  "chart_down",
  "checkmark",
  "cross",
  "question",
  "rocket",
  "lock",
  "magnifier",
  "gear",
  "fire",
  "document",
  "phone",
  "cloud",
  "book",
  "heart",
  "star",
  "trophy",
  "watermelon",
  "watermelon_split", // two halves flying apart with juice — pair with anim "burst"
] as const;
export type PropName = (typeof PROPS)[number];

export const PROP_ANIMS = ["pop", "bounce", "slide_left", "slide_right", "drop", "fade", "shake", "burst"] as const;
export type PropAnim = (typeof PROP_ANIMS)[number];

export const PROP_POSITIONS = [
  "top",
  "top_left",
  "top_right",
  "left",
  "right",
  "center",
  "above_character",
] as const;
export type PropPosition = (typeof PROP_POSITIONS)[number];

export const SFX = ["pop", "whoosh", "click", "ding", "boom", "error", "swoosh", "tick", "cash", "glitch", "drum", "slash", "splat", "snikt"] as const;
export type SfxName = (typeof SFX)[number];

export const THEMES = ["midnight", "paper", "sunset", "mint", "grape"] as const;

/** Character costumes. `stickman` is the plain narrator; `wolverine` adds a pointed mask, claws and blue trunks. */
export const CHARACTER_STYLES = ["stickman", "wolverine"] as const;
export type CharacterStyle = (typeof CHARACTER_STYLES)[number];
export type Theme = (typeof THEMES)[number];

/** Kokoro-82M English voices. af_ = American female, am_ = American male, bf_/bm_ = British. */
export const VOICES = [
  "af_heart",
  "af_bella",
  "af_nicole",
  "af_sarah",
  "af_sky",
  "am_adam",
  "am_michael",
  "am_fenrir",
  "am_puck",
  "bf_emma",
  "bf_isabella",
  "bm_george",
  "bm_lewis",
] as const;
export type Voice = (typeof VOICES)[number];

/** Post-processing on the synthesized voice. `deep` = pitch down ~12% + light room; `villain` = pitch down ~20%, bass, big reverb. */
export const VOICE_FX = ["none", "deep", "villain"] as const;
export type VoiceFx = (typeof VOICE_FX)[number];

export const CAMERA_MOVES = ["none", "punch_in", "slow_zoom", "shake"] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

export const TRANSITIONS = ["cut", "slide", "wipe", "zoom"] as const;
export type Transition = (typeof TRANSITIONS)[number];

/** Hard platform constraints for Shorts / Reels / TikTok. */
export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  maxDurationSec: 60,
  warnDurationSec: 45,
  /** UI overlays (TikTok right rail, YT title bottom) — keep text inside this box. */
  safeArea: { top: 250, bottom: 420, left: 60, right: 140 },
} as const;
