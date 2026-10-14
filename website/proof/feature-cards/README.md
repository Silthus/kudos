# The home's feature cards read their unlock state (#143)

WS55–WS60, from a disposable local backend on `127.0.0.1:4510`/`4511` and the mock Slack issuer on `4512` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake.

## The flag override

`everyone-board`, `xp-levels`, `unlocks` and `skill-tree` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=everyone-board,xp-levels,unlocks,skill-tree`, beside `website`, which the mock serves on. `KUDOS_ENVIRONMENT` was `sandbox`. No PostHog project was read or written. `skill-tree` was on so the home shows a second shipped feature, one without a web page.

## The steps

1. **The launch, before anyone joined.** `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know recorded the workspace's one `unlockLaunches` row with `shipped: ["leaderboard", "skillTree"]`, as Slack's own mutation does. Nobody was a member yet, so P77 kept nothing open.
2. **Locked.** Juno signed in at level 1. `Still locked` held the Leaderboard (`Unlocks at level 3`) and the Skill tree (`Unlocks at level 5`), each with its sentence and no progress. The four features that haven't shipped had no card. The nav held only `Home`.
3. **Ready.** One `unlocks` row with `readyAt` was imported for the Leaderboard while the home was open. The page moved it to `Ready for you`, reading `Ready for you. Open it in Slack's App Home.`, through its subscription, without a reload. The row stands in for the level-3 readiness that `makeReady` writes, which the `convex-test` seam covers.
4. **Opened.** The row was replaced with `openedAt` set. The Leaderboard moved to `Open` as a link to `/leaderboard`, and the nav gained `Leaderboard`.
5. **Open without a web page.** An opened Skill tree row was added. Its card read `Open. Find it in Slack's App Home.` with `Open Slack`, and the nav stayed `Home` and `Leaderboard`.
6. **No second launch.** After every read, `unlockLaunches` still held the one row from step 1.

## Screenshots

| State | Light | Dark |
|---|---|---|
| Locked: both shipped features under `Still locked` with their levels, nothing unshipped | [home-locked-light.png](home-locked-light.png) | [home-locked-dark.png](home-locked-dark.png) |
| Ready: the Leaderboard under `Ready for you`, the Skill tree still locked | [home-ready-light.png](home-ready-light.png) | [home-ready-dark.png](home-ready-dark.png) |
| Opened: the Leaderboard under `Open` and in the nav | [home-opened-light.png](home-opened-light.png) | [home-opened-dark.png](home-opened-dark.png) |
| Both open: the Skill tree points to Slack's App Home | [home-every-open-light.png](home-every-open-light.png) | [home-every-open-dark.png](home-every-open-dark.png) |

## Tests

- [red-convex.txt](red-convex.txt): `convex/website/features.test.ts` on the tree before the change: 17 of 17 fail, `features` is missing.
- [red-website.txt](red-website.txt): `website/src/FeatureCards.test.tsx` on the tree before the change, with the fixtures in place: the 5 new card-group tests fail. The nav and WS19 tests pass on both trees and pin what must not change.
- [green.txt](green.txt): the same files on the landed tree, verbose, none skipped.
- The gate: [gate.txt](gate.txt).
- Coherence: *the website's feature states are Unlocks' facts* (refuted by reading every feature as locked) and *the website shows only shipped features* (refuted by listing every scheduled feature) in `convex/website/WebsiteReads.spec.md`, each restored and green, batched and alone.

## Review

One read-only GPT-6.1 Sol (high) review over the diff, with the spec as the oracle: [review-gpt-6.1-sol.txt](review-gpt-6.1-sol.txt). No findings at any severity.

## Manual pass (V24)

On the fixture build (`VITE_SHELL_FIXTURE=member-with-every-feature-open`), Tab after the profile card reaches the Leaderboard's Open card and then the Skill tree's `Open Slack`, in reading order, each `:focus-visible` with its ring showing. Locked hedgehogs are decorative silhouettes (`aria-hidden`); the outline `Open Slack` border is visible in both modes. Nothing moves, so reduced motion changes nothing here.
