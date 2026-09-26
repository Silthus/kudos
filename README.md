# Kudos

Peer recognition for Slack. Give seeds of appreciation: mention teammates with the kudos emoji, 🌱 `seedling` by default (`@ana @ben :seedling::seedling: thanks for the release!`), everyone gets a daily allowance, and every bot reply is a collectible message with a rarity. Thoughtful kudos (a few words on why) also earn XP and Hog coins in an optional game: levels, a skill tree, quests, kudos sprees, gardens grown for teammates, boosters and bonus days, and a Store priced in Hog coins.

The web app is a small isometric pixel-art garden at dusk. You walk around it as PostHog's Hedgehog Mode hedgehog (arrow keys, WASD, or click where to go), with your garden of key beds in the middle and your teammates' beds around it. Every page is a place on the map, and walking to its door opens its window:

| Place | What's there | Route |
| --- | --- | --- |
| Your garden | your plants, fruit to pick, planting for a teammate, the neighbours' gardens | `/garden`, `/garden/<memberId>` |
| Your cabin | level, XP, allowance, wallet, activity, your look, sign out | `/me` |
| Quest signpost | the weekly board, today's quest, the quest log | `/quests` |
| Notice board | standings by period | `/leaderboard` |
| Mirror pond | you against past you, a teammate or the team | `/compare` |
| The gallery | the discovered messages by rarity | `/discoveries` |
| The store stall | game items, cosmetics, real rewards | `/store` |
| The elder oak | the skill tree | `/skills` |
| The observatory | team analytics and the game's success metrics | `/analytics` |
| The gatehouse | admin: settings, members, moderation, store, bonus days, Slack | `/admin` |
| The sandbox | a Slack playground and the simulator (demo only) | `/playground`, `/playground?tab=simulator` |

Routes are still locations: a deep link from Slack opens the place's window with the hedgehog at its door, and a link inside a window walks you to its place first. The Places button (top right) lists every place for keyboard and screen-reader users, and the Motion switch in the settings menu (or the system's reduced-motion setting) moves the hedgehog without walking and stills the celebrations. The world, buildings and plants are drawn in code; the hedgehog sprite and PostHog's hoggies and Keyboard garden load at runtime (jsDelivr and posthog.com) and are never committed.

Everything runs on one Convex deployment: the database, Slack's Events API webhooks (plain HTTPS, no Socket Mode), Sign in with Slack, and the static React app (`@convex-dev/static-hosting`).

**Live:** https://valiant-monitor-701.convex.site (click "Explore the live demo" for a seeded sample workspace, played through a year of the game).

**The simulator** (demo only): the sandbox's Simulator tab gives a demo visitor a private copy of the game, joined at any level from 1 to 25, with twelve teammates, an empty garden and its own clock. Give kudos in the Playground tab as usual, move the days on with Next day and Next week, or let a bot play up to 24 levels through the real engine (Simulate levels) and read the run's summary: days, kudos, quests, coins and days per level. It belongs to the visitor's sign-in session, never posts to Slack or touches the shared demo, and is wiped when they stop it or after 7 days (an hourly cron). Like the demo, it needs `DEMO_MODE=true`.

`docs/screenshots/` holds screenshots of the earlier dashboard design, from before the garden world.

## How it fits together

| Path | What it does |
| --- | --- |
| `convex/http.ts` | Slack webhooks (`/slack/events`, `/slack/commands`, `/slack/interactions`), OAuth install (`/slack/install`), manifest, auth routes, then the SPA catch-all |
| `convex/slack.ts` | Event processing and every Slack Web API call (DMs, ephemeral replies, bot reactions, App Home, member sync) |
| `convex/engine.ts` | The one place kudos are given or revoked: allowance, rollups, totals, maxed days, rarity-rolled bot messages |
| `convex/lib/messages.ts` | The 72 discoverable messages and the rarity roll |
| `convex/me.ts`, `leaderboard.ts`, `analytics.ts`, `discoveries.ts`, `compare/` | Read models for the web app |
| `convex/game.ts`, `gardens.ts`, `items.ts`, `store.ts`, `quests.ts`, `life.ts` | The game: XP and coins, gardens, Store items, quests, the world's sprouts |
| `convex/admin.ts` | Settings, admins, moderation (revoke) |
| `convex/demo.ts` | Seeded demo workspace and the Slack playground |
| `convex/simulator.ts`, `lib/time.ts` | The simulator: a visitor's private workspace, its bot, and the workspace clock (`workspaceNow`, used instead of `Date.now()`) |
| `src/world/` | The garden world: map, places (`places/<id>.ts`), hedgehog, windows, HUD |
| `src/` | React app (Vite, Tailwind v4, Motion); pages render inside place windows |

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

Tests need no backend and no `.env.local`: they pass on a fresh clone. Vitest ignores `.env*` files and pins its own placeholder `VITE_CONVEX_URL`/`VITE_CONVEX_SITE_URL` (`src/testing/env.ts`); frontend tests mock `convex/react` instead of talking to a deployment.

Deploy: `npx convex deploy && npx @convex-dev/static-hosting upload --build --prod`.

## Maintenance

Internal functions for operators, run with `npx convex run --prod <function> '<args>'`:

- `rollups:rebuildWorkspace '{"workspaceId":"…"}'` rebuilds a workspace's rollups; `rollups:verify '{"workspaceId":"…"}'` checks them (add `"buckets":["m:2026-09",…]` to pick what it samples).
- `removal:removeMember '{"slackTeamId":"T…","slackUserId":"U…"}'` removes a member for good:
  - Every kudos they gave or received is revoked, so the people they thanked lose those kudos too: received totals, the Hog coins their teammates earned by thanking them (a balance can go below zero) and quests that needed them go down. Their own rows, Store requests (open ones give back their stock) and sign-in are deleted, the admins' review DMs of their requests lose their buttons, and the workspace's rollups are rebuilt.
  - Not touched: other people's bot messages, and the text of messages that also thanked someone else, still show their name; adjustments and request decisions they made as an admin stay and read "a former admin".
  - It refuses bots, the demo, and the workspace's last admin (pass `"force":true` to remove them anyway).
  - The work runs in the background; the logs end with a `removeMember: removed …` summary. If that never appears (a step failed), run it again: a second run finishes what the first left.
  - It doesn't remove them from Slack. If they are still there, the next time Slack tells Kudos about them (someone thanks them, they react or use `/kudos`, their profile changes, the nightly directory sync) they come back as a new, empty member, an admin again if they are a Slack admin.
