# The Book's page index and category pages (#280)

WS331, WS332, WS339. Website only: `getBook`'s read is unchanged, so the screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`, now answered with every shipped ladder, Generosity at bronze) at 1440 × 1200 and 390 × 844, served by `vite preview` on 127.0.0.1:7612 and driven in the T3 preview browser. No backend, flag or cloud deployment was touched.

| Shot | What it shows |
|---|---|
| `1-overview-wide-light.png` | `/book?page=overview` canonicalised to `/book`: the Book pages column (Book icon, `Overview`, then `Achievements` with each category's emblem), `Overview` striped; every ladder in catalogue order below `Achievements`. |
| `2-giving-wide-light.png` | `/book?page=giving`: Giving striped, the plain header (`Achievements` label, `Giving`, its blurb), then Generosity, Dependability and Seasons. |
| `3-connections-wide-dark.png` | Connections in dark, blurb `The people you thank and old friends.` (E's album clause cut). |
| `4-connections-390-dark.png` | 390 px dark: the native `Book page` select in place of the column. |
| `5-crowd-390-light-after-select.png` | 390 px light after choosing `Crowd` in the select: `/book?page=crowd`, focus on the `Crowd` title, no blurb (E's is all chime-ins), Applause. `scrollWidth` 390, so no sideways scroll. |
| `6-focus-ring-wide-dark.png` | Keyboard focus on `Being thanked` after tabbing through the HUD: a 2 px ring in `--ring`, offset 2 px. |

E at the same state, for comparison: the #259 audit's [category pair](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/screenshots/compare-book-category-light.png) ([dark](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/screenshots/compare-book-category-dark.png)) and [overview pair](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/screenshots/compare-book-overview-light.png): the right half of each is E.

## Kept from E, and left out on purpose

- **Kept:** the sticky left index with the Book icon, `Overview`, the `Achievements` group label, the category emblems (E's Mailbox, Katy Perry, Coding Group and Party hedgehogs), the primary current-page stripe on the selected fill, the hover tilt of the emblem (no tilt under reduced motion), the native select with option groups below `lg`, the `Achievements` label above a category's title, and E's blurbs.
- **Left out:** per-entry counts and bars, and category totals in headers (the overview's totals, WS334, #290); the hedgehog art beside page titles (V17: no hedgehogs in page headers); the index's corner marks (V2: a reading surface); paper styling (C10); the sticker albums group (WS346).

## Manual pass (V24)

- **Focus order:** the HUD (logo, nav, theme, account), then `Overview`, `Giving`, `Being thanked`, `Connections` and `Crowd`, then the page. On 390 px, the select comes straight after the HUD.
- **Focus visibility:** index entries and the select draw a 2 px `--ring` outline, offset 2 px (`6-focus-ring-wide-dark.png`).
- **Following a page:** an index entry or a select change moves without a reload and puts focus on the new page's title (tested and checked in the browser: `document.activeElement` is the `h1`).
- **Reduced motion:** the only motion is the emblem's hover tilt, inside `prefers-reduced-motion: no-preference`.
- **Screen-reader wording:** a `navigation` landmark named `Book pages`; each entry's name is just the category (the emblem is `aria-hidden`); the current entry carries `aria-current="page"`; the select is named `Book page`, with `Overview` and an `Achievements` group; the tab title is `HedgeHug · Book · {category}`.

## Fable 5.1 design spot check

Fable checked the screenshots against E and the visual language. Its findings and what changed:

- **V5:** the index heading `Book` used RoundHog, which V5 keeps for titles. **Fixed:** Inter semibold.
- **Focus visibility:** the index relied on the faint global outline. **Fixed:** an explicit `focus-visible` ring on the entries and the select.
- **The current emblem's permanent tilt:** **fixed**, so only hover tilts it.
- **Two small labels stacked on narrow screens:** **fixed** with more space under the select.
- **Left for #281/#290:** the overview's own heading and structure, and the ladder details.
