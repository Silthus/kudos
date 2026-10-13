# Convex production setup for a Slack backend

Research for [Kudos issue #7](https://github.com/Silthus/kudos/issues/7), supporting the core-loop grilling and architecture prototype in [map #1](https://github.com/Silthus/kudos/issues/1). Sources checked on 2026-10-13. This is a research proposal, not an implemented backend or a product decision.

## Findings that affect the next decisions

1. **Convex can host the Slack endpoints directly.** HTTP actions expose Fetch `Request`/`Response` handlers on the deployment's `.convex.site` URL. Slack requires Events acknowledgments within three seconds and interaction acknowledgments within three seconds. Verify, durably accept, and return before doing Slack API work. [C1][S1][S2][S3]
2. **Accepting and scheduling should be one mutation.** Scheduling from a mutation commits atomically with its writes. Scheduled mutations have exactly-once execution guarantees for successful processing, with automatic retries of internal Convex errors; developer errors still fail. Scheduled actions execute at most once and need an explicit retry strategy. Neither guarantee makes a Slack network side effect exactly once. [C2][C3]
3. **Transport deduplication and edit-to-retry are different concerns.** Slack's `event_id` identifies an event globally, while an edited message is still identified by its channel and nested `message.ts`. Metadata-only changes can also emit `message_changed`. The mutation needs a receipt key plus message/grant state; a new event ID must not automatically award again. [S2][S4][C3]
4. **A Slack-only core does not need Convex Auth sessions to authenticate Slack requests.** Signed requests carry Slack user/workspace context; Convex Auth is a user-session system. Recommendation: defer session setup until there is an actual sign-in consumer, while preserving the map's choice of Slack OIDC if sign-in is needed. Auth.js has a Slack OIDC provider, but Convex Auth only documents GitHub, Google, and Apple as supported OAuth providers. Treat Slack compatibility as a prototype check. [S1][S5][S6][C4][C5][A1]
5. **Production can deploy from GitHub Actions without hosting a website.** Provision a project and production deployment, configure deployment environment variables, and run `pnpm exec convex deploy` using a production deploy key after the repository gate succeeds. Recommend a trusted `main` push workflow; the conductor/spec still owns the pipeline choice. [C6][C7][C8][C9][G1][G2]
6. **Start with the built-in scheduler and explicit daily accounting.** The rate limiter fits operational throttling, aggregate fits ranks/sums when the leaderboard needs them, and dynamic crons are useful only when schedules must be created at runtime. Fixed UTC cron resets cannot by themselves implement every workspace-local calendar day. [C10][P1][P2][P3]

## 1. Slack ingress and the three-second acknowledgment

### Verified platform behavior

- Register HTTP routes through the default `httpRouter` export in `convex/http.ts`, using `httpAction` from `./_generated/server`. HTTP actions call database functions through `ctx.runQuery`/`ctx.runMutation`; they do not provide direct database access. The webhook hostname ends in `.convex.site`, not `.convex.cloud`. [C1]
- HTTP actions run in the default Convex runtime and cannot use arbitrary Node-only APIs. That runtime documents Web Crypto, including `crypto`, `CryptoKey`, and `SubtleCrypto`; the Web Crypto specification defines HMAC signing/verification. A Web Crypto implementation avoids putting a Node SDK on ingress, but its exact algorithm support should be proved against a deployed HTTP action. [C1][C11][W1]
- Slack signs the **raw request body** with HMAC-SHA256 using the signing secret. Construct `v0:<timestamp>:<raw-body>` and check `X-Slack-Signature`. Slack's verification example rejects timestamps differing from local time by more than five minutes and recommends an HMAC comparison function. Parse JSON or form fields only after signature verification. [S1]
- Events arrive as JSON. Interaction bodies are `application/x-www-form-urlencoded` with a JSON `payload` field; slash commands, if added, are a separate form payload. The whole received body, including form encoding, is what must be verified. [S1][S2][S3][S10]
- An authenticated `url_verification` request needs an immediate response containing its `challenge`; it has no inner event. Do not treat its deprecated `token` field as authentication. [S7]
- Events need HTTP 2xx within three seconds; interactions need HTTP 200 within three seconds. Slack recommends decoupling receiving from processing. [S2][S3]
- Modal `trigger_id` values expire in three seconds and can be used once. Interaction `response_url` values can be used up to five times within thirty minutes and bypass channel posting permissions. Deferring all interactivity blindly would break modal opening; response URLs must be treated as credentials. [S3]

### Proposed ingress contract

Use separate routes such as `/slack/events` and `/slack/interactivity`; add `/slack/commands` only if commands enter the spec. Keep the Slack payload shapes and signing logic in the Slack adapter. These are proposed names, not existing routes.

1. Read raw bytes, require a well-formed signature/timestamp, reject stale or forged requests, and verify before parsing. Prefer `crypto.subtle.verify` over a hand-written timing-sensitive equality check. [S1][C11][W1]
2. Handle verified URL challenges immediately. Validate other payloads and map them to the small command the adapter understands. HTTP actions have no automatic argument validators, so validate the HTTP payload explicitly; registered mutation/action arguments can then use Convex validators. [C1][C12][S7]
3. For relevant events, await **one internal acceptance mutation**. It checks the configured app/installation and workspace policy, reads the indexed receipt, and either returns `duplicate` or records receipt/work and schedules an internal processing mutation with `runAfter(0, ...)`. The write and schedule then share one commit. [C2][C3][C13][S2]
4. Return 200 after acceptance commits. Return 200 for verified duplicates or intentionally ignored event types. Do not claim durable acceptance if the mutation fails; allow Slack's documented Events retry path to retry transient acceptance failures. [C2][S2]
5. Process the kudos command in a mutation. Persist grants, daily consumption, and the intent for outbound feedback together; schedule Slack delivery afterward. The action delivers feedback and records its outcome through a mutation. [C2][C3][C11]

**Design implication:** no fire-and-forget promise after the HTTP response, and no call to `chat.postMessage` before durable acceptance. Awaiting one small mutation fits the intended acknowledgment path, but documentation is not a measured three-second latency guarantee. The prototype must measure it under real deployment conditions. [C1][C2][S2]

**Security implication:** a valid signature proves which Slack app signed a request, not that this app should accept arbitrary workspace/user operations. Derive actors from verified payloads, enforce the chosen installation/workspace policy internally, and keep processing functions internal. Scheduled auth context is not propagated, so pass the validated actor and tenant context explicitly. [S1][S2][S6][C2][C13]

## 2. Retries, edits, and idempotent accounting

### Verified delivery behavior

Slack supplies globally unique `event_id` values. Failed Events deliveries retry up to three times: almost immediately, after one minute, and after five minutes, with `x-slack-retry-num` and `x-slack-retry-reason`. These headers describe a delivery attempt; they are not a business identifier. The optional Delayed Events setting adds hourly retries for twenty-four hours; Slack describes Events delivery as best effort, including possible delayed events during incidents. [S2]

`message_changed` wraps the updated message in `event.message`; the original message identity is its nested `message.ts` within `event.channel`, not the edit event's outer `ts`. Slack says language/locale metadata changes can also produce this subtype. [S4]

Convex mutations are atomic and serializable and retry OCC conflicts. An indexed read-before-insert in the same mutation is therefore the proposed deduplication mechanism. Defining an index is not a substitute for that application check, and an action query followed by an action write would not make the check atomic. [C3][C14][C11]

### Proposed durable records

- **Delivery receipt:** keyed by app + `event_id` (workspace stored as context). Record acceptance/processing status and a bounded normalized command. Use an index such as `by_app_and_event_id`. Never drop every request carrying a retry header: the first attempt may not have committed. [S2][C3][C14]
- **Message attempt:** keyed by workspace + channel + original message timestamp. Preserve whether processing was rejected or accepted and the relevant revision/fingerprint. Nested `message.ts` is the identity for edits. [S4]
- **Accepted grant:** assign a stable business identity under the product's eventual message/recipient/count rule. Check this state in the same mutation as allowance and totals, independently of delivery receipts. This is a recommendation derived from separate event and message identities, not a Slack-supplied grant key. [S2][S4][C3]
- **Outbound effect:** record the intended reaction/reply and delivery status separately from whether a grant committed. A Slack delivery failure must not rerun the grant and consume allowance again. [C2][C3]

Do not use `message.ts` as the only receipt key: doing so discards edits that need reconsideration. Do not use `event_id` as the only grant key: doing so allows a new edit event to grant twice. Treat timestamps as opaque message identifiers; any ordering comparison must deliberately handle the timestamp format rather than assume JavaScript float conversion is safe. [S2][S4]

For interactions, the block-actions schema has actor, team, container, trigger, and per-action fields but no Events-style `event_id`. Recommendation: dedupe exact request replays with a digest of the signed request and use a separate operation identity for a persistent action. A new legitimate click must not be permanently blocked because it shares the same button ID. Choose a contract per interaction type instead of inventing a universal Slack event identifier. [S3][S6]

### Product choices the core-loop grilling must settle

These are open design choices, not missing platform facts:

- If a rejected message is edited, does it retry all recipients or only the previously rejected portion? Does exceeding allowance reject the whole message or partially accept it?
- If an accepted message is edited, can it add more recipients/counts, remove accepted kudos, or only change presentation? Are grants immutable, or can edits/deletions reverse grants and refund allowance?
- What counts as a retry: changed kudos-bearing content, any user edit, or an explicit retry interaction? Metadata-only edits must not accidentally count as intentional retries.
- Which clock determines a day: workspace timezone, giver timezone, or UTC? Do delayed events consume the original day or the processing day?
- How long must receipt and message history survive, and is Delayed Events enabled? Twenty-four-hour transport retention is relevant to that optional setting, but durable grant identity cannot expire in a way that permits double awards.

The platform reasons these choices exist are Slack's separate message/event identities, metadata-triggered edit events, delayed Events delivery, and UTC cron scheduling. [S2][S4][C10]

**Prototype scenarios:** deliver one signed event twice, concurrently submit two different events against the final allowance, reject then edit a message, accept then receive a metadata-only edit, and deliver an older revision after a newer revision. Accounting must be idempotent for the chosen rules. Protect against stale revisions as an application requirement; the cited best-effort delivery docs do not establish an ordering guarantee. [S2][S4][C3]

## 3. Outside-in tests with Vitest and convex-test

Convex's documented setup uses `convex-test`, Vitest, and `@edge-runtime/vm`, with Vitest's `edge-runtime` environment. Translate the installation to `pnpm add -D convex-test vitest @edge-runtime/vm`; keep the dependency versions compatible with the bootstrap's pinned SDK. Each test creates `convexTest(schema, modules)` with schema validation and an appropriate `import.meta.glob` covering the Convex function modules. [C15]

Test seams proposed for the prototype:

1. **Slack ingress:** call `t.fetch('/slack/events', requestOptions)` through the registered HTTP router using signed synthetic raw requests. Verify challenge response, forged/stale rejection, exact JSON/form handling, acknowledgment, duplicate delivery, and the resulting observable Slack response or module result. `t.fetch` remains available even when outbound global `fetch` is mocked. [C15][S1][S7]
2. **Kudos engine interface:** exercise its public TypeScript interface or the HTTP route that exposes its behavior. Assert accepted/rejected results and the allowance/totals returned through that interface. Cover the exact-last-allowance race and edit behavior once specified. Do not export an unauthenticated public Convex mutation merely to make it accessible to a test: `convex-test` can invoke internal registered functions when testing a deliberately selected internal module interface. [C15][C13][C3]
3. **Outbound Slack adapter:** stub external `fetch` with Vitest and drive the public HTTP route through scheduled processing. Assert the externally visible Slack operation and that retrying delivery never applies the grant twice. Use fake timers and `t.finishAllScheduledFunctions(vi.runAllTimers)` to finish a chain of jobs; restore timers/globals after the test. [C15][C2]

Here, **public interface** means the seam callers use. It does not mean every engine function must be exported using Convex's network-public `mutation` constructor. Internal functions can remain internal to the deployed application. [C13][C15]

`convex-test` is a JavaScript mock: it does not enforce production size/time limits, may differ in runtime built-ins, and does not support cron execution. Test a cron's function explicitly. It is not proof of real webhook latency or production OCC retry behavior. A real local backend enforces backend limits; a sandbox Slack app pointed at a deployed backend proves signing, acknowledgment latency, subscriptions, and outbound permissions. [C15][C16][S1][S2]

Recommended verification: focused outside-in tests first, then the repository gate defined by bootstrap, then one real sandbox end-to-end event and its retry/edit cases. Broad local gates on these devboxes use Fleet's heavy wrapper under Michael's standing instructions. This research ticket has no implementation to build or test.

## 4. Project, production deployment, secrets, and GitHub Actions

### Provisioning facts and proposed procedure

Convex projects belong to a team. The dashboard and first-run `convex dev` provide project creation, and current CLI docs also expose explicit project/deployment creation. Current CLI `project create` says provisioning a deployment is a separate step. `deployment create` accepts a deployment type and `--default`; `convex deploy` targets the default production deployment for a configured project or the deployment identified by `CONVEX_DEPLOY_KEY`. [C6][C7][C27][C8]

Proposed explicit setup, for a future authorized setup worker, after installing the pinned Convex SDK and authenticating:

```sh
pnpm exec convex project create kudos --team <team-slug>
pnpm exec convex deployment create <team-slug>:kudos:prod --type prod --default
pnpm exec convex deployment create <team-slug>:kudos:dev/bootstrap --type dev --select
```

These commands adapt the current documented CLI syntax to pnpm; verify `--help` against the bootstrap's pinned SDK before using newer provisioning subcommands. The project slug in the references must match the actual created project. The dashboard is an alternative if that SDK lacks these commands. No project or deployment was created for this research. [C6][C7][C27][C8]

Configure **each target deployment's** runtime variables before activating Slack traffic. Convex variables are per deployment; project defaults initialize new deployments and do not keep existing deployments in sync. Current docs support declared variables in `convex.config.ts`, validated at deployment, with a typed `env` import from `_generated/server`; undeclared variables remain readable through `process.env`. Declaration does not set their values. [C9]

Suggested variables, with names chosen for this application:

- `SLACK_SIGNING_SECRET`: needed to verify this app's inbound requests. [S1]
- `SLACK_BOT_TOKEN`: appropriate for a single configured installation; a multi-workspace install needs installation-scoped token storage/lookup instead. The spec must choose the installation model, because Slack installs grant tokens/scopes per authorized installation. [S2][S8]
- `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`: needed only when implementing an install OAuth flow or user OIDC flow, and configured against the appropriate environment. [S5][S8]
- If Convex Auth is actually introduced: `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, and the chosen provider credentials on production as well as development. `SITE_URL` is the return destination for sign-in, not the Slack webhook URL. [C17][C18]

`CONVEX_DEPLOY_KEY` belongs in the **CI environment**. Slack signing secrets/tokens belong in the **Convex deployment environment**. Setting a value on the Actions runner does not configure a remote function's environment. [C9][C19][G1]

### Deploy keys

Generate a named production deploy key for the intended deployment in Deployment Settings. Current docs allow a scoped key with the `deployment:deploy` permission for CI. Store it as a GitHub Actions secret named `CONVEX_DEPLOY_KEY` and reference that secret only in the trusted deploy step. Convex also documents `deployment token create` and `delete`; key creation requires a logged-in personal token and cannot run with a deploy key already in scope. Prefer the dashboard when selecting the exact allowed permissions. [C19][G1]

A production deploy key targets production; a preview key changes deploy behavior to preview deployments. Do not use an unrestricted admin key when a scoped production deploy key does the job. [C19][C8]

### Recommended workflow shape, not a checked-in pipeline

The map leaves automatic versus manual deployment open. Recommend `main` push -> bootstrap gate -> production deploy, with pull requests running the same gate without production credentials. Convex explicitly supports standalone backend deployment, so a frontend build, Vercel project, and `--cmd` are unnecessary for this Slack-only backend. GitHub supports secrets and concurrency groups; serialize production deploys and do not cancel an active deployment. [C6][C8][G1][G2]

Illustrative template, assuming bootstrap defines a `gate` script and a pinned `packageManager` in `package.json`:

```yaml
name: Deploy Convex production
on:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: convex-production
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm gate
      - run: pnpm exec convex deploy
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

This combines Convex's documented CLI/CI model with pnpm's official action setup and GitHub's workflow controls. It is not tested against this empty project's future bootstrap. If the gate requires dev deployment credentials/codegen, establish those separately; never give a PR job the production key just to generate types. Pin action revisions according to the repository's CI policy. [C8][C20][G1][G2][G3]

`convex deploy` typechecks, regenerates generated code, bundles, and pushes functions/indexes/schema, stopping after failed steps. This complements the repository gate; it does not replace behavioral tests. Schema must still match existing production data, and queued scheduled calls execute the current code with the old stored arguments, so scheduled function changes need backward compatibility. [C8][C6]

**Sandbox implication:** the map already requires sandbox installation first. A permanent staging backend can be a separate Convex project with its own deployment/key. Keeping sandbox and real-workspace tokens/traffic separate is recommended until the spec chooses one app with multiple installations or separate apps. A sandbox Slack workspace is not automatically an isolated backend environment. [Map #1](https://github.com/Silthus/kudos/issues/1), [C6][S8]

## 5. Pausing or disabling the old deployment

Pausing is reversible and preserves data. The dashboard exposes it in Deployment Settings; the deployment API also documents `POST /pause_deployment`. Paused deployments reject new function calls, keep scheduled jobs queued until resume, and skip cron runs. Code pushes and dashboard edits can still work. Pausing stops function-call/bandwidth charges but storage charges remain. [C21][C22]

Convex's export CLI accepts an explicit deployment name, an output path, and optional file storage. Proposed shutdown handoff, respecting the map's already-locked export-first/uninstall/pause sequence:

```sh
pnpm exec convex export --deployment valiant-monitor-701 --include-file-storage --path /absolute/private/backup/path/kudos-old.zip
```

Use the old project's authorized CLI context. The path is a placeholder outside every repository; confirm the archive exists and can be inspected privately, then uninstall the old Slack app and pause the old deployment through its settings. This is an operational recommendation, not an export or shutdown performed by this research worker. [C23], [Map #1](https://github.com/Silthus/kudos/issues/1)

Do not substitute deleting the project for pausing it: project deletion is permanent and removes its deployments/data. Resuming the paused deployment can run its queued jobs; the shutdown worker should inspect/cancel or otherwise prevent obsolete Slack sends before any later resume. A feature-level disabled flag is an alternative for keeping a deployment online, but it would need to gate HTTP ingress and scheduled work explicitly. [C24][C21][C2]

## 6. Convex Auth and Sign in with Slack

Slack has three distinct mechanisms: signed inbound requests, OAuth installation permissions/tokens, and OIDC user sign-in. Sign in with Slack uses `/openid/connect/authorize`, `openid.connect.token`, and `openid.connect.userInfo`; it requests `openid` and optionally `profile`/`email`. Slack forbids combining Sign in with Slack scopes and ordinary app scopes in the same OAuth flow. Installation is not user sign-in. [S1][S5][S8]

**Feasibility:** Convex Auth accepts Auth.js provider configurations. Auth.js core `0.41.1`, the version named in Convex Auth's setup docs at research time, includes `@auth/core/providers/slack` with provider ID `slack`, `type: 'oidc'`, issuer `https://slack.com`, and nonce checks. Convex Auth's provider guide says providers beyond GitHub/Google/Apple can be tried but are unsupported by Convex. This establishes a plausible configuration path, not a verified end-to-end compatibility claim. [C5][C25][A1]

If a later interface genuinely needs sign-in:

1. Follow Convex Auth setup, including `authTables`, `convex/auth.ts`, `convex/auth.config.ts` with deployment site issuer/application ID, and `auth.addHttpRoutes(http)` alongside the Slack routes. [C17][C25]
2. Configure the Slack provider with explicit client ID/secret and register the callback `https://<deployment>.convex.site/api/auth/callback/slack` in Slack's redirect settings. The path follows Convex Auth's documented callback pattern and the provider's `slack` ID. Slack requires HTTPS redirects. [C5][A1][S8]
3. Configure keys, `SITE_URL`, and provider credentials separately for production; Convex Auth documents an initialization command with `--prod`, or manual setup. [C17][C18][C9]
4. Preserve and authorize Slack workspace/user claims, including `https://slack.com/team_id` and `https://slack.com/user_id`. Convex Auth saves only name/email/image by default and allows a custom provider profile and schema. Do not use email matching alone as tenant authorization. [S5][C5]
5. Prove real redirect, code exchange, nonce/state protection, session identity, and cross-workspace rejection in the sandbox. Mock identities with `t.withIdentity` test authorization logic, not the OIDC exchange. [S5][C15]

**Recommendation for the core:** use verified Slack request actors and internal functions now. App Home and commands already arrive with Slack actor context, so no separate user-session consumer is identified by the map's Slack-only scope. Keep Sign in with Slack as the chosen provider when a sign-in use case appears; do not invent a web UI merely to exercise authentication. Convex Auth is currently documented as beta, which is an additional reason to make its compatibility check explicit before adopting it. [S3][S6][S10][C4], [Map #1](https://github.com/Silthus/kudos/issues/1)

## 7. Components and daily accounting

- **Built-in scheduler:** use for durable immediate processing and individual retry times. Scheduling is transactional when invoked in a mutation; no separate queue service is needed for the first acceptance/processing loop. [C2]
- **`@convex-dev/rate-limiter`:** supports token buckets, fixed windows, per-key limits, reservations, and transactional rollback. Use it for operational request/outbound throttling if needed. A fixed window has a configurable start and defaults to a randomized start; it is not automatically a workspace calendar-day allowance. Its async mode is eventually consistent and can allow a concurrent burst past the instantaneous cap, so do not use that mode for a strict kudos allowance. [P1]
- **Daily allowance recommendation:** store consumption by workspace + giver + resolved day, or lazily reset a per-giver counter when the day changes; update allowance and grants in the same mutation. This avoids depending on a midnight sweep. Choose timezone, delayed-event clock, refund behavior, and configuration-change policy in grilling first. The recommendation follows Convex atomicity plus UTC cron and pause/skip behavior. [C3][C10][C21]
- **`@convex-dev/aggregate`:** supplies efficient counts/sums, sorted selection and rank operations, with namespace partitioning. Consider it when the leaderboard spec needs arbitrary user rank, totals, or range aggregation; a bounded top-N query on an indexed score table may be sufficient initially. Maintain the aggregate in the same mutation as source records using explicit updates or its trigger integration. Default synchronous updates are transactional; async/stale modes deliberately relax freshness. Namespaces separate data structures and reduce interference, so choose workspace/team/period scope deliberately. [P2][C14]
- **Built-in `convex/crons.ts`:** enough for static cleanup/reminder schedules. Cron syntax uses UTC; overlapping runs can be skipped and paused deployments skip crons. Treat local-midnight/DST behavior as domain logic and keep scheduled work bounded. [C10][C21]
- **`@convex-dev/crons`:** adds runtime registration/deletion of schedules; add only when tenant configuration must manage schedules dynamically. It does not resolve the daily-allowance product semantics for us. [P3]
- **`@convex-dev/workpool`:** a later option for bounded concurrent outbound jobs and configurable retries of idempotent actions. It does not make non-idempotent Slack operations exactly once. Slack HTTP 429 responses require honoring `Retry-After`; keep retry policy aware of workspace/method/channel limits and uncertain network outcomes. [P4][S9][C2]

**Outbound failure contract to prototype:** a grant can be committed while its Slack feedback is pending or failed. Record that distinction and choose whether/how to retry each operation. A timeout after Slack accepted a request is ambiguous; retrying may repeat the external effect. Retrying a job must never repeat the grant. Decide the visible failure behavior in the core spec. [C2][S9]

## 8. Skill reconciliation and handoff

Consulted the bundled `convex:convex-expert`, `convex:convex-reviewer`, and `convex:add` skills (Convex plugin 2.0.1), plus `research`, `codebase-design`, `domain-modeling`, and `tdd`. No backend capability was installed. Apply the skills' object-form registered functions, validators, internal defaults, indexed/bounded reads, and action-only external side effects to implementation. Those recommendations also appear in the official best practices/function docs. HTTP actions are the documented exception to registered args/returns validators: they validate their incoming Request themselves. [C1][C11][C12][C13][C26]

Use primary docs over stale examples in skill text. In particular, current docs describe typed declared environment variables and newer project/deployment CLI commands. The report deliberately does not copy approximate hard limits or generic frontend/auth assumptions from the skills into an implementation contract. [C7][C27][C8][C9][C11]

**Calls made in this research:** recommend HTTP ingress with atomic receipt/scheduler handoff, separate transport/message/grant identities, daily accounting independent of reset sweeps, internal processing functions, and scoped CI deployment credentials. Recommend deferring Convex Auth until a sign-in consumer exists and adopting aggregate/dynamic-cron/workpool only when the relevant spec needs them. These are recommendations for the conductor and prototype, not locked product decisions.

**Follow-ups for existing map work:** core grilling settles edit semantics, allowance day and failure UX; the architecture prototype proves Web Crypto on real HTTP actions, concurrent idempotency/accounting, and ingress acknowledgment latency; provisioning verifies pinned CLI syntax, runtime secrets, and the selected trusted deploy pipeline. If auth is needed, prove Slack OIDC specifically. The shutdown worker follows export/uninstall/pause and queued-job precautions. This worker does not create downstream tickets or change the map.

**Evidence limits:** this report checked documentation and first-party source. No Convex deployment was provisioned, no Slack app was installed, and no end-to-end runtime was executed. Source citations establish platform contracts; the proposed workflow and module contracts still need implementation verification.

## References

All links below are primary documentation or first-party source. Component source links are pinned to the revisions inspected; Auth.js is pinned to its documented core version. Documentation is live and may change after the research date.

[C1]: https://docs.convex.dev/functions/http-actions
[C2]: https://docs.convex.dev/scheduling/scheduled-functions
[C3]: https://docs.convex.dev/database/advanced/occ
[C4]: https://docs.convex.dev/auth/convex-auth
[C5]: https://labs.convex.dev/auth/config/oauth
[C6]: https://docs.convex.dev/production/overview
[C7]: https://docs.convex.dev/cli/reference/project
[C8]: https://docs.convex.dev/cli/reference/deploy
[C9]: https://docs.convex.dev/production/environment-variables
[C10]: https://docs.convex.dev/scheduling/cron-jobs
[C11]: https://docs.convex.dev/functions/runtimes
[C12]: https://docs.convex.dev/functions/validation
[C13]: https://docs.convex.dev/functions/internal-functions
[C14]: https://docs.convex.dev/database/reading-data/indexes
[C15]: https://docs.convex.dev/testing/convex-test
[C16]: https://docs.convex.dev/testing/convex-backend
[C17]: https://labs.convex.dev/auth/setup/manual
[C18]: https://labs.convex.dev/auth/production
[C19]: https://docs.convex.dev/cli/deploy-key-types
[C20]: https://docs.convex.dev/testing/ci
[C21]: https://docs.convex.dev/production/pause-deployment
[C22]: https://docs.convex.dev/deployment-api/pause-deployment
[C23]: https://docs.convex.dev/cli/reference/export
[C24]: https://docs.convex.dev/dashboard/projects
[C25]: https://labs.convex.dev/auth/setup
[C26]: https://docs.convex.dev/understanding/best-practices
[C27]: https://docs.convex.dev/cli/reference/deployment
[S1]: https://docs.slack.dev/authentication/verifying-requests-from-slack
[S2]: https://docs.slack.dev/apis/events-api
[S3]: https://docs.slack.dev/interactivity/handling-user-interaction
[S4]: https://docs.slack.dev/reference/events/message/message_changed
[S5]: https://docs.slack.dev/authentication/sign-in-with-slack
[S6]: https://docs.slack.dev/reference/interaction-payloads/block_actions-payload
[S7]: https://docs.slack.dev/reference/events/url_verification
[S8]: https://docs.slack.dev/authentication/installing-with-oauth
[S9]: https://docs.slack.dev/apis/web-api/rate-limits
[S10]: https://docs.slack.dev/interactivity/implementing-slash-commands
[A1]: https://github.com/nextauthjs/next-auth/blob/%40auth/core%400.41.1/packages/core/src/providers/slack.ts
[P1]: https://github.com/get-convex/rate-limiter/blob/2f5c7b5b3de103b7dcf84d0bfeecd95ca7fef94c/README.md
[P2]: https://github.com/get-convex/aggregate/blob/da878bc71f8bc55bdb82cdad796c15d3fbc6f0b3/README.md
[P3]: https://github.com/get-convex/crons/blob/9d2506a207bfbfccbadde3571ab333039648a225/README.md
[P4]: https://github.com/get-convex/workpool/blob/358fb205ebb8bdffea844de0c00ddd1ab11fc198/README.md
[G1]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
[G2]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
[G3]: https://github.com/pnpm/action-setup
[W1]: https://www.w3.org/TR/WebCryptoAPI/

- [C1: HTTP actions][C1]; [C2: scheduled functions and guarantees][C2]; [C3: OCC and atomicity][C3].
- [C4: Convex Auth status][C4]; [C5: provider support and callbacks][C5]; [C17: manual auth setup][C17]; [C18: production auth][C18]; [C25: auth dependencies][C25].
- [C6: production workflow][C6]; [C7: project CLI][C7]; [C27: deployment creation CLI][C27]; [C8: deploy CLI][C8]; [C9: deployment environment variables][C9]; [C19: deploy keys][C19]; [C20: CI][C20].
- [C10: cron schedules][C10]; [C11: runtime APIs][C11]; [C12: validation][C12]; [C13: internal functions][C13]; [C14: indexes][C14]; [C26: best practices][C26].
- [C15: convex-test][C15]; [C16: real backend testing][C16].
- [C21: pause semantics][C21]; [C22: pause API][C22]; [C23: export CLI][C23]; [C24: projects and deletion][C24].
- [S1: request signing][S1]; [S2: Events delivery and retries][S2]; [S3: interactivity][S3]; [S4: message edits][S4]; [S6: interaction identity fields][S6]; [S7: URL challenge][S7]; [S10: slash command payloads][S10].
- [S5: Slack OIDC][S5]; [S8: installation OAuth][S8]; [S9: Slack rate limits][S9]; [A1: Auth.js Slack provider source][A1].
- [P1: rate limiter][P1]; [P2: aggregate][P2]; [P3: dynamic crons][P3]; [P4: workpool][P4].
- [G1: Actions secrets][G1]; [G2: Actions concurrency][G2]; [G3: official pnpm setup action][G3]; [W1: Web Crypto specification][W1].
