# Kudos

Peer recognition for Slack. Mention teammates with the kudos emoji (`@ana @ben :taco::taco: thanks!`), everyone gets a daily allowance, every bot reply is a collectible message with a rarity, and a web dashboard shows personal stats, leaderboards and team analytics.

Everything runs on one Convex deployment: the database, Slack's Events API webhooks (plain HTTPS, no Socket Mode), Sign in with Slack, and the static React app (`@convex-dev/static-hosting`).

**Live:** https://valiant-monitor-701.convex.site (click "Explore the live demo" for a seeded sample workspace).

| Personal dashboard | Leaderboard |
| --- | --- |
| ![My kudos dashboard: daily allowance, rank, giving cadence, weekly quests and discoveries](docs/screenshots/me.png) | ![Leaderboard of givers and receivers](docs/screenshots/leaderboard.png) |

<img src="docs/screenshots/mobile-me.png" alt="The dashboard on a phone" width="260">

More in [`docs/screenshots/`](docs/screenshots/).

## How it fits together

| Path | What it does |
| --- | --- |
| `convex/http.ts` | Slack webhooks (`/slack/events`, `/slack/commands`, `/slack/interactions`), OAuth install (`/slack/install`), manifest, auth routes, then the SPA catch-all |
| `convex/slack.ts` | Event processing and every Slack Web API call (DMs, ephemeral replies, bot reactions, App Home, member sync) |
| `convex/engine.ts` | The one place kudos are given or revoked: allowance, rollups, totals, maxed days, rarity-rolled bot messages |
| `convex/lib/messages.ts` | The 60 discoverable messages and the rarity roll |
| `convex/me.ts`, `leaderboard.ts`, `analytics.ts`, `discoveries.ts` | Read models for the dashboard |
| `convex/admin.ts` | Settings, admins, moderation (revoke) |
| `convex/demo.ts` | Seeded demo workspace and the Slack playground |
| `src/` | React app (Vite, Tailwind v4, Motion) |

Received kudos are private by default (`receivedVisibility`: `hidden` / `self` / `everyone`, set by admins).

## Install into a Slack workspace

Open `/setup` on the deployment. It shows the manifest with this deployment's URLs, a "create app from manifest" link, which env vars are configured, and the install link. In short:

1. Create the Slack app from `https://<deployment>.convex.site/slack/manifest.json`.
2. `npx convex env set --prod SLACK_CLIENT_ID=… SLACK_CLIENT_SECRET=… SLACK_SIGNING_SECRET=…`
3. Install via `https://<deployment>.convex.site/slack/install`, then `/invite @Kudos` to channels.

Other env vars: `JWT_PRIVATE_KEY` / `JWKS` (Convex Auth), `SITE_URL`, `DEMO_MODE=true` to enable the public demo.

## Develop

```bash
npm install
npx convex dev          # backend, watches convex/
npm run dev             # Vite on :5173
npm test                # vitest + convex-test (unit, engine, HTTP/Slack, authorization)
npm run check           # the merge gate: typecheck + tests + build
```

Deploy: `npx convex deploy && npx @convex-dev/static-hosting upload --build --prod`.

## Maintenance

Internal functions for operators, run with `npx convex run --prod <function> '<args>'`:

- `rollups:rebuildWorkspace '{"workspaceId":"…"}'` rebuilds a workspace's rollups; `rollups:verify '{"workspaceId":"…"}'` checks them (add `"buckets":["m:2026-09",…]` to pick what it samples).
- `removal:removeMember '{"slackTeamId":"T…","slackUserId":"U…"}'` removes a member for good:
  - Every kudos they gave or received is revoked, so the people they thanked lose those kudos too: received totals, Store balances (which can go below zero) and quests that needed them go down. Their own rows, Store requests (open ones give back their stock) and sign-in are deleted, the admins' review DMs of their requests lose their buttons, and the workspace's rollups are rebuilt.
  - Not touched: other people's bot messages, and the text of messages that also thanked someone else, still show their name; adjustments and request decisions they made as an admin stay and read "a former admin".
  - It refuses bots, the demo, and the workspace's last admin (pass `"force":true` to remove them anyway).
  - The work runs in the background; the logs end with a `removeMember: removed …` summary. If that never appears (a step failed), run it again: a second run finishes what the first left.
  - It doesn't remove them from Slack. If they are still there, the next time Slack tells Kudos about them (someone thanks them, they react or use `/kudos`, their profile changes, the nightly directory sync) they come back as a new, empty member, an admin again if they are a Slack admin.
