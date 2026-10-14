# The leaderboard page follows its unlock (#137)

WS52 and WS53, from a disposable local backend on `127.0.0.1:4310`/`4311` and the mock Slack issuer on `4312` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake.

## The flag override

`everyone-board`, `xp-levels` and `unlocks` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=everyone-board,xp-levels,unlocks`, beside `website`, which the mock serves on. No PostHog project was read or written.

## The steps

1. **The launch, before anyone joined.** `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know recorded the workspace's one `unlockLaunches` row with `shipped: ["leaderboard"]`, as Slack's own mutation does. Nobody was a member yet, so P77 kept nothing open.
2. **Locked.** Juno signed in at level 1. The home's Leaderboard card stayed locked with `Leaderboard opens at level 3.`, the screen nav held only `Home`, and `/leaderboard` showed Max's page with the same sentence and `Go to Home`.
3. **Ready.** One `unlocks` row with `readyAt` was imported for Juno while `/leaderboard` was open. The page turned to `Leaderboard is ready for you. Open it in Slack's App Home.` with `Open Slack` through its subscription, without a reload. The home's card carried the same sentence. Juno's XP stayed at level 1: the row stands in for the level-3 readiness that `makeReady` writes, which the `convex-test` seam covers.
4. **Opened.** The row was replaced with `openedAt` set. The `Leaderboard` nav item appeared on the open home, and it led to the board (WS37–WS46).
5. **No second launch.** After every read, `unlockLaunches` still held the one row from step 1.

## Screenshots

| State | Light | Dark |
|---|---|---|
| The home while the Leaderboard is locked: the locked card with its level, no nav item | [home-locked-light.png](home-locked-light.png) | [home-locked-dark.png](home-locked-dark.png) |
| `/leaderboard` while it is locked: Max says it opens at level 3, with `Go to Home` | [leaderboard-locked-light.png](leaderboard-locked-light.png) | [leaderboard-locked-dark.png](leaderboard-locked-dark.png) |
| `/leaderboard` once it is ready, on the same open page: Max says to open it in App Home, with `Open Slack` | [leaderboard-ready-light.png](leaderboard-ready-light.png) | [leaderboard-ready-dark.png](leaderboard-ready-dark.png) |
| The home while it is ready: the locked card with the ready sentence | [home-ready-light.png](home-ready-light.png) | [home-ready-dark.png](home-ready-dark.png) |
| Opened: the `Leaderboard` nav item and the board | [leaderboard-opened-light.png](leaderboard-opened-light.png) | [leaderboard-opened-dark.png](leaderboard-opened-dark.png) |

## Tests

- [red-convex.txt](red-convex.txt): the final `convex/website/leaderboard.test.ts` on the tree before the change. The locked and ready members read the board: 2 of 43 fail. The other WS52 tests pin what must not change: WS30's answer while unlocks don't apply, the opened and grandfathered members, and the row on another member's board.
- [red-website.txt](red-website.txt): the final browser tests on the tree before the change, with the fixtures in place: the 5 WS52 page and home-card tests fail.
- [green.txt](green.txt): the same files on the landed tree, verbose, none skipped.
- The gate: [gate.txt](gate.txt).
- Coherence: *the website's leaderboard waits for its unlock* in `convex/website/WebsiteReads.spec.md`, refuted by answering `open` for every shipped state while unlocks apply (the locked and ready members read the board), then restored and green.

## Review

One read-only GPT-6.1 Sol (high) review over the diff, with the spec as the oracle: [review-gpt-6.1-sol.txt](review-gpt-6.1-sol.txt). No blocker, major or nit findings; two minors, both fixed:

1. **Fixed (minor, WS24 via WS54):** focus fell to the page body when a ready leaderboard opened under the open page, because the focus hook watched only the profile's kind. It now also watches the board answer's kind on the leaderboard page, and still leaves focus alone on first load and while the next period loads. Red: [red-review-focus.txt](red-review-focus.txt).
2. **Fixed (minor, test seam 4a):** the `xp-levels`/`unlocks` matrix lacked three combinations. It now covers every on/off pair before and after the launch, each asserting both reads.
