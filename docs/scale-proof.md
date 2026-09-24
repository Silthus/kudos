# Scale proof: the read models at 500 members

- Ticket: [Read models: scale proof at 500 members / 50k kudos](https://github.com/Silthus/kudos/issues/30), ticket 7 of [Scale the dashboard read models](https://github.com/Silthus/kudos/issues/3)
- Measured: 2026-09-24 on `main` at `05c8b24` (with #21, #22 and #12) plus this ticket's tooling, on an isolated local backend (`CONVEX_AGENT_MODE=anonymous`, Convex local backend `precompiled-2026-09-21`)
- Release: the [production runbook](#production-runbook-for-9) at the end is written for [the release](https://github.com/Silthus/kudos/issues/9)

## Result

**Every dashboard read path that reads the rollups stays under 7.1% of Convex's per-transaction read limits at 500 members.** The limits are 32,000 documents and 16 MiB. The worst path is the year leaderboard by received: 2,253 docs and 0.98 MiB. It is also under 14% of the older 16,384-doc / 8 MiB limits the research budgeted against. The rollups are exact: every sampled day, week and month bucket verified with no mismatches. The backfill took **2.7–10.5 minutes** end to end (the same workspace, run twice on a shared machine). No backfill step read more than 5,714 docs (17.9%) or wrote more than 895.

Three things are flagged. None of them is a dashboard read path on the rollups:

1. **`discoveries.gallery` truncates at scale.** It reads the workspace's discoveries with `take(8000)`, and there are 13,332 of them. The read hits the cap on every run, so "found by N teammates" and `collectors` come out silently wrong. It is 25% of the doc limit (49% of the old 16k budget). This needs a fix ticket (see [Findings](#findings)).
2. **`rollups:verify` on a month reads 13–19k docs (up to 59% of the limit).** Quarters and years can't be verified in one call at this scale. The runbook verifies one bucket per call and uses weeks and months only for large workspaces.
3. **Before the backfill, the legacy scans fail at this scale.** The year and all-time analytics, the year leaderboard and the year team compare time out. Month and quarter reads use 43–54% of the limit. This only matters between the deploy and the end of the backfill, and production is far smaller. The runbook starts the backfill right after the deploy.

## The dataset

Seeded by `internal.rollups.seedScale` (dev only, see [below](#the-seed-helper)): one workspace, 2025-01-01 → 2026-09-24, Europe/Berlin, daily limit 5, `receivedVisibility: "everyone"` (so every received-count path runs), store enabled.

| | |
|---|---|
| Members | 500 people, all signed in (500 `users`), plus the bot; 3 admins; teams of 10 |
| Kudos rows | **86,479** over 632 days, at a rate of 50k a year: **49,575 in 2025** (a full calendar year) and 36,904 in 2026 so far |
| Units given | 107,531 across 69,979 messages; 13% of the units come from reactions |
| `memberDays` | 53,396 giver-days (plus receiver-only days); 2,840 maxed days |
| Discoveries | 13,332 |
| Notifications | 2,500 (the latest 5 per member; the Me page reads `take(5)`) |
| Not seeded | `kudosAttempts`, quest boards and completions, redemptions and rewards. No dashboard read path reads attempts. The quest and store reads are bounded `take`s, so an empty table understates them by at most their bound. |

A skewed minority gives most (generosity weight `r³`), 70% of kudos stay within the giver's team, one channel in six is private, and weekends run at 8%. Everything is deterministic in the member index and the day.

Timing on this machine (aarch64, shared with other lanes' backends): the seed took about 33 minutes. The local backend caps writes at 4 MiB/s, and those rejections are retried. One step once hit "too many system operations" with two days per step, so a step now seeds one day.

## Method

`scripts/scale-proof.mjs` signs in as real members through the local backend's admin key. It runs every read path once per variant and reads `usageStats.databaseReadDocuments` / `databaseReadBytes` from the backend's own function log (`npx convex logs --jsonl --success`). Those are the counters Convex enforces the limits on. No result was served from the query cache.

- **Viewers:** the busiest member (most own kudos: the heaviest `me`/compare reads), the median member, and the runner-up as the compare teammate. The leaderboard and analytics don't depend on the viewer.
- **Two anchors for `today`:** 2026-09-24 (the real today) and 2025-12-31 (a complete calendar year, quarter and month behind it: the worst case for "year").
- **Before and after:** the rollup reads were measured after `backfillAll` + `mirrorBackfillMarkers`. The "Before backfill" column was measured on the same code with the markers cleared by `rollups:unmarkBackfilled`, i.e. the legacy scans after a rollback. Right after the deploy the legacy `me.overview` reads a little more, because members don't carry their giving profile yet (`me.ts` then scans all their `memberDays`). A first pass measured on a fresh seed before any backfill (pre-#12 code) had `me.overview` at up to 1,236 docs for the busiest member (vs 832 after the backfill). The other legacy paths matched this column to within a few docs.

## Measurements

Docs / bytes read per run. The percentage is the worst of both anchors against **32,000 docs / 16 MiB** (the current limits, <https://docs.convex.dev/production/state/limits>). "Fails" means the query was killed after ~15 s on the local backend ("Your request timed out performing too many system operations"). It is expected to be over the limits: the month scan alone reads 15–17k docs. The backend reports no read counts for a killed query, so the exact figure wasn't measured.

| Read path | Viewer | Today = 2026-09-24 (docs / bytes) | Today = 2025-12-31 (full year) | Worst % of 32k docs / 16 MiB | Before backfill (legacy scan, 2025-12-31) |
|---|---|---|---|---|---|
| `leaderboard.get week given` | any | 993 / 0.49 MiB | 1,073 / 0.51 MiB | 3.4% / 3.2% | 3,552 / 1.30 MiB |
| `leaderboard.get week received` | any | 1,486 / 0.65 MiB | 1,632 / 0.69 MiB | 5.1% / 4.3% | 3,552 / 1.30 MiB |
| `leaderboard.get month given` | any | 1,262 / 0.58 MiB | 1,283 / 0.59 MiB | 4.0% / 3.7% | 16,826 / 5.31 MiB |
| `leaderboard.get month received` | any | 1,875 / 0.78 MiB | 1,910 / 0.79 MiB | 6.0% / 4.9% | 16,826 / 5.31 MiB |
| `leaderboard.get quarter given` | any | 1,455 / 0.66 MiB | 1,470 / 0.67 MiB | 4.6% / 4.2% | 17,271 / 5.47 MiB |
| `leaderboard.get quarter received` | any | 2,021 / 0.85 MiB | 2,028 / 0.85 MiB | 6.3% / 5.3% | 17,271 / 5.47 MiB |
| `leaderboard.get year given` | any | 1,742 / 0.82 MiB | 994 / 0.48 MiB | 5.4% / 5.1% | fails |
| `leaderboard.get year received` | any | 2,253 / 0.98 MiB | 1,494 / 0.64 MiB | 7.0% / 6.1% | fails |
| `leaderboard.get all given` | any | 504 / 0.32 MiB | 504 / 0.32 MiB | 1.6% / 2.0% | 5,504 / 2.08 MiB |
| `leaderboard.get all received` | any | 504 / 0.32 MiB | 504 / 0.32 MiB | 1.6% / 2.0% | 5,504 / 2.08 MiB |
| `me.overview week` | busiest member | 96 / 0.04 MiB | 99 / 0.04 MiB | 0.3% / 0.3% | 93 / 0.04 MiB |
| `me.overview month` | busiest member | 158 / 0.07 MiB | 178 / 0.08 MiB | 0.6% / 0.5% | 163 / 0.07 MiB |
| `me.overview quarter` | busiest member | 340 / 0.14 MiB | 357 / 0.15 MiB | 1.1% / 0.9% | 333 / 0.15 MiB |
| `me.overview year` | busiest member | 932 / 0.38 MiB | 845 / 0.37 MiB | 2.9% / 2.4% | 831 / 0.41 MiB |
| `me.overview all` | busiest member | 1,247 / 0.57 MiB | 944 / 0.39 MiB | 3.9% / 3.5% | 832 / 0.41 MiB |
| `me.overview week` | median member | 72 / 0.03 MiB | 78 / 0.04 MiB | 0.2% / 0.2% | 75 / 0.03 MiB |
| `me.overview month` | median member | 84 / 0.04 MiB | 94 / 0.04 MiB | 0.3% / 0.3% | 91 / 0.04 MiB |
| `me.overview quarter` | median member | 158 / 0.06 MiB | 170 / 0.07 MiB | 0.5% / 0.4% | 160 / 0.07 MiB |
| `me.overview year` | median member | 385 / 0.15 MiB | 343 / 0.14 MiB | 1.2% / 0.9% | 330 / 0.15 MiB |
| `me.overview all` | median member | 452 / 0.19 MiB | 375 / 0.15 MiB | 1.4% / 1.2% | 331 / 0.15 MiB |
| `me.standing week` | any | 715 / 0.39 MiB | 793 / 0.42 MiB | 2.5% / 2.6% | 1,196 / 0.53 MiB |
| `me.standing month` | any | 1,070 / 0.51 MiB | 1,168 / 0.54 MiB | 3.6% / 3.4% | 6,196 / 2.04 MiB |
| `me.standing quarter` | any | 1,145 / 0.53 MiB | 1,224 / 0.56 MiB | 3.8% / 3.5% | 6,196 / 2.04 MiB |
| `me.standing year` | any | 1,196 / 0.54 MiB | 1,282 / 0.57 MiB | 4.0% / 3.6% | 6,196 / 2.04 MiB |
| `me.standing all` | any | 1,215 / 0.71 MiB | 1,293 / 0.74 MiB | 4.0% / 4.6% | 1,696 / 0.85 MiB |
| `analytics.overview week` | any | 1,224 / 0.56 MiB | 1,276 / 0.58 MiB | 4.0% / 3.6% | 4,093 / 1.61 MiB |
| `analytics.overview month` | any | 1,454 / 0.65 MiB | 1,456 / 0.66 MiB | 4.5% / 4.1% | 14,826 / 5.53 MiB |
| `analytics.overview quarter` | any | 1,631 / 0.75 MiB | 1,651 / 0.76 MiB | 5.2% / 4.8% | 15,271 / 5.69 MiB |
| `analytics.overview year` | any | 2,048 / 1.01 MiB | 1,390 / 0.74 MiB | 6.4% / 6.3% | fails |
| `analytics.overview all` | any | 576 / 0.39 MiB | 567 / 0.38 MiB | 1.8% / 2.5% | fails |
| `compare.past week` | busiest member | 53 / 0.02 MiB | 51 / 0.02 MiB | 0.2% / 0.1% | 51 / 0.02 MiB |
| `compare.past month` | busiest member | 112 / 0.05 MiB | 135 / 0.06 MiB | 0.4% / 0.4% | 135 / 0.06 MiB |
| `compare.past quarter` | busiest member | 338 / 0.15 MiB | 325 / 0.15 MiB | 1.1% / 1.0% | 325 / 0.15 MiB |
| `compare.past year` | busiest member | 985 / 0.45 MiB | 608 / 0.28 MiB | 3.1% / 2.8% | 608 / 0.28 MiB |
| `compare.teammate week` | busiest vs runner-up | 90 / 0.04 MiB | 90 / 0.04 MiB | 0.3% / 0.2% | 90 / 0.04 MiB |
| `compare.teammate month` | busiest vs runner-up | 147 / 0.06 MiB | 178 / 0.08 MiB | 0.6% / 0.5% | 178 / 0.08 MiB |
| `compare.teammate quarter` | busiest vs runner-up | 351 / 0.16 MiB | 381 / 0.17 MiB | 1.2% / 1.1% | 381 / 0.17 MiB |
| `compare.teammate year` | busiest vs runner-up | 988 / 0.46 MiB | 1,241 / 0.57 MiB | 3.9% / 3.6% | 1,241 / 0.57 MiB |
| `compare.team week` | busiest member | 908 / 0.45 MiB | 968 / 0.47 MiB | 3.0% / 3.0% | 1,196 / 0.53 MiB |
| `compare.team month` | busiest member | 1,002 / 0.48 MiB | 1,003 / 0.48 MiB | 3.1% / 3.0% | 5,503 / 1.83 MiB |
| `compare.team quarter` | busiest member | 1,003 / 0.48 MiB | 1,003 / 0.48 MiB | 3.1% / 3.0% | 5,503 / 1.83 MiB |
| `compare.team year` | busiest member | 1,003 / 0.48 MiB | 1,003 / 0.48 MiB | 3.1% / 3.0% | fails |
| `compare.candidates.list` | busiest member | 503 / 0.32 MiB | — | 1.6% / 2.0% | 503 / 0.32 MiB |
| `slackData.homeData (App Home, incl. #22 quests)` | busiest member | 95 / 0.04 MiB | — | 0.3% / 0.2% | 800 / 0.25 MiB |
| `slackData.homeData (App Home, incl. #22 quests)` | median member | 45 / 0.02 MiB | — | 0.1% / 0.1% | 789 / 0.24 MiB |
| `store.balance` | busiest member | 2 / 0.00 MiB | — | 0.0% / 0.0% | 2 / 0.00 MiB |
| `store.catalog` | busiest member | 2 / 0.00 MiB | — | 0.0% / 0.0% | 2 / 0.00 MiB |
| `me.today` | busiest member | 37 / 0.01 MiB | 37 / 0.01 MiB | 0.1% / 0.1% | 37 / 0.01 MiB |
| `quests.mine` | busiest member | 10 / 0.01 MiB | 18 / 0.01 MiB | 0.1% / 0.1% | 18 / 0.01 MiB |
| `quests.history 12 weeks` | busiest member | 3 / 0.00 MiB | 3 / 0.00 MiB | 0.0% / 0.0% | 3 / 0.00 MiB |
| `quests.history 52 weeks` | busiest member | 3 / 0.00 MiB | 3 / 0.00 MiB | 0.0% / 0.0% | 3 / 0.00 MiB |
| `session.viewer` | busiest member | 2 / 0.00 MiB | — | 0.0% / 0.0% | 2 / 0.00 MiB |
| `discoveries.gallery (capped)` | busiest member | 8,037 / 2.83 MiB | — | 25.1% / 17.7% | 8,037 / 2.83 MiB |

`quests.mine` and `quests.history` are **not really measured**: no quest boards or completions were seeded, and `quests.history` returns early when no board exists. Their reads are bounded by the board (3 quests) and by `weeks` (≤ 52 boards plus their completions); that bound is reasoning, not measurement. [#31](https://github.com/Silthus/kudos/issues/31) merged after these runs. It adds the viewer's quest completions to `compare.past` and `compare.teammate`: ≤ 1,000 `questCompletions` (`MAX_QUEST_COMPLETIONS`) plus one `questBoards` row. `compare.team` reads nothing for it. So the worst compare path stays ≤ ~2.3k docs (≤ 7.1% of the limit), in line with the headline. `store.catalog` has no rewards or redemptions to read. The "Before backfill" column was measured on the same code by clearing the marker with `rollups:unmarkBackfilled`, which is the runbook's rollback, exercised here at scale.

### Tooling and backfill

| Transaction | Docs read | Bytes read | Docs written | % of limits (read docs / bytes / written docs) |
|---|---|---|---|---|
| Heaviest backfill step (a month period: its kudos for channels and messages) | 5,658–5,714 | 3.04 MiB | 56 | 17.9% / 19.0% / 0.4% |
| Heaviest writing backfill step (a week of day rows) | 619 | 0.29 MiB | 895 | 1.9% / 1.8% / 5.6% |
| `rollups:verify` one day bucket | 648–1,094 | ≤ 0.51 MiB | — | ≤ 3.4% |
| `rollups:verify` one week bucket | 3,620–3,902 | ≤ 1.53 MiB | — | ≤ 12.2% |
| **`rollups:verify` one month bucket** | **13,406–18,838** | **≤ 7.20 MiB** | — | **≤ 58.9% / 45.0%** |
| `rollups:verify` default sample (latest day + week + month in one call) | 13,373 | 5.27 MiB | — | 41.8% / 32.9% |
| `rollups:verify` a quarter | 27,189–27,514 | 11.7 MiB | — | refuses: "too large to verify in one query" (its 15k-row cap) |
| `rollups:verify` a year | — | — | — | exceeds the limits |
| `rollups:verify` with several month buckets in one call | 32,001 | — | — | exceeds the limits: buckets add up in one transaction |

**Backfill runs:** `backfillAll` at 07:51:06 UTC, marker `rollupsBackfilledAt` at 08:01:36 UTC: **10 min 30 s** for 2,221 chained `backfillStep`s, with no errors and no retries. After the rollback exercise (`unmarkBackfilled`), `rebuildWorkspace` on the same workspace took **2 min 44 s** for 2,758 steps, also with no errors, on a quieter machine. Wall time depends on scheduler latency and machine load more than on the work itself. 1.13M docs were read and 309k written (218 MiB) across the run. In the first run, execution time summed to 198 s; the rest was scheduler latency between the chained steps. The step count is members × (calendar years in the span + 1) plus days / 7 plus the number of periods, not kudos volume. `sourceSpan` pads the span by a day each side, so history that starts on 1 January also covers 31 December of the year before: 501 members × 4 year steps here. A production workspace with ~20 people and a few months of history backfills in well under a minute.

**Local-backend note:** `quests.mine` and App Home take ~0.87 s wall time with only 10–95 docs. The time goes to one `kudos.by_workspace_at … .first()`, which costs 0.7–0.96 s on this SQLite local backend (so does a workspace-prefixed `.first()` on `memberDays`), while range reads of thousands of rollup docs take ~100 ms. User code is 8–19 ms. Convex's 1 s execution limit counts user code only, so this is not a limit risk. Check App Home latency in production after the release anyway (see the runbook).

## Findings

1. **Fix ticket needed: `discoveries.gallery` is capped and silently wrong at scale.** `convex/discoveries.ts` reads `discoveries.by_workspace_firstSeen` with `take(8000)` to count finders per template and distinct collectors. At 500 members the seed holds ~13k discovery rows after 21 months (up to 72 × members eventually). A real workspace holds more: the engine prefers undiscovered messages 65% of the time, and the seed doesn't. The read always hits the cap: 8,037 docs, 25% of the limit and 49% of the old 16k budget. `foundBy` and `collectors` then undercount without any flag. Suggested fix: keep per-template finder counts in a small rollup (`templateStats {workspaceId, templateKey, finders}`, maintained where `discoveries` rows are first inserted, rebuilt by the backfill). Then the gallery reads ≤ 72 rows. Outside this ticket's write scope.
2. **Tooling limit, handled in the runbook: `rollups:verify` must run one bucket per call.** At this scale, verify days, weeks and months, one call each. For large workspaces, cover quarters and years through their months. Production workspaces are small enough to verify `q:`/`y:` directly (as #43's hand-off asks).
3. **Accepted: the legacy scans fail at scale before the backfill** (and after an `unmarkBackfilled` rollback). Production data is orders of magnitude smaller, and the backfill runs right after the deploy.

## The seed helper

`convex/rollups.ts` holds the internal functions and `convex/lib/scaleSeed.ts` the pure generator:

- `internal.rollups.seedScale({ members?, kudosPerYear?, fromDay?, toDay?, teamId? })`: defaults 500 / 50,000 / 1 January last year / today / `T_SCALE_PROOF`. It creates the workspace, members, users and notifications, then chains `seedScaleStep` one day at a time. It writes sources only, like a production workspace before its backfill, except that the seeded rows already carry `hour`, `capped` and `noteWords` (which v1 rows lack). It refuses a team that is already seeded and more than 2,000 members (one transaction). `seedScaleStep` also refuses any workspace that `seedScale` didn't create, even locally (a rehearsal on an imported production snapshot).
- `internal.rollups.seedScaleViewers`: the viewers the measurement signs in as (from the default `T_SCALE_PROOF` team).
- **Guard:** every one of them calls `assertLocalDeployment()`, which throws unless `CONVEX_CLOUD_URL` is a loopback host (`127.0.0.1`, `localhost`, `[::1]`, `0.0.0.0`). It fails closed: a missing or unparsable URL is refused, and so is a look-alike host such as `127.0.0.1.evil.example`. On production the URL is `https://valiant-monitor-701.convex.cloud`, so the seed can't run there even through `npx convex run --prod`. The guard assumes Convex cloud: a self-hosted backend whose cloud origin is left at the default `http://127.0.0.1:3210` would pass it. Tests: `tests/scale-seed.test.ts` (refusals write nothing; a local seed is consistent, backfills and verifies exactly).
- `internal.rollups.unmarkBackfilled({ workspaceId })`: the rollback used by the runbook. It is not guarded, because it's meant for production.

To reproduce:

```sh
CONVEX_AGENT_MODE=anonymous npx convex dev --once          # isolated local backend, writes .env.local
CONVEX_AGENT_MODE=anonymous npx convex dev &                # keep functions pushed
CONVEX_AGENT_MODE=anonymous npx convex logs --jsonl --success > /tmp/scale-logs.jsonl &
CONVEX_AGENT_MODE=anonymous npx convex run rollups:seedScale                     # ~30 min; ends with the log line "seedScale finished: …"
node scripts/scale-proof.mjs /tmp/scale-logs.jsonl > before.json                 # legacy scans
CONVEX_AGENT_MODE=anonymous npx convex run rollups:backfillAll                   # ~10 min; done when the workspace has rollupsBackfilledAt
CONVEX_AGENT_MODE=anonymous npx convex run rollups:mirrorBackfillMarkers
CONVEX_AGENT_MODE=anonymous npx convex run rollups:verify '{"workspaceId":"<id>","buckets":["m:2025-12"]}'
node scripts/scale-proof.mjs /tmp/scale-logs.jsonl > after.json                  # rollups
```

## Production runbook for #9

Production (`valiant-monitor-701`) still runs the pre-map v1 today: no rollup tables and the old `7d`/`30d`/`90d` periods. The release adds the rollup tables. From the moment the new code is live, live gives maintain the rollups, but the readers keep their legacy scans until a workspace carries `rollupsBackfilledAt`. **The backfill is what flips the readers**, one workspace at a time as each finishes. Follow these steps in order; each lists what you should see.

**0. Preconditions.** `main` is at the release commit, `npm run check` is green, and `npx convex login` is done for team `lonir`. Every command below with `--prod` targets `valiant-monitor-701`.

**1. Snapshot the data (the only way back for a code rollback).**

```sh
npx convex export --prod --path ~/kudos-prod-pre-1.1-$(date -u +%Y%m%dT%H%MZ).zip
```

Expected: the command reports the export as complete and the ZIP exists on disk. Keep it until the release is signed off.

**2. Deploy the backend, then the frontend, back to back** (hand-off from #26: browsers left open send the old periods until they reload).

```sh
npx convex deploy -y
npx @convex-dev/static-hosting upload --build --prod
```

Expected: `Deployed Convex functions to https://valiant-monitor-701.convex.cloud`, with the new indexes and the rollup tables listed as added. From here on, every give writes rollups too.

**3. List the workspaces.**

```sh
npx convex data workspaces --prod --format jsonl --limit 1000
```

Note each `_id`. None should carry `rollupsBackfilledAt` yet. A demo workspace with `resettingSince` set is skipped by `backfillAll`, because its reset rebuilds it.

**4. Start the backfill.**

```sh
npx convex run --prod rollups:backfillAll
```

Expected: `null`. It schedules one `rebuildWorkspace` per workspace, which chains `rollups:backfillStep` runs through the phases days → members → periods → all.

**5. Wait until every workspace is marked.** Watch progress in `npx convex logs --prod --success`: a stream of `rollups:backfillStep`, and no failures. Check the markers with:

```sh
npx convex data workspaces --prod --format jsonl --limit 1000 | grep -c rollupsBackfilledAt
```

The count must equal the number of workspaces from step 3 (minus a demo mid-reset). Expected duration: under a minute for a small workspace. 500 members over 21 months took 10.5 min. If a step fails permanently (a red `backfillStep` without a retry), rerun only that workspace. The rebuild is idempotent:

```sh
npx convex run --prod rollups:rebuildWorkspace '{"workspaceId":"<id>"}'
```

**6. Mirror the markers** (hand-off from #29; a no-op for workspaces this release backfilled, but required for any marked earlier).

```sh
npx convex run --prod rollups:mirrorBackfillMarkers
```

Expected: `null`.

**7. Verify every workspace, one bucket per call** (hand-off from #43: production may hold double gives from before that fix, and the rebuild repairs them). First the default sample (latest active day, its week, its month):

```sh
npx convex run --prod rollups:verify '{"workspaceId":"<id>"}'
```

Then each quarter and year that has history, one call per bucket:

```sh
npx convex run --prod rollups:verify '{"workspaceId":"<id>","buckets":["q:2026-Q3"]}'
npx convex run --prod rollups:verify '{"workspaceId":"<id>","buckets":["y:2026"]}'
```

Expected: `{ "checked": […], "mismatches": [] }` for each call. If one fails with `… is too large to verify in one query` (more than 15k kudos or day rows), or with a raw read-limit `Server Error` (a year at hundreds of members), verify that bucket's months instead (`m:YYYY-MM`, one per call). **Any mismatch:** record it on #9, run `rollups:rebuildWorkspace` for that workspace, wait for its marker to update, and verify again. The mismatch must be gone.

**8. Smoke test with a hard reload.** Open the app: Dashboard (Me), Leaderboard (week … all, given and received), Analytics (week … all), Compare, and the Store if enabled. Every page loads and the numbers look plausible. Then give one kudos in the test workspace: the leaderboard and Me update live. In Slack, open the App Home, which should render within about a second. On the Convex dashboard (production, Health / Insights), there are no read-limit warnings for `leaderboard:get`, `analytics:overview` or `me:*`.

**9. Continue with the other release hand-offs** (demo reset `internal.demo.startDemoReset`, e2e tester removal, Slack reinstall). A demo reset wipes and rebuilds the demo's rollups by itself.

### Rollback

- **Wrong numbers on the rollups (readers only; no redeploy).** Send a workspace's readers back to their legacy scans instantly:

  ```sh
  npx convex run --prod rollups:unmarkBackfilled '{"workspaceId":"<id>"}'
  ```

  Expected: `null`, and the workspace no longer shows `rollupsBackfilledAt` in `npx convex data workspaces --prod --format jsonl`. That workspace's leaderboard, analytics, `me`, compare team and App Home read the legacy scans again. Live gives keep maintaining the rollups meanwhile.

  **The rollback does not stick on its own.** Anything that rebuilds the workspace marks it again when it finishes:
  - a `rebuildWorkspace` or `backfillAll` still in flight (wait until the `backfillStep` runs stop before unmarking);
  - `removal:removeMember` for a member of that workspace (the #8 hand-off in step 9);
  - a Slack reinstall of that workspace (`saveInstallation` rebuilds a returning workspace that isn't marked);
  - for the demo, any demo reset, including the nightly cron.

  While a workspace is rolled back, don't run removals or the reinstall for it, and check its marker again after step 9. Once the cause is fixed, `rollups:rebuildWorkspace '{"workspaceId":"<id>"}'` rebuilds and marks it again; then return to step 7. A persistent "pinned to legacy" switch would need a change to `markBackfilled` in `convex/lib/rebuild.ts`, which is not part of this release.
- **Repair a corrupted bucket.** `rollups:rebuildWorkspace '{"workspaceId":"<id>"}'`. It is idempotent and exact under live traffic, and needs no rollback.
- **Code rollback to v1, keeping the data (preferred if the code must go).** Redeploying v1 on its own fails schema validation. v1 is `b797ad3` "Ship the v1 baseline"; confirm it is what production ran before the release. The release wrote fields v1's schema lacks (`kudos.hour`, `memberDays.capped`, `members.currentStreak`/…, `workspaces.rollupsBackfilledAt`) and new tables. Its schema only adds optional fields, new tables and wider unions to v1's tables, so v1's functions run on the release's schema:

  ```sh
  git switch -c rollback-v1 <release commit>
  git checkout b797ad3 -- convex src && git checkout <release commit> -- convex/schema.ts
  npx convex deploy -y --typecheck=disable && npx @convex-dev/static-hosting upload --build --prod
  ```

  No data is lost. The rollup, store, quest and attempt tables stay in the database untouched until you roll forward.
- **Full restore (last resort, only if the data itself is bad).**
  1. Pause the deployment in the Convex dashboard (production → Settings → Pause deployment), so Slack events, crons and queued backfill steps can't write new-schema fields into the restored data.
  2. Restore the snapshot from step 1 and deploy v1:

     ```sh
     npx convex import --prod --replace-all ~/kudos-prod-pre-1.1-<stamp>.zip
     git checkout b797ad3 && npx convex deploy -y && npx @convex-dev/static-hosting upload --build --prod
     ```

  3. Unpause.

  Everything written after the snapshot is lost (kudos, redemptions, settings).
