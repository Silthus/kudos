# Proof: stickers and group albums on the Collection page (#555)

The product owner's direction (map #1, decision 27, "It's both"): the Book holds hoggies and crests, plus stickers of the teammates you thank, collected into albums per Slack group. Map #1's ship #550 (PR #574) made `getCollection` answer `stickers` and `albums` behind `sticker-book`. This ticket builds the website's side on `main`.

**The sections.** `/book/collection` is four in-page sections, each shown only while the answer carries it: Hoggies (`#hoggies`, the rarities inside it), Team crests (`#team-crests`), Stickers (`#stickers`) and Group albums (`#group-albums`). A jump list under the title links to each, and appears once the page has two or more sections.

**Stickers.** One tile per teammate, newest first: their face as a die-cut sticker, their name, the day you first swapped thanks, and `New` until this browser has shown it. A former teammate keeps their sticker with a greyscale face, a muted name, and the line "Former teammate"; one the directory no longer names reads "A teammate" with the nameless face. The summary card adds "{n} stickers of teammates".

**Group albums.** One card per Slack group, the member's own groups first (tagged "Your group"), with `held of total`, a quiet bar, its people as a row of sticker faces and silhouettes, and one visible sentence naming them: "Everyone here: …", or "Held: …. Still missing: ….", so a touch or screen-reader user knows whom to thank. An empty group says "No one else in this group yet."

**No stickers yet.** While the sticker book is on but the member holds none, the Stickers section is one calm card: a hedgehog, Max's line "No stickers yet. Thank a teammate in Slack, or get thanked, and their sticker lands here." and one action, "Thank someone in Slack" (V23). The albums below show every person as a silhouette.

**Naming.** Crests stay PostHog teams of hoggies; albums are Slack groups of people. A test pins that the albums section never says team or crest and the crests section's copy never says group or album.

## Tests

- `red.txt`: `stickerBook.test.tsx` and `CollectionPage.test.tsx` on `main` before the change: 13 failing.
- `green.txt`: the same files after: 40 of 40 (41 after the review round, with the empty state).
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on the landed tree.

Seams: `stickerBook.test.tsx` (the Stickers section and its order, a sticker's face, name and date, `New`, former teammates, the empty state with and without albums, the flag-off answer naming nothing; the albums' order and counts, held faces and silhouettes with the visible roster sentence outside any `aria-hidden` ancestor, the empty group, stickers without albums, SB13's naming; the Hoggies section, the jump list and its anchors), `CollectionPage.test.tsx` (the crests now follow the hoggies), `accessibility.test.tsx` (axe in light and dark over the page with the sticker book, and with it open but empty).

## Running app

A fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`, made-up teammates and groups in `stickerBookFixtures.ts`: drawn faces as Slack photos, drawn cutouts on their own colour as company profiles, and initials) served with `vite preview` and shot with T3's preview browser. The empty-state shot is a second build of the same tree with the fixture answer swapped for `withNoStickersYet`.

| What | File |
|---|---|
| The top of the page, light, 1280 px: the jump list under the title, the summary with "12 stickers of teammates", the Hoggies section | `1-collection-top-jump-list-1280-light.png` |
| Stickers and Group albums on a first visit: every sticker tagged New | `2-stickers-and-albums-first-visit-1280-light.png` |
| The same once this browser has seen all but Noor's, light | `3-stickers-and-albums-1280-light.png` |
| The same in dark | `4-stickers-and-albums-1280-dark.png` |
| The same at 390 px: three stickers a row, albums stacked, the jump list wrapping | `5-stickers-and-albums-390-light.png` |
| The sticker book on with no stickers yet: the empty card with Max's line and the Slack action, every album person a silhouette | `6-no-stickers-yet-1280-light.png` |

## Review

`review-round-1.md`: GPT-6.1 Sol (high, `codex exec --sandbox read-only`) over the diff against `main` with the ticket, SB1–SB17, the visual language and the agent instructions as the oracle. Five findings.

1. **Taken.** Album people were named only on hover: the roster sentence is now visible text under the faces, and the test asserts it sits outside any `aria-hidden` ancestor.
2. **Taken, in two steps.** First the fragment offset grew to 112 px; the final read held that a header carrying the ready-pill failure notice still grows past it. Now the HUD measures itself: `useMeasuredHudHeight` (`hudHeight.ts`) observes the sticky header and publishes `--hud-height`, and every section's scroll margin is that height plus 1 rem. A test stubs the observer, grows the header to 140 px and reads the variable and the margin back. The Book index's `top-24` still assumes 96 px; it overlaps a taller header by a few pixels and is a follow-up.
3. **Taken.** `stickers: []` is now a V23 empty state: one hedgehog, Max's line, one Slack action, tested with and without albums.
4. **Taken.** The roster assertion checks for a hidden ancestor, and the axe matrix gains the page with the sticker book and the page with it open but empty, in light and dark.
5. **Taken.** The fixtures carry drawn faces as Slack photos, drawn cutouts on their own colour as company profiles, and initials.

`review-final.md`: a second GPT-6.1 Sol read of the fixes with the round-1 findings as its checklist: 1, 3, 4 and 5 resolved, 2 partly, no new defects. Finding 2's remaining case is fixed as above.

`review-final-2.md`: a third read, of the measured header only: two minors, both taken. The hook's cleanup is unconditional (it removes `--hud-height` and disconnects the observer when there is one), and the test tracks disconnection, drives only the live observer, unmounts, and reads the variable back empty; a second test covers a browser without `ResizeObserver`.

## Calls

- Hoggies before Team crests, mirroring Stickers before Group albums: the pieces, then the sets they complete.
- The jump list appears with two or more sections, as plain fragment links; the sections' scroll margin follows the HUD's measured height.
- A former teammate's sticker stays, dimmed, with the directory's name or "A teammate".
- An album's people are an aria-hidden row of faces and silhouettes with one spoken sentence, as the crest tile's roster.
- The fixture build's Collection carries the sticker book for every member fixture.
