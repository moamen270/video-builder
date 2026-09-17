---
name: 2d-storytelling
description: Write the script and scene plan for a 30–55 s vertical stickman explainer (YouTube Shorts / TikTok / Reels). Use when asked to make, script, or plan a short video with video-builder. Covers hooks, pacing, structure, retention devices and how to turn the script into a manifest.
---

# 2D storytelling for Shorts

You are writing a **manifest.json** for the video-builder engine. You never write
code or timings — you write what the narrator says, what the stickman does, and
which props/SFX land on which *word*. The engine synthesizes the voice, measures
every word, and animates to it.

Workflow: `video_catalog` → draft script → `video_create_project` →
`video_validate_manifest` → `video_write_manifest` → `video_compile` (read the
exact word list back, fix anchors) → `video_render` → look at the contact sheet →
iterate. Read `stickman-animation` for the visual vocabulary.

## Two formats

- **Explainer** (database-indexes): the structure in "Structure that retains" below.
- **Character short** (Wolverine, Jhin, Batman — the Dummy Sticky channel): one
  character, one obsession, one payoff. Structure: **cold open on the action →
  text hook → 3–5 escalating beats → payoff → one CTA**. The character is deadpan
  and serious about something trivial; the joke is never in his lines.

## The first 3 seconds (both formats — this is where Shorts die)

- Frame 0 must already show the interesting thing: claws out, gun raised, the hero
  mid-fall, the target on screen. No idle stickman, no walk-on, no "Everyone thinks…".
- First spoken line = threat, number or payoff, ≤ 8 words. Introductions go second or nowhere.
- Give `social.hook` (3–8 words) — it is the on-screen/caption hook and must work muted.
- Add `overlays: [{ "kind": "hook_card", "text": "<the hook>", "at": "start", "until": "start+1.3" }]`
  on the opening scene, and a strike/shot/prop/entrance/SFX inside the first second. `video_compile` warns
  ("weak hook") if the opening scene is > 2.5 s with nothing happening in its first second — fix it, don't ignore it.
- Write 2–3 alternative hooks in `notes` so the next version can A/B them.

## CTA — exactly one

