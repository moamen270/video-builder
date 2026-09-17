---
name: stickman-animation
description: Visual vocabulary for video-builder manifests — which pose, expression, layout, prop, SFX, bubble and camera cue to use for each kind of beat, and the manifest field reference. Use alongside 2d-storytelling when writing or fixing scenes.
---

# Stickman animation guide

The stickman is a single narrator. It cannot walk or hold things; it *gestures*.
Motion comes from **pose switches** (spring-animated, ~0.4 s), **props popping in
on words**, and **camera cues**. Aim for one visible change every 1.5–2 s.

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
| `walk_right` / `walk_left` | side view, procedural gait, no face to camera — pair with `character.travel` | — |

Locomotion: `"travel": { "from": "offscreen_left", "to": "offscreen_right", "start": "start", "end": "end" }`
moves the character rect between stops (`offscreen_left left center right offscreen_right`).
Silent visual scenes: `"silence": 9` (seconds) instead of `speech`/`clip` — music only, no captions.
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

`characters[].style`: `stickman` (plain narrator) or `wolverine` — the same
plain stickman with three adamantium claws on each hand. No costume, no mask:
the claws and the delivery carry the aura. Play him deadpan and serious about
something trivial; the joke is never in his lines. Pair with `voiceFx: "deep"`,
`speed` 0.9–0.98, `am_michael`/`am_fenrir`, `snikt` on the reveal, and a
`voiceFx: "villain"` scene for the evil laugh (`"Muahahahaha! Hahahahaha!"`).

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
- `overlays` (on the viewer's screen, outside the camera): `claw_marks`, `flash`, `blackout`.
- `transition` (into the scene): `cut` default; `slide` for a change of
  subject; `wipe` before → after; `zoom` for the pattern-interrupt scene.

## Manifest field reference (authored)

```jsonc
{
  "version": 1, "slug": "kebab-case", "title": "…",
  "voice": "af_heart",      // af_heart af_bella af_nicole af_sarah af_sky am_adam am_michael am_fenrir am_puck bf_emma bf_isabella bm_george bm_lewis
  "speed": 1.08,            // 0.8–1.3
  "voiceFx": "none",        // none deep villain
  "theme": "midnight",      // midnight paper sunset mint grape
  "music": { "track": "lofi-01", "volume": 0.16 } | null,
  "scenes": [{
    "id": "hook", "speech": "…", "emphasis": ["…"], "pauseAfter": 0.25,
    "speed": 0.95, "voiceFx": "villain",          // optional per-scene overrides
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
