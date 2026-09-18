---
name: stickman-animation
description: Visual vocabulary for video-builder manifests — which pose, expression, layout, prop, SFX, bubble and camera cue to use for each kind of beat, and the manifest field reference. Use alongside 2d-storytelling when writing or fixing scenes.
---

# Stickman animation guide

The stickman is a narrator first: in front-facing scenes motion comes from **pose
switches** (spring-animated, ~0.4 s), **props popping in on words**, and **camera
cues**. Aim for one visible change every 1.5–2 s. For action it can also walk/run
(`walk_*`/`run_*` + `travel`), jump, strike, shoot, throw, drop in and grapple out —
see the sections below.

## Poses → meaning

| pose | reads as | pair with |
|---|---|---|
| `idle` | neutral rest; use briefly between beats | `neutral` |
| `explaining` | palms out, "here's the thing" — the default talking pose | `neutral`, `happy` |
| `pointing_left` / `pointing_right` | directing attention to a prop on that side | prop in `left`/`right` or `top_left`/`top_right` |
| `pointing_up` | "the key point", "look at this" — pair with prop `above_character` or `top` | `smug`, `happy` |
| `shocked` | arms up, big problem or big number | `surprised`, bubble `"?!"`, SFX `boom`/`error` |
| `thinking` | hand on chin, question or trade-off | `confused`, bubble `"HMM"` |
| `facepalm` | mistake, anti-pattern, "everyone does this" | `worried` |
| `celebrating` | success, payoff, CTA finale | `happy`, SFX `ding`/`cash` |
| `typing` | code, running a query | prop `computer` |
| `shrugging` | "who knows", "nobody does that", rhetorical | `confused`, `smug` |
| `waving` | greeting / CTA opener | `happy` |
| `presenting` | introducing an analogy or prop to the side | prop in `right` |
| `leaning` | casual aside, "between you and me" | `smug` |
| `claws_out` | hero stance, fists low and wide, chin down — menace or "let's go" | `fierce`, SFX `snikt` |
| `slash_left` / `slash_right` | one fast horizontal swipe (snaps, no ease) — anchor a `watermelon_split` + `splat` 0.08 s later | `fierce`, SFX `slash` |
| `laughing` | head back, hands on belly; body bounces while audio plays — use with a real laugh `clip`, not TTS "ha ha" | `laughing` |
| `aim_right` / `aim_left` | gunslinger: arm locked straight out at a target in `right`/`left` | `smug`, `fierce`, `shots` |
| `aim_high` / `aim_up` | gunslinger: arm at ~120° / ~150° for targets in `top_right` / `top` | `shots` |
| `reload` | hands together at chest — the beat before the shot | SFX `reload` |
| `bow` | theatrical bow, one arm sweeping — finales, "thank you" | `happy`, `smug` |
| `aim_camera` | gun pointed at the viewer (front view of the pistol) — the finale shot: `shots: [{ camera: true, big: true }]` + `screen_crack` | `fierce` |
| `twirl` | pistol spinning in cycles in the raised hand — the flourish before a finale shot | `smug` |
| `admire` | gun lowered, other hand to the chin, head tilted — after a shot, admiring the bloom | `smug` |
| `walk_right` / `walk_left` | side view, procedural gait, no face to camera — pair with `character.travel` | — |

