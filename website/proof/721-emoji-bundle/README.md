# #721 proof: waiting emoji unlocks open as one bundle

Sandbox `different-dog-467`, 2026-10-19 16:36–16:47 UTC, and the fixture build.

## What ran where

- **Website:** this branch at `37e69b5f`, uploaded to the sandbox with `static-hosting upload` alone, so no lane's backend function or index changed. A sibling lane uploaded over it at about 16:42; it was uploaded again, and the served bundle (`index-BLuV62RC.js`) was checked against `website/dist/index.html` before each set of shots.
- **Backend:** the sandbox's own, unchanged. This change is website-only.
- **Data:** [`drive.mts`](drive.mts) (`bun`, signed Slack-shaped events) joins a fresh synthetic giver and six synthetic teammates, then sends two thoughtful kudos to three people each, yesterday and today. Cast `B` and cast `C` each made six waiting packs and six held hype emojis, plus the giver's first milestone emoji ([drive-output.txt](drive-output.txt), [getAlbum-giver-before.json](getAlbum-giver-before.json)).
- **Session:** a `users`, an `authSessions` and an `authRefreshTokens` row were appended for each synthetic giver, with a four-hour expiry. Nothing was deleted.

## Proof

| Behaviour | Evidence |
| --- | --- |
| One waiting emoji keeps its own moment, and an emoji Slack lacks says "Not in Slack yet", with no download prompt | [sandbox-light-1440-single-milestone.png](sandbox-light-1440-single-milestone.png) |
| Hype emojis wait behind their packs; after the six packs close, the six arrive as one bundle: five cards, each with its picture, its Slack name and what it came from, and "+1 more" | [sandbox-recording-packs-then-bundle.mp4](sandbox-recording-packs-then-bundle.mp4), [sandbox-light-1440-bundle.png](sandbox-light-1440-bundle.png) |
| Taking the bundle flies its five emojis into the emoji button and sends one `markEmojisSeen` for exactly those five (five `seenEmojis` rows share one instant); the sixth arrives alone next | [sandbox-light-1440-last-one-alone.png](sandbox-light-1440-last-one-alone.png), [getAlbum-giver-after.json](getAlbum-giver-after.json) (every emoji seen) |
| Dark at 1440 × 900 | [sandbox-dark-1440-bundle.png](sandbox-dark-1440-bundle.png) |
| Phone at 390 × 844, keyboard: the dialog takes focus, Tab reaches "+1 more" with a visible focus ring, no sideways scroll (`scrollWidth` 390) | [sandbox-dark-390-keyboard-more.png](sandbox-dark-390-keyboard-more.png), [sandbox-recording-keyboard-more.mp4](sandbox-recording-keyboard-more.mp4) |
| "+1 more" by Enter marks all six seen and opens the emoji popup, with focus on the emoji button | [sandbox-dark-390-popup-after-more.png](sandbox-dark-390-popup-after-more.png), [getAlbum-c-after.json](getAlbum-c-after.json) |
| No CSP violation | a `securitypolicyviolation` listener stayed empty through both walks |
| The bundle opens like a pack (the wrapper rips, the cards rise one after another), at 1440 × 900 | [fixture-bundle-open-and-take-1440.mp4](fixture-bundle-open-and-take-1440.mp4) |
| Fixture build: four new emojis, light and dark; seven new, at 1440 and 390; "+2 more" opening the popup | [fixture-bundle-light-1440.png](fixture-bundle-light-1440.png), [fixture-bundle-dark-1440.png](fixture-bundle-dark-1440.png), [fixture-seven-light-1440.png](fixture-seven-light-1440.png), [fixture-seven-light-390.png](fixture-seven-light-390.png), [fixture-more-opens-popup-390.png](fixture-more-opens-popup-390.png) |
| Side by side with the accepted prototype's emoji moment at the same viewport | [compare-prototype-vs-721.png](compare-prototype-vs-721.png) |
| Red, then green | [red-website.txt](red-website.txt) (9 of 13 red before the change), [gate-37e69b5f.txt](gate-37e69b5f.txt) |

The seven-emoji fixture shots came from a build with three more hype emojis added to `albumFixtures.newEmojis`; that edit was reverted and isn't committed. The tests build their own seven.

## Gaps

- Reduced motion is proven in the tests (`preferReducedMotion`: the cards show at once and taking sends at once), not in the browser, which can't emulate it.
- The prototype has a moment for one emoji only and no dark theme, so the comparison shows the prototype's single moment beside the bundle.
- `gate-37e69b5f.txt`: one backend test (`convex/album/packs.test.ts`, the 120-person page) hit its 5 s timeout at load ~41. It passes with a longer timeout, and this branch changes nothing under `convex/`.
