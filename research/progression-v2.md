# Progression economy rerun after the scope cut

2026-10-13 · Ticket [#86](https://github.com/Silthus/kudos/issues/86) · **Synthetic archetypes only. No real usage data went in.**

**Revision 5 (#97, 2026-10-13)** takes the Octalysis walk-through's findings ([#85](https://github.com/Silthus/kudos/issues/85), report on `research/octalysis` at `f0b786f`): a personal quest pays 20 XP instead of 25, the group quest pays no XP, and the Journey drops its two steps that paid for spending a skill point and equipping a hedgehog. Every table below is revision 5; the [spec](../spec/progression.md) carries the numbers.

Michael cut the game to its core loop (map #1, decision 12). This rerun, revision 4 of the [balance research](https://github.com/Silthus/kudos/blob/research/progression-economy/research/progression-balance.md), sets the numbers in the [revised spec](../spec/progression.md): skill points from level 5, the 14-perk tree, quest and Journey rewards, achievement tier coins, and the store.

## Reproduce

```sh
node research/simulations/progression-v2.mts   # writes research/simulations/progression-v2-output.json, ~3 s
```

Two runs give the same file byte for byte. Revision 4.1 fixes two bugs a review found in the first run: an unthoughtful kudos no longer hides a later qualifying recognition to the same person that day, and Focus charges end with their day (P16, P22). Same horizon and archetypes as the research, plus a colluding pair: 546 local dates from 2027-01-04, ten synthetic archetypes, 12 seeds. The colluding pair is two colleagues who thank only each other every workday, always thoughtfully; with one partner they can finish only the thoughtfulness quests. Each archetype plays five builds plus no perks, and the table shows its best build.

## What revision 4 models

| Mechanic | Rule simulated |
|---|---|
| Gone | Boosters, drops, rarities, auras, streaks, freezes, expression perks. |
| Skill points | One per level from level 5 (P4). |
| The tree | P18's 14 perks: rows at 5, 7, 9 and 12, upgrades costing coins. |
| Coins | 4 per qualifying recognition, `treasurer` +2 or `banker` +4, 2 per distinct thoughtful giver a week (cap 20), quests, the Journey, bronze 10 and diamond 100. Earned from level 1. |
| Quests | 3 personal a week from level 2 at 20 XP and 10 coins, each finished with the archetype's own chance; a group quest at 15 coins and no XP, finished 55% of weeks. |
| The Journey | P89's five steps, each when its level is reached. |
| Achievements | Seven ladders that count giving data; tier coins only. |
| Store | Kudos emoji at 100 from level 6, then five hedgehogs at 120 / 300 / 700 / 1,500 / 3,000 from level 7, bought when no upgrade is waiting for coins. |

## Results (tuned perks, quests at 20 XP, group quest at no XP)

Days to a level count from the member's first day. XP and coin shares are percentages.

| Archetype | Best build | Level at 18 months | No-perk level | Build spread | Days to level 2 / 3 / 4 / 5 / 6 / 7 / 12 | XP: base / perks / quests / Journey | Coins a week | Coins: giving / receiving / perks / quests / tiers | Coins when Coins opens | Upgrade wait (days) | First store hedgehog (day) | Coins left |
|---|---|---:|---:|---:|---|---|---:|---|---:|---:|---:|---:|
| Steady | steady | 25.3 | 20 | 29.5% | 0 / 1 / 7 / 14 / 24 / 36 / 119 | 50 / 38 / 12 / 0 | 119 | 42 / 10 / 14 / 26 / 7 | 403 | 0 | 37 | 2,261 |
| Burst | burst | 18.5 | 15 | 17.6% | 2 / 4 / 15 / 29 / 52 / 73 / 252 | 53 / 30 / 16 / 1 | 73 | 36 / 9 / 15 / 32 / 8 | 440 | 0 | 84 | 1,604 |
| Popular | receiver | 26.3 | 22.5 | 30.9% | 0 / 1 / 4 / 11 / 22 / 32 / 116 | 63 / 28 / 8 / 0 | 69 | 18 / 29 / 6 / 37 / 10 | 244 | 10 | 32 | 1,486 |
| Part-time | steady | 18 | 14.9 | 22.9% | 0 / 4 / 14 / 30 / 51 / 74 / 238 | 47 / 34 / 18 / 1 | 59 | 34 / 12 / 5 / 42 / 6 | 426 | 0 | 77 | 560 |
| New hire | steady | 19 | 15 | 26.7% | 0 / 3 / 10 / 20 / 35 / 52 / 157 | 48 / 35 / 16 / 1 | 87 | 35 / 14 / 7 / 36 / 8 | 413 | 0 | 52 | 872 |
| Holiday | steady | 24 | 19.1 | 28.6% | 0 / 2 / 7 / 15 / 25 / 37 / 133 | 49 / 37 / 14 / 0 | 108 | 41 / 10 / 12 / 29 / 8 | 407 | 0 | 38 | 1,372 |
| Swapper | steady | 21.2 | 20 | 5.1% | 0 / 2 / 8 / 17 / 29 / 44 / 155 | 86 / 13 / 1 / 0 | 31 | 22 / 24 / 6 / 30 / 18 | 138 | 18 | 165 | 492 |
| Min-maxer | steady | 27.8 | 22.1 | 14.8% | 0 / 1 / 4 / 11 / 21 / 31 / 105 | 52 / 36 / 12 / 0 | 128 | 38 / 13 / 14 / 27 / 8 | 454 | 2 | 35 | 2,937 |
| Quiet | social | 12.3 | 10.8 | 15.1% | 1 / 8 / 28 / 63 / 105 / 148 / 477 | 51 / 27 / 20 / 2 | 33 | 22 / 18 / 0 / 50 / 10 | 485 | 0 | 154 | 436 |
| Colluding pair | steady | 23 | 20.6 | 7.9% | 0 / 1 / 7 / 15 / 25 / 38 / 133 | 74 / 20 / 6 / 0 | 52 | 39 / 4 / 12 / 35 / 11 | 183 | 18 | 42 | 764 |

- **The unlock schedule paces well.** Most members open the leaderboard in their first days, the skill tree in their second or third week, and hedgehogs within a month or two. A quiet member reaches the skill tree in about nine weeks and hedgehogs in about five months (six weeks and four months in revision 4, when quests paid more).
- **Four builds win** (steady, burst, receiver, social), so no pick order wins for every kind of member.
- **Collusion pays less than breadth.** The colluding pair earns 52 coins a week against 119 for a steady giver, because coins and most perks pay once per recipient a day and receiving coins once per giver a week. It waits 18 days for an upgrade and gets 20% of its XP from perks.
- **Coins wait for level 6.** Most members open Coins with 400–490 coins: the first emoji and the first hedgehog right away. The popular receiver opens with 244, because receiving coins are capped.
- **Upgrades rarely wait for coins.** Skill points, not coins, pace the tree. Coins pace the store.
- **Abuse stays slow.** The swapper (mostly quick, unthoughtful kudos) earns 31 coins a week, waits 18 days for an upgrade, and gets 13% of its XP from perks.

## Calibration sweeps

**Perk strengths.** At the prototype's values (`flame` +10, `cadence` +4, `bridge` +10, `echo` +3, `resonance` +8) perks made 44% of a steady giver's XP, with a 38% spread between builds. The tuned values in P18 bring that to 38% and a 30% spread.

| Perk share of XP  Steady | Burst | Popular | Part-time | New hire | Holiday | Swapper | Min-maxer | Quiet | Colluding pair |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Prototype values | 43.9 | 38.2 | 36.3 | 39.5 | 40.9 | 42.6 | 16.4 | 42.6 | 31.3 | 23.8 |
| Tuned (P18) | 37.7 | 30.3 | 28.3 | 33.9 | 34.9 | 36.6 | 12.7 | 36.1 | 27 | 19.8 |

**Quest XP.** The prototype's mock rewards were 40–90 XP. The share of XP from quests, by personal quest XP, with the group quest at no XP:

| Quest XP  Steady | Burst | Popular | Part-time | New hire | Holiday | Swapper | Min-maxer | Quiet | Colluding pair |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15 | 9.2 | 12.6 | 6.4 | 14.5 | 12.9 | 10.4 | 0.8 | 9 | 16 | 4.8 |
| **20** | **11.8** | **15.6** | **8.4** | **18.4** | **16.1** | **13.6** | **1.1** | **11.6** | **20.1** | **6.3** |
| 25 | 14.4 | 18.8 | 10.3 | 21.8 | 19.5 | 16.3 | 1.4 | 14.1 | 23.2 | 7.8 |
| 40 | 20.9 | 26.1 | 15.4 | 30.4 | 27.6 | 23.5 | 2.2 | 20.5 | 32.7 | 12 |
| 60 | 28.4 | 34.1 | 21.4 | 39 | 36.3 | 31.8 | 3.3 | 28 | 41.3 | 17 |

**Quest budgets (revision 5).** #85 found that the prototype's quests could pay 240 XP a week against 150 base XP for spending the whole allowance, and proposed at most 20 XP a personal quest and no XP for group or teaching tasks. Revision 4's 25 XP and 30 for the group quest already cut that to 105 a week; revision 5 tests #85's budget. Base XP share / quest XP share by archetype, and the quiet member's days to level 5:

| Personal / group XP | Steady | Burst | Popular | Part-time | New hire | Holiday | Swapper | Min-maxer | Quiet | Colluding pair | Quiet: days to 5 |
|---|---|---|---|---|---|---|---|---|---|---|---:|
| 25 / 30 (revision 4) | 46.4 / 17.9 | 47 / 24.1 | 59.2 / 13.6 | 41 / 27.7 | 43.3 / 23.8 | 45.2 / 20.2 | 81 / 7 | 48.5 / 16.9 | 39.6 / 34.8 | 69 / 12.4 | 44 |
| 20 / 30 | 47.7 / 15.6 | 48.9 / 21.6 | 60.4 / 11.8 | 42.7 / 24.9 | 45.3 / 20.7 | 46.9 / 17.5 | 81.2 / 6.7 | 49.8 / 14.7 | 41.4 / 32.5 | 70 / 11.1 | 49 |
| 25 / 0 | 48.5 / 14.4 | 51 / 18.8 | 61.5 / 10.3 | 44.9 / 21.8 | 46 / 19.5 | 47.6 / 16.3 | 85.8 / 1.4 | 50.2 / 14.1 | 48.5 / 23.2 | 72.6 / 7.8 | 56 |
| **20 / 0 (revision 5)** | **50.1 / 11.8** | **53.2 / 15.6** | **62.9 / 8.4** | **46.8 / 18.4** | **48.1 / 16.1** | **49.2 / 13.6** | **86.1 / 1.1** | **51.9 / 11.6** | **50.9 / 20.1** | **73.8 / 6.3** | **63** |

At 20 / 0, base XP is the largest source of XP for every archetype by a clear margin, the quiet member included (51% base against 20% quests; at 25 / 30 it was 40 against 35). The group quest's XP was the one income a member got for what others did: the swapper, who finishes almost no personal quest, got 7% of its XP from it. The price is pace for the quiet member, who reaches the skill tree in 63 days instead of 44. That's accepted: unlocks never gate earning (ADR-0005), and the quiet member's coins still come half from quests.

## Open findings

1. **Coins pile up at the top.** A steady giver who bought every perk and store item holds about 2,260 coins after 18 months. **Recommendation: accept.** Coins can't be traded or turned into kudos, so a pile harms nothing; new hedgehogs are the planned sink.
2. **Quests are a fifth of a quiet member's XP and half their coins** (a third of their XP in revision 4). **Settled on #97:** #85 checked it, and revision 5 lowers quest XP so base XP leads for everyone; quest coins stay.
3. **Quests are about a quarter to two fifths of everyone's coins.** They're the second coin source after giving. **Recommendation: accept**; quest coins reward breadth and thoughtfulness, which giving coins also reward.

## Limits

Same limits as the research: member-local dates, no closed network, no time zones or daylight saving, no concurrency, synthetic behaviour. Quest completion is a per-archetype chance, not a model of each goal. Chime-ins aren't simulated: without the crowd booster they add only base XP (revision 5 also drops the recipient's threshold XP, which the first rerun measured at under 2%). Achievement ladders that need chime-ins or groups aren't counted.
