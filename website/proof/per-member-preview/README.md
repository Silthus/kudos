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

The gate on `8c0226e`: `gate-8c0226e.txt`. The launch refusal round 1 added (a flag switched on for the workspace after a preview) is proven in `convex/website/preview.test.ts`; its red run is `red-launch-due.txt`, and the stuck page's red run is `red-stuck-blank.txt`.
