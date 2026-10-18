# #647 sandbox proof: open a thoughtful pack into the tray

Branch `album/3` at `9758acb6` (main merged in), hand-deployed at 22:47 UTC on 2026-10-18 to the sandbox `different-dog-467`, functions only (the website is unchanged). Two lanes were live on the sandbox with schema `main` lacks (`album/11`, #674: `companyFaces.profile`; `album/2`: the history tables), so the deployed tree was `album/3` merged with both branches, never pushed, keeping their functions and indexes. `album` flag 970572 at `environment = sandbox`, 100%; `collection` and `packs` on.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: three synthetic members join, and one giver sends a thoughtful kudos to the other two. Output: `drive-output.txt`.
2. `convex run website/album:getAlbum '{}' --identity …` as the giver, through an imported `users` and `authSessions` row: `getAlbum-before-sandbox.json`, two waiting packs, an empty tray, 20 XP.
3. `convex run website/album:openThoughtfulPack '{"pack":"<first pack>"}' --identity …`: `open-sandbox.json`, `opened` with the person's sticker, then the hoggie `caribana` (uncommon, new), and 15 XP applied with coins unchanged (28 before and after).
4. The same open again: `open-again-sandbox.json`, the fixed refusal `{ kind: "refused" }`.
5. `getAlbum` after: `getAlbum-after-sandbox.json`, one waiting pack, the tray holding the sticker and the hoggie with the open's item IDs, `moreTray: false`, 35 XP.
6. PostHog project 662840: `posthog-hoggie-dropped.txt`, `hoggie dropped` with `crate_kind: thoughtful`, `surface: website`, `pack_xp: 15`, `pack_coins: 0`.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/647-album/drive.mts`
