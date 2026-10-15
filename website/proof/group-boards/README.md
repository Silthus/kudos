# Group boards on the leaderboard (#285)

Captured from a disposable local Convex backend on ports 10610/10611, with the mock Slack issuer serving `website`, `everyone-board` and `groups` on for that backend only. Members, four Slack user groups (through `keepUserGroups` and `keepUserGroupMembers`, so the real reconcile picked each primary group) and attributed kudos for last week and this week were seeded there. Juno signed in through the real Convex Auth handshake.

- `my-group-light.png`: the default tab for a member with a group.
- `groups-light.png`, `groups-dark.png`: the Groups board with crests, per-person scores, participation, climb marks, the most improved card and the group's line.
- `groups-390-light.png`: the same at 390 px.

Keyboard, in the same browser: focus on the selected tab, ArrowRight selected and focused My group, `:focus-visible` matched, the panel switched to `Design · This week`, and only the selected tab was in the tab order (`[-1, 0, -1]`).
