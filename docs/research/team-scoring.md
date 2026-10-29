# A friendly weekly team score

Research recommendation, 2026-10-29. This branch is disposable and must not be merged. This note proposes a product choice; it changes no rules or runtime behavior. Observed production results, team identities and usage counts live only in the private research ticket.

## Recommendation

Feature **the increase in the share of teammates who gave a hug or a kudos**, measured in percentage points against the same elapsed part of last week. Show the current participation fraction beside it. Keep a separate positive acknowledgement when everybody has joined in, including when participation is unchanged.

The question is whether another team can make visible progress, rather than whether the same prolific giver can produce more messages. An improvement score gives a quiet team a fresh route into the celebration. Participation alone remains useful context, but does not prevent the same already-active team from leading repeatedly. A volume blend still lets one member determine a team's standing.

This is a recommendation for the product owner to accept in the downstream spec. Historical observations cannot prove that it improves motivation, produces enduring leader rotation, or increases weekly participation. Do not change weights until a preferred winner appears.

## Definitions and candidates

Let `M` be a team's current primary-member roster and `N = |M|`. Use the same roster for both comparison periods. Retain the existing minimum of three primary members. `K` is kudos units given, not messages, recipients counted again, XP, or kudos received. `H` is accepted hugs given. `A` is the number of distinct members in `M` who gave either kind of thanks while attributed to this primary team during the window. Giving both kinds still contributes one person.

| Candidate | Formula | What it rewards | Limitation |
| --- | --- | --- | --- |
| Raw totals | `K` | Total giving | Favors larger teams at equal individual behavior; one prolific member can dominate. |
| Per-member average | `K / N` | Giving volume relative to size | Removes the expected linear size advantage but retains concentrated giving. |
| Participation share | `P = A / N` | Breadth of giving, including hugs | A team can remain at the top indefinitely; small teams have larger individual steps. |
| Most improved participation | `100 × (P_now - P_before)` percentage points | Broadening giving relative to the team's own baseline | Can reward a rebound after a quiet week; a team already at full participation has no upward headroom. |
| Hugs and kudos blend | `(K + H) / N` | Both forms of giving volume | One prolific hug giver still dominates; an arbitrary kudos weight does not solve that. |

Also inspect `(K_now - K_before) / N` as the existing kudos-improvement comparator. It can change the featured team without making hugs part of the loop, so it does not meet this requirement by itself.

The blend uses equal event-unit weights for an understandable baseline. Repeat it with kudos weights `0.1, 0.5, 1, 3, 5, 10` as a sensitivity analysis, not as a search for an attractive leaderboard. These are synthetic model parameters, not production measurements or reward amounts.

## Recommended behavior

- Rank strictly positive participation gains. Show the current `A of N` and participation share as context. A team with no positive gain gets its own participation or best-week acknowledgement, not a negative delta or a losing rank. If nobody improves, make the headline a shared acknowledgement instead of naming a winner.
- Give identical exact scores the same rank and celebrate co-leaders. Do not break a participation tie using message volume, hugs, kudos, XP, rarity, or team size. Name ordering is for stable display only. Compare rational values before rounding the displayed score.
- Use percentage-point change, not percentage growth. Moving from no participation has a valid percentage-point gain; relative growth from zero is undefined. A missing or unobserved baseline is different from a measured zero.
- Use a Monday-start week with a visibly stated boundary. A live board compares the same elapsed window of last week. A Monday recap compares two completed weeks. Never compare a partial current week with a whole previous week and call the difference an improvement.
- Preserve the current primary-team boundary. Membership in several Slack groups must not multiply a person's contribution. For participation, intersect event-time attribution with the current primary roster, matching the existing board's treatment of givers. Use that same roster for both denominators. Treat this as a current-roster comparison, not an immutable historical result.
- A group needs a reliably observed prior comparison window before competing on improvement. A new team or a period from before hug capture began gets a starting-state message, not a fabricated zero baseline. Keep full participation visible even when its improvement score is zero.
- Score only accepted domain actions. Rejected, duplicate, self-directed or over-budget reaction attempts do not count. Additional hugs by an already participating member can earn their ordinary rewards but cannot increase this team's participation score.

This deliberately offers several honest things to celebrate: improvement for a growing team and full participation for an already engaged team. It does not guarantee a different leader every week. Such a guarantee would require excluding teams, rotating eligibility or choosing winners independently of behavior, none of which this research recommends.

## Copy recommendations

The following examples are fictional:

- Headline: **More teammates joining in this week**.
- Improving team: **2 of 3 teammates joined in · up 33 percentage points from this time last week**.
- Full participation: **Everyone joined in this week 💜**.
- Tie: **Sharing this week's biggest participation gain**.
- Quiet team: **Start your team's week with a hug or a kudos**.
- Missing baseline: **Your team's first week. Every hug or kudos helps someone feel appreciated**.
- Next action: **Give a hug or a kudos**.
- Explanation: **A teammate joins in by giving at least one hug or kudos this week. Each person counts once**.

