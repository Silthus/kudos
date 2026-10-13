# Octalysis walk-through for HedgeHug

**Status: completed research, 2026-10-13.** Research ticket [#85](https://github.com/Silthus/kudos/issues/85), website map [#57](https://github.com/Silthus/kudos/issues/57). This branch is research only. Recommendations are proposals for [re-spec #86](https://github.com/Silthus/kudos/issues/86), never amendments to its rules. Synthetic examples only.

## Findings #86 can use now

1. **The five-word gate is a length check, not a thoughtfulness check.** `Thank you for your help today` passes P11 without naming any work. Base XP and achievement counts remain ungated (P1, P13, P59). A reciprocal pair giving 3 units to each other every weekday earns **225 base XP per member per synthetic week**, against **150** for someone giving 3 units each weekday and receiving none. The daily allowance caps the rate but does not prevent farming. Keep brief thanks valid, but describe the gate honestly and cap *bonus* rewards per giver-recipient-day. [Progression P1/P11/P13/P16/P29][progression]; [core R4/R11][core].
2. **Apply qualifying-recognition semantics to the new tree.** Prototype Rhythm/Cadence and Treasurer/Banker say “every thoughtful kudos”. Literal per-unit or per-award bonuses let one pair split messages or repeat emoji to mint rewards. Use P16's first thoughtful giver-recipient-day for all per-recognition XP and coins; require that gate for Spark, Circle and Focus too. The website descriptions must match. [Accepted cut][cut]; [prototype tree][tree]; [P16/P20][progression].
3. **Quest rewards dominate early XP.** Prototype `new-face` pays 60 XP for one new recipient, `say-why` pays 90 for three notes, and a group quest pays 100–120 XP. L2 needs 20 total XP and L3 100. A 60-XP quest is six ordinary giving units. Do not balance a new member using only P3's base-XP curve. Treat these as prototype inputs to a sensitivity run, not verified production rewards. [Quest data][quests]; [P3][progression].
4. **Filter impossible quests before assigning them.** The pool needs two groups, another group, a recent joiner or a never-thanked colleague. The “everyone” group quests pressure the last nonparticipant; the four-other-groups quest is impossible with fewer than five groups. A single reroll cannot fix three infeasible picks. A workspace without groups needs personal equivalents, not locked progression. [Quest data][quests]; [groups G4/G20][groups].
5. **Keep claims and crates deterministic.** Disclose the exact reward, let “open” reveal an already-earned entitlement, and make replay cosmetic. Completed quest rewards should not disappear at the weekly reset. Opening a feature, visiting a board, equipping an item or spending a point should not mint repeatable progression. [Accepted handoff][handoff]; [quest data][quests]; [P8/P30/P32][progression].
6. **Resolve pre-unlock entitlements explicitly.** Quests at L2 award coins, bronze achievements at L4 award 10 coins, and the catalogue gives a hedgehog at L5, before coins/inventory at L6 and collection at L7. Recommend recording earned rewards immediately and revealing the wallet/items when opened, while ordinary giving coin earnings start when the coin feature is enabled. This is a proposal, not a settled rule. [Unlock schedule][unlocks]; [achievement rewards][rewards]; [hedgehog catalogue][hogs].
7. **The onboarding Journey stays. Its detailed steps are unverified.** Read every round comment on #62 and searched all prototype source at `3409ade`; the only Journey references say “first quest chain” and “the prototype doesn't show it yet”. There is no Journey step list or Journey mock data in those inputs. Do not invent an accepted chain. A separate table and runnable simulation below use an explicitly proposed non-expiring chain, distinct from the five existing feature-introduction quests. [Corrected cut][cut]; [corrected handoff][handoff]; [prototype source][prototype].

## Source precedence and limits

Michael's accepted cut and Journey correction override the pre-cut spec. The prototype is the concrete *candidate* catalogue, but its local state is not backend proof. P1/P3, thoughtful-gate semantics, once-only effects and coin arithmetic are inherited unless the cut changes them. Pre-cut rules forbidding quest XP or achievement coins (P2/P29/P58) are superseded by the accepted new reward sources. No cut feature is simulated as retained.

The accepted changes remove boosters, group auras, drops, rarities, titles, quips, cards, streaks and freezes. They keep the Journey; 3 personal weekly quests, one reroll, one group quest and a bonus quest per feature; 11 achievement ladders; 14 perks; skill points `max(0, level - 4)`; the L2–L7 feature schedule. [Cut][cut]; [handoff][handoff].

Sources are pinned below so later changes on #86 cannot silently change this baseline. Framework definitions below come from Chou; mechanism classifications and recommendations are our analysis of those pinned specs. This is a design audit, not an empirical claim that gamification improves recognition.

## References

[core]: https://github.com/Silthus/kudos/issues/28
[progression]: https://github.com/Silthus/kudos/blob/1da795da2755e54cedbee21fb2659cbf0840bd7b/spec/progression.md
[groups]: https://github.com/Silthus/kudos/blob/6da9b18ff3a2abff3b3bbc4d777905bdb1baafc6/spec/groups.md
[cut]: https://github.com/Silthus/kudos/issues/62#issuecomment-6152588034
[handoff]: https://github.com/Silthus/kudos/issues/62#issuecomment-6152903919
[prototype]: https://github.com/Silthus/kudos/tree/3409adebdba017e96a0e4dde22a64f71dab44822/prototype/website-ui/src
[quests]: https://github.com/Silthus/kudos/blob/3409adebdba017e96a0e4dde22a64f71dab44822/prototype/website-ui/src/variants/e/quests-data.ts
[tree]: https://github.com/Silthus/kudos/blob/3409adebdba017e96a0e4dde22a64f71dab44822/prototype/website-ui/src/variants/e/skills-perks.ts
[unlocks]: https://github.com/Silthus/kudos/blob/3409adebdba017e96a0e4dde22a64f71dab44822/prototype/website-ui/src/variants/e/unlocks.ts
[rewards]: https://github.com/Silthus/kudos/blob/3409adebdba017e96a0e4dde22a64f71dab44822/prototype/website-ui/src/variants/e/book-rewards.ts
[hogs]: https://github.com/Silthus/kudos/blob/3409adebdba017e96a0e4dde22a64f71dab44822/prototype/website-ui/src/variants/e/hedgehogs.ts

## Runnable simulation and explicit assumptions

Run `bun research/octalysis-simulation.ts --check`, then `bun research/octalysis-simulation.ts`. No additional dependencies are required. [Results](octalysis-results.md), [weekly state](octalysis-weekly.tsv), and [trigger/action/reward trace](octalysis-trace.md) are generated artifacts.

The candidate and bounded runs each cover six synthetic personas for 104 UTC weeks, starting 2026-01-05. Candidate interprets ambiguous new Rhythm/Cadence, Treasurer/Banker and Focus/Spotlight bonuses per award; bounded applies P16's per-pair/day limit and removes infeasible personal quests before assignment. Both retain ungated base XP and the five-word gate; bounded is not a complete anti-farming solution. New member gives 5/receives 2 per week, thoughtful giver 10/3, quiet receiver 0/6, optimiser 15/15, small group 5/3 and no-groups member 10/3. Reserve, once present at the next Monday refill after purchase, adds its permitted units on Friday. No persona posts on weekends. All notes pass the length gate; the optimiser's notes are synthetic padding without a concrete contribution.

**Assumptions, not accepted rules:** all features are opened promptly; quests count the week's activity even if opened midweek; three quests rotate deterministically through the prototype pool (rather than its wall-clock shuffle); one infeasible pick can be rerolled; a quest completion is immediately claimed and may recur next week; reward coins and achievements bank before their surface unlocks; giving/receiving coins begin after the coin surface opens; new feature quests persist rather than disappearing after a level window; perks are bought at the beginning of the next week when affordable, with no retroactive effects; synthetic recipients repeat over a fixed roster, with album group membership derived from peer ID modulo group count; Focus is activated on Monday, not optimised for Friday reserve spending; the recent joiner ages out after 13 weeks; group participation is a declared external scenario input for the unanimity quest; all six baseline workspaces have fewer than five groups, so Group Reach is structurally infeasible and no multi-member reach aggregation is modelled; store buys the 80-coin emoji and 120-coin hedgehog once while reserving 350 coins for upgrades. The four Journey steps are research proposals with zero extra XP or coins.

Controlled runnable cases cover chime-in eligibility, 24-hour age, affordability, deduplication, a three-person reciprocal ring, roster-change completion, and late/retried quest claims. The weekly baseline generates no chime-ins, so Crowd Favourite/Standing Ovation/Amplifier are zero there. Exact final pacing is contingent on #86 settling these assumptions. A production reward budget or real behavior claim cannot be inferred from this synthetic run.

## What Octalysis contributes

Chou's *Actionable Gamification* treats game mechanics as ways to engage human motivations, rather than assuming counters make an experience meaningful. This report uses the author's [official book overview][book] and publicly published book chapters/adaptations, including [white/black hat][hats] and [left/right drives][axes]. **A licensed full edition was not available: edition-specific page numbers and a complete-book reading are unverified.** The definitions are the author's framework, not established neurological findings or measured effects in HedgeHug.

| Drive | Meaning in this audit | Hat | Symbolic axis | Primary source |
|---|---|---|---|---|
| 1. Epic Meaning & Calling | Recognising work helps a community beyond oneself. | White | Vertical, neither left nor right | [Chou CD1][cd1] |
| 2. Development & Accomplishment | Progress toward a challenge the member values. | White | Left | [Chou CD2][cd2] |
| 3. Empowerment of Creativity & Feedback | Expressing thanks, choosing a build, seeing its effects. | White | Right | [Chou CD3][cd3] |
| 4. Ownership & Possession | Attachment to earned progress, an album or avatar. | Contextual | Left | [Chou CD4][cd4] |
| 5. Social Influence & Relatedness | Belonging, endorsement, comparison and competition. | Contextual | Right | [Chou CD5][cd5] |
| 6. Scarcity & Impatience | Restricted allowance, level gates or limited access. | Black | Left | [Chou CD6][cd6] |
| 7. Unpredictability & Curiosity | Wanting to discover a concealed outcome. | Black | Right | [Chou CD7][cd7] |
| 8. Loss & Avoidance | Fear of missing a reward, position or group obligation. | Black | Vertical, neither left nor right | [Chou CD8][cd8] |

White/black hat and left/right are separate axes. CD4/5 can take on either hat through design; white hat is not synonymous with intrinsic motivation. Chou explicitly describes the brain labels as symbolic, so this report does not claim hemispheric causation. [Hat definitions][hats]; [axis caveat][axes].

The phase codes in the step tables are **D** discovery (motivation to try), **O** onboarding (learning to participate), **S** scaffolding (using learned rules repeatedly), **E** endgame (continuing after the available systems feel familiar). These are experience stages, not fixed level ranges: an existing receiver at L8 may still need giving onboarding. [Chou's four phases][phases].

Every drive annotation below is our interpretation. The default core is CD1/3/5: express a concrete contribution, see that the recipient was recognised, and build connection. XP, coins and collection can support it, but Chou's [PBL warning][pbl] is a reason not to treat ranking or accumulating as the purpose. His [ethics argument][ethics] supports a transparent purpose and voluntary participation. None of these sources establishes that a particular reward number produces sincere gratitude.

## Core loop step table

The source of award, allowance and feedback facts is [#28 R1–R27/R33–R47][core]; XP, gate, effects and coins are [P1–P17/P29][progression]. Feature-opening semantics follow [the accepted handoff][handoff]. “Black risk” identifies a drive the presentation can amplify, not a moral judgement about the member.

| Step / trigger | Action | Reward or consequence | Drives; phase | Main-loop assessment and concrete change |
|---|---|---|---|---|
| Discover a colleague recognising work | Read a normal thanks, then explanation | Meaning and a way to join | 1/5; D | Strong. Show what was appreciated before counters; do not greet with a leaderboard contest. |
| First give or receive | Read one welcome, learn mention + emoji and allowance | Understanding and own basic profile | 1/2/3/5; O | Strong unless “give it back” implies debt. Say “thank someone when you notice work worth recognising”, without naming the sender. |
| Notice a contribution | Write mention(s), kudos emoji, optionally a specific reason | Recipient gets `emoji count` kudos; giver spends recipients × emoji | 1/3/5, 6 budget; O/S/E | Keep quick thanks valid. Repeated emoji raise XP and ranking without a richer reason. Bonus rewards must count recognition, not repeated units. |
| Insufficient allowance | Edit failed mentions/emoji or wait for local midnight | No partial award; daily budget refills to base 3, no rollover | 6/8 risk with 3 control; O/S | A limit can preserve meaning; “use them before they disappear” turns it into a quota. Use neutral balance/refill copy, no depletion alarm or refill nag. |
| Five-word note qualifies | Include a reason in the original accepted message | Perk/coin eligibility; decision stored once | 1/2/3; O/S | Five words measure length. Example: “Thank you for your help today” qualifies without describing work. Ask for contribution + impact; label eligibility accurately. Do not claim semantic verification. |
| Accepted award | Read private result; recipient sees thanks in its original context | 10 giver XP + 5 recipient XP per unit, sticker when applicable; immutable effects | 2/4/5; O/S/E | Trading stays possible even with no bonus. Keep receipt centred on the recognition, with counters secondary. Do not reward responding to a particular sender. |
| Received recognition | Read thanks; decide freely whether to give later | Received XP; 2 coins per distinct thoughtful giver/week, max 20 once coins open | 2/4/5; O/S/E | Do not ask the receiver to solicit kudos or “repay” the sender. Receiving-only progress is valid; keep received totals private. |
| Threshold reached | See level and named feature/point entitlement | L2=20, L3=100, L4=300; later `50(L−1)(L−2)`; points from L5 | 2/4; O/S | White-hat progress can still be empty accumulation. Never describe level as work quality or contribution value. Respect multi-level jumps and opened state in notices. |
| First thoughtful pair/day | Give one eligible recognition, regardless of units | 4 giver coins; once-per-recognition bonuses | 1/2/4/5; S/E | This contains repeated-unit extraction. Explicitly retain P16 for every new coin/XP perk. Pair/day caps do not prove sincerity. |
| Edit, retry, duplicate delivery or delete | Correct failed message, or revisit accepted one | At most one award; accepted effects never rerolled | 2/3/4; O/S | Essential trust. Adding a reason after acceptance cannot backfill coins; explain before submission, and never suggest resending merely to earn rewards. |

## Chime-in side loop

Chime-ins are retained in [prototype quests][quests] and three achievement ladders. Their existing mechanics are [P46–P50][progression]. The cut removes Crowd boosters; P53's remaining recipient threshold XP is **unsettled** because it belonged to that coupled system. The baseline simulation excludes all such threshold XP and recommends removing it in #86 rather than accidentally retaining a crowd-farming multiplier. [Cut][cut].

| Trigger | Action | Reward | Drives; phase | Assessment / change |
|---|---|---|---|---|
| Another member's accepted kudos, within 24 hours | An independent member clicks its indicator reaction | One unit per recipient, spending clicker's daily/reserve budget; normal XP/qualifying effects | 1/5 plus 6 window/budget; O/S/E | Useful endorsement if the clicker knows the contribution. Show cost first; do not treat every ordinary emoji reaction as a paid chime-in. |
| Giver, recipient, repeat join, expired window or too little allowance | Attempt click | No extra award; removal never refunds | 2/3/5; O/S | Keep constraints and feedback clear. A two-person pair cannot chime in on its own mutual kudos; a third colluder can. |
| Independent endorsements accumulate | Observe shared appreciation | Crowd/Amplifier achievement progress; existing base XP, no cut booster | 2/5, possible 8 status pressure; S/E | Reject bonus XP for endorsement thresholds; avoid “get friends to chime in” quests. Endorsement must be optional, not a popularity campaign. |
| Three-person farming ring | Rotate sender, recipient and independent clicker | Every legal unit still gives base XP; quest/coin eligibility can pass inherited note | 2/4/5; S | Eligibility is not anti-collusion. Share P16 limits across direct and chime-in awards and bound quest bonuses; preserve sincere endorsements. |

## Personal weekly quests: every prototype definition

All goals, targets and rewards below are copied from [the pinned quest pool][quests], **candidate numbers**, not a final backend contract. The analysis column is a proposal for #86. Assignment itself adds CD7 (unknown next tasks); weekly expiry adds CD8 if earned rewards or progress are threatened. Control through a free replacement is CD3. The accepted structure is 3 weekly quests and one reroll. [Cut][cut].

| ID / trigger | Action / target | Candidate reward | Drives; phase | Assessment / concrete change |
|---|---|---|---|---|
| `new-face` | Thank 1 person never thanked before | 60 XP, 15 coins | 1/2/5; O/S | Breadth can be meaningful; novelty can become harvesting people. Require qualifying reason, offer only with unseen eligible peers, retire when roster is exhausted. |
| `two-groups` | Thank people in 2 groups | 80 XP, 20 coins | 1/2/5; S | Impossible without 2 groups; overlap could let 1 person satisfy both. Count distinct recipients and disclosed group attribution; offer an equivalent breadth task where groups do not exist. |
| `outside` | Thank 1 person outside own group | 50 XP, 10 coins, sunflower emoji | 1/2/4/5; S | Do not target a named team/member or imply an obligation. Assign only when a real outside peer exists; keep the goal generic. |
| `newcomer` | Thank 1 member who joined within 3 months | 60 XP, 15 coins | 1/2/5; O/S | Welcoming is useful, fake welcome is not. Require a contribution to name, age eligibility out, never show a roster of people to “collect”. |
| `long-time` | Thank 1 person not thanked for a month | 50 XP, 10 coins | 1/2/5; S/E | Can encourage connection, but timing invites withholding thanks. Use as a reflection prompt, not a payout for deliberately waiting. |
| `say-why` | 3 thoughtful kudos with 5+ words | 90 XP, 25 coins | 1/2/3/5; O/S | A pair can pad three notes. Count first qualifying pair/day, cap completion reward and use copy about contribution/impact, not word quotas. |
| `three-days` | Thoughtful kudos on 3 distinct days | 90 XP, 20 coins, Party Hog | 1/2/4/5, 8 deadline; S | A weekly schedule can recreate cut streak pressure. Nonconsecutive days, optional task, no reminder or penalty; adapt to feasible opportunities rather than demanding daily output. |
| `detail` | Name 1 exact contribution in a thoughtful note | 50 XP, 15 coins | 1/2/3/5; O/S | Closest to the core purpose, but P11 cannot verify “exact”. Treat as an educational prompt until an evidence-backed assessor is specified; do not silently promise validation. |
| `chime-two` | Chime in on 2 other members' kudos | 60 XP, 10 coins | 1/2/5; S | Click farming possible. First independent eligible contributions only, same limits as direct kudos; avoid simultaneous mandatory giving and endorsement quotas. |
| `chime-other` | Chime in on 1 kudos from another group | 50 XP, 10 coins, clapping emoji | 1/2/4/5; S | Group availability and an actual eligible message are prerequisites. Filter before assignment; use a personal alternative without groups. |
| `chimed` | Get 1 chime-in on your own kudos | 40 XP, 10 coins | 2/5 with 8 social dependency; S | **Replace this task.** Its action depends on somebody else, encouraging requests, reciprocal endorsement and popularity pressure. Reward the original thoughtful recognition directly. |
| `pair-up` | Chime in and thank someone on same day | 60 XP, 15 coins | 1/2/5 with 6 timing; S | The same award must not satisfy both “chime” and “direct give”. Require two distinct actions if retained; remove same-day urgency or replace with a chosen style of participation. |
| Weekly refresh | Read new assignments; optionally replace one unfinished task | 3 opportunities, one free reroll | 3/7, possible 8; S/E | Feasibility filtering comes before reroll. Keep completed unclaimed entitlements; an expired unfinished quest never removes earned XP/coins. Disclose replacement result; no paid rerolls. |
| Completed task | Claim exact reward; replay moment if wanted | Disclosed XP/coins/item, once per quest instance | 2/3/4; O/S/E | Separate entitlement from reveal. Stable member + quest-instance claim ID; redraws and website reloads never grant more. |

All assignments should be offered only when their prerequisites can be met. “One reroll” is agency, not a substitute for correct eligibility.

## Group quests: every prototype definition

Definitions and amounts are [prototype candidates][quests]; [G4][groups] hides group systems when unavailable. Group rewards' recipient scope (every member or contributors only), fixed eligible roster, joining/leaving, deadline and partial completion are **unverified**. The simulation assumes its focal participant receives the stated reward once if the group condition completes. It does not model a payout to every member or a whole-workspace liability.

| Trigger | Action | Candidate reward | Drives; phase | Assessment / concrete change |
|---|---|---|---|---|
| `group-everyone` | Everyone in primary group gives one thoughtful kudos | 120 XP, 30 coins, Surfer Hog | 1/2/4/5, 8 collective pressure; S | Last-member blame and quiet-member exclusion. Recommend contributors earn personal recognition independently and collective progress has no public missing-person list; offer a voluntary participation goal, not unanimity. |
| `group-reach` | Together thank people in 4 other groups | 120 XP, 30 coins | 1/2/5; S | Impossible with fewer than 5 groups. Bound to available groups/peers before assignment, with a group-free equivalent; require genuine reasons, not outreach spam. |
| `group-chime` | Everyone in primary group chimes in once | 100 XP, 25 coins | 2/5, 6 window and 8 obligation; S | Requires both suitable messages and unanimous paid clicks. Replace unanimity with optional independent participation; a colluding trio can farm endorsements. |
| Group grows, shrinks or primary membership changes | Reevaluate progress against roster | Potential completion/eligibility changes | 2/5, possible 8; S/E | Freeze disclosed quest cohort/target at assignment. Changes next period should not confiscate rewards or complete a quest solely because a holdout left. |

## Feature-introduction quests: every mock definition

These are in [quest data][quests] and are **not the Journey**. The accepted schedule is [unlocks][unlocks]. The mock picks only a feature at the current or previous level; that can hide an unfinished intro task after a fast level jump. Recommend persistence until done or dismissed.

| Feature / trigger | Candidate action | Reward | Drives; phase | Assessment / concrete change |
|---|---|---|---|---|
| Leaderboard opened at L3 | Thank someone in another group | 50 XP | 1/2/5; O/S | Link ranking back to recognition, but offer a group-free equivalent. Viewing the board is not a rewarded action. |
| Book opened at L4 | Get thanked by 2 people not yet in albums | 70 XP | 2/4/5, 8 dependency; O/S | **Replace “get thanked”.** Learn the private book and optionally recognise a contribution; receiving requests turn thanks into a transaction and can be impossible after roster saturation. |
| Skills opened at L5 | Spend first skill point | 50 XP | 2/3/4, 6 pressure; O | Rewards irreversible spending despite “save for later”. Teach inspect/choose/save with no XP for spending; the simulation retains the mock payout once to expose the effect. |
| Inventory opened at L6 | Equip emoji, thank 3 people with it | 80 XP, 20 coins | 1/2/3/4/5; O/S | Expressive, but a 3-person quota fails in a 3-member workspace with only 2 peers. Require at most one natural recognition or just teach equip/unequip without numerical reward. |
| Collection opened at L7 | Choose avatar, then one thoughtful kudos | 60 XP, 15 coins | 1/2/3/4/5; O/S | Keep avatar changes free; no repeat rewards on equip. Explain rewards and preserve no-avatar-change choice. |

There is no separate intro quest for Quests or Coins in the pinned data, despite “bonus per new unlock”; the prototype has 7 feature entries, but only 5 intro quests. #86 should settle this mismatch explicitly, rather than infer missing rewards. [Quest definitions][quests]; [feature schedule][unlocks].

## Journey: separate proposed onboarding chain

**Confirmed:** the Journey is retained as the first quest chain. **Unverified:** its steps, targets, rewards and availability relative to the L2 quest unlock. Both corrected comments state that the prototype does not show it. Every round comment and source file was searched; no accepted step list was found. [Round 9][cut]; [handoff][handoff]; [pinned prototype][prototype].

The following chain is a **research proposal**, simulated separately. Make it available with the L1 basics while its last step explains the L2 quests. Let members skip or return; no time limit, no mandatory reciprocal kudos, no need to solicit received thanks. The proposed chain adds **zero XP or coins** beyond the ordinary awards it teaches, so it cannot accelerate itself by teaching members to click screens.

| Proposed step / trigger | Action | Reward | Drives; phase | Risk and counterweight |
|---|---|---|---|---|
| J1. First welcome | Learn mention + emoji, allowance and brief-vs-specific notes; choose notification preferences | Understanding and control, no numerical payout | 1/2/3/5; O | Avoid a mandatory modal before thanks; a receiver can learn without giving back. |
| J2. A contribution worth recognising | Give one note naming contribution and impact, to anyone eligible | Normal award, base XP and qualifying effects only | 1/2/3/5; O | No named target or date deadline. Specificity is an authoring prompt; automated semantic verification remains unverified. |
| J3. First award receipt | Read what was given/spent; understand receiver has no debt | Feedback and competence, no extra coins/XP | 2/3/5; O | Do not add a “thank them back” button or notification. A failed attempt can explain retry without rewarding resubmission. |
| J4. Quests available at L2 | Choose a feasible optional task, save for later or dismiss | Transition to recurring play, no spending/visit reward | 2/3/5; O→S | The Journey must not block receiving-only progression or become a weekly streak. |

The synthetic optimiser is marked as padding notes, so J2's proposed **specificity** step is not shown as genuinely completed. Production P11 alone cannot make that distinction. Quiet receivers keep J1 while progressing automatically; the uncompleted chain never blocks levels/features. This is a modelling annotation, not a claimed content classifier. [Length gate P11][progression].

## Leaderboard and profile side loops

Facts here come from [G13–G30][groups], overridden where explicitly accepted by [#62 rounds 6/7][round6] and [the cut handoff][handoff]. The website can expand beyond G17's initial window; other members still do not see received totals, coins, perks or private albums. Removing hide-level/achievement switches does not authorise exposing every private fact. [Round 7][round7]; [map #57][website-map].

| Trigger | Action | Reward / result | Drives; phase | Assessment / concrete change |
|---|---|---|---|---|
| Board opens at L3 | Compare kudos **given** this week/month/all-time | Relative rank, no XP/coins/item payout | 2/5; O/S/E | Counts volume, not thoughtfulness or work performance. Say exactly what it counts; do not tie quests or cosmetics to rank. |
| Individual total changes | Give units; view shared-rank table | G16 ties share rank; default window centred on viewer; website expands | 2/5, 8 possible status loss; S | The padded 15-unit giver outranks a specific 10-unit giver. Preserve honest count semantics; make personal reflection primary and expanded comparisons optional. |
| Primary groups have 3+ members | View group score = given total/current primary members | Per-person standing, participation tie-break, then total/name | 2/5; S/E | Small groups with <3 primary members cannot rank. Membership can change a score with no new thanks; disclose denominator and avoid conflating a rank change with a behavioral improvement. |
| Viewer opens My group | See currently primary peers' awards attributed to that group | Local comparison and own position | 2/5; S | Excludes history attributed to an old group. Explain attribution; never invite switching groups to boost standing. |
| Improvement over same day last period | Read private increase/best-period line and eligible peer comparison | Positive comparison, never a displayed loss | 2/5, possible 8 implied pressure; S/E | No explicit loss helps, but “best ever” can become a quota. Keep optional, no target to exceed one's past volume and no countdown to protect rank. |
| Visibility/notification choice | Opt out where G22 still applies; control notices | Private progress stays; group attribution remains | 3/5; O/S/E | Hide-level switches are cut; **leaderboard opt-out and notice/DM controls are separate and should remain** unless #86 explicitly changes them. Clarify this distinction rather than restoring rejected switches silently. |
| Monday group post enabled | Read group-only summary | Shared celebration, no numeric payout | 1/2/5; S/E | Name groups only, avoid individual winner/loser pressure; no post in an empty week. Keep administrative opt-in. |
| Teammate opens profile card | View avatar, allowed level/achievements and group | Expression and recognition | 3/4/5; D/S/E | Public-by-default progress can feel evaluative. Put “recognition game, not a performance measure” beside shared standings; never expose received count or private relationships. |

## Book: stickers and albums

The canonical rule is **either direction**: one sticker per person the owner thanked **or was thanked by** (G31). The unlock teaser says only “Every teammate who thanks you becomes a sticker”; that is incomplete. [Groups G31–G36][groups]; [prototype unlock copy][unlocks].

| Trigger | Action | Reward | Drives; phase | Assessment / concrete change |
|---|---|---|---|---|
| First award involving a person, either direction | Give or receive, thoughtful or brief | Their sticker, once; recorded even before Book opens | 2/4/5; O/S | A memory of connection is useful. Never tell members a colleague is a missing collectible they must obtain. Make “given or received” clear. |
| Book opens at L4 | Browse own stickers and private group albums | Reveal banked history | 2/3/4/5; O/S | No reward for browsing; no public missing slots or completion comparison. Keep incoming thanks free of solicitation. |
| Every current page of an album covered | Recognise naturally across a group, or receive from it | Once-only album completion, Team Spirit threshold if applicable | 1/2/4/5; S/E | Completion invites exchanging thanks purely for stickers. Do not reward targeted album-filling quests; show history without “ask this person to thank you”. |
| A group member leaves | G34 recomputes current pages | Album may complete without another award | 2/4/5; S/E | Legitimate membership bookkeeping, not new gratitude. Retain completion but do not emit copy saying new thoughtful work earned it. |
| New group member arrives / group archived | Update pages, retain previously completed album | Existing completion stays; archived album cannot complete later | 2/4/5; S/E | This counters CD8 loss aversion. State that earned completion is permanent and the new person is an opportunity, not a broken collection. |
| No available groups | Browse plain stickers | Same private book, no albums or Team Spirit | 2/4/5; O/S/E | An absent paid-plan feature must not block independent progression or make the book look broken. |

## Achievements: every retained ladder

Thresholds inherit [P58/P59][progression], with Momentum removed and rewards replaced by [the accepted cut][cut] and [prototype reward table][rewards]. All achievements use ungated history under P13/P59. Every tier is permanent and awarded once. Shared tier rewards are **bronze 10 coins; silver one named kudos emoji; gold one named hedgehog; diamond 100 coins plus a named hedgehog**. They give no XP or skill points. This creates a monetary reward for ungated counting; merely saying “thoughtful kudos earn coins” no longer describes every coin source.

| Ladder | Trigger/action and four thresholds | Drives; phase | Main-loop risk / concrete change |
|---|---|---|---|
| Generosity | Given units: 1 / 25 / 100 / 500 | 2/4/5; O/S/E | Repeated emoji and reciprocal padding earn tiers and coins. Keep historical milestone recognition, but propose bonus/reward counting on qualifying recognitions for future tiers; do not claw back existing tiers. |
| Recognition | Received units: 1 / 25 / 100 / 500 | 2/4/5; O/S/E | Soliciting and popularity farming. Never assign “get X kudos” tasks or compare receivers publicly; keep automatic recognition without a demand to reciprocate. |
| Connections | Unique people thanked: 3 / 6 / 12 / 24 | 1/2/4/5; S/E | Breadth good, roster harvesting bad; 24 peers impossible in a small workspace. Disclose feasibility, do not fill empty slots with pressure; no guaranteed diamond for every workspace. |
| Dependability | Days with any giving: 10 / 30 / 100 / 250 | 2/4/5, possible 8; S/E | Not a streak; don't recreate one through copy or daily reminders. Counts persist across gaps; say “days over your history”. |
| Applause | Days thanking 3+ distinct people: 3 / 10 / 30 / 100 | 2/4/5; S/E | Implies spending all default allowance and fails with only 2 peers. De-emphasise; propose a breadth milestone independent of daily exhaustion. |
| Seasons | Calendar months with giving: 1 / 3 / 6 / 12 | 2/4/5; S/E | Low burden but may become a monthly checkbox. Celebrate continuity; never threaten loss if a month is skipped. |
| Old Friends | Repeat thanks after ≥30 days since prior thanks: 1 / 3 / 6 / 12 | 1/2/4/5; S/E | Timing rewards withholding recognition. Use a reflective history milestone, never a countdown to when a person becomes rewardable. |
| Team Spirit | Primary-group completed album first; then 2 / 4 / 8 albums | 1/2/4/5; S/E | Depends on group count, size and current roster; paired swaps can fill albums. Hide without groups; never promise all tiers or reward asking for missing stickers. |
| Crowd Favourite | Chime-ins on authored kudos in total: 5 / 10 / 20 / 50 | 2/4/5, 8 social dependency; S/E | Campaigning for endorsements. Automatic historical celebration only; no “get people to join” prompts. |
| Standing Ovation | Maximum chime-ins on one received kudos: 3 / 10 / 20 / 50 | 2/4/5, 8 popularity; S/E | High tiers structurally unavailable in small workspaces. No recipient competitions or outreach tasks; label it as historical celebration, not expected progression. |
| Amplifier | Chime-in actions: 5 / 25 / 100 / 500 | 1/2/4/5; S/E | Paid-click farming. Share once-per-message and qualification limits; no XP multiplier for hitting a chime-in threshold. |

Catalogue inconsistency: `hedgehogs.ts` names Explorer as Social Butterfly and Wizard as Patron of Praise, while `book-rewards.ts` names Tourist Hog for Connections gold and Angel Hog for Generosity diamond. Several quest/store hogs also exist outside the shelf's 12 entries. #86/#27 need one stable reward/item catalogue, not independently named UI rewards. [Shelf][hogs]; [tier reward table][rewards]; [quest items][quests]. The simulation uses stable synthetic entitlement IDs for these conflicting rewards; it does not assert a final item mapping.

## Skill tree: all 14 perks

Levels, costs and strengths below come from [the post-cut tree][tree], overriding pre-cut P18. **SP** = skill points. Upgrades replace the lower effect, never add both. All numeric effects are triggered by thoughtful/qualifying recognition under the proposed P16 interpretation; the mock copy omits the gate for some perks. Base XP stays ungated. [P13/P16/P19–P22][progression].

Every choice uses CD2/3/4 (progress, autonomy and ownership), with CD6 for level/price gates, in O/S/E. The individual social drive and trigger risks are shown below; no perk is needed to give valid kudos.

| Perk | Trigger / action | Reward effect | Gate / price | Risk / concrete change |
|---|---|---|---|---|
| Spark | First qualifying recognition of day | +5 XP | L5; 1 SP | “First kudos” omits thoughtfulness. Make copy accurate; no morning reminder or obligation. |
| Flame | Choose upgrade of Spark; same daily trigger | +10 XP replaces +5 | L7; 1 SP + 150 coins | Disclose full replacement effect before permanent spend. |
| Rhythm | Give qualifying recognition | +2 XP | L5; 1 SP | Changed from pre-cut weekly schedule. Count first pair/day, not every split award or emoji unit. |
| Cadence | Upgrade Rhythm; same trigger | +4 XP replaces +2 | L7; 1 SP + 200 coins | Same farming cap; no resurrected workday streak. |
| Circle | First qualifying thanks to each peer/week | +5 XP | L5; 1 SP | CD5 breadth, but low-effort harvesting possible. Require a reason and don't display a named target list. |
| Bridge | Upgrade Circle; same trigger | +5 inside, +10 outside group | L7; 1 SP + 150 coins | CD5 cross-group relatedness; group-free semantics unsettled. Recommend neutral +5 where no groups exist, disclose that upgrade's external condition. |
| Treasurer | Give qualifying recognition | +2 coins | L7; 1 SP | A literal “each thoughtful kudos” per award breaks P16's limit. One first pair/day, shared with normal giving coins. |
| Banker | Upgrade Treasurer; same trigger | +4 coins replaces +2 | L9; 2 SP + 250 coins | Same cap; no compounding, no multiplying by emoji units. |
| Focus | Voluntarily activate one day/week; next 3 qualifying recognitions that day | +12 XP each | L9; 2 SP | CD6/8 active-day urgency without a white-hat counterweight. No nag/countdown; require distinct qualifying pair/day actions; let unused charges lapse without scolding. |
| Spotlight | Upgrade Focus; same activation | +24 XP replaces +12 | L12; 2 SP + 300 coins | Keep voluntary activation and same cap; no “use it now” promo. |
| Echo | First thoughtful received award per distinct giver/week | +3 XP | L9; 2 SP | CD5 receiving path, but trading eligible. Never tell the receiver to request thanks; repeated units/giver cannot repeat the bonus. |
| Resonance | Upgrade Echo; same receiver trigger | +8 XP replaces +3 | L12; 2 SP + 300 coins | Same distinct-giver cap; allow quiet progress without giving quests. |
| Reserve | Own perk at next Monday refill; thoughtful spend after daily pool | +2 weekly bonus kudos | L9; 2 SP | CD6 allowance competition: owners can outscore others by capacity. Explain base vs reserve; unspent reserve isn't a lost reward, and brief thanks cannot spend it. |
| Reservoir | Upgrade Reserve at next refill | +4 weekly bonus kudos replaces +2 | L12; 2 SP + 350 coins | Same timing and leaderboard-capacity trade-off. Do not sell reserve for coins or add cut auras. |
| Purchase or save | Inspect disclosed effect/cost; choose or defer | Atomic debit/grant, permanent ownership; no respec in inherited P5 | As above | Irreversibility + paid intro quest can cause fear. Keep “save for later”; no reward for spending a point, no glowing must-buy prompts. |

The cut reduces SP growth, not just visual tree size. L8 has earned 4 total points; L12 has 8. The whole tree costs **21 SP plus 1,700 coins**, so all 14 nodes are not attainable before L25 even with unlimited coins. The simulation exercises all nodes through the long giver runs; the quiet receiver prioritises Echo/Resonance and preserves unused points. These totals are arithmetic from [the tree][tree] and `max(0,L−4)`, not a suggested requirement to complete the tree.

## Coins, store, emoji and hedgehogs

Inherited coin limits are [P16/P29/P30][progression], amended by new quest and tier rewards in [the cut][cut]. Candidate store prices and item sources are [emoji catalogue][emoji] and [hedgehog shelf][hogs]. With rarities cut, those prices are exact item prices, not a hidden rarity economy. Long-run balance after adding quest/achievement income has not been accepted; this simulation is evidence for rebalancing, not a price decision.

| Trigger | Action | Reward / cost | Drives; phase | Assessment / concrete change |
|---|---|---|---|---|
| Coins opened at L6 | Give first thoughtful pair/day | 4 coins, plus Treasurer/Banker if owned | 1/2/4/5; S | Brief awards give no normal coins, but quest/tier rewards can. Show separate earning sources; no “every thanks pays”. |
| Thoughtful recognition received | First distinct giver/week | 2 coins, capped at 20/week | 2/4/5; S/E | Never attach a reciprocal obligation; progress can come from being appreciated. |
| Earn reward before its surface opens | Complete quest/tier/level condition | Stored coins/items; visible/useable at feature opening | 2/4, 6 waiting; O/S | A declared assumption. Bank immediately, show “saved for inventory” rather than “lost until L6”. Coin earning activation must be independent of animation or an absent website. |
| Choose exact store emoji | Buy Raised hands or Party popper | 80 / 120 coins, respectively | 3/4; S/E | Pure expression. Preview exact item; no random pack, real-money shortcut, transfer or coins-to-kudos conversion. |
| Choose exact store hog | Buy Bookworm / Gardener / Chef / DJ / Angel | 120 / 300 / 700 / 1,500 / 3,000 coins | 3/4; S/E | Prices persist from older rarity design; added quest income changes attainability. Rebalance against combined income, retain deterministic cosmetic-only purchases. |
| Inventory available; choose up to 3 emoji | Equip/unequip owned emoji | Expressive language, each still worth 1 unit | 3/4/5; O/S/E | Explain parser ownership and slots. The standard emoji stays available; changing slots must not retroactively reparse an accepted award or earn quest rewards again. |
| Buy or equip command retries | Repeat click/reload/replay | Same purchase/entitlement, no second debit or reward | 3/4; S/E | Require atomic command and stable idempotency key; reveal is read-only after grant. |
| Starter or level threshold | Receive Sunday Hog, L5 Super Hog, L8 1-Up Hog, L10 Rocket Hog | Named avatar entitlement | 2/4; O/S/E | L5 hog precedes L7 collection; do not advertise equip until usable. Level gating is CD6, countered by clear earned entitlement and control. |
| Gold/diamond achievement or quest | Complete disclosed milestone | Named hog, no rarity or random drop | 2/4/5; S/E | Never demand thanks for a cosmetic; source/identity must reconcile across catalogues. Duplicate-item fallback is unverified. Recommend no XP/coin conversion unless #86 specifies it. |
| Collection opened at L7 | Pick owned avatar or keep starter | Same avatar in HUD/card/board | 3/4/5; O/S/E | Identity, not a recognition advantage. Free switching, no stat boost or public catalogue-completion leaderboard. |

Illustrative coin attack, independent of the long-run purchase policy: a padded pair splitting 3 units into 3 accepted notes each weekday gets P29's **20 base giving coins/week** (first pair/day only). A literal Banker +4 per award adds 60, total **80**; bounded Banker +4 per qualifying pair/day adds 20, total **40**. Received coins add **2** for that one giver/week in either case. This does not remove fake gratitude; it halves one bonus exploit. A genuine breadth giver thanking 3 distinct peers/day would still earn `15 × (4 + 4) = 120` giving coins with Banker. [P16/P29][progression]; [Banker][tree]; [runnable boundary assertions](octalysis-simulation.ts).

No amount of these caps proves thoughtfulness: the P11 gate still accepts any five countable words. #86 can bound economy exposure now; a stronger assessor would be a separate requirement, not a feature silently invented by this research.

## Progressive unlocks and crates: every level and beyond

XP thresholds are [P3][progression]; feature states and schedule are [the accepted handoff][handoff] and [prototype unlocks][unlocks]. In Octalysis terms, gradual disclosure can combine CD2 accomplishment and CD3 agency with CD6 scarcity. A concealed outcome adds CD7. The white-hat counterweight is knowing what one earned and opening it at one's own pace.

| Level / XP trigger | Action | Reward / next availability | Drives; phase | Assessment / concrete change |
|---|---|---|---|---|
| L1 / 0 | Learn basics; use regular kudos | Starter avatar, allowance, own profile | 1/3/5; D/O | No game feature is required to express thanks. Journey may start here as a proposal. |
| L2 / 20 | Open Quests crate | 3 personal tasks, optional group task and retained first quest chain | 2/3/4 + 6/7 if hidden; O | Preview named feature, make pending tasks feasible. Quest XP can jump several early levels; avoid a cascade of modal obligations. |
| L3 / 100 | Open Leaderboard crate | Given-count standings | 2/3/5 + 6; O/S | No XP for viewing it. Prefer personal context, no “race to win” onboarding. |
| L4 / 300 | Open Book crate | Historical stickers/achievements | 2/3/4/5 + 6; O/S | Reveal existing history, not a demand to fill named gaps. Bank earlier tier rewards. |
| L5 / 600 | Open Skills crate; choose or save point | First SP, base row; L5 hog banked | 2/3/4 + 6; O/S | First irreversible choice needs exact cost/effect and “save”. Do not mint extra XP for opening/spending. |
| L6 / 1,000 | Open Coins and Inventory (2 entries) | Wallet, banked items, emoji slots | 2/3/4 + 6; O/S | One calm combined overview may explain both; respect their distinct backend opened states. Reveal cannot determine when earnings exist. |
| L7 / 1,500 | Open Collection | Avatar shelf; second perk row now eligible | 2/3/4/5 + 6; S | Perks and store compete for coins. Keep expression optional and no random purchase. |
| L8 / 2,100 | Continue natural giving/receiving | 4 lifetime SP; 1-Up Hog; no new system | 2/4/5; S | Explicitly show “no new feature” rather than inventing a mystery crate. New members can still be learning earlier features. |
| L9 / 2,800; L10 / 3,600; L12 / 5,500 | Choose deeper perk/level cosmetic if wanted | L9/L12 rows; L10 named hog/emoji; points keep accruing | 2/3/4/5; S/E | Continued levels need meaning beyond a completion chase. Thank real work, revisit connections, choose expression; no infinite escalation of required output. |
| Several levels reached before return | View all ready items; open later or show details | Every earned entitlement, one batch notification | 2/3/4; O/S/E | Never lose/reorder grants or force 7 full-screen reveals. Accessible “view reward” action; replay is decorative. |
| Reduced motion, screen reader, repeat visit | Read end state immediately | Same earned feature/reward | 2/3/4; O/S/E | No surprise or timing requirement. Visible exact content before action keeps CD7 from becoming a loot-box promise. |

**Crate distinctions:** a feature crate opens a named system; a quest crate pays its exact earned reward; an achievement moment presents a historical tier entitlement. They must not share an ambiguous “roll” operation. Opening/replaying never changes the reward. This follows deterministic store/effect principles [P8/P30/P32][progression] and is a recommendation for the new crate design, not a verified backend implementation.

## What the synthetic simulation establishes

The [source](octalysis-simulation.ts) models six personas in both candidate and bounded modes for 104 weeks. It applies the real inherited XP/coin formulas, post-cut tree parameters, candidate quest/tier rewards and the explicitly listed temporal assumptions. It outputs 1,248 weekly state rows and trigger/action/reward traces for every level, feature opening, perk purchase, tier, store purchase and proposed Journey step. Controlled scenarios cover chime-in boundaries, a reciprocal ring, group/album roster changes and durable claims. [Generated results](octalysis-results.md); [weekly ledger](octalysis-weekly.tsv); [milestone trace](octalysis-trace.md).

The simulation is intentionally not the production Convex engine or a semantic note assessor. It proves arithmetic and exposes incentives under synthetic inputs. Its invariant checks reconcile total XP with base/perk/quest components, earned coins with sources, nonnegative balances, SP from L5, exact threshold boundaries, repeated-opening effects and no-group personal-quest eligibility. Controlled proposal checks show what durable claims should do, not that the app already does it.

| Synthetic persona | Candidate L8 week | Bounded L8 week | Key observation |
|---|---:|---:|---|
| New member (5 given, 2 received/week) | 6 | 6 | Several unlocks occur early; quest income, not the base curve alone, drives onboarding. Journey can complete without extra numerical rewards. |
| Thoughtful giver (10/3) | 5 | 5 | Breadth and specific reasons fit the tasks, but perks/quests eventually dwarf base XP; preserve recognition as the purpose. |
| Quiet receiver (0/6) | 70 | 70 | Progression still reaches L8. Journey J2 and giving quests remain optional; no solicitation or forced return-thanks needed. |
| Optimiser (15/15 reciprocal; padded notes) | 6 | 6 | Bounded run reduces final XP from 51,111 to 43,313 and earned coins from 11,079 to 6,577, but does not identify insincerity or stop base-XP farming. |
| Small group (5/3; only 2 peers) | 10 | 7 | Candidate initially offers 156 infeasible personal tasks over 104 weeks; one reroll cannot repair the pool. Unanimity quest also fails. |
| No groups (10/3) | 7 | 5 | Candidate likewise offers 156 infeasible tasks. Filtering restores opportunities; Everyone and plain sticker book remain available. |

These outputs depend on the declared purchase and automatic-opening policy. The candidate-vs-bounded comparison changes **both** bonus counting and personal quest eligibility, so its long-run differences cannot be attributed to one change alone. In particular, eligibility can accelerate the farmer's early unlocks while limits reduce the eventual payout. Do not advertise these weeks as a product promise.

All synthetic notes pass the five-word gate; the new member's recent-joiner opportunity ages out after 13 weeks. Recipient identities represent fixed anonymous peer slots, not real people. The baseline produces no chime-ins and does not aggregate a complete social network: recipient awards are external inputs, group unanimity is declared, and multi-member Group Reach aggregation is outside the baseline. The controlled cases make the limitations visible rather than presenting empty achievement counts as evidence those loops are safe.

### Separate trigger/reward sensitivities

- **Base-XP trading:** a member giving 15 and receiving 15 units per weekday week gets `15×10 + 15×5 = 225 XP`. A giver with the same giving but no receives gets 150. The rules reward counted units and social opportunity, not verified contribution quality. [P1][progression].
- **Early quest jump:** 2 giving units reach L2 at 20 XP. A later one-unit new-face award adds 10 base XP and its 60-XP quest reward, reaching 90. Any further 10 base XP reaches L3. Whether earlier activity can satisfy an assigned quest must be specified; the simulation's weekly retrospective credit is an assumption. [P3][progression]; [quest amounts][quests].
- **Starter triple bundle:** `new-face` 60 + `say-why` 90 + `three-days` 90 = **240 quest XP**, against 150 base XP for using all 3 allowance each weekday. Those three are all satisfiable by five genuine daily notes if a new recipient exists, or by padded notes plus one new peer. They are not a neutral decoration on the base curve. [Quest pool][quests].
- **Bonus splitting:** the Banker sensitivity above is 80 vs 40 giver coins/week for the pair. Rhythm/Cadence and Focus/Spotlight likewise need recognition limits, with Focus restricted to genuinely qualifying first pair/day events. [Tree][tree]; [P16/P22][progression].
- **Roster distortion:** 9 attributed units / 3 primary members = **3.0**; the same total / 4 members rounds to **2.3**. A departing unthanked album page can complete an album. Neither event establishes more gratitude occurred. [G20/G34][groups]; [controlled trace](octalysis-trace.md).
- **Chime-in affordability:** for a thoughtful two-recipient message, an independent observer with 3 daily units spends 2, gets 20 giver XP and 8 giving coins (first qualifying pair/day), and leaves 1 daily unit. A duplicate/re-add does not repeat it; the original giver and recipients cannot join. A third colluder can complete endorsement quests where a pure pair cannot. [P46–P50/P16/P29][progression]; [controlled assertions](octalysis-simulation.ts).
- **Supply of high tiers:** 24 unique-person Connections diamond, 8 albums for Team Spirit diamond, and 50 independent chime-ins for Standing Ovation diamond need a sufficiently large social graph. A two-peer workspace cannot satisfy those by sincere repetition; adapt available goals, not the people. [P58][progression]; [G33/G36][groups].
- **Income saturation:** in the long candidate giver run, base XP is 14,580 of 58,861 total, and 15,567 coins are earned with only 1,700 upgrade + 200 illustrative store spending. The large leftover wallet is a consequence of adding repeated quest/tier/perk income to old prices and a finite synthetic shopping policy. It demonstrates the need for a combined economy model; it does not prove everyone will hoard that balance. [Generated results](octalysis-results.md); [tree][tree]; [store prices][hogs].

## Game-rule recommendations to re-spec #86 (cross-map, conductor relay)

These are recommendations, not edits to map #1 or #86. They are ordered for the smallest safe specification change.

1. **Keep recognition valid and its length gate honest.** P11 remains a cheap proxy; teach a concrete contribution and impact, never equate five words with proven thoughtfulness. Keep brief thanks and ungated base XP, but acknowledge that the daily allowance rate-limits rather than prevents reciprocal farming. [P1/P11/P13][progression].
2. **Define one shared bonus recognition unit.** First thoughtful giver-recipient-day, irrespective of units, split messages or direct/chime-in entry. Apply it to Rhythm/Cadence, Treasurer/Banker, Spark/Flame and Focus/Spotlight; Echo/Resonance remain first distinct thoughtful giver/week. This bounds extraction without retracting accepted awards. [P16/P17/P20][progression]; [tree][tree].
3. **Make feasible personal choices before a reroll.** Eligibility must include available groups, peers, recent-joiner age, unseen peers, prior-history timing, chime-in capability and task preconditions. Define group-free alternatives with equivalent reward budgets; no named person, “get thanked” or “get endorsed” task. Keep no-group progression complete without albums or group quests. [Quests][quests]; [G4][groups].
4. **Set a quest-XP budget against the level curve.** Retain the candidate reward types but **do not carry 40–120 XP amounts into the spec unexamined**. Recommend at most 20 bonus XP per personal quest and 60 total personal-quest bonus XP/week as a first re-simulation candidate, with no additional weekly XP for group or interface-intro tasks. This is an explicit new proposal, not simulated/validated balance. Prefer group cosmetics/celebration with independent participant entitlements and avoid stacking multiple reward systems on the same three notes. [Candidate amounts][quests]; [P3][progression]; [results](octalysis-results.md).
5. **Retain the Journey as education.** Confirm its actual steps; until then, use the clearly proposed J1–J4 chain here. Start with basics, no expiry, no reciprocal task, no extra XP for reading, opening or spending. Receiving-only members keep progressing independently. [Journey retention][handoff].
6. **Separate earned entitlement, enabled capability and reveal.** Record exact quest/tier/item grants once; completed unclaimed quests survive Monday; pre-unlock coins/items bank; openings/replays never mint rewards. Define when ordinary coin earning begins independently of whether the website is built or an animation has played. Recommend activation when the capability is enabled/ready, with opened state controlling presentation only. The simulation currently starts ordinary coins after opening, so it is not proof of this alternative. [P8/P9/P30/P32][progression]; [unlocks][unlocks].
7. **Remove collective blame.** Replace unanimity and externally dependent tasks with voluntary participation and individual qualifying contributions; freeze disclosed group cohorts for each assignment, and settle join/leave attribution. Never publish a missing contributor list. Group reward scope and aggregate accounting must be specified and simulated before implementation. [Group quest definitions][quests].
8. **Keep cosmetic purchases deterministic.** Exact item/price, no random packs, paid rerolls, transfer or coins-to-allowance. Unify stable catalogue IDs and rewards; decide duplicate behavior and prices using coins from giving, receiving, perks, quests and achievements together. [P30/P32][progression]; [catalogue mismatch][hogs]; [tier mapping][rewards].
9. **Make milestone trade-offs explicit.** Existing ladder counts are ungated. Coin rewards for Generosity/Recognition/Applause can monetise volume. Recommend qualifying/breadth-based bonus rewards for future milestones, with historical earned tiers preserved and no new targeted album-completion task. Avoid expecting every workspace to earn every graph-dependent diamond. [P13/P58/P59/P61][progression].
10. **Preserve non-ranking and independent controls.** Levels, received counts, coins and achievements are not performance rankings. Keep G22 leaderboard participation and P63/muted notice controls separate from the explicitly cut hide-level/achievement switches. No XP or item reward for rank. [P63/P66][progression]; [G13/G22/G26/G28][groups]; [accepted privacy change][round7].
11. **Remove remaining crowd thresholds unless explicitly redesigned.** The cut removed Crowd boosters; retain simple endorsements but do not inherit P53 recipient XP multipliers accidentally. Explain Focus timing calmly and don't recreate streak pressure through three-days quests. [P51–P53][progression]; [cut][cut].

Before #86 locks numbers, rerun (a) the lower quest-budget proposal independently of eligibility fixes, (b) a legal padded pair and colluding trio, (c) two-peer and no-group rosters, (d) receiving-only progression, (e) delayed openings/claims, and (f) all monetary sources against finite cosmetics. This ticket's combined candidate/bounded runs deliberately do not claim to optimise those numbers.

## Website recommendations for this map

- **#63 visual-language grilling:** put the actual contribution/thanks before XP, coin and crate chrome. Preserve one primary action, neutral progress bars, one-off optional motion and reduced-motion end states from the accepted handoff. Crates should say their exact named feature/reward before opening; no concealed odds, rarity glow, timed wobble or recurring “open now” pulse. These are recommendations for applying the accepted style to its most vulnerable motivations. [Handoff][handoff]; [Chou CD7][cd7].
- **#65 first-slice spec:** ship the authorised sign-in/profile facts first: own allowance, given/received facts already available. Do not imply later XP, coin, quest or Journey state exists. Where future states are designed now, derive `locked`, `ready`, `opened`, `in progress`, `earned/unclaimed` and `claimed` from backend facts; website code never computes rewards or eligibility. [Website map][website-map]; [accepted architecture][architecture].
- **#62 prototype handoff:** keep the retained Journey visible as a first quest chain in a follow-up, with its steps explicitly settled by #86. Distinguish it from feature-introduction quests. Correct “Book is incoming thanks only”, “anyone can top it” and gate-omitting perk copy; reserve and social opportunity already make that leaderboard promise imprecise. [Unlock copy][unlocks]; [G31][groups]; [tree][tree].
- **#64 architecture follow-through:** query exact entitlement IDs, reward items/amounts, conditions, feasibility reasons, earned timestamps, unopened feature set, notification preferences and privacy-scoped data. Commands should use stable idempotency keys for claim, open, buy and equip, with grant/debit on the backend. A reveal reads the recorded result. This fits the accepted platform-neutral command ownership; it adds no website game engine. [Architecture handoff][architecture]; [P8/P19/P30][progression].
- **Every later surface:** show `No group features here` only when useful, with normal personal quests, Everyone and stickers working; don't render unreachable progress as a broken or incomplete account. A quest hint teaches rather than names a target. A completed reward remains available without a countdown. Public cards and standings never reveal receiver totals, coins or private sticker gaps. [G4/G22/G28/G31][groups].
- **Repeated visits and returns:** batch pending unlocks, let the user read exact rewards without full-screen animation, and allow “later”. Saving a point or keeping the starter avatar is an acceptable outcome. The absence of a Journey/quest completion should never shame a quiet receiver. [Accepted motion][handoff]; [Chou ethics][ethics].

## Verification, calls and limitations

The runnable artifact was executed and checked against the actual generated ledger. An independent GPT-6.1 Sol source reader verified formulas/catalogue parameters and reconciled all 12 runs. Its newcomer-progress finding was fixed by explicit eligible-newcomer progress and a 13-week age limit; its Focus-label and distinct-other-group findings were fixed in the code/report. A final source check also made newly bought reserve capacity wait until the next Monday refill, and ledger assertions verify that timing. The source reader's primary-source work and audit were read-only.

Local verification uses `bun research/octalysis-simulation.ts --check`, a full simulation run, byte-for-byte deterministic regeneration, and `~/dev/fleet/fleet heavy -- pnpm gate`. The gate includes strict TypeScript, 218 existing tests and Coherence spec/vocabulary checks. Journey's confirmed name was declared only on this throwaway branch, without declaring proposed steps as accepted rules. No production backend, deployment, primary map, other ticket or PR was changed.

Calls made here: use the accepted cut over older conflicting prose; retain Journey while reporting absent source steps; use publicly available book adaptations rather than pretend to cite inaccessible pages; treat prototype amounts as candidate inputs; preserve unspecified matters as assumptions; isolate recommendations for #86 from website presentation for #63/#65. No human decision is needed to publish those research findings. Final numbers, semantic thoughtfulness assessment, group payouts/aggregation, duplicate rewards, exact item mapping, coin activation and actual Journey steps remain for #86 and later content work.

The initial dependency symlink prevented pnpm's dependency verification from installing into the worktree; it was removed and replaced with an isolated frozen-lockfile install before a clean passing gate. A preliminary Coherence check flagged the undeclared Journey; the final definition contains only its confirmed retained-first-chain meaning. The research vocabulary baseline `d-a9934b5b` explicitly holds nine unresolved source/proposal candidates on this throwaway branch; it is not a production vocabulary ruling. The final gate uses that disclosed baseline, with no rejected names or findings beyond it. No production code or Coherence enforcement configuration changed to make those checks pass.

## Framework and context references

[book]: https://yukaichou.com/actionable-gamification-book/
[cd1]: https://yukaichou.com/gamification-study/8-core-drives-gamification-1-epic-meaning-calling/
[cd2]: https://yukaichou.com/gamification-study/8-core-drives-gamification-2-development-accomplishment/
[cd3]: https://yukaichou.com/gamification-study/8-core-drives-gamification-3-empowerment-creativity-feedback/
[cd4]: https://yukaichou.com/gamification-study/8-core-drives-4-ownership/
[cd5]: https://yukaichou.com/gamification-study/8-core-drives-of-gamification-5-social-influence-relatedness/
[cd6]: https://yukaichou.com/gamification-study/8-core-drives-gamification-6-scarcity-impatience/
[cd7]: https://yukaichou.com/gamification-study/the-8-core-drives-of-gamification-7-unpredictability/
[cd8]: https://yukaichou.com/gamification-study/8-loss-and-avoidance/
[hats]: https://yukaichou.com/gamification-study/white-hat-vs-black-hat-gamification/
[axes]: https://yukaichou.com/gamification-study/left-brain-extrinsic-brain-intrinsic-core-drives-gamification/
[phases]: https://yukaichou.com/gamification-examples/gamification-4-experience-phases-of-a-game/
[pbl]: https://yukaichou.com/gamification-study/points-%62adges-and-leaderboards-the-gamification-fallacy/
[ethics]: https://yukaichou.com/gamification-study/gamification-manipulation-ethics/
[round6]: https://github.com/Silthus/kudos/issues/62#issuecomment-6150776028
[round7]: https://github.com/Silthus/kudos/issues/62#issuecomment-6151641559
[emoji]: https://github.com/Silthus/kudos/blob/3409adebdba017e96a0e4dde22a64f71dab44822/prototype/website-ui/src/variants/e/gear-items.ts
[website-map]: https://github.com/Silthus/kudos/issues/57
[architecture]: https://github.com/Silthus/kudos/issues/64
