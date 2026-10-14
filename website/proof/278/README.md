# #278: spending skill points from the hero (WS313)

Screenshots come from the fixture build. `VITE_SHELL_FIXTURE=member-level-7-with-one-skill-point` is a level 7 member with the Skill tree open and 1 skill point. `member-with-every-feature-open` has 2 points. Variant E is the accepted prototype at `3409ade`, at preview level 7 (`?v=e&lvl=7`), where it holds 2 points.

| | Branch | Variant E |
|---|---|---|
| Light, 1280 px | [home-level7-one-point-light.png](home-level7-one-point-light.png), [home-two-points-light.png](home-two-points-light.png) | [variant-e-level7-light.png](variant-e-level7-light.png) |
| Dark, 1280 px | [home-level7-one-point-dark.png](home-level7-one-point-dark.png) | [variant-e-level7-dark.png](variant-e-level7-dark.png) |
| Light, 390 px | [home-level7-one-point-390-light.png](home-level7-one-point-390-light.png) | |
| Dark, 390 px | [home-level7-one-point-390-dark.png](home-level7-one-point-390-dark.png) | |

The link has E's shape: an outline control with the skill point glyph, after the lifetime line under the allowance row, 165 × 28 px for `Spend 2 skill points` in both. At 390 px the page is 390 px wide (`scrollWidth` 390), and the link is centred like the rest of the hero.

## Tests

- [red.txt](red.txt): the final tests run against `main`'s `Hero.tsx`. Six fail: the link for 1 and 2 points, the one-primary check, following the link, and the glyph's contrast in light and dark.
- [green.txt](green.txt): the same tests on this branch, all passing.
- [gate.txt](gate.txt): `pnpm gate` under `fleet heavy`.

## V24 manual pass

- **Focus order:** the hero's `Thank someone in Slack`, then `Spend 1 skill point`, then Max's line and the panels. The link shows `:focus-visible` with quill's focus ring ([focus-spend-light.png](focus-spend-light.png)).
- **Screen reader:** a link named `Spend 1 skill point` (or `Spend {n} skill points`). The glyph is `aria-hidden`.
- **Reduced motion:** the change adds no motion. The header chip stays the target of the reward flight.
- **Contrast:** axe passes in light and dark for `home with every shipped feature open`, which shows the link. A token test measures the glyph (`completed-foreground`) at 3:1 or more against the page background and `muted`, which the outline's fill mixes from. The outline's border is quill's stock outline, the same as the hero's outline Slack link, and the control's text identifies it.
