# Bus

Event bus: publishes domain events to the registered subscribers in the publisher's transaction: kudosGiven to the welcome message, progression, and the analytics module's recording of kudos given and kudos received; attemptFailed and memberWelcomed to the analytics module's recording of attempt failed and member welcomed; levelReached, which progression publishes, to Unlocks, which records the level up and its readiness and sends the level-up DM in one mutation, and to feedback's public level notice and App Home; and unlockReady and unlockOpened, which Unlocks publishes and nothing subscribes to yet; and the command registry, its twin, which routes each command to the one internal mutation of the module that owns it.

## invariants
