# #654 sandbox proof: person and week reads

Branch `album/10` at `cc4386c5` (`main` at `7dcb093d` merged in), hand-deployed at 03:01 UTC on 2026-10-19 to the sandbox `different-dog-467`, functions only (the website is unchanged). The dry run changed no index: the new week-tally fields are optional. One other worktree (`album/6`) carried schema beyond `main`, a `teamStickers` table that isn't on the sandbox, so nothing of a live lane was dropped. `album` flag 970572 at `environment = sandbox`, 100%; `collection` and `packs` on.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: four synthetic members join (Europe/Berlin). Marlowe Tansy gives Juniper Vale a thoughtful kudos a week ago, a shorter thoughtful one today and a `ty` today. Ottilie Brack thanks Marlowe today. Bram Seton hugs Marlowe's kudos of today and a plain message of Marlowe's. Marlowe hugs a plain message of Juniper's. Output: `drive-output.txt`.
2. `convex run website/album:… --identity …` as Marlowe, through an imported `users` and `authSessions` row. `getAlbum-before.json`: two waiting packs for Juniper, nobody held.
3. Before opening (`person-juniper-before-put-in.json`, `week-before-put-in.json`): Juniper's page holds first thanked at last week's kudos, 3 kudos given, 0 received, 1 hug given, the best message being last week's (the most words) with its words and Slack link, no teams (no company match), the hype emoji earned with its registry name, `held: false`. This week has no packs opened, no new faces and no hoggies.
4. Both packs opened (`opens.json`) and `putAllIn` (`putAllIn.json`): `megaphone`, `robot`, then Juniper's sticker.
5. After (`person-juniper.json`, `person-ottilie.json`): Juniper is `held: true` with the same history. Ottilie, who only thanked Marlowe, shows 1 kudos received, no best message and her hype emoji not earned.
6. This week (`week-this.json`, week `2026-10-19`): tabs `2026-10-19`, `2026-10-12`; 2 kudos given, 1 received, 1 thoughtful given, 1 hug given, 1 received, 2 packs opened; Juniper thanked and hugged, Ottilie thanking, Bram hugging; Juniper as the new face; `megaphone` (common) and `robot` (rare) from the packs; the kudos of the week is Marlowe's hugged kudos (1 hug) with its link; five awards and hugs on Monday.
7. Last week (`week-last.json`): 1 thoughtful kudos to Juniper, the kudos of the week with no hugs, no packs (they were opened this week). The week before the first tally (`week-before-history.json`) and a Wednesday (`week-not-a-monday.json`) answer no issue, with the same tabs.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/654-album/drive.mts`

Tests: `red.txt` (all 10 new tests failing before the reads existed), `green.txt`, and `gate.txt` (`fleet heavy -- pnpm gate` on the merged head).

## Cross-version: tallies the base code wrote, read by this branch

Ticket 2's sandbox member Odile Marsh (`website/proof/646-album/`) has week and pair tallies that `main`'s subscribers wrote on 2026-10-18, before this branch existed, so the row has none of the new fields (`base-written/stored-week-tallies.jsonl`).

8. `getAlbumWeek {"week":"2026-10-12"}` as Odile (`base-written/getAlbumWeek-2026-10-12.json`): 2 kudos given, 1 received, Pim and Quill thanked, the days as stored, and `packsOpened: 0`, no new faces and no hoggies, read from the missing fields.
9. `getAlbumPerson` of Pim (`base-written/getAlbumPerson-pim.json`): 1 kudos given, 1 hug received, the best message, held (the history put him in), the hype emoji earned.

The reverse direction is an accepted failure: a week tally this branch wrote with the new fields fails `main`'s schema, so a rollback deploy to the sandbox is refused until those rows lose the fields. Production writes none of them while `album` is off there, since only opening and putting in write them.

## Prod shape

Read-only from production's Convex data on 2026-10-19: production holds no pair or week tally yet, so every member's person page reads an empty history and every week no issue until a kudos, a hug or the history writes one. Rows written there before this deploy carry none of the new fields and read as none.
