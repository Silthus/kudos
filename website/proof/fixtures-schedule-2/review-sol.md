- **Medium — `website/src/questRewardKinds.test.tsx:139`:** `withForty` still has Quests open at level 2. Move its progression to level 3, preserving the reward-flight scenario and every coin assertion.

- **Medium — `website/src/header.test.tsx:13`, `website/proof/header-phone/fixture/proof-fixture.tsx:17`:** Concatenating fixture paths produces Quests → Book → Leaderboard → Skill tree. Compose these in schedule-2 order and retain the scrolling/focus assertions.

- **Medium — `website/proof/hud-nav/fixture/proof-fixture.tsx:17`:** Taking the first feature now copies Book instead of Quests. The “open” preview consequently duplicates Book and loses Quests. Build a unique, ordered all-open path.

- **Medium — `website/src/fixtureReads.ts:22`:** Quests and Leaderboard always return open data. Thus the new level-2 fixture’s nav says Quests is locked, but visiting `/quests` renders quests; ready pages likewise render open content. Derive fixture answers from the visitor’s feature states, as Book already does.

- **Low — `website/proof/feature-gates/fixture/proof-fixture.tsx:16`, `website/src/accessibility.test.tsx:72`, `website/src/accessibility.test.tsx:104`:** Remaining schedule-1 values: the proof answers Leaderboard locked at 3; accessibility cases name Book 4 and Quests 2. Change them to 2, 1, and 3 respectively.

- **Low — `website/src/pages/SkillTreePage.tsx:82`, `website/src/skills/perkWords.ts:39`:** Production copy still hardcodes the skill-point starting level, “from 5 on.” The ticket’s copy cleanup is incomplete. Describe earning more points through leveling without embedding the threshold.

- **Low — `website/src/fixtureSchedule.test.tsx:36`:** The guard assumes every locked feature must be above the member’s level. That contradicts the accepted pending-readiness Book state at level 1. Scope this assertion to settled progression scenarios and preserve explicit pending-readiness coverage.

- **Medium — `/tmp/i570/ticket.md:23`:** Required proof is missing from the supplied change: light/dark screenshots of locked/ready pages and level-1/2/3 navigation, plus completed before/after website-suite and full-gate evidence. The current proof directory contains partial logs only.

Recorded calls: **1 accept**—the backend can answer locked Book at 1. **2 accept**—deliberately fictional mechanics paths need not match the product schedule. **3 accept**—the offsets preserve the scenarios, and `(290 − 100) / 200 = 95%`. **4 accept the real-schedule coupling; object to its blanket state invariant**, as above.

No existing tests deleted or assertions weakened found. No tests run or files modified.

**Verdict: Request changes—fixture migration and required proof remain incomplete.**