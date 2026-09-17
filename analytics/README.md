# Performance tracking

`videos.csv` — one row per video × platform × checkpoint (24 h, 72 h, 7 d).
Fill from YouTube Studio (Shorts: *Viewed vs swiped away* = `retention_3s_pct`,
*Average view duration*, *Watched full video %*), Instagram Insights, Facebook
Professional dashboard, TikTok Analytics. Leave a cell blank if the platform
does not expose the number.

Primary metric while the hook is the known weakness: `retention_3s_pct`.
Secondary: `completion_pct`, then `followers_gained` per 1000 views.

Keep the format constant for 10–20 videos before changing more than one
variable (hook style, length, character) — see `docs/PRODUCTION.md` §8–9.
