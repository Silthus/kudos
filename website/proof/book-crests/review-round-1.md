- **should-fix — [website/src/activity/Entries.tsx:109](/home/coder/dev/kudos-wt/book-crests/website/src/activity/Entries.tsx:109):** Crest activity entries overflow at 390 px. The headline’s container retains `shrink-0`; adding “and completed Blitzscale” plus another 44 px image makes the row wider than the available space. Allow the text container to shrink with `min-w-0 flex-1` and wrap, keeping the art fixed.

- **should-fix — [website/src/book/CrestTile.tsx:17](/home/coder/dev/kudos-wt/book-crests/website/src/book/CrestTile.tsx:17):** Screen readers cannot identify held roster members. The entire roster is `aria-hidden`, while the spoken fallback names only missing hoggies. A collected crest exposes no roster names at all, contrary to V24’s equivalent-access requirement. Keep the art hidden, but provide text naming every roster member and whether it is held; verify partial and completed rosters through their accessible text.

Tests and builds were not run, as requested.

**FIX FIRST — 2 findings.**