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
