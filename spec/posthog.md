# Spec: observability and product analytics with PostHog

> **Accepted on 2026-10-13 under Michael's autonomous build-and-ship authority** (map [#1](https://github.com/Silthus/kudos/issues/1) Notes: "accept the spec automatically once it's written"), with every open call at its recommendation (listed under "Further Notes"). A GPT-6.1 Sol review found 12 issues (3 blockers); all were fixed before publishing. Ticket [#69](https://github.com/Silthus/kudos/issues/69). This file lives on the branch `docs/spec-posthog` and is never merged. It is the target design. It ships as the stopping points in [posthog-stopping-points.md](posthog-stopping-points.md); the first one's implementation tickets are in [posthog-core-loop-tickets.md](posthog-core-loop-tickets.md).
>
> Sources: Michael's request (map decision 9: "fully integrating and monitoring it with analytics, error tracking, logging, and so on using PostHog. Feature flags as well, especially product analytics events"), the PostHog research ([#68](https://github.com/Silthus/kudos/issues/68), [report](https://github.com/Silthus/kudos/blob/16e02e9/research/posthog-convex.md)), the architecture ([#11](https://github.com/Silthus/kudos/issues/11)), the core loop spec ([#28](https://github.com/Silthus/kudos/issues/28), [`spec/core-loop.md`](https://github.com/Silthus/kudos/blob/docs/spec-core-loop/spec/core-loop.md)) and its code on `spec/core-loop`, the progression spec ([#13](https://github.com/Silthus/kudos/issues/13)), the groups spec ([#14](https://github.com/Silthus/kudos/issues/14)), ADR-0001 to ADR-0004 and the Coherence lexicon.
>
> **Three of Michael's calls are open** (Convex Professional, one or two PostHog projects, the flags key). This spec makes each one a switch and ships the no-cost position of every switch first. The switches are in "Switches"; flipping one is a settings change, never a migration.

## Problem Statement

HedgeHug runs on a Convex deployment that nobody can see into. Michael can't tell whether people give kudos, how often an attempt fails on the daily allowance, whether edit-to-retry works, or whether new members come back after their welcome message. When something breaks (Slack rejects a delivery, a scheduled job throws, a mutation fails on an unexpected row) the only trace is a line in the Convex dashboard's log view, which nobody watches, and which disappears. There is no safe way to switch a new slice on for the sandbox only, or for a few members first. And every one of these needs a telemetry path that must never leak what members wrote, who they are in Slack, or anything else the public repo and the workspace's trust rule out.

## Solution

HedgeHug sends its product analytics and its errors to PostHog, from the backend only. Every fact the domain already knows (a kudos given, an attempt that ended Over allowance or Invalid, a member welcomed, App Home opened, `/hedgehug` used) becomes a **product event** named from the domain's vocabulary, sent under an opaque **analytics ID** per member, never a Slack ID or name. Each event is written to an **outbox** in the transaction that makes it true and delivered to PostHog's batch endpoint by one drain that checks PostHog's answer and retries a failed batch on a fixed schedule; an event that can't be delivered is given up visibly, never silently, and never blocks a kudos.

Errors that nobody caught (in an HTTP route, an action or a scheduled job) reach PostHog Error Tracking through the same outbox, with the function, the error type and a sanitized message. Expected outcomes (Over allowance, a gone Slack message, a rate limit) are never errors.

Later stopping points add a product and an operations dashboard with a few alerts, logs in PostHog, a feature flag seam with a safe default for every flag, and the events of progression and groups as those ship. Each paid or keyed capability (Convex Professional's native error and log streams, a second PostHog project, the flags key, PostHog's group analytics) is a switch that defaults to the no-cost path.

## User Stories

**Seeing the product**
1. As Michael, I want every kudos given to show up in PostHog within a minute, so that I can see the product being used.
2. As Michael, I want to see how many members gave and how many received kudos this week, so that I know how far recognition spreads.
3. As Michael, I want to see how often attempts end Over allowance or Invalid, so that I know whether the daily allowance and the copy work.
4. As Michael, I want to see how often a failed attempt is retried by an edit and then gives, so that I know whether edit-to-retry is understood.
5. As Michael, I want to see when members are welcomed and whether they give kudos afterwards, so that I can measure activation.
6. As Michael, I want to see how often members open App Home and use `/hedgehug`, so that I know which surfaces matter.
7. As Michael, I want event names I recognize from the domain's vocabulary, so that I don't need a mapping to read a chart.
8. As Michael, I want sandbox traffic never mixed into production charts, so that testing doesn't distort the numbers.
9. As Michael, I want the events of every later slice (XP, levels, perks, coins, achievements, groups, the leaderboard) to follow the same taxonomy, so that the whole game stays readable in one place.

