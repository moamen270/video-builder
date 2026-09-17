# video-builder

Local-first 2D stickman **Shorts compiler**. An AI agent writes a small JSON
manifest (what is said, which pose/prop/sound lands on which *word*); the engine
synthesizes the voice with Kokoro-82M, measures every word, and renders a
1080×1920 @ 30 fps MP4 with Remotion. No cloud services, no timing guesswork.

```
prompt ─▶ agent (Claude Code + skills) ─▶ manifest.json
                                              │  vb compile
                       Kokoro TTS ──▶ word timestamps ──▶ manifest.resolved.json
                                              │  vb render
                       Remotion (stickman, kinetic captions, props, SFX, ducked music)
                                              │  vb qa
                       ffprobe / luminance / loudness / contact sheet ──▶ final.mp4
```

**Contributor docs:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (pipeline, the
stickman rig and why it is procedural), [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
(setup, add-a-feature checklist, known traps), [docs/AUDIO.md](docs/AUDIO.md)
(Kokoro alignment, voice FX, Bark laughs), [docs/DECISIONS.md](docs/DECISIONS.md),
[docs/PRODUCTION.md](docs/PRODUCTION.md) (per-video checklist: hook, retention, CTA, QC, platforms, metrics).

## Prerequisites (Windows)

| tool | install | why |
|---|---|---|
| Node ≥ 22 | nodejs.org | engine + Remotion |
| Python 3.12 | `winget install Python.Python.3.12` | Kokoro TTS |
| uv | `winget install astral-sh.uv` | Python env management |
| FFmpeg | `winget install Gyan.FFmpeg` | QA, loudness, optional NVENC |
| NVIDIA GPU | optional | `--nvenc` encode path |

```powershell
npm install                 # node workspaces (engine + renderer)
cd py; uv sync; cd ..       # python env; downloads torch (CPU) + kokoro
npm run vb -- doctor        # verifies everything, downloads the Kokoro model on first TTS
```

## CLI

```powershell
npm run vb -- create "Why databases use indexes" --slug database-indexes
#   → projects/database-indexes/manifest.json (starter; replace it)
npm run vb -- validate database-indexes      # schema only, instant
npm run vb -- compile  database-indexes      # TTS + alignment + anchor resolution
npm run vb -- render   database-indexes      # Remotion → output/final.mp4
npm run vb -- build    database-indexes      # compile + render + QA in one go
npm run vb -- qa       database-indexes      # re-run checks, regenerate contact sheet
npm run vb -- catalog                        # every pose/prop/sfx/voice the schema accepts
npm run vb -- render database-indexes --frames 0-90 --scale 0.5   # quick preview
npm run vb -- render database-indexes --nvenc                     # GPU encode
npm run vb -- publish  database-indexes      # upload latest version to GitHub Releases → public URL
npm run vb -- social   database-indexes      # (re)write output/v<N>/social.md: YouTube title/description/tags, TikTok/IG/FB captions
npm run vb -- brand                          # render brand/avatar.png, youtube-banner.png, facebook-cover.png from the rig
npm run vb -- publish --all                  # publish every unpublished version
npm run studio                               # Remotion Studio for the renderer
npm test                                     # unit tests
```

Only scenes whose text/voice/speed changed are re-synthesized on `compile`.

Every render is an immutable `output/v<N>/` (mp4, QA, contact sheet, manifest
snapshot). Renders are not committed; `vb publish` uploads a version as a
GitHub Release tagged `<slug>-v<N>` — see the
[Releases page](https://github.com/moamen270/video-builder/releases) for every
video ever rendered. The token comes from `GITHUB_TOKEN`, `gh auth token`, or the
credential git already stores for github.com.

## Agent interface (MCP)

`.mcp.json` registers the server for Claude Code automatically. Tools:
`video_catalog`, `video_read_skill`, `video_create_project`, `video_list_projects`,
`video_get_project`, `video_validate_manifest`, `video_write_manifest`,
`video_compile`, `video_render` (returns QA + contact sheet image),
`video_qa`, `video_contact_sheet`, `video_publish`, `video_social`, `video_doctor`, `video_logs`.

Skills in `.claude/skills/`: **2d-storytelling** (hooks, pacing, retention
devices, script → manifest) and **stickman-animation** (pose/prop/SFX vocabulary,
field reference). Any other MCP client (Codex, etc.) reads them via `video_read_skill`.

## Channel packaging

Dummy Sticky: [YouTube](https://www.youtube.com/@DummySticky) ·
[TikTok](https://www.tiktok.com/@dummysticky) ·
[Instagram](https://www.instagram.com/dummysticky) ·
[Facebook](https://www.facebook.com/DummySticky).

`brand.json` holds the channel identity (name, `@handle`, watermark on/off,
default hashtags); the handle is drawn on every frame. Each manifest carries a
`social` block (title, hook, description, tags, hashtags, pinned comment, cover
text) and every render writes `output/v<N>/social.md` with per-platform copy.
The pre-upload checklist is [docs/PRODUCTION.md](docs/PRODUCTION.md); results go
in `analytics/videos.csv`. Profile picture and channel covers are rendered from
the same stickman rig (`vb brand` → `brand/`; compositions in `renderer/src/brand/`),
so the artwork never drifts from the videos.

## The manifest DSL

The agent never writes numbers for time. Every visual is placed with an **anchor**:

```
start | end | word:<text>[#n] | word:<a>_<b>   optionally  +sec / -sec
"word:slow"  "word:every_single_row"  "word:the#2"  "end-0.4"
```

```jsonc
{
  "version": 1, "slug": "database-indexes", "title": "Why databases use indexes",
  "voice": "af_heart", "speed": 1.08, "theme": "midnight",
  "music": { "track": "lofi-01", "volume": 0.16 },
  "scenes": [{
    "id": "hook",
    "speech": "Your database query takes four seconds. Here's the one line that makes it instant.",
    "emphasis": ["four seconds", "instant"],
    "layout": "character_center",
    "character": { "pose": "shocked", "expression": "surprised",
                   "poseChanges": [{ "pose": "pointing_up", "expression": "smug", "at": "word:here's" }] },
    "props":  [{ "name": "clock", "at": "word:four", "until": "word:here's", "anim": "shake", "position": "above_character" }],
    "sfx":    [{ "name": "error", "at": "word:four" }],
    "camera": [{ "move": "punch_in", "at": "word:four" }],
    "bubbles": [{ "text": "4s?!", "at": "word:seconds", "until": "word:here's" }]
  }]
}
```

Full vocabulary: `npm run vb -- catalog` or `engine/src/schema/catalog.ts`.
Schema: `engine/src/schema/manifest.ts`. Compiled form the renderer reads:
`engine/src/schema/resolved.ts`.

## Project layout

```
engine/      CLI, Zod schemas, TTS bridge, resolver, render driver, QA, MCP server
renderer/    Remotion app: Short composition, stickman rig, captions, props, audio
py/          uv project: vb-audio (Kokoro synth + forced word timestamps)
assets/      sfx/ music/ (+ generate_assets.py to regenerate the built-in set)
.claude/     skills/ for Claude Code
projects/<slug>/
  manifest.json                   authored by the agent (committed)
  project.json                    status + topic
  build/alignment.json            word timings (committed)
  build/manifest.resolved.json    frame-exact compiled manifest (committed)
  build/audio/*.wav, build/assets audio staged for Remotion (ignored)
  clips/*.wav                     Bark laughs / user-provided audio for clip scenes (committed)
  output/v<N>/final.mp4, qa.json, contact.png, manifest snapshots   (ignored; one folder per render)
```

## Performance (GTX 1660 SUPER, 12-core CPU)

- TTS: ~13 s model load + ~2 s per scene, CPU.
- Render: 40 s video → ~60 s including webpack bundle. Chrome screenshotting is
  the bottleneck, not encoding; `--nvenc` helps only marginally.
- Loudness master (−14 LUFS) and QA: ~5 s.

## Extending

- New prop: add the name to `PROPS` in `catalog.ts` and an icon in `renderer/src/props/icons.tsx`.
- New pose: add to `POSES` and a rig in `renderer/src/characters/poses.ts`.
- New SFX/music: drop `name.wav|mp3` into `assets/sfx` or `assets/music` (SFX names must also be in `SFX`).
- New voice/language: Kokoro voices in `VOICES`; other languages need a different TTS in `py/vb_audio/tts.py`.

## Licensing notes

Private repo, no license file (see docs/DECISIONS.md D12). Remotion itself is
free for individuals and companies ≤ 3 people; larger teams need a company
license. Bundled SFX/music are procedurally generated (no third-party rights).
