# #269: the HUD nav, as in variant E (WS301–WS304)

## Tests

- [red.txt](red.txt): `navEntriesOf` before `nav/entries.ts` existed, and the HUD's `App` tests on `d0abca6` (16 of 17 failing; the one passing holds trivially before the change: no pop-in on a reload).
- [green.txt](green.txt): the same 21 tests passing, every assertion intact.
- [gate.txt](gate.txt): `pnpm gate` through `fleet heavy` on the landed tree.

## Width proof (WS300 with WS301's entries)

Chromium (T3 preview), the fixture build in `fixture/` with `?six=1&path=/quests`. Six nav entries: Profile, Quests (open, current), Leaderboard (ready crate), Book (locked, the next unlock, with `Lv 4`), Skill tree (locked), and Collection (a DOM clone of a locked entry, standing in for a future page). The bar also carries the skill point chip, the ready pill, the avatar at level 3, the theme control and `Sign out`.

| Viewport | `document.documentElement.scrollWidth` | Header |
|---|---|---|
| 320 px | 320 | 93 px: bar plus rail |
| 390 px | 390 | 93 px: bar plus rail |
| 1024 px | 1024 | 57 px, one row; all six labels visually hidden (icon-only, `lg` to `xl`) |
| 1440 px | 1440 | 57 px, one row; all six labels shown |

## Pop-in (WS304) in a real browser

On `/quests`, clicking the nav's `Leaderboard: unlock ready. Open its crate` sent `openFeature`. The reveal opened (`Level 3 unlock`), and once the fixture's member showed Leaderboard open, its new nav link carried `nav-pop`, with the computed `animation-name` `nav-pop`. A reload shows the link without it (unit tests cover reload and reduced motion).

## V24 manual pass

- **Focus order** (Tab through the bar on `/quests` at 1440 px): Leaderboard's crate, Book (locked), Skill tree (locked), `2 skill points to spend`, `2 ready`, `Sam Example, level 3`, the three theme buttons, `Sign out`, then the page's `Open`. Every stop matched `:focus-visible`. Keyboard focus on a nav entry opens its tooltip.
- **Screen-reader wording:** `Profile`; `Quests`; `Leaderboard: unlock ready. Open its crate`; `Book, locked. Unlocks at level 4` (a link marked disabled, with no `href`); `Sam Example, level 3`, described as `Level 3, 90 XP to level 4`; `Sign out`.
- **Reduced motion:** the pop-in, the crate token's entrance and its shimmer play only under `prefers-reduced-motion: no-preference`; the pop-in class is never set under `reduce` (tested).

## Screenshots

- This branch at 390 px: [light](branch-390-light.png), [dark](branch-390-dark.png)
- This branch at 1440 px: [light](branch-1440-light.png)
- This branch at 1024 px, icon-only, with the next unlock's tooltip: [dark](branch-1024-dark-next-unlock-tooltip.png)
- Variant E at level 3, 390 px: [light](variant-e-level-3-390-light.png). At level 4, 1440 px: [light](variant-e-level-4-1440-light.png)

E's rail shows `Lv` on every locked entry; WS301 keeps it on the next unlock only.

## Reproduce

Copy `fixture/proof-fixture.tsx`, `fixture/proof-fixture.html` and `fixture/proof.vite.config.ts` into `website/`, run `pnpm --dir website exec vite build --config proof.vite.config.ts --outDir <dir>`, serve `<dir>`, and open `/proof-fixture.html?six=1&path=/quests`. `state=open` shows every page open.