Never say that a team lost, fell behind, dropped places, is the least active, or needs a named person to act. Do not name nonparticipants. Do not display a negative score and rely on cheerful wording to disguise it. Do not show the fictional phrase "up 33%" for a percentage-point change. Copy cannot repair a persistent public bottom rank, so the no-loss rule needs to affect presentation as well as the improvement sentence.

## Three-person and thirty-person teams

All figures in this section are invented stress cases, not production observations.

| Equal behavior scenario | Three people | Thirty people | Interpretation |
| --- | --- | --- | --- |
| Everyone gives one kudos: raw total | 3 | 30 | Larger team gets ten times the score. |
| Same scenario: kudos per member | 1 | 1 | Equal per-member behavior ties. |
| Same scenario: participation | 100% | 100% | Equal breadth ties. |
| Participation rises from one third to two thirds | +33⅓ pp | +33⅓ pp | Equal proportional progress ties. |
| Everyone gives one kudos and one hug: blend | 2 | 2 | Size normalization helps, but volume remains uncapped per contributor. |
| One additional person joins in | +33⅓ pp | +3⅓ pp | Small teams have much larger individual steps. |
| One giver produces thirty hugs: participation | 33⅓% | 3⅓% | Breadth counts once; repeated hugs cannot manufacture new participants. |
| Same thirty hugs: blend | 10 | 1 | A prolific member still dominates the volume score. |

Size normalization is not statistical equality. Under the artificial assumption of independent participation probability `p`, the standard deviation of a participation share is `sqrt(p × (1-p) / N)`. At `p = 0.2`, this is about 23.09 percentage points for three members and 7.30 for thirty. Small teams are more volatile and more likely to reach extremes. These are mathematical calculations, not estimates of actual team behavior.

Do not claim that a percentage makes sizes equally likely to win. Starting with size bands, Bayesian shrinkage, multiweek smoothing or hidden bonuses would add product choices and make the score harder to explain. Keep the limitation explicit and revisit only after observing ordinary completed weeks.

An improvement score also has a ceiling and a rebound incentive. A team at full participation cannot improve next week; a quiet week creates more room to rebound. The separate full-participation acknowledgement addresses visibility, not that incentive. No evidence here establishes that people would actually game it.

## Evidence and reproducible method

