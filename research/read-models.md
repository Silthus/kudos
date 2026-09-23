# Scaling the dashboard read models (Silthus/kudos#3)

Researched 2026-09-23 for map #1 ("Kudos 1.1"). The question is how the leaderboard (`convex/leaderboard.ts`), analytics (`convex/analytics.ts`) and `me.overview` (`convex/me.ts`) should scale to **~500 members and ~50k kudos per year** within Convex's per-function limits and its reactivity cost. Three designs were compared:

- **(a)** Hand-maintained rollup tables written in the give/revoke transaction.
- **(b)** `@convex-dev/aggregate`.
- **(c)** Snapshots written by a cron.

**Recommendation: (a) rollup tables on calendar-aligned buckets.** The rollups are maintained in the same transaction as give and revoke. A single "recompute from source" routine does the backfill, repairs, and the demo seeding. `@convex-dev/aggregate` is the escalation path if the org grows past a few thousand members or rolling windows become a hard requirement. Cron snapshots are not recommended.

Code facts come from the v1 code in `/home/coder/dev/kudos/convex/` as it is on branch `ticket/2-v1-baseline`, which is not on `main` yet. Platform facts cite primary sources.

---

## 1. Platform facts that constrain the design

**Per-transaction limits.** Each query and each mutation is one transaction with these limits ([limits][limits]):

| Limit | Value |
|---|---|
| Documents scanned | 32,000 |
| Data read | 16 MiB |
| Index ranges (`db.get` + `db.query` calls) | 4,096 |
| Documents written | 16,000 |
| Data written | 16 MiB |
| User-code time | 1 s |
| Array elements per document | 8,192 |

"Documents not returned due to a `filter` count as scanned" ([limits][limits]). Cron-run mutations get no exemption from these limits ([crons][crons]), so any snapshot over more than about 32k documents has to be chunked.

**Reactivity works on index ranges.** A query's read set is the index ranges it scanned. Any committed write inside one of those ranges re-runs every subscribed query that covers it, even when the result would not change ([how-convex-works][hcw]). Cached results are free and "always 100% consistent" ([realtime][realtime], [hcw][hcw]). Everything returned by `.collect()` counts towards bandwidth, and "if any document in the result changes, the query will re-run" ([best practices][bp]).

