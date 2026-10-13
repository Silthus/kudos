# Progression economy rerun: prices and strengths for the progression spec

2026-10-13 · Ticket [#13](https://github.com/Silthus/kudos/issues/13) · **Synthetic archetypes only. No real usage data went in.**

Grilling [#9](https://github.com/Silthus/kudos/issues/9) changed four things the [balance research](https://github.com/Silthus/kudos/blob/research/progression-economy/research/progression-balance.md) had rejected or not modelled: the store sells **XP boosters**, **upgrades cost skill points plus coins**, members earn **coins for receiving**, and **chime-ins** exist. It asked for one rerun that sets every price and strength. This is that rerun, revision 3 of the research's model.

## Reproduce

```sh
node research/simulations/rerun.mts   # writes research/simulations/rerun-output.json, ~45 s
```

[`rerun.mts`](simulations/rerun.mts) imports the research's unchanged [`model.mts`](simulations/model.mts) (archetypes, perks, the XP curve, the pseudo-random drop solver) and replaces `run.mts`'s `simulate` with revision 3. Two runs give the same file byte for byte (`sha256 b8267235…`). Same horizon as the research: 546 local dates, 2027-01-04 to 2028-07-02, nine synthetic archetypes, the named builds, gate on unless marked. Sweeps use 6 seeds; the final table uses 24.

## What revision 3 changes

| Mechanic | Rule simulated |
|---|---|
| Qualifying recognition | The first thoughtful award to each recipient per giver-local date (unchanged). Every bonus, coin and drop fires only on one. |
| Giving coins | 4 per qualifying recognition (unchanged). |
| Receiving coins | 2 per distinct giver who thoughtfully thanked you this week. Chime-ins on a kudos that thanks you count as givers. |
| XP booster | Store item, +25% of the award's base giver XP on qualifying recognitions, rounded half up (one kudos: +3 XP), 7 days from activation, one at a time. XP-shopper builds buy one each active week unless they are saving coins for their next perk. |
| Upgrades | The second tier of a branch (Flame, Cadence, Spotlight, Bridge, `Resonance`, Reservoir, Fortune) costs its skill points plus coins. A build saves for it rather than skipping ahead. |
| Expression perks | Signature, Keepsake and Gallery cost coins only, no skill points. |
| Chime-ins | Members chime in with leftover allowance after their own kudos (daily, then reserve if thoughtful). Each chime-in is a one-kudos award: base XP, coins, drops and perks like any qualifying recognition. Final crowd sizes are geometric with a 2% chance of an 8× "big moment". Thresholds 3/5/10/20/50/100 give the giver and every chime-in a Crowd booster for the next giving date, and the recipients bonus XP for every threshold reached. |
| Chime-in volume | In a closed workspace chime-ins made equal chime-ins received. With ~2.5 kudos given per member per day, a typical message draws ~0.2 chime-ins. The min-maxer stands in for a chime-in ring (1.5 per own message). |

The first calibration pass used 1–2 chime-ins per message and sent the popular receiver to level 49; that breaks the closed-network balance above, so it was discarded.

## Prices and strengths

| Item | Value | Why (sweep evidence below) |
|---|---:|---|
| XP booster | **120 coins**, +25%, 7 days | Same price as a common cosmetic, so it is a weekly choice between XP and expression. Buying one every week a member can afford it adds at most **5.7%** XP (steady, holiday) with the gate on, 7.9% with it off. At 60 coins the uplift reaches 10.6%. |
| Flame, Fortune, Bridge upgrades | **150 coins** + skill points | Scale 1: a steady giver waits ~1 week after the skill points are ready, burst and part-time ~2.5 weeks, quiet ~4. Scale 1.5 doubles the waits. |
| Spotlight, `Resonance` upgrades | **200 coins** + skill points | Same scale. |
| Cadence upgrade | **300 coins** + skill points | Same scale. |
| Reservoir upgrade | **350 coins** + skill points | The capacity upgrade is the most expensive, since coins → capacity is the route Michael accepted with care. |
| Signature | **120 coins** | One named common cosmetic, priced as one. |
| Keepsake | **300 coins** | Up to 12 chosen cosmetics, at least 28 dates apart. |
| Gallery | **450 coins** (needs Signature) | Three named cosmetics, below three uncommon prices. |
| Streak freeze | **60 coins** | Unchanged from the research. |
| Discovery Lantern | **180 coins**, drops +25%, 7 days | Unchanged. |
| Cosmetics by rarity | **120 / 300 / 700 / 1,500 / 3,000** | Unchanged. |
| Crowd booster by tier (3/5/10/20/50/100) | **+10 / 15 / 20 / 30 / 40 / 50%** of base giver XP, 24 hours | The "gentle" set. Crowd XP stays under 2% of total XP for every archetype and 4.7% for a chime-in ring; the "strong" set (+25…150%) doubles the ring to 10%. |
| Recipient bonus XP per threshold | **5 / 10 / 20 / 40 / 80 / 160** | Paid once per threshold reached, so a kudos reaching 10 chime-ins pays 35 in total. |

The Crowd booster is the only booster nobody buys or chooses. It adds to the XP booster (+25%) and never compounds.

## Final results (gate on, 24 seeds)

| Archetype | Best build | XP / level | No-perk level | XP-build spread | XP booster uplift | Crowd share of XP | Wait for an upgrade (days) | Coins a week (no perks) | From receiving |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Steady | Receiver + boosters | 31,380 / 26.0 | 19.0 | 15.5% | 5.7% | 0.6% | 7.6 | 66.5 | 27% |
| Burst | Burst + boosters | 17,029 / 19.5 | 13.9 | 32.9% | 1.5% | 0.5% | 18.4 | 32.1 | 28% |
| Popular | Receiver + boosters | 51,146 / 33.0 | 25.7 | 44.8% | 1.2% | 1.9% | 5.4 | 89.2 | **81%** |
| Part-time | Steady + boosters | 13,977 / 18.0 | 14.0 | 16.4% | 1.3% | 0.6% | 18.8 | 33.2 | 33% |
| New hire | Social + boosters | 16,770 / 19.2 | 15.0 | 23.2% | 2.9% | 0.8% | 10.2 | 54.1 | 33% |
| Holiday | Receiver + boosters | 26,858 / 24.0 | 18.0 | 15.8% | 5.6% | 0.7% | 8.7 | 57.8 | 27% |
| Swapper | Hybrid + boosters | 22,353 / 22.0 | 20.0 | 12.4% | 0.2% | 0% | 89.5 | 9.5 | 19% |
| Min-maxer (chime-in ring) | Receiver + boosters | 47,307 / 31.9 | 24.0 | 15.3% | 3.9% | 4.8% | 5.7 | 74.9 | 50% |
| Quiet | Hybrid, cosmetics | 7,165 / 13.0 | 10.3 | 20.7% | −0.9% | 0.4% | 29.5 | 18.5 | 46% |

- **Five different builds win** across the nine archetypes (Receiver, Burst, Steady, Social, Hybrid). The finding "no pick order wins for every kind of member" still holds.
- **Receiver got stronger.** Chime-ins on kudos that thank you bring new distinct givers, and Echo/`Resonance` pay per distinct giver a week. Receiver now wins for steady, holiday and the min-maxer by 1–5%. This is a measured spread, not a broken build; it is listed below because it also feeds the popular receiver.
- **XP boosters are a mild accelerator.** Members who buy one every week they can afford it gain 1–6%. Quiet members can't afford them and lose nothing for it.
- **Coins slow abuse down.** The swapper (two people trading kudos with few thoughtful notes) earns 9.5 coins a week and waits ~13 weeks for each upgrade.
- **The gate still matters.** With the gate off the swapper's best XP rises from 22,353 to 28,067, as in the research.

## Open findings for Michael

1. **Receiving coins make popular receivers the richest members.** A popular receiver earns 89 coins a week, 81% from receiving, against 66 for a steady giver. The research had removed receiving coins for this reason ("popularity must not buy the store"). A cap of **10 distinct givers a week (20 coins)** brings the popular receiver to 37 a week and the chime-in ring from 74 to 57, and leaves the other seven archetypes within 1.5% of uncapped; a cap of 20 givers (40 coins) gives the popular receiver 57 a week. **Recommendation: cap receiving coins at 20 a week.**
2. **Receiver is now the most common winner.** Not a balance break (spread 1–5%), and `Resonance` costs coins now. **Recommendation: accept, and revisit with real data.**
3. **Popular receivers level fastest** (level 33 at ~18 months against 26 for a steady giver), because received kudos and chime-ins carry base XP. Progression is not a performance measure and the leaderboard counts kudos, so **recommendation: accept.**

## Limits

Same limits as the research: member-local dates, no closed network, no time zones or daylight saving, no concurrency, synthetic behaviour. Chime-in volumes and crowd sizes are assumptions; the closed-network argument bounds their mean, not their shape. Group auras are not re-simulated. Drop rates and pool sizes are unchanged.
