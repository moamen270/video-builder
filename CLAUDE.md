# video-builder — notes for Claude Code

Purpose: compile a JSON manifest into a 1080x1920 stickman Short. You author
manifests; the engine does TTS, timing, rendering and QA. Read
`.claude/skills/2d-storytelling/SKILL.md` before writing a manifest and
`.claude/skills/stickman-animation/SKILL.md` for the visual vocabulary.

## Making a video (MCP tools are preferred; CLI equivalents in README)
1. `video_catalog` → know the allowed poses/props/sfx/voices.
2. `video_create_project` → `video_write_manifest` (validate first).
3. `video_compile` → read back exact words + per-scene seconds; fix anchors.
4. `video_render` → inspect QA checks and the contact-sheet image; iterate.
Only changed scenes are re-synthesized; a full render is ~1 min per 40 s.
Every render is a NEW `output/v<N>/` (mp4, qa, contact sheet, manifest
snapshot). Never delete or overwrite a version — Moamen compares them.
Laughter/screams: never TTS "ha ha"; use a `clip` scene with a Bark-generated
wav (`vb-audio laugh`) or a file the user provides.

## Repo rules
- Never hand-edit `projects/*/build/manifest.resolved.json` — it is generated.
- The LLM-facing vocabulary lives in `engine/src/schema/catalog.ts`. Adding a
  prop/pose/sfx = add it there AND implement it in `renderer/src/...`.
- Timing is anchors only (`word:foo`, `start`, `end-0.3`). Never add numeric
  frame/second fields to the authored schema.
- Python side is `py/` (uv). Run with `uv run --project py vb-audio ...`.
  Never print data to stdout in `vb_audio` — third-party libs pollute it; write files.
- Windows: ffmpeg/uv are on the user PATH from winget. If a shell can't find
  them, it predates the install — open a new one.
- Tests: `npm test` (vitest, engine only). Typecheck: `npm run typecheck`.
- zod is pinned to 4.5.4 via root `overrides` because Remotion requires that exact version.
