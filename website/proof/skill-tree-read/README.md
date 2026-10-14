# #187: the skill tree read and skill points

`getSkillTree` (WS80, WS83) and `getMyProfile.skillPoints` (WS84), projected from progression's `perksOf`.

- **Red:** [`red.txt`](red.txt). `convex/website/skillTree.test.ts` and `skillTreeCatalogue.test.ts` before `convex/website/skillTree.ts` existed: all 13 tests fail, 12 with `Could not find module for: "website/skillTree"` and the guard's validator test with the same missing function.
- **Green:** [`green.txt`](green.txt). The same 13 tests pass, verbose, none skipped. Between red and green, one test moved to its own describe, since the shared `beforeEach` had already launched unlocks before its member joined; its assertions are unchanged.
- **Gate:** [`gate.txt`](gate.txt). `pnpm gate` through `fleet heavy`: typecheck, 124 files and 1,920 tests, `coherence spec --check` with 0 problems, and `coherence lexicon --check` with 0 unknown nouns.
- **Running app:** [`running-app.txt`](running-app.txt). A disposable local backend on ports 5510 and 5511, storage under `/tmp`, never the shared 3210 and never a cloud deployment. The flag mock ran on 5512 with `MOCK_FLAGS_ON=xp-levels,unlocks,skill-tree`, a local override only. Juno is a seeded member with a seeded Convex Auth session, read with `convex run --identity`:
  1. Before any launch, `getSkillTree` reads `not-found` and `skillPoints` is `null`, and no `unlockLaunches` row exists after the reads.
  2. The unlocks launch runs from the shell, as App Home's first open would. P77 opens the shipped Skill tree for Juno.
  3. At 1,000 XP, `getSkillTree` reads all three first-row perks `available` with 2 skill points, equal to `perksOf` read directly. `getMyProfile.skillPoints` is `2`.
  4. With spark and rhythm owned and both points spent (seeded rows), the read shows both `owned` with their time, circle `unavailable` for `points`, and `skillPoints` `0`, again equal to `perksOf`.
  5. With `skill-tree` switched off, `getSkillTree` reads `not-found` and `skillPoints` is `null`, while the owned perks stay (P5). The one `unlockLaunches` row is step 2's, and no `journeyLaunches` row exists.

This ticket changes no page. The Skill tree's page and the HUD's chip come with #188, so no screenshot applies here.
