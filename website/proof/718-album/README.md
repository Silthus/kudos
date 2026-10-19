# #718 sandbox proof: the pack opening names the person and fits a long hype emoji

The sandbox `different-dog-467` ran a throwaway tree at `6d182cee`: branch `album/fix-718` at `88877211` merged with the live sandbox lanes' trees (#670 `e2fbdc36`, #719 `59597995`, #722 `bd0fbd18`). All three merged cleanly, so their functions and indexes stayed live. The dry run showed no index added or dropped. The functions were deployed at 17:19 UTC on 2026-10-19, then the merged website was uploaded and `prepareWebsiteFlag` ran.

1. `drive.mts` signs Slack-shaped events with the sandbox signing secret (not a Slack click). Three synthetic members join in Europe/Berlin. The giver, Tamsin Vale, thanks two people in one message with a reason, which earns two thoughtful packs:
   - Maximiliane Aurelia Konstantinopoulou-Wetherington, with a Slack picture (Gravatar's public docs example);
   - Pim Lark, with no picture.

   Neither is on a team page, and neither is in the giver's album: this is the case that opened as "Your teammate" on `main`. Output: `drive-output.txt`.
2. A `users`, an `authSessions` and an `authRefreshTokens` row were appended for the giver, with a six-hour expiry, and the browser session was set from the refresh token.
3. `getAlbum` through `convex run --identity` before the walk (`getAlbum-before-sandbox.json`, packs and tray only): both waiting packs carry `thanked` with the name. Maximiliane's face is the Slack picture; Pim's is the initials `PL`.
4. Browser walk, light at 1440 × 900, by mouse:
   - The sealed pack reads "For thanking Maximiliane Aurelia Konstantinopoulou-Wetherington" with the face, and Up next reads "For thanking Pim Lark" with `PL`.
   - The rip sends `openThoughtfulPack`, and the person card turns with the name and the face.
   - The hype emoji `:maximiliane-aurelia-konstantinopoulou-wetherington-hype:` sits under the card: 510–710 px wide like the card, from 424 px against the card's 412 px bottom, wrapped onto four lines. It has no "+" and no "unlocked".
   - Pim Lark's pack turns with the name, `PL` and the faceless hype emblem.
5. Dark at 390 × 844:
   - The hype emoji moment wraps the long name inside 16–374 px, with no sideways scroll.
   - The tray lists both cards by name: Maximiliane with the face, Pim Lark with `PL`.
6. `getAlbum` after the walk (`getAlbum-after-sandbox.json`): no waiting pack, and the tray's two stickers carry `thanked` with each name and face.
7. No `securitypolicyviolation` and no page error during either walk.

The face in the screenshots is blurred: it's a real photo, Gravatar's docs example.

Run: `KUDOS_CAST=<letter> KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/718-album/drive.mts`
