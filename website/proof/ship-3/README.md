# Ship #151: the merged tree on the sandbox, and the review's fixes

## The live client on the sandbox, after merging `main`

`main` brought the website's second slice (#154) and quests (#153). `deploy-sandbox.yml` (run 38503279625) redeployed the sandbox from `00356d1`, right before this check. The served bundle carries both slices' strings (`Positions skipped`, `Ready for you`, `Still locked`).

- **Signed in** (the default browser profile's sandbox session), the [home](sandbox-home-light.png) rendered with no render loop:
  - `Open` lists Quests (`Open. Find it in Slack's App Home.`) and the Leaderboard.
  - `Still locked` lists the Skill tree at level 5.
  - Quests and the Skill tree now ship on the sandbox, because map #1's `quests` and `skill-tree` flags are on there. Part A shows a Quests card only where `quests` is on (WS76).
- The Leaderboard opened in place from the nav. Its empty board took focus on its title, with no `aria-busy` left. This month then moved the address to `/leaderboard?period=month` ([screenshot](sandbox-leaderboard-month-light.png)).
- **Signed out** (an incognito tab), `/leaderboard` showed the [sign-in page](sandbox-signed-out-light.png).

Nothing on the sandbox was written, cleared or migrated.

## Gate

- [`gate-merge.txt`](gate-merge.txt): the merge `00356d1`, 1321 tests.
- [`gate-fixes.txt`](gate-fixes.txt): the fixes, 1326 tests. The first run timed out map #1's 1,200-member launch test under load. It passes alone in 3.8 s, and the rerun was green.

## Review fixes, red then green

| Fix | Red | Green |
| --- | --- | --- |
| WS66: an open the server never answers ends after ten seconds | [red-timeout.txt](red-timeout.txt) | [green-timeout.txt](green-timeout.txt) |
| WS60: a pending open or queued reveal never reaches another member | [red-member-fence.txt](red-member-fence.txt) | [green-member-fence.txt](green-member-fence.txt) |
| WS68: a failed open from the pill shows its message beside the pill | [red-pill-failure.txt](red-pill-failure.txt) | [green-pill-failure.txt](green-pill-failure.txt) |
| WS66 V24: `You opened {name}.` is announced inside the modal dialog | [red-announcement.txt](red-announcement.txt) | [green-announcement.txt](green-announcement.txt) |

The header on a 390 px phone with two crates ready is shown in [phone-390-header-pill-light.png](phone-390-header-pill-light.png). The nav wraps to its own row and the pill shows its crate and count, with `2 ready` as its accessible name. Measured in the preview from the fixture build:
- at 390 px and 320 px, the page is exactly the viewport's width, with no horizontal scroll;
- a member with the Leaderboard open also fits at 320 px;
- the desktop header is unchanged at 56 px.
