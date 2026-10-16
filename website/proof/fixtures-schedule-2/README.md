# #570: the fixture build follows unlock schedule 2

Map #1's #538 moved the backend to unlock schedule 2: the Book at level 1, the Leaderboard at 2, Quests at 3, the Skill tree at 5 and Coins at 6, in that order. The website's fixture build still modelled schedule 1.

## Tests

- [red.txt](red.txt): `website/src/fixtureSchedule.test.tsx` on `origin/main` (`ecb72f6d`) with only the test added: 48 of its cases fail. Every member listing a feature has it at a schedule-1 level, 16 list their features out of the schedule's order, and the locked pages name the old levels.
- [red-nav-climb.txt](red-nav-climb.txt): the test's nav-climb cases with the two new fixture members left out of the build. The level-1 and level-3 builds render the closed page.
- [green.txt](green.txt): the same file passing, 99 cases. It reads `convex/unlocks/schedule.ts`, so the next schedule change fails the website suite.
- [gate.txt](gate.txt): `pnpm gate` through `fleet heavy` on the branch.

The other 37 assertions that named a schedule-1 level now name the schedule-2 level for the same state. No test was deleted or skipped. See the PR for the list.

## The fixture build in a browser

These are Vite fixture builds (`VITE_SHELL_FIXTURE=<name>`), served by `vite preview` and captured in Chromium (T3 preview) at 1440 × 900.

| State | Light | Dark |
|---|---|---|
| Level 1 (`member-at-level-1-with-the-book-ready`): Book ready; Leaderboard `Lv 2`, the next unlock; Quests and Skill tree locked; locked panels say "Unlocks at level 2", "3" and "5" | [light](shots/level-1-home-light.png) | [dark](shots/level-1-home-dark.png) |
| Level 2 (`member-with-every-nav-state`): Book open, Leaderboard ready, Quests `Lv 3` next, Skill tree locked | [light](shots/level-2-home-light.png) | [dark](shots/level-2-home-dark.png) |
| Level 3 (`member-at-level-3-with-the-quests-ready`): Book and Leaderboard open, Quests ready, Skill tree `Lv 5` next | [light](shots/level-3-home-light.png) | [dark](shots/level-3-home-dark.png) |
| Ready page: `/book` for `member-with-the-book-ready` | [light](shots/book-ready-light.png) | [dark](shots/book-ready-dark.png) |
| Locked page: `/book` for `member-waiting-for-the-book`, "Unlocks at level 1" | [light](shots/book-locked-light.png) | [dark](shots/book-locked-dark.png) |

The fixture build serves fixed leaderboard and quests reads, so it has no locked `/leaderboard` or `/quests` page. Their locked pages are covered by `LeaderboardPage.test.tsx` (level 2) and `QuestsPage.test.tsx` (level 3). The locked panels on the level-1 home show the same "Unlocks at level n" values.
