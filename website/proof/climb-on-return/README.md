# #413 proof: the climb on return and the level-up celebration

Every picture comes from the real app on a local Convex backend (ports 9710/9711) with a real Slack sign-in through the mock issuer, real kudos sent as signed Slack events, and flags served on by the mock for that local backend only (`MOCK_FLAGS_ON`). Headless Chromium signed in, then took a screenshot every 50–100 ms; each `sheet-*.png` is a contact sheet of one run with the time since load.

- **Climb on return:** the browser last saw 85 XP (level 2) before three kudos; the member came back at 125 XP. The header starts at 85, chips fly from the Recent kudos card into the XP bar, the bar crosses level 3, and the celebration names "Leaderboard is ready to open". Light `sheet-climb-light.png`, dark `sheet-climb-dark.png`, 390 px `sheet-climb-390-*.png` (the card is off-screen there, so the chips leave the page title).
- **Live level-up:** the page is open at 125 XP and the member reaches 310 XP (level 4): `sheet-live-*.png`.
- **Reduced motion** (`reducedMotion: "reduce"`): the totals show at once with "+40 XP and level 3 since your last visit", no chips and no burst: `7-reduced-motion-summary-light.png`.
- **Once per change:** a reload after the climb stays still: `10-reload-stays-still-light.png` (each run also counted 0 flights and 0 celebrations after its reload).
- **Tests:** `red.txt` (13 of 16 failing before the change, the first visit and no change already still), `green.txt`.
