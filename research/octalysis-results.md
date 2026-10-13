# Synthetic simulation results

Generated with `bun research/octalysis-simulation.ts`. Candidate = literal per-award Rhythm/Treasurer, one reroll; bounded = P16 bonus limits and feasibility filtering. Both still use the five-word gate and unchanged base XP. All numbers are synthetic, not product analytics. The proposed Journey gives no additional numerical rewards.

| Persona | Mode | L2/L3/L4/L5/L6/L7/L8 weeks | Final level | XP (base / perks / quests) | Coins earned / balance | Impossible initial offers | Unfinished group weeks |
|---|---|---|---:|---|---|---:|---:|
| new-member | candidate | 1/1/1/2/4/5/6 | 30 | 41974 (8380/15794/17800) | 10787/8887 | 43 | 69 |
| new-member | bounded | 1/1/1/2/4/5/6 | 30 | 41974 (8380/15794/17800) | 10787/8887 | 0 | 69 |
| thoughtful-giver | candidate | 1/1/1/2/3/4/5 | 35 | 58961 (14620/25561/18780) | 15599/13699 | 78 | 69 |
| thoughtful-giver | bounded | 1/1/1/2/3/4/5 | 36 | 60414 (14660/25714/20040) | 15966/14066 | 0 | 69 |
| quiet-receiver | candidate | 1/4/10/20/34/50/70 | 9 | 3320 (3120/150/50) | 820/620 | 54 | 104 |
| quiet-receiver | bounded | 1/4/10/20/34/50/70 | 9 | 3320 (3120/150/50) | 820/620 | 0 | 104 |
| optimiser | candidate | 1/1/2/2/4/5/6 | 33 | 51167 (25900/17807/7460) | 11095/9195 | 54 | 104 |
| optimiser | bounded | 1/1/2/2/3/4/6 | 30 | 43358 (25720/9368/8270) | 6577/4677 | 0 | 104 |
| small-group | candidate | 1/1/2/3/5/6/9 | 26 | 31604 (8380/9914/13310) | 8836/6936 | 156 | 104 |
| small-group | bounded | 1/1/1/2/4/5/7 | 28 | 35739 (8680/9929/17130) | 9497/7597 | 0 | 104 |
| no-groups | candidate | 1/1/2/3/4/5/6 | 31 | 45425 (14240/17795/13390) | 13974/12074 | 156 | 0 |
| no-groups | bounded | 1/1/1/2/3/4/5 | 33 | 49998 (14440/18348/17210) | 15195/13295 | 0 | 0 |

Candidate and bounded both permit padding and reciprocal base-XP farming. These interventions contain bonus extraction, not sincerity. Quiet receivers reach L8 on received XP while the proposed giving Journey remains incomplete. Every run reaches L8; later levels, limited skill points and permanent builds appear in the trace. No baseline chime-ins are generated; their full controlled boundary scenarios are in the report.

[Weekly state for every run](octalysis-weekly.tsv) · [Every milestone/claim/purchase/Journey step](octalysis-trace.md)
