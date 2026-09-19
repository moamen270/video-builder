---
name: video-review
description: Independent review of a rendered video version — builds the review pack (per-scene frame strips, facts, unit-style checklist), hands it to the video-reviewer subagent, and returns the report. Use after any render and before showing a version to Moamen, or when asked to "review", "QA like Moamen", or "second opinion" on a video. Usage: /video-review <slug> [version].
---

# Video review

Two layers, like tests: **unit checks** (one part at a time — hook, a scene's contact, a caption,
a voice) and **integration checks** (the whole story read muted, escalation, standard shape).
The maker never grades its own work: the review is done by the `video-reviewer` subagent from
the pack, not from memory of building the video.

## Steps

1. **Build the pack** — `video_review_pack` (MCP) or `npm run vb -- review <slug> [-v N]`.
   Output: `projects/<slug>/output/v<N>/review/` with
   - `scenes/NN-<id>.png` — 5 frames per scene, left→right in time (first, ≤3 event frames, last)
   - `summary.json` — per-scene facts: text + word timings, voice/fx/speaker, poses & changes, extras,
     props, SFX, bubbles, camera, overlays, projectiles; plus the checks and QA
   - `events/NN-<id>-<event>.png` — 7 frames at 2-frame spacing around every contact (hit/miss/strike/shot/throw)
   - `frames/tSSS.S.png` — every 0.5 s of the whole video as single images (for debugging by eye)
   - `checklist.md` — the checks as a table: **auto** rows decided, **👁️ check** rows point at strips,
     **ear** rows are for a human
2. **Run the reviewer** — `Agent` tool, `subagent_type: "video-reviewer"`, prompt:
   `Review projects/<slug>/output/v<N>/review/ and return the report from docs/REVIEW_TEMPLATE.md.`
   The subagent cannot write files: **save its returned report verbatim to `review/report.md`**.
   Do not pre-judge the result; if the `video-reviewer` type is not registered yet (new session
   needed), run `general-purpose` with `.claude/agents/video-reviewer.md` pasted as instructions.
3. **Relay the report** to the user: verdict, scores, the ranked fixes, and the `ear` items — quote
   the report, don't paraphrase the verdict. Then, if asked, apply the fixes as a **new version**
   and review again.
4. If the reviewer's verdict is FIX/REWORK and the maker disagrees with a finding, say so with
   evidence (a strip and frame) — never silently drop a finding.

## Report

`review/report.md`, from `docs/REVIEW_TEMPLATE.md`: verdict (SHIP / FIX / REWORK), 1–5 scores per
area, every check with evidence, integration notes (read muted, escalation, consistency, standard
shape), ranked fixes with the manifest change, "what Moamen would say" cross-checked against
`docs/LESSONS.md`, needs-an-ear list, open questions.

## Why strips, not the video

Small models cannot watch an MP4. Five frames per scene with the scene's facts beside them turn
"watch and judge" into "compare what should happen with what is drawn" — a check a small model
can do reliably, one part at a time.
