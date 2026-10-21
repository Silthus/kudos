# Proof for Silthus/personal#141: the emoji popup leads with what the member can use

Made-up sandbox members only (Oli Firstday, Wren Twofold, Kit Helper). Team names come from the public company directory.

## Seam: the album shell

`website/src/album/emojisToUse.test.tsx` renders the album shell under Testing Library with album answers, the way `getAlbum` answers them. It covers:

- a newcomer's popup: count 1, `Use these now` with the kudos emoji, `Unlock next` with level 2, the hype row and the nearest locked emoji;
- a level-2 member: the button counts only emojis Slack has;
- `Unlock next` ordered by progress, ties in shelf order, and gone when nothing is left;
- `Set it up` opening the emoji wizard, and today's controls where the wizard doesn't open;
- `All emojis · N` and back, with focus moving both ways;
- `+N more` after a level-up opening on `All emojis`;
- with `onboarding` off, today's button and popup.

Refutation: with `usableCountOf` counting every earned emoji, whether or not Slack has it, 1 of 9 tests went red.

There is no backend change. `getAlbum` already answers `emojiHowTo` only while `onboarding` is on, and the popup reads that as its flag.

## Sandbox (different-dog-467, `onboarding` on for the sandbox)

The backend was deployed by deploy-sandbox.yml. The website was uploaded from this branch, and the served bundle (`index-D-FlnxE2.js`) was checked right before each capture.

- `newcomer.png`: Oli, level 1, no kudos given yet. The button reads `1`. `Use these now` shows `:hedgehog:` In Slack. `Unlock next` shows `:raised_hands:` ("Reach level 2 · your first kudos does it"), the hype row and `:team-client-libraries:`.
- `all-emojis.png`: `All emojis · 34` opens today's popup, with `← Use these now` focused at the top. Pressing it returned focus to `All emojis · 34 →`.
- `level-two.png`: Wren, level 2, after turning the first item from a thoughtful kudos. The button reads `2`: `:hedgehog:` and `:raised_hands:` are In Slack. `:first-thank-you:` is earned, but Slack doesn't have it yet, so it shows the sandbox's control (`Coming soon to Slack`; the wizard doesn't open for members there) and isn't counted. `Unlock next` drops the level-2 row and keeps the hype row, `:generous-soul:` and `:curious:`.
