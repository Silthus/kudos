# Quests

Quests: owns each member's quests and the Journey (P80 to P93, ADR-0004 as amended). The Journey is versioned catalogue data keyed by step ID, never by number, and holds only steps whose feature has shipped: so far `first-thanks`, active from the start. Each step's activation is stored per member, once, with its time, its promised reward and the catalogue version, by the first mutation that sees the member while the slice applies: the kudosGiven subscriber for the giver, or App Home's publish for the viewer. It subscribes to kudosGiven and finishes `first-thanks` when the giver's award carries a stored gate decision that says why (P12), read from the event and never from the text: it has progression record the step's reward record with exactly the promised reward, and publishes questFinished, keyed by member and step, and has feedback send the member one DM naming the step and what it earned with an Open button, only when that record was new. A finished step's crate waits for the member for good: the openQuestCrate command opens the clicking member's own crate, named by its quest and never by a member from the payload, and only where a reward record is stored for it; it stores one crate opening (member, reward key, time) beside the reward record, never on it, and publishes questOpened, and a second open, a replayed click or a stale button writes nothing (P85, P92, P93). It gives App Home the Journey's activated steps, active with their goal and reward, done with an Open button until its crate is opened, or opened, and the website questsOf: each activated step's activation time, promised reward, catalogue version, finish time and crate opening. The slice applies in a workspace only where the quests flag (a workspace flag, off by default) and xp-levels are on and unlocks applies there, on and already launched by Unlocks, which Quests never launches itself; every mutation and query reads that one predicate, and where it doesn't apply Quests records and shows nothing.