Last ~2 s, after the payoff, one ask: "Follow Dummy Sticky for more." / "Comment who
he should go after next." / "Part 2 is coming — follow so you don't miss it."
Pose `waving` or `pointing_up`, `happy`/`smug`. Never two asks. The character speaks the
line in his own voice (a sidekick relaying it is fine: "Batman says: follow Dummy Sticky for
more!"); scene has `"captions": false` and `overlays: [{ "kind": "follow_card", "at": "word:follow" }]`.
The comment question goes in `social.pinnedComment`.

## Packaging (`social` block — required)

Every manifest carries its upload copy so `video_render` writes `output/v<N>/social.md`:
```jsonc
"social": {
  "title": "Wolverine vs Watermelons 🍉 \"They know what they did.\"",   // ≤ 100, hook first
  "hook": "He takes watermelons personally.",                             // 3–8 words, works muted
  "description": "First line = what the feed shows.

What happens, what to wait for.

Follow Dummy Sticky …",
  "tags": ["wolverine", "stickman animation", "…"],                        // no #, specific first, 15–25
  "hashtags": ["#shorts", "#wolverine", "#stickman", "…"],                 // first 3 show above the YouTube title
  "pinnedComment": "Who should he go after next?",
  "coverText": "THEY KNOW WHAT THEY DID"
}
```
Compile warns when `social` is missing. Regenerate after edits with `video_social`.

## Length & pacing

- Target **35–45 s**. Hard cap 60 s. Speech at `speed` 1.05–1.12 ≈ **2.8 words/s**,
  so 40 s ≈ 110 words. Count words before compiling.
- 6–9 scenes. One idea per scene, 8–20 words each. A scene longer than ~7 s
  feels static no matter what the stickman does.
- Vary rhythm: follow a 6 s explanation with a 2–3 s punch ("Nobody does that.").
- `pauseAfter` 0.2–0.35 normally; 0.5–0.7 after the hook and before the CTA.

## Structure that retains

1. **Hook (0–3 s)** — a concrete pain, number or contradiction. Never "In this
   video…" or "Today we'll…". Patterns that work:
   - Stakes-first: *"Your query takes four seconds. Here's the one line that fixes it."*
   - Contradiction: *"Adding more servers made this site slower."*
   - Curiosity gap: *"There's a reason your password is hashed twice."*
   - Challenge: *"Bet you can't explain what an index is in one sentence."*
   Use `layout: character_center`, a big expression (`shocked`/`surprised`),
   a `punch_in` camera cue and one loud SFX (`error`, `boom`, `glitch`).
2. **Problem (3–12 s)** — what goes wrong and why, in the viewer's language.
3. **Analogy (12–20 s)** — one physical, everyday comparison. Book/index,
   restaurant/queue, mail/address. Stickman uses `presenting`/`shrugging`.
4. **Mechanism (20–32 s)** — how it actually works. Props pop in *on the noun*.
5. **Numbers or proof (32–38 s)** — a `caption_only` scene with 1–2 stats.
   Pattern interrupt: no stickman, `zoom` transition, `boom` SFX.
6. **The catch (38–45 s)** — the trade-off. Builds trust; use `thinking` → `explaining`.
7. **CTA (last 3–4 s)** — one ask, tied to value: *"Follow for one backend
   concept a day."* `waving` → `celebrating`, `heart` prop.

## Retention devices (use 3–5 per video)

- **Open loop** in the hook, closed in scene 5 or 6.
- **Pattern interrupt** every ~12 s: layout change, `caption_only` scene,
  `slide`/`wipe` transition, or the bubble (`"?!"`, `"WAIT"`, `"10x"`).
- **Countable beats**: "Every. Single. Row." — put a `tick` SFX and a prop
  drop on each word.
- **Callback**: reuse the hook's prop in the payoff scene (clock → rocket).
- **Direct address**: "you", "your" — at least once per scene.
- **Number on screen**: put figures in `emphasis` so they render in accent colour.
- **Silence**: a 0.5 s `pauseAfter` right before the answer.

## Writing the speech field

- Spoken English, contractions, no semicolons. TTS reads punctuation: `.` = full
  stop pause, `,` = short pause, `?` = rising tone, `!` = energy. Use them deliberately.
- Write numbers as words when they must be spoken ("ten million"), digits when
  they are visual ("10x" — the engine will say "ten x").
- Avoid words the TTS may mangle: unusual acronyms (write "sequel" or "S Q L"),
  code symbols, long URLs.
- `emphasis` phrases must appear verbatim in `speech` (case-insensitive).
  2–3 per scene, the nouns and numbers that carry the idea.

## Anchors — the timing language

Everything visual is placed with an anchor, never a number:
`"start"`, `"end"`, `"end-0.4"`, `"word:index"`, `"word:the#2"`,
`"word:every_single_row"` (phrase), `"word:slow+0.15"`.
Anchor to the **first word of the concept**, not the last: the prop should be
on screen as the word is spoken. After `video_compile`, copy anchors from the
returned `words` list — it is the exact tokenization (punctuation is attached,
e.g. `"row."`, but anchors ignore punctuation and case).

## Checklist before `video_render`

- [ ] Hook is a concrete pain/number/contradiction in ≤ 12 words
- [ ] ≤ 120 words total, 6–9 scenes, one `caption_only` scene
- [ ] Every scene > 3 s has a pose change; hook and CTA have a camera or bubble cue
- [ ] Every prop is anchored to the noun it depicts; every prop entrance has an SFX
- [ ] `emphasis` covers the numbers and the key nouns
- [ ] CTA asks for exactly one thing
- [ ] `video_compile` total ≤ 50 s with no anchor warnings and no "weak hook" warning
- [ ] `social` block present; hook works with the sound off; exactly one CTA
- [ ] Walk `docs/PRODUCTION.md` before the video is uploaded
