# Architecture — how a manifest becomes a Short

This is the contributor's map. If you only want to *make* videos, read
`.claude/skills/` instead; this document explains what happens underneath and
why it was built this way. Decisions that were consciously locked are in
[DECISIONS.md](DECISIONS.md); the audio side is detailed in [AUDIO.md](AUDIO.md).

## 1. The one-sentence model

> An LLM writes **what is said and what happens on which word**. The engine
> measures the speech, turns every word into a frame number, and a purely
> deterministic React renderer draws frame *N* as a function of the compiled
> manifest and *N* alone.

Everything else follows from that: no keyframes are authored by hand, no
timings are guessed, and the same inputs always produce the same MP4.

## 2. Pipeline

```
manifest.json ──validate (Zod)──▶ Manifest
      │
      │ vb compile
      ▼
py/vb_audio synth ──▶ build/audio/<scene>.wav + build/alignment.json   (word → [start,end] seconds)
      │
      ▼
engine/src/resolver ──▶ build/manifest.resolved.json                  (everything in frames)
      │
      │ vb render
      ▼
renderer (Remotion) ──▶ frames ──▶ ffmpeg (x264 / NVENC) ──▶ loudnorm −14 LUFS ──▶ output/v<N>/final.mp4
      │
      │ vb qa
      ▼
ffprobe · per-second luminance · volumedetect · 4×3 contact sheet ──▶ output/v<N>/qa.json, contact.png
```

| stage | code | input → output |
|---|---|---|
| validate | `engine/src/schema/manifest.ts` | JSON → `Manifest` (closed vocabularies from `catalog.ts`) |
| synth | `py/vb_audio/tts.py`, `engine/src/audio.ts` | scene text → wav + per-token timestamps; clip import; silence; voice FX |
| resolve | `engine/src/resolver/{anchors,resolve}.ts` | `Manifest` + alignment → `ResolvedManifest` (`schema/resolved.ts`) |
| render | `engine/src/render.ts`, `renderer/src/**` | resolved JSON as Remotion props → MP4 |
| qa | `engine/src/qa.ts` | MP4 → checks + contact sheet |
| version/publish | `engine/src/{paths,project,publish}.ts` | immutable `output/v<N>/`, GitHub Release `<slug>-v<N>` |
| agent interface | `engine/src/mcp/server.ts`, `engine/src/cli/index.ts` | same functions exposed as MCP tools and as `vb` CLI |

### 2.1 Two schemas, on purpose

- **Authored** (`schema/manifest.ts`) — what the LLM writes. Small, closed
  vocabularies (poses, props, SFX, styles…), every time reference is an
  **anchor** string. No numbers for time, ever.
- **Resolved** (`schema/resolved.ts`) — what the renderer reads. Every anchor
  has become an absolute frame (`atFrame`, `startFrame`, `koFrame`, hop
  `hitFrame`…), every fractional x has become pixels, every asset has a staged
  path. The renderer never sees the authored form and never touches audio
  timing; it is a pure function `(resolved, frame) → pixels`.

Keeping them separate is what lets us change how timing is computed (TTS
model, alignment method, fps) without touching a single component, and lets a
person diff `manifest.resolved.json` to see exactly what the renderer will do.

### 2.2 Anchors — the timing language

```
start | end | word:<text>[#n] | word:<a>_<b>      optionally ±seconds
"word:slow"   "word:every_single_row"   "word:the#2"   "end-0.4"   "start+2.2"
```

`anchors.ts` matches words case- and punctuation-insensitively against the
scene's token list (from Kokoro's forced timestamps), returns the **first
frame of that word**, and applies the offset. Phrases (`a_b`) resolve to the
first word. Out-of-range anchors warn and clamp.

Why words and not seconds: an LLM cannot know how long "every single row"
takes to say, but it knows *which word* the prop belongs to. Speech timing is
a measurement, so we measure it and let the author point at meaning.

## 3. Timeline layout

The resolver walks the scenes in order with a frame `cursor`:

