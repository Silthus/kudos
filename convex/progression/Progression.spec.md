# Progression

Progression: subscribes to kudosGiven, writes one insert-only effects record per side of every award with its base XP, gate decision and catalogue version, derives XP, levels and skill points (one per level from level 5, none for levels 2 to 4) from base XP and bonus XP, writes on the giver's record, while the skill tree applies, one bonus line `{ source, xp }` per owned perk that pays on the award (P7, P16, P18, P20): a qualifying recognition is the first award from a giver to a recipient on the giver's day whose stored gate decision says thoughtful, read from the giver's recorded awards of the giver's week whatever the giver owns, so a later purchase never re-creates a first (P17); spark pays 5 XP on the day's first, rhythm 2 on every one and circle 5 on the week's first to each recipient, each from base values, once per award however many kudos it carries; a perk pays on the records written after its purchase and never rewrites an earlier one (P9, P21), records written before bonus lines existed stay as they are, and an owned perk pays by its ID even once it is retired from the tree, where nobody else can buy it (P5); and publishes xpRecorded for each member whose XP it recorded, and levelReached with the member's saved skill points and the XP to the next level; it owns reward records (P87, ADR-0004 as amended): recordReward, in one mutation, inserts one insert-only reward record keyed by what it pays for, with its XP, coins, item and catalogue version, applies its XP once and publishes xpRecorded and levelReached, without a kudos message, for a level it crosses, and a second call with the same key writes and publishes nothing; levels and skill points count reward records like effects records; a one-off backfill replays the awards given before its first run into base XP records and tells nobody; it also contributes the thoughtful kudos parse hook, App Home's level, XP to the next level and skill points, and owns a member's progression settings (mute notices, DMs), which the setProgressSettings command sets; it owns the skill tree (P18, P19): the tree is versioned catalogue data keyed by perk ID, so far its first row only, spark, rhythm and circle at level 5 for one skill point each with no prerequisite, each described with P94's copy; buyPerk has two entrances, both through the command registry behind the skill tree's predicate, each with an idempotency key in its own space: Slack's `Buy`, keyed `slack:` and the click's trigger, and the website's (#183), keyed `website:`, the member and the request, so no key from one entrance can equal a key from the other; it buys a perk in one mutation when the member has opened the skill tree, their level reaches the perk's row, its prerequisite is owned, it isn't owned yet and they have its skill points: it adds the cost to the points spent, stores the owned perk with its time and catalogue version and publishes perkBought; otherwise it changes nothing, publishes nothing and returns the reason, which for a member who hasn't opened the skill tree is P76's reply; it stores each outcome under its idempotency key in the same mutation, so the same command again returns the first outcome, a purchase or a refusal; perksOf gives the website the unspent skill points, the owned perks with their times, and each catalogue perk's display name, P94 copy, row, cost in skill points, prerequisite, state (buyable, owned or P19's reason why not) and the time it was bought; and it declares the xp-levels flag (workspace subject, off by default), which every member-facing XP and levels surface reads before it shows anything, while progression keeps recording XP dark, and the skill-tree flag (workspace subject, off by default), the skill tree's ship flag in Unlocks' schedule: the skill tree applies only where skill-tree, xp-levels and unlocks all apply, read in each mutation, and where it doesn't, buyPerk writes nothing and perksOf shows nothing.

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
- reward records are insert-only: A reward record, once written, is never changed or deleted, whatever later happens to the quest or step it paid for, the member's progress, a crate opening or the catalogue.
  over: every module under convex/, outside its tests and the generated code
  via: P87: reward records are only ever inserted, never changed or deleted
  because: a reward record is what finishing a quest or Journey step earned, fixed when it was promised (P86, P87, ADR-0004 as amended); rewriting one would let a catalogue change, a replayed finish or a crate opening take XP back or pay it twice, and XP never goes down (ADR-0002); a crate opening is stored beside the record, never on it (P85)
  refuted: insertReward overwrote an existing reward record for the same member and key with ctx.db.patch -> the test failed on its no patch, replace or delete assertion (2026-10-13)
  kinds: storage
  checklist: scoped-reads dismissed: the invariant is about writes; reward records are read by member and key, with no shared population restricted by scope
  checklist: encrypted-storage dismissed: a record holds a member id, a key, XP, coins and a catalogue version, nothing designated confidential at rest
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: a record is built by Quests from its stored activation, and the table's validator checks it again on insert
  checklist: revision-preservation dismissed: a reward record has no revisions; there is only the first and only write
  checklist: commit-ordered-effects dismissed: writing a record issues no external effect; its events are published in the same transaction and reach subscribers only after it commits
  checklist: durable-dispatch-intent dismissed: no external dispatch is tied to the record itself
  checklist: declared-target-coverage dismissed: no fan-out to a registry of targets writes records; recordReward writes them
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
- a skill point is spent once and never refunded: A purchase adds its perk's cost to the member's spent skill points once, however often its command is repeated with the same idempotency key; a purchase without the skill points refuses and spends nothing, so two purchases for one point buy one perk; and nothing lowers the spent points, so a later level up adds its point on top of what is left.
  over: the same purchase twice with one idempotency key, a refusal repeated with its key after the member could buy, two purchases of two perks with one skill point, and a purchase followed by a kudos that reaches the next level, read through the member's standing, the owned perks and the published perkBought events
  via: P4 P19: a skill point is spent once and never refunded
  because: P4 and P5 make skill points permanent and a spent point is never refunded (ADR-0002); a purchase replayed by a retried click or a second entrance would spend a point twice or grant a perk twice, a purchase without the points would mint a perk from nothing, and a refund or a recount that dropped the spent points would let a member buy every perk in the tree
  refuted: perkStateOf skipped the skill point check -> two purchases with one skill point bought both perks (2026-10-14)
  refuted: the reducer reset the spent points when it recorded XP -> a later level up showed 2 skill points where 1 belongs (2026-10-14)
  kinds: storage, message
  checklist: scoped-reads dismissed: a purchase reads one member's progress, owned perks and stored outcomes by member, with no shared population restricted by scope
  checklist: destination-confinement dismissed: a purchase sends nothing anywhere; perkBought goes only to the in-process bus
  checklist: message-authenticity dismissed: the command reaches buyPerk from the adapter only after Slack's signature is verified, which the adapter's own invariant covers
  checklist: encrypted-storage dismissed: an owned perk and a stored outcome hold a member id, a perk ID, a time, a key and a catalogue version, nothing designated confidential at rest
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the command validator admits only perk IDs in the tree, and the tables' validators check every row again on insert
  checklist: revision-preservation dismissed: owned perks and outcomes have no revisions; each is written once
  checklist: retry-recognition declared as a skill point is spent once and never refunded
  checklist: duplicate-suppression declared as a skill point is spent once and never refunded
  checklist: keyed-ordering dismissed: Convex serializes the mutations that touch one member's progress, so two purchases see each other's spending whatever order they run in
  checklist: acknowledgment-barrier dismissed: the click is acknowledged before the command runs; nothing retires responsibility on the purchase's acknowledgment
  checklist: commit-ordered-effects dismissed: a purchase issues no external effect; perkBought's subscribers and App Home's publish run only after its mutation commits
  checklist: durable-dispatch-intent dismissed: no external dispatch is tied to a purchase
  checklist: retry-classification dismissed: a purchase calls no external system
  checklist: declared-target-coverage dismissed: no fan-out to a registry of targets; one mutation writes the purchase
  checklist: completion-evidence dismissed: a purchase is complete when its mutation commits; nothing is queued before its effect
