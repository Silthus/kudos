# #269: the HUD nav, as in variant E (WS301–WS304)

## Tests

- [red.txt](red.txt): `navEntriesOf` before `nav/entries.ts` existed, and the HUD's `App` tests on `d0abca6` (16 of 17 failing; the one passing holds trivially before the change: no pop-in on a reload).
- [green.txt](green.txt): the same tests passing, every assertion intact, with the review rounds' tests added.
- [gate.txt](gate.txt): `pnpm gate` through `fleet heavy` on the landed tree.

## Width proof (WS300 with WS301's entries)

Chromium (T3 preview), the fixture build in `fixture/` with `?six=1&path=/quests`. Six nav entries: Profile, Quests (open, current), Leaderboard (ready crate), Book (locked, the next unlock, with `Lv 4`), Skill tree (locked), and Collection (a DOM clone of a locked entry, standing in for a future page). The bar also carries the skill point chip, the ready pill, the avatar at level 3, the theme control and `Sign out`.

| Viewport | `document.documentElement.scrollWidth` | Header |
|---|---|---|
| 320 px | 320 | 101 px: bar plus rail |
| 390 px | 390 | 101 px: bar plus rail |
| 640 px | 640 | 101 px: bar plus rail |
| 1024 px | 1024 | 57 px, one row; all six labels visually hidden (icon-only, `lg` to `xl`) |
| 1440 px | 1440 | 57 px, one row; all six labels shown |

The rail's 6 px top padding (Fable finding 3) keeps the ready glow and focus rings inside the rail's scroll box.

## Pop-in (WS304) in a real browser

On `/quests`, clicking the nav's `Leaderboard: unlock ready. Open its crate` sent `openFeature`. The reveal opened (`Level 3 unlock`), and once the fixture's member showed Leaderboard open, its new nav link carried `nav-pop`, with the computed `animation-name` `nav-pop`. A reload shows the link without it (unit tests cover reload and reduced motion).

## V24 manual pass

- **Focus on the ready crate** keeps its glow and adds a 2 px outline in the ring colour (computed: `outline: solid 2px`, the 16 px glow still in `box-shadow`): [dark, 1440 px](branch-1440-dark-ready-focus.png).
- **Focus order** (Tab through the bar on `/quests` at 1440 px): Leaderboard's crate, Book (locked), Skill tree (locked), `2 skill points to spend`, `2 ready`, `Sam Example, level 3`, the three theme buttons, `Sign out`, then the page's `Open`. Every stop matched `:focus-visible`. Keyboard focus on a nav entry opens its tooltip.
- **Screen-reader wording:** `Profile`; `Quests`; `Leaderboard: unlock ready. Open its crate`; `Book, locked. Unlocks at level 4` (a link marked disabled, with no `href`); `Sam Example, level 3`, described as `Level 3, 90 XP to level 4`; `Sign out`.
- **Reduced motion:** the pop-in, the crate token's entrance and its shimmer play only under `prefers-reduced-motion: no-preference`; the pop-in class is never set under `reduce` (tested).

## Reviews

**GPT-6.1 Sol, round 1** ([review-sol.md](review-sol.md)), on the diff with the spec as the oracle: no high findings.
1. The ready token lost its focus ring under its glow. **Fixed**: an explicit focus-visible outline (`nav.css`).
2. Later locked entries at 55% failed 4.5:1. **Fixed**: every locked entry uses `text-muted-foreground`; the contrast test now measures the later lock too.
3. A pending nav open kept inviting a click. **Fixed**: `Opening…`, `{name}: opening its crate`, `aria-disabled`, one send (tested with a deferred answer).
4. A failed open of a later crate had no visible message. **Fixed**: the bar shows the first failed attempt among crates not shown on the page (tested for refused and unreachable).
5. The pop-in replayed after the HUD remounted. **Fixed**: the pop-in is consumed on its own `animationend` (tested through a lost connection).
6. The rail didn't scroll an entry into view when it turned open on its page. **Fixed**: the effect follows the current entry's existence (tested).
7. Low: the motion tests check a class, not an animation. **Partly rejected**: jsdom has no animation engine; the browser check above reads the computed `animation-name`, and finding 5's test now drives `animationend`.

**Fable 5.1 design spot check**, on the screenshots: all six held and are fixed.
1. Tooltips stack their two lines (`flex-col items-start`).
2. The next unlock gets E's dashed outline again, in `border-muted-foreground` (3:1, tested), now that every locked entry shares one colour.
3. The rail has top padding, so the glow and focus rings aren't clipped.
4. The ready token's focus outline no longer replaces its glow (its shape drops `focus-visible:ring`).
5. `Sign out` is `size="icon"`, matching the chips' height.
6. Rail entries use 14 px icons and `font-medium` on the current entry only, as E's do.

## Screenshots

- This branch at 390 px: [light](branch-390-light.png), [dark](branch-390-dark.png)
- This branch at 1440 px: [light](branch-1440-light.png)
- This branch at 1024 px, icon-only, with the next unlock's tooltip: [dark](branch-1024-dark-next-unlock-tooltip.png)
- This branch at 1440 px, the ready crate with keyboard focus: [dark](branch-1440-dark-ready-focus.png)
- Variant E at level 3, 390 px: [light](variant-e-level-3-390-light.png). At level 4, 1440 px: [light](variant-e-level-4-1440-light.png)

E's rail shows `Lv` on every locked entry; WS301 keeps it on the next unlock only.

## Reproduce

Copy `fixture/proof-fixture.tsx`, `fixture/proof-fixture.html` and `fixture/proof.vite.config.ts` into `website/`, run `pnpm --dir website exec vite build --config proof.vite.config.ts --outDir <dir>`, serve `<dir>`, and open `/proof-fixture.html?six=1&path=/quests`. `state=open` shows every page open.
