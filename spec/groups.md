# Spec: groups, the leaderboard and the Slack profile

> **Accepted on 2026-10-13 under Michael's autonomous build-and-ship authority** (map [#1](https://github.com/Silthus/kudos/issues/1) Notes: "accept the spec automatically once it's written"), with every open call at its recommendation (listed under "Further Notes"). A GPT-6.1 Sol review found 13 issues; all were fixed before publishing. Ticket [#14](https://github.com/Silthus/kudos/issues/14). This file lives on the branch `docs/spec-groups` and is never merged. It is the target design. It ships as the stopping-point specs in [groups-stopping-points.md](groups-stopping-points.md), each a `wayfinder:spec` sub-issue of #14. The first one's implementation tickets are in [groups-everyone-board-tickets.md](groups-everyone-board-tickets.md).
>
> Sources: the groups grilling ([#10 handoff](https://github.com/Silthus/kudos/issues/10)) and its journal records (`d-37c20076` to `d-f8ad338b`), the copy baseline `d-f6186e52`, the slice placement `d-1c7a971d` and the cross-spec slice order `d-1e03b988`, the core loop spec ([#28](https://github.com/Silthus/kudos/issues/28), [`spec/core-loop.md`](https://github.com/Silthus/kudos/blob/docs/spec-core-loop/spec/core-loop.md)), the progression spec ([`spec/progression.md`](https://github.com/Silthus/kudos/blob/1da795da2755e54cedbee21fb2659cbf0840bd7b/spec/progression.md), seams in its resolution on [#13](https://github.com/Silthus/kudos/issues/13)), the architecture ([#11 handoff](https://github.com/Silthus/kudos/issues/11), [brief](https://github.com/Silthus/kudos/blob/prototype/architecture/prototype/architecture.md) §2, §6, §11), the Slack research ([#5](https://github.com/Silthus/kudos/issues/5), §4: user groups need a paid plan), ADR-0001 to ADR-0004 and the Coherence lexicon.
>
> **The word is group, never team.** A group is a Slack user group that counts for Kudos. Slack's API "team" (`team_id`) is the workspace. The Team Spirit ladder keeps its name as flavour.

## Problem Statement

Kudos flow between people, but nobody can see them add up. A member who gives generously has no sense of how they compare with the colleagues around them, or whether they gave more than last week. Groups that thank each other a lot get no credit for it, and nothing nudges people to thank someone outside their own corner of the company. The usual answer, a ranking of who received the most, turns recognition into a popularity contest and puts most people at the bottom of a long list. And there is no way to look up a colleague's progress without opening the app's private pages.

## Solution

Kudos reads the workspace's Slack user groups and treats each one as a **group**. A member in several groups picks one **primary group** from the welcome message or App Home; their kudos count for that group from then on, and past kudos never move. Without user groups (a free Slack plan), everything group-related simply doesn't appear.

The **leaderboard** ranks kudos given, never received, never XP. It is positive: each board shows the top 3 and you with the three people above and below you, and a line tells you how much more you gave than at this point last week, or your best week so far. There are three boards: Groups (ranked by kudos given per member, so small groups compete fairly), My group and Everyone, for this week, this month and all time. They live in an App Home tab and behind `/kudos leaderboard`. An admin can switch on a Monday post that celebrates the top groups in the announcement channel and never names a person.

`/kudos @member` shows a small **profile card** of a colleague: name, title and card, group, level and achievement tiers, unless they hid them. Every member keeps a private **sticker book** of the people they've thanked or been thanked by, with an album for every group to complete, which feeds the Team Spirit achievements. Group perks bought by one member light up **group auras** for everyone in that member's primary group who opts in.

## User Stories

**Groups**
1. As a member, I want Kudos to know my Slack user groups without me setting anything up, so that groups match how we already work.
2. As a workspace admin, I want every custom user group to count by default, so that groups work the day they ship.
3. As a workspace admin, I want to switch to an allowlist of groups, so that interest groups and on-call aliases don't compete.
4. As a workspace admin, I want Slack's automatic admin and owner groups never to count, so that they don't appear as a group.
5. As a member of a workspace without user groups, I want no empty group screens, so that the app doesn't look broken.
6. As a member, I want a group that is disabled in Slack to disappear from the boards without erasing what it did, so that history stays true.
7. As a member, I want my group membership to follow Slack, so that I never maintain it twice.

**Primary group**
8. As a member in several groups, I want to pick the group I count for in the welcome message, so that the choice is made when I first meet the app.
9. As a member in several groups, I want a sensible default when I don't pick, so that ignoring the question is fine.
10. As a member, I want to change my primary group in App Home at any time, so that I can follow a move to another group.
11. As a member, I want switching groups never to move my past kudos, so that past weeks stay as they were.
12. As a member removed from my primary group in Slack, I want to fall back to another group quietly, so that the app doesn't nag me.
13. As a member who joins my first group, I want it to become my primary group automatically, so that I count without doing anything.
14. As a member without a group, I want to give and receive kudos as usual, so that groups are never a requirement.

**The leaderboard**
15. As a giver, I want a board of kudos given, never received, so that it rewards what I control.
16. As a member, I want to see the top 3 and the people around me, never the bottom of a long list, so that the board motivates instead of shaming.
17. As a member, I want to see how much more I gave than at this point last week, so that I can see my own progress.
18. As a member who gave less than last week, I want the board never to say I dropped, so that it stays encouraging.
19. As a member, I want my best week so far when I haven't improved, so that there is still something to aim for.
20. As a member, I want to know when I improved more than most of my group, so that a good week feels recognised.
21. As a member, I want this week, this month and all time, so that I can look at short and long runs.
22. As a member, I want a board inside my group and one across the workspace, so that I can compare with the people near me.
23. As a member, I want to leave the individual boards while my kudos still count for my group, so that I can play quietly.
24. As a member of a small group, I want groups ranked by kudos given per member, so that big groups don't win by size.
25. As a group, we want participation to break ties, so that a group where everyone gives wins over one where one person does.
26. As a member, I want to see the most improved group, so that progress is celebrated, not only the top.
27. As a member, I want the leaderboard in an App Home tab and through `/kudos leaderboard`, so that I can check it where I am.
28. As a member, I want kudos from before the leaderboard shipped to count, so that early givers aren't behind.
29. As a member, I want deactivated colleagues to leave the individual boards, so that the board shows the people who are here.

**The Monday post**
30. As a workspace admin, I want to switch on a Monday post in the announcement channel, so that the whole company sees which groups thanked the most.
31. As a member, I want the post to name groups only, never people, so that nobody is ranked in public.
32. As a workspace admin, I want the post to go out at 9:00 in my time zone, so that it lands at the start of our week.

**The profile card**
33. As a colleague, I want `/kudos @member` to show their name, title, card, group, level and achievement tiers, so that I can see what they've collected.
34. As a member, I want my card never to show coins, perks, streaks, XP or kudos received, so that private progress stays private.
35. As a member who hid my level or achievements, I want them missing from my card, so that hiding works everywhere.

**Sticker book and albums**
36. As a member, I want a sticker of every colleague I've thanked or who thanked me, so that I can see my web of thanks grow.
37. As a giver, I want to be told when a kudos earned me a new sticker, so that thanking someone new feels like a find.
38. As a member, I want an album for every group, not only mine, so that I'm nudged to thank people across the company.
39. As a member, I want a completed album to stay complete when new people join, so that I don't lose what I earned.
40. As a member, I want the Team Spirit achievements for completing albums, starting with my own group's, so that crossing groups is rewarded.
41. As a member, I want my sticker book private, so that nobody sees who I haven't thanked.

**Group auras**
42. As a perk buyer, I want my group perk to help everyone in my primary group, so that my build helps my colleagues.
43. As a member, I want to be asked once before an aura applies to me, so that nothing changes my game without consent.
44. As a member, I want to change my aura opt-in in Settings, so that the choice stays mine.
45. As a group, we want a second owner of the same aura to add nothing, so that buying the same perk twice isn't a race.
46. As an aura owner who changes group, I want my aura to come with me, so that the perk stays mine.

**Admin and robustness**
47. As a workspace admin, I want an Admin tab for the group mode, the allowlist and the Monday post, so that I configure Kudos in Slack.
48. As a member who isn't an admin, I want never to see the Admin tab, so that Settings stays simple.
49. As a member, I want every count recorded once per award, so that a Slack retry never inflates a board, a sticker or an album.
50. As Michael, I want each stopping point shipped and deployed on its own, so that the game grows in usable steps.

## Rules

Each rule is a testable statement; tests cite it (`G7`). Core loop rules are cited as `R12`, progression rules as `P45`. "Member" is R5's member. "The viewer" is the member looking at a board. A **period** is a range of allowance days (R12, D20): this week (Monday to Sunday), this month (calendar month) or all time. A board for "this week" covers the week containing the viewer's current allowance day; an award counts in a period when the allowance day stored with it falls in that range. "Groups are available" is defined in G4.

### Groups

- **G1. Which groups count.** In **all-groups mode** (the default), every enabled custom Slack user group counts. In **allowlist mode**, only the enabled user groups a workspace admin picked count. Slack's automatic admin and owner groups never count, in either mode. A group is identified by its workspace and Slack group ID, never by its name or handle, and is shown by its Slack name.
- **G2. Group members.** A group's members are the people in its Slack user group who are members (R5). A member can be in any number of groups. Membership is derived from both sources: a user group change (G3) and a directory change (R28: deactivation, reactivation, a person becoming a member) each update it the same way, with the same consequences for primary groups (G7, G9) and albums (G34).
- **G3. Following Slack.** The app takes a full snapshot of the workspace's user groups and their members when the groups feature first runs, and again daily. On `subteam_created`, `subteam_updated` or `subteam_members_changed` it refreshes that one group's metadata and full member list from Slack; it never applies a delta on its own. A refresh that finds no change changes nothing.
- **G4. Groups available.** Groups are available when at least one group counts (G1). When none does (a Slack plan without user groups, an empty allowlist, or no custom groups), every group feature is hidden: the welcome message's group block (G11), the Groups and My group boards (G20, G21), the peer line (G19), the group on the profile card (G28), the primary group setting, the albums and the Team Spirit ladder (G33, G36), group perks in the perk list (G37), and the Monday post switch (G25). Nothing else changes: kudos, the Everyone board and the sticker book work as before.
- **G5. Archived groups.** A group whose Slack user group is disabled, or that leaves the allowlist, is archived: it counts for nothing from then on (no primary group, no board, no album can be started or completed), and everything recorded for it stays (attributions, completed albums). If it counts again later, it comes back with its history.

### Primary group

- **G6. One or none.** A member in at least one group has exactly one primary group, one of their current groups. A member in no group has none.
- **G7. The default.** A member who hasn't picked has the **smallest** of their current groups as primary group: the fewest members (G2), ties broken by Slack group name, then ID. The default is recomputed whenever their groups or the groups' sizes change.
- **G8. Picking.** A member picks their primary group in the welcome message (G11) or in App Home Settings. A pick holds as long as the member stays in that group and it counts. It applies to awards from the moment it is saved.
- **G9. Fallback.** When a member leaves their picked group, or it is archived, the pick is dropped and the default applies (G7): the smallest remaining group, or none. No DM is sent. A member who joins their first group gets it as primary group automatically.
- **G10. Attribution.** Every award counts for the **giver's primary group in force at its spend instant** (R13): for a chime-in, the clicker's. It is recorded once per award and never changes (extends ADR-0004, `d-9f32e9ed`). Awards given before groups were available, and awards by a giver without a group, count for no group. The recipients' groups play no part.

### The welcome message's group block

- **G11. The group block.** Once groups are available, the welcome message (R42–R44) gets a group block after its third line, depending on the member's groups when it is sent: in several groups, `Which group do you count for on the leaderboard?` with a dropdown of their groups preselected with the default (G7) and a **Save** button; in one group, `You count for {group} on the leaderboard.`; in none, no block. A member welcomed before groups were available gets no second welcome message (R42); they pick in App Home.
- **G12. Saving.** **Save** stores the pick (G8) and updates the message in place: `Saved. You count for {group} on the leaderboard. You can change it in App Home.` When the chosen group is no longer one of the member's counting groups, nothing is stored and the message says `{group} isn't one of your groups anymore. Pick another one.` Saving the same pick again changes nothing. Not saving keeps the default.

### The leaderboard

- **G13. What counts.** The leaderboard counts **kudos given**: the kudos on Given awards (R18), chime-ins included (P47), in the period of the award's allowance day. It never ranks kudos received, XP, bonuses, coins or achievements (P66). Each award counts exactly once (G44).
- **G14. Earlier kudos.** When the leaderboard first ships, every award already given counts, in its own period.
- **G15. Who is on an individual board.** The Everyone and My group boards list members who gave at least 1 kudos in the period, except members who left the boards (G22). People who are no longer members (deactivated, R5) leave every individual board, current and past; their kudos still count for their group (G20).
- **G16. Ranking.** Rows are ranked by kudos given, highest first. Equal totals share a rank (competition ranking: 1, 1, 3) and are listed by display name.
- **G17. The window.** Rows are put in order (G16) and numbered by **position** 1, 2, 3 …; the rank shown is G16's rank, which ties can repeat. An individual board shows at most ten rows: positions 1–3, then the viewer's position `v` with up to three positions above and three below (`v − 3` to `v + 3`), each position once. As the one exception, when `v` is 7 or better the rows are positions 1–10, which can show more than three people below the viewer. Where positions are skipped between the top 3 and the viewer's rows, one `…` line marks the gap. A viewer who isn't on the board sees positions 1–3 and the line `Give kudos this {period} to join the board.` (`week`, `month`; all time: `Give kudos to join the board.`).
- **G18. The improvement line.** For this week and this month, the viewer gets one private line under the Everyone board, comparing all the kudos they gave so far in this period (the Everyone board's count) with the previous period **up to the same day** (a week: up to the same weekday; a month: up to the same day of the month, or its last day when the month was shorter):
  - When the gain is above 0: `▲ {gain} more kudos than this time last {period}`, followed by ` · ▲ {places} places` when the viewer was on the Everyone board of last period up to the same day and their position now is better than their position then. Without a position then, places are left out.
  - Otherwise, when they have at least one full period behind them with kudos given: `Your best {period} so far: {n} kudos.`, the highest number of kudos they gave in any completed period.
  - Otherwise no line. The line never states a loss or a lower rank. All time has no improvement line.
- **G19. The peer line.** A viewer whose gain (G18) is above 0 and larger than the gain of more than half of the other members with the same current primary group gets `You improved more than {p}% of {group}.` right after the improvement line, where `p` is the share of those members with a smaller gain, rounded down to a multiple of 10. Every gain is G18's: all kudos given, whatever group they were attributed to. Only for groups with at least 3 other such members.
- **G20. The Groups board.** It lists every counting group (G1, not archived) that is the current primary group of at least 3 members. A group's score is the kudos attributed to it (G10) in the period divided by its current number of primary-group members, shown with one decimal. Ties are broken by **participation** (the share of its current primary-group members who gave at least 1 kudos attributed to it in the period), then by total kudos, then by name. Each row shows the score, the participation and the total. The window is G17's, around the viewer's primary group. For this week and this month, a group's **gain** is its score now minus its score in the previous period up to the same day (G18's comparison), with the same current primary-group member count. Under the board, the viewer's primary group gets `▲ {gain} more per person than this time last {period}` (one decimal), plus ` · ▲ {places} places` when it was on last period's Groups board and its position is better now; otherwise `{group}'s best {period} so far: {score} per person.` when it has a completed period with kudos; otherwise nothing. Then `📈 Most improved: {group}` names the listed group with the largest gain, when that gain is above 0. Neither line ever states a loss.
- **G21. The My group board.** It ranks the members whose current primary group is the viewer's by the kudos they gave **attributed to that group** in the period (G10), with G15–G17's rules. A viewer without a primary group doesn't get it.
- **G22. Leaving the boards.** Settings has `Show me on the leaderboards`, on by default. Turned off, the member is left out of the Everyone and My group boards for every viewer, their own included; their kudos still count for their group (G20). Viewing a board while left out shows `You're not on the leaderboards. You can change that in Settings.` in place of their rows; the gain line of G18 still shows (without places).
- **G23. Where it shows.** App Home's **Leaderboard** tab shows the Groups, My group and Everyone boards (each only when it applies) for one period, with buttons for `This week`, `This month` and `All time`; it opens on this week. `/kudos leaderboard`, optionally followed by `week`, `month` or `all`, replies privately with the same boards for that period, in any conversation. Any other argument replies with ``Try `/kudos leaderboard`, `/kudos leaderboard month` or `/kudos leaderboard all`.``
- **G24. Read when viewed.** Boards are computed whenever they are rendered, from totals kept per award (G44). App Home remembers the member's selected tab and period, so every publish of it (on open, on a tab or period click, and any republish P68 triggers) renders that same view from the current totals. The leaderboard itself never triggers a publish.

### The Monday post

- **G25. Switching it on.** In the Admin tab, a workspace admin can switch the Monday post on once groups are available and an announcement channel is set (P64, P69). It is off by default. It goes out every Monday at 9:00 in the time zone of the admin who switched it on; the Admin tab shows that time zone and lets an admin change it.
- **G26. What it says.** It covers last week, the seven allowance days from the Monday to the Sunday before the post, counting the awards recorded when it is posted: `🏆 Last week in kudos`, then up to three lines `{medal} {group} · {score} per person` ranked as on the Groups board (G20), then `📈 Most improved: {group}` (against the week before, when a group gained), then `{n} people gave kudos last week. Thank you!` where `n` counts distinct members who gave. It never names a person.
- **G27. Once a week.** The post goes out at most once per week, even when its job runs twice. When no one gave kudos last week, nothing is posted. When the app can't post in the channel, the admin sees `I can't post in {channel}. Add me to it or pick another channel.` in the Admin tab and the post is skipped that week.

### The profile card

- **G28. What it shows.** `/kudos @member` replies privately with that member's profile card: their name and equipped title on the first line, their primary group and `Level {n}` on the second, their achievement tiers on the third, and their equipped card as an image. Each part appears once the stopping point that brings it has shipped, and the level and the achievement tiers only when the member hasn't hidden them (P65). The card never shows coins, perks, streaks, XP, or kudos given or received. A member can show their own card.
- **G29. Other cases.** For a person who isn't a member: `{name} isn't an active member of this workspace.` Without exactly one person mention: ``Type `/kudos @someone` to see their profile card.``
- **G30. Live.** The card reads the member's current state when it is shown; nothing is stored for it.

### The sticker book and group albums

- **G31. Stickers.** A member holds one sticker of each other member they gave a Given award to or received one from, chime-ins included. One sticker per person, kept forever, also after that person leaves. The sticker book is private: only its owner sees it.
- **G32. The sticker line.** When a Given award gives its giver a new sticker, the giver's success reply gets `New sticker: {recipient}` (several: `New stickers: {recipients}`) in its extras line, in P71's order: coins, sticker, drop. Stickers don't depend on the thoughtful gate (P13): when the gate isn't met, the extras line is the sticker part followed by P15's hint (`New sticker: {recipient} · Add why they earned it to activate your perks.`). Recipients aren't told; the sticker is in their book.
- **G33. Albums.** Every member has an album for every counting group, their own groups and every other one. An album's pages are the group's current members (G2) other than the album's owner; its progress is how many of them the owner holds a sticker of.
- **G34. Completing an album.** An album is complete when the owner holds a sticker of every page and it has at least one page. Completion is checked on every award involving the owner and on every membership change of the group (someone leaving can complete it). It is recorded once and stays complete when people join or the group is archived. The album of an archived group can't be completed afterwards (G5).
- **G35. The Sticker book tab.** It shows how many stickers the member holds and every album with its progress (`{held}/{pages}`), completed albums marked `✅`. When groups aren't available, it shows the stickers only.
- **G36. Team Spirit.** The Team Spirit ladder (P58) counts completed albums. Bronze: the member holds a completed album of their current primary group. Silver, gold and diamond: 2, 4 and 8 completed albums of any groups. Like every ladder, tiers are earned once (P61) and retroactively when the ladder ships (P62), after the backfill of G46. The ladder is hidden when groups aren't available.

### Group auras

- **G37. Group perks on sale.** The group perks `rally`, `beacon` and `provision` (P18) are in the perk list only when groups are available and the buyer has a primary group; otherwise the reason is `Join a group to use group perks.` `beacon` is sold once drops (P40) have shipped and `provision` once the weekly reserve (P25) has.
- **G38. Who an aura reaches.** A group perk's aura reaches its owner and every member who opted in and whose current primary group is the owner's current primary group, at the moment the effect is computed (P9; for `provision`, when the week starts, P21). It follows its owner when they change primary group. A member without a primary group gets no aura.
- **G39. One aura of each kind.** Only the strongest aura of each kind applies; a second owner in the same group adds nothing (P45).
- **G40. Opting in.** The first time a member's current primary group has an aura they don't own, they get one DM: `✨ {owner} unlocked {aura} for {group}: {effect}. Want it too?` with **Opt in** and **No thanks**, updated in place after a click (`You're in. You can change it in App Home Settings.` or `No problem. You can opt in later in App Home Settings.`). It is sent at most once per member and respects the progression DM setting (P63). After that, `Group auras` in Settings switches it; members start opted out.
- **G41. Stored with the award.** An aura's bonus is a line on the effects record with its source (perk ID and owner), like every bonus (P7). A later opt-out, group change or archived group never rewrites a record (P9).

### App Home and admin

- **G42. Tabs.** The groups spec adds the **Leaderboard** tab (G23), the **Sticker book** tab (G35), and to **Settings**: the primary group (a dropdown for members in several groups, the group's name for members in one), `Show me on the leaderboards` (G22) and `Group auras` (G40). The **Admin** tab gets the group mode with the allowlist picker (G1), and the Monday post switch with its time zone (G25). The tab bar itself is built by whichever stopping point first needs a second tab (here or progression's P67).
- **G43. Admins.** Admins are the workspace's Slack admins and owners, read from the directory (R28). Only they see the Admin tab, and an admin command from anyone else changes nothing.

### Robustness

- **G44. Exactly once.** Attributions (G10), board totals (G13), stickers (G31, G46) and album completions (G34) are written once per award, member and group. Redelivered `kudosGiven` events, retried subscribers and replays never count twice; a sticker or a completion is never written twice.
- **G45. Standings stay private.** No surface other members see shows a member's kudos received. Individual boards are seen only inside App Home and private replies, and the leaderboard's only public post, the Monday post (G26), names groups only. (Progression's public notices, P64, are unchanged.)
- **G46. Earlier kudos in the sticker book.** When the sticker book first ships, every earlier award gives its stickers, in award order and without sticker lines, and then every album is evaluated once (G34), so albums already covered by history start complete. Running it again changes nothing.

### Copy

The app speaks as "I", plain and short (R36, P70). `{medal}` is 🥇, 🥈, 🥉 for ranks 1–3 and `{rank}.` from rank 4 on.

| Message | Text |
| --- | --- |
| Welcome, group block (several groups) | `Which group do you count for on the leaderboard?` + dropdown + **Save** |
| Welcome, group block (one group) | `You count for {group} on the leaderboard.` |
| Group saved | `Saved. You count for {group} on the leaderboard. You can change it in App Home.` |
| Group no longer yours | `{group} isn't one of your groups anymore. Pick another one.` |
| Individual board row | `{medal} {name} · {n} kudos` |
| Groups board row | `{medal} {group} · {score} per person · {participation}% gave · {total} kudos` |
| Gap | `…` |
| Improvement line | `▲ {gain} more kudos than this time last {period}` + optional ` · ▲ {places} places` |
| Best period | `Your best {period} so far: {n} kudos.` |
| Peer line | `You improved more than {p}% of {group}.` |
| Group's improvement line | `▲ {gain} more per person than this time last {period}` + optional ` · ▲ {places} places` |
| Group's best period | `{group}'s best {period} so far: {score} per person.` |
| Most improved group | `📈 Most improved: {group}` |
| Not on the board | `Give kudos this {period} to join the board.` / `Give kudos to join the board.` |
| Left the boards | `You're not on the leaderboards. You can change that in Settings.` |
| Leaderboard usage | ``Try `/kudos leaderboard`, `/kudos leaderboard month` or `/kudos leaderboard all`.`` |
| Monday post | `🏆 Last week in kudos`, up to three `{medal} {group} · {score} per person`, `📈 Most improved: {group}`, `{n} people gave kudos last week. Thank you!` |
| Monday post can't post | `I can't post in {channel}. Add me to it or pick another channel.` |
| Profile card | `{name} · {title}`, `{group} · Level {n}`, the achievement tiers, the card image |
| Profile card usage | ``Type `/kudos @someone` to see their profile card.`` |
| Sticker line | `New sticker: {recipient}` / `New stickers: {recipients}`; with the gate hint: `New sticker: {recipient} · Add why they earned it to activate your perks.` |
| Aura opt-in DM | `✨ {owner} unlocked {aura} for {group}: {effect}. Want it too?` + **Opt in** / **No thanks** |
| Aura opted in / declined | `You're in. You can change it in App Home Settings.` / `No problem. You can opt in later in App Home Settings.` |
| Group perk without a group | `Join a group to use group perks.` |

## Implementation Decisions

### Modules

The brief's green modules (§2: "teams and leaderboard", renamed), split along what each one owns. Every domain function is internal (R50, L1); only the Slack adapter knows Slack.

- **Groups**: the counting groups, their members, the group mode and allowlist, primary groups with their history, and attributions (G1–G12). Subscribes to `kudosGiven` to write attributions, and to directory changes (R28) for membership (G2). Publishes `awardsAttributed`, `primaryGroupChanged` and `groupMembersChanged` for modules that derive state from them (L10).
- **Leaderboard**: totals of kudos given per member by day, with week, month and all-time rollups, fed by `kudosGiven` and backfilled from the awards table (D12); totals per group, fed only by `awardsAttributed`, so a group total never exists before its attribution; board queries; the Monday post. A board is composed by a pure function (below) from totals the module reads.
- **Sticker book**: stickers, albums and completions. Subscribes to `kudosGiven` and `groupMembersChanged`; backfills stickers from the awards table when it ships (G46); publishes `albumCompleted`; contributes the sticker line to the success extras.
- **Achievements (extended)**: the Team Spirit ladder from `albumCompleted` and `primaryGroupChanged`.
- **Progression (extended)**: group perks and their aura lines, reading primary groups and opt-ins at effect time.
- **Slack adapter (extended)**: user group snapshots and `subteam_*` events, `/kudos leaderboard` and `/kudos @member`, the welcome message's group block and the aura DM buttons through `/slack/interactivity`, the Leaderboard, Sticker book, Settings and Admin views, and posting the Monday post.
- **Commands (D17)**: every click and settings change is a platform-neutral command routed to its module.

### Contracts

**User groups, normalized by the adapter**, the groups module's only input about Slack groups:

```ts
type GroupSnapshot = {
  workspace: WorkspaceId;
  group: GroupId;            // Slack's usergroup ID
  name: string;
  enabled: boolean;          // false when Slack's date_delete is set
  automatic: boolean;        // Slack's admin and owner groups
  members: ChatUserId[];     // the full list, never a delta
};
interface GroupDirectory {
  sync(workspace: WorkspaceId, snapshots: GroupSnapshot[], complete: boolean): void; // complete: a full snapshot, so missing groups are gone
}
```

The adapter turns each `subteam_*` event into "refresh this group" (`usergroups.list` for its metadata, `usergroups.users.list` for its members) and schedules a daily full snapshot. Slack's plan error for user groups normalizes to an empty complete snapshot, which makes groups unavailable (G4).

**Groups' reads** for other modules, direct reads in the caller's transaction:

```ts
interface Groups {
  available(workspace: WorkspaceId): boolean;
  primaryGroupOf(member: MemberId, at: number): GroupId | null;   // G6–G9, from the primary group history
  groupsOf(member: MemberId): GroupId[];
  membersOf(group: GroupId): MemberId[];
  primaryMembersOf(group: GroupId): MemberId[];
}
```

**Attribution** keys on the award ID that progression's ticket #22 adds to `kudosGiven` (`awards[].award`). The groups subscriber reads `primaryGroupOf(giver, event.at)` from the primary group history, so a subscriber that runs late still attributes to the group in force at the spend instant (G10), and a replay from the awards table gives the same answer. Attributions are insert-only, keyed by award. The same mutation publishes `awardsAttributed`, so the leaderboard's group totals follow attributions, never a parallel reading of `kudosGiven` (subscribers of one event run in no guaranteed order).

**Domain events** (additive to the registry):

```ts
type AwardsAttributed = { type: "awardsAttributed"; awards: Array<{ award: AwardId; giver: MemberId; group: GroupId | null; kudos: number; day: DayKey }> };
type PrimaryGroupChanged = { type: "primaryGroupChanged"; member: MemberId; from: GroupId | null; to: GroupId | null; at: number };
type GroupMembersChanged = { type: "groupMembersChanged"; group: GroupId; joined: MemberId[]; left: MemberId[]; archived: boolean; at: number };
type AlbumCompleted = { type: "albumCompleted"; member: MemberId; group: GroupId; at: number };
```

**The board is a pure function**, the same code for App Home, `/kudos leaderboard`, the Monday post and tests:

```ts
type Entry = { id: MemberId | GroupId; name: string; value: number; tieBreak?: number[] };
type BoardView = {
  rows: Array<{ rank: number; id: string; name: string; value: number; viewer: boolean } | { gap: true }>;
  viewerAbsent?: "not-ranked" | "left";
};
function board(entries: Entry[], viewer: string | null): BoardView;             // G16, G17
function improvement(now: Totals, before: Totals, best: number | null): Line | null; // G18
```

**The success extras** (R38, P71): extras come from contributors called in the engine's transaction, read-only, in a fixed order (coins, sticker, drop). The sticker contributor answers "is this the giver's first award with this recipient, either way" from the awards table, excluding the awards being written, so two quick kudos to the same new person can't both claim it. Whichever stopping point first fills the extras line (here or progression's) builds the contributor list.

**Commands** (D17), each with the payload's idempotency key:

```ts
type GroupsCommand =
  | { type: "pickPrimaryGroup"; member: MemberId; group: GroupId }
  | { type: "setLeaderboardVisibility"; member: MemberId; visible: boolean }
  | { type: "showLeaderboard"; member: MemberId; period: "week" | "month" | "all" }
  | { type: "setGroupMode"; admin: MemberId; mode: "all" | "allowlist"; allowlist?: GroupId[] }
  | { type: "setMondayPost"; admin: MemberId; on: boolean; timeZone?: string }
  | { type: "setAuraOptIn"; member: MemberId; optedIn: boolean };
```

**The Monday post** is scheduled per workspace with `scheduler.runAt` for the next Monday 9:00 in the post's time zone (so half-hour offsets and daylight-saving changes land on 9:00 local), rescheduled after each run and whenever the switch or the time zone changes; a `mondayPosts` row per week key makes it once even when a stale job also runs (G27).

### Data (sketch)

`groups` (workspace, Slack ID, name, enabled, automatic, counting), `groupMembers` (group, member), `groupSettings` (mode, allowlist), `primaryGroupPicks` (member, group), `primaryGroupHistory` (member, group or null, from), `attributions` (award → group, insert-only), `givenByDay` (member, day, kudos), `givenTotals` (member, period key: week, month, all), `groupTotals` (group, period key, kudos, givers), `leaderboardSettings` (member, visible), `stickers` (member, person, first award), `albumCompletions` (member, group, at), `auraOptIns` (member, opted in, asked), `mondayPosts` (workspace, week key, posted at, channel). The totals are a cache of the awards and attributions: they can be rebuilt from them.

**Totals over an aggregate component.** The brief left it open (§6). Boards read one totals row per giver for the period (`givenTotals`) plus, for the improvement line, the day rows of last week or month up to the same day; at workspace scale that stays within Convex's read limits. The `@convex-dev/aggregate` component is the fallback if a board query outgrows it.

### Slack app changes

Each in the stopping point that first needs it: `/kudos leaderboard` and `/kudos @member` reuse the existing `/kudos` command; the Leaderboard and Settings tabs need the interactivity URL (if progression hasn't added it); groups add `usergroups:read` and the bot events `subteam_created`, `subteam_updated` and `subteam_members_changed` (one reinstall of each app). The Monday post uses `chat:write` in the announcement channel the app is in.

## Testing Decisions

- **A good test enters at a seam and checks what a member or another module can observe**: the Slack calls made, the private replies and views, the events published, the rows another module reads. Never private helpers.
- **Seams, highest first** (the same as the core loop and progression):
  1. **The Slack boundary**: signed events (`subteam_*`, `app_home_opened`), slash commands and interactivity payloads through the HTTP router with `convex-test`, Slack stubbed at `fetch`. Covers G3, G11–G12, G23, G25–G29, G40, G42–G43, and one end-to-end path per stopping point (a kudos message to a board row; a user group change to a new primary group).
  2. **The modules' internal functions** with a seeded directory and groups: attribution (G6–G10) and group totals following it, run with the `kudosGiven` subscribers in both orders; totals and their backfill (G13–G14, G44); membership from directory changes (G2); stickers, albums and their backfill (G31–G34, G46); Team Spirit (G36); auras (G37–G39).
  3. **The pure board functions**: ranking, the window, the improvement and peer lines, the Groups score and tie-breaks (G15–G21) as table-driven tests.
- **Exactly-once (G44)** is tested by delivering the same `kudosGiven` twice and running the backfill over awards that live events already counted.
- **Time** uses fake timers with two time zones: a Monday boundary for weeks and the post, a month boundary, a 31-day month compared with a 30-day one, a primary group change between an award's spend instant and its subscriber run, and the post in a half-hour offset zone and across a daylight-saving change.
- **Sandbox checks are acceptance criteria**, recorded on the pull request: whether the Slack Developer Program sandbox has user groups (if it doesn't, the group tickets prove G3 at seam 1 and the check moves to the go-live in the real workspace, #16); a `subteam_members_changed` arriving after a change in Slack; the welcome message's dropdown and Save in a DM; switching App Home tabs.
- **Prior art:** the core loop's tests at seams 1 and 2; progression's reducer tables.
- **The gate** (`pnpm gate`) is green on every ticket. Each stopping point adds its Coherence component spec and invariants (attributions are insert-only; a board never shows a member who left it; the Monday post names no member) and settles its vocabulary.

## Out of Scope

- Groups created or edited inside Kudos, and groups from anything but Slack user groups.
- Ranking kudos received, XP or any progression measure; public individual standings; channel leaderboards (Hey Taco's filter).
- A workspace time zone setting (periods use each giver's allowance day; the post uses the admin's time zone).
- Group super kudos (the brief's map note), group quests and group-versus-group challenges.
- Admin settings beyond the group mode, the allowlist and the Monday post: the base allowance, the workspace emoji, reversals and data deletion belong to operating the app.
- A web UI.

## Further Notes

**Calls this spec makes (accepted with it, each at the recommendation)**
1. **Default primary group ties** go by Slack group name, then ID (G7), and the default is recomputed while the member hasn't picked.
2. **Attribution reads the primary group history at the spend instant** rather than at subscriber time (G10), so a late subscriber or a replay never misattributes; awards from before groups shipped count for no group instead of being backfilled to today's groups.
3. **Rank ties share a rank** and list by name (G16); the window works on positions, and becomes the first ten positions when the viewer is in the top 7 (G17); a viewer with no kudos sees the top 3 and a nudge.
4. **One improvement line per viewer**, measured on all kudos given and shown under the Everyone board, with the peer line after it (G18, G19); places only when the viewer was on last period's board; the best-period line names the best completed week or month; the peer line needs at least 3 other members with the same primary group, and `p` rounds down to tens. Groups get the same lines on their score (G20).
5. **Groups board score** divides by the group's current primary-group members, with one decimal; ties then go to participation, total and name (G20). The My group board counts kudos attributed to the group (G21), so a newcomer's kudos for their old group stay there.
6. **Leaving the boards** hides you from your own view too, but keeps your private gain line (G22).
7. **`/kudos leaderboard` takes an optional period**, and works in any conversation because it only replies privately (G23).
8. **The Monday post is skipped** in a week with no kudos and when the app can't post, with a note in the Admin tab (G27); it covers the allowance days of last week as counted at 9:00.
9. **The profile card grows** as later stopping points ship its parts (G28); it never shows kudos given either.
10. **Stickers need no thoughtful note** (the gate governs bonuses only, P13), so the sticker line stays in front of the gate hint (G32); earlier awards give their stickers when the sticker book ships (G46); albums exist for every counting group, need at least one page to complete, and can complete when someone leaves or is deactivated (G2, G33–G34).
11. **Team Spirit bronze** is a completed album of your *current* primary group, so a member who switches to a group whose album they already completed earns it then (G36).
12. **Group perks** need a primary group to buy; their owner benefits without opting in; `beacon` and `provision` go on sale with drops and the weekly reserve (G37–G38). The aura DM respects the progression DM setting (G40).
13. **A daily full snapshot** of user groups backs up the `subteam_*` events (G3); the Monday post is scheduled for each workspace's local 9:00 rather than polled.
14. **Totals tables, not the aggregate component**, for the boards (Implementation Decisions).

**Changes to earlier specs (additive)**
- **Core loop (#12, #28):** `/kudos` gains the `leaderboard` and `@member` arguments; R39–R41 still govern bare `/kudos`. The welcome message (R43) gets G11's group block from the groups stopping point on. `kudosGiven` needs no new field beyond progression's award IDs.
- **Progression (#13):** P45 is sharpened by G37–G41 (owner benefits without opting in; a buyer needs a primary group; `beacon` and `provision` sell with what they boost). P58's Team Spirit is counted by G36. P71's sticker line has a plural form, and it keeps its place in front of P15's hint when the gate isn't met, so P71's "the extras line is the hint instead" becomes "the hint replaces coins and drops" (G32). The tab bar is built by whichever stopping point first needs it (G42).

**Vocabulary to settle in Coherence** (each in the ticket that first uses it): board, window, improvement line, attribution, album and page, sticker, Monday post, group mode and allowlist, admin, App Home tab names, and "Team Spirit" as a ladder name.
