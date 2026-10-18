# #646 sandbox proof: the album's history and its tallies

Branch `album/2` at `b40217b6`, merged with `origin/main` at `3f4fd068` in a throwaway tree and hand-deployed to the sandbox `different-dog-467` (functions only; the website is unchanged), `album` flag 970572 at `environment = sandbox`, 100%. A sibling lane later redeployed the sandbox from a tree with this branch merged in; the functions below were live for every step. That lane's deploy at 22:29:19 UTC dropped this branch's new indexes until its redeploy at 22:30:15 UTC; every step here ran outside that window (the driver's events and their tally jobs 22:28:28–22:28:50, the history from 22:31:52).

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: four synthetic members join; Odile Marsh gives Pim Larch a thoughtful kudos and Quill Fen a short one (`ty`); Sorrel Wick gives Odile a thoughtful kudos; Pim hugs a plain message of Odile's. Output: `drive-output.txt`.
2. Before the history, `convex run website/album:getAlbum '{}' --identity …` as Odile, through an imported `users` and `authSessions` row: `getAlbum-before-history.json`, `people: []` (one waiting pack, for Pim).
3. `convex run album/history:startAlbumHistory '{"workspace":"T0C3US298SH"}'` ran to done: `albumHistory-sandbox.jsonl` (`phase: hugs`, `done: true`; the head names the first phase `kudos` instead of `awards`, for R18's literal check, and nothing else changed).
4. After it, getAlbum as Odile: `getAlbum-after-history.json`, `people` holds exactly Pim Larch and Quill Fen. Sorrel, who only thanked her, isn't there. Her album stickers: `album-stickers-of-odile-sandbox.jsonl`, two rows `from: history`, each at its award's instant.
5. Her tallies through the internal reads (`tallies-sandbox.txt`). Her kudos were sent after the deploy, so the live subscribers counted them and the history's pages found their markers: with Pim one kudos given, first thanked at that award, best message that thoughtful kudos (11 words), one hug received; with Quill one kudos given and no best message (it was short); with Sorrel one kudos received. Her week of 2026-10-12 counts 2 kudos given, 1 received, Pim and Quill thanked, Sorrel thanking, Sorrel's kudos as the kudos of the week, one award on each of Friday, Saturday and Sunday. Pim's hug falls in the week of 2026-10-19 by Pim's Berlin day.
6. **The history filling past tallies** (`history-filled-sandbox.txt`): ticket 1's first cast sent its kudos at 20:42 UTC, before this branch was deployed, so no tally subscriber ever ran for them. After the history, that giver holds history stickers for Fennel, Juniper and Rowan, and pair tallies of 2, 2 and 1 kudos given. Each tally's best message is a thoughtful kudos, never Juniper's `ty`.
7. A second `startAlbumHistory` is a no-op start and changed nothing: `second-run.txt` (the history record, every album sticker, getAlbum and the five tallies byte-identical). Re-paging is proven by the tests, not here.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/646-album/drive.mts`

## The round 1 fixes, live (`273bdf9f` merged with `origin/main`, `origin/album/11` and `origin/album/3` in a throwaway tree, deployed 23:20:44 UTC)

The fixes rewrote the history's hug phase (one hug a mutation, at most 50 of its people, a bigger hug carried to the next mutation through its last person, `done` only when no hug is left), so it ran again on the real backend, in a second synthetic workspace `T0PRF646B` with no history record (`drive-hug-paging.mts`, output `drive-hug-paging-output.txt`):

- 57 synthetic members joined; Wren Alder gave one thoughtful kudos to 55 of them, and Tamsin Reed hugged it, so the hug reaches 55 people, more than one page.
- `albumHistoryOf` answered nothing before the start, `done: false` for ten polls, then `done: true`. The stored record carries no leftover `hug` or `hugPeopleAfter` (`hug-paging-sandbox.txt`).
- Tamsin's pair tally with Proof Crowd 54, the hug's last person, holds `hugsGiven: 1`, and her week of 2026-10-19 lists 12 hugged people with 43 more: all 55 were counted before `done`.
- Wren holds 55 history stickers, and no `album/history` or `album/tallies` job failed after the deploy.
