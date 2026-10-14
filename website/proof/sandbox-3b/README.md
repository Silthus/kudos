# Part B on the sandbox: quests and the Journey (#150)

WS69–WS77 and WS27, on the shared sandbox. This ticket deployed `spec/website-3-quests` at `07edc39` to the sandbox through the `deploy-sandbox.yml` workflow ([run 38511653248](https://github.com/Silthus/kudos/actions/runs/38511653248)), which finished its deploy at 2026-10-14T04:31:07Z, right before the proof. That tree already holds `main` at `19223ef`, with map #1's quests ship (#129). Nothing was deployed to production, and no flag's targeting changed. No product code changed: this folder is the proof.

## The deploy

[`sandbox-deploy.txt`](sandbox-deploy.txt) is the run's log for the gate's summary and the workflow's four steps: `convex deploy`, `static-hosting upload --build`, `prepareWebsiteFlag` and `syncCompanyProfiles`. Each passed. The gate in CI ran 90 files and 1478 tests, with 0 Coherence problems and 0 unknown nouns.

The schema push printed `No indexes are deleted by this push` and `Schema validation complete`. No sandbox data was cleared or migrated, and the sandbox's env was left as it was.

## The flags answer on in the sandbox and off in production

- [`flag-definitions.txt`](flag-definitions.txt): `website` (957148), `everyone-board` (956734), `xp-levels` (956733), `unlocks` (956771) and `quests` (957184), as each deployment had them cached. Each has one condition, `environment` exact `sandbox` at 100%.
- [`flag-answers.txt`](flag-answers.txt) comes from [`flagAnswers.proof.ts`](flagAnswers.proof.ts), #136's proof with `questsFlag` added. It runs the app's own `flag()` over each deployment's cached definitions, with that deployment's `KUDOS_ENVIRONMENT` and its one workspace key:
  - the sandbox answers all five on;
  - production answers all five off;
  - a control reads production's definitions as if it were the sandbox and gets all five on, so production's off comes from the targeting, not from the safe default.
- [`public-reads.txt`](public-reads.txt): with no session, `getMyProfile`, `getQuests` and `openQuestCrate` answer `signed-out` on the sandbox. On production `getMyProfile` answers `closed`. Production runs `main`, which part B hasn't reached, so `getQuests` and `openQuestCrate` don't exist there yet: both calls errored and wrote nothing.

## What the sandbox's data holds

[`launch-and-quest-tables.txt`](launch-and-quest-tables.txt), redacted, read four times: before the deploy, after it, after the screenshots, and after the website's commands. All four are identical.

- **One unlocks launch** (P77), at 2026-10-13T22:11:41Z, with `shipped: ["leaderboard"]`.
- **One Journey launch** (P91), at 2026-10-14T01:30:23Z. Its join ran once, from map #1's quests lane: one `joinJourney` and one `joinJourneyPage` job, both `success`.
- **The one human member** joined the Journey then. `someone-new` finished at the join (30 XP) and its crate was opened at 02:17:16Z, before this ticket. `first-thanks` and `first-quest` are active. Quests is open since 02:18:00Z.
- **No `questDraws`, `questProgress` or waiting crate.** The draw found no feasible quest: every quest in the pool needs at least one teammate left to thank (`feasibility` in `convex/quests/pool.ts`), and the sandbox workspace has one human and a bot. The hourly sweep and App Home's publish both try the draw, and both find nothing to draw.

So the sandbox can't finish a quest or a Journey step: a kudos needs a second human member to thank. This ticket wrote no quest, reward or crate row, and sent no kudos.

## The sandbox, signed in

A proof session signed the browser in, as in #136 and #146: one `authSessions` row and one `authRefreshTokens` row appended for #136's proof user, each expiring at 2026-10-14T06:31:51Z. The sandbox's own Convex Auth refresh then issued the browser's token. Nothing else was written by hand.

| Page | Light | Dark |
|---|---|---|
| Home: the Journey panel after the counters, with `Give a kudos that says why.` and its hint active, `Finish a weekly quest.` active, and `Thank someone you haven't thanked before.` as `✓ Done · You earned 30 XP`. No crate, so no `Open` and no ready pill. Quests and Leaderboard under Open, and the Quests nav item | [light](1-home-journey-light.png) | [dark](1-home-journey-dark.png) |
| `/quests`: `This week`, no draw: one hedgehog, `You have no quests this week.` and `Open Slack`, beside `How quests work`. No `Waiting to open` | [light](2-quests-empty-week-light.png) | [dark](2-quests-empty-week-dark.png) |

## The website's calls on the sandbox

[`website-calls.json`](website-calls.json): every call went from the signed-in tab with its own session token, as the site's client sends it. [`website-calls-log.txt`](website-calls-log.txt) is the deployment's log for them.

1. `getQuests` answers `kind: "quests"` with no slots and no waiting crates (WS69, WS70).
2. `getMyProfile` answers the Journey's three steps: `first-thanks` and `first-quest` active with no crate, `someone-new` opened with its `seen` key (WS71).
3. `openQuestCrate({ quest: { kind: "journey", step: "someone-new" } })` answered `opened`, twice. The crate was already opened, so the command found its opening afterwards and wrote none (WS74). The Journey launch is recorded here, so #149's gate let the call through.
4. `openQuestCrate` answered `refused` for `first-thanks` and `first-quest`, which are unfinished, and for slot 0 of this week and of last week, which were never drawn.
5. Without a session it answered `signed-out`.
6. With a `member` beside the quest, the argument validator rejected the call before any handler ran. The log shows `ArgumentValidationError: Object contains extra field member`.
7. App Home's republish ran after each `opened`: two `publishHome` jobs completed at 04:33:10Z ([`republish.txt`](republish.txt)). The member had no crate to drop, so this shows only that the republish runs.

**The launch rules held.** The tables are identical before and after the website's calls: one `unlockLaunches` row, one `journeyLaunches` row, the same three `journeySteps`, one `crateOpenings` and one `rewardRecords` row. No launch, join or Journey job was scheduled after the deploy. This ticket's website calls added no launch and ran no join. The sandbox's Journey launch predates them, so these calls can't show what `openFeature` would do without one (see `quests` under the switches below).

## Each check from #150, and where it is proven

| Check | Where |
|---|---|
| The Journey's first step shows for a new member | Sandbox: `Give a kudos that says why.` active, above. A new member's view: local, [`quests-page`](../quests-page/README.md) step 1 (#148) |
| It is finished by a kudos that says why, and its crate opens on the website | Local: [`quests-page`](../quests-page/README.md) steps 4–5 (#148) and [`quest-crates`](../quest-crates/README.md) steps 4–6 (#149), each with a real signed Slack `message`. Sandbox: the command answers `opened` for an opened crate and `refused` for an unfinished one, above |
| The week's quests show with their progress | Local: [`quests-page`](../quests-page/README.md) steps 4 and 7 (#148). Sandbox: the empty week, above, since nothing is drawable there |
| A finished quest's crate opens on the website and is gone from App Home | Local: [`quest-crates`](../quest-crates/README.md) steps 1–3 and *App Home drops each crate* (#149) |
| An earlier week's crate opens from `Waiting to open` when one exists | None exists on the sandbox. Local: `Waiting to open` listed in [`quests-page`](../quests-page/README.md) step 7 (#148); opening one, and focus to the page title, in #149's tests |
| `quests` answers off in production | [`flag-answers.txt`](flag-answers.txt) |

The local runs used disposable backends with recorded flag overrides (`MOCK_FLAGS_ON`), never a cloud deployment.

## Each flag's production switch, in order (WS77)

In PostHog project 662840, each switch adds `production` to the flag's one `environment` condition. The site follows at the deployment's next flag-definitions refresh, and removing the value closes it again. The website creates no flag of its own.

1. **`everyone-board` (956734):** the leaderboard page, its nav item and the home's card. The same flag as Slack's Everyone board.
2. **`xp-levels` (956733):** level and XP on the home and the profile card. The same flag as Slack's levels.
3. **`unlocks` (956771):** the unlock path, its crates, `openFeature` and the ready pill. The same flag as Slack's unlocks.
4. **`website` (957148):** the whole site.
5. **`quests` (957184), after `website`:** the Journey panel, `/quests`, its nav item, the quest crates and `openQuestCrate`. The same flag as Slack's quests. It needs `unlocks` on, since Quests opens through the unlock path at level 2. When it first turns on in production, the first quests mutation, App Home publish or hourly sweep records the Journey's launch and joins every existing member (P91). `openQuestCrate` refuses until that launch is recorded (#149, call 1). `openFeature({ feature: "quests" })` has no such check: the `unlockOpened` event it publishes reaches `drawWeeklyQuests` and `activateJourney`, and both call `questsLiveIn`, which records the launch if none exists. The kudos that makes a member's Quests ready also schedules `followKudosGiven`, which records the launch through `questsShownTo`, and the hourly sweep records it too, so the gap is a short window, but it is open (review finding 1, a follow-up for #152).

## Gate and review

- The gate on the landed tree: [`gate.txt`](gate.txt). This ticket adds no behaviour, so it has no red test of its own; the executable check is `flagAnswers.proof.ts`, 3 of 3 green on the deployments' real caches.
- GPT-6.1 Sol (high), read-only, with the spec as the oracle: [`review-gpt-6.1-sol.txt`](review-gpt-6.1-sol.txt). One major finding, which holds: the README claimed the website never records the Journey's launch, but `openFeature({ feature: "quests" })` can, through the quests module's subscribers, while no launch exists. The claim is narrowed to `openQuestCrate`, and the gap is a follow-up for #152. This ticket changes no product code.
