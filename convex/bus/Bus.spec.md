# Bus

Event bus: publishes domain events to the registered subscribers in the publisher's transaction: kudosGiven to the welcome message, progression, the leaderboard's totals, and the analytics module's recording of kudos given and kudos received; attemptFailed and memberWelcomed to the analytics module's recording of attempt failed and member welcomed; and levelReached, which progression publishes, to feedback's level-up DM and public level notice; and xpRecorded, which progression publishes from the transaction that records a member's XP, to feedback's App Home refresh. Commands are not domain events: the command registry in convex/commands routes them.

## invariants
