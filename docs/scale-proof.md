# Scale proof: the read models at 500 members

- Ticket: [Read models: scale proof at 500 members / 50k kudos](https://github.com/Silthus/kudos/issues/30), ticket 7 of [Scale the dashboard read models](https://github.com/Silthus/kudos/issues/3)
- Measured: 2026-09-24 on `main` at `6526612` (with #22) plus this ticket's tooling, on an isolated local backend (`CONVEX_AGENT_MODE=anonymous`, Convex local backend `precompiled-2026-09-21`)
- Release: the [production runbook](#production-runbook-for-9) at the end is written for [the release](https://github.com/Silthus/kudos/issues/9)

## Result

**Every dashboard read path stays under 7.1% of Convex's per-transaction read limits at 500 members.** The limits are 32,000 documents and 16 MiB. The worst path is the year leaderboard by received: 2,253 docs and 0.98 MiB. It is also under 14% of the older 16,384-doc / 8 MiB limits the research budgeted against. The rollups are exact: every sampled day, week and month bucket verified with no mismatches. The backfill took **10.5 minutes** end to end. No backfill step read more than 5,658 docs (17.7%) or wrote more than 895.

Three things are flagged. None of them is a dashboard read path on the rollups:

1. **`discoveries.gallery` truncates at scale.** It reads the workspace's discoveries with `take(8000)`, and there are 13,332 of them. The read hits the cap on every run, so "found by N teammates" and `collectors` come out silently wrong. It is 25% of the doc limit (49% of the old 16k budget). This needs a fix ticket (see [Findings](#findings)).
2. **`rollups:verify` on a month reads 13–19k docs (up to 59% of the limit).** Quarters and years can't be verified in one call at this scale. The runbook verifies one bucket per call and uses weeks and months only for large workspaces.
3. **Before the backfill, the legacy scans fail at this scale.** The year and all-time analytics and the year leaderboard time out. Month and quarter reads use 43–54% of the limit. This only matters between the deploy and the end of the backfill, and production is far smaller. The runbook starts the backfill right after the deploy.

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
- **Before and after:** the legacy scans were measured after the seed and before the backfill, which is the state production is in right after the deploy. The rollup reads were measured after `backfillAll` + `mirrorBackfillMarkers`.

## Measurements

Docs / bytes read per run. The percentage is the worst of both anchors against **32,000 docs / 16 MiB** (the current limits, <https://docs.convex.dev/production/state/limits>). "Fails" means the query exceeded the limits and was killed ("Your request timed out performing too many system operations").

| Read path | Viewer | Today = 2026-09-24 (docs / bytes) | Today = 2025-12-31 (full year) | Worst % of 32k docs / 16 MiB | Before backfill (legacy scan, 2025-12-31) |
|---|---|---|---|---|---|
| `leaderboard.get week given` | median member | 993 / 0.49 MiB | 1,073 / 0.51 MiB | 3.4% / 3.2% | 3,551 / 1.23 MiB |
| `leaderboard.get week received` | median member | 1,486 / 0.65 MiB | 1,632 / 0.69 MiB | 5.1% / 4.3% | 3,551 / 1.23 MiB |
| `leaderboard.get month given` | median member | 1,262 / 0.58 MiB | 1,283 / 0.59 MiB | 4.0% / 3.7% | 16,825 / 5.24 MiB |
| `leaderboard.get month received` | median member | 1,875 / 0.78 MiB | 1,910 / 0.79 MiB | 6.0% / 4.9% | 16,825 / 5.24 MiB |
| `leaderboard.get quarter given` | median member | 1,455 / 0.66 MiB | 1,470 / 0.67 MiB | 4.6% / 4.2% | 17,270 / 5.39 MiB |
| `leaderboard.get quarter received` | median member | 2,021 / 0.85 MiB | 2,028 / 0.85 MiB | 6.3% / 5.3% | 17,270 / 5.39 MiB |
| `leaderboard.get year given` | median member | 1,742 / 0.82 MiB | 994 / 0.48 MiB | 5.4% / 5.1% | fails |
| `leaderboard.get year received` | median member | **2,253 / 0.98 MiB** | 1,494 / 0.64 MiB | **7.0% / 6.1%** | fails |
| `leaderboard.get all given` | median member | 504 / 0.32 MiB | 504 / 0.32 MiB | 1.6% / 2.0% | 5,503 / 2.01 MiB |
| `leaderboard.get all received` | median member | 504 / 0.32 MiB | 504 / 0.32 MiB | 1.6% / 2.0% | 5,503 / 2.01 MiB |
| `me.overview week` | busiest member | 96 / 0.04 MiB | 99 / 0.04 MiB | 0.3% / 0.3% | 497 / 0.16 MiB |
| `me.overview month` | busiest member | 158 / 0.07 MiB | 178 / 0.08 MiB | 0.6% / 0.5% | 567 / 0.19 MiB |
| `me.overview quarter` | busiest member | 340 / 0.14 MiB | 357 / 0.15 MiB | 1.1% / 0.9% | 737 / 0.27 MiB |
| `me.overview year` | busiest member | 932 / 0.38 MiB | 845 / 0.37 MiB | 2.9% / 2.4% | 1,235 / 0.53 MiB |
| `me.overview all` | busiest member | 1,247 / 0.57 MiB | 944 / 0.39 MiB | 3.9% / 3.5% | 1,236 / 0.53 MiB |
| `me.overview` week … all | median member | 72 … 452 docs | 78 … 375 docs | ≤ 1.4% / 1.2% | 268 … 524 docs |
| `me.standing week` | any | 214 / 0.07 MiB | 292 / 0.10 MiB | 0.9% / 0.6% | 695 / 0.21 MiB |
| `me.standing month` | any | 569 / 0.18 MiB | 667 / 0.22 MiB | 2.1% / 1.4% | 5,695 / 1.72 MiB |
| `me.standing quarter` | any | 644 / 0.21 MiB | 723 / 0.23 MiB | 2.3% / 1.5% | 5,695 / 1.72 MiB |
| `me.standing year` | any | 695 / 0.22 MiB | 781 / 0.25 MiB | 2.4% / 1.6% | 5,695 / 1.72 MiB |
| `me.standing all` | any | 714 / 0.39 MiB | 792 / 0.41 MiB | 2.5% / 2.6% | 1,195 / 0.46 MiB |
| `analytics.overview week` | any | 1,224 / 0.56 MiB | 1,276 / 0.58 MiB | 4.0% / 3.6% | 4,092 / 1.54 MiB |
| `analytics.overview month` | any | 1,454 / 0.65 MiB | 1,456 / 0.66 MiB | 4.5% / 4.1% | 14,825 / 5.46 MiB |
| `analytics.overview quarter` | any | 1,631 / 0.75 MiB | 1,651 / 0.76 MiB | 5.2% / 4.8% | 15,270 / 5.61 MiB |
| `analytics.overview year` | any | 2,048 / 1.01 MiB | 1,390 / 0.74 MiB | 6.4% / 6.3% | fails |
| `analytics.overview all` | any | 576 / 0.39 MiB | 567 / 0.38 MiB | 1.8% / 2.5% | fails |
| `compare.past week / month / quarter / year` | busiest member | 53 / 112 / 338 / 985 | 51 / 135 / 325 / 608 | ≤ 3.1% / 2.8% | same (reads own kudos) |
| `compare.teammate week / month / quarter / year` | busiest vs runner-up | 90 / 147 / 351 / 988 | 90 / 178 / 381 / 1,241 | ≤ 3.9% / 3.6% | same |
| `compare.candidates.list` | busiest member | 503 / 0.32 MiB | — | 1.6% / 2.0% | 503 / 0.25 MiB |
| Slack App Home (`slackData.homeData`, incl. #22's quest section) | busiest / median | 95 / 45 docs | — | 0.3% / 0.2% | 799 / 788 docs |
| `store.balance` (and `store.catalog`) | busiest member | 2 / 0.001 MiB | — | 0.0% | 2 |
| `me.today` | busiest member | 37 / 0.01 MiB | 37 | 0.1% | 37 |
| `quests.mine` | busiest member | 10 / 0.01 MiB | 18 | 0.1% | 18 |
| `session.viewer` | busiest member | 2 | — | 0.0% | 2 |
| **`discoveries.gallery`** | busiest member | **8,037 / 2.83 MiB (capped)** | — | **25.1% / 17.7%** | 8,037 |

Compare "team" ([#12](https://github.com/Silthus/kudos/issues/12)) was not on `main` yet when this was measured. Its read path should be run with `scripts/scale-proof.mjs` once it merges.

### Tooling and backfill

| Transaction | Docs read | Bytes read | Docs written | % of limits (read docs / bytes / written docs) |
|---|---|---|---|---|
| Heaviest backfill step (a month period: its kudos for channels and messages) | 5,658 | 3.04 MiB | 56 | 17.7% / 19.0% / 0.4% |
| Heaviest writing backfill step (a week of day rows) | 619 | 0.29 MiB | 895 | 1.9% / 1.8% / 5.6% |
| `rollups:verify` one day bucket | 648–1,094 | ≤ 0.51 MiB | — | ≤ 3.4% |
| `rollups:verify` one week bucket | 3,620–3,902 | ≤ 1.53 MiB | — | ≤ 12.2% |
| **`rollups:verify` one month bucket** | **13,406–18,838** | **≤ 7.20 MiB** | — | **≤ 58.9% / 45.0%** |
| `rollups:verify` default sample (latest day + week + month in one call) | 13,373 | 5.27 MiB | — | 41.8% / 32.9% |
| `rollups:verify` a quarter | 27,189–27,514 | 11.7 MiB | — | refuses: "too large to verify in one query" (its 15k-row cap) |
| `rollups:verify` a year | — | — | — | exceeds the limits |
| `rollups:verify` with several month buckets in one call | 32,001 | — | — | exceeds the limits: buckets add up in one transaction |

**Backfill run:** `backfillAll` at 07:51:06 UTC, marker `rollupsBackfilledAt` at 08:01:36 UTC: **10 min 30 s** for 2,221 chained `backfillStep`s. No errors and no retries. 1.13M docs were read and 309k written (218 MiB) across the run. The Σ execution time was 198 s; the rest was scheduler latency between the chained steps. The duration scales with members × years (1,500 member steps here) plus days / 7 plus the number of periods, not with kudos volume. A production workspace with ~20 people and a few months of history backfills in well under a minute.

**Local-backend note:** `quests.mine` and App Home take ~0.87 s wall time with only 10–95 docs. The time goes to one `kudos.by_workspace_at … .first()`, which costs 0.7–0.96 s on this SQLite local backend for any workspace-prefixed `.first()` over a large table. User code is 8–19 ms. Convex's 1 s execution limit counts user code only, so this is not a limit risk. Check App Home latency in production after the release anyway (see the runbook).

## Findings

1. **Fix ticket needed: `discoveries.gallery` is capped and silently wrong at scale.** `convex/discoveries.ts` reads `discoveries.by_workspace_firstSeen` with `take(8000)` to count finders per template and distinct collectors. At 500 members a workspace holds ~13k discovery rows after 21 months (up to 72 × members eventually). The read always hits the cap: 8,037 docs, 25% of the limit and 49% of the old 16k budget. `foundBy` and `collectors` then undercount without any flag. Suggested fix: keep per-template finder counts in a small rollup (`templateStats {workspaceId, templateKey, finders}`, maintained where `discoveries` rows are first inserted, rebuilt by the backfill). Then the gallery reads ≤ 72 rows. Outside this ticket's write scope.
2. **Tooling limit, handled in the runbook: `rollups:verify` must run one bucket per call.** At this scale, verify days, weeks and months, one call each. For large workspaces, cover quarters and years through their months. Production workspaces are small enough to verify `q:`/`y:` directly (as #43's hand-off asks).
3. **Accepted: the legacy scans fail at scale before the backfill.** Production data is orders of magnitude smaller, and the backfill runs right after the deploy.

## The seed helper

`convex/rollups.ts` holds the internal functions and `convex/lib/scaleSeed.ts` the pure generator:

- `internal.rollups.seedScale({ members?, kudosPerYear?, fromDay?, toDay?, teamId? })`: defaults 500 / 50,000 / 1 January last year / today / `T_SCALE_PROOF`. It creates the workspace, members, users and notifications, then chains `seedScaleStep` one day at a time. It writes sources only, like a production workspace before its backfill. It refuses a team that is already seeded.
- `internal.rollups.seedScaleViewers`: the viewers the measurement signs in as.
- **Guard:** every one of them calls `assertLocalDeployment()`, which throws unless `CONVEX_CLOUD_URL` is a loopback host (`127.0.0.1`, `localhost`, `[::1]`, `0.0.0.0`). It fails closed: a missing or unparsable URL is refused, and so is a look-alike host such as `127.0.0.1.evil.example`. On production the URL is `https://valiant-monitor-701.convex.cloud`, so the seed can't run there even through `npx convex run --prod`. Tests: `tests/scale-seed.test.ts` (refusals write nothing; a local seed is consistent, backfills and verifies exactly).
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
npx convex data workspaces --prod --format jsonl
```

Note each `_id`. None should carry `rollupsBackfilledAt` yet. A demo workspace with `resettingSince` set is skipped by `backfillAll`, because its reset rebuilds it.

**4. Start the backfill.**

```sh
npx convex run --prod rollups:backfillAll
```

Expected: `null`. It schedules one `rebuildWorkspace` per workspace, which chains `rollups:backfillStep` runs through the phases days → members → periods → all.

**5. Wait until every workspace is marked.** Watch progress in `npx convex logs --prod --success`: a stream of `rollups:backfillStep`, and no failures. Check the markers with:

```sh
npx convex data workspaces --prod --format jsonl | grep -c rollupsBackfilledAt
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

Expected: `{ "checked": […], "mismatches": [] }` for each call. If one says `… is too large to verify in one query` (more than 15k kudos or day rows: only at hundreds of members), verify that bucket's months instead (`m:YYYY-MM`, one per call). **Any mismatch:** record it on #9, run `rollups:rebuildWorkspace` for that workspace, wait for its marker to update, and verify again. The mismatch must be gone.

**8. Smoke test with a hard reload.** Open the app: Dashboard (Me), Leaderboard (week … all, given and received), Analytics (week … all), Compare, and the Store if enabled. Every page loads and the numbers look plausible. Then give one kudos in the test workspace: the leaderboard and Me update live. In Slack, open the App Home, which should render within about a second. On the Convex dashboard (production, Health / Insights), there are no read-limit warnings for `leaderboard:get`, `analytics:overview` or `me:*`.

**9. Continue with the other release hand-offs** (demo reset `internal.demo.startDemoReset`, e2e tester removal, Slack reinstall). A demo reset wipes and rebuilds the demo's rollups by itself.

### Rollback

- **Wrong numbers on the rollups (readers only; no redeploy).** Send a workspace's readers back to their legacy scans instantly:

  ```sh
  npx convex run --prod rollups:unmarkBackfilled '{"workspaceId":"<id>"}'
  ```

  Expected: `null`. That workspace's leaderboard, analytics, `me` and App Home read the legacy scans again. Live gives keep maintaining the rollups meanwhile. After fixing the cause, `rollups:rebuildWorkspace` rebuilds and marks it again. Then return to step 7.
- **Repair a corrupted bucket.** `rollups:rebuildWorkspace '{"workspaceId":"<id>"}'`. It is idempotent and exact under live traffic, and needs no rollback.
- **Full code rollback to v1 (last resort).** Redeploying the old commit alone fails schema validation: the new code wrote fields v1's schema doesn't know (`kudos.hour`, `memberDays.capped`, `members.currentStreak`/…, `workspaces.rollupsBackfilledAt`) and new tables. Restore the snapshot from step 1, then deploy the previous commit:

  ```sh
  npx convex import --prod --replace-all ~/kudos-prod-pre-1.1-<stamp>.zip
  git checkout <previous release commit> && npx convex deploy -y && npx @convex-dev/static-hosting upload --build --prod
  ```

  Everything written after the snapshot is lost (kudos, redemptions, settings). Prefer the readers-only rollback above.
