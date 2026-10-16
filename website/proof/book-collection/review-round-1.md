1. **must-fix — [App.tsx:293](/home/coder/dev/kudos-wt/book-collection/website/src/App.tsx:293): Collection’s answer is overridden.** When `getCollection` says `not-found` but `getBook` says locked or ready, `/book/collection` shows the Book’s waiting page, including its actionable crate. **CL15, CL18 and Website.spec.md** require not-found while collection is off. Handle collection’s loading, not-found, waiting and denial answers before requiring the successful Book payload.

2. **must-fix — [useFreshKeys.ts:6](/home/coder/dev/kudos-wt/book-collection/website/src/book/useFreshKeys.ts:6): Live arrivals lose “New” permanently.** The fresh set is captured only on mount, but the effect marks later keys seen. A hoggie arriving while Collection remains mounted never gets its badge, even after revisiting. This violates **Website.spec.md’s New-until-shown requirement**, supported by **CL15’s `seen` key**. Capture unseen incoming keys before persisting them, preserving freshness across rerenders and StrictMode effect replay.

3. **must-fix — [CollectionTile.tsx:25](/home/coder/dev/kudos-wt/book-collection/website/src/book/CollectionTile.tsx:25): Rarity counters rely on colour alone.** The breakdown shows coloured squares and fractions without rarity words; `aria-hidden` also removes it from accessible content. **CL3, V3 and V24** require square plus word. Use `rarityWordsOf` and expose the breakdown through accessible text or a description.

4. **should-fix — [index.css:56](/home/coder/dev/kudos-wt/book-collection/website/src/index.css:56): The reveal uses a competing rarity palette.** These new theme tokens coexist with hardcoded `.moment-scrim` overrides in `crates/crates.css:157`. Legendary, for example, changes from `#c2410c` in the light Book to `#ff8000` during reveal. **V3** requires one shared rarity palette with light and dark values. Consolidate the definitions across collection, activity and reveal.

5. **should-fix — [HoggieTile.tsx:15](/home/coder/dev/kudos-wt/book-collection/website/src/book/HoggieTile.tsx:15): First-found dates are unavailable visually.** Every individual date is `sr-only`, and tiles offer no details interaction. Sighted members cannot inspect their collection history, contrary to **collection user story 14**. Show the date visibly or provide an accessible details interaction.

No tests, typechecks or builds run, as requested.

fix first
84,385
1. **must-fix — [App.tsx:293](/home/coder/dev/kudos-wt/book-collection/website/src/App.tsx:293): Collection’s answer is overridden.** When `getCollection` says `not-found` but `getBook` says locked or ready, `/book/collection` shows the Book’s waiting page, including its actionable crate. **CL15, CL18 and Website.spec.md** require not-found while collection is off. Handle collection’s loading, not-found, waiting and denial answers before requiring the successful Book payload.

2. **must-fix — [useFreshKeys.ts:6](/home/coder/dev/kudos-wt/book-collection/website/src/book/useFreshKeys.ts:6): Live arrivals lose “New” permanently.** The fresh set is captured only on mount, but the effect marks later keys seen. A hoggie arriving while Collection remains mounted never gets its badge, even after revisiting. This violates **Website.spec.md’s New-until-shown requirement**, supported by **CL15’s `seen` key**. Capture unseen incoming keys before persisting them, preserving freshness across rerenders and StrictMode effect replay.

3. **must-fix — [CollectionTile.tsx:25](/home/coder/dev/kudos-wt/book-collection/website/src/book/CollectionTile.tsx:25): Rarity counters rely on colour alone.** The breakdown shows coloured squares and fractions without rarity words; `aria-hidden` also removes it from accessible content. **CL3, V3 and V24** require square plus word. Use `rarityWordsOf` and expose the breakdown through accessible text or a description.

4. **should-fix — [index.css:56](/home/coder/dev/kudos-wt/book-collection/website/src/index.css:56): The reveal uses a competing rarity palette.** These new theme tokens coexist with hardcoded `.moment-scrim` overrides in `crates/crates.css:157`. Legendary, for example, changes from `#c2410c` in the light Book to `#ff8000` during reveal. **V3** requires one shared rarity palette with light and dark values. Consolidate the definitions across collection, activity and reveal.

5. **should-fix — [HoggieTile.tsx:15](/home/coder/dev/kudos-wt/book-collection/website/src/book/HoggieTile.tsx:15): First-found dates are unavailable visually.** Every individual date is `sr-only`, and tiles offer no details interaction. Sighted members cannot inspect their collection history, contrary to **collection user story 14**. Show the date visibly or provide an accessible details interaction.

No tests, typechecks or builds run, as requested.

fix first
