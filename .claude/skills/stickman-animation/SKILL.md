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

Rules:
- Start each scene in the pose that matches its first clause; add 1–3
  `poseChanges` anchored to the words where the meaning turns.
- Don't repeat the same pose in consecutive scenes' openings.
- Give an `expression` on every pose change where the mood shifts.
- `position`: `center` for hooks/CTA; `left`/`right` when props need the other
  side. The stickman flips to face inward when on the right.

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
`fade` (background context), `shake` (warnings, errors).

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
`cash` savings/speed win · `drum` build-up before the answer.

## Bubbles, camera, transitions

- `bubbles`: ≤ 8 chars, comic beats only: `"?!"`, `"WAIT"`, `"10x"`, `"HMM"`,
  `"NOPE"`. One per scene max, anchored to the reaction word, `until` the
  next thought.
- `camera`: `punch_in` on the hook's key word and the payoff word (max 2 per
  video); `slow_zoom` on a calm explainer scene; `shake` with `boom`/`error`.
- `transition` (into the scene): `cut` default; `slide` for a change of
  subject; `wipe` before → after; `zoom` for the pattern-interrupt scene.

## Manifest field reference (authored)

```jsonc
{
  "version": 1, "slug": "kebab-case", "title": "…",
  "voice": "af_heart",      // af_heart af_bella af_nicole af_sarah af_sky am_adam am_michael am_fenrir am_puck bf_emma bf_isabella bm_george bm_lewis
  "speed": 1.08,            // 0.8–1.3
  "theme": "midnight",      // midnight paper sunset mint grape
  "music": { "track": "lofi-01", "volume": 0.16 } | null,
  "scenes": [{
    "id": "hook", "speech": "…", "emphasis": ["…"], "pauseAfter": 0.25,
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

After `video_render` you get a 5×3 grid. Check: stickman never overlaps the
caption; props are visible when their noun is spoken (compare against the
`words` timing); no scene shows the same pose in 3 consecutive frames; text
stays inside the frame. Fix by moving anchors or changing layout, then re-render
(only changed scenes are re-synthesized).
