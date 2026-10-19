# #664 proof: the emoji popup, emoji moments and Add to Slack

Album ticket 20. Sandbox `different-dog-467`, 2026-10-19 11:42–11:56 UTC.

## What ran where

- **Backend and website:** a throwaway proof tree, `album/20` at `02951143` merged with the live sandbox tree `120e8219` (#656's, which carries #687's and #697's backends), with the whole `website/` taken from `album/20`. The dry run dropped no index, and every function the sandbox served was still exported. The website was re-uploaded twice after fixes found in this proof (`c4d2b5d9`, `6f6abb41`).
- **Session:** the synthetic giver `U0PRF645GVRB` (Imogen Quarry), signed in through an appended `authSessions` and `authRefreshTokens` row with a four-hour expiry.
- **Seed:** one appended `customEmoji` row, `fennel-brook-2-hype`, so one hype emoji reads in Slack and the others don't. No row was deleted.

## Proof

| Behaviour | Evidence |
| --- | --- |
| `getAlbum` answers each emoji's `from` and `earnedAt`, and the workspace's custom emoji page | [getAlbum-emojis-before.json](getAlbum-emojis-before.json) |
| A new emoji pops as a moment with its picture, its name, where it came from and "use it in Slack" while Slack has it | [light-1440-in-slack-moment.png](light-1440-in-slack-moment.png), [recording-1-first-moment.mp4](recording-1-first-moment.mp4) |
| A hype emoji waits while its person's pack is unopened, then pops once the pack opening closes (AL54) | [recording-2-pack-then-hype-moment-then-add-to-slack.mp4](recording-2-pack-then-hype-moment-then-add-to-slack.mp4), [light-1440-hype-moment.png](light-1440-hype-moment.png) |
| The popup lists every emoji by kind, earned ones with picture, name and source, locked ones grey with how to unlock and progress | [light-1440-popup.png](light-1440-popup.png), [dark-1440-popup.png](dark-1440-popup.png) |
| Add to Slack saves `<name>.png`, copies the name and opens the workspace's Slack emoji page | [light-1440-popup-add-to-slack.png](light-1440-popup-add-to-slack.png), [download-juniper-vale-2-hype.png](download-juniper-vale-2-hype.png) (first upload, the emblem's star under the initials), [download-rowan-thistle-2-hype.png](download-rowan-thistle-2-hype.png) (final) |
| Keyboard: emoji button, Enter, Tab to search, Tab to Add to Slack, focus visible | [dark-1440-popup-search-keyboard.png](dark-1440-popup-search-keyboard.png) |
| Phone at 390 × 844: the popup spans the screen, no sideways scroll (`scrollWidth` 390) | [light-390-popup.png](light-390-popup.png) |
| Admins see the shared list in Settings (fixture build `album-as-an-admin`; the sandbox giver isn't an admin) | [fixture-1440-settings-shared-emojis.png](fixture-1440-settings-shared-emojis.png) |
| No CSP violation | a `securitypolicyviolation` listener stayed empty through the moments, the popup, both downloads and the dark reload |
| Red, then green | [red-backend.txt](red-backend.txt) (10 of 20), [red-website.txt](red-website.txt) (15 of 17), [gate-02951143.txt](gate-02951143.txt) |

## Refresh on the reviewed head (12:38 UTC)

After two review rounds and the merges of #701 and #704, the website at `7e901c92` was uploaded over the sandbox, whose backend by then was another lane's (#707, per-tier milestone emojis, not on `main`). [light-1440-head-7e901c92-moment-and-popup.png](light-1440-head-7e901c92-moment-and-popup.png) shows HEAD's popup and a moment there: the batch counter ("1 of 2 new"), the dialog holding focus with Skip the rest, wrapped names, the new wording, and an emoji from a milestone this website doesn't know listed under its own name instead of failing the album. No CSP violation. The earlier shots above were taken at `02951143`–`6f6abb41` on this branch's own backend.

## Gaps

- Reduced motion was checked in the tests (`preferReducedMotion`), not in the browser: the preview browser can't emulate `prefers-reduced-motion`.
- The level and team moments weren't played on the sandbox: the synthetic giver is level 2 with no unlocked team. The tests play them.
- A face framed in the hype download was drawn only in tests: the sandbox giver's people have no face. Cloudinary (posthog.com faces) and Gravatar answer `Access-Control-Allow-Origin: *`, so their faces draw; a Slack-avatar face falls back to the initials, as AL31 allows.
