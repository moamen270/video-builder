# Reference voices for `engine: "chatterbox"`

Each file is > 5 s of clean speech that fixes *who* speaks when a scene uses Chatterbox (`voiceRef: "<name>.wav"`).
A project may also keep its own references in `projects/<slug>/clips/` (looked up first).

| file | origin | licence | character notes |
|---|---|---|---|
| `lewis.wav` | Kokoro `bm_lewis` lines concatenated (11.9 s) | Apache-2.0 output — ours | deepest base; Batman-region (comes back ~95–130 Hz, add `voiceFx: growl` for depth) |
| `george.wav` | Kokoro `bm_george` (8.1 s) | ours | refined British; Jhin base with `voiceFx: mask` |
| `puck.wav` | Kokoro `am_puck` (10.9 s) | ours | mid male, dry; Robin / Pebble base with `voiceFx: young` |
| `heart.wav` | Kokoro `af_heart` (9.5 s) | ours | default female narrator |
| `michael.wav` | Kokoro `am_michael`, three commentary lines (18.9 s) | ours | sports commentator (dodgeball) with `voiceFx: theatre`; emotion 0.35 deadpan → 0.9 at the knockout |

Rules (docs/08-legal.md in the `audios` repo): never a real person's recording without written consent; never a game or film rip.
Adding one: 6–15 s, 24 kHz mono, no music/SFX/reverb (FX are applied after synthesis), one speaker, add a row here.
Keep `emotion` ≤ 0.5 for deep voices — higher values raise the pitch of every reference (measured in audios/experiments/002-chatterbox).
