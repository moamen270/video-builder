# Decisions

Short records of choices that were made deliberately, so nobody re-opens them
by accident. Format: what we chose, what we rejected, why. Dates are when the
decision was locked.

## D1 — 100 % code-driven: an LLM writes a manifest, an engine renders it (2026-09)

**Chose** a JSON DSL compiled by a deterministic local pipeline.
**Rejected** letting the model drive a video editor / generate frames directly.
**Why** reproducibility (same manifest → same MP4), reviewability (a diff of two
manifests explains a difference between two videos), and the model is good at
*what to say and when* but bad at pixels and timing.

## D2 — Word anchors, never numeric time, in the authored schema

**Chose** `word:<text>±s | start | end`. **Rejected** seconds/frames in the
manifest. **Why** the LLM cannot know speech durations; they are a measurement
we can take. Numeric fields would invite guessing and desync captions from
props. The resolved schema is where numbers live.

## D3 — Kokoro-82M for TTS, forced timestamps, no Whisper

**Chose** Kokoro's per-phoneme durations mapped to tokens. **Rejected**
cloud TTS (ElevenLabs etc.) and Whisper re-alignment. **Why** local, free,
fast on CPU, good English quality, and the alignment is exact by construction
instead of a second lossy model on top. Trade-off: English only (Arabic would
need another TTS behind the same `alignment.json` contract).

## D4 — Remotion for rendering

**Chose** Remotion (React → frames → ffmpeg). **Rejected** raw canvas + ffmpeg,
Motion Canvas, Lottie. **Why** frame = pure function of props, easy SVG
rigging, springs/interpolate built in, Studio for previewing, parallel
rendering. Trade-offs: Chrome screenshotting bottleneck (~60 s for a 40 s
video), zod version pinned by Remotion (`4.5.4` via root `overrides`),
company license needed if the team grows past 3.

## D5 — Procedural joint-angle stickman, no sprites, no costumes

**Chose** a 12-angle rig per pose, spring-interpolated; styles add
attachments (claws, pistol, ears/cape, hats). **Rejected** PNG sprite sets,
Lottie clips, full costumes/masks. **Why** poses are cheap data the LLM can
pick from a closed catalog; transitions are free; geometry can be *computed*
(aim at a target, plant a foot, fall about the feet). User feedback: a costumed
stickman became "a yellow cat" — silhouette + one signature prop reads better
at Shorts size. Details in [ARCHITECTURE.md §4](ARCHITECTURE.md#4-the-stickman--how-it-animates-and-why-it-is-built-this-way).

## D6 — Hits are computed, not posed

**Chose** `strikes[]`/`throws[]`/`shots[]` with target zones, arm aimed in
screen space, lunge/hop for reach, shared geometry for on-screen marks.
**Rejected** `slash_*` poses as the hit. **Why** a pose never touches anything
and marks never matched the swing; computing from the target makes contact
true for any position/scale.

## D7 — Vertical 1080×1920 @ 30 fps, hard cap 60 s, warn > 45 s

**Why** one master for YouTube Shorts / TikTok / Reels; 60 s is the strictest
platform limit, 35–45 s is the retention sweet spot.

## D8 — Immutable versions: every render is `output/v<N>/`

**Chose** append-only versions with QA + contact sheet + manifest snapshots.
**Rejected** overwriting `final.mp4`. **Why** the user compares versions side
by side; a "fix" that regresses something must remain diffable against the
previous take. Renders are not committed; `vb publish` puts a version on a
GitHub Release for remote viewing.

## D9 — MCP is the agent's only interface

**Chose** an MCP server exposing catalog/skills/create/validate/compile/render/
qa/publish. **Rejected** letting the agent shell out to the CLI. **Why** the
tool surface *is* the contract: any client (Claude Code today, Codex later)
gets the same operations, skills come back via `video_read_skill`, and the
render tool returns the contact sheet as an image so the agent can look at
its own output.

## D10 — Laughs and screams are clips (Bark), never TTS

**Why** Kokoro reads "ha ha" as words. Bark generates non-verbal audio;
candidates are ranked by laughter-like 3–7 Hz modulation and pitch-matched to
the narrator by measured F0. See [AUDIO.md §3](AUDIO.md#3-clip-scenes-and-laughter-bark).

## D11 — Single narrator first, `characters[]` and `extras[]` for more

**Why** ship one good stickman before a cast. `characters[]` (hero styles) and
`extras[]` (goons, sidekicks, bodies) were added when the Batman video needed
them, without changing the single-narrator path.

## D12 — Private repo, no license file

The repo is private and personal; no LICENSE is added. Revisit if it is ever
opened up (Remotion's own license terms still apply to the renderer).

## D13 — Chatterbox is the second voice engine, on a one-week trial (from 2026-09-19)

**Why** Kokoro cannot be directed: punctuation, casing and speed change nothing in
its pitch contour, and it reads laughs as syllables (measured in
`F:/PoCs/audios/experiments/001-kokoro-limits`). Character voices therefore never
matched the personality. Chatterbox (Resemble AI, MIT, 350 M/500 M) runs on the
GTX 1660 at ~0.7–1.5× real time, has an `exaggeration` knob that measurably moves
prosody, performs `[laugh] [chuckle] [cough]` in the same voice, and clones a
reference clip — so a Kokoro voice we already published can stay the character's
identity (`assets/voices/*.wav`). Its missing word timestamps are recovered by
forced alignment within 12 ms median (`audios/experiments/003-alignment`).

**How** a second uv project `py-chatterbox/` (torch 2.6 CUDA cannot share `py/`'s
env); manifest fields `engine`, `voiceRef`, `emotion` at manifest and scene level;
`speech` may carry tags when the engine is chatterbox; the aligner writes the same
`alignment.json`, so the resolver, renderer, QA and review pack are untouched.
Kokoro stays the default. First like-for-like: `batman-alley` v7 (Kokoro) vs v8 (Chatterbox).

**Exit criteria (decide ~2026-09-26)** Moamen's ear on the week's videos: does the
character match improve, do laughs land, is the voice stable across scenes and
videos? Keep → make it the default for character lines and log the choice here.
Drop → remove the engine fields' default docs but keep the engine abstraction for the
next candidate (Qwen3-TTS VoiceDesign or a paid API, see `audios/docs/06`).
D10 (laughs are Bark clips) is suspended for Chatterbox scenes: tag the laugh instead.

