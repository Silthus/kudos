# Proof for #136: the second slice on the sandbox

The sandbox ran `spec/website-2` at `8ffdaa0`, which already holds `main` at `0c40c11`. Deployment names are written `<sandbox>` and `<production>` in these files. Nothing was deployed to production, and no flag's targeting changed.

## The deploy

[`sandbox-deploy.txt`](sandbox-deploy.txt): the deploy workflow's commands, run by hand from the ticket's worktree at 2026-10-14T00:24Z, right before the proof.

1. `convex deploy` passed schema validation, so no other lane's data stood in the way.
2. `static-hosting upload` built the site against the sandbox's own URL and published it.
3. `prepareWebsiteFlag` and `syncCompanyProfiles` ran.

## The flags (WS30, WS47)

- [`flag-definitions.txt`](flag-definitions.txt): `website` (957148), `everyone-board` (956734), `xp-levels` (956733) and `unlocks` (956771), as each deployment had cached them. All four have one condition, `environment` exact `sandbox` at 100%.
- [`flag-answers.txt`](flag-answers.txt): [`flagAnswers.proof.ts`](flagAnswers.proof.ts) runs the app's own `flag()` over each deployment's cached definitions, with that deployment's `KUDOS_ENVIRONMENT` and the workspace key it holds for its sign-in workspace.
  - The sandbox answers on for all four.
  - Production answers off for all four.
  - A control reads production's definitions and key as if it were the sandbox and gets all four on. So production's off comes from the targeting, not from the safe default an unreadable flag would fall back to.
  - Both deployments were only read: the cached definitions, the environment and the workspace key.
- [`public-reads.txt`](public-reads.txt): an anonymous `getMyProfile` answers `signed-out` on the sandbox, because the site is open there, and `closed` on production, because it is not.

### The production switches

In PostHog project 662840, each switch adds `production` to the flag's one `environment` condition. The site follows at the deployment's next flag-definitions refresh, and removing the value closes it again. The website creates no flag of its own: each piece opens in production exactly when Slack's own flag opens it there.

1. **`website` (957148): the whole site** (WS2–WS4). First set `AUTH_SLACK_ID` and `AUTH_SLACK_SECRET` on production and apply #88's redirect URL and scopes (#115). Without them the site opens to a sign-in that can't finish.
2. **`xp-levels` (956733): level and XP** on the home and the profile card (WS47). Slack's App Home shows them too. The website adds no switch of its own.
3. **`everyone-board` (956734): the leaderboard page**, its nav item and the home's card (WS30). This is the same flag as Slack's Everyone board.
4. **`unlocks` (956771): the leaderboard's locked and ready states** (WS52), once `xp-levels` is also on. WS53 is met: #137 is on `spec/website-2`, so this slice ships with the unlock gate. `unlocks` may get its production condition whenever map #1 opens unlocks in Slack.

## The sandbox, signed in

Nobody here is signed into the sandbox's Slack workspace, and the live Sign in with Slack waits on #115. So the browser was signed in with a **proof session**, appended to the sandbox, for its one member's chat identity:

- one `users` row;
- one `authSessions` row and one `authRefreshTokens` row, each expiring two hours after it was written.

The browser held only that refresh token. The sandbox's own Convex Auth refresh then issued its token. Nothing was cleared, migrated or changed, and no unlock row was written. The proof `users` row has no name, so the face shows `?` and the profile card says `You`.

[`sandbox-reads.txt`](sandbox-reads.txt) has the same reads through `convex run --identity`, plus the sandbox's unlock launch and its one `unlocks` row.

| Page | Light | Dark |
|---|---|---|
| The home with the level line (`Level 1 · 20 XP to level 2`), the Leaderboard card under Open, and the nav item | [home-level-light.png](home-level-light.png) | [home-level-dark.png](home-level-dark.png) |
| `/leaderboard`, this week | [leaderboard-week-light.png](leaderboard-week-light.png) | [leaderboard-week-dark.png](leaderboard-week-dark.png) |
| `/leaderboard`, all time | [leaderboard-all-light.png](leaderboard-all-light.png) | [leaderboard-all-dark.png](leaderboard-all-dark.png) |

The sandbox's data has one human member, who has given no kudos. So both boards show the empty board (WS44), `Not ranked yet`, and the side panel's `You're on the leaderboards` line. The populated board, its podium and its window are shown on a local backend in `../leaderboard-page/`.

## The unlock gate (WS52, WS53)

Map #1's unlocks (#105) is on `main`, and #137, the leaderboard page following its unlock, landed on `spec/website-2` at `8ffdaa0` before this deploy. On the sandbox, `unlocks` and `xp-levels` answer on, and the workspace's one unlock launch shipped `leaderboard`. That launch opened the leaderboard for the member who was already there. So the sandbox can show only the opened state:

- `getMyProfile` answers `"leaderboard": "open"`;
- the home lists the Leaderboard under Open;
- the nav holds the Leaderboard;
- `/leaderboard` shows the board.

Showing the locked and ready states here would need a second member joining after the launch, or unlock rows that Slack's own flow didn't write. #137 proved both states on a local backend (`../leaderboard-unlock/`).

## The clock on an open board (WS36, #134's follow-up)

[`clock.txt`](clock.txt) covers two runs on a disposable local backend on 4410/4411. A clock proof needs a viewer whose midnight falls inside this ticket's window. The sandbox's one member's midnight is 22:00Z.

- **Run 1** (Atlantic/Cape_Verde): the open page turned over at 01:00:44Z, a minute before the clock ticked. The mock serves flag definitions without an ETag, so the PostHog component rewrote its cached row every minute, and every flag-reading query re-ran. That run doesn't isolate the tick: [before](clock-1-before-midnight.png), [after](clock-1-after-midnight.png).
- **Run 2** (America/Noronha), with the mock stopped so nothing else rewrote what the board reads: the open page, still on its first navigation, turned from `▲ 9` to `▲ 4 more kudos than this time last week` 85 ms after the 02:01:44Z tick, the first after Noa's midnight. Screenshots: [before](clock-2-before-midnight-dark.png), [after](clock-2-after-midnight-dark.png).