**Privacy**
10. As a member, I want nothing I wrote to leave HedgeHug for an analytics tool, so that a kudos message stays between my colleagues and me.
11. As a member, I want analytics to know me by an opaque ID, never my Slack ID, name, email or time zone, so that a dashboard can't identify me by itself.
12. As Michael, I want an allowlist of properties per event, enforced in code and tested, so that a later change can't leak a field by accident.
13. As Michael, I want error messages and stack traces sent without message text or Slack payloads, so that Error Tracking is safe to look at.

**Reliability**
14. As a giver, I want my kudos to work the same when PostHog is down or slow, so that analytics never costs me a kudos.
15. As Michael, I want an event that failed to deliver retried with the same identity, so that a retry neither loses nor doubles it.
16. As Michael, I want an event PostHog rejects, or one that keeps failing, given up visibly with a count, so that I know data is missing instead of guessing.
17. As Michael, I want analytics switched off when its token or environment is missing, so that a local run, a test or a half-configured deployment sends nothing.

**Errors**
18. As Michael, I want every uncaught error in an HTTP route, an action or a scheduled job to reach PostHog Error Tracking, so that I see breakage without reading Convex logs.
19. As Michael, I want expected outcomes kept out of Error Tracking, so that real errors stand out.
20. As Michael, I want an error reported once, not once per layer it passed through, so that issue counts are honest.
21. As Michael, I want to be alerted to a new production error, so that I find out before a member tells me.

**Operating**
22. As Michael, I want a product dashboard and an operations dashboard in PostHog, so that I have one place to look.
23. As Michael, I want the function logs of production in PostHog Logs once I enable it, so that I can search them next to errors and events.
24. As a developer, I want one flag seam that returns a typed value with a safe default, so that a slice can be dark-launched without a code path that throws.
25. As a member, I want a flag that changed after I earned something never to take it back, so that permanent progression stays permanent.
26. As Michael, I want each paid or keyed PostHog or Convex capability behind a switch with the free path as default, so that I can buy it later without a migration.
27. As Michael, I want the PostHog token kept out of the repository and out of GitHub, so that the public repo leaks nothing.

## Rules

Each rule is a testable statement; tests cite it (`O12`). Core loop rules are cited as `R12`, progression rules as `P45`, groups rules as `G10`. "Member" is R5's member. The **analytics module** is the module this spec adds; it owns the outbox, the analytics IDs and the projections. **Capture is on** for a deployment when O26's conditions hold.

### Product events

