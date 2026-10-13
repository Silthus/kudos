# Octalysis and Kudos progression

Research checked 2026-10-13. **Recommendation, not an approved spec.** Product rules supplied by Michael are constraints; perk effects, thresholds and guardrails below are proposals. Numerical scenarios are design assumptions, not usage data. No code or external records were changed.

Make recognition satisfying before making it optimizable. Offer meaningful choices, expression and cooperative abilities; keep random rewards cosmetic and streaks forgiving. XP is personal progression, never an employee performance score.

## 1. Framework and product patterns

Yu-kai Chou's eight core drives describe motivations underneath mechanics. The definitions below summarize [his framework][S1]; the Kudos mappings are design judgments.

| Drive | Motivation | Kudos application and risk |
| --- | --- | --- |
| CD1: Epic Meaning & Calling | Contributing to a larger purpose | Appreciation and Team Player; avoid turning company values into participation obligations. |
| CD2: Development & Accomplishment | Mastery and visible progress | Fast first level, skill points, tiered milestones, workweek XP; numbers can eclipse appreciation. |
| CD3: Empowerment of Creativity & Feedback | Expression, experimentation, response | Chosen perk builds, quips, emoji, active abilities; never automate the actual thank-you. |
| CD4: Ownership & Possession | Collecting and improving something personal | Permanent unlock collection, favourite quips; avoid making recognition a tradeable asset. |
| CD5: Social Influence & Relatedness | Belonging, mentoring, comparison | Three recipients, wider connections, Team Player, shared boosts; favoritism and popularity contests remain possible. |
| CD6: Scarcity & Impatience | Wanting an unavailable opportunity | Daily allowance, level prerequisites, cooldowns; avoid countdowns and scarcity sales. |
| CD7: Unpredictability & Curiosity | Discovering an uncertain outcome | Common/rare drops and allowance-completion legendary chance; bound attempts and disclose odds. |
| CD8: Loss & Avoidance | Protecting progress or opportunities | Streaks, future freezes, pressure to exhaust allowance; protect absence and never remove earned progression. |

