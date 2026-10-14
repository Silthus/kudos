# Part A on the sandbox: the unlock path (#146)

WS55–WS68, WS76, WS77 and WS27, on the shared sandbox. This ticket deployed `spec/website-3` at `f3481bc` to the sandbox at 2026-10-14T02:07Z, right before the proof. That tree already holds `main` at `0c40c11`, and #138 had not merged the second slice to `main` yet. Nothing was deployed to production, and no flag's targeting changed. No product code changed: this folder is the proof.

## The deploy

[`sandbox-deploy.txt`](sandbox-deploy.txt) holds the deploy workflow's four commands, run by hand: `convex deploy`, `static-hosting upload --build`, `prepareWebsiteFlag` and `syncCompanyProfiles`. All four exited 0. The sandbox's env was left as it was.

The schema push passed, so no sandbox data was cleared or migrated. It did remove 11 indexes on tables this tree's schema doesn't declare (`questDraws`, `journeySteps`, `crateOpenings` and others). Map #1's quests lane had deployed its branch over the sandbox after #136, and this deploy replaced it, as every hand deploy replaces the last one. Those tables' rows stay. The quests lane's next deploy rebuilds its indexes.

## The flags answer on in the sandbox and off in production

- [`flag-definitions.txt`](flag-definitions.txt): `website` (957148), `everyone-board` (956734), `xp-levels` (956733) and `unlocks` (956771), as each deployment had them cached. Each has one condition, `environment` exact `sandbox` at 100%. Neither deployment has a `skill-tree` flag.
- [`flag-answers.txt`](flag-answers.txt) comes from [`flagAnswers.proof.ts`](flagAnswers.proof.ts), #136's proof, unchanged. It runs the app's own `flag()` over each deployment's cached definitions, with that deployment's `KUDOS_ENVIRONMENT` and its one workspace key:
  - the sandbox answers all four on;
  - production answers all four off;
  - a control reads production's definitions as if it were the sandbox and gets all four on, so production's off comes from the targeting, not from the safe default.
- [`public-reads.txt`](public-reads.txt): with no session, `getMyProfile` answers `signed-out` on the sandbox and `closed` on production. `openFeature` answers `signed-out` on the sandbox. Production has no `openFeature` yet, because it runs `main`, which part A hasn't reached; that call errored and wrote nothing.

## What the sandbox's data holds

[`unlock-tables.txt`](unlock-tables.txt), redacted, before and after the website calls:

- **One launch**, at 2026-10-13T22:11:41Z, with `shipped: ["leaderboard"]`. It opened the Leaderboard for the one human member already there (P77).
- **That member is level 2.** Their Leaderboard row is open from the launch. They also hold a ready `quests` row from the quests lane's deploy, where Quests had a ship flag. On this tree Quests has none, so it isn't shipped and has no entry (WS56, P78).
- **Only the Leaderboard can ship here.** `skillTree` waits on a `skill-tree` flag, which doesn't exist, and the other features have no ship flag yet.

So the sandbox can show only the grandfathered member's open Leaderboard. A locked or ready Leaderboard needs a member who joins after the launch, and the sandbox workspace has one human. `makeReady` can't help either: for this member it finds nothing shipped without a row. The locked, ready, crate and ready-pill states stay proven by the local runs of #137 and #143–#145 (below). This ticket wrote no `unlocks` row.

## The sandbox, signed in

A proof session signed the browser in, as in #136: one `authSessions` row and one `authRefreshTokens` row appended for #136's proof user, each expiring at 2026-10-14T04:08Z. The sandbox's own Convex Auth refresh then issued the browser's token. Nothing else was written by hand.

| Page | Light | Dark |
|---|---|---|
| Home: the grandfathered Leaderboard under `Open`, no `Still locked` and no `Ready for you`, no Quests card, no ready pill, nav `Home` and `Leaderboard` | [light](home-open-light.png) | [dark](home-open-dark.png) |
| `/leaderboard`: the board, opened by the launch | [light](leaderboard-open-light.png) | [dark](leaderboard-open-dark.png) |

## The website's command on the sandbox

[`website-calls.json`](website-calls.json): every call went from the signed-in tab with its own session token, as the site's client sends it.

1. `getMyProfile` answers `features` with one entry, the Leaderboard, `state: "open"`, and `leaderboard: "open"` (WS56, WS57). No other feature has an entry.
2. `openFeature({ feature: "leaderboard" })` answered `opened`, twice (WS62, WS63).
3. `openFeature({ feature: "quests" })` answered `refused`, although the member holds a ready `quests` row: Unlocks alone decides, and Quests isn't shipped here.
4. `openFeature({ feature: "skillTree" })` answered `refused`.
5. Without a session it answered `signed-out` (WS61).
6. With a `member` beside the feature, the argument validator rejected the call before any handler ran (WS61).
7. App Home was republished after each `opened`: two `publishHome` runs succeeded at 02:09:24Z ([`republish.txt`](republish.txt)). The member has no crate to drop, so the content of a republish without the crate is proven locally by #144.

**The launch rule held.** [`unlock-tables.txt`](unlock-tables.txt) is identical before and after: one `unlockLaunches` row, the same two `unlocks` rows with the same times, and one `levelUps` row. The website added no launch and opened nothing twice.

## Each state, and where it is proven

| Check from #146 | Where |
|---|---|
| A member below level 3 sees `Unlocks at level 3` for the Leaderboard | Local: [`feature-cards`](../feature-cards/README.md) (#143), [`leaderboard-unlock`](../leaderboard-unlock/README.md) (#137) |
| A ready member opens it on the website, and App Home's republished view drops the crate | Local: [`open-feature`](../open-feature/README.md) (#144, `app-home-before.txt` and `app-home-after.txt`), [`crate-moment`](../crate-moment/README.md) (#145). Sandbox: the command answers `opened` and republishes App Home, above |
| A grandfathered member (P77) sees it open | Sandbox: above |
| The ready pill counts and opens | Local: [`crate-moment`](../crate-moment/README.md) (#145). Sandbox: no pill, with nothing ready |
| `website`, `xp-levels`, `unlocks` and `everyone-board` answer off in production | Sandbox and production: [`flag-answers.txt`](flag-answers.txt) |

The local runs used disposable backends with recorded flag overrides (`MOCK_FLAGS_ON`), never a cloud deployment.

## Each flag's production switch, in order (WS77)

In PostHog project 662840, each switch adds `production` to the flag's one `environment` condition. The site follows at the deployment's next flag-definitions refresh, and removing the value closes it again. The website creates no flag of its own.

1. **`everyone-board` (956734):** the leaderboard page, its nav item and the home's card. The same flag as Slack's Everyone board.
2. **`xp-levels` (956733):** level and XP on the home and the profile card, and half of WS55's gate. The same flag as Slack's levels.
3. **`unlocks` (956771):** the unlock path: the three card groups, the crates, `openFeature` and the ready pill. The same flag as Slack's unlocks. P77's launch takes a snapshot of the shipped features the first time `unlocks` is on. With `everyone-board` already on, every existing member keeps the leaderboard and doesn't have to reach level 3 for it.
4. **`website` (957148):** the whole site. It needs #115 first: `AUTH_SLACK_ID` and `AUTH_SLACK_SECRET` on production, plus #88's redirect URL and `openid` and `profile` scopes on the production Slack app.