The source baseline is commit [`df092e3`](https://github.com/Silthus/kudos/tree/df092e346d11f55fc5e86977715a8a03445820ce). Read these primary sources before interpreting a reconstruction:

1. [`groupsBoard.ts`](../../convex/leaderboard/groupsBoard.ts): `fewestMembersListed`, `scored`, `byStandingThenName`, `sameStanding`, `gainOf` and `mostImprovedOf` define the existing ranking and kudos improvement. The current implementation rounds kudos per member to one decimal, floors participation to an integer percent, then uses participation, total and name to order it.
2. [`groupBoards.ts`](../../convex/leaderboard/groupBoards.ts): `countingGroupsWithPrimaryMembersIn`, `factsOf` and `tallyUpToTheSameDay` define denominators, retained group totals, current-roster givers and comparable windows.
3. [`groupTotals.ts`](../../convex/leaderboard/groupTotals.ts), [`attribution.ts`](../../convex/groups/attribution.ts) and [`history.ts`](../../convex/groups/history.ts): kudos sums and insert-only attribution follow the primary group at spend time. Later membership does not rewrite those amounts.
4. [`person.ts`](../../convex/analytics/person.ts): `teamsOf` sends all kept Slack group handles, not the selected primary group. Analytics affiliation arrays alone cannot reproduce the board.
5. [`projections.ts`](../../convex/analytics/projections.ts): `kudosGiven` sends one giving event per message with `kudos_total`; `projectHugGiven` sends an accepted hug on its giver. Neither projection sends the primary team. Received kudos must not be treated as giving.
6. [`hugs.ts`](../../convex/hugs/hugs.ts) and [`records.ts`](../../convex/hugs/records.ts): accepted hugs enforce membership, feature eligibility, message age, allowance and duplicate rules. Records retain the giver's allowance day. Arbitrary reaction telemetry would bypass those rules.
7. [`periods.ts`](../../convex/leaderboard/periods.ts) and [`Leaderboard.spec.md`](../../convex/leaderboard/Leaderboard.spec.md): Monday-start periods, same-day comparisons and the existing no-loss invariant. This research amends none of these rules.
8. [PostHog's array query tutorial](https://posthog.com/tutorials/array-filter-breakdown): unfolding an affiliation array creates a row per affiliation. Doing that here would credit one action to several groups, contrary to primary attribution.

Query the governed metric catalog first. None of the definitions inspected defines a team race; these comparisons are exploratory rather than approved semantic metrics. Switch to the requested project immediately before every data query and filter every event query to production.

Use a fixed cutoff and bounded timestamps. The query template is public-safe; `start` and `cutoff` must be supplied as explicit timestamp literals:

```sql
SELECT
    uuid,
    timestamp,
    distinct_id,
    person_id,
    event,
    coalesce(toFloat(properties.kudos_total), 0) AS kudos_units
FROM events
WHERE timestamp >= {start}
  AND timestamp < {cutoff}
  AND properties.environment = 'production'
  AND event IN ('kudos given', 'hug given')
ORDER BY timestamp, uuid
LIMIT 500
```

Read the primary roster, group eligibility, analytics-ID mapping and primary-group history using an existing read-only Convex query or the CLI's sandboxed `--inline-query`. Do not deploy research functions or run mutations. Do not return message text, channel identifiers or recipient lists. Bound the roster read to analytics-linked members rather than returning the whole Slack directory. Keep every extracted row outside the public checkout.

For each candidate:

1. Verify output completeness and unique event UUIDs. Resolve the event's opaque `distinct_id` through `analyticsIds` to its domain member. Verify a member does not map to conflicting analytics people; use `person_id` for analytic unique-person audits.
2. Select enabled, nonautomatic, allowed groups with at least three current primary members. Record exclusions instead of silently dropping events from tiny or unassigned groups. Do not use whole-workspace enrollment as a team denominator.
3. Run a **fixed-current-roster what-if** first: credit each observed event to the giver's current primary team. This tests formulas on the same population but is not the historical board.
4. Run an **event-time reconstruction** separately: use stored kudos attributions and primary-group history for hugs. For participation require that the giver is also in that team's current primary roster. Leave events before reliable group history unassigned; never invent their historical team.
5. Reproduce the stored weekly `attributedGroupTotals` from attribution sums, and compare the analytics/history kudos reconstruction with those totals. The check must account for events predating group attribution rather than treating every giving event as a recorded group award.
6. Match accepted hug records with analytics by giver and timestamp. Capture truncates timestamps to milliseconds, so compare against the floor of the domain timestamp. Verify both giver and time, not just total event count.
7. Calculate each candidate using exact fractions; separately verify that the existing rounding precision does not change the leading set. Keep all tied leaders. Count a leader-set change only between measured periods with a positive leader. A missing baseline is not a leader, and alphabetical order is not a tiebreak victory.
8. Show each observed week's leaders and values in the private ticket. Mark launch or instrumentation gaps and the partial current week. Report transition counts with their small denominator; they are not a forecast of future rotation.
9. Repeat with the maintainer's actions omitted while keeping the denominator fixed. This measures sensitivity; it does not propose excluding the maintainer from the product.
10. Repeat equal elapsed windows, including Monday through Wednesday for the present snapshot. Inspect giver-local allowance days against UTC week boundaries. Use the production weekly boundary for the implementation; the analytic UTC comparison must not silently redefine it.

The investigation cross-checked accepted hug records, attribution sums and stored weekly totals through read-only production access. The private ticket contains the actual observations, exclusions, sensitivity results and the limits they place on the recommendation. The two attribution methods agreed on the headline candidate leaders in the examined snapshot, but not on every historical amount. That distinction is necessary for a truthful comparison.

## Small verification calculation

This executable snippet uses only invented cases and checks the scoring properties claimed above:

```python
from fractions import Fraction as F
from math import sqrt

def participation(active, members):
    return F(active, members)

def gain(active, before, members):
    return 100 * (participation(active, members) - participation(before, members))

assert participation(3, 3) == participation(30, 30) == 1
assert gain(2, 1, 3) == gain(20, 10, 30)
assert gain(1, 0, 3) == 10 * gain(1, 0, 30)
assert gain(3, 3, 3) == 0
assert gain(0, 0, 3) == 0
assert participation(len({'giver'}), 3) == F(1, 3)
assert F(3, 3) == F(30, 30)
assert F(30, 3) > F(30, 30)
assert round(100 * sqrt(0.2 * 0.8 / 3), 2) == 23.09
assert round(100 * sqrt(0.2 * 0.8 / 30), 2) == 7.30
```

## Handoff boundaries

The product owner still chooses the score and the prototype shows the gain, the current participation and the acknowledgement for a fully participating team together. Treat the incomplete launch sample as a model check, not an experiment showing a causal effect. Keep scoring independent of XP and drop odds. Do not add a new reward economy, a winner-selection rotation or a team eligibility policy through this research lane.

The implementation needs an idempotent way to attribute accepted hug participation to a primary team, a union with kudos givers and a comparable prior-window read. Hugs currently have no group totals; adding hug counts to an existing kudos total would neither measure participation nor preserve one-person-one-contribution. Follow the existing pure board calculation seam and positive improvement copy, then prove ties, zero baselines, missing baselines, repeated hugs, membership boundaries and partial windows from the behavior surface.
