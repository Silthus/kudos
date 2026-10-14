# #272: the open hero and the first-kudos nudge (WS311, WS312)

Screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-before-their-first-kudos`): a level 1 member who has given no kudos. Variant E is the accepted prototype at `3409ade`, at preview level 1 (`?v=e&lvl=1`), the same state.

| | Branch | Variant E |
|---|---|---|
| Light, 1280 px | [home-first-kudos-light.png](home-first-kudos-light.png) | [variant-e-level1-light.png](variant-e-level1-light.png) |
| Dark, 1280 px | [home-first-kudos-dark.png](home-first-kudos-dark.png) | [variant-e-level1-dark.png](variant-e-level1-dark.png) |
| Light, 390 px | [home-first-kudos-390-light.png](home-first-kudos-390-light.png) | [variant-e-level1-390-light.png](variant-e-level1-390-light.png) |
| Dark, 390 px | [home-first-kudos-390-dark.png](home-first-kudos-390-dark.png) | |

At 390 px the page is 390 px wide (`scrollWidth` 390), so nothing scrolls sideways.

## Tests

- [red.txt](red.txt): the final tests run against `main`'s source with this branch's tests and fixture. Five fail: the open hero, the nudge (twice), and the nudge's icon contrast in light and dark.
- [green.txt](green.txt): the same tests on this branch, all passing.
- [gate.txt](gate.txt): `pnpm gate` under `fleet heavy`, 163 files and 2,930 tests passing.

## V24 manual pass

- **Focus order:** header, then the hero's outline `Thank someone in Slack`, then the nudge's primary `Thank someone in Slack`, then the end of the page. Each shows `:focus-visible` with a visible ring ([focus-1-hero-outline-light.png](focus-1-hero-outline-light.png), [focus-2-nudge-primary-light.png](focus-2-nudge-primary-light.png)).
- **Screen reader:** the nudge is a region named by its heading, `Give your first kudos in Slack`. The message icon is `aria-hidden`. The link reads `Thank someone in Slack (opens in a new tab)`.
- **Reduced motion:** the change adds no motion.
- **Contrast:** axe passes in light and dark for the new home state. A token test measures the icon (foreground on muted) and its frame (muted-foreground on card) at 3:1 or more. The hero's ring, XP bar and pips are now measured against the page background, which is what they sit on without the card.
