# HedgeHug core loop through Octalysis, 2026-10-21

**Status: completed research.** Ticket: Silthus/personal#96, map Silthus/personal#95. Research only: this branch opens no PR and is never merged. The file carries mechanics and public sources only. Every drive annotation is our reading of the code, not a measured effect.

## Sources

Primary, read on 2026-10-21:

- Yu-kai Chou, [How to Build Game Loops](https://yukaichou.com/gamification-analysis/game-loop-1-of-2/), a four-part series (the ticket names part 1 of 2; the page is now part 1 of 4, with [part 2](https://yukaichou.com/gamification-analysis/how-to-build-game-loops-part-2-of-4/), [part 3](https://yukaichou.com/gamification-analysis/how-to-build-game-loops-part-3-of-4/) and [part 4](https://yukaichou.com/gamification-analysis/how-to-build-game-loops-part-4-of-4/)). Parts 2 and 3 are mostly a video wrapper with little text; part 4 carries the substance on loop closing and currency.
- Chou, [the Octalysis framework page](https://yukaichou.com/gamification-examples/octalysis-gamification-framework/) and the per-drive pages for [CD1](https://yukaichou.com/gamification-study/8-core-drives-gamification-1-epic-meaning-calling/), [CD2](https://yukaichou.com/gamification-study/8-core-drives-gamification-2-development-accomplishment/), [CD3](https://yukaichou.com/gamification-study/8-core-drives-gamification-3-empowerment-creativity-feedback/), [CD4](https://yukaichou.com/gamification-study/8-core-drives-4-ownership/), [CD5](https://yukaichou.com/gamification-study/8-core-drives-of-gamification-5-social-influence-relatedness/), [CD6](https://yukaichou.com/gamification-study/8-core-drives-gamification-6-scarcity-impatience/), [CD7](https://yukaichou.com/gamification-study/the-8-core-drives-of-gamification-7-unpredictability/) and [CD8](https://yukaichou.com/gamification-study/8-loss-and-avoidance/). Technique names and their `#` numbers below are the ones those pages print. A technique a page names without defining is marked as such.
- The earlier pass: Silthus/kudos#85 (report on `research/octalysis`), Silthus/kudos#97 (folded into the progression spec) and Silthus/kudos#452 (loot-box crates: nothing in the closed crate spoils what is inside).
- Silthus/kudos#624 Q14, "reactive only": the app joins social channels so hugs and kudos there count, but it never prompts at moments.
- Today's code: `convex/album/{packs,opening,putIn,boards,weekIssue,personPage,milestoneCatalogue,earnedEmojis,levelUp}.ts`, `convex/feedback/{albumReplies,mondayPost}.ts`, `convex/hugs/recap.ts`, `convex/progression/levels.ts`, `convex/unlocks/schedule.ts`, `convex/hoggies/{catalogue,draw,drops}.ts`, `convex/messageSettings/kinds.ts`, `convex/slack/appHome.ts`, `website/src/album/`.

What Chou's loop series says that matters here:

- An activity loop is a repeated cycle of actions. A **game loop is an activity loop with Boosters**, and a Booster is anything that changes how the next pass can be played. Boosters are CD3 (Empowerment of Creativity & Feedback) and are what keeps the hundredth pass from feeling like the first.
- Part 4 says a loop is **closed** only when the player wants to go round again, and that depends on perceived value. A currency has value when it is hard enough to earn, spendable on things that matter, losable, and visible to others. CD4, CD3 and CD6 are the drives that close a loop. Chou's own example loop closes with collectibles (CD4/5/6/7) and a currency.
- Chou's drive classes: CD1, CD2, CD3 white hat; CD6, CD7, CD8 black hat; CD4 and CD5 sit in the middle and take either hat from the design. Black hat is not bad in itself, but overuse causes a "Black Hat Rebound" (CD8 page), and loss must be tied to something the user earned (CD8 page), not manufactured.

## Today's loop, step by step

Scale: strength 0 to 3. Hat: W white, B black, M middle (CD4/5 depend on the design). Phase: D discovery, O onboarding, S scaffolding, E endgame (Chou's four phases).

| # | Step (where it lives) | What happens today | Drives (strength, hat) | Phase |
|---|---|---|---|---|
| 1 | **Thoughtful kudos in Slack** (engine, `progression/gate`) | Member spends a daily allowance to thank someone with a reason. Base XP to giver and recipient. | CD1 3 W (the thanks is the meaning), CD5 3 M (a public, visible thanks), CD3 2 W (choose the words and the emoji), CD2 1 W (base XP), CD6 1 B (the daily allowance is a cap) | D, S |
| 2 | **Pack grant** (`album/packs.ts`) | One item per giver, recipient and giver's week, written behind the scenes. The outcome is `new` (holds the recipient's sticker), `held`, `waiting` or `nextWeek` (no pack, "comes next week"). | CD6 2 B (the weekly cap per pair is a Magnetic Cap, #68), CD7 2 B (what the pack holds is unknown), CD4 2 M (sticker or hoggie to own) | S |
| 3 | **Slack reply** (`feedback/albumReplies.ts`) | In the thread or a DM, per the member's setting: "Name is new in your album", team page progress ("Team 3/5, page complete!"), a hype-emoji unlock line, an "Open your pack" button, the XP gains line. | CD5 2 M, CD4 2 M (page progress is a Collection Set, #16), CD2 2 W (a progress readout), CD7 1 B | S |
| 4 | **Website: open, then put in** (`album/opening.ts`, `putIn.ts`, `PackOpening`, tray) | Open the pack (rarity burst, 15 XP bonus, a random emoji may drop), the items land in a tray, then the member puts them in the album, where they fly to their page. | CD7 3 B (the reveal is a Mystery Box, #72), CD4 3 M, CD2 1 W (15 XP), CD3 1 W (placing, but it is a chore step) | O, S |
| 5 | **Album pages** (people by team, hoggies, earned emojis, milestones, person pages) | Collections to complete: a sticker per teammate on team pages, 54 team crests, hoggies at five rarities (weights 50/28/14/6/2), earned emojis of five kinds (team, milestone, level, hype, random), five milestone ladders of four tiers. | CD4 3 M (Collection Sets), CD2 3 W (milestones, Progress Bar #4 on pages), CD1 2 W (every page is a real colleague), CD5 2 M (earned emojis show in Slack: a Tout Flag, #64) | S, E |
| 6 | **XP and levels** (`progression/levels.ts`, `unlocks/schedule.ts`) | L2 at 20 XP, L3 at 100, then 50(L-1)(L-2). Levels open features, and a level-up reveal hands out hoggies and emojis (behind `level-up-reveal`). | CD2 3 W (Status Points #1), CD6 1 B (Milestone Unlock gates), CD7 1 B (what the reveal holds) | S, E |
| 7 | **Leaderboard** (`album/boards.ts`) | Thoughtful boards for people and teams, by week, last week, month and all time. Opt-out exists. The viewer is pinned. | CD2 2 W, CD5 3 M (competition), CD1 1 W (team crests as an Elitism hook, #26), CD8 1 B (rank anxiety, the main black hat risk) | S, E |
| 8 | **Weekly edition and digests** (`album/weekIssue.ts`, Monday post, hugs recap) | A website issue per week: packs opened, new faces, hoggies found, kudos of the week. Slack digests on Monday: the channel post and the personal hugs recap. | CD6 2 B (Appointment Dynamics, #21: a new issue each week), CD2 2 W, CD5 2 M, CD1 2 W (kudos of the week), CD4 1 M (a record of the week) | S, E |
| 9 | **Hugs** (`hugs/`) | A reaction within 24 hours gives 1 XP to each side, up to 10 a day. | CD5 2 M (Social Prods, #62: low effort endorsement), CD2 1 W | D, S |

### Loop shape against Chou's game-loop test

- **The activity loop:** thank, then item, then album, then thank again. It closes through CD4 and CD7: the next item is unknown and the album has gaps.
- **Boosters:** the thank-and-open pass plays the same every time. The only thing that varies is what the item holds. Nothing the member earns changes how they give or open the next one (the skill tree and perks exist in the backend, but the album shell has no booster tied to this loop). By Chou's definition this is an activity loop with collectibles, not yet a game loop. CD3 is the weak drive of the whole loop (strength 1 to 2 at best).
- **Currency test (part 4):** XP is earned, visible and kept for good. The album shell has no spend path (no store or coin surface in `website/src/album`), and nothing is losable. That is deliberate and fits the white hat stance. It means the loop closes on CD4/CD7 only, and CD6 closes it weakly through the weekly cap.
- **Phases:** discovery is the colleague's public thanks, onboarding is the first pack, scaffolding is the loop above, and **endgame is thin**: the diamond tiers and "every page" are far goals, and nothing changes after a member finishes a team's page or a ladder.

### What is strong, and what is not

- **Strong:** CD1 and CD5 at the source (a real person thanked for real work), CD4 and CD7 at the item, CD2 in milestones and levels.
- **Hat balance:** the loop is mostly white hat plus middle drives. The black hat drives are used lightly: the weekly cap (CD6), the reveal (CD7) and the leaderboard (CD8 by rank). Nothing expires, nothing is lost. This is what Silthus/kudos#85 recommended and what the "reactive only" rule asks for.
- **Weak:** CD3 (no creative expression or booster in the album), the endgame, and the pull from Slack to the site (the only Slack-to-site hooks are the "Open your pack" button and the weekly digests).

## Gaps

1. **Slack-to-site pull.** The reply carries one button. The digests do not mention items or the album. A member who is thanked, or who has not opened the site, sees nothing from the album in Slack. App Home is a front door to the site but not a place that says "something is waiting".
2. **The reply spoils the turn.** Today's reply says whether a person is new, shows page progress and unlocks a hype emoji before the item is opened. The map's decision ("nothing shows what an item holds before it turns") removes this. The page-progress line ("page complete!") and the hype-emoji line must move to after the turn or into the site.
3. **No booster, so CD3 is the weak drive.** Nothing the member earns changes the next pass. The skill tree and perks exist but sit outside the album loop.
4. **Thin endgame.** After a member completes a team's page, there is no new thing to do with it. Veterans see the same loop.
5. **No social proof of the norm.** A member cannot see how many teammates thanked someone this week. The boards show rank, not the shared habit (CD5 Conformity Anchor, #58).
6. **No sharing of a big win.** A legendary item or a finished page cannot be shared by the member (CD5 Brag Button, #57). Earned emojis are the only Tout Flags, and they live only in Slack's emoji picker.
7. **The first item is like any other.** Activation is the leading metric, but the first thing a new member opens has the same odds as the hundredth (CD1 Beginner's Luck, #23).
8. **Putting in is a chore step.** Opening, then a tray, then a put-in. The map already fixes this by letting the turn land the item on its page.

## Candidate mechanics, ranked for the social-pull grilling

Cost: XS under a day, S a day or two, M about a week, L more. "Fit" checks the map's decisions (items turn one at a time, nothing spoils before the turn, XP moments on return, no stored data deleted, every piece behind a sandbox-only flag) and the "reactive only" rule.

| Rank | Mechanic | Technique | Step | Drive | Cost | Fit |
|---:|---|---|---|---|---|---|
| 1 | **"Items wait" line where the member already looks**: one spoiler-free line ("3 items wait, 2 thank-yous came in") in App Home, in the Monday hugs recap and in the reply. | Mystery Boxes (#72) teaser with Appointment Dynamics (#21) | 3, 8 | CD7, CD6 | XS to S | Fits fully. The reply copy is already decided ("An item for thanking X · 3 wait"). App Home is opened by the member, the recap is an existing scheduled digest the member can turn off, so it never prompts at a moment. The count reveals nothing about what the items hold. |
| 2 | **Brag button on a big win**: after a turn that lands a legendary or epic item, a finished team page, or a diamond tier, an optional "Share to Slack" that the member presses, with a link the site unfurls into the item card. | Brag Buttons (#57), Tout Flags (#64) | 4, 5 | CD5, CD4 | M | Member-initiated, so it respects "reactive only". It only appears after the turn, so nothing spoils. Needs the site to serve a public item card and the app to post as the member's choice into a channel the member picks; needs a graphics-team look first (the map already parks that). Never auto-post, never default on. |
| 3 | **Norm line**: "N teammates gave thanks this week" (workspace level, no names) at the end of the XP moment, in App Home and in the Monday post. | Conformity Anchor (#58) | 6, 8 | CD5, CD1 | S | Data exists (board tallies). Fits XP moments (it is the closing line). Chou's caution: top givers relax toward the average, so show a count of people, not an average rate. |
| 4 | **Beginner's Luck**: the member's first item has a rare floor. | Beginner's Luck (#23) | 4 | CD1, CD7 | XS | The draw already takes a `floor` rarity. The item still lies face down, so nothing spoils, and the burst on the turn is bigger. It goes at the first-kudos moment, which is where activation is decided. Chou pairs this with a Grown Up Lock (CD6); do not add one. |
| 5 | **Page-complete moment, after the turn**: when a turn completes a team page, the site celebrates and the team's emoji joins the earned shelf. A later, member-chosen "see my page" link replaces the "page complete!" reply line. | Collection Sets (#16), Tout Flags (#64) | 5 | CD4, CD5 | S | This is the spoiler fix for gap 2 turned into a mechanic. The celebration exists in the reply today and moves to the turn. |
| 6 | **Easter egg item**: now and then a second item rides along with a turn, never announced. | Easter Eggs / Sudden Rewards (#30) | 4 | CD7 | S | White-leaning on Chou's page. Nothing is promised, so nothing spoils, and the surprise lands at the turn. Needs an economy call (how often) and a draw seed. Risk: users hunting hidden triggers (Chou's own caution). |
| 7 | **Glowing next choice**: after the last turn, one soft highlight on the team page the member is closest to finishing. | Glowing Choice (#28) | 4, 5 | CD7, CD2 | S | Guides without prompting. Counts only, no named missing person (Silthus/kudos#85 advice). Helps retention more than pull. |
| 8 | **Favourites on a page**: pick three hoggies to show on one's own page and person card. | Build From Scratch (#43) or Blank Fills (named on the CD3 page without a definition), Tout Flags (#64) | 5 | CD3, CD4 | M | Fills the CD3 gap with a small act of self-expression. Not social pull by itself. |
| 9 | **Milestone booster**: a tier or a finished page makes the next item roll from an uncommon floor. | Boosters (#31), Milestone Unlock (#19) | 5, 6 | CD3, CD2 | M | Closest to Chou's own game-loop test. Conflicts with "no spoilers" in part (the floor tells a little), and it tempts thanks for the item's sake. Defer until the core flow has run for a while. |
| 10 | **Team page quest**: a team's page completes through the whole team's thanks. | Group Quests (#22), Elitism (#26) | 5 | CD5, CD1 | L | Collective pressure and last-member blame were the main risks in Silthus/kudos#85 and #97. Defer. |

### Rejected, with the reason

- **Thank-You Economy (#45)**: giving creates pressure to give back (CD5 page). Silthus/kudos#85 warned against repayment duty and incoming-thanks solicitation.
- **Countdown Timers (#65), Evanescent Opportunities (#86), FOMO Punch (#84), Sunk Cost Prison (#50), Torture Breaks (#66)**: every one works through expiry or loss. The CD8 page says loss must be tied to something earned, and Silthus/kudos#85 and #452 say nothing expires and nothing is rerolled. They also read as prompts at moments.
- **Rolling Rewards / lottery (#74)**: a black hat technique at scale, and a per-period winner clashes with the no-expiry stance.
- **Social Prods (#62) as nudges** ("Nudge Alex to thank you"): a push to thank. It breaks "reactive only" and the old-bot lesson (bots that rely on being remembered die; ones that wait to be opened do not).

## Calls made

- The research reads "reactive only" as: no new message appears at a moment, an event the app dates itself. A line inside a surface the member opens (App Home, the site) or inside a message that already exists (the reply, the Monday digests) is reactive. Only a member's own press may post anything new.
- The Monday digests (channel post and hugs recap) count as inside the rule because they are scheduled by the week, not by a moment, and the member or maintainer can turn them off. They are the only places to carry a stat to people who have not opened the site.
- Techniques are named only as the per-drive pages define them; where a page names one without defining it (Blank Fills), the table says so.
- Quests, Journey, coins and the skill tree were not re-audited: Silthus/kudos#85 and #97 did that, and the album shell does not use them.

## What this file does not claim

No measured effect of any mechanic on kudos behaviour: Octalysis is a design framework (Chou states its brain labels are symbolic, not science). Costs are rough sizing from reading the code, not estimates.
