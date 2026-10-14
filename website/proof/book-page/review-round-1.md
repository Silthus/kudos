# Review round 1 (#191)

**Reviewer:** GPT-6.1 Sol (high), `codex exec --sandbox read-only`, waited on. The first call hit a 429, and the retry answered.
**Input:** the ticket commit `b0e9f9f` against `df2c736` (the integration tip with `origin/main` merged), with `spec/website-4.md` (WS80, WS81, WS92–WS94) as the oracle and `docs/website/visual-language.md` (V1–V24) beside it. The tree was a frozen copy of `b0e9f9f`.

## Findings

1. **Minor, holds, fixed.** `website/src/Root.tsx:17`: the fixture build always answered the open Book, so `/book` showed Achievements for `member-waiting-for-the-book`, `member-with-the-book-ready` and `member-with-nothing-shipped`, while the home and nav treated the Book as locked, ready or absent (WS80, WS81).
   - **Fix:** `fixtureBookFor(visitor)` in `bookFixtures.ts` answers from the fixture member's own Book entry: not-found without one, locked with its level, ready, or the Book once open. `Root` passes it through a small `FixtureApp`.
   - **Test:** *WS80 WS81: the fixture build's /book agrees with its member* renders `Root` with each fixture. Before the fix, 4 of its 5 tests failed on their assertions. After it, all 24 tests in `BookPage.test.tsx` pass.

**Verdict (the reviewer's):** "one minor fixture-state regression; no major findings."

Nothing was rejected.
