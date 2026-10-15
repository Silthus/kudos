# Browser measurements at 320 px (from the GPT-6.1 Sol review's nit)

Read with `preview_evaluate` in Chromium at a 320 × 700 viewport on the fixture builds, after the review's `wrap-anywhere` fix.

| Page | `document.documentElement.scrollWidth` | `window.innerWidth` | Measured |
|---|---|---|---|
| Home, `member-level-7-with-one-skill-point` (`after-home-320-light.png`) | 320 | 320 | the face-and-ring row is `display: flex`, 252 × 120 px, inside the 288 px content width |
| Leaderboard, `member-with-every-feature-open` (`after-leaderboard-320-light.png`) | 320 | 320 | the "Everyone" heading spans x 85 to 203.5; the standing is 71.5 px wide and starts at about 232, so nothing collides |

At 390 px the same pages are `after-home-390-*.png` and `after-leaderboard-390-*.png`; `scrollWidth` equalled `innerWidth` there in the audit's run too (WS300). The 639 / 640 px edge is Tailwind's own `sm` breakpoint, which the structural tests pin through the `sm:contents` and `sm:flex-row` classes.
