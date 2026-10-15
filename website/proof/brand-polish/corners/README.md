# #453 PR 4: corner marks stay on their panel

Found while reviewing the locked, ready and earned pages after PR 3: each page's `hud-panel` section had no `position`, so its bottom-right corner mark (`.hud-panel::after`) resolved against the viewport and floated at the bottom-right of the window (visible in the audit's `locked-1280-*.png`, `ready-1280-*.png` and `book-earned-1280-*.png` too, so it predates this lane). V2 says corner marks frame game objects; a mark on the window frames nothing.

## Tests

- [red.txt](red.txt): `hudPanelCorners.test.tsx` on the tree before the change: `.hud-panel` has no rule of its own, so nothing positions it.
- [green.txt](green.txt): the rule `position: relative` exists, beside the feature gate and panel suites (94 tests).

## In the browser

| | Before (PR 3) | After |
|---|---|---|
| Locked Book, 1280, light | [before](before-locked-1280-light.png) (mark at the window's corner) | [after](after-locked-1280-light.png) (marks on the card) |
| Ready skill tree, 1280, dark | [before](before-ready-1280-dark.png) | [after](after-ready-1280-dark.png) |

## Review

[review-gpt-6.1-sol.md](review-gpt-6.1-sol.md): GPT-6.1 Sol, round 1, no high findings; all three fixed.

1. The unlayered rule beat Tailwind's `lg:sticky` on the perk details. **Fixed**: the rule sits in `@layer components`, so positioning utilities win; the test pins the layer.
2. The top-left mark sat under the ready page's opaque night band and the earned page's lemon band. **Fixed**: the marks carry `z-index: 1`; the test pins it.
3. The test's title claimed behaviour it can't see. **Fixed**: it is titled as the declaration check it is, and the screenshots carry the behaviour.

After the review fixes, on the rebuilt `member-with-every-feature-open` build at 1280 px: the perk details section computes to `position: sticky; top: 96px` (the utility wins over the layered rule), every `hud-panel` computes to `relative` or `sticky` with its `::before` at `z-index: 1`, and the ready page's night band shows both marks ([after-ready-1280-dark.png](after-ready-1280-dark.png), reshot).
