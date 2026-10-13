# Progression

Progression: subscribes to kudosGiven, writes one insert-only effects record per side of every award with its base XP, gate decision and catalogue version, derives XP, levels and skill points, and publishes levelReached with the member's saved skill points and the XP to the next level; it also contributes the thoughtful kudos parse hook.

## invariants
- effects records are insert-only: An effects record, once written, is never changed or deleted, whatever later happens to its award's message, the member's progress or the catalogue.
  over: every module under convex/, outside its tests and the generated code
  via: P8: effects records are only ever inserted, never changed or deleted
  because: an effects record is what an award earned when it was given (ADR-0004, P8, P9); rewriting one would let an edit, a retried subscriber, a later purchase or a catalogue change take XP back or mint it twice, and XP never goes down (ADR-0002)
  refuted: insertEffects overwrote an existing record for the same award and side with ctx.db.patch -> the test failed on its no patch, replace or delete assertion (2026-10-13)
  kinds: storage
  checklist: scoped-reads dismissed: the invariant is about writes; effects records are read by award and side, with no shared population restricted by scope
  checklist: encrypted-storage dismissed: a record holds member and award ids, XP, a day and the gate verdict, nothing designated confidential at rest
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: a record is built by the pure reducer from the kudosGiven event, which Convex validates at the subscriber's boundary, and the table's validator checks it again on insert
  checklist: revision-preservation dismissed: an effects record has no revisions; there is only the first and only write
  checklist: commit-ordered-effects dismissed: writing a record issues no external effect; levelReached is published in the same transaction and its subscribers run only after it commits
  checklist: durable-dispatch-intent dismissed: no external dispatch is tied to the record itself
  checklist: declared-target-coverage dismissed: no fan-out to a registry of targets writes records; one subscriber writes them
  checklist: completion-evidence dismissed: a record is complete when its transaction commits; nothing is queued before its effect
- an award's side is recorded once: Each side of an award gets exactly one effects record and its XP counts once, however often kudosGiven is delivered or its subscriber runs.
  over: a Given kudos message whose kudosGiven the subscriber records, then the same event delivered to the subscriber twice more
  via: P8 P6: delivering the same kudosGiven twice, or retrying the subscriber, leaves one record per side, counts the XP once and reaches a level once
  because: effects are written exactly once (ADR-0004, P8); the bus may run a subscriber again and a later backfill replays awards, and a second record for one side would pay XP twice and publish a second level up
  refuted: removed the anyRecorded check in recordEffects -> the test found 6 records where 2 belong (2026-10-13)
  kinds: message
  checklist: destination-confinement dismissed: the subscriber sends nothing anywhere; levelReached goes only to the in-process bus
  checklist: message-authenticity dismissed: kudosGiven comes from the engine's own transaction, never from outside; the Slack event behind it is covered by signed Slack requests only
  checklist: input-validation dismissed: the subscriber's argument is checked by the kudosGiven event validator, and only the engine publishes the event
  checklist: retry-recognition dismissed: a repeated event is recognized by the award and side of its records, which are already stored, and is skipped as done, never reported as a conflict
  checklist: duplicate-suppression declared as an award's side is recorded once
  checklist: keyed-ordering dismissed: XP is a sum, so the order in which kudosGiven events are recorded doesn't change a member's total; Convex serializes the mutations that touch one member's progress
  checklist: acknowledgment-barrier dismissed: nothing acknowledges kudosGiven; the subscriber's mutation commits its records and progress together
  checklist: retry-classification dismissed: the subscriber calls no external system
