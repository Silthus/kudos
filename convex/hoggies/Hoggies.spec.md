# Hoggies

Hoggies: the hoggies and team crests members collect from the crates they open (CL1–CL26, decision 25), knowing nothing about why a crate was opened. It owns the versioned hoggie catalogue, version 1 being every hoggie in the pinned `@posthog/brand` 0.13.0 with one rarity each, common, uncommon, rare, epic or legendary, weighted 50, 28, 14, 6 and 2, and version 2 adding the package's 54 team crests, each with a frozen roster of two to four version 1 hoggies, every hoggie on exactly one; the draw, a pure function of the deployment's `HOGGIE_DRAW_SECRET` (the empty string where it is unset), the member, the crate key and the catalogue version, through SHA-256, whose first 4 bytes pick the rarity by cumulative weight and whose next 4 pick the hoggie in catalogue order; the `collection` flag, a member decision off by default, read without exposure everywhere but the drop; the `crests` flag, a member decision off by default, read without exposure everywhere but an open that completes or answers a crest; and each member's insert-only drop records, unique per member and crate key, with the hoggie, its rarity at the draw, the member's drop sequence `n`, the hoggie's `copy`, the catalogue version, the open's time and, from version 2, the crest the drop completed or null, beside a tally per member and hoggie and one per member, written in the drop's mutation so no read counts the history. Its one write, `dropFor`, called by Quests and Unlocks in the mutation of a crate's first successful open of a weekly quest, a Journey step or a feature (CL6; a group quest's crate drops none), after the open's own writes and before the open's event, reads `collection` with exposure, draws, stores the drop and its tallies with the crest it completed whatever `crests` says, and publishes hoggieDropped, or does nothing where the crate already dropped or `collection` is off; `dropOf` answers a crate's stored drop and `dropsNewestFirst` a member's drops by time and then `n`, both read from the drop records. `collectionOf` answers every catalogue hoggie with the member's count and first find, each rarity's chance, held and catalogue counts and, while `crests` is shown, every crest with its roster, the roster hoggies held and when it was collected, at the first find of the roster hoggie with the highest drop sequence, never stored as its own record, read from the member's tallies through one index range of at most one row per catalogue hoggie, never the drop records; `hoggiesOf` answers App Home how many distinct catalogue entries the member holds, the catalogue's size, their newest drop and, while `crests` is shown, how many crests they collected, read from those tallies and the one newest drop record. Only this module writes drop records and tallies.

## invariants
- a crate drops at most one hoggie: A member's crate drops at most one hoggie, decided at its first successful open: that open draws once, stores one drop record and publishes hoggieDropped once, and every later open of the crate, from App Home or the website, under a new event or as a replayed request, answers that same drop and writes no drop record; the same member, crate and catalogue version draw the same hoggie on any backend with the same secret, so a retried open draws the same; a refused open, a feature opened by a launch and a crate opened while collection was off drop nothing, then or later.
  over: a finished Journey step's, a finished weekly quest's and a ready feature's crate opened on the website, from App Home and from both, opened again on the website, from App Home under a new event and as a replayed click in App Home, the same crate opened in two fresh backends, a refused quest crate and feature, a feature opened by the unlocks launch, a crate opened while collection was off and opened again once it was on, a held crate's open with what it applied, and the drops each leaves, read through the website's answers, dropsNewestFirst and the events published
  via: CL20: a crate drops at most one hoggie
  because: the drop is what the crate held (CL7): if a second open, a second device or a replayed request drew or stored again, a member could duplicate a hoggie by clicking twice or see a different hoggie each time they opened the same crate (user story 6), and a draw that changed between retries would answer a hoggie the stored record doesn't hold
  refuted: dropFor no longer looked up the crate's stored drop, and openQuestCrate called it again on a repeated open -> a second click of Open in App Home left two drops, and a crate opened while collection was off answered a drop once it was on (2026-10-15)
  kinds: storage, state
  checklist: scoped-reads dismissed: dropOf and dropsNewestFirst read one member's records by the member they are given; the website's guard decides which member that is
  checklist: revalidated-permission dismissed: nothing is queued; the drop is drawn and stored inside the open's own mutation
  checklist: encrypted-storage dismissed: drop records are game data, not confidential; the draw's secret lives in the deployment's environment, never in a table
  checklist: key-rotation-compatibility dismissed: nothing is encrypted, and the draw's secret is set once per deployment and never rotated (CL8)
  checklist: input-validation dismissed: dropFor takes only internal arguments from Quests and Unlocks, checked by the drop record's validator; nothing from outside reaches it
  checklist: revision-preservation declared as a drop never changes
  checklist: separation-of-duties dismissed: no approval policy; a member's own open drops their own hoggie
  checklist: legal-state-succession dismissed: a crate goes from undropped to dropped once, and Convex serializes the mutations that read and write one member's drop record for a crate, so a concurrent second open sees the first's record or retries
  checklist: supersession-safety dismissed: no late work publishes a drop; it is written in the open's mutation or not at all
  checklist: worker-fencing dismissed: no worker owns a drop; every drop is one mutation
  checklist: commit-ordered-effects dismissed: the drop issues no external effect; hoggieDropped schedules analytics, which runs only after the mutation commits
  checklist: durable-dispatch-intent dismissed: hoggieDropped is scheduled in the drop's own mutation, so it commits with the drop or not at all
  checklist: resumption-coverage dismissed: no batch writes drops; a launch's openings never drop (CL6)
  checklist: declared-target-coverage dismissed: the callers are Quests' openQuestCrate and Unlocks' openUnlock, both reached by the oracle from App Home and the website
  checklist: completion-evidence dismissed: nothing waits on a drop; it commits with its open or not at all
- a drop never changes: A drop record, once written, is never changed or deleted: a later catalogue version's rarities, a later drop of the same hoggie and collection going off and on again leave its hoggie, rarity and copy as they were, and every answer reads them from the record, never from the catalogue as it is now.
  over: a stored drop answered again by the website after the catalogue moved its hoggie to another rarity, after a second drop of the same hoggie, and after collection went off and on again, read through the website's answers and dropsNewestFirst
  via: CL20: a drop never changes
  because: a drop is what the crate held when it was opened (CL2, CL11): a rarity re-read from a later catalogue would turn a legendary find common after the fact, a copy recounted later would rename a first find a duplicate, and turning collection off and on would hand back different hoggies, all taking from a member what they found
  refuted: a drop's answer read its rarity from the catalogue as it is now instead of from the drop record -> the repeated open after the catalogue moved the hoggie answered the new rarity (2026-10-15)
  kinds: storage
  checklist: scoped-reads dismissed: the invariant is about what a stored record answers, not which records a read returns
  checklist: encrypted-storage dismissed: drop records are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the drop record's validator checks every row the module writes
  checklist: revision-preservation declared as a drop never changes
  checklist: commit-ordered-effects dismissed: no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: declared-target-coverage dismissed: dropOf and dropsNewestFirst are the module's only reads of drop records, both read by the oracle
  checklist: completion-evidence dismissed: nothing waits on a read
- the collection is dark where collection is off: With `collection` off, missing in PostHog, unread without the flags key, or in production while it is on in the sandbox and for the product owner's email only, every Slack call, website answer, activity page, product event and table row a walk of crates opened in Slack and on the website leaves equals what the same walk leaves where this module decides nothing, apart from the flag's own exposure; with it on for one member's email only, only that member's opens drop and every other member's App Home, Slack calls and website answers equal those with it off; and `collection` is exposed once per member and value, only in a crate's first successful open, never by App Home, the activity or the Book's collection.
  over: two members at level 4 who each gave a kudos, each opening a feature and their Journey crate from App Home twice with the website closed, then a feature and the Journey crate again on the website, every activity page, getCollection and getBook, and App Home after, in each of the four off states beside the same walk with the hoggies module deciding nothing, and with collection on for everyone as the positive control and for one member's email; and a locked feature and an undrawn weekly crate opened in Slack and on the website before any successful open, then opens, App Home, the activity and getCollection read through collection on, off and on again for two members
  via: CL18: the collection is dark where collection is off, drops only for the members it is on for, and only a first open exposes it
  refuted: dropShownTo no longer asked whether collection is shown to the member -> 3 of 7 tests failed: with collection off, missing in PostHog and in production, the website's opens answered a drop field the walk without the collection doesn't (2026-10-15)
  because: production is live (decision 18) and the collection ships dark behind `collection` (CL18): a drop, a `drop` field, a found entry or the collection's App Home line where it is off would show members a feature nobody turned on for them, and an exposure from a read would count members who never decided anything (CL7)
  kinds: state, output
  checklist: revalidated-permission dismissed: every open, App Home publish and website read decides `collection` for the member when it runs, never from a stored value
  checklist: legal-state-succession dismissed: where collection is off nothing of the collection is written
  checklist: supersession-safety dismissed: the flag is read fresh in the mutation or query that decides; only the exposure is stored, once per value
  checklist: worker-fencing dismissed: no worker owns a member's drops; the open's one mutation decides and writes
  checklist: commit-ordered-effects dismissed: App Home is published and hoggieDropped reaches analytics only after the deciding mutation commits
  checklist: destination-confinement dismissed: the decision withholds lines, fields and entries; where Slack calls and answers go is unchanged
  checklist: redaction dismissed: the decision removes the whole line, field or entry rather than scrubbing content inside it
  checklist: circuit-breaker-policy dismissed: the flag is read from the PostHog component's cached definitions, never by calling PostHog per read
  checklist: declared-target-coverage dismissed: the surfaces are App Home, the Slack opens, the website's opens, getActivity, getCollection and getBook, each read by the oracle's walk
  checklist: separation-of-duties dismissed: the flag is switched in PostHog by the owner, outside this deployment
  checklist: resumption-coverage dismissed: no batch runs for the collection; a drop is one open's mutation, and widening runs no backfill (CL19)
- turning collection off takes nothing away: With drops made, turning `collection` off, dropping it from PostHog or unsetting the flags key hides the collection's App Home line, getCollection's collection and every found entry and leaves every drop record and tally as it was; a crate opened while it is off stays without a drop, answering `drop: null` once it is on again; and on again shows the same line, collection and found entries as before.
  over: a member who dropped twice from App Home, in each of the three off states and on again, read through App Home, getCollection, getActivity and the drop records and tallies, and a feature opened in Slack while off and opened again in Slack and on the website once on
  via: CL11: turning collection off hides every hoggie and takes nothing away; on again shows the same
  refuted: App Home's hoggies line no longer asked whether collection is shown to the member -> 2 of 5 tests failed: with collection off and missing in PostHog, App Home still showed the Hoggies line (2026-10-15)
  because: CL11 promises a rollback takes nothing away: a drop deleted or rewritten while off, or a draw for a crate opened while off, would hand a member a different collection when the flag comes back
  kinds: state, output
  checklist: revalidated-permission dismissed: each read decides `collection` when it runs, never from a value stored while it was on
  checklist: legal-state-succession dismissed: turning the flag off writes nothing; drop records are insert-only (a drop never changes)
  checklist: revision-preservation declared as a drop never changes
  checklist: supersession-safety dismissed: nothing stored records the flag's value but the exposure
  checklist: commit-ordered-effects dismissed: turning a flag off issues no effect
  checklist: declared-target-coverage dismissed: the surfaces are App Home, getCollection and getActivity, each read by the oracle
  checklist: destination-confinement dismissed: turning the flag off withholds lines, fields and entries; where Slack calls and answers go is unchanged
  checklist: redaction dismissed: the decision removes the whole line, collection or entry rather than scrubbing content inside it
  checklist: separation-of-duties dismissed: the flag is switched in PostHog by the owner, outside this deployment
  checklist: worker-fencing dismissed: no worker owns a member's drops; nothing runs when the flag turns off
  checklist: resumption-coverage dismissed: turning the flag on again runs no backfill (CL11, CL19)
  checklist: circuit-breaker-policy dismissed: the flag is read from the PostHog component's cached definitions, never by calling PostHog per read
- a collected crest stays collected: Once a member holds at least one of every hoggie on a crest's roster, that crest stays collected, at the first find of the roster hoggie that completed it, through every later drop, a duplicate of a roster hoggie, a later catalogue version and `crests` going off and on again; the drop that completed it answers the crest on every later call, and no other drop ever does.
  over: a member who completed a two-hoggie roster on the website and then dropped a duplicate of one of its hoggies, opened a crate again under a later catalogue version, and saw crests go off and on again, read through getCollection's crests and the website's answers to the completing open
  via: CL23: a collected crest stays collected
  refuted: crestHeldIn counted a roster hoggie as held only while the member held exactly one of it -> 1 of 2 tests failed: after a duplicate of a roster hoggie the crest read as no longer collected (2026-10-16)
  because: decision 25 promises "once you collect the whole team, you collect this crest sticker in the book" and CL26 that crests never go away: a crest that a duplicate, a newer catalogue or a rollback could uncollect, or move to a later time, would take a finished set back from a member
  kinds: storage, state
  checklist: scoped-reads dismissed: collectionOf and hoggiesOf read one member's tallies by the member they are given; the website's guard and App Home's viewer decide which member that is
  checklist: revalidated-permission dismissed: a crest is derived from the tallies when it is read, never from a stored grant that could go stale
  checklist: encrypted-storage dismissed: crests are game data derived from drop tallies, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: dropFor takes only internal arguments, and the drop record's validator checks the crest it stores
  checklist: revision-preservation declared as a drop never changes
  checklist: separation-of-duties dismissed: no approval policy; a member's own drops collect their own crests
  checklist: legal-state-succession dismissed: a crest goes from not collected to collected once, because tallies only grow and published rosters never change (CL22, proved by the catalogue's roster test)
  checklist: supersession-safety dismissed: nothing late writes a crest; it is derived at each read and recorded on the completing drop in the open's mutation
  checklist: worker-fencing dismissed: no worker owns a crest; the open's one mutation writes the drop that completes it
  checklist: commit-ordered-effects dismissed: collecting a crest issues no external effect; App Home is republished after the open commits
  checklist: durable-dispatch-intent dismissed: nothing is dispatched for a crest
  checklist: resumption-coverage dismissed: no batch collects crests; a roster held before version 2 is collected by the read itself, with no backfill
  checklist: declared-target-coverage dismissed: the surfaces are getCollection's crests, the website's open answers and App Home's count, read by the oracle and the crests gate
  checklist: completion-evidence dismissed: nothing waits on a crest; it is read from the tallies
- the crests are dark where crests is off: With `crests` off, missing in PostHog, unread without the flags key, or in production while it is on in the sandbox and for the product owner's email only, every Slack call, website answer, activity page, product event and table row a walk of crates opened in Slack and on the website, completing a crest for each member, leaves equals what the same walk leaves where the crests decide nothing, apart from the flag's own exposure; with it on for one member's email only, only that member sees crests, and every other member's App Home, Slack calls and website answers equal those with it off; and `crests` is exposed once per member and value, only by an open that completes or answers a crest, never by App Home, the activity or the Book's collection.
  over: two members at level 4 with collection on, each opening a feature and their Journey crate from App Home twice, then a feature and the Journey crate on the website, one member's roster completed in Slack and the other's on the website, every activity page, getCollection and getBook, and App Home after, in each of the four off states beside the same walk with the crests deciding nothing, with crests on for everyone as the positive control and for one member's email; and the opens, App Home and the website's reads before and after each member's completing open
  via: CL26: crests are dark where crests is off, show only to the members it is on for, and only an open that completes a crest exposes it
  refuted: App Home's hoggies line no longer asked whether crests is shown to the member -> 4 of 7 tests failed: with crests off, missing in PostHog and in production App Home counted crests the walk without crests doesn't, and with crests on for one email only the other member's App Home changed (2026-10-16)
  because: production is live (decision 18) and crests ship dark behind `crests` (CL26): a `crest` field, a `crests` list or the crests count on App Home where it is off would show members a feature nobody turned on for them, and an exposure from a read would count members who never decided anything
  kinds: state, output
  checklist: revalidated-permission dismissed: every open, App Home publish and website read decides `crests` for the member when it runs, never from a stored value
  checklist: legal-state-succession dismissed: `crests` decides only what is shown; the crest on a drop record is written whatever it says, so turning it on or off writes nothing
  checklist: supersession-safety dismissed: the flag is read fresh in the mutation or query that decides; only the exposure is stored, once per value
  checklist: worker-fencing dismissed: no worker owns a member's crests; the open's one mutation decides and writes
  checklist: commit-ordered-effects dismissed: App Home is published and the exposure reaches analytics only after the deciding mutation commits
  checklist: destination-confinement dismissed: the decision withholds fields, lists and a count; where Slack calls and answers go is unchanged
  checklist: redaction dismissed: the decision removes the whole field, list or count rather than scrubbing content inside it
  checklist: circuit-breaker-policy dismissed: the flag is read from the PostHog component's cached definitions, never by calling PostHog per read
  checklist: declared-target-coverage dismissed: the surfaces are App Home, the Slack opens, the website's opens, getActivity, getCollection and getBook, each read by the oracle's walk
  checklist: separation-of-duties dismissed: the flag is switched in PostHog by the owner, outside this deployment
  checklist: resumption-coverage dismissed: no batch runs for crests; widening `crests` runs no backfill, since crests are derived
