# #268: the header fits a phone (WS300)

## Width proof

Chromium (T3 preview), the fixture build in `fixture/` with `?six=1`, after merging `main` with #193: six nav entries (Home, Quests, Leaderboard, Book and Skill tree are real; Collection is a DOM clone standing in for a future page), the real skill point chip, the ready pill, the theme control and the avatar. `document.documentElement.scrollWidth` at each viewport width. The `main` column was read before #193 merged, with the same six entries (Book, Skill tree and Collection cloned) and a cloned chip:

| Viewport | `main` | This branch |
|---|---|---|
| 320 px | 523 | 320 |
| 390 px | 523 | 390 |
| 640 px | 640 | 640 |
| 1024 px | n/a | 1024 |
| 1440 px | n/a | 1440 |
| 1440 px at `zoom: 2` | n/a | 1440 |

A real 200% browser zoom of a 1280 px window lays the page out at 640 CSS px, which the 640 px row covers.

At 1024 and 1440 px the bar is one 57 px row. Before the merge, with longer cloned labels, the controls wrapped to a right-aligned second row at 1024 px and the page still fit; WS302's icon-only entries from `lg` to `xl` (#269) leave more room.

## Rail behaviour in a real browser (240 px, below the 320 px floor so the third entry starts off-screen)

- `/leaderboard` on load: the rail's `scrollLeft` is 55.5 and Leaderboard is fully in view; the page's `scrollX` stays 0.
- Focus on Quests, then Tab: focus moves to Leaderboard, `:focus-visible` is on, the rail scrolls to 55.5 and the entry is in view; the page's `scrollWidth` stays 240.

## Screenshots at 390 px

- This branch: [light](branch-390-light.png), [dark](branch-390-dark.png)
- Variant E at level 8: [light](variant-e-390-light.png), [dark](variant-e-390-dark.png)
- `main` before #193 merged, with six entries, overflowing to 523 px: [light](main-390-light.png)

## Reproduce

Copy `fixture/proof-fixture.tsx`, `fixture/proof-fixture.html` and `fixture/proof.vite.config.ts` into `website/`, then run `pnpm --dir website exec vite build --config proof.vite.config.ts --outDir <dir>` and serve `<dir>` on a local port. Open `/proof-fixture.html?six=1`. Pass `path=/leaderboard` to start on another page.
