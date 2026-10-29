# Spec: the hoggie forge

> **Settled with the product owner on 2026-10-21, revised 2026-10-22** in the thread of the core-loop demo task (Silthus/personal#102, map Silthus/personal#95). It is a side feature: it does not block the demo. Rules are cited as `HF1`–`HF12`.

## Problem Statement

A member who keeps thanking teammates keeps finding hoggies they already hold. A fourth Coffee Cup is a number on a plate, `×4`, and nothing more: a duplicate never moves the member closer to the hoggies they are missing, so the more a member gives, the less each find means.

## Solution

**Four of a kind forge into a face-down item one rarity up.** A member holding four or more copies of a hoggie can forge three of them, in their field guide entry on the `Hoggies` page, into a hoggie one rarity up: one they do not own yet while that rarity still has one, otherwise a second copy of one. They keep one copy, so they never lose the hoggie itself. Three copies fly together and fuse into a face-down item, and the member turns it over like every other item: it flips, bursts out in its rarity's colour and goes into the album.

## User Stories

1. As a member with four or more copies of a hoggie, I want to forge three of them into a hoggie one rarity up, so that my duplicates bring me closer to a full collection.
2. As a member, I want to keep one copy of the hoggie I forge from, so that forging never costs me a hoggie, a crest or my pet.
3. As a member, I want the forged hoggie to be one I don't own yet while one is left, so that a forge is a new find whenever it can be.
4. As a member, I want the forge to end on a face-down item I turn over myself, as every item is, so that it keeps its suspense and feels like a reward and not a form.
5. As a member who prefers reduced motion, I want the face-down item at once, and its turn with no movement.
6. As a member with fewer than four copies, I want the entry to tell me what four copies would forge into, so that I know the forge exists.
7. As a member who owns every hoggie one rarity up, I want to forge anyway, so that I can collect copies of the rarity above; as a member who holds a legendary, I want no forge button, as nothing is above it.
8. As a member, I want a forged hoggie to count like any other find on Milestones, in team crests and in Activity, so that it is a real part of my collection.
9. As the product owner, I want every forge recorded in PostHog, so that I can see whether duplicates get used.
10. As the product owner, I want the forge dark behind its own flag, so that I can turn it off without losing anything.

## Implementation Decisions

### Vocabulary

- **HF1 The lexicon.** **hoggie forge** joins `lexicon.json` as a concept: a member's spend of three spare copies of one hoggie for a hoggie one rarity up that they do not own yet. It is named hoggie forge, not forge, because a forged request is the security sense. **spare** joins it as a property of hoggie: every copy of a hoggie past the first a member holds. Spares already exist in `getAlbumHoggies` (`spares`, `convex/album/hoggies.ts`).

### What a forge takes and gives

- **HF2 It takes three spares.** A member may forge a hoggie while they hold at least three spares of it (four copies). The forge lowers that hoggie's copies by exactly three, so its tally never falls below one and every reader of "holds this hoggie" (pets, crests, Milestones, the avatar) sees no change. A hoggie's tally count therefore means the copies a member holds now, no longer every find ever.
- **HF3 It gives one rarity up.** The forged hoggie has the rarity directly above the spent hoggie's (common → uncommon → rare → epic → legendary). While the member does not hold every hoggie of that rarity it is one they hold no copy of; when they hold them all it is a second copy of one, so a full rarity never stops a forge. A legendary is never forged, and while `rarity-caps` is on for the member a rare or an epic is not forged either (HH43).
- **HF4 The pick, at the turn.** The forged hoggie is picked when its item is turned (HF5), among the hoggies of the next rarity the member does not hold then, in catalogue order, or among every hoggie of that rarity when they hold them all, uniformly by the first 4 bytes of SHA-256 of `{secret}:{member}:{crate}:{version}`, with the deployment's `HOGGIE_DRAW_SECRET` and the forge's crate key, so a turn sent again finds the same hoggie. The member never chooses.
- **HF5 It is an item, then a find.** The forge earns the member one face-down item through `convex/items`' `earnItem`: source `hoggie`, key `forge:<request>` (HF7) and reason `forge` naming the hoggie forged from. The item board shows it like any item, tagged `Forged`, never its face or rarity (LP9). Its turn, the items module's own `turn` (LP10), records the forged hoggie through the existing find path of `convex/hoggies`: a drop row with that crate key, of a new crate kind `forge` with no pack band, so it pays no XP and no coins, counted in the album's tallies, and it publishes `hoggieDropped` and `itemTurned`. A first copy can complete a team crest. The milestone subscriber records any tier it reaches, Activity lists it as a find, and App Home's last find can name it. A crest it completes is recorded as for any find; the website shows no new crest surface for it. A milestone tier the turn reaches unlocks in that turn, with its own beat on Milestones (LP14, LP19a). Turned again, it answers the same face and applies nothing (LP12).
- **HF6 One mutation.** `forgeHoggie({ hoggie, request })` is a public website mutation for the signed-in member. It spends the copies and earns the item in one transaction and answers the item's ID. A request it has already forged answers that forge's item again, turned or not, and spends nothing. It answers `refused` when the flag, `hidden-items`, the album or the collection is off for the member, when the request is not 1 to 64 letters, digits, dashes or underscores, when the name is no catalogue hoggie, when the member holds fewer than three spares of it, when it is legendary, or when it is rare or epic while `rarity-caps` is on for the member (HH43). A refusal writes nothing.
- **HF7 Sent once, keyed by its request.** The website sends `forgeHoggie` through the HTTP path (`useSentOnce`), as `makePet` does, so a reconnect never replays a forge. Each forge the member means gets a new request ID (`crypto.randomUUID()`), kept for each hoggie by the album, through visits to other pages, while its answer is unknown: `Forge` pressed again after an unreachable server sends the same request, and the button and its unreachable line stay for that retry though the reactive read already shows the copies spent, also after a visit to another page and after `rarity-caps` turns on for a rare or an epic in the meantime (HH43), and a forge still sent when the member comes back shows `Forging…` and then its face-down item, so a forge that committed before its answer was lost is never made twice. The reactive read updates the copies.

### On the website

- **HF8 Where it shows.** In the field guide entry of a found hoggie, beside "Make my pet":
  - with three or more spares: a button, `Forge 3 into a Rare`, with one line under it, `Keeps one Coffee Cup. Gives a Rare you don't have yet.`, or, with every hoggie one rarity up held, `Keeps one Coffee Cup. Gives a Rare. You hold every one already.`;
  - with fewer than three spares: one quiet line, `4 copies forge into a Rare you don't have yet.`, or, with every hoggie one rarity up held, `4 copies forge into a Rare.`;
  - for a legendary, and for a rare or an epic while `rarity-caps` is on for the member (HH43): nothing.
  The rarity word is the catalogue's word for the next rarity. `getAlbumHoggies` carries `forge: { upTo }`, the highest rarity a forge makes for the member (`rare` while `rarity-caps` is on, read without an exposure, and `legendary` otherwise, HH43), only while `hoggie-forge` and `hidden-items` are on for the member and omits it otherwise; the entry derives the cases from that field and the copies and rarities the answer already has, and the server decides again at the forge.
- **HF9 The forge's sequence.** Over the entry of the hoggie it was forged from, and no other, waiting there until the member opens it, each hoggie's apart: three copies of the spent hoggie's art fly to the centre and fuse (600 ms), a flash in the next rarity's colour (200 ms), and the item pops in face down, as the item board shows items, with the caption `Forged into a Rare. Identify it.` and focus on it. A click, `Enter` or `Space` on it turns it over through the item board's own turn, so it plays exactly as a turn from the board does: the item lifts from the entry, flips, bursts out with its caption and goes into its plate on `Hoggies`, with any medal beat after. `Esc` sets it aside: the entry keeps no face-down item and the item waits on the item board. While a hoggie's entry is open the item board does not open over it, so an item set aside waits on the board until the entry closes, then shows as the board would, behind its pill after Later or a turn that left it closed (every turn with reduced motion, and a turn with motion once nothing waits), and while the face-down item waits the entry behind it is inert, so no second forge or close slips through. A forged item turned on the item board leaves no face-down item in its entry. With reduced motion the face-down item and its caption show at once, and its turn lands with no movement.
- **HF10 Busy and failure.** The button reads `Forging…` while the forge is sent and takes no second press. A refusal says `Coffee Cup couldn't be forged. Reload the page to see where it stands.`, and an unreachable server says `Couldn't reach HedgeHug. Try again.`, as the pet pick does.

### Flag and analytics

- **HF11 The flag.** Everything in HF6–HF10 is behind `hoggie-forge`, a new sandbox-only flag in project 662840, created with one condition, `environment = sandbox` at 100%, read for the member without an exposure as `pet-hoggie` is, and needs `hidden-items` on too, as the forge ends on an item. While either is off the entry shows no forge and `forgeHoggie` refuses. A forge made while they were on stays: the copies it spent stay spent, and its item waits on the board or its hoggie stays held.
- **HF12 Analytics.** A forge is a `hoggie dropped` event with `crate_kind = forge`, through the existing projection. No new event.

## Testing Decisions

- **A good test** drives the product from the outside: a signed-in website session's calls go in, and what the member sees comes out (`getAlbumHoggies`, `getAlbum`, the forge's answer, the PostHog capture). It never reads a table to prove what the member could observe.
- **Seam 1: the backend.** One convex-test backend per test, with a signed-in session (`testing/website.ts`), hoggies seeded with `holds` (`testing/hoggies.ts`) and flags from the fake PostHog, calling `forgeHoggie` and `turnItem` and reading `getAlbumHoggies` and `getAlbum`'s item board. The pick is pinned by leaving exactly one hoggie of the next rarity unheld. A forge sent twice with one request stands in for a lost answer. Prior art: `convex/website/petHoggie.test.ts`.
- **Seam 2: the website shell.** The album shell with fixture reads under Testing Library and jsdom, with a fake clock for the sequence, asserting the entry's forge line, the calls made, the face-down item and the turn it starts. Prior art: the pet-hoggie block of `website/src/album/hoggies.test.tsx`.
- **The flag's two directions.** One test with `hoggie-forge` off shows the entry and `forgeHoggie` as before the forge shipped.
- **Timing and look are a proof, not a test.** The sequence and the reduced-motion path are proven in the sandbox browser with a capture.

