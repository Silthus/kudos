# Spec: the new core loop: items, XP moments and social pull

> **Accepted on Silthus/personal#101 (2026-10-21): the product owner locked the spec and its two test seams and asked for it to be built and deployed autonomously. Its 17 implementation tickets are Silthus/personal#103 to Silthus/personal#119.** This file lives on the integration branch `spec/core-loop` and is never merged on its own: each implementation ticket lands its slice on this branch, and the ship ticket takes it to `main`. It is the spec of the core-loop map (Silthus/personal#95).
>
> **Rule numbers.** Rules are cited as `LP1`–`LP64`. Album rules keep their own numbers (`AL8`, `AL10`), as `convex/album/Album.spec.md` cites them.
>
> **Seven stopping points**, one flag each. 1 (LP1–LP25) is the item board behind `hidden-items`: the ledger, the board, the turn, the old flow going dark and the spoiler-free Slack reply. 2 (LP26–LP37) is the XP moment behind `xp-moments`, with its level-up takeover. 3 (LP38–LP43) is the Slack teaser and the norm line behind `teasers`. 4 (LP44–LP50) is the welcome item and the welcome nudge behind `welcome-item`. 5 (LP51–LP56) is the share and the Monday post's find behind `item-share`. 6 (LP57–LP60) is the pet hoggie behind `pet-hoggie`. 7 (LP61–LP64), a follow-up from Silthus/personal#130, is the achievement hoggies behind `achievement-hoggies`. 1 comes first; 2, 3, 4, 5 and 7 build on it; 6 stands alone.
>
> Sources: the map's decisions (Silthus/personal#95); the resolutions of the game-design research (Silthus/personal#96), the item board prototype (Silthus/personal#97, branch `prototype/item-board`, `ItemBoard.tsx` `play()`), the XP moments prototype (Silthus/personal#98, branch `prototype/xp-moments`, `ACCEPTED.md`), the items architecture (Silthus/personal#99, branch `prototype/items-architecture`, `docs/architecture/items.md` and ADR-0010) and the social-pull grilling (Silthus/personal#100); the code on `main` at `e1d2859a`. Where an input conflicts with the product owner's own call, his call wins: earned emojis are never hidden and unlock with the turn that brings them, and there are no random emojis.

## Problem Statement

A member who is thanked, or who thanks a teammate thoughtfully, has to do three chores before they see what they earned: open a pack, find the sticker and the hoggie in the tray, and put each one into the album. The Slack reply spoils the surprise before the website gets a chance: it already says who the new sticker is, how far the page got and which emoji unlocked. When the member comes back to the website, nothing tells them what happened in Slack since they were last there. Slack itself says almost nothing that would pull them over: one button. A member who has been thanked but never opened the website gets no reason to. And a member who finds something rare has no way to show it.

## Solution

**Everything a member earned and has not seen lies face down on one board, and turning an item over is the reveal. Coming back plays what happened since the last visit, and Slack says just enough to make the member want to look.**