```
speechFrames     = ceil(audio.duration * fps)
durationInFrames = ceil((audio.duration + pauseAfter) * fps)
startFrame       = cursor;  cursor += durationInFrames
word.startFrame  = startFrame + round(word.start * fps)
```

`Short.tsx` turns each resolved scene into a Remotion `<Sequence from=startFrame
durationInFrames=…>` containing a `SceneView`. Inside a scene, `abs = frame +
scene.startFrame` so every cue compares against absolute frames — the same
numbers you can read in `manifest.resolved.json`.

Silence scenes (`"silence": 3.4`) and clip scenes (`"clip": {file}`) go through
the same path: they just have no tokens (clip scenes get one pseudo-token for
the caption so `word:<caption>` anchors still work).

## 4. The stickman — how it animates and why it is built this way

### 4.1 Why a procedural joint rig instead of sprites or Lottie

We considered three options at the start:

1. **Pre-drawn sprites / PNG sequences per pose** — fast to render, but every
   new pose is art work, transitions between poses are hard cuts, and nothing
   can be aimed at a target (you can't make a sprite's hand pass through a
   specific watermelon).
2. **Lottie / After Effects exports** — great motion quality, but authored
   keyframes are opaque to an LLM and to code; retiming to a word means
   stretching a baked animation.
3. **Procedural SVG rig driven by joint angles** — every pose is 12 numbers,
   transitions are free (interpolate the numbers), and *anything can be
   computed*: aim an arm at a point, plant a foot on a ground line, rotate a
   body about its feet when it's knocked out.

Option 3 is the only one where "the claws must actually touch the melon" and
"the marks on screen must follow the claw path" are solvable with geometry
rather than with an artist. It also fits the compiler philosophy: a pose is
data in a closed catalog, so the LLM can only pick valid poses, and we can add
a pose by adding one row of numbers.

### 4.2 The front rig (`renderer/src/characters/Stickman.tsx`, `poses.ts`)

The character lives in a **240×420 rig space** scaled into the layout's
character rect. Fixed points: hip, shoulder, neck; segment lengths for upper
arm, forearm, thigh, shin; head radius.

A **pose is a `Rig`**: 12 numbers — `lUpper lLower rUpper rLower lThigh lShin
rThigh rShin head torso lift nod`. Angles are in degrees with one convention
used everywhere:

```
0°  = straight down
+   = toward screen-right        x = sin(deg), y = cos(deg)
180 = straight up
lower joints are relative to their parent (forearm relative to upper arm)
```

`polar(x, y, len, deg)` walks a segment; the whole body is built shoulder →
elbow → hand, hip → knee → foot in ~15 lines. Because everything is angles,
`flip` (character on the right facing inward) is a single `scaleX(-1)`.

**Pose changes are springs, not keyframes.** The scene declares `pose` and
`poseChanges[{pose, atFrame}]`; at frame `abs` we find the latest change
(`since`) and the previous pose, then

```
t   = spring(abs - since)          // Remotion spring, damping 13 / stiffness 140
rig = lerpRig(RIGS[prev], RIGS[pose], t)
```

A spring gives overshoot and settle for free, so "shocked" throws the arms up
and they bounce slightly. Poses in `SNAP_POSES` (slashes, aims, claws) use a
stiff spring (damping 20 / stiffness 420 / mass 0.6) so attacks hit instead of
floating.

On top of the interpolated rig, small **procedural life** is layered every
frame: breathing (torso/lift sine), idle sway, head nod, mouth opening driven
by whether a word is being spoken at `abs`, blink. This is why a 6-second scene
with a single pose still moves.

**Expressions** are a separate enum drawn onto the head (brows, eyes, mouth
shape): `neutral happy surprised worried confused smug laughing fierce ko`.

**Styles** (`CHARACTER_STYLES`) decorate the *same* rig: `wolverine` adds
claws to the hands, `gunslinger` a pistol, `batman` cowl ears + cape (`Cape`
is a few bezier ribbons whose control points lag the torso), villains and
Robin add head decor. There are no costumes or masks over the face — early
feedback was that a full costume turned the stickman into "a yellow cat"; the
silhouette + one prop reads better at Shorts size.

