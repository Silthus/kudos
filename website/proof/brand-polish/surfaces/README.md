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

## Review

[review-gpt-6.1-sol.md](review-gpt-6.1-sol.md): GPT-6.1 Sol, round 1, no high findings.

1. Card borders measure 1.79:1 light and 1.51:1 dark against their card, under V24's 3:1 for borders. **Rejected as a regression, accepted as a wording fix**: posthog.com's own border is this value, Quill's border before this PR measured about 1.3:1, and WCAG 1.4.11 asks 3:1 only of a boundary that alone identifies a control. V24 now says so: a card's or separator's border is decorative; a control's border, ring or icon keeps 3:1, and the switch, outline and ring tests that measure those still pass.
2. `medalMetals.test.tsx` read Quill's `oklch` card and muted lightness instead of the website's overrides. **Fixed**: both medal checks resolve through `themeContrast.ts` now, and the gap line in the PR body is closed.
