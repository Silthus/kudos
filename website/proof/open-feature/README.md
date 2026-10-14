# The website's first command: open a ready feature (#144)

WS61–WS64, from a disposable local backend on `127.0.0.1:4610`/`4611` and the mock Slack issuer on `4612` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake, and every website call below went out from that browser tab with its own session token, as the site's client sends it.

## The flag override

`everyone-board`, `xp-levels` and `unlocks` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=everyone-board,xp-levels,unlocks`, beside `website`, which the mock serves on. `KUDOS_ENVIRONMENT` was `sandbox`. No PostHog project was read or written.

## The steps

1. **The launch, before anyone joined.** `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know recorded the workspace's one `unlockLaunches` row, `shipped: ["leaderboard"]`.
2. **Locked.** Juno signed in at level 1, and the home showed the Leaderboard under `Still locked`. `openFeature({ feature: "leaderboard" })` from the tab answered `refused`; the same call with no session answered `signed-out`.
3. **Ready.** Unlocks' own `makeReady` ran with a `levelReached` event for level 3, so the Leaderboard became ready and App Home was published with its crate: [app-home-before.txt](app-home-before.txt) reads `*Leaderboard* is ready. It opens the boards. | [Open]`. The open home moved the card to `Ready for you` without a reload. The event stands in for the XP a level needs, so the profile still reads level 1.
4. **Opened on the website.** `openFeature({ feature: "leaderboard" })` from the tab answered `opened`. The home moved the card to `Open` and the nav gained `Leaderboard`, through its subscription. App Home was republished without the crate and with its Leaderboard tab: [app-home-after.txt](app-home-after.txt).
5. **A second open** answered `opened` again, and the `unlocks` row kept its first `openedAt` (WS63).
6. **A member named beside the feature** was rejected by the argument validator before any handler ran (WS61).
7. **No second launch.** `unlockLaunches` still held the one row from step 1.

The answers are in [run.json](run.json). The mock recorded each `views.publish` and answered it at `GET /control/home?user=U_JUNO`, a small addition to `mockSlackIssuer.ts` for this proof.

## Screenshots

| State | Light | Dark |
|---|---|---|
| Ready: the Leaderboard under `Ready for you`, before the website's open | [home-ready-light.png](home-ready-light.png) | [home-ready-dark.png](home-ready-dark.png) |
| Opened on the website: the Leaderboard under `Open` and in the nav | [home-opened-light.png](home-opened-light.png) | [home-opened-dark.png](home-opened-dark.png) |

The site has no `Open` button yet: #145 adds the crate and calls this command from it.

## Tests

- [red-convex.txt](red-convex.txt): `convex/website/commands.test.ts` and `convex/publicSurface.test.ts` on the tree before the change: 22 of 22 fail, `openFeature` is missing.
- [green.txt](green.txt): the same files on the landed tree, verbose, none skipped.
- The gate: [gate.txt](gate.txt).
- Coherence, in `convex/website/WebsiteReads.spec.md`, each refuted, restored and green batched and alone:
  - *website commands pass one guard*, refuted by reading the website flag through the seam's writing path: the call with a flags key but no workspace key made a key and answered `refused` instead of `closed`;
  - *a website command never launches unlocks*, refuted by dropping WS55's gate: the unlaunched workspace recorded the launch;
  - *a website command is a D17 command*, refuted by answering `opened` without reading Unlocks' state: the locked and the unshipped feature answered `opened`;
  - *opening on the website grants nothing*, refuted by giving 10 XP on open.

## Review

One read-only GPT-6.1 Sol (high) review over the diff, with the spec as the oracle: [review-gpt-6.1-sol.txt](review-gpt-6.1-sol.txt).
