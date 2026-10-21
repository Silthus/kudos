# Proof for Silthus/personal#125: polish the item board

Sandbox `different-dog-467`, website only. No backend deploy: every fix in this branch is in the website or in a test.

## What ran on the sandbox

1. `drive.mts` sent signed Slack events: a `team_join` for a made-up visitor and teammate, then one thoughtful kudos from the visitor (`drive-output.txt`). Cast A is Ilse Brandvold, cast B is Sunniva Haldorsen, and the teammate is Rafe Okoro. All three are made up.
2. `convex import --append` added the rows in this folder: `users*.jsonl` for the website sign-in, and `items*.jsonl` to give the visitor waiting items. The sign-in session rows are not committed.
3. The website bundle went up with `pnpm exec static-hosting upload`: main's bundle for the before stills, then this branch's bundle from `e32ec50d` for the after stills. The branch bundle was checked live right before capture.

## Stills

| Item | Before | After |
| --- | --- | --- |
| 3. On a phone every item is about 72 px | `1-phone-board-before.png`: the items are 72, 66, 75 and 68 px | `2-phone-board-after.png`: every item is 72 px |
| 5. At 1280 px the loop line sits clear of the rarity bars | `3-loop-line-1280-before.png`: under the top bar, the loop line and Share pile up with the turned status and the wait pill, over the Milestones page | `4-loop-line-1280-after.png`: on Hoggies, the loop line sits at the foot of the window, apart from the turned status and the wait pill |

`5-fixture-loop-line-phone-after.png` and `6-fixture-loop-line-phone-half-width.png` come from a local fixture build. They show the loop line at the foot of a phone screen, spanning the window instead of half of it.

The leaderboard rank in the phone stills is painted over.

## Sandbox leftovers

- Cast A's member has two `analyticsIds` rows: the kudos flow recorded one, and `analyticsIds.jsonl` added a second. `identityOf` reads that row with `.unique()`, so the flag falls to its safe default and the website answers "Not open yet" for that member. Cast B has no imported analytics row and works. Delete the `proof-125-visitor-a` row to restore cast A.

## After the review

Local fixture build on a 375 × 667 phone, scrolled to the foot of Hoggies:

- `7-fixture-page-foot-clear-of-the-line.png`: the page leaves room at its foot, so its last cards end above the loop line.
- `8-fixture-strip-capped-five-wins.png`: five Share rows, added to the page by hand to stand in for a visit with many wins. The strip stops at 12 rem and scrolls, and the cards above stay clear.
