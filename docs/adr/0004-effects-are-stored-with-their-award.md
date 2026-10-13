# Progression effects are stored with their award

Every progression effect is stored with the award that caused it: the base and bonus XP, the coins, the thoughtful-gate decision, the perks and boosters that applied, and any drop with its pseudo-random charge. Levels, achievements, balances and the sticker book are derived from these stored facts. We chose this over recomputing bonuses from today's rules or keeping only running totals, because awards and progression are permanent ([ADR-0001](0001-awards-are-permanent.md), [ADR-0002](0002-progression-is-permanent.md)): retuning a price or a perk must never rewrite history. Stored effects also make a retried event safe to replay, let new achievements count retroactively, and keep every coin auditable before coins can buy real-world rewards.

Settled in grilling [#9](https://github.com/Silthus/kudos/issues/9). Coherence journal decision: `d-74ada940`.
