# Proof: team crests in the reveal, the Collection, the activity and the Book panel (#468)

The product owner's direction (2026-10-15, map #57): "once you collect the whole team, you collect this crest sticker in the book." Map #1's ship #464 (PR #504) made a drop complete a team's crest and `getCollection` answer every crest with its roster, behind `crests`. This ticket builds the website's side on `main`.

**The reveal.** A drop whose `crest` is set lands the crest after the hoggie's card as its own card: "Team complete!", the crest's full art on lemon rays, the team's name and "Crest earned". The burst is held for the beat (`crestBeatDelayMs`, `crestBeatPlaysForMs` in `RewardTokens.tsx`), the finish lists "{team} crest · Team complete", and the live region says "You found a {rarity} {hoggie}. It completed the {team} crest." Under reduced motion everything shows at once.

**The Collection.** A "Team crests" section after the summary and before the rarities: every crest in the answer's order, its art in full colour once collected and dimmed until then, its name, its roster as each hoggie's ring in full art or silhouette from the same answer, the date it was collected and `New` until this browser has shown it, or `{held} of {n}`. Screen readers get "Roster complete: …", or "Held: …. Still missing: ….". The summary adds "{n} of 54 team crests collected".

**The activity.** A `found` entry whose drop completed a crest reads "You found a {rarity} {hoggie} and completed {team}", with the crest's art beside the hoggie's ring. **The home.** The Book panel reads "{n} of 151 hoggies found · {m} of 54 crests".

**Crest art.** The brand package's full crest SVGs weigh 34 MB of source, so `TeamCrest.tsx` draws the package's 600 px PNGs, emitted as hashed assets and fetched only when a crest is on screen (the production bundle is 33 MB of hoggie SVG today; a follow-up).

## Tests

- `red.txt`: the five test files on `main` before the change: 8 failing plus the unresolved `TeamCrest` import.
- `green.txt`: the same files after: 58 of 58.
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on the landed tree.

Seams: `lootCrates.test.tsx` (the crest card after the hoggie, the held burst, the chips, the live region, reduced motion, a drop that completed no crest), `CollectionPage.test.tsx` (the section, order, counts, a collected and an uncollected tile, `New`, the spoken roster, no crests in the answer), `activityFound.test.tsx`, `bookPanel.test.tsx`, `crestCatalogue.test.tsx` (every catalogue crest resolves to its PNG).

## Running app

A fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`) and the reveal's proof fixture (`fixture/`, built in `website/` with `vite build --config proof.vite.config.ts`; `?drop=common&crest=customer-success-eu&path=/quests`), both served with `vite preview` and shot with T3's preview browser.

| What | File |
|---|---|
| The Collection with the Team crests section, light, 1280 px: 2 of 54 collected, People & Ops and Platform UX in colour and tagged New, the rest dimmed with their roster's progress | `1-collection-crests-1280-light.png` |
| The same in dark | `2-collection-crests-1280-dark.png` |
| The same at 390 px, two tiles a row | `3-collection-crests-390-light.png` |
| The home's Book panel: "41 of 151 hoggies found · 2 of 54 crests" | `4-home-book-panel-crests-1280-light.png` |
| The activity: "You found a 🟧 Legendary Rocket and completed Blitzscale" with the crest beside the ring | `5-activity-found-crest-1280-light.png` |
| The same row at 390 px, wrapping (review round 1, finding 1) | `6-activity-found-crest-390-light.png` |
| The reveal: a common Angel completing Customer Success EU, from the burst to the finish, and the finish | `7-reveal-crest-beat-1280-light.mp4`, `7-reveal-crest-finish-1280-light.png` |
| The reveal's finish in dark | `8-reveal-crest-finish-1280-dark.png` |

## Sandbox, `different-dog-467`, read-only

The sandbox runs the ship head and was not deployed. This branch's build was pointed at the sandbox deployment (`VITE_CONVEX_URL`), served locally, and signed in as the synthetic member Cy (`U0PRF350CYP`) through one appended six-hour `authRefreshTokens` row for Cy's existing session; nothing wrote a collection row. `sandbox-getCollection-cy.json` and `sandbox-getActivity-cy.json` are the reads through `convex run --identity`: Cy holds 7 hoggies, Customer Success EU is collected, and the Croissant `found` entry carries the crest.

| What | File |
|---|---|
| Cy's Collection from the real `getCollection`: 7 of 151, Customer Success EU collected on 16 Oct 2026 and tagged New | `9-sandbox-collection-cy-1280-light.png` |
| Cy's home: the Book panel's crest count | `10-sandbox-home-cy-1280-light.png` |
| Cy's activity in dark: the Croissant find that completed Customer Success EU | `11-sandbox-activity-cy-1280-dark.png` |

## Review

`review-final.md`: a second GPT-6.1 Sol read of the fixes since round 1 with the round-1 findings as its checklist: both resolved, no regression, ship.

`review-round-1.md`: GPT-6.1 Sol (high, `codex exec --sandbox read-only`) over the diff against `main` with the ticket, the website spec, the visual language and the hoggies contract as the oracle. Two findings, both taken: the found row's text now shrinks and wraps at 390 px, and a crest tile names every roster hoggie as held or still missing.

## Calls

- Crest art from the package's PNGs, fetched on demand, over the 34 MB of inline SVG.
- The Team crests section after the summary and before the rarities, in the answer's order, uncollected crests dimmed with their roster's progress.
- The crest lands as its own card after the hoggie's, on lemon rays, and the burst is held for it.
- The live region says the hoggie found and the crest it completed.
