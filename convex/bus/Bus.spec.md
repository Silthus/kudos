# Bus

Event bus: publishes domain events to the registered subscribers in the publisher's transaction: kudosGiven to the welcome message, progression, and the analytics module's recording of kudos given and kudos received; attemptFailed and memberWelcomed to the analytics module's recording of attempt failed and member welcomed; levelReached, which progression publishes, to feedback's level-up DM, public level notice and App Home and to Unlocks, which stores readiness; and unlockReady and unlockOpened, which Unlocks publishes and nothing subscribes to yet; and the command registry, its twin, which routes each command to the one internal mutation of the module that owns it.

## invariants
