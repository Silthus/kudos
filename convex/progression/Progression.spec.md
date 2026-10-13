# Progression

Progression: subscribes to kudosGiven, writes one insert-only effects record per side of every award with its base XP, gate decision and catalogue version, derives XP, levels and skill points (one per level from level 5, none for levels 2 to 4), and publishes xpRecorded for each member whose XP it recorded, and levelReached with the member's saved skill points and the XP to the next level; a one-off backfill replays the awards given before its first run into base XP records and tells nobody; it also contributes the thoughtful kudos parse hook, App Home's level, XP to the next level and skill points, and owns a member's progression settings (mute notices, DMs), which the setProgressSettings command sets; and it declares the xp-levels flag (workspace subject, off by default), which every member-facing XP and levels surface reads before it shows anything, while progression keeps recording XP dark.

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
- the slice is dark while xp-levels is off: While the xp-levels flag is off, unset or unreadable, no member sees anything of XP and levels: no level-up DM, public level notice, App Home section, tab or setting, and a click on an App Home button published while it was on changes no setting; XP is still recorded, so turning the flag on shows what was earned and turning it off again rewrites nothing.
  over: every Slack call and App Home view the app makes for a level reached, an App Home opening and a click on a stale App Home button, with xp-levels turned off in PostHog, not created there, on in the sandbox only and read in production, and unreadable for a missing flags key
  via: the xp-levels flag hides the slice while it is off
  because: every new member-facing slice reaches production dark behind a flag whose safe default is off (the owner, 2026-10-13; O33); XP is recorded dark rather than not at all, so the flag only decides what members see and never what they earned (O35), and a flag change can neither take XP back nor leave a gap the backfill would have to fill
  refuted: removed the xp-levels check in notifyLevelReached -> all 4 off cases failed on the level-up DM's conversations.open for U_ALICE (2026-10-13)
  kinds: output
  checklist: destination-confinement dismissed: the gate only withholds sends; where a level-up DM, a notice or App Home goes is unchanged and covered by feedback's and the adapter's own invariants
  checklist: redaction dismissed: the gate removes whole surfaces rather than scrubbing content inside one
  checklist: commit-ordered-effects dismissed: each gate reads the flag in the mutation that schedules the send, so a withheld send is never scheduled and a shown one goes out only after that mutation commits
  checklist: circuit-breaker-policy dismissed: the flag is read from the PostHog component's cached definitions, never by calling PostHog per read, so there is no failure history to divert on
  checklist: declared-target-coverage dismissed: the surfaces are the level-up DM, the public level notice, App Home and its clicks, each gated in its own mutation or query and each covered by a case of the oracle; there is no fan-out registry
