# #662 sandbox proof: opening a thoughtful pack in the album

Branch `album/18` at `9bc441e4` (`main` merged in), website built from that commit and uploaded to the sandbox `different-dog-467` with the deploy workflow's `static-hosting upload` step only. Functions were left as the live lanes deployed them; `openThoughtfulPack` and `getAlbum` (#647) were already there. `album` flag 970572 at `environment = sandbox`, 100%.

1. `drive.mts` signs Slack-shaped events with the sandbox signing secret (not a Slack click). Three synthetic members join in Europe/Berlin, and the giver thanks the other two in one message with a reason, which earns two thoughtful packs. Output: `drive-output.txt`.
2. A `users`, an `authSessions` and an `authRefreshTokens` row were appended for the giver, with a six-hour expiry, and the browser session was set from the refresh token.
3. `getAlbum` through `convex run --identity` before the walk (`getAlbum-before-sandbox.json`): two waiting packs, an empty tray, 20 XP.
4. Browser walk, light at 1440 × 900 by mouse, recorded: the packs button opens the oldest pack sealed; the rip sends one `openThoughtfulPack` (`POST /api/mutation`, 200); the sticker turns with "New in your album" and a modest burst; the hoggie glows and turns (`ipad`, common, new) with `+15 XP` while the XP bar counts from 20 to 35; "Done for now" flies both cards into the tray, whose count goes from 0 to 2 only once they land, and focus returns to the packs button.
5. Browser walk, dark at 390 × 844 by keyboard alone, recorded: Tab to the packs button, Enter opens, Enter rips, Enter turns the first card, Escape jumps to the end with focus on Done and the live region saying what the pack held (`workflows`, common, new), Enter flies the cards and lands focus on the packs button. No sideways scroll at 390 px. With no pack left, the dialog says how a pack is earned.
6. `getAlbum` after the walk (`getAlbum-after-sandbox.json`): no waiting pack, the tray holding both packs' stickers and hoggies in opening order, 50 XP.
7. The console showed no `securitypolicyviolation` and no error during either walk.

The two people thanked have no album sticker yet, so `getAlbum` doesn't list them and the opening names them "a teammate" with a blank face (decision `d-20ba1673`). The fixture build (`VITE_SHELL_FIXTURE=album`) shows the named card, the gold "Team complete!" burst and a rare hoggie's sparkles. Reduced motion can't be emulated in the preview browser; `packOpening.test.tsx` proves its end state.

Run: `KUDOS_CAST=<letter> KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/662-album/drive.mts`

## Rerun on the reviewed head

After the review's fixes (focus kept inside the dialog, opened packs remembered by the shell, no sideways scroll), the website built from `41a0a3fc` was uploaded at 02:00 UTC on 2026-10-19 and walked with a fresh cast (`KUDOS_CAST=B`, `head-drive-output.txt`), light at 1440 × 900, by keyboard alone, recorded: Enter opens and rips, Escape jumps to the end, "Open next pack" flies the cards while focus stays on the dialog with no outline, the next sealed pack takes focus, Tab wraps from its last control to Close, and Done lands focus on the packs button with the tray at 4 and 50 XP. No console error.
