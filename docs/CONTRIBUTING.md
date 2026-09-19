# Contributing

Read [ARCHITECTURE.md](ARCHITECTURE.md) first (15 minutes). This file is the
practical part: setup, the change checklist, testing, and the traps that have
already bitten us.

## Setup

```powershell
npm install                      # engine + renderer workspaces
cd py; uv sync; cd ..            # python env (torch CPU, kokoro, bark deps)
npm run vb -- doctor             # node, python, ffmpeg, NVENC probe, model presence
npm run typecheck && npm test
```

Fast inner loop while working on the renderer:

```powershell
npm run studio                                            # Remotion Studio, live reload
npm run vb -- render <slug> --frames 0-90 --scale 0.5     # 3-second preview render
```

Existing projects under `projects/` are the fixtures: `database-indexes`
(explainer), `wolverine-watermelons` (strikes, claw marks, clip laugh),
`jhin-four-shots` (gunslinger shots, theatre fx), `walking-stickman` /
`stickman-box-jump` (Walker, jump), `batman-alley` (extras, drop-in, throws,
grapple, per-scene voice). Their `build/alignment.json` is committed, so
`vb render <slug>` works without running TTS.

## Adding a feature end-to-end

Every vocabulary change touches the same chain. Do all of it or the LLM will
be offered something the renderer can't draw (or vice-versa).

| step | file | what |
|---|---|---|
| 1 | `engine/src/schema/catalog.ts` | add the name to the closed list (`POSES`, `PROPS`, `SFX`, `CHARACTER_STYLES`, `VOICE_FX`, `OVERLAYS`, …). One-line comment on what it does. |
| 2 | `engine/src/schema/manifest.ts` | only if a new *field* is needed (anchors are strings, never numbers). |
| 3 | `engine/src/schema/resolved.ts` | frame-exact mirror of that field. |
| 4 | `engine/src/resolver/resolve.ts` | anchor → frame, fractions → px, any derived frames (hits, KO, landings). Validate cross-references here (e.g. throw target must be an extra) and throw `ResolveError` with a path. |
| 5 | `renderer/src/...` | draw it. Pose → `poses.ts` row; prop → `props/icons.tsx`; style → `Stickman.tsx` (+ `Walker` head decor); SFX → `assets/generate_assets.py` + regenerate. |
| 6 | `.claude/skills/stickman-animation/SKILL.md` | tell the author when and how to use it, with a copy-pasteable snippet. Update the field reference at the bottom. |
| 7 | tests | resolver behaviour in `engine/src/**/*.test.ts`; render a fixture project and look at the contact sheet. |
| 8 | `README.md` | only if the CLI or setup changed. |
| 9 | `renderer/src/brand/Brand.tsx` | if a new character style should appear on the channel cover, add a `Figure` and rerun `vb brand`. |

Then render a **new version** of a fixture project that exercises the feature
(`npm run vb -- build <slug>`), check `output/v<N>/contact.png` and `qa.json`.

## Rules

- **Never overwrite or delete a render version.** `render.ts` refuses to; do
  not work around it. Renders are gitignored, published via `vb publish`.
- **Never hand-edit `projects/*/build/manifest.resolved.json`.** Regenerate with `vb compile`.
- **No numeric time in the authored schema.** Anchors only.
- **Determinism in the renderer:** only `useCurrentFrame()`/props may vary a
  frame. No `Math.random`, `Date`, or module-level mutable state.
- **Angle convention** everywhere in the rig: 0° = down, + = screen-right
  (`x = sin, y = cos`); lower joints relative to parent. SVG `rotate()` is
  clockwise, so attachments use `rotate(-deg)`.
- **Hooks in `Stickman.tsx`** must all be called before the Walker early
  return. Changing hook count between frames (e.g. when an extra gets KO'd and
  switches rig) crashes the render with React #310.
- **Python never writes data to stdout.** Third-party libs pollute it; take an
  `--out` path.
- **Commit `manifest.json`, `project.json`, `build/alignment.json`,
  `build/manifest.resolved.json`, `clips/`.** Do not commit `build/audio`,
  `build/assets`, `output/`.
- Commit messages: imperative summary line; mention the project version if a
  video was rendered ("…; alley v3").

## Testing

- `npm test` — vitest over `engine/`. Currently: anchor grammar
  (`resolver/anchors.test.ts`) and manifest schema (`schema/manifest.test.ts`).
  Add resolver tests for any new derived timing (travel, jump, throws/KO).
- `npm run typecheck` — both workspaces; the renderer imports engine types via
  `@vb/engine/schema`, so schema changes surface here.
- Visual: there is no pixel test. Render a fixture, open the contact sheet,
  compare with the previous version's.
- Audio: `uv run --project py vb-audio probe <wav>` for duration/levels;
  `python -m vb_audio.pitch` for F0.

## Known traps (each of these cost time once)

| symptom | cause / fix |
|---|---|
| Remotion "version mismatch" on zod | Remotion needs exactly `zod@4.5.4`; root `package.json` `overrides` pins it. Clean reinstall after changing deps. |
| webpack can't resolve `./catalog.js` | engine uses `.js` specifiers for ESM; `renderer/remotion.config.ts` sets `resolve.extensionAlias` `.js → .ts`. |
| alignment JSON corrupt / parse error | something printed to stdout in Python. Use `--out` files. |
| `ffmpeg`/`uv` not found in a shell | shell predates the winget install. Open a new one or prepend the winget package bin dirs to `PATH`. |
| render output slightly longer, 96 kHz | `loudnorm` resamples; `render.ts` forces `-ar 48000 -shortest`. |
| voice-FX scene drifts vs captions | pitch shift changed length; `applyVoiceFx` pads/trims to exact seconds (`apad`, `-t`). Keep that. |
| `engine: chatterbox` says "unavailable" | `cd py-chatterbox && uv sync`, then force CUDA torch: `uv pip install --python .venv/Scripts/python.exe --reinstall --no-deps torch==2.6.0+cu126 torchaudio==2.6.0+cu126 --index-url https://download.pytorch.org/whl/cu126`. `setuptools<81` is pinned because `resemble-perth` imports `pkg_resources`. Caches: `HF_HOME`/`UV_CACHE_DIR`/`TORCH_HOME` point at `F:\caches` (C: is small). |
| NVENC fails | driver < 610 lacks the needed API; `doctor` does a real test encode and `render.ts` falls back to libx264. |
| claws/pistol point back up the arm | `rotate(deg)` instead of `rotate(-deg)`. |
| arm swings but claws don't follow | claws must use the *aimed* forearm angle (`lForeDeg/rForeDeg`), not the pose's. |
| React error #310 mid-scene | hook after the Walker early return, or `useMemo` count changing on KO. |
| QA fails on an intentional fade-to-black | luminance check is per-second and skips declared `blackout`/`flash` windows — declare the overlay, don't lower the threshold. |
| bodies "teleport" between scenes | extras don't persist; re-declare KO'd extras with the same `x` and explicit `fallDir`. |
| `thunder`/`glitch` sound like a broken radio | sustained noisy SFX under speech at Shorts volume; use `drum`/`boom`/`chime` instead. |
| long heredocs in Git Bash mangle TS/Python | write a small patch script file instead of inline heredocs; delete it afterwards. |

## Where to look when something is wrong

- Timing off by a word → `build/alignment.json` (what Kokoro measured) then
  `build/manifest.resolved.json` (what the resolver produced).
- Wrong frame → open Remotion Studio, scrub to `abs` frame; every cue in the
  resolved file is an absolute frame.
- Audio → MCP `video_logs` (last 200 lines of compile/render output) for the TTS and ffmpeg steps.
