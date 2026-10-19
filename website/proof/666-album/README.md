# #666 sandbox proof: the album's Activity

Branch `album/22` at `d82675e6` (`main` at `0ac73f87` merged in). Only the website was built and uploaded to the sandbox `different-dog-467`, with the deploy workflow's `static-hosting upload` step. Functions were left as the live lanes deployed them, since `getAlbumWeek` (#654) was already there. `album` flag 970572 is at `environment = sandbox`, 100%.

1. The member is Marlowe Tansy, from #654's proof (`website/proof/654-album/`). Their week tallies were written there by signed Slack-shaped events, not a Slack click: two weeks, `2026-10-19` and `2026-10-12`, in Europe/Berlin.
2. One `authSessions` row and one `authRefreshTokens` row were appended for Marlowe's existing `users` row, both expiring after two days. The browser got the refresh token in localStorage, as in `kudos-browser-session-without-slack`.
3. `getAlbumWeek` through `convex run --identity` as Marlowe:
   - `getAlbumWeek-this-week-sandbox.json`, with no week: tabs `2026-10-19` and `2026-10-12`. 2 kudos given, 1 received, 1 hug each way, 2 packs opened. Juniper is thanked, hugged and the new face. Ottilie thanked them and Bram hugged them. `megaphone` (common) and `robot` (rare) came from the packs. The kudos of the week is Marlowe's own, with 1 hug and its link.
   - `getAlbumWeek-last-week-sandbox.json`, with `{"week":"2026-10-12"}`: 1 thoughtful kudos to Juniper, and the kudos of the week with no hugs.
4. The browser walk of `/activity` as Marlowe, in the PR:
   - 1440×900 in dark and light.
   - The arrow keys from This week to Last week and Home back, recorded. Focus stayed visible on the picked tab, and the tab order moved with it.
   - 390×844 in light and dark. `scrollWidth` equalled the viewport, so there was no sideways scroll.
   - The console held only the socket's reconnect lines: no CSP violation.

Every person is a synthetic sandbox member. The Slack permalinks point at the sandbox's test workspace.

Not shown on the sandbox, and proven by `website/src/album/activity.test.tsx` instead:
- an overflowing week ("and 9 more");
- a quiet week, a week with no issue, and a member with no week yet;
- a picked week still loading;
- reduced motion. The preview can't emulate it; the issue's fade is the only motion, and it is off under reduced motion.

Tests: `red.txt` (14 of 15 new tests failing before the page existed), `red-round-1.txt` (review round 1's three tests before their fix).

## Rerun on the reviewed head

After review round 1 and the merge with `main` (#685, the tray), `album/22` at `c5a9ab74` was built and uploaded again, website only. As Marlowe, `/activity` showed This week, and picking Last week read `2026-10-12`'s issue. That issue has no new faces, and its panel now takes focus (`tabIndex` 0). The capture is in the PR.
