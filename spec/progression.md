# Spec: progression, after the scope cut

> **Accepted on [#86](https://github.com/Silthus/kudos/issues/86) (2026-10-13) under the map's autonomous build-and-ship authority, every open call at its recommendation.** This file lives on the branch `docs/spec-progression-v2` and is never merged. It replaces [the first progression spec](https://github.com/Silthus/kudos/blob/1da795da2755e54cedbee21fb2659cbf0840bd7b/spec/progression.md) (#13) as the target design for the whole game, and it ships as the stopping points in [progression-stopping-points.md](progression-stopping-points.md).
>
> **Why it changed.** Michael cut the game to its core loop while prototyping the website (map #1, decision 12; [#62 round 9](https://github.com/Silthus/kudos/issues/62#issuecomment-6152588034)): "I agree with cutting more of the complex stuff like boosters, etc. and leaving only the core parts that truly feed the gameplay loop. things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey", "can we reduce the skill tree to just a single tree?", "Let's lock that design in." He corrected it in map #1's conductor thread: "the onboarding journey is not cut, the rest is as stated".
>
> **Rule numbers are stable.** Shipped code and tests cite `P1`–`P13` and `P63`–`P69`. A rule that survives keeps its number; a cut rule keeps its number as a one-line stub; new rules start at `P72`. Groups rules are cited as `G17`, core loop rules as `R36`.
>
> Sources: the cut above; the accepted website prototype ([#62 handoff](https://github.com/Silthus/kudos/issues/62#issuecomment-6152903919), branch `prototype/website-ui` at `3409ade`); the first spec and its stopping points #21, #29–#42; the groups spec (#14, `spec/groups.md` on `docs/spec-groups`); what is built on `spec/xp-levels` (#22–#26) and `spec/everyone-board` (#48–#51); the flag rule (decision 11); the PostHog spec (#69); ADR-0001 to ADR-0005; the Coherence lexicon; and the [economy rerun](../research/progression-v2.md) on this branch, which sets every number below.

## Problem Statement

The first progression spec designed a big game: three kinds of booster, group auras, drops with rarities, four kinds of cosmetic, streaks with freezes and pauses, and 21 perks in nine branches. Prototyping the website showed that most of it competes with the one thing the game exists for, thanking colleagues thoughtfully, and that a new member meets all of it at once. The game needs to shrink to the parts that feed that loop, and to reveal itself a step at a time.

## Solution

Every member still earns XP from every kudos, levels without a cap, and never loses anything. What changes is what levels lead to, and when:

- **Progressive unlocks.** Each level up to 7 makes one feature ready: quests at 2, the leaderboard at 3, the Book at 4, the skill tree at 5, coins and the inventory at 6, hedgehogs at 7. The member opens it with one click. Unlocks change what a member sees, never what they earn (ADR-0005).
- **Quests.** Three personal quests a week, one reroll, and a group quest. They ask for breadth, thoughtfulness and participation, never volume, and never name a person. The **Journey** is the first quest chain: one step per unlock that shows a member around what they just opened.
- **One skill tree** of 14 perks in 7 chains, with skill points from level 5.
- **Coins** from thoughtful giving, from being thanked by many people, from quests and from achievements. They buy perk upgrades, kudos emoji and hedgehogs, all shown with their exact price.
- **The Book**: the sticker book (groups spec) and 11 achievement ladders whose tiers give coins, kudos emoji and hedgehogs.
- **Hedgehogs**: collectable avatars from levels, achievements, quests, the Journey and the store.

Everything keeps living in Slack until the website exists: App Home for the profile, DMs for news, one thread reply under the kudos message for public moments.

## User Stories

**XP, levels and skill points**
1. As a member, I want XP for every kudos I give and receive without setting anything up, so that the game starts with my first thank-you.
2. As a new member, I want my first thoughtful kudos to reach level 2, so that the first win comes fast.
3. As a member, I want levels without a cap, so that there is always a next step.
4. As a member, I want my first skill point at level 5 when the skill tree opens, and one per level after that, so that every point arrives with something to spend it on.
5. As a member, I want my XP, level, skill points and coins never to go down (ADR-0002).
6. As a member, I want a DM when I level up that says what is now ready for me and how far the next level is.
7. As a colleague, I want a short public line when someone reaches a level, so that we can celebrate together.

**Unlocks**
8. As a new member, I want the app to show me one new thing at a time, so that I am never buried in features on day one.
9. As a member, I want to open a feature myself when it is ready, so that the moment feels like mine.
10. As a member, I want everything I earned before a feature opened to be waiting in it, so that I never miss out by opening late.
11. As a member, I want DMs and replies to mention only what I have opened, so that the app never talks about things I can't see.
12. As an early member, I want features I already used to stay mine when unlocks ship, so that nothing is taken away.

**Quests and the Journey**
13. As a member, I want three quests a week that nudge me to thank someone new or say why, so that I have a small goal each week.
14. As a member, I want to swap one quest a week, so that a quest that doesn't fit my week isn't wasted.
15. As a member of a group, I want a quest my group works on together that shows who joined in, never how much, so that it feels like a team effort without a scoreboard.
16. As a member, I want quests never to ask for a number of kudos or tell me whom to thank, so that thanks stay genuine.
17. As a new member, I want the Journey to walk me through each feature as I open it, so that I learn the game by playing it.
18. As a member, I want to claim a finished quest by opening its crate, so that the reward feels like a moment.

**Perks**
19. As a member, I want one skill tree whose rows open by level, so that my choices are easy to see.
20. As a member, I want to see every perk's effect, level, cost and prerequisite before I buy.
21. As a member, I want upgrades to cost skill points and coins, so that thoughtful giving feeds my build.
22. As a member, I want perks I own to stay mine even if the tree changes.

**Coins, the store, kudos emoji and hedgehogs**
23. As a giver, I want coins for thoughtful kudos, so that saying why pays.
24. As a member, I want to see exactly what I'm buying and its price, so that nothing in the store is a gamble.
25. As a member, I want extra kudos emoji to thank with, so that I can thank people my way.
26. As a member, I want to collect hedgehogs and pick one as my avatar, so that my profile shows who I am.
27. As a member, I want coins never to turn into kudos and never to be transferable.

**Achievements**
28. As a member, I want achievements on ladders of four tiers whose rewards grow, so that each milestone leads to the next.
29. As a member, I want achievements to count my whole history, so that I get credit for what I already did.

**Chime-ins, notices and privacy**
30. As a colleague, I want to join a kudos by clicking the app's reaction, so that one thank-you can come from many people.
31. As a member, I want public notices to show only progress, never the thank-you or the giver.
32. As a member, I want to mute public notices about me and turn progression DMs off, so that I can play quietly.
33. As a member, I want progression never used as a performance measure.

**Robustness**
34. As a member, I want every effect and reward written once and never recomputed, so that a Slack retry can't mint XP or coins (ADR-0004).
35. As Michael, I want every stopping point shipped on its own and dark behind its flag until I switch it on (decision 11).
36. As the website, I want each member's opened unlocks, quest state and earned items as facts, so that the site never computes game rules.

## Rules

Each rule is a testable statement; tests cite it (`P7`). "The giver's day" is the allowance day of the award (D20, R12). "The giver's week" starts Monday 00:00 in the giver's time zone and contains that day; "the member's week" uses the member's time zone. Catalogue items are named by their stable ID in code font. **A feature has shipped** when its stopping point is deployed and its flag is on for the workspace (decision 11); a feature that hasn't shipped doesn't exist for any rule below.

### XP and levels

- **P1. Base XP.** Every Given award gives its giver 10 XP and its recipient 5 XP per kudos, whether it came from a kudos message or a chime-in. Base XP is never gated (P13).
- **P2. Where XP comes from.** XP comes only from base XP (P1), bonus XP from perks the member owns (P18, P20), chime-in thresholds on kudos the member received (P53), and quest and Journey rewards (P86, P90). Level ups, achievements, coins, purchases, opening unlocks and opening the app give no XP.
- **P3. Levels.** Level 1 at 0 XP, level 2 at 20 XP, and from level 3 the total is `50 × (L − 1) × (L − 2)`: level 3 at 100, level 4 at 300, level 5 at 600, level 7 at 1,500, level 10 at 3,600, level 12 at 5,500, level 20 at 17,100. There is no cap.
- **P4. Skill points.** Every level reached from level 5 on gives one skill point; levels 2 to 4 give none, and nothing is paid out for them later. A member's unspent points are `max(0, level − 4) − spent`. They never expire; a spent point is never refunded (ADR-0002).
- **P5. Permanent.** XP, levels, skill points, perks, kudos emoji, hedgehogs, achievements, opened unlocks, claimed quest rewards and coins earned never go down, reset or expire. There is no respec. A perk or item retired from the catalogue stays with its owners and keeps working.
- **P6. Several levels at once.** An award or a claim that crosses several levels gives one skill point per level from 5, and one level-up notice for the highest level reached, naming every feature those levels made ready (P74).

### Effects are stored with their award (ADR-0004)

- **P7. Effects records.** Progression writes one effects record per side of every award (giver, recipient). It holds the base XP, every bonus XP line with its source (perk ID and tier, or chime-in threshold), coins earned with their source, the gate decision (P12) and the catalogue version in force. Levels, skill points, coin balances and achievements are derived from effects records, reward records (P87) and purchases.
- **P8. Exactly once.** An award's effects records are written once. Redeliveries, retried subscribers and replays never write a second record or change one. Records are insert-only.
- **P9. No recomputation.** Effects use the member's perks and the catalogue in force when the record is written. A later purchase, price change, retired item or opened unlock never rewrites an earlier record.
- **P10. Backfill.** When progression first ships, it replays every existing award in award order into effects records with base XP only: no bonus, coins or level-up notices from before it shipped. Achievement replay follows P62.

### Thoughtful kudos

- **P11. The rule (version 1).** A kudos message is thoughtful when its countable content (R1) has at least 5 words besides mentions, emoji, channel links and URLs. A word is a run of characters with at least one letter or digit, separated by whitespace.
- **P12. Decided once.** A parse hook decides it from the text in memory and annotates the kudos message with `{ version, thoughtful, words }`. The engine stores the annotation with the evaluated revision before anything is spent. A recheck (R29) reuses it; a retry (R23) is a new revision and decides again before it spends. Every effects record copies the decision.
- **P13. What the gate governs.** Only thoughtful kudos trigger bonus XP, perk effects, coins, quest progress that asks for thoughtful kudos, and spending the weekly reserve. Base XP, the daily allowance, the award itself and achievement counts never depend on it.
- **P14. Chime-ins inherit.** A chime-in uses the stored decision of the kudos message it joins.
- **P15. The hint.** When a Given message isn't thoughtful and the giver could have earned something from it (they own a perk, or coins have shipped), the success reply adds `Add why they earned it to earn more.` as its extras line (P71). Otherwise nothing is added.

### Qualifying recognitions

- **P16. Qualifying recognition.** The first thoughtful award from a giver to a recipient on the giver's day is a qualifying recognition, whether it came from a message or a chime-in. Every per-recognition bonus and giving coins trigger once per qualifying recognition, however many kudos the award carries. Base XP still counts every kudos.
- **P17. History is kept regardless of ownership.** "First this day/week" facts are recorded for every award whether or not a perk uses them, so buying a perk later never re-creates a first.

### The skill tree

- **P18. The tree.** One tree of 14 perks in 7 chains. Each row opens at its level; an upgrade replaces its base's effect. Strengths and prices from the rerun:

| ID | Row (min level) | Effect | Skill points | Coins | Requires |
|---|---:|---|---:|---:|---|
| `spark` | 5 | +5 XP on the giver's first qualifying recognition of the giver's day | 1 | | |
| `rhythm` | 5 | +2 XP on every qualifying recognition | 1 | | |
| `circle` | 5 | +5 XP on the first qualifying recognition to each recipient in the giver's week | 1 | | |
| `flame` | 7 | `spark` becomes +8 | 1 | 150 | `spark` |
| `cadence` | 7 | `rhythm` becomes +3 | 1 | 200 | `rhythm` |
| `bridge` | 7 | `circle` becomes +8 when the recipient isn't in the giver's primary group (every recipient, for a giver without one) | 1 | 150 | `circle` |
| `treasurer` | 7 | +2 coins on every qualifying recognition | 1 | | |
| `focus` | 9 | switch on for one day a week: +12 XP on that day's next three qualifying recognitions | 2 | | |
| `echo` | 9 | +2 XP on the first thoughtful award received from each giver in the recipient's week | 2 | | |
| `reserve` | 9 | weekly reserve +2 | 2 | | |
| `banker` | 9 | `treasurer` becomes +4 coins | 2 | 250 | `treasurer` |
| `spotlight` | 12 | `focus` becomes +24 | 2 | 300 | `focus` |
| `resonance` | 12 | `echo` becomes +5 | 2 | 300 | `echo` |
| `reservoir` | 12 | `reserve` becomes +4 | 2 | 350 | `reserve` |

- **P19. Buying.** A purchase succeeds when the member has opened the skill tree (P73), their level is at least the perk's row, the prerequisite is owned, the perk isn't owned, and the member has the skill points and coins; it debits both and grants the perk in one step. Otherwise nothing changes and the reason is shown. A repeated purchase command (same idempotency key) returns the first result.
- **P20. Effects add up.** A recognition's bonus XP is the sum of every applicable line. Each line is computed from base values, never from another bonus: no cap, no clipping, no compounding. An upgrade replaces its base's line.
- **P21. When a perk starts.** A perk applies to awards whose effects are written after the purchase. `reserve` and `reservoir` apply from the next Monday refill.
- **P22. Focus.** Switching `focus` on is a command, at most once per giver's week, for the giver's current day. Unused charges end with that day. No reminders.
- **P23. Cut** (`keepsake`, decision 12).
- **P24. Cut** (expression perks, decision 12).

### The weekly reserve

- **P25. Daily allowance.** The daily allowance is the workspace base only. Perks never add to it (the core loop's perks hook returns a daily bonus of 0).
- **P26. Reserve size.** The weekly reserve is `reserve` +2 or `reservoir` +4. Its size is fixed by what the giver owns when the week starts (P21). It refills Monday 00:00 in the giver's time zone, and nothing carries over.
- **P27. Spending.** A kudos message or chime-in pays from the daily allowance first and then the reserve, atomically, all or nothing (R15). The reserve counts only for a thoughtful message (P13); for any other message it is 0.
- **P28. Copy.** While a giver's reserve size is above 0, replies use R38's weekly line, naming the pool "bonus kudos". When a message is Over allowance only because it isn't thoughtful, the reply adds `Add why they earned it to use your bonus kudos.`

### Coins

- **P29. Earning.** Coins come only from:
  - giving: 4 coins per qualifying recognition, plus `treasurer` +2 or `banker` +4;
  - receiving: 2 coins for each different giver whose award to the recipient was thoughtful in the recipient's week (chime-ins count as awards from the clicker), at most 20 coins in the recipient's week;
  - quest and Journey rewards (P86, P90);
  - achievement tiers: bronze 10 coins, diamond 100 coins (P58).

  Nothing else earns coins: not levels, receiving more from the same giver, opening unlocks or opening the app. Coins are earned from level 1, whether or not Coins is opened (P75). Coins have no history before they ship: awards and claims before then earned none (P10, P86), and achievement tiers earned before then get their coins once when coins ship, as reward records (P62, P87).
- **P30. The wallet.** A member's balance is coins earned minus coins spent, never below 0. Coins never expire, can't be transferred, and never turn into kudos or allowance. A purchase debits and grants in one step.

### The store

- **P31. Items.** The store sells kudos emoji and hedgehogs from the store pool (P34), one exact item each, previewed before purchase, owned once:

| Item | Price |
|---|---:|
| Kudos emoji | 100 coins each |
| Hedgehog | 120, 300, 700, 1,500 or 3,000 coins, fixed per hedgehog in the catalogue |

- **P32. No random purchases.** Every item is shown with its exact look and price before purchase. Nothing in the store is a random draw, a reroll or a pack, and no crate holds a surprise (P92).
- **P33. Cut** (boosters, decision 12).

### Kudos emoji and hedgehogs

- **P34. Kinds and sources.** The game's items are **kudos emoji** and **hedgehogs**. Each has a stable ID and exactly one source: the starter set, a level, an achievement tier, a quest, the Journey, or the store. Sources are disjoint: an item that a tier gives is never sold.
- **P35. Cut** (rarity, decision 12).
- **P36. Collection and loadout.** The collection lists every kudos emoji and hedgehog a member owns. The loadout holds one hedgehog as avatar and up to 3 kudos emoji. Equipping and previewing are free and instant, and items earned before the inventory or hedgehogs are opened wait in the collection.
- **P37. Cut** (quips, decision 12).
- **P38. Kudos emoji.** A kudos emoji in a member's loadout is worth 1 kudos for its owner, through a parse hook (D15: the highest value wins). The workspace's own kudos emoji always works for everyone. Unlockable emoji are a curated Unicode list plus custom emoji a workspace admin picks. A chime-in counts even when the clicker hasn't unlocked the message's emoji. The starter set gives every member 🦔, waiting in the collection until they open the inventory.
- **P39. Hedgehogs.** A hedgehog is an avatar: it shows on the member's profile card, App Home and, later, the website. Every member starts with the starter hedgehog as avatar. More hedgehogs come from levels 7, 10, 15, 20 and 30, gold and diamond tiers (P58), quests (P86), finishing the Journey (P90) and the store (P31). Art is the official PostHog hedgehogs, stored in Convex storage and served from it, within Slack's image limits; no member uploads.

### Cut systems

- **P40–P44. Cut** (drops, decision 12).
- **P45. Cut** (group auras, decision 12).

### Chime-ins

- **P46. What counts.** A chime-in is a member's `reaction_added` of the message's indicator kudos emoji (R32) on a kudos message whose outcome is Given, within 24 hours of that outcome. The giver and the recipients can't chime in. Each member chimes in at most once per message. Other reactions, removals and reactions after 24 hours do nothing.
- **P47. It is a kudos.** A chime-in gives each of the message's recipients 1 kudos from the clicker: one award per recipient, spent from the clicker's daily allowance and then their reserve (P27), all or nothing, on the clicker's day at the reaction time. Awards are permanent: removing the reaction changes nothing (ADR-0001).
- **P48. Members only.** A clicker who isn't a member (R5) is ignored; an unknown clicker waits for the directory like an unknown author (R29).
- **P49. Replies.** The clicker gets an ephemeral beside the message: `You chimed in: {recipients} got 1 kudos from you. You have {left} left today.` When they can't afford it: `You need {cost} kudos to chime in ({people}), but you have {left} left today.` Nothing else changes on an unaffordable chime-in.
- **P50. Published.** A chime-in publishes `kudosGiven` with `via: "chime-in"` and the message's chime-in count after it.
- **P51. Thresholds.** When a chime-in brings a message to 3, 5, 10, 20, 50 or 100 chime-ins, each recipient gets that threshold's bonus XP (P53). Nobody gets a booster.
- **P52. The public line.** Reaching a threshold sets the chime-in section of the message's one public reply (D18) to `🔥 {count} people chimed in.`
- **P53. Strengths.** Recipient bonus XP per threshold reached: 5, 10, 20, 40, 80, 160, recorded on the effects record of the chime-in that crossed it. This is the one bonus XP nobody chooses.

### Cut: streaks

- **P54–P57. Cut** (workday streaks, workdays, pauses and streak freezes, decision 12).

### Achievements

- **P58. Ladders.** Eleven ladders of four tiers (bronze, silver, gold, diamond). The Momentum ladder is cut with streaks. Tier rewards: **bronze** 10 coins, **silver** a kudos emoji, **gold** a hedgehog, **diamond** 100 coins and a hedgehog; each ladder's emoji and hedgehogs are named in the catalogue. Never XP or skill points.

| Ladder | Counts | Bronze | Silver | Gold | Diamond |
|---|---|---|---|---|---|
| Generosity | kudos given | 1 First Thanks | 25 Generous Soul | 100 Heart of the Team | 500 Patron of Praise |
| Recognition | kudos received | 1 Noticed | 25 Appreciated | 100 Highly Valued | 500 Hall of Fame |
| Connections | different people thanked | 3 Friendly Face | 6 Connector | 12 Social Butterfly | 24 Constellation Maker |
| Dependability | days with a kudos given | 10 Regular | 30 Mainstay | 100 Pillar | 250 Cornerstone |
| Applause | days thanking 3+ different people | 3 Shout-out | 10 Hype Squad | 30 Thunderous Applause | 100 Grand Chorus |
| Seasons | calendar months with a kudos given | 1 First Chapter | 3 Season of Thanks | 6 Half-Year Hero | 12 Year of Gratitude |
| Old Friends | thanking someone again 30+ days after you last did | 1 Remembered | 3 Old Friends | 6 Long Memory | 12 Evergreen |
| Team Spirit | sticker albums completed (your primary group's, then 2, 4, 8) | Team Spirit | All Hands | Tight-Knit | Unbreakable Crew |
| Crowd Favourite | chime-ins on kudos messages you gave, in total | 5 Crowd Pleaser | 10 Rallying Cry | 20 Talk of the Town | 50 Living Legend |
| Standing Ovation | most chime-ins on one kudos you received | 3 Applauded | 10 Encore | 20 Crowd Roar | 50 Stadium Legend |
| Amplifier | times you chimed in | 5 Joined In | 25 Backup Vocals | 100 Amplifier | 500 One-Person Crowd |

- **P59. Counting.** Counts use Given awards as giver or recipient (chime-ins included), on the giver's day and calendar month; "kudos" counts units. A day counts once per member.
- **P60. Stable IDs.** Every ladder, tier and tier reward has a stable ID; the names above are copy.
- **P61. Earned once.** A tier is earned when its count is reached, once, and is never taken back. Its earned date is stored.
- **P62. Retroactive.** When a ladder ships or a tier is added, achievements evaluates it against full history. A member who earns tiers that way gets one DM summary and one public notice for the batch, not one per tier. A tier earned before its reward's kind has shipped (coins, kudos emoji, hedgehogs) gets that reward when the kind ships, once, with one DM summary.

### Notices, DMs and privacy

- **P63. DMs.** Level ups, unlocks made ready, achievements and quests ready to claim send the member a DM. DMs are on by default and can be turned off in App Home; the DM thread is the member's history.
- **P64. Public notices.** Level ups and achievements post a public notice in the kudos message's one public reply (D18), or in the announcement channel if a workspace admin picked one. A level reached by claiming a reward has no kudos message, so its notice goes only to the announcement channel when one is set. A notice states only the progress, never the thank-you text or the giver.
- **P65. Privacy.** Levels, achievement tiers and the hedgehog avatar are public by default: there is no switch to hide them. A member can mute public notices about them (P64) and turn progression DMs off (P63); leaving the leaderboards is the groups spec's (G22). Muted notices are not posted. Their own App Home and DMs still show everything.
- **P66. Not a performance measure.** Nothing ranks members by XP, level, coins or achievements. The leaderboard (groups spec) counts kudos given, never XP or bonuses.

### App Home

- **P67. Profile.** Progression extends the App Home the core loop's slice 1 builds (how to give, allowance left, kudos given and received). Its Profile tab adds the level, XP to the next level, the skill points from level 5, and the next unlock (P74); its Settings tab adds muting public notices and DMs; its Admin tab adds the announcement channel. Each feature adds its own tab or section once the member has opened it (P76).
- **P68. Fresh.** App Home is published when the member opens it and again after any change to what it shows, as desired state: the latest version wins, and a failed publish is retried.
- **P69. Admin.** Workspace admins (from the directory) also see the announcement channel picker and, once kudos emoji ship, the custom emoji picker.

### Copy

- **P70. Voice.** The app speaks as "I", plain and short, and names coins `🪙`.
- **P71. Success extras.** The core loop's success reply (R36) gets at most one extra line, joining the extras in this order with ` · `: coins earned (once Coins is opened), a new sticker (once the Book is opened, groups spec G32), a quest finished. Example: `+4 🪙 · New sticker: {recipient} · Quest done: Thank someone new`. When the gate isn't met, the hint (P15) is the last part instead of the coins.

### Progressive unlocks (ADR-0005)

- **P72. The schedule.**

| Level | Feature | What opens |
|---:|---|---|
| 1 | **Basics** | level, XP, kudos left today, the starter hedgehog avatar, the profile card, the Journey's first step; open from the start |
| 2 | **Quests** | weekly quests and the group quest |
| 3 | **Leaderboard** | the boards (groups spec) |
| 4 | **Book** | the sticker book and albums (groups spec) and achievements |
| 5 | **Skill tree** | the tree and the first skill point (P4) |
| 6 | **Coins and inventory** | the wallet, the store's kudos emoji, the loadout's emoji slots |
| 7 | **Hedgehogs** | the hedgehog collection, picking an avatar, the store's hedgehogs |

- **P73. Ready, then opened.** Reaching a feature's level makes it **ready**. The member **opens** it with one action: the `Open` button on its crate in the level-up DM or App Home, or on the website. Opening is per member, permanent, idempotent and stored with its time. A member can open ready features in any order, several at once, or never.
- **P74. Telling.** A level-up DM names the features that level made ready, each with its `Open` button. App Home's Profile tab lists every ready feature with `Open`, and the next feature still locked as `Next: {feature} at level {n}.` Nothing nudges a member to open a ready feature again.
- **P75. Unlocks never gate earning.** Effects, coins, stickers, achievement counts and tiers, and reward records are written from level 1 whatever the member has opened (P7, P9). Opening a feature shows what was already earned for it (`You already have {coins} 🪙.`). Skill points start at level 5 by P4, with the skill tree. Quests and Journey steps are goals, not earnings: a member can't pursue a goal they can't see, so quests are drawn, and a Journey step counts, only once its feature is open (P80, P88); what a finished goal earns then waits like everything else.
- **P76. Messages respect unlocks.** This rule governs what a member is told about their own progress; what other members see of them (the profile card, their row on a board) follows what has shipped, never anyone's unlocks. A DM, notice, reply line or App Home section about a feature appears only once the member has opened it. A moment that happens before is kept silent and summarised when the feature opens: tiers earned before the Book opens arrive as one DM summary on opening, like P62; coins earned before Coins opens show as the balance. A command for an unopened feature replies `{Feature} is ready for you. Open it in App Home.`, or `{Feature} opens at level {n}.` before it is ready.
- **P77. Nothing is taken away.** When unlocks first ship, every feature that had already shipped counts as opened for every member who existed then, whatever their level (ADR-0002). Members who join later follow the schedule.
- **P78. Unshipped features don't exist.** A feature that hasn't shipped is never ready, named, teased or counted in `Next:`. When it ships, it becomes ready for every member already past its level, with one DM that names it.
- **P79. Facts for the website.** Each member's ready and opened features, with their times, are stored facts that the website reads; it never computes them from the level.

### Quests

- **P80. Weekly quests.** From the moment a member opens Quests, they have 3 personal quests each week, drawn from the quest pool on Monday 00:00 in the member's time zone (on opening, for the current week). The pool is catalogue data: each quest has a stable ID, its goal, its progress predicate and what it needs (groups, chime-ins). A draw takes 3 different quests whose needs have shipped and apply to the member; with fewer eligible, it draws fewer. The draw is deterministic per member and week, and stored. Unfinished quests end with the week, with no penalty and no carry-over.
- **P81. Reroll.** Once per member's week, a member can swap one unfinished personal quest for an eligible quest not already in that week's draw. The swap is stored and can't be undone; with no such quest, there is no reroll.
- **P82. The group quest.** Each group has one group quest a week. A member takes part in the quest of the primary group (G6) they have when their week starts, and only that one: a later change of primary group counts from the next week. The quest finishes when that week's participants reach its goal together, counting only their awards attributed to the group (G10); every participant who contributed can claim it once. It shows who helped, never how much anyone gave. It is hidden when groups aren't available (G4), and a member without a primary group at the start of their week has none that week.
- **P83. Guardrails.** Every quest goal rewards **breadth** (someone new, someone not thanked in 30 days, someone in another group), **thoughtfulness** (thoughtful kudos, on different days) or **participation** (chiming in, the group taking part). A goal never:
  - counts more than 3 of anything in a week;
  - counts kudos units instead of qualifying recognitions, people or days;
  - names, suggests or ranks a person to thank;
  - depends on receiving kudos or chime-ins, which a member can't do alone and could trade.
- **P84. Progress.** Progress counts Given awards and chime-ins after the quest was drawn, with each award's stored gate decision (P12); an edit or a retry never changes progress already counted. Progress is recorded once per award and quest.
- **P85. Claiming.** A finished quest waits in its crate until the member claims it by opening it (P92), from the DM, App Home or the website. A finished quest stays claimable for good, even after its week ends. Claiming is idempotent.
- **P86. Rewards.** A personal quest gives 25 XP and 10 coins; a group quest 30 XP and 15 coins. A quest may name a kudos emoji or hedgehog from the quest pool instead of its coins, shown on the quest before it starts. A reward is fixed with its catalogue version when the quest is drawn (a Journey step: when it becomes active), and a claim pays exactly that. Coins and items wait for their features like every other earning (P75); a reward fixed before coins shipped holds no coins.
- **P87. Reward records.** A claim writes one insert-only reward record, with its XP, coins, item and the catalogue version fixed by P86. It is keyed by what it pays for: a weekly quest by member, week and slot (a reroll replaces the slot's quest, not the slot); a group quest by member, group and week; a Journey step by member and step; a tier reward by member and tier. Like effects records, they count toward XP, levels and the wallet; a level crossed by a claim publishes `levelReached` without a kudos message (P64).

### The Journey

- **P88. The first quest chain.** The Journey is a fixed chain of 7 onboarding steps, one per row of P72. Its first step is active from the start; every other step becomes active when its feature is opened. Steps run beside the weekly quests, never count toward their 3, never expire and never restart, and are claimed like quests (P85, P87).
- **P89. Steps.**

| # | Active when | Goal | Reward |
|---:|---|---|---|
| 1 | from the start | Give a thoughtful kudos | 10 XP |
| 2 | Quests opened | Finish a weekly quest | 20 XP |
| 3 | Leaderboard opened | Thank someone you haven't thanked before | 30 XP |
| 4 | Book opened | Give thoughtful kudos on 2 different days | 30 XP |
| 5 | Skill tree opened | Own a perk | 40 XP |
| 6 | Coins and inventory opened | Give a thoughtful kudos with a kudos emoji from your loadout | 40 XP and 20 🪙 |
| 7 | Hedgehogs opened | Have a hedgehog other than the starter as your avatar | 50 XP and 20 🪙 |

- **P90. Finishing.** Steps 1, 5 and 7 are states: they are finished as soon as they are active and true, counting what the member already did. Steps 2, 3, 4 and 6 count only after they become active. Claiming all seven steps gives the Journey's own hedgehog. A new member's first thoughtful kudos finishes step 1, and its 10 XP plus that kudos's 10 base XP reach level 2.
- **P91. Members already playing.** When the Journey ships, every step whose feature a member has opened becomes active for them. Steps whose state is already true (P90) are finished at once and claimable, with their rewards as usual; the others count from then.

### Crates

- **P92. Crates.** A crate is how a member takes something the game has ready for them: a ready feature (P73) or a finished quest or Journey step (P85). Opening it is one action. Its content is always known before it is opened; a crate is a moment, never a draw. In Slack a crate is an `Open` button; the reveal animation is the website's.

### Events

- **P93. Derived events.** Progression publishes `levelReached`, `unlockReady`, `unlockOpened`, `questFinished`, `questClaimed`, `perkBought`, `itemBought` and `achievementEarned`, each additive and keyed by stable IDs, so groups, the website and the PostHog events spec (#79) build on them without reading progression's tables.

## Changes to the groups spec (#14)

The groups spec stays on `docs/spec-groups`; these amendments win where they meet:

- **G4.** "Group perks in the perk list (G37)" is removed from what hides without groups; the group quest (P82) is added.
- **G17.** Unchanged in Slack. The website shows the whole ranked board, with G17's window as its default view (website map #57).
- **G23 and G42.** The Leaderboard tab and `/kudos leaderboard` follow P76 once unlocks ship: before the member opens the Leaderboard, they get P76's replies. P77 keeps them open for members who had them.
- **G28.** The profile card shows the member's name, hedgehog avatar (as the image), primary group, `Level {n}` and achievement tiers, each once the stopping point that brings it has shipped. There is no title or card, and nothing is hidden (P65).
- **G32.** The sticker line appears once the member has opened the Book (P71, P76).
- **G35.** The Sticker book tab is a section of the Book, opened at level 4.
- **G36.** Team Spirit's tier rewards follow P58.
- **G37–G41. Cut** (group auras, decision 12). G42 loses the `Group auras` setting.
- **New: the group quest (P82)** lands with groups (#52).

## Implementation Decisions

### Modules

Every domain function is internal (L1); only the adapter knows Slack.

- **Progression**: subscribes to `kudosGiven`; owns effects records, XP, levels, skill points, the tree and its purchases, the weekly-reserve contribution to the perks hook; publishes `levelReached` and `perkBought`. Built as a pure reducer (D21).
- **Unlocks**: owns each member's ready and opened features (P72–P79). It subscribes to `levelReached` and to a feature's ship, publishes `unlockReady` and `unlockOpened`, and answers `isOpen(member, feature)` for feedback and the website. The schedule is versioned catalogue data.
- **Quests**: owns the quest pool, each member's weekly draw, rerolls, group quests, Journey steps, progress and reward records (P80–P91). It subscribes to `kudosGiven`, `unlockOpened` and `perkBought`, and publishes `questFinished` and `questClaimed`.
- **Wallet and store**: coin earnings come from effects and reward records; the store owns its catalogue, the purchase ledger, the collection and the loadout. A purchase is one mutation that debits and grants.
- **Achievements**: subscribes to `kudosGiven` and to derived events (L10), keeps ladder counts and earned dates, grants tier rewards through the wallet and store, and publishes `achievementEarned`.
- **Kudos engine (extended)**: chime-ins (a new entry), the gate annotation stored per revision, and the reserve gated by it through the perks hook.
- **Feedback (extended, E3)**: DMs as intents, the one public reply per kudos message as desired state, the announcement channel and mute routing, and the **unlock filter**: it asks Unlocks before rendering any line about a feature (P76).
- **Slack adapter (extended)**: `reaction_added`, `app_home_opened`, `/slack/interactivity`, `views.publish`, DMs, and image blocks for hedgehogs.
- **Commands (D17)**: the command registry, twin of the event registry.

### Contracts

**`kudosGiven`** keeps its additive fields from #22 (`awards[].award`, `via`) and gains `chimeIns` with chime-ins.

**Perks hook** sees the message's annotations, so the reserve is gated without the engine knowing what "thoughtful" means:

```ts
interface Perks {
  of(giver: MemberId, day: DayKey, message: { annotations: Annotations }): { dailyBonus: number; weeklyBonus: number };
}
```

**Progression's reducer** (D21), the same code in Convex, tests, replay and the simulation:

```ts
type Progress = (state: MemberProgress, event: DomainEvent, catalogue: Catalogue)
  => { state: MemberProgress; effects: EffectsRecord[]; events: DomainEvent[] };
type EffectsRecord = {
  award: AwardId; side: "giver" | "recipient"; member: MemberId; day: DayKey;
  baseXp: number; bonus: Array<{ source: PerkId | ChimeInThreshold; xp: number }>;
  coins: Array<{ source: "giving" | "receiving" | PerkId; coins: number }>;
  gate: GateDecision | null; catalogueVersion: string;
};
type RewardRecord = {
  member: MemberId;
  source: { quest: QuestId; week: WeekKey; slot: number } | { groupQuest: QuestId; group: GroupId; week: WeekKey } | { journeyStep: number } | { tier: TierId };
  xp: number; coins: number; item: ItemId | null; catalogueVersion: string; at: number;
};
```

The draw is gone with drops, so the reducer needs no random source. Standing derives skill points as `max(0, level − 4) − spent` (P4).

**Unlocks:**

```ts
type Feature = "quests" | "leaderboard" | "book" | "skillTree" | "coins" | "hedgehogs";
interface Unlocks {
  stateOf(member: MemberId, feature: Feature): "unshipped" | "locked" | "ready" | "open";
}
type UnlockOpened = { type: "unlockOpened"; member: MemberId; feature: Feature; at: number };
```

`stateOf` reads the stored opened set and the feature's ship state; it never reads the level directly, because readiness is stored when `levelReached` arrives (P79).

**Commands (D17)**, each with an idempotency key from the interaction payload:

```ts
type Command =
  | { type: "setProgressSettings"; member: MemberId; muteNotices?: boolean; dms?: boolean }
  | { type: "setAnnouncementChannel"; admin: MemberId; channel: ConversationId | null }
  | { type: "openUnlock"; member: MemberId; feature: Feature }
  | { type: "rerollQuest"; member: MemberId; quest: QuestId } | { type: "claimQuest"; member: MemberId; quest: QuestId }
  | { type: "buyPerk"; member: MemberId; perk: PerkId } | { type: "switchOnFocus"; member: MemberId }
  | { type: "buyItem"; member: MemberId; item: ItemId } | { type: "equip"; member: MemberId; slot: LoadoutSlot; item: ItemId | null };
```

The website calls the same commands through its own entrance (map #57); the module returns a result and the caller renders it.

**App Home and images.** A domain query `homeOf(member)` returns a platform-neutral view model; the adapter renders it and calls `views.publish` (P68). Hedgehog art lives in Convex file storage; the first ticket that shows a hedgehog proves in the sandbox that Slack renders a Convex storage URL in a DM, App Home and the profile card, or serves the files through an `httpAction` with cache headers instead (`imageUrl(item)` doesn't change).

**Flags (decision 11).** Every stopping point ships dark behind its own flag, and "shipped" in P78 means its flag is on. A flag read that affects a permanent fact is read in the mutation and stored with the fact (O35).

### Data (sketch)

`effectsRecords` and `rewardRecords` (insert-only), `memberProgress` (a cache of the records), `perksOwned`, `coinLedger` (spends; earnings come from records), `collection`, `loadouts`, `unlocks` (member, feature, readyAt, openedAt), `questDraws` (member, week, quests, reroll), `questProgress`, `groupQuests`, `journeySteps`, `chimeIns`, `achievementCounts`, `achievementsEarned` (with dates), `progressSettings` (mute, DMs), `homes`, `notifications`, `publicReplies`. The tree, the store, the items, the quest pool, the Journey, the ladders and the unlock schedule are versioned code with stable IDs, not tables.

## Testing Decisions

- **A good test enters at a seam and checks what a member or another module can observe**: the Slack calls made, the events published, the records written, the rows another module reads. Never private helpers.
- **Seams, highest first:**
  1. **The Slack boundary**: signed `reaction_added`, `app_home_opened` and interactivity payloads through the HTTP router with `convex-test`, Slack stubbed at `fetch`. Covers DMs, App Home, crates (`Open`, `Claim`), and P76's silence before a feature is opened.
  2. **The engine's and modules' internal functions**: chime-ins, the gated reserve, unlock state, quest draws and progress, purchases, with a seeded directory.
  3. **The pure functions**: the progression reducer and the quest progress function, with every rule table (P1–P22, P29, P58–P62, P80–P91) as table-driven tests.
- **Exactly-once (P8, P87)** is tested by delivering the same `kudosGiven` twice and repeating a claim: one record each.
- **Time** uses fake timers and two time zones, with a Monday boundary for quests, the reserve and `circle`.
- **The rerun is the balance check**, not a test: `research/simulations/progression-v2.mts` stays the reference until a later ticket points it at the real reducer.
- **The gate** (`pnpm gate`) is green on every ticket; each stopping point adds its Coherence component spec and invariants (records are insert-only; a feature's lines wait for its opening; coins never change allowance).

## Out of Scope

- **Cut by decision 12:** boosters (the XP booster, the Discovery Lantern, the crowd booster), group auras, drops, rarities, titles, quips, cards, workday streaks, workdays, pauses and streak freezes, the Momentum ladder, the hide-level and hide-achievements switches, and the expression perks `signature`, `keepsake` and `gallery`.
- **Parked by the grilling:** real-world rewards, a respec token, an App Home activity feed, the AI judge for thoughtful kudos (only its seam, D16), seasonal items, more allowance tiers.
- **Trading, gardens, 3D and 2D.**
- **The website itself**: map #57. This spec gives it facts (P79, P93) and commands.

## Further Notes

**Calls this spec makes (accepted with the spec)**

1. **Rule numbers stay stable**; cut rules stay as stubs, new rules start at P72, because shipped code cites them.
2. **The Journey is the unlock bonus quest chain.** The prototype's "bonus quest for each freshly unlocked feature" and Michael's onboarding Journey are one thing: a fixed chain with one step per unlock (P88–P91).
3. **Unlocks never gate earning** (ADR-0005): records are written from level 1, and features show what is waiting when opened.
4. **Features that shipped before unlocks stay open** for existing members (P77), so the Everyone board needs no change now.
5. **Unshipped features don't exist** for unlocks, DMs and `Next:` lines (P78), so the XP slice never promises quests or a skill tree that aren't built.
6. **Perk strengths are tuned down from the prototype's** (`flame` +8, `cadence` +3, `bridge` +8, `echo` +2, `resonance` +5): at the prototype's values perks made 41% of a steady giver's XP; tuned, 36%, with four builds winning.
7. **Quest rewards are small:** 25 XP and 10 coins personal, 30 and 15 group. At 60 XP, quests made 24–53% of members' XP; at 25, 12–35%.
8. **Quests never depend on receiving** (P83), dropping two prototype quests ("Get a chime-in on a kudos you gave", "Get thanked by 2 people"): a member can't do them alone, and they invite trading.
9. **Coins are earned from level 1** and wait for level 6: a steady giver opens Coins with about 360 coins, enough for the first emoji and hedgehog.
10. **Receiving coins keep the cap of 20 a week** from the first spec.
11. **Chime-ins stay**, without the crowd booster: the recipient's threshold XP and the public line remain; the chime-in ladders need them.
12. **Mute notices and DMs stay as settings**; only the hide switches go.
13. **Bridge counts every recipient as outside** for a giver without a primary group, so it works before groups ship.
14. **Achievement rewards wait for their kind** (P62): a tier earned before coins, kudos emoji or hedgehogs ship gets its reward when they do.
15. **Hedgehog sources:** levels 7, 10, 15, 20 and 30; gold and diamond tiers; quests; the Journey; five store hedgehogs at the old cosmetic prices.
16. **Kudos emoji in the store cost 100 coins**; only emoji in the loadout (up to 3) count as kudos for their owner.
17. **Store prices drop rarity** but keep the old ladder of prices for hedgehogs.
18. **The gate hint says `Add why they earned it to earn more.`** instead of "to activate your perks", which was wrong for a member with coins and no perks (P15, G32).
19. **Achievement tiers store their earned date** (P61), which the website's Book shows.
20. **Quests and Journey steps are goals, not earnings** (P75): they start once their feature is open, the one exception to "unlocks never gate earning".
21. **Quest rewards are fixed when drawn** (P86) and keyed by what they pay for (P87), so a catalogue change never alters a promised crate and a retry never pays twice.
22. **A member takes part in one group quest a week**, their primary group's at the start of their week (P82).
23. **Journey steps 1, 5 and 7 are states**, so members already playing finish them at once (P90, P91).

**Findings from the rerun** ([report](../research/progression-v2.md))

- **Coins pile up at the top.** After 18 months a steady giver who bought every perk and store item holds about 2,300 coins. Accepted for now: coins can't be traded or turned into kudos, so a pile harms nothing. New hedgehogs are the planned sink.
- **Quests are about a third of a quiet member's XP and half their coins.** Accepted: quests ask for the behaviour the game exists for, and quiet members level slower anyway.
- **Abuse stays slow.** A swapper trading quick kudos earns 31 coins a week and waits 28 days for an upgrade. A colluding pair who thank only each other, always thoughtfully, earns 52 coins a week against 120 for a steady giver, because coins and most perks pay once per recipient a day.

**The Octalysis walk-through (#85) can still change** the quest reward sizes and the share of coins from quests, the leaderboard opening at level 3, coins waiting before level 6, levels and achievements being public with no hide switch, the group quest showing who helped, and whether achievement rewards in coins crowd out the achievement itself. Its findings come in as an amendment.

**Vocabulary** (settled in the lexicon with this spec): quest, Journey, crate, hedgehog and Book are declared; unlock (ready, opened), skill point, level, xp, perk, coin, store, cosmetic, loadout, collection, kudos emoji, achievement, profile card, chime-in threshold, thoughtful kudos, primary group and sticker are redefined. The cut concepts (booster, XP booster, Discovery Lantern, crowd booster, group aura, drop, rarity, title, quip, card, streak, workday, pause, freeze) stay in the lexicon with definitions that say they were cut, rather than retired, because retiring rejects their names and ordinary words such as an issue title or a dropdown would fail the check (`d-f596ec02`).
