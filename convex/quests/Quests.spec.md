# Quests

Quests: owns each member's quests and the Journey (P80 to P93, ADR-0004 as amended). The Journey is versioned catalogue data keyed by step ID, never by number, and holds only steps whose feature has shipped: `first-thanks`, active from the start, `first-quest` (finish a weekly quest, 20 XP), active once the member opens Quests, and `someone-new` (thank someone you haven't thanked before, 30 XP), active once the member opens the Leaderboard. Each step's activation is stored per member, once, with its time, its promised reward and the catalogue version: `first-thanks` by the first mutation that sees the member while the slice applies, the kudosGiven subscriber for the giver or App Home's publish for the viewer, and each other step by Quests' unlockOpened subscriber for its feature, at the opening's time, which then republishes App Home; an opening by Unlocks' launch activates nothing, since steps for members already playing are P91's. The Journey ships in a workspace at the first mutation that sees the slice apply there, which is after Unlocks launched: the kudosGiven, unlockOpened and questFinished subscribers, App Home's publish, the commands or the hourly sweep. That mutation stores the ship moment once, with its time, and schedules the join: a page of 100 members per mutation, so no mutation schedules more than Convex allows, each member who existed before the moment joined in a mutation of its own. The join activates, at the moment, every step whose feature the member had opened by then and finishes, with its reward as usual, each step that is already true then: `first-thanks` when one of the member's awards up to the moment carries a stored gate decision that says why, read from their effects records as giver in one index range, so an award recorded without a decision doesn't count and the member's next kudos that says why finishes it, `someone-new` when every current member besides them was thanked, and either next step with what followed the moment but was read before the join ran. An opening from before the moment that reaches the unlockOpened subscriber after it is left to the join, so its step counts from the moment too. It sends the member at most one DM, naming every step it finished with an Open button each, and republishes App Home when it finished one. The others count from the moment (P91). Turning a flag off and on again never moves the moment or runs the join again, and members who join later follow the schedule. It subscribes to kudosGiven with one subscriber, which counts the weekly quests and then follows the Journey in one mutation, and finishes `first-thanks` when the giver's award carries a stored gate decision that says why (P12), read from the event and never from the text: it has progression record the step's reward record with exactly the promised reward, and publishes questFinished, keyed by member and step, and has feedback send the member one DM naming the step and what it earned with an Open button, only when that record was new. The other steps count only what follows their activation (P90) and finish the same way: `first-quest` on a questFinished for a weekly quest finished at or after it became active, and in the kudosGiven subscriber itself when that kudos finished a weekly quest, so the questFinished that follows finds it recorded, and `someone-new` on a kudosGiven at or after it became active with an award to someone the giver had never thanked before that award, in the order awards were recorded; Activation also finishes a step with what followed the opening but was read before the activation ran: the first weekly quest finished, or the first award to someone the member had never thanked, at or after the opening. `someone-new` also finishes whenever every current member besides the member has been thanked by them, checked when it becomes active, on each memberLeft the directory publishes, for every member of the workspace whose step is unfinished, a page of 100 members per mutation, each checked in a mutation of its own, and on each memberRejoined for the member who came back, so a small or shrinking workspace never strands it. A finished step's crate waits for the member for good: the openQuestCrate command opens the clicking member's own crate, named by its quest and never by a member from the payload, and only where a reward record is stored for it; it stores one crate opening (member, reward key, time) beside the reward record, never on it, and publishes questOpened, and a second open, a replayed click or a stale button writes nothing (P85, P92, P93). Quests ships with the quests flag in Unlocks' schedule, so it becomes ready at level 2 only where the quests flag is on, and is shown only where unlocks is. The quest pool is versioned catalogue data: each quest has a stable ID, its kind (breadth, thoughtfulness or participation), its goal copy, its progress predicate (what it counts of the member's given recognitions, at most 3 in a week), its needs and its reward of 20 XP, and it holds only quests whose needs have shipped, at least 3 of which need nothing but the member and stay feasible on the last day of a week with one teammate. Quests subscribes to unlockOpened for the Quests feature and draws the member's quests for the week of the opening, once per member and week: the member's week starts Monday 00:00 in their time zone, or in UTC without one, and is keyed by that Monday. The draw ranks the pool by a hash of member, week and quest and takes the first 3 that are feasible, checked against stored facts at the draw: people left to meet a goal (every current member besides the member for anyone, those the member never thanked, those not thanked in the 30 days before) days left in the week, counting the draw's day only while the member has kudos left that day, and kudos left that week, one per recognition the goal counts; the facts are read when the draw runs, which is also its time; with fewer feasible, it draws fewer, and with none, such as before any teammate is in the directory, it stores nothing, so a later draw that week can still give 3. It stores the draw with its week, its time and each slot's quest, reward, catalogue version and the facts that made it feasible, and republishes App Home. From then on, a member who opened Quests gets a new draw for each of their weeks, by the same rule but from the facts at the week's start (the whole of its first day's kudos, every day of the week, and whom the member had thanked before that instant), stored with the week's start as its time whenever it runs, and no DM: an hourly sweep pages through the members, 100 per mutation, and schedules one draw for each member who opened Quests and has none for their current week where the slice applies, plus one mutation for the next page, so no mutation schedules more than Convex allows; and a mutation that needs the current week's draw and finds none draws it first: the kudosGiven subscriber for the giver, before it counts the award, App Home's publish for the viewer, so a member who opens App Home at 00:05 on Monday sees that week's quests, and the rerollQuest command before it looks for the week to swap in. Each new draw republishes App Home. Once per member's week, the rerollQuest command swaps one unfinished quest of the clicking member's current week, named by its week and slot and never by a member, for the first quest of the same ranking that isn't in that week's draw and is feasible against the facts read at the swap, which is also its time (P81): it stores one swap per member and week, never changed and never undone, with the replaced quest and the new quest, its reward, catalogue version and the facts that made it feasible; the slot keeps its key (P87), and the new quest counts only awards made at or after the swap. A second swap that week, a swap of a finished quest, of another week or with no feasible quest left outside the draw stores no swap. The same kudosGiven subscriber counts the weekly quests: an award counts toward a slot of the giver's draw for the week of the award's day only when it was made at or after the draw's time, which for every week after the one Quests was opened in is the week's start (the week's start is the boundary, so last week's unfinished quests end with it, with no penalty and no carry-over, while a finished quest's crate stays openable after its week), and only where the slot's quest counts it, decided by the pure quest progress function from the stored gate decision read from the event (P12) and from when the giver last thanked the recipient before that award, in the order awards were recorded; each counted award is stored once per member, week, slot and award with the slot's quest and never changed, so a redelivered kudosGiven, an edit or a retry never changes progress already counted (P84). A slot's progress is what its quest counts of those awards (qualifying recognitions, one per person and day (P16), different people or different days) up to its target. When it reaches the target, the quest finishes: progression records the reward record keyed by member, week and slot with exactly the reward and catalogue version stored at the draw, or at the swap for a swapped-in quest, Quests publishes questFinished naming the week and slot, and feedback sends the member one DM naming the goal and what it earned with an Open button, only when that record was new; a finished slot counts nothing more. A draw exists only once the member opened Quests, so nothing counts or finishes before (P76). After progress that changes what App Home shows, Quests republishes it. Last, the kudosGiven subscriber has feedback release the giver's success reply held for it (P71), naming each weekly quest and then each Journey step whose reward record that mutation wrote, so a quest is named only in the reply of the kudos whose award finished it, and where the slice doesn't apply it releases the reply unchanged; a redelivered kudosGiven finds no held reply and releases nothing. It gives App Home the current week's quests once Quests is opened, each with its goal, its progress toward its target and its reward, and a Swap button while a swap is available (none stored this week and a feasible quest left outside the draw), or done with an Open button until its crate is opened, and the Journey's activated steps, active with their goal and reward, done with an Open button until its crate is opened, or opened, and the website questsOf: the current week's key, draw time, its swap with the swap's time, whether a swap is available, and each slot's quest, goal, promised reward, feasibility facts, progress, target, finish time and crate opening, and each activated step's activation time, promised reward, catalogue version, finish time and crate opening. The slice applies in a workspace only where the quests flag (a workspace flag, off by default) and xp-levels are on and unlocks applies there, on and already launched by Unlocks, which Quests never launches itself; every mutation and query reads that one predicate, and where it doesn't apply Quests records and shows nothing.

## invariants
- a Journey step's reward is recorded once: A Journey step's reward record is written once per member and step, its XP counts once and its level is reached once, however often kudosGiven is delivered and whichever of progression's recordEffects and Quests' kudosGiven subscriber runs first; questFinished is published once, with the reward record.
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
- a Journey step that opens with a feature counts only what follows it: A Journey step after the first counts only what happens at or after it became active: a kudos to someone new, or a weekly quest finished, before the member opened the step's feature never finishes it, whether its event is read then, delivered late, or followed by thanking the same person again; and one at or after the opening finishes it even when its event is read before the activation's subscriber runs.
  over: a kudos to someone new before the Leaderboard was opened and the same person thanked again after, at the Slack boundary, a kudosGiven for a kudos made before the opening delivered after it, a weekly questFinished from before first-quest became active, and a kudos to someone new and a weekly quest finished after each opening but read before its activation, read through the reward records and App Home
  via: P90: a Journey step that opens with a feature counts only what follows its activation
  because: the steps after the first count only after they become active (P90), and quests and Journey steps are goals, not earnings (P75): a member can't pursue a goal they can't see, so a step finished by what came before its feature opened would pay for a goal nobody set
  refuted: first-quest and someone-new no longer compared the event's time with the step's activation -> the late kudosGiven and the earlier weekly questFinished cases failed: each finished its step (2026-10-13)
  refuted: activation no longer finished a step with what followed the opening but was read before it -> both read-before-activation cases failed: neither step finished (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; each subscriber reads the stored activation and the slice predicate in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an activation is inserted once and never changed; what came before it writes nothing
  checklist: supersession-safety dismissed: the activation is read in the mutation that would finish the step, and the event's own time is compared with it, so a late delivery is judged by when its kudos or quest happened
  checklist: worker-fencing dismissed: no worker owns a member's Journey; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: an event that doesn't count issues nothing
  checklist: resumption-coverage dismissed: no batch operation resumes
- someone-new never strands a member: While someone-new is active, a member who has thanked every current member besides themselves finishes it: when it becomes active if that is already true, when the last member they hadn't thanked leaves the directory, however many members the workspace has, and when they come back after that member left while they were away.
  over: a member who thanked the only other member before opening the Leaderboard, a member whose one teammate not yet thanked leaves after the opening, and a member who left and came back after that teammate left, at the Slack boundary, and a leave in a workspace of 400 members who all have someone-new active, run with Convex's transaction limits, read through the reward records, the DMs and App Home
  via: P90: someone-new never strands a member
  because: a small or shrinking workspace never strands the chain (P90); with nobody left to thank for the first time, the step could never finish, and steps never expire (P88), so it would sit unfinished on the Journey for good
  refuted: someone-new counted as everyone thanked only in a workspace with no other member, ignoring who the member had thanked -> both cases failed: neither the opening nor the leave finished the step (2026-10-13)
  refuted: the directory no longer published memberRejoined when a member came back -> the return case failed: the step stayed unfinished (2026-10-14)
  refuted: a leave checked every unfinished member of the page in its own mutation instead of one mutation per member -> the 400-member case failed on Convex's read limit (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the activation, the directory and the award history are read in the mutation that finishes the step
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: finishing only inserts the step's reward record, once
  checklist: supersession-safety dismissed: the directory and the awards are read in the same transaction that records the reward, so a member who joined since is counted and one who left is not
  checklist: worker-fencing dismissed: no worker owns a member's Journey; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: the reward record, its events and the DM are written and scheduled in one transaction and reach subscribers and the adapter only after it commits
  checklist: resumption-coverage dismissed: a leave pages through the workspace's members, each page scheduling the next with its cursor and one check per unfinished member, so a failed check is retried on its own and no page is skipped
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
  checklist: declared-target-coverage dismissed: the surfaces are Quests' kudosGiven subscriber for the Journey and the weekly quests, App Home's Journey lines and questsOf, each reading the predicate itself and each covered by a case of the oracle; there is no fan-out registry
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
- a weekly quest's reward is recorded once: An award counts toward a weekly quest's slot once, however often kudosGiven is delivered and whichever of progression's recordEffects and Quests' kudosGiven subscriber runs first, and a slot's reward record is written once per member, week and slot with exactly the reward drawn for it, its XP counts once and questFinished is published once, with the record; a finished slot counts nothing more.
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
- a week swaps one unfinished quest at most: A member's week holds at most one swap, of a quest not yet finished when it was swapped, in the member's current week: a second swap that week, a swap of a finished quest or a Swap left on an earlier week's App Home stores no swap and changes no draw, counted award or reward record already stored, and the swapped slot keeps its key; in a new week the click draws only that week's due quests.
  over: a second Swap left on an earlier App Home, a Swap left on a quest that has since finished, and a Swap left on last week's App Home, each read through the stored draws, swaps, counted awards and reward records
  via: P81: a week swaps one unfinished quest at most
  because: a member swaps one unfinished quest once per week, and the swap is stored and can't be undone (P81); a second swap would let a member reroll until a quest came up easy, and swapping a finished slot would replace a quest whose reward record is already keyed by member, week and slot (P87)
  refuted: rerollQuest no longer refused a week that already held a swap -> the second-swap case failed: it stored a second swap (2026-10-13)
  kinds: state, message
  checklist: destination-confinement dismissed: the swap sends nothing outside; App Home is republished to the clicking member's own App Home by the adapter
  checklist: message-authenticity dismissed: the click arrives only through signed Slack requests, and the command acts on the clicking member, never on a member from the payload
  checklist: input-validation dismissed: the command is checked by the command registry's validator before it runs
  checklist: retry-recognition dismissed: the adapter runs each click once by its idempotency key, and a repeated click finds the week's swap already stored and writes nothing
  checklist: duplicate-suppression declared as a week swaps one unfinished quest at most
  checklist: keyed-ordering dismissed: Convex serializes the mutations that read and insert one member's swap for a week
  checklist: acknowledgment-barrier dismissed: the swap commits in the click's own mutation before the adapter answers
  checklist: retry-classification dismissed: the swap calls no external system
  checklist: revalidated-permission dismissed: no permission is involved; the slice predicate, the week, the stored swap and the slot's reward record are read in the mutation that swaps
  checklist: separation-of-duties dismissed: no approval policy applies; a member swaps their own quest with one action
  checklist: legal-state-succession dismissed: a swap is only inserted, once per member and week, and never changed; the draw is never changed
  checklist: supersession-safety dismissed: the swap and the slot's reward record are read and the swap inserted in one transaction, so a stale or replayed click finds them and writes nothing
  checklist: worker-fencing dismissed: no worker owns a member's swap; Convex serializes mutations on one member's rows
  checklist: commit-ordered-effects dismissed: the swap issues no external effect; the App Home republish is scheduled by the click's own mutation and runs after it commits
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
- a new week counts from its start: In every week after the one Quests was opened in, an award made at or after the week's start in the member's time zone counts toward that week's draw, once, whether the hourly sweep drew it before the award was counted or the kudosGiven subscriber drew it on demand, and an award made before that start counts toward the week before; in the week Quests is opened in, only awards after its draw count.
  over: a kudos that says why 30 seconds after a member's Monday 00:00 in Pacific/Auckland, delivered twice before any sweep, before a sweep at 00:10 and after it, one made 30 seconds before that boundary and delivered after the sweep, and one made in the week Quests opens before its draw, read through the counted awards and the stored draws
  via: P80 P84: a new week's quests count every award from the week's start, whenever the draw is stored
  because: a member's week starts Monday 00:00 in their time zone (P80), and a weekly draw is due from that moment whenever it's stored, so an award made after it pursues the new week's quests and never last week's, which end with no carry-over (P80); progress is recorded once per award and quest (P84), and the week Quests opens in counts only from its draw, because a quest can't be pursued before it is drawn (P84)
  refuted: a later week's draw stored the time it ran instead of the week's start -> 3 of 5 cases failed: an award just after the boundary counted nothing whether it ran before or after the sweep (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the subscriber reads the draw, the Quests opening and the slice predicate in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a draw and a counted award are only inserted, never changed
  checklist: supersession-safety dismissed: the subscriber draws, if due, and counts in one transaction, and a draw already stored by the sweep is found and kept, so the sweep and the award racing for a week store one draw and count the award once
  checklist: worker-fencing dismissed: no worker owns a draw; Convex serializes the sweep's draw and the subscriber's on one member's rows
  checklist: commit-ordered-effects dismissed: drawing and counting issue no external effect; the App Home republish is scheduled by the same mutation and runs after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes; a delayed delivery is judged by the award's own day and time
- each member's week starts at their own Monday: The hourly sweep draws a member's new week at the first run at or after Monday 00:00 in their time zone, or in UTC without one, never before it, only for a member who opened Quests, and only where the slice applies.
  over: a member in Pacific/Auckland and one without a time zone, both opened into Quests the week before, read through questsOf and the stored draws across sweeps just before and at each one's Monday 00:00, a member who never opened Quests, and the sweep with quests off
  via: P80: every Monday 00:00 in the member's time zone, the hourly sweep draws their week
  because: a member's quests are drawn on Monday 00:00 in their time zone, falling back to UTC like the allowance day (P80), only once Quests is open, because quests are goals, not earnings, and nothing is drawn where the slice doesn't apply (P75)
  refuted: the sweep judged whether a member's week was drawn by the UTC week instead of their own time zone's -> the Pacific/Auckland member got no new quests at their Monday 00:00 (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the scheduled draw reads the slice predicate and the Quests opening again in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a draw is inserted once and never changed
  checklist: supersession-safety dismissed: the scheduled draw reads the week's draw in its own transaction, so a draw stored on demand meanwhile is kept and nothing is drawn twice
  checklist: worker-fencing dismissed: one cron runs the sweep, and Convex serializes each scheduled draw with every mutation on the member's draw
  checklist: commit-ordered-effects dismissed: the draw issues no external effect; the App Home republish is scheduled by the draw's mutation and runs after it commits
  checklist: resumption-coverage dismissed: the sweep pages through every member from the first each hour, and a page that fails ends only that run; the next run finds every member still without this week's draw
- the new-week sweep stays within Convex's limits: Each mutation of the hourly sweep reads one page of 100 members and schedules at most one draw for each of them and one mutation for the next page, only for members who opened Quests and have no draw for their current week, so a second run schedules and draws nothing new.
  over: the scheduled functions and stored draws for 105 members who opened Quests and 5 who didn't, after the first sweep mutation, after the whole run and after a second run an hour later
  via: P80: the hourly sweep stays within Convex's limits and draws a week once
  because: Convex refuses a mutation that schedules more than 1000 functions, so a sweep over every member must page (#101, P78), and a draw is deterministic and stored once per member and week (P80), so a sweep that ran again would only spend work
  refuted: the sweep scheduled a draw for every member who opened Quests, even one whose week was already drawn -> the second run scheduled 105 draws again (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; each scheduled draw reads the slice predicate itself
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: the sweep writes nothing but scheduled functions; draws are declared by a week is drawn once
  checklist: supersession-safety dismissed: each scheduled draw reads the week's draw in its own transaction, so two runs scheduling one member store one draw
  checklist: worker-fencing dismissed: one cron runs the sweep, and each page schedules the next, so one run walks the members once
  checklist: commit-ordered-effects dismissed: the draws and the next page are scheduled by the sweep's mutation and run only after it commits
  checklist: resumption-coverage dismissed: the sweep pages through every member from the first each hour, and a page that fails ends only that run; the next run covers what it missed
- a new week replaces the last on App Home: App Home opened in a new week shows that week's quests, drawn by its own publish if no draw is stored yet, with none of last week's, and costs the member no XP, level or skill point; a finished quest's crate from last week still opens from its DM.
  over: App Home opened at 00:05 on Monday by a member who finished one of last week's quests and made progress on another, the member's standing before and after, and an Open click on last week's finished DM
  via: P80 P85: a new week replaces the last on App Home without a penalty, and last week's crates stay openable
  because: unfinished quests end with the week, with no penalty and no carry-over (P80), and a member who opens App Home just after Monday 00:00 must see that week's quests rather than last week's or none (#95's plan); a finished quest's crate stays openable for good, even after its week ends (P85)
  refuted: App Home's publish no longer drew the week's quests when none were stored -> App Home at 00:05 on Monday showed no quests this week (2026-10-13)
  kinds: output, state
  checklist: destination-confinement dismissed: App Home is published to the viewing member only, through the adapter's own publish
  checklist: redaction dismissed: App Home shows only the viewer's own quests
  checklist: circuit-breaker-policy dismissed: the draw calls no external system; App Home's publish is the adapter's
  checklist: declared-target-coverage dismissed: the surfaces are App Home's publish and the crate's Open, each covered by the oracle
  checklist: revalidated-permission dismissed: no permission is involved; the publish reads the slice and the Quests opening in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: the publish only inserts a due draw; reward records and crate openings are declared by their own invariants
  checklist: supersession-safety dismissed: the publish reads the week's draw in its own transaction, so a draw stored by the sweep meanwhile is kept
  checklist: worker-fencing dismissed: no worker owns a draw; Convex serializes the publish's draw with the sweep's
  checklist: commit-ordered-effects dismissed: the view is published by the adapter after the mutation that drew commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- a new week is drawn from the facts at its start: A draw for a week after the one Quests was opened in reads its facts as at the week's start, with the first day's kudos all left, and stores the week's start as its time, so the same member and week draw the same quests with the same facts whether the sweep draws it at the start or an award made later in the week draws it on demand, and an award that spends a member's last kudos never leaves their week without quests.
  over: one member's week drawn by a sweep at 00:10 on one backend and on demand by a kudos made at 00:00:30 that spent a kudos and thanked someone new on another, the same for a first thanks to each teammate made at 00:00:00 and at 00:00:30, read through the stored draws, and a member with 1 kudos a day whose week is first drawn by their only kudos on Sunday, read through the stored draw and the counted awards
  via: P80: a new week is drawn from the facts at its start, whenever the draw is stored
  because: a member's weekly draw happens on Monday 00:00 in their time zone (P80) and is deterministic per member and week (P80), so a draw stored later must be the one that moment would have made; facts read after the week's first awards would drop quests those awards already pursue, and on a late day could leave a member who opened Quests without the 3 quests P80 promises
  refuted: a later week's draw read its facts at the time it ran instead of the week's start -> both cases failed: the on-demand draw stored other facts than the sweep's, and the Sunday kudos left no quest to draw (2026-10-14)
  refuted: a later week's draw read whom the member had thanked up to and including the week's start -> the 00:00:00 case failed: the on-demand draw lost not-in-30-days to the award that triggered it (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the draw reads the facts and the slice predicate in its own mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a draw is inserted once and never changed
  checklist: supersession-safety dismissed: the facts are read and the draw inserted in one transaction, and the facts are cut at the week's start, so awards committed later can't change them
  checklist: worker-fencing dismissed: no worker owns a draw; Convex serializes the mutations that touch one member's draw
  checklist: commit-ordered-effects dismissed: the draw issues no external effect; the App Home republish is scheduled by the same mutation and runs after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- the success reply names the quests its kudos finished: While the slice applies, the giver's success reply names, in its extras line, each weekly quest and Journey step whose reward record was written by Quests' kudosGiven subscriber for that kudos, as `Quest done: {goal}` joined with ` · `, and no other: a kudos that finishes nothing names none, and of two quick kudos that together finish one quest only the one whose award finished it names it.
  over: a member who opened Quests giving a kudos that finishes first-thanks, one that doesn't say why, one that counts toward a quest, one that finishes it and with it first-quest, and one after, and two kudos sent before either is counted that together finish a quest, at the Slack boundary, read through the ephemerals sent to the giver and the counted awards
  via: P71: the success reply names the quests its kudos finished
  because: the success extras name a quest finished (P71), and the line must be true by construction: the engine renders the reply before any subscriber runs, so a line predicted there could name a quest another kudos ends up finishing (#127); naming only what the subscriber's own mutation recorded ties the line to the award that finished the quest
  refuted: the line named every weekly quest a kudos counted toward, not only the ones its mutation finished -> both cases failed: replies that only counted toward a quest named it (2026-10-14)
  refuted: first-quest finished by a kudos's weekly quest was left to the questFinished subscriber, so the reply never named it -> both cases failed: the finishing reply lacked Finish a weekly quest (2026-10-14)
  kinds: output, message
  checklist: destination-confinement dismissed: the line joins the giver's own private reply, which goes only where private replies reach only the giver says
  checklist: redaction dismissed: the line names only the giver's own goals, never a person
  checklist: circuit-breaker-policy dismissed: releasing calls no external system; the adapter delivers the reply with its own retries
  checklist: declared-target-coverage dismissed: the one surface is the given private reply, released by Quests' kudosGiven subscriber or by its bound
  checklist: message-authenticity dismissed: kudosGiven comes from the engine's own transaction, never from outside
  checklist: input-validation dismissed: the subscriber's argument is checked by the kudosGiven event validator
  checklist: retry-recognition dismissed: a redelivered kudosGiven finds the reply already released and the quests already recorded, so it releases and names nothing
  checklist: duplicate-suppression dismissed: a reply is released once, from held to sent, and each quest's reward record is written once by its own invariants
  checklist: keyed-ordering dismissed: Convex serializes the subscribers that count one member's awards, so the one that reaches a quest's target is the one that records it and names it
  checklist: acknowledgment-barrier dismissed: the counted awards, the reward records and the released reply commit in one mutation
  checklist: retry-classification dismissed: the subscriber calls no external system
  checklist: revalidated-permission dismissed: no permission is involved; the slice predicate is read in the mutation that names the quests
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a reply goes only from held to released, never back
  checklist: supersession-safety dismissed: the line is read from the reward records the same mutation wrote, so a quest another kudos finished meanwhile is never named here
  checklist: worker-fencing dismissed: no worker owns a reply; Convex serializes the release and the bound on its row
  checklist: commit-ordered-effects dismissed: the reply's delivery is scheduled by the mutation that releases it and runs only after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- members already playing join the Journey once: When the Journey ships in a workspace, each member who existed before its ship moment gets every step whose feature they had opened active from that moment, `first-thanks` finished and paid once if they had given a kudos that says why, `someone-new` finished at once if they had thanked everyone, and at most one DM naming the steps the join finished; the moment waits until Unlocks has launched, and turning quests off and on again, a second sweep or a replayed unlockOpened writes and sends nothing more, while a member who joined after the moment follows the schedule; an award recorded without a gate decision doesn't finish first-thanks, and a Leaderboard opening from before the moment delivered after it activates someone-new from the moment and counts no kudos before it.
  over: a member with an earlier kudos that says why and the Leaderboard opened by Unlocks' launch, one who had thanked everyone, quests turned on before Unlocks launched, a second sweep, quests turned off and on, a replayed unlockOpened, a member who joins before the join runs, an award recorded without a decision followed by a kudos that says why delivered twice, and a Leaderboard opening from before the moment delivered after it, at the Slack boundary and the hourly sweep, read through questsOf, the reward records, the stored Journey and the DMs
  via: P91: members already playing join the Journey once, when it ships
  because: when the Journey ships, members already playing join it where they are (P91): a step whose feature they opened is active, and a step whose state is already true is finished at once (P90), so a member who already said why isn't asked to again; the moment is stored once and the join keyed by it, because a second join would pay a step twice or move when the others count from (P87), and the slice applies only once Unlocks launched, so the Leaderboard P77 keeps open for existing members activates someone-new
  refuted: the join no longer finished first-thanks from the member's stored gate decisions -> 4 of 5 cases failed: no member who had said why got first-thanks finished or a DM (2026-10-14)
  refuted: the unlockOpened subscriber no longer left openings from before the ship moment to the join -> the delayed-opening case failed: someone-new became active at the opening and counted a kudos from before the moment (2026-10-14)
  kinds: message, state
  checklist: destination-confinement dismissed: the join sends nothing outside but each member's own DM through the adapter; questFinished, xpRecorded and levelReached go only to the in-process bus
  checklist: message-authenticity dismissed: the join is scheduled only by the mutation that stores the ship moment, never from outside
  checklist: input-validation dismissed: the join's arguments are checked by its validators, and only Quests schedules it
  checklist: retry-recognition dismissed: a rerun finds each activation and reward record already stored and is skipped as done
  checklist: duplicate-suppression declared as members already playing join the Journey once
  checklist: keyed-ordering dismissed: the join and the subscribers each insert an activation or reward record only when none is stored, and Convex serializes the mutations that touch one member's rows, so whichever runs first records it once
  checklist: acknowledgment-barrier dismissed: nothing acknowledges the join; the activations, reward records, XP and events commit in one mutation per member
  checklist: retry-classification dismissed: the join calls no external system; the DM is delivered by the adapter's own retries
  checklist: revalidated-permission dismissed: no permission is involved; the slice predicate is read by the mutation that stores the moment, and the join acts on that moment, so a flag flip in between loses no member's join
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: the ship moment, activations and reward records are only inserted, once each, and never changed
  checklist: supersession-safety dismissed: each member's join reads the openings, effects records and award history and inserts in one transaction, cut at the moment, so a later opening or kudos is left to its own subscriber
  checklist: worker-fencing dismissed: one stored moment schedules one join run, and Convex serializes each member's join with every mutation on their rows
  checklist: commit-ordered-effects dismissed: the events are published and the DM and App Home republish scheduled inside the member's join, so they reach subscribers and the adapter only after it commits
  checklist: resumption-coverage dismissed: the join pages through the workspace's members, each page scheduling the next with its cursor and one join per member, so a failed join is retried on its own and no page is skipped
- the Journey's join stays within Convex's limits: Each mutation of the join reads one page of 100 members and schedules at most one join for each of them and one mutation for the next page, the whole run joins every member who existed before the ship moment, and each member's join reads their history in one index range, however many kudos they gave.
  over: the scheduled joins after one join page in a workspace of 150 members, and the activations after the whole run, and the join of a member who gave 4100 kudos without a decision before one that says why, run with Convex's transaction limits
  via: P91: the Journey's join stays within Convex's limits
  because: Convex refuses a mutation that schedules more than 1000 functions and caps what one mutation reads, so a join over every member must page and join each member in a mutation of their own (#101, P78), and every member already playing must join (P91)
  refuted: a join page read 1000 members instead of 100 -> the 150-member case failed: one page scheduled 150 joins (2026-10-14)
  refuted: first-thanks history read each award's giver effects record with an index range of its own -> the 4100-kudos case failed on Convex's index range limit, leaving first-thanks unfinished (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; each join acts on the stored ship moment
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: the pages write nothing but scheduled functions; the joins are declared by members already playing join the Journey once
  checklist: supersession-safety dismissed: each member's join reads their rows in its own transaction, so a page scheduled twice joins a member once
  checklist: worker-fencing dismissed: one stored moment schedules the first page, and each page schedules the next, so one run walks the members once
  checklist: commit-ordered-effects dismissed: the joins and the next page are scheduled by the page's mutation and run only after it commits
  checklist: resumption-coverage dismissed: each page carries the cursor of the next, and a failed page is retried by Convex's scheduler before the next is scheduled
