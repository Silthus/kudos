# #652 sandbox proof: earned emojis and their names

Branch `album/8` at `0caebaa8` (`main` at `2a0ded78`), hand-deployed at 07:42 UTC on 2026-10-19 to the sandbox `different-dog-467`, functions only. The deploy came from a proof tree that also merged the live lane `album/24`'s proof tree (`e626ebb9`), so its `getAlbumProfile` stayed live; no other sandbox function was missing from the tree (`convex function-spec` against the tree's exports). The dry run added only `seenEmojis.by_member_emoji` and deleted no index. `album` flag 970572 is on in the sandbox; `collection` and `packs` on.

1. `drive.mts` signs Slack-shaped events by hand (not a Slack click) with the sandbox signing secret: two synthetic members join (`cast.mts`, `KUDOS_CAST=A`), the thanked one with a Slack picture, and the giver sends them one thoughtful kudos. Output: `drive-output.txt`.
2. `convex run website/album:getAlbum '{}' --identity …` as the giver, through an imported `users` and `authSessions` row. The giver's emojis hold **the packed person's hype emoji, earned, named `caspian-thornea-hype`, pictured by their Slack face URL**, and every team, milestone and level emoji locked with its progress.
3. `seed.mts` writes the company copy as the sync writes it: `companyProfiles/sync:replaceCompanyProfiles` with the sandbox's copy plus two made-up teams. `Piggy` slugs to `piggy`, an emoji the sandbox workspace already has; `Lanternfolk A` slugs to `lanternfolk-a`, which it hasn't. The after-sync reservation named both in the registry.
4. `getAlbum-1-seeded-before-sync.json`: `piggy` reads **`inSlack: true`** and `lanternfolk-a` **`inSlack: false`**, from the copy the daily sync had already kept.
5. `slack/customEmoji:syncCustomEmoji` ran by hand: `emoji.list` answered and listing 8 was written (`customEmojiListings-after-sync.jsonl`), re-listing `piggy` (`customEmoji-piggy.jsonl`). `getAlbum-2-after-sync.json` reads the same: `piggy` in Slack, `lanternfolk-a` not.
6. `markEmojisSeen` with the hype emoji, `level:5` (not reached) and the `Piggy` team emoji (not unlocked) answered `seen` with **the hype emoji only** (`markEmojisSeen.json`). `getAlbum-3-hype-seen.json` reads it `seen: true`; `seenEmojis-sandbox.jsonl` holds the one stored row.
7. The real `companyProfiles/sync:syncCompanyProfiles` replaced the copy again, so the seeded teams are gone from the sandbox; their registry names stay, as AL25 orders.
8. `build-listing.txt`: a local `pnpm website:build` wrote 66 pictures under `website/dist/emoji/`, each a 128 × 128 PNG, the largest about 18 KB. `emoji-art-sheet.png` shows two team crests, the team and hype emblems, the five milestone emblems and the five level badges.

The `getAlbum` files keep the seeded teams' emojis, the hype, milestone and level emojis, and a count of the other team emojis; `me`, `teams` and `people` are left out, since they list posthog.com's teams and the names of their people.

The `curl` of `/emoji/team-<slug>.png` runs on production after the merge deploys the website, rather than by uploading this branch's build over the shared sandbox website, which UI lanes are proving on.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> KUDOS_CAST=A SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/652-album/drive.mts`, then `KUDOS_CAST=A bun website/proof/652-album/seed.mts <companyProfiles.jsonl> <companyTeams.jsonl> seed > args.json` and `convex run companyProfiles/sync:replaceCompanyProfiles "$(cat args.json)"`.
