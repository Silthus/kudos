# The HedgeHug logo and favicon (#258)

- `red.txt`: `website/src/logo.test.tsx` failing on `main` at `763c147` (7 of 7).
- `green.txt`: the same tests passing on the branch.
- `gate.txt`: the summary of `pnpm gate` on the branch.
- `served.txt`: a disposable local Convex backend (ports 6810/6811) serving the built site through static hosting: the HTML's CSP, the icons' content types, the served bytes equal to the committed files, and the head tags.
- `closed-light.png`, `closed-dark.png`: the closed page from that backend (the `website` flag does not exist there, so it answers closed).
- `sign-in-light.png`, `sign-in-dark.png`: the signed-out page from the `signed-out` fixture build.
- `member-header-light.png`, `member-header-dark.png`: a member's header from the `member` fixture build.
- `variant-e-reference.png`: the accepted prototype's variant E (`3409ade`, `prototype/website-ui/screenshots/final-home-level2.png`), for the header.
