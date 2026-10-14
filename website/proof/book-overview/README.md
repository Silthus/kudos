# The Book's overview (#290)

WS334, WS339; V4, V16, V17, V24; #85. Website only: `getBook`'s read is unchanged, so the screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`, answered with every shipped ladder at a different stage) at 1440 px and 390 px, served by `vite preview` on 127.0.0.1:7920 and driven in the T3 preview browser. No backend, flag or cloud deployment was touched.

| Shot | What it shows |
|---|---|
| `1-overview-wide-light.png` | The overview on a wide screen: E's book-reading hedgehog beside `14 of 28 tiers earned`, `Across 7 ladders.` and a neutral bar; the closest next tier (`Noticed`, `Bronze · Recognition`, `1 to go`, a neutral `Next` tag); five shelved tiers, newest first, the newest tagged `New`; four category tiles with their art, ladder emblems, counts and bars. |
| `2-overview-wide-dark.png` | The same in dark. |
| `3-overview-390-light.png` | 390 px: the hedgehog stacks above the totals, the shelf holds three, names and dates wrap rather than truncate, the tiles stack. `scrollWidth` 390. |
| `4-overview-390-dark.png` | The same in dark. |
| `5-focus-shelf-wide-light.png` | Keyboard focus on the first shelved tier: the 2 px ring round the whole entry. |

E at the same page, for comparison: the #259 audit's [overview pair](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/screenshots/compare-book-overview-light.png) ([dark](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/screenshots/compare-book-overview-dark.png)): the right half of each is E.

## Kept from E, and changed on purpose

- **Kept:** the book-reading hedgehog (`HedgehogReadingIsMagic`), `{earned} of {total} tiers earned` with a bar, the `Closest next tier` card with emblem, `Next`, medal, tier name and ladder, linking to its page; `Recently earned` with `Newest first`, the latest tier per ladder on a shelf plank, five wide and three narrow, `New` on the newest; the category tiles with art, ladder emblems, count and bar.
- **Changed:**
  - No paper texture or stacked-page shadow: C10 keeps paper for the albums; achievements stay plain Quill cards (V2).
  - `Next` and `New` are neutral foreground pills, not primary (D2, V4). The bars are neutral `muted-foreground`, and the plank is a solid `muted-foreground` rule, so each meets 3:1 (V24).
  - The closest next tier shows `{at − count} to go` and no `count / at` bar: Recognition counts kudos received, and received totals stay private on the overview (#85). E's requirement sentence waits for a unit fact, as on the ladder cards.
  - No reward lines, coins or sticker-album tile: their facts haven't shipped (WS91, WS346, WS347).
  - No hover tilts or shine: the only motion-like element is the static gold and diamond sparkle (WS339).
  - Five or three entries switch at the website's own wide breakpoint (64rem, the one the page index uses), and only the shown entries render, so a screen reader hears what is on screen.

## V24 manual pass

- **Focus order:** the page index, the title, the closest next tier, each shelved tier newest first, then each tile in E's order: reading order.
- **Focus visibility:** every link on the overview draws the 2 px `outline-ring` ring with an offset (`5-focus-shelf-wide-light.png`).
- **Reduced motion:** nothing on the overview animates, so there is nothing to reduce.
- **Screen-reader wording:** the totals are a `progressbar` named `14 of 28 tiers earned`; the card reads `Closest next tier: Noticed, Bronze · Recognition, 1 to go`; a shelved tier reads `First Thanks, Bronze Generosity, earned 14 Oct 2026, new`; a tile reads `Giving, 7 of 12 tiers earned`. The art, emblems and tile bars are `aria-hidden`.
