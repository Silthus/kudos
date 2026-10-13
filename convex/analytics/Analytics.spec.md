# Analytics

Analytics: the only module that knows PostHog. It projects each kudosGiven domain event into the product events kudos given and kudos received, each attemptFailed into attempt failed and each memberWelcomed into member welcomed, and the Slack adapter's usage facts into app home opened and command used, and records them in the outbox in the subscriber's transaction while capture is on, under an opaque analytics ID per member and a workspace key per workspace, and one drain at a time sends due events to PostHog's batch endpoint, at most 100 per request, deleting them when PostHog answers 2xx. Every function is internal; the PostHog spec is issue #69.

## invariants
- only allowlisted properties leave the deployment: Only the properties a projection lists by name for its event leave the deployment for PostHog; message text, names, time zones, emoji names, Slack IDs and Convex document IDs never do.
  over: every PostHog request body the drain sends for a kudos message full of distinctive words, display names, a custom kudos emoji, time zones, Slack user, team, channel, message and thread IDs, run through the whole loop from a signed Slack request, followed by an Over allowance and an Invalid message from the same giver, their App Home opening and their /hedgehug in a named channel, checked against those values, every stored Convex document ID and any Slack-shaped ID
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
