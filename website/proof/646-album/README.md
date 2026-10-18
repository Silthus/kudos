# #646 sandbox proof: the album's history and its tallies

Branch `album/2` at `b40217b6`, merged with `origin/main` at `3f4fd068` in a throwaway tree and hand-deployed to the sandbox `different-dog-467` (functions only; the website is unchanged), `album` flag 970572 at `environment = sandbox`, 100%. A sibling lane later redeployed the sandbox from a tree with this branch merged in; the functions below were live for every step.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: four synthetic members join; Odile Marsh gives Pim Larch a thoughtful kudos and Quill Fen a short one (`ty`); Sorrel Wick gives Odile a thoughtful kudos; Pim hugs a plain message of Odile's. Output: `drive-output.txt`.
2. Before the history, `convex run website/album:getAlbum '{}' --identity …` as Odile, through an imported `users` and `authSessions` row: `getAlbum-before-history.json`, `people: []` (one waiting pack, for Pim).
3. `convex run album/history:startAlbumHistory '{"workspace":"T0C3US298SH"}'` ran to done: `albumHistory-sandbox.jsonl` (`phase: hugs`, `done: true`; the head names the first phase `kudos` instead of `awards`, for R18's literal check, and nothing else changed).
4. After it, getAlbum as Odile: `getAlbum-after-history.json`, `people` holds exactly Pim Larch and Quill Fen. Sorrel, who only thanked her, isn't there. Her album stickers: `album-stickers-of-odile-sandbox.jsonl`, two rows `from: history`, each at its award's instant.
5. Her tallies through the internal reads (`tallies-sandbox.txt`): with Pim one kudos given, first thanked at that award, best message that thoughtful kudos (11 words), one hug received; with Quill one kudos given and no best message (it was short); with Sorrel one kudos received. Her week of 2026-10-12 counts 2 kudos given, 1 received, Pim and Quill thanked, Sorrel thanking, Sorrel's kudos as the kudos of the week, one award on each of Friday, Saturday and Sunday. Pim's hug falls in the week of 2026-10-19 by Pim's Berlin day.
6. A second `startAlbumHistory` changed nothing: `second-run.txt` (the history record, every album sticker, getAlbum and the five tallies byte-identical).

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/646-album/drive.mts`
