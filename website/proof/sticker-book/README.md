# Proof: stickers and group albums on the Collection page (#555)

The product owner's direction (map #1, decision 27, "It's both"): the Book holds hoggies and crests, plus stickers of the teammates you thank, collected into albums per Slack group. Map #1's ship #550 (PR #574) made `getCollection` answer `stickers` and `albums` behind `sticker-book`. This ticket builds the website's side on `main`.

**The sections.** `/book/collection` is four in-page sections, each shown only while the answer carries it: Hoggies (`#hoggies`, the rarities inside it), Team crests (`#team-crests`), Stickers (`#stickers`) and Group albums (`#group-albums`). A jump list under the title links to each, and appears once the page has two or more sections.

**Stickers.** One tile per teammate, newest first: their face as a die-cut sticker, their name, the day you first swapped thanks, and `New` until this browser has shown it. A former teammate keeps their sticker with a greyscale face, a muted name, and the line "Former teammate"; one the directory no longer names reads "A teammate" with the nameless face. The summary card adds "{n} stickers of teammates".

**Group albums.** One card per Slack group, the member's own groups first (tagged "Your group"), with `held of total`, a quiet bar, and its people: held ones as their sticker's face, missing ones as silhouettes, each named on hover. Screen readers get "Everyone here: …", or "Held: …. Still missing: ….". An empty group says "No one else in this group yet."

**Naming.** Crests stay PostHog teams of hoggies; albums are Slack groups of people. A test pins that the albums section never says team or crest and the crests section's copy never says group or album.

## Tests

- `red.txt`: `stickerBook.test.tsx` and `CollectionPage.test.tsx` on `main` before the change: 13 failing.
- `green.txt`: the same files after: 40 of 40.
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on the landed tree.

Seams: `stickerBook.test.tsx` (the Stickers section and its order, a sticker's face, name and date, `New`, former teammates, the flag-off answer naming nothing; the albums' order and counts, held faces and silhouettes with the spoken roster, the empty group, stickers without albums, SB13's naming; the Hoggies section, the jump list and its anchors), `CollectionPage.test.tsx` (the crests now follow the hoggies).

## Running app

A fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`, made-up teammates and groups in `stickerBookFixtures.ts`) served with `vite preview` and shot with T3's preview browser.

| What | File |
|---|---|
| The top of the page, light, 1280 px: the jump list under the title, the summary with "12 stickers of teammates", the Hoggies section | `1-collection-top-jump-list-1280-light.png` |
| Stickers and Group albums on a first visit: every sticker tagged New | `2-stickers-and-albums-first-visit-1280-light.png` |
| The same once this browser has seen all but Noor's, light | `3-stickers-and-albums-1280-light.png` |
| The same in dark | `4-stickers-and-albums-1280-dark.png` |
| The same at 390 px: three stickers a row, albums stacked, the jump list wrapping | `5-stickers-and-albums-390-light.png` |

## Calls

- Hoggies before Team crests, mirroring Stickers before Group albums: the pieces, then the sets they complete.
- The jump list appears with two or more sections, as plain fragment links with a scroll margin for the sticky header.
- A former teammate's sticker stays, dimmed, with the directory's name or "A teammate".
- An album's people are an aria-hidden row of faces and silhouettes with one spoken sentence, as the crest tile's roster.
- The fixture build's Collection carries the sticker book for every member fixture.
