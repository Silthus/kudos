# Analytics

Analytics: the only module that knows PostHog. It projects each kudosGiven domain event into the product events kudos given, which says whether the giver's gate decision found the message thoughtful, and kudos received, each attemptFailed into attempt failed, each memberWelcomed into member welcomed and each levelReached into level reached, via kudos when the event carries a kudos message and via reward when a reward record crossed the level, each unlockReady into unlock made ready, each unlockOpened a member opened into unlock opened by member, and each unlocksLaunched into one unlock opened by launch per opening it names, each naming its feature from one table of feature names, each questFinished into quest finished with its kind, the weekly quest's pool ID or the Journey step's ID, and the reward's XP and coins, leaving out whichever of them an event queued before they were added lacks, each questsDrawn into one quest drawn per drawn quest and each questSwapped into quest swapped with the replaced quest, each quest named only by its pool ID, each journeyStepActivated into journey step activated with the step's ID, and the Slack adapter's usage facts into app home opened and command used, and each accepted request to see a board the board's rules show into leaderboard viewed, with its board, period and surface, recorded once where the request is accepted and in a scheduled mutation of its own so a failure never undoes the member's choice or reply, and records them in the outbox in the subscriber's transaction while capture is on, under an opaque analytics ID per member and a workspace key per workspace, and one drain at a time sends due events to PostHog's batch endpoint, at most 100 per request, deleting them when PostHog answers 2xx. A batch PostHog doesn't accept is retried with the same identity after successive delays of 1, 5, 30, 120 and 360 minutes; a rejected batch, an event that fails a sixth time and one still pending 7 days after it was recorded are exhausted, logged and deleted 7 days later. Claims carry a lease token, and a recovery check at each lease's expiry releases a dead or stalled drain's batch and replaces that drain, whose generation then claims nothing. It is also the feature flag seam: a flag is declared once with its key, subject, values and safe default, is read through the PostHog component's locally evaluated definitions on the subject's analytics ID or workspace key, and sends its exposure once per member, flag and value, only when the flags key is set, since without it nothing was evaluated. Its error boundary wraps every HTTP route and action outside the module and records an error nobody caught as one exception event before rethrowing it marked [reported]; its failed-job sweep, every 15 minutes, records each scheduled function that failed without a boundary reporting it, rereading the jobs created at its cursor's instant so a job tied with the last one it read is not skipped. A recording mutation that fails logs a fixed code and is never recorded as an exception. Only a reportable error sends its message. With native error reporting switched on, neither records anything. Every function is internal; the PostHog spec is issue #69.

## invariants
- only allowlisted properties leave the deployment: Only the properties a projection lists by name for its event leave the deployment for PostHog; message text, the gate decision's word count, names, time zones, emoji names, Slack IDs and Convex document IDs never do.
  over: every PostHog request body the drain sends, with xp-levels, unlocks and quests on, for a kudos message that takes its giver to level 2 and activates and finishes their Journey's first-thanks, full of distinctive words, display names, a custom kudos emoji, time zones, Slack user, team, channel, message and thread IDs, run through the whole loop from a signed Slack request, followed by an Over allowance and an Invalid message from the same giver, their App Home opening and their /hedgehug in a named channel, then with unlocks off and everyone-board on their Leaderboard tab and their /hedgehug leaderboard month, checked against those values, every stored Convex document ID, any Slack-shaped ID and the gate decision's fields
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
- an error is reported once: An error nobody caught in an HTTP route, an action or a scheduled function becomes at most one exception event: the error boundary it left first records it and rethrows it marked [reported], so no outer boundary records it again, and the failed-job sweep records a failed job only when no boundary did, at most once per job.
  over: a scheduled action reached from a signed /hedgehug whose Slack call answers not_authed, followed by two failed-job sweeps, the PostHog requests the drain sends for it and the job's final state
  via: O22 O23: an action that throws
  because: issue counts in Error Tracking must be honest (O22, user story 20); a failure that passes through a nested action, a scheduled job and the sweep would otherwise be one issue counted up to three times
  refuted: recordBoundaryException no longer wrote the reportedJobs row for the scheduled function it reported -> the sweep recorded the action's failure a second time and the test failed on its assertion of one exception (2026-10-13)
  kinds: message
  checklist: destination-confinement dismissed: an exception event goes only through the outbox to the configured POSTHOG_HOST's batch endpoint, like every product event
  checklist: message-authenticity dismissed: a boundary records what its own function threw and the sweep reads Convex's own _scheduled_functions table; no outside input claims an error happened
  checklist: input-validation dismissed: the recording mutation's arguments are checked by the exception validator, scalars and a list of frames only
  checklist: retry-recognition dismissed: Convex doesn't retry an action or a scheduled function that failed, and a redelivered Slack request that fails again is a new failure, which Error Tracking groups into the same issue
  checklist: duplicate-suppression declared as an error is reported once
  checklist: keyed-ordering dismissed: PostHog orders exception events by their timestamp, the failure's time
  checklist: acknowledgment-barrier dismissed: the boundary's recording mutation commits before it rethrows, so a failed HTTP route answers Slack only after its exception is recorded; nothing acknowledges an exception to its source
  checklist: retry-classification dismissed: expected outcomes never throw (O21): the delivery path classifies every Slack answer and the drain every PostHog answer, so neither reaches a boundary
- only a reportable error sends its message: Only a reportable error's message leaves the deployment for PostHog; every other error, including malformed JSON, a Convex argument validation error and a dependency error, is sent as unexpected error with its type name and none of its text.
  over: every PostHog request body the drain sends after a signed events request with malformed JSON, a signed events request whose arguments fail Convex's validation, and a /hedgehug whose Slack call throws a dependency error, each full of distinctive words, an emoji name and Slack-shaped IDs
  via: O10 O23: only a reportable error sends its message
  because: an error message can embed the input that caused it (O10, O23); a JSON parse error quotes the body and a validation error prints the arguments, which hold a kudos message's content and Slack IDs
  refuted: exceptionOf sent every Error's message, not only a ReportableError's -> all 3 cases failed on their assertion that the value is unexpected error (2026-10-13)
  kinds: message
  checklist: destination-confinement dismissed: an exception event goes only through the outbox to the configured POSTHOG_HOST's batch endpoint
  checklist: message-authenticity dismissed: the classification reads the error object the boundary caught or the error string Convex stored for a failed job, never outside input that claims to be a reportable error
  checklist: input-validation declared as only a reportable error sends its message
  checklist: retry-recognition dismissed: a retried failure is recorded with the same rules as its first
  checklist: duplicate-suppression dismissed: covered by an error is reported once
  checklist: keyed-ordering dismissed: no ordered transport is relied on
  checklist: acknowledgment-barrier dismissed: nothing acknowledges an exception to its source
  checklist: retry-classification dismissed: the rule classifies an error's content, not whether it is retried
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
