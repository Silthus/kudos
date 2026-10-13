# Quests

Quests: owns each member's quests and the Journey (P80 to P93, ADR-0004 as amended). The Journey is versioned catalogue data keyed by step ID, never by number, and holds only steps whose feature has shipped: `first-thanks`, active from the start, `first-quest` (finish a weekly quest, 20 XP), active once the member opens Quests, and `someone-new` (thank someone you haven't thanked before, 30 XP), active once the member opens the Leaderboard. Each step's activation is stored per member, once, with its time, its promised reward and the catalogue version: `first-thanks` by the first mutation that sees the member while the slice applies, the kudosGiven subscriber for the giver or App Home's publish for the viewer, and each other step by Quests' unlockOpened subscriber for its feature, at the opening's time, which then republishes App Home; an opening by Unlocks' launch activates nothing, since steps for members already playing are P91's. It subscribes to kudosGiven and finishes `first-thanks` when the giver's award carries a stored gate decision that says why (P12), read from the event and never from the text: it has progression record the step's reward record with exactly the promised reward, and publishes questFinished, keyed by member and step, and has feedback send the member one DM naming the step and what it earned with an Open button, only when that record was new. The other steps count only what follows their activation (P90) and finish the same way: `first-quest` on a questFinished for a weekly quest finished at or after it became active, and `someone-new` on a kudosGiven at or after it became active with an award to someone the giver had never thanked before that award, in the order awards were recorded; `someone-new` also finishes whenever every current member besides the member has been thanked by them, checked when it becomes active and on each memberLeft the directory publishes, so a small or shrinking workspace never strands it. A finished step's crate waits for the member for good: the openQuestCrate command opens the clicking member's own crate, named by its quest and never by a member from the payload, and only where a reward record is stored for it; it stores one crate opening (member, reward key, time) beside the reward record, never on it, and publishes questOpened, and a second open, a replayed click or a stale button writes nothing (P85, P92, P93). Quests ships with the quests flag in Unlocks' schedule, so it becomes ready at level 2 only where the quests flag is on, and is shown only where unlocks is. The quest pool is versioned catalogue data: each quest has a stable ID, its kind (breadth, thoughtfulness or participation), its goal copy, its progress predicate (what it counts of the member's given recognitions, at most 3 in a week), its needs and its reward of 20 XP, and it holds only quests whose needs have shipped, at least 3 of which need nothing but the member and stay feasible on the last day of a week with one teammate. Quests subscribes to unlockOpened for the Quests feature and draws the member's quests for the week of the opening, once per member and week: the member's week starts Monday 00:00 in their time zone, or in UTC without one, and is keyed by that Monday. The draw ranks the pool by a hash of member, week and quest and takes the first 3 that are feasible, checked against stored facts at the draw: people left to meet a goal (every current member besides the member for anyone, those the member never thanked, those not thanked in the 30 days before) days left in the week, counting the draw's day only while the member has kudos left that day, and kudos left that week, one per recognition the goal counts; the facts are read when the draw runs, which is also its time; with fewer feasible, it draws fewer, and with none, such as before any teammate is in the directory, it stores nothing, so a later draw that week can still give 3. It stores the draw with its week, its time and each slot's quest, reward, catalogue version and the facts that made it feasible, and republishes App Home. Quests also subscribes to kudosGiven for the weekly quests: an award counts toward a slot of the giver's draw for the week of the award's day only when it was made at or after the draw, and only where the slot's quest counts it, decided by the pure quest progress function from the stored gate decision read from the event (P12) and from when the giver last thanked the recipient before that award, in the order awards were recorded; each counted award is stored once per member, week, slot and award with the slot's quest and never changed, so a redelivered kudosGiven, an edit or a retry never changes progress already counted (P84). A slot's progress is what its quest counts of those awards (qualifying recognitions, one per person and day (P16), different people or different days) up to its target. When it reaches the target, the quest finishes: progression records the reward record keyed by member, week and slot with exactly the reward and catalogue version stored at the draw, Quests publishes questFinished naming the week and slot, and feedback sends the member one DM naming the goal and what it earned with an Open button, only when that record was new; a finished slot counts nothing more. A draw exists only once the member opened Quests, so nothing counts or finishes before (P76). After progress that changes what App Home shows, Quests republishes it. It gives App Home the current week's quests once Quests is opened, each with its goal, its progress toward its target and its reward, or done with an Open button until its crate is opened, and the Journey's activated steps, active with their goal and reward, done with an Open button until its crate is opened, or opened, and the website questsOf: the current week's key, draw time and each slot's quest, goal, promised reward, feasibility facts, progress, target, finish time and crate opening, and each activated step's activation time, promised reward, catalogue version, finish time and crate opening. The slice applies in a workspace only where the quests flag (a workspace flag, off by default) and xp-levels are on and unlocks applies there, on and already launched by Unlocks, which Quests never launches itself; every mutation and query reads that one predicate, and where it doesn't apply Quests records and shows nothing.

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
- a Journey step that opens with a feature counts only what follows it: A Journey step after the first counts only what happens at or after it became active: a kudos to someone new, or a weekly quest finished, before the member opened the step's feature never finishes it, whether its event is read then, delivered late, or followed by thanking the same person again.
  over: a kudos to someone new before the Leaderboard was opened and the same person thanked again after, at the Slack boundary, a kudosGiven for a kudos made before the opening delivered after it, and a weekly questFinished from before first-quest became active, read through the reward records and App Home
  via: P90: a Journey step that opens with a feature counts only what follows its activation
  because: the steps after the first count only after they become active (P90), and quests and Journey steps are goals, not earnings (P75): a member can't pursue a goal they can't see, so a step finished by what came before its feature opened would pay for a goal nobody set
  refuted: first-quest and someone-new no longer compared the event's time with the step's activation -> the late kudosGiven and the earlier weekly questFinished cases failed: each finished its step (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; each subscriber reads the stored activation and the slice predicate in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an activation is inserted once and never changed; what came before it writes nothing
  checklist: supersession-safety dismissed: the activation is read in the mutation that would finish the step, and the event's own time is compared with it, so a late delivery is judged by when its kudos or quest happened
  checklist: worker-fencing dismissed: no worker owns a member's Journey; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: an event that doesn't count issues nothing
  checklist: resumption-coverage dismissed: no batch operation resumes
- someone-new never strands a member: While someone-new is active, a member who has thanked every current member besides themselves finishes it: when it becomes active if that is already true, and when the last member they hadn't thanked leaves the directory.
  over: a member who thanked the only other member before opening the Leaderboard, and a member whose one teammate not yet thanked leaves after the opening, at the Slack boundary, read through the reward records, the DMs and App Home
  via: P90: someone-new never strands a member
  because: a small or shrinking workspace never strands the chain (P90); with nobody left to thank for the first time, the step could never finish, and steps never expire (P88), so it would sit unfinished on the Journey for good
  refuted: someone-new counted as everyone thanked only in a workspace with no other member, ignoring who the member had thanked -> both cases failed: neither the opening nor the leave finished the step (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the activation, the directory and the award history are read in the mutation that finishes the step
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: finishing only inserts the step's reward record, once
  checklist: supersession-safety dismissed: the directory and the awards are read in the same transaction that records the reward, so a member who joined since is counted and one who left is not
  checklist: worker-fencing dismissed: no worker owns a member's Journey; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: the reward record, its events and the DM are written and scheduled in one transaction and reach subscribers and the adapter only after it commits
  checklist: resumption-coverage dismissed: memberLeft is checked in one mutation over the workspace's members; nothing resumes
- a Journey step that opens with a feature finishes once: first-quest and someone-new each get one reward record and one questFinished per member, however often unlockOpened, questFinished, kudosGiven or memberLeft is delivered, and a later weekly quest or kudos to someone new pays nothing more.
  over: the Quests opening and a weekly questFinished each delivered twice and a second weekly quest finished, and the Leaderboard opening, a kudos to someone new and a leave each delivered twice, read through the reward records, the member's standing and the published questFinished events
  via: P87 P90: a Journey step that opens with a feature finishes once
  because: a Journey step's reward record is keyed by member and step and written once (P87), and XP is permanent (P5, ADR-0002); the bus schedules each subscriber on its own and may run one again, so a second record would pay the step twice
  refuted: recordReward no longer skipped a reward key already recorded -> the first-quest case failed: the redelivered questFinished paid the step again; someone-new's own finished check still held (2026-10-13)
  kinds: message, state
  checklist: destination-confinement dismissed: the subscribers send nothing outside but the member's own DM through the adapter; questFinished, xpRecorded and levelReached go only to the in-process bus
  checklist: message-authenticity dismissed: unlockOpened, questFinished, kudosGiven and memberLeft come from this app's own transactions, never from outside
  checklist: input-validation dismissed: each subscriber's argument is checked by its event's validator, and only the app publishes them
  checklist: retry-recognition dismissed: a repeated event finds the activation or the step's reward record already stored and is skipped as done, never reported as a conflict
  checklist: duplicate-suppression declared as a Journey step that opens with a feature finishes once
  checklist: keyed-ordering dismissed: the step finishes on the first event that qualifies, whichever arrives first, and Convex serializes the mutations that touch one member's reward records
  checklist: acknowledgment-barrier dismissed: nothing acknowledges these events; the reward record, the XP and the events commit in one mutation
  checklist: retry-classification dismissed: the subscribers call no external system; the DM is delivered by the adapter's own retries
  checklist: revalidated-permission dismissed: no permission is involved; the slice predicate is read in the same mutation that records
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a reward record is only inserted, never changed, by reward records are insert-only
  checklist: supersession-safety dismissed: the reward record is read and inserted in one transaction with the XP it applies, so a late or replayed delivery finds it and writes nothing
  checklist: worker-fencing dismissed: no worker owns a member's Journey; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: the events are published and the DM scheduled inside the transaction that writes the record, so they reach subscribers and the adapter only after it commits
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
  checklist: declared-target-coverage dismissed: the surfaces are the kudosGiven subscribers for the Journey and the weekly quests, App Home's Journey lines and questsOf, each reading the predicate itself and each covered by a case of the oracle; there is no fan-out registry
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
- a weekly quest's reward is recorded once: An award counts toward a weekly quest's slot once, however often kudosGiven is delivered and whichever of progression's recordEffects and the weekly quests' subscriber runs first, and a slot's reward record is written once per member, week and slot with exactly the reward drawn for it, its XP counts once and questFinished is published once, with the record; a finished slot counts nothing more.
  over: a kudos that says why delivered twice to both subscribers in each order, and a second kudos after one quest finished, read through the reward records, the member's standing, the published questFinished events and questsOf
  via: P84 P87: a weekly quest's progress and finish are recorded once
  because: progress is recorded once per award and quest, and an edit or a retry never changes progress already counted (P84); a reward is recorded once when its quest finishes, keyed by member, week and slot (P85, P87), and XP is permanent (P5, ADR-0002); the bus schedules each kudosGiven subscriber on its own and may run one again, so counting an award twice would finish a quest early and a second record would pay it twice
  refuted: advanceWeeklyQuests no longer skipped an award already counted for the slot -> both subscriber orders failed: the second delivery counted the award again and finished a second quest (2026-10-13)
  kinds: message, state
  checklist: destination-confinement dismissed: the subscriber sends nothing outside; xpRecorded, levelReached and questFinished go only to the in-process bus, and the DM goes to the member's own DM through the adapter
  checklist: message-authenticity dismissed: kudosGiven comes from the engine's own transaction, never from outside; the Slack event behind it is covered by signed Slack requests only
  checklist: input-validation dismissed: the subscriber's argument is checked by the kudosGiven event validator, and only the engine publishes the event
  checklist: retry-recognition dismissed: a repeated event finds each award already counted for the slot and the slot's reward record already stored, and is skipped as done, never reported as a conflict
  checklist: duplicate-suppression declared as a weekly quest's reward is recorded once
  checklist: keyed-ordering dismissed: progress counts awards and distinct people and days, so the order two kudos are counted in doesn't change it, and Convex serializes the mutations that touch one member's progress and reward records
  checklist: acknowledgment-barrier dismissed: nothing acknowledges kudosGiven; the progress, the reward record, the XP and the events commit in one mutation
  checklist: retry-classification dismissed: the subscriber calls no external system; the DM is scheduled and delivered by the adapter's own retries
  checklist: revalidated-permission dismissed: no permission is involved; the slice predicate is read in the same mutation that records
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a counted award and a reward record are only inserted, never changed
  checklist: supersession-safety dismissed: the counted awards and the reward record are read and inserted in one transaction with the XP they apply, so a late or replayed delivery finds them and writes nothing
  checklist: worker-fencing dismissed: no worker owns a member's quests; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: the events are published and the DM and App Home republish scheduled inside the transaction that writes the record, so they reach subscribers and the adapter only after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- progress counts only awards after the draw and within its week: An award made before the week's draw, in another week, by a member with no draw for that week, or where the slice doesn't apply counts toward no quest and records no progress and no reward.
  over: a kudos that says why an hour before the draw, in the week before and in the week after, from a member with no draw, and with quests off, read through questsOf, the counted awards and the reward records
  via: P84: progress counts only awards after the draw and within its week
  because: progress counts Given awards after the quest was drawn (P84), and a week's quests are goals for that week only (P80); counting an award from before the draw or from another week would finish a quest the member never pursued, and quests are goals, not earnings, so nothing is recorded where the slice doesn't apply (P75)
  refuted: advanceWeeklyQuests no longer compared the award's time with the draw's -> the hour-before case failed: it finished a quest (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the subscriber reads the draw and the slice predicate in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an award that doesn't count writes nothing, so there is no state to succeed
  checklist: supersession-safety dismissed: the draw is read in the mutation that would count, and a draw is never changed, so a late delivery is judged against the draw of its own week
  checklist: worker-fencing dismissed: no worker owns a draw; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: an award that doesn't count issues nothing
  checklist: resumption-coverage dismissed: no batch operation resumes