**White hat / black hat:** CD1–3 emphasize meaning, accomplishment and agency; CD6–8 emphasize scarcity, uncertainty and loss. CD4–5 can work either way. These describe motivation, not a moral verdict: context and user control matter. [Chou's explanation][S2]

**Left brain / right brain:** CD2/4/6 represent extrinsic, reward-seeking motivation; CD3/5/7 represent creative, social and curiosity-led motivation. CD1/8 lie on the central axis. Chou explicitly calls the brain labels symbolic, not neuroscience. White hat is not synonymous with intrinsic motivation. Treat Octalysis as a design lens, not evidence that a particular workplace feature works. [Chou on the distinction][S3]

Chou separates the journey into [four experience phases][S4]. Apply them without making members wait for basic recognition features:

| Phase | Meaning | Kudos recommendation |
| --- | --- | --- |
| Discovery | Why try it? | See a colleague's specific thank-you and a tasteful quip; lead with appreciation, not prizes. |
| Onboarding | Learn the rules and first success | First award starts progression automatically. Explain allowance in the ephemeral; two kudos given reach level 2. Level-up DM offers affordable perks as buttons, including saving the skill point. |
| Scaffolding | Repeat learned actions toward goals | App Home shows builds, visible milestone criteria, collection progress and an optional work schedule. No web UI or daily task checklist. |
| Endgame | Remain engaged after exploring the system | Uncapped levels, harder cosmetic ladders, cooperative activations and future curated collections. No resets; saving skill points is valid after buying everything. |

### Patterns worth borrowing

| Evidence from primary sources | Interpretation for Kudos |
| --- | --- |
| Duolingo discusses streak loss aversion, demotivation and freezes; its league documentation describes weekly competition, matching and opt-out. [Streaks][S5], [leagues][S6] | Preserve continuity around absence. Defer competitive leagues; never copy demotion or weekend pressure into a workplace. |
| Duolingo Friends Quests document cooperation, opt-out and an XP boost sent using gems. [Friends Quests][S7] | A shared activation can feel supportive. Documented boosts are precedent, not proof that recognition needs them; no current multiplier/duration is assumed. |
| HeyTaco documents emoji-and-mention recognition, configurable daily allowance with no rollover, progression, extra-allowance unlocks and optional leaderboards. Its admin guide distinguishes recognition from performance evaluation. [Mechanics][S8], [admin guide][S9] | Keep recognition in normal Slack conversation, make remaining allowance clear, and provide competition controls. Allowance limits alone cannot prevent favoritism. |
| Blizzard's **2020 pre-release** Diablo IV tree design separates active skills from passive roots and uses limited choices to differentiate builds. [Design article][S10] | Make passive effects automatic and active perks explicit buttons. This is a historical design example, not a claim about today's game. |
| Apple requires odds disclosure for purchased random virtual items. The UK evidence review reports associations with loot-box harms without establishing causation. [Policy][S11], [review][S12] | Disclose free-drop odds too; no paid draws, tradeable prizes or urgency. These sources concern purchased game rewards and do not establish harm from free workplace cosmetics. |

Product documentation establishes patterns, not independent causal evidence of healthier recognition. All transfers to Kudos here are recommendations.

## 2. Rules and workplace guardrails

Preserve the locked model: Given awards alone produce **10 XP per kudos given / 5 per kudos received**. Base XP has no multipliers; perks add separate bonus XP. XP, levels, awards and unlocks never reverse or reset. One skill point per level-up from level 2, no expiry or respec. Achievements award only named exclusive quips/emoji, never XP or skill points, and replay against history.

| Risk | Recommended guardrail |
| --- | --- |
| Transactional or farmed recognition | Keep the member's message central; no XP for activating a perk, selecting a quip or opening App Home. No content-length or sentiment scoring. Never suggest someone to thank merely to finish a target. |
| Kudos-swapping pairs | For **bonus XP and drop eligibility only**, the first kudos to each recipient per giver-local date qualifies; cap at three qualifying kudos/day. Base XP and recognition stay unchanged. Broader patterns make bonus farming harder, not impossible; don't silently classify colleagues as cheaters. |
| Unequal allowance and compounding power | Launch one +1 allowance perk, no unlimited tiers. Extra allowance still earns locked base XP but cannot increase the three daily bonus/drop opportunities. Document the remaining base-XP advantage. |
| Part-time work, leave and holidays | Member-selected workdays and free planned pauses, independent of perks or coins. Give equal weekly XP per completed scheduled week, not per five-day week. No absence leaderboard or participation requirement. |
| Streak anxiety and random-reward chasing | Streak display/reminders optional; no loss of earned rewards. Visible odds, finite pools, duplicate protection, guaranteed fallback and no near-miss animations. No “use your remaining allowance before midnight” prompts. |
| Recipients lack control; popularity differs by role | No perk requires receiving or induces a recipient to reciprocate. Receiving ladder is passive and never a recommended task. Allow hiding level/achievement displays and muting announcements; automatic progression continues. |
| Public noise or sensitive context | Quips default to none. One app reply per kudos message, consolidating quip/unlocks; DM each unlocking member. Use admin-selected announcement routing and existing channel visibility; never copy private-message context into a public channel. |
| Performance or competitive pressure | State that progression is not a performance measure. Team leaderboard later should count recognition, not boosted XP; offer opt-out and avoid cross-schedule comparisons. |

**Shared bonus rule:** maximum **15 action bonus XP per giver-local date**, including social and active effects, plus **one weekly reward of at most 20 XP** outside that cap. Weekly upgrades thus retain value alongside daily perks. Event effects resolve by stable perk ID. App Home and purchase previews explain both limits. No bonus-on-bonus calculations, recipient bonus multipliers, or retroactive perk XP/drops. These limits constrain extras, not the locked base XP.

### Pace check

With the locked curve, total XP for level L ≥ 3 is `50 × (L−2) × (L−1)`; level 2 needs 20. “45 XP/workday” is a supplied illustrative baseline.

| Level | Total XP | At 45 XP/workday | At a hypothetical sustained 65 XP/workday |
| --- | ---: | ---: | ---: |
| 5 | 600 | 14 workdays (~3 weeks) | 10 workdays (~2 weeks) |
| 10 | 3,600 | 80 workdays (~4 months) | 56 workdays (~3 months) |
| 20 | 17,100 | 380 workdays (~18 months) | 264 workdays (~1 year) |

Five-day weeks, no leave, rounded up. The rough product targets match an **eventual perk-enhanced** rate better than the base rate. One extra kudos given adds 10 base XP; a further average 10 bonus XP could reach 65. That is a scenario, not a forecast: perks unlock gradually, receiving is outside the member's control, and holidays lengthen elapsed time. Keep the curve locked and present estimates as ranges.

## 3. First perk catalogue: 18 choices

All perks are permanent purchases; costs are **additional** skill points, not total branch cost. Unless stated, there is no prerequisite and a perk is bought once. “Qualifying” means the guarded giving opportunities above. Existing App Home controls (none/one/favourites), curated emoji administration and announcements remain baseline features, not paid perks. Emoji always cost one kudos per occurrence per recipient.

| Group / perk | Effect | Min level / cost | Prerequisite; stacking | Drives | Abuse notes / dependency |
| --- | --- | --- | --- | --- | --- |
| XP · First Spark | +3 XP on first qualifying kudos of a scheduled workday | 2 / 1 | None; once/day | 2 | Encourages token daily thanks; capped, no reminders. |
| XP · Steady Flame | First Spark becomes +6 XP | 5 / 2 | First Spark; replaces +3 | 2 | No multiplying received XP. |
| XP · Weekly Rhythm | +10 XP when every scheduled, unpaused workday in the local week has genuine giving | 3 / 1 | None; once/week, outside action cap | 2, 8 | Same reward for 1–7 scheduled days; all-paused week earns nothing. |
| XP · Weekly Cadence | Weekly Rhythm becomes +20 XP | 8 / 2 | Weekly Rhythm; replaces +10; weekly cap 20 | 2, 8 | No freeze-generated completion or extra week from time-zone changes. |
| Social · Three Cheers | +5 XP on giving to three distinct recipients in one local date | 4 / 1 | None; once/day; adds to Spark within cap | 5, 2 | All three must receive Given awards; extra emoji don't help. |
| Social · Open Circle | +3 XP for a recipient this giver has never previously recognized | 6 / 1 | None; once/day; adds within cap | 5, 1 | Count full prior history. Guests/new members are not an unlimited recruitment target. |
| Social · Team Player | +10 XP for recognizing the whole eligible team roster during a local month | 7 / 2 | None; once/month across all teams; shared cap | 1, 5 | **Teams later**; snapshot rules below. Small teams complete more easily; no public checklist. |
| Luck · Pocket Surprise | 5% common-quip chance per qualifying kudos | 2 / 1 | None; ≤3 rolls/day | 7, 4 | Common guarantee on the 20th consecutive common miss. |
| Luck · Good Odds | Common chance becomes 10% | 5 / 2 | Pocket Surprise; replaces 5% | 7, 4 | No extra rolls; common guarantee unchanged. |
| Luck · Rare Find | Adds a 2% rare-quip outcome to the same roll | 9 / 2 | Good Odds; common/rare mutually exclusive | 7, 4 | Rare guarantee on 50th consecutive rare miss; rare wins priority. |
| Luck · Grand Finale | Separate 1% legendary-quip roll on reaching that day's opening allowance | 12 / 3 | Rare Find; once/day, no XP for exhaustion | 7, 6, 8 | Require opening allowance ≥3 and ≥3 distinct recipients. Legendary guarantee on 100th eligible miss. No exhaustion nudges. |
| Expression · Palette | Choose one of six curated kudos emoji | 2 / 1 | None; permanent unlock | 3, 4 | Unicode defaults: 🌟 🙌 👏 💪 🎯 💐; admin-curated custom emoji may replace options. Reveal choices. |
| Expression · Palette Plus | Choose three additional emoji from the perk pool | 6 / 1 | Palette; adds unlocks | 3, 4 | Achievement-exclusive emoji excluded; no change to allowance cost. |
| Expression · Signature | Choose one of three common quips, e.g. “Quiet work. Loud thanks.” | 3 / 1 | None; permanent unlock | 3, 4 | A deterministic alternative to luck. Does not require using a quip. |
| Expression · Repertoire | Choose one three-quip themed pack: craft, teamwork or kindness | 8 / 2 | Signature; adds unlocks | 3, 4 | Preview complete text; no achievement-exclusive content. |
| Allowance · Extra Mile | +1 to daily allowance from the next local reset | 4 / 2 | None; adds once to workspace base | 4, 5 | Base-XP advantage remains; no further allowance tier initially. |
| Active · Spotlight | Activate in App Home: +20% of giver base XP on next three qualifying kudos within 24h (+2 each, max +6) | 7 / 2 | None; 7×24h cooldown from activation | 3, 2 | Separate bonus; no urgency DM. Overlapping active multipliers use the highest only. |
| Active · Rally | Activate a workspace-wide +20% giving boost: each member's first three qualifying kudos during 72h, max +6/member | 10 / 3 | None; workspace and owner cooldown 14×24h | 5, 1, 3 | Admin opt-in; highest active multiplier only; recipient recognition unchanged. Different owners cannot chain activations. No public inactivity list. |

**Roll semantics:** independent server-side draws across eligible events; persist outcomes before notifications so retries never reroll. Rare Find uses disjoint outcomes: 2% rare, 10% common, 88% none. A rare guarantee overrides the ordinary roll and holds the common-miss counter; a common guarantee overrides an ordinary common/none result, but waits if rare wins. Successful drops reset only that rarity's counter. Grand Finale's legendary draw is independent. Miss counters count eligible draws, not days; guaranteed draws consume the ordinary opportunity.

Draw uniformly from unowned quips in the rolled rarity, with displayed pool size and odds. Exhausted pools stop that rarity's counter and turn its outcomes into none. No duplicates, trading, purchasable attempts or XP substitution. Pool additions preserve existing counters. Offer a **known-reward mode** per member: replace luck with a choice after 20 common opportunities (10 with Good Odds), 50 rare or 100 legendary; the same eligibility caps apply. Mode changes preserve progress and grant no immediate extra reward. Stage luck after deterministic choices if content is not ready.

No catalogue perk depends on coins. Team Player alone waits for the teams spec. Rally needs no team model, but should ship after personal activation and workspace cooldown behavior are proven. Prices create real branches: at level 10 there are nine earned skill points; Spark→Flame plus Extra Mile costs five, leaving four for weekly, cosmetic or active choices. No purchase is required to keep earning levels.

## 4. Streak definition and tiered achievements

**Workday streak:** a sequence of scheduled, unpaused local dates, each with at least one kudos given through a Given award. Default Monday–Friday; members choose their actual recurring workdays. Off-days (including weekend days unless scheduled) neither advance nor break the sequence; giving then still earns normal XP. Missing a scheduled date breaks the current streak at its end, never the personal best or earned achievement tiers. A received award alone does not count.

Use the giver's IANA time zone and the award's successful evaluation timestamp, including a retry that first succeeds. Store the local date and effective schedule/time-zone version for historical replay. DST follows local calendar boundaries. Schedule/time-zone changes apply from the next local Monday and cannot reclassify past days or create a second allowance reset; award allocation must remain aligned with the recognition spec. Before configurable schedules existed, use the documented Monday–Friday default with the historical award time zone; if neither is available, label the inferred segment and begin strict streak calculation at reliable history rather than inventing proof.

Free pauses cover planned holidays/leave and do not advance the streak. Only future dates can be member-paused; an admin can correct unexpected absence, with a recorded effective-date adjustment. Avoid inferring health or leave reasons from Slack status. Weekly Rhythm uses actual giving on every unpaused scheduled day of Monday–Sunday, not streak length; credit it on the last required day's award, at most once per versioned week.

**Future freeze:** an optional pre-owned item automatically bridges one missed scheduled date; it preserves continuity but adds no genuine day, kudos, XP, allowance, weekly completion or achievement activity. Pauses take precedence and consume nothing. Two consecutive bridged dates maximum; longer absence uses free pause. Store freeze consumption separately. Achievement thresholds below count **genuine giving days within the preserved sequence**. Thus a freeze can protect the streak ladder but cannot buy its length. This entire item/economy remains postponed.

### Nine ladders, four tiers each

All tiers are one-time, visible and cumulative: bronze → silver → gold → diamond. Each cell is `threshold → exclusive reward`. Quoted text is the proposed full quip. Emoji exclusivity means Kudos unlock entitlement, not ownership of the Unicode character. Reserve these rewards outside perk/drop pools and prevent the workspace base emoji from duplicating them.

| Ladder / criterion | Bronze | Silver | Gold | Diamond |
| --- | --- | --- | --- | --- |
| **First to Thank:** lifetime kudos given | 1 → 🌱 “First Sprout” | 25 → “Good work deserves a spotlight.” | 100 → “A hundred reasons to say thanks.” | 500 → “Appreciation has deep roots here.” |
| **Seen and Valued:** lifetime kudos received | 1 → “Your work was noticed.” | 25 → 💎 “Recognized” | 100 → “The team sees what you bring.” | 500 → “A lasting mark, made together.” |
| **Wider Circle:** distinct recipients recognized | 3 → “Thanks travels.” | 6 → 🌉 “Bridge” | 12 → “Good work has many names.” | 24 → “A whole constellation of contributions.” |
| **Steady Current:** best workday streak, genuine giving days | 5 → “A little thanks, often.” | 10 → “Kindness found its rhythm.” | 25 → 🔥 “Steady Flame” | 60 → “Consistency, with room for life.” |
| **Keep Showing Up:** lifetime scheduled dates with giving, nonconsecutive | 10 → “Back with another thank-you.” | 30 → 🧭 “Regular” | 100 → “Small moments made a habit.” | 250 → “Thanks belongs in the everyday.” |
| **Three Cheers:** dates recognizing ≥3 distinct recipients | 3 → “One day. Many good people.” | 10 → 🎊 “Chorus” | 30 → “A chorus of well-earned thanks.” | 100 → “No single spotlight can hold this team.” |
| **Long View:** nonconsecutive local months with ≥1 kudos given | 1 → “The first chapter of thanks.” | 3 → “Still finding reasons to appreciate.” | 6 → 🌳 “Rooted” | 12 → “A year of noticing what matters.” |
| **Renewed Thanks:** distinct recipients recognized on dates ≥30 days apart | 1 → “Good work keeps showing up.” | 3 → “Another chapter. Another thank-you.” | 6 → 🪴 “Nurtured” | 12 → “Longstanding effort, freshly appreciated.” |
| **Team Circle — teams later:** completed eligible team-months | 1 → “Everyone helped write this chapter.” | 3 → 🧩 “Whole Team” | 6 → “Every contribution belongs here.” | 12 → “A team story told in thank-yous.” |

Award counts sum kudos amounts; date/breadth ladders count unique dates/recipients, never emoji repetitions. Scheduled-date achievements exclude paused/off-days. Renewal needs two genuine giving dates, counts each recipient once, and requires no reciprocal award. Received milestones are passive celebration, not goals to solicit. Fixed breadth tiers may be unreachable in small workspaces: show the constraint, require none for progression, and never recommend recruitment to complete them.

For Team Player/Team Circle, snapshot the member's primary team roster at the first local day of the month, excluding the giver, inactive members and members already marked unavailable for that month. Require at least two eligible recipients; joins and transfers apply next month. Later deactivation or admin-corrected absence may remove a recipient from the target, without making anyone's recognition disappear. Complete by giving ≥1 kudos to every remaining eligible recipient; at most one team-month per member per month. This is a proposed seam for the later teams spec, not a dependency to invent now.

Replay historical award facts for all achievable tiers; highest attained and prior tiers all unlock. Use versioned effective schedule, team and future-freeze records only where a criterion needs them; missing history is not proof of completion. Perk ownership is never an achievement criterion. Retroactive unlocks arrive as one DM summary plus a batched public notice in an eligible configured channel; don't reply to every historical message. Every tier reward stays earned after a streak breaks or a roster changes.

## 5. Decisions for Michael

| Open question | Recommended answer |
| --- | --- |
| Must the rough level timings hold without perks? | No: keep the locked curve and distinguish base pace from eventual enhanced pace. Don't promise a calendar deadline. |
| How much advantage can allowance create? | +1 initially, starting next reset; no second tier until the recognition economy is evaluated. Base XP remains exactly as locked. |
| How much bonus XP can stack? | Max 15 action bonus XP/day plus one weekly reward up to 20; active multipliers take the highest. Explicit purchase previews are essential with no respec. |
| Does a completed workweek require five days? | The member's actual schedule; equal weekly bonus, free leave pauses, no XP for an all-paused week. |
| Does allowance exhaustion deserve XP or legendary chance? | No exhaustion XP. Grand Finale is an optional later catalogue entry with bounded cosmetic chance and a guarantee; release only if its pressure is acceptable. |
| How are random rewards made fair? | Publish odds/pools, no duplicates, persisted draws, guaranteed outcomes and known-reward mode. Start with deterministic cosmetics if content is small. |
| Are upgrades bought or automatically awarded by level? | Bought with additional skill points; level only gates access. Show branch total and permanent/no-respec terms before confirmation. |
| Can balancing remove a chosen perk's value? | Avoid nerfing permanent purchases; retain owned entitlement when retiring a perk, with an equivalent replacement policy decided before launch. No silent confiscation or XP rollback. |
| Who can start a shared multiplier? | Owners of Rally, in admin-enabled workspaces; shared cooldown prevents chains. Boost giving progression, never recipient kudos value or leaderboard recognition totals. |
| How public are progress and quips? | Quips default none; offer public-progress visibility controls. Keep DM announcements and admin routing while respecting channel visibility. |
| Which tiers need complete historical metadata? | Define reliable history boundaries and effective-date versions now; do not retrospectively guess schedules, team membership or freezes. |
| Can streak protection be paid for? | Free leave protection always. Coins later may bridge isolated misses, never become the way part-time members or holiday-takers buy fairness. |

### This map versus the coins feature

**Now:** permanent skill-point choices, one allowance bonus, curated emoji/quips, achievement entitlement, work schedule/pauses, optional streak display, auditable bonus rules. Stage random perks and workspace activation after simpler paths. Team Player and Team Circle belong to the later teams spec.

**Coins later:** consumable freeze inventory, fixed-price one-time boosters, purely cosmetic/equippable items and loadout presentation. Defer earning rates, pricing, trading and monetization decisions. Do not exchange kudos, XP or skill points for coins; do not sell random draws or an advantage in recognition leaderboards. Repeatable booster purchases must not bypass today's bonus cap or shared cooldown policy.

**Design seam only:** distinguish permanent perk ownership, permanent achievement rewards, unlock entitlement, timed activation and future consumable use. Record stable reward/effect IDs and provenance, alongside award-derived progression, so coins can later produce a cosmetic entitlement or a consumable activation without rewriting awards. No wallet or coins implementation is needed for this map. Verify future implementation through replayable awards, idempotent outcomes, schedule boundaries and shared cooldowns, not tests that duplicate catalogue rows.

## Sources

First-party documentation unless labeled otherwise; accessed 2026-10-13. Product blogs describe documented examples, not a live account audit. No claim of proven workplace efficacy is made.

1. [Yu-kai Chou — The Octalysis Framework: 8 Core Drives of Gamification][S1]. Framework names and motivations.
2. [Yu-kai Chou — White Hat vs Black Hat Gamification][S2]. Motivation categories and context.
3. [Yu-kai Chou — Left Brain vs Right Brain Core Drives][S3]. Extrinsic/intrinsic framing and symbolic brain labels.
4. [Yu-kai Chou — Four Experience Phases][S4]. Discovery, onboarding, scaffolding, endgame.
5. [Duolingo — How streaks build habit][S5]. Streak pressure, breaks and protection; first-party design account.
6. [Duolingo — Leagues and leaderboards][S6]. Weekly comparisons and opt-out; availability details may change.
7. [Duolingo — Friends Quests][S7]. Cooperative challenges and XP boosts; no current exact multiplier asserted.
8. [HeyTaco — How does HeyTaco work?][S8]. Recognition workflow and daily allowance.
9. [HeyTaco — Administrator guide][S9]. Levels, unlocks, competition controls and performance distinction.
10. [Blizzard — Diablo IV Quarterly Update, September 2020][S10]. Historical, explicitly unfinished active/passive tree proposal.
11. [Apple — App Review Guidelines, §3.1.1][S11]. Odds disclosure for purchased randomized virtual items; platform policy, not a Slack requirement.
12. [UK government — Response to loot-box evidence, 2022][S12]. Public evidence synthesis; association does not establish causation.

[S1]: https://yukaichou.com/gamification-examples/octalysis-gamification-framework/
[S2]: https://yukaichou.com/gamification-study/white-hat-vs-black-hat-gamification/
[S3]: https://yukaichou.com/gamification-study/left-brain-extrinsic-brain-intrinsic-core-drives-gamification/
[S4]: https://yukaichou.com/gamification-examples/gamification-4-experience-phases-of-a-game/
[S5]: https://blog.duolingo.com/how-duolingo-streak-builds-habit/
[S6]: https://blog.duolingo.com/duolingo-leagues-leaderboards/
[S7]: https://blog.duolingo.com/friends-quests/
[S8]: https://heytaco.com/docs/article/75-how-does-heytaco-work
[S9]: https://heytaco.helpscoutdocs.com/article/208-heytaco-administrator-guide
[S10]: https://news.blizzard.com/en-us/article/23529210/diablo-iv-quarterly-updateseptember-2020
[S11]: https://developer.apple.com/app-store/review/guidelines/#in-app-purchase
[S12]: https://www.gov.uk/government/calls-for-evidence/loot-boxes-in-video-games-call-for-evidence/outcome/government-response-to-the-call-for-evidence-on-loot-boxes-in-video-games
