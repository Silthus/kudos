# Spec: coins, the wallet and the coin perks

> **Accepted on [#30](https://github.com/Silthus/kudos/issues/30) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/coins` and is never merged. It is progression stopping point 5 and builds on the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P2, P5, P7–P9, P13, P15–P21, P29, P30, P58, P62, P63, P71, P75–P78, P86, P87, P92–P95), the per-member flags spec (`spec/per-member-flags.md` on `docs/per-member-flags`: F16–F25), and the Slack-to-web spec (`spec/slack-to-web.md` on `docs/slack-to-web`: SW1–SW5). Where this spec and P29, P62 or P19 differ, this spec wins and says why under "Further Notes".
>
> **Rule numbers.** Rules are cited as `CO1`–`CO30`. Progression rules are cited as `P29`, per-member flag rules as `F17`, Slack-to-web rules as `SW1`, website rules as `WS341`.
>
> Sources: ticket #30 and its amendment by #97; map #1's decisions 11, 12, 14 and 18 (quoted under "Further Notes"); the code on `main` at `2fe2a5a` (`convex/progression/`, `convex/achievements/`, `convex/quests/`, `convex/unlocks/`, `convex/commands/`, `convex/feedback/`); the website map's needs (map #57, `spec/website-7.md` on `docs/spec-website-7`: WS335, WS341, WS345, WS347, WS348), and the website conductor's answer to this contract.

## Problem Statement

A member who thanks a colleague and says why earns a little more XP once they own a perk, and nothing else. The game promises coins, a wallet and perk upgrades that cost coins (P18, P29, P30), and none of it exists. A diamond tier promises 100 coins and pays nothing. A personal quest promises 10 coins and pays 0. The skill tree stops at its first row because every later upgrade has a coin price. And the website can't draw its coins chip, its inventory or the rest of the tree, because no read gives it a balance.

So there is no second reward for saying why, nothing to save towards, and three stopping points (#31 kudos emoji and the store, #35 the weekly reserve, #39 the rest of the tree) wait for a currency.

## Solution

**Coins exist from the moment this slice deploys, and members see and spend them once the `coins` flag is on for them and they have opened Coins.**

- **Earning.** A kudos that says why earns its giver 4 🪙 once per qualifying recognition (P16). Being thanked, with a reason, by different people earns the recipient 2 🪙 per giver a week, at most 20. A personal quest pays 10 🪙. A bronze tier pays 10 🪙, a diamond tier 100 🪙. Tiers earned before coins existed are paid once.
- **Recorded dark.** Coins are written on effects and reward records from the deploy, like XP, whatever any flag says. The flag decides only what a member sees and whether they can spend. So turning the flag on, for the product owner or for everyone, shows what was already earned, and turning it off takes nothing away.
- **The wallet.** A balance that never goes below 0, never expires and can't be moved. Coins never become kudos.
- **Coins opens at level 6** (P72). Opening it says `You already have {n} 🪙.` From then on App Home shows the balance, and the success reply shows `+4 🪙` beside the XP.
- **The first sink.** The skill tree grows its coin perks: `treasurer` (+2 🪙 a recognition) and its upgrade `banker` (+4 🪙), and the row-7 upgrades `flame`, `cadence` and `bridge`, which cost skill points and coins. Buying one debits both in one step.
- **For the website and the next stopping points.** One read of the balance, the perk list with coin costs and upgrade links, tier rewards with their coins, and `buyPerk` debiting coins under the same idempotency key. One wallet step that every later purchase (#31's kudos emoji, #96's hedgehogs, #35's `reservoir`, #39's upgrades) spends through.

## User Stories

**Earning**
1. As a giver, I want coins when I thank someone and say why, so that saying why pays more than XP alone.
2. As a giver, I want those coins once per person a day, however many kudos I send them, so that sending more kudos to one person doesn't farm coins.
3. As a recipient, I want coins when different people thank me and say why, so that being valued by many people is worth something.
4. As a recipient, I want receiving coins capped each week, so that being popular can't outpace thanking others.
5. As a member, I want my weekly quests to pay coins, so that a finished quest helps me save.
6. As a member, I want bronze and diamond achievement tiers to pay coins, including the tiers I earned before coins existed, so that my history counts.
7. As a member, I want coins I earn before I can see them to wait for me, so that opening Coins late costs me nothing (P75).
8. As a member, I want no coins for kudos I gave before coins existed, so that the economy starts fresh for everyone (P10, P29).

**The wallet**
9. As a member, I want to open Coins at level 6 and be told what I already have, so that the moment feels like a reward.
10. As a member, I want my balance in App Home and on the website, so that I know what I can afford.
11. As a giver, I want the success reply to say how many coins my kudos earned, so that I see saying why paying off right away.
12. As a member, I want a finished quest's line to say its coins, so that I know where they came from.
13. As a member, I want a tier's DM to say its coins, so that I know the tier paid.
14. As a member, I want my balance never to go below 0, never expire and never be taken away.
15. As a member, I want coins never to turn into kudos or allowance and never to be sent to someone else (ADR-0003).

**Perks**
16. As a member at level 7, I want `treasurer`, so that I earn 2 more coins every time I thank someone and say why.
17. As a member, I want upgrades (`flame`, `cadence`, `bridge`, `banker`) that make a perk I own stronger, so that my build grows.
18. As a member, I want to see each upgrade's coin price and which perk it upgrades before I buy, so that nothing surprises me.
19. As a member, I want a purchase to take the skill points and coins together or not at all, so that I never lose one without the other.
20. As a member, I want to be told plainly why I can't buy something: not enough coins, or Coins not opened yet.
21. As a member, I want a repeated click or a retried website request to buy once, so that I never pay twice.
22. As a member without a primary group, I want `bridge` to count everyone, so that the upgrade isn't a trap before groups exist (P18, #86 call 13).

**The product owner and the rollout**
23. As the product owner, I want coins dark behind `coins`, on in the sandbox and for my email only, so that I can try them in production before anyone else (decisions 11, 14, 18).
24. As the product owner, I want coins recorded from the deploy whatever the flag says, so that switching coins on for everyone shows real balances on day one.
25. As the product owner, I want turning `coins` off to hide everything and take nothing away, so that a preview is safe to end (F24).
26. As a member who isn't previewing, I want nothing to change for me while someone else previews.

**The website and later stopping points**
27. As the website, I want the balance as a read, so that the coins chip and the inventory never compute it (WS341).
28. As the website, I want every perk with its coin cost and the perk it upgrades, so that the tree draws upgrades and connectors (WS345).
29. As the website, I want each tier's coin reward and each quest's coins as facts, so that rewards show without game rules on the page (WS347, WS348).
30. As the next stopping points (#31, #35, #39, #96), I want one wallet step that spends coins inside a purchase and refuses without changing anything, so that every purchase debits the same way.

## Rules

"Coins are shown to a member" means CO13's predicate holds for them. "Coins is open" means the member has opened the `coins` feature (P73). **"Coins are visible to a member"** means both: coins are shown to them and Coins is open for them. Every member-facing mention of coins, a balance, a coin price or a coin perk needs it (P76). "The deploy" is the moment this slice's code reaches a deployment.

### Earning (recorded dark)

- **CO1. Recorded from the deploy, whatever the flags say.** From the deploy on, coins are written on effects records (CO2–CO5) and reward records (CO6, CO7) for every member, from level 1, whatever `coins`, `xp-levels`, `unlocks` or any other flag says, and whether or not the member has opened Coins. This is how XP is recorded dark (`d-0eb89fc6`) and how the Book counts dark (#170). The boundary is the record, not the award: an effects record first written from the deploy on carries coin lines, one written before carries none, and a quest drawn before the deploy keeps its drawn reward (P10, P29, P86). So an award accepted seconds before the deploy whose subscriber runs after it earns coins; that is accepted. The progression backfill writes no coin lines, because its records carry no gate decision. Tiers earned before the deploy are paid once by CO7.
- **CO2. Giving coins.** The giver-side effects record of an award that is a qualifying recognition (P16) holds the line `{ source: "giving", coins: 4 }`, once per award however many kudos it carries. Any other award earns no giving coins.
- **CO3. Receiving coins.** The recipient-side effects record of a thoughtful award (P11, its stored gate decision) holds the line `{ source: "receiving", coins: 2 }` when it is the first recorded thoughtful award from that giver to that recipient in the recipient's week, and fewer than 10 givers have already paid the recipient receiving coins that week. The recipient's week is the Monday-to-Sunday week that holds the award's time, in the recipient's time zone as the directory holds it when the record is written (UTC when it holds none). The directory keeps no history of time zones, so a recipient who changes time zone between an award and its recording is counted in the new one. So a recipient earns at most 20 receiving coins a week, at most once per giver. Progression keeps the set of givers who paid each recipient in each week, inserted with the record. When records are written out of award order (a retry), the set may hold a different tenth giver than award order would; the total still never passes 20 and no giver pays twice.
- **CO4. Coin perk lines.** Where the skill tree applies (the skill tree's own predicate, which reads its flags; moving it to the member decision is the skill tree's work, not this slice's, and `skill-tree` is on for everyone in production), the giver-side record of a qualifying recognition also holds `{ source: "treasurer", coins: 2 }` when the giver owns `treasurer` and not `banker`, or `{ source: "banker", coins: 4 }` when they own `banker` (an upgrade replaces its base's line, P18, P20). Lines are computed from base values, never from each other.
- **CO5. Effects records stay insert-only and exactly-once.** Coin lines are part of the record when it is first written (P7, P8). A redelivered `kudosGiven`, a retried subscriber or the progression backfill writes no second record and changes none. Records written before the deploy have no coin lines and are never given any (P9). The catalogue version on records written from the deploy is `2`.
- **CO6. Quest coins.** A personal quest drawn from the deploy on fixes the reward `{ xp: 20, coins: 10, item: null }` at its draw (P86), with the quest pool at version `2`. A quest drawn before the deploy keeps the reward it was drawn with, `coins: 0`, even if it finishes later. Journey steps keep their rewards; `your-emoji`'s 20 🪙 lands with #31 and the group quest's 15 🪙 with groups (#52).
- **CO7. Tier coins.** Earning a tier whose rewards include coins writes, in the same mutation, one reward record per coin reward: `{ xp: 0, coins, item: null }` with bronze 10 and diamond 100 (P58), keyed `tier:{reward ID}` (for example `tier:generosity-diamond-coins`), at the tier's earned time. This happens whatever any flag says (CO1). A one-off paged job writes the same record, once, for every tier earned before the deploy, with the time it ran. It tells nobody: those coins show as the balance (CO16). **The ship runs the job to completion in a deployment before `coins` is created or switched on there**, so no member sees a balance that is still missing tier coins. A second run, or a tier earned again, writes nothing because the key exists (P87).
- **CO8. Nothing else earns coins.** Not levels, Journey steps (until #31), receiving from the same giver again, unlocks, crate openings, opening the app or spending skill points (P29).

### The wallet

- **CO9. The balance.** A member's balance is the coins on their effects and reward records minus the coins they spent. It never goes below 0 and never expires (P30). The wallet keeps it as a cached row per member, updated in the same mutation that writes a coin-bearing record or a spend, so a read never sums history.
- **CO10. Spending.** The wallet has one spend step, called inside a purchase's own mutation: given the member, the price and what it pays for (`{ perk }` now; `{ item }` from #31), it either debits the price and writes one insert-only spend record (member, coins, what for, time), or answers `no-coins` and writes nothing. A purchase that answers `no-coins` grants nothing and spends nothing else either. Nothing spends coins outside a purchase.
- **CO11. Coins stay coins.** Coins can't be transferred, given, refunded or turned into kudos, allowance or XP, and kudos never turn into coins (ADR-0003, P30). A spend is never reversed.
- **CO12. The wallet is the only writer.** No module but the wallet writes the cached balance or a spend record. Progression and achievements credit it through the wallet when they write a coin-bearing record.

### The flag

- **CO13. Who sees coins.** Coins are shown to a member when the `coins` flag is on in their member decision and XP and levels and unlocks apply to them (F16, F20), read without an exposure in queries. The mutation that first takes a member down a coins path sends their `coins` exposure once per value (F25, O36). `coins` is the Coins feature's ship flag in the unlock schedule, so P78's ship sweep makes Coins ready, with its one DM, for every member past level 6 when it ships for them, and a level-up to 6 makes it ready from then on. Until #31 ships the inventory, the schedule's `coins` entry is named `Coins` and opens `your wallet and the coin perks`; #31 renames it to `Coins and inventory` and widens what it opens, keeping the feature ID `coins`, so nothing promises the store or emoji slots before they exist.
- **CO14. Dark where it isn't shown.** Where coins aren't shown to a member, they see nothing of coins: no Coins in a level-up DM, App Home or `Next:` line (P78), no balance, no `🪙` part in any reply or DM, no coin perk or coin price in the skill tree, and `walletOf` answers null. Where coins are shown but Coins isn't open, the same holds except that Coins is ready or next as P73 and P74 say (P76). A stale `Buy` for a coin perk, from Slack or the website, writes nothing, spends nothing and publishes nothing where coins aren't shown, and is refused with `coins-not-open` where they are shown but Coins isn't open. Earning goes on (CO1). Turning the flag off and on again rewrites nothing and shows the same balance (O35, F24).
- **CO15. Who has it on.** `coins` starts on for `environment = sandbox` and for the product owner's email only (decision 18), and stays off for everyone else in production until the product owner turns it on. A preview never shows in a channel: coins have no public line (F18).

### Slack

- **CO16. Opening Coins.** Opening Coins (P73) sends the member one DM, unless they turned progression DMs off (P63): `Coins are open. You already have {balance} 🪙.`, or, with a balance of 0, `Coins are open. You earn 🪙 when you thank someone and say why.` (P75, P95).
- **CO17. App Home.** While coins are visible to the member, App Home's level line ends with ` · {balance} 🪙`: `Level 7 · 120 XP to level 8 · 1 skill point to spend · 340 🪙`. It is published again after every change to the balance (P68).
- **CO18. The success reply.** The coins part of the extras line (SW1) is `+{coins} 🪙`: the sum of the coin lines on the message's giver-side effects records (giving, `treasurer`, `banker`), from one function both the reply and progression use (SW2). It shows only when that sum is above 0 and coins are visible to the giver, decided at each delivery (SW5). Its place follows SW1, right after the XP part; the full order is the XP part, the coins part, quest parts, bonus parts, the hint and the link: `+10 XP · +6 🪙 · Spark bonus (+5 XP)`. The reply computes the sum when it is written, with the function the effects record uses, as the bonus parts do today. A purchase of `treasurer` or `banker` landing between the reply and the record's write can make the two differ by that perk's line; the record is the truth, and this race is accepted as it is for bonus lines.
- **CO19. Quest parts.** A quest-done part whose reward holds coins says them while coins are visible to the giver: `Quest done: Thank someone new (+20 XP, +10 🪙)` (SW3).
- **CO20. Tier DMs.** A tier DM line whose tier paid coins says them while coins are visible to the member: `🏅 You earned First Thanks (Generosity, bronze). +10 🪙`. A batch summary (P62) says the same per tier.
- **CO21. The hint.** P15's "could have earned something" also holds when coins are visible to the giver. The hint's copy is unchanged: `Add why they earned it to earn more.`

### The coin perks

- **CO22. The perks.** The skill tree gains these perks, listed and buyable only while coins are visible to the member (P76, P78), with P94's copy:

| ID | Row | Skill points | Coins | Upgrades | Copy |
|---|---:|---:|---:|---|---|
| `treasurer` | 7 | 1 | 0 | | +2 🪙 each time you thank someone and say why, once per person a day. |
| `flame` | 7 | 1 | 150 | `spark` | Spark gives +8 XP instead of +5. |
| `cadence` | 7 | 1 | 200 | `rhythm` | Rhythm gives +3 XP instead of +2. |
| `bridge` | 7 | 1 | 150 | `circle` | Circle gives +8 XP instead of +5 when the person isn't in your primary group. Without a primary group, everyone counts. |
| `banker` | 9 | 2 | 250 | `treasurer` | Treasurer gives +4 🪙 instead of +2. |

  An upgrade requires the perk it upgrades (P18). The rest of rows 9 and 12 stay with #35 and #39.
- **CO23. Upgrades replace.** Where the skill tree applies, a giver who owns an upgrade gets its line instead of its base's: `{ source: "flame", xp: 8 }` instead of `spark`'s 5, `cadence` 3 instead of `rhythm`'s 2, `bridge` 8 instead of `circle`'s 5. Until groups ship (#52) nobody has a primary group, so `bridge` pays 8 on every `circle` recognition. The success reply's bonus part names the upgrade: `Flame bonus (+8 XP)`.
- **CO24. Buying.** `buyPerk` keeps P19's checks and order, then adds two for every CO22 perk: Coins open (`coins-not-open`, for a stale button or a website request that raced the opening) and, for a perk with a coin price, a balance of at least the price (`no-coins`). A purchase that passes debits the skill points and, through the wallet's spend step (CO10), the coins, grants the perk and publishes `perkBought`, all in one mutation. A refusal changes nothing and stores its outcome under the idempotency key like any other (P19). The refusal order is: `tree-locked`, `tree-ready`, `owned`, `retired`, `below-row`, `needs-prerequisite`, `no-skill-points`, `coins-not-open`, `no-coins`.
- **CO25. Owned stays owned.** A coin perk a member owns keeps paying wherever the skill tree applies, even while coins aren't visible to them, and is never taken back (P5). While coins aren't visible, coin perks the member doesn't own aren't listed; owned ones stay listed as owned, without their coin price.

### For the website (map #57) and the next stopping points

- **CO26. `walletOf(member)`.** An internal query answering `{ balance: number }`, or `null` while coins aren't visible to the member, so the website's coins chip needs no rule of its own, and composes `coins: number | null` into its own profile answer.
- **CO27. `perksOf(member)`.** Each perk gains `coins: number` (0 when it has no coin price) and `upgrades: PerkId | null`. The CO22 perks follow CO25. The states gain `coins-not-open` and `no-coins`.
- **CO28. `achievementsOf(member)`.** Each tier's reward of kind `coins` gains `coins: number` (bronze 10, diamond 100) and, on an earned tier, `recordedAt: number | null`, the time its reward record was written. It is `null` only for a tier earned before the deploy whose backfill page hasn't run, which CO7's ordering keeps from ever reaching a member. A tier's identity stays `(ladder, tier)` with `earnedAt`, which the website's own seen key covers.
- **CO29. Quest facts.** `questsOf` and the Journey's facts keep the reward shape `{ xp, coins, item }`; CO6 fills `coins`. The website shows a reward's coins, like the balance, only while coins are visible to the member (CO26 answering non-null), as WS348 does per reward kind.
- **CO30. The path every later purchase follows.** `buyPerk` keeps its shape and its key spaces (`slack:` and the click's trigger; `website:{member}:{request}`). #31's `buyItem` and #96's hedgehog purchase follow the same rule: one D17 command whose outcome is stored under its idempotency key in the same mutation as the purchase, that spends through CO10, and that refuses with `no-coins` and `coins-not-open`. #35's `reservoir` and #39's `spotlight` and `resonance` are perks and go through `buyPerk`.

## Implementation Decisions

- **A wallet module** (new, deep): the cached balance row per member, the insert-only spend records, `credit` (called by the writers of coin-bearing records), `spend` (CO10), `balanceOf`, and `walletOf` for the website. It owns CO9–CO12 and knows nothing about why coins were earned or what they buy.
- **Progression** writes the coin lines (CO2–CO4) in its pure reducer beside the bonus lines, so tests, replay and the reducer stay one code path (D21). The reducer gains, for the recipient, the givers who already paid them receiving coins in their week (read in the mutation, like `thoughtfulAwardsBefore`) and the recipient's time zone. The effects record gains an optional `coins: Array<{ source: "giving" | "receiving" | PerkId; coins: number }>`. `recordEffects` and `recordReward` credit the wallet in the same mutation. A small table, the receiving givers per recipient and week, is inserted with the record and indexed by recipient and week. The catalogue goes to version `2` with the CO22 perks, their coin prices and an `upgrades` field; a bonus or coin line's `on` decides when it pays and `replaces` names the line it replaces.
- **The skill tree** gains CO22's perks behind CO13's predicate, CO23's replacement, CO24's checks and the coin spend, through the existing `buyPerk` and its stored outcomes. The refusal validator gains `coins-not-open` and `no-coins`.
- **Quests**: the pool's personal reward becomes `{ xp: 20, coins: 10, item: null }` at pool version `2` (CO6). Nothing else changes: the draw already fixes the reward and `recordReward` already writes its coins.
- **Achievements**: `earnTier` writes CO7's reward records through progression's `recordReward`. A one-off internal job pages through `earnedTiers` (25 per page, within the 4,096 index ranges and the scheduling limit) and writes the missing records; the ship runs it once per deployment. `achievementsOf` adds the coin amounts (CO28).
- **Unlocks**: the schedule's `coins` entry ships with the new `coins` flag (`safeDefault: false`), declared beside the other flags, and takes CO13's wallet-only name and copy. The existing ship sweep and level-up readiness do the rest.
- **Feedback**: the Coins opening DM (CO16), the App Home balance (CO17), the reply's coins part through progression's one function (CO18), the quest and tier parts (CO19, CO20) and the hint predicate (CO21), each asking CO13 and the unlock state at delivery.
- **Commands (D17)**: no new command. `buyPerk` debits coins for an upgrade (CO24).
- **Lexicon**: declare **wallet** (a member's coins: earned on effects and reward records, minus what they spent, never below 0) and **upgrade** (a perk that replaces a perk the member owns with a stronger line, costing skill points and coins); amend **store** (it now sells kudos emoji and hedgehogs, and lists no cut items) and **perk** (no expression perks after the cut).
- **Coherence**: the wallet's component spec with the invariants "a member's balance equals their coin lines and reward coins minus their spends, and never goes below 0", "a purchase spends coins once per idempotency key", and "only the wallet writes the balance"; progression's spec gains "a giver pays a recipient receiving coins at most once a week, and a recipient gets at most 20 receiving coins a week", and its existing insert-only invariants cover the coin lines; "coins are dark where they aren't shown" as the gate's oracle.

## Testing Decisions

- **Good tests** enter at the highest seam and check what a member or another module can observe: the Slack calls made, the events published, the records and the balance another module reads. Never private helpers.
- **The Slack boundary** (signed events and interactivity through the HTTP router with `convex-test`, Slack stubbed at `fetch`):
  - a kudos that says why to two people shows `+8 🪙` once Coins is open, and nothing about coins before;
  - a second kudos to the same person that day earns no giving coins;
  - opening Coins sends CO16's DM with the waiting balance;
  - App Home's level line ends with the balance;
  - `Buy` on `flame` with and without enough coins and with Coins unopened;
  - a stale `Buy` with `coins` off writes nothing;
  - the whole slice dark with `coins` off, not created, the flags key missing, `xp-levels` off or `unlocks` off, and on for one member's email only.

  Prior art: `convex/slack/perkBonus.test.ts`, `skillTree.test.ts`, `skillTreeFlag.test.ts`, `gainsLine.test.ts`, `previewXpAndBoard.test.ts`.
- **The modules' internal functions**: receiving coins across two time zones and a Monday boundary, the cap at the tenth giver, a retried `kudosGiven` writing nothing twice, a quest drawn before and after the catalogue change, tier rewards at earning and through the backfill run twice, `walletOf`, `perksOf` and `achievementsOf` answers. Prior art: `convex/progression/progression.test.ts`, `effectsInsertOnly.test.ts`, `rewardsInsertOnly.test.ts`, `convex/quests/draw.test.ts`, `convex/achievements/replay.test.ts`.
- **The pure reducer**: CO2–CO4 and CO23 as table-driven tests over the progress function, with every perk combination. Prior art: `convex/progression/progress.test.ts`.
- **The wallet's invariant**: after any sequence of kudos, rewards and purchases, the cached balance equals the sum of coin lines and reward coins minus spends.
- **Limits**: the tier backfill under `testBackend({ transactionLimits: true })` with members holding all 28 tiers; scheduled functions counted under 1,000.

## Out of Scope

- Kudos emoji, the store, the collection, the loadout, `buyItem`, `equip` and `takeOff` (#31); hedgehogs (#96); the weekly reserve and `reservoir` (#35); `focus`, `echo`, their upgrades and Focus's switch-on (#39).
- The group quest's coins (#52) and the Journey's `your-emoji` coins (#31).
- A coin ledger or history read, and earned and spent totals: the website asked for the balance only.
- Coins for awards given before the deploy, or for chime-ins until chime-ins ship.
- Coin properties on PostHog events; a later ticket adds them to the progression events (#182's set).
- Primary groups for `bridge` (#52).

## Review

A GPT-6.1 Sol review (high) of the first draft found no blockers, 7 majors and 2 minors. Seven were fixed here, one is accepted as a documented race, and one was rejected:

1. **Major: no durable boundary for "before the deploy".** Fixed: the boundary is the record's first write, and the race of a few seconds is accepted (CO1).
2. **Major: the recipient's time zone at the award's time isn't stored.** Fixed: CO3 uses the directory's time zone when the record is written, with UTC as fallback.
3. **Major: the reply's coins can differ from the record's** when `treasurer` or `banker` is bought between them. Accepted and documented (CO18): the bonus parts have the same race today, and the record is the truth.
4. **Major: the skill tree's predicate reads workspace decisions, not the member's.** Narrowed: coin perks pay and sell by the skill tree's own predicate, whose move to the member decision belongs to the skill tree, and `skill-tree` is on for everyone in production (CO4). Coins themselves follow the member decision (CO13).
5. **Major: coin perks and prices showed before Coins was open (P76).** Fixed: "visible" means shown and open, and every coin mention, perk and price needs it (CO14, CO22, CO25, CO26, CO29).
6. **Major: the tier backfill had no completion barrier.** Fixed: the ship runs it to completion before `coins` goes on, and `achievementsOf` states `recordedAt` truthfully (CO7, CO28).
7. **Major: the Coins unlock promised the store and emoji slots.** Fixed: it is named `Coins` and opens the wallet and the coin perks until #31 (CO13).
8. **Minor: the extras order was ambiguous.** Fixed: the full order is stated and the example matches it (CO18).
9. **Minor: move `flame`, `cadence` and `bridge` to #39 to shrink the slice.** Rejected: #30's body ships them, the website's #295 waits on "#30 row 7", and they are one ticket of their own, so they never hold the wallet up.

## Further Notes

**The product owner's words this spec rests on.**

- Decision 12 (2026-10-13): "things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey", "can we reduce the skill tree to just a single tree?", "Let's lock that design in", corrected to "the onboarding journey is not cut, the rest is as stated". Coins, kudos emoji, hedgehogs, one skill tree and the Book are kept, and thoughtful kudos earn coins.
- Decision 11 (2026-10-13): "make sure that any new feature going to production, like leveling, the new website, etc. is behind a feature flag."
- Decision 18 (2026-10-14): "let's just turn them all on for everyone. I'm going to organically roll this out as we go. Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on. Let's go all in here."

**Calls taken at recommendation** (each recorded with `coherence decide`; ids in the resolution on #30):

1. **Coins are recorded dark from the deploy** (CO1), not from the moment the flag turns on. It mirrors XP and the Book, needs no per-member "coins shipped" moment, and makes switching coins on for everyone show real balances. P29's "no history before they ship" now means before the deploy.
2. **Tier coins are paid once by a silent backfill**, with no DM (CO7), run to completion before the flag goes on. P62 asks for one DM summary, but Coins is almost never open when it ships (only P77's or F22's opening of every shipped feature could open it, in a workspace or for a member that hadn't launched unlocks yet), and opening Coins already says what is waiting (CO16), so one silent path beats a DM that P76 would silence for nearly everyone.
3. **Tier reward records are keyed by reward ID**, not by tier (P87 amended), because a diamond tier promises coins now and a hedgehog later, and each needs its own once-only record.
4. **Coin perks need Coins open**, to be listed and to be bought (CO22, CO24), so nobody sees or spends a currency before they opened it (P76). This includes `treasurer`, which has no coin price but pays coins.
5. **The coin perks exist only where coins are visible** (CO22, P76, P78), and owned ones keep paying wherever the skill tree applies (CO25), like every perk.
6. **Receiving coins are counted per recipient week in the recipient's time zone**, first recorded giver wins, at most 10 givers (CO3). Order-independent totals beat a strict award-order replay.
7. **A wallet module with a cached balance and insert-only spends** (CO9–CO12), so every later purchase spends through one step and a read never sums history.
8. **No new D17 command.** `buyPerk` spends coins; `buyItem` waits for #31 under CO30's rule.
9. **`walletOf` answers the balance only** and stays its own read (the website conductor's answer).
10. **Quest and tier lines say their coins while coins are visible** (CO19, CO20), so a member sees where coins came from.
11. **The flag is `coins`** (#30's body, decision 11), on in the sandbox and for the product owner's email only (decision 18).
12. **The Coins unlock is named for what it holds now** (CO13): `Coins`, opening the wallet and the coin perks, until #31 adds the inventory.
13. **Coins are counted in the recipient's current time zone** (CO3), since the directory keeps no history.

**The website conductor's answer** (map #57, 2026-10-14): the contract fits its #283, #295, #297 and #287. `balance` alone is enough; `walletOf` stays a separate internal read that the website composes into its profile as `coins: number | null`; it maps the new refusals in #295.

**Casting.** The build tickets run on Opus 5.5 (high); reviews on GPT-6.1 Sol (high).
