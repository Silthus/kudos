# Analytics

Analytics: the only module that knows PostHog. It projects each kudosGiven domain event into the product events kudos given and kudos received, records them in the outbox in the subscriber's transaction while capture is on, under an opaque analytics ID per member and a workspace key per workspace, and one drain at a time sends due events to PostHog's batch endpoint, at most 100 per request, deleting them when PostHog answers 2xx. A batch PostHog doesn't accept is retried with the same identity after successive delays of 1, 5, 30, 120 and 360 minutes; a rejected batch, an event that fails a sixth time and one still pending 7 days after it was recorded are exhausted, logged and deleted 7 days later. Claims carry a lease token, and a recovery check at each lease's expiry releases a dead or stalled drain's batch and replaces that drain, whose generation then claims nothing. Every function is internal; the PostHog spec is issue #69.

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
  checklist: retry-recognition declared as an event keeps its identity across delivery attempts
  checklist: duplicate-suppression dismissed: one fact is one event because the engine evaluates an attempt once and the bus schedules each subscriber once per publish (O4), witnessed by the redelivery test
  checklist: keyed-ordering dismissed: PostHog orders events by their timestamp, the spend instant, not by delivery order
  checklist: acknowledgment-barrier dismissed: nothing acknowledges a product event to its source; the Slack event was acknowledged when the engine's transaction committed
  checklist: commit-ordered-effects dismissed: the drain is scheduled from the recording mutation and Convex runs it only after that mutation commits
  checklist: durable-dispatch-intent dismissed: the outbox row is the durable intent; it is written in the subscriber's transaction and leaves only when PostHog answers 2xx
  checklist: retry-classification dismissed: an answer is classified in one place, answerTo in drain.ts: 2xx delivered, 400 and 413 rejected, everything else retried; no answer ever widens what a request carries
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
  checklist: legal-state-succession dismissed: an outbox row moves between pending, sending and exhausted, or is deleted, and no domain state depends on any of them
  checklist: supersession-safety dismissed: a recorded event is never replaced
  checklist: retry-recognition dismissed: a failed batch goes back to pending with its identity unchanged and is sent by a later drain
  checklist: duplicate-suppression dismissed: covered by the engine's a message gives kudos at most once and the bus scheduling each subscriber once
  checklist: keyed-ordering dismissed: no ordered transport is relied on
  checklist: worker-fencing dismissed: fencing a drain whose lease expired guards the outbox, never the domain; settle touches only rows still holding the claim's unexpired lease token, witnessed by "a drain whose lease expired changes nothing, before the recovery check and after another drain claimed its rows"
  checklist: acknowledgment-barrier dismissed: the Slack event is acknowledged after the engine's mutation commits, which records no analytics itself
  checklist: commit-ordered-effects dismissed: the subscriber runs after the engine's transaction commits, and the drain after the subscriber's
  checklist: resumption-coverage dismissed: the drain resumes by claiming whatever is pending; it keeps no checkpoint
  checklist: retry-classification dismissed: a failed or rejected batch never reaches the domain; only its outbox rows change
- an event keeps its identity across delivery attempts: An event keeps its identity across delivery attempts: every attempt to deliver a recorded product event sends the UUID, name, distinct_id and timestamp it was given when it was recorded, however often PostHog fails to accept it.
  over: every request the drain sends for one recorded kudos given and kudos received, through each failure PostHog can give short of rejection (429, 503, 401, a network error, no answer within 10 seconds) to the attempt it accepts, checked against the outbox rows as recorded
  via: O14: every retry sends the same UUID, name, distinct_id and timestamp as the first attempt
  because: PostHog drops a repeated delivery only when its UUID, name, distinct_id and timestamp match (O14), so a retry after an unknown result, which may have landed, would count the fact twice if any of them changed; and a timestamp moved to the retry would place the fact at the wrong time
  refuted: a retried row was given a fresh UUID when settle rescheduled it -> the test failed on its assertion that every attempt's UUIDs equal the recorded rows' (2026-10-13)
  kinds: message, state
  checklist: revalidated-permission dismissed: the drain acts for the deployment, never for a member, and PostHog checks the project token on every request
  checklist: destination-confinement dismissed: the destination is the configured POSTHOG_HOST's batch endpoint whatever the attempt; an identity is never a destination
  checklist: message-authenticity dismissed: the drain accepts no signed message; PostHog's answer is read only for its status code
  checklist: input-validation dismissed: every outbox row is checked by the schema's validators when it is recorded, and a retry rewrites only its delivery fields
  checklist: separation-of-duties dismissed: no approval policy applies to delivering analytics
  checklist: legal-state-succession dismissed: identity fields are written once at recording; the drain's transitions between pending, sending and exhausted patch only failures, dueAt, lease and reason
  checklist: supersession-safety dismissed: a recorded event is never replaced by a later one; a late drain's settle is fenced by the lease token
  checklist: retry-recognition dismissed: this invariant is the recognition: PostHog recognises a retry whose earlier delivery landed by the unchanged identity
  checklist: duplicate-suppression dismissed: PostHog suppresses a repeated delivery on the identity this invariant keeps; one fact being one event rests on O4, witnessed by the redelivery test
  checklist: keyed-ordering dismissed: PostHog orders events by their timestamp, which this invariant keeps, not by delivery order
  checklist: worker-fencing dismissed: settle touches only rows still holding the claim's unexpired lease token, witnessed by "a drain whose lease expired changes nothing, before the recovery check and after another drain claimed its rows"; a fenced drain cannot change an identity either
  checklist: acknowledgment-barrier dismissed: an event leaves the outbox only when PostHog answered its batch with 2xx
  checklist: commit-ordered-effects dismissed: the drain is scheduled from the recording mutation and runs only after it commits
  checklist: resumption-coverage dismissed: a released lease returns the whole batch to pending with its identity; the drain keeps no checkpoint
  checklist: retry-classification dismissed: classification decides whether an event is retried, never what a retry carries; it lives in answerTo in drain.ts
