# A deep link to an earlier week's waiting crate (#500)

The built website (`vite build` with `VITE_SHELL_FIXTURE=member-with-quests`, served by `vite preview`) in the T3 preview browser, in light and dark. The fixture's Quests answer holds last week's waiting crate: `{ kind: "weekly", week: "2026-10-05", slot: 0 }`.

1. `1-wide-{light,dark}.png`: `/quests?crate=weekly%3A2026-10-05%3A0` at 1280×800. Focus is on the `Waiting to open` card's `Claim`, inside the view, with its focus ring. `document.activeElement` read `BUTTON Claim` inside `[data-crate-target="weekly:2026-10-05:0"]`, `:focus-visible` read true, and no dialog opened: the crate waits for the member.
2. `2-phone-{light,dark}.png`: the same link at 390×844. The page scrolled (`scrollY` 311) so that the card's `Claim` sits in the view (top 533 of 844), focused, with no dialog.
3. `3-stale-target-light.png`: `/quests?crate=weekly%3A2026-09-28%3A0`, a crate that isn't waiting. The plain page, at the top (`scrollY` 0), with focus on the body.

## Tests

- `red.txt`: the final tests run on an untouched `origin/main` (`c4589db8`): 6 fail. `websiteLinkOf` refuses the weekly page and `urlOf` writes `[object Object]`, the router drops the target, nothing scrolls or takes focus, and sign-in returns to plain `/quests`.
- `green.txt`: the same three files on this branch: 76 pass, none skipped.
