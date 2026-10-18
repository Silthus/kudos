# The Journey, not a level, makes weekly quests ready

For members with the redesign flag on, Quests becomes ready when they finish every Journey quest before `first-quest` that applies to them (`first-thanks`, `two-days` where the Book applies, and `someone-new`), not at level 3. This is the one feature [ADR-0006](0006-unlocks-gate-what-members-see-not-what-they-earn.md)'s level schedule doesn't ready. Quests decides and publishes `weeklyQuestsEarned`; Unlocks stores the readiness once (`makeWeeklyReady`), and its level path skips any feature whose `readyByFor` answers `journey`. We chose this over Unlocks following `questFinished` and asking Quests which steps are done, because that would teach Unlocks the Journey's steps and add an Unlocks-to-Quests call beside the `questsFlag` cycle. We also chose it over readying at the crate open, because a click shouldn't gate what a member is offered next.

## Consequences

- Members whose earlier quests finished before the flag reached them are caught up by Quests' hourly new-week sweep, their next kudos or App Home's publish.
- Nothing is taken away: a ready or opened Quests stays whatever the flag says later. A member who isn't ready yet when the flag turns off goes back to level 3.

Settled on [#626](https://github.com/Silthus/kudos/issues/626) (map #624); the architecture is `docs/architecture/quest-log.md` on `prototype/quest-log-architecture`. Coherence journal decision: `d-faff0beb`.
