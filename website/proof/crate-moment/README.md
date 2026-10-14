# The crate moment and the ready pill (#145)

WS65–WS68 and WS75. The app ran on a disposable local backend on `127.0.0.1:4710`/`4711` with the mock Slack issuer on `4712` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake, and every open below was a click or a key press in that browser tab.

## The flag override

`everyone-board`, `xp-levels` and `unlocks` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=everyone-board,xp-levels,unlocks`, beside `website`, which the mock serves on. `KUDOS_ENVIRONMENT` was `sandbox`. No PostHog project was read or written.

## The steps

1. **The launch, before anyone joined.** `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know recorded the workspace's one `unlockLaunches` row, `shipped: ["leaderboard"]`.
2. **Locked.** Juno signed in at level 1, and the home showed the Leaderboard under `Still locked`, with no ready pill.
3. **Ready.** Unlocks' own `makeReady` ran with a `levelReached` event for level 3. Without a reload, the home moved the Leaderboard to `Ready for you` as a closed crate with an outline `Open`, and the HUD gained `1 ready`. App Home was published with its crate: [app-home-before.txt](app-home-before.txt).
4. **Opened from the crate.** `Open` sent `openFeature`. The reveal played only after `opened`, and the home behind it had already moved the Leaderboard to `Open`, with a nav item. The end state showed `Level 3 unlock`, `Leaderboard is open`, `It opens the boards.`, `Go to Leaderboard`, `Done` and `Replay`, and the live region said `You opened Leaderboard.`. App Home was republished without the crate and with its Leaderboard tab: [app-home-after.txt](app-home-after.txt).
5. **The ready page in place.** With the `unlocks` row set back to ready (`convex import --replace`), `/leaderboard` showed the crate with a primary `Open` in place of WS52's sentence. This browser had seen the crate, so `Open` showed the end state at once with `Replay`, and the board loaded behind it. `Done` moved focus to the board's title (`H1`). The browser kept only `hedgehug.seen.<32 hex>`, no ID.
6. **Opened from the pill.** With the seen key cleared and the row ready again, `1 ready` sent the same command, and the full reveal played. `Done` returned focus to the open Leaderboard card, and the pill was gone.

## Screenshots

| State | Light | Dark |
|---|---|---|
| The home's closed crate and the `1 ready` pill | [home-crate-light.png](home-crate-light.png) | [home-crate-dark.png](home-crate-dark.png) |
| The reveal playing | [home-reveal-playing-light.png](home-reveal-playing-light.png) (lid lifting, opened from the pill) | [home-reveal-playing-dark.png](home-reveal-playing-dark.png) (crate shaking) |
| The reveal's end state | [home-reveal-end-light.png](home-reveal-end-light.png) | [home-reveal-end-dark.png](home-reveal-end-dark.png) |
| `/leaderboard` ready, the crate in place | [leaderboard-ready-light.png](leaderboard-ready-light.png) | [leaderboard-ready-dark.png](leaderboard-ready-dark.png) |
| `/leaderboard` opened by a member who had seen it: the end state at once, the board behind it | | [leaderboard-reveal-seen-dark.png](leaderboard-reveal-seen-dark.png) |

The first dark end state showed the rising hedgehog over `Level 3 unlock`. The crate got headroom above it, and every end state here is from the build with that fix. The review's fixes below change behaviour only, so the tests prove them.

## V24's manual pass

- **Focus order:** on the home, `Open` is the last stop, after the hero and the counters. Enter opened the crate, and focus moved into the dialog.
- **Focus visibility:** `Open` and the open card after `Done` each matched `:focus-visible` when reached by keyboard.
- **Focus return:** to the open card on the home, and to the page title on `/leaderboard`.
- **Screen-reader wording:** the dialog is named `Level 3 unlock`, and the live region read `You opened Leaderboard.`. The pill's name is `1 ready`, and the crate art is hidden from assistive technology.
- **Reduced motion:** the preview browser can't emulate `prefers-reduced-motion`. The tests prove it: the dialog opens on its end state and is marked for the fade. The CSS holds motion under `no-preference` only, and caps the fade at 200 ms.
- **Contrast:** text on the scrim is white on `--band-night` at 96%. The crate art outlines are `--band-night` on tangerine and lemon. Both are well past 3:1 and 4.5:1 by eye. axe runs with color-contrast off in jsdom.

## Tests

- [red-website.txt](red-website.txt): `website/src/crateMoment.test.tsx` on the tree before the change. 27 of 29 fail. The 2 that pass guard what must not change: no pill while unlocks don't apply, and the locked page keeps WS52's sentence.
- [red-review.txt](red-review.txt): the 6 tests that reproduce the review's findings, failing before their fixes.
- [green.txt](green.txt): the crate tests, axe in light and dark for every crate state, and the edited older tests, on the final tree. 191 pass, none skipped.
- The gate: [gate.txt](gate.txt).

## Review

One read-only GPT-6.1 Sol (high) review over the diff, with the spec as the oracle: [review-gpt-6.1-sol.txt](review-gpt-6.1-sol.txt). It found no blocker, three majors and two minors, and every one holds:
1. Two answers that arrive together now queue, each with its own first reveal.
2. A sign-out drops the moment state and any answer still in flight.
3. Replay under reduced motion keeps focus in the dialog.
4. The crate stops nudging once opening starts, and stays still after an error.
5. A modified click on `Go to` keeps the dialog open.
