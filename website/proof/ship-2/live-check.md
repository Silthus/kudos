# The live client on the sandbox, after round 2's fixes

Round 2 found that the live board read looped ("Too many re-renders") on every page, which the gate missed because the live-shell test stubbed Convex's `useQueries`. The test now runs the real hook ([red](red-render-loop.txt)), and this check runs the real client against a real deployment.

- The sandbox was redeployed from `c840123` by `deploy-sandbox.yml` (run 38501837883), right before the check. The served bundle carries this round's strings (`Positions skipped`).
- A signed-in member (the default browser profile's sandbox session) opened the home, then the Leaderboard from the nav in place, then This month:
  - [home](sandbox-home-light.png): the level line and the Leaderboard under Open;
  - [leaderboard](sandbox-leaderboard-light.png): the board, empty because the sandbox's one member has given nothing;
  - after This month: the address read `/leaderboard?period=month`, `main` had no `aria-busy`, the board read `Everyone · This month`, and focus stayed on `This month` with `aria-pressed="true"`.
- A signed-out visitor (an incognito tab) on `/leaderboard` got the [sign-in page](sandbox-signed-out-light.png), not the error page.

Sandbox rows appended for a fallback session, unused because the default profile was already signed in: one `authSessions` row and one `authRefreshTokens` row for #136's proof user, each expiring two hours after it was written. Nothing was cleared or changed.
