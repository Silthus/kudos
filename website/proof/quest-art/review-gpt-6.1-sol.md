Found three behavior defects and one test gap:

1. **Medium — [RewardFlight.tsx:43](/home/coder/dev/kudos-wt/quest-art/website/src/crates/RewardFlight.tsx:43): waiting crates lose their flight (WS315).**  
   Claim an earlier week’s crate, let Convex remove it from `waiting` while the reveal plays, then press Done. The source chip is gone, so `courseOf` returns `undefined` and silently skips the flight. Reproduced with a changing read. **Fix:** capture the origin before the mutation, or retain the row until its flight starts.

2. **Medium — [RewardFlight.tsx:18](/home/coder/dev/kudos-wt/quest-art/website/src/crates/RewardFlight.tsx:18): focus restoration can invalidate the flight’s origin (WS315).**  
   The layout effect measures before `moments` restores card focus in a passive effect. If that focus scrolls a partially offscreen card, the ghost starts at its old viewport coordinates. A modeled scroll reproduced stale geometry without StrictMode; StrictMode’s extra effect pass remeasures and masks it. **Fix:** measure after focus restoration and scrolling settle, and cover this with a test using production’s single effect pass.

3. **Medium — [crates.css:266](/home/coder/dev/kudos-wt/quest-art/website/src/crates/crates.css:266): enabling reduced motion during flight does not stop it (WS315, WS339, V11).**  
   The preference is checked only when the reveal closes. Enable it during the flight: the chip continues moving and subsequently triggers the avatar’s scaling animation. Reproduced. **Fix:** observe preference changes, clear the active flight, guard both animations with the media query, and handle cancellation cleanup.

4. **Low — [QuestsPage.test.tsx:313](/home/coder/dev/kudos-wt/quest-art/website/src/QuestsPage.test.tsx:313): the “from the card” test accepts an incorrect origin.**  
   Only the avatar’s rectangle is mocked; the source retains JSDOM’s zero rectangle. An implementation that always launches from `(0, 0)` would pass the asserted offsets. **Fix:** mock distinct, nonzero source and target rectangles, then assert the ghost’s `left`/`top` and both center-to-center offsets.

Validation used read-only React/JSDOM probes and the supplied theme-token calculation. No files changed.