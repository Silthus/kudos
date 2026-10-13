# Kudos progression balance and target economy

2026-10-13 · **Proposal, not an approved spec. All behaviour and numbers are synthetic.**

This replaces the perk numbers, daily extra allowance, bonus XP caps and drop rules in [the prior research](octalysis-progression.md). Keep its nine four-tier achievement ladders, exclusive cosmetic rewards, retroactivity, permanent awards, voluntary schedules/pauses and privacy controls. Achievements grant cosmetics only. Nothing here changes the locked XP curve.

**Recommend:** four coins per distinct thoughtful recipient per date; weekly reserve of +2, upgraded to +4, with a non-stacking team +1; additive uncapped bonus XP; automatic free PRD drops; deterministic store alternatives. The final simulation has different XP winners across behaviours, both with and without the thoughtful gate. This is evidence against a universal pick order, not proof that every possible build is equally good.

## Evidence and reproduction

| Artifact | What it contains |
|---|---|
| [model.mts](simulations/model.mts) | Final prices, perk prerequisites/costs, synthetic archetypes, XP thresholds, PRD solver |
| [run.mts](simulations/run.mts) | Daily simulation, three revisions, named builds, additional pick-order search and sensitivities |
| [summary.json](simulations/summary.json) | All 486 scenario aggregates, PRD constants, team-owner/allowance/quality sensitivities |
| [runs.jsonl](simulations/runs.jsonl) | All 11,664 named-build run endpoints, including coins, sinks, rarity counts, streaks and allowance use |
| [monthly.jsonl](simulations/monthly.jsonl) | 8,964 month-end snapshots for representative seed 1001, all revisions/scenarios |
| [monthly-summary.json](simulations/monthly-summary.json) | Final month-end means across all 24 seeds, each build/archetype/gate |
| [order-search.json](simulations/order-search.json) | 96 additional prerequisite-valid XP pick orders; 6,912 runs over four seeds |
| [analysis-tables.md](simulations/analysis-tables.md) | Full derived tables, including both gate modes, all sink splits and search winners |
| [validation-output.json](simulations/validation-output.json) | Ledger/curve/budget checks and ten million empirical PRD draws |
| [determinism-output.json](simulations/determinism-output.json) | Byte-for-byte rerun hashes and report/result consistency check |
| [run-output.json](simulations/run-output.json), [validation-log.json](simulations/validation-log.json) | Raw console output |

Run from the repo root with Node 24; no dependencies or package changes. Standalone TypeScript ESM uses `.mts`, outside the repository’s `**/*.ts` application compilation pattern:

```sh
node research/simulations/run.mts > research/simulations/run-output.json
node research/simulations/validate.mts > research/simulations/validation-log.json
node research/simulations/analyze.mts
node research/simulations/verify-artifacts.mts
```

Sequential commands matter: validate/analyze after the simulation completes. Seeds are 1001–1024, with separate deterministic behaviour/drop streams. Horizon: 546 local-date steps, 78 weeks, 2027-01-04 through 2028-07-02 (~18 months). Even the month-six joiner receives more than twelve simulated months. All raw outputs remain local; no commit or GitHub work.

The simulation code passes a strict focused TypeScript check through `fleet heavy`, and the numerical validator checks XP decomposition, skill-point budgets, wallet/allowance conservation, monotone progression, pool bounds and PRD calibration. The numerical sources are Michael's supplied constraints, the prior research and the executable model above. PRD constants are derived from the specified `P(N)=C×N`, not copied from an undocumented game table. Colour hex values below are proposed conventional WoW-style presentation values; the category names/colours are supplied constraints. No external behavioural efficacy claim is made.

## What was simulated

Daily base is three. On an active scheduled date, a member either gives the stated demand or gives nothing. Demand is a sequence of one-emoji, one-recipient messages, so the simulator never partially fulfils a multi-recipient message. Incoming kudos are fixed on active dates. Recipients/givers are uniformly sampled within the stated breadth; repeated recipients are possible. Thoughtfulness is a Bernoulli parameter per intended message, also used for synthetic incoming messages; it is **not** a proposed judge.

| Archetype | Schedule | Probability of giving on active date | Demand on a giving date | Received/date | Relationship breadth | Thoughtful fraction | Other assumption |
|---|---|---:|---:|---:|---:|---:|---|
| Steady giver | Mon–Fri | 94% | 3 | 2 | 16 | 90% | Regular broad recognition |
| Burst giver | Mon–Fri | 45% | 8 | 1 | 12 | 80% | Needs capacity on busy giving dates |
| Popular receiver | Mon–Fri | 65% | 1 | 9 | 24 | 90% | Receiving mostly drives base XP |
| Part-timer | Mon/Wed/Fri | 92% | 2 | 2 | 10 | 90% | No weekend obligation |
| New hire | Mon–Fri | 85% | 2 | 2 | 18 | 85% | Joins day 151, June 4 |
| Holiday-taker | Mon–Fri | 94% | 3 | 2 | 16 | 90% | Ten weeks of free pauses over horizon |
| Swapping-pair member | Mon–Fri | 100% | 8 | 3 | 1 | 15% | One partner returns their base three; repeated recognition is eligible for base XP |
| Min-maxer | Mon–Fri | 100% | 8 | 3 | 30 | 65% | Broad contacts and demand beyond base capacity |
| Quiet member | Mon–Fri | 35% | 1 | 1 | 6 | 95% | Few recognition opportunities |

Skill points are purchased in order; if the next pick is unaffordable or level-gated, the member saves rather than skipping ahead. Perks purchased after a day's activity affect future activity. Weekly capacities/auras refresh on Monday. Active Focus is assumed activated on the first giving date of each week; its remaining charges expire at that date's end. The order search uses the same active policy, not perfect foreknowledge of the week's best date. XP-focused builds spend coins on known cosmetics in the final revision; their old `xp` shopper tag remains solely to reproduce rejected revisions 0/1.

| Named build | Pick order | Coin preference |
|---|---|---|
| Steady | Spark → Rhythm → Flame → Cadence → Circle → Reserve → Echo → Curiosity | Known cosmetics |
| Burst | Focus → Reserve → Spotlight → Reservoir → Circle → Bridge → Curiosity → Spark | Known cosmetics |
| Social | Circle → Spark → Bridge → Flame → Reserve → Echo → Curiosity → Rhythm | Known cosmetics |
| Receiver | Echo → Resonance → Spark → Circle → Reserve → Rhythm → Curiosity → Focus | Known cosmetics |
| Collector | Curiosity → Field Notes → Fortune → Reserve → Reservoir → Spark → Signature | Discovery booster |
| Expression | Signature → Keepsake → Gallery → Spark → Echo → Curiosity → Rhythm → Reserve | Known cosmetics |
| Team | Rally → Provision → Beacon → Spark → Echo → Curiosity → Reserve | Known cosmetics |
| Hybrid | Spark → Focus → Echo → Reserve → Flame → Spotlight → Resonance → Circle → Curiosity | Known cosmetics |
| Baseline | No perks, no spending | Hoards coins; still progresses and gets free drops |

Shopping is a behavioural assumption, not automatic product spending: discovery-booster buyers try once per week when affordable, skip fully paused weeks, and save remaining funds; cosmetic buyers buy successively 120/300/700/1500/3000-coin items, then further distinct 3000-coin items. All shoppers may buy a freeze when an earlier miss suggests demand, but devote at most **15% of lifetime income** to freezes and hold at most two. That 15% is a simulated preference, **not an economy restriction**. No automatic purchases in the product.

## Balance iterations and critical run-through

| Revision / problem | Evidence | Correction retained in final design |
|---|---|---|
| 0: daily extra allowance, +15 bonus per qualifying award from Flame, coins on giving **and receiving** | Hybrid wins XP for eight of nine archetypes in either gate mode; receiving is an easy coin faucet | Weekly reserve; remove the broad +15 effect and every receiving coin source |
| 1: weekly reserve alone does not solve cheap XP stacking | Hybrid wins nine of nine without gate and seven of nine with gate | Focus/Echo cost 2, upgrades cost 3; Focus lasts one chosen date, not the whole week; Echo becomes +2 and Resonance +6; stronger schedule-sensitive weekly branch |
| Flat weekly completion reward rewards declaring fewer workdays | A one-day schedule could collect the same payout while still giving on other dates | Rhythm pays 9 × genuine scheduled giving dates in a completed week; Cadence pays 16 × dates. Pauses/freezes cannot manufacture dates |
| Bonus coins per emoji permit repeated partner farming | Three repeats to one recipient must not mint 12 coins | First thoughtful giver–recipient recognition per local date grants four coins, one set of perk/drop triggers; further units retain base XP |
| Coin-funded XP/respec can buy recognition indirectly | More XP earns SP sooner, then Reserve/Provision; a respec can move spent cosmetic points into allowance | **Exclude coin XP boosters and respec tokens from the target.** Chosen SP perks provide XP boosts; coins buy cosmetics, cosmetic discovery and freezes only |
| Booster improves the accumulated PRD misses retroactively | Switching to a higher rate at a high miss count could multiply past progress | Preserve accumulated hazard charge; add only the **current** rate's C at each new attempt |
| Freeze-hungry shopper spends everything on protection | An earlier shopping policy starved burst/quiet members of their chosen boosters | Treat freeze demand as an optional limited spending preference; keep free pauses and baseline streak hiding |
| Weekly reserve could amplify unthoughtful messages | A strict reading of the proposed gate should cover allowance perks too | With gate on, overflow messages must be thoughtful to spend reserve; daily base remains usable regardless of quality |

Final named-build XP winners: **five distinct builds with the gate**, four without it. The 96-order search has **eight distinct winning orders** with the gate; only steady/holiday share their winner. Search improvement over named builds is 2.8–15.5% with gate, measured on the same four seeds. Min-maxing has a reward, but the same pick order does not win every synthetic situation.

Do not claim “all builds within 10%.” They are not. Within the five XP-focused builds, best/worst is 3.1–54.6% with gate; comparing XP to cosmetic/team builds gives 13.7–88.3%. Burst strongly punishes buying weekly-completion perks. Near-ties of 0.3–1.3% are practical alternatives, not a confident recommendation of one winner. Scores are seed means, not significance tests. Finite sampling and the 96-order search do not prove a global optimum or rule out an undiscovered stronger order.

### Progression and tradeoffs

Locked cumulative thresholds: L2=20; L≥3 needs `50×(L−2)×(L−1)` total XP. L10=3,600; L20=17,100. Fractional levels below are averages of integer levels; nobody actually has a fractional level.

| Archetype | Best named XP build, gate on | End XP / mean level | No-perk end level | Best/worst XP-build spread | Best item-count build / total items |
|---|---|---:|---:|---:|---|
| Steady | Steady | 25,591 / 23.6 | 18.0 | 11.9% | Expression / 119.2 |
| Burst | Burst | 15,757 / 18.7 | 13.0 | 54.6% | Collector / 81.3 |
| Popular | Receiver | 31,648 / 26.0 | 21.0 | 35.6% | Expression / 42.2 |
| Part-time | Steady | 11,887 / 16.4 | 12.8 | 20.5% | Collector / 60.0 |
| New hire | Social | 12,284 / 16.8 | 13.0 | 22.9% | Collector / 63.0 |
| Holiday | Steady | 22,062 / 22.0 | 17.0 | 12.6% | Collector / 108.1 |
| Swapper | Hybrid | 22,164 / 22.0 | 20.0 | 6.7% | Expression / 37.9 |
| Min-maxer | Hybrid | 31,330 / 26.0 | 20.0 | 3.1% | Collector / 117.8 |
| Quiet | Hybrid | 5,306 / 11.2 | 9.0 | 19.9% | Expression / 29.3 |

Item counts include random drops, purchased cosmetics and deterministic perk rewards, excluding the unchanged achievement ladders. Count is an imperfect utility measure: an intentional title, a rare surprise and a common quip have different personal value. Expression has immediate choice; Collector has higher discovery rates; Team sacrifices personal pace for peer benefit. Do not collapse these to one employee-facing score.

| Archetype | Month-six level range | Month-twelve range | End (~month eighteen) range |
|---|---:|---:|---:|
| Steady | 11.0–13.1 | 15.4–19.1 | 19.0–23.6 |
| Burst | 7.8–9.8 | 11.3–14.7 | 13.9–18.7 |
| Popular | 12.8–15.0 | 18.0–21.2 | 21.2–26.0 |
| Part-time | 8.0–9.0 | 10.2–13.0 | 13.0–16.4 |
| New hire | 4.0–5.0 | 10.0–12.0 | 13.7–16.8 |
| Holiday | 10.6–12.7 | 14.0–17.8 | 18.0–22.0 |
| Swapper | 12.0–13.0 | 17.0–18.0 | 21.0–22.0 |
| Min-maxer | 12.0–14.0 | 18.0–21.0 | 22.0–26.0 |
| Quiet | 6.0–6.7 | 7.9–9.0 | 9.0–11.2 |

Ranges are min/max **build mean levels** among eight perk builds, gate on; they are not individual uncertainty intervals. Months six/twelve end June/December 2027; final is July 2, 2028. Holiday pauses protect continuity but reduce earning time, as intended. New hire's month-six number represents only their first few weeks.

### Gate and abuse sensitivity

| Comparison | Without gate | With archetype's gate fraction | Interpretation |
|---|---:|---:|---|
| Swapper, best named XP | 28,416 | 22,164 | Extras fall; 17,550 base XP persists |
| Min-maxer, best named XP | 34,727 | 31,330 | Thoughtful broad recognition still progresses strongly |
| Steady, best named XP | 26,066 | 25,591 | Small reduction for mostly thoughtful behaviour |
| Swapper, no-perk wallet | 1,560 coins | 597 coins | Duplicate protection already limits farmed coins without gate |
| Steady, no-perk wallet | 4,119 coins | 3,742 coins | Most intended recognition qualifies |

At thoughtful fraction **zero**, the quality sensitivity run produces no coins, drops, bonus XP or weekly-reserve spending; ordinary base XP remains. The sensitivity also tests 15%, 50%, 90%, 100%, and base allowances 1/3/5. One-seed hybrid min-maxer XP changes from 19,280 at base 1 to 41,389 at base 5: **allowance policy matters more than fine perk tuning**. Do not silently change coin prices per workspace to conceal that effect.

There is no incentive-compatible proof against collusion. A pair whose messages always pass a judge still earns locked base XP and some extras. Repeated attempts give more chances to produce a qualifying message, which the Bernoulli model permits. The supplied thoughtful fractions assume classification outcomes; they do not estimate false positives or negatives. Mechanism choice, evasion, classifier cost/latency and correlated message quality need separate validation.

## Target rules: award effects and weekly reserve

| Rule | Proposed final behaviour |
|---|---|
| Base XP | Every Given unit: giver +10, recipient +5, permanently; gate never removes this |
| Bonus eligibility | First thoughtful Given recognition for each giver–recipient pair on a giver-local date; without gate, first Given recognition qualifies. Multi-emoji awards get one bonus/coin/drop trigger per pair, all their units get base XP |
| Received bonus eligibility | Echo uses thoughtful source awards; at most the first eligible recognition from each distinct giver in the recipient's local week |
| Bonus composition | Add every applicable owned/selected effect. No global daily/weekly XP cap, no clipping, no bonus-on-bonus multipliers. Upgrade rows replace their lower tier |
| Persistence | Store base/bonus XP, coins, gate decision/version and selected effects with the award. Weekly completion bonus attaches to the final qualifying award on the last required date. Derived level/achievement views replay immutable facts |
| Daily spending | Workspace base refills at giver-local midnight. No rollover. Coins never alter it |
| Weekly spending | Separate reserve refills Monday 00:00 in giver's time zone; +2 Reserve, or +4 Reservoir, plus at most +1 Provision aura. Maximum owned reserve is five per local week |
| Spend order | Deduct daily base first, then reserve, atomically. A message may straddle both. If the entire recipients×emoji cost cannot fit, award nothing. No partial delivery |
| Thoughtful overflow | Gate on: a message needing reserve must pass the thoughtful gate before spending/awarding. Non-qualifying messages can spend available daily base; they get ordinary XP only |
| Pool lifecycle | Replace unused reserve at reset; no rollover, coin refill, trading, separate refill on purchase, or accumulation during leave. Newly bought tiers affect next Monday. Off-days may spend reserve but do not advance streaks |
| Zone/schedule/team changes | Future effective versions only. Changing zones or teams cannot issue another current-week pool; finish the already-issued period before transitioning reset ownership. No retroactive workdays or duplicate daily resets |
| Team bonus consent | Each member may freely choose team attunement in App Home. Only opted-in members receive aura XP/drop effects; this preserves “bonus only from chosen effects” |

The duplicate predicate is an **effect trigger**, not a cap on earned XP. A meaningful trigger can pay every applicable bonus without truncation. Freeze continuity still counts only genuine giving days. Giving need not be thoughtful to advance the basic streak; Rhythm completion does require thoughtful giving. Off-days neither advance nor break; free planned pauses skip dates; a freeze bridges one missed date, adds no day/XP/completion, maximum two consecutive bridges and inventory two.

## Final perk catalogue

Costs are additional, permanent skill points. Minimum level does not buy an upgrade automatically. Save points freely. All non-team perks need no team model. “Qualifying” uses the rules above. Store and achievement pools are disjoint from perk/drop rewards. Basic controls, favourites, muting, hiding progression and selecting already-owned cosmetics are free.

| Perk (stable ID) | Effect | Min L | SP | Prerequisite | Stacking | Favours | Needs teams? |
|---|---|---:|---:|---|---|---|---|
| First Spark (`spark`) | +5 XP on first qualifying giving of each scheduled, unpaused date | 2 | 1 | — | Once/date; adds to other branches | Steady, quiet | No |
| Steady Flame (`flame`) | Spark becomes +9 | 6 | 2 | Spark | Replaces +5 | Steady | No |
| Weekly Rhythm (`rhythm`) | On completing every unpaused scheduled date that week with qualifying giving: +9 × those genuine dates | 3 | 2 | — | Once/completed week; no all-paused reward | Regular schedules | No |
| Weekly Cadence (`cadence`) | Rhythm becomes +16 × those dates | 9 | 3 | Rhythm | Replaces +9/date | Steady, part-time | No |
| Focus (`focus`) | Activate for one local date: +12 XP on next three qualifying recognitions; one activation per local week | 3 | 2 | — | Adds; unused charges expire with date; no reminder pressure | Burst | No |
| Spotlight (`spotlight`) | Focus becomes +24 per trigger | 7 | 3 | Focus | Replaces +12 | Burst, intentional active use | No |
| Open Circle (`circle`) | +5 XP on first qualifying recognition to each distinct recipient that local week | 3 | 2 | — | Adds; recipient history does not reset on purchase | Broad giver, new hire | No |
| Bridge Builder (`bridge`) | +4 XP on first qualifying recognition to each distinct recipient that local month | 7 | 2 | Circle | Adds to Circle; calendar month, no 30-day waiting game | Broader relationships | No |
| Echo (`echo`) | +2 personal XP on first thoughtful recognition received from each giver that recipient-local week | 3 | 2 | — | Once/giver/week; not per emoji | Receiver | No |
| Resonance (`resonance`) | Echo becomes +6 | 7 | 3 | Echo | Replaces +2 | Popular receiver | No |
| Weekly Reserve (`reserve`) | +2 reserve kudos per week | 4 | 2 | — | Refilled next Monday; never daily | Burst, min-maxer | No |
| Reservoir (`reservoir`) | Personal reserve becomes +4/week | 9 | 3 | Reserve | Replaces +2; team +1 may add | Heavy burst | No |
| Curiosity (`curiosity`) | +25% of base long-run drop rates across rarities | 2 | 1 | — | Adds to other rate bonuses | Collector | No |
| Fortune (`fortune`) | Additional +25% of base drop rates | 6 | 2 | Curiosity | Branch total +50%; additive | Collector | No |
| Field Notes (`fieldnotes`) | +25% of base drop rates on first qualifying recipient recognition that week | 4 | 2 | — | Adds; same weekly recipient fact as Circle | Broad collector | No |
| Signature (`signature`) | Immediately choose one named common cosmetic from its disclosed exclusive pool | 2 | 1 | — | Permanent entitlement, not a random draw | Expression, quiet | No |
| Gallery (`gallery`) | Choose three additional named cosmetics from the Gallery pool | 6 | 2 | Signature | Adds; rewards kept | Expression | No |
| Keepsake (`keepsake`) | First qualifying giving after purchase, then at least 28 dates apart: choose one of 12 disclosed exclusive cosmetics | 4 | 2 | — | No reminder, no stockpiled catch-up claims; stops when its pool is owned | Expression, holiday, quiet | No |
| Rally (`rally`) | Primary-team aura: +1 giver XP on every qualifying recognition by attuned members | 5 | 3 | — | Highest same-family aura only; adds to personal/store XP | Cooperative player | **Yes** |
| Beacon (`beacon`) | Primary-team aura: +15% of base drop rates for attuned members | 5 | 3 | — | One Beacon benefit, regardless of owners | Cooperative collector | **Yes** |
| Provision (`provision`) | Primary-team aura: +1 reserve kudos/week per member, available only while attuned | 5 | 3 | — | One benefit; next refill, no owner stacking | Cooperative burst giver | **Yes** |

At L10, nine earned SP buy Spark/Flame plus Rhythm/Cadence for eight; Echo/Resonance plus Spark/Flame for eight; Focus/Spotlight plus Reserve for seven; or all three team auras for nine. These compete with cosmetics and discovery. Skill-point saving is deliberate. The whole catalogue costs 46 SP: at L47 (103,500 total XP) everyone could own it all, so numeric builds eventually converge under the locked unlimited-SP model. This proposal balances the path, not permanent endgame exclusivity. Finite cosmetics eventually stop granting new items; uncapped levels continue granting skill points after the catalogue is owned. Do not invent infinite upgrade tiers to consume every point.

**Removed/merged:** Palette/Palette Plus into deterministic cosmetic content; Signature/Repertoire into Signature/Gallery; Pocket Surprise/Good Odds/Rare Find into automatic all-rarity drops plus Curiosity/Fortune; Grand Finale removed because allowance exhaustion should not gate the best rarity; Three Cheers/Open Circle into Circle/Bridge without a three-recipient quota; Team Player's roster-completion XP removed, while its cosmetic achievement remains; Spotlight's old tiny weekly boost replaced by Focus/Spotlight; workspace Rally replaced by opt-in team aura. New ideas are received Echo, relationship-based Field Notes, time-spaced guaranteed Keepsake and three team specialisations.

## Kudos coins and store

Coins are an account-bound, non-expiring balance in App Home. No transfer, gifting, redemption to money, external goods, kudos, skill points or recognition rank. There is no real-money purchase path and no coin price for a draw. Only genuine earned currency funds fixed, disclosed purchases. No quests, login rewards, scarcity sales, loot boxes or paid random rerolls.

| Earning source | Coins | Reason |
|---|---:|---|
| First qualifying giver–recipient recognition per giver-local date | **4** | Rewards the giving loop; no emoji multiplication |
| Additional kudos to that same recipient/date | 0 | Still ordinary recognition/base XP |
| Receiving | 0 | Popularity/swaps must not buy the store |
| Level-ups | 0 | Avoid XP → coins → booster → more coins feedback |
| Achievements / streak milestones / team totals | 0 | Keep ladders exclusive cosmetics; avoid pressure and team farming |
| App opens / choosing cosmetics / activating items | 0 | No rewards for operating the reward system |

Typical five-date week has at most `4×(5×base+reserve)` coins if every unit targets a new recipient/date and qualifies: at base three and full reserve five, **80/week**. Giving on seven dates allows **104/week**; weekends still never become a streak requirement. These are allowance-derived ceilings, not independent daily coin caps.

| Store item | Price | Entitlement / stacking | Why this sink |
|---|---:|---|---|
| Streak freeze | **60** | One missed scheduled date; inventory two, no genuine day/completion; auto-consume only if enabled | Protection is optional; planned leave remains free |
| XP booster | **Do not sell** | XP buys levels/SP, which can unlock allowance sooner | Violates the strict no coin-funded recognition-advantage rule indirectly; Focus/Rally still supply chosen XP boosts |
| Discovery lantern | **180** | Seven local dates; +25% of base drop rates, no extra attempts. One lantern active; adds to perk/Beacon rate modifiers | Optional earned-coin odds boost; never a purchase of a draw or guaranteed random item |
| Common cosmetic | **120** | Preview exact item before buying; one ownership | First affordable expression sink |
| Uncommon cosmetic | **300** | Exact item | Medium saving goal |
| Rare cosmetic | **700** | Exact item | Longer cosmetic sink |
| Epic cosmetic | **1,500** | Exact item | Collection sink |
| Legendary cosmetic | **3,000** | Exact item; separate from achievement/drop exclusives | Known long-term alternative to relying on orange drops |
| Respec token | **Do not sell** | Coin-funded SP reallocation can buy Reserve/Provision | Keep locked no-respec default. Revisit only if Michael accepts indirect recognition advantage or authorises free respec |
| Quip reroll | **Do not sell** | Free selection among owned quips/favourites | Paying to reroll expression adds friction and random-purchase ambiguity |

Cosmetic prices are placeholders for the parallel Slack-cosmetics research. Possible forms: titles, quip packs, curated emoji, GIF/sticker entitlements **only where Slack's actual surfaces support them**. No claim here that an arbitrary Slack UI can render them. Each cosmetic SKU is deterministic and disjoint from achievement exclusives. Rarity is visual scarcity, never recognition value. No cosmetics are required to thank somebody.

Store items cannot grant XP, SP, allowance, recognition leaderboard score or coins. They improve cosmetic discovery/expression or protect cosmetic streak continuity. This closes the indirect coins → XP/SP → allowance route, not just direct kudos purchases. Do not rank XP/coins as team performance. Unactivated discovery boosters have no expiry; show duration/odds before voluntary activation, no countdown nudges. Coin-funded respec is excluded for the same reason; any future exception must preserve award effects, cooldowns, PRD charges and consumed weekly capacity.

### Inflows, sinks and saving time

| Archetype, gate on | Best-XP build coins earned / spent / remainder | Absorbed | Given units from daily / reserve | Average best genuine-day streak |
|---|---:|---:|---:|---:|
| Steady | 3,742 / 3,152 / 589 | 84% | 1,096 / 0 | 88.7 |
| Burst | 2,238 / 1,425 / 812 | 64% | 528 / 225 | 7.6 |
| Popular | 906 / 540 / 366 | 60% | 254 / 0 | 13.5 |
| Part-time | 1,482 / 1,300 / 182 | 88% | 431 / 0 | 53.5 |
| New hire | 1,560 / 1,308 / 252 | 84% | 472 / 0 | 28.1 |
| Holiday | 3,241 / 3,002 / 239 | 93% | 955 / 0 | 77.6 |
| Swapper | 866 / 420 / 446 | 49% | 1,170 / 129 | 390.0 |
| Min-maxer | 3,482 / 2,620 / 862 | 75% | 1,170 / 140 | 390.0 |
| Quiet | 528 / 430 / 98 | 81% | 139 / 0 | 5.7 |

Rounded columns can differ by one coin. Full sink splits are in analysis-tables.md. Discovery-preferring policies absorb 80–97% of inflow; best-XP builds now prefer known cosmetics and absorb 49–93%, retaining substantial savings between expensive purchases. Excluding coin XP boosters makes this a slower-burning economy, so maintain a useful range of exact-item prices instead of restoring progression purchases. Hoarders can retain their entire 528–3,742 coin income. This is allowed, not evidence that coins need an expiry or forced sink. A healthy balance is purchasable choices, not zero wallets.

At the steady no-perk rate of ~48 coins/week, saving without spending buys a freeze in ~1.3 weeks, common cosmetic in 2.5, discovery booster in 3.8, rare in 14.6, epic in 31.3, legendary in 62.5 weeks. Quiet's ~6.8/week takes ~18 weeks for common and ~27 for a booster; do not promise everyone a first-week purchase. Signature gives an earlier point-funded expression option. At 180, a seven-date discovery booster consumes roughly four weeks of steady earnings while providing one week of improved cosmetic odds. It never produces coins, XP or SP, so it cannot finance another purchase or unlock more recognition.

Those saving times are flow estimates, not a simulated optimal purchase schedule. Future cosmetic content cadence is **not** simulated; coin XP boosters are simulated only in rejected revisions 0/1. Existing data demonstrates affordable sinks and optional spending, not demand forecasts. Catalogues need replenishment over years; finite pools and hoarders make indefinite zero-inflation claims impossible.

## Teams: cooperative value without owner stacking

Team data/spec comes later. Use a member's one primary team, effective roster and attunement at each award; record effect provenance. Other teams do not contribute auras. Identical owners provide redundancy, never extra strength. One owner is sufficient per family; extra owners are clearly labelled “already provided” before purchase. Owner purchases/joins affect next week's aura snapshot; midweek switching cannot acquire another reserve. These are passive, so members do not have to coordinate daily button presses.

| Team size | Rally: +XP/week if each has 12 qualifying recognitions | Beacon: approximate added common drops/week at same activity | Provision: maximum added kudos/week |
|---:|---:|---:|---:|
| 5 | 60 | 0.54 | 5 |
| 10 | 120 | 1.08 | 10 |
| 25 | 300 | 2.70 | 25 |

Beacon calculation is `members×12×0.06×0.15`, a stationary expectation before pool depletion/PRD cold start, not a closed-team simulation. Provision only creates **used** recognition when members have additional real demand: steady/quiet members in the simulation do not use their reserve. Every used extra kudos adds the locked 10 giver +5 recipient base XP; it does not multiply leaderboard credit for an existing kudos. Maximum reserve five is still only 33% over the fifteen-unit five-workday base, and +1 team alone is 6.7%; compare to the prior +1 **daily** perk's 33% before upgrades.

The owner-count sensitivity runs 0/1/5/10 owners; outcomes for 1, 5 and 10 are exactly identical. The named Team build reports only the owner's results; the simulator is not a connected roster. Peer-value calculations above make the social opportunity cost visible. Large teams make the *first* aura owner efficient in aggregate; that cooperative advantage is intentional, not proof of personal build dominance. Team formation/roster eligibility must prevent joining extra teams merely to stack benefits.

## PRD: five visible, independent rarity tracks

Every qualifying giving triggers one opportunity for each non-exhausted rarity. This is automatic: no perk required. Rarity draws are **independent**, so an event can yield several items. Publish that explicitly; do not present these as a categorical single-roll table. All pools contain cosmetic items only. Proposed pool sizes are modelling placeholders, not finished authored content.

Let `S(0)=1`, `S(n)=product(i=1..n)[1−min(1,C×i)]`. The expected interval is `sum(n=0..∞)S(n)`. Solve `1/E[interval]=p` by binary search. Thus the first-draw chance is **C**, not the advertised long-run p. This distinction must be visible in App Home with the current next-draw probability.

| Rarity | Colour / hex | Long-run p | C (per miss increment) | Mean eligible interval | Pool size |
|---|---|---:|---:|---:|---:|
| Common | White `#FFFFFF` | 6% | 0.0054401086149 | 16.67 | 60 |
| Uncommon | Green `#1EFF00` | 2.5% | 0.00096574158449 | 40 | 40 |
| Rare | Blue `#0070DD` | 0.8% | 0.000099998598707 | 125 | 24 |
| Epic | Purple `#A335EE` | 0.2% | 0.0000062748226545 | 500 | 12 |
| Legendary | Orange `#FF8000` | 0.04% | 0.00000025126041557 | 2,500 | 6 |

For constant rate, next chance is `min(1,C×N)`; miss advances N, hit resets. With rate modifiers, maintain accumulated charge: on an attempt `charge += C(current p)`; draw at `min(1,charge)`; hit resets charge. This is exactly CN at fixed p and avoids repricing historical misses when a booster starts/ends. Persist charge across leave, perk changes, pool additions and booster expiry. Recompute C from modified **long-run p**, not by multiplying C. Modifier bonuses add as percentages of base p: fully chosen personal +50%, Field Notes +25%, Beacon +15%, lantern +25% give **2.15×** the base rate on eligible Field Notes events. No exponential owner/booster stacking.

| Final gate-on best-XP build | Common | Uncommon | Rare | Epic | Legendary |
|---|---:|---:|---:|---:|---:|
| Steady | 59.5 | 27.1 | 7.9 | 2.0 | 0.1 |
| Burst | 34.6 | 13.7 | 4.3 | 0.9 | 0.0 |
| Popular | 15.5 | 6.0 | 2.0 | 0.3 | 0.0 |
| Part-time | 22.8 | 8.8 | 2.5 | 0.3 | 0.0 |
| New hire | 25.9 | 10.0 | 3.0 | 0.3 | 0.0 |
| Holiday | 53.0 | 22.3 | 6.7 | 1.3 | 0.0 |
| Swapper | 13.5 | 5.6 | 1.3 | 0.2 | 0.0 |
| Min-maxer | 56.7 | 23.9 | 7.4 | 1.6 | 0.1 |
| Quiet | 7.7 | 2.9 | 0.7 | 0.1 | 0.0 |

Mean drops over 24 seeds; 0.0 after rounding is not “unavailable.” PRD cold starts make short-horizon rare counts lower than `p×attempts`: at baseline, chance of a first legendary by 1,000 eligible opportunities is approximately 12%. Orange drops are exceptional, not a required journey stage. Known legendary store items and achievement exclusives remain available by deterministic routes.

The intrinsic CN guarantee is at 184/1,036/10,001/159,368/3,979,935 opportunities for these rarities. Those last numbers are **not useful workplace pity timers**. Do not call PRD “a guaranteed legendary this year” or bolt on the prior 20/50/100 guarantees without recalibrating p. No extra hard pity is proposed. Ten million empirical draws reproduce targets (legendary 0.0398% vs 0.04%); validation also checks the exact expected-interval solution.

Uniformly select from unowned items in the hit rarity. Persist selected IDs and charges atomically before notification; duplicate retries replay, not redraw. Exhausted rarity stops its attempts/charge and awards nothing; no coin/XP substitute. New content resumes the preserved charge. In the simulation, a drop removes one interchangeable pool slot; it models counts/depletion, not individual aesthetic preference. Store/perk/achievement rewards cannot be random-pool duplicates.

## Remaining implementation and anti-abuse requirements

| Requirement | Why it remains necessary |
|---|---|
| Atomic award/ledger/effect writes with stable idempotency IDs | Slack retries, notifications and multi-recipient messages must not mint effects twice; award/effect snapshots never change after success |
| Gate decision recorded once with version; quality evaluated before reserve spending | Avoid edits/retries rerolling a successful award; preserve explanations without deciding an AI/heuristic here |
| Pair/date eligibility and giver/week receiving keys | Per emoji, per message splitting and swap bursts must not mint extra coins or repeated bonus triggers |
| Keep counters/history even when perks are unowned | Buying, respec or toggling an effect cannot recreate “first recipient this week/month” |
| Versioned local dates/schedules/teams and unique refill periods | No travel, daylight-saving, team transfer or pause edits creating duplicate capacity/credit |
| Free future pauses; audited correction of unexpected absence | Never require coins for leave or pretend freezes are genuine giving days |
| No coin-funded XP or SP reallocation | No direct or indirect coins → allowance route; freezes do not generate Rhythm XP |
| No reciprocal bonus; no received coins; no progression ranking | Thoughtful recognition and role popularity must not become a performance score |
| Visible mathematical odds/pools and consent | No hidden odds, daily exhaustion goals, roster-to-thank checklist, public inactivity list, or announcement pressure |
| Decide eligibility for unusual allowances and bot/import awards | Simulations cover Given human awards and bases 1/3/5, not unlimited imported activity; do not retroactively mint coins or drops from old awards |

The simulator models member-local dates, not UTC event delivery, DST, transactional concurrency, membership changes, correlated networks or Slack UI. Those mechanisms need implementation tests. It does model holiday pauses, freezes, genuine streak lengths, budgets, pool depletion and quality-dependent reserve spending. Team aggregation is analytical, coin XP/respec purchases are excluded from the final target, and content prices remain provisional. These limitations are intentional boundaries of this research.

## Small vertical slices

| Order | Independently shippable result | Outside-in proof to include in its implementation |
|---:|---|---|
| 1 | Automatic locked XP/levels/skill-point balance, private App Home and hide/mute controls; gate/effect snapshot seam | Real Given message persists 10/5 base XP and levels correctly through Slack retry; no perk required |
| 2 | Coin wallet + four-coin giving source + one previewable 120-coin cosmetic in the same slice | Earn through recognition, buy once, equip in supported Slack surface; retry/concurrent spend cannot duplicate ownership |
| 3 | Signature, Spark and Circle choices with real SP spending and additive award bonuses | Different choices create different stored award effects, no global XP clipping; first-pair and saved-SP behaviour |
| 4 | Weekly Reserve +2 and separate App Home capacity display | Message straddles daily/reserve atomically; local Monday replaces pool; failed full cost spends neither |
| 5 | Work schedule, pauses, genuine-day streak; 60-coin optional freeze | Holiday/off-date doesn't break/advance; freeze bridges a miss without fabricating activity or weekly reward |
| 6 | Rhythm/Flame/Echo/Focus and their upgrade paths | Compare real giving/receiving/workweek triggers and one-date active expiry; make costs/upgrade replacement reviewable |
| 7 | Known common→legendary store catalogue | Buy exact item once, equip in supported surface; no XP/SP/allowance effect |
| 8 | Free PRD discovery with initial authored pools, odds display, Curiosity and persisted draws | Trigger across multiple events; replay never redraws, cold-start odds match displayed probability, no duplicates |
| 9 | Fortune/Field Notes/Keepsake/Gallery + Discovery lantern; only ship rates for actually authored pools | Booster preserves existing charge on start/end; deterministic Keepsake gives no missed-period catch-up burst |
| 10 | Teams spec, primary-team consent, one aura at a time: Rally then Beacon then Provision | One/five/ten owners yield the same per-member effect; team transfer cannot mint reserve; show peer benefit |

Achievement ladders can ship independently alongside these when each criterion's history is reliable; no coins/XP/SP for them. The thoughtful-gate seam exists from slice one, but gate activation must wait for a separately validated mechanism. If gate-off progression ships first, use the same duplicate/effect rules and published gate-off balance; do not retroactively remove successful awards or earnings when a gate is introduced. Every slice provides a usable loop, not an empty wallet or a store with nothing purchasable.

## Open decisions for Michael

| Decision | Recommended answer | Consequence |
|---|---|---|
| Should the gate govern reserve spending and coins too? | **Yes**, in addition to XP/drop extras; daily base recognition remains untouched | Overflow needs a decision before award creation; no judge chosen here |
| Is 4 coins/pair/date, with no received/level/milestone coins, acceptable? | **Yes** | Simple ledger and no compounding/popularity faucet; quiet members save more slowly |
| Is schedule-normalised Rhythm preferable to the old equal weekly payout? | **Yes**, 9/16 per genuine scheduled date in a complete week | Prevents one-day schedule optimisation; part-time alternative builds stay viable |
| Is the observed XP-build spread acceptable? | **Yes for deliberate specialisations**, with clear triggers and costs; do not promise equivalence | Burst mismatch reaches ~55%; close winners should be presented as alternatives |
| Should coin-funded XP boosters/respec remain excluded? | **Yes**, honour the strict no recognition-advantage rule | Both can indirectly buy skill points for allowance perks. If Michael instead accepts that indirect route, rerun an explicitly relaxed design; a full target cannot promise both |
| Do coin-funded chance boosters violate “no paid random draws”? | **Keep only the explicitly proposed earned-coin timed booster**, with fixed disclosed effect and no purchased attempts; confirm this interpretation before slice nine | If Michael means no coin-funded randomness at all, omit lantern and rerun collectors; other store sinks remain useful |
| Is legendary discovery intentionally this rare? | **Yes as an optional surprise**, with deterministic legendary store alternatives | Most members will not see an orange drop in eighteen months; raise p and rerun if that is disappointing |
| Do team auras apply without individual selection? | **No**, free team attunement; one primary team, highest aura per family | Preserves locked chosen-bonus rule, privacy and non-stacking balance |
| Which cosmetic SKUs/Slack surfaces ship? | **One supported exact-item SKU first**; keep tier prices provisional until parallel research lands | Do not promise unsupported GIF/sticker behaviour or author 142 drop items before the first useful slice |
| How are existing perks handled if superseded? | **Grandfather earned rewards and offer an explicit equivalent/refund policy before changing purchases** | No XP rollback or silent confiscation; this research is not authorisation to mutate an installed economy |

The judging mechanism, team membership rules, actual cosmetic presentation and strict treatment of indirect coin advantages remain Michael's decisions. The proposed numbers and complete target economy are ready to review without a commit or PR.
