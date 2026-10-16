# Proof: the Book's Collection page, found entries and the home's collection progress (#467)

The product owner's direction (2026-10-15, map #57 decision 25): the Book becomes a collection of hoggies with rarities and duplicates, and every crate drops one. Map #1 ships the drop, `getCollection` and the activity's `found` entry (#462, on `spec/collection`). This ticket builds the website's side of it on today's `main`: the Collection page, the `found` entry, the home's Book panel, and the visual language's rarity rules.

**`/book/collection`.** Every one of the 151 hoggies, grouped by rarity, rarest first, so the six legendaries lead the page. Each section is named by its coloured square and word (`🟧 Legendary`) with its chance and its found count. A found hoggie is drawn in full art from `@posthog/brand` on a coin in its rarity's colour, with its name, `×{count}` past the first copy, and a `New` tag until this browser has shown it (the Book's seen keys, like a new tier). A missing one is a silhouette on a dashed coin with its name. The summary card leads with how many are found of the total, a neutral progressbar and the latest find. The index and the overview gain `Collection`; the overview's tile carries the rarity counts.

**The activity.** A `found` entry renders centred, like a level reached: the hoggie's art on its rarity coin and `You found a 🟧 Legendary Rocket`, with `×{copy}` past the first copy.

**The home.** While `getCollection` answers the collection, the Book panel shows how many hoggies are found of the total, the latest find with its art and rarity, and `See your collection` beside `Open the Book`.

**The reveal.** #452 already reads `drop` from the open's answer and bursts it out last as a card; this ticket adds nothing there beyond the rarity tokens' home, and the recording below proves the drop landing on the fixture that supplies one.

**The real read.** Ship #462 (PR #495) landed on `main` on 2026-10-16, so `LiveApp` subscribes to `api.website.collection.getCollection`, the website types come from `convex/website/collection.ts`, `convex/hoggies/drops.ts` and `convex/activity/entries.ts`, and the fixtures build from `convex/hoggies/catalogue.ts`. The local copies the draft carried are gone.

## Tests

- `red.txt`: the five new or changed test files on `main` before the change: 25 of 40 failing (the routes, the rarity tokens, the Collection page, the found entry and the Book panel).
- `green.txt`: the same files after: 40 of 40 passing.
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on the landed tree.

Seams: `CollectionPage.test.tsx` (the answers, the read gating, the page), `activityFound.test.tsx`, `bookPanel.test.tsx`, `rarityContrast.test.tsx` (V24 at 3:1 on the card and the canvas in both modes), `routeList.test.tsx`, and five new rows in `accessibility.test.tsx`.

## Running app

A fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`) served with `vite preview`, shot with T3's preview browser. The reveal uses #452's proof fixture (`website/proof/loot-crates/fixture/`) with `?drop=legendary&path=/quests`.

| What | File |
|---|---|
| The Collection page, light, 1280 px: 41 of 151 found, the rarity sections, New tags on a first visit | `1-collection-1280-light.png` |
| The same in dark | `2-collection-1280-dark.png` |
| The same at 390 px, with the page picker | `3-collection-390-light.png` |
| The Book overview with the Collection tile, its rarity counts in squares and words | `4-book-overview-collection-tile-1280-light.png` |
| The home's Book panel with the collection's progress and the latest find | `5-home-book-panel-1280-light.png` |
| The activity with a found entry between two kudos | `6-activity-found-entry-1280-light.png` |
| A legendary drop landing in the reveal: the burst, the card, the finish (the recording is from before review round 1; the finish shot after it, with the card on the shared rarity tokens) | `7-reveal-legendary-drop-light.mp4`, `7-reveal-legendary-drop-finish-light.png` |

## Calls

- Rarest first, with the odds on each section header, over catalogue order with a legend (`d-` in the journal, "the Collection page groups the 151 hoggies by rarity").
- The home's latest find is the newest first find (`getCollection` carries no drop history); App Home's line names the last drop.
- Rarity colours become V3's fourth exception, one token per rarity with light and dark values, always beside the rarity's square and word; V13 and V17 follow the drop.
- `hoggie` joins the lexicon with `spec/collection`'s definition, so the branches merge clean.

## Review

`review-round-1.md`: GPT-6.1 Sol (high, `codex exec --sandbox read-only`) over the diff against `main`, with `spec/collection.md`, the ticket, the visual language and the website spec as the oracle. Five findings, all taken:

1. `/book/collection` showed the Book's waiting page (with its crate) while `getCollection` said not-found: the collection's answers now come first.
2. A hoggie arriving while the page was open never got its `New`: `useFreshKeys` now adds unseen arrivals before marking them.
3. The overview tile's rarity counts were squares alone, hidden from assistive tech: squares plus words, and a spoken description on the link.
4. The reveal kept #452's own hex values beside the new tokens: the scrim now takes the tokens' dark values.
5. First-found dates were screen-reader only: each found tile shows its date.

## Live run on a local backend

`live-rig.sh` starts a fresh `convex-local-backend` on 11410/11411 (its own instance and storage under `/tmp`, never a cloud deployment) and deploys this tree; `live-driver.mts` (run with `bun`) answers Slack and PostHog with the repo's `FakeSlack` and `FakePostHog` on 11412, turns the flags on for everyone (`xp-levels`, `unlocks`, `everyone-board`, `achievements`, `skill-tree`, `quests`, `activity`, `website`, `collection`), and drives Alice through signed Slack requests: a kudos to Bob, levels 2 to 5, then `Open` on the Leaderboard, the Book, the Skill tree and Quests from App Home. Each open drops one hoggie. `live-transcript.txt` is the run; `live-getCollection-alice.json` and `live-getActivity-alice.json` are the website's answers read with `convex run --identity` for Alice's appended `authSessions` row. The browser signed in with the appended refresh token in `localStorage` (Convex Auth's own refresh minted the JWT with keys set on the local deployment).

| What | File |
|---|---|
| `/book/collection` from the real `getCollection`: 4 of 151, the two rare finds tagged New, each found tile dated | `8-live-collection-1280-light.png`, `8-live-collection-1280-dark.png` |
| `/activity` with the four `found` entries between the level marks and the kudos | `9-live-activity-found-1280-light.png` |
| The home's Book panel with 4 of 151 and the latest find | `10-live-home-book-panel-1280-light.png` |
| A real drop: `Open` on the Journey reward runs `openQuestCrate`, the backend draws Doll House, and the reveal bursts it out as the card; the Book panel behind reads 5 of 151 | `11-live-reveal-real-drop-light.mp4`, `11-live-reveal-real-drop-finish-light.png` |
