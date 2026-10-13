# PostHog for the Kudos Convex backend

Research for [#68](https://github.com/Silthus/kudos/issues/68), feeding [spec #69](https://github.com/Silthus/kudos/issues/69). Checked 2026-10-13. This is a research branch, not an implementation or an accepted spec. Coherence record: `d-76cfcee2`.

## Recommendation

Use the official `@posthog/convex` component for durable, locally evaluated flags. Send product events through a small, status-checked PostHog capture adapter in the event bus's network subscriber, with the architecture's Workpool retry boundary. Use Convex's native PostHog exception reporting and OTLP log stream when a Convex Professional plan is available. Keep sandbox and production in separate PostHog projects, with deployment properties on both. These are research recommendations for #69 to accept or change. [PostHog Convex guide][PConvex], [component directory][Directory], [Convex integrations][Integrations], [environment guidance][Environments], [runtime probe evidence](#runtime-probe-evidence).

The important delivery caveat: the component's `capture(ctx, ...)` schedules another action rather than awaiting ingestion. Its action uses `captureImmediate()`, which in the tested SDK **emits an error and resolves on a failed HTTP request**. Neither awaiting the wrapper nor awaiting the component action alone proves delivery. A Workpool retry needs an actual thrown delivery failure. Use a checked `fetch` to `/batch/`, or explicitly observe and propagate SDK errors. [Component client][ComponentClient], [component actions][ComponentLib], [SDK core][Core], [failure probe](#runtime-probe-evidence).

## What is available today

The Convex component directory lists a verified, PostHog-maintained `@posthog/convex` package. PostHog's guide requires Convex 1.39 or newer. The researched package versions were `@posthog/convex` **2.1.5**, `posthog-node` **5.55.2**, and `@posthog/core` **1.58.0**; the probe used Convex **1.46.0**. Source references below pin the published SDK tags rather than a moving `main`. [Directory], [PConvex], [component package][ComponentPackage], [Node package][NodePackage], [probe evidence](#runtime-probe-evidence).

There are also first-party Convex dashboard destinations for **PostHog Logs** and **PostHog Error Tracking**, both gated on Convex Pro. A Convex data warehouse source exists too, requiring Convex Professional streaming export and a deployment URL/key. It is unnecessary for the five requested capabilities and would expand the data exported, so do not add it as part of this integration without a separate spec decision. [Log streams][Logs], [exception reporting][Exceptions], [warehouse connector][Warehouse].

| Capability | Default Convex runtime | Node actions | Component / native integration |
| --- | --- | --- | --- |
| Product events | Direct network capture works in actions and HTTP actions. Queries and mutations cannot perform network capture. | Ordinary `posthog-node` works in a `"use node"` action. | Component capture/identify/groupIdentify schedule delivery from mutations or actions, not queries. |
| Exceptions | Manual edge capture works in an action. A failing mutation cannot persist scheduled exception capture in its own transaction. | Manual Node SDK capture is available; process autocapture is not a substitute for Convex execution reporting. | Native Pro exception reporting covers default/Node executions, including queries, mutations, actions and HTTP actions. |
| Logs | `console` works in Convex functions. Direct OTLP HTTP export is action-only. | OTel Node exporters belong in Node actions and need an awaited flush. | Native Pro PostHog log stream covers console and function execution logs. |
| Flags | Component local evaluation reads cached definitions in queries, mutations and actions. Remote evaluation is action-only. | Node SDK remote/local APIs work, but an in-memory poller alone is a poor short-lived-function cache. | Component persists definitions and refreshes them in the background. |
| Monitoring | Emit domain/operational signals from the permitted seams; query them in PostHog. | No Node runtime is required for PostHog dashboards or alerts. | PostHog dashboards and alerts consume the captured signals; Convex Health remains useful. |

Runtime claims: [Convex runtimes][Runtimes], [HTTP actions][HTTP], [component client][ComponentClient], [component actions][ComponentLib], [Convex log streams][Logs], [exception reporting][Exceptions], [Node exception setup][NodeErrors], [local evaluation][LocalFlags], [alerts][Alerts], [Convex Health][Health], [probe evidence](#runtime-probe-evidence).

The literal import `from "posthog-node"` did **not** bundle in the default runtime: it pulled in `path`, `node:zlib`, `node:os`, `node:fs`, and other Node modules. The explicit `from "posthog-node/edge"` import did bundle; import/construction succeeded even in a query and mutation, but capture failed there. Thus “imports successfully” and “may perform I/O here” are separate questions. The component itself imports the edge entrypoint. No Node action is needed just to send events or exceptions from an action. [Node entrypoint exports][NodePackage], [component actions][ComponentLib], [probe evidence](#runtime-probe-evidence).

## 1. Product analytics events

### Wiring and identity

The intended architecture publishes domain events through one registry and runs network subscribers in a Workpool. At the inspected `spec/core-loop` commit, the registry currently schedules subscribers directly with `ctx.scheduler.runAfter`; its only registered `kudosGiven` subscriber is welcome handling. The event includes workspace, giver, recipients/awards, allowance, time, message reference and annotations. This research changes none of it. Add analytics at that registry seam, not in the Slack parser or each domain engine. [Architecture #11][Architecture], [inspected bus][Bus], [event shape][Events].

Recommendation: build an allowlisted analytics projection of a domain event. Never forward the domain object wholesale. Emit an accepted-kudos event on the giver's stable member identity; #69 must choose whether receipt is a separate event per recipient and whether one event represents a message, an award, or an individual kudos. Keep raw message references and annotation contents out unless individually justified. These are taxonomy choices, not SDK requirements. [Event shape][Events], [ticket guardrails][Ticket].

PostHog uses `distinct_id` to connect events, and the same string is needed across sources for one person timeline. Recommendation: use a deployment-independent, opaque member analytics ID mapped to the workspace/user identity, so a future website can reuse it. A Convex member document ID is the simpler option if rebuild/import lifetime and future identity sharing are accepted explicitly. Do not use display names or emails. Opaque IDs remain identifiers, not anonymous data; #69 should define deletion and retention. [Identity resolution][Identity], [PConvex], [member schema][Schema], [ticket guardrails][Ticket].

PostHog groups are event associations. Define `workspace` as one group type and the domain's `group` as another, using opaque stable keys. Call `groupIdentify` with only allowlisted properties; attach group keys in `groups` on each event. A project supports up to five group types, and an event can reference only one group of a given type. Members can belong to several domain groups, so #69 must choose a primary-group attribution or separate group facts instead of sending an array under `groups.group`. [Group analytics][Groups], [component group methods][ComponentClient], [groups decision #10][GroupDecision].

### Delivery and short-lived functions

Convex scheduling from a mutation commits atomically with the mutation; a rollback cancels the schedule. Scheduled actions are at-most-once and are not automatically retried by Convex. This gives a good “publish only after acceptance” seam, but not durable external delivery by itself. Preserve the architecture's Workpool boundary for network delivery, and decide bounded retries, exhausted-job handling and retention in #69. [Scheduled functions][Scheduling], [Architecture], [rollback probe](#runtime-probe-evidence).

The smallest retryable transport is a default-runtime action/helper that POSTs a JSON batch to `https://us.i.posthog.com/batch/` using the deployment's project token and throws on a non-success response. PostHog's capture/batch API is public ingestion, authenticated by the project token; no personal API key is needed. Check the response status without logging the token, request payload, or response body. Keep capture out of Slack's acknowledgement path. This transport returned HTTP 200 in the local-backend probe. [Capture API][Capture], [HTTP actions][HTTP], [probe evidence](#runtime-probe-evidence).

Reuse a stored event UUID, name, original occurrence timestamp and distinct ID across retries. PostHog eventually deduplicates on **all four**, not UUID alone; reissuing the same event with a new timestamp can prevent deduplication. This is not an immediate exactly-once guarantee, and domain accounting must stay in Convex. #69 must specify the stable event identity, which the inspected domain event does not currently expose as an explicit event ID. [Event deduplication][Dedup], [event shape][Events], [component UUID/timestamp forwarding][ComponentClient].

`posthog-node` capture queues events. The tested defaults are a 20-event flush threshold and a 5-second interval. In a short-lived function, a threshold or timer is not proof of completion: Convex says to await all action promises. For an ephemeral Node/edge client, await an explicit flush/shutdown; for a reused client, flush per invocation rather than shutting it down. `flushAt: 1, flushInterval: 0` avoids an idle batching timer, but does not itself await delivery. `captureImmediate()` awaits its transport work but needs error-event handling to distinguish failure. [Node client defaults and capture][NodeClient], [SDK queue/flush/shutdown][Core], [dangling promises][Actions], [probe evidence](#runtime-probe-evidence).

The component uses `flushAt: 1, flushInterval: 0`, a cached edge client and `captureImmediate()` for its scheduled capture action. It does not maintain a durable cross-invocation event batch; its durable tables hold flag definitions and refresh-loop state. Recommendation: send a bounded batch per subscriber job if one accepted domain event yields several analytics records. Do not add a periodic aggregation buffer until traffic or cost justifies it. [ComponentLib], [component schema][ComponentSchema], [Capture].

**Build estimate:** roughly 1–2 engineer-days for the projection, identities, retry-aware adapter and focused integration verification once the bus/Workpool seam is ready. This is an engineering estimate, not a vendor commitment. An explicit persistent outbox/dead-letter interface would add scope. **Needs Michael:** no new secret for capture; decide whether to enable the paid group analytics add-on. [Capture], [Groups].

## 2. Error tracking

Prefer the native Convex PostHog Error Tracking destination when Pro is available. Configure each deployment under Settings → Integrations with its project token and `https://us.i.posthog.com`; Convex adds the endpoint path. It sends `$exception` events with stack traces, function name/type/runtime, deployment name/type and request ID. The documented types are `query`, `mutation`, `action`, and `http_action`; scheduled callbacks execute as their underlying function type. A deployment acceptance check should throw a synthetic error from each type, including scheduled mutation and action callbacks. Native cloud reporting itself was not configured or tested in this research. [Exceptions], [Scheduling].

For unauthenticated functions, native exception `distinct_id` falls back to the deployment name; authenticated functions use `tokenIdentifier`. Slack HTTP ingress does not authenticate as a Convex member, so native errors should be treated as deployment-level diagnostics unless #69 adds a deliberately sanitized association. Do not assume these exceptions automatically join the opaque product-member timeline. [Exceptions], [HTTP], [Architecture].

Use explicit manual capture for **caught** failures that never reach the platform reporter and for sanitized domain context. The component schedules `captureException` from mutations/actions; raw `posthog-node/edge` `captureExceptionImmediate` worked in a default action with HTTP 200. Native reporting bypasses the component's `beforeSend`. The component's callback also does not scrub normalized exception message/stack/name: it receives the additional properties while the error fields are forwarded separately. Sanitize exception content before invoking manual capture, and make thrown/logged errors safe before enabling the native destinations. [ComponentClient], [ComponentLib], [probe evidence](#runtime-probe-evidence).

Do not implement `catch → schedule captureException → rethrow` inside a mutation: rethrow rolls back the scheduled report. Queries cannot schedule it at all. Node process exception autocapture watches uncaught exceptions/unhandled rejections; PostHog's own guide documents that framework handling can prevent this hook from seeing exceptions. There is no basis for assuming that installing it automatically observes every Convex invocation. On Free/Starter, choose an explicit action boundary for manual reporting, or accept a coverage gap for failed query/mutation executions until Pro/native reporting is enabled. [Scheduling], [Runtimes], [NodeErrors], [rollback probe](#runtime-probe-evidence).

**Build estimate:** 0.5–1 engineer-day for native configuration, error-content review and synthetic coverage checks. Manual boundary wrappers add roughly 1–2 days and still require an explicit coverage policy. **Needs Michael:** Convex Professional for native reporting; project token only, no personal API key. #69 must decide expected domain rejection vs exception, scrubbing, native/manual overlap, and whether repeated delivery retries should create separate incidents. [Exceptions], [NodeErrors].

## 3. Logs

Convex Pro log streams support Axiom, Datadog, **PostHog**, and a custom webhook. The PostHog destination takes the project token, optional host and optional `service.name` (default: deployment name). It sends OTLP logs, with deployment resource attributes and the full Convex event as the body. The stream includes console events and execution events; execution records expose duration, success/failure and error details. Configure separate destinations for sandbox and production. [Logs].

Use the **native PostHog destination**, not the generic webhook pointed at the PostHog logs URL. The generic webhook sends Convex's JSON event array and an HMAC signature; PostHog Logs expects OTLP with project-token authentication. A webhook path would need a receiver to verify the signature, transform and redact the events, then POST OTLP. That bridge buys control but adds infrastructure and failure modes. [Logs], [Node logs installation][NodeLogs].

Keep operational logs as `console` statements containing fixed codes and allowlisted fields: function/request identity, deployment, event/job identity, outcome and duration. Native console messages are serialized strings and may include truncated content; avoid dumping Slack requests, message text, member directories, API responses or thrown objects. This is a recommendation grounded in the stream's full-body forwarding and #68's privacy constraints. [Logs], [Ticket].

On Free/Starter, code-based logging is possible: export selected records from an action to `https://us.i.posthog.com/i/v1/logs` with OTLP and `Authorization: Bearer <project token>`. Node OTel SDK/exporters require Node actions; direct OTLP JSON via `fetch` works in the default runtime and returned HTTP 200 in the probe. Await a `forceFlush`/shutdown when using a batching OTel exporter. This fallback observes only what code emits through that path; it does not drain all Convex function logs. Ordinary analytics `capture` is not the PostHog Logs transport. [NodeLogs], [Runtimes], [Actions], [probe evidence](#runtime-probe-evidence).

**Build estimate:** 0.5–1 engineer-day for native setup, log-content review and verification; roughly 1–2 days for a custom exporter or redaction bridge. **Needs Michael:** Convex Professional for a full native log stream; project token only. #69 must choose full native streams versus a selective custom stream, retention, verbosity/sampling and whether structured application context needs OTLP attributes as well as the native string body. [Logs], [NodeLogs].

## 4. Feature flags

Use the component's local evaluation for the domain seam. Its client reads definitions from a component query, then evaluates locally with the provided distinct ID and person/group properties. Because definitions are stored in Convex, queries can react to definition changes and mutations evaluate against the transactional data snapshot. This is deterministic for the same definition snapshot and inputs; it is not a promise that an action's separate queries/mutations all see the same snapshot. Read/apply the flag at the authoritative mutation when it affects an award or permanent progression outcome. [ComponentClient], [ComponentSchema], [Runtimes], [Actions], [seeded flag probe](#runtime-probe-evidence).

Credentials differ by evaluation path:

- **Remote:** project token only; component `evaluateFlag`, `evaluateFlagPayload` and `evaluateAllFlags` call actions. They cannot run in a query/mutation. [PConvex], [ComponentLib].
- **Local:** a read-authorized secret to fetch definitions. Current PostHog docs recommend a project secret API key (`phs_`) scoped to `feature_flag:read`; legacy personal API keys (`phx_`) continue to work. The component still takes either through the environment variable named `POSTHOG_PERSONAL_API_KEY`. It must stay server-side. Encrypted payload requests may still need a personal API key. [LocalFlags], [PConvex], [component env schema][ComponentConfig].

The default refresh interval is 60 seconds. In **2.1.5**, it is a self-rescheduling mutation/action chain plus an unconditional five-minute supervisor cron, not just one simple interval cron. `POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS` tunes the chain at runtime; `POSTHOG_DISABLE_LOCAL_EVALUATION` stops it even with a key present. The supervisor can take up to its next tick to bootstrap/recover the loop, so do not assume a cold deployment is ready after exactly one minute. The supervisor still incurs a function call without a key; longer polling reduces fetch/loop work but does not remove that floor. [Refresh implementation][ComponentLib], [supervisor cron][ComponentCrons], [ComponentConfig].

A local call without a configured key **throws**. With a key but no cached definitions it returns `undefined` (our wrapper represented it as `null` for Convex). Unsupported conditions such as experience continuity, static cohorts and missing required properties can also produce no local verdict. The component does not automatically perform remote fallback from its local methods. #69 must define safe fallback per flag, restrict allowed targeting for transactional flags, and monitor failed refreshes/staleness. A remote lookup can occur before a mutation, but then its result is external input, not a transactional local read. [ComponentClient], [local evaluator][Evaluator], [LocalFlags], [probe evidence](#runtime-probe-evidence).

Expose one internal seam returning a boolean/variant plus the chosen fallback semantics. For a new optional slice, fail closed when unavailable; existing core kudos should keep the agreed baseline behavior. Persist the chosen variant when it influences permanent effects, so retries or later flag changes do not rewrite an earned outcome. These are proposed spec calls, consistent with the permanent-effects decision. [ADR-0004][Effects], [ComponentClient].

Local evaluation does not automatically capture `$feature_flag_called` exposure from queries. Emit it from a committed mutation/action when the member actually enters the slice, with flag key, response, `locally_evaluated`, deployment/environment and the stable member identity. A query read alone should not count as exposure. [PConvex], [ComponentClient].

**Build estimate:** 0.5–1.5 engineer-days for installation, one gating seam, defaults, exposure and failure/stale-definition checks. **Needs Michael:** a scoped project secret API key, or legacy personal API key, for local evaluation; no Convex Pro requirement for the component. Remote evaluation is an available starting point without that key, with a different seam and per-request network dependency. [PConvex], [LocalFlags], [Directory].

## 5. Monitoring

Build private PostHog dashboards for two concerns: product behavior (accepted kudos, allowance outcomes, active members/workspaces, onboarding and slice adoption) and operations (Slack acknowledgement latency, processing/delivery failures, retry exhaustion, backlog age, exceptions and flag-refresh health). These are proposed signals, not existing measurements. Product dashboards consume analytics events; native logs provide execution duration/status and scheduler statistics. Keep Convex's Health page for platform diagnostics and integration health. [Dashboards][Dashboards], [Logs], [Health], [Architecture].

PostHog supports threshold/anomaly alerts on trends, supported funnel views and saved HogQL insights. The documented insight-alert frequencies include hourly on the base offering, 15-minute on Boost and about two-minute “real time” on Scale/Enterprise; free organizations can create up to five insight alerts. Do not promise instant paging from a base-plan insight. Logs have their own threshold alerts checked every five minutes. Error Tracking can notify on new/reopened issues and supports spike alerts. Destinations include Slack/webhooks; dashboard subscriptions provide scheduled digests separately. [Alerts], [log alerts][LogAlerts], [error alerts][ErrorAlerts], [subscriptions][Subscriptions].

Recommendation: page on unexpected new production exceptions, sustained delivery failures and exhausted jobs; use dashboards/digests for product behavior. Add a synthetic heartbeat or an external check if an availability signal is wanted. Normal kudos inactivity is not proof of downtime, and a heartbeat inside Convex cannot prove that Slack or Convex's external ingress is reachable. #69 must choose the detection window, destination/owner, thresholds, quiet hours, missing-data handling and alert budget. Do not publish dashboards containing customer data. [Alerts], [LogAlerts], [ErrorAlerts], [Ticket].

**Build estimate:** 0.5–1.5 engineer-days after signal capture exists, including controlled alert tests. **Needs Michael:** access to the target project and an authorized notification destination. UI setup needs no personal API key; automation through the management API/MCP needs suitable authenticated access, separate from the ingestion token. Pro is required for the native Convex telemetry sources, not for building a product analytics dashboard. [Capture], [Alerts], [Logs], [Exceptions].

## Sandbox and production

PostHog recommends separate projects for environments. Use one project token per deployment, separate native destinations and separate scoped flag-definition secrets; set `environment: "sandbox" | "production"`, deployment name and release ID explicitly on application events. Project separation also separates flags and prevents sandbox writes from altering production targeting. Current PostHog pricing includes one project on Free and six on pay-as-you-go with no base fee, so two projects require the paid organization setup/card even if ingestion remains within its allowance. [Environments], [Pricing], [PConvex].

A single project with an environment property is a viable lower-setup fallback, not equivalent isolation. Every insight/alert must filter the environment, identities must be namespaced, and each flag must target the environment explicitly. Native exceptions use `convex_deployment_type` (`prod`, `dev`, `preview`), which is a deployment category, not our business environment: a sandbox can itself be a Convex production deployment. Filter by deployment/project, not only `convex_deployment_type = prod`. Native logs likewise carry their own deployment metadata rather than inheriting application properties. [Environments], [Exceptions], [Logs], [sandbox provisioning decision #15][Sandbox].

Do not send message text, Slack display names, emails, request bodies, access tokens, full member/group objects, or arbitrary metadata to PostHog by default. `beforeSend`/property allowlisting protects only paths that use it; native logs/errors require safe logging/error construction at the source or a redaction bridge. #69 owns any exception to the privacy policy. [Ticket], [ComponentClient], [Logs], [Exceptions].

## Published run costs and practical drivers

The figures below are **published product allowances/rates**, not Kudos usage or an account forecast. Prices checked 2026-10-13; later tiers decrease. The production region is not assumed from PostHog's US cloud location. [PostHog pricing][Pricing], [Convex pricing][ConvexPricing].

| Capability | PostHog published allowance and first paid tier | Convex cost driver |
| --- | --- | --- |
| Events | Product analytics: 1M events/month free, then $0.00005/event. Identified-event add-on: 1M free, then $0.000198/event; it extends base analytics. Group analytics: paid add-on with 1M free, then $0.000071/event; once enabled, all identified project events count, not just group-attached events. | Subscriber/action calls, action compute, outbound data; batch size and retries affect these. |
| Errors | 100K exceptions/month free, then $0.00037/exception. | Native destination requires Pro; manual capture adds action calls/compute/egress. |
| Logs | 10 GB/month free, then $0.25/GB through the next tier. | Native stream requires Pro; log-stream egress and custom outbound export use data egress. |
| Flags | 1M requests/month free, then $0.0001/request. Local definition fetch with changed definitions counts as 10 requests; a not-modified ETag poll counts as 1. Local evaluations themselves do not make a request. | Component supervisor, refresh mutation/action chain, definition reads/writes; cadence matters even with no member traffic. |
| Monitoring | Dashboards operate on the already-ingested data. Insight alert count/frequency depends on plan; higher-frequency tiers are separate commercial choices. | Any custom heartbeat/queue-health instrumentation adds function calls; platform health is already available. |

Sources: [Pricing], [group billing][Groups], [local flag billing][LocalFlags], [refresh implementation][ComponentLib], [ComponentCrons], [Convex pricing][ConvexPricing], [usage limits/egress][Usage], [Alerts], [Health]. Do not estimate events as only `kudosGiven`: identifies, group identifies, recipient events and flag exposure records also consume ingestion.

Convex Professional is advertised at **$25 per developer/month**, with native log streaming and exception reporting. As a US East pricing reference, Starter overages are $2.20 per million calls, $0.33 per GB-hour action compute and $0.132 per GB data egress; Professional advertises $2, $0.30 and $0.12 respectively after its higher included resources. Free cannot simply spend through its limits. Use the team's actual plan/region and measured sanitized payload sizes to budget; no current-plan or account-usage assumption was made. [ConvexPricing], [Usage].

## Open calls for spec #69

These follow-ups belong to #69; this worker creates no tickets and changes no map entries.

1. **Events:** taxonomy and unit of counting; giver/recipient semantics; stable immutable UUID/timestamp; property allowlist; opaque member identity and cross-deployment/website lifetime; group attribution and paid group add-on. [Events], [Identity], [Groups], [Dedup].
2. **Delivery:** checked capture transport in the bus network subscriber; Workpool/retry parameters, exhaustion visibility, sampling/batching and retention. Component schedule completion alone is insufficient delivery proof. [Architecture], [Scheduling], [Core], [failure probe](#runtime-probe-evidence).
3. **Errors:** Pro/native versus the explicitly incomplete manual alternative; classification, safe exception contents, deployment-level versus member context, native/manual duplication. [Exceptions], [ComponentClient], [Scheduling].
4. **Logs:** Pro/native full stream versus selective exporter/redaction bridge; safe console/error fields, volume/retention, deployment attribution. [Logs], [NodeLogs].
5. **Flags:** local evaluation secret; target scope (member/workspace/group); supported condition types; cold/stale/failure defaults; refresh cadence; variant persistence and exposure semantics. [LocalFlags], [ComponentClient], [ComponentLib], [Effects].
6. **Monitoring:** signal definitions, dashboard ownership, production alert destinations, thresholds/detection windows, missing-data behavior, higher-frequency plan needs and whether external availability checks are in scope. [Alerts], [LogAlerts], [ErrorAlerts], [Health].
7. **Environment and privacy:** recommend two projects; paid organization/card requirement, separate keys, allowlists for all telemetry paths, deletion and retention. Needed from Michael: local flag secret, Convex Professional choice, group add-on/project setup and notification destination. These are requirements for implementation, not blockers to this research resolution. [Environments], [Pricing], [LocalFlags], [ConvexPricing], [Ticket].

## Runtime probe evidence

### Scope and method

Empirical observations below are this worker's own evidence, not assertions of cloud integration coverage. All real requests used the supplied project token read into the process environment from its existing local configuration, without printing it or adding it to a file in Git. Event/exception probes used `distinctId: "research-probe"` and `environment: "research"`. OTLP logs used `environment=research` and `posthogDistinctId=research-probe`. No member data was used.

An isolated anonymous local backend ran on **3410/3411**, instance `kudos-posthog-research-68`, with SQLite/storage under `/tmp/kudos-posthog-convex-68`. Binary: cached `precompiled-2026-10-06-a3538c6`. No shared lane's backend, sandbox cloud deployment or main checkout files were changed. Commands used installed binaries via `npx --no --`; dependencies were installed with pnpm.

### Observed results

| Probe | Observed result |
| --- | --- |
| Ordinary `posthog-node` import in a module exporting default query, mutation and action | Deployment failed: Node built-ins including `path`, `node:zlib`, `node:os`, `node:fs` could not resolve. |
| Explicit `posthog-node/edge` import/construction in query and mutation | Both returned `"function"` for `typeof client.capture`; deployment succeeded. |
| Edge `captureImmediate` in query and mutation | Both failed: `Can't use setTimeout in queries and mutations`. |
| Direct `fetch` in query and mutation | Both failed: `Can't use fetch() in queries and mutations`. This rules out bypassing the SDK timer error to permit remote flags/capture. |
| Edge action `captureImmediate`, and queued capture with awaited flush | Both returned observed capture HTTP **200**. |
| Edge `captureExceptionImmediate` in default action | Observed capture HTTP **200** for a synthetic exception. |
| Ordinary SDK in `"use node"` action | Deployed and returned observed capture HTTP **200**. |
| Edge SDK inside an HTTP action | POST to `/research-sdk` returned `{"captureStatus":200}`. |
| Status-checked direct `/batch/` default action | Returned HTTP **200**. |
| Direct OTLP JSON `/i/v1/logs` default action | Returned HTTP **200**. |
| Component capture from a successful mutation | `_scheduled_functions` showed `lib.js:capture`, event `research_convex_component_probe`, state `success`. |
| Component capture followed by a thrown mutation error | Mutation failed as intended; no schedule for `research_convex_component_rollback` existed. Only the committed capture appeared. |
| Component local flag without secret | Query threw the component's “local feature flag evaluation is not configured” error. |
| Component local flag with synthetic secret, polling disabled, empty cache | Query/mutation/action returned unavailable (wrapper mapped `undefined` to `null`). No live definition fetch or real secret was involved. |
| Component local flag with seeded definition | Query, mutation and action each returned **true** for `research-slice`. Tests seeded the component's flag cache through its local admin interface, not PostHog's flag UI/API. |
| SDK immediate capture with injected HTTP **503**, retries disabled | Action succeeded and returned `"captureImmediate resolved after injected HTTP 503"`. No request reached PostHog in this probe. |

The installed `posthog-node` client, shared-core implementation and component action source matched the pinned upstream files byte-for-byte. The probe TypeScript project passed `pnpm exec tsc --noEmit` through `fleet heavy`. HTTP 200 is capture acceptance, not independently verified appearance in PostHog's event store. Component scheduled `success` also must not be promoted to delivery proof given the 503 behavior.

The research worktree's `pnpm gate` passed typechecking, the empty main-branch test suite and spec checks, but failed vocabulary checks on technical nouns and citation labels in this report. The same gate without the report passed. This branch is a throwaway research artifact and must not be merged; vocabulary adoption and integration implementation belong to #69. No lexicon entries or gate configuration were changed to suppress that result.

### Minimal reproduction seams

Use a fresh temporary pnpm project with the pinned packages, outside the shared checkout. Start the cached backend directly with a private generated instance secret, `--instance-name`, `--port 3410`, `--site-proxy-port 3411`, `--local-storage` and a private SQLite path. Generate its local admin key with `convex-local-backend keygen admin-key`, store it in a mode-0600 temporary env file with `CONVEX_SELF_HOSTED_URL`, and deploy with:

```sh
npx --no -- convex dev --once --env-file /tmp/backend.env
npx --no -- convex run probe:actionCapture --env-file /tmp/backend.env
```

For the SDK runtime test, use this shared handler behind `internalQuery`, `internalMutation` and `internalAction`. Repeat with the ordinary import to reproduce bundling failure; put the ordinary import in its own `"use node"` action module for the successful Node case. Register args/return validators around each handler.

```ts
import { PostHog } from "posthog-node/edge";

async function capture() {
  let status = 0;
  const client = new PostHog(process.env.POSTHOG_PROJECT_TOKEN!, {
    host: "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    fetch: async (url, options) => {
      const response = await fetch(url, options);
      status = response.status;
      return response;
    },
  });
  await client.captureImmediate({
    distinctId: "research-probe",
    event: "research_convex_sdk_probe",
    properties: { environment: "research" },
  });
  await client.shutdown();
  return status;
}
```

For failure semantics, replace `fetch` with `async () => new Response("Synthetic upstream unavailable", { status: 503 })` and set `fetchRetryCount: 0`. `captureImmediate()` still resolves in the pinned version. The checked direct API transport instead inspects `response.ok` and throws a sanitized error on failure. [NodeClient], [Core].

For flag runtime compatibility, register the component with the guide's forwarded env variables plus `POSTHOG_DISABLE_LOCAL_EVALUATION`, use a clearly synthetic key and disable polling, then seed `lib:_setFlagDefinitions` in the local `posthog` component with a boolean flag whose condition has empty properties and `rollout_percentage: 100`. Invoke `posthog.getFeatureFlag` through query/mutation/action wrappers. This verifies deterministic-runtime compatibility, not live secret permissions, definition refresh or cohort parity. Remove the synthetic key afterward. [PConvex], [ComponentConfig], [ComponentLib], [Evaluator].

### Tool calls and limits

PostHog MCP: loaded the server's skill discovery (`learn -s`), inspected tool schemas, ran business-knowledge document/repository searches and topic-specific `docs-search` calls, and attempted project discovery using organizations/projects. The available connection did not identify the target Kudos project in its accessible project lists, so no unrelated project analytics were queried. The original organization was restored. Event arrival could not be confirmed through this MCP connection; the observed capture status is the retained evidence.

Convex's paid native log/exception destinations were verified against current documentation, not enabled by this worker. A real local-evaluation secret was unavailable; cold-cache and seeded definitions were checked without claiming live polling. No production flags, dashboards, alerts, billing settings or cloud deployment were changed. Temporary probe source/backend data are not published; the findings and reproduction seams are retained here. The backend is stopped by its own PID and the worktree is removed at completion.

## Sources

Documentation links refer to pages checked on 2026-10-13. SDK links pin the inspected releases. Repository links pin the inspected core-loop code so later workers can see exactly what was present.

[PConvex]: https://posthog.com/docs/libraries/convex
[Directory]: https://www.convex.dev/components/posthog/convex
[Integrations]: https://docs.convex.dev/production/integrations
[Runtimes]: https://docs.convex.dev/functions/runtimes
[Actions]: https://docs.convex.dev/functions/actions
[HTTP]: https://docs.convex.dev/functions/http-actions
[Scheduling]: https://docs.convex.dev/scheduling/scheduled-functions
[Logs]: https://docs.convex.dev/production/integrations/log-streams
[Exceptions]: https://docs.convex.dev/production/integrations/exception-reporting
[Health]: https://docs.convex.dev/dashboard/deployments/health
[Usage]: https://docs.convex.dev/production/usage-limits
[Capture]: https://posthog.com/docs/api/capture
[Dedup]: https://posthog.com/docs/data/events#event-deduplication
[Identity]: https://posthog.com/docs/product-analytics/identity-resolution
[Groups]: https://posthog.com/docs/product-analytics/group-analytics
[LocalFlags]: https://posthog.com/docs/feature-flags/local-evaluation
[NodeErrors]: https://posthog.com/docs/error-tracking/installation/node
[NodeLogs]: https://posthog.com/docs/logs/installation/nodejs
[Alerts]: https://posthog.com/docs/alerts
[LogAlerts]: https://posthog.com/docs/logs/alerts
[ErrorAlerts]: https://posthog.com/docs/error-tracking/alerts
[Dashboards]: https://posthog.com/docs/product-analytics/dashboards
[Subscriptions]: https://posthog.com/docs/product-analytics/subscriptions
[Environments]: https://posthog.com/tutorials/multiple-environments
[Pricing]: https://posthog.com/pricing
[ConvexPricing]: https://www.convex.dev/pricing
[Warehouse]: https://posthog.com/docs/data-warehouse/sources/convex
[Architecture]: https://github.com/Silthus/kudos/issues/11
[Ticket]: https://github.com/Silthus/kudos/issues/68
[GroupDecision]: https://github.com/Silthus/kudos/issues/10
[Sandbox]: https://github.com/Silthus/kudos/issues/15
[Effects]: https://github.com/Silthus/kudos/blob/main/docs/adr/0004-effects-are-stored-with-their-award.md
[Bus]: https://github.com/Silthus/kudos/blob/2b26b86a4f1c3bb32f809e8e5f3a3588869af2a1/convex/bus/publish.ts
[Events]: https://github.com/Silthus/kudos/blob/2b26b86a4f1c3bb32f809e8e5f3a3588869af2a1/convex/bus/events.ts
[Schema]: https://github.com/Silthus/kudos/blob/2b26b86a4f1c3bb32f809e8e5f3a3588869af2a1/convex/schema.ts
[NodePackage]: https://github.com/PostHog/posthog-js/blob/4f590b367e415fccf85a5f7a895e0f1f454ad25a/packages/node/package.json
[NodeClient]: https://github.com/PostHog/posthog-js/blob/4f590b367e415fccf85a5f7a895e0f1f454ad25a/packages/node/src/client.ts
[Core]: https://github.com/PostHog/posthog-js/blob/4f590b367e415fccf85a5f7a895e0f1f454ad25a/packages/core/src/posthog-core-stateless.ts
[ComponentPackage]: https://github.com/PostHog/posthog-js/blob/3e72e7bb76c66b213a2e3ff61dc85795ca12e544/packages/convex/package.json
[ComponentClient]: https://github.com/PostHog/posthog-js/blob/3e72e7bb76c66b213a2e3ff61dc85795ca12e544/packages/convex/src/client/index.ts
[ComponentLib]: https://github.com/PostHog/posthog-js/blob/3e72e7bb76c66b213a2e3ff61dc85795ca12e544/packages/convex/src/component/lib.ts
[ComponentSchema]: https://github.com/PostHog/posthog-js/blob/3e72e7bb76c66b213a2e3ff61dc85795ca12e544/packages/convex/src/component/schema.ts
[ComponentConfig]: https://github.com/PostHog/posthog-js/blob/3e72e7bb76c66b213a2e3ff61dc85795ca12e544/packages/convex/src/component/convex.config.ts
[ComponentCrons]: https://github.com/PostHog/posthog-js/blob/3e72e7bb76c66b213a2e3ff61dc85795ca12e544/packages/convex/src/component/crons.ts
[Evaluator]: https://github.com/PostHog/posthog-js/blob/3e72e7bb76c66b213a2e3ff61dc85795ca12e544/packages/convex/src/client/feature-flags/evaluator.ts
