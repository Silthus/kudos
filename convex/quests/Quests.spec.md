# Quests

Quests: owns each member's quests and the Journey (P80 to P93, ADR-0004 as amended). The Journey is versioned catalogue data keyed by step ID, never by number, and holds only steps whose feature has shipped: so far `first-thanks`, active from the start. Each step's activation is stored per member, once, with its time, its promised reward and the catalogue version, by the first mutation that sees the member while the slice applies: the kudosGiven subscriber for the giver, or App Home's publish for the viewer. It subscribes to kudosGiven and finishes `first-thanks` when the giver's award carries a stored gate decision that says why (P12), read from the event and never from the text: it has progression record the step's reward record with exactly the promised reward, and publishes questFinished, keyed by member and step, only when that record was new. Quests ships with the quests flag in Unlocks' schedule, so it becomes ready at level 2 only where the quests flag is on, and is shown only where unlocks is. The quest pool is versioned catalogue data: each quest has a stable ID, its kind (breadth, thoughtfulness or participation), its goal copy, its progress predicate (what it counts of the member's given recognitions, at most 3 in a week), its needs and its reward of 20 XP, and it holds only quests whose needs have shipped, at least 3 of which need nothing but the member and stay feasible on the last day of a week with one teammate. Quests subscribes to unlockOpened for the Quests feature and draws the member's quests for the week of the opening, once per member and week: the member's week starts Monday 00:00 in their time zone, or in UTC without one, and is keyed by that Monday. The draw ranks the pool by a hash of member, week and quest and takes the first 3 that are feasible, checked against stored facts at the draw: people left to meet a goal (every current member besides the member for anyone, those the member never thanked, those not thanked in the 30 days before) days left in the week, counting the draw's day only while the member has kudos left that day, and kudos left that week, one per recognition the goal counts; the facts are read when the draw runs, which is also its time; with fewer feasible, it draws fewer, and with none, such as before any teammate is in the directory, it stores nothing, so a later draw that week can still give 3. It stores the draw with its week, its time and each slot's quest, reward, catalogue version and the facts that made it feasible, and republishes App Home. It gives App Home the current week's quests once Quests is opened, with each goal and its progress, and the Journey's activated steps, active with their goal and reward or done, and the website questsOf: the current week's key, draw time and each slot's quest, goal, promised reward and feasibility facts, and each activated step's activation time, promised reward, catalogue version and finish time. The slice applies in a workspace only where the quests flag (a workspace flag, off by default) and xp-levels are on and unlocks applies there, on and already launched by Unlocks, which Quests never launches itself; every mutation and query reads that one predicate, and where it doesn't apply Quests records and shows nothing.

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
- a drawn quest is feasible: Every quest a draw stores is one the member can finish alone that week from the facts at the draw: a goal over different days has that many days left in the member's week, counting the draw's day while kudos are left that day, a goal about people has that many people left to meet it, and every goal has a kudos left this week for each recognition it counts; a member with a teammate and a day's kudos left gets 3 different quests.
  over: draws over 12 weeks opened on a Sunday, opened on a Sunday after spending 1 of 3 kudos and after spending all 3, opened late on Saturday and drawn on Sunday, and over 12 weeks for a member who has thanked everyone beside one who hasn't, each read through questsOf, with the members' draw facts
  via: P80: opening Quests draws 3 different quests the member can finish this week
  because: a quest that isn't feasible is never drawn and never shown as locked (P80, amended on #97), and a goal a member can't finish alone that week asks for something they can't do (P83); the pool's fallbacks guarantee every member who opened Quests gets 3
  refuted: the draw took the first 3 quests of the ranked pool without checking feasibility -> the Sunday and thanked-everyone cases failed: the draw held goals over 2 days and a thank someone new quest (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the draw reads the facts in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a draw is inserted once and never changed here
  checklist: supersession-safety dismissed: the facts are read and the draw inserted in one transaction, so no later fact can reach a draw already stored
  checklist: worker-fencing dismissed: no worker owns a draw; Convex serializes the mutations that touch one member's draw
  checklist: commit-ordered-effects dismissed: the draw issues no external effect; the App Home republish is scheduled by the same mutation and runs after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- a week is drawn once: A member's week is drawn at most once: a repeated or later opening in the same week keeps the first draw, its time and its quests, and the same member and week with the same facts draw the same quests.
  over: two openings in one week read through questsOf and the stored draws, and the same member and week drawn on two backends a day apart
  via: P80: the draw is deterministic per member and week, and stored once
  because: the draw is deterministic per member and week, and stored (P80); a second draw would change a member's goals mid-week and could pay a slot twice later (P87 keys a weekly reward by member, week and slot)
  refuted: drawFor no longer kept an existing draw for the week -> opening twice stored 2 draws and moved the draw time (2026-10-13)
  kinds: state, message
  checklist: destination-confinement dismissed: the draw sends nothing outside; the App Home republish goes to the member's own App Home through the adapter
  checklist: message-authenticity dismissed: unlockOpened comes from Unlocks' own transaction, never from outside
  checklist: input-validation dismissed: the subscriber's argument is checked by the unlockOpened event validator
  checklist: retry-recognition dismissed: a repeated unlockOpened finds the week's draw already stored and keeps it
  checklist: duplicate-suppression declared as a week is drawn once
  checklist: keyed-ordering dismissed: Convex serializes the mutations that read and insert one member's draw for a week
  checklist: acknowledgment-barrier dismissed: nothing acknowledges unlockOpened; the draw commits in one mutation
  checklist: retry-classification dismissed: the subscriber calls no external system
  checklist: revalidated-permission dismissed: no permission is involved; the slice predicate is read in the same mutation that draws
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a draw is inserted once and never changed here
  checklist: supersession-safety dismissed: a late opening finds the stored draw and writes nothing
  checklist: worker-fencing dismissed: no worker owns a draw; Convex serializes mutations on one member's rows
  checklist: commit-ordered-effects dismissed: the draw issues no external effect
  checklist: resumption-coverage dismissed: no batch operation resumes
- the pool keeps the guardrails: Every quest in the pool rewards breadth, thoughtfulness or participation, counts at most 3 recognitions, people or days of what the member gives in a week, names no person, depends on nothing received, asks to say why in words only as P95 allows, needs nothing unshipped, and pays 20 XP; at least 3 need nothing but the member and stay feasible on the last day of the week with one teammate.
  over: every quest of the pool, and the pool's quests feasible with 1 day left and one teammate already thanked
  via: P83: every quest in the pool keeps the guardrails
  because: P83's guardrails keep quests from counting volume, trading, naming people or asking for what a member can't do alone; P80 needs the fallbacks so every member who opened Quests gets 3, and P86 sets the reward
  refuted: say-why-three-times counted 4 recognitions -> its guardrail case failed: counts 4 of something in a week (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: the pool is catalogue data in code; nothing is permitted at runtime
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: the pool has no runtime state
  checklist: supersession-safety dismissed: a slot keeps its catalogue version, so a retuned pool reaches only later draws
  checklist: worker-fencing dismissed: no worker owns the pool
  checklist: commit-ordered-effects dismissed: the pool issues no effect
  checklist: resumption-coverage dismissed: no batch operation resumes
