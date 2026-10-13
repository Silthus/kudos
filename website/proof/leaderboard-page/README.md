# The leaderboard page (#134)

WS37–WS46 and WS54, from a disposable local backend on `127.0.0.1:4210`/`4211` and the mock Slack issuer on `4212` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake.

## The flag override

`everyone-board` was on only on that local backend: the mock served it on for everyone with `MOCK_FLAGS_ON=everyone-board`, beside `website`, which the mock serves on. No PostHog project was read or written.

## The data

Twelve synthetic teammates and Juno, all in `Atlantic/Reykjavik`, were imported with `convex import` into `members`, `givenTotals` and `givenByDay` on that backend. The totals went straight into the board's own tables, so the home's counters, which read the kudos themselves, still say 0. Juno left the boards through one `leaderboardSettings` row and came back by replacing it. The open page followed each change through its subscription.

## Screenshots

| State | Light | Dark |
|---|---|---|
| Nobody ranked yet: one hedgehog, Max's sentence, one action to Slack | [empty-light.png](empty-light.png) | [empty-dark.png](empty-dark.png) |
| Juno at No. 9 of 13: the headline, the neutral podium with a tie at 3, the list from 6 with the `…` gap, Juno's ringed row with `You`, the private line, `No. 6–12 of 13` | [mid-board-light.png](mid-board-light.png) | [mid-board-dark.png](mid-board-dark.png) |
| The whole board scrolled to the top: Juno's row pinned to the bottom edge with `Jump to me`, and `Back to my spot` | [whole-board-jump-to-me-light.png](whole-board-jump-to-me-light.png) | [whole-board-jump-to-me-dark.png](whole-board-jump-to-me-dark.png) |
| Juno left the boards: `Off the board`, the deck's `off the board by choice`, the left line in place of a row, `No. 1–3 of 12`, the gain without places, `You're off the leaderboards.` | [left-light.png](left-light.png) | [left-dark.png](left-dark.png) |
| The home while the board is open: the Leaderboard nav item and the open link card above `Still locked` | [home-open-card-light.png](home-open-card-light.png) | [home-open-card-dark.png](home-open-card-dark.png) |

## In the browser

- Opening the whole board centred Juno's row (`scrollTop` 241.5 in a 416 px area). Scrolled to the top, the copy pinned to the bottom edge. `Jump to me` scrolled back to 241.5, focused Juno's row, and the copy went away.
- Tab from the avatar menu reached `This week`, ArrowRight `This month`, and Enter switched to `/leaderboard?period=month` without a reload.
- Choosing `All time` kept focus on `All time` while the next board loaded, and the page turned to `Ada Lindqvist leads all time.`.
- The nav's `Home` link moved to `/` in place, with one navigation entry in the page's history, and focused the home's title.

## Three bugs the running app caught

Each got a red test first ([red-sign-in-code.txt](red-sign-in-code.txt), [red-footer-for-a-viewer-off-the-board.txt](red-footer-for-a-viewer-off-the-board.txt), [red-period-switch-loading.txt](red-period-switch-loading.txt)):

1. The router rewrote `/?code=…` to `/` before Convex Auth's provider read the sign-in code, and sign-in came back unfinished. Only the leaderboard's period is rewritten now.
2. The footer read `No. undefined–undefined` for a viewer off the board, whose G17 window is the top three. It names the podium's positions now.
3. Switching the period dropped focus to the page body while the next board loaded. The page keeps the last board and focus on the switch until the next one arrives.

## Tests

- [red-website.txt](red-website.txt): the final `LeaderboardPage.test.tsx` and `accessibility.test.tsx` on the base tree `23e757f`: 48 fail.
- [green-website.txt](green-website.txt): the same files on the landed tree, every test passing and none skipped.
- The gate: [gate.txt](gate.txt).

## V24's manual pass

- **Focus order:** the HUD (wordmark, `Home`, `Leaderboard`, theme, avatar menu), then the period switch, then `Show the whole board`, or in the whole board the scroll area, `Jump to me` and `Back to my spot`. The pinned copy of the row is `aria-hidden`, so only its button is reached.
- **Focus visibility:** the period buttons and the footer's buttons keep Quill's focus ring; the scroll area and Juno's focused row show an inset ring.
- **Reduced motion:** nothing animates on the page (`document.getAnimations()` is empty). `Jump to me` scrolls smoothly, and instantly under reduced motion, as the tests assert.
- **Screen-reader wording:** each podium spot and list line starts with `Rank 3, tied:` and the like. The nav item reads `Leaderboard` with `aria-current="page"`. The period buttons carry `aria-pressed`. The board card is a heading, `Everyone`.
- **Contrast:** the selected period's border, Juno's ring and left edge, and the `You` label's border use the primary token, as the theme control's selection does. The pedestals and initials tiles are neutral, with their text in the foreground and muted foreground tokens.
