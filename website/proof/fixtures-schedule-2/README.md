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

## Review

**GPT-6.1 Sol, high** ([review-sol.md](review-sol.md)), read-only, on the diff at `3e51539d`, with the ticket, `convex/unlocks/schedule.ts` and `website/Website.spec.md` as the oracle. It accepted all four recorded calls and found no deleted test or weakened assertion.

| Finding | Outcome |
|---|---|
| `questRewardKinds.test.tsx`: `withForty` had Quests open at level 2 | **Fixed**: level 3, with the same reward staying inside the level and every coin assertion intact |
| `header.test.tsx`: the three-page member listed Quests before the Book | **Fixed**: its features sorted by level, the scroll and focus assertions intact |
| `accessibility.test.tsx`: case names said "book locked until level 4" and "quests locked until level 2" | **Fixed**: level 1 and level 3 |
| `proof/header-phone`, `proof/hud-nav`, `proof/feature-gates` fixtures still compose schedule-1 paths | **Rejected**: these are earlier tickets' proof rigs, kept to reproduce their own screenshots. No gate builds or tests them, and moving them would change what they recorded |
| `fixtureReads.ts`: the fixture build's quests and leaderboard reads are fixed, so `/quests` renders open content for a member whose nav says Quests is locked | **Rejected for this ticket**: the fixed reads predate #570 and name no level, and the nav and panels follow the schedule. Named as a follow-up in #570's resolution: derive those reads from the visitor's card, as the Book's already do |
| `SkillTreePage.tsx`, `perkWords.ts`: "Every level from 5 on gives one skill point" | **Rejected**: this is progression's skill-point rule (`skillTreeLevel` in `convex/progression/levels.ts`), not a feature's unlock level, and schedule 2 left it at 5. The copy is still true |
| `fixtureSchedule.test.tsx`: "nothing locked at or below the member's level" contradicts the pending-readiness Book | **Rejected**: that check covers only members with a progression. The pending-readiness Book is `memberWaitingForTheBook`, which has none, and `BookPage.test.tsx` keeps covering it |
| The proof was missing | **Stale**: the review read the diff before the proof commit, which has the screenshots, red, green and the gate |
