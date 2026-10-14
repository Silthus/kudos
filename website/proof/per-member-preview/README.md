# Per-member preview of the website (#204)

A local Convex backend on its own ports (6210/6211), with the handshake mock as Slack's issuer and as PostHog's flag definitions. The mock served `website`, `xp-levels`, `everyone-board`, `unlocks` and `quests` with one release condition, `email` exact `alice@example.com` at 100%, so the workspace decision is off for every flag. That override lived only on this disposable backend. The directory held two invented members, Alice (`alice@example.com`) and Bob (`bob@example.com`).

1. A signed `app_home_opened` for each member published App Home through the mock. Alice's front door links each page with the sign-in ask (`app-home-previewer.json`: `/?sign-in`, `/quests?sign-in`, `/leaderboard?sign-in`). Bob's App Home has no website link (`app-home-other-member.json`).
2. Alice opened `/quests?sign-in`. The site started Sign in with Slack at once, the callback admitted her on her own decision, and she landed back on `/quests`, signed in (`previewer-quests-light.png`, `previewer-quests-dark.png`). Her home shows her level and Journey (`previewer-home-light.png`, `previewer-home-dark.png`).
3. Bob opened `/?sign-in` in a separate browser profile. The callback refused him, and the site shows "Not open yet" with the ask gone from the address, so nothing loops (`other-member-refused-light.png`, `other-member-refused-dark.png`).
4. `backend-rows.txt`: one account (Alice), her two preview moments and the openings they made, no `unlockLaunches` and no `journeyLaunches` row, and an anonymous `getMyProfile` answering `closed`. Capture was off on this backend, so `flagExposures` stays empty here; `convex/website/preview.test.ts` proves the exposure.

Red before the change: `red-backend.txt` (6 of 11 failing), `red-website.txt` (6 failing). The gate on `4c3d85e`: `gate-4c3d85e.txt`.

## Refreshed on 8c0226e, after both review rounds

The same backend, redeployed at `8c0226e` with the site rebuilt:

5. Alice, still signed in, opened `/leaderboard?sign-in`. The ask was dropped and the board showed with no trip to Slack (`head-signed-in-ask-dropped-light.png`).
6. She signed out from the account menu. The page shows "Not open yet", not the blank page review round 2 found (`head-signed-out-after-ask-light.png`).
7. She opened `/leaderboard?period=month&sign-in`. The site started Sign in with Slack and brought her back to the month's board (`head-month-board-after-sign-in-dark.png`).

The gate on `8c0226e`: `gate-8c0226e.txt`. The launch refusal round 1 added (a flag switched on for the workspace after a preview) is proven in `convex/website/preview.test.ts`; its red run is `red-launch-due.txt`; round 2 added that no preview moment runs while such a launch is due (`red-preview-while-due.txt`, gate on `5993dd3`: `gate-5993dd3.txt`); the stuck page's red run is `red-stuck-blank.txt`.

## Final, on 31a3fd4 (merged with main)

`main` changed App Home's front door to hand over its origin, and App Home builds the home link and every crate's Open from it. So the sign-in ask moved from a `?sign-in` query into a `/sign-in` path in front of the route: while the workspace decision is off, the front door's origin is the site plus `/sign-in`. The sections above show the earlier `?sign-in` form.

8. A signed `app_home_opened` republished both App Homes. Alice's links are `/sign-in/`, `/sign-in/quests` and `/sign-in/leaderboard` (`merged-app-home-previewer.json`). Bob's has no website link (`merged-app-home-other-member.json`).
9. In a fresh browser profile, Alice opened `/sign-in/quests`. The site started Sign in with Slack and brought her back to `/quests`, signed in (`merged-previewer-quests-light.png`, `merged-previewer-quests-dark.png`).
10. She signed out, and Bob opened `/sign-in/`. The callback refused him and the page shows "Not open yet" at `/` (`merged-other-member-refused-dark.png`). The backend still held only Alice's account, and no `unlockLaunches` or `journeyLaunches` row.

The gate on `31a3fd4`: `gate-31a3fd4.txt` (131 files, 2082 tests).