- **O1. One taxonomy.** A product event is named `<object> <past-tense verb>` in lowercase words from the lexicon (`kudos given`, `member welcomed`), never a Slack term or a code identifier. Its properties are `snake_case`. The taxonomy below is closed: an event or property not listed here, or in a later stopping point's addition to it, is never sent.
- **O2. Every event carries** `environment` (`sandbox` or `production`, O27), `workspace_key` (O8) and `taxonomy_version` (an integer, 1 for this spec, raised only when an existing event's meaning changes).
- **O3. The core loop's events** (stopping point 1):

  | Event | Sent for | On whom | Properties besides O2 |
  |---|---|---|---|
  | `kudos given` | each attempt with the outcome Given (R15) | the giver | `recipients`, `kudos_per_recipient`, `kudos_total`, `skipped_mentions`, `retry`, `in_thread`, `daily_allowance_opening`, `daily_allowance_left`, `default_kudos_emoji` |
  | `kudos received` | each award (R18) | the recipient | `kudos`, `retry` |
  | `attempt failed` | each attempt with the outcome Over allowance or Invalid (R10, R15) | the giver | `outcome` (`over allowance`, `invalid`), `recipients`, `kudos_per_recipient`, `kudos_total`, `skipped_mentions`, `retry`, `in_thread`, `daily_allowance_left` |
  | `member welcomed` | each member R42 welcomes, when the welcome is decided | the member | `as` (`giver`, `recipient`) |
  | `app home opened` | each `app_home_opened` the adapter accepts for a member (R45) | the member | none |
  | `command used` | each `/hedgehug` or `/kudos` a member types | the member | `command` (`hedgehug`), `alias` (true for `/kudos`), `result` (`joined`, `already in`, `private channel`, `direct message`) |

  `retry` is true when the attempt evaluated an edit of a message whose earlier attempt ended Over allowance or Invalid, or was withdrawn (R23). `recipients` counts recipients (R8), `skipped_mentions` counts skipped mentions (R9), `kudos_total` is the cost (R4). `default_kudos_emoji` is true when the first kudos emoji is the workspace default `:taco:`; the emoji's name is never sent. Attempts that are ignored, withdrawn, abandoned or still waiting (R24, R29, R30) send nothing in stopping point 1.
- **O4. One fact, one event.** Each fact in O3 sends its event exactly once, whatever Slack redelivers and however often a delivery to Slack or PostHog is retried. This rests on the guarantees that already make the fact happen once: an attempt is evaluated once per revision (R19, R21), a member is welcomed once (R44), a Slack event is received once (R49), the bus schedules each subscriber once per publish, and an event is recorded at ingress, never in a retried delivery. A message that gives after a failed attempt sends `attempt failed` for the failure and `kudos given` for the retry.
- **O5. Fact time.** An event's timestamp is the time of its fact: the spend instant (R13) for `kudos given`, `kudos received` and `attempt failed`, the event's own time for the others. It never changes after the event is recorded.
- **O6. Later events** come with the code that makes them true, in the stopping point that builds it. Each addition lists its events and properties in this taxonomy's style before its ticket ships, follows O1–O5 and O10–O14, and raises nothing in `taxonomy_version`. The planned names are in "Events for later stopping points".

### Identity

- **O7. Analytics ID.** Every member has one analytics ID: a random UUID the analytics module creates the first time it records an event for that member and keeps for as long as the member's data exists. It is the event's `distinct_id`. It is never derived from, or sent together with, a Slack ID, a name, an email or a Convex document ID.
- **O8. Workspace key.** Every workspace has one workspace key, a random UUID created the same way and sent as `workspace_key` on every event (O2).
- **O9. Groups later, without a migration.** A domain group (G1) gets a group key the same way when the groups stopping point ships, and events attributed to a group (G10) carry it as `group_key`. PostHog's group analytics is off by default: no `$groups` property and no `$groupidentify` event is sent. With the group analytics switch on (O30), every event also carries `$groups` with `workspace` set to its `workspace_key` and, when it has one, `group` set to its `group_key`, and a group's first event is preceded by a `$groupidentify` with only `environment`. Events from before the switch keep their plain keys, which insights can still break down by.

### What is never sent

- **O10. Never sent** to PostHog, in any event, person property, exception or log: message text or any part of it (R51); mentions or recipient lists; Slack user, team, channel, message, thread or event IDs; names, display names, titles, emails, avatars or time zones; emoji names; annotations; Slack request or response bodies; tokens, secrets or signing material; Convex document IDs; the content of a kudos message's note (thoughtful kudos sends only whether it was thoughtful).
- **O11. Allowlist in code.** Each event's properties are produced by one projection per event from the domain fact, listing every property by name. Nothing forwards a domain object, a row or an error object wholesale.
- **O12. Person properties.** Stopping point 1 sets no person properties. A later stopping point may `$set` only properties its taxonomy addition lists (for example `level`), each a number, a boolean or one of a fixed set of values.

### Delivery

- **O13. Recorded with the fact.** A product event is written to the analytics outbox in the same transaction that makes its fact true, or in the subscriber transaction that the fact's domain event schedules (D12). If that transaction rolls back, the event was never recorded.
- **O14. Stable identity.** Each recorded event gets its UUID, name, `distinct_id` and timestamp once, when it is recorded, and every delivery attempt sends exactly those, so PostHog's deduplication on the four of them can drop a repeat delivery. (PostHog's deduplication is eventual and only covers repeated deliveries of one recorded event; O4, not PostHog, makes a fact one event.)
- **O15. Analytics never blocks the domain.** Recording an event performs no network call, and no outcome, award, allowance or feedback depends on whether an event was recorded or delivered. PostHog being down, slow or rejecting changes nothing a member sees.
- **O16. The drain.** One drain at a time sends due outbox events to PostHog's `/batch/` endpoint on the configured host, at most 100 per request, and only while capture is on (O26). A batch is delivered only when PostHog answers 2xx; delivered events leave the outbox. It is not delivered on any other answer, a network error, or no answer within 10 seconds. Each claim carries a lease token: only the drain holding a row's current token may settle it, so a drain that resumes after its lease expired changes nothing. A drain that crashes holds its batch for at most 2 minutes; a recovery check scheduled for the lease's expiry releases the batch and starts a drain.
- **O17. Promptness.** With capture on, no drain crashed and PostHog answering 2xx, an event recorded now is delivered within 1 minute. After a crashed drain, within 3 minutes.
- **O18. Retries.** A batch PostHog answers with 400 or 413 is **rejected**: its events are given up at once (O19). Any other failure, an unknown result included, retries each event after successive delays of 1, 5, 30, 120 and 360 minutes, so the retries fall 1, 6, 36, 156 and 516 minutes after its first failure (the R29 schedule); an event that fails a sixth time is given up. A retry after an unknown result may make PostHog see the event twice, which O14 lets it deduplicate.
- **O19. Giving up is visible.** An event given up is marked exhausted with the reason (`rejected`, `exhausted`, `expired`) and logged once with a fixed code, the event name and the reason, never its properties. Exhausted events are kept for 7 days and then deleted daily, like receipts (R49).
- **O20. Exceptions never feed back.** A failure of the analytics module's own functions (the drain, the recovery check, the sweep, the heartbeat, the cleanup, the recording mutation) is logged with a fixed code, never recorded as an exception event, so a PostHog outage or a broken reporter can't fill the outbox it is draining.

