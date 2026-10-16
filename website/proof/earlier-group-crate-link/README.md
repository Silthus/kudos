# A deep link to an earlier week's waiting group crate (#517)

The built website (`vite build` with `VITE_SHELL_FIXTURE=member-with-quests`, served by `vite preview`) in the T3 preview browser, in light and dark. The fixture's Quests answer was switched to `weekWithTwoWeeksOfGroupCrates` for this build only: two weeks' waiting Ants crates (`2026-09-28`, `2026-10-05`), last week's weekly crate (`weekly:2026-10-05:0`) and this week's finished group quest (`group`). The page carried `data-crate-target` values `group:2026-09-28`, `weekly:2026-10-05:0`, `group:2026-10-05` and `group`.

1. `1-wide-{light,dark}.png`: `/quests?crate=group%3A2026-09-28` at 1280×800. `document.activeElement` read `BUTTON Claim` inside `[data-crate-target="group:2026-09-28"]`, `:focus-visible` true, in view (top 468 of 800, `scrollY` 234), and no dialog opened.
2. `2-phone-{light,dark}.png`: `/quests?crate=group%3A2026-10-05` at 390×844. Focus on that week's Ants crate's `Claim` (`scrollY` 634, top 448 of 844), not on the weekly crate of the same week and not on this week's group quest, with no dialog.
3. `3-stale-target-light.png`: `/quests?crate=group%3A2026-09-21`, a week with no waiting group crate. The plain page at the top (`scrollY` 0), focus on the body.

## Tests

- `red.txt`: the new tests on the tree before the change: 5 fail. `websiteLinkOf` refuses the group page, the router drops `group:{week}`, nothing scrolls or takes focus, and sign-in returns to plain `/quests`.
- `green.txt`: the same three files after the change: 93 pass, none skipped.
