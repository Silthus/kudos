# Bus

Event bus: publishes domain events to the registered subscribers in the publisher's transaction: kudosGiven to the welcome message, progression, feedback's App Home refresh, the leaderboard's totals, and the analytics module's recording of kudos given and kudos received; attemptFailed and memberWelcomed to the analytics module's recording of attempt failed and member welcomed; and levelReached, which progression publishes, to feedback's level-up DM and public level notice. Commands are not domain events: the command registry in convex/commands routes them.

## invariants
