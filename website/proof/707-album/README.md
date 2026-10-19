# #707 proof: every milestone tier earns its own emoji

## Sandbox live run (2026-10-19, `different-dog-467`)

Functions were deployed at 12:05 UTC from a throwaway proof tree: `album/fix-707` at `5255b5a1`, merged with the live sandbox tree (#656, #687 and #697's functions) and with #664's proof tree `e01c358e`, so no lane's function went missing. The dry run added and deleted no index. The website was uploaded at 12:09 UTC from `album/fix-707` alone (`5255b5a1`), because #664's popup and #707's per-tier IDs don't run together yet (see the integration note below).

The sandbox's registry was opened before #707, when gold alone had a milestone emoji: that is data the base code wrote.

1. `1-registry-milestones-before.jsonl`: the workspace's five gold names under `milestone:<id>`.
2. `2-getAlbum-before-reservation.json`: after the deploy and before any reservation, the synthetic member Cy Pebble reads each gold emoji under its stored name (`milestone:people:gold` is `full-of-friends`). The other tiers aren't answered yet, since the registry hasn't named them.
3. `shots/sandbox-base-website-on-head-backend.png`, cross-version: the sandbox's previous website (the base Milestones page) on HEAD's backend still shows "Gold unlocks :full-of-friends:" and the other four gold names.
4. `3-reserveSharedEmojiNames.txt`: the hand-run `reserveSharedEmojiNames` exits 0.
5. `4-registry-milestones-after.jsonl`: the five gold rows are byte-identical (same `_id`, key and name), and 15 tier names are new (`first-face`, `familiar-faces`, `everyone-s-album`, …).
6. `5-getAlbum-after-reservation.json`: Cy Pebble already held Faces in the album bronze and Kind words bronze, so `:first-face:` and `:first-thank-you:` now read earned. Every other tier reads locked with its own step.
7. `6-drive-output.txt`: a fresh synthetic giver (`KUDOS_CAST=T707`, 652's driver) joins and sends one thoughtful kudos through signed Slack events. This is data HEAD creates.
8. `7-giver-tiers.jsonl` and `8-giver-getAlbum.json`: the kudos recorded Kind words bronze, so `:first-thank-you:` reads earned and silver, gold and diamond read locked at 1 of 25, 100 and 500.
9. `9-markEmojisSeen.json`: given the earned bronze, the locked silver and the old `milestone:thoughtful` ID, `markEmojisSeen` records only the bronze.

Browser, signed in through short-lived sessions as synthetic sandbox members. Faces are blurred in the page before capture.
- `shots/sandbox-add-to-slack.mp4` (website at `5255b5a1`, as Cy Pebble): Add to Slack downloads `first-face.png` (16,892 bytes, from `/emoji/milestone-people-bronze.png`) and opens Slack's `/customize/emoji` in a new tab.
- `shots/sandbox-light.png`, `shots/sandbox-dark.png` (1440×900) and `shots/sandbox-phone.png` (390×844): the website re-uploaded at 12:18 UTC from `545e950b` (review round 2), shown as #645's synthetic member, whom another lane's session had signed into the shared browser profile by then. Every medal has its emoji: earned ones in colour with Add to Slack, locked ones greyed out with "Unlocks at N". The four emoji blocks in every row start at the same height (measured in the page on desktop and phone). On the phone nothing scrolls sideways and every Add to Slack pill sits inside its medal.

## Fixture build and prototype

`shots/comparison.png` sets the accepted prototype's Milestones (round 6, `0ac9e96d`, light only, gold named as text) beside this branch at `545e950b`: the fixture build in light, and the sandbox in dark and on a phone, at the same viewport. `shots/fixture-light.png` and `shots/fixture-phone.png` are the fixture build alone. The fixture holds one earned emoji in Slack, one not in Slack and locked ones.

## Cross-version

- Base website, HEAD backend: `shots/sandbox-base-website-on-head-backend.png` (step 3 above).
- Base backend, HEAD website: `website/src/album/milestonesAnsweredBefore707.json` is `getAlbum`'s milestone answer as the code before #707 (`a8d06ae9`) built it, produced by that code in `convex-test`. The page test "#707: getAlbum's answer as the code before #707 built it…" renders HEAD's Milestones on it: every medal shows its own picture under its tier's slug and nothing to add.

## Integration note for #664

With both PRs in one tree, #664's `emojiShelf.ts` `milestoneOf` reads `milestone:people:gold` as a milestone ID and the album crashes. Whichever of the two merges second takes the milestone ID before the second colon and words the popup per tier. Both lanes have been told.

Rows appended to the sandbox: one `authSessions` and one `authRefreshTokens` row for Cy Pebble, and a `users` and an `authSessions` row for the driver's giver. They are short-lived and left in place; nothing was deleted.
