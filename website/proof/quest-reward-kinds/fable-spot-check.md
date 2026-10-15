# Design spot check: Fable 5.1 (high), read-only, screenshots against variant E and V1–V24

**Verdict: ship.** No must-fix. The quest cards follow E's `RewardLine`, the reveal follows E's `RewardChips` (sparkles for XP, the coin glyph for coins, a one-shot staggered rise, one primary Done), and the flight reuses the one-shot reward flight. The crate label follows V13's "reward · XP · coins" shape.

Optional polish:

1. The Journey line "Pays 40 XP and ◉ 20" mixed a word and a glyph under a crate label that uses `·`. **Taken:** it now reads "Pays 40 XP · ◉ 20".
2. The home's quest rows show coins but not XP, where E's rows showed no reward. **Skipped:** WS348 names the home's quest rows as a place that shows the coin glyph and value. XP on the rows isn't asked for, and adding it would widen every row.
3. The reveal headline orphaned "coins" at 1280 px. **Taken:** the headline now has `text-balance`.
