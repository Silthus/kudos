# Unlocks

Unlocks: owns each member's ready and opened features (P72 to P79, P92, ADR-0006). The schedule is versioned catalogue data with stable feature IDs, each feature shipped by its own flag, so far only the leaderboard by everyone-board; a feature that hasn't shipped is never ready, named or counted. It subscribes to levelReached and stores readiness, with its time, for every shipped feature at or below the level reached, once, publishing unlockReady and republishing App Home, records each level up once, with the features it made ready, before writing anything else, so a replayed levelReached writes nothing and a feature that ships later is made ready by the ship sweep; and in the same mutation has feedback send the level-up DM naming exactly the features that mutation made ready, so each ready feature is named in one DM whichever subscriber runs first; the openUnlock command opens a ready, shipped feature for good, storing openedAt and publishing unlockOpened, and refuses anything else without writing; stateOf answers unshipped, locked, ready or open from the stored facts and the ship state, never from the level; and it gives App Home the ready features with what each opens and the next shipped feature still locked, and the website each shipped feature's state, readyAt and openedAt. Opening only reveals: it grants nothing.

## invariants
- opening grants nothing: Opening a feature writes only that feature's openedAt and publishes only unlockOpened: it writes no effects or reward record and changes no XP, level, skill points or coins, so what a member earned before opening is exactly what they have after.
  over: every table of the schema, read before and after openUnlock opens a ready Leaderboard for a member with an effects record, XP and a level, and every event published by the open
  via: P92: opening grants nothing
  because: a crate only reveals what is already recorded (P92, amended on #97) and unlocks gate what a member sees, never what they earn (ADR-0006, P75); if opening granted anything, a click would gate earning, a member who opened late would find less or more than they earned, and a replayed open could pay twice (P2: opening unlocks gives no XP; P9: an opened unlock never rewrites an earlier record)
  refuted: openUnlock also added 10 XP to the member's progress when it opened a feature -> the test failed on its every-table assertion, memberProgress differing (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: opening acts only on the clicking member's own row, and whether it may open is the stored readiness and the ship flag read in the same mutation; no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: supersession-safety dismissed: openUnlock writes openedAt in its own transaction, and nothing late publishes a different value
  checklist: worker-fencing dismissed: no worker owns a member's unlocks; Convex serializes the mutations that touch one row
  checklist: commit-ordered-effects dismissed: opening issues no external effect; unlockOpened goes to the in-process bus and its subscribers run only after the transaction commits, and the App Home republish is scheduled by the interaction's own mutation
  checklist: resumption-coverage dismissed: no batch operation resumes
- a ready or opened feature is kept for good: A feature once ready stays ready, with its first readyAt, until the member opens it, and once opened stays open, with its first openedAt, for good: through later level ups, a replayed levelReached, a second open, time passing and its flag going off and on; while its flag is off it reads unshipped, and it reads ready or open again with the same times when the flag is back on.
  over: every table of the schema and every published event, across a week passing, later levelReached events, a replayed levelReached, a second open and everyone-board turned off and on again, for a ready Leaderboard and for an opened one
  via: P5: a ready or opened feature is kept for good
  because: opened unlocks never go down, reset or expire (P5, ADR-0002), opening is permanent and idempotent (P73), and a member can leave a feature ready for good (P73, P74, the Octalysis finding on #85); a replayed levelReached that wrote readiness again would move readyAt and publish a second unlockReady, and a flag flip that cleared rows would take an opened feature away
  refuted: makeReady replaced an existing unlock row with a fresh ready one at the new event's time -> both tests failed: the ready Leaderboard's readyAt moved, and the opened one lost its openedAt (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved in keeping a row; the subscriber and the command decide from the stored row and the flag read in their own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: supersession-safety dismissed: readiness is inserted once and openedAt patched once, each guarded by the stored row in the same transaction, so a late or replayed delivery finds the row and writes nothing
  checklist: worker-fencing dismissed: no worker owns the rows; Convex serializes mutations on one member's unlock row
  checklist: commit-ordered-effects dismissed: unlockReady and unlockOpened are published inside the transaction that writes the row and reach subscribers only after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes; the sweep that makes a later-shipped feature ready is #101's
- each ready feature is named in one level-up DM: A level up is told in one DM, once per level reached, and that DM names exactly the features the same mutation made ready, whichever subscriber of levelReached runs first: a replayed levelReached writes and sends nothing, even after the feature's flag went on, and a feature that something else made ready first is never named again.
  over: the level-up DMs the app asks Slack to send and the stored readiness, for levelReached run before and after the other subscribers, replayed, replayed after everyone-board went on, and arriving after the Leaderboard was made ready by something else
  via: P74: one owner for readiness and the level-up DM
  refuted: makeReady no longer returned early when the member's level up was already recorded -> both replay tests failed: the plain replay sent a second DM, and the replay after everyone-board went on made the Leaderboard ready unnamed (2026-10-13)
  because: one level-up notice names every feature its levels made ready (P6, P74), and nothing nudges a member to open a ready feature again (P74); the bus schedules each levelReached subscriber on its own, so a DM sent beside readiness could run before it and name nothing, and a replay or a later sweep (P78) could name a feature twice
  kinds: message, state
  checklist: revalidated-permission dismissed: no permission is involved; whether a member wants DMs is their setting, read in the same mutation that records the level up
  checklist: destination-confinement dismissed: the DM goes to Slack's API at one configured base URL, to the member's own DM conversation, with no destination taken from input
  checklist: message-authenticity dismissed: the DM is outbound; levelReached comes from progression's own transaction, and an Open click is verified by the Slack adapter's signed Slack requests only
  checklist: input-validation dismissed: levelReached is checked by its event validator at the subscriber's boundary, and only progression publishes it
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a level up is recorded once per member and level and never changed; readiness's succession is declared by a ready or opened feature is kept for good
  checklist: supersession-safety dismissed: the level up's record is read first and written with readiness in one transaction, so a late or replayed levelReached finds it and writes nothing
  checklist: retry-recognition declared as each ready feature is named in one level-up DM
  checklist: duplicate-suppression declared as each ready feature is named in one level-up DM
  checklist: keyed-ordering dismissed: one DM per level reached, with no ordering promised between DMs; a member's levels only rise (P5)
  checklist: worker-fencing dismissed: no worker owns a level up; Convex serializes the mutations that touch one member's unlock and level-up rows
  checklist: acknowledgment-barrier dismissed: nothing retires on the DM's acknowledgment; its delivery is the Slack adapter's, bounded by a level-up DM is tried at most 3 times
  checklist: commit-ordered-effects dismissed: the DM's delivery is scheduled in the mutation that records the level up and its readiness, and runs only after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes; the sweep that makes a later-shipped feature ready is #101's
  checklist: retry-classification dismissed: the Slack adapter's delivery classifies failures, by its invariant a level-up DM is tried at most 3 times
