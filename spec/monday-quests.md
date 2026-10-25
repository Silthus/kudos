# Spec: onboarding quests, Monday quests and the three welcomes

> **Approved by the product owner on 2026-10-25 on Silthus/personal#173**, the spec ticket of the Monday-quests map (Silthus/personal#169). Rules are cited as `MQ1`–`MQ45`. Rules of the core loop keep their numbers (`LP45`, `LP70`, `LP73`, `LP76`), and the rules here that change them say so.
>
> **Two stopping points**, one flag each. 1 (MQ1–MQ30, MQ34–MQ44) is onboarding quests, drawn quests, the three welcomes, the Monday DM, Stop, the quests on the website and their measurement, behind `monday-quest`. 2 (MQ31–MQ33, MQ45) is the one-off catch-up welcome, behind its kill switch `catch-up-welcome`. 2 builds on 1.
>
> Sources: the map's decisions (Silthus/personal#169); the architecture prototype (Silthus/personal#170, branch `prototype/monday-quests-architecture`, `docs/architecture/monday-quests.md` and ADR-0011 to ADR-0013); the Slack messages prototype (Silthus/personal#171, branch `prototype/welcome-and-monday-dms`, `website/proof/prototype-171-dms/round2.mts`); the website quests prototype (Silthus/personal#172, branch `prototype/website-quests`, `website/src/album/questsPrototype/`); the code on `main` at `97640845`. Where an input conflicts with the product owner's own call, the product owner's call wins.

## Problem Statement

Most people who use HedgeHug have hugged a message or been thanked, and have never thanked anyone in a message that says why. That thoughtful kudos is the habit the product exists for. Nothing leads them to it. A first hug answers with one ephemeral line that leaves the member asking where to send the thanks. A welcome DM goes out only after a kudos, never after a hug, and it still teaches the old loop. Most members who joined by hugging never got one at all.

Quests could lead the way, but they start only when the unlock path opens them, and that path is off. The Journey steps that teach thanking someone and saying why sit behind the same gate. So a member who wants to do more has no next step in Slack and none on the website.

And nobody can tell whether a DM helps. No event records a DM sent, a link in it pressed, or a member turning it off.

## Solution

**A member's first act is answered with one warm welcome that hands them a short onboarding journey, and from then on one quiet Monday DM shows them the week's quests, with one press to stop it.**

- **Three welcomes.** A member's first hug, first thoughtful kudos given, or a thoughtful kudos received sends one welcome DM, written for how they started. It says what just happened, says when a step is already done, shows the onboarding journey with the next quest, and pulls the member onto the website to identify the hoggie items waiting for them.
- **A catch-up welcome.** Every member who already uses HedgeHug and never got a welcome gets one once ("a hoggie was stuck in the pipe"), inside their first Monday DM.
- **Onboarding quests, then drawn quests.** Three onboarding quests (thank someone and say why, thank someone new, say why on two days), then three quests drawn each week. Each onboarding quest pays 50 XP and an unidentified Hoggie, each drawn quest 20 XP and an unidentified Hoggie. No coins, no crates, no unlocks.
- **One Monday DM.** At 9:00 on Monday in the member's time zone: last week's hugs recap when there is one, then this week's quests. A "Stop Monday quests" button turns the quests off in one press, and the reply turns them back on in one press.
- **Quests on the website.** A quests panel on the right of every album page, open on a first visit and foldable to a tab, and the same list on the member's own profile. `Getting started` becomes this one journey.
- **Measured.** `dm sent`, `dm link clicked` and `quests viewed` feed a funnel from each DM to a website visit, the first item turned and quests viewed, and an opt-out rate for the Monday DM.
- **Dark first.** Everything ships behind `monday-quest`, sandbox-only in project 662840, and widens in production one stage per Monday.

## User Stories

**Welcomes**

1. As a member who just gave my first hug, I want one DM that says what the hug did and what to do next, so that I know where to send a real thanks.
2. As a member who just gave my first thoughtful kudos, I want the welcome to say I already finished the first step, so that I feel the progress and see the next one.
3. As a member who was just thanked thoughtfully, I want the welcome to quote the thanks and ask me to pass it on, so that the good feeling turns into my own first kudos.
4. As a member, I want the welcome once, ever, whichever act comes first, so that HedgeHug never welcomes me twice.
5. As a member, I want the welcome to show my onboarding journey with what's done crossed off and the next quest pointed at, so that I always know the next step.
6. As a member, I want the welcome to say how many unidentified hoggie items wait for me and give me one button to identify them, so that I have a reason to open the website now.
7. As a member, I want a "Show me how" next to the next quest, so that I can learn it without guessing.
8. As a member who hugged before I was welcomed, I want no ephemeral first-hug reply beside the welcome, so that I get one clear message instead of two.
9. As a member who already got a welcome, I want no welcome nudge on top of it, so that HedgeHug doesn't DM me twice about the same thing.

**Catch-up welcome**

