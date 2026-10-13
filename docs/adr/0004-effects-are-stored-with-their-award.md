# Progression effects are stored with their award

Every progression effect is stored with the award that caused it: the base and bonus XP, the coins, the thoughtful-gate decision, the perks and boosters that applied, and any drop with its pseudo-random charge. Levels, achievements, balances and the sticker book are derived from these stored facts. We chose this over recomputing bonuses from today's rules or keeping only running totals, because awards and progression are permanent ([ADR-0001](0001-awards-are-permanent.md), [ADR-0002](0002-progression-is-permanent.md)): retuning a price or a perk must never rewrite history. Stored effects also make a retried event safe to replay, let new achievements count retroactively, and keep every coin auditable before coins can buy real-world rewards.

Settled in grilling [#9](https://github.com/Silthus/kudos/issues/9). Coherence journal decision: `d-74ada940`.

**Amended on [#86](https://github.com/Silthus/kudos/issues/86) (2026-10-13), after the scope cut (map #1, decision 12):** boosters and drops are gone, so an effects record holds base and bonus XP, coins, the gate decision and the perks that applied. Quest and Journey rewards, the first XP not tied to an award, are stored the same way: one insert-only reward record per claim, never recomputed. Coherence journal decision: `d-01e321cd`.
