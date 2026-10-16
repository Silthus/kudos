
codex
- **P2 — Address changes discard in-flight purchase feedback** — [HomePage.tsx:27](/home/coder/dev/kudos-wt/panel-section-links/website/src/pages/HomePage.tsx:27). Open `/?panel=inventory`, start buying an item, click the “HedgeHug, home” link, then switch to Inventory before the request finishes. The changed key remounts `GearPanel`, clearing `buying` and its notice state. “Buying…” disappears, Buy becomes available again, and the eventual success, refusal, or connection error updates the unmounted hook, so no result is announced. The retained `pendingPurchase` preserves only the request identity.

Verdict: The reported history sequence is fixed, but the remount introduces a P2 regression.
