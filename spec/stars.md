# Spec: stars, a light thank-you by reaction

> **Accepted on [#558](https://github.com/Silthus/kudos/issues/558) (2026-10-16) under the map's autonomous authority, every open question answered at its recommendation.** This file lives on the branch `docs/stars` and is never merged. It answers the product owner's calls on #558 (decision 29 on map #1, "Yes go") and replaces #32's reaction spec (CH1–CH30, at commit `e71985d8`), whose tickets #539–#546 are closed. The build runs on the integration branch `spec/stars`, which the conductor cuts from `main`.
>
> **Rule numbers.** Rules are cited as `SR1`–`SR40`. Progression rules are cited as `P80`, `P83`; core rules as `R5`, `R12`; analytics rules as `O10`; quiet messages rules as `QM23`; collection rules as `CL6`; store rules as `ST31`–`ST35`; #32's rules as `CH1`–`CH30`.
>
> **Three stopping points.** 1 (SR1–SR24) is the star itself: the kudos emoji as a reaction gives a little XP, shows on the timeline and is summed up in a Monday DM. It ships behind the member-decision flag `stars`. 2 (SR25–SR31) is the star boost, the Book's Crowd ladders and a quest to give stars, under the same flag. 3 (SR32–SR38) is star kinds from the collection, behind its own flag `star-kinds`. SR39–SR40 say what this replaces. Only stopping point 1 is planned into tickets now; 2 and 3 are planned once the product owner has tried 1.
>
> Sources: ticket #558 (the product owner's calls, 2026-10-16); map #1's decisions 11, 12, 18, 20, 22–29; #32's spec at `e71985d8`; and the code on `main` at `99854ab7`: `convex/slack/` (`events.ts`, `receipts.ts`, `normalize.ts`, `verifyMember.ts`, `richText.ts`, `directMessages.ts`, `customKudosEmoji` tests), `convex/engine/` (`awards.ts`, `allowance.ts`), `convex/progression/` (`progression.ts`, `rewards.ts`), `convex/activity/` (`activity.ts`, `entries.ts`), `convex/messageSettings/` (`kinds.ts`, `messageSettings.ts`), `convex/quests/` (`newWeek.ts`, `pool.ts`, `finishedBy.ts`), `convex/achievements/ladders.ts`, `convex/hoggies/catalogue.ts`, `convex/workspace/settings.ts`, `convex/bus/events.ts`, `convex/analytics/projections.ts`, `convex/crons.ts` and `slack-app/manifest.ts`.

## Problem Statement

Someone gives a great demo in a channel, or makes the whole team laugh, and people want to say so. Today the only thing that counts is a kudos message: a mention, the kudos emoji and, ideally, a few words on why. That is the right weight for a real thank-you, but most appreciation in a busy workspace is lighter. People already react to messages dozens of times a day, and none of those reactions count. HedgeHug has no low-effort entry point, so people who never write a kudos message never meet it.

The product owner, 2026-10-16: "it would be cool to widen the angle a bit: not just say thank you, but really give out stars. [...] maybe having a pure reaction could also be cool already. With the HedgeHug, for example, if I react with that, it already triggers something. Would be cool. It's like the lowest entry point that doesn't give so much XP."

## Solution

**React with the workspace's kudos emoji on a teammate's message, and they get a star: 1 XP for them and 1 XP for you.**

- **A star.** A member reacts with the kudos emoji (`:hedgehug:` in the real workspace) on someone else's message in a channel, within a day of it. On a Given kudos message, the star is for its recipients; on any other message, it is for its author. Each person it is for gets 1 XP, and the giver gets 1 XP.
- **Light, and kept that way.** Each member gives up to 10 stars a day, separately from the daily allowance. A star is not kudos: it never counts on a board, pays no coins, drops nothing and is never thoughtful kudos. Writing a kudos message stays the only way to spend the allowance, and the ladder stays star ≪ kudos message ≪ thoughtful kudos.
- **Quiet.** No Slack message is ever sent for a single star. Stars show on the website's activity timeline, and a weekly recap DM on Monday morning tells members what their stars earned and nudges toward a kudos that says why.
- **Later.** Stopping point 2 adds the silent star boost (+5, +10, +20 XP when a message reaches 5, 10, 20 stars), the Book's Crowd ladders and a quest to give stars. Stopping point 3 lets each hoggie a member finds unlock a further star emoji.
- **Dark first.** It ships behind `stars`, on in the sandbox and for the product owner's email only (decision 18). The product owner pastes both manifests once, because the app needs `reactions:read` and the `reaction_added` event.

## User Stories

**Giving stars**
1. As a member, I want my kudos emoji reaction on a teammate's message to count as a star, so that appreciating them takes one click.
2. As a member, I want a star to give the author 1 XP, so that my click means something to them.
3. As a member, I want a star to give me 1 XP too, so that giving stars is worth it.
4. As a member, I want my star on a kudos message to go to the people it thanked, so that I join the thank-you.
5. As a member, I want stars to cost nothing from my daily allowance, so that writing a kudos stays a separate, bigger thing.
6. As a member, I want 10 stars a day, so that I can appreciate many things without stars becoming worthless.
7. As a member, I want stars past my 10 to do nothing and say nothing, so that reacting never nags me.
8. As a member, I want a star in a thread to work like one in the channel.
9. As a member, I want removing my reaction to keep the XP, so that a star is never taken back (ADR-0001's spirit).
10. As a member, I want my first star to count even if the app hasn't seen me before.

**What doesn't count**
11. As a member, I want my reaction on my own message to do nothing, so that nobody stars themselves.
12. As a giver or recipient of a kudos message, I want my reaction on it to do nothing, so that I can't thank twice.
13. As a member, I want a second reaction, another skin tone or a re-added reaction on the same message to do nothing, so that one message takes one star from me.
14. As a member, I want a reaction on a message older than a day, on a bot's message or the app's to do nothing, so that stars stay about people and the moment.
15. As a member, I want any other emoji to stay an ordinary reaction.

**Seeing stars**
16. As a member, I want my activity timeline to show the stars I received, with who gave them and a link to the message.
17. As a member, I want my timeline to show the stars I gave, so that I can see my week.
18. As a member, I want stars kept off the leaderboard and my kudos totals, so that kudos keep their weight.
19. As a member, I want no channel message for a star, so that the app stays quiet (decision 22).
20. As a member, I want a weekly recap DM with the stars I gave and received and the XP they earned, so that I know they count.
21. As a member, I want the recap to show my most-starred message with a link, so that I see what people liked.
22. As a member, I want the recap to tell me a kudos that says why earns much more, so that I learn the next step.
23. As a member, I want to turn the recap off in my message settings, so that I choose what reaches me.
24. As a member who gave and received no star last week, I want no recap.

**Stopping point 2**
25. As a member whose message many people starred, I want a little extra XP at 5, 10 and 20 stars, so that a popular message pays a bit more, quietly.
26. As a member, I want Book ladders for my most-starred message, stars received and stars given, so that stars count toward achievements.
27. As a member, I want a weekly quest to give stars, so that I learn they exist, and never a quest to get them (P83).

**Stopping point 3**
28. As a member, I want each hoggie I find to unlock a matching star emoji, so that my collection does something.
29. As an admin, I want to map a workspace custom emoji to each star kind, so that the emoji members already use can count.
30. As a member, I want my profile to say what I'm known for from the star kinds I received.

**Rollout**
31. As the product owner, I want stars behind their own flag, on in the sandbox and for my email only, so that I try them first in early November.
32. As the product owner, I want production unchanged while the flag is off, apart from the flag's exposure, so that shipping is dark.
33. As the product owner, I want to be told the one manifest paste this needs, first in my list.

## Rules

"`stars` is on for a member" means the flag answers true in their member decision. "The kudos emoji" is the workspace's kudos emoji (`settingsOf(...).kudosEmoji`, `:hedgehug:` in the real workspace). "A Given kudos message" is a message with awards from its author (outcome Given). "Its people" are the people a star is for (SR3).

### Stopping point 1: stars

#### What counts

- **SR1. A star.** A star is a Slack `reaction_added` by a person on a message, where:
  - the item is a message (top level or thread reply), never a file, in a conversation that isn't a one-to-one DM. A reaction event carries only the conversation's ID, without the message events' channel type, so the rule is the ID: a `D…` ID is a DM and does nothing, and every other conversation the app is in counts, a group DM the app was added to included. No Slack call classifies it. *(Call 13.)*
  - the reaction's name, without a `::skin-tone-N` suffix, is the kudos emoji. Members' other kudos emoji, custom kudos emoji and every other emoji are ordinary reactions (stopping point 3 adds star kinds);
  - its time is within 24 hours of the message: `0 ≤ event_ts − item.ts < 24 h`, both Slack timestamps;
  - the giver is a member (R5);
  - it has at least one person it is for (SR3), and the giver is none of them and, on a Given kudos message, isn't its author;
  - the giver has no star on the message yet (SR5) and is within their star budget (SR6);
  - `stars` is on for the giver (SR21).

  Every other reaction does nothing: a reaction by a bot or by the app itself (its indicator included), on a bot's or the app's message, on one's own message, after 24 hours, a second star by the same member on the same message, and `reaction_removed`. "Does nothing" means no record, no XP, no event and no Slack call or write beyond those SR21 lists.
- **SR2. Not kudos.** A star is its own record, never an award. It spends no daily allowance or weekly reserve, and nothing that reads awards sees it: kudos totals, the leaderboard and group boards, the Monday post, the spotlight, quests and the Journey, achievements' kudos ladders, the sticker book, coins, drops and the gate decision (thoughtful kudos). Stars never reach the meaningful-thank-you classifier (#209, `thoughtful-ai`). *(Call 1.)*
- **SR3. Who a star is for.**
  - On a Given kudos message: its recipients, from the author's awards on the message. Whether the giver is the author or a recipient is decided in the star's mutation with bounded reads (the message's author, and the giver's own award on the message). The people themselves are resolved after the star is recorded, in pages (SR9); a recipient who is no longer a member is skipped there, and the giver is paid whatever is skipped.
  - On any other message: its author, the event's `item_user`, when the directory says they are a member. A non-Given kudos message counts as any other message.
- **SR4. Unknown people.** A giver or author the directory doesn't know is looked up from `users.info`, at most 3 times, as a signed-in person is today (`verifyMember`). The star is then decided as at its event time, with only the workspace, the two user IDs, the conversation, the message `ts` and the event time in the waiting job. A person who turns out not to be a member, or whose lookup fails 3 times, makes the star do nothing.
- **SR5. Once per member and message.** A star is recorded once: `{ workspace, conversation, message, giver, onKudos, at, day }`, unique per message and giver, insert-only, written only by the stars module.
  - A redelivered event (same `event_id`) stops at its receipt.
  - A reaction removed and added again, or a second skin tone, finds the record and does nothing.
  - A star past the budget writes no record, so the same member can star that message on a later day, within its 24 hours.
  - No message text is fetched or stored for a star (decision 20): a star on a kudos message reads that message's stored kudos text where it shows it, and a star on any other message has no words.
- **SR6. The star budget.** A member gives at most their star budget of stars on their day (R12, the giver's day at the event time): 10, unless the workspace row sets `starBudget`. There is no admin control for it yet; a maintainer sets it with an internal mutation. *(Call 3.)*
  - A star past the budget writes nothing and says nothing.
  - The receipt, the budget count, the once-check and the record are decided and written in one mutation, so two reactions at once can't both pass the tenth star.
- **SR7. Removal changes nothing.** `reaction_removed` isn't subscribed. A removed reaction, an edited or a deleted message keeps the star and its XP.

#### XP

- **SR8. 1 XP each way.** A star gives each of its people 1 XP and its giver 1 XP, as reward records through progression's reward path (`recordReward`), so levels, `levelReached`, level-up messages, the XP climb and App Home's republish follow as for any reward.
  - The reward keys are `star:{giver}:{conversation}:{ts}` for each person it is for and `star-given:{conversation}:{ts}` for the giver, so a star pays each of them once, whatever is redelivered.
  - The records carry no `cause`, so a star never looks like a quest the message finished. Their catalogue version is `stars-1`.
  - Coins 0, item none. A star pays XP to people whose `stars` flag is off: the giver's flag alone decides.
- **SR9. Paged.** The star's mutation pays the giver and publishes `starGiven`. A job keyed by the star then resolves its people 100 a mutation, as progression records effects today: for each person it writes one row per star and person (unique, so a rerun skips who is done), updates their counts (SR14) and pays their 1 XP, then continues from the last person done. No mutation reads or writes more than one page of a star's people, so a star on a kudos message with hundreds of recipients stays within Convex's limits.
- **SR10. No message for a star.** No Slack message is ever sent for a single star: no reply, no ephemeral, no DM, no reaction, no public line. A level-up the XP causes is a level-up like any other, and follows the member's message settings.

#### Seeing stars

- **SR11. Activity.** `getActivity` gains two entry kinds in the full view, while `stars` is on for the viewer:
  - `starReceived`: `{ kind, key, at, giver: Person, xp: number | null, on: string, permalink: string | null, kudos: Message | null }`, one per star a person received;
  - `starGiven`: `{ kind, key, at, people: Person[], xp: number | null, on: string, permalink: string | null, kudos: Message | null }`, one per star the member gave.

  `xp` follows the gains line's view rule (null while XP doesn't show to the viewer). `on` is an opaque key equal for every entry on the same message, so the website can fold adjacent entries on one message into one line ("Ana and 3 others starred your message"), within the loaded page. The read doesn't group: one entry per star keeps the cursor a plain position. *(Call 6.)* `kudos` is the kudos message's words when the star was on one, resolved as a kudos entry's are, and null otherwise. `permalink` is built from the workspace URL, the channel and the `ts` once the URL is known; a star on a non-kudos thread reply has no thread root, so its link opens the message without its thread.

  The website's copy (map #57, 2026-10-16): with `kudos` set, "{giver} starred the kudos you received" and "You starred {people}'s kudos"; otherwise "{giver} starred your message" and "You starred {person}'s message". It shows no channel tag: Slack's permalink enforces access.

  The backend ticket stubs the two kinds in the website so it compiles; map #57 renders them, and its rows must be live before the product owner tries stars (SR22).

  Entries order by instant like the others, star entries below kudos entries at the same instant. Each kind reads one index range per page. The filters `received` and `given` stay kudos-only, and `getRecentKudos` is unchanged: stars aren't kudos.
- **SR12. The weekly recap.** On Monday at 09:00 in the member's time zone (as the allowance reads it), a member who gave or received at least one star in the past week (Monday to Sunday, their time zone) gets one DM:

  ```
  :{kudos emoji}: Your week in stars
  You gave {given} stars (+{givenXp} XP) and got {received} (+{receivedXp} XP).
  Your most-starred message got {count} stars: <{permalink}|open it in Slack>
  Stars are a quick thanks. A kudos that names a teammate and says why earns much more XP.
  ```

  - A line with a zero count is left out (`You gave 4 stars (+4 XP).`), and so is the most-starred line when they received none or the workspace URL isn't known yet. `1 star` is singular.
  - The most-starred message is the one that got them the most stars that week (stars given in their Monday-to-Sunday week, not the message's all-time count), the one whose last star came latest on a tie.
  - The DM ends with the message settings footer every DM carries.
  - It is sent once per member and week, at most 3 tries, as a level-up DM is.
  - It goes only while `stars` is on for the member, read with exposure when the recap is due, while XP shows to them (`xp-levels`, which every notification already requires) and while their `stars-recap` place is `dm`. The footer follows `message-settings` as on every DM.
- **SR13. The recap's setting.** A new message kind, `stars-recap`, "Weekly stars recap", "What your stars gave and got last week, on Monday morning.", with places DM (the default) or none and no in-channel place (decision 24). It applies while `stars` is on for the member, so it shows in App Home's Settings and the website's settings only then. It is not one of the DM kinds the earlier notification switches set, so those switches never write it.
- **SR14. The recap reads kept counts.** The star's writes keep, per person and week (the person's own week): the stars given and received and their XP; per person, week and message, the stars it got them and when the last came, from which the week's most-starred message is kept up to date; and per message, its all-time star count (for stopping point 2). The recap reads one row per member and never collects stars. An hourly sweep reads only members with a star week not yet scheduled, and schedules each recap at its exact Monday 09:00 instant in the member's time zone, as the Monday post schedules its wall-clock time, so half-hour time zones get it on time. The sweep also recovers a recap whose job Convex stopped.

#### Published

- **SR15. The event.** A recorded star publishes `starGiven { workspace, giver, message: { workspace, conversation, message }, onKudos: boolean, at, day }` on the bus. Its subscribers are the star's people job (SR9), analytics (SR16) and nothing else: no achievements, quests, leaderboard, groups, sticker book, unlocks or hoggies subscriber hears it.
- **SR16. Analytics.** Two product events, with no Slack IDs, names or text (O10):
  - `star given` for the giver: `on_kudos` (whether the message was a Given kudos message);
  - `stars recap sent` for the member: `stars_given`, `stars_received` and `xp`.

#### Slack app

- **SR17. Manifest.** Both manifests gain the bot scope `reactions:read` and the bot event `reaction_added`. A scope change makes Slack ask for a reinstall, so **the product owner pastes each rendered manifest (sandbox and real) and reinstalls once**. That step goes first in the ship and on #194. Until then no reaction event arrives and nothing changes.
- **SR18. The route filters cheaply.** Every reaction in every channel the app is in reaches `/slack/events`. The route drops, before any receipt or mutation:
  - a reaction whose name isn't the kudos emoji (the route reads the setting once per request);
  - an item that isn't a channel message;
  - a reaction by the app's own bot user, or one without `item_user`;
  - a reaction whose `item_user` is the reacting user.

  Most reactions stop there.
- **SR19. The normalized reaction.** The Slack adapter hands the stars module `{ giver, author, conversation, message, at }` and nothing else of the event: no reaction name beyond the match, no text.

#### Flags and dark

- **SR20. The module.** A new stars module (`convex/stars/`, with its own component spec) owns the star records, the budget, the per-message and per-week counts, the recap's due check and its copy. It reads the engine's awards and kudos text, the directory and progression's view rule through their exported reads, never their tables. The Slack adapter owns the route, the lookup and the DM's delivery.
- **SR21. The flag.** `stars`, a member decision of the giver, `safeDefault: false`. It starts on for `environment = sandbox` and the product owner's email only, with the same email condition as `activity` (decision 18).
  - It is read with exposure only for a reaction that passes every other part of SR1, so its exposure goes only where it decides something.
  - With it off, unset or the flags key missing, the reaction does nothing. Every Slack call, website read and table write then equals `main`'s, apart from what an App Home opening by the same person already causes on `main`:
    - the event's receipt;
    - SR4's `users.info` lookup of an unknown person, with its verification row, its scheduled retries, and the directory row and group reconcile it writes;
    - the analytics identity and workspace key the member decision creates, with their `$identify`;
    - the flag's exposure row and its `$feature_flag_called` event.
  - The people a star is for are paid whatever their own flag says. Their timeline entries and recap show only where `stars` is on for them.
- **SR22. Widening.** The product owner tries it once map #57's timeline rows are live. After he has tried it, the conductor asks him before turning `stars` on in production (decision 18).
- **SR23. Coherence.** The stars module's component spec carries the invariants:
  - **a member stars a message at most once**: refuted by a redelivered event, a re-added reaction or a second skin tone paying twice;
  - **a star never passes the star budget**: refuted by two reactions at once both paying the eleventh star;
  - **a star is never an award**: refuted by a star changing a board, a kudos total, coins or a quest.

  As the gate's oracle, the Slack adapter's component spec carries **stars are dark where the flag is off**.
- **SR24. Scale.** A star's mutation reads the receipt, the giver's and author's directory rows, whether the message is a Given kudos message and the giver's own award on it (unique lookups), the giver's stars that day (at most the budget), the giver's star on the message (a unique lookup) and the giver's count rows. It never collects the message's other stars or its recipients: the people are paged (SR9).

### Stopping point 2: the boost, the Book and a quest

- **SR25. Where it applies.** The boost follows stars wherever they are (a star exists only where `stars` was on for its giver). The ladders and the quest apply in a workspace while the `stars` workspace decision is on there, as CH23 planned: the sandbox at once, production when the product owner widens `stars`. One predicate decides it for every path: ladder discovery and replay, counting, tier earning, tier notices, the Book's reads and every quest candidate path.
- **SR26. The star boost.** When a star brings a message's count to 5, 10 or 20, each of that star's people gets +5, +10 or +20 XP once per message and threshold, keyed `star-boost:{conversation}:{ts}:{threshold}`, through the same reward path. The star's mutation publishes `starBoost`, and progression pays it as SR9 pays a star. Nothing posts in a channel. *(Call 7.)*
  - The timeline gains `starBoost: { kind, key, at, stars: 5 | 10 | 20, xp: number | null, on, permalink }` for each person it paid.
  - The recap adds the boost's XP to `receivedXp` and, when there was one, a line `Your message reached {stars} stars: +{xp} XP.` for the highest threshold that week.
- **SR27. The Crowd ladders.** Ladder catalogue version `2` adds three ladders in the Book's Crowd category, beside Applause:

  | Ladder | Counts | Bronze | Silver | Gold | Diamond |
  |---|---|---|---|---|---|
  | `crowd-favourite` Crowd Favourite | the most stars on one message you were starred for | 3 Crowd Pleaser | 5 Rallying Cry | 10 Talk of the Town | 20 Living Legend |
  | `standing-ovation` Standing Ovation | stars received | 10 Applauded | 50 Encore | 200 Crowd Roar | 1,000 Stadium Legend |
  | `amplifier` Amplifier | stars given | 10 Joined In | 50 Backup Vocals | 250 Amplifier | 1,000 One-Person Crowd |

  - Their tiers carry no promised reward: no coins (stars pay none, SR2), no kudos emoji (the slots retirement makes every owned kudos emoji count) and no drop (crates stay the one drop source). A tier is its Book entry and its tier notice. *(Call 8.)*
  - They count from the star records and the per-message counts, and are replayed over the workspace's star history when they first apply (P62), with one summary per member. Earned tiers today name the award that earned them, and replay reads award history; these ladders need a star-backed source: a tier earned by a star names that star, and replay walks star history. Existing award-backed tiers are unchanged, and no award is ever made up for a star.
- **SR28. The Book.** `getBook` and App Home's Book show the three ladders where SR25 applies. Elsewhere the Book equals `main`'s.
- **SR29. The quest.** Quest pool version `3` adds `give-stars`, "Give 5 stars to teammates' messages.": kind participation, target 5, the personal reward, `needs: ["stars"]` (replacing the pool's unused need for #32's feature). Its progress counts the member's stars after the draw, one per star.
- **SR30. Feasible.** `give-stars` is feasible for a member (P80) while SR25 applies and `stars` is on for them, read without exposure at the draw. A drawn one stays for the week if the flag turns off. No quest ever asks to receive stars (P83).
- **SR31. Nothing else.** Stopping point 2 sends no Slack message beyond the tier notices and quest lines the existing modules send, and adds no flag.

### Stopping point 3: star kinds from the collection

- **SR32. The flag.** `star-kinds`, a member decision of the giver, `safeDefault: false`, sandbox plus the product owner's email first. Stars (stopping point 1) must be on for the giver too.
- **SR33. The kinds.** Star kind catalogue version `1`, eight kinds, each one hoggie from the collection catalogue (record slugs only; art is never committed, the brand package is PolyForm Strict):

  | Kind | Label | Hoggie |
  |---|---|---|
  | `great-work` | great work | `star` |
  | `great-demo` | great demo | `hot-popcorn` |
  | `funny` | funny | `haha-bizzniss` |
  | `thanks` | thanks | `heart` |
  | `mind-blown` | mind blown | `shocked` |
  | `clever` | clever | `einstein` |
  | `shipped` | shipped | `rocket` |
  | `celebrate` | celebrate | `party` |

  The other candidates on #558 (`success`, `steve-jobs`, `hand-clasp`) stay out: one hoggie per kind. *(Call 9.)*
- **SR34. The admin maps each kind.** The workspace admin uploads one custom emoji per kind from the brand art, then maps it in App Home's Admin tab: a "Star kinds" section with one row per kind and the custom emoji picker of ST31–ST35 (search the workspace's custom emoji, aliases folded). One emoji per kind and one kind per emoji. The workspace's kudos emoji and its aliases can't be mapped: it is every member's star already (SR1). Clearing a row stops that emoji counting from then; stars already given stay. A kind without an emoji counts nothing.
- **SR35. A kind counts once found.** A reaction with a mapped emoji (skin tone stripped) is a star for a giver who holds that kind's hoggie in their collection (CL6), from the moment they first found it, forever: no slots, no choosing. Everything else is SR1–SR24: the same budget, the same 1 XP each way, one star per member and message whatever the emoji. The star record keeps its kind.
- **SR36. Every kind is worth the same.** No kind pays more, and the boost counts every star on a message.
- **SR37. Known for.** A member is known for the kind they received most, all time, with at least 3 stars of it, the latest on a tie. The website's profile and the `/hedgehug` profile card show "Known for :{emoji}: {label}" while `star-kinds` is on for the viewer. The kudos emoji itself is never a "known for".
- **SR38. Showing kinds.** Timeline star entries and the recap show the kind's emoji. The website's collection marks a hoggie that is a mapped kind with its emoji ("Counts as a star"), and a crate that drops one says so.

### What this replaces

- **SR39.** SR1–SR38 replace CH1–CH30. What carries over: the reaction event and its manifest (CH18 → SR17), unknown people (CH6 → SR4), skin tones and redelivery (CH5 → SR5), the dark oracle's shape (CH19 → SR21) and the Crowd ladders' names (CH24 → SR27). What doesn't: the allowance spend (CH2), the replies (CH7, CH8), the recognition-is-a-message-and-a-giver prefactor (CH3, unneeded since stars aren't awards; #539 is closed and never merged), the `via` property (CH10, CH11) and CH26's quest.
- **SR40. Vocabulary.** The lexicon declares **star**, **star budget**, **star boost** and **star kind**. #32's two concepts (the reaction and its threshold) are retired on the product owner's "Retire it." (2026-10-16), and award, crowd booster, qualifying recognition and bonus drop their clauses about them. The retire rejects the names, so `main`'s three uses are rewritten: the `kudosGiven` event's `via` union keeps only `"message"`, and the website's quests fixture says "Give 5 stars to teammates' messages.".

## Implementation Decisions

- **Modules.**
  - The Slack adapter gains a `reaction_added` branch in the events route with SR18's cheap filter, a normalized reaction (SR19), the lookup of unknown people (SR4, reusing `verifyMember`'s path), and the recap DM's delivery through the existing DM path.
  - A new stars module owns the star entrance (SR1–SR7), its records and counts, the budget, `starGiven`, the recap's due check, copy and claim (SR12–SR14), and the `stars` flag.
  - Progression gains a `starGiven` subscriber that pays reward records (SR8, SR9); nothing else in progression changes.
  - Activity gains two star sources beside levelUps and found (SR11). The website's activity switch must keep compiling: the activity ticket renders nothing for the new kinds until map #57 builds them.
  - Message settings gain the `stars-recap` kind (SR13). Analytics gains two projections (SR16). The manifest gains its scope and event (SR17). The workspace settings row gains an optional `starBudget`.