**OCC and hot documents.** A mutation commits only if every document it read is still at the latest version. Otherwise it is retried ([OCC][occ]). A single document that every call patches becomes a hot spot once calls arrive faster than one can execute. The standard remedies are [sharded counters][sharded] or splitting the data model ([error#1][err1]). Convex also advises moving frequently changing fields into their own table so that other queries are not invalidated ([queries that scale][qts]).

**`@convex-dev/aggregate`** is at 0.3.1 (published 2026-09-03, peer dependency `convex ^1.43`) ([npm][agg-npm], [README][agg]).
- It is a B-tree sorted by key that gives O(log n) `count`, `sum`, `at`, `indexOf`, `min`/`max` and `paginate`, with prefix bounds on tuple keys and namespaces.
- It orders **only by key**. It has no group-by and no "top N by summed value". A leaderboard ranked by total needs a per-user totals table plus a second aggregate keyed by that total, and every change becomes a `replace` (delete + insert) ([README][agg], [client source][agg-src]).
- Writes contend when keys are neighbours. A `_creationTime` key makes "all inserts wait for each other". Namespaces isolate contention but cannot be aggregated across ([README "Read dependencies and writes"][agg]).
- To attach it to an existing table you switch writes to `insertIfDoesNotExist`/`replaceOrInsert`, backfill with `@convex-dev/migrations`, then switch back ([README][agg]).

**`@convex-dev/migrations`** is at 0.3.6. Migrations are defined with `migrations.define({table, migrateOne, customRange?, batchSize?})`. The default batch size is 100 and batches run serially ([migrations][migr]).

## 2. Volume model (assumptions)

The model assumes 500 members and 50k `kudos` rows per year. Each row is one recipient of one message.

- **Kudos per day.** About 250 working days a year gives **~190 rows per working day** and ~137 per calendar day on average.
- **`memberDays` rows.** There is one row per (member, day) with any giving or receiving. At about 180 distinct active members per working day, that is ~0.9–1.0 rows per kudos row, or **~47k a year**.
- **Rows per window.** The table below shows the rows each window contains for `memberDays` (the workspace-wide range) and for `kudos`.

| Window | `memberDays` rows | `kudos` rows |
|---|---|---|
| Full week | ~960 | ~960 |
| 30 days or a month | ~3,900 | ~4,100 |
| 90 days | ~11,700 | ~12,300 |
| 365 days | ~47,000 | ~50,000 |

- **`discoveries`.** At most 500 × 60 = 30k over a workspace's lifetime. A realistic count after year 1 is ~10–15k, with first discoveries concentrated early.
- **Document sizes.** A `memberDays` document is ~150 B. A `kudos` document is ~0.4–0.8 KB because `text` is up to 500 characters. The 16 MiB read limit is therefore never the binding limit. What matters is the 32k scanned-document limit and the bandwidth spent on re-runs.

## 3. What today's queries read at that scale

Every query below starts with `requireViewer` (~4 docs) and `workspaceMembers`, which reads all 500 `members`. The code has defensive `.take()` caps:

- `workspaceDays`: `MAX_DAY_ROWS = 5000` per range.
- `kudosInRange`: 3000.
- `discoveries`: 5000 or 2000.
- `me.overview`: 2000 or 3000 in several places.

Because of these caps the queries **never hit the 32k limit. They return silently wrong numbers instead**, flagged only by a `truncated` boolean.

| Query / period | Docs scanned per run (approx.) | Correct? |
|---|---|---|
| `leaderboard.get` week / 7d | 500 + 960 + 960 + ~100 discoveries ≈ **2.5k** | yes |
| `leaderboard.get` 30d / month | 500 + 3.9k + 3.9k + ~400 ≈ **8.7k** | yes, but each range is at ~80% of its 5k cap |
| `leaderboard.get` 90d | 500 + 5k + 5k + ~1k ≈ **11.5k** | **no.** About 57% of day rows are dropped, oldest first, so ranks and deltas are wrong |
| `leaderboard.get` all | 500 members + 5k discoveries ≈ **5.5k** | **no.** `discoveries`/`legendaryFinds` stop at 5k of ~12k |
| `analytics.overview` 7d | 500 + 960 + 960 + 960 kudos + ~100 ≈ **3.5k** | yes |
| `analytics.overview` 30d / month | 500 + 3.9k + 3.9k + **3k of 4.1k** kudos + ~400 ≈ **11.7k** | **no.** Heatmap, channels, sources, top pairs and message count cover ~73% of the period |
| `analytics.overview` 90d | 500 + 5k + 5k + 3k + 2k ≈ **15.5k** | **no.** Every section is truncated |
| `analytics.overview` all (365d) | 500 + 5k of 47k + 3k of 50k + 2k ≈ **10.5k** | **no.** Covers ~10% of the year |
| `me.overview` 30d | 4 + 960 (workspace week) + ≤2k own days + own kudos ≤3k + 3k + 2k prior + 3.9k team median + ~120 ≈ **6–10k** | mostly |
| `me.overview` 90d | the same, but the team median reads 5k of 11.7k ≈ **9–12k** | team median is wrong |

The table leaves out two further problems:

- **Latent bug in `me.ts`.** `allMine` reads `by_member_day` in ascending order and `.take(2000)`. After about 5–8 years of daily giving it drops the *newest* days, which breaks streaks and the cadence chart.
- **Slack App Home.** `slackData.homeData`/`weekStanding` reads the whole workspace week of `memberDays` (`take(8000)`) on each App Home open.

**Reactivity cost is the bigger problem.**
- **Why each give re-runs every dashboard.** Every give writes today's `memberDays` rows, which fall inside the workspace day-range each dashboard scans. It also patches the giver's and receivers' `members` documents (`totalGiven`/`totalReceived`), which fall inside the 500-member range each dashboard scans. So **every give in the workspace re-runs every open leaderboard, analytics view and `me.overview` in that workspace**. `me.overview` is included because of its workspace-wide "week standing" and team-median reads.
- **Why the cache doesn't help.** The queries depend on the caller's identity, so each viewer has their own subscription and the re-runs are not shared. This is an inference from per-identity query caching.
- **Estimated cost.** Suppose 150 give mutations per working day and 50 dashboards open at once (10% of the org). Each give would then cause about 50 re-runs of 5–12k docs, which is **~250–600k documents read per give and roughly 40–90M per working day**. This estimate is the main reason to shrink what each re-run reads.

## 4. Options compared

| | (a) Rollup tables, calendar buckets | (b) `@convex-dev/aggregate` | (c) Cron snapshots |
|---|---|---|---|
| **Correctness** | Exact and transactionally consistent with give/revoke | Exact | Stale between runs. Revokes and new kudos show up late |
| **Live feel** (core to a gamified app) | Live | Live | Lost |
| **Reads per dashboard run** | ~0.5–2k (§6) | Rolling-window sums are O(log n), but ranking 500 members needs 500 `sum` calls or a second aggregate keyed by total | ~1–5 docs |
| **Rolling windows (7d/30d/90d)** | Workspace-level: yes, by summing day buckets. Per member: only calendar buckets | Yes, and this is its real strength | Only the windows that were precomputed |
| **Distinct counts** (givers, receivers) and top-N by value (pairs, channels, top givers) | Yes. Maintained counters, plus an index on the value field and `order("desc").take(n)` | No. Needs an extra aggregate or table per metric, keyed by value | Yes |
| **Heatmap and channel buckets** | Fields on the bucket doc, plus a small channel table | Needs one aggregate per dimension | Yes |
| **Write cost per give** | ~24 docs for 1 recipient, ~42 for 3. Well under 16k | Several B-tree node writes per aggregate. Neighbouring keys contend | None on the hot path |
| **Contention** | One workspace-day doc and 4 workspace-period docs per give. At ~1 give every 3 minutes (bursts of a few per second) OCC retries are negligible. Sharded counters are the fix if a workspace ever gives >10/s | Tree nodes shared by neighbouring keys, but namespaces isolate them | None |
| **Backfill** | Idempotent recompute-from-source per bucket (§7) | Needs `insertIfDoesNotExist` dual-write, a migrations run, then a switch back | Just run the cron |
| **New dependency / ops surface** | None | One component instance per sort key/sum. Triggers don't fire on dashboard edits | Chunked scheduler jobs, and a cron per workspace × period |
| **Fit at 500 members** | Best | Over-engineered: rank-of-me over ≤500 rows is trivially cheap with a plain index | Wrong trade-off |

**Why not (b)?**
- At 500 members, ranking and median are reads of ≤500 small documents, which an index handles directly.
- The aggregate cannot produce the leaderboard ranking, top pairs, top channels or distinct-giver counts without a second structure keyed by value. You would end up maintaining rollup rows *and* aggregates.
- The case where it wins is *arbitrary rolling windows per member*, for example "top givers over the last 90 days as of right now" at thousands of members. That case is out of scope here (see §8 for the escalation trigger).

**Why not (c)?** Recognition is only rewarding if it is visible immediately. The give confirmation, the leaderboard move and the "you're #3 this week" line all depend on that. A cron would also still need the same paginated scans over 50k rows, chunked across transactions. Snapshots stay a reasonable later option for a heavy, non-live "year in review" artifact. They are not needed now.

## 5. Decisions (made AFK, with rationale)

1. **Periods become calendar-aligned: `week`, `month`, `quarter`, `year`, `all`.** These replace `7d`/`30d`/`90d` and analytics' "last 365 days" in the leaderboard, analytics and `me`.
   - **Why.** Aligned buckets make every per-member number an exact O(members) read. They match how teams talk ("top giver this month"), and the landing page already promises "weekly and monthly rankings".
   - **Previous period.**
     - Workspace-level KPIs and the daily chart compare against the previous bucket up to the same day offset. This is exact and cheap because it sums ≤92 day buckets (≤366 for `year`).
     - Per-member values, ranks and rank changes compare against the **full** previous bucket, i.e. "last week's final rank".
     - `rising` means the member has already beaten their previous-bucket total.
   - **Defaults.** The UI default changes from `30d` to `month` (`src/pages/Me.tsx`, `src/pages/Analytics.tsx`).
2. **Bucket keys are pure functions of `dayKey`.** The four keys are:
   - `w:2026-W39`: ISO week, Monday start, which matches `weekdayOfKey`.
   - `m:2026-09`
   - `q:2026-Q3`
   - `y:2026`

   There is also `all`, and day buckets use `d:2026-09-23`. `dayKey` is already stored on every `kudos` and `memberDays` row in the workspace timezone at write time. Revokes and rebuilds therefore always land in the same bucket, even if the workspace timezone changes later.
3. **Store the local hour on each kudos row.** Add `hour: v.optional(v.number())` to `kudos` (0–23, workspace timezone at write time). The heatmap bucket used by a revoke or rebuild is then stable, and the weekday comes from `dayKey`. The backfill fills in `hour` using the current timezone.
4. **Rollup writes go through one explicit helper (`convex/lib/rollups.ts`)**, not triggers.
   - `giveKudos`, `revokeKudosRow`, `bumpMemberDay`'s maxed/active transitions and `sendBotMessage` (new discoveries) call it.
   - This follows the repo's existing "all writes through engine helpers" pattern, is testable with convex-test, and is what the aggregate README itself prefers over triggers ([README][agg]).
5. **"All time" per-member totals stay on `members.totalGiven/totalReceived/totalMaxedDays`.**
   - An index `by_workspace_totalReceived` is added.
   - A workspace-level `all` bucket holds the org totals and discovery counts.
6. **Keep `memberDays`.** It is the per-member day bucket and the allowance hot path. `memberStats` only adds the week, month, quarter and year buckets.
7. **Split `me.overview` by what invalidates each part.**
   - The personal parts are only invalidated by the viewer's own activity.
   - The workspace-relative parts (week rank, team median) move to a small `me.standing` query.
   - A give by someone else then re-runs a ~500-doc query instead of the whole page.
8. **No sharded counter for now.** The per-workspace bucket docs see about one write every few minutes. Revisit if a single workspace sustains more than ~10 gives per second ([error#1][err1], [sharded counter][sharded]).

## 6. Proposed schema and what each query reads afterwards

```ts
// All counts are sums over kudos rows / memberDays rows whose dayKey falls in the bucket.
workspaceStats: defineTable({
  workspaceId: v.id("workspaces"),
  bucket: v.string(),            // "d:YYYY-MM-DD" | "w:YYYY-Www" | "m:YYYY-MM" | "q:YYYY-Qn" | "y:YYYY" | "all"
  given: v.number(),             // total units given
  kudosRows: v.number(),         // recipient rows
  messages: v.number(),          // distinct batchIds (a batch never spans days, so buckets sum)
  givers: v.number(),            // distinct members with given > 0 in this bucket
  receivers: v.number(),         // distinct members with received > 0 in this bucket
  giverDays: v.number(),         // memberDays rows with given > 0
  cappedGiven: v.number(),       // Σ min(given, dailyLimit at write time) over giver-days → allowanceUse
  maxedDays: v.number(),
  fromReactions: v.number(),
  fromMessages: v.number(),
  heat: v.array(v.number()),     // day bucket: 24 hours; period buckets: 7×24 = 168 (weekday-major)
  found: v.object({ common: v.number(), uncommon: v.number(), rare: v.number(), epic: v.number(), legendary: v.number() }),
}).index("by_workspace_bucket", ["workspaceId", "bucket"]),

memberStats: defineTable({       // w/m/q/y buckets; day = memberDays, all = members.total*
  workspaceId: v.id("workspaces"),
  memberId: v.id("members"),
  bucket: v.string(),
  given: v.number(),
  received: v.number(),
  maxedDays: v.number(),
  activeDays: v.number(),        // days with given > 0
})
  .index("by_member_bucket", ["memberId", "bucket"])
  .index("by_workspace_bucket_given", ["workspaceId", "bucket", "given"])
  .index("by_workspace_bucket_received", ["workspaceId", "bucket", "received"]),

pairStats: defineTable({         // w/m/q/y/all buckets
  workspaceId: v.id("workspaces"),
  bucket: v.string(),
  giverId: v.id("members"),
  receiverId: v.id("members"),
  amount: v.number(),
})
  .index("by_giver_bucket_receiver", ["giverId", "bucket", "receiverId"])   // upsert lookup
  .index("by_giver_bucket_amount", ["giverId", "bucket", "amount"])         // my top recipient
  .index("by_receiver_bucket_amount", ["receiverId", "bucket", "amount"])   // my top supporter
  .index("by_workspace_bucket_amount", ["workspaceId", "bucket", "amount"]), // org top pairs

channelStats: defineTable({      // w/m/q/y/all buckets
  workspaceId: v.id("workspaces"),
  bucket: v.string(),
  channel: v.string(),           // channelName ?? channelId, as analytics does today
  amount: v.number(),
})
  .index("by_workspace_bucket_channel", ["workspaceId", "bucket", "channel"])
  .index("by_workspace_bucket_amount", ["workspaceId", "bucket", "amount"]),

// members: add streak fields maintained on give (recomputed from the member's own memberDays on revoke)
//   currentStreak, longestStreak, lastActiveDay, givenByWeekday: number[7]
// members: add index by_workspace_totalReceived ["workspaceId", "totalReceived"]
// kudos:   add hour: v.optional(v.number())
```

**Writes per give** (1 giver, r recipients), on top of today's writes:

| Table | Docs written |
|---|---|
| `workspaceStats` (day plus w/m/q/y/all) | 6 |
| `memberStats` | 4 × (1 + r) |
| `pairStats` | 5 × r |
| `channelStats` | 5 |
| **Total for r = 1** | **24** |
| **Total for r = 3** | **42** |

Revoke applies the same deltas negated. When the last row of a batch is removed (`by_batch`), it also decrements `messages`. Distinct counters (`givers`, `receivers`, `giverDays`, `activeDays`, `maxedDays`) change only on 0↔>0 transitions of the member's day or bucket row. `bumpMemberDay` already computes `becameMaxed`/`lostMaxed`.

**Yearly row growth** at 500/50k:

| Table | Rows per year |
|---|---|
| `workspaceStats` | ~435 |
| `memberStats` | ~26k |
| `pairStats` | ~100k (~150 B each, ~15 MB) |
| `channelStats` | ~3.5k |

`pairStats` is the largest. Dropping its week bucket would cut about a third of that if storage ever matters.

**Reads per run afterwards.** All results are exact. The "Invalidated by" column says which writes re-run the query.

| Query | Reads | Docs | Invalidated by |
|---|---|---|---|
| `leaderboard.get` (w/m/q/y) | viewer + 2 `workspaceStats` + `memberStats` current (`given>0`, or `received`) ≤500 + previous ≤500 + `members` gets ≤500 | **≤1.5k** (typical ~1k) | any give in the workspace (inherent: it is a live leaderboard) |
| `leaderboard.get` all | viewer + `members` 500 + `workspaceStats` all | **~0.5k** | any give |
| `analytics.overview` (w/m/q/y) | viewer + 2 `workspaceStats` period docs (KPIs, heatmap, sources, found) + day buckets for the daily chart (current ≤92/366 + previous ≤92/366) + top-5 givers + top-5 receivers (index desc) + top-6 pairs + top-8 channels + top-20% givers for `topShare` (≤100) + current and previous givers for new/retained (≤500 + ≤500) + `members` for `teamSize` (500) + ~17 person gets | **~1.3k (month) / ≤2.4k (year)** | any give |
| `me.standing` (new) | `memberStats` (me, week) + rank = count of week rows with `given` > mine (≤500) + `workspaceStats` week `givers` + median = first ⌈givers/2⌉ rows of `by_workspace_bucket_given` for the period (≤250) | **≤750** | any give |
| `me.overview` (personal) | today's `memberDays` + own `memberStats` current/previous (≤4) + own `memberDays` for the cadence chart (≤2 × 120) + streak/weekday fields on `members` (0 extra) + own `pairStats` for top recipient, top supporter and teammates celebrated (≤~150) + own `kudos` in the bucket for channels visited (≤ dailyLimit × days; typical ≤300) + recent 24 + names ≤24 + notifications 5 + discoveries ≤60 | **~0.7k typical, ≤2.5k worst (year)** | the viewer's own gives and receipts only |
| Slack App Home `weekStanding` | `memberStats` week, `by_workspace_bucket_given` desc, `take(5)` + own row | **~10** | any give |

Result:
- The worst case falls from 10–15k truncated reads to ≤2.5k exact reads.
- The per-give re-run cost across 50 open dashboards falls about 5–10×.
- All `truncated` flags and `MAX_DAY_ROWS`-style caps can be removed.

The same `memberStats`/`pairStats` rows also serve **Compare stats (#6)**. The `me.overview` quests block is likely to be replaced by the **Quest system (#5)**. Until then, its "new connection" check can use `pairStats` `all` instead of scanning 2k prior kudos.

## 7. Backfill / migration path

The key idea is to **recompute each bucket from source in one transaction and overwrite it**, rather than replaying kudos rows.

- **Why an overwrite is exact while live writes continue.** A recompute transaction reads the *entire* source range for its target rows and writes absolute values. Convex transactions are serializable, and OCC retries a transaction whose read set changed ([OCC][occ]). So a concurrent live give either commits first, and the recompute sees it, or commits after, and applies its delta on top of the correct absolute value. The result is exact without a write freeze or a cutoff timestamp.
- **Why the units are small enough.** Each unit is sized well under the 32k/16 MiB limits.

The units:

| Unit | Reads (source) | Writes (target) | Size at 500/50k |
|---|---|---|---|
| `rebuildWorkspaceDay(ws, dayKey)` | `memberDays` + `kudos` + `discoveries` (`firstSeenAt` in the day) for that day. Sets `kudos.hour` if missing | `workspaceStats d:` | ~200 + ~200 + few |
| `rebuildMemberYear(member, year)` | that member's `memberDays` for the year (`by_member_day`) | the member's w/m/q/y `memberStats` rows in the year; streak/weekday fields when it is the latest year | ≤366 |
| `rebuildGiverPairs(giver, year)` | that giver's `kudos` in the year (`by_giver_at`) | the giver's w/m/q/y `pairStats` rows | ≤~1.8k |
| `rebuildWorkspacePeriod(ws, bucket)` | the bucket's `d:` `workspaceStats` rows + `memberStats` rows for distinct givers/receivers + `kudos` for `channelStats` (month: ~4.1k; quarter/year sum the month `channelStats`) | `workspaceStats` w/m/q/y + `channelStats` | ≤~4.5k |
| `all` buckets | sum of the year buckets / `pairStats y:` per giver | `workspaceStats all`, `pairStats all`, `channelStats all` | small |

Two ordering constraints apply across units:
- Run week buckets that span a year boundary after both years' member units.
- Run workspace periods after member units.

Rollout:
1. **Widen the schema and dual-write.** Deploy the new tables and optional fields, with the give and revoke paths maintaining rollups from that moment. The rollup helper creates missing rows lazily with the delta, and a later recompute overwrites them.
2. **Backfill.** An internal driver walks each workspace's day range (`kudos` `by_workspace_at` min → today) and schedules the units in dependency order. Each unit reschedules the next with `ctx.scheduler.runAfter(0, …)`, as `demo.seedHistory` already does.
   - `@convex-dev/migrations` is optional here. The units are keyed by (workspace, day/member/year), not by one table's documents, so a hand-rolled chained scheduler fits better and adds no component.
   - The driver records `rollupsBackfilledAt` per workspace, stored in the workspace's `all` `workspaceStats` doc rather than the settings document, so that finishing the backfill doesn't invalidate every query.
3. **Verify.** An internal query compares, for a sample of buckets, the rollup values against the legacy computation from `memberDays`/`kudos` over the same day range. Run it on the local backend with a 500-member/50k-kudos seed and against prod after backfill.
4. **Flip the readers.** The leaderboard, analytics, `me` and App Home switch to rollups, gated on `rollupsBackfilledAt` so that each reader has a fallback until the backfill is done.
5. **Clean up.** Delete the legacy range scans, the `truncated` flags and the caps.

**The rebuild units get two more uses.**
- They become the **repair tool** (`internal.rollups.rebuildWorkspace`).
- The **demo seeder** can use them. `demo.seedHistory` bulk-inserts `kudos`/`memberDays` directly, so after seeding it calls the rebuild instead of maintaining rollups inline. `resetDemoWorkspace` must also delete `workspaceStats`/`memberStats`/`pairStats`/`channelStats` rows (add them to `DEMO_TABLES`).
- **Member removal (#8)** must delete the member's `memberStats`/`pairStats` rows and re-run the affected workspace periods.

## 8. When to escalate to `@convex-dev/aggregate`

Adopt it, as `TableAggregate` on `kudos` with `namespace: workspaceId`, `sortKey: [at]` and `sumValue: amount`, plus per-member namespaces, if any of these become true:

- **Rolling per-member windows become a product requirement.** An example is "last 30 days" leaderboards.
- **A workspace grows past ~5k active members.** Rank-of-me and median via ≤N reads then stop being cheap. At that point, switch those two to an aggregate keyed by `[bucket, -given]`, using `indexOf`/`at` ([README][agg]).

The rollups designed here stay useful in both cases.

## 9. Proposed implementation tickets

1. **Rollup tables and transactional maintenance.**
   - **Question.** How do we add `workspaceStats`/`memberStats`/`pairStats`/`channelStats`, `kudos.hour` and the `members` streak/weekday fields, and maintain them exactly inside `giveKudos`, `revokeKudosRow` and `sendBotMessage` so that give and revoke round-trip to zero? The distinct counters must follow 0↔>0 transitions, and the tests must prove the rollups equal a recomputation from `memberDays`/`kudos` after random give/revoke sequences.
   - **Blocked by:** #2.
   - **Write scope:** `convex/schema.ts`, `convex/lib/buckets.ts` (new: bucket keys from `dayKey`), `convex/lib/rollups.ts` (new), `convex/engine.ts`, `convex/lib/rollups.test.ts` / `convex/lib/buckets.test.ts` (new).
2. **Recompute-from-source rebuild, backfill driver and verification.**
   - **Question.** How do we implement the idempotent rebuild units from §7, a chained per-workspace backfill driver that records `rollupsBackfilledAt`, and an internal verification query? The demo seeder and reset must use the rebuild and wipe the rollup tables. Tests must show that a rebuild overwrites a corrupted bucket exactly and that the demo reset leaves no rollup rows.
   - **Blocked by:** ticket 1.
   - **Write scope:** `convex/rollups.ts` (new: internal functions), `convex/lib/rollups.ts`, `convex/demo.ts`, tests.
3. **Calendar-aligned periods.**
   - **Question.** How do we replace `7d`/`30d`/`90d` with `week`/`month`/`quarter`/`year`/`all` in `periodValidator`/`resolvePeriod`? `resolvePeriod` must return the current and previous bucket keys plus day ranges, with "to-date" previous ranges for workspace KPIs. The period pickers and defaults must be updated to `month`, and the legacy readers must keep working on the new ranges.
   - **Blocked by:** #2.
   - **Write scope:** `convex/lib/time.ts`, `convex/lib/time.test.ts`, `src/pages/Me.tsx`, `src/pages/Analytics.tsx`, `src/pages/Leaderboard.tsx`. Ticket 1 and ticket 3 can run in parallel.
4. **Leaderboard and Slack App Home on rollups.**
   - **Question.** How do we rewrite `leaderboard.get` and `slackData.weekStanding`/`homeData` to read only `memberStats`/`workspaceStats`/`members`, as in the §6 table? This includes rank change and rising against the full previous bucket and discovery highlights from `found`. It also means removing `truncated`, with tests on a seeded workspace.
   - **Blocked by:** tickets 2 and 3.
   - **Write scope:** `convex/leaderboard.ts`, `convex/slackData.ts`, `convex/lib/stats.ts`, `src/pages/Leaderboard.tsx`, tests.
5. **Analytics on rollups.**
   - **Question.** How do we rewrite `analytics.overview` so that KPIs, the daily chart (with a to-date previous overlay), the heatmap, sources, channels, top givers/receivers/pairs, `topShare`, new/retained and rarity all come from the rollups, and so that it reads ≤2.4k docs for a year? This also means dropping the "last 365 days" special case and the `truncated` flag.
   - **Blocked by:** tickets 2 and 3.
   - **Write scope:** `convex/analytics.ts`, `convex/lib/stats.ts`, `src/pages/Analytics.tsx`, tests.
6. **`me` on rollups, split by invalidation.**
   - **Question.** How do we split `me.overview` into a personal query (own `memberDays`/`memberStats`/`pairStats`/`kudos`, streak and weekday from `members`) and a small `me.standing` query (week rank, team median)? The ascending `take(2000)` bug in `allMine` must be removed, and the quests block's scan of 2k prior kudos replaced with a `pairStats all` lookup. This must be coordinated with the Quest system spec (#5), which may replace the block entirely.
   - **Blocked by:** tickets 2 and 3.
   - **Write scope:** `convex/me.ts`, `src/pages/Me.tsx`, tests.
7. **Run the backfill in production and prove it at scale.**
   - **Question.** How do we seed 500 members and 50k kudos on a local backend, run the backfill and verification, and record the docs read by each dashboard query (the Convex dashboard's function metrics or the insights logs)? Then, in the release, how do we run the backfill against production, verify it, and only then ship the reader flip?
   - **Blocked by:** tickets 4, 5 and 6. Fold it into or coordinate it with the release task #9.
   - **Write scope:** `convex/rollups.ts` (seed helper, dev only), `research/` or the ticket proof bundle. No product files.

## Sources

- [limits] Convex production limits: https://docs.convex.dev/production/state/limits
- [bp] Convex best practices: https://docs.convex.dev/understanding/best-practices
- [occ] OCC and atomicity: https://docs.convex.dev/database/advanced/occ
- [err1] Write conflicts (error #1): https://docs.convex.dev/error#1
- [realtime] Realtime and caching: https://docs.convex.dev/realtime
- [hcw] How Convex works (read sets, subscriptions): https://stack.convex.dev/how-convex-works
- [qts] Queries that scale: https://stack.convex.dev/queries-that-scale
- [crons] Cron jobs: https://docs.convex.dev/scheduling/cron-jobs
- [agg] `@convex-dev/aggregate` README: https://github.com/get-convex/aggregate/blob/main/README.md
- [agg-src] `@convex-dev/aggregate` client source: https://github.com/get-convex/aggregate/blob/main/src/client/index.ts
- [agg-npm] npm registry: https://registry.npmjs.org/@convex-dev/aggregate
- [agg-post] Efficient count/sum/max with the aggregate component: https://stack.convex.dev/efficient-count-sum-max-with-the-aggregate-component
- [sharded] `@convex-dev/sharded-counter`: https://github.com/get-convex/sharded-counter
- [migr] `@convex-dev/migrations`: https://github.com/get-convex/migrations
- Code: `convex/schema.ts`, `convex/engine.ts`, `convex/lib/stats.ts`, `convex/leaderboard.ts`, `convex/analytics.ts`, `convex/me.ts`, `convex/slackData.ts`, `convex/demo.ts` (v1 baseline, ticket #2).

[limits]: https://docs.convex.dev/production/state/limits
[bp]: https://docs.convex.dev/understanding/best-practices
[occ]: https://docs.convex.dev/database/advanced/occ
[err1]: https://docs.convex.dev/error#1
[realtime]: https://docs.convex.dev/realtime
[hcw]: https://stack.convex.dev/how-convex-works
[qts]: https://stack.convex.dev/queries-that-scale
[crons]: https://docs.convex.dev/scheduling/cron-jobs
[agg]: https://github.com/get-convex/aggregate/blob/main/README.md
[agg-src]: https://github.com/get-convex/aggregate/blob/main/src/client/index.ts
[agg-npm]: https://registry.npmjs.org/@convex-dev/aggregate
[sharded]: https://github.com/get-convex/sharded-counter
[migr]: https://github.com/get-convex/migrations
