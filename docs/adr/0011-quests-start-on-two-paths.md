# Quests start on two paths, and the Monday path never reads Unlocks

Quests used to start only when the unlock path opened the `quests` feature, and each Journey step started when its feature opened. Now one gate, `questsFor`, says which path a member is on: `monday` (the `monday-quest` and `xp-levels` flags) or `unlocks` (today's `questsApplyTo`). `startQuests` is the only writer of a member's start. On the Monday path the onboarding steps (first-thanks, someone-new, two-days) all start together, and the weekly draw reads the stored start instead of the `quests` feature's opening. Neither reads Unlocks, the Book or the store.

We kept `questsApplyTo` meaning "on the unlock path" instead of widening it to both paths. About twenty callers read it for coin lines, crates, swaps and group copy, and widening it would light those up for Monday members. Only the three callers the feature needs move to `questsFor`. This bends the quests exception in [ADR-0006](0006-unlocks-gate-what-members-see-not-what-they-earn.md): opening the feature is now one way to start quests, not the only one.

Shaped in [docs/architecture/monday-quests.md](../architecture/monday-quests.md).
