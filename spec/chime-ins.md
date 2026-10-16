# Spec: chime-ins: joining a kudos with the app's reaction

> **Accepted on [#32](https://github.com/Silthus/kudos/issues/32) (2026-10-16) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/chime-ins` and is never merged. It answers the product owner's "Start chiming, please." (2026-10-16) and rewrites progression stopping point 8 against today's product: decisions 22–27 on map #1. The build runs on the integration branch `spec/chime-ins`, which the conductor cuts from `main`.
>
> **Rule numbers.** Rules are cited as `CH1`–`CH30`. Progression rules are cited as `P46`, quiet messages rules as `QM13`, collection rules as `CL6`, activity rules as `AT14`.
>
> **Two stopping points.** 1 (CH1–CH22) is the chime-in itself: clicking the reaction gives kudos. It ships behind `chime-ins`. 2 (CH23–CH28) is the three crowd ladders and the chime-in quest. It ships under the same flag's workspace decision, once stopping point 1 is on `main`. CH29–CH30 say what this replaces.
>
> Sources: ticket #32 and its #97 amendment; map #1's decisions 12, 17, 18, 22, 24, 25, 26 and 27; the revised progression spec (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P1, P14, P16, P27, P46–P53, P58, P59, P80, P83, P84); the quiet messages spec (`docs/quiet-messages`, QM13, QM16, QM23); the collection spec (`docs/collection` at `4143cd7`); and the code on `main` at `99854ab7`: `convex/slack/` (`events.ts`, `normalize.ts`, `receipts.ts`, `delivery.ts`), `convex/engine/` (`engine.ts`, `awards.ts`, `allowance.ts`, `spotlight.ts`), `convex/feedback/` (`replies.ts`, `publicReplies.ts`, `indicator.ts`), `convex/leaderboard/` (`totals.ts`, `groupTotals.ts`), `convex/groups/attribution.ts`, `convex/progression/progression.ts`, `convex/quests/` (`pool.ts`, `quests.ts`), `convex/achievements/ladders.ts`, `convex/activity/entries.ts`, `convex/analytics/projections.ts`, `convex/messageSettings/kinds.ts` and `slack-app/manifest.ts`. A GPT-6.1 Sol read of the code (2026-10-16) found the reads that take one Slack message for one recognition (CH3).

## Problem Statement

Someone posts a kudos thanking a teammate for staying late on the release, and three others who were there too want to say the same. Today they can only write their own kudos message, so they either copy it or say nothing. The app's reaction already sits under the message, and clicking it adds a number in Slack. That click is free, and it gives the teammate nothing.

The product owner, 2026-10-16: "Start chiming, please."

## Solution

**Clicking the app's kudos reaction under someone else's kudos joins it: each of its recipients gets 1 kudos from you.**

- **The chime-in.** A member clicks the reaction the app placed on a Given kudos message, within 24 hours of it. That gives each of the message's recipients 1 kudos from the member's daily allowance, all or nothing. It is an award like any other, so the clicker earns base XP, the recipients receive kudos, and the boards, quests, ladders, activity and coins count it.
- **Words still pay.** A chime-in carries no words of the clicker's, so it is never thoughtful kudos. Saying why stays the way to earn the thoughtful bonuses.
- **Quiet.** The clicker gets one private reply where their after-kudos replies go. Nothing is posted in public: the reaction's count in Slack is the public line.
- **Ladders and a quest later (stopping point 2).** Crowd Favourite, Standing Ovation and Amplifier join the Book, and a chime-in quest joins the pool.
- **Dark first.** It ships behind the member-decision flag `chime-ins`, on in the sandbox and for the product owner's email only (decision 18). He must paste the new manifest once, because the app needs `reactions:read` and the `reaction_added` event.

## User Stories

**Chiming in**
1. As a colleague, I want to join a kudos by clicking the app's reaction under it, so that one thank-you can come from many people.
2. As a colleague, I want my chime-in to give each person the kudos thanked 1 kudos from me, so that I thank them too.
3. As a colleague, I want a chime-in to spend my daily allowance like a kudos message does, so that joining is a real thank-you, not a free click.
4. As a colleague, I want to be told plainly when I can't afford to chime in, and how many kudos it needs, so that I'm not left thinking I thanked them.
5. As a colleague, I want a short private reply when my chime-in counted, with who got kudos and what I have left today, so that I know it worked.
6. As a colleague, I want that reply to arrive where my after-kudos replies go (in the channel, as a DM, or not at all), so that my message settings hold.
7. As a colleague, I want a chime-in to earn me base XP, like any kudos I give, so that joining counts.
8. As a colleague, I want removing my reaction to change nothing, so that kudos stay given (ADR-0001).
9. As a colleague, I want each kudos message to take my chime-in once, so that a double click or a re-added reaction never spends twice.
10. As a colleague, I want chiming in on a kudos in a thread to work as it does on one in the channel.
11. As a colleague the app doesn't know yet, I want my first chime-in to count once the app has looked me up, so that being new costs me nothing.

**What doesn't count**
12. As a giver, I want my own click on my kudos to do nothing, so that I can't thank twice.
13. As a recipient, I want my click on a kudos to me to do nothing, so that nobody thanks themselves.
14. As a member, I want any other reaction to do nothing, so that ordinary emoji stay ordinary.
15. As a member, I want a click on a kudos older than a day, or on one that wasn't given, to do nothing, so that chime-ins stay about the moment.

**Recipients and the game**
16. As a recipient, I want kudos from chime-ins to count on the boards and in my totals like any kudos, so that being joined matters.
17. As a recipient, I want my activity timeline to say who chimed in and on whose kudos, so that I know where the kudos came from.
18. As a member, I want my group's board to count chime-ins, so that joining helps my group.
19. As a writer of thoughtful kudos, I want only kudos with words to earn the thoughtful bonuses and coins, so that saying why still pays.
20. As a member, I want no public post for chime-ins, so that the app stays quiet (decision 22).

**Stopping point 2**
21. As a member, I want the Book's Crowd ladders (Crowd Favourite, Standing Ovation, Amplifier), so that chime-ins count toward achievements.
22. As a member, I want a weekly quest to chime in, drawn only when I could do it alone, so that I learn the feature exists.
23. As a member, I want no quest that asks me to get chime-ins, so that nobody trades them (P83).

**Rollout**
24. As the product owner, I want chime-ins behind their own flag, on in the sandbox and for my email only, so that I try them first.
25. As the product owner, I want production unchanged while the flag is off, apart from the flag's exposure, so that shipping is dark.
26. As the product owner, I want to know whether I must paste a new manifest, so that the app gets the events it needs.

## Rules

"`chime-ins` is on for a member" means the flag answers true in their member decision. "The message" is a kudos message whose outcome is Given. "Its awards" are the awards its author's kudos gave (`via: "message"`). "The indicator" is the message's current desired indicator (R32), the kudos emoji the app reacts with for Given.

### Stopping point 1: the chime-in

#### What counts

- **CH1. A chime-in.** A chime-in is a Slack `reaction_added` by a person on the message, where:
  - the reaction's name, without a `::skin-tone-N` suffix, is the indicator's emoji (the current desired indicator, never an earlier placed reaction);
  - its event time is less than 24 hours after the message's awards;
  - the clicker is a member (R5) who is neither the message's author nor one of its recipients;
  - the clicker has no chime-in on the message yet (CH5);
  - `chime-ins` is on for the clicker (CH19).

  Every other reaction does nothing: other emoji, reactions on other messages or on a message that isn't Given, reactions after 24 hours, a reaction by a bot or by the app itself, and `reaction_removed`. "Does nothing" means no award, no reply, no Slack call and no write beyond the event's receipt and CH19's exposure.
- **CH2. It is a kudos.** A chime-in gives each of the message's recipients who is still a member 1 kudos from the clicker: one award per recipient, `via: "chime-in"`.
  - It spends from the clicker's daily allowance on the clicker's day at the reaction's event time (R12), all or nothing, as P27 does for a message. The weekly reserve hasn't shipped; when it does, a chime-in spends it as a message does.
  - The awards are permanent: removing the reaction, editing or deleting the message changes nothing (ADR-0001).
  - The eligibility checks, the allowance check and spend, the award inserts and the chime-in record are written in one mutation.
- **CH3. A recognition is a message and a giver.** Several givers' awards now share one message. Every read and every dedupe that names a recognition by its Slack message names it by the message and its giver instead. On `main` at `99854ab7` that means:
  1. the leaderboard's counted-kudos marker (one per message today), so that a chime-in isn't dropped from daily and period totals. A marker written before this change counts as the message author's;
  2. the groups attribution (one per message today) and the group totals' counted-attribution marker, so that group boards and the group quest count chime-ins;
  3. the replay page of Given messages, which today rebuilds a message from all its awards under the first row's giver and day. It rebuilds one batch per message and giver instead, each with its own day;
  4. the gains a reply shows, which today read every award on the message and take the first award's day and cutoff. They read only the awards of the recognition they reply to;
  5. the held success reply, which today releases the first held reply on the message. It releases the reply of the recognition whose quests just finished;
  6. the spotlight, which today folds every award on the message into one quotation. It reads the author's awards only, so the spotlight stays one entry per message with its author.

  Award rows record `via`; a row without it is `"message"`. The message row, its kudos text, its indicator and its annotations stay one per message: a chime-in writes no message row and no text. A read the list above misses is a defect of this rule.
- **CH4. Never thoughtful.** A chime-in carries no words of the clicker's, so its awards are never thoughtful kudos. Wherever a gate decision is read for a chime-in award, it answers not thoughtful, whatever the message's own decision says. A chime-in is therefore never a qualifying recognition. It pays no per-recognition bonus XP and no giving coins, and it never counts toward a quest or Journey step that asks to say why. Its recipient's receiving coins count it as a different giver only where the award is thoughtful, so never. Base XP counts every kudos (P1). *This amends P14 and P16's "or a chime-in" (call 4).*
- **CH5. Once per member and message.** A chime-in is recorded once: `chimeIns { workspace, conversation, message, member, at, recipients }`, unique per message and member, insert-only, written only by the engine.
  - A redelivered event (same `event_id`) stops at its receipt.
  - A reaction removed and added again, or a second skin tone, finds the record and does nothing.
  - An unaffordable chime-in (CH8) writes no record, so the same member can chime in later within the 24 hours once they have the kudos.
- **CH6. Unknown clickers.** A clicker the directory doesn't know is looked up from `users.info`, at most 3 times, as an App Home opener is today. The chime-in is then decided as at its event time. A clicker who turns out not to be a member, or whose lookup fails 3 times, does nothing.

#### Telling the clicker

- **CH7. The reply.** A chime-in that counted gets one private reply to the clicker. It goes where their `kudos-reply` setting puts it (QM23): an ephemeral beside the message (in its thread when it has one), a DM, or none.
  - It starts with the gains line a Given reply starts with while it shows one (`+N XP` and any `Quest done:` parts, decision 17), computed from the chime-in's own awards (CH3.4). Then: `You chimed in: {recipients} got 1 kudos from you. You have {left} left today.`
  - `{recipients}` mentions each recipient as a Given reply does. `{left}` is the daily allowance left after the spend.
- **CH8. Can't afford it.** When the clicker's allowance can't pay every recipient: `You need {cost} kudos to chime in ({people}), but you have {left} left today.` `{cost}` is the recipients count and `{people}` is `1 person` or `{n} people`.
  - This reply reaches the clicker whatever their message settings say, like Over allowance (QM13): beside the message when their `kudos-reply` place is none.
  - Nothing else changes: no award, no spend, no record, no event.
- **CH9. Nothing else in Slack.** A chime-in changes no reaction: the clicker's own reaction is its mark. It posts nothing in public, sends no DM beyond CH7's place, and adds no reply to the author's. Level-ups, tier notices, welcome messages and App Home republishes that the awards cause follow from `kudosGiven`, exactly as they do for a message.

#### Published

- **CH10. The event.** A chime-in publishes `kudosGiven`:
  - `via: "chime-in"`, `giver` the clicker, `message` the message's ref and `awards` the chime-in's awards;
  - `kudosEmoji` the indicator's emoji, with no `loadoutEmoji`;
  - `annotations` the message's stored annotations with the gate decision set to not thoughtful (CH4);
  - `allowance` the clicker's, `skippedMentions: 0`, `retry: false`, `inThread` the message's, and `day` and `at` the clicker's;
  - and, additively, `chimeIns`: the message's chime-in count with this one.

  Every subscriber takes it as an award from the clicker (CH3): XP, effects records, quests progress, achievements counts, groups attribution, leaderboard and group totals, the welcome, analytics.
- **CH11. Analytics.** `kudos given` and `kudos received` gain the property `via: "chime-in"` on a chime-in only. Events from messages carry no `via`, so they stay equal to `main`'s.
- **CH12. Counts follow.** Kudos totals, week and period totals, the leaderboard window, the Monday post, the Connections ladder, the ladder for thanking someone again after 30 days, the "someone new" and 30-day facts all count a chime-in's awards as kudos from the clicker. That is the rule, not a side effect.

#### Thresholds, the public line and drops

- **CH13. No thresholds, no public line.** A chime-in count reaching 3, 5, 10, 20, 50 or 100 does nothing. P51 and P52's `🔥 {count} people chimed in.` is cut. Since quiet messages (decision 22, QM ships 1–4), public lines are posted only at the announcement channel's top level and never in a thread. There, a line can't say which kudos it means without showing the thank-you and the giver, which public notices never show (progression user story 31). Slack's own count on the reaction already shows the crowd where the kudos is. *This replaces P51 and P52 (call 2).*
- **CH14. No XP, no booster.** A chime-in count gives nobody XP or a booster (P53 cut on #97, boosters cut by decision 12).
- **CH15. No drops.** A chime-in and a chime-in count drop no hoggie, crest or crate. Hoggies drop only from crates a member opens (CL6, decision 25), and paying for being popular was the reason P53 was cut. *(Call 3.)*

#### The website

- **CH16. Activity.** `getActivity` and `getRecentKudos` mark a chime-in's entries with `chimeIn: { giver: Person }`, the message's author:
  - a `kudosReceived` entry from a chime-in has the clicker as `giver`;
  - a `kudosGiven` entry from a chime-in is the viewer's own chime-in, with `recipients` its recipients;
  - both show the message's words, channel and permalink, since the clicker wrote none.

  The field is absent on every other entry, so an answer with no chime-in in it equals `main`'s. `earned` keeps its shape.
- **CH17. Nothing else.** The spotlight stays one entry per message with its author (CH3.6). Boards change no shape. No website command chimes in: a chime-in is the Slack reaction only.

#### Slack app

- **CH18. Manifest.** Both manifests gain the bot scope `reactions:read` and the bot event `reaction_added`. A scope change makes Slack ask for the app to be reinstalled, so **the product owner pastes each rendered manifest (sandbox and real) and reinstalls once**. Until then no reaction event arrives and nothing changes. `reaction_removed` isn't subscribed: removing a reaction changes nothing (CH2).
- **CH19. The flag.** `chime-ins`, a member decision of the clicker, `safeDefault: false`. It starts on for `environment = sandbox` and the product owner's email only, the same email condition as `activity` (decision 18).
  - It is read with exposure only for a reaction that passes every other part of CH1, so its exposure is sent only where it decides something.
  - With it off, unset or the flags key missing, the reaction does nothing (CH1). Every Slack call, website read and table write then equals `main`'s, apart from the receipt of the event, CH6's lookup of an unknown person (as an App Home opening does), the flag's exposure row and its `$feature_flag_called` event.
  - The recipients' flags decide nothing: a previewer's chime-in gives kudos to anyone.
- **CH20. Widening.** After the product owner has tried it, the conductor asks him before turning `chime-ins` on in production.
- **CH21. Coherence.** The engine's component spec carries the invariants:
  - **a member chimes in at most once per message**: refuted by a redelivered event, a re-added reaction or a second skin tone giving twice;
  - **a recognition is a message and a giver**: refuted by a chime-in dropped from the leaderboard's or a group's totals, or rebuilt under the author by the replay page;
  - **a chime-in is never thoughtful**.

  As the gate's oracle, the Slack adapter's component spec carries **chime-ins are dark where the flag is off**.
- **CH22. Scale.** A chime-in's mutation reads the message row, its indicator, its awards (one index range) and the clicker's chime-in record. It writes at most one award per recipient, inside the same budget a kudos message to those recipients already uses.

### Stopping point 2: crowd ladders and the chime-in quest

- **CH23. Where it applies.** Stopping point 2 applies in a workspace while the `chime-ins` workspace decision is on there, so it reaches production when the product owner widens `chime-ins` (CH20). The sandbox has it at once.
- **CH24. Three ladders.** Ladder catalogue version `2` adds the P58 ladders, with the reward kinds the seven ladders carry today:

  | Ladder | Counts | Bronze | Silver | Gold | Diamond |
  |---|---|---|---|---|---|
  | `crowd-favourite` Crowd Favourite | chime-ins on kudos messages you wrote, in total | 5 Crowd Pleaser | 10 Rallying Cry | 20 Talk of the Town | 50 Living Legend |
  | `standing-ovation` Standing Ovation | most chime-ins on one kudos message you received | 3 Applauded | 10 Encore | 20 Crowd Roar | 50 Stadium Legend |
  | `amplifier` Amplifier | times you chimed in | 5 Joined In | 25 Backup Vocals | 100 Amplifier | 500 One-Person Crowd |

  - Each counts chime-ins, once per chime-in, never per award. Standing Ovation counts for the message's own recipients only, not for recipients of a chime-in.
  - The kudos given and kudos received ladders, and the others, already count a chime-in's kudos (P59, CH12).
  - The ladders are replayed over the workspace's history when they first apply (P62), with one summary per member.
- **CH25. The Book.** `getBook` and App Home's Book show the three ladders where CH23 applies, in the website's `Crowd` category. Where it doesn't apply, the Book equals `main`'s.
- **CH26. The quest.** Quest pool version `3` adds `chime-in`, "Chime in on a kudos someone else gave.":
  - kind participation, target 1 chime-in, the personal reward, `needs: ["chime-ins"]`;
  - its progress counts the member's chime-ins after the draw, one per chime-in (P84).
- **CH27. Feasible.** `chime-in` is feasible for a member (P80) only while `chime-ins` is on for them, read without exposure at the draw. It also needs at least one Given kudos message in the previous week, in the workspace, that the member neither wrote nor received. It is never drawn, offered by a swap or shown otherwise. No quest ever asks to receive a chime-in (P83).
- **CH28. Nothing else.** Stopping point 2 changes no Slack message beyond the tier notices and quest lines the existing modules send, and adds no flag.

### What this replaces

- **CH29.** CH1–CH28 replace P46–P53 and progression stopping point 8 as ticket #32's body states it. P46–P50 hold as amended here: the indicator's emoji, the 24 hours and the members-only rule are theirs. P14 and P16 lose chime-ins (CH4), and P51–P53 are cut (CH13–CH15).
- **CH30. Vocabulary.** The lexicon's **chime-in** drops "is thoughtful when the message was" and its thresholds. **Chime-in threshold** is redefined as cut, and **bonus XP** loses its chime-in threshold sentence.

## Implementation Decisions

- **Modules.**
  - The Slack adapter gains a `reaction_added` branch in the events route, a normalized reaction, and the reply placement through the existing private reply and DM paths.
  - The engine gains the chime-in entrance (CH1–CH6, CH10), beside `observe`, with the `chimeIns` table and `via` on award rows.
  - Feedback gains the two reply texts.
  - Leaderboard, groups, progression, feedback replies and the spotlight change their keys (CH3).
  - Activity gains `chimeIn`, analytics gains `via`, and the manifest gains its scope and event.
  - Stopping point 2 touches the achievements catalogue and counting, and the quests pool and feasibility.
- **The route filters cheaply.** Every reaction in every channel the app is in reaches the route. The route asks one query whether the message has a Given indicator with that emoji before it records a receipt or runs a mutation. Most reactions stop there.
- **No new public surface.** The chime-in is an internal mutation scheduled from the signed events route. The website's reads only gain a field.
- **Prefactor first.** CH3 lands before any chime-in exists and changes nothing on `main`: every message has one giver there. It is tested by publishing two `kudosGiven` events that share a ref with two givers.

## Testing Decisions

- Test from the outside in at the existing seams:
  - signed Slack events into `/slack/events`, observed as FakeSlack calls, PostHog captures and the domain reads (`homeFacts`, the boards, `getActivity`);
  - the bus's `kudosGiven` for CH3's prefactor;
  - `getBook` and the quest draw for stopping point 2.
- Prior art: `convex/slack/kudosMessages.test.ts`, `edits.test.ts` and `messagePlaces.test.ts` for events and reply places; `convex/slack/*Gate.test.ts` for the dark oracle; `convex/leaderboard/` and `convex/groups/` tests for totals; `convex/quests/draw.test.ts` and `pool.test.ts` for feasibility; `convex/achievements/replay.test.ts` for ladders.
- Fake Slack must send `reaction_added` shapes, with and without a skin-tone suffix. Ticket 2 verifies the real shape against the sandbox workspace and records it as a fixture.
- No test asserts a private function or a table layout. The "once" rules are proven by redelivered and re-added events.

## Out of Scope

- A public chime-in line anywhere, and thresholds (CH13).
- Chime-ins on the website, in DMs, or on messages that weren't Given.
- Threshold XP, boosters and drops (CH14, CH15).
- A per-message chime-in count on activity entries. It was offered to the website map, which can ask for it.
- Undoing a chime-in.

## Further Notes

**The product owner's words.**
- 2026-10-16: "Start chiming, please."
- Decision 22 (2026-10-14): "limit it to either private messages or in-app messages"; "the reach level 2 is too much. That should be in the general configured channel and not in the thread".
- Decision 25 (2026-10-15): "every chest should contain one" collectible.
- Decision 12 (2026-10-13): "things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey". The Journey was later restored.

**Calls made at their recommendation** (each recorded with `coherence decide`):
1. Chime-ins land as two stopping points under one flag. 1 is the chime-in, 2 is the ladders and the quest under `chime-ins`' workspace decision. The alternative, one ship with all three, would hold the useful part back behind catalogue and replay work.
2. No thresholds and no public line (CH13). The alternative, a line in the announcement channel's message-scoped reply, can't name the kudos without the thank-you and the giver.
3. Thresholds and chime-ins drop nothing (CH15).
4. A chime-in is never thoughtful (CH4), over P14's inheritance. The clicker wrote no words, and decision 16's meaningful thank-you is about saying why.
5. A recognition is a message and a giver (CH3), and the prefactor ships first, over a chime-in written as its own pseudo-message.
6. The unaffordable reply always reaches the clicker (CH8), as QM13 does for Over allowance.
7. `via` appears in analytics only on chime-ins (CH11), keeping message events equal to `main`'s.
8. The manifest gains `reactions:read` and `reaction_added`, and the product owner pastes it once (CH18).
9. The ticket body's "thresholds give recipients bonus XP" stays cut, as #97 amended (P53, CH14).
