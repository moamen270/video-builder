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
  "aim_right", // right arm locked straight out to screen-right (gunslinger)
  "aim_left",
  "aim_high", // arm at ~120°, for targets in the top corners
  "aim_up", // arm at ~150°, for targets straight above
  "reload", // both hands in front at chest height
  "bow", // theatrical bow, one arm sweeping
  "walk_right",
  "aim_camera", // gun pointed straight at the viewer (front view of the pistol)
  "mj_lean", // the anti-gravity lean: body straight as a plank, tilted toward the thrower, heels planted — the ball sails over
  "mj_toe", // toe-stand, knees together, one hand on the hat brim, other arm out
  "dodge_jump", // tucked jump straight up — the ball passes under
  "dodge_lean", // Matrix lean-back away from a ball: torso way back, arms flung, front leg straight
  "dodge_limbo", // even further back, knees bent, almost horizontal
  "dodge_split", // drops into a split under a ball
  "spin", // hurricane: body whirls about its axis (scaleX oscillates), arms out — with a held pan it deflects
  "windup", // ball arm cocked far back over the shoulder, other arm forward, weight on the back foot
  "throw", // arm snapped forward after the release, body leaning into it
  "victory", // both arms up, chest out, chin up — champion
  "twirl", // gun spinning in cycles in the raised hand (gunslinger flourish before the finale)
  "admire", // gun lowered, other hand to the chin, head tilted: appreciating the work // side view, procedural gait, facing screen-right — pair with character.travel
  "walk_left",
  "arms_crossed", // brooding, immovable
  "run_right", // side view sprint (faster cadence, forward lean)
  "run_left",
  "knocked_out", // lying flat on the ground, X eyes
] as const;
export type Pose = (typeof POSES)[number];

export const EXPRESSIONS = ["neutral", "happy", "surprised", "worried", "confused", "smug", "laughing", "fierce", "ko", "angry"] as const; // angry: head flushes red, brows down, steam puffs from the ears
export type Expression = (typeof EXPRESSIONS)[number];

export const POSITIONS = ["left", "center", "right"] as const;

/** Horizontal stops for character.travel; offscreen_* start/end fully outside the frame. */
export const TRAVEL_STOPS = ["offscreen_left", "left", "center", "right", "offscreen_right"] as const;
export type TravelStop = (typeof TRAVEL_STOPS)[number];
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
  "target", // bullseye on a post
  "lotus", // flower that blooms — pair with anim "bloom"
  "number_1",
  "number_2",
  "number_3",
  "number_4",
  "crate", // wooden box that sits on the ground — a landing surface for `jump`
  "milk", // carton
  "bat_signal", // spotlight disc with a bat silhouette
  "moon",
  "ball", // red rubber dodgeball with a pale stripe
  "frying_pan",
  "crown",
  "medal",
  "trophy", // crescent
] as const;
export type PropName = (typeof PROPS)[number];

export const PROP_ANIMS = ["pop", "bounce", "slide_left", "slide_right", "drop", "fade", "shake", "burst", "bloom", "stamp"] as const;
export type PropAnim = (typeof PROP_ANIMS)[number];

export const PROP_POSITIONS = [
  "top",
  "top_left",
  "top_right",
  "left",
  "right",
  "center",
  "above_character",
  "ground_left", // bottom-aligned on the character's ground line
  "ground_center",
  "ground_right",
] as const;
export type PropPosition = (typeof PROP_POSITIONS)[number];

export const SFX = ["pop", "whoosh", "click", "ding", "boom", "error", "swoosh", "tick", "cash", "glitch", "drum", "slash", "splat", "snikt", "gunshot", "gunshot_big", "reload", "chime", "thunder", "thud", "zip", "bounce", "clang", "whistle", "cheer"] as const; // bounce: rubber ball; clang: pan; whistle: referee; cheer: crowd stinger
export type SfxName = (typeof SFX)[number];

export const THEMES = ["midnight", "paper", "sunset", "mint", "grape"] as const;

/** Character costumes. `stickman` is the plain narrator; `wolverine` adds a pointed mask, claws and blue trunks. */
export const CHARACTER_STYLES = ["stickman", "wolverine", "gunslinger", "batman", "thug", "joker", "penguin", "riddler", "robin", "jhin", "kid"] as const; // kid: tiny (scale 0.5), hair tuft, rosy cheeks // jhin: gunslinger with the porcelain mask and magenta shots // thug: beanie; joker: green hair + red grin; penguin: top hat + monocle; riddler: bowler with ?; robin: domino mask + short yellow cape // batman: cowl ears + flowing cape, face untouched
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
export const VOICE_FX = ["none", "deep", "villain", "theatre", "growl", "young", "mask"] as const; // mask: slight lift, hollow porcelain resonance, stage room — Jhin // young: pitch up ~12% for kids/sidekicks // growl: pitch down, compressed, soft-clipped rasp — Batman
export type VoiceFx = (typeof VOICE_FX)[number];

export const CAMERA_MOVES = ["none", "punch_in", "slow_zoom", "shake", "dolly_in", "pan_left", "pan_right", "zoom_out", "focus"] as const; // focus: zoom 1.5× onto the extra named in `on` and centre him // pan_*: whip the camera ~260 px toward that side and stay; zoom_out: pull back to 0.8× and stay (fits a wide duel) // dolly_in: fast 2.3x push toward the character (looming at the viewer)

/** Full-frame effects drawn on top of everything — on the "viewer's screen", not in the scene. */
export const OVERLAYS = ["claw_marks", "flash", "blackout", "bat_signal", "batarang_stuck", "hook_card", "follow_card", "screen_crack", "spotlight", "flourish"] as const; // flourish: Jhin W — thin white line with a blue-violet halo across the screen + brief cool wash // screen_crack: glass shatter at the impact point (standard ending); spotlight: dark stage, cone of light on the character (standard opening) // hook_card: big text hook over the opening (needs `text`); follow_card: @handle + Follow button for the CTA line
export type OverlayKind = (typeof OVERLAYS)[number];
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
