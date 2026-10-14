# Slice 4 on the sandbox: the skill tree, the Book and buying a perk (#192)

WS78–WS96 and WS27, on the shared sandbox. This ticket merged `origin/main` into `spec/website-4`, landed it at `98e76fa`, and deployed that commit to the sandbox through the `deploy-sandbox.yml` workflow ([run 38534703862](https://github.com/Silthus/kudos/actions/runs/38534703862)). The deploy finished at 2026-10-14T08:28:17Z, and the proof ran right after it, from 08:29Z to 08:32Z. Nothing was deployed to production, and no flag's targeting changed.

## The merge, and the one fix it needed

`main` brought #225's per-member flags, #221's pending-crate index and map #1's later merges. The merge was clean, but the gate failed one test: [`red-merge.txt`](red-merge.txt).

- **What broke:** *a Skill tree still locked at level 1 answers refused … and writes nothing at all.* `buyPerk`'s gate reads the unlock path with the member's decision. Since #225, a member decision evaluated in a mutation gives a member with no analytics ID their first one, and schedules `identifyNewPeople`. The refusal still writes nothing else.
- **The fix is in the test.** The test now asserts that the refusal writes nothing but that analytics ID and its identify job. The invariant *a website command is a D17 command* already leaves the analytics outbox and scheduled functions out of what it compares. The gate keeps the member's decision, so it agrees with D17's for a member in preview (decision `d-909985ae`).
- **Green:** [`green-merge.txt`](green-merge.txt), all 29 of `buyPerk.test.ts`. The gate on the landed tree: [`gate-merge-landing.txt`](gate-merge-landing.txt), 139 files and 2,248 tests, typecheck clean, 0 Coherence problems and 0 unknown nouns.

## The deploy

[`sandbox-deploy.txt`](sandbox-deploy.txt) is the run's log without the gate's test output. Every step passed: the gate (139 files, 2,248 tests), `convex deploy`, `static-hosting upload --build`, `prepareWebsiteFlag`, `syncCompanyProfiles` and the pending-crate backfill.

The schema push printed `No indexes are deleted by this push` and `Schema validation complete.` No sandbox data was cleared or migrated, and the sandbox's env was left as it was.

## The flags

- [`flag-definitions.txt`](flag-definitions.txt): `website` (957148), `everyone-board` (956734), `xp-levels` (956733), `unlocks` (956771), `quests` (957184), `skill-tree` (957886) and `achievements` (957887), as each deployment had them cached. Each has two conditions, `environment` exact `sandbox` and `environment` exact `production`, each at 100%.
- [`flag-answers.txt`](flag-answers.txt) comes from [`flagAnswers.proof.ts`](flagAnswers.proof.ts). It runs the app's own `workspaceDecisionWithoutWriting` over each deployment's cached definitions, with that deployment's `KUDOS_ENVIRONMENT` and workspace key:
  - the sandbox answers all seven on;
  - **production answers all seven on.** Production is live (Michael, 2026-10-14). So `skill-tree` and `achievements` no longer answer off in production, and this proof doesn't claim they do;
  - a control reads production's definitions under an environment no condition names and gets all seven off, so the answers come from the targeting, not from a default.
- [`public-reads.txt`](public-reads.txt): with no session, `getSkillTree`, `getBook`, `getMyProfile` and `buyPerk` answer `signed-out` on the sandbox. Production runs `main`, which slice 4 hasn't reached, so `getSkillTree`, `getBook` and `buyPerk` don't exist there yet and answer `Server Error`. `getMyProfile` answers `signed-out`.

**The live release.** Every slice 4 flag already answers on in production. Ship #193's merge to `main` is the release: it gives every production member `/skills`, `/book` and Buy on the website at once.

## What the sandbox's data holds

[`launch-and-purchase-tables.txt`](launch-and-purchase-tables.txt), redacted, read three times: before the deploy, after it, and after the website's calls. All three are identical.

- One unlocks launch (P77), `shipped: ["leaderboard"]`. One Journey launch (P91). One Book launch.
- The sandbox's one human member is at level 2 with 30 XP: Quests and the Leaderboard are open, the Book is locked at level 4 and the Skill tree at level 5.
- No `perkPurchases`, `perksOwned`, `skillPoints`, `earnedTiers` or `tierSummaries` row.

The sandbox's Slack workspace has one human and a bot, so nobody can thank that member. Their kudos so far name only themselves and were refused. So no real flow can take them to level 4 or 5, give them a skill point, or earn them a tier there. This ticket wrote no perk, unlock, tier, skill point or XP row, and sent no kudos.

## The sandbox, signed in

A proof session signed the browser in, as in #136, #146 and #150: one `authSessions` row and one `authRefreshTokens` row appended for #136's proof user, each expiring at 2026-10-14T10:30Z. The sandbox's own Convex Auth refresh then issued the browser's token. The proof user has no name or picture, so the face shows `?` and the card shows `You`.

| Page | Light | Dark |
|---|---|---|
| `/skills`, locked: `Skill tree opens at level 5.` and `Go to Home`. No skill point chip in the HUD, and no Skill tree in the nav | [light](1-skills-locked-light.png) | [dark](1-skills-locked-dark.png) |
| `/book`, locked: `Book opens at level 4.` and `Go to Home`. No Book in the nav | [light](2-book-locked-light.png) | [dark](2-book-locked-dark.png) |
| Home: Quests and Leaderboard under Open; the Book (`Unlocks at level 4`, WS82's sentence) and the Skill tree (`Unlocks at level 5`) under Still locked | [light](3-home-locked-cards-light.png) | [dark](3-home-locked-cards-dark.png) |

## The website's calls on the sandbox

[`website-calls.json`](website-calls.json): every call went from the signed-in tab with its own session token, as the site's client sends it. [`website-calls-log.txt`](website-calls-log.txt) is the deployment's log for them.

1. `getSkillTree` answers `{ kind: "locked", level: 5 }` and `getBook` answers `{ kind: "locked", level: 4 }` (WS80).
2. `getMyProfile` answers `book` and `skillTree` as `locked`, and `skillPoints: null` (WS79, WS84).
3. `buyPerk({ perk: "spark", request })` answers `{ kind: "refused", reason: null }`, twice with the same request. The tree isn't open, so the gate refused both before D17 and stored nothing (WS88).
4. `buyPerk` with a request that isn't a UUID throws, and the log shows `A purchase's request must be a UUID.`
5. Without a session, `buyPerk` answers `signed-out`.
6. `openFeature` answers `refused` for `skillTree` and for `book`, both locked.

**The launch rules held.** The launch, unlock, purchase, tier and job rows are identical before and after the website's calls. No launch, join, replay or App Home republish was scheduled by them.

## Each check from #192, and where it is proven

| Check | Where |
|---|---|
| Below level 5, `/skills` is locked at level 5; below level 4, `/book` is locked at level 4 | Sandbox, above |
| A ready member opens the Skill tree on its page | Local: [`skill-tree-page`](../skill-tree-page/README.md) (#188) and [`feature-pages`](../feature-pages/README.md) (#186) |
| The three perks with P94's copy, and skill points in the HUD | Local: [`skill-tree-page`](../skill-tree-page/README.md) (#188), [`skill-tree-read`](../skill-tree-read/README.md) (#187) |
| Buying `spark`: the HUD chip goes down, and App Home's Skill tree tab shows it owned | Local: [`buy-perk`](../buy-perk/README.md) (#189), with `running-app-spark.txt` |
| A doubled request buys once, and a refusal shows its reason | Local: [`buy-perk`](../buy-perk/README.md) (#189). Sandbox: a doubled request refused at the gate stores nothing, above |
| The Book with an earned tier and its historical date | Local: [`book-page`](../book-page/running-app.md) (#191), [`book-read`](../book-read/README.md) (#190) |
| A grandfathered member | Local: #186–#191's tests. The sandbox's one member reached no level that the tree or the Book opens at |
| Production's `skill-tree` and `achievements` answer off | Superseded: production is live and both answer on. See the flags above |

The open states also hold on the merged tree: the gate on `98e76fa` runs every test #186–#191 added, after `main`'s merge.

## Review

GPT-6.1 Sol (high), read-only, over this ticket's commits with the spec as the oracle: [`review-gpt-6.1-sol.md`](review-gpt-6.1-sol.md).
