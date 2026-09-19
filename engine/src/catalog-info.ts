import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { ASSETS_DIR } from "./paths.js";
import {
  CAMERA_MOVES, CHARACTER_STYLES, ENGINES, EXPRESSIONS, LAYOUTS, POSES, POSITIONS, PROPS, PROP_ANIMS, PROP_POSITIONS, SFX, THEMES, TRANSITIONS, VIDEO, VOICES, VOICE_FX, VOICE_TAGS,
} from "./schema/catalog.js";

const names = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => /\.(mp3|wav|ogg)$/.test(f)).map((f) => path.parse(f).name) : []);

/** Everything an agent needs to know to write a valid manifest, in one object. */
export function catalogSummary() {
  return {
    video: VIDEO,
    anchors: "start | end | word:<text>[#n] | word:<a>_<b> (phrase)  — optional +sec / -sec, e.g. word:slow-0.2",
    poses: POSES,
    expressions: EXPRESSIONS,
    positions: POSITIONS,
    layouts: LAYOUTS,
    props: PROPS,
    propAnims: PROP_ANIMS,
    propPositions: PROP_POSITIONS,
    sfx: SFX,
    sfxFilesPresent: names(path.join(ASSETS_DIR, "sfx")),
    music: names(path.join(ASSETS_DIR, "music")),
    themes: THEMES,
    characterStyles: CHARACTER_STYLES,
    voices: VOICES,
    voiceFx: VOICE_FX,
    engines: ENGINES,
    /** Chatterbox only: `[laugh]` etc. inside `speech`; needs `voiceRef` (a file below). */
    voiceTags: VOICE_TAGS,
    /** Reference clips for `voiceRef` (assets/voices/*.wav, > 5 s each). */
    voiceRefs: names(path.join(ASSETS_DIR, "voices")),
    cameraMoves: CAMERA_MOVES,
    transitions: TRANSITIONS,
  };
}
