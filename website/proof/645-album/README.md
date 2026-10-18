# #645 sandbox proof: thoughtful packs are earned

Branch `album/1`, hand-deployed at `e087e77f` (first run) and again at `2e2b1a78` (second run, with qa-swarm round 1's fixes; `KUDOS_CAST=B` gives a second cast with the same names), to the sandbox `different-dog-467` (functions only; the website is unchanged), `album` flag 970572 at `environment = sandbox`, 100%.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: four synthetic members join, then one giver sends a thoughtful kudos to three of them, a second thoughtful kudos to one of them, and a short kudos (`ty`). Output: `drive-output.txt`.
2. `convex run website/album:getAlbum '{}' --identity …` as the giver, through an imported `users` and `authSessions` row: `getAlbum-sandbox.json`, exactly three waiting packs.
3. The sandbox's grant records for the second run's giver (`grant-records-sandbox.jsonl`): three `new` for the first message, one `nextWeek` for the second, none for the short kudos.
4. The registry (`emoji-names-sandbox.jsonl`): the five level and five milestone names and every company team's name reserved, the first cast's hype names (`fennel-brook-hype`, …) and the second cast's namesakes numbered before the suffix (`fennel-brook-2-hype`, …).
5. PostHog project 662840: `posthog-packs-earned.txt`, one `packs earned` with `packs_earned = 3` and `recipients = 3`, then one with `0` and `recipients = 1`.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/645-album/drive.mts`
