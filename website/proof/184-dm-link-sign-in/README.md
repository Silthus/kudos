# Strand C2 proof: a DM link keeps its section through sign-in

Strand C2 of `spec/monday-quests.md` (MQ22, MQ28). The walk ran on production builds (`vite build`, then `vite preview`) of two committed shell fixtures, `signed-out` and `album-quests`, at 1280 px, and of the `signed-out` fixture on the base `c6031fb9` for the before shots. All members are made up. Each shot carries a black caption the walk added with the address at the moment of the shot.

The fixtures have no Convex Auth, so the walk shows the two ends of the trip. Between them, Convex Auth builds the return as `SITE_URL + redirectTo` with `?code=` set through `URL.searchParams`, which keeps the hash, and its client drops `code` with `url.pathname + url.search + url.hash` (`@convex-dev/auth` 0.0.96, `server/implementation/redirects.js` and `react/client.js`).

## Leaving for Slack, signed out

- `01-base-signed-out-loses-the-section.png`: on the base, `/sign-in/book#me/quests` becomes `/book` before Slack's sign-in starts, so the return address had no section.
- `02-head-signed-out-keeps-the-section.png`: on HEAD the address is `/book#me/quests`, the return address the sign-in sends Convex Auth.
- `03-head-signed-out-keeps-the-named-step.png`: `/sign-in/book#me/quests/someone-new` keeps the named step.
- `04-head-signed-out-no-hash-as-before.png` beside `04b-base-signed-out-no-hash.png`: `/sign-in/book` becomes `/book` on both.

## Back from Slack, signed in

- `05-member-back-from-slack-lands-on-the-section.png`: `/book?code=12345678#me/quests` scrolls the quests section into view. The album then settles the hash to `#me` and leaves `code` for Convex Auth.
- `06-member-back-from-slack-how-to-open.png`: `/book?code=12345678#me/quests/someone-new` lands on the same section. In this fixture the named step is also the next step, so its how-to shows either way; the album's own test tells the two apart.
- `07-signed-in-member-goes-straight-to-the-section.png`: a member who is already signed in and opens `/sign-in/book#me/quests` lands on the section without a sign-in.

## Tests

- `website/src/liveShell.test.tsx`: the live shell asks Convex Auth for `signIn("slack", { redirectTo: "/book#me/quests" })` from `/sign-in/book#me/quests`.
- `website/src/signIn.test.tsx`, `MQ22 MQ28`: signed-out and closed visitors go to Slack with the hash and keep it in the address; a member lands on the section from `/sign-in/book#me/quests`, `/book#me/quests` and `/book?code=…#me/quests`, with `code` kept; the named step's how-to opens after the return. The F28 table above it covers links without a hash, unchanged.
