# Synthetic simulation results

Generated with `bun research/octalysis-simulation.ts`. Candidate = literal per-award Rhythm/Treasurer/Focus, one reroll; bounded = P16 bonus limits and feasibility filtering. Both still use the five-word gate and unchanged base XP. All numbers are synthetic, not product analytics. The proposed Journey gives no additional numerical rewards.

| Persona | Mode | L2/L3/L4/L5/L6/L7/L8 weeks | Final level | XP (base / perks / quests) | Coins earned / balance | Impossible initial offers | Unfinished group weeks |
|---|---|---|---:|---|---|---:|---:|
| new-member | candidate | 1/1/1/2/4/5/6 | 30 | 43066 (8380/15856/18830) | 11067/9167 | 67 | 69 |
| new-member | bounded | 1/1/1/2/4/5/6 | 31 | 43831 (8400/15901/19530) | 11258/9358 | 0 | 69 |
| thoughtful-giver | candidate | 1/1/1/2/3/4/5 | 35 | 58861 (14580/25501/18780) | 15567/13667 | 78 | 69 |
| thoughtful-giver | bounded | 1/1/1/2/3/4/5 | 36 | 60280 (14600/25640/20040) | 15918/14018 | 0 | 69 |
| quiet-receiver | candidate | 1/4/10/20/34/50/70 | 9 | 3320 (3120/150/50) | 820/620 | 54 | 104 |
| quiet-receiver | bounded | 1/4/10/20/34/50/70 | 9 | 3320 (3120/150/50) | 820/620 | 0 | 104 |
| optimiser | candidate | 1/1/2/2/4/5/6 | 33 | 51111 (25860/17791/7460) | 11079/9179 | 54 | 104 |
| optimiser | bounded | 1/1/2/2/3/4/6 | 30 | 43313 (25680/9363/8270) | 6577/4677 | 0 | 104 |
| small-group | candidate | 1/1/2/4/5/7/10 | 26 | 30091 (8200/9661/12230) | 8458/6558 | 156 | 104 |
| small-group | bounded | 1/1/1/2/4/5/7 | 28 | 35665 (8620/9915/17130) | 9489/7589 | 0 | 104 |
| no-groups | candidate | 1/1/2/3/4/5/7 | 31 | 44126 (14160/17656/12310) | 13600/11700 | 156 | 0 |
| no-groups | bounded | 1/1/1/2/3/4/5 | 33 | 49942 (14400/18332/17210) | 15163/13263 | 0 | 0 |

Candidate and bounded both permit padding and reciprocal base-XP farming. These interventions contain bonus extraction, not sincerity. Quiet receivers reach L8 on received XP while the proposed giving Journey remains incomplete. Every run reaches L8; later levels, limited skill points and permanent builds appear in the trace. No baseline chime-ins are generated; their controlled boundary scenarios are in the trace and report.

[Weekly state for every run](octalysis-weekly.tsv) · [Every milestone/claim/purchase/Journey step](octalysis-trace.md)
