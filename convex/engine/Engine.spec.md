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
