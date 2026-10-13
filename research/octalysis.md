# Octalysis walk-through for HedgeHug

**Status: intermediate findings, 2026-10-13.** Research ticket [#85](https://github.com/Silthus/kudos/issues/85), website map [#57](https://github.com/Silthus/kudos/issues/57). This branch is research only. Recommendations are proposals for [re-spec #86](https://github.com/Silthus/kudos/issues/86), never amendments to its rules. Synthetic examples only.

## Findings #86 can use now

1. **The five-word gate is a length check, not a thoughtfulness check.** `Thank you for your help today` passes P11 without naming any work. Base XP and achievement counts remain ungated (P1, P13, P59). A reciprocal pair giving 3 units to each other every weekday earns **225 base XP per member per synthetic week**, against **150** for someone giving 3 units each weekday and receiving none. The daily allowance caps the rate but does not prevent farming. Keep brief thanks valid, but describe the gate honestly and cap *bonus* rewards per giver-recipient-day. [Progression P1/P11/P13/P16/P29][progression]; [core R4/R11][core].
2. **Apply qualifying-recognition semantics to the new tree.** Prototype Rhythm/Cadence and Treasurer/Banker say “every thoughtful kudos”. Literal per-unit or per-award bonuses let one pair split messages or repeat emoji to mint rewards. Use P16's first thoughtful giver-recipient-day for all per-recognition XP and coins; require that gate for Spark, Circle and Focus too. The website descriptions must match. [Accepted cut][cut]; [prototype tree][tree]; [P16/P20][progression].
3. **Quest rewards dominate early XP.** Prototype `new-face` pays 60 XP for one new recipient, `say-why` pays 90 for three notes, and a group quest pays 100–120 XP. L2 needs 20 total XP and L3 100. A 60-XP quest is six ordinary giving units. Do not balance a new member using only P3's base-XP curve. Treat these as prototype inputs to a sensitivity run, not verified production rewards. [Quest data][quests]; [P3][progression].
4. **Filter impossible quests before assigning them.** The pool needs two groups, another group, a recent joiner or a never-thanked colleague. The “everyone” group quests pressure the last nonparticipant; the four-other-groups quest is impossible with fewer than five groups. A single reroll cannot fix three infeasible picks. A workspace without groups needs personal equivalents, not locked progression. [Quest data][quests]; [groups G4/G20][groups].
5. **Keep claims and crates deterministic.** Disclose the exact reward, let “open” reveal an already-earned entitlement, and make replay cosmetic. Completed quest rewards should not disappear at the weekly reset. Opening a feature, visiting a board, equipping an item or spending a point should not mint repeatable progression. [Accepted handoff][handoff]; [quest data][quests]; [P8/P30/P32][progression].
6. **Resolve pre-unlock entitlements explicitly.** Quests at L2 award coins, bronze achievements at L4 award 10 coins, and the catalogue gives a hedgehog at L5, before coins/inventory at L6 and collection at L7. Recommend recording earned rewards immediately and revealing the wallet/items when opened, while ordinary giving coin earnings start when the coin feature is enabled. This is a proposal, not a settled rule. [Unlock schedule][unlocks]; [achievement rewards][rewards]; [hedgehog catalogue][hogs].
7. **The onboarding Journey stays. Its detailed steps are unverified.** Read every round comment on #62 and searched all prototype source at `3409ade`; the only Journey references say “first quest chain” and “the prototype doesn't show it yet”. There is no Journey step list or Journey mock data in those inputs. Do not invent an accepted chain. The final report will include an explicitly proposed non-expiring chain and simulation, separate from the five existing feature-introduction quests. [Corrected cut][cut]; [corrected handoff][handoff]; [prototype source][prototype].

## Source precedence and limits

Michael's accepted cut and Journey correction override the pre-cut spec. The prototype is the concrete *candidate* catalogue, but its local state is not backend proof. P1/P3, thoughtful-gate semantics, once-only effects and coin arithmetic are inherited unless the cut changes them. Pre-cut rules forbidding quest XP or achievement coins (P2/P29/P58) are superseded by the accepted new reward sources. No cut feature is simulated as retained.

The accepted changes remove boosters, group auras, drops, rarities, titles, quips, cards, streaks and freezes. They keep the Journey; 3 personal weekly quests, one reroll, one group quest and a bonus quest per feature; 11 achievement ladders; 14 perks; skill points `max(0, level - 4)`; the L2–L7 feature schedule. [Cut][cut]; [handoff][handoff].

Sources are pinned below so later changes on #86 cannot silently change this baseline. Framework primary-source research, complete loop tables, the runnable simulation and its assumptions/results will follow in the next commit.

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

## Runnable simulation (intermediate)

Run `bun research/octalysis-simulation.ts --check`, then `bun research/octalysis-simulation.ts`. No additional dependencies are required. [Results](octalysis-results.md), [weekly state](octalysis-weekly.tsv), and [trigger/action/reward trace](octalysis-trace.md) are generated artifacts.

The candidate and bounded runs each cover six synthetic personas for 104 UTC weeks, starting 2026-01-05. Candidate interprets ambiguous new per-kudos bonuses per award; bounded applies P16's per-pair/day limit and removes infeasible personal quests before assignment. Both retain ungated base XP and the five-word gate; bounded is not a complete anti-farming solution. New member gives 5/receives 2 per week, thoughtful giver 10/3, quiet receiver 0/6, optimiser 15/15, small group 5/3 and no-groups member 10/3. Reserve, when bought, adds its permitted units on Friday. No persona posts on weekends. All notes pass the length gate; the optimiser's notes are synthetic padding without a concrete contribution.

**Assumptions, not accepted rules:** all features are opened promptly; quests count the week's activity even if opened midweek; three quests rotate deterministically through the prototype pool (rather than its wall-clock shuffle); one infeasible pick can be rerolled; a quest completion is immediately claimed and may recur next week; reward coins and achievements bank before their surface unlocks; giving/receiving coins begin after the coin surface opens; new feature quests persist rather than disappearing after a level window; perks are bought at the beginning of the next week when affordable, with no retroactive effects; synthetic recipients repeat over a fixed roster; group participation is a declared external scenario input; store buys the 80-coin emoji and 120-coin hedgehog once while reserving 350 coins for upgrades. The four Journey steps are research proposals with zero extra XP or coins.

Controlled runnable cases cover chime-in eligibility, 24-hour age, affordability, deduplication, a three-person reciprocal ring, roster-change completion, and late/retried quest claims. The weekly baseline generates no chime-ins, so Crowd Favourite/Standing Ovation/Amplifier are zero there. Exact final pacing is contingent on #86 settling these assumptions. A production reward budget or real behavior claim cannot be inferred from this synthetic run.