10. As a member who used HedgeHug before welcomes worked for me, I want one late welcome that owns up to being late, so that I still get the journey and my Hoggie.
11. As a member who already finished some steps, I want the late welcome to show them done, so that it doesn't ask me to do them again.
12. As the product owner, I want the catch-up to go out once, on one Monday, inside each member's Monday DM, so that nobody gets it twice or as a DM of its own.
13. As the product owner, I want to stop the catch-up at once, between any two members, without a deploy, so that a mistake reaches as few people as possible.

**Quests**

14. As a newcomer, I want all three onboarding quests open at once, so that whichever I do first counts.
15. As a member, I want each onboarding quest to pay 50 XP and each drawn quest 20 XP, both with an unidentified Hoggie, so that I reach level 3 within my first few kudos and every weekly quest stays a small, sure reward.
16. As a member, I want my first thoughtful kudos to still take me to level 2 and pay its quest on top, so that onboarding never pays me less than before.
17. As a member who finished onboarding, I want three new quests each week, so that I have a small reason to thank people every week.
18. As a member, I want every drawn quest to be one I can still finish this week, so that I'm never handed an impossible goal.
19. As a member, I want a finished quest to say so in the reply to the kudos that finished it, so that I see the reward where I earned it.
20. As a member, I want a finished quest to pay once, however often Slack resends the event, so that rewards stay fair.

**Monday DM**

21. As a member, I want one DM on Monday morning, not two, with my hugs recap and my quests together, so that HedgeHug stays quiet.
22. As a member who got no hugs last week, I want the quests alone, so that I still get my week's quests.
23. As a member who turned the hugs recap off, I want my quests anyway, so that one setting doesn't silently cost me the other.
24. As a member, I want the Monday DM to say how many hoggie items wait and give me one button to identify them, so that I come back to the website.
25. As a member, I want the Monday DM at most once, so that a retry never doubles it.
26. As a member, I want one press on "Stop Monday quests" to stop them, with no dialog, so that opting out is effortless.
27. As a member who pressed Stop, I want the DM itself to change to say it's done and offer a one-press undo, so that I know it worked and can change my mind.
28. As a member who stops Monday quests, I want my hugs recap to keep coming, so that Stop does exactly what it says.

**Website**

29. As a member, I want my quests in a panel on every album page, so that I see my next step wherever I am.
30. As a member, I want the panel open on my first visit and folded to a tab once I fold it, remembered next time, so that it helps without standing in my way.
31. As a member on a phone, I want the panel to start folded, so that it doesn't cover the page.
32. As a member, I want the same list on my own profile, with the panel stepping aside there, so that I don't see it twice.
33. As a newcomer, I want one `Getting started` journey that starts with my first hug, so that the website and Slack tell the same story.
34. As a member, I want a finished quest to link to the Hoggie it left, so that I can identify it at once.

**Measurement and rollout**

35. As the product owner, I want every delivered welcome and Monday DM recorded with its kind, so that I have the denominator for every rate.
36. As the product owner, I want each press on a DM link recorded with where it leads, so that I can see what pulls people onto the website.
37. As the product owner, I want a funnel from DM to website visit, first item turned and quests viewed, so that I can see whether the DMs work.
38. As the product owner, I want the share of Monday DM members who press Stop within the week, so that I can hold the rollout to its bar.
39. As the product owner, I want everything dark behind one flag that widens a stage at a time and goes back off without losing anything, so that the rollout is a two-way door.

## Implementation Decisions

### Vocabulary

- **MQ1 The lexicon.** The first ticket declares these terms in `lexicon.json`, before any code uses them:
  - **Monday path**: how a member's quests run while `monday-quest` is on for them: started by a welcome, not by an unlock, and paid in XP and items, never in coins or crates. Its counterpart, the **unlock path**, is today's.
  - **onboarding quest**: one of the three Journey steps a Monday-path member starts with: `first-thanks`, `someone-new` and `two-days`.
  - **drawn quest**: one of the three quests drawn from the pool for a week, once a member's onboarding quests are done.
  - **Monday DM**: the one DM a member gets on Monday at 9:00 local, built from a hugs section and a quests section.
  - **catch-up welcome**: the one-off welcome for a member who used HedgeHug before any welcome reached them.
  - **quests panel**: the panel on the right of every album page that lists the member's quests.
  - **welcome** widens: one DM per member, ever, whose **welcome path** says how the member started: `hug`, `thoughtful-given`, `thoughtful-received` or `catch-up`.

### The quests gate

- **MQ2 One gate.** Quests answers `questsFor(member)`: `monday` while `monday-quest` and `xp-levels` are on for the member, `unlocks` while today's `questsApplyTo` holds, and nothing otherwise. Monday wins when both hold, which only the sandbox can reach. It reads flags without an exposure and never throws: a failed flag read answers the flag's safe default (ADR-0011).
- **MQ3 One start.** `startQuests(member, cause)` is the only writer of a member's start, once: a second call changes nothing. `openUnlock` calls it with `unlock`. On the Monday path it is called by the welcome on a hug or a received kudos (MQ17), by Quests' own `kudosGiven` subscriber for a giver with no start whose kudos is thoughtful, before that kudos is counted, by the catch-up (MQ31), and by the weekly sweep for a member who has a `welcomes` row from before this shipped and no start yet. Each Monday-path caller reads `monday-quest` with an exposure. The weekly draw and the onboarding quests read the start instead of the `quests` feature's opening. A member who used HedgeHug but was never welcomed starts only at one of these moments, so no Monday DM reaches someone nothing has introduced it to.
- **MQ4 The unlock path keeps its meaning.** `questsApplyTo` still means the unlock path, so the coin lines, crates, swaps and group copy that read it stay dark for Monday-path members. Three readers move to `questsFor`: the `quests` message kind's applicability, the website's quests read and the finish notice (MQ12). Legacy quests, their crates, `first-quest`, `your-emoji`, swaps and group quests keep their code and stay dark.