- **Items, face down.** Every reward a member has not seen (a thanked person's sticker, a pack's hoggie, a level-up's three hoggies, the welcome hoggie) is a round item, face down with a question mark, on one item board. A click cross-fades to the album page it belongs to, the item turns over, its rarity bursts out, and it lands in its slot with force. There are no packs to open and no tray to empty.
- **No spoilers.** Slack says `An item for thanking Alex · 3 wait`. Nothing anywhere says what an item holds before it turns.
- **The XP moment.** When a member comes back, what happened since the last visit flies out of a glowing orb as Slack-style excerpts. A click dissolves them into XP that fills the bar. A crossed level gets a gold takeover. Then the waiting items land face down on the same canvas.
- **Pull from Slack.** App Home and the Monday hugs recap carry a teaser ("3 items wait · 2 kudos came in since your last visit"), and the XP moment and App Home carry a norm line ("12 teammates gave thoughtful kudos this week").
- **Welcome.** A member who has never opened the website has one welcome item waiting, a hoggie that is at least rare, and gets exactly one DM, ever, after a kudos or hug they receive, inviting them to collect it.
- **Share and pet.** After a turn that finds an epic or legendary hoggie or completes a team page, the member may press `Share` to post the win to the weekly-post channel. A member may pick one hoggie they own as their pet, shown on their person page and beside their sticker on team pages.
- **Dark first.** Every piece ships behind its own sandbox-only flag in project 662840 and widens to production once its sandbox proof is green.

## User Stories

**The item board (stopping point 1)**

1. As a member, I want everything I earned and have not seen to wait face down on one board, so that I collect it in one place instead of opening packs and emptying a tray.
2. As a member, I want every waiting item to look the same from the back, so that nothing tells me what it holds before I turn it.
3. As a member, I want an item to lift, wiggle once and bob its question mark when I hover over it, so that the board feels alive without giving anything away.
4. As a member, I want a click on an item to show the album page it belongs to before it turns, so that I know where it goes and the turn happens in its place.
5. As a member, I want the item to turn over and burst in its rarity's colour, so that a rare find feels rare.
6. As a member, I want a turned item to land in its slot with force, so that putting it in the album is the reward, not a chore.
7. As a member, I want the screen to fade to the slot rather than scroll, so that the animation never makes me motion sick.
8. As a member, I want a second click, `Enter`, `Space` or `Esc` to jump the item straight into its slot, so that I can go fast once I know the sequence.
9. As a member, I want the +15 XP of a thanked pack to fly from the turned hoggie into my XP bar, so that I see what the thanks paid.
10. As a member who just filled a team, I want the team sticker to unlock on that page right after the sticker lands, so that completing a page is celebrated where it happened.
11. As a member, I want an emoji to unlock right after the turn of the item that brought it, so that every emoji arrives as part of a reveal instead of sitting hidden.
12. As a member who reached a milestone tier, I want it to get its own beat on Milestones, so that a milestone feels bigger than a single slot.
13. As a member, I want everything I just put in to carry a "New" label until my next visit, so that I find it again when I come back to the page.
14. As a member, I want a quiet "Later" that closes the board and an "N items wait" pill that reopens it, so that I can stop at any time.
15. As a new member, I want a pointer to show me the first item once, so that I know what to do without a tutorial.
16. As a member who prefers reduced motion, I want a click to put the item in place, show its slot, say what it was and add its XP at once, so that I get the reveal without the movement.
17. As a member on a phone, I want the same flow with smaller items, so that I can collect from anywhere.
18. As a member who levelled up, I want the level's three hoggies to wait on the board tagged with their level, so that I know where they came from without seeing them.
19. As a member who had packs or tray items waiting when the board arrived, I want them on the board face down, so that nothing I earned is lost.
20. As a giver, I want the Slack reply to say only that an item waits for thanking the person and how many wait, so that the reveal stays on the website.
21. As a giver, I want the reply's button to take me to my items, so that the pull from Slack is one click.
22. As a member, I want a turn I make twice (after a reconnect, or in two tabs) to reveal one thing and pay once, so that I never get a different hoggie or double XP.
23. As the product owner, I want every turn recorded in PostHog with its source and rarity, so that I can see whether the board is used.
24. As the product owner, I want the flag to go back off at any time without losing anything, so that a bad rollout is a two-way door.

**The XP moment (stopping point 2)**

25. As a returning member, I want what happened in Slack since my last visit to play as Slack-style excerpts, so that I feel the thanks I got and gave.
26. As a returning member, I want the excerpts to ring a mystery orb that reads "? XP", so that the total is a small surprise.
27. As a returning member, I want a click anywhere, or a short timeout, to collect, so that I never have to find a button.
28. As a returning member, I want the excerpts to dissolve into XP particles that count up in the orb and stream into my XP bar, so that the XP feels earned and lands where it lives.
29. As a busy member, I want everything past five excerpts folded into one line with its XP, so that a big week still plays in seconds.
30. As a member who crossed a level, I want the level-up always among the five, so that it never hides in the fold.
31. As a member who crossed a level, I want a gold takeover that names the level and lists what it unlocked, staying until I click, so that the level-up is its own moment.
32. As a member, I want the waiting items to land face down on the same canvas after the moment, so that the moment hands me straight to the board.
33. As a member, I want `Skip` or `Esc` to land all the XP at once and show the items, so that I can get on with it.
34. As a member who prefers reduced motion, I want the moment to show its end state at once, so that I get the summary without movement.
35. As a member with two tabs or two devices, I want one moment per visit, so that the same excerpts do not play twice.
36. As a member whose Slack was quiet, I want only the waiting items, so that I am not shown an empty moment.
37. As the product owner, I want to know how often the moment is skipped and how many excerpts it showed, so that I can tune it.

**Teaser and norm line (stopping point 3)**

38. As a member opening App Home, I want one line that says how many items wait and how many kudos came in since my last visit, so that I know there is something for me on the website.
39. As a member who gets the Monday hugs recap, I want the same counts as its last line, so that the recap pulls me over too.
40. As a member, I want the teaser hidden when nothing waits and nothing came in, so that Slack stays quiet when there is nothing to say.
41. As a member, I want to see how many teammates gave thoughtful kudos this week, so that I feel part of a habit without anyone being ranked.
42. As a member who opted out of the boards, I want to be counted in the norm line but never named, so that my privacy holds.

**Welcome (stopping point 4)**

43. As a member who has never opened the website, I want one hoggie that is at least rare waiting for me, so that my first visit pays off.
44. As a member who was just thanked and has never opened the website, I want one DM that quotes the thanks and invites me to collect my rare hoggie, so that I learn HedgeHug exists for me.
45. As a member, I want that DM exactly once, ever, so that HedgeHug never nags me.
46. As a member who was hugged rather than thanked, I want the DM to link the hugged message, so that it still makes sense.
47. As a member who has opened the website before, I want no welcome DM, so that only newcomers are nudged.
48. As a workspace maintainer, I want to turn the welcome nudge off in App Home settings, so that the workspace decides whether HedgeHug may DM first.
49. As a new member who just turned my welcome item, I want one line that tells me how the next item comes, so that I learn the loop in one sentence.

**Share and the Monday post (stopping point 5)**

50. As a member who just found an epic or legendary hoggie or completed a team page, I want a `Share` button, so that I can show the win to my workspace.
51. As a member, I want sharing to happen only when I press it, once per win, so that nothing is posted in my name by surprise.
52. As a colleague, I want a shared win to lead with the thanks behind it, so that the post celebrates the thanks, not the loot.
53. As a member thanked in a private channel, I want a shared win never to quote the message, so that private thanks stay private.
54. As a member of a workspace without a weekly-post channel, I want no `Share` button, so that I never press something that cannot post.
55. As a reader of the Monday post, I want a quoted kudos to say which epic or legendary hoggie it brought once its owner has turned it, so that the post shows the fun without spoiling anyone.

**Pet hoggie (stopping point 6)**

56. As a member, I want to pick one hoggie I own as my pet, so that my page shows something I chose.
57. As a member, I want to change my pet at any time, so that it follows my favourite.
58. As a colleague, I want to see a member's pet in colour on their person page and beside their sticker on team pages, so that the album feels personal.

**Achievement hoggies (stopping point 7)**

59. As a member who fills a team page or reaches a milestone tier, I want a hoggie I do not own yet, rarer the harder the achievement, so that a hard achievement pays better than an easy one and never pays a duplicate.

## Implementation Decisions

### Vocabulary

- **LP1 The lexicon.** The first ticket declares and widens these terms in `lexicon.json`, before any spec uses them:
  - **item** widens: something a member owns or has waiting. Besides a kudos emoji or hedgehog with a stable ID (its sense today), an item is a reward the member has not seen, a thanked person's sticker or a hoggie, that lies face down on the item board until its turn. **hoggie** changes with it: a hoggie waits as an item and is drawn at its turn, not at an open.
  - **item board**: the one place on the website where every waiting item lies face down. It is declared as "item board", not "board", because "board" is the leaderboard's ranking.
  - **face down**: an item not yet turned, which shows nothing of what it holds.
  - **turn**: the member's click that reveals one item and puts it in the album. An item turns once.
  - **last visit**: one instant per member, stored on the server, moved forward once per visit.
  - **XP moment**: what plays when a member comes back: the excerpts since the last visit, their XP into the bar, a level-up takeover when a level was crossed, then the waiting items.
  - **teaser**, **norm line**, **share**, **welcome nudge**, **welcome item**, **pet hoggie**, as Silthus/personal#100 defined them: a teaser is a line in a Slack surface the member opens or already receives that counts what waits and never says what it holds; a norm line is a count of people who gave thoughtful kudos in a period, with no names; a share is a member's own press that posts one win to the weekly-post channel; the welcome nudge is the one DM a member gets after receiving a kudos or hug while they have never opened the website; the welcome item is a member's first hoggie, with a rare floor, waiting for their first visit; the pet hoggie is the one hoggie a member picks to show on their person page and on team pages.

### The items ledger

- **LP2 A new Items module.** `convex/items` owns every reward a member has not seen, with its own component spec. It keeps a ledger with one row per waiting item, written in the same mutation that earns it (ADR-0010, carried from the architecture branch into `docs/adr/` by the first ticket, with `docs/architecture/items.md`).
- **LP3 Two sources.** An item is a sticker or a hoggie. Earned emojis are never items and never hidden: each unlocks with the turn that brings it (LP14). There are no random emojis (LP15). This overrides the architecture's emoji source.
- **LP4 The ledger's shape** (from the architecture prototype, trimmed to the two sources):

  ```ts
  source: "sticker" | "hoggie"
  key: string // sticker: the pack ID; hoggie: the crate key (thoughtful:<pack>, level:<n>:<slot>, welcome:first, team:<team>, milestone:<milestone>:<tier>)
  floor?: Rarity // a level-up's third hoggie (rare), the welcome item (rare), a team or tier item (LP61)
  reason: { kind: "thanks"; person; message } | { kind: "levelUp"; level } | { kind: "welcome" } | { kind: "team"; team; name } | { kind: "milestone"; milestone; tier }
  earnedAt: number
  turnedAt?: number
  // indexes: by_member_turned [member, turnedAt, earnedAt]; by_member_source_key [member, source, key]
  ```

- **LP5 Earned once, turned once.** An item is unique per member, source and key: a second earn returns the first row and changes nothing, so redelivered events, retried pages and the backfill can overlap. `turnedAt` is set once and never moves.
- **LP6 Earned whatever the flag says.** Writers earn items whether or not `hidden-items` is on for the member, as packs are recorded whatever `album` says (ADR-0006, ADR-0009). The old reveals (open and put-in, the level-up drop) mark their items turned, so a member whose flag turns on finds exactly what they have not seen, and a flag turned back off loses nothing.
- **LP7 Who earns.** The thoughtful pack grant earns the hoggie (`thoughtful:<pack>`) and, where the grant decided the pack holds one, the person's sticker, both with reason `thanks`. A thanks therefore earns one or two items. The level-up hoggie drop earns `level:<n>:<slot>` for its three slots, the third with a rare floor, and drops nothing while `hidden-items` is on. The welcome item is LP44. The team and tier items are LP61.
- **LP8 Reads are one range each.** The board reads one index range, oldest first, at most 100 items with a `more` flag. The waiting count reads one range of at most 51 rows and answers "50+" past 50.
- **LP9 The board names nothing.** A board item carries its ID, when it was earned and its reason (the thanked person's name and face, or the level). Never a face, a person's sticker, a hoggie, a rarity or a source.

### The turn

- **LP10 One turn mutation.** `turnItem` is the only thing that reveals an item and puts it in the album. It answers the face, the page it lands on, the XP it applied and anything it unlocked, or `refused` for another member's item, a missing item, or `album` or `hidden-items` off, writing nothing then.
- **LP11 Drawn at the turn.** A hoggie item has no drop record until its turn. The turn draws it (the draw stays a pure function of the secret, the member, the crate key and the catalogue version), counts the find, records the crest and pays the crate's band through the existing gain path: 15 XP for a thoughtful pack, nothing for a level-up or the welcome item. Hoggies' drop takes `waits` from its caller instead of checking the crate kind; the old open passes `waits: true`.
- **LP12 Idempotent.** A replayed turn answers the same face with `again: true`, applies nothing and publishes nothing, because the Convex client resends a mutation after a reconnect. Two tabs turning two items at once both succeed; Convex retries one on conflict.
- **LP13 A sticker's turn is today's put-in.** It records the pack sticker, counts the new face, publishes `stickerPutIn` (so `album sticker collected` keeps its series) and lands on the member's first team page holding the person, else the people page. Milestones stay inline: every turn, a sticker's or a hoggie's, records the milestone tiers it reaches in the same mutation and answers them, so their unlock plays in the turn's sequence. This drops the architecture's move of milestones to the bus.
- **LP14 Emojis unlock with the turn that brings them.** Every emoji is unlocked by an item or a milestone, so its unlock plays as a follow-up of the turn whose item brings it, after the item lands: a sticker that fills the last place on a team unlocks the team sticker and its team emoji on that team page (LP19); a turn that reaches a collection milestone tier (people, teams, reach, hoggies) unlocks the tier and its emoji on Milestones (LP19a); the first item turned from thanking a person unlocks that person's hype emoji beside their sticker. Emojis earned away from the board unlock where the member next sees their cause: a level's emoji in the level-up takeover (LP34), and a thoughtful-giving tier, reached in Slack, as a follow-up of the member's next turn. Each unlock plays once, wherever it plays first, and marks its emoji seen. None of them is an item, and nothing lands in the top bar.
- **LP15 No random emojis.** Random emoji drops never left the sandbox (`random-emojis` is sandbox-only), and the core loop has none: the turn never rolls one. The sandbox's old open keeps its roll until the tray retires.
- **LP16 Analytics.** The first turn of an item publishes `itemTurned` on the bus, projected as `item turned` with `source`, `rarity` and `is_new` on the allowlist. The dark-features walk reaches it.

### The board on the website

- **LP17 Where it shows.** While `hidden-items` is on, `getAlbum` answers the board and empty packs and tray. The board opens over the live album shell when items wait and the XP moment (if any) has handed over. "Later" closes it, and an "N items wait" pill under the top bar opens it again. The packs button and the tray are hidden.
- **LP18 The Page-first sequence at 0.8×.** The prototype's accepted timings, one hoggie, measured: the click at 0 s, the page cross-fades from 0.03 s and shows at 0.36 s, the turn starts at 0.76 s with the rarity bursting partway through, the hold with the caption from 1.7 s, the fade-and-jump to the slot from 2.5 to 2.8 s, the drop from 3.1 s, then a rest, and the board is back at 5.3 s. A plain item takes about 5.8 s from click to board; one that also unlocks a team sticker about 8.8 s. The decision-rich part of `play()` (prototype durations at 1×; the real build divides each by 0.8):

  ```ts
  lift to the middle (560 ms) ‖ if another page: aside, 200 ms, go to the item's page
  turn: rotateY 0 → 205° → 180° (720 ms), burst at 330 ms
  hold with caption; +15 XP chip flies to the bar; 650 ms
  fade to the slot: dark, 220 ms, jump (never scroll), light, 260 ms
  above the slot (420 ms), drop (190 ms, fast-in), disc fits the slot
  land: slot pops 1 → 1.26 → 0.93 → 1.04 → 1 (520 ms), two rings, squash 1.16 × 0.84 (200 ms)
  if the sticker filled a team: 380 ms, fade to the seal, gold burst, seal pops and colours (760 ms), 1300 ms
  then each milestone tier the turn reached (LP19a)
  rest 800 ms, the board comes back (420 ms)
  ```

- **LP19 What the sequence holds.** Hover never changes the page and never says where an item belongs: the item lifts 9 px, wiggles once and its question mark bobs, and nothing loops. A hoggie's page opens at the top of the `Hoggies` page, so its rarity waits for the turn. The burst carries the rarity: the hoggie's rarity colour, the accent colour for a sticker. On the drop a sticker's disc squares off to the slot's corners, and a hoggie loses its disc so only the art lands. A filled team's sticker unlocks with a gold burst, the seal pops and colours in, it reads `Unlocked <date> :team-…:` and gets a "New" label, with no second line under it. The turned item's caption is its name and one line.
- **LP19a A milestone gets its own beat.** After the item lands (and after a team sticker's unlock), each tier the turn reached plays on Milestones: the screen fades to the medal (never a scroll), the medal pops from grey into its tier's colour with a burst of rays in that colour, its name and tier read out (`Familiar faces · Silver`), and its emoji pops in beside it with a "New" label. It holds about 1.5 s at 0.8×, longer than a team sticker's unlock, and a click skips it like the rest. A diamond tier adds the gold confetti. Reduced motion shows the medal and emoji in place with one line.
- **LP20 The board's look.** Every back is the same cream disc with a dashed orange ring and an orange question mark. The items drift in a loose cluster with mixed sizes and tilts and no panel behind them. The only text is "N items wait" and a quiet "Later". The first item sits a little forward, and a pointer slides in and taps it twice, then stops, and disappears once the member hovers or clicks. Items with reason `levelUp` carry a gold "Level N" tag.
- **LP21 Skip, reduced motion and phone.** A click anywhere, or `Enter`, `Space` or `Esc`, jumps the running item into its slot. With reduced motion, a click puts the item in place, shows its slot, says what it was ("70's Dance: Rare hoggie · New") and adds the XP, with no movement. A phone runs the same flow with 72 px items.
- **LP22 "New" labels.** Every sticker, hoggie plate, team sticker and medal turned or unlocked after the member's last visit carries a small "New" label on its page. The labels clear at the member's next visit (LP26): an item put in before that visit never says New again, even when the last visit stops short of it.

### The old flow goes dark

- **LP23 The tray and the put-in.** While `hidden-items` is on, the website's open, put-in and put-all-in refuse, and their code stays until the flag is everyone's. A tray item not yet put in is a face-down item; its turn finishes today's put-in without a second XP. A hoggie in the tray turns from its existing drop and pays nothing.
- **LP24 The backfill.** `fillItems`, internal and run by hand once per deployment and again after the flag widens, walks every member one mutation at a time and earns, idempotently, every pack not yet opened (its sticker where it holds one, and its hoggie) and every tray item not yet put in. Level-up hoggies already dropped earn nothing. Nothing stored is deleted, and a rerun earns nothing twice.
- **LP25 The Slack reply and the level-up reveal.** While `hidden-items` is on for the giver, each recipient's headline is "An item for thanking X" (for `nextWeek`: "Kudos counted." and "Your next item for X comes next week."), with one line "N wait" (or "50+ wait") and one button, "See your items", to the item board. The headline stays "An item" when the thanks earned a sticker too, so the count per thanks never tells a new face. No outcome lines and no hype picture: the new person, page progress and emoji unlock move to the turn. Feedback reads only Items' waiting count. The separate level-up reveal page from Silthus/kudos#744, which turns three cards face up, is not shown while `hidden-items` is on, and the level-up DM's link opens the album instead. The level-up lives in the one flowing sequence: the XP flies in, the takeover follows (LP34), and it flows into the item board, where the level's three items wait face down (LP32).

### Last visit and the XP moment

- **LP26 The last visit.** One forward-only instant per member, kept in Website reads. It moves once per visit: at the XP moment's end or skip when one plays, and at arrival when none plays (flag off, or nothing since). It moves to the newest instant the moment read, never to the clock, so entries decided while the moment played wait for the next one, and a stale tab moves nothing. The visit's answer labels from the later of the last visit and the newest item put in, so what a visit turned after its moment ended never says New at the next visit; a stale tab's answer is the last visit as it stands. It exists under `hidden-items` (for the "New" labels) and under `xp-moments`, whichever is on.
- **LP27 What it reads.** `getXpMoment` reads Activity through a new lower bound, `activitySince`: one index range per source with the instant above the last visit, at most 50 entries, plus the waiting count. It answers `off`, `none` (no last visit yet, or nothing since) or a moment: the excerpts, the fold, the climb from the standing before the moment's XP to now, and the waiting items. The pack's 15 XP is not in it: that pays at the turn.
- **LP28 Which excerpts.** Kudos received, hugs on the member's message, kudos the member gave, hugs the member gave and level-ups. Up to five: every level-up crossed, then the newest of the rest, shown oldest first. Everything else folds into one line, "+12 more kudos and hugs · +140 XP", whose XP flies as one chip.
- **LP29 The canvas.** After a 600 ms settle the page dims under the top bar; the XP bar stays lit while the rest of the top bar fades back. Senders show initials on a colour; only HedgeHug's own messages carry the sitting hedgehog.
- **LP30 The mystery orb.** The excerpts and the fold line fly out of a glowing orb in the centre, 170 ms apart, and ring it: 370 by 196 px on desktop, tilted up to 7°, overlapping a little, each with its own "+N XP" chip. The orb reads "? XP · Tap to collect" with a countdown ring.
- **LP31 Collect.** A click anywhere collects, or the timeout: 2 s plus 0.7 s per excerpt (6.2 s for six). Each excerpt dissolves left to right into fine dust and XP particles, 140 ms apart over a 720 ms sweep; the particles fly into the orb, which counts up from +0 to the total with a small bump as they land. After a 550 ms beat the orb streams into the XP bar, which fills particle by particle; crossing a level pops the level pill.
- **LP32 One flowing sequence.** The XP moment, the level-up takeover and the item board are one sequence on one dim canvas, each flowing into the next. After the XP lands (and the takeover, when a level was crossed), the canvas reads "+178 XP from 16 moments since Mon 09:12" and becomes the item board: the round face-down items land on it, the level's new items among them with their gold `Level N` tag, and a click turns one right there (LP18). "Later" is a quiet link. The norm line sits under the summary (LP40).
- **LP33 Skip, reduced motion, quiet weeks, phone.** `Skip` and `Esc` land all the XP at once and show the end state. Reduced motion shows the end state at once. With no excerpts, only the items show; with no excerpts and no items, nothing plays. Rays and confetti run once. On a phone the orb sits under the excerpts; the accepted sequence was checked at desktop size only, so the slice's proof checks the phone layout.
- **LP34 The level-up takeover.** When the climb crosses a level, after the bar fills, gold sparks fly off the level pill and a gold `Level N` disc drops to the centre with a shockwave, one pass of gold rays and gold confetti. "You reached level N!", then the unlocks pop in one by one: "3 new items unlocked" with three face-down backs, and the level's emoji where the level earns one. Then "Level N+1 is X XP away". It stays until the member clicks, and the click flows into the item board, where those three backs land among the waiting items (LP32). The skill point and the level emblem the prototype listed are left out: skill points are retired, and a level emblem is not a thing the album has or needs.
- **LP35 One moment per visit.** A second tab or device reads the same moment until one of them ends it; ending an older moment moves nothing.
- **LP36 Analytics.** `endXpMoment` records `xp moment ended` as a usage fact with `skipped`, `excerpts_shown` and `folded`.
- **LP37 Types from the server.** The website imports every new answer type (board, turn, XP moment) from `convex/website`; it adds no hand copies.

### Teaser and norm line

- **LP38 The teaser.** "3 items wait · 2 kudos came in since your last visit" sits at the top of App Home's front door, under the level line, and is the last count line of the Monday hugs recap. The counts are the waiting items (LP8, "50+") and the kudos received since the last visit (one range, "50+"). Without a last visit the kudos half is left out. The line is hidden when both are zero. It never says what an item holds.
- **LP39 No new digest.** The hugs recap still goes out only in weeks with hugs, to members who get it by DM. There is no album digest DM.
- **LP40 The norm line.** "N teammates gave thoughtful kudos this week" closes the XP moment and sits on App Home's front door. N counts the workspace's distinct thoughtful givers this giving week, members opted out of the boards included, and names nobody. It is hidden below 3. It is a count of people, never an average. A stored count per workspace and giving week, bumped on a member's first thoughtful kudos of the week, keeps the read to one row. The Monday post keeps its own "N people gave kudos last week" line.
- **LP41 Flags.** The teaser shows where `teasers` and `hidden-items` are both on for the member; the App Home norm line where `teasers` is on; the XP moment's norm line where `xp-moments` is on.
- **LP42 Reactive only.** The teaser and the norm line live only in surfaces the member opens or already receives. Neither sends a new message.
- **LP43 Words.** Slack copy says "album" (not "Team Album") and lowercase "hoggie".

### Welcome

- **LP44 The welcome item.** A member who has never opened the website (no signed-in user for their Slack identity) has exactly one welcome item: a hoggie item with key `welcome:first` (the `welcome` crate kind, which has no pack band), reason `welcome`, a rare floor and no XP. It is earned when the welcome nudge is sent, and at the member's first sign-in if it is still missing. A member who signed in before `welcome-item` ships earns none. It never expires.
- **LP45 The welcome nudge.** Right after a kudos or hug the member receives, while they have never opened the website, HedgeHug sends one DM. It is sent at most once per member, ever, recorded before the send so a retry never sends twice. Members thanked before launch are reached on their next kudos or hug.
- **LP46 Its copy.** The giver and the quoted thanks, then "Your rare hoggie is waiting for you to collect it.", then a button, "Open your HedgeHug album". For a hug the first line reads `Alex hugged your message :hedgehog:`, linking the hugged message. It never says "face down" or "item waits" and shows no XP. "Rare" is the welcome item's one exception to no spoilers, and the rare floor makes it always true; the nudge never names or shows the hoggie. A kudos from a private channel is named without a quote.
- **LP47 Only newcomers.** A member who has opened the website gets no nudge, only the teaser.
- **LP48 The maintainer's switch.** The workspace maintainer can turn the welcome nudge off in App Home settings. Members have no setting of their own.
- **LP49 Teaching the loop.** After the welcome item turns, one line on the board teaches the loop: "Your next item comes when you thank a teammate with :hedgehog: and say why.", with the workspace's kudos emoji. There is no tutorial.
- **LP50 Flag.** All of LP44–LP49 is behind `welcome-item`, read for the receiving member, and needs `hidden-items` on for them too.

### Share and the Monday post

- **LP51 When Share shows.** Only after a turn that finds an epic or legendary hoggie, or whose sticker completes a team page; diamond tiers wait. It is never on by default and never posts by itself. Without a weekly-post channel there is no button.
- **LP52 Once per win.** A win is shared at most once, keyed by its item, and the button is gone after the press, on every device.
- **LP53 Where it goes.** HedgeHug posts the share into the workspace's weekly-post channel. No channel picker, and no new Slack scope (`chat:write.public` covers public channels).
- **LP54 The card puts the thanks first.** `Michael thanked Alex: '…' and found a legendary Disco Hog`, giver and recipient in bold, or "…and completed the Product Analytics page", with the hoggie art or the team crest and an "Open HedgeHug" link. Colleagues' faces are not shown. The quote is the thanks alone, without the mentions and emoji that open or close the message. A kudos from a private channel names the giver and the recipient without a quote. A level-up hoggie leads with the level (`Michael reached level 7 and found …`) and the welcome item with the find alone.
- **LP55 The Monday post marks a find.** The top-kudos post stays built around the quoted thoughtful kudos. Beside a quote it may show the hoggie the kudos brought ("found a legendary Disco Hog"), only when that item was an epic or legendary hoggie and its owner has turned it. "Team stickers unlocked last week" stays; no list of finds is added. The weekly edition on the website does not get the mark.
- **LP56 Flag.** The share and the Monday post's mark are behind `item-share`; the share also needs `hidden-items` on for the member.

### Pet hoggie

- **LP57 Picking.** "Make my pet" on a hoggie the member owns, on the `Hoggies` page, makes it their pet. One pet per member; picking another replaces it. There is no default pet.
- **LP58 Where it shows.** In colour on the member's person page and beside their sticker on team pages, to every viewer, even one who does not own that hoggie or hold that member's sticker; the sticker itself stays as it is. Not on the Leaderboard and not in Slack.
- **LP59 Storage.** One row per member naming a hoggie slug they own; a pick of a hoggie the member does not own is refused.
- **LP60 Flag.** Behind `pet-hoggie`, read for the viewer for the pet's display and for the owner for "Make my pet".

### Achievement hoggies

- **LP61 Who earns.** A filled team page earns its member one hoggie item keyed `team:<team>`, with reason `team` naming the team and its name and a `rare` floor. Each milestone tier reached earns one keyed `milestone:<milestone>:<tier>`, with reason `milestone` and a floor that rises with the tier: bronze `uncommon`, silver `rare`, gold `epic`, diamond `legendary`. The team sticker's unlock and the tier's record earn them in their own mutation, whatever `hidden-items` or `achievement-hoggies` says (LP6), and the key makes a rerun earn nothing twice (LP5). The `team` and `milestone` crate kinds have no pack band, so their turn pays no XP. Team pages and tiers reached before this ships earn nothing, and `fillItems` earns none for them (LP24).
- **LP62 Never a duplicate.** The turn draws a team or tier item from the hoggies at or above its floor that the member does not own at that moment, so a hoggie turned earlier, in the same visit too, counts as owned. The rarity is drawn with the usual weights among the rarities at or above the floor that still hold a hoggie the member does not own. Every other draw keeps its duplicates.
- **LP63 Owning everything at or above the floor.** When the member owns every hoggie at or above the item's floor, the turn draws as any floored item does: a duplicate at or above the floor. A harder achievement therefore never pays a lower rarity than an easier one, which a new hoggie below the floor would.
- **LP64 Flag.** Behind `achievement-hoggies`, read for the member, which also needs `hidden-items` on. While either is off, team and tier items wait unseen: the item board, the waiting count and every reply or teaser built on it leave them out, and the turn refuses them, so today's behaviour is unchanged. Nothing about them is drawn while they wait, so nothing is lost when either flag turns back off: they wait until both are on again. The old flow never paid them, so unlike level items they need no old-flow reveal. On the board a team item carries its team's name and a tier item its medal (`Hoarder · Gold`), as a level item carries its level (LP20).

### Flags

Seven sandbox-only flags in project 662840, each created with one condition, `environment = sandbox` at 100%, read without an exposure as `album` is, and widened by the conductor once its proof is green: `hidden-items`, `xp-moments`, `teasers`, `welcome-item`, `item-share`, `pet-hoggie` and `achievement-hoggies`. A missing flag answers off. A recorder never reads a flag.

## Testing Decisions

- **A good test** drives the product from the outside: a signed Slack event or a member's call to a public website function goes in, and what the member sees comes out (the website's answer, the Slack message sent, the App Home published, the PostHog event captured). It never reads a table to prove a behaviour that a member could observe instead.
- **Seam 1: the backend from Slack to the website.** One convex-test backend per test, with the signed Slack boundary, the fake Slack and the fake PostHog from `testing/`, and a signed-in website session calling `getAlbum`, `turnItem`, `getXpMoment` and `endXpMoment`. A thanks in Slack, then the board, the turn and the reply, all through it. Prior art: `convex/website/album.test.ts`, `convex/website/levelUp.test.ts`, `convex/website/activity.test.ts`, the App Home and DM proof seams.
- **Seam 2: the website shell with fixture reads.** The album shell rendered with fixture reads under Testing Library and jsdom, with a fake clock for the sequences, asserting what the member sees and which mutation was called. Prior art: `website/src/album/hoggies.test.tsx`, `levelUp.test.tsx`, `home.test.tsx`, the pack-opening tests.
- **No new seam.** Both seams exist. A ticket that cannot test through them names why in its PR.
- **Idempotence and limits.** The turn's replay, two-tab turns and the ledger's earn-once run through Seam 1 with `transactionLimits: true` where a page of 50 recipients earns items.
- **The flag's two directions.** Each flag gets a test with it off that shows today's behaviour unchanged, and the dark-features walk covers every new event.
- **Timing and look are proofs, not tests.** The sequences' feel, the phone layout and the reduced-motion path are proven in the sandbox browser with stills or a capture, per ticket.

## Out of Scope

- Quests, the Store and crate store, the quest, feature and bought crates (ADR-0009 retired them), the Book's stickers and Engine.
- Easter-egg items, a glowing next choice, favourite hoggies, a milestone booster and a team-page group quest (ranks 6 to 10 of the game-design research).
- New stat pages: person pair stats, the Leaderboard and the weekly edition stay as they are.
- Any expiry, countdown or loss mechanic, and the welcome item's expiry (revisit once engagement is measured).
- Sound.
- Deleting the tray, the open and the put-in: a follow-up once `hidden-items` is everyone's.
- The architecture's other follow-ups: one earned-emoji set, tallies as bus subscribers, breaking the import cycle between the hoggie, unlock and quest modules, and one guard for album mutations.

## Further Notes

- **Where the product owner's calls override the architecture.** The architecture made earned emojis board items, rolled a random emoji at each pack hoggie's turn and moved milestones to the bus. The product owner ruled that emojis are never hidden but unlock with the turn that brings them, that milestone unlocks get their own beat, and that there are no random emojis, so items are stickers and hoggies only and milestones stay inline in the turn (LP3, LP13, LP14, LP15, LP19a).
- **Choices this spec made** where the inputs left it open: the "New" labels clear at the next visit (LP22); the last visit also moves at arrival when no moment plays (LP26); one headline per thanks, however many items it earned (LP25); level-ups always among the five excerpts (LP28); the separate level-up reveal page gives way to the one flowing sequence (LP25, LP32); a thoughtful-giving tier unlocks after the next turn (LP14); "never opened the website" means no signed-in user (LP44); "item board" rather than "board" in the lexicon (LP1).
- **The architecture capture moves into the repo.** `docs/architecture/items.md` and ADR-0010 come from `prototype/items-architecture` with the first ticket, amended for LP3, LP14 and LP15.
