# Engine

Kudos engine: observes message events, checks the directory, decides each attempt's outcome against the daily allowance, writes awards and publishes kudosGiven, and answers App Home with a member's facts: the daily allowance left and the kudos given and received.

## invariants
- awards are insert-only: An award, once written, is never changed or deleted, whatever later happens to its message, its giver's allowance or its delivery.
  over: every module under convex/, outside its tests and the generated code
  via: R18: awards are only ever inserted, never changed or deleted
  because: an award is permanent recognition (ADR-0001); an edit, a deletion, a retried delivery or a later module must never take kudos back or change how many were given
  refuted: added withdrawAward to the awards module, which deletes an award by id -> the test failed on its no patch, replace or delete assertion (2026-10-13)
  kinds: storage
  checklist: scoped-reads dismissed: the invariant is about writes; awards are read whole by their recipient, with no shared population restricted by scope
  checklist: encrypted-storage dismissed: an award holds member ids, counts and dates, nothing designated confidential at rest
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the award row is written by the engine from validated rows, never from outside input
  checklist: revision-preservation dismissed: awards have no revisions; there is only the first and only write
  checklist: commit-ordered-effects dismissed: writing an award issues no external effect; the indicator delivery is scheduled in the same transaction and runs only after it commits
  checklist: durable-dispatch-intent dismissed: no external dispatch is tied to the award row itself
  checklist: declared-target-coverage dismissed: no fan-out to a registry of targets; spec 1 registers no subscriber
  checklist: completion-evidence dismissed: an award is complete when its transaction commits; nothing is queued before its effect
- a message gives kudos at most once: A kudos message gives kudos at most once, however often Slack redelivers it and however often its giver edits it, an edit away from a kudos message and back into one included.
  over: a kudos message the engine observes twice, a retry Slack delivers twice, and a message that gave kudos and is then edited away from a kudos message and back into one
  via: R19: a message gives at most once
  because: an award is permanent (ADR-0001), so a second evaluation of a message that already gave would pay its recipients twice and spend the giver's allowance twice; Slack redelivers events and an edit can turn a message back into a kudos message (R19, R26)
  refuted: observeEdit no longer treated a message that gave kudos as accepted -> the edit away and back test gave Bob a second kudos (2026-10-13)
  kinds: message, revision
  checklist: destination-confinement dismissed: the engine sends nothing anywhere; its feedback is delivered by the Slack adapter to one configured base URL
  checklist: message-authenticity dismissed: the engine trusts its caller; the Slack adapter's signed Slack requests only verifies every event before it reaches observe
  checklist: input-validation dismissed: observe takes a MessageEvent that Convex validates against messageEventValidator at the internal mutation's boundary
  checklist: revision-preservation dismissed: a kudos message keeps only its newest revision as a watermark; no history of revisions is published or addressed
  checklist: retry-recognition dismissed: a redelivered event or a repeated edit is recognized by its revision at or below the newest seen and answered as unchanged or stale, never as a conflict
  checklist: duplicate-suppression declared as a message gives kudos at most once
  checklist: keyed-ordering dismissed: no transport ordering is relied on; the newest revision wins whatever order Slack delivers in (R21), and Convex serializes the mutations that touch one message's row
  checklist: acknowledgment-barrier dismissed: the event is acknowledged after the mutation that records its receipt and evaluates it commits
  checklist: retry-classification dismissed: observe calls no external system; delivery retries belong to R35's slice
