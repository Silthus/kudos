# #649 sandbox proof: the album's hoggie read

Branch `album/5` at `06c2be66` (`main` at `121c7427` merged in), hand-deployed at 02:49 UTC on 2026-10-19 to the sandbox `different-dog-467`, functions only (the website is unchanged). Before the deploy the sandbox ran `main`'s functions and nothing else; no other live worktree's schema was deployed there, and the deploy deleted no index. `album` flag 970572 at `environment = sandbox`, 100%; `collection` and `packs` on.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: three synthetic members join, and the giver sends one thoughtful kudos to the other two, earning a pack for each. Output: `drive-output.txt`.
2. Through an imported `users` and `authSessions` row, `convex run … --identity …` as the giver: `getAlbum-before.json` shows the two waiting packs and an empty tray; `getAlbumHoggies-before.json` answers all 151 hoggies of the catalogue, none found.
3. `openThoughtfulPack` on both packs: `open-1.json` drew `steve-jobs` (epic) with its sticker, `open-2.json` drew `dynamite` (uncommon) with its sticker. `getAlbumHoggies-opened.json`: both hoggies wait in the tray, so neither is found (`found: 0`, `rarest: []`).
4. `putIn` of the `dynamite` tray item only (`putIn.json`, at `put-in-at.txt`).
5. `getAlbumHoggies-after.json` answers only the hoggie put in as found: `dynamite` with `count: 1`, `spares: 0` and `firstAt` the put-in instant; `found: 1` of `total: 151`; the uncommon rarity `found: 1` of 40 and every other rarity 0; the rarest finds hold only `dynamite`. `steve-jobs`, still in the tray, answers `found: false`, `count: 0`, `firstAt: null`, and is left out of the rarest finds although it is rarer. `getAlbum-after.json` still lists it in the tray beside both stickers.
6. `getCollection.json`: the Book's read answers `ready` for this member, whose Book is not opened, while `getAlbumHoggies` answered throughout (AL73: whatever the Book says).

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/649-album/drive.mts`

## Rerun on the round-1 fixes, over data the base code wrote and data this head creates

After qa-swarm round 1 (the read now also answers `off` while `collection` is off; that answer is proven by convex-test only, under CL11's oracle with refutation run `f61d06bf` and green again in run `25425534`, because the sandbox's `collection` flag is shared with every lane), the head `9bc78092` (`main` at `7dcb093d` merged in) was deployed at 03:06 UTC from a throwaway proof tree merged with #654's live sandbox commit `cc4386c5`, so that lane's `getAlbumPerson` and `getAlbumWeek` stayed deployed; the deploy deleted no index.

7. **Base-written finds** (`base-written/`): the givers of #648's rerun and #647's base-opened tray hold tallies `main`'s code wrote (`stored-tallies.jsonl`, members redacted). `getAlbumHoggies` answers them as stored: `panic` and `trenchcoat` found, count 1, first found at their put-in instant (`getAlbumHoggies-648-giver.json`); `burning-money`, which the base open counted at once, found with its original first find (`getAlbumHoggies-647-giver.json`).
8. **Head-created finds** (`head/`, `KUDOS_CAST=B`): two packs drew `ball` (common) and `hogpatch` (rare). Before any put-in, `found: 0` (`getAlbumHoggies-opened.json`). After putting in only `ball` (`putIn.json`, `put-in-at.txt`), `getAlbumHoggies-after.json` answers `ball` alone as found, `firstAt` the put-in instant, common 1 of 60, the rarest finds `[ball]`; `hogpatch`, still in the tray, is hidden and left out of the rarest finds although it is rarer.
