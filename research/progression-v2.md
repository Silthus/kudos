# Progression economy rerun after the scope cut

2026-10-13 · Ticket [#86](https://github.com/Silthus/kudos/issues/86) · **Synthetic archetypes only. No real usage data went in.**

Michael cut the game to its core loop (map #1, decision 12). This rerun, revision 4 of the [balance research](https://github.com/Silthus/kudos/blob/research/progression-economy/research/progression-balance.md), sets the numbers in the [revised spec](../spec/progression.md): skill points from level 5, the 14-perk tree, quest and Journey rewards, achievement tier coins, and the store.

## Reproduce

```sh
node research/simulations/progression-v2.mts   # writes research/simulations/progression-v2-output.json, ~3 s
```

Two runs give the same file byte for byte. Same horizon and archetypes as the research: 546 local dates from 2027-01-04, nine synthetic archetypes, 12 seeds. Each archetype plays five builds plus no perks, and the table shows its best build.

## What revision 4 models

| Mechanic | Rule simulated |
|---|---|
| Gone | Boosters, drops, rarities, auras, streaks, freezes, expression perks. |
| Skill points | One per level from level 5 (P4). |
| The tree | P18's 14 perks: rows at 5, 7, 9 and 12, upgrades costing coins. |
| Coins | 4 per qualifying recognition, `treasurer` +2 or `banker` +4, 2 per distinct thoughtful giver a week (cap 20), quests, the Journey, bronze 10 and diamond 100. Earned from level 1. |
| Quests | 3 personal a week from level 2, each finished with the archetype's own chance; a group quest finished 55% of weeks. |
| The Journey | P89's seven steps, each when its level is reached. |
| Achievements | Seven ladders that count giving data; tier coins only. |
| Store | Kudos emoji at 100 from level 6, then five hedgehogs at 120 / 300 / 700 / 1,500 / 3,000 from level 7, bought when no upgrade is waiting for coins. |

## Results (tuned perks, quests at 25 XP)

Days to a level count from the member's first day. XP and coin shares are percentages.

| Archetype | Best build | Level at 18 months | No-perk level | Build spread | Days to level 2 / 3 / 4 / 5 / 6 / 7 / 12 | XP: base / perks / quests / Journey | Coins a week | Coins: giving / receiving / perks / quests / tiers | Coins when Coins opens | Upgrade wait (days) | First store hedgehog (day) | Coins left |
|---|---|---:|---:|---:|---|---|---:|---|---:|---:|---:|---:|
| Steady | steady | 26.2 | 21.2 | 28.1% | 0 / 1 / 7 / 14 / 22 / 32 / 106 | 46 / 35 / 18 / 1 | 119 | 42 / 10 / 15 / 26 / 7 | 359 | 0 | 35 | 2,293 |
| Burst | burst | 20.2 | 16.2 | 21.2% | 2 / 4 / 14 / 25 / 39 / 58 / 210 | 46 / 29 / 24 / 1 | 76 | 35 / 9 / 15 / 32 / 8 | 358 | 0 | 67 | 1,816 |
| Popular | receiver | 27.3 | 23.3 | 29.3% | 0 / 1 / 4 / 11 / 21 / 29 / 101 | 59 / 27 / 14 / 1 | 69 | 18 / 29 / 7 / 37 / 10 | 187 | 10 | 29 | 1,546 |
| Part-time | steady | 19.0 | 16.0 | 19.5% | 0 / 4 / 14 / 28 / 42 / 63 / 200 | 41 / 31 / 27 / 1 | 59 | 34 / 12 / 7 / 41 / 6 | 356 | 7 | 63 | 596 |
| New hire | social | 19.9 | 16.3 | 23.9% | 0 / 3 / 10 / 18 / 28 / 40 / 137 | 43 / 32 / 23 / 1 | 89 | 34 / 14 / 9 / 35 / 7 | 344 | 0 | 45 | 1,206 |
| Holiday | steady | 25.0 | 20.3 | 26.5% | 0 / 2 / 7 / 14 / 22 / 31 / 119 | 45 / 34 / 20 / 1 | 109 | 40 / 10 / 13 / 29 / 8 | 364 | 0 | 35 | 1,477 |
| Swapper | burst | 22.1 | 20.7 | 7.4% | 0 / 2 / 8 / 16 / 28 / 42 / 148 | 84 / 9 / 7 / 0 | 28 | 15 / 26 / 7 / 32 / 20 | 120 | 23 | 85 | 340 |
| Min-maxer | steady | 28.8 | 23.0 | 13.0% | 0 / 1 / 4 / 10 / 18 / 28 / 98 | 48 / 34 / 17 / 1 | 128 | 38 / 13 / 14 / 27 / 8 | 323 | 0 | 28 | 2,977 |
| Quiet | social | 14.1 | 12.3 | 16.2% | 1 / 7 / 23 / 44 / 73 / 109 / 368 | 39 / 24 / 35 / 3 | 34 | 21 / 17 / 1 / 50 / 10 | 369 | 0 | 113 | 310 |

- **The unlock schedule paces well.** Most members open the leaderboard in their first days, the skill tree in their second or third week, and hedgehogs within a month or two. A quiet member reaches the skill tree in about six weeks and hedgehogs in about four months.
- **Four builds win** (steady, burst, receiver, social), so no pick order wins for every kind of member.
- **Coins wait for level 6.** Most members open Coins with 320–370 coins: the first emoji and the first hedgehog right away. The popular receiver opens with 187, because receiving coins are capped.
- **Upgrades rarely wait for coins.** Skill points, not coins, pace the tree. Coins pace the store.
- **Abuse stays slow.** The swapper earns 28 coins a week, waits 23 days for an upgrade, and gets 9% of their XP from perks.

## Calibration sweeps

**Perk strengths.** At the prototype's values (`flame` +10, `cadence` +4, `bridge` +10, `echo` +3, `resonance` +8) perks made 41% of a steady giver's XP, with a 36% spread between builds. The tuned values in P18 bring that to 35% and a 28% spread, and add `social` as a winning build.

| Perk share of XP | Steady | Burst | Popular | Part-time | New hire | Holiday | Swapper | Min-maxer | Quiet |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Prototype values | 41.4 | 31.3 | 34.5 | 36.4 | 38.3 | 40.0 | 13.0 | 40.5 | 28.4 |
| Tuned (P18) | 35.4 | 29.3 | 26.9 | 30.6 | 32.2 | 34.0 | 9.0 | 34.3 | 24.1 |

**Quest XP.** The prototype's mock rewards were 40–90 XP. The share of XP from quests, by personal quest XP (the group quest gets 5 more):

| Quest XP | Steady | Burst | Popular | Part-time | New hire | Holiday | Swapper | Min-maxer | Quiet |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15 | 11.8 | 16.6 | 8.8 | 19.3 | 16.0 | 13.5 | 4.4 | 11.0 | 25.6 |
| **25** | **17.5** | **23.7** | **13.6** | **27.1** | **23.4** | **20.2** | **6.6** | **16.7** | **34.5** |
| 40 | 24.9 | 31.0 | 19.6 | 36.7 | 32.3 | 28.2 | 9.7 | 24.4 | 43.5 |
| 60 | 33.4 | 39.4 | 26.7 | 45.7 | 41.7 | 36.5 | 13.6 | 32.3 | 53.0 |

25 XP keeps giving the main source of XP for every archetype except the quiet member, whose quests ask for exactly the behaviour the game exists for.

## Open findings

1. **Coins pile up at the top.** A steady giver who bought every perk and store item holds about 2,300 coins after 18 months. **Recommendation: accept.** Coins can't be traded or turned into kudos, so a pile harms nothing; new hedgehogs are the planned sink.
2. **Quests are a third of a quiet member's XP and half their coins.** **Recommendation: accept**, and let the Octalysis walk-through (#85) check it.
3. **Quests are about a quarter to two fifths of everyone's coins.** They're the second coin source after giving. **Recommendation: accept**; quest coins reward breadth and thoughtfulness, which giving coins also reward.

## Limits

Same limits as the research: member-local dates, no closed network, no time zones or daylight saving, no concurrency, synthetic behaviour. Quest completion is a per-archetype chance, not a model of each goal. Chime-ins aren't simulated: without the crowd booster they add only base XP and the recipient's threshold XP, which the first rerun measured at under 2%. Achievement ladders that need chime-ins or groups aren't counted.
