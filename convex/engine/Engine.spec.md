# Engine

Kudos engine: observes message events and their deletions, keeps the kudos text of a message while its newest revision is a kudos message (its words as segments, its channel's visibility, its author and that revision's gate decision), replacing it with each newer revision and leaving a word-free tombstone when the message is edited away, its newer revision comes from an author who is no longer a member, or it is deleted in Slack, after which a deletion never lets words be stored again, checks the directory and rechecks a message that waits on it 1, 6, 36, 156 and 516 minutes after the first miss before abandoning it, decides each attempt's outcome against the daily allowance, writes awards and publishes kudosGiven for a Given attempt and attemptFailed for an Over allowance or Invalid one, reads back every Given message with its awards in award order for the backfills of later subscribers, tells when a giver last thanked each award's recipient before that award, in the order awards were recorded, and answers what App Home shows through homeFacts, a platform-neutral read of a member's facts: the daily allowance left of its base, when it refills (the member's next local midnight, or midnight UTC without a time zone), the kudos emoji, and the kudos given and received this week and in total. homeOf serves those facts to the Slack adapter; any other surface reads the same facts through homeFacts.

## invariants
- only kudos messages' text is stored: The words of a message are stored only while its newest revision is a kudos message, and only in the kudos text: never in another table or a scheduled job's arguments, and never in a captured exception, the analytics outbox or a console line when the events mutation fails.
  over: an ordinary chat message, a kudos message, a kudos message edited away or deleted in Slack, and a failure of the events mutation with capture on
  via: AT40: only kudos messages' text is stored
  because: the owner's decision of 2026-10-14 (d-9e3c1a90) is that the app keeps the words of kudos messages and nothing else (AT1, amending R51); ordinary chat must never sit in the app's database, and a kudos message's words must stay in one table so deleting them in Slack deletes them everywhere
  refuted: forgetDeleted wrote its deleted tombstone only for a message with no kudos text yet -> the deleting it test found the words still stored (2026-10-14)
  kinds: storage
  checklist: scoped-reads dismissed: the invariant is about where words are written; the member reads that confine who reads them are the activity read's (AT14, AT28)
  checklist: encrypted-storage dismissed: the words are kept readable for the member reads by the owner's decision (AT1); no field is designated encrypted at rest
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the segments reach the engine through messageEventValidator at the events mutation's boundary
  checklist: revision-preservation dismissed: only the newest revision's words are kept (AT4); no earlier revision is kept or addressed
  checklist: commit-ordered-effects dismissed: the kudos text is written in the mutation that records the revision it follows and issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched from the kudos text
  checklist: declared-target-coverage dismissed: no fan-out to a registry of targets
  checklist: completion-evidence dismissed: the kudos text is complete when the events mutation commits; nothing is queued
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