Locomotion: `"travel": { "from": "offscreen_left", "to": "offscreen_right", "start": "start", "end": "end" }`
moves the character rect between stops (`offscreen_left left center right offscreen_right`).
Silent visual scenes: `"silence": 9` (seconds) instead of `speech`/`clip` — music only, no captions.
Scene flags: `"captions": false` (no kinetic captions), `"captionStyle": "beat"` (every word is a hit — laughs, counts),
`"bare": true` (no progress bar/watermark — the standard opening). `character.scale` 0.5–1.2 shrinks the hero about his feet
(smaller hero + `target` at scale 0.7 reads as distance). A hero at `position: right` is mirrored: his `aim_right` points screen-LEFT.
Shot → target: give the target `"exit": "cut"` and `until: word+0.34` (the tracer lands at +0.22, then an impact glow), lotus `at: word+0.36`
with `anim: bloom`; let a lotus detonate later with `"exit": "burst"` (+ `splat`) to clear the stage.
Laughs in the character's OWN voice: a speech scene `"Ha ha ha! Ha ha ha ha ha! Ha, ha, ha!"`, `speed` 1.05–1.1, `captionStyle: beat` —
not a Bark clip when the character has a distinctive voice (two voices read as two people).
Jumping (walk_* poses): `"jump": { "at": "start+5", "to": "right", "height": 300, "air": 0.6 }` —
crouch 0.3 s → flight → landing absorb → damped rebound/balance 1.1 s → stand. Walking stops at `at`.
`height` = landing surface above ground in px; a `crate` in a `ground_*` slot is 300 px × scale.
Ground props (`ground_left/center/right`) are bottom-aligned on the character's ground line and don't hover.

Expressions: `neutral happy surprised worried confused smug laughing fierce`
(`laughing` = closed eyes + big D mouth; `fierce` = angled brows + toothy grin).

Rules:
- Start each scene in the pose that matches its first clause; add 1–3
  `poseChanges` anchored to the words where the meaning turns.
- Don't repeat the same pose in consecutive scenes' openings.
- Give an `expression` on every pose change where the mood shifts.
- `position`: `center` for hooks/CTA; `left`/`right` when props need the other
  side. The stickman flips to face inward when on the right.

### Strikes (melee that actually connects)

Never fake a hit with `slash_*` poses. Use `character.strikes`:
`[{ "at": "word:bub+0.15", "target": "right", "big": false }]` — the hand winds up
high (8 frames), comes down THROUGH the centre of the `target` prop zone exactly at
`at` (the body lunges if the target is out of reach), follows through and recovers.
Put the prop swap at `at + 0.03` with `"exit": "cut"` on the struck prop:
`{ "name": "watermelon", "at": "start", "until": "word:bub+0.18", "exit": "cut", "position": "right" }`,
`{ "name": "watermelon_split", "at": "word:bub+0.18", "anim": "burst", "position": "right" }`.
SFX: `slash` at `at - 0.05`, `splat` at the swap. Works with any front-rig style; on
wolverine the claws lead the swing. Targets above the shoulder make him HOP to reach.
Strike `target: "camera"` = a flat swipe at the viewer; pair with camera `dolly_in`
(2.3× push toward the character) and `overlays: [{ "kind": "claw_marks", "at": <same> }]`
so three gashes tear across the screen, the picture dims behind them, then
`{ "kind": "blackout", "at": "end-0.5" }`. Strikes can be as close as 12 frames apart.

### Character styles

`characters[].style`: `stickman` (plain narrator), `wolverine`, `gunslinger`, `batman`;
extras may also be `thug`, `joker`, `penguin`, `riddler`, `robin`. Styles only add
attachments to the same rig — never a costume over the face. `wolverine` = the
plain stickman with three adamantium claws on each hand. No costume, no mask:
the claws and the delivery carry the aura. Play him deadpan and serious about
something trivial; the joke is never in his lines. Pair with `voiceFx: "deep"`,
`speed` 0.9–0.98, `am_michael`/`am_fenrir`, `snikt` on the reveal, and a
`voiceFx: "villain"` scene for the evil laugh (`"Muahahahaha! Hahahahaha!"`).

`jhin` = gunslinger wearing the porcelain mask (ivory, forehead/chin slots, angular eye
holes, three scratches by the left eye). No face: expression is head tilt. Shots are
**magenta** tracers with muzzle smoke and a torso recoil; `admire` after each shot (gun
lowered, hand to the mask) reads as artistic appreciation. Voice `bm_george`, speed
0.9–0.94, `voiceFx: mask`. Count the shots; the 4th is the finale at the camera.

`batman` = plain stickman with cowl ears and a rippling cape (face untouched). Pair
with `arms_crossed`, `voiceFx: deep`, speed ≤ 0.86, `thunder`, `moon`/`bat_signal`
props, midnight theme; deliver trivial problems as rooftop monologues.

`gunslinger` = plain stickman with a long pistol in the right hand. Put the
shots in `character.shots: [{ "at": "word:one+0.05", "big": false }]` — each
one draws a muzzle flash and a recoil kick; `big: true` for the dramatic last
shot. Aim poses point the barrel: `aim_right` → prop zone `right`, `aim_high`
→ `top_right`, `aim_up` → `top`, `aim_left` → `left`. Sequence that works:
`reload` + SFX `reload` → aim pose → shot on the word → target swaps to `lotus`
(`anim: bloom`) + `gunshot` + `chime` 0.2 s later + camera `shake`.

### Extras, entrances, throws, exits (action scenes)

`scene.extras[]` adds goons/bystanders drawn behind the hero: `{ id, style: "thug",
x: 0.22 (fraction of width), scale: 0.85, pose, expression, travel: { fromX, toX,
start, end }, poseChanges, knockedOutAt }`. Extras walk/run by pose (`walk_*`,
`run_*`) + travel; a knocked-out extra rolls flat with X eyes and stays down (re-declare
it with `knockedOutAt: "start"` in later scenes). Bubbles attach with `"on": "<id>"`.
Hero cues: `entrance: { kind: "drop_in", at, duration }` (falls from above, squash
on landing — set the goon he lands on to `knockedOutAt` at the landing time);
`throws: [{ at, targets: ["t3", "t1"], flight: 0.3 }]` (spinning batarang homes onto
each target in turn, knocks it out, comes back; target `"camera"` sticks it in the
screen → add overlay `batarang_stuck` at the hit); `exit: { kind: "grapple", at,
duration }` (cable to the top-right, swings out of frame). Overlay `bat_signal`
fills the screen. SFX duck automatically under speech, but still keep booms off the
first word of a line.

Villain looks for extras: `joker` (green spikes, red grin), `penguin` (top hat, monocle),
`riddler` (green bowler with ?), `robin` (domino mask, short yellow cape — use `scale: 0.72`).
Keep bodies where they fell: re-declare each KO'd extra in later scenes with the x it was
hit at and an explicit `fallDir` (default falls toward frame centre).
Second speaker: set `voice` (+ `voiceFx: "young"`) AND `"speaker": "<extra id>"` on that scene — e.g. Robin = `am_puck`;
`speaker` decides whose mouth moves (default: the hero). A line for an extra while the hero is off-screen = `character: null` + `speaker`.
A bubble is silent: if the line should be HEARD ("WAIT!"), give it its own short speech scene with the extra as speaker.
Voice pitch reference (Hz): bm_lewis 94 · am_michael 119 · am_puck 121 · am_adam 122 ·
am_fenrir 139 · bm_george 153. Deep heroes: bm_lewis + growl (~100 Hz) or am_michael + deep.
Avoid `thunder`/`glitch` under dialogue; they read as static.

### Duels, sports, slapstick (dodgeball-duel is the reference)

Cast = extras only (`character: null`), narrated by a commentator voice (`am_michael`, speed 1.15,
`theatre`). Each extra can carry `label` (name tag), `held: "ball" | "frying_pan"` (+ `heldAt`),
`hat: "fedora"` (+ `hatAt`/`hatUntil` — appears for the move, vanishes after). Styles: `kid` (scale 0.5).
**Projectiles** — `projectiles: [{ from, to, at, flight, outcome, count, every }]`: a ball on an arc from
the thrower's hand; `miss` sails over the head (dodge with `mj_lean` / `mj_toe` / `dodge_jump` /
`dodge_split`, or moonwalk = `walk_left` pose + travel to the right), `deflect` bounces off a held pan
(pose `spin`), `hit` stops on the target (set his `knockedOutAt`), `roll` drops from the hand and
bounces along the ground to the target's foot, `to: "camera"` throws at the viewer (+ `screen_crack`).
Barrage: `count: 12, every: 0.1`. Thrower poses: `windup` → `throw` on the word.
**Anger**: `expression: "angry"` = red head + ear steam. **Camera**: `{ "move": "focus", "on": "<id>" }`
zooms onto that figure and centres him (use it on whoever owns the beat — the dodger, the angry one,
the champion); `pan_left/right`, `zoom_out` for wide duels. Captions stay fixed under any camera move.
**Props on a character**: `{ "name": "crown", "on": "pebble", "position": "above_character" }`
(head), `center` (chest — medal), `right`/`left` (in that hand — trophy).