Attachments (claws, pistol, batarang in hand) are placed at the hand and
rotated along the forearm. Gotcha baked into the code: SVG `rotate()` is
clockwise, our angles are "0 = down, + = right", so attachments use
`rotate(-deg)`. Getting this wrong makes the claws point back up the arm.

### 4.3 Strikes — hits that really connect (`strikeAt`)

A `slash_left` pose alone never touched anything, so melee became its own
system. `character.strikes[{atFrame, target, big}]` where `target` is a prop
zone (`left`, `right`, `top_right`…) or `"camera"`.

For each strike the renderer computes, in **screen space**:

1. the shoulder pivot (after scale/flip/torso) and the target zone centre;
2. the *hit angle* `atan2(dx, dy)` — the forearm angle whose claw tip passes
   through the target;
3. a wind-up angle ~125–138° over the top, and a follow-through angle past
   the hit;
4. a frame envelope relative to `atFrame`: `[-8,-3]` raise to wind-up,
   `[-3,0]` snap down to the hit angle, `[0,4]` follow through, `[4,20]`
   recover. Consecutive strikes can be 12 frames apart.

The result overrides the aimed arm via `blend(base, strike)` — a weight `w`
that fades in/out so the arm leaves and rejoins the spring-interpolated pose
smoothly. If the target is out of reach, the body **lunges** (translate toward
the target) or **hops** (lift) so the tip still passes through the zone centre.
The claws are attached to the *aimed* forearm angle (`lForeDeg/rForeDeg`), not
the pose's, otherwise they fall off the swing (that regression happened once).

Why compute rather than author: the same strike code works for a melon on the
left, one over the shoulder, and the camera, at any character scale or
position — the manifest just says *which* zone and *which word*.

### 4.4 Camera strike → claw marks (`cameraSlashGeometry`, `Overlay.tsx`)

For `target: "camera"` the strike and the `claw_marks` overlay share one
function returning the shoulder pivot, claw-tip radius and sweep angles **in
frame coordinates after the camera transform**. The overlay draws three arcs
along that exact claw-tip path, staggered radially, dims the picture behind
them and then blacks out. Sharing geometry is what makes "the marks follow the
claws" true by construction instead of by tuning.

### 4.5 Side-view `Walker` (`Walker.tsx`)

Walking, running and jumping use a second rig drawn in profile (one eye, nose
bump, no face to camera). It is procedural, not keyframed:

- **Gait** — a phase `φ = frame · cadence` drives thigh/shin/arm angles with
  sines; the absolute frame drives it so cuts between scenes never restart the
  step. `run` raises cadence, stride and forward lean.
- **Planted-foot rule** — leg angles are computed first, then the whole body
  is dropped so the stance foot sits exactly on the ground line. That single
  rule gives crouch squash, landing absorb and rebound without any extra
  animation.
- **Jump state machine** — `crouch → air → land → settle → stand`, with frame
  counts fixed by the resolver (`crouch 0.3 s, air = manifest, land 0.25 s,
  settle 1.1 s`). Air follows a parabola between the from/to x stops to the
  target `height`; landing bends knees, settle is a damped oscillation of lean
  and knee angle. Lean is toward the landing target (`180 - lean` — an earlier
  version leaned away).

The front rig and the Walker share the 240×420 rig space, so a character can
switch between them across scenes (or mid-scene when knocked out) without a
size jump.

Two React gotchas: the switch between Walker and front rig happens with a
plain early return, so **no hooks may follow that return** (React #310 —
hook count changed — hit us when an extra got knocked out mid-scene), and
`useMemo` is avoided in that component for the same reason.

### 4.6 Motion, extras, throws (`motion.ts`, `SceneView.tsx`)

- `motionAt(scene, abs)` — hero position: `travel` between stops
  (`offscreen_left left center right offscreen_right`, resolved to px per
  layout), `jump` parabola, plus `heroEntranceExit` (drop-in with gravity
  `1 − t²` and landing squash; grapple exit accelerating toward a cable anchor
  at the top-right and hiding when done).
