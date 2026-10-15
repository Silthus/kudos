# #453 PR 2: posthog.com's surfaces

Audit item 2 of [`../audit/README.md`](../audit/README.md).

## Tests

- [red.txt](red.txt): `brandSurfaces.test.tsx` on the tree before the change: the ten surface tokens fail (they resolve to Quill's `oklch(…)` values) and the flat-canvas check fails; the five V24 contrast guards pass on both trees, which is their job.
- [green.txt](green.txt): the same file passing, beside every test that measures contrast through `themeContrast.ts` (`levelContrast`, `claimedCardContrast`, `featureGates`, `BookPage`, `inventory`, `laterPerkRows`, `compactSkillTree`, `palette`, `medalMetals`). The first run's two `featureGates` failures were 5 s timeouts while three builds ran; the file passes alone.

The dark `--muted-foreground` moved to posthog.com's secondary text (`#AEB3C4`) because the equipped inventory tile's slot number measured 4.35:1 on the new, lighter dark card with Quill's grey; it now clears 4.5:1.

## In the browser

Chromium through the T3 preview, the `member-with-every-feature-open` fixture build on `vite preview`, dark: `body` computes to `rgb(30, 31, 35)`, a card to `rgb(37, 38, 43)` with a `rgb(62, 66, 79)` border, secondary text to `rgb(174, 179, 196)`, and `.hud-root` has no background image.

| | Before (PR 1) | After |
|---|---|---|
| Home, 1280, light | [before](before-home-1280-light.png) | [after](after-home-1280-light.png) |
| Home, 1280, dark | [before](before-home-1280-dark.png) | [after](after-home-1280-dark.png) |
| Leaderboard, 390, light | [before](before-leaderboard-390-light.png) | [after](after-leaderboard-390-light.png) |
| Leaderboard, 390, dark | [before](before-leaderboard-390-dark.png) | [after](after-leaderboard-390-dark.png) |
