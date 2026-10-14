# Slice 4 on the sandbox: the skill tree, the Book and buying a perk (#192)

WS78–WS96 and WS27, on the shared sandbox. This ticket merged `origin/main` into `spec/website-4` twice, fixed what each merge broke, and landed the result at `a9a5e37`. That commit holds `main` at `12a0f95`, past map #1's `8d48641` (the members' `picture` field). It deployed `a9a5e37` to the sandbox through the `deploy-sandbox.yml` workflow ([run 38539157304](https://github.com/Silthus/kudos/actions/runs/38539157304)), which finished at 2026-10-14T09:05:46Z. The screenshots, the website's calls, their log, the table snapshots after the deploy, and the public reads and function lists were taken on that deploy, from 09:06Z to 09:10Z. The flag definitions were read at 08:16Z, and the red, green and review artifacts come from the fixes along the way. **The sandbox runs `a9a5e37`.**

Two earlier deploys from this ticket, `98e76fa` and `31d1bc8`, came before the review fix and before `8d48641`. They are superseded. Nothing was deployed to production, and no flag's targeting changed.

## What the merges broke, and the fixes

**1. `buyPerk`'s gate wrote an analytics ID.** The first merge brought #225's per-member flags. Since #225, a member decision evaluated in a mutation gives a member with no analytics ID their first one. `buyPerk`'s gate read the unlock path through the mutation's context, so a refusal at the gate wrote that ID and scheduled `identifyNewPeople`.
- WS88 says the gate checks "with query-safe reads". The invariant says a refusal at the gate "writes nothing and stores nothing".
- The gate now reads through a read-only view of the context (`queryOnly` in `convex/website/commands.ts`). For a member with an analytics ID, the gate still reads their member decision, email conditions included. Only a member with no analytics ID yet falls back to the workspace's decision, as `getMyProfile` does, so the gate decides on the same answer the page shows.
- Red: [`red-merge.txt`](red-merge.txt) is the gate on the merged tree, and [`red-r1.txt`](red-r1.txt) is the test file. Green: [`green-r1.txt`](green-r1.txt), 29 of 29.
- A first attempt narrowed the test instead. The review rejected it, rightly (see [`review-gpt-6.1-sol.md`](review-gpt-6.1-sol.md)).

**2. Main's front door linked a ready Skill tree to the home.** The second merge brought #246. Its test used the Skill tree as the example of a ready feature with no web page, so its Open in Slack linked to `/`. On `spec/website-4` the route list holds `/skills` and `/book`, as `WebsiteReads.spec.md` states. So App Home's Open for a ready Skill tree now opens `/skills`, labelled `Open on HedgeHug's Skill tree page`, and the test says so.
- Red: [`red-r2.txt`](red-r2.txt). Green: [`green-r2.txt`](green-r2.txt), 17 of 17.

**The gate on the landed tree:** [`gate.txt`](gate.txt). 139 files and 2,269 tests, typecheck clean, 0 Coherence problems and 0 unknown nouns. [`green-merge.txt`](green-merge.txt) and [`gate-merge-landing.txt`](gate-merge-landing.txt) are from the superseded first attempt.

## The deploy

[`sandbox-deploy.txt`](sandbox-deploy.txt) is the run's log without the gate's test output, with the Convex team, project and dashboard redacted. Every step passed: the gate (139 files, 2,269 tests), `convex deploy`, `static-hosting upload --build`, `prepareWebsiteFlag`, `syncCompanyProfiles` and the pending-crate backfill.

The schema push printed `No indexes are deleted by this push` and `Schema validation complete.` No sandbox data was cleared or migrated, and the sandbox's env was left as it was. This ticket did not run map #1's `fillMemberProfiles`.

## The flags

- [`flag-definitions.txt`](flag-definitions.txt): `website` (957148), `everyone-board` (956734), `xp-levels` (956733), `unlocks` (956771), `quests` (957184), `skill-tree` (957886) and `achievements` (957887), as each deployment had them cached at 08:16Z. Each has two conditions, `environment` exact `sandbox` and `environment` exact `production`, each at 100%.
- [`flag-answers.txt`](flag-answers.txt) comes from [`flagAnswers.proof.ts`](flagAnswers.proof.ts). It runs the app's own `workspaceDecisionWithoutWriting` over each deployment's cached definitions, with that deployment's `KUDOS_ENVIRONMENT` and workspace key:
  - the sandbox answers all seven on;
  - **production answers all seven on.** Production is live since 2026-10-14. So `skill-tree` and `achievements` no longer answer off in production, and this proof doesn't claim they do;
  - a control reads production's definitions under an environment no condition names and gets all seven off, so the answers come from the targeting.
- [`public-functions.txt`](public-functions.txt), from `convex function-spec`, read-only: production has `getMyProfile` and lacks `getSkillTree`, `getBook` and `buyPerk`. The sandbox has all four.
- [`public-reads.txt`](public-reads.txt): with no session, all four answer `signed-out` on the sandbox. On production `getMyProfile` answers `signed-out`, and the three missing functions answer `Server Error`.

**The live release.** Every slice 4 flag already answers on in production. Ship #193's merge to `main` is the release: it gives every production member `/skills`, `/book` and Buy on the website at once.

## What the sandbox's data holds

[`launch-and-purchase-tables.txt`](launch-and-purchase-tables.txt), redacted, read before this ticket's first deploy, after the `a9a5e37` deploy, and after the website's calls. The rows are identical across all three reads.

