# #413 proof: the climb on return and the level-up celebration

Every picture comes from the real app on a local Convex backend (ports 9710/9711) with a real Slack sign-in through the mock issuer, real kudos sent as signed Slack events, and flags served on by the mock for that local backend only (`MOCK_FLAGS_ON`). Headless Chromium signed in, then took a screenshot every 50–100 ms; each `sheet-*.png` is a contact sheet of one run with the time since load.

- **Climb on return:** the browser last saw 85 XP (level 2) before three kudos; the member came back at 125 XP. The header starts at 85, chips fly from the Recent kudos card into the XP bar, the bar crosses level 3, and the celebration names "Leaderboard is ready to open". Light `sheet-climb-light.png`, dark `sheet-climb-dark.png`, 390 px `sheet-climb-390-*.png` (the card is off-screen there, so the chips leave the page title).
- **Live level-up:** the page is open at 125 XP and the member reaches 310 XP (level 4): `sheet-live-*.png`.
- **Reduced motion** (`reducedMotion: "reduce"`): the totals show at once with "+40 XP and level 3 since your last visit", no chips and no burst: `7-reduced-motion-summary-light.png`.
- **Once per change:** a reload after the climb stays still: `10-reload-stays-still-light.png` (each run also counted 0 flights and 0 celebrations after its reload).
- **Tests:** `red.txt` (13 of 16 failing before the change, the first visit and no change already still), `green.txt`.

## Review rounds

- **Fable 5.1 design spot check** (ship with fixes): taken: the card anchors above the level ring (top-centre below the header when there's no room), chips leave offset so they never stack, a bigger burst (24 sparks, rays to 420 px, ring to 3.4×), a white edge in dark, one size for "Level N", chips 220 ms apart and the card leaving after 2 s. Not taken, recorded with `coherence decide`: celebrating at the first crossing (one celebration per climb, as the ticket asks) and a chip flight for live XP (the ticket keeps #354's live flights).
- **GPT-6.1 Sol review**: fixed, each with a red test in `red-review.txt` or `red-stuck-climb.txt`: a chip that can't fly landed twice under StrictMode; a chip that never lands (reduced motion turned on mid-climb) held the header (now every chip lands by a deadline, and at once under reduced motion); `settle` kept one timer per element, so the celebration's bar burst stranded `reward-levelling` on the frame; a celebration outlived sign-out; the calm card stayed 4 s, now 3 s. Rejected with reasons in the journal: a crate landing during the two-second climb waits until it ends; two tabs restored in the same instant may both play; a member without an unlock path gets no climb.
