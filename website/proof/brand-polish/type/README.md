# #453 PR 1: RoundHog sets every word

Audit item 1 and 4 of [`../audit/README.md`](../audit/README.md).

## Tests

- [red.txt](red.txt): `brandType.test.tsx` (the stylesheet seam: the four brand faces, `--font-sans`, no Inter, the display tracking and the label metrics) and `displayTitles.test.tsx` (page titles at the brand's Bold, 800) on the tree before the change: 7 failing.
- [green.txt](green.txt): the same 7 passing after it, every assertion intact.

## In the browser

Chromium through the T3 preview, the `member-with-every-feature-open` fixture build on `vite preview`, after the change: `document.fonts` holds RoundHog at 400, 500, 700 and 800, all `loaded`; `body` computes to `RoundHog, -apple-system, …`; the page title computes to weight 800 with −0.9 px tracking at 36 px, which is what posthog.com's `h1` computes to. RoundHog's tabular figures hold: `1111` and `8888` both measure 40 px under `tabular-nums` (24 and 40 px without), so V5's table rule still holds.

| | Before | After |
|---|---|---|
| Home, 1280, light | [before](before-home-1280-light.png) | [after](after-home-1280-light.png) |
| Home, 1280, dark | [before](before-home-1280-dark.png) | [after](after-home-1280-dark.png) |
| Leaderboard, 390, light | [before](before-leaderboard-390-light.png) | [after](after-leaderboard-390-light.png) |

## Review

[review-gpt-6.1-sol.md](review-gpt-6.1-sol.md): GPT-6.1 Sol, round 1, no high findings.

1. Moment headlines in `crates/RevealDialog.tsx` stay at `font-bold` (700). **Rejected here**: `website/src/crates/` belongs to the loot-crate lane #452; passed on as a follow-up for that lane.
2. `font-mono` stays on code, paths and keyboard hints. **Rejected**: posthog.com keeps a monospace face for code too (Source Code Pro); V5 now names the monospace stack as the one other face.
3. Nav entries at 400 on phones with the current one at 500. **Rejected**: that is the accepted design from #269 (Fable finding 6); V5 now says Medium 500 is for emphasis such as the current entry.
4. The level-up headline tracked at −0.02em. **Fixed**: −0.025em in `levelUp/levelUp.css`.
5. Two leaderboard tests still titled "in Inter". **Fixed**: retitled to the body face.
