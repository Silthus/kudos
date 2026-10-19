# #648 sandbox proof: putting the tray in

Branch `album/4` at `47479044` (`main` at `3174e514` merged in), hand-deployed at 01:33 UTC on 2026-10-19 to the sandbox `different-dog-467`, functions only (the website is unchanged). No other live worktree carried schema beyond `main`; the dry run added only `trayDrops.by_member_crate` and `trayItems.by_member_put_in_kind` and deleted no index. `album` flag 970572 at `environment = sandbox`, 100%; `collection` and `packs` on.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: two synthetic members join, and the giver sends a thoughtful kudos to the same person a week ago and today, so the giver earns two packs for one person, and only the first holds the sticker (AL5). Output: `drive-output.txt`.
2. `convex run website/album:getAlbum '{}' --identity …` as the giver, through an imported `users` and `authSessions` row: `getAlbum-before.json`, two waiting packs for the one person, an empty tray, nobody held.
3. `openThoughtfulPack` on both: `open-last-week.json` opened the sticker and `doctor` (new); `open-this-week.json` opened only `data-thief` (new); each paid 15 XP. `getAlbum-opened.json`: the tray holds the sticker and the two hoggies, no pack waits.
4. Before the put-in, the member has no `hoggieTallies` row and two waiting `trayDrops` (`found-before-put-in.jsonl`): the tray's hoggies are not found yet (AL12).
5. `putAllIn`: `putAllIn.json` placed the two hoggies first, then the sticker, `more: false` (AL11's order). Called again: `putAllIn-again.json`, `{ items: [], kind: "placed", more: false }`.
6. `getAlbum-after.json`: the tray is empty and the person is held. `found-after-put-in.jsonl`: one `hoggieTallies` row per hoggie, count 1, first found at the put-in instant; both tray drops carry `putInAt`; one album sticker `{ from: "pack", pack: <last week's pack> }`.
7. PostHog project 662840 (`posthog-events.txt`): one `album sticker collected` at the put-in instant, whose own properties are only `environment`, `taxonomy_version` and `workspace_key`, naming nobody; the two opens' `hoggie dropped` with `crate_kind: thoughtful`, `surface: website`, `pack_xp: 15`, `pack_coins: 0`.

The Book's `getCollection` answers `ready` for this synthetic member (their Book feature is not opened), so the found counts are read from the stored tallies instead; `convex/album/putIn.test.ts` proves the same through `getCollection` with the Book open.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/648-album/drive.mts`
