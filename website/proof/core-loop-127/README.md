# Silthus/personal#127 proof: the trimmed top bar

The stills come from the album's fixture build (`VITE_SHELL_FIXTURE=album`, made-up member Sam Example), built with `vite build` and served with `vite preview`. "Before" is `origin/main` at 44745c7a, and "after" is this branch. Each pair was captured at the same size: 1280 × 400 for desktop and an iPhone 12 Pro (390 × 844) for the phone.

| Still | What it shows |
| --- | --- |
| `1-desktop-waiting-before.png` | Two packs wait and the tray holds four. Packs, Tray, then icon-only Activity and Leaderboard. |
| `2-desktop-waiting-after.png` | Same album. Activity and Leaderboard are written out, and everything fits at 1280 px. |
| `3-desktop-tray-emptied-before.png` | After Put them all in, the empty tray stays in the bar. |
| `4-desktop-tray-emptied-after.png` | After Put them all in, the tray leaves the bar, and focus moves to the emojis. |
| `5-desktop-nothing-waiting-before.png` | Both packs opened and put in. The packs button is the empty square from the ticket, next to an empty tray. |
| `6-desktop-nothing-waiting-after.png` | Same state. Neither control is in the bar. |
| `7-phone-waiting-before.png`, `8-phone-waiting-after.png` | Phone with packs and tray waiting. They look the same: Activity and Leaderboard stay in the menu. |
| `9-phone-nothing-waiting-before.png`, `10-phone-nothing-waiting-after.png` | Phone with nothing waiting. The empty square and the empty tray are gone, and the level row stays intact. |

The sandbox `different-dog-467` can't show the flag-off states. Every core-loop flag is on there, so `hidden-items` already hides Packs and Tray (LP17) whether this branch is deployed or not.
