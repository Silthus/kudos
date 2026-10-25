# One Monday DM per member and week, built from sections

The weekly hugs recap and the Monday quests share one DM. A `convex/mondayDm` module owns one row per member and week and the 9:00-local send in the member's zone, with its retries. At send time it asks each source for its section, `hugsSectionOf` and `questsSectionOf`, and each section honours its own message kind. It sends one DM, or skips the week when every section is empty. Hugs keeps counting hugs into `hugWeeks` and no longer delivers anything.

We chose one owner over two schedulers that hand off. "Inside the recap when one goes out, otherwise standalone" needs both sources' answers at the same moment. Two sweeps firing at 9:00 would have to read each other's state. A member who turned the recap off would silently lose the quests too, because the recap's skip path never sends. The Monday DM is sent at most once, so a doubled DM never counts against the opt-out bar.

Shaped in [docs/architecture/monday-quests.md](../architecture/monday-quests.md).
