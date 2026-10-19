# #729: the maintainer switches the weekly post from Settings

## Red, then green

- `red-backend.txt`: `convex/website/weeklyPost.test.ts` on the tree before the change. All 11 fail: Settings carries no `weeklyPost`, and there is no `setWeeklyPost`.
- `red-website.txt`: `website/src/weeklyPost.test.tsx` before the component. 8 of 9 fail: there is no `Weekly post` region.
- Green: both files, plus `publicSurface`, `workspaceSettings`, `emojiMapping` and the Slack Monday post suites, pass on the branch.

## Sandbox (`different-dog-467`, deployed by hand, no index dropped)

First run on af31cf77; re-captured on the final head 1a855994 after the review fixes (shots, recordings and rows 2–3 are from that run).

Nobody here can sign in to the sandbox's Slack, so the proof uses a synthetic member:

1. `join.mts` sends a signed `team_join` for a synthetic member, Mae Maintainer (`U0PRF729MAEA`, Europe/Berlin).
2. `KUDOS_MAINTAINER` was set to that member for the proof, then removed again (it was unset before).
3. One `users`, `authSessions` and `authRefreshTokens` row was appended for that member, and the browser session was set from them.

| Step | Evidence |
| --- | --- |
| The maintainer's Settings read: switched off, Europe/Berlin, the channel as a Slack link, the album's top kudos post | `sandbox-1-settings-before.json` |
| Switching on in the browser | `shots/switch-on.mp4`, `shots/settings-on-light.png`, `shots/settings-on-dark.png` |
| The stored row: on, Europe/Berlin, a new generation, the next post at 2026-10-26 08:00 UTC (09:00 in Berlin after the clocks change) | `sandbox-2-settings-row-after-switch-on.json` |
| Switching off again, leaving the sandbox as it was | `shots/switch-off.mp4`, `shots/settings-off-dark.png`, `sandbox-3-settings-row-after-switch-off.json` |
| With `KUDOS_MAINTAINER` removed, the same member sees neither the Workspace part nor the weekly post | `sandbox-4-settings-after-env-removed.json` |
| Light, switched off, before any click | `shots/settings-off-light.png` |

The prototype at `0ac9e96d` has no weekly post setting; the section follows the existing Settings panels: the Workspace panel above it and the emoji mapping below it.

The privacy oracle found the channel link outside `ph-no-capture` after the first run (df-57f6ecc6); the final head carries the fix.
