# Gamification for Kudos: Octalysis, levels, boosters, perks and kudos trees

Research for [#53](https://github.com/Silthus/kudos/issues/53). Feeds the grilling session [#55](https://github.com/Silthus/kudos/issues/55) (HITL). Written 2026-09-24.

> **The question.** Which game mechanics would turn Kudos into "almost a game of kudos" while always fuelling genuine appreciation, and how would each one work here?

This note does **not** make the product decisions. Every choice below is an option with a recommendation; §8 lists the questions the grilling has to settle, most load-bearing first.

## TL;DR

- **The one rule that keeps it honest: the game rewards *how well you appreciate*, never *how much you're appreciated* and never *how many kudos you move*.** Everything below hangs off the "qualifying kudos" rule the Quest spec already uses (a note of 3+ words, not a thank-you-back within 72 h, one message = one step).
- **Three ledgers, one firewall.** *Kudos* stay what they are (allowance-limited recognition; received kudos are the Store balance, [ADR 0001](../docs/adr/0001-store-balance-is-received-kudos.md)). *XP* is a new, never-spent progress score that decides your *level*. *Seeds* are a new soft currency for boosters, saplings and cosmetics. **Nothing in the game ever writes the Store balance or the daily allowance.** One optional, admin-controlled bridge is sketched in §6.4.
- **XP: a thoughtful kudos earns the giver 10 XP and the receiver 3**, with per-pair decay, a daily cap and small bonuses for breadth (new connection, rekindled friendship, unsung hero, a real "why"). A steady thoughtful giver reaches level 5 in about 3 weeks and level 10 in about a quarter; a points farmer earns less than half of that (§4).
- **Kudos trees are relationship trees.** You plant a sapling *for a teammate you recognise*; it only grows when you recognise that person again in a later week, it can't be rushed, it fruits Seeds and a little XP, and it goes dormant (never dies) when you stop. An "Ancient" tree means a year of recognising the same person, spread over 20 different weeks (§6.2).
- **Boosters and perks make your recognition better for the receiver, not your score bigger.** Recommended boosters raise the rarity of the bot message *the receiver* gets, water a whole team grove, or feature a kudos. XP multipliers are listed but not recommended (§6.3).
- **Progressive disclosure: new areas show up locked with a clear "how to unlock".** Features that already shipped stay open (taking them away would be a loss), and veterans' XP is backfilled from history so nobody starts at level 1 (§5).
- **Octalysis Prime has an island map with level-gated areas, per-drive XP, powers that unlock, coins, a daily chest and boosters, but no trees, seeds or perks that we could verify.** The tree mechanics here are modelled on Stardew Valley's fruit trees instead (§2.2, §2.5).
- **35 mechanics** in the catalog (§3), each with the behaviour it fuels, its abuse guard, data impact and an S/M/L cost. A recommended starter bundle is in §7.

## Contents

1. [Today's Kudos through the Octalysis lens](#1-todays-kudos-through-the-octalysis-lens)
2. [What the research says](#2-what-the-research-says)
3. [Idea catalog (35 mechanics by core drive)](#3-idea-catalog-35-mechanics-by-core-drive)
4. [Strawman XP and level curve](#4-strawman-xp-and-level-curve)
5. [Strawman unlock ladder](#5-strawman-unlock-ladder)
6. [Economy sketch: Seeds, trees, boosters, perks](#6-economy-sketch-seeds-trees-boosters-perks)
7. [Recommended starter bundle and anti-patterns](#7-recommended-starter-bundle-and-anti-patterns)
8. [Open questions for the grilling, ordered](#8-open-questions-for-the-grilling-ordered)
9. [Sources](#9-sources)

---

## 1. Today's Kudos through the Octalysis lens

Octalysis sorts motivation into eight **core drives** ([Chou, framework](https://yukaichou.com/gamification-examples/octalysis-gamification-framework/)). Here is Kudos as it ships today, before any new mechanic:

| Core drive | Hat / brain | What Kudos already has | Strength today |
|---|---|---|---|
| **CD1 Epic Meaning & Calling** | White / — | Almost nothing. A hint of lore in the planned legendary quest message ("the Guild of Gratitude"). | Weak |
| **CD2 Development & Accomplishment** | White / Left | Dashboard stats, leaderboard, weekly quests with a quest log, Compare "Past you". | Medium |
| **CD3 Empowerment of Creativity & Feedback** | White / Right | *Who* to thank and *what* to write is a real creative choice, but the product gives no feedback on it. | Weak |
| **CD4 Ownership & Possession** | Mixed / Left | The Discoveries collection (60 messages, 72 with quest messages); the Store balance, which is Chou's "exchangeable points". | Medium |
| **CD5 Social Influence & Relatedness** | Mixed / Right | The whole product: kudos are gifts only friends can give ("social treasure"), public channel posts, receiver DMs. | Strong |
| **CD6 Scarcity & Impatience** | Black / Left | The daily allowance: 5 a day makes each one worth something (a "magnetic cap"); the weekly quest board. | Medium |
| **CD7 Unpredictability & Curiosity** | Black / Right | Every bot message rolls a rarity (55/25/12/6/2%). | Strong |
| **CD8 Loss & Avoidance** | Black / — | Only the use-it-or-lose-it allowance. Quests deliberately have no failed state and no streaks. | Weak, by design |

**Reading of this table.**

- **Kudos is already a right-brain product.** Its strongest drives are social (CD5) and curiosity (CD7), which are the ones Chou says keep people intrinsically motivated ([left/right brain](https://yukaichou.com/gamification-study/left-brain-extrinsic-brain-intrinsic-core-drives-gamification/)).
- **The request adds left-brain drives.** Levels are CD2, owned trees and boosters are CD4, and locked areas are CD6. Chou's own warning is that extrinsic motivators crowd out intrinsic ones: "once you stop offering the extrinsic motivator, user motivation will often decrease to much lower than before" ([framework](https://yukaichou.com/gamification-examples/octalysis-gamification-framework/)).
- **So the design rule is to hand off.** Left-brain mechanics get people through onboarding. Then they must hand off to white-hat, right-brain drives: CD1 meaning (team grove), CD3 choice (plant picker, altruistic boosters) and CD5 relatedness (gift trees, mentoring). That's the shape of the catalog in §3.
- **The gaps are CD1 and CD3.** Those are the cheapest white-hat wins.

---

## 2. What the research says

Every claim below links its source. Items marked *(snippet)* were only readable through a search-engine excerpt because the page blocked fetching. Items marked *(unverified)* have no primary source.

### 2.1 Octalysis in five minutes

**The eight drives**, each with Chou's own one-line definition ([framework](https://yukaichou.com/gamification-examples/octalysis-gamification-framework/)):

1. **Epic Meaning & Calling**: "a player believes that he is doing something greater than himself".
2. **Development & Accomplishment**: "the internal drive of making progress, developing skills, and eventually overcoming challenges".
3. **Empowerment of Creativity & Feedback**: users "engaged in a creative process where they have to repeatedly figure things out".
4. **Ownership & Possession**: "users are motivated because they feel like they own something".
5. **Social Influence & Relatedness**: "all the social elements that drive people, including mentorship, acceptance…".
6. **Scarcity & Impatience**: "wanting something because you can't have it".
7. **Unpredictability & Curiosity**: "wanting to find out what will happen next".
8. **Loss & Avoidance**: "the avoidance of something negative happening".

**White hat vs black hat** ([source](https://yukaichou.com/gamification-study/white-hat-black-hat-gamification-octalysis-framework/)):

- The white-hat drives (CD1–3) "make us feel powerful, fulfilled, and satisfied", but create no urgency.
- The black-hat drives (CD6–8) "make us feel obsessed, anxious, and addicted".
- CD4 and CD5 can go either way.
- Chou's recipe: "Use Black Hat to spark action, then hand off to White Hat to retain". His ethical line: "whether the user feels in control".
- On CD8 specifically: it "is the drive Black Hat programs live on — and the drive that burns users out fastest" ([CD8](https://yukaichou.com/gamification-study/8-loss-and-avoidance/)).

**Left brain vs right brain** ([source](https://yukaichou.com/gamification-study/left-brain-extrinsic-brain-intrinsic-core-drives-gamification/)):

- The left-brain drives are CD2, CD4 and CD6 (extrinsic). The right-brain drives are CD3, CD5 and CD7 (intrinsic).
- Chou's test: "if the goal or objective were removed, would the person still be motivated?"
- He names the **overjustification effect** explicitly, citing Deci & Ryan.
- His advice: use left-brain drives for onboarding and right-brain drives for retention.

**The four experience phases** ([source](https://yukaichou.com/gamification-examples/gamification-4-experience-phases-of-a-game/)):

| Phase | What it has to answer |
|---|---|
| **Discovery** | "why would people even want to start". |
| **Onboarding** | Teach the rules and "make users FEEL smart and competent" ([onboarding](https://yukaichou.com/gamification-study/4-experience-phases-gamification-2-onboarding-phase/)). |
| **Scaffolding** | Why people "come back and do the exact same things over and over". |
| **Endgame** | Retaining veterans, "more easily achieved by implementing techniques that appeal to White Hat and Intrinsic Core Drives". |

Two lines from the same page shape the ladder in §5: "CD1 (Epic Meaning) has to be planted in phase 1 to sprout in phase 4", and "the transitions between phases are where most users churn".

**Progressive disclosure is Chou's own onboarding advice.**

- Features should be "grayed out, with a pointy arrow" to the next thing to learn, and users should know "what they don't have YET as quickly as possible" ([onboarding](https://yukaichou.com/gamification-study/4-experience-phases-gamification-2-onboarding-phase/)).
- The named techniques are **Evolved UI** (GT#37: "giving people less options at the beginning … and evolving as the player moves through the experience", [CD6](https://yukaichou.com/gamification-examples/8-game-techniques-to-effectively-use-scarcity-and-impatience-in-your-life-part-6-of-8-in-lifestyle-gamification-examples/)) and **Milestone Unlock** (GT#19: "unlocks an exciting possibility that wasn't there before", [CD3](https://yukaichou.com/gamification-study/8-core-drives-gamification-3-empowerment-creativity-feedback/)).

**Chou on points, badges and leaderboards.**

- "If you just slap on Badges, Badges will slap your Users."
- On leaderboards: "if designed incorrectly, they often do the exact opposite" ([CD2](https://yukaichou.com/gamification-study/8-core-drives-gamification-2-development-accomplishment/)).
- On workplace gamification: "Good Gamification does not start with game elements but starts with our Core Drives" ([workplace](https://yukaichou.com/workplace-gamification/gamified-training-corporate-workplace/)).

**Chou's Strategy Dashboard** gives two reward rules that matter here ([source](https://yukaichou.com/gamification-study/the-strategy-dashboard-for-gamification-design/)):

1. **SAPS: Status, Access, Power, Stuff.** Moving toward Stuff makes a reward "more expensive for the company, but less sticky for the user". This is why §6.4's perks are Access and Power, not Stuff.
2. **Match rewards to effort:** "high-value, low-abundance rewards to your hardest Desired Actions … low-value, high-abundance rewards to frequent, easy actions".

### 2.2 Octalysis Prime ("the island"): what's verifiable, and what isn't

Octalysis Prime (OP) is Chou's gamified learning platform, launched in February 2018 as "a real-life RPG" ([Chou](https://yukaichou.com/gamificationnews/octalysis-prime-real-life-rpg/)). **What primary sources confirm:**

- **An island map whose areas unlock as you progress**: "After completing the initial lessons, new areas are unlocked with additional lessons" ([Gameful Bits review](https://www.gamefulbits.com/2018/02/05/octalysis-prime-gameful-journey-learn-gamification/)). Chou also admits many "blue users" never realised "they could go to more places on the Island" ([Chou](https://yukaichou.com/gamification-analysis/daily-quest-design-octalysis-prime/)). **Lesson: a locked area must be visibly signposted.**
- **XP per core drive, with growth that unlocks powers**: "various Core Drives will grow and unlock new powers… Leveling Up Faster, Opening the Daily Chest more than once a day, to lowering your monthly payments by 40%!" ([Chou](https://yukaichou.com/gamificationnews/octalysis-prime-real-life-rpg/)). These are OP's "perks" in all but name.
- **Status tiers** (Blue, Orange, Purple, Silver, Gold): "blue users" and "Silver+" appear on Chou's site; the full ladder only in a member guide's table of contents ([Leanpub](https://leanpub.com/octalysisprime)).
- **Chou Coins and a Daily Chest** that refills "20 hours later, but not a second before!" ([Chou](https://yukaichou.com/gamification-examples/design-coins-octalysis-prime/)). Coins were deliberately launched *before they could be spent*, to build curiosity about what they "*might* be used for" (CD7 + CD4).
- **A Daily Quest List** (watch 3 videos → a chest), potions, "Orbs", and collectible "Geomons" with rarities ([Chou](https://yukaichou.com/gamification-analysis/daily-quest-design-octalysis-prime/), [promo](https://yukaichou.com/gamificationnews/invest-in-your-skills-octalysis-prime-58-off-for-3-days/)).

**What we could not find: plants, seeds, trees or a garden in OP.** None appears in any primary source, and "perks" isn't an in-platform term either. The fan wiki (octalysisprime.fandom.com) was unreachable (HTTP 402), so it's possible they live there. *The tree mechanics in this note therefore borrow from farming games (§2.5), not from OP.* If the human remembers specific OP tree mechanics, the grilling should capture them.

**Chou's own post-mortems of OP are the most useful part** ([daily quest thread](https://yukaichou.com/gamification-analysis/daily-quest-design-octalysis-prime/)):

- **Stacked boosters turned learning into "grunt work".** Hardcore members felt they "MUST use potions, Success Buddy Bonus, and now Geomon bonus on every video watched". Chou calls it a black-hat compulsion. *For Kudos: boosters must not stack into an optimisation chore.*
- **A coin reward for the daily quest made people watch videos they didn't want.** Chou added a paid "refresh" so members could pick different ones. *For Kudos: never reward recognising someone you didn't mean to recognise.*
- **Per-video rewatch cooldown.** The proposal was to "cap each video to only be rewatched with exp once a week". *That's the per-pair weekly decay in §4.2.*
- **Capped comment rewards.** "after the third, with gives no reward, some people stop". *Caps are fine, but the thing itself must stay worth doing after the cap.*
- **Finishing everything was an "anticlimactic win state".** *Kudos needs an endgame (§5).*

### 2.3 Chou's rules for boosters

Chou defines a booster as "any feature that enhances another feature" ([Booster Design System, 2026](https://yukaichou.com/advanced-gamification/booster-design-system-core-drive-power-ups/)). His rules:

- **Permanent vs consumable:** "If it modifies another feature or produces a recurring effect, make it permanent." Numeric boosts should be consumable. *This is exactly the split between **perks** (permanent, level-unlocked) and **boosters** (consumable, bought) in §6.*
- **Earned beats bought:** "Paid boosters work best when they save time rather than replace mastery."
- **Decide stacking up front:** make boosters mutually exclusive, and decide "Stack? Compete? Reset?" before launch.
- **His examples:**
  - Gold Fertilizer: "2× lucky drops for 30 minutes".
  - XP Scroll: "3× XP for the next 5 activities".
  - Island Map: "Unlocks a new navigation option forever".
  - Compound Interest: a recurring percentage of your coins.

  The page implies, but doesn't state, that these are OP items.
- In Chou's framework, **Boosters are GT#31** under CD3: something that "in a limited capacity, help[s] them achieve the win-state easier" ([CD3](https://yukaichou.com/gamification-study/8-core-drives-gamification-3-empowerment-creativity-feedback/)).
- On the Strategy Dashboard he calls boosters the best reward type, because they "loop you back into the ecosystem" ([source](https://yukaichou.com/gamification-study/the-strategy-dashboard-for-gamification-design/)).

### 2.4 Prior art in recognition tools

| Tool | Relevant mechanics | Anti-gaming | Lesson for Kudos |
|---|---|---|---|
| **HeyTaco** | 5 tacos a day, use-it-or-lose-it ([docs](https://heytaco.com/docs/article/75-how-does-heytaco-work)). **50 "Tacotars" = 50 levels**, unlocked "based on your taco giving and receiving behavior" ([Tacotars](https://heytaco.com/tacotars)); thresholds aren't public. Leaderboards for given / received / combined, which admins can hide ([leaderboards](https://heytaco.com/features/leaderboards)). **Giver Mode** keeps only the "Tacos Given" board ([docs](https://heytaco.com/docs/article/74-enable-heytaco-giver-mode-as-part-of-your-culture-of-giving)). "Collaborative Rewards" pool tacos toward a shared goal *(snippet)*. | Admin limits only. "The most important part of HeyTaco is the message behind the taco." | The closest existing product to "levels for recognition". HeyTaco counts receiving too, so Kudos can differentiate by weighting giving. Giver Mode is precedent for givers-only surfaces. |
| **Bonusly** | Two balances: "Giveable points … refresh every month and expire"; "Redeemable points … never expire" ([help](https://help.bonus.ly/en/articles/357124-how-do-bonusly-points-work)). Company-value hashtags can be required *(snippet)*. Automated celebration awards are funded by the company, not by allowance *(snippet)*. | A **Quality Bot** flags "the same user sending the same post to the same person over and over", deactivates the giver, and archives the posts pending admin review. Deleting a post claws the points back from the receiver ([help](https://help.bonus.ly/en/articles/1650845-managing-bonus-quality-user-reports-the-quality-bot)). | Keep giving currency and earning currency separate (Kudos does already). A monitor-first pattern detector is prior art for §3 guard rails. |
| **Kudos® (kudos.com)** | "Points are always optional": a zero-point message is "still a full recognition post". Senders must pick a value. The only leaderboard ranks **managers by the share of their direct reports recognised** in the last 30 days ([blog](https://www.kudos.com/blog/how-kudos-works)). | None named. | Rank coverage, not volume. Values tagging is prior art for the plant picker (#11). |
| **Disco** | Values tagging; a monthly raffle where giving or receiving earns one entry *(snippet, [site](https://values.justdisco.com/recognize))*. | — | A raffle is Chou's "rolling rewards" (CD7): cheap and not farmable beyond one entry. |
| **Nectar** | "Guardrails" to "monitor or prevent users from sending too many points to the same coworker", with monitor mode recommended first *(snippet, [help](https://help.nectarhr.com/en/articles/7993211-what-are-guardrails))*. | Monitor or block. | Pair concentration is the abuse everybody guards. Kudos' Store already has a 90-day giver-concentration aid (#18). |
| **Karma bot** | Per-request and per-period limits; users can opt out of receiving; badges for streaks and totals; "no leaderboards" *(snippet, [help](https://help.karmabot.chat/en/article/limit-karma-a8bahc/), [site](https://karmabot.chat/slack/))*. | Limits. | Opting out of the game is normal. |
| **Google gThanks / peer bonus** | Any employee could give a $175 peer bonus, with peers policing abuse *(unverified: [secondary notes](https://medium.com/desiderium-sciendi/notes-from-work-rules-by-laszlo-bock-69c61c0458c7) on Bock's *Work Rules!*)*. | — | — |

**Gap:** we found **no peer-reviewed study of collusion inside enterprise peer-bonus tools**. The evidence is vendor features (Bonusly, Nectar) and research on reciprocity in other peer-rating systems (§2.6).

### 2.5 Growth-over-time mechanics in games

| Game | Mechanic | Pattern worth stealing |
|---|---|---|
| **Stardew Valley** fruit trees | "require 28 days to mature, after which they produce one fruit per day"; "Fruit can accumulate up to three days before harvesting"; quality goes up "one star per year of tree age"; they "do not need to be watered, and will not die in the winter" ([wiki](https://stardewvalleywiki.com/Fruit_Trees)). Unwatered crops "do not die, but … do not grow" *(snippet, [crops](https://stardewvalleywiki.com/Crops))*. | **The template for kudos trees:** slow maturity, a daily yield with a 3-day cap, age brings quality rather than quantity, and neglect pauses growth instead of killing. |
| **Forest** | "every minute of concentration grows a tree"; leaving the app kills it; "Dead trees stay in your forest as an honest record … not a verdict". Plant Together: "If anyone gives up, the whole forest falls". Real trees through Trees for the Future, paid from revenue, "up to 5 real trees per account" ([site](https://forestapp.cc/)). | Growth tied to a real behaviour, and virtual → real impact, company-funded and capped (catalog #4). We avoid its tree death (§7.2). |
| **Duolingo** | Equipping up to 2 **streak freezes** "increased … active learners … by +0.38%", and Duolingo admits "the fear of losing a streak could prevent learners from even attempting one" ([blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)). **XP grinding:** learners "could spend the last few days of the month gaming the system to earn XP in bulk", so Duolingo "switched the Monthly Challenge to be Quest-based instead of XP-based" and made "XP rewards … proportionate to effort and learning outcomes" ([blog](https://blog.duolingo.com/time-spent-learning-well/)). XP Boosts can be gifted to friends in Friends Quests *(snippet, [blog](https://blog.duolingo.com/friends-quests/))*. | A live Goodhart case: XP races invite grinding, and quests are the fix. Kudos already made that move. Giftable boosters are precedent for altruistic boosters (§6.3). |
| **Habitica** | The class system "is unlocked at level 10" and can be declined; missed dailies damage your avatar, softened by class skills *(snippet, [wiki](https://habitica.fandom.com/wiki/Class_System))*. | Level-gated *identity* features with an opt-out. |
| **Cookie Clicker** | Offline production is "5% of your regular CpS and up to 1 hour … Beyond 1 hour, this is reduced by a further 90%" ([wiki](https://cookieclicker.wiki.gg/wiki/Offline_Cookie_Production)). | Idle yield is a fraction of active play and drops off sharply after a cap. Trees must never out-earn giving. |
| **Animal Crossing** money tree | Plant Bells once a day in shining soil; a one-shot harvest; returns diminish above a threshold *(snippet, [Nookipedia](https://nookipedia.com/wiki/Money_tree))*. | The literal "tree that yields points". Fun in a single-player game; in a workplace it's catalog option D in §6.2 (not recommended). |

### 2.6 What backfires: the evidence

| Finding | Source | What it means for Kudos |
|---|---|---|
| Expected, tangible, performance-contingent rewards undermine intrinsic motivation (d = −0.28 to −0.40); **positive feedback increases it**. Meta-analysis of 128 studies. | [Deci, Koestner & Ryan 1999](https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf) | Make **feedback** (notes, "Nice note", gift trees) the main reward. Keep anything tangible small, unexpected or optional. |
| People thrive when "competence, autonomy, and relatedness" are met. | [Ryan & Deci 2000](https://pubmed.ncbi.nlm.nih.gov/11392867/) | Levels serve competence, choices (plant picker, boosters) serve autonomy, and gift trees and mentoring serve relatedness. |
| Small payments can do *worse* than none ("Pay enough or don't pay at all"). A fine became "a price" and late pickups *rose*, staying up after it was removed. | [Gneezy & Rustichini 2000a](https://academic.oup.com/qje/article-abstract/115/3/791/1828156), [2000b](https://www.journals.uchicago.edu/doi/10.1086/468061) | A tiny Store payout for giving could turn appreciation into a transaction. That's the case against the §6.4 bridge. |
| Gamification's effects are positive but "greatly dependent on the context … as well as on the users". | [Hamari, Koivisto & Sarsa 2014](https://research.aalto.fi/en/publications/does-gamification-work-a-literature-review-of-empirical-studies-o/) | Pilot it, measure it, keep a kill switch (§8 Q14). |
| Points, levels and leaderboards raised the *quantity* of contributions but "did not significantly affect competence or intrinsic motivation" *(snippet)*. | [Mekler et al. 2017](https://www.sciencedirect.com/science/article/abs/pii/S0747563215301229) | XP alone buys volume, and volume is the one thing we don't want. XP must be tied to quality and breadth. |
| **Consent decides it:** "If they don't buy into the game, there is a negative effect"; "Among non-consenters, performance actually declined slightly." | [Mollick & Rothbard, Wharton](https://knowledge.wharton.upenn.edu/article/gamification-powering-game/) | A workspace switch *and* a per-member "hide the game" option (§8 Q2). |
| On leaderboards, top ranks became "complacent", and effort from low ranks faded once there seemed to be no "room for competition". | [Na & Han 2023](https://www.emerald.com/intr/article/33/7/1/178330/How-leaderboard-positions-shape-our-motivation-the) | No level leaderboard (§7.2). |
| "When a measure becomes a target, it ceases to be a good measure" (Goodhart / Strathern). Campbell: indicators used for decisions get "corruption pressures". | [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7901608/) | XP is a target, so what it measures will be gamed. Measure *breadth* and *notes*, which are hard to fake cheaply. |
| **Reciprocity:** peer-rating networks show about 41–42% positive reciprocity against a 2–5% null. It's driven mostly by the *least active* users, and "Removing ratings between low activity users is key to suppressing the reciprocity bias". | [Livan, Caccioli & Aste 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5471239/) | The 72 h reciprocity rule and per-pair decay target exactly this. Newcomers are the most likely to reciprocate, so onboarding copy should teach "no need to thank back". |
| One-sided feedback channels reduce reciprocal distortion. | [Bolton, Greiner & Ockenfels 2013](https://pubsonline.informs.org/doi/10.1287/mnsc.1120.1609) | "Appreciation received ♥" (#25) is a one-sided acknowledgement instead of a thank-back kudos. |
| Only about a third of employees strongly agree the recognition they get is **authentic**. Those who find it inauthentic or inequitable are far more likely to be job-seeking (53% / 52%). | [Gallup–Workhuman 2022](https://www.workhuman.com/resources/reports-guides/unleashing-the-human-element-at-work-transforming-workplaces-through-recognition/) | Gamification that produces token kudos makes recognition *worse*. The note is the product. |
| "Well-recognized employees are 45% less likely to have turned over two years later." | [Gallup](https://www.gallup.com/analytics/472658/workplace-recognition-research.aspx) | Why frequent, genuine recognition is worth nudging at all. |
| Equity gaps show up in recognition data (e.g. men's average monetary awards 12% higher). | [Workhuman](https://www.workhuman.com/blog/start-closing-equity-gap-with-recognition/) | Reward reaching the *unsung* (#3, the Unsung bonus), not popularity. |
| Unannounced public recognition raised later performance, mostly among workers who *weren't* recognised *(snippet)*. | [Bradler et al. 2016](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.2015.2291) | Public celebration of good recognition (Kudos of the week, #23) can lift the whole team, not just the winner. |
| Intact streaks increase engagement and broken ones hurt, especially when people blame themselves. Being able to "repair" a streak reduces the damage *(snippet)*. | [Silverman & Barasch 2023](https://academic.oup.com/jcr/article-abstract/49/6/1095/6623414) | No loss-framed streaks. If any streak-like mechanic ever ships, it needs freezes and repairs, and it should pause for PTO and outages. |

---

## 3. Idea catalog (35 mechanics by core drive)

How to read the tables:

- **Fuels** is the appreciation behaviour the mechanic should cause. If a mechanic can't name one, it doesn't belong.
- **Abuse → guard** names the most likely way to game it and the rule that stops it. "Qualifying" always means the Quest spec's qualifying kudos: a note of 3+ words, not reciprocal within 72 h, one message = one step.
- **Data** is a rough data-model impact against today's schema (`members`, `kudos`, `memberDays`, rollups, `questBoards`/`questCompletions`, `discoveries`, `notifications`, `balanceAdjustments`).
- **Cost** is a first cut: **S** ≈ a day or two, **M** ≈ a vertical slice (about a week), **L** ≈ several slices.
- ⭐ marks the recommended starter bundle (§7). 🎩 marks black-hat mechanics (§2.1): use sparingly and on purpose.
- The small print under each name gives the closest of Chou's numbered game techniques (GT#), using only numbers verified on his site (§2.1).

### CD1 Epic Meaning & Calling: "I'm part of something bigger"

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 1 ⭐ | **Team grove** (commons tree) <br><sub>GT#22 Group Quest, GT#10 Narrative</sub> | One shared workspace tree on the dashboard and App Home. It grows one ring per week when enough *distinct* members gave qualifying kudos (e.g. ≥ 30% participation). It blossoms at team milestones ("1,000 thoughtful notes"). | Participation breadth: getting quiet people to give once. | Volume can't move it: only distinct qualifying givers count. A clique can't push it alone because it needs a share of the whole team. | One `workspaceGrove` row per workspace (rings, lastWeekKey); computed from the existing `workspaceStats` week bucket plus a distinct-qualifying-giver count. | M |
| 2 | **Guild titles** <br><sub>GT#10 Narrative, GT#26 Elitism</sub> | Levels come with titles from a short lore ("Guild of Gratitude", already used in a legendary quest message): Newcomer → Apprentice → Gardener → Grove keeper → Elder. Could be themed with PostHog crests (#52). | Identity as "someone who notices people". | None meaningful; titles are cosmetic. Keep them off public rankings (§7.2). | None (derived from level). | S |
| 3 | **Keeper of the unsung** | A calling, not a quest: a quiet title and a crest line for members who regularly recognise people nobody recognised in the last 14 days. | Recognition reaching the people it usually misses (quieter or less visible colleagues). | Only works when received counts are public (`receivedVisibility = everyone`), the same gate as the *Unsung hero* quest. Otherwise waived. | Derived from `kudos.by_receiver_at` like the `unsung` quest. | S |
| 4 | **Real trees** <br><sub>GT#27 Humanity Hero</sub> | When the team grove reaches a milestone, an admin-configured pledge plants a real tree (Forest-app style) and the grove shows a "🌍 planted for real" marker. | Meaning: appreciation has an effect outside Slack. | Costs real money, so admin-only, off by default, manual fulfilment like Store rewards. | A workspace setting and a milestone log. | S |

### CD2 Development & Accomplishment: "I'm getting better at this"

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 5 ⭐ | **XP and levels** <br><sub>GT#1 Status Points</sub> | XP comes mostly from qualifying giving, with bonuses for breadth and detail and a small, capped share from receiving. Level = f(total XP). See §4. | Sustained, spread-out, specific recognition. | Farming by volume, ping-pong or mass mentions is cut by per-pair decay, a daily cap, the 72 h reciprocity rule and "max 3 recipients per message". | `members.xp`, `members.level`, plus an `xpEvents` ledger keyed by kudos batch so a revoke reverses exactly (§4.4). | M |
| 6 ⭐ | **Level-up moment** <br><sub>GT#17 High Five</sub> | A full-screen celebration (hedgehog + crest, #52) on the web, and a DM in Slack that says what just unlocked. | The feeling of progress, tied to the next thing you can do. | None. At most one DM per level. | A `level_up` notification category. | S |
| 7 ⭐ | **Crests** (milestones) <br><sub>GT#2 Achievement Symbols</sub> | One-time crests for firsts and breadth: first thoughtful note, recognised 10 / 25 / 50 different people, recognised someone in every team, a year of Steady hands. They're collected on your profile. (Not called "achievements": the glossary reserves that family of words.) | Breadth and craft, not volume. | Crests only count distinct people, weeks or teams, never amounts. | A `crests` table (member, crestKey, earnedAt), checked in the give hook like quests. | M |
| 8 ⭐ | **Next-unlock bar** <br><sub>GT#4 Progress Bar</sub> | A progress bar on the dashboard: "240 XP to level 6: a second grove plot". | Knowing what to do next. | None. | None (derived). | S |
| 9 | **Seasons** | 12-week seasons with a cosmetic season track (a ring on your crest, a seasonal tree skin). Lifetime level never resets. | A fresh start for newcomers and lapsed members. | A season track must not reset anything you own; it only adds. | A `seasonProgress` row per member per season. | M |

### CD3 Empowerment of Creativity & Feedback: "My choices matter"

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 10 ⭐ | **Lucky charm booster** <br><sub>GT#31 Boosters</sub> | Spend Seeds: your next 3 qualifying kudos roll the *receiver's* bot message with a minimum rarity of Uncommon. The Quest spec (§6.3) already plans a `minRarity` option on the roll for clean sweeps; not yet on `main`. | Making someone else's moment special. | It only affects the receiver's message, so it gives the giver nothing to farm. It only fires on qualifying kudos. | A `boosters` table (member, kind, charges, expiresAt). | S |
| 11 | **Plant picker** <br><sub>GT#11 Plant Picker</sub> | When you plant a tree you choose its species, and each species stands for a value (e.g. *Helpful oak*, *Craft maple*, *Brave birch*, customisable per workspace). The grove becomes a map of what you appreciate in people. | Naming the *why*: values-based recognition (Bonusly's hashtags idea without the hashtags). | None; it's a label. | `trees.species`; optional per-workspace species list. | S |
| 12 ⭐ | **"Nice note" feedback** | The giver's success message says what made it count: "+5 XP for saying why", "+15 XP new connection". Short notes get "Add a reason next time for more XP". | Better notes, learned by feedback, not rules. | Explains the rules without exposing others' data. It never says "reciprocal" for a single kudos (the Quest spec's inference rule). | A few vars on the giver success message. | S |
| 13 | **Grove layout** <br><sub>GT#43 Build From Scratch</sub> | Arrange your trees, paths and a bench; unlock decorations with Seeds. | Ownership and a reason to come back to the web app. | Cosmetic only. | `groveLayout` blob per member. | L |
| 14 | **Pay-it-forward chain** 🎩 | If someone you recognised goes on to recognise a *third* person within 48 h, you get a small chain bonus, and the chain is shown as a little path on the team grove. | Recognition spreading across the network. | A chain that loops back to anyone earlier in it doesn't count. Bonus capped at 3 chains a week. | A lookup on `kudos.by_giver_at` for the receiver; a `chainBonus` xpEvent. | M |

### CD4 Ownership & Possession: "This is mine and I want to grow it"

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 15 ⭐ | **Kudos grove** (relationship trees) <br><sub>GT#36 Protector Quest</sub> | Plant a sapling for a teammate you recognise. It grows a stage when you recognise that person again with a qualifying kudos *in a later week*, and each stage has a minimum age. Grown trees fruit Seeds and a little XP. See §6.2. | Recognising the same people over and over across months, i.e. real relationships, and spreading across many people because plots are limited. | Watering counts at most once per tree per quest week; reciprocal kudos don't water; growth needs time. So spamming one person does nothing. | A `trees` table (owner, partner, species, stage, waterings, plantedAt, lastWateredWeek, lastHarvestAt). Growth is computed lazily from timestamps: no cron. | L |
| 16 ⭐ | **Seeds** (soft currency) and **booster shop** <br><sub>GT#75 Exchangeable Points</sub> | Seeds come from qualifying giving, quests, crests and tree fruit, and pay for saplings, boosters and cosmetics. They're never convertible to Store balance, allowance or XP. | Choices about how to celebrate others (boosters are mostly altruistic). | Seeds are capped (a "full basket" of 200) and sinks match sources (§6.1). Following Chou's OP coins, which launched before they could be spent (§2.2), Seeds start collecting at level 1 and the shop opens at level 5. | `members.seeds` plus a `seedEvents` ledger. | M |
| 17 | **Crest and hedgehog customisation** <br><sub>GT#13 Avatar</sub> | Unlock crest frames, colours and PostHog-hedgehog accessories (#52) by level or Seeds. They show next to your name in the web app. | Identity. | Cosmetic only. | `members.cosmetics` (equipped + owned keys). | M |
| 18 | **Collection sets** <br><sub>GT#16 Collection Set</sub> | Discoveries already form a collection of 60 (72 with quest messages). Completing a *set* (all Uncommons of "receiver" messages, all Quest messages…) awards a crest and Seeds. | Keeps the existing collection loop fresh. | Discoveries can be farmed by spamming `/kudos me` (the Quest spec dropped *Collector* for this). So sets only count giver- and quest-category messages, or set bonuses give crests only, no Seeds. | Derived from `discoveries`. | S |
| 19 | **Scrapbook** <br><sub>GT#83 Alfred Effect</sub> | Receivers pin their favourite notes they received into a private scrapbook, which you can revisit or export. | The *receiver's* experience: rereading why people thanked you, which is the bit that motivates. | Private to the receiver. | A `pins` table (member, kudosId). | S |

### CD5 Social Influence & Relatedness: "We do this together"

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 20 ⭐ | **Gift tree** (visible to the receiver) <br><sub>GT#63 Social Treasure</sub> | When you plant a tree for someone, *they* see it: "Ben is growing a Helpful oak for you (Young tree)". Their profile shows "5 people are growing trees for you". | Durable, visible recognition that lasts longer than a message. | It reveals received data, so it follows `receivedVisibility` (hidden: nobody sees it; self: only the receiver; everyone: public). | Read of `trees.by_partner`. | S (on top of #15) |
| 21 | **Group quest** <br><sub>GT#22 Group Quest</sub> | A weekly team goal ("together, recognise 25 different people this week") that, when met, sends *rain* to everyone's grove (a growth tick). | Collective effort, participation. | Counts distinct recipients of qualifying kudos, not volume. | A new quest kind at workspace scope. Re-opens the Quest spec's "no team quests". | M |
| 22 | **Mentor** <br><sub>GT#61 Mentorship</sub> | From level 12, you can sponsor a newcomer (< 30 days in the workspace). When your mentee gives their first 3 qualifying kudos, both get a crest and Seeds. | Onboarding new people into the recognition habit. | One mentee at a time, max 4 a year; the mentee's kudos must not go to the mentor (that's a trade, not a habit). | A `mentorships` table. | M |
| 23 | **Kudos of the week** <br><sub>GT#55 Water Cooler</sub> | Everyone can nominate one kudos note per week (not their own, not one they received). The most-nominated note is featured in a digest (opt-in channel). | Surfacing great notes as examples. | One nomination per member; can't nominate your own or your received; the receiver can opt out of being featured. | A `nominations` table; a scheduled weekly digest. | M |
| 24 | **Brag button** <br><sub>GT#57 Brag Buttons</sub> | Share a level-up or crest in a channel with one click (opt-in, never automatic). | Social proof for the habit. | Opt-in only, rate-limited to one post a week. | None beyond a Slack post. | S |
| 25 ⭐ | **Appreciation received ♥** <br><sub>GT#45 Thank-You Economy, GT#62 Social Prod</sub> | The receiver can acknowledge a kudos with one tap ("♥ Felt appreciated") instead of thanking back. The giver gets a small XP bonus and a warm DM. | Closing the loop *without* ping-pong kudos (which the 72 h rule excludes anyway). | One ack per kudos; capped at a small weekly XP; it's not a kudos, so it never touches balances or leaderboards. | `kudos.ackedAt`; an `ack` xpEvent. | S |

### CD6 Scarcity & Impatience: "I can't have it yet"

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 26 ⭐ | **Visible-but-locked areas** <br><sub>GT#19 Milestone Unlock, GT#37 Evolved UI, GT#44 Dangling</sub> | Nav items and dashboard cards for the grove, booster shop, crests and so on show up with a lock and "Unlocks at level 3: plant your first tree". See §5. | Curiosity plus a concrete next step. | Never lock something people already had (see §5). | None (derived from level). | M |
| 27 | **Harvest window** <br><sub>GT#21 Appointment Dynamics, GT#68 Magnetic Caps</sub> | Trees fruit once a day and hold at most 3 days of fruit. Come back to harvest; nothing is lost beyond the fruit that didn't grow. | A light reason to open the dashboard a few times a week. | The cap means no big pay-out for leaving it, so no anxiety; no push notifications for it. | `trees.lastHarvestAt`. | S |
| 28 | **Golden kudos** <br><sub>GT#68 Magnetic Caps</sub> | A level perk: once a month, mark one kudos as *golden*. The receiver gets a unique golden message (legendary-rarity floor) and a golden leaf on their gift tree. It doesn't use or add allowance. | Rare, deliberate, big-moment recognition. | One a month, needs a 12+ word note, can't go to the same person twice in a quarter. | `kudos.golden`; perk usage per month. | S |
| 29 | **Growth time** <br><sub>GT#66 Torture Breaks</sub> | Tree stages have a minimum age (3 / 7 / 21 / 45 / 90 / 365 days). You can't rush a tree. | Patience; recognition over time. | That *is* the guard against bursts. | Part of #15. | S |

### CD7 Unpredictability & Curiosity: "What happens next?"

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 30 | **Mystery seed** <br><sub>GT#72 Mystery Box</sub> | A sapling's species rarity is rolled on planting, like bot messages (common → legendary). Shiny trees are rare. | Delight; the collection spills over into the grove. | Planting still needs a real, qualifying kudos to that person. | `trees.rarity`. | S |
| 31 | **Surprise fruit** <br><sub>GT#30 Easter Eggs / Sudden Rewards</sub> | Occasionally a tree drops a rare fruit: a bonus Seed bundle or a cosmetic. | Delight when you come back. | Random, tiny, capped; not tied to giving volume. | Part of harvest. | S |
| 32 | **Easter eggs** <br><sub>GT#30 Easter Eggs</sub> | Hidden messages for rare, *positive* moments: recognising someone on their work anniversary, the first kudos in a new channel, closing a pay-it-forward loop across 5 people. | Curiosity, noticing people's moments. | Triggers need a qualifying kudos; none rewards volume. | New templates in `lib/messages.ts`. | S |
| 33 | **Rarity for trees and crests** | Reuse the existing 5-tier rarity (55/25/12/6/2%) for species, fruit and crest variants. | Continuity with the discoveries people already know. | Same as #30. | Reuses `rarityValidator`. | S |

### CD8 Loss & Avoidance: "I don't want to lose it" (use sparingly)

| # | Mechanic | How it works in Kudos | Fuels | Abuse → guard | Data | Cost |
|---|---|---|---|---|---|---|
| 34 ⭐ | **Dormant, never dead** 🎩 (soft) <br><sub>GT#46 Rightful Heritage (softened)</sub> | A tree whose partner you haven't recognised in 60 days goes into autumn colours and stops fruiting. One qualifying kudos to that person wakes it up (and pairs with the *Old friends* quest). Trees never die. | Rekindling relationships you let slide. | Soft loss only: nothing is taken away, so nothing to panic about. | Derived from `trees.lastWateredWeek`. | S |
| 35 | **Seasonal event** 🎩 <br><sub>GT#86 Evanescent Opportunity</sub> | Limited-time events (e.g. a December "Harvest festival": rekindled friendships water twice). | A burst of reconnection at the end of the year. | Time-boxed, never punishes missing it, and only boosts qualifying, breadth-oriented actions. | An events table or code-defined calendar. | S |

### Guard rails that apply to every mechanic

- **One definition of "counts".** Every reward in the game reuses the Quest spec's *qualifying kudos*. There is one rule to explain and one place (`lib/parse.ts`, `lib/quests.ts`) to test.
- **Revoke undoes everything.** A revoked kudos removes the XP, Seeds, waterings and crests it produced, as quest completions already are removed.
- **Monitor first, block never (at first).** An admin-only "unusual patterns" list (the same pair every day, identical notes, closed rings of 3) is modelled on Bonusly's Quality Bot and Nectar's Guardrails (§2.4). It flags, and admins decide. It builds on the Store's 90-day giver-concentration aid.
- **Teach "no need to thank back".** Newcomers reciprocate most (§2.6). Onboarding copy and the "♥ Felt appreciated" ack (#25) give them a better way to respond.
- **Nothing is ranked.** Levels, crests, trees and Seeds never get a leaderboard.
- **Everything is optional.** A workspace switch, and a per-member "hide the game" option.

**Deliberately not in the catalog** (and why) is in §7.2: streaks with loss, XP for received *volume*, public level leaderboards, bonus allowance, trees that pay Store balance, pay-to-win XP boosters.

---

## 4. Strawman XP and level curve

### 4.1 Design goals

1. **Giving beats receiving.** For a typical member, about 90% of XP traces back to their own giving (including quests and trees). Receiving earns some, so being appreciated still feels like progress, but it's capped and counts *people*, not amounts.
2. **Breadth beats volume.** XP counts distinct people and distinct weeks. Kudos amounts (🌮🌮🌮) never matter.
3. **Farming earns less than honesty.** A points farmer (reactions, ping-pong, mass mentions) should earn well under half of what a steady thoughtful giver earns.
4. **Explainable in one sentence:** "You level up by giving thoughtful kudos (a real reason, to many people, over time)."
5. **Recomputable.** XP is a deterministic function of kudos rows, quest completions and acks, so it can be rebuilt and backfilled like the rollups (§4.4).

### 4.2 XP sources (strawman numbers)

| Event | XP | Guard |
|---|---|---|
| Qualifying kudos: per message × recipient (max 3 recipients count per message) | **10** | **Pair decay:** the 2nd qualifying message to the same person in a quest week earns 5, the 3rd and later earn 0. |
| … note of 12+ words ("Say why") | **+5** per message | Once per message. |
| … first-ever kudos to that person ("New connection") | **+15** | Once per pair, ever. |
| … last kudos to that person was 30+ days ago ("Old friends") | **+10** | Same rule as the `rekindle` quest. |
| … recipient got nothing in 14 days ("Unsung") | **+10** | Only when `receivedVisibility = everyone`, as for the `unsung` quest. |
| Non-qualifying kudos (reaction, or a note under 3 words) | **1** | Max 5 XP a day from these. |
| Reciprocal kudos (the receiver gave you kudos in the last 72 h) | **3** | No bonuses. |
| **Daily giving cap** | **50** | Everything above counts toward it. |
| Receiving: per *distinct* giver per day with a qualifying note | **3** | Max 30 XP a week from receiving. Off while `receivedVisibility = hidden` if levels are public (§8 Q2). |
| Receiver acknowledges your kudos ("♥ Felt appreciated", #25) | **2** | Max 10 XP a week. |
| Quest completed | **20** | ≤ 3 a week (the board has 3). |
| Clean sweep | **+30** | Once a week. |
| Crest earned | **25** | One-time per crest. |
| Tree fruit (harvested) | **1 per fruiting tree per day** | Max 3 days stored (§6.2). |

**What never earns XP:** received kudos *amounts*, allowance used, maxed days, discoveries, Store redemptions, Seeds spent.

**Revokes:** revoking a kudos removes exactly the xpEvents that batch created (and a quest completion that no longer holds, as the Quest spec already does). XP never goes down otherwise.

### 4.3 Three personas

| Persona | A typical week | XP/week |
|---|---|---|
| **Quiet appreciator** | 2 thoughtful messages to 2 people, one of them detailed; thanked by 2 people; 1 quest. | 20 + 5 + 6 + 20 = 51, **~55** with the odd ack or crest |
| **Steady champion** | 5 thoughtful messages to 4 people (one repeat), 2 detailed, 1 new connection, 1 rekindle; thanked by 4 people; clean sweep; 3 fruiting trees. | 45 + 10 + 15 + 10 + 12 + 90 + 21 = **~200** |
| **Points farmer** | 20 reactions a day, daily ping-pong with a buddy, one 10-person mass mention a week. | 35 (reactions, capped) + ~30 (ping-pong: decay and reciprocity) + 30 (mass mention: 3 recipients count) + 21 (receiving from the buddy) + 0 quests (reciprocal and short notes don't count) = **~85** |
| *Ceiling* | Maxes the daily giving cap every day, clean sweep, max receiving, 5 fruiting trees. | 350 + 90 + 30 + 35 + … ≈ **~515** |

The farmer earns ~40% of the champion. More importantly, the farmer's route is boring and slow while the champion's route is also the one that fills the grove and the quest log.

### 4.4 Level curve

**XP from level L to L+1 = 50 × L**, so **total XP for level L = 25 × L × (L − 1)**. Early levels come fast (onboarding), later ones take months (endgame). A cap at level 25 is suggested, after which Seasons (#9) take over.

| Level | XP to next | Total XP | Quiet (~55/wk) | Steady (~200/wk) | Ceiling (~515/wk) |
|---|---|---|---|---|---|
| 2 | 100 | 50 | < 1 wk | < 1 wk | < 1 wk |
| 3 | 150 | 150 | 2.7 wk | < 1 wk | < 1 wk |
| 4 | 200 | 300 | 5.5 wk | 1.5 wk | < 1 wk |
| 5 | 250 | 500 | 9 wk | 2.5 wk | < 1 wk |
| 6 | 300 | 750 | 14 wk | 3.8 wk | 1.5 wk |
| 8 | 400 | 1,400 | 25 wk | 7 wk | 2.7 wk |
| 10 | 500 | 2,250 | 41 wk | 11 wk | 4.4 wk |
| 12 | 600 | 3,300 | 60 wk | 17 wk | 6.4 wk |
| 15 | 750 | 5,250 | 95 wk | 26 wk | 10 wk |
| 20 | 1,000 | 9,500 | 173 wk | 48 wk | 18 wk |
| 25 | 1,250 | 15,000 | 273 wk | 75 wk | 29 wk |

Knobs for the grilling: the quiet appreciator reaching level 10 only after ~10 months may be too slow. Halving the slope (`25 × L` per level) doubles everyone's pace; a steeper early ramp (a flat 100 XP for levels 2–5) front-loads onboarding.

### 4.5 Data-model sketch

- `members.xp` and `members.level` (optional fields, `undefined` = 0/1: no migration).
- `xpEvents` (workspaceId, memberId, amount, reason, batchId?, questCompletionId?, dayKey, at), indexed by member+day (for the daily cap) and by batch (for revokes). Written inside `giveKudos` / `revokeKudosRow` / quest hooks, in the same transaction, the way rollups are.
- Pure rules in `convex/lib/xp.ts` (`xpForGive(facts)`, `levelOf(xp)`), property-tested against an independent recompute, like `lib/rollups.ts`.
- **Backfill** reuses the rollup rebuild pattern: replay each member's history through `lib/xp.ts`, so veterans get their XP and level on day one (§5.2).
- Bounded reads per give: the pair's earlier kudos this week (`by_giver_receiver_at`, already used by quests), the giver's `xpEvents` for today (daily cap), and the receiver's last-14-days probe (already used by `unsung`).

---

## 5. Strawman unlock ladder

### 5.1 How the ladder follows the four Octalysis phases

| Phase | Levels | What it's for | Examples |
|---|---|---|---|
| **Discovery** | before joining | Why would I care? | The demo, the first bot message after a kudos. |
| **Onboarding** | 1–4 | Learn the one rule (thoughtful giving) and get the first win fast. | First crest after one thoughtful note; the grove shows up locked. |
| **Scaffolding** | 5–14 | The weekly loop: quests, harvest, boosters. | Booster shop, more plots, golden kudos. |
| **Endgame** | 15–25+ | Veterans stay because they help others. | Mentor, Elder tree in the team grove, seasons. |

### 5.2 Two ground rules

1. **Nothing that already shipped gets locked.** Giving, the dashboard, discoveries, leaderboard, analytics, quests, compare and the Store stay open to everyone at every level. Taking away something people already have is exactly the kind of loss that makes a game feel hostile (CD8 rightful heritage, §2.1). Only **new** features go on the ladder.
2. **Veterans start where their history puts them.** XP is backfilled from all existing kudos rows and quest completions, so a year-long regular might start at level 9, not level 1. (The demo year from #49 gives the demo user a realistic mid-ladder level.)

### 5.3 The ladder (visible-but-locked at every step)

Each locked item is shown with a lock and a one-line "how": *"Level 6: 240 XP to go. Give a thoughtful kudos to someone new for +25."*

| Level | Title | Unlocks | Shown locked until then |
|---|---|---|---|
| 1 | Newcomer | Everything that exists today; the XP bar; the "Nice note" feedback (#12); the "♥ Felt appreciated" ack (#25). | Grove, crests, booster shop, perks. |
| 2 | Newcomer | **Crests** gallery (#7) with your first crest. | |
| 3 | Apprentice | **Grove**: 1 plot, plant your first sapling (#15), which the partner sees as a gift tree (#20); the **team grove** (#1). | |
| 4 | Apprentice | **Scrapbook** (#19); the *Keeper of the unsung* title track (#3). | |
| 5 | Gardener | **Booster shop** and Seeds wallet (#16): Lucky charm, Watering can. | |
| 6 | Gardener | 2nd plot; **Plant picker** (#11); **harvest** (#27). | |
| 8 | Gardener | 3rd plot; Fertiliser booster; collection-set bonuses (#18). | |
| 10 | Grove keeper | **Golden kudos** perk, 1 a month (#28); crest customisation (#17). | |
| 12 | Grove keeper | 4th plot; **Mentor** (#22); Megaphone booster. | |
| 15 | Grove keeper | 5th plot; **Kudos of the week** nominations weigh double (#23); seasonal skins (#9). | |
| 20 | Elder | 6th plot; an **Elder tree** with your name in the team grove; a 2nd golden kudos a month. | |
| 25 | Elder | Cap. Seasons (#9) take over; your crest gets a permanent ring per season completed. | |

Alternative worth grilling: **also gate some existing surfaces** (e.g. Compare at level 4) for *new* joiners only, grandfathering everyone already active. It makes the ladder richer but adds a "why can't I see what my colleague sees" support question.

---

## 6. Economy sketch: Seeds, trees, boosters, perks

### 6.1 Three ledgers and a firewall

| Ledger | What it is | Comes from | Goes to | Can it reach the Store? |
|---|---|---|---|---|
| **Kudos** (allowance / received) | Recognition. Unchanged. | Your daily allowance. | Receivers; received kudos are the Store balance (`received + granted − spent`). | It *is* the Store currency. |
| **XP** | Progress. Never spent, never decays. | Mostly qualifying giving (§4). | Level → titles, perks, unlocks. | **No.** |
| **Seeds** | The game's soft currency. | Qualifying giving, quests, crests, tree fruit. | Saplings, boosters, cosmetics. | **No.** Not convertible, not transferable, not counted anywhere outside the game. |

**Invariants to write into an ADR:**

1. Nothing in the game writes `members.storeGranted`, `storeSpent` or `totalReceived`, and nothing changes the daily allowance.
2. No path turns Seeds or XP into kudos, allowance or Store balance.
3. Every game reward traces back to a qualifying kudos (or a quest completion, which itself needs qualifying kudos).
4. Revoking a kudos undoes the XP and Seeds it created. Seeds already spent can make the Seeds balance negative, like the Store balance can (Store spec D9).

**Seeds flow (strawman):**

| Source | Seeds | Sink | Seeds |
|---|---|---|---|
| Qualifying kudos | 1 each, max 3 a day | Sapling | 10 |
| Quest completed / clean sweep | 2 / +3 | Lucky charm (3 charges) | 12 |
| Crest earned | 5 | Watering can (+1 growth tick, once a week) | 8 |
| Level-up | 5 | Rain cloud (team grove gets a growth tick) | 25 |
| Tree fruit | 1–3 per fruiting tree per day | Cosmetics (frames, skins, accessories) | 20–60 |
| | | **Basket cap:** 200 Seeds; fruit beyond it isn't picked | |

A steady champion earns ~30–40 Seeds a week, which buys one booster a week plus a sapling or cosmetic every couple of weeks. Plots (1 to 6 by level) cap the number of fruiting trees, so fruit can't snowball.

### 6.2 Kudos trees

**Recommended model: relationship trees.** A tree is always *yours, for one teammate*. The mechanics are modelled on Stardew Valley's fruit trees: slow to mature, one yield a day, at most 3 days of uncollected fruit, and neglect pauses a tree instead of killing it (§2.5).

| Stage | Needs (cumulative) | Minimum age | Fruit per day |
|---|---|---|---|
| 🌰 Seed | Plant: a qualifying kudos to that person + 10 Seeds + a free plot | — | — |
| 🌱 Sprout | 1 more watering | 3 days | — |
| 🌿 Sapling | 2 waterings | 7 days | — |
| 🌳 Young tree | 4 waterings | 21 days | 1 Seed |
| 🌳 Grown | 6 waterings | 45 days | 1 Seed + 1 XP |
| 🌸 Blossoming | 10 waterings | 90 days | 2 Seeds + 1 XP |
| 🌲 Ancient | 20 waterings | 365 days | 3 Seeds + 1 XP, a legendary-floor gift-tree message for your partner, and a permanent place on your crest |

- **Watering** = a qualifying kudos to the tree's partner, **at most once per tree per quest week**. Reciprocal kudos don't water.
- **Dormant, never dead:** 60 days without watering and the tree turns autumn-coloured and stops fruiting. One watering wakes it (#34).
- **Growth is computed lazily** from `plantedAt`, `waterings` and `lastWateredWeek` when read or harvested: no cron, no per-tree timers. That fits the codebase rule that public queries don't read `Date.now()` (clients pass `today`).
- **The partner sees their gift trees** subject to `receivedVisibility` (#20).
- **Plots** (1 at level 3, up to 6 at level 20) force a choice about whom to grow trees for; a tree can be *uprooted* to free a plot (it's archived in a "memories" list, not destroyed).

**Other tree models to put in front of the human:**

| Model | Pros | Cons |
|---|---|---|
| **A. Relationship trees** (recommended) | Rewards sustained recognition of real people; gift trees give receivers something lasting. | More UI; needs a privacy rule for the partner. |
| **B. One personal tree** that grows with your XP | Very simple; a pure progress visual. | Just a level bar in disguise; no relationship meaning. |
| **C. Team tree only** (#1) | Collective, zero inequity. | No personal ownership, the part the human asked for. |
| **D. Idle money tree** that yields Store kudos over time | Literal reading of "trees that yield kudos points". | Prints Store currency detached from recognition; breaks ADR 0001; the most farmable option. **Not recommended.** |

### 6.3 Boosters (consumable, bought with Seeds)

| Booster | Effect | Who benefits | Recommend? |
|---|---|---|---|
| **Lucky charm** | Next 3 qualifying kudos roll the receiver's message at Uncommon or better. | Receiver | ✅ |
| **Watering can** | One extra growth tick on one tree (still respects the minimum age). | You (grove) | ✅ |
| **Rain cloud** | One growth tick for the team grove, credited to you in the grove log. | Everyone | ✅ |
| **Megaphone** | Your next qualifying kudos is also featured in the digest channel (receiver can decline). | Receiver | ✅ (needs the digest, #23) |
| **Fertiliser** | Doubles your trees' fruit for 3 days. | You (Seeds) | ⚠️ Fine, but it's Seeds-for-Seeds; keep it pricey. |
| **XP boost** (Duolingo-style 2× for 1 h) | Doubles XP from qualifying kudos for an hour. | You (XP) | ❌ It invites bursts of token kudos in the boost window; the daily cap blunts it but the incentive is the wrong one. Chou's own OP members ended up "MUST use potions … on every video" (§2.2), and Duolingo moved away from XP races (§2.5). |

### 6.4 Perks (permanent, unlocked by level)

Perks are abilities, not multipliers: each makes your recognition richer.

| Perk | Level | What it does |
|---|---|---|
| Plots 1–6 | 3, 6, 8, 12, 15, 20 | Grow more relationship trees. |
| Plant picker | 6 | Choose a species/value for new trees. |
| Golden kudos | 10 (1/month), 20 (2/month) | A rare, special kudos for a big moment (#28). |
| Crest customisation | 10 | Frames, colours, hedgehog accessories (#17, #52). |
| Mentor | 12 | Sponsor a newcomer (#22). |
| Elder tree | 20 | Your named tree in the team grove. |

**The optional Store bridge (off by default).** Today the Store only pays *receivers*. If the human wants givers to see a real-world reward too, the least risky bridge is a **fixed, admin-configured grant at a few level milestones** (e.g. +10 balance at levels 5, 10, 15, 20), written through the existing `grantBalance` with `source: "system"` and a reason, so it shows up in the member ledger and the four-eyes context. It's bounded (a handful of grants per person, ever), it rewards thoughtful giving (the only fast way up the ladder), and admins can leave it off. It still turns giving into a paid activity in a small way, which is why it's not the default. This would re-open the Quest spec's D8 and needs its own ADR.

---

## 7. Recommended starter bundle and anti-patterns

### 7.1 A starter bundle (if the grilling wants one)

Ship in this order; each step works on its own.

1. **XP, levels, next-unlock bar, level-up moment, "Nice note" feedback** (#5, #6, #8, #12), with the backfill. *Foundation; everything else hangs off the level.*
2. **Crests** (#7). *First wins for newcomers, breadth for veterans.*
3. **Grove + gift trees + dormant-not-dead + team grove** (#15, #20, #34, #1). *The signature feature.*
4. **Seeds + booster shop** with Lucky charm, Watering can, Rain cloud (#16, #10). *Choices, and a sink for fruit.*
5. **Appreciation received ♥** (#25). *Closes the loop without ping-pong.*
6. **Visible-but-locked** everywhere (#26), rolled out alongside each of the above.

Later candidates: Golden kudos, Mentor, Kudos of the week, Seasons, Plant picker, collection sets.

### 7.2 Anti-patterns: recommended against

| Tempting mechanic | Why not |
|---|---|
| **Streaks you can lose** | The Quest spec already replaced *On a roll* with *Steady hand* because streaks push token kudos to keep the streak alive; loss-framed streaks are black-hat by design, and broken streaks demotivate (§2.6). |
| **XP for received amounts** | Invites asking for kudos and trading them; leaks received counts; rewards popularity, not appreciation. |
| **A public level or XP leaderboard** | Turns recognition into a status race; top ranks coast and bottom ranks give up (§2.6). Show levels on profiles if at all, never ranked. |
| **Bonus allowance as a reward** | "Give more to be allowed to give more" is a volume loop that also inflates everyone's Store balances (Quest spec D9). |
| **Trees or boosters that pay Store balance** | Prints real-reward currency detached from recognition (ADR 0001). |
| **XP multipliers** | Encourages bursts of low-effort giving inside the boost window. |
| **Mandatory participation** | Workplace games people didn't consent to backfire (Mollick & Rothbard, §2.6). The game layer should be switchable per workspace, and ideally hideable per member. |

---

## 8. Open questions for the grilling, ordered

Ordered by how much each answer shapes the rest. Each has the recommendation from this note.

1. **Currency architecture.** How many ledgers, and can anything in the game ever reach the Store balance or the allowance?
   *Recommend:* three ledgers (Kudos / XP / Seeds) with the firewall in §6.1; the level-milestone Store grant (§6.4) as an admin option, off by default.
2. **Visibility and consent.** Are levels, crests and trees public, private, or opt-in per member? How do they interact with `receivedVisibility`? Can a workspace turn the game off, and can a member hide it for themselves?
   *Recommend:* workspace switch (on by default in the demo, admin choice elsewhere); your level and crests visible on your profile to teammates, *never ranked*; receiving-derived bits (gift trees, receiving XP) follow `receivedVisibility`; members can hide the game UI.
3. **What earns XP.** Giving-to-receiving ratio; per message × recipient vs per kudos unit; reuse the qualifying rule?
   *Recommend:* §4.2 as written: per message × recipient (max 3), qualifying rule reused, ~3–4× giving over receiving, receiving counts distinct givers only.
4. **Does gamification re-open the Quest spec?** Quests currently give only collectible messages (D7) and no currency, bonus or public display (D8–D10).
   *Recommend:* yes, narrowly: quests grant XP and Seeds, still no Store currency, no allowance, no public quest stats.
5. **What is a kudos tree?** Relationship trees, one personal tree, a team tree, or a money tree (§6.2)? What do trees yield?
   *Recommend:* relationship trees (A) plus the team grove (C); they yield Seeds and a little XP, never Store kudos.
6. **Loss.** Can trees wither or die? Any streaks?
   *Recommend:* dormant, never dead; no loss-framed streaks.
7. **Progressive gating.** Only new features on the ladder, or also existing ones for new joiners? Backfill XP for veterans?
   *Recommend:* new features only; backfill everyone.
8. **Boosters.** Altruistic only, or also self-boosts? Bought with Seeds only, or also earned directly?
   *Recommend:* the four ✅ boosters in §6.3; Seeds only; no XP multipliers.
9. **Perks and pacing.** Which perks, at which level; the curve slope; the level cap; seasons?
   *Recommend:* §4.4 curve, cap 25, perks in §6.4; decide on seasons later.
10. **Theme and names.** Garden/island (Octalysis Prime-like), PostHog hedgehogs and crests (#52), or both? What are "Seeds", "grove", "crest" called?
    *Recommend:* garden mechanics dressed in the PostHog look: hedgehogs tend the grove, crests are the level badges.
11. **Slack surfaces.** Level-up DMs, gift-tree DMs, App Home grove, `/kudos level`? How chatty may the bot get?
    *Recommend:* one DM per level-up and per gift tree planted for you; App Home shows level + grove summary; no reminder DMs (same as quests).
12. **Admin knobs.** Which numbers can admins tune (caps, curve, Store bridge), and which are fixed in code?
    *Recommend:* on/off, Store bridge amounts, species list; everything else fixed in code for 1.x.
13. **Demo.** How does the seeded demo year (#49) show the game?
    *Recommend:* backfill the demo user to ~level 9 with a half-grown grove, one locked area one level away, and a scripted level-up on the next thoughtful kudos.
14. **Success metrics and kill switch.** What tells us it's working (distinct recipients per giver, note length, participation, share of reciprocal kudos) and what would make us turn it off?
    *Recommend:* define 3 metrics before launch and review after one season.

---

## 9. Sources

**Octalysis (Yu-kai Chou, yukaichou.com)**
- The Octalysis framework: https://yukaichou.com/gamification-examples/octalysis-gamification-framework/
- White hat vs black hat: https://yukaichou.com/gamification-study/white-hat-black-hat-gamification-octalysis-framework/
- Left brain vs right brain: https://yukaichou.com/gamification-study/left-brain-extrinsic-brain-intrinsic-core-drives-gamification/
- The four experience phases: https://yukaichou.com/gamification-examples/gamification-4-experience-phases-of-a-game/ and onboarding https://yukaichou.com/gamification-study/4-experience-phases-gamification-2-onboarding-phase/
- Core drive articles: CD1 https://yukaichou.com/gamification-study/8-core-drives-gamification-1-epic-meaning-calling/ · CD2 https://yukaichou.com/gamification-study/8-core-drives-gamification-2-development-accomplishment/ · CD3 https://yukaichou.com/gamification-study/8-core-drives-gamification-3-empowerment-creativity-feedback/ · CD4 https://yukaichou.com/gamification-study/8-core-drives-4-ownership/ · CD5 https://yukaichou.com/gamification-study/8-core-drives-of-gamification-5-social-influence-relatedness/ · CD6 https://yukaichou.com/gamification-study/8-core-drives-gamification-6-scarcity-impatience/ and https://yukaichou.com/gamification-examples/8-game-techniques-to-effectively-use-scarcity-and-impatience-in-your-life-part-6-of-8-in-lifestyle-gamification-examples/ · CD7 https://yukaichou.com/gamification-study/the-8-core-drives-of-gamification-7-unpredictability/ · CD8 https://yukaichou.com/gamification-study/8-loss-and-avoidance/
- Milestone unlocks: https://yukaichou.com/advanced-gamification/the-power-of-milestone-unlocks-in-gamification-design/
- Plant picker vs poison picker: https://yukaichou.com/advanced-gamification/exploring-the-art-of-choice-in-game-design-technique-plant-picker-vs-poison-picker/
- Booster Design System: https://yukaichou.com/advanced-gamification/booster-design-system-core-drive-power-ups/
- Strategy Dashboard: https://yukaichou.com/gamification-study/the-strategy-dashboard-for-gamification-design/
- Leaderboard design: https://yukaichou.com/gamification-analysis/leaderboard-design-definitive-guide-octalysis/
- Workplace training gamification: https://yukaichou.com/workplace-gamification/gamified-training-corporate-workplace/

**Octalysis Prime**
- Launch post: https://yukaichou.com/gamificationnews/octalysis-prime-real-life-rpg/
- Chou Coins design: https://yukaichou.com/gamification-examples/design-coins-octalysis-prime/
- Daily Quest design thread: https://yukaichou.com/gamification-analysis/daily-quest-design-octalysis-prime/
- 2023 promo: https://yukaichou.com/gamificationnews/invest-in-your-skills-octalysis-prime-58-off-for-3-days/
- Gameful Bits review: https://www.gamefulbits.com/2018/02/05/octalysis-prime-gameful-journey-learn-gamification/
- Member guide (table of contents only): https://leanpub.com/octalysisprime
- Could not be reached: octalysisprime.fandom.com (HTTP 402), the SlideShare case study, Kickstarter.

**Recognition tools**
- HeyTaco: https://heytaco.com/docs/article/75-how-does-heytaco-work · https://heytaco.com/tacotars · https://heytaco.com/features/gamification · https://heytaco.com/features/leaderboards · https://heytaco.com/docs/article/74-enable-heytaco-giver-mode-as-part-of-your-culture-of-giving
- Bonusly: https://help.bonus.ly/en/articles/357124-how-do-bonusly-points-work · https://help.bonus.ly/en/articles/9458998-managing-peer-to-peer-recognition-settings · https://help.bonus.ly/en/articles/1650845-managing-bonus-quality-user-reports-the-quality-bot
- Kudos®: https://www.kudos.com/blog/how-kudos-works
- Disco: https://values.justdisco.com/recognize *(snippet)*
- Nectar: https://help.nectarhr.com/en/articles/7993211-what-are-guardrails *(snippet)*
- Karma: https://help.karmabot.chat/en/article/limit-karma-a8bahc/ · https://karmabot.chat/slack/ *(snippets)*

**Games**
- Stardew Valley: https://stardewvalleywiki.com/Fruit_Trees · https://stardewvalleywiki.com/Crops *(snippet)*
- Forest: https://forestapp.cc/
- Duolingo: https://blog.duolingo.com/how-duolingo-streak-builds-habit/ · https://blog.duolingo.com/time-spent-learning-well/ · https://blog.duolingo.com/duolingo-leagues-leaderboards/ · https://blog.duolingo.com/friends-quests/ *(snippet)*
- Habitica: https://habitica.fandom.com/wiki/Class_System *(snippet)*
- Cookie Clicker: https://cookieclicker.wiki.gg/wiki/Offline_Cookie_Production
- Animal Crossing: https://nookipedia.com/wiki/Money_tree *(snippet)*

**Research on motivation and recognition**
- Deci, Koestner & Ryan (1999), Psychological Bulletin 125(6), doi:10.1037/0033-2909.125.6.627: https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf
- Ryan & Deci (2000), Self-Determination Theory: https://pubmed.ncbi.nlm.nih.gov/11392867/
- Gneezy & Rustichini (2000), "Pay Enough or Don't Pay at All": https://academic.oup.com/qje/article-abstract/115/3/791/1828156 · "A Fine Is a Price": https://www.journals.uchicago.edu/doi/10.1086/468061
- Hamari, Koivisto & Sarsa (2014), "Does gamification work?", doi:10.1109/HICSS.2014.377: https://research.aalto.fi/en/publications/does-gamification-work-a-literature-review-of-empirical-studies-o/
- Mekler et al. (2017), Computers in Human Behavior: https://www.sciencedirect.com/science/article/abs/pii/S0747563215301229
- Mollick & Rothbard, "Mandatory Fun": https://knowledge.wharton.upenn.edu/article/gamification-powering-game/ · https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2277103
- Na & Han (2023), Internet Research: https://www.emerald.com/intr/article/33/7/1/178330/How-leaderboard-positions-shape-our-motivation-the
- Goodhart / Campbell review: https://pmc.ncbi.nlm.nih.gov/articles/PMC7901608/
- Livan, Caccioli & Aste (2017), Scientific Reports: https://pmc.ncbi.nlm.nih.gov/articles/PMC5471239/
- Bolton, Greiner & Ockenfels (2013), Management Science: https://pubsonline.informs.org/doi/10.1287/mnsc.1120.1609
- Bradler et al. (2016), Management Science: https://pubsonline.informs.org/doi/abs/10.1287/mnsc.2015.2291 *(snippet)*
- Silverman & Barasch (2023), Journal of Consumer Research: https://academic.oup.com/jcr/article-abstract/49/6/1095/6623414 *(snippet)*
- Gallup–Workhuman (2022): https://www.workhuman.com/resources/reports-guides/unleashing-the-human-element-at-work-transforming-workplaces-through-recognition/ · Gallup: https://www.gallup.com/analytics/472658/workplace-recognition-research.aspx · Workhuman equity: https://www.workhuman.com/blog/start-closing-equity-gap-with-recognition/

**This repo**
- Store spec [#4](https://github.com/Silthus/kudos/issues/4), Quest spec [#5](https://github.com/Silthus/kudos/issues/5), Compare spec [#6](https://github.com/Silthus/kudos/issues/6), [`CONTEXT.md`](../CONTEXT.md), [ADR 0001](../docs/adr/0001-store-balance-is-received-kudos.md), `convex/schema.ts`, `convex/lib/messages.ts`, `convex/lib/settings.ts` (default `dailyLimit: 5`).
