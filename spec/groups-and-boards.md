# Spec: groups and the group boards (groups stopping point 3)

> **Accepted on [#52](https://github.com/Silthus/kudos/issues/52) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/groups` and is never merged. It is the stopping-point spec for groups stopping point 3. It ships the groups spec's rules G1–G12, G19–G21, G25–G27, G28 (the group), G42–G43 and G45 (`spec/groups.md` on `docs/spec-groups` at `6da9b18`) as amended by the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`, "Changes to the groups spec"), plus the group quest P82. Where this file differs from those rules, this file wins, and each difference is a numbered call under "Further Notes".
>
> **Rule numbers.** This spec's rules are cited as `GB1`–`GB36`. Groups rules are cited as `G20`, progression rules as `P82`, core loop rules as `R5`, website rules as `WS344`.
>
> Sources: ticket #52 and its two amendments (#86, #97); map #1's decisions 12 ("things I would cut: boosters, group auras, ..."), 15 (user groups as teams on PostHog persons), 18 ("let's just turn them all on for everyone ... code where it's not yet fully there still has the flags only for me") and 11 (every new feature behind a flag); the code on `main` at `2fe2a5a` (the Everyone board in `convex/leaderboard/`, the user group copy in `convex/workspace/userGroups.ts` and `convex/slack/userGroups.ts` from #205, D17 in `convex/commands/`, quests in `convex/quests/`); the website map's needs (map #57, needs 3 and 4, from `spec/website-7.md` on `docs/spec-website-7`: WS343, WS344) and its conductor's answer of 2026-10-14.
>
> **The word is group, never team.** A group is a Slack user group that counts for Kudos. The app's slash command is `/hedgehug`.

## Problem Statement

The Everyone board shows who gave the most kudos across the workspace, but people don't work across the workspace: they work in groups. A member can't see how their own group is doing, can't compare it with the people right around them, and gets no sense of their group thanking more than it did last week. Groups that thank a lot get no credit; a small group can't compete with a large one on raw totals. Nothing gives a group something to do together. And the website, which already shows the Everyone board, waits for group facts before it can show the group boards, the member's group on their public card and the group quest.

## Solution

**HedgeHug reads the workspace's Slack user groups and treats each enabled custom one as a group.** It already keeps a copy of them for PostHog (#205); groups build on that copy and never call Slack themselves.

- **A primary group.** A member in several groups counts for one. HedgeHug picks the smallest of their groups for them, and they can pick another in the welcome message or in the Settings tab. A member in one group counts for it; a member in none gives kudos as before.
- **Attribution.** Every kudos counts for the giver's primary group at the moment it was given, once, for good. Switching groups never moves past kudos.
- **The group boards.** The Leaderboard tab and `/hedgehug leaderboard` gain two boards above the Everyone board: **Groups**, ranked by kudos given per member so small groups compete fairly, with participation breaking ties, and **My group**, the members of the viewer's group by what they gave for it. Each shows the same window as the Everyone board, a private line about the group's progress, and the most improved group. Under the Everyone board, a member who improved more than most of their group is told so.
- **The group quest.** Each week, each group gets one quest it finishes together: enough members each do one thing, and everyone who helped gets the reward. It shows how many took part, never who.
- **The Admin tab** gets the group mode (every group, or only the groups an admin picks) and a Monday post that celebrates the top groups in the announcement channel and never names a person.
- **The website** gets the facts it waits for: the group boards' ranked rows, the viewer's group and standing, places climbed since last period on every board, the peer line and the group quest's counts.
- **Three slices, each behind a flag that starts sandbox-only:** groups, the group mode and the boards (`groups`), the group quest (`group-quest`), and the Monday post (`monday-post`). Facts are recorded dark from the first deploy, so the boards have history the day their flag turns on.

## User Stories

**Groups**
1. As a member, I want HedgeHug to know my Slack user groups without me setting anything up, so that groups match how we already work.
2. As a workspace admin, I want every custom user group to count by default, so that groups work the day they ship.
3. As a workspace admin, I want to switch to an allowlist of groups, so that interest groups and on-call aliases don't compete.
4. As a workspace admin, I want Slack's automatic admin and owner groups never to count, so that they don't appear as a group.
5. As a member of a workspace without user groups, I want no empty group screens, so that the app doesn't look broken.
6. As a member, I want a group that is disabled in Slack to disappear from the boards without erasing what it did, so that history stays true.
7. As a member, I want my group membership to follow Slack, so that I never maintain it twice.
8. As a member who is deactivated, I want to leave my groups' counts, so that the boards count the people who are here.

**Primary group**
9. As a member in several groups, I want to pick the group I count for in the welcome message, so that the choice is made when I first meet the app.
10. As a member in several groups, I want a sensible default when I don't pick, so that ignoring the question is fine.
11. As a member, I want my default to stay put when other people join or leave groups, so that I don't silently change groups.
12. As a member, I want to change my primary group in the Settings tab at any time, so that I can follow a move to another group.
13. As a member, I want switching groups never to move my past kudos, so that past weeks stay as they were.
14. As a member removed from my primary group in Slack, I want to fall back to another group quietly, so that the app doesn't nag me.
15. As a member who joins my first group, I want it to become my primary group automatically, so that I count without doing anything.
16. As a member without a group, I want to give and receive kudos as usual, so that groups are never a requirement.
17. As a member who picked a group that is no longer mine, I want a clear message and a new choice, so that a stale dropdown doesn't confuse me.

**The group boards**
18. As a member of a small group, I want groups ranked by kudos given per member, so that big groups don't win by size.
19. As a group, we want participation to break ties, so that a group where everyone gives wins over one where one person does.
20. As a member, I want to see my group's rank with the top 3 and the groups around mine, so that I can compare with the groups near us.
21. As a member, I want to see how much more my group gave per person than this time last period, so that our progress shows.
22. As a member, I want my group's best period when we haven't improved, so that there is still something to aim for.
23. As a member, I want the most improved group named, so that progress is celebrated, not only the top.
24. As a member, I want a board of the people in my group by what they gave for it, so that I can compare with my closest colleagues.
25. As a member who changed group, I want my kudos for my old group to stay on its board, so that every group's history stays true.
26. As a member who left the leaderboards, I want to stay off the My group board too, while my kudos still count for my group, so that I can play quietly.
27. As a member, I want to know when I improved more than most of my group, so that a good week feels recognised.
28. As a member, I want the group lines never to state a loss, so that the boards stay encouraging.
29. As a member, I want the group boards in the Leaderboard tab and in `/hedgehug leaderboard`, for this week, this month and all time, so that I can check them where I am.
30. As a member who hasn't opened the Leaderboard yet, I want the group boards to wait with it, so that unlocks stay consistent.

**The group quest**
31. As a member of a group, I want a quest my group works on together each week, so that thanking feels like a team effort.
32. As a member, I want the quest never to need everyone, so that nobody is the one who held the group back.
33. As a member, I want to see how many of us took part against the goal, never who did or didn't, so that there is no list of who's missing.
34. As a contributor, I want the reward when the goal is reached, even if I helped before it was, so that early help counts.
35. As a member who helps after the goal was reached, I want the reward too, so that joining late still pays in the same week.
36. As a member who changes group mid-week, I want my quest to stay with the group I started the week in, so that the goal doesn't move under anyone.
37. As a member, I want App Home and the website to show when the group quest is done for me, so that the moment is visible.
38. As a member, I want a group quest to exist only when my group can finish it, so that a group of one never gets an impossible quest.

**Admin and the Monday post**
39. As a workspace admin, I want the group mode and the allowlist in the Admin tab, so that I configure groups in Slack.
40. As a workspace admin, I want to switch on a Monday post in the announcement channel, so that the whole company sees which groups thanked the most.
41. As a member, I want the post to name groups only, never people, so that nobody is ranked in public.
42. As a workspace admin, I want the post at 9:00 in my time zone, so that it lands at the start of our week.
43. As a workspace admin, I want to be told when the app can't post in the channel, so that I can fix it.
44. As a member who isn't an admin, I want never to see the admin settings, so that Settings stays simple.

**The website and the profile card**
45. As a member on the website, I want the Groups and My group boards with the same facts Slack shows, so that the two never disagree.
46. As a member on the website, I want to see which rows climbed since last period, never which fell, so that the arrows encourage.
47. As a member on the website, I want my group's standing and the peer line in "Where you stand", so that my progress is in one place.
48. As a member on the website, I want the group quest's counts and my own part, so that I can follow it from the browser.
49. As a colleague, I want a member's primary group on their profile card, so that I know where they work.

**Rollout and robustness**
50. As the product owner, I want each slice dark behind its own flag, sandbox-only plus my email, so that I roll it out myself.
51. As a member, I want every count recorded once per kudos message, so that a Slack retry never inflates a board or a quest.
52. As the product owner, I want the facts recorded while the flags are off, so that the boards have history the day they turn on.

## Rules

"Member" is R5's member. "The viewer" is the member looking at a board. A **period** is G13's: this week, this month or all time, over allowance days. "Applies" for a flag means it is on in the member's decision (per-member flags, #203), or the workspace decision for a caller the directory doesn't know.

### Groups

- **GB1. Which groups count** (G1, G5). A Slack user group **counts** when it is enabled, isn't one of Slack's automatic admin and owner groups, and, in allowlist mode (GB27), is on the allowlist. A group is identified by its workspace and Slack group ID, never by its name or handle, and shown by its Slack name. A group that stops counting is **archived**: no primary group, board or new group quest from then on (GB36); everything recorded for it stays; if it counts again, it comes back with its history.
- **GB2. Following Slack.** Groups read the user group copy the directory already keeps (#205: a daily full sync and a refresh on `subteam_created`, `subteam_updated` and `subteam_members_changed`); they never call Slack. A group's **members** are the people in its copy whom the directory knows as members (R5). A change takes effect at the instant the app records it (the copy's, the directory's or the group mode's write), never earlier. Every such change reconciles the primary group of each person it touches (GB5–GB8) in bounded pages, and every write that depends on a member's primary group (attribution, a pick, the group quest's draw) first reconciles that one member against the recorded facts, so a page that hasn't reached them yet never leaves a kudos attributed to a group they had already left or that had stopped counting (call 13). The boards' member counts may lag a running reconciliation by its pages.
- **GB3. Groups available** (G4 as amended). Groups are available in a workspace when at least one group counts there. When none does (a Slack plan without user groups, an empty allowlist, no custom groups), every group surface is hidden: the welcome message's group block, the Groups and My group boards, the peer line, the primary group setting, the group on the profile card, the group quest and the Monday post switch. Nothing else changes.
- **GB4. The sandbox check.** The first ticket records whether the Slack Developer Program sandbox has user groups. If it doesn't, Slack-facing proofs run at seam 1 with signed `subteam_*` events and a stubbed `usergroups.*`, and the real-workspace check moves to the ship's production proof.

### Primary group

- **GB5. One or none** (G6). A member in at least one counting group has exactly one primary group, one of their current counting groups. A member in none has none.
- **GB6. The default** (amends G7, call 1). A member who has no primary group and gains one or more counting groups gets the **smallest** of them as primary group: the fewest members (GB2), ties broken by Slack group name, then ID. The default **holds** until the member leaves it, it stops counting, or they pick another; it is not recomputed when groups' sizes change. A member's current groups and primary group are kept as one row per member, so reconciling one member reads a bounded number of rows.
- **GB7. Picking** (G8). A member picks their primary group in the welcome message (GB19) or in the Settings tab (GB20), through the D17 command `pickPrimaryGroup`. A pick of one of the member's counting groups is stored and applies to kudos from the instant it is saved; a pick of anything else changes nothing. Picking the current primary group again changes nothing.
- **GB8. Fallback** (G9). When a member leaves their primary group, or it is archived, their primary group becomes the default of GB6 over their remaining counting groups, or none. No DM is sent.
- **GB9. History.** Every change of a member's primary group is recorded, insert-only, with its instant (the instant its cause was recorded, GB2) and its cause (`default`, `picked`, `fallback`), and publishes `primaryGroupChanged`. "The primary group at instant t" is the entry with the latest instant at or before t; a change recorded in the same millisecond as a spend applies to it.

### Attribution

- **GB10. Attribution** (G10). Every Given kudos message counts for the **giver's primary group at its spend instant** (`kudosGiven.at`), read from the history (GB9) after reconciling the giver (GB2), so a subscriber that runs late or a replay gives the same answer. It is recorded once per message, insert-only, with its kudos, allowance day, spend instant, group (or none), each award's stored gate decision and each recipient's primary group at the spend instant, and publishes `awardsAttributed` with the same facts. A giver without a primary group then counts for no group. The recipients' groups don't change the attribution.
- **GB11. Dark from the first deploy** (call 3). Primary groups, their history and attributions are recorded from the deploy of the first slice, whatever any flag says, like the Everyone board's totals. Kudos given before that deploy count for no group; nothing is backfilled.
- **GB12. Group totals follow attribution.** The kudos each member gave for each group are kept as one row per group, member and period (week, month, all time), with the period's running total by day of the period, fed only by `awardsAttributed`, so a group total never exists without its attribution and "the previous period up to the same day" is one read per row (GB35). They are a cache: they can be rebuilt from the attributions.

### The group boards

- **GB13. The Groups board** (G20). It lists every counting group that is the current primary group of at least 3 members. A group's **score** is the kudos attributed to it in the period divided by its current number of primary-group members, shown with one decimal. Its **participation** is the share of its current primary-group members who gave at least 1 kudos attributed to it in the period, shown as a whole percent rounded down. Groups are ranked by score; ties go to participation, then total kudos, then name; equal on all three share a rank (G16). The window is G17's, around the viewer's primary group; a viewer whose group isn't listed sees positions 1–3.
- **GB14. The group's lines** (G20). For this week and this month, under the Groups board, the viewer's primary group (when listed) gets one line: `▲ {gain} more per person than this time last {period}`, where the **gain** is (the kudos attributed to it in the period so far − the kudos attributed to it in the previous period up to the same day, G18's comparison) ÷ its current primary-group members, rounded once to one decimal, with ` · ▲ {places} places` when it was on that board then and is higher now; otherwise `{group}'s best {period} so far: {score} per person.` when it has a completed period with kudos; otherwise nothing. Then `📈 Most improved: {group}` names the listed group with the largest gain, when that gain is above 0 (ties: name). No line ever states a loss.
- **GB15. The My group board** (G21). It ranks the members whose current primary group is the viewer's by the kudos they gave **attributed to that group** in the period, with G15–G17's rules and G22's `Show me on the leaderboards`. A viewer without a primary group doesn't get it.
- **GB16. The peer line** (G19). Right after the Everyone board's improvement line, a viewer whose gain (G18) is above 0 and larger than the gain of more than half of the other members with the same current primary group gets `You improved more than {p}% of {group}.`, where `p` is the share of those members with a smaller gain, rounded down to a multiple of 10. Every gain is G18's, over all kudos given. Only for groups with at least 3 other members; only for this week and this month.
- **GB17. Where they show** (G23, G42 as amended). The Leaderboard tab shows, for the selected period, the Groups board, the My group board and the Everyone board, in that order, each only when it applies, under the existing period buttons. `/hedgehug leaderboard [week|month|all]` replies privately with the same boards. The group boards and the peer line show only where `groups` applies to the viewer and groups are available (GB3), and follow the Everyone board's unlock (P76: before the member opens the Leaderboard they get its replies).
- **GB18. Places climbed** (new, website need 4). Every ranked row of the Everyone, My group and Groups boards carries **`climbed`**: how many positions it rose against the same board in the previous period up to the same day (G18's comparison), a positive number, or nothing when it didn't rise, wasn't on that board then, or the period is all time. No read ever states a drop. Slack shows no arrows. On the Everyone board, `climbed` comes with the board wherever it shows (`everyone-board` and the Leaderboard's unlock), independent of `groups` (call 9).

### The welcome message and Settings

- **GB19. The welcome block** (G11, G12). Once groups are available and `groups` applies to the member, the welcome message (R42–R44) gets a group block after its third line: in several counting groups, `Which group do you count for on the leaderboard?` with a dropdown of their groups preselected with their primary group and a **Save** button; in one group, `You count for {group} on the leaderboard.`; in none, no block. **Save** runs `pickPrimaryGroup` and updates the message in place to `Saved. You count for {group} on the leaderboard. You can change it in App Home.`, or `{group} isn't one of your groups anymore. Pick another one.` when the pick is refused. A member welcomed before gets no second welcome message.
- **GB20. Settings.** Where `groups` applies and groups are available, the Settings tab shows the primary group: a dropdown of the member's counting groups for a member in several, `You count for {group} on the leaderboard.` for a member in one, nothing for a member in none. Choosing in the dropdown runs `pickPrimaryGroup` and republishes App Home.

### The group quest

- **GB21. One group week** (P82). A group quest's week runs from Monday 00:00 UTC to the next; an award belongs to the group week its spend instant (`at`) falls in, whenever it is processed. At that Monday instant its **participants** are fixed: the members whose primary group the group was then (GB9), who had opened Quests by then (the stored opening time) and to whom `quests`, `groups` and `group-quest` apply when the draw runs (call 5). Joins, leaves, picks and fallbacks during the week change neither the participants nor the target. A group with fewer than 2 participants has no group quest that week; a member without a primary group then has none. A group gets its first group quest at the first Monday after `group-quest` applies in the workspace, never mid-week (call 14). The draw runs from the hourly sweep, in bounded pages of groups.
- **GB22. The quest and its target.** The group quest pool holds two quests, both counting qualifying recognitions, never kudos units (P83): `together-say-why`, `Thank someone and say why.` (a Given award whose stored gate decision says why), and `together-reach-out`, `Thank someone outside {group}.` (a Given award to a recipient whose primary group at the spend instant isn't the group, from the facts `awardsAttributed` carries). The draw keeps only quests that are feasible (P80): `together-reach-out` needs at least one member whose primary group at the draw isn't the group; `together-say-why` is always feasible and is the fallback. Among the feasible ones the week's quest is drawn deterministically per group and week, and stored with its participants, target, reward, catalogue version and the facts that made it feasible. The **target** is `min(3, participants − 1)` participants who each do the action at least once in the group week, counting only their kudos attributed to the group (GB10).
- **GB23. The reward** (P82, P86). When the target is reached, every participant who has contributed gets the reward once; a participant who first contributes later in the same group week gets it at that contribution. Contributions after the week count for nothing. The reward is 15 coins and no XP, fixed at the draw; while coins (#30) hasn't shipped it holds no coins, and a reward with nothing in it has no crate (call 6). It is a reward record keyed by member, group and week (P87). Once coins ship and a group reward holds coins, its crate joins the member's pending crates and stays openable for good, whatever their group is then (P85).
- **GB24. Counts, never names** (P82). Members see how many took part against the target and whether they themselves did, never who did, who didn't or how much anyone gave. App Home's Quests section shows `{group} quest: {goal} · {n} of {target} took part`, with ` · ✅` when done. The success reply says nothing of the group quest (call 15): its progress is recorded after `awardsAttributed`, after the reply is released.
- **GB25. Where it applies.** The group quest exists only where `group-quest`, `groups` and `quests` apply and groups are available. Draws, progress and rewards are recorded only where it applies (P75: a quest is a goal, not an earning).
- **GB36. The week's lifecycle.** A participant who changes primary group mid-week can't contribute to the old group's quest from then (their kudos are attributed to the new group, GB10) and isn't a participant of the new one until next week; what they contributed stays. The target never changes, so a week whose target can no longer be reached (members deactivated, a group archived) ends without a reward. When a group is archived mid-week its quest ends at that instant: no further contributions, and every reward already recorded stays. While a flag that GB25 needs is off, nothing new is recorded; turned on again in the same week, contributions count from then.

### Admin

- **GB26. Admins** (G43). Admins are the workspace's Slack admins and owners, read from the directory. Only they see the groups settings in the Admin tab, and an admin command from anyone else changes nothing.
- **GB27. The group mode** (G1, G42). Where `groups` applies and the member is an admin, the Admin tab shows `Groups that count` with **Every group** (the default) and **Only these groups**, and, in the second mode, a picker of every enabled custom group by name. The command `setGroupMode` stores the mode and allowlist, which take effect at that instant (GB2), and reconciles every member's primary group. An empty allowlist makes groups unavailable (GB3).
- **GB28. The Monday post** (G25–G27). Where `monday-post` applies, an admin can switch on the Monday post once groups are available and an announcement channel is set. It goes out every Monday at 9:00 in the time zone of the admin who switched it on, shown and changeable in the Admin tab. It covers last week's seven allowance days: `🏆 Last week in kudos`, up to three lines `{medal} {group} · {score} per person` ranked as on the Groups board, `📈 Most improved: {group}` when a group gained, and `{n} people gave kudos last week. Thank you!` where `n` counts distinct givers. It never names a person. **At most once per week:** before calling Slack, one mutation rechecks the switch, its settings generation (bumped by every switch or time zone change, so a stale job does nothing), `monday-post`, the channel and groups availability, and claims the workspace's week; only the claimer posts. A post whose answer is lost or ambiguous is never retried that week. Nothing is posted when nobody gave; when the app can't post, the Admin tab says `I can't post in {channel}. Add me to it or pick another channel.` and that week is skipped.

### Flags, privacy and robustness

- **GB29. Three flags** (decisions 11, 18). `groups` (GB1–GB20, GB27 and GB32 surfaces), `group-quest` (GB21–GB25) and `monday-post` (GB28) each start with `environment = sandbox` plus the product owner's email, created by the slice's gate ticket. `climbed` on the Everyone board follows that board's own gates (GB18). Each flag is read in the mutation that decides what a member sees (O35), with one exposure per member and value (O36). Turning a flag off hides its surfaces and rewrites nothing; on again shows everything unchanged.
- **GB30. Exactly once** (G44). Attributions and group totals are written once per kudos message. A group quest contribution is written once per participant, group and week (later messages add nothing), and a group quest reward once per member, group and week. A redelivered `kudosGiven` or `awardsAttributed`, a retried subscriber, and the attribution, totals and quest subscribers running in any order never count twice.
- **GB35. Scale.** Every board read touches at most one totals row per member and period plus one directory row per listed member, and every write touches a bounded number of rows; reconciliation, the group quest draw and the Monday post page their work so no mutation exceeds Convex's limits (32,000 documents read, 4,096 index ranges, 1,000 functions scheduled). A scale acceptance test seeds a workspace of 1,500 members in 60 groups, every member giving every day for a month, and reads every board and runs every write with Convex's transaction limits enforced. The Everyone board's comparison moves to the same one-row-per-member reading in the ticket that adds `climbed` (call 16).
- **GB31. Standings stay private** (G45). Individual boards are seen only inside App Home, private replies and the member's own website session. The only public post, the Monday post, names groups only. The group quest names nobody, to anyone.
- **GB32. The profile card's group** (G28 as amended). The profile card (#53) shows the member's current primary group, from `primaryGroupOf`, where `groups` applies to the viewer and groups are available.

### Analytics

- **GB33. Events** (O-spec, #79). `leaderboard viewed` gains the board values `groups` and `my-group`. `primary group picked` is captured with its surface (`welcome`, `settings`, `website`). `quest drawn` and `quest finished` carry `kind: "group"` for the group quest. No group name or Slack group ID is an event property; PostHog persons already carry teams (decision 15).
- **GB34. Copy.** The app speaks as "I", plain and short (R36, P70). Copy is the table below.

### Copy

| Message | Text |
| --- | --- |
| Welcome, group block (several groups) | `Which group do you count for on the leaderboard?` + dropdown + **Save** |
| Welcome / Settings (one group) | `You count for {group} on the leaderboard.` |
| Group saved | `Saved. You count for {group} on the leaderboard. You can change it in App Home.` |
| Group no longer yours | `{group} isn't one of your groups anymore. Pick another one.` |
| Groups board heading | `Groups` |
| My group board heading | `{group}` |
| Groups board row | `{medal} {group} · {score} per person · {participation}% gave · {total} kudos` |
| Group's improvement line | `▲ {gain} more per person than this time last {period}` + optional ` · ▲ {places} places` |
| Group's best period | `{group}'s best {period} so far: {score} per person.` |
| Most improved group | `📈 Most improved: {group}` |
| Peer line | `You improved more than {p}% of {group}.` |
| Group quest (App Home) | `{group} quest: {goal} · {n} of {target} took part` + optional ` · ✅` |
| Group mode | `Groups that count` · **Every group** / **Only these groups** |
| Monday post | `🏆 Last week in kudos`, up to three `{medal} {group} · {score} per person`, `📈 Most improved: {group}`, `{n} people gave kudos last week. Thank you!` |
| Monday post can't post | `I can't post in {channel}. Add me to it or pick another channel.` |

## Implementation Decisions

### Modules

Every domain function is internal (L1); only the Slack adapter knows Slack.

- **Groups (new)**: counting groups over the directory's user group copy, the group mode and allowlist, primary groups with their history, reconciliation, and attributions (GB1–GB11). It subscribes to `kudosGiven` for attributions and is called by the user group copy and the directory after each change (GB2). It publishes `primaryGroupChanged` and `awardsAttributed`. Its reads are the interface below.
- **Leaderboard (extended)**: group totals fed by `awardsAttributed` (GB12); the Groups and My group boards, the group lines and the peer line, composed by the existing pure board functions extended with tie-breaks and `climbed` (GB13–GB18); the Monday post (GB28).
- **Quests (extended)**: the group quest pool, the weekly group draw, progress from `awardsAttributed`, reward records and the App Home line (GB21–GB25, GB36).
- **Slack adapter (extended)**: the Leaderboard tab's and `/hedgehug leaderboard`'s group boards, the welcome block, the Settings dropdown, the Admin tab's group mode and Monday post, and posting the Monday post.
- **Commands (D17, extended)**: `pickPrimaryGroup`, `setGroupMode`, `setMondayPost`.
- **Analytics (extended)**: GB33.

### Contracts

**Groups' reads**, direct reads in the caller's transaction:

```ts
type GroupRef = { group: GroupId; name: string };
interface Groups {
  availableIn(workspace: WorkspaceId): boolean;                    // GB3
  groupsShownTo(member: MemberId): boolean;                        // `groups` applies ∧ available
  primaryGroupOf(member: MemberId): GroupRef | null;               // now; the profile card, the website
  primaryGroupAt(member: MemberId, at: number): GroupId | null;    // GB9, attribution and the quest draw
  countingGroupsOf(member: MemberId): GroupRef[];                  // the pickers
  primaryMembersOf(group: GroupId): MemberId[];                    // the boards' divisors
}
```

**Domain events** (additive to the registry):

```ts
type PrimaryGroupChanged = { type: "primaryGroupChanged"; workspace; member: MemberId; from: GroupId | null; to: GroupId | null; cause: "default" | "picked" | "fallback"; at: number };
type AwardsAttributed = {
  type: "awardsAttributed"; workspace; message: MessageRef; giver: MemberId; group: GroupId | null; kudos: number; day: DayKey; at: number;
  awards: Array<{ award: AwardId; recipient: MemberId; kudos: number; saysWhy: boolean; recipientGroup: GroupId | null }>;  // gate decision and the recipient's primary group at `at`
};
```

`awardsAttributed` carries each award's stored gate decision and its recipient's primary group at the spend instant, captured once in the attribution mutation from the history, so the group quest checks its action without re-reading `kudosGiven` or current membership, and a replay gives the same answer; subscribers of one event run in no guaranteed order, so group totals and the group quest follow attribution, never a parallel reading of `kudosGiven`.

**The boards for the website** (map #57's needs 3 and 4, accepted by its conductor on 2026-10-14):

```ts
// The Everyone board's existing rankedBoardOf, extended:
type RankedRow = { position; rank; tied; member; name; picture; kudos; viewer; climbed: number | null };   // GB18
type RankedBoard = { rows; window; standing; improvement; peer: { percent: number; group: GroupRef } | null }; // GB16

function groupBoardsOf(workspace, viewer, period): { groups: GroupsBoard | null; myGroup: MyGroupBoard | null };
type GroupsBoard = {
  rows: Array<{ position; rank; tied; group: GroupId; name: string; perMember: number; participation: number; kudos: number; members: number; mine: boolean; climbed: number | null }>;
  window: number[];
  standing: { kind: "ranked"; position: number; rank: number } | { kind: "not-listed" } | { kind: "no-group" };
  improvement: { gain: number; places?: number } | { best: number } | null;   // GB14, per person
  mostImproved: { group: GroupId; name: string; gain: number } | null;
};
type MyGroupBoard = { group: GroupRef; rows: RankedRow[]; window: number[]; standing: Standing };
```

`perMember` and `gain` are rounded to one decimal and `participation` is a whole percent, so Slack and the website show the same numbers.

**The group quest for the website:**

```ts
function groupQuestOf(member): null | {
  group: GroupRef; quest: "together-say-why" | "together-reach-out"; goal: string;
  week: WeekKey; endsAt: number; tookPart: number; target: number;
  you: boolean; done: boolean;
  reward: { xp: 0; coins: number; item: null };
  crate: { key: string; opened: boolean } | null;   // null while the reward holds nothing (GB23)
};
```

**Commands (D17)**, the website wrapping them through `memberMutation` and WS335's gates:

```ts
type GroupsCommand =
  | { type: "pickPrimaryGroup"; group: GroupId }                                   // safe by state; no stored outcome
  | { type: "setGroupMode"; mode: "all" | "allowlist"; allowlist?: GroupId[] }     // admins, Slack only
  | { type: "setMondayPost"; on: boolean; timeZone?: string };                     // admins, Slack only
// openQuestCrate's quest gains { kind: "group"; group: GroupId; week: WeekKey } once the reward holds coins.
```

`pickPrimaryGroup` ignores its idempotency key, like `rerollQuest` and `setLeaderboardVisibility`: repeating it leaves the same state, and the caller reads `primaryGroupOf` afterwards to answer. No groups command needs a keyed outcome.

**The Monday post** is scheduled per workspace with `scheduler.runAt` for the next Monday 9:00 in its time zone, rescheduled after each run and on every switch or time zone change; the job carries the settings generation, and a claim row per workspace and week key, written in the mutation that rechecks everything before Slack is called, makes it at most once (GB28).

### Data (sketch)

`memberGroups` (member, current counting groups, primary group or null, picked; one row per member), `primaryGroupHistory` (member, group or null, cause, from; insert-only), `groupSettings` (workspace, mode, allowlist), `attributions` (message → giver, group, kudos, day, at; insert-only), `attributedTotals` (group, member, period key, kudos, running total by day of the period; GB12, GB35), `groupQuests` (group, week, quest, participants, target, reward, catalogue version), `groupQuestContributions` (group, week, member, first message; one per participant), `mondayPostClaims` (workspace, week key, claimed at, channel, outcome), `mondayPostSettings` (workspace, on, time zone, generation). Reward records reuse `rewardRecords` with the group quest key. The group quest pool is versioned code, not a table.

### Slack app changes

None. `usergroups:read` and the `subteam_*` events are already in both manifests (#205); the user group copy waits only on the product owner's re-paste of the manifests (#194), which the first ticket checks.

## Testing Decisions

- **A good test enters at a seam and checks what a member or another module can observe**: the Slack calls and views, the private replies, the events published, the rows another module reads. Never private helpers.
- **Seams, highest first** (as the Everyone board and quests):
  1. **The Slack boundary**: signed `subteam_*` events with `usergroups.*` stubbed at `fetch`, signed kudos messages, `app_home_opened`, `/hedgehug leaderboard`, and interactivity payloads through the HTTP router with `convex-test`. Covers GB2, GB17, GB19, GB20, GB24, GB27, GB28, GB29, and one end-to-end path per slice: a user group change to a primary group to a Groups board row; a week of kudos to a group quest done line.
  2. **The modules' internal functions** with a seeded directory and user group copy: primary groups (GB5–GB9), attribution with the subscribers in both orders and a primary group change between spend instant and subscriber run (GB10, GB30), group totals, the group quest draw, progress and rewards (GB21–GB23), and the reads the website calls (`groupBoardsOf`, `rankedBoardOf`'s `climbed` and `peer`, `groupQuestOf`).
  3. **The pure board functions**: the Groups score, participation and tie-breaks, the window around the viewer's group, the group lines, the peer line and `climbed` (GB13–GB18) as table-driven tests.
- **Scale** (GB35): the 1,500-member acceptance test runs with Convex's transaction limits enforced (`testBackend({ transactionLimits: true })`) and counts scheduled functions per mutation.
- **Time** uses fake timers: a UTC Monday boundary for the group week with a member in a far-east zone and an award spent before the boundary but processed after it, a month boundary, the Monday post across a daylight-saving change and in a half-hour zone.
- **Flags** are proven off, unset and without a key for each slice, as #128 did for `quests`.
- **Prior art**: `convex/leaderboard/*.test.ts` (board and totals), `convex/slack/leaderboard*.test.ts`, `convex/quests/*.test.ts` (draw, progress, finish), `convex/slack/userGroups.test.ts`.
- **Each slice adds its Coherence invariants**: attributions are insert-only and follow the history at the spend instant; a board never shows a member who left it; no read states a drop; the group quest names no member; the Monday post names no member. The Groups module gets its component spec.
- **The gate** (`pnpm gate`) is green on every ticket.

## Out of Scope

- The sticker book, albums and Team Spirit (#54, which waits on this spec).
- Rendering the profile card (#53); this spec gives it `primaryGroupOf`.
- Group auras and group perks (cut, decision 12).
- Helper names on the group quest (P82 stands until the product owner changes it in words).
- A web picker for the primary group or web admin settings (the website map may wrap `pickPrimaryGroup` later; admin stays in Slack).
- Groups made inside HedgeHug, or from anything but Slack user groups; ranking kudos received, XP or any progression measure; channel leaderboards.
- Backfilling attributions for kudos given before the first deploy.

## Further Notes

**The product owner's decisions this spec rests on (quoted)**
- Decision 12: "things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey" (the Journey restored: "the onboarding journey is not cut, the rest is as stated"). So no group perks or auras here.
- Decision 18: "let's just turn them all on for everyone ... Just make sure that code where it's not yet fully there still has the flags only for me". So each slice starts sandbox-only plus the product owner's email.
- Decision 15: "add name, mail, and so on to the people properties, and their Slack user ID and also teams". The user group copy this spec builds on.

**Calls this spec makes (each at its recommendation)**
1. **A sticky default** (GB6, amends G7): the smallest group is chosen when a member first needs a primary group and holds until they leave it, it stops counting or they pick. G7 recomputed it whenever any group's size changed, which would silently move members between groups when colleagues join other groups, and touch every member of a large group on each change.
2. **Groups read the directory's user group copy** (GB2) rather than a second snapshot of Slack: #205 already syncs it daily and on `subteam_*` events.
3. **Facts are recorded dark from the first deploy** (GB11): primary groups, history and attributions whatever the flags, like the Everyone board's totals and XP, so the boards have history the day `groups` turns on. No backfill before that deploy (G10's call).
4. **Attribution is per kudos message** (GB10): every award in one message shares its giver and spend instant, and the Everyone board already counts per message.
5. **Group quest participants must have opened Quests** (GB21): P75 says a member can't pursue a goal they can't see; a member who opens Quests mid-week joins the next group week.
6. **The group quest has no crate until coins ship** (GB23): its only reward is coins, which hold nothing before #30 (P86); an empty crate would open to nothing.
7. **Two group quests** (GB22), `together-say-why` and `together-reach-out`, both always feasible for a group with 2 or more participants; the content catalogue (#27) extends the pool.
8. **Three slices behind three flags** (GB29): groups, the group mode and the boards first (`groups`); the group quest (`group-quest`) and the Monday post (`monday-post`) after it, in either order. The product owner's priority is the next smallest useful PR; the boards are useful alone. The group mode and allowlist ride in the first slice (amended after review) so that interest groups and on-call aliases can be kept out before `groups` widens in the real workspace; `climbed` on the Everyone board is its own ticket with no blocker, landing with the first ship as the website conductor asked.
9. **`climbed` instead of last week's rank** (GB18, the website's need 4): a read of places climbed, never a raw earlier position, so no surface can show a member dropping (G18, user story 18). On the Everyone board it comes with the board, not with `groups`, as the website conductor asked.
10. **No new Slack scopes or events** (Implementation Decisions): #205 added them.
11. **Participation is a whole percent rounded down, score and gain one decimal** (GB13, GB14), computed once in the domain so Slack and the website agree.
12. **The allowlist picker** lists every enabled custom group by name in a multi-select; above Slack's 100 options per list it uses option groups of up to 100 (GB27).
13. **Reconcile on write** (GB2, after review): every write that depends on a member's primary group reconciles that member first, and a change takes effect when the app records it, so paged reconciliation never misattributes a kudos.
14. **The group quest starts on a Monday** (GB21): a group's first quest comes at the first Monday after `group-quest` applies, so participants are always a full week's frozen set, read from the history and stored opening times.
15. **No group quest line in the success reply** (GB24, after review): its progress follows `awardsAttributed`, after the reply is released; coordinating the two would hold every reply for a second subscriber. App Home and the website show it done.
16. **One totals row per member and period** with a running total by day (GB12, GB35, after review): the previous period up to the same day becomes one read per row instead of a scan of day rows, which at a large workspace exceeds Convex's read limits. The Everyone board moves to the same reading with `climbed`.
17. **`together-reach-out` reads the recipient's primary group at the spend instant** (GB22, after review): the user group copy has no membership history, the primary group history does, so delayed subscribers and replays agree.

**Changes to earlier specs (additive)**
- **Groups spec (#14):** G7's recomputation becomes GB6's sticky default; G37–G41 stay cut; G44 gains the group quest.
- **Progression (#86, #97):** P82's participants also need Quests opened (call 5); the group quest pool is GB22's.
- **Website (#57):** `rankedBoardOf` gains `climbed` and `peer`; `groupBoardsOf`, `groupQuestOf`, `primaryGroupOf` and `groupsShownTo` are new reads; D17 gains `pickPrimaryGroup`.

**Vocabulary to settle in Coherence** (each in the ticket that first uses it): attribution, group board, group quest (already in P82), group mode, allowlist, Monday post, places climbed.
