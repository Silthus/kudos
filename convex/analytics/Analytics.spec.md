# Analytics

Analytics: the only module that knows PostHog. It projects each kudosGiven domain event into the product events kudos given and kudos received, records them in the outbox in the subscriber's transaction while capture is on, under an opaque analytics ID per member and a workspace key per workspace, and one drain at a time sends due events to PostHog's batch endpoint, at most 100 per request, deleting them when PostHog answers 2xx. It is also the feature flag seam: a flag is declared once with its key, subject, values and safe default, is read through the PostHog component's locally evaluated definitions on the subject's analytics ID or workspace key, and sends its exposure once per member, flag and value. Every function is internal; the PostHog spec is issue #69.

## invariants
- only allowlisted properties leave the deployment: Only the properties a projection lists by name for its event leave the deployment for PostHog; message text, names, time zones, emoji names, Slack IDs and Convex document IDs never do.
  over: every PostHog request body the drain sends for a kudos message full of distinctive words, display names, a custom kudos emoji, time zones, Slack user, team, channel, message and thread IDs, run through the whole loop from a signed Slack request, checked against those values, every stored Convex document ID and any Slack-shaped ID
  via: no PostHog request carries the message, a name, a Slack or Convex ID, an emoji name or a time zone
  because: a kudos message stays between colleagues and analytics must not identify a member by itself (O10, O11); the public repo and the workspace's trust rule out any field forwarded by accident, and a projection that spread a domain object would send the emoji name, the message reference and the Convex IDs it carries
  refuted: the kudos given projection also forwarded the kudos emoji's name as kudos_emoji -> the test failed on its assertion that no request body contains the emoji's name (2026-10-13)
  kinds: message, storage
  checklist: scoped-reads dismissed: the outbox is read whole by the one drain, which serves no member; no population is restricted by scope
  checklist: destination-confinement dismissed: the drain posts only to the configured POSTHOG_HOST's batch endpoint, and no row or answer can redirect it
  checklist: message-authenticity dismissed: the subscriber's input is the kudosGiven event the engine publishes in its own transaction, never outside input
  checklist: encrypted-storage dismissed: the outbox holds the allowlisted properties and random UUIDs only, nothing designated confidential at rest; the project token lives in the deployment's environment variables
  checklist: key-rotation-compatibility dismissed: nothing is encrypted; a rotated project token replaces the environment variable and pending rows are sent with it
  checklist: input-validation dismissed: the subscriber's argument is checked by the kudosGiven event validator, and every outbox row by the properties validator, scalars only
  checklist: revision-preservation dismissed: a recorded event is never revised; it is sent as recorded and deleted when delivered
  checklist: retry-recognition dismissed: a batch PostHog doesn't accept is resent with the same UUID, name, distinct_id and timestamp, which PostHog deduplicates (O14); the retry schedule belongs to ticket #72
  checklist: duplicate-suppression dismissed: one fact is one event because the engine evaluates an attempt once and the bus schedules each subscriber once per publish (O4), witnessed by the redelivery test
  checklist: keyed-ordering dismissed: PostHog orders events by their timestamp, the spend instant, not by delivery order
  checklist: acknowledgment-barrier dismissed: nothing acknowledges a product event to its source; the Slack event was acknowledged when the engine's transaction committed
  checklist: commit-ordered-effects dismissed: the drain is scheduled from the recording mutation and Convex runs it only after that mutation commits
  checklist: durable-dispatch-intent dismissed: the outbox row is the durable intent; it is written in the subscriber's transaction and leaves only when PostHog answers 2xx
  checklist: retry-classification dismissed: every answer other than 2xx keeps the batch pending; classifying 400 and 413 as rejected belongs to ticket #72
  checklist: declared-target-coverage dismissed: there is one destination, PostHog's batch endpoint
  checklist: completion-evidence dismissed: an event leaves the outbox only after PostHog answered its batch with 2xx
