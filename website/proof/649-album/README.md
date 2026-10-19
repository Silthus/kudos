# #649 sandbox proof: the album's hoggie read

Branch `album/5` at `06c2be66` (`main` at `121c7427` merged in), hand-deployed at 02:49 UTC on 2026-10-19 to the sandbox `different-dog-467`, functions only (the website is unchanged). Before the deploy the sandbox ran `main`'s functions and nothing else; no other live worktree's schema was deployed there, and the deploy deleted no index. `album` flag 970572 at `environment = sandbox`, 100%; `collection` and `packs` on.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: three synthetic members join, and the giver sends one thoughtful kudos to the other two, earning a pack for each. Output: `drive-output.txt`.
2. Through an imported `users` and `authSessions` row, `convex run … --identity …` as the giver: `getAlbum-before.json` shows the two waiting packs and an empty tray; `getAlbumHoggies-before.json` answers all 151 hoggies of the catalogue, none found.
3. `openThoughtfulPack` on both packs: `open-1.json` drew `steve-jobs` (epic) with its sticker, `open-2.json` drew `dynamite` (uncommon) with its sticker. `getAlbumHoggies-opened.json`: both hoggies wait in the tray, so neither is found (`found: 0`, `rarest: []`).
4. `putIn` of the `dynamite` tray item only (`putIn.json`, at `put-in-at.txt`).
5. `getAlbumHoggies-after.json` answers only the hoggie put in as found: `dynamite` with `count: 1`, `spares: 0` and `firstAt` the put-in instant; `found: 1` of `total: 151`; the uncommon rarity `found: 1` of 40 and every other rarity 0; the rarest finds hold only `dynamite`. `steve-jobs`, still in the tray, answers `found: false`, `count: 0`, `firstAt: null`, and is left out of the rarest finds although it is rarer. `getAlbum-after.json` still lists it in the tray beside both stickers.
6. `getCollection.json`: the Book's read answers `ready` for this member, whose Book is not opened, while `getAlbumHoggies` answered throughout (AL73: whatever the Book says).

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/649-album/drive.mts`
