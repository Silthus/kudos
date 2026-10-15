# Deep links to a perk and a ready crate (#435)

The built website (`vite build` with `VITE_SHELL_FIXTURE`, served by `vite preview`) in the T3 preview browser, at 1280×800 and at 390×844 for the drawer, in light and dark.

1. `1-perk-wide-{light,dark}.png`: `/skills?perk=circle` as `member-with-every-feature-open`. The page scrolled Circle into view. Focus is on its node, which reads `Selected`, and the details panel shows Circle. `document.activeElement` read `Circle. Can buy. Costs 1 skill point.` with `aria-pressed="true"`.
2. `2-perk-drawer-{light,dark}.png`: `/skills?perk=rhythm` at 390 px. Rhythm's drawer is open and holds focus. Escape closed it, and focus went back to Rhythm's node.
3. `3-skill-tree-crate-{light,dark}.png`: `/skills?crate=skillTree` as `member-with-the-skill-tree-ready`. Focus is on the ready band's `Open`, inside the view, with its focus ring (`:focus-visible` read true). No dialog opened: the crate waits for the member.
4. `4-book-crate-{light,dark}.png`: `/book?crate=book` as `member-with-the-book-ready`. The same landing on the Book's ready band.
5. `5-journey-crate-{light,dark}.png`: `/?crate=journey` as `member-with-quests`. The home scrolled to the Journey step `Finish a weekly quest.` and focused its `Open`. No reveal played.

`/quests?crate=quests` and `/leaderboard?crate=leaderboard` are proven in `website/src/deepLinkTargets.test.tsx` only: the fixture build always answers those two reads open, so it has no ready page for them.
