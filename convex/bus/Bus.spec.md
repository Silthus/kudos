# Bus

Event bus: publishes domain events to the registered subscribers in the publisher's transaction: kudosGiven to the welcome message, progression, and the analytics module's recording of kudos given and kudos received; attemptFailed and memberWelcomed to the analytics module's recording of attempt failed and member welcomed; and levelReached, which progression publishes, to feedback's level-up DM, public level notice and App Home; and the command registry, its twin, which routes each command to the one internal mutation of the module that owns it.

## invariants
