# Silthus/personal#130 sandbox proof: a filled team pays a new rare hoggie

On 2026-10-21, branch `core-loop/130` (60fd5042) was deployed by hand to the sandbox `different-dog-467`, with both the functions and the website.

The deploy used a throwaway tree that was never pushed. It merged three sibling lanes that were live on the sandbox, so their functions stayed up:
- the hoggie-forge tree 6703d972 (`feat/hoggie-forge` with `core-loop/129`);
- `core-loop/132` (6b28bbc1).

The dry run deleted no index. Flags `achievement-hoggies` (980756) and `hidden-items` are both at 100% for `environment = sandbox` only.

Every member and the team are made up. Nobody has a picture.

## Steps (take B)

1. `drive.mts join` signs two `team_join` events, for Juno Pellward and Corin Wilderby.
2. `seed.mts` writes the company copy the way the sync does: the sandbox's own copy plus one made-up team, Lamplighters, holding the two.
3. `drive.mts thanks` signs Corin's thoughtful kudos to Juno.
   - Corin collects Juno's face-down sticker and a thoughtful pack.
   - At the same moment, Corin's bronze First thank-you medal earns one face-down item with an uncommon floor (`1-board-medal-item.png`, tag "First thank-you · Bronze").
4. Corin signs in through imported `users`, `authSessions` and `authRefreshTokens` rows, in an incognito tab. Corin turns Juno's sticker item, which fills Lamplighters (1 of 1).
   - The same turn earns one item for filling Lamplighters, with a rare floor.
   - It also earns two items for the bronze medals that filling the page completes: First face and First full page.
   - The board tags these items "Lamplighters", "First face · Bronze" and "First full page · Bronze" (`2-board-team-item.png`).
5. Corin turns the Lamplighters item. It draws Einstein Group, a rare hoggie that Corin did not own: "Einstein Group: Rare hoggie · New" and Rare 1/30 (`3-team-item-turned-rare.png`, `4-hoggies-einstein-group-new-rare.png`).
   - The drop row reads crate `team:proof-130-lamplighters`, rarity `rare`, copy 1 (`drops-sandbox.jsonl`).
   - Corin's items are in `items-sandbox.jsonl`.

Take A (Rook Tamberlane and Sable Ashgrove on Lanternwrights) ran first. Between the first deploy and the kudos, a sibling lane (`core-loop/132`) redeployed functions only. Rook's First thank-you tier and the Lanternwrights sticker were therefore recorded with no item. No backfill pays them now, as LP62 says. Take B ran after the merged redeploy.

## Demo beat 6

Run take B with a fresh `KUDOS_CAST` letter added to `cast.mts`. The sandbox allows three kudos per giver per day, and each take's members must be new.

- `KUDOS_CAST=<letter> KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/core-loop-130/drive.mts join`
- `KUDOS_CAST=<letter> bun website/proof/core-loop-130/seed.mts <companyProfiles.jsonl> <companyTeams.jsonl> > args.json`, then `convex run companyProfiles/sync:replaceCompanyProfiles "$(cat args.json)"`.
- `KUDOS_CAST=<letter> … drive.mts thanks`, then sign the giver in with imported `users`, `authSessions` and `authRefreshTokens` rows, as in `../core-loop-119/README.md`. Turn the sticker, then the team item.
