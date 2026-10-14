# #276: the locked and ready pages and a richer reveal

WS323–WS325 and WS339 of `spec/website-7.md`, from variant E's `unlock-gate.tsx` and `unlock-overlay.tsx`.

## Red and green

- `red.txt`: `website/src/featureGates.test.tsx` on the tests-only commit `47ce80f7`: 38 failing, 15 passing (the passing ones are D3's absences, the untouched quest reveal and contrast of tokens that already existed).
- `green.txt`: the same file after the change: 42 at the time, now 53 with the contrast and axe cases, all passing.

## Running app

The fixture build in `fixture/` (copy its three files into `website/`, run `pnpm --dir website exec vite build --config proof.vite.config.ts --outDir <dir>`, serve `<dir>`), in Chromium through the T3 preview.

| Shot | State |
| --- | --- |
| `1-locked-skill-tree-light.png`, `2-locked-skill-tree-dark.png` | `?state=locked&path=/skills`: the Skill tree's wizard in silhouette with the padlock, `Unlocks at level 5`, its sentence, `Back to your profile`. No climb, no levels to go (D3). |
| `3-ready-leaderboard-light.png`, `4-ready-leaderboard-dark.png` | `?state=ready&path=/leaderboard`: the night band in both modes, `Leaderboard is ready`, the sentence, the crate with its light edge and the primary `Open`. |
| `8-ready-book-390-dark.png` | The Book's ready band at 390 px. |
| `5-reveal-book-next-light.png`, `6-reveal-book-next-dark.png` | The Book's reveal end state from the home with all four crates ready: the checklist, `Go to Book` focused, `Open the next one · 3 more ready`. |
| `7-reveal-next-quests-dark.png` | After `Open the next one`: the button read `Opening…` with `aria-disabled` and kept focus, then the Quests reveal played and its end state focused `Go to Quests`, with `2 more ready`. |
| `e-locked-light.png`, `e-locked-dark.png` | Variant E's locked Skill tree, from the #259 audit, for comparison. E's blurred ghost, climb and levels to go are cut by D3. |
