# Group rows in Where you stand (#294)

Captured from a disposable local Convex backend on ports 11110/11111, with the mock Slack issuer on 11112 serving `website`, `everyone-board`, `groups` and `profile-card` on for that backend only. Thirteen members and four Slack user groups were seeded there through the real `keepUserGroups` and `keepUserGroupMembers`, so the real reconcile picked each primary group. This week's and last week's given totals were imported, and group kudos went through the real `countAwardsAttributed`. Juno signed in through the real Convex Auth handshake.

- `home-light.png`, `home-dark.png`: My group (#2 in Design), Groups (#2, ▲ 2, crests with kudos per person), Everyone (#4, ▲ 3), the peer line `You improved more than 60% of Design.`, and `Design` under the name on the public card.
- `home-390-light.png`: the same panel at 390 px, with no horizontal overflow (`scrollWidth` 390).
- `leaderboard-peer-light.png`: `/leaderboard`, Everyone, with the peer line right after the improvement line under "Only you see these".
- `hidden-light.png`, `hidden-dark.png`: after switching off `Show me on the leaderboards` on `/leaderboard` (the real `setBoardVisibility` command), the home keeps only the Groups row and shows the hidden note while Design still ranks.
- `hidden-focus-dark.png`: the keyboard pass. Tab from the Quests panel lands on `Groups this week: your group is #2, up 2 places` with `:focus-visible`, then on `Open the leaderboard`.
- `variant-e-light.png`, `variant-e-dark.png`: variant E's standing card (`3409ade`) at the same state.

Reduced motion: the panel adds no motion. Screen-reader wording is covered by the component tests in `RightRail.test.tsx` (link names with the climb, neighbour words, crest words).