### Clip scenes (real laughs, screams, stingers)

A scene may use a pre-recorded file instead of TTS:
`"clip": { "file": "laugh.wav", "caption": "HAHAHAHA", "maxSeconds": 6, "volume": 1.1 }`
(no `speech`). Files live in `projects/<slug>/clips/`. Generate laughter with
`uv run --project py vb-audio laugh --out projects/<slug>/clips --count 4`
(Bark; ranks candidates by laugh-likeness, copy the best to `laugh.wav`).
Anchors inside a clip scene: `start`, `end`, `start+2.2`, or `word:<caption>`.

### Voice FX and speed

Manifest `voiceFx` (default `none`) applies to every scene; a scene can override
it. `deep` = pitch −12 % + small room (gritty narrator). `villain` = pitch −20 %,
bass, big reverb — one threat line at most. `theatre` = no pitch change, stage
reverb — performers, showmen, Jhin-types. Voice FX also apply to clips. Scenes may also
override `speed` (0.7–1.4): slow to 0.9 for menace, 1.15 for lists.

## Layouts

- `character_center` — big stickman, caption below. Hooks, punchlines, CTA.
- `character_bottom` — default explainer: props on top, caption middle,
  stickman lower third. Up to 3 props fanned in `top`, or one each in
  `top_left`/`top_right`.
- `character_left` — stickman left, big prop zone `right`, caption on top.
  Good for analogies and "look at this thing" scenes.
- `caption_only` — no stickman; giant text. Use once per video for numbers
  or the key sentence. Set `"character": null`.

## Props

Anchor a prop to the **noun** it depicts (`"at": "word:database"`), default
`until` is scene end. Use `until` to swap props mid-scene (before → after).

Entrance `anim`: `pop` (default, everything), `bounce` (heavy things landing),
`drop` (lists: one per item word), `slide_left`/`slide_right` (motion, arrival),
`fade` (background context), `shake` (warnings, errors), `burst` (only for
`watermelon_split`: halves fly apart with juice over ~0.5 s), `bloom` (for
`lotus`: petals unfold), `stamp` (slams in from large — `number_1..4`, verdicts).

Persisting props across scenes: re-add them in the next scene with
`"at": "start", "anim": "fade"` in the same position (props never carry over).

Before/after swap: give the "before" prop `until: "word:X+0.08"` and the
"after" prop `at: "word:X+0.08"` in the same `position`. Up to 8 props per scene.

Position guide: `top` (centered, wide), `top_left`/`top_right` (pairs, before/after,
good/bad), `left`/`right` (beside the stickman), `above_character` (the idea
in its head — lightbulb, question, brain), `center` (caption_only scenes).

Pairs that read instantly: `checkmark`/`cross`, `chart_up`/`chart_down`,
`clock` (slow) → `rocket` (fast), `lock` (secure), `warning` (catch),
`money`/`cash` SFX, `brain`/`lightbulb` (idea), `document` ×3 with `drop` (rows,
files, requests), `database`, `computer`, `cloud`, `phone`, `book`+`magnifier`.

## SFX

One SFX per visual event, volume 0.5–0.8; never two on the same word.
`pop` prop appears · `whoosh`/`swoosh` slide-ins and scene transitions ·
`click`/`tick` countable beats, typing · `ding` correct/insight ·
`error` wrong/slow · `boom` big reveal or number · `glitch` "the catch", bugs ·
`cash` savings/speed win · `drum` build-up before the answer ·
`snikt` claws out · `slash` swipe · `splat` something got cut ·
`gunshot` / `gunshot_big` (finale) · `reload` cylinder + shells · `chime` a bloom, a soft win.

