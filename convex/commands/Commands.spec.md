# Commands

Commands: the platform-neutral registry every App Home click is routed through (D17). A command shows a Home tab or a leaderboard period, or turns `Show me on the leaderboards` on or off; it acts on the clicking member only, is applied by the module that owns its state, and sets that state to the value it carries, so a second click on the same button changes nothing, and the adapter runs each click once, keyed by the payload's idempotency key.

## invariants