- **Tables (stopping point 1).** `stars` (one per giver and message, indexed by giver and day, by giver and time, and by message and giver); a per-person row for each star's people, indexed by member and time, for the received timeline; `starCounts` (per message); per person, week and message counts; `starWeeks` (per member and week: given, received, their XP, the most-starred message, and whether the recap was scheduled and sent). Every star table is insert-only except the counts and weeks.
- **No new public surface.** The star is an internal mutation run from the signed events route; the recap is an internal cron job. The website's reads only gain entries and a setting.
- **The lexicon commit comes first.** The first build ticket cherry-picks `docs/stars`'s lexicon commit (the declares, the retires and the three rewrites), so `spec/stars` never carries a rejected name.

## Testing Decisions

- Test from the outside in at the existing seams:
  - signed Slack `reaction_added` events into `/slack/events`, observed as the domain reads (`homeFacts`, standing and level, the boards, `getActivity`), FakeSlack calls and PostHog captures;
  - the clock moved to Monday 09:00 in a member's time zone for the recap, observed as FakeSlack's DM;
  - `messageSettingsOf` for the new kind.
- Prior art: `convex/slack/kudosMessages.test.ts` and `edits.test.ts` for events; `convex/slack/unknownPeople.test.ts` for lookups; `convex/slack/levelUpDm.test.ts` and `messagePlaces.test.ts` for DMs and places; `convex/slack/*Gate.test.ts` for the dark oracle; `convex/quests/newWeek.test.ts` for the Monday sweep; the activity tests behind `getActivity`.
- FakeSlack must send `reaction_added` shapes with and without a skin-tone suffix, in a thread and at the top level, by the app's bot user and by a person. The ship verifies the real shape against the sandbox once the manifest is pasted and records it as a fixture.
- "Once" and "budget" are proven by redelivered, re-added and concurrent events, never by reading a table. Stars staying out of awards are proven by the boards and kudos totals equalling a run without the star.
- No test asserts a private function or a table layout.