## Out of Scope

- Choosing the forged hoggie, forging several at once, climbing two rarities at once, and forging a legendary.
- A forge marker on the plates of the `Hoggies` grid; the entry is the one place the forge lives.
- A crest line in the forge's sequence, and any new crest surface on the website (HF5).
- Any Slack surface for the forge, and the share of a forged epic or legendary (LP51 covers turns only).
- Undoing a forge.

## Further Notes

- **Choices the product owner made:** four copies, three spent, one kept; no forge at legendary; a random pick among the hoggies not held. On 2026-10-22 they replaced two: the forge ends on a face-down item turned like every item, where it first revealed the hoggie at once on the `Hoggies` page, and a fully held next rarity gives a second copy, where it first refused the forge.
- **Complexity.** The spec pass (GPT-6.1 Sol, 2026-10-21) kept every concept the spec adds and found four gaps, now in the rules: a lost answer could forge twice (HF6, HF7), the entry needed the flag in its answer (HF8), the crest promise named a surface the album lacks (HF5, Out of Scope), and a tier a forge reaches stays held under `hidden-items` (HF5). For that last one the pass proposed unlocking the tier inside the forge; the spec kept LP14's rule, because an unlock inside the forge would mark the emoji seen with no beat. Since the forge ends on an item, the tier unlocks at that item's turn, with its beat, which is LP14's rule itself.