- **Extras** are secondary characters drawn behind the hero, positioned by a
  fraction of width (`x`), optionally travelling, with their own poses. A
  knocked-out extra freezes its x at `koFrame`, rotates about its feet by
  `fallDir` and switches to the `ko` expression. Bodies persist across scenes
  only because the manifest re-declares them at the same x — the skill tells
  the author to do that.
- **Throws** — the resolver expands `throws[{at, targets[], flight}]` into
  hops with `hitFrame = atFrame + flightFrames·(k+1)` and sets each target's
  `koFrame`; the renderer moves a spinning batarang along each hop
  (`alongHop`) and returns it. `"camera"` as a target sticks it into the
  screen via the `batarang_stuck` overlay.
- **Camera** — a per-scene transform (`punch_in` 1.09×, `dolly_in` 1.45×,
  `slow_zoom`, `shake`) applied to the world; overlays are drawn outside it.
- **SFX ducking** — every SFX `<Audio>` has a volume callback that drops to
  38 % while a word is being spoken near that frame, so a boom never masks a
  line.

## 5. Determinism and versioning

- The renderer uses only `useCurrentFrame()` and the resolved props — no
  `Date`, no `Math.random` outside seeded helpers — so Remotion can render
  frames in parallel and the output is reproducible.
- Every render goes to a **new** `output/v<N>/` with the mp4, `qa.json`,
  `contact.png` and snapshots of both manifests. `render.ts` refuses to
  overwrite; `project.json.versions[]` records them. The user compares
  versions side by side, so nothing is ever deleted.
- Renders are gitignored; `vb publish` uploads a version to a GitHub Release
  tagged `<slug>-v<N>` for viewing away from the PC.

## 6. Module map

```
engine/src/
  schema/catalog.ts      closed vocabularies the LLM may use (poses, props, sfx, styles, fx, cameras, overlays, VIDEO consts)
  schema/manifest.ts     authored Zod schema (anchors, ≤8 props/sfx, exactly one of speech|clip|silence)
  schema/resolved.ts     frame-exact mirror the renderer reads
  resolver/anchors.ts    anchor grammar → frame
  resolver/resolve.ts    Manifest + alignment → ResolvedManifest (travel px, jump/throw/KO frames, asset staging)
  audio.ts               per-scene TTS cache (hash of text/voice/speed/fx), clips, silence, ffmpeg voice-FX chains
  render.ts              Remotion render → encode (NVENC test, x264 fallback) → loudnorm master; new version only
  qa.ts                  ffprobe / luminance / loudness / contact sheet
  build.ts               compile → render → qa orchestration
  paths.ts project.ts    project folders, versions, project.json
  publish.ts             GitHub Releases upload (token from env / gh / git credential)
  cli/index.ts           `vb` commands
  mcp/server.ts          the same operations as MCP tools (the agent's only interface)
renderer/src/
  Root.tsx Short.tsx     composition; one <Sequence> per scene; progress bar
  theme.ts               palettes, LAYOUTS (character rect, prop slots, caption slot, ground line per layout)
  scenes/SceneView.tsx   camera, background, extras, hero, props, batarang, bubbles, captions, SFX, overlays
  scenes/Overlay.tsx     claw_marks, flash, blackout, bat_signal, batarang_stuck
  characters/poses.ts    RIGS (12 angles per pose), SNAP/WALK/RUN sets, lerpRig
  characters/Stickman.tsx front rig, styles/attachments, strikes, KO, squash
  characters/Walker.tsx  side-view gait + jump state machine
  characters/motion.ts   hero/extra positions per frame
  captions/              kinetic word captions from resolved words
  props/                 icon set + entrance animations
py/vb_audio/             Kokoro synth + forced timestamps, Bark laughs, F0 pitch, CLI
assets/                  procedurally generated SFX and music (+ generator)
projects/<slug>/         manifest, project.json, build/ (alignment + resolved committed), clips/, output/v<N>/ (ignored)
```
