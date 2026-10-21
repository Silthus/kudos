# Silthus/personal#119 sandbox proof: the pet hoggie

Branch `core-loop/119` was deployed by hand to the sandbox `different-dog-467` on 2026-10-21, with both the functions and the website. The dry run deleted no index and added only `petHoggies.by_workspace_member`. No sibling lane was live there. Flag `pet-hoggie` 978982 is at 100% for `environment = sandbox` only.

1. `drive.mts` signs three `team_join` events by hand, not through Slack. It uses the sandbox signing secret to add three made-up members (`drive-output.txt`).
2. `seed.mts` writes the company copy the way the sync does: the sandbox's own copy plus one made-up team, `Burrowkeepers`, holding the three. The members have no pictures, so no real face appears in any still.
3. Appended rows:
   - the owner's two drops, Banana and Rocket (`drops`, `hoggieTallies`, `dropTallies`);
   - one `analyticsIds` row per member;
   - a `users` row, an `authSessions` row and an `authRefreshTokens` row for each signed-in member.
4. The owner signs in and opens Rocket's entry on Hoggies (`1-owner-rocket-before.png`), then clicks **Make my pet**. The entry turns to "Your pet" (`2-owner-rocket-your-pet.png`), and `petHoggies` holds one row (`petHoggies-sandbox.jsonl`).
5. Another member signs in. Their `getAlbum`, read through `convex run --identity`, lists the owner's pet (`getAlbum-viewer-pets.json`). That member's team page shows Rocket in colour on the owner's sticker (`3-viewer-team-page.png`). The person page shows it in the mount, with "Pet: Rocket" (`4-viewer-person-page.png`).
6. The same member's Leaderboard lists the owner, and the page has no pet element.

The first team-page capture showed the pet's circle over the owner's name. `pet.css` now sets the circle into the sticker's corner at every photo size, and the website was uploaded again before stills 3 and 4.

Run:
- `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/core-loop-119/drive.mts`
- `bun website/proof/core-loop-119/seed.mts <companyProfiles.jsonl> <companyTeams.jsonl> > args.json`, then `convex run companyProfiles/sync:replaceCompanyProfiles "$(cat args.json)"`.
