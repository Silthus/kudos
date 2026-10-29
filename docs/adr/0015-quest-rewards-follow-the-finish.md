# A quest's XP and hoggie are paid by followers of the finish

On the Monday path, Quests writes its own finish record and publishes `questFinished` with the quest's reward key. `Progression` follows it and pays the XP under that key, and `Album` follows it and earns the face-down hoggie under `quest:<rewardKey>`. This amends [ADR-0013](0013-quest-rewards-are-items-not-crates.md), which paid both in the finishing mutation. The keys are the same as before, so a finish replayed across the change pays nothing twice.

We gave up the single mutation so that Quests decides only what a member pursues and never writes another module's tables ([ADR-0014](0014-writes-cross-modules-as-bus-facts.md)). For a moment after the finish, the XP or the hoggie can be missing. If one follower throws, the other's write stands until a replay. The legacy unlock path keeps paying in its own mutation while it stays dark.

Shaped in [docs/architecture/hugs-hook.md](../architecture/hugs-hook.md), and brought into the repo with `spec/hugs-hook.md`. Coherence journal decision: `d-132df81f`.
