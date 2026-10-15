# Hoggies

Hoggies: the hoggies members collect from the crates they open (CL1–CL20, decision 25), knowing nothing about why a crate was opened. It owns the versioned hoggie catalogue, version 1 being every hoggie in the pinned `@posthog/brand` 0.13.0 with one rarity each, common, uncommon, rare, epic or legendary, weighted 50, 28, 14, 6 and 2; the draw, a pure function of the deployment's `HOGGIE_DRAW_SECRET` (the empty string where it is unset), the member, the crate key and the catalogue version, through SHA-256, whose first 4 bytes pick the rarity by cumulative weight and whose next 4 pick the hoggie in catalogue order; the `collection` flag, a member decision off by default, read without exposure everywhere but the drop; and each member's insert-only drop records, unique per member and crate key, with the hoggie, its rarity at the draw, the member's drop sequence `n`, the hoggie's `copy`, the catalogue version and the open's time, beside a tally per member and hoggie and one per member, written in the drop's mutation so no read counts the history. Its one write, `dropFor`, called by Quests and Unlocks in the mutation of a crate's first successful open, after the open's own writes and before the open's event, reads `collection` with exposure, draws, stores the drop and its tallies, and publishes hoggieDropped, or does nothing where the crate already dropped or `collection` is off; `dropOf` answers a crate's stored drop and `dropsNewestFirst` a member's drops by time and then `n`, both read from the drop records. `collectionOf` answers every catalogue hoggie with the member's count and first find, and each rarity's chance, held and catalogue counts, read from the member's tallies through one index range of at most one row per catalogue hoggie, never the drop records; `hoggiesOf` answers App Home how many distinct catalogue entries the member holds, the catalogue's size and their newest drop, read from those tallies and the one newest drop record. Only this module writes drop records and tallies.

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