- analytics never blocks the domain: Analytics never blocks the domain: recording a product event makes no network call, and PostHog being down, slow or rejecting a batch changes no award, allowance, indicator or reply.
  over: the HTTP answer, the awards and every call to Slack's API of a kudos message that gives, from a signed Slack request through the whole loop, with PostHog answering 2xx and with PostHog answering 503
  via: PostHog answering 503 changes nothing Slack sees: the same awards, indicator and reply
  because: a giver's kudos must work the same whether PostHog is up or not (O15); an analytics call inside the engine's transaction would make a PostHog outage cost members their kudos
  refuted: the private reply's delivery action called PostHog before sending and skipped the reply when PostHog didn't answer 2xx -> with PostHog answering 503 the giver's reply was missing from the Slack calls, so the test failed on its same-as-2xx assertion (2026-10-13)
  kinds: message, state
  checklist: revalidated-permission dismissed: recording needs no permission; the drain's project token is checked by PostHog on each request
  checklist: destination-confinement dismissed: the drain posts only to the configured POSTHOG_HOST's batch endpoint
  checklist: message-authenticity dismissed: the subscriber's input comes from the engine's own transaction, never from outside
  checklist: input-validation dismissed: the kudosGiven event validator checks the subscriber's argument
  checklist: separation-of-duties dismissed: no approval policy applies to recording or sending analytics
  checklist: legal-state-succession dismissed: an outbox row moves only from pending to sending and back, or is deleted when delivered; no domain state depends on it
  checklist: supersession-safety dismissed: a recorded event is never replaced
  checklist: retry-recognition dismissed: a failed batch goes back to pending with its identity unchanged and is sent by a later drain
  checklist: duplicate-suppression dismissed: covered by the engine's a message gives kudos at most once and the bus scheduling each subscriber once
  checklist: keyed-ordering dismissed: no ordered transport is relied on
  checklist: worker-fencing dismissed: one drain runs at a time through the analyticsDrain row, which the recording and claiming mutations serialize on; lease tokens for a crashed drain belong to ticket #72
  checklist: acknowledgment-barrier dismissed: the Slack event is acknowledged after the engine's mutation commits, which records no analytics itself
  checklist: commit-ordered-effects dismissed: the subscriber runs after the engine's transaction commits, and the drain after the subscriber's
  checklist: resumption-coverage dismissed: the drain resumes by claiming whatever is pending; it keeps no checkpoint
  checklist: retry-classification dismissed: a failed batch never reaches the domain; how it retries belongs to ticket #72
- a flag answers its safe default whenever it can't be evaluated: Reading a flag never throws, and answers the flag's safe default without the flags key, before PostHog's definitions are cached, for a flag PostHog doesn't have, for a value the flag doesn't declare, for a condition local evaluation can't answer, and in a query for a subject that has no analytics ID yet.
  over: reading a boolean and a variant flag in a mutation and in a query, with no key, an empty cache, definitions PostHog serves for other flags, an undeclared variant, a cohort condition, a sandbox-only condition without the environment, and a member without an analytics ID
  via: a flag answers its safe default whenever it can't be evaluated
  because: every new member-facing slice ships dark behind a flag whose safe default is off (the owner's rule, 2026-10-13), so a missing key, a cold cache or an unexpected value must leave the slice off rather than turn it on or break the core loop (O31, O33, O34)
  refuted: declaredValue returned PostHog's value unchecked -> the test failed on its assertion that a value the flag doesn't declare answers the safe default, receiving purple instead of control (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: reading a flag grants nothing; the slice it gates checks its own permissions
  checklist: separation-of-duties dismissed: flags are switched in PostHog, outside this deployment; no approval policy applies to reading one
  checklist: legal-state-succession dismissed: reading a flag changes no state; only the analytics ID or workspace key a mutation creates for the subject, once
  checklist: supersession-safety dismissed: a value that affects an award or a permanent effect is stored with the effect where it is read (O35), so a later definition never rewrites it
  checklist: worker-fencing dismissed: no worker owns a flag; the component's refresh loop replaces the cached definitions in one mutation
  checklist: commit-ordered-effects dismissed: reading a flag has no external effect; its exposure is an outbox row written in the reading mutation
  checklist: resumption-coverage dismissed: nothing resumes; a cold cache answers safe defaults until the component's refresh lands
