# Spec: the hoggie forge

> **Settled with the product owner on 2026-10-21** in the thread of the core-loop demo task (Silthus/personal#102, map Silthus/personal#95). It is a side feature: it does not block the demo. Rules are cited as `HF1`–`HF12`.

## Problem Statement

A member who keeps thanking teammates keeps finding hoggies they already hold. A fourth Coffee Cup is a number on a plate, `×4`, and nothing more: a duplicate never moves the member closer to the hoggies they are missing, so the more a member gives, the less each find means.

## Solution

**Four of a kind forge into one you don't have.** A member holding four or more copies of a hoggie can forge three of them, in their field guide entry on the `Hoggies` page, into a hoggie one rarity up that they do not own yet. They keep one copy, so they never lose the hoggie itself. Three copies fly together, fuse, and the new hoggie bursts out in its rarity's colour.

## User Stories

1. As a member with four or more copies of a hoggie, I want to forge three of them into a hoggie one rarity up, so that my duplicates bring me closer to a full collection.
2. As a member, I want to keep one copy of the hoggie I forge from, so that forging never costs me a hoggie, a crest or my pet.
3. As a member, I want the forged hoggie to be one I don't own yet, so that every forge is a new find.
4. As a member, I want the forge to play as its own short animation, so that it feels like a reward and not a form.
5. As a member who prefers reduced motion, I want the forge's result at once, with no movement.
6. As a member with fewer than four copies, I want the entry to tell me what four copies would forge into, so that I know the forge exists.
7. As a member who owns every hoggie one rarity up, or who holds a legendary, I want no forge button, so that I never press something that cannot keep its promise.
8. As a member, I want a forged hoggie to count like any other find on Milestones, in team crests and in Activity, so that it is a real part of my collection.
9. As the product owner, I want every forge recorded in PostHog, so that I can see whether duplicates get used.
10. As the product owner, I want the forge dark behind its own flag, so that I can turn it off without losing anything.

## Implementation Decisions

### Vocabulary

- **HF1 The lexicon.** **hoggie forge** joins `lexicon.json` as a concept: a member's spend of three spare copies of one hoggie for a hoggie one rarity up that they do not own yet. It is named hoggie forge, not forge, because a forged request is the security sense. **spare** joins it as a property of hoggie: every copy of a hoggie past the first a member holds. Spares already exist in `getAlbumHoggies` (`spares`, `convex/album/hoggies.ts`).

### What a forge takes and gives

- **HF2 It takes three spares.** A member may forge a hoggie while they hold at least three spares of it (four copies). The forge lowers that hoggie's copies by exactly three, so its tally never falls below one and every reader of "holds this hoggie" (pets, crests, Milestones, the avatar) sees no change. A hoggie's tally count therefore means the copies a member holds now, no longer every find ever.
- **HF3 It gives one rarity up, never owned.** The forged hoggie has the rarity directly above the spent hoggie's (common → uncommon → rare → epic → legendary) and is one the member holds no copy of. A legendary is never forged. When the member holds every hoggie of the next rarity, the forge is refused.
- **HF4 The pick.** Among the hoggies of the next rarity the member does not hold, in catalogue order, the forge picks one uniformly by the first 4 bytes of SHA-256 of `{secret}:{member}:{crate}:{version}`, with the deployment's `HOGGIE_DRAW_SECRET` and the forge's crate key (HF5), so a forge sent again picks the same hoggie. The member never chooses.
- **HF5 It is a find.** The forge records the forged hoggie through the existing find path of `convex/hoggies`: a drop row with crate key `forge:<request>` (HF7), and a new crate kind `forge` with no pack band, so it pays no XP and no coins. Its copy is 1, so it can complete a team crest, and it publishes `hoggieDropped`. The existing milestone subscriber records any tier it reaches, Activity lists it as a find, and App Home's last find can name it. A crest it completes is recorded as for any find; the website shows no new crest surface for it. With `hidden-items` on, a milestone tier it reaches is held like every tier earned away from the item board and plays at the member's next turn (LP14).
- **HF6 One mutation.** `forgeHoggie({ hoggie, request })` is a public website mutation for the signed-in member. It spends, picks and records in one transaction and answers the forged hoggie's face (`Drop`). A request it has already forged answers that forge's face again and spends nothing. It answers `refused` when the flag, the album or the collection is off for the member, when the request is not 1 to 64 letters, digits, dashes or underscores, when the name is no catalogue hoggie, when the member holds fewer than three spares of it, when it is legendary, or when no hoggie one rarity up is left to find. A refusal writes nothing.
- **HF7 Sent once, keyed by its request.** The website sends `forgeHoggie` through the HTTP path (`useSentOnce`), as `makePet` does, so a reconnect never replays a forge. Each forge the member means gets a new request ID (`crypto.randomUUID()`), kept while its answer is unknown: `Forge` pressed again after an unreachable server sends the same request, so a forge that committed before its answer was lost is never made twice. The reactive read updates the copies.

### On the website

- **HF8 Where it shows.** In the field guide entry of a found hoggie, beside "Make my pet":
  - with three or more spares and a hoggie left to find one rarity up: a button, `Forge 3 into a Rare`, with one line under it, `Keeps one Coffee Cup. Gives a Rare you don't have yet.`;
  - with fewer than three spares and a hoggie left to find one rarity up: one quiet line, `4 copies forge into a Rare you don't have yet.`;
  - with every hoggie one rarity up held: `You hold every Rare.`;
  - for a legendary: nothing.
  The rarity word is the catalogue's word for the next rarity. `getAlbumHoggies` carries `forge: true` only while `hoggie-forge` is on for the member and omits it otherwise; the entry derives the four cases from that field and the copies and rarities the answer already has, and the server decides again at the forge.
- **HF9 The forge's sequence.** Over the entry: three copies of the spent hoggie's art fly from the entry's art to the centre and fuse (600 ms), a white flash (200 ms), the forged hoggie bursts out in its rarity's colour and settles (700 ms), and the caption reads `Forged: Disco Hog · Rare · New`. A click anywhere, `Enter`, `Space` or `Esc`, or 2.5 s of rest, ends it, and the entry steps to the forged hoggie's own entry. With reduced motion the forged hoggie and its caption show at once, with no movement.
- **HF10 Busy and failure.** The button reads `Forging…` while the forge is sent and takes no second press. A refusal says `Coffee Cup couldn't be forged. Reload the page to see where it stands.`, and an unreachable server says `Couldn't reach HedgeHug. Try again.`, as the pet pick does.

### Flag and analytics

- **HF11 The flag.** Everything in HF6–HF10 is behind `hoggie-forge`, a new sandbox-only flag in project 662840, created with one condition, `environment = sandbox` at 100%, read for the member without an exposure as `pet-hoggie` is. While it is off the entry shows no forge and `forgeHoggie` refuses. A forge made while it was on stays: the copies it spent stay spent and the forged hoggie stays held.
- **HF12 Analytics.** A forge is a `hoggie dropped` event with `crate_kind = forge`, through the existing projection. No new event.

## Testing Decisions

- **A good test** drives the product from the outside: a signed-in website session's calls go in, and what the member sees comes out (`getAlbumHoggies`, `getAlbum`, the forge's answer, the PostHog capture). It never reads a table to prove what the member could observe.
- **Seam 1: the backend.** One convex-test backend per test, with a signed-in session (`testing/website.ts`), hoggies seeded with `holds` (`testing/hoggies.ts`) and flags from the fake PostHog, calling `forgeHoggie` and reading `getAlbumHoggies`. The pick is pinned by leaving exactly one hoggie of the next rarity unheld. A forge sent twice with one request stands in for a lost answer. Prior art: `convex/website/petHoggie.test.ts`.
- **Seam 2: the website shell.** The album shell with fixture reads under Testing Library and jsdom, with a fake clock for the sequence, asserting the entry's forge line, the call made and the reveal. Prior art: the pet-hoggie block of `website/src/album/hoggies.test.tsx`.
- **The flag's two directions.** One test with `hoggie-forge` off shows the entry and `forgeHoggie` as before the forge shipped.
- **Timing and look are a proof, not a test.** The sequence and the reduced-motion path are proven in the sandbox browser with a capture.

## Out of Scope

- Choosing the forged hoggie, forging several at once, forging into a duplicate, climbing past a fully held rarity, and forging a legendary.
- A forge marker on the plates of the `Hoggies` grid; the entry is the one place the forge lives.
- A crest line or a milestone beat in the forge's sequence, and any new crest surface on the website (HF5).
- Any Slack surface for the forge, and the share of a forged epic or legendary (LP51 covers turns only).
- Undoing a forge.

## Further Notes

- **Choices the product owner made:** four copies, three spent, one kept; the reveal on the `Hoggies` page rather than a face-down item; no forge at legendary or when the next rarity is fully held; a random pick among the hoggies not held.
- **Complexity.** The spec pass (GPT-6.1 Sol, 2026-10-21) kept every concept the spec adds and found four gaps, now in the rules: a lost answer could forge twice (HF6, HF7), the entry needed the flag in its answer (HF8), the crest promise named a surface the album lacks (HF5, Out of Scope), and a tier a forge reaches stays held under `hidden-items` (HF5). For that last one the pass proposed unlocking the tier inside the forge; the spec keeps LP14's rule instead, because an unlock inside the forge would mark the emoji seen with no beat, and LP14 plays every unlock once, where the member sees it.
