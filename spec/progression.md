# Spec: progression

> **Approved by Michael on 2026-10-13 ([#13](https://github.com/Silthus/kudos/issues/13), map [#1](https://github.com/Silthus/kudos/issues/1)), with every open call at its recommendation and the groups grilling's amendments ([#10](https://github.com/Silthus/kudos/issues/10)).** This file lives on the branch `docs/spec-progression` and is never merged. It is the target design for the whole game. It ships as stopping-point specs ([progression-stopping-points.md](progression-stopping-points.md)), each published as its own `wayfinder:spec` issue under #13 once Michael approves. The first one's implementation tickets are in [progression-xp-levels-tickets.md](progression-xp-levels-tickets.md).
>
> Sources: the progression grilling ([#9 handoff](https://github.com/Silthus/kudos/issues/9)) and its journal records, ADR-0002 to ADR-0004, the Coherence lexicon, the accepted architecture ([#11 handoff](https://github.com/Silthus/kudos/issues/11), [brief](https://github.com/Silthus/kudos/blob/prototype/architecture/prototype/architecture.md) §3, §7 and §13), the core loop spec draft ([`spec/core-loop.md` on `docs/spec-core-loop`](https://github.com/Silthus/kudos/blob/docs/spec-core-loop/spec/core-loop.md)), the balance research and the [rerun](../research/progression-rerun.md) on this branch, which sets every price and strength below.

## Problem Statement

Once kudos flow, a member has no reason to come back beyond the thank-you itself. Nothing remembers how generous they have been, nothing marks a milestone, and nothing lets them make the app their own. Hey Taco answers with levels, but its formulas are secret and its rewards are thin. The archived kudos-garden built a whole world nobody asked for. Kudos needs a game that rewards giving thoughtful thanks, stays private and optional, never turns into a performance score, and can't be farmed by two people trading kudos.

## Solution

Every member progresses automatically. Each kudos given earns 10 XP and each kudos received 5, from the first message on. Levels have no cap, and each one gives a skill point. Members spend skill points on perks: small effects that reward the way they like to thank people (the first kudos of the day, thanking someone new, being thanked by many). Thoughtful kudos, ones that say why, earn coins, which buy perk upgrades, XP boosters, streak freezes and exact cosmetics in a store with no random draws. Cosmetics (quips, cards, titles and kudos emoji) come from the store, from achievements on twelve four-tier ladders, and from drops whose chance rises after every miss. Anyone can chime in on a kudos by clicking the app's reaction, which turns one thank-you into a crowd. A weekly reserve gives perk owners a few extra kudos, and workday streaks reward steady giving without punishing holidays. Everything lives in Slack: App Home for the profile, DMs for news, one thread reply under the kudos message for public moments. Nothing ever resets or goes down.

## User Stories

**XP and levels**
1. As a member, I want XP for every kudos I give and receive without setting anything up, so that the game starts with my first thank-you.
2. As a new member, I want to reach level 2 after two kudos given, so that the first win comes fast.
3. As a member, I want levels without a cap, so that there is always a next step.
4. As a member, I want a skill point for every level up, so that levelling up gives me something to choose.
5. As a member, I want unspent skill points to stay mine, so that I can save for a perk I want.
6. As a member, I want my level, XP to the next level and skill points in App Home, so that I can see where I stand.
7. As a member, I want a DM when I level up that tells me my points and how far the next level is, so that I notice the moment.
8. As a member, I want my XP and level never to go down, so that nothing I earned is taken away (ADR-0002).
9. As a member who joined before progression shipped, I want my earlier kudos to count, so that the early adopters aren't behind.
10. As a colleague, I want a short public line when someone reaches a level, so that we can celebrate together.

**Thoughtful kudos**
11. As a giver, I want a kudos that says why to count as thoughtful, so that the game rewards meaningful thanks.
12. As a giver, I want a quick thank-you to still give kudos and base XP, so that being brief never fails.
13. As a giver, I want a private hint when my kudos wasn't thoughtful and I could have earned more, so that I learn the rule without being scolded.
14. As a giver, I want the thoughtful judgment made once, so that editing a message after the fact can't change what it earned.

**Perks**
15. As a member, I want to spend skill points on a perk from a DM button or App Home, so that choosing is one click.
16. As a member, I want to see every perk's effect, minimum level, cost and prerequisite before I buy, so that I choose knowingly.
17. As a member, I want perks in branches that reward different ways of giving, so that my build fits how I thank people.
18. As a member, I want upgrades to cost skill points and coins, so that thoughtful giving feeds my build.
19. As a member, I want my perk bonuses to add up without a cap, so that every choice keeps counting.
20. As a member, I want perks I own to stay mine even if the catalogue changes, so that nothing is confiscated.
21. As a burst giver, I want to switch on Focus for one busy day, so that my big days pay off.
22. As a receiver, I want Echo to reward being thanked by different people, so that receiving builds have a path.

**Weekly reserve**
23. As a perk owner, I want a weekly reserve of extra kudos after my daily allowance, so that busy weeks aren't capped by a quiet day's budget.
24. As a giver, I want one message to spend the rest of today's allowance and then my reserve, so that I don't have to split it.
25. As a giver, I want the reserve to refill on Monday at my midnight with no rollover, so that it stays a weekly bonus.
26. As a giver, I want to know when a message needs the reserve but isn't thoughtful, so that I can add why.

**Coins and the store**
27. As a giver, I want 4 coins for the first thoughtful kudos to each person each day, so that thoughtful giving pays.
28. As a member, I want coins when many different people thoughtfully thank me, so that being appreciated counts too.
29. As a member, I want my coin balance in App Home and coins earned on the success line, so that I see them grow.
30. As a member, I want to see exactly what I'm buying and what it costs, so that nothing in the store is a gamble.
31. As a member, I want to buy an XP booster and switch it on when it suits me, so that I control when it runs.
32. As a member, I want coins never to turn into kudos and never to be transferable, so that recognition can't be bought or traded.

**Cosmetics**
33. As a giver, I want to equip a quip that the app posts under my kudos, so that my thanks have personality.
34. As a giver, I want to pick none, one or several favourite quips, so that I control how often they show.
35. As a member, I want to unlock new kudos emoji, so that I can thank people my way.
36. As a member, I want a title next to my name and a card in my loadout, so that my profile shows what I've collected.
37. As a member, I want to see each cosmetic's rarity as a coloured square and a word, so that rarity reads without colour alone.
38. As a member, I want equipping, previewing and switching off animation to be free, so that I never pay to use what I own.
39. As a workspace admin, I want to choose which custom emoji can be unlocked, so that our own emoji join the game.

**Drops**
40. As a giver, I want a chance to find a cosmetic with every thoughtful kudos, so that giving has small surprises.
41. As a member, I want the same cosmetic never to drop twice, so that every find is new.
42. As a member, I want to see the long-run drop chance of each rarity, so that I know the odds.
43. As a member, I want a DM when something drops, so that I don't miss it.

**Achievements**
44. As a member, I want achievements on ladders of four tiers, so that each milestone leads to the next.
45. As a member, I want each tier to give an exclusive cosmetic, so that achievements are worth showing.
46. As a member, I want achievements to count my whole history, including ones added later, so that I get credit for what I already did.
47. As a member, I want an achievement never to be taken back, so that a broken streak doesn't cost me a tier.

**Streaks**
48. As a member, I want a streak of my workdays with kudos, so that steady giving is visible.
49. As a part-timer, I want to choose my workdays, so that my days off don't break my streak.
50. As a member, I want to pause future dates for free, so that holidays never cost me.
51. As a member, I want to buy a freeze that covers a missed workday, so that one bad day doesn't end a long streak.
52. As a member, I want to hide my streak and get no reminders, so that it never nags me.

**Chime-ins**
53. As a colleague, I want to join a kudos by clicking the app's reaction, so that one thank-you can come from many people.
54. As a colleague, I want a chime-in to cost me one kudos per recipient, so that it is real recognition.
55. As a giver, I want my kudos to draw a crowd that boosts everyone involved, so that group thanks feel bigger.
56. As a recipient, I want bonus XP when many people chime in, so that a big moment counts.
57. As a member, I want removing my reaction to change nothing, so that chime-ins behave like kudos (ADR-0001).

**Notices and privacy**
58. As a member, I want public notices to show only progress, never the thank-you or the giver, so that private context stays private.
59. As a member, I want to hide my level and achievements and mute public notices about me, so that I can play quietly.
60. As a member, I want to turn progression DMs off, so that the app doesn't nag me.
61. As a workspace admin, I want to send level-up and achievement notices to one announcement channel, so that threads stay clean.
62. As a member, I want progression never used as a performance measure, so that the game stays a game.

**Robustness and operations**
63. As a member, I want every effect of an award written once and never recomputed, so that a Slack retry can't mint coins or re-roll a drop (ADR-0004).
64. As Michael, I want each stopping point shipped and deployed on its own, so that the game grows in usable steps.
65. As a later module (groups, the leaderboard), I want progression's derived events and stable catalogue IDs, so that I can build on them without reading progression's tables.

## Rules

Each rule is a testable statement; tests cite it (`P7`). Core loop rules are cited as `R15`. "The giver's day" is the allowance day of the award (D20, R12). "The giver's week" starts Monday 00:00 in the giver's time zone and contains that day; "the recipient's week" uses the recipient's time zone. Catalogue items are named by their stable ID in code font.

### XP and levels

- **P1. Base XP.** Every Given award gives its giver 10 XP and its recipient 5 XP per kudos, whether it came from a kudos message or a chime-in. Base XP is never gated (P13).
- **P2. Where XP comes from.** XP comes only from base XP (P1), bonus XP from effects the member chose (perks, boosters and group auras, P20, P45), and chime-in thresholds on kudos the member received (P53). Level ups, achievements, coins, streaks, purchases and opening the app give no XP.
- **P3. Levels.** Level 1 at 0 XP, level 2 at 20 XP, and from level 3 the total is `50 × (L − 1) × (L − 2)`: level 3 at 100, level 4 at 300, level 10 at 3,600, level 20 at 17,100. So reaching L+1 from L ≥ 3 takes `100 × (L − 1)` more. There is no cap.
- **P4. Skill points.** Every level reached from level 2 on gives one skill point. A member's unspent points are `level − 1 − spent`. They never expire; a spent point is never refunded (ADR-0002).
- **P5. Permanent.** XP, levels, skill points, perks, cosmetics, achievements and coins earned never go down, reset or expire. There is no respec. A perk retired from the catalogue stays with its owners and keeps working.
- **P6. Several levels at once.** An award that crosses several levels gives one skill point per level and one level-up notice for the highest level reached.

### Effects are stored with their award (ADR-0004)

- **P7. Effects records.** Progression writes one effects record per side of every award (giver, recipient). It holds the base XP, every bonus XP line with its source (perk ID and tier, booster, group aura, chime-in threshold), coins earned, the gate decision (P12), drops with the pseudo-random charges after the draw, and the catalogue version in force. Levels, skill points, coin balances, streaks and achievements are derived from effects records plus purchases.
- **P8. Exactly once.** An award's effects records are written once. Redeliveries, retried subscribers and replays never write a second record or change one. Records are insert-only.
- **P9. No recomputation.** Effects use the member's perks, boosters, auras and the catalogue in force when the record is written. A later purchase, price change or retired item never rewrites an earlier record.
- **P10. Backfill.** When progression first ships, it replays every existing award in award order into effects records with base XP only: no bonus, coins, drops or level-up notices from before it shipped. Achievement replay follows P62.

### Thoughtful kudos

- **P11. The rule (version 1).** A kudos message is thoughtful when its countable content (R1) has at least 5 words besides mentions, emoji, channel links and URLs. A word is a run of characters with at least one letter or digit, separated by whitespace.
- **P12. Decided once.** A parse hook decides it from the text in memory and annotates the kudos message with `{ version, thoughtful, words }`. The engine stores the annotation with the evaluated revision before anything is spent. A recheck (R29) reuses it; a retry (R23) is a new revision and decides again before it spends. Every effects record copies the decision.
- **P13. What the gate governs.** Only thoughtful kudos trigger bonus XP, perk effects, coins, drops, and spending the weekly reserve. Base XP, the daily allowance, the award itself and achievement counts never depend on it.
- **P14. Chime-ins inherit.** A chime-in uses the stored decision of the kudos message it joins.
- **P15. The hint.** When a Given message isn't thoughtful and the giver could have earned something from it (they own a perk or an active booster, or coins have shipped), the success reply adds `Add why they earned it to activate your perks.` as its extras line (P71). Otherwise nothing is added.

### Qualifying recognitions

- **P16. Qualifying recognition.** The first thoughtful award from a giver to a recipient on the giver's day is a qualifying recognition, whether it came from a message or a chime-in. Every per-recognition bonus, giving coins and drops trigger once per qualifying recognition, however many kudos the award carries. Base XP still counts every kudos.
- **P17. History is kept regardless of ownership.** "First this day/week/month" facts are recorded for every award whether or not a perk uses them, so buying a perk later never re-creates a first.

### Perks

- **P18. The catalogue.** Branches, effects and costs (coins from the rerun):

| ID | Branch | Effect | Min level | Skill points | Coins | Requires | Groups |
|---|---|---|---:|---:|---:|---|---|
| `spark` | daily | +5 XP on the first qualifying recognition of each scheduled, unpaused workday | 2 | 1 | | | |
| `flame` | daily | `spark` becomes +9 | 6 | 2 | 150 | `spark` | |
| `rhythm` | weekly | when every unpaused workday of a week had a qualifying recognition: +9 XP × those workdays | 3 | 2 | | | |
| `cadence` | weekly | `rhythm` becomes +16 × workdays | 9 | 3 | 300 | `rhythm` | |
| `focus` | active | switch on for one day a week: +12 XP on that day's next three qualifying recognitions | 3 | 2 | | | |
| `spotlight` | active | `focus` becomes +24 | 7 | 3 | 200 | `focus` | |
| `circle` | breadth | +5 XP on the first qualifying recognition to each recipient in the giver's week | 3 | 2 | | | |
| `bridge` | breadth | +4 XP on the first qualifying recognition to each recipient in the giver's calendar month | 7 | 2 | 150 | `circle` | |
| `echo` | receiving | +2 XP on the first thoughtful award received from each giver in the recipient's week | 3 | 2 | | | |
| `resonance` | receiving | `echo` becomes +6 | 7 | 3 | 200 | `echo` | |
| `reserve` | capacity | weekly reserve +2 | 4 | 2 | | | |
| `reservoir` | capacity | personal reserve becomes +4 | 9 | 3 | 350 | `reserve` | |
| `curiosity` | discovery | drop rates +25% of base | 2 | 1 | | | |
| `fortune` | discovery | another +25% of base | 6 | 2 | 150 | `curiosity` | |
| `fieldnotes` | discovery | +25% of base on the first qualifying recognition to each recipient in the giver's week | 4 | 2 | | | |
| `signature` | expression | choose one named common cosmetic from its pool | 2 | | 120 | | |
| `gallery` | expression | choose three named cosmetics from its pool | 6 | | 450 | `signature` | |
| `keepsake` | expression | on the first qualifying recognition after purchase, then at least 28 days apart: choose one of 12 named cosmetics | 4 | | 300 | | |
| `rally` | group | group aura: +1 XP on every qualifying recognition by opted-in group members | 5 | 3 | | | yes |
| `beacon` | group | group aura: drop rates +15% of base for opted-in group members | 5 | 3 | | | yes |
| `provision` | group | group aura: weekly reserve +1 for opted-in group members | 5 | 3 | | | yes |

- **P19. Buying.** A purchase succeeds when the member's level is at least the minimum, the prerequisite is owned, the perk isn't owned, and the member has the skill points and coins; it debits both and grants the perk in one step. Otherwise nothing changes and the reason is shown. A repeated purchase command (same idempotency key) returns the first result. Group perks are sold only once the groups spec ships.
- **P20. Effects add up.** A recognition's bonus XP is the sum of every applicable line. Each line is computed from base values, never from another bonus: no cap, no clipping, no compounding. An upgrade replaces its lower tier's effect.
- **P21. When a perk starts.** A perk applies to awards whose effects are written after the purchase. `reserve`, `reservoir` and `provision` apply from the next Monday refill.
- **P22. Focus.** Switching `focus` on is a command, at most once per giver's week, for the giver's current day. Unused charges end with that day. No reminders.
- **P23. Keepsake.** `keepsake` offers its choice on the first qualifying recognition after purchase, then on the first one at least 28 days after the last offer, until its 12 items are owned. Missed periods never stack.
- **P24. Expression picks.** `signature` and `gallery` grant their choices immediately; the member picks from disclosed, named items. These pools are disjoint from the store, achievement and drop pools.

### The weekly reserve

- **P25. Daily allowance.** The daily allowance is the workspace base only. Perks never add to it (the core loop's perks hook returns a daily bonus of 0).
- **P26. Reserve size.** The weekly reserve is `reserve` +2 or `reservoir` +4, plus `provision` +1 from an opted-in group aura, at most 5. Its size is fixed by what the giver owns when the week starts (P21). It refills Monday 00:00 in the giver's time zone, and nothing carries over.
- **P27. Spending.** A kudos message or chime-in pays from the daily allowance first and then the reserve, atomically, all or nothing (R15). The reserve counts only for a thoughtful message (P13); for any other message it is 0.
- **P28. Copy.** While a giver's reserve size is above 0, replies use R38's weekly line, naming the pool "bonus kudos". When a message is Over allowance only because it isn't thoughtful, the reply adds `Add why they earned it to use your bonus kudos.`

### Coins

- **P29. Earning.** A giver earns 4 coins per qualifying recognition. A recipient earns 2 coins for each different giver whose award to them was thoughtful in the recipient's week (chime-ins count as awards from the clicker), at most 20 coins in the recipient's week. Nothing else earns coins: not levels, achievements, streaks, receiving more from the same giver, or opening the app.
- **P30. The wallet.** A member's balance is coins earned minus coins spent, never below 0. Coins never expire, can't be transferred, and never turn into kudos or allowance. A purchase debits and grants in one step.

### The store

- **P31. Items.** Prices from the rerun:

| Item | Price | Behaviour |
|---|---:|---|
| XP booster | 120 | When switched on: +25% of the base giver XP of each qualifying recognition, rounded half up (one kudos: +3), for 7 days. Never boosts received XP. |
| Discovery Lantern | 180 | When switched on: drop rates +25% of base for 7 days. No extra draws. |
| Streak freeze | 60 | Covers one missed workday (P54). At most 2 held. |
| Cosmetic, common / uncommon / rare / epic / legendary | 120 / 300 / 700 / 1,500 / 3,000 | One exact, previewed item; owned once. |

- **P32. No random purchases.** Every item is shown with its exact effect or look and price before purchase. Nothing in the store is a random draw, a reroll or a pack.
- **P33. Boosters.** A bought booster waits in the inventory until the member switches it on, and never expires before that. Only one booster of each kind runs at a time. Boosters of different kinds add up (P20). No countdown nudges.

### Cosmetics

- **P34. Kinds.** Cosmetics are quips, cards, titles and kudos emoji. Each has a stable ID, a rarity and a source pool (store, achievement, drop, expression perk). Pools are disjoint.
- **P35. Rarity.** Common, uncommon, rare, epic and legendary, shown as a coloured square plus the word: `⬜ Common`, `🟩 Uncommon`, `🟦 Rare`, `🟪 Epic`, `🟧 Legendary`. Rarity never changes what a kudos is worth.
- **P36. Collection and loadout.** The collection (private, App Home) lists everything a member owns. The loadout holds one title, one card, quips (none, one or favourites) and unlocked kudos emoji. Equipping, previewing and turning animation off are free and instant.
- **P37. Quips.** When a giver with a quip equipped gives kudos, the app adds a quip section to the one public thread reply under the kudos message (D18): card image, then `{kudos emoji} *{giver} · {title}* → {recipients}`, then `"{quip}"`. With favourites, they rotate in the giver's order. A giver with no quip equipped gets no public reply from quips.
- **P38. Kudos emoji.** An unlocked kudos emoji is worth 1 kudos for its owner, through a parse hook (D15: the highest value wins). Unlockable emoji are a curated Unicode list plus custom emoji a workspace admin picks. A chime-in counts even when the clicker hasn't unlocked the message's emoji.
- **P39. Art.** Cards are original art (commissioned or AI-assisted, reviewed by a person), stored in Convex storage and served from it. No GIPHY, Tenor or member uploads. Public cards are static by default.

### Drops

- **P40. Attempts.** Every qualifying recognition a member gives makes one attempt per rarity that still has unowned items. Rarities are independent, so one attempt can find several.
- **P41. Rising chance.** Each rarity keeps a charge. An attempt adds `C(p)` to the charge and hits with probability `min(1, charge)`; a hit resets the charge to 0. `p` is the long-run rate with modifiers added as percentages of the base rate (`curiosity` +25, `fortune` +25, `fieldnotes` +25 on its trigger, `beacon` +15, Discovery Lantern +25), and `C(p)` is the constant whose long-run hit rate is exactly `p`:

| Rarity | Long-run rate | C at base rate |
|---|---:|---:|
| Common | 6% | 0.0054401086149 |
| Uncommon | 2.5% | 0.00096574158449 |
| Rare | 0.8% | 0.000099998598707 |
| Epic | 0.2% | 0.0000062748226545 |
| Legendary | 0.04% | 0.00000025126041557 |

- **P42. What drops.** A hit picks uniformly among the member's unowned items of that rarity in the drop pool. No duplicates. An exhausted rarity makes no attempt and keeps its charge; new content resumes it.
- **P43. Stored first.** The draw and the charges are stored in the effects record before anyone is told. A replay reads the stored draw and never draws again.
- **P44. Shown odds.** App Home shows each rarity's long-run chance with the member's modifiers, never the current charge.

### Group auras

- **P45. Group auras.** An aura from `rally`, `beacon` or `provision` follows its owner to their current primary group and reaches every member with the same primary group who opted in. Only the strongest aura of each kind counts; a second owner adds nothing. Groups, primary groups and opting in belong to the groups spec (#14).

### Chime-ins

- **P46. What counts.** A chime-in is a member's `reaction_added` of the message's indicator kudos emoji (R32) on a kudos message whose outcome is Given, within 24 hours of that outcome. The giver and the recipients can't chime in. Each member chimes in at most once per message. Other reactions, removals and reactions after 24 hours do nothing.
- **P47. It is a kudos.** A chime-in gives each of the message's recipients 1 kudos from the clicker: one award per recipient, spent from the clicker's daily allowance and then their reserve (P27), all or nothing, on the clicker's day at the reaction time. Awards are permanent: removing the reaction changes nothing (ADR-0001).
- **P48. Members only.** A clicker who isn't a member (R5) is ignored; an unknown clicker waits for the directory like an unknown author (R29).
- **P49. Replies.** The clicker gets an ephemeral beside the message: `You chimed in: {recipients} got 1 kudos from you. You have {left} left today.` When they can't afford it: `You need {cost} kudos to chime in ({people}), but you have {left} left today.` Nothing else changes on an unaffordable chime-in.
- **P50. Published.** A chime-in publishes `kudosGiven` with `via: "chime-in"` and the message's chime-in count after it.
- **P51. Thresholds.** When a chime-in brings a message to 3, 5, 10, 20, 50 or 100 chime-ins, the giver and everyone who has chimed in so far get that tier's Crowd booster for 24 hours from that moment, and each recipient gets that tier's bonus XP (P53). A member who chimes in on a message that already passed a threshold gets the current tier's booster with their chime-in.
- **P52. The public line.** Reaching a threshold sets the chime-in section of the message's one public reply (D18) to `🔥 {count} people chimed in. Everyone who joined has a Crowd booster for 24 hours.`
- **P53. Strengths.** Crowd boosters by tier (3, 5, 10, 20, 50, 100): +10, 15, 20, 30, 40, 50% of the base giver XP of each qualifying recognition, only the strongest held counts, adding to the XP booster. Recipient bonus XP per threshold reached: 5, 10, 20, 40, 80, 160, recorded on the effects record of the chime-in that crossed it. This is the one bonus XP nobody chooses (journal `d-8c8ea3d7`).

### Streaks

- **P54. Streaks.** A streak is a run of the member's scheduled workdays on which they gave at least one Given award (any, thoughtful or not). Workdays are Monday to Friday by default; a member can change them from the next Monday. Days off and paused days neither advance nor break it. A missed workday breaks it unless a freeze covers it: a freeze covers one missed workday, at most two missed workdays in a row, and never adds a day. Freezes are used automatically on a miss when held.
- **P55. Pauses.** Members pause future dates for free. A date already started can't be paused.
- **P56. Quiet streaks.** No reminders. A member can hide the streak display. A broken streak never takes back an achievement (P61).
- **P57. Evaluated lazily.** A streak's break is computed from the calendar on the next award or read, never by a sweep.

### Achievements

- **P58. Ladders.** Twelve ladders of four tiers (bronze, silver, gold, diamond). Each tier gives one exclusive cosmetic from the achievement pool, never XP, skill points or coins. Tiers are not rarities.

| Ladder | Counts | Bronze | Silver | Gold | Diamond |
|---|---|---|---|---|---|
| Generosity | kudos given | 1 First Thanks | 25 Generous Soul | 100 Heart of the Team | 500 Patron of Praise |
| Recognition | kudos received | 1 Noticed | 25 Appreciated | 100 Highly Valued | 500 Hall of Fame |
| Connections | different people thanked | 3 Friendly Face | 6 Connector | 12 Social Butterfly | 24 Constellation Maker |
| Momentum | best streak | 5 Warming Up | 10 On a Roll | 25 Unstoppable | 60 Perpetual Motion |
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
- **P61. Earned once.** A tier is earned when its count is reached, once, and is never taken back.
- **P62. Retroactive.** When a ladder ships or a tier is added, achievements evaluates it against full history. A member who earns tiers that way gets one DM summary and one public notice for the batch, not one per tier.

### Notices, DMs and privacy

- **P63. DMs.** Level ups, achievements, unlocks and drops send the member a DM. DMs are on by default and can be turned off in App Home; the DM thread is the member's history.
- **P64. Public notices.** Level ups and achievements post a public notice in the kudos message's one public reply (D18), or in the announcement channel if a workspace admin picked one. A notice states only the progress, never the thank-you text or the giver.
- **P65. Privacy.** A member can hide their level, hide their achievements, and mute public notices about them. Hidden progress appears on no surface other members see; muted notices are not posted. Their own App Home and DMs still show everything.
- **P66. Not a performance measure.** Nothing ranks members by XP, level, coins or achievements. The leaderboard (groups spec) counts kudos, never XP or bonuses.

### App Home

- **P67. Profile.** Progression extends the App Home the core loop's slice 1 builds (how to give, allowance left, kudos given and received). Its Profile tab adds level, XP to the next level and skill points; its Settings tab adds hiding, muting and DMs; its Admin tab adds the announcement channel. Later stopping points add the Perks, Collection and Achievements tabs, coins, title and card, the streak, workdays, pauses, quips and drop odds (layout `d-766ac71d`).
- **P68. Fresh.** App Home is published when the member opens it and again after any change to what it shows, as desired state: the latest version wins, and a failed publish is retried.
- **P69. Admin.** Workspace admins (from the directory) also see the announcement channel picker and, from the cosmetics stopping point, the custom emoji picker.

### Copy

- **P70. Voice.** The app speaks as "I", plain and short, and names coins `🪙`.
- **P71. Success extras.** The core loop's success reply (R36) gets at most one extra line, joining the extras in this order with ` · `: coins earned, a new sticker (groups spec), a drop. Example: `+4 🪙 · New sticker: {recipient} · Found a 🟩 Uncommon card: Paper High-Five`. When the gate isn't met, the extras line is the hint (P15) instead.

| Message | Text |
|---|---|
| Level-up DM | `🎉 You reached level {n}! You have {points} skill points to spend.` then one button per perk the member can afford, `Save for later`, and `Level {n+1} is {xp} XP away.` |
| Level-up DM, before perks ship | `🎉 You reached level {n}! You have {points} skill points saved for perks.` then `Level {n+1} is {xp} XP away.` |
| Achievement DM | `🏅 You earned {tier name} ({ladder}, {tier}). It unlocked {reward}, and you can equip it in App Home.` |
| Achievement DM, retroactive batch | `🏅 You earned {count} achievements from your kudos so far: {tier names}. Their rewards are in your collection in App Home.` |
| Drop DM | `✨ You found a {rarity square} {Rarity} {kind}: {name}. It's in your collection in App Home.` |
| Public level notice | `🎉 {member} reached level {n}.` |
| Public achievement notice | `🏅 {member} earned {tier name}.` |
| Quip reply | card image, `{kudos emoji} *{giver} · {title}* → {recipients}`, `"{quip}"` |
| Chime-in threshold line | `🔥 {count} people chimed in. Everyone who joined has a Crowd booster for 24 hours.` |
| Chime-in | `You chimed in: {recipients} got 1 kudos from you. You have {left} left today.` |
| Chime-in, can't afford | `You need {cost} kudos to chime in ({people}), but you have {left} left today.` |
| Gate hint | `Add why they earned it to activate your perks.` |
| Reserve needs a reason | `Add why they earned it to use your bonus kudos.` |

## Implementation Decisions

### Modules

The brief's amber modules, plus three the game added. Every domain function is internal (L1); only the adapter knows Slack.

- **Progression**: subscribes to `kudosGiven`; owns effects records, XP, levels, skill points, perks, boosters and the weekly-reserve contribution to the perks hook; publishes `levelReached`, `perkBought`, `streakExtended`. Built as a pure reducer (D21).
- **Wallet and store**: coin earnings come from effects records; the store owns the catalogue of items, the purchase ledger and the inventory. A purchase is one mutation that debits and grants.
- **Cosmetics**: the catalogue with stable IDs, the collection, the loadout, the drop pools and the PRD charges' rules; contributes the unlocked-emoji parse hook and the quip section of the public reply (D10 B).
- **Achievements**: subscribes to `kudosGiven` and to progression's derived events (L10), keeps ladder counts, publishes `achievementEarned`.
- **Kudos engine (extended)**: chime-ins (a new entry), the gate annotation stored per revision, and the reserve gated by it through the perks hook.
- **Feedback (extended, E3)**: DMs as intents, the one public reply per kudos message as desired state with sections from many modules, the announcement channel and the mute and hide routing rules, image segments.
- **Slack adapter (extended)**: `reaction_added`, `app_home_opened`, the `/slack/interactivity` route, `views.publish`, DMs (`conversations.open`, `chat.postMessage`, `chat.update`).
- **Commands (D17)**: the command registry, twin of the event registry.

### Contracts (extending the locked ones from the brief and the core loop spec)

**`kudosGiven` grows by additive fields only** (queued jobs keep old shapes):

```ts
type KudosGivenEvent = {
  // ...every core loop field...
  awards: Array<{ award: AwardId; giver: MemberId; recipient: MemberId; kudos: number }>;
  via: "message" | "chime-in";
  chimeIns: number;            // the message's chime-in count after this event
};
```

The award ID is what makes effects exactly-once: progression keys effects records by `(award, side)`.

**Perks hook sees the message's annotations**, so the reserve is gated without the engine knowing what "thoughtful" means:

```ts
interface Perks {
  of(giver: MemberId, day: DayKey, message: { annotations: Annotations }): { dailyBonus: number; weeklyBonus: number };
}
```

Progression's contributor returns `weeklyBonus: 0` for a message whose gate annotation isn't thoughtful. The engine's existing R14–R15 arithmetic then makes the reserve unusable for it, in the same transaction as the spend (#11 follow-ups: atomic daily-plus-reserve spend, gate recorded once before the reserve is spent).

**The gate is a parse hook**: `thoughtfulHook.annotate(content)` returns `{ gate: { version: 1, thoughtful, words } }`. The engine already stores annotations with the revision and never reruns annotate hooks on a recheck (core loop "Interfaces"), which is exactly P12. The later AI judge (D16) publishes a separate `kudosAssessed` event and never rewrites a stored decision.

**Chime-ins enter the engine through a new entry**:

```ts
type ReactionEvent = { kind: "reacted"; ref: MessageRef; user: ChatUserId; emoji: string; at: number };
interface KudosEngine {
  chimeIn(event: ReactionEvent): ChimeInObservation;
}
type ChimeInObservation =
  | { kind: "ignored"; why: "not-a-kudos" | "not-given" | "wrong-emoji" | "too-late" | "giver-or-recipient" | "already-chimed-in" | "not-a-member" }
  | { kind: "awaiting-directory"; users: ChatUserId[]; retryInMs: number }
  | { kind: "over-allowance"; cost: number; left: number }
  | { kind: "given"; chimeIns: number };
```

The adapter normalizes `reaction_added` (dropping `reaction_removed`) with the reacting user, never text. The engine keys chime-ins by `(message, member)`, so a redelivered reaction or a remove-and-add does nothing.

**Progression's reducer** (D21), the same code in Convex, tests, replay and the simulation:

```ts
type Progress = (state: MemberProgress, event: DomainEvent, catalogue: Catalogue, draw: Draw)
  => { state: MemberProgress; effects: EffectsRecord[]; events: DomainEvent[] };
type EffectsRecord = {
  award: AwardId; side: "giver" | "recipient"; member: MemberId; day: DayKey;
  baseXp: number; bonus: Array<{ source: EffectSource; xp: number }>; coins: number;
  gate: { version: number; thoughtful: boolean }; drops: Array<{ rarity: Rarity; item: CosmeticId }>;
  charges: Record<Rarity, number>; catalogueVersion: string;
};
```

`draw` is a seeded source passed in, so a replay of a stored record never calls it.

**Commands (D17).** `/slack/interactivity` verifies the signature, turns the payload into a platform-neutral command with an idempotency key from the payload, and the registry routes it to the owning module's internal mutation:

```ts
type Command =
  | { type: "setProgressSettings"; member: MemberId; hideLevel?: boolean; hideAchievements?: boolean; muteNotices?: boolean; dms?: boolean }
  | { type: "setAnnouncementChannel"; admin: MemberId; channel: ConversationId | null }
  | { type: "buyPerk"; member: MemberId; perk: PerkId } | { type: "switchOnFocus"; member: MemberId }
  | { type: "buyItem"; member: MemberId; item: ItemId } | { type: "switchOnBooster"; member: MemberId; item: ItemId }
  | { type: "equip"; member: MemberId; slot: LoadoutSlot; cosmetic: CosmeticId | null }
  | { type: "setWorkdays"; member: MemberId; days: Weekday[] } | { type: "pause"; member: MemberId; dates: DayKey[] };
```

The module returns a result; the adapter renders it (update the DM, an ephemeral, republish App Home).

**App Home (#11 follow-up).** A domain query `homeOf(member)` returns a platform-neutral view model; the adapter renders it to Block Kit and calls `views.publish`. A `homes` row per member holds the desired version; any change that affects the view bumps it, and delivery publishes the latest, like the indicator (L3). `app_home_opened` publishes too.

**DMs and the public reply.** Feedback gets `notify(member, Notification)` (a DM intent, delivered with `conversations.open` + `chat.postMessage`, honouring the member's DM setting) and `setPublicSection(ref, section)` (one public thread reply per kudos message, edited with `chat.update` as sections arrive, D18). Routing (announcement channel, mute, hide) lives inside feedback, so modules state what happened, not where it goes.

**Images (#11 follow-up).** Card art lives in Convex file storage; image blocks use the storage URL. Slack fetches image URLs itself, so the first ticket that shows an image proves in the sandbox that Slack renders a Convex storage URL in a DM, a thread reply and App Home. If it doesn't, an `httpAction` route serves the files with cache headers instead; the contract (`imageUrl(cosmetic)`) doesn't change.

**Slack app changes** (each in the stopping point that first needs it): App Home tab and `app_home_opened`, interactivity URL, `im:write` (DMs); `reactions:read` and `reaction_added` (chime-ins); `emoji:read` (admin custom emoji).

### Data (sketch)

`effectsRecords` (insert-only, keyed by award and side), `memberProgress` (derived totals: XP, level, points spent, kept as a cache of the records), `perksOwned`, `coinLedger` (earnings come from effects records; spends from purchases), `inventory`, `boostersActive`, `collection`, `loadouts`, `prdCharges` (latest per member and rarity; the history lives in effects records), `chimeIns` (unique per message and member), `streakSchedules`, `pauses`, `achievementCounts`, `achievementsEarned`, `progressSettings`, `homes`, `notifications`, `publicReplies`. Catalogue data (perks, items, cosmetics, ladders) is versioned code with stable IDs, not tables.

## Testing Decisions

- **A good test enters at a seam and checks what a member or another module can observe**: the Slack calls made, the events published, the effects records, the rows another module reads. Never private helpers.
- **Seams, highest first:**
  1. **The Slack boundary** (core loop seam 1): signed `reaction_added`, `app_home_opened` and interactivity payloads through the HTTP router with `convex-test`, Slack stubbed at `fetch`. Covers P46–P49, P63–P69, the DM and App Home copy, and one end-to-end path per stopping point (a real message to a level-up DM).
  2. **The engine's internal functions** (core loop seam 2): chime-ins (P46–P50, P51) and the gated reserve through the perks hook (P25–P28), with a seeded directory.
  3. **The progression reducer**, a pure function (D21): every rule table (P1–P24, P29–P33, P40–P45, P54–P62) as table-driven tests with a seeded draw. The Convex subscriber is tested once per event type through seam 2, never re-testing the rules.
- **Exactly-once (P8, P43)** is tested by delivering the same `kudosGiven` twice and replaying a stored record: one record, the same draw.
- **Time** uses fake timers and two time zones, a Monday boundary for the reserve and `circle`, a month boundary for `bridge`, and a workday schedule change for streaks.
- **The rerun is the balance check**, not a test: `research/simulations/rerun.mts` stays the reference until a later ticket points it at the real reducer.
- **Prior art:** the core loop's tests at seams 1 and 2, and the prototype's `progression-sketch.ts` and `simulate.ts` (port, don't copy).
- **The gate** (`pnpm gate`) is green on every ticket; each stopping point adds its Coherence component spec and invariants (effects are insert-only; a drop is stored before it is told; coins never change allowance).

## Out of Scope

- **Groups, auras and the sticker book**: the groups spec (#14, grilling #10). This spec names the seams: group perks (`rally`, `beacon`, `provision`) and their aura rules (P45), the Team Spirit ladder, the sticker line in the extras (P71), and that the leaderboard counts kudos (P66).
- **Parked by the grilling**: real-world rewards, a respec token, picking a quip per message, an App Home activity feed, the AI judge for thoughtful kudos (only its seam, D16), banners, the mascot, frames, seasonal cosmetics, more allowance tiers.
- **Quests, trading, gardens, 3D and 2D.**
- **A web UI** and admin tools beyond the announcement channel and custom emoji pickers.

## Further Notes

**Calls this spec makes (approved with the spec)**
- The XP booster's +25% is rounded half up per award, so one kudos gets +3 (P31).
- Every bonus, coin and drop fires once per qualifying recognition (first thoughtful award to each recipient per giver's day, P16), carried over from the research; the grilling named it only for coins.
- Expression perks keep a minimum level and cost coins only (P18): `signature` 120, `keepsake` 300, `gallery` 450.
- Freezes are used automatically when held (P54).
- Favourite quips rotate in order rather than at random (P37).
- Crowd Favourite counts chime-ins on all your kudos messages in total (P58).
- A member who chimes in after a threshold gets the current tier's booster (P51).
- Backfill gives base XP only and sends no level-up notices for the past (P10).
- The minimal App Home and the welcome message land in the core loop's slice 1 (`d-1c7a971d`); progression extends them.

**Findings from the rerun** ([report](../research/progression-rerun.md))
- **Receiving coins made popular receivers the richest members** (89 coins a week against 66 for a steady giver): approved cap of 20 a week (P29).
- Receiver is now the most common winning build, by 1–5%. Accepted; revisit with real data.
- Popular receivers level fastest. Accepted; progression is not a performance measure.

**Changes to earlier specs**
- Core loop (#12): `kudosGiven` gains `awards[].award`, `via` and `chimeIns`; the perks hook gets the message's annotations; the engine gains `chimeIn`; R33's "Recipients get nothing extra" is relaxed by quips and notices (D18, `d-fe8e7f4a`). All additive; the core loop builds none of them.
- The core loop's perks hook keeps a daily bonus of 0 forever (P25).

**From the groups grilling (#10):** "team" is "group" throughout (Slack's API "team" is the workspace); Team Spirit counts 1/2/4/8 albums, and an album is complete when you've thanked or been thanked by every other current member of the group; the welcome message on the first Given award is the core loop's; the profile card lands with XP and levels in the groups spec's thin slice (`d-1c7a971d`).

**Vocabulary to settle in Coherence** (each in the ticket that first uses it): App Home, effects record, gate decision, qualifying recognition, catalogue, command, public reply, and Crowd booster's "crowd". "Bonus kudos" in the copy is the weekly reserve's user-facing name.