### Errors

- **O21. What is an error.** An error is an exception nobody caught: a throw out of an HTTP route, an action, or a scheduled mutation or action. Expected outcomes are never errors: an attempt's outcome, an ignored or waiting message, a Slack answer the adapter classifies (R35: a gone delivery, a rate limit, a retried failure), a signature failure (R48), a rejected or retried analytics batch.
- **O22. Reported once.** With native error reporting off (O29), an error is recorded as one `$exception` event in the outbox and delivered like a product event, by one of two reporters:
  - the **error boundary** of the HTTP route or action it left, which records it in its own mutation and rethrows an error whose message starts with the fixed marker `[reported]`, so Convex and Slack still see the failure and no outer boundary or the sweep reports it again. If recording fails, the boundary logs that and rethrows the original error unmarked.
  - the **failed-job sweep**, every 15 minutes, for scheduled functions (mutations above all, and actions that failed before their handler ran). It discovers new scheduled functions from a cursor in bounded pages, keeps every one not yet finished on a watch list, and checks the watch list on each run, so a job seen while pending is still caught when it fails later. It records each failed job whose error doesn't carry the marker, at most once per scheduled-function ID (a report row keyed by that ID, written in the same mutation), and drops finished jobs from the watch list.
- **O23. Exception content.** An `$exception` event's `distinct_id` is `deployment:{environment}` (for example `deployment:production`), never a member's analytics ID. It carries O2's properties, the function's path and kind (`http`, `action`, `mutation`), and PostHog's `$exception_list` with one entry: the error's type, its value and, when the boundary has the error object, its stack frames as file, function and line only (the sweep has only Convex's error string, so its entries carry no frames). The value is the error's message only when the error is a **reportable error**, a class this codebase throws with a message written from fixed text and Slack error codes (such as `channel_not_found`); every other error, including JSON parsing, Convex argument validation and dependency errors whose messages can embed input values, is sent with the fixed value `unexpected error` and its type name.
- **O24. With native reporting on** (O29), boundaries and the sweep record nothing, because Convex's own reporter covers every function kind. Native exceptions use Convex's own schema: `distinct_id` is the deployment name, and they carry `convex_deployment_name` and `convex_deployment_type` instead of O2's properties. In one project, error insights and alerts then filter on `convex_deployment_name`, never on `convex_deployment_type` (the sandbox is a Convex production deployment too).

### Logs

- **O25. Safe log lines.** Every log line this codebase writes is a fixed code plus allowlisted fields (function, outcome, counts, durations, the event name, a Slack error code), never O10's data. This holds with or without a log stream, because Convex Professional's PostHog log stream forwards each line as written. Logs reach PostHog Logs only through the logs stopping point, which first brings every existing line in line with this rule (the core loop has lines that print a Slack user ID).

### Switches and environments

- **O26. Capture is on** only when the deployment has both `POSTHOG_PROJECT_TOKEN` and a valid `KUDOS_ENVIRONMENT` (`sandbox` or `production`). Otherwise nothing is recorded and nothing is sent. Removing either stops recording and sending at once: events already in the outbox stay pending, without a network call and without counting a failure, and are sent when capture is on again; an event still pending 7 days after it was recorded is given up as `expired`.
- **O27. One project or two.** Each deployment's `POSTHOG_PROJECT_TOKEN` decides its PostHog project: the same token on both deployments is one project, two tokens are two projects. Nothing in code depends on which. In one project, every insight, alert and flag filters on `environment`; analytics IDs never collide across deployments because they are random.
- **O28. Host.** Events go to `POSTHOG_HOST`, default `https://us.i.posthog.com`.
- **O29. Native error reporting** (Convex Professional): `POSTHOG_NATIVE_ERRORS=on` turns off manual error capture (O24). It is off by default. Turning it on is paired with configuring Convex's PostHog exception destination on that deployment; turning it on without the destination loses error reporting, so the switch and the destination are changed together. Convex's reporter sends each error's message as it is, so O23's reportable-error rule doesn't protect it: an argument validation error on the ingress mutation, whose arguments hold message text in memory (R51), would send that text. Before turning it on, the switch's owner confirms that no function whose arguments carry text or Slack payloads can throw on its arguments, or keeps the switch off; the recommendation is off even with Professional until that check is recorded.
- **O30. Group analytics** (PostHog's paid add-on): `POSTHOG_GROUP_ANALYTICS=on` adds `$groups` and `$groupidentify` (O9). Off by default.
- **O31. Flags key.** Feature flags evaluate locally only when `POSTHOG_PERSONAL_API_KEY` holds a project secret API key scoped to `feature_flag:read` (the name is the component's). Without it, every flag answers its safe default (O33).
- **O32. Secrets stay out.** The token and the flags key live only in each deployment's Convex environment variables (and the conductor's local config). They are never committed, never in a GitHub issue, comment, pull request or Actions log, and never in a log line.

### Feature flags

- **O33. One seam, safe defaults.** A flag is declared once in code with its key, its value type (boolean or a fixed set of variants), its subject (a member or the workspace) and its safe default. Reading a flag returns its value for the subject, or its safe default when the key is unset, no definitions are cached yet, the definition can't be evaluated locally, or evaluation fails. Reading a flag never throws. A new slice's safe default is off; a flag never gates the core loop's agreed behavior (R1–R51).
- **O34. Allowed targeting.** A flag may target only rollout percentage on the subject's analytics ID or workspace key, and the properties this spec sends (`environment` always, so a flag can be on in the sandbox only). Cohorts, experience continuity and properties HedgeHug doesn't send are not used, because local evaluation can't answer them.
- **O35. Read where it decides.** A flag that affects an award or a permanent effect (ADR-0001, ADR-0002, ADR-0004) is read in the mutation that writes it, and the value used is stored with the effect, so a retry or a later flag change never rewrites what was earned.
- **O36. Exposure.** `$feature_flag_called` is sent once per member, flag and value, from the mutation in which the member first enters the flagged path, with the flag key, the value and `locally_evaluated: true`. Reading a flag in a query is never an exposure.

### Dashboards and alerts

- **O37. Product dashboard** "HedgeHug product", filtered to `environment = production`: kudos given per day; members who gave and members who received, weekly; attempts by outcome (`kudos given` against `attempt failed` by `outcome`); retries that give, as a ratio per week of `kudos given` with `retry = true` to `attempt failed` (a member-level funnel would join unrelated messages, so there is none); activation (`member welcomed` followed by `kudos given` within 7 days); App Home opens and command use per week. It holds no table of members.
- **O38. Operations dashboard** "HedgeHug operations": exceptions per day by function; new error issues; the delivery health signal of O40.
- **O39. Alerts**, at most five (the free plan's insight-alert limit), each proven with a controlled notification before the stopping point ships: a new or reopened production error issue notifies Michael (Error Tracking's issue alert); production `$exception` events above 10 in one hour notify Michael (an hourly insight alert, no data counting as 0); no `analytics heartbeat` from production in 3 hours notifies Michael (O40, no data counting as 0, so it fires). Product behavior is a weekly dashboard subscription, never an alert; a quiet day is not an outage.
- **O40. Delivery health.** The drain logs the count of events given up per day with a fixed code, and, while capture is on, sends one `analytics heartbeat` event per deployment per hour carrying `exhausted_last_hour` and `oldest_pending_minutes`, on `distinct_id` `deployment:{environment}`. A missing heartbeat alerts (O39).

## Implementation Decisions

### Modules

- **Analytics (new)**: the outbox, the analytics IDs and workspace keys, one projection per event, the drain, the heartbeat, the boundary wrapper and the failed-job sweep for errors, and later the flag seam. It subscribes to domain events; it is the only module that knows PostHog, as the Slack adapter is the only one that knows Slack. Every function is internal (R50).
- **Kudos engine (extended)**: publishes the new `attemptFailed` domain event with Over allowance and Invalid outcomes, and adds `retry` and `skippedMentions` to `kudosGiven` (event shapes only grow, D14).
- **Welcome (extended)**: publishes `memberWelcomed` when it decides to welcome a member.
- **Slack adapter (extended)**: reports App Home opens and `/hedgehug` use to the analytics module as platform-neutral usage facts, with the member resolved through the directory. Every `httpAction` and `internalAction` it exports runs inside the analytics module's error boundary.

### Contracts

**Domain events** (additive to the registry):

```ts
type KudosGivenEvent = { /* the core loop's fields */ retry: boolean; skippedMentions: number };
type AttemptFailedEvent = {
  type: "attemptFailed";
  workspace: WorkspaceId; message: MessageRef; giver: MemberId;
  outcome: "over-allowance" | "invalid";
  recipients: number; perRecipient: number; cost: number; skippedMentions: number;
  retry: boolean; inThread: boolean; allowance: { dailyLeft: number };
  day: DayKey; at: number;
};
type MemberWelcomedEvent = { type: "memberWelcomed"; workspace: WorkspaceId; member: MemberId; as: "giver" | "recipient"; at: number };
```

`kudosGiven` grows `inThread` too if the projection can't read it from `message`. The analytics subscribers are mutations, so the bus runs each exactly once.

**Usage facts** from the adapter, written in the mutation that handles them:

```ts
type UsageFact =
  | { kind: "appHomeOpened"; member: MemberId; at: number }
  | { kind: "commandUsed"; member: MemberId; alias: boolean; result: "joined" | "already-in" | "private-channel" | "direct-message"; at: number };
interface Analytics { recordUsage(ctx: MutationCtx, fact: UsageFact): Promise<void> }
```

A person who isn't a member (R47) records nothing. `app home opened` is recorded in the mutation that records the event's receipt (R49), so a redelivered `app_home_opened` and a retried `views.publish` record nothing more. `/hedgehug` is answered by an action: the route passes the command's user, whether it was `/kudos`, and the time it arrived in the action's arguments, and the action records its result through one internal mutation once it knows it. Slack doesn't redeliver slash commands, and the action isn't retried, so each command records once.

**Projections** are pure functions, one per event, table-tested:

```ts
type Scalar = string | number | boolean;
type AnalyticsRecord =
  | { kind: "product"; event: string; subject: { member: MemberId } | "deployment"; at: number; properties: Record<string, Scalar> }
  | { kind: "exception"; at: number; function: { path: string; kind: "http" | "action" | "mutation" }; exception: ExceptionEntry };
type ExceptionEntry = {
  type: string; value: string;   // value: a reportable error's message, else "unexpected error" (O23)
  frames: Array<{ filename: string; function: string; lineno: number }>;
};
function projectKudosGiven(event: KudosGivenEvent): AnalyticsRecord[];   // kudos given + one kudos received per award
function projectAttemptFailed(event: AttemptFailedEvent): AnalyticsRecord;
```

The recording step resolves the subject to its analytics ID (O7), adds O2's properties (and, with O30 on, `$groups`), assigns the UUID (O14) and inserts the outbox row; it does nothing when capture is off (O26). An exception record becomes PostHog's `$exception` event with `$exception_list: [{ type, value, mechanism: { handled: false }, stacktrace: { type: "raw", frames } }]`; the ticket that builds it confirms the shape against PostHog's current manual-capture schema and proves the event appears as an Error Tracking issue, not only that `/batch/` accepted it.

**The outbox and the drain:**

```ts
type OutboxRow = {
  uuid: string; event: string; distinctId: string; timestamp: number;
  properties: Record<string, Scalar | Record<string, Scalar> | ExceptionPayload>; // nested values only for $groups and $exception_list, validated per kind
  state: "pending" | "sending" | "exhausted";
  failures: number; dueAt: number; recordedAt: number;
  lease?: { token: string; until: number }; reason?: "rejected" | "exhausted" | "expired";
};
```

Recording schedules the drain at once unless one is already scheduled or running (a singleton row records that, with the current drain's token). The drain claims up to 100 due rows (pending with `dueAt` reached, or sending with an expired lease) in a mutation that writes a fresh lease token on each and schedules a recovery check for the lease's expiry. It POSTs them in an action with a checked `fetch` (the PostHog SDK's `captureImmediate()` resolves on a 503, #68), and settles them in a mutation that touches only rows still holding its token: delete on 2xx, give up on 400 or 413, otherwise reschedule each by O18. It loops while rows are due, then schedules itself for the earliest `dueAt`. The recovery check releases rows whose lease expired and starts a drain if the singleton's drain is gone; a cron every 10 minutes does the same as a backstop. With capture off, claiming returns nothing (O26). The hourly heartbeat (O40) and the daily cleanup of exhausted rows and expired pending rows are crons too.

**Why an outbox, not the Workpool.** The architecture runs network subscribers through the Workpool. Here the subscriber is a mutation that only writes the outbox, and one drain does the network work: batching, the stable identity of O14, and a visible exhausted state come from one table without a new component, and the delivery state is queryable for O40. The Workpool stays the runner for network subscribers that act on one event (D12).

**The error boundary:**

```ts
function observedHttpAction(name: string, handler: HttpHandler): PublicHttpAction;
function observedAction<Args, Result>(name: string, definition: ActionDefinition<Args, Result>): RegisteredAction;
```

On a throw it records one `$exception` through an internal mutation (its own transaction, so it commits although the caller fails) and rethrows `[reported] {type}`; an error that already carries the marker, from an inner action, is rethrown as it is. If recording throws, it logs a fixed code and rethrows the original error. The failed-job sweep reads Convex's `_scheduled_functions` system table (queryable from queries and mutations; a failed job's `state` holds its error string): it pages through new jobs by creation time from a cursor, adds unfinished ones to a watch list, rechecks the watch list by ID, and records each failed job without the marker once, keyed by its scheduled-function ID. It skips the analytics module's own functions (O20). With `POSTHOG_NATIVE_ERRORS=on` both only rethrow or skip. The analytics module's own actions run outside the boundary (O20): their failures are logged.

**The flag seam** (flags stopping point), over the first-party `@posthog/convex` component's local evaluation:

```ts
type Flag<V extends string | boolean> = { key: string; subject: "member" | "workspace"; safeDefault: V; values: readonly V[] };
function flag<V>(ctx: QueryCtx | MutationCtx, flag: Flag<V>, subject: MemberId | WorkspaceId): Promise<V>;
function exposed<V>(ctx: MutationCtx, flag: Flag<V>, member: MemberId, value: V): Promise<void>; // O36, deduplicated
```

The seam checks O31 before calling the component (which throws without a key) and maps `undefined` and unknown variants to the safe default. The component is installed only in the flags stopping point, because its refresh loop and supervisor cron run even without a key.

### Data (sketch)

`analyticsIds` (member → UUID), `workspaceKeys` (workspace → UUID), later `groupKeys` (group → UUID); `analyticsOutbox` (OutboxRow, indexed by state and `dueAt`); `analyticsDrain` (the singleton); `errorSweep` (the sweep's cursor), `watchedJobs` and `reportedJobs` (scheduled-function IDs, kept 7 days, as long as Convex keeps finished jobs); later `flagExposures` (member, flag, value). None of them holds O10's data.

### Environment variables (per deployment)

| Variable | Holds | Default | Stopping point |
|---|---|---|---|
| `POSTHOG_PROJECT_TOKEN` | the project token (secret, O32) | unset: capture off | 1 |
| `KUDOS_ENVIRONMENT` | `sandbox` or `production` | unset: capture off | 1 |
| `POSTHOG_HOST` | ingestion host | `https://us.i.posthog.com` | 1 |
| `POSTHOG_NATIVE_ERRORS` | `on` with Convex Professional's exception destination | off | 1 |
| `POSTHOG_GROUP_ANALYTICS` | `on` with PostHog's group analytics add-on | off | later events |
| `POSTHOG_PERSONAL_API_KEY` | the flags key, scoped `feature_flag:read` (secret, O32) | unset: safe defaults | flags |

### Events for later stopping points

Planned names, to be confirmed with properties when each stopping point plans its tickets (O6). Progression: `xp earned` (per effects record, on the member: `base_xp`, `bonus_xp`, `side`), `level reached` (`level`), `skill point spent`, `perk bought` (`perk`, a catalogue ID), `perk switched on`, `coins earned`, `item bought` (`item`, `price`), `cosmetic equipped` (`slot`, `rarity`), `cosmetic dropped` (`rarity`), `achievement earned` (`ladder`, `tier`), `chime-in given` (`kudos`), `chime-in threshold reached` (`threshold`), `streak extended` (`length`), `freeze used`, `booster switched on` (`kind`); `kudos given` gains `thoughtful` and `weekly_reserve_spent`. Groups: `primary group picked` (`by`: `welcome`, `settings`, `default`), `leaderboard viewed` (`board`, `period`, `surface`), `leaderboard left` and `leaderboard joined`, `profile card viewed`, `sticker earned`, `album completed`, `aura opted in` and `aura declined`; events attributed to a group gain `group_key` (O9). Catalogue IDs (perks, items, cosmetics, ladders) are the game's own stable IDs, never member data.

## Testing Decisions

- **A good test enters at a seam and checks what Michael or a member could observe**: the requests PostHog receives, the outbox rows another function reads, the HTTP answer Slack gets. It never asserts on private helpers.
- **Seams, highest first:**
  1. **The Slack boundary**, as in the core loop: signed requests through the HTTP router with `convex-test`, with one `fetch` stub that answers Slack's Web API and PostHog's `/batch/`. The test runs the scheduled drain and reads the PostHog requests it made. Covers O1–O5 and O7 end to end for each core loop event, O10 (one test sends a kudos message full of distinctive text, names and IDs through the whole loop and asserts that no PostHog request body contains any of them or any `U…`, `T…`, `C…` ID), O15 (PostHog answering 503 changes nothing Slack sees), O21–O23 for an HTTP route and an action (including malformed JSON and an argument validation error whose input holds distinctive text, which must send only `unexpected error`), and O26 (no token, nothing sent).
  2. **The analytics module's internal functions**: the projections as rule tables (O3, O11); recording and the outbox (O4, O13, O14); the drain with fake timers and a stubbed `fetch` answering 2xx, 400, 413, 429, 503, a network error and a timeout (O16–O20); the sweep over failed scheduled functions, including a job that was pending at one sweep and failed before the next (O22); the boundary with a nested action and with a failing recording mutation (O22); later the flag seam with no key, an empty cache, a seeded definition, an unknown variant and a cohort condition (O31, O33–O36).
- **Exactly once (O4)** is tested by redelivering the same Slack event, and by failing a Slack delivery and a PostHog batch so they retry.
- **Time** uses fake timers for the retry schedule, the lease and the heartbeat.
- **Prior art:** the core loop's Slack boundary tests and its `fetch` stub (`testing/fakeSlack.ts`), the delivery retry tests (R35), and the receipt cleanup test (R49).
- **Sandbox checks are acceptance criteria**, recorded on the pull request without the token: a real kudos in the sandbox app shows `kudos given` and `kudos received` in PostHog's activity view with `environment = sandbox`; a synthetic error in a test-only route shows in Error Tracking; nothing from the sandbox appears in a production-filtered insight.
- **The gate** (`pnpm gate`) is green on every ticket. The analytics component spec declares its invariants with witnessed refutations: only allowlisted properties leave the deployment (O10, O11); an event keeps its identity across delivery attempts (O14); analytics never blocks the domain (O15); an error is reported once (O22).

## Out of Scope

- Client-side analytics, session replay, surveys and web analytics: HedgeHug has no web UI in this map. The website map (sibling of #1) reuses the analytics ID (O7) when it signs members in.
- PostHog's Convex data warehouse source (it exports whole tables; #68).
- Experiments. Flags are for rollout here; an experiment needs its own spec once flags exist.
- Deleting a member's analytics data when they leave the workspace. It belongs with data deletion in "Operating it" (map #1): the plan is to delete the `analyticsIds` row and ask PostHog to delete the person, which needs an API key with person-write scope.
- Paging with phone or on-call tooling, external uptime checks, and alerts on product behavior.
- A Slack notification destination for alerts in the real workspace; alerts go to Michael's PostHog notification email until he picks one.

## Further Notes

**Calls this spec makes (accepted with it, each at the recommendation)**
1. **The event unit is the attempt for the giver and the award for the recipient** (`kudos given` per Given attempt, `kudos received` per award, O3), so active givers and active recipients are one-event insights, and `retry` on `kudos given` measures edit-to-retry without joining events.
2. **Failed attempts get their own event, `attempt failed`, with `outcome`** rather than one `attempt evaluated` event with Given among its outcomes, so `kudos given` stays the headline event and failures read as their own trend.
3. **The analytics ID is a random UUID per member kept by the analytics module** (O7), not the Convex document ID (which would leak a database identifier and change on a rebuild) and not a keyed hash of the Slack IDs (which needs another secret and is reversible by anyone holding it).
4. **Every event is sent with a person profile**, without person properties in stopping point 1 (O12). Person-less events would be cheaper beyond the free allowance but would lose the person timeline; the free allowance covers the core loop.
5. **Delivery goes through an outbox and one checked drain** (O13–O20), not the component's `capture()` and not one Workpool job per event; claims are fenced by a lease token; retries reuse the core loop's successive delays of 1, 5, 30, 120 and 360 minutes; 400 and 413 are given up at once; exhausted rows are kept 7 days; with capture off, pending rows wait up to 7 days.
6. **Errors on the free path are caught at every HTTP route and action boundary and by a 15-minute failed-job sweep** with a watch list for scheduled functions (O22), which closes the gap the research left for Convex Free. A `[reported]` marker on the rethrown error is the correlation that survives Convex's serialization between functions. Only reportable errors send their message; every other error sends `unexpected error` (O23).
7. **Native error reporting stays off even with Professional** until the check in O29 is recorded, because Convex's reporter sends raw messages and an argument validation error can carry message text.
8. **Exceptions are deployment-level** (`distinct_id` `deployment:{environment}`, O23), never joined to a member.
9. **Logs stay in the Convex dashboard until the logs stopping point**; the safe-line rule (O25) applies now so that a later stream leaks nothing.
10. **Alerts are only for errors and delivery health** (O39, O40): three alerts with explicit thresholds, at most five; product behavior is a weekly subscription.
11. **Dashboards are created in PostHog by the operations stopping point**, through the PostHog API or MCP with Michael's access, and their definitions live in this spec (O37, O38).
12. **Group analytics stays off and every event carries plain keys** (O9), so the add-on can be switched on without rewriting history.

**Michael's open choices** (asked by the conductor; each is a switch, the default is shipped):
- **Convex Professional** (O29, logs stopping point): off. On: the PostHog log stream in the logs stopping point after its log audit; `POSTHOG_NATIVE_ERRORS=on` together with Convex's PostHog exception destination only once O29's check is recorded.
- **One PostHog project or two** (O27): one, with the US cloud project token we have on both deployments and `environment` on every event. Two: create a second project and set its token on the sandbox deployment; nothing else changes. PostHog's free plan includes one project.
- **The flags key** (O31): unset, so every flag answers its safe default. Set: a project secret API key scoped to `feature_flag:read` in `POSTHOG_PERSONAL_API_KEY` on each deployment.
- **Group analytics** (O30): off unless Michael opts in.

**Changes to earlier specs (additive)**
- **Core loop (#12, #28):** `kudosGiven` gains `retry` and `skippedMentions` (and `inThread` if needed); the engine publishes `attemptFailed`; welcome publishes `memberWelcomed`. Every `httpAction` and action runs inside the error boundary. No rule changes.
- **Progression (#13) and groups (#14):** each stopping point lists its events (O6, "Events for later stopping points") and adds them in the tickets that build the code.

**Vocabulary to settle in Coherence** (each in the ticket that first uses it): product event, analytics ID, workspace key, outbox, drain, capture, exhausted (for an event), error boundary, failed-job sweep, heartbeat, flag and safe default, exposure.
