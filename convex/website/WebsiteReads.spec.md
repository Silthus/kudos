# Website reads

The website's signed-in reads and the sign-in callback: every website query is built on memberQuery, which answers closed while the website flag is off, signed-out without a live session of the deployment's workspace, and verifying, unverified or not-a-member until the directory knows the person as a member, and calls its handler only with a verified member taken from the session, never from arguments; getMyProfile answers that member with their own homeFacts (kudos left, when they refill, given and received this week and in total) beside their sign-in name and picture, and reads the website clock, a row a cron ticks every 15 minutes, so an open home turns to the new day and the new week without another kudos; the sign-in callback refuses while the flag is off and links an account only by the Slack pair.

## entrances
- query getMyProfile: a browser asks for the signed-in person's own website answer, with no arguments
  handler: getMyProfile in convex/website/profile.ts
  trust: browser

## invariants
- the public surface is exact: Exactly the HTTP routes, Convex Auth's signIn, signOut and isAuthenticated, and the website's signed-in functions are public; every other Convex function is internal.
  over: every Convex function every module of the deployment exports, outside convex/_generated
  via: WS10: the public surface is exact
  because: a public function is an entrance anyone on the internet can call; a new one must fail until a reviewed change adds it, so no domain function is reachable without the session check (WS10, replacing R50)
  crossing: browser -> domain
  entrances: none
  refuted: made prepareWebsiteFlag a public mutation instead of an internal one -> the surface test failed listing it (2026-10-13)
  kinds: read, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: no public function accepts a credential carrying bounded permission; the session is checked by website reads pass one guard
  checklist: redaction dismissed: the test lists function names, nothing is exported or scrubbed
  checklist: canonical-encoding dismissed: function paths are compared as the module glob lists them, sorted; no identity is encoded
  checklist: identity-continuity dismissed: the surface carries no identity across a succession
- website reads pass one guard: A website read answers closed while the website flag is off, signed-out without a live session of the deployment's current workspace, verifying, unverified or not-a-member until the directory knows the person as a member, and reaches its handler only with that verified member, taken from the session.
  over: getMyProfile for no session, a signed-out and an expired session, a session left over after SLACK_WORKSPACE_ID changes, an unknown person being verified, a failed verification, a member user_change deactivates, the flag off, never created, without its workspace key, switched off under an open session, and SLACK_WORKSPACE_ID unset
  via: website reads pass one guard
  because: the shell is public and a JWT outlives sign-out and membership, so every read must recheck the flag, the live session, the workspace and the directory in that order, or a closed site, a signed-out browser or a former member would read a member's kudos (WS3, WS9, WS11, WS14)
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: memberQuery dropped the check that the session's workspace is the current SLACK_WORKSPACE_ID -> the leftover session after SLACK_WORKSPACE_ID changes read member instead of signed-out (2026-10-13)
  kinds: read, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the session token authorizes only reading the signed-in person's own answer, and the guard rechecks its live session row on every read rather than trusting the token
  checklist: redaction dismissed: a denial carries only its kind, never a profile of zeros or another member's facts
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: a session belongs to one Slack pair for its whole life; a changed workspace reads signed-out rather than carrying over
- a member's home shows only their own facts: getMyProfile's member answer is the signed-in member's own homeFacts with their own sign-in name and picture, never another member's facts.
  over: getMyProfile for a member beside members who gave and received kudos, before and after a kudos lands, and across the member's midnight and the week's turn on a clock tick
  via: WS13 WS15 WS18: a member's home answer projects their own homeFacts
  because: the kudos a member receives stay private (WS18, P65), so the home must read the facts of the session's own Slack pair and nobody else's
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: getMyProfile read homeFacts for another member of the workspace -> the answer carried that member's counts (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer carries only the member's own counts, emoji, refill time, name and picture, and a link to the workspace in Slack; it never names another member
- only the allowed workspace signs in, and only while open: A sign-in creates or updates an account only for a profile of the deployment's SLACK_WORKSPACE_ID with a non-empty Slack user, and only while the website flag is on.
  over: the sign-in callback for a profile from another workspace, an empty Slack user, an unset SLACK_WORKSPACE_ID, and the flag off
  via: WS3 WS6: only the allowed workspace signs in, and only while open
  because: anyone on the internet can start a Slack sign-in, so a person from another workspace, or anybody while the site is dark, must get no account (WS3, WS6)
  crossing: browser -> session
  entrances: route GET /api/auth/callback/slack, route POST /api/auth/callback/slack, action signIn
  refuted: rememberSignedInMember no longer refused while the website flag is off -> the flag-off sign-in created an account (2026-10-13)
  kinds: identity, credential
  checklist: capability-authorization dismissed: the Slack ID token's audience, nonce and state are checked by Auth.js before the callback runs, proven by the handshake test against the mock issuer
  checklist: revalidated-permission declared as website reads pass one guard
  checklist: message-authenticity dismissed: Auth.js verifies the ID token's signature against Slack's published keys before the callback sees a claim
  checklist: encrypted-storage dismissed: no credential is stored by the callback; Convex Auth keeps only hashed verifiers and refresh tokens
  checklist: key-rotation-compatibility dismissed: Slack's signing keys are read from its JWKS on each handshake; JWT_PRIVATE_KEY and JWKS rotate as a pair per deployment
  checklist: canonical-encoding dismissed: the workspace is compared exactly as Slack's team_id claim carries it
  checklist: identity-continuity declared as accounts link only by the Slack pair
  checklist: separation-of-duties dismissed: no approval policy applies to signing in
- accounts link only by the Slack pair: A sign-in links to an account only by its Slack workspace and user, never by an email, and keeps the display claims of the latest sign-in on that same account.
  over: a first sign-in and a later sign-in of the same Slack pair with changed and dropped display claims
  via: WS7: accounts link only by the Slack pair
  because: Slack can't vouch for an email a member types elsewhere; linking by email would let another identity take over a member's account (WS7)
  crossing: browser -> session
  entrances: route GET /api/auth/callback/slack
  refuted: a later sign-in of the same Slack pair inserted a new user instead of updating the linked one -> the same-pair sign-in returned another user (2026-10-13)
  kinds: identity
  checklist: capability-authorization dismissed: the account key is Slack's workspace and user from a verified ID token; no credential with bounded permission is accepted
  checklist: canonical-encoding dismissed: the account key is `<workspace>/<user>` exactly as Slack's claims carry them, with no normalisation to disagree on
  checklist: identity-continuity declared as accounts link only by the Slack pair
