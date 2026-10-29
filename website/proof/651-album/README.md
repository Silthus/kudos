# #651 sandbox proof: milestones

Branch `album/7` at `f494a21f` (`main` at `d3a28eff` merged in), hand-deployed at 05:18 UTC on 2026-10-19 to the sandbox `different-dog-467`, functions only (the website is unchanged). No live lane served a function outside this tree (`convex function-spec` against the tree's exports). The dry run added only `milestoneTiers.by_member_milestone_tier` and deleted no index. `album` flag 970572 is on in the sandbox; `collection` and `packs` on.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: two synthetic members join (`KUDOS_CAST=A`), and the giver sends one thoughtful kudos to the other. Output: `drive-output.txt`.
2. `convex run website/album:getAlbum '{}' --identity …` as the giver, through an imported `users` and `authSessions` row: `getAlbum-1-after-kudos.json`. **Kind words** counts 1, its bronze `First thank-you` earned at the kudos tally (`1792387137263`, 05:18:57 UTC today); every other milestone counts 0 with nothing earned. One pack waits.
3. `openThoughtfulPack` (`open.json`): the person's sticker and `croissant`, 15 XP. `putAllIn` (`putAllIn.json`): the hoggie, then the sticker, `more: false`.
4. `getAlbum-2-after-put-in.json`: **Faces in the album** counts 1, its bronze `First face` earned at `1792387178675` (05:19:38 UTC), inside the put-in call's window `1792387178045`–`1792387178900`. Hoggie hunter counts 1 (bronze is 10). Kind words keeps its bronze with the kudos date. Across the company counts 0: the synthetic person is on no posthog.com team.
5. `milestoneTiers-giver.jsonl`: the two stored tiers, `{ member, milestone, tier, at, catalogue: 1 }`.
6. `workspace-pass.txt`: `recordMilestonesInWorkspace`, the pass the history's last page schedules, run by hand over the sandbox workspace, whose history finished before this deploy. Every page succeeded, it recorded the tiers the history's stickers, week tallies and team stickers reach, no tier is stored twice, and the giver's tiers kept their dates.

The catalogue's diamond step `D` for Full pages and Across the company is **50**, fixed in the catalogue.

The `getAlbum` files keep the packs, the tray, the held people's IDs and the milestones. `me`, `level` and `teams` are left out: `teams` lists every posthog.com team and its people.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> KUDOS_CAST=A bun website/proof/651-album/drive.mts`

## Rerun on the reviewed head

After qa-swarm's two rounds changed when tiers are recorded, `album/7` at `4e8fae42` was deployed to the sandbox at 06:02 UTC on 2026-10-19. The dry run deleted no index, and no live lane served a function outside the tree. The run used a fresh cast (`KUDOS_CAST=B`, `head/drive-output.txt`):

7. `head/getAlbum-1-after-kudos.json`: Kind words at bronze, earned at the kudos tally (`1792389741049`); nothing else earned.
8. `head/open.json`, `head/putAllIn.json`, then `head/getAlbum-2-after-put-in.json`: Faces in the album at bronze, earned at `1792389766019`, inside the put-in call's window `1792389765335`–`1792389766215`. Kind words kept its date. `head/milestoneTiers-giver.jsonl` holds the two stored tiers.
9. `head/sync-pass.txt`: the real posthog.com sync ran by hand. Company Profiles stored each workspace's matches and published `companyMatchesKept`. Album's holders pass then ran over every sticker holder of each workspace, and every page succeeded. No tier changed or was stored twice.

The hoggie drop path (a crate outside the album) has no sandbox run: the sandbox member who could open a crate is the one human, whose own crates stay theirs. `convex/album/milestones.test.ts` drives it through `buyCrate` and `openCrate`.