## invariants
- a Journey step's reward is recorded once: A Journey step's reward record is written once per member and step, its XP counts once and its level is reached once, however often kudosGiven is delivered and whichever of progression's recordEffects and the Journey's subscriber runs first; questFinished is published once, with the reward record.
  over: a kudos that says why from a level 1 member, delivered twice to both subscribers in each order, read through the member's standing, the published levelReached and questFinished events and questsOf
  via: P8 P87: a Journey step's reward is recorded once
  because: a reward is recorded once when its step finishes (P85, P87) and XP is permanent (P5, ADR-0002); the bus schedules each kudosGiven subscriber on its own and may run one again, so a second record would pay the step twice, and two subscribers that each judged a level crossing from a stale total would announce one level twice (P6)
  refuted: recordReward no longer skipped a reward key already recorded -> both subscriber orders failed: the second delivery paid the step again (2026-10-13)
  kinds: message, state
  checklist: destination-confinement dismissed: the subscriber sends nothing outside; levelReached, xpRecorded and questFinished go only to the in-process bus
  checklist: message-authenticity dismissed: kudosGiven comes from the engine's own transaction, never from outside; the Slack event behind it is covered by signed Slack requests only
  checklist: input-validation dismissed: the subscriber's argument is checked by the kudosGiven event validator, and only the engine publishes the event
  checklist: retry-recognition dismissed: a repeated event finds the reward record keyed by member and step already stored and is skipped as done, never reported as a conflict
  checklist: duplicate-suppression declared as a Journey step's reward is recorded once
  checklist: keyed-ordering dismissed: XP is a sum, and Convex serializes the mutations that touch one member's progress, so each sees the other's total and only the one that crosses a level publishes it
  checklist: acknowledgment-barrier dismissed: nothing acknowledges kudosGiven; the reward record, the XP and the events commit in one mutation
  checklist: retry-classification dismissed: the subscriber calls no external system
  checklist: revalidated-permission dismissed: no permission is involved; the slice predicate is read in the same mutation that records
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a reward record is only inserted, never changed, by reward records are insert-only
  checklist: supersession-safety dismissed: the reward record is read and inserted in one transaction with the XP it applies, so a late or replayed delivery finds it and writes nothing
  checklist: worker-fencing dismissed: no worker owns a member's Journey; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: the events are published inside the transaction that writes the record and reach subscribers only after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- a Journey step pays what it promised: A Journey step's reward record pays exactly the reward and catalogue version stored when the step became active for the member, whatever the catalogue says when it finishes.
  over: a step activated under catalogue version 1 and finished under a retuned version 2, read through the member's standing and questsOf
  via: P86: the reward is the one promised when the step became active
  because: a reward is fixed with its catalogue version when its step becomes active, and finishing records exactly that (P86, ADR-0004); retuning the catalogue must never change what a member was promised, nor rewrite what a record pays
  refuted: finishing paid the catalogue's current reward and version instead of the activation's -> the test failed on the member's standing (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the subscriber decides from the stored activation read in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an activation is inserted once and never changed; the reward record copies it once
  checklist: supersession-safety dismissed: the activation is read and the record inserted in one transaction, so a catalogue change between them cannot reach the record
  checklist: worker-fencing dismissed: no worker owns an activation; Convex serializes mutations on one member's rows
  checklist: commit-ordered-effects dismissed: recording issues no external effect; its events reach subscribers only after the transaction commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- opening a crate grants nothing: Opening a finished quest's crate writes only one crate opening beside its reward record and publishes only questOpened: it writes no reward or effects record and changes no XP, level, skill points or coins, so what a member earned before opening is exactly what they have after; a second open writes and publishes nothing.
  over: every table of the schema, read before and after openQuestCrate opens a finished first-thanks crate, and again across a second open a week later, and every event published by the opens
  via: P92: opening a crate grants nothing
  because: a quest's reward is recorded the moment it finishes and its crate only reveals it (P85, P92, amended on #97); if opening granted anything, a click would gate earning, a member who never opened would hold less than they earned, and a replayed or stale Open could pay twice (P2, P9)
  refuted: openQuestCrate also recorded a 10 XP reward record when it opened a crate -> the test failed on its every-table assertion, rewardRecords and memberProgress differing (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: opening acts only on the clicking member's own crate, and whether it may open is the stored reward record and the slice predicate read in the same mutation; no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own crate with one action (P92)
  checklist: legal-state-succession dismissed: a crate opening is only inserted, once per member and reward key, and never changed; the reward record beside it is never touched
  checklist: supersession-safety dismissed: the crate opening is read and inserted in one transaction, so a late or replayed click finds it and writes nothing
  checklist: worker-fencing dismissed: no worker owns a member's crates; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: opening issues no external effect; questOpened goes to the in-process bus and reaches subscribers only after the transaction commits, and the App Home republish is scheduled by the click's own mutation
  checklist: resumption-coverage dismissed: no batch operation resumes
- quests are dark where the slice doesn't apply: Where the quests flag, xp-levels or unlocks is off, or unlocks hasn't launched in the workspace, Quests records no activation, reward record or questFinished, App Home shows no Journey and questsOf shows nothing; a kudos that says why there pays only its base XP.
  over: a kudos that says why and questsOf with each of quests, xp-levels and unlocks off, and with unlocks on before it launched, and the kudos and App Home at the Slack boundary with quests off
  via: the slice applies only where quests, xp-levels and unlocks all apply
  because: every new member-facing slice reaches production dark behind a flag whose safe default is off (O33), and Quests sits on XP and unlocks, so it applies only where both do (#95's plan); quests are goals, not earnings (P75), so nothing is recorded while it doesn't apply, and P91 later finishes the steps whose state is already true when it starts applying
  refuted: the slice predicate ignored the quests flag -> both quests-off cases failed: the kudos paid the step and App Home showed the Journey (2026-10-13)
  refuted: the slice predicate launched unlocks itself through unlocksLiveIn instead of reading whether Unlocks had launched -> the not-yet-launched case failed: the kudos activated and paid the step (2026-10-13)
  kinds: output, state
  checklist: destination-confinement dismissed: the predicate only withholds records and lines; where App Home goes is unchanged and covered by the adapter's own invariants
  checklist: redaction dismissed: the predicate removes the whole Journey rather than scrubbing content inside it
  checklist: commit-ordered-effects dismissed: each mutation reads the predicate before it writes or decides the view, so a withheld record is never written and a shown one goes out only after that mutation commits
  checklist: circuit-breaker-policy dismissed: the flags are read from the PostHog component's cached definitions, never by calling PostHog per read, so there is no failure history to divert on
  checklist: declared-target-coverage dismissed: the surfaces are the kudosGiven subscriber, App Home's Journey lines and questsOf, each reading the predicate itself and each covered by a case of the oracle; there is no fan-out registry
  checklist: revalidated-permission dismissed: no permission is involved; the predicate is read in each mutation that records
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: while the slice doesn't apply nothing is written, so there is no state to succeed
  checklist: supersession-safety dismissed: the flags are read in the mutation that would write, so a late delivery reads the flags of its own moment
  checklist: worker-fencing dismissed: no worker owns the slice; Convex serializes the mutations that read the flags and write
  checklist: resumption-coverage dismissed: no batch operation resumes