- One unlocks launch (P77), `shipped: ["leaderboard"]`. One Journey launch (P91). One Book launch.
- One `member` row and one `bot` row. All nine stored kudos messages were written by the member, mention only the member, and are `invalid`: nobody else can be thanked.
- The member is at level 2 with 30 XP, from the Journey's `someone-new`. Quests and the Leaderboard are open. The Book is locked at level 4 and the Skill tree at level 5.
- No `perkPurchases`, `perksOwned`, `skillPoints`, `earnedTiers` or `tierSummaries` row.

**Not exercised on the sandbox:** a ready or open Skill tree or Book, a purchase, and an earned tier. Level 4 needs 300 XP and level 5 needs 600. XP comes from kudos given or received and from Journey and weekly quest rewards. Each of those needs a second human to thank or be thanked by, and the sandbox has none. Every other route would be a hand-written XP, unlock, perk, skill point or tier row, which this ticket doesn't write. This ticket sent no kudos.

## The sandbox, signed in

A proof session signed the browser in, as in #136, #146 and #150. This ticket ran `convex import --append` three times: one `authSessions` row for #136's proof user, created 08:23Z and expiring 10:23Z, and two `authRefreshTokens` rows with the same expiry. The sandbox's own Convex Auth refresh then issued the browser's tokens, adding the refresh-token rows with a 30-day expiry that the tables file also lists. Those are bound to the session, which expires at 10:23Z. The tables file shows each row with no IDs or tokens; it has no read from before the session's creation. The proof user has no name or picture, so the face shows `?` and the card shows `You`.

| Page | Light | Dark |
|---|---|---|
| `/skills`, locked: `Skill tree opens at level 5.` and `Go to Home`. No skill point chip in the HUD, and no Skill tree in the nav | [light](1-skills-locked-light.png) | [dark](1-skills-locked-dark.png) |
| `/book`, locked: `Book opens at level 4.` and `Go to Home`. No Book in the nav | [light](2-book-locked-light.png) | [dark](2-book-locked-dark.png) |
| Home: Quests and Leaderboard under Open; the Book (`Unlocks at level 4`, WS82's sentence) and the Skill tree (`Unlocks at level 5`) under Still locked | [light](3-home-locked-cards-light.png) | [dark](3-home-locked-cards-dark.png) |

## The website's calls on the sandbox

[`website-calls.json`](website-calls.json): every call went from the signed-in tab with its own session token, as the site's client sends it. [`website-calls-log.txt`](website-calls-log.txt) is the deployment's log for them.

1. `getSkillTree` answers `{ kind: "locked", level: 5 }` and `getBook` answers `{ kind: "locked", level: 4 }` (WS80).
2. `getMyProfile` answers `book` and `skillTree` as `locked`, and `skillPoints: null` (WS79, WS84).
3. `buyPerk({ perk: "spark", request })` answers `{ kind: "refused", reason: null }`, twice with the same request. The tree isn't open, so the gate refused both before D17 (WS88).
4. `buyPerk` with a request that isn't a UUID throws. The log shows `A purchase's request must be a UUID.`
5. Without a session, `buyPerk` answers `signed-out`.
6. `openFeature` answers `refused` for `skillTree` and for `book`, both locked.

**The launch rules held.** The launch, unlock, purchase, tier and analytics ID rows are identical before and after the calls. Only one job was created after the deploy, a `followMembers` at 09:06:23Z, before the first call at 09:07:56Z. The calls created none: no launch, join, replay or App Home republish.

## Each check from #192, and where it is proven

| Check | Where |
|---|---|
| Below level 5, `/skills` is locked at level 5; below level 4, `/book` is locked at level 4 | Sandbox, above |
| A ready member opens the Skill tree on its page | Local: [`skill-tree-page`](../skill-tree-page/README.md) (#188) and [`feature-pages`](../feature-pages/README.md) (#186) |
| The three perks with P94's copy, and skill points in the HUD | Local: [`skill-tree-page`](../skill-tree-page/README.md) (#188), [`skill-tree-read`](../skill-tree-read/README.md) (#187) |
| Buying `spark`: the HUD chip goes down, and App Home's Skill tree tab shows it owned | Local: [`buy-perk`](../buy-perk/README.md) (#189), with `running-app-spark.txt` |
| A doubled request buys once, and a refusal shows its reason | Local: [`buy-perk`](../buy-perk/README.md) (#189). Sandbox: a doubled request refused at the gate, writing nothing, above |
| The Book with an earned tier and its historical date | Local: [`book-page`](../book-page/running-app.md) (#191), [`book-read`](../book-read/README.md) (#190) |
| A grandfathered member | Local: #186–#191's tests. The sandbox's one member reached neither level |
| Production's `skill-tree` and `achievements` answer off | Superseded: production is live and both answer on. See the flags above |

The open states also hold on the landed tree: the gate on `a9a5e37` runs every test #186–#191 added, after both merges of `main`. The running-app proofs above ran before those merges.

## Review

GPT-6.1 Sol (high), read-only, on a frozen copy of `9a0b907`, with the spec, the ticket and the brief as the oracle: [`review-gpt-6.1-sol.md`](review-gpt-6.1-sol.md), with each finding's disposition. Round 1: one major finding (the gate) was fixed in product code. Three more were evidence gaps in this README, now closed. Part of one (the owner's first name) was rejected with its reason. Round 2, on `ca06e81`, found no fault in the fix. One answer raised a major gap shared by every website command, which a preview flag can reach: it is a follow-up for #193, with the reason it isn't reachable today.