## Out of Scope

- Retiring slots (#558's call 9): its own ticket under the store (#31). It doesn't block stars.
- Any channel message for stars or for the boost, and stars on the leaderboard.
- Stars from the website, in DMs or on files. Undoing a star.
- An admin control for the star budget (SR6).
- Changing the kudos emoji: it stays `:hedgehug:`, with no icon change.
- Grouping stars in the read (SR11): the website folds adjacent entries.

## Further Notes

**The product owner's calls** (#558, 2026-10-16, grilled one at a time; "Yes go"):
1. Stars replace #32's reaction design (the verbatim call is on #558). One light tier for every counting reaction; writing stays the only way to spend the allowance.
2. The name is "star": "give out stars", "12 stars this week". "boops" was rejected.
3. Up to 10 stars a day, separate from the allowance; 1 XP to every person it is for and 1 XP to the giver ("amended the recommendation here, which gave the giver nothing"); once per message; past the budget nothing; a removed reaction keeps its XP.
4. First slice: `:hedgehug:` only.
5. Stars give XP and appear on the timeline; they are not kudos and never count on the leaderboard; no Slack message for a single star; a recap: "a daily or weekly recap would be helpful so people [...] know how much XP they earned. Perhaps the system could also prompt users, hinting that they can earn more XP by giving thoughtful kudos messages."
6. Recap weekly, as a DM, a new message kind with DM or none, default DM.
7. The boost is stopping point 2 and silent: +5, +10, +20 XP at 5, 10, 20 stars; Slack's own count is the public sign.
8. Kinds unlock through the collection (stopping point 3); every kind is worth the same.
9. Slots retire, in a separate ticket.
- 2026-10-16, on retiring the lexicon terms: "Retire it."

**Calls made at their recommendation** (each recorded with `coherence decide`):
1. A star is its own record, not an award (SR2), so boards, allowance, quests, coins and the thoughtful gate never see it.
2. Unknown givers and authors are looked up and the star decided afterwards (SR4), as CH6 planned, over dropping a first star.
3. The star budget is a workspace row field defaulting to 10, with no admin control yet (SR6), over a deployment constant or an Admin tab control.
4. Star XP goes through reward records with no cause (SR8), over effects records (which are per award) or a new XP path.
5. XP is paid by a paged bus subscriber (SR9), so a star on a kudos message with many recipients stays within limits.
6. The timeline gets one entry per star with an `on` key for the website to fold, over grouping in the read (SR11). Star entries show in the full view only, and `getRecentKudos` stays kudos-only.
7. The boost (SR26) is keyed per message and threshold and pays the crossing star's people.
8. The Crowd ladders' tiers carry no promised reward (SR27): stars pay no coins, and a standard kudos emoji reward would turn ordinary messages into kudos once slots retire.
9. One hoggie per kind, eight kinds (SR33); the admin maps each with the ST31 picker (SR34); "known for" is the all-time top kind with at least 3 stars (SR37).
10. The recap is sent at 09:00 Monday in the member's time zone, the Monday post's hour, and only while `stars` is on for the member (SR12).
11. Only stopping point 1 is ticketed now; 2 and 3 are planned once the product owner has tried 1 in early November.
12. The ship deploys dark and proves everything with signed synthetic events in the sandbox, then parks on the manifest paste before the live-reaction proof (the conductor's relay, 2026-10-16).
13. A reaction's conversation is classified by its ID alone (SR1): `D…` is a DM and does nothing, everything else the app is in counts, group DMs included, over a `conversations.info` call per reaction.
14. A star's people are resolved and paid after the star is recorded, in pages (SR3, SR9); the giver is paid in the star's mutation.