### Onboarding quests

- **MQ5 All three at once.** On the Monday path the three onboarding quests are active together from the start, with no feature opening: `first-thanks` (thank someone and say why), `someone-new` (thank someone you haven't thanked before) and `two-days` (say why on 2 different days). `two-days` has no Book dependency on the Monday path. `someone-new` counts only kudos given after `first-thanks` finished, in a later message, because a member's first kudos is always to someone new and would otherwise finish both at once. Each counts as it does today and finishes at most once. A step a member finished on the unlock path stays finished.
- **MQ6 The next quest.** `nextOnboardingQuestOf(member)` answers the first unfinished step in that order, or nothing once all three are done. A step is finished when its `journey:<step>` reward is recorded. Every reader takes the steps from those records, and nothing passes a step as finished beside them. So the welcome after a hug or a received kudos points at `first-thanks`, and the welcome after a first thoughtful kudos given, which waits for that step's record (MQ14), points at `someone-new`.
- **MQ7 The reward.** Each onboarding quest pays 50 XP and one unidentified Hoggie (MQ10), from a new Journey catalogue version for the Monday path. A step finished on the Monday path pays that reward, whatever an activation from the unlock path once promised. A step finished before keeps its record as it is, pays nothing again and has no quest item. The first-thanks top-up (LP70) stays: it is computed from the XP the first kudos itself leaves, without any onboarding quest reward, so a newcomer's first thoughtful kudos lands them at 70 XP whichever subscriber runs first: 20 XP from the kudos and the top-up, and 50 from the quest. Level 3 (100 XP) comes with the second quest, and with a thoughtful kudos per quest and the turns of the thanks' own hoggie items, onboarding ends near 235 XP, short of level 4 (300 XP). The drawn quests then add 60 XP at most a week against a curve that needs 300 more for level 5. So kudos stay the main source of XP and quests stay a nudge.
### Drawn quests

- **MQ8 The pool.** All eight quests of today's pool stay drawable. None needs groups, the store or unlocks: say why once, twice or three times, say why on 2 or 3 days, thank someone new, thank 2 new people, thank someone not thanked in 30 days. The draw is today's: three per week, each one the member can still finish this week by today's feasibility rule, from a pool version for the Monday path. On the Monday path each pays 20 XP and one unidentified Hoggie, never coins, and there is no swap. Harder drawn quests that pay more are a follow-up (Out of Scope).
- **MQ9 When they come.** The first draw waits until the three onboarding quests are finished, which is the one test of "onboarding is done" everywhere, then happens at the next existing trigger: the hourly sweep, a kudos, or the Monday DM's start (MQ24). After that, each week's three are drawn at the week's start, Monday 0:00 in the member's zone, as today. A week's quests that aren't finished by Sunday are gone, and nothing carries over.
### Rewards through the item ledger

- **MQ10 One mutation.** On the Monday path, finishing a quest records the XP through `recordReward` with no coins, earns a face-down hoggie item through `earnItem` with key `quest:<reward key>` and reason `quest`, and publishes `questFinished`, all in one mutation. Both writes are keyed, so a replayed finish pays nothing twice (ADR-0013). The `quest` crate kind has no pack band, so the turn pays no XP and no coins. It only draws the hoggie, with the usual rarity weights and no floor.
- **MQ11 What the turn needs.** Without `collection` on, the turn draws nothing (`dropFor`), and without `hidden-items` there is no item board. So `monday-quest` is never widened past the stages of `collection` and `hidden-items` (MQ44).
- **MQ12 The finish in Slack.** On the Monday path a finished quest sends no DM of its own. The giver's after-kudos reply (LP25) gains one line: "Quest done: <goal> · +<xp> XP and an unidentified Hoggie for your collection", with the quest's own XP (50 for an onboarding quest, 20 for a drawn one), one line per quest the kudos finished. The reply's waiting count already includes the quest's item. The reply follows the `kudos-reply` kind's place as today, and while that place is `none` the finish shows only on the website and in the next Monday DM.

### Welcome

- **MQ13 One welcome, ever.** A member has at most one `welcomes` row, which now records its path (MQ1). It is inserted in the mutation that decides the welcome, before any send is scheduled, and it is the only "welcomed" check. A first hug and a thoughtful kudos in the same moment are serialized by Convex, so the second finds the row and stops. A replayed event stops the same way. A row from before this shipped (`giver` or `recipient`) counts: that member is never welcomed again.
- **MQ14 Three triggers.** Hugs' `hugGiven` gains `first`, true for a member's first hug ever. Welcome subscribes to it and acts only on `first`, for the giver of the hug: path `hug`. Welcome subscribes to `questFinished` and acts on the `first-thanks` step finishing on the Monday path: path `thoughtful-given` for that member, so the welcome reads the step's record instead of racing it. Welcome's `kudosGiven` subscriber acts, on the Monday path, only on a thoughtful kudos, for each recipient: path `thoughtful-received`. Each trigger reads `questsFor` for the member it would welcome. A member not on the Monday path keeps today's behaviour: the welcome on any kudos, and the first-hug reply.
- **MQ15 The first-hug reply goes.** On the Monday path, Hugs schedules no first-hug reply (LP73 is reversed for these members): the welcome on a first hug replaces it, and Hugs no longer calls the Slack adapter. A first hug from a member who already has a `welcomes` row sends nothing.
- **MQ16 No nudge after a welcome.** The welcome nudge (LP45) is never sent to a member who has a `welcomes` row. It still goes, as today, to a member who was hugged or thanked and has no welcome and has never signed in. A member nudged first can still be welcomed later, since the nudge is not a welcome. The nudge stays in `convex/feedback`.
- **MQ17 What a welcome does.** In the welcome's mutation: insert the row, earn the welcome item (`welcome:first`, LP44, idempotent) whether or not the member has signed in, call `startQuests`, and schedule the delivery with the path, the next onboarding quest and the steps already done. The welcome item obeys LP50's flags: where `welcome-item` or `hidden-items` is off for the member, no item is earned, and the waiting line counts what does wait.
- **MQ18 Delivery outcomes.** A welcome's delivery calls Slack through `attemptCall` and its rate-limit retries, as the recap's adapter does today, and records `dm sent` (MQ34) only on `delivered`. It retries only as today's welcome does, and an unknown answer ends `failed` without a resend. A DM to a deactivated account is `gone` and counts nowhere.
### The welcome's look

- **MQ19 One shape.** Every welcome is, in order (Silthus/personal#171, accepted):
  1. A personal note: a greeting with the member's mention, what just happened, and the waiting line.
  2. A divider.
  3. The card: "Your onboarding journey · N of 3 done", the checklist of the three onboarding quests (✅ and crossed off when done, 👉 on the next one, ⚪ otherwise, progress such as "0 of 2 days" on a quest that counts more than one), "Up next" with the next quest's how-to and a "Show me how" button, and the reward line "🎁 +50 XP and an unidentified Hoggie for your collection".
  4. The buttons: "Identify it now" (or "Identify them now" for more than one), the primary, and "See your quests".

  No header block and no App Home button.
- **MQ20 The waiting line.** It counts the member's waiting hoggie items when the DM is built, from the same bounded range the item board reads (LP8), so it needs no new index: "An unidentified Hoggie for your collection is waiting for you." for one, `Two unidentified Hoggies for your collection are waiting for you.` for two, the number spelled out to ten, then digits, and "50+" past 50. Stickers waiting are not counted, since the line names only hoggie items. With no hoggie waiting there is no line and the primary button reads "See your quests" alone.
- **MQ21 Per path.**
  - **Hug:** "Nice, that was your first hug!", then the hug line naming the hugged message's author (the directory's display name, else their real name, else "the author"; on a Given kudos message, "the people thanked") with "+1 XP", then "Want to really make someone's day? …", then the card at 0 of 3, pointing at "Thank someone and say why".
  - **Thoughtful given:** "Your first kudos just landed with <recipients>, and you said why. That's the one that counts! 🎉", then "You just completed the first step of your onboarding journey.", then the card at 1 of 3, pointing at "Thank someone you haven't thanked before".
  - **Thoughtful received:** "<giver> just thanked you with a kudos!", the quoted kudos text only when the kudos is public (as `publicQuoteOf` decides today), "Feels good, right? 🙂", the waiting line and "Your first quest is to pass it on.", then the card at 0 of 3.
  - **Catch-up:** "A hoggie was stuck in the pipe, which kept this welcome from coming out. Here it is now 😅", then "HedgeHug is how we thank each other here. …", the waiting line, and the card as the journey stands, with every step already done crossed off and counted.

  The exact words of each line are `round2.mts` on the prototype branch.
- **MQ22 Link buttons.** Every link in a welcome is a URL button whose `action_id` is `dm-link:welcome:<destination>`: `book` (the item board) and `quests` (the member's own profile, at the quests section). The URLs carry no tracking parameter. "Show me how" opens no website: it is a button with the `action_id` `dm-link:welcome:quests-how` and the next quest's step as its value, so its click still records the destination `quests-how`. Kudos answers the click with a reply in the welcome's thread: "How to <the quest's goal>", the quest's how-to again, and an example kudos that says why, `@Ana thanks for untangling the deploy, it saved my afternoon` with the workspace's kudos emoji. It shows with or without the website. A click Slack delivers twice is answered once, and a reply whose answer is unclear is not posted again (Silthus/personal#176, 2026-10-25).

### The Monday DM

- **MQ23 One row per member and Monday.** A new Monday DM module keeps one `mondayDms` row per member and Monday, unique by both, with its state (`waiting`, `scheduled`, `sent`, `skipped` or `failed`), its due time and its tries (ADR-0012). Its own hourly sweep pages through members, as the weekly quests sweep does, and ensures the coming Monday's row for each member whose quests started on the Monday path, while `isMember` and `onTheMondayPath` answer true for them, so a member `monday-quest` is off for keeps today's recap byte for byte (MQ43). On a Monday the coming Monday is that day, unless the member was welcomed that day, so a row first ensured after 9:00 goes at once and a member welcomed on a Monday gets their first Monday DM the next one. Ensuring is idempotent. It is the module's own so the Monday DM and Quests share no file beyond the reads Quests exports.
- **MQ24 When it goes.** A row is due on its Monday at 9:00 in the member's time zone, with today's recap fallback when the zone is unknown. A zone move moves the due time, as the recap's does. The row's start mutation, fenced on its tries, draws the week first when it is due and not drawn yet, so the DM never lists last week's quests, then builds both sections. When both are empty the row is `skipped` and nothing is sent.
- **MQ25 The two sections.**
  - **Hugs:** last week's hugs recap lines, as today's recap builds them, when the member had hugs that week and wants the recap (`hugs-recap` placed `dm`, as `recapWantedBy` decides today).
  - **Quests:** the remaining onboarding quests, or this week's three drawn quests, while the member is on the Monday path and the `quests` kind is not `none`. `monday-quest` is read again here, without an exposure, so a member taken out of a stage before 9:00 gets no quests section.
- **MQ26 The hand-over from today's recap.** A member's week of hugs belongs to exactly one sender, and the `hugWeeks` row holds the claim. Today's recap claims it when its start begins a try, which records the try on the row, as it does today. The Monday DM claims it at its own start by marking the row as the Monday DM's, and only while the row is waiting or scheduled with no try started. Once claimed, the row never changes hands: today's recap only sends a row still scheduled as its own, and the Monday DM leaves out the hugs of a row the recap has claimed. Today's recap also stands down, before it claims, for a member who has a Monday DM row for that Monday, in any state, so a member who joins a stage mid-week gets one DM on their first Monday, not two. A member with no Monday DM row keeps today's recap, unchanged.
- **MQ27 At most once.** The Monday DM calls Slack through `attemptCall`, as the recap's adapter does. Only a rate limit is retried, at most three tries, and an unknown answer is never resent: it ends `failed`. A start stranded past Convex's action limit is marked `failed`, not resent, since its post may have gone out before the action stopped; a first try that never started gets its first try again. The send ends in one mutation that receives `delivered`, `gone` or `failed`. On `delivered` it records `dm sent` with the sections it carried, and `hugs recap sent` as today when the hugs section went, so the recap's existing series continues.
- **MQ28 Its look** (Silthus/personal#171, accepted).
  - **Quests only:** "Happy Monday ☀️ Here are three quests for your week. Each one pays +20 XP and an unidentified Hoggie for your collection.", the waiting line (MQ20) when hoggie items wait, and the quests with their progress ("0 of 2 kudos", "0 of 2 days"). During onboarding it reads "Your onboarding journey · N of 3 done", the checklist with what's done crossed off, and "Each one pays +50 XP and an unidentified Hoggie for your collection."
  - **With hugs:** today's recap lines first, then a divider, then the quests section. The recap's teaser line and its "Hugs are a quick thanks …" line give way to the quests section's waiting line and quests, which say the same. Today's recap footer, "Change what I send you in App Home's Settings tab.", stays at the end.
  - **Buttons**, on the quests section: "Identify them on the website" (primary, only when a hoggie item waits, `dm-link:monday:book`), "See your quests" (`dm-link:monday:quests`) and "Stop Monday quests". A hugs-only Monday DM is today's recap, byte for byte.

### Stop

- **MQ29 Stop and resume.** "Stop Monday quests" runs a new command, `stopMondayQuests`, and the reply's "Turn Monday quests back on" runs `resumeMondayQuests`. They write the `quests` kind to `none` and back to `dm` through the `messageSettings` storage, and report `message setting changed` with `kind: quests`, `on` and `via: dm-button`. They are gated only by the Monday path, not by `message-settings`, and do nothing outside it. A replayed press does nothing new (Slack receipts). Stop leaves the hugs recap, the welcome, the quests themselves, their rewards and the website panel as they are: it stops the quests section of the Monday DM, and the finish lines of MQ12 keep following `kudos-reply`.
- **MQ30 The reply replaces the DM.** One press, no confirm dialog, a plain button. The DM is replaced in place: "🔕 Done, no more Monday quests from me." Inside a DM with hugs the recap stays above it, and it adds "Your hugs recap still comes on Mondays.". Then "Changed your mind? One press brings them back." and the "Turn Monday quests back on" button. Pressing it replaces the reply with the DM as it was sent. The recap footer stays where it was.

### The catch-up welcome

- **MQ31 It rides the first Monday DM.** No job runs it. The Monday DM's sweep (MQ23) also pages through members and ensures the coming Monday's row for each member `catchesUp` answers true for: opted in (has given a hug, or given or received a kudos), on the Monday path, no `welcomes` row, and `catch-up-welcome` true. A failed read answers false. The row's start mutation asks `catchesUp` again; when it answers true, that mutation writes the `welcomes` row (path `catch-up`), earns the welcome item and calls `startQuests`, as MQ17 does, and the DM's quests section is the catch-up welcome. The `welcomes` row is the once-marker (MQ13): the next Monday the member gets the regular Monday DM, and a member welcomed by any path never sees the catch-up. A retried try of that DM keeps the catch-up while `monday-quest` and `catch-up-welcome` still answer true, since the member's `welcomes` row says `catch-up` and was written around the row's Monday (from a day before it to two days after, in UTC, which no time zone or zone move reaches from another week); each try reads both flags again. A try outside that window, such as a lost start the sweep recovers days later, sends no catch-up, and the member's next Monday DM carries it. A row ensured before the member was welcomed that Monday by another path carries no quests section that day, so the welcome is their only quests DM. The welcome's own delivery is not scheduled.
- **MQ32 What it sends.** The welcome of MQ21's catch-up path, "A hoggie was stuck in the pipe …" with the journey as it stands, its card and its buttons, under the hugs recap's lines and a divider when the member had hugs (MQ28), with today's recap footer at the end. The member gets no recap of their own that Monday (MQ26). On `delivered` it records `dm sent` with `kind: monday` and `sections` that include `catch-up`. Its link buttons are the Monday DM's, `dm-link:monday:book` and `dm-link:monday:quests`, so their clicks count for the Monday DM; "Show me how" keeps `dm-link:welcome:quests-how`, which its thread reply answers.
- **MQ33 Once, on one Monday.** `catch-up-welcome` is on for the Monday it goes out, Monday 2026-10-26 at 9:00 member-local, and the cleanup after that Monday removes it (Silthus/personal#186). Turning the flag off stops the catch-up at each member's next start mutation; a member it is off for gets their Monday DM as before. With the flag off, everything is as before, byte for byte.
### Measurement

- **MQ34 Three usage facts.** Analytics gains three usage facts, recorded through the existing usage path, never reading a flag, never blocking a DM or a click when recording fails (Analytics' spec):
  - `dm sent` with `kind` (`welcome` or `monday`), `path` for a welcome, and `sections` (`hugs`, `quests`) for a Monday DM;
  - `dm link clicked` with `kind` and `destination` (`book`, `quests`, `quests-how`);
  - `quests viewed` with `surface` (`panel` or `profile`).

  Their properties go on the allowlist, and the dark-features walk reaches all three.
- **MQ35 Link clicks.** Slack sends a `block_actions` payload when a URL button is pressed, and opens the URL itself. Slack interactivity records a `dm-link:<kind>:<destination>` action as `dm link clicked` and acknowledges it, where it drops it today. Every other action is handled as before.
- **MQ36 The funnel.** No link carries a `?via=` parameter, which the website would strip anyway. The website visit, the first item turned (`item turned`) and `quests viewed` join the click by person in PostHog. The last ticket creates two insights in project 662840, on the HedgeHug adoption dashboard, for `environment = production`:
  - **Welcome funnel:** `dm sent` → `dm link clicked` → `$pageview` on the website → `item turned` → `quests viewed`, by person, within 7 days, broken down by `kind`.
  - **Monday opt-out:** of the people sent a Monday DM in a week, the share who pressed Stop (`message setting changed` with `kind = quests`, `on = false`, `via = dm-button`) within 7 days. Its bar is the map's: under 15%.

### The quests on the website

- **MQ37 The read.** On the Monday path `getQuests` answers the `Getting started` journey, this week's drawn quests (or nothing during onboarding), the next onboarding quest, the days left in the week, the member's first name, and for each finished quest its item's state, `waiting` or `turned`, or none for a step finished before its quest paid an item (MQ7), which gets no link to the board. Off the Monday path it answers as today. The website imports the answer's type from `convex/website`.
- **MQ38 The `Getting started` journey.** One journey of five steps replaces the `Getting started` strip (LP76) on the Monday path: give your first hug, thank someone and say why, identify the hoggie it left on your board, thank someone you haven't thanked before, say why on 2 different days. Each is done from one read: a hug given, the `first-thanks` reward, any item of the member's turned, the `someone-new` reward, the `two-days` reward. Only the three quests carry a reward ("+50 XP" and a mini card back), and only they decide when onboarding is done (MQ9): the hug and the turn are guidance. The eyebrow counts the five steps (`Getting started · n of 5`), and the Slack card counts the three quests (MQ19), since its checklist shows only the quests. Once the three quests are finished, the journey gives way to the drawn quests, whether or not the two guidance steps are done.
- **MQ39 The panel.** On every album page for a Monday-path member, on the right under the top bar, 21 rem wide, on the card surface:
  - an eyebrow in accent ink (`Getting started · n of 5` or "This week · n of 3"), a warm title with the first name ("Welcome in, <first name>" or "Your quests this week, <first name>") and its one-line note ("A few small ways to make someone's day. Every quest leaves an unidentified hoggie on your board.");
  - the journey as numbered rings on a line (a done step: green tick ring, goal crossed off, reward dimmed; the next step: solid accent ring, "NEXT" and its hint), or the drawn quests as checklist rows (checkbox, goal, a progress bar with "n/m", "+20 XP" and the card back; a finished row crossed off with "Identify it on your board →" while its item waits);
  - a footer: "Once these are done, three new quests arrive every Monday." or "n days left · new quests Monday at 9:00".

  A fold button ("Fold the quests away") folds it into a tab on the right edge: a ring with n/m and a vertical "QUESTS", which unfolds it. `Escape` folds it. It opens on a first visit, and the fold is remembered per browser. At 90 rem and wider the open panel pushes the page over as a right-hand rail; below that it floats over the page. Below 64 rem, where the sidebar becomes a drawer, it starts folded whatever was remembered, and opens over the page. On the member's own page D it shows as its tab, because the list is in the page (MQ40), and opening it there doesn't change the remembered fold. Light and dark come from the album's tokens.
- **MQ40 The profile.** On the member's own page D, while `person-page-d` is on for them, a quests section between the card row and This week, with the same greeting, journey or rows and footer as the panel. Not on a teammate's page. While `person-page-d` is off, the old profile gets no section, and the panel there behaves as on any other page.
- **MQ41 Viewed.** `viewQuests({ surface })`, a member mutation, records `quests viewed` when the panel opens, the first-visit open included, and when the profile section shows. Each open or page view records once.
- **MQ42 Empty and failing reads.** Off the Monday path there is no panel and no profile section. While the read is loading, nothing shows. When it fails, the panel and the section are left out, and the rest of the page works.

### Flags and rollout

- **MQ43 `monday-quest`.** A new flag in project 662840, created sandbox-only: one condition, `environment = sandbox`, at 100%. It needs `xp-levels`. It is read with an exposure where a member's start is written (MQ3) and without one everywhere else. Everything in MQ2–MQ30 and MQ34–MQ42 is behind it. While it is off for a member, everything is as before, byte for byte: today's welcome on any kudos, the first-hug reply, `Getting started`, the recap, no quests. Turning it off loses nothing: rewards, items and `welcomes` rows stay, a started member's quests wait, and the next Monday's row is skipped for want of a quests section unless it carries hugs.
- **MQ44 Its stages.** The conductor widens it, with an annotation each time, one stage per Monday while the opt-out bar holds (MQ36), the first send being Monday 2026-11-02:
  1. Production: the product owner and the people who reacted to the launch announcement, by email.
  2. Production: everyone at 100%. Members enter the Monday path only by a first act or the catch-up, so this is also "on by default for new members", and no third stage is needed.

  Every stage stays inside the stages of `collection`, `hidden-items` and `welcome-item`, so every quest hoggie and welcome item can be turned, and of `person-page-d`, so the profile carries its quests section. A member the catch-up has not reached by then is reached by the next Monday DM while `catch-up-welcome` is on (MQ31).
- **MQ45 `catch-up-welcome`.** A new flag in project 662840, created sandbox-only like `monday-quest`, then turned on at 100% in production for Monday 2026-10-26 (MQ33). It is read for each member by the Monday DM's sweep and again by the row's start mutation, and only there. It is the kill switch: turning it off stops the catch-up at each member's next start.

## Testing Decisions

- **A good test** drives the product from the outside: a signed Slack event, a press on a button, a cron tick on a fake clock or a website session's call goes in, and what the member sees comes out (the Slack message sent or updated, the website's answer, the PostHog event captured). It never reads a table to prove what a member could observe.
- **Seam 1: the backend from Slack to the website.** One convex-test backend per test, with the signed Slack boundary, the fake Slack and the fake PostHog from `testing/`, flags from the fake PostHog, the clock faked to cross Monday 9:00 local, and a signed-in website session calling `getQuests` and `viewQuests`. A first hug in Slack then the welcome DM and no ephemeral; a first thoughtful kudos then the welcome at 1 of 3, the reply's finish line, 70 XP and the item waiting; Monday 9:00 then one DM with both sections; a press on Stop then the DM updated in place and the next Monday's DM without quests. Prior art: `convex/slack/welcome.test.ts`, `convex/slack/firstHugReply.test.ts`, `convex/slack/hugsRecap.test.ts`, `convex/feedback/welcomeNudge.test.ts`, `convex/quests/journey.test.ts`, `convex/quests/weekly.test.ts`, `convex/website/album.test.ts`.
- **Seam 2: the website shell with fixture reads.** The album shell rendered with fixture reads under `@testing-library/react` and jsdom, asserting the panel, its fold and its memory, the tab on the own profile, the profile section and the `viewQuests` calls. Prior art: `website/src/album/home.test.tsx`, `website/src/album/hoggies.test.tsx`.
- **No new seam.** Both seams exist. A ticket that cannot test through them names why in its pull request.
- **Once-only facts.** The welcome's first-act race (a hug and a thoughtful kudos in one moment), a replayed `hugGiven` and `kudosGiven`, the catch-up's rerun, a replayed finish, and the recap hand-over in both orders and with delivery paused between a start and its end, run through Seam 1. A first thoughtful kudos ends at 1 of 3 and 70 XP whichever subscriber runs first.
- **The flags' two directions.** A test with `monday-quest` off shows today's welcome, first-hug reply, recap and `Getting started` unchanged. A test with `catch-up-welcome` off or undefined shows the Monday DM and the recap as before, and a test that turns it off after the rows are ensured and before 9:00 sends no catch-up.
- **Look and phones are proofs, not tests.** Each Slack message is checked in the sandbox Slack on desktop and on a phone against the element checklists of Silthus/personal#171 and Silthus/personal#172: on a phone the rich-text checklist, the "Show me how" accessory and the three-button row must read without breaking; where one breaks, the slice moves "Show me how" into the button row. The panel is checked at 1280 px, 1536 px and a phone width, light and dark.

## Out of Scope

- **The bold map** of the architecture (Quests paying only through `progression` and `items`, Unlocks as one starter among several, one Messages module, `feedback` as copy, Website reads as thin projections): a follow-up once the legacy quests are deleted.
- **Deleting the legacy quests** (crates, coins, swaps, group quests, `your-emoji`, `first-quest`) and **today's recap scheduler**: follow-ups once `monday-quest` is everyone's. No stored data is deleted.
- **Moving the welcome nudge into Welcome**, **a recorded `deliverDm` for every DM kind**, and **message kinds owning their applicability**: follow-ups with no behaviour for this feature.
- **The fold remembered across devices**: it is remembered per browser.
- **Harder drawn quests**: drawn quests with more variety that pay more XP, such as completing a team, on top of today's eight-quest pool. A follow-up the product owner asked for.
- Direct emoji unlocks from quests, group quests, coins and the store, and swaps on the Monday path.
- A send to the whole workspace beyond opted-in members.
- A quest-finished DM on the Monday path (MQ12), a confirm dialog on Stop, and any new Slack scope.
- A dashboard beyond the two insights of MQ36, and automation of the weekly widening: the conductor widens by hand.

## Further Notes

- **The product owner's answer** to the park (👤, 2026-10-25): each onboarding quest pays 50 XP so level 3 comes sooner, drawn quests keep 20 XP, and harder drawn quests that pay more are a follow-up. The other five choices below were accepted as recommended.
- **Choices this spec made** where the inputs left them open (🤖):
  - The drawn-quest pool keeps all eight quests (MQ8).
  - The welcome nudge overlap: never after a welcome, and a nudged member can still be welcomed (MQ16).
  - The recap cutover is per member, by the hand-over of MQ26, rather than a deploy-wide switch: a member with no Monday DM row keeps today's recap, so `monday-quest` off stays byte for byte.
  - The Monday DM rows are ensured by the module's own hourly sweep, and the start draws a week not yet drawn (MQ23, MQ24).
  - Quests start only at a welcome or catch-up, or for a member welcomed before this shipped (MQ3).
  - The waiting line counts what really waits (MQ20), so the welcome after a first thoughtful kudos may say three: the welcome item, the quest's hoggie and the thanks' own.
  - The welcome item is earned by every Monday-path welcome, signed in or not (MQ17).
  - A finished quest shows as one line in the after-kudos reply instead of a DM of its own (MQ12).
  - Phones start with the panel folded (MQ39); the fold is per browser.
  - The rollout's third stage is folded into the second (MQ44).
  - Each architecture follow-up is ruled out above, with its reason.
- **Complexity.** The spec pass (GPT-6.1 Sol, 2026-10-25, Anti-Overengineering) found ten gaps, now in the rules: `justFinished` raced the recorded steps and a first kudos finished two quests at once (MQ3, MQ5, MQ6, MQ14); the recap hand-over could double a DM while a send was in flight (MQ26); the website ended onboarding on five steps where Slack ended it on three (MQ9, MQ38); a stored activation from the unlock path kept its old reward, and a step finished before had no item (MQ7, MQ37); the catch-up's per-member check read cached flags and stopped at the first excluded member (MQ31, MQ33); stranded and unknown sends could resend (MQ27); `sendAtMostOnce` hides the outcome `dm sent` needs (MQ18, MQ27); the profile section needs `person-page-d` (MQ40, MQ44); the waiting count counted stickers and runs to "50+" (MQ20). For the last, the pass proposed "unidentified items" over today's count; the spec keeps the product owner's Hoggie wording and counts hoggie items from the board's own range instead.
- **The architecture capture moves into the repo.** `docs/architecture/monday-quests.md`, its diagrams and ADR-0011 to ADR-0013 come from `prototype/monday-quests-architecture` with the first ticket, amended for MQ3, MQ6, MQ14, MQ23, MQ26 and MQ27, each ADR recorded with `coherence decide`.
