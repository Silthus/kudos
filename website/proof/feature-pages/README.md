# The Skill tree and Book pages follow their unlock (#186)

WS78–WS82, from a disposable local backend on `127.0.0.1:5010`/`5011` and the mock Slack issuer on `5012` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake.

## The flag override

`everyone-board`, `xp-levels`, `unlocks` and `skill-tree` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=everyone-board,xp-levels,unlocks,skill-tree`, beside `website`, which the mock serves on. No PostHog project was read or written. The Book has no ship flag on `main` yet (#171), so `/book` stays the not-found page in the running app, and its locked, ready and open states are proven in the browser tests from typed fixtures.

## The steps

1. **The launch, before anyone joined.** `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know recorded the workspace's one `unlockLaunches` row with `shipped: ["leaderboard", "skillTree"]`. Nobody was a member yet, so P77 kept nothing open.
2. **Locked.** Juno signed in at level 1. `/skills` showed Max's `Skill tree opens at level 5.` with `Go to Home`, and the screen nav held only `Home`. `/leaderboard`, through the same shared frame, still read `Leaderboard opens at level 3.`
3. **Ready.** One `unlocks` row `{ member, feature: "skillTree", readyAt }` was imported for Juno while `/skills` was open. The page turned into the Skill tree's crate with a primary `Open` through its subscription, without a reload, and focus moved to the page title. Juno's XP stayed at level 1: the row stands in for the level-5 readiness that `makeReady` writes, which the `convex-test` seam covers.
4. **Opened in place.** `Open` ran the guarded `openFeature`. The reveal ended on `Go to Skill tree`, and behind it the page became the interim open page: the Skill tree's hedgehog, `Skill tree is open. Find it in Slack's App Home.` and one `Open Slack`. The nav gained `Skill tree`, and the home's open card linked to `/skills` with `Spend skill points on perks you choose.`
5. **Not shipped.** `/book` was the not-found page.
6. **No website launch.** After every read, `unlockLaunches` still held the one row from step 1.

## Screenshots

| State | Light | Dark |
|---|---|---|
| `/skills` locked: Max says it opens at level 5, with `Go to Home` | [skills-locked-light.png](skills-locked-light.png) | [skills-locked-dark.png](skills-locked-dark.png) |
| `/skills` ready: the crate in place with a primary `Open` | [skills-ready-light.png](skills-ready-light.png) | [skills-ready-dark.png](skills-ready-dark.png) |
| The reveal ends on `Go to Skill tree` | | [skills-reveal-dark.png](skills-reveal-dark.png) |
| `/skills` open, until #188: the sentence and `Open Slack`, with the `Skill tree` nav item | [skills-open-light.png](skills-open-light.png) | [skills-open-dark.png](skills-open-dark.png) |
| The home's open Skill tree card | [home-open-light.png](home-open-light.png) | |
| `/book` while the Book hasn't shipped | [book-not-found-light.png](book-not-found-light.png) | |
| `/leaderboard` locked, through the shared frame | [leaderboard-locked-light.png](leaderboard-locked-light.png) | |

## Tests

- [red.txt](red.txt): the final browser and `convex-test` files on the integration tip before the change (`00356d1`), with the fixtures in place: 19 fail, the routes, pages, nav, home cards, `Go to`, and the Book's sentence. The new `convex-test` cases for the Skill tree's entry beside the leaderboard pass there too: `getMyProfile` already carried the entry, and they pin that `featurePageOf` changes none of the leaderboard's answers.
- [green.txt](green.txt): the same files on the landed tree, verbose, none skipped.
- The gate: [gate.txt](gate.txt).
- The landing tree merges `origin/spec/website-3` at `9054f3c` (ship #151's review fixes). Its plain names now live once in `features.ts`, and the Book's plain name there is `Book` (WS82).

## Review

One read-only GPT-6.1 Sol (high) review over the diff, with the spec as the oracle: [review-gpt-6.1-sol.txt](review-gpt-6.1-sol.txt). No findings in scope.