## Bubbles, camera, transitions

- `bubbles`: ≤ 8 chars, comic beats only: `"?!"`, `"WAIT"`, `"10x"`, `"HMM"`,
  `"NOPE"`. One per scene max, anchored to the reaction word, `until` the
  next thought.
- `camera`: `punch_in` on the hook's key word and the payoff word (max 2 per
  video); `slow_zoom` on a calm explainer scene; `shake` with `boom`/`error`;
  `dolly_in` for a character looming at the viewer (finales).
- `overlays` (on the viewer's screen, outside the camera): `claw_marks`, `flash`, `blackout`,
  `hook_card` (opening text hook, needs `text`, 2–8 words; sits above the top prop slots),
  `spotlight` (dark stage, cone of light — the standard `bare` opening), `flourish` (Jhin W as in the game: a thin white line
  with a blue-violet halo across the screen + a brief cool wash, on a line like "Hold still." before the finale shot), `screen_crack`
  (glass shatter at frame centre — the standard ending after a camera shot/strike/throw; re-add at `start`
  on every later scene so the screen stays broken), `follow_card` (CTA: @handle + Follow button in the caption slot — set the scene's
  `"captions": false` and anchor it to `word:follow`; the character SAYS the CTA in his own voice).
- `transition` (into the scene): `cut` default; `slide` for a change of
  subject; `wipe` before → after; `zoom` for the pattern-interrupt scene.

## Manifest field reference (authored)

```jsonc
{
  "version": 1, "slug": "kebab-case", "title": "…",
  "voice": "af_heart",      // af_heart af_bella af_nicole af_sarah af_sky am_adam am_michael am_fenrir am_puck bf_emma bf_isabella bm_george bm_lewis
  "speed": 1.08,            // 0.8–1.3
  "voiceFx": "none",        // none deep villain theatre growl young mask
  "theme": "midnight",      // midnight paper sunset mint grape
  "music": { "track": "lofi-01", "volume": 0.16 } | null,
  "watermark": true,          // channel handle from brand.json on every frame (omit = brand default)
  "social": { "title": "…", "hook": "…", "description": "…", "tags": ["…"], "hashtags": ["#shorts"], "pinnedComment": "…", "coverText": "…" },
  "scenes": [{
    "id": "hook", "speech": "…", "emphasis": ["…"], "pauseAfter": 0.25,
    "speed": 0.95, "voiceFx": "villain", "voice": "am_puck",   // optional per-scene overrides (second speaker)
    "layout": "character_bottom", "transition": "cut",
    "character": { "pose": "explaining", "expression": "neutral", "position": "center",
                   "poseChanges": [{ "pose": "shocked", "expression": "surprised", "at": "word:slow" }] } | null,
    "props":   [{ "name": "database", "at": "word:database", "until": "end", "anim": "pop", "position": "top", "scale": 1 }],
    "sfx":     [{ "name": "pop", "at": "word:database", "volume": 0.8 }],
    "bubbles": [{ "text": "?!", "at": "word:slow", "until": "end-0.5" }],
    "camera":  [{ "move": "punch_in", "at": "word:slow" }]
  }]
}
```

Anchor grammar: `start | end | word:<text>[#n] | word:<a>_<b>` + optional `±seconds`.
Word matching ignores case and punctuation; `#2` = second occurrence.

## Reviewing the contact sheet

After `video_render` you get a 4×3 grid (every render is a new `output/v<N>/`;
say "v3 vs v2", never overwrite). Check: stickman never overlaps the
caption; props are visible when their noun is spoken (compare against the
`words` timing); no scene shows the same pose in 3 consecutive frames; text
stays inside the frame. Fix by moving anchors or changing layout, then re-render
(only changed scenes are re-synthesized).
