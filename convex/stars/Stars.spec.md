# Stars

Stars: a light thank-you by reaction (SR1–SR10, SR15, SR20, SR21, SR24), never an award. The Slack adapter hands it a normalized reaction, the workspace, the giver and the message's author as chat user IDs, the conversation, the message's ts and the reaction's time, and nothing else of the event; giveStar decides it in the mutation that records the event's receipt: a reaction 24 hours or more after the message, or before it, does nothing; a giver or author the directory doesn't know answers unknown people for the adapter to look up, and the reaction is decided again as at its time once they are known; a giver who isn't a member does nothing; on a Given kudos message, read through the engine's exported reads (its author and the giver's own award on it, unique lookups), the star is for its recipients, and the author or a recipient starring it does nothing; on any other message it is for the author while the directory says they are a member, never the giver. A giver stars a message once, and gives at most their star budget of stars on their day (R12), 10 unless the workspace row sets starBudget, which a maintainer sets with an internal mutation; the once-check, the budget count and the insert-only star record are read and written in that one mutation, so a star past the budget writes nothing and the same member can star that message on a later day within its 24 hours. Only a reaction that passes every other check reads the giver's `stars` member decision, with exposure, and does nothing while it is off. A recorded star pays the giver 1 XP through progression's recordReward, keyed `star-given:{conversation}:{ts}`, and publishes starGiven; payStarPeople, its subscriber, then pays each of its people 1 XP keyed `star:{giver}:{conversation}:{ts}`, 100 recipients a mutation from the engine's paged read of the message's awards and continuing from its cursor, skipping a recipient who is no longer a member, and writes one row per star and person, so a rerun pays nobody twice. Reward records carry no cause, no coins and no item, at catalogue version `stars-1`; the people are paid whatever their own flag says. No message, ephemeral, DM or reaction is sent for a star, and nothing that reads awards sees one.

## invariants
- a member stars a message at most once: A giver's reactions on one message pay its author or recipients and the giver 1 XP once in all, whether the event is redelivered, the reaction is removed and added again or given again with another skin tone.
  over: a redelivered event, a removed and re-added reaction and a second skin tone on an ordinary message, and a redelivered star on a Given kudos message with two recipients
  via: SR5 SR23: a member stars a message at most once
  because: a star is a one-click thank-you worth 1 XP each way; paying it again for every redelivery, re-add or skin tone would let a member farm XP for themselves and a teammate from one message (SR5)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the star's mutation reads the giver's membership and the message's awards when it decides
  checklist: separation-of-duties dismissed: no approval policy applies to a star
  checklist: legal-state-succession declared as a member stars a message at most once
  checklist: supersession-safety dismissed: a star record is insert-only, unique per message and giver, and a later reaction finds it in its own transaction
  checklist: worker-fencing dismissed: no worker owns a star; the decision is one mutation and the people's pages are keyed per star and person
  checklist: commit-ordered-effects dismissed: a star sends nothing to Slack; its XP and starGiven commit with the record
  checklist: resumption-coverage dismissed: payStarPeople continues from the recipients' cursor, and a page rerun skips each person whose row exists and each reward whose key is recorded
- a star never passes the star budget: A giver's stars on their day never pay past their star budget, 10 unless the workspace sets another, even when two reactions arrive at once for the last star left.
  over: eleven stars on one day, the twelfth the next day, a workspace budget of 2, and two reactions at once after nine stars
  via: SR6 SR23: a star never passes the star budget
  because: the budget keeps stars light (SR6); a check and a write in separate transactions would let two reactions at once both take the tenth star
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the budget is counted in the mutation that records the star
  checklist: separation-of-duties dismissed: no approval policy applies to a star
  checklist: legal-state-succession declared as a star never passes the star budget
  checklist: supersession-safety dismissed: Convex serializes two mutations that read the same giver's stars that day, so the second sees the first's record or retries
  checklist: worker-fencing dismissed: no worker holds the budget; each reaction's mutation counts and records on its own
  checklist: commit-ordered-effects dismissed: a star past the budget writes and sends nothing; a star within it commits its record, XP and starGiven together
  checklist: resumption-coverage dismissed: no batch counts the budget; a looked-up star is decided again in one mutation as at its time
- a star is never an award: A star changes no award, board, kudos total, allowance, coin, quest, Journey step, sticker or gate decision; it writes only its own records, reward records and XP, and its flag's exposure.
  over: three stars, on a Given kudos message and on ordinary messages, by members who each gave and got kudos, with every feature on, compared table by table with the state before them
  via: SR2 SR23: a star is never an award
  because: stars sit below kudos on purpose (SR2): a star that reached awards would count on boards and kudos totals, spend or refill no allowance yet earn coins, finish quests and Journey steps, or reach the meaningful-thank-you classifier
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; a star reads awards only to find its people
  checklist: separation-of-duties dismissed: no approval policy applies to a star
  checklist: legal-state-succession declared as a star is never an award
  checklist: supersession-safety dismissed: a star writes no award-side row, so no award-side state can be displaced by it
  checklist: worker-fencing dismissed: no worker owns a star's writes
  checklist: commit-ordered-effects dismissed: starGiven reaches only payStarPeople and analytics, never a module that reads awards
  checklist: resumption-coverage dismissed: payStarPeople pays only reward records keyed per star and person, whatever page it resumes from
