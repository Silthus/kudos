# Quest rewards are items under a `quest:` key, not crates

On the Monday path a finished quest pays XP through `recordReward`, with no coins. In the same mutation it earns a face-down hoggie in the item ledger ([ADR-0010](0010-hidden-items-are-a-ledger-drawn-at-the-turn.md)), keyed `quest:<rewardKey>`. There is no crate, no pending crate and no `crate-rewards` hold. Both writes are keyed, so a replayed finish pays nothing twice.

The item key is `quest:` and not the quest's `weekly:` or `journey:` reward key, even though both are already valid crate keys. Those keys carry pack bands that pay XP and coins when the hoggie is turned, so reusing them would quietly bring coins back. A `quest:` key has no band, and the turn only draws the hoggie. Legacy quests keep their crates while they stay dark.

Shaped in [docs/architecture/monday-quests.md](../architecture/monday-quests.md). Coherence journal decision: `d-fe6492c9`.
