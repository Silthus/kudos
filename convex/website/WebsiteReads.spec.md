# Website reads

The website's signed-in reads, the sign-in callback, and the link App Home shows, `${SITE_URL}/` with no identity, only while the website flag is on, SITE_URL is set and the App Home is the deployment's workspace: every website query is built on memberQuery, which answers closed while the website flag is off, signed-out without a live session of the deployment's workspace, and verifying, unverified or not-a-member until the directory knows the person as a member, and calls its handler only with a verified member taken from the session, never from arguments; getMyProfile answers that member with their own homeFacts (kudos left, when they refill, given and received this week and in total) beside their sign-in name, their face (their company profile cutout on its colour when exactly one company profile matches their Slack real name, else their sign-in picture, else initials), and, only while the xp-levels flag is on for the workspace, their level and XP from progression's own read with the thresholds of their level and the next, and reads the website clock, a row a cron ticks every 15 minutes, so an open home turns to the new day and the new week without another kudos; getMyProfile also says whether the Everyone board is off, locked, ready or open, and, only while unlocks apply, lists each shipped feature in the schedule's order with its name, what it opens, its level, the member's state, when it became ready and when it was opened from unlocks' own read, and an opaque key per member and crate that carries no ID, the leaderboard's answer following its entry, and getLeaderboard answers one period's Everyone board as the leaderboard module's rankedBoardOf gives it to that member (every ranked row with its position, rank, tie, display name or "A teammate", face and kudos given, the window's positions, their standing and their improvement line), not-found while the everyone-board flag is off for the workspace, reading that flag without an exposure and following the same clock, and, while unlocks apply (xp-levels on and unlocks' query-safe unlocksAppliedIn true), locked with the level or ready with no board facts until the member has opened the Leaderboard, never running unlocks' launch; openFeature, the website's one command, passes the same guard as a mutation that writes nothing until the member is verified, reading the website flag without making a workspace key, refuses unless unlocks apply so it never runs unlocks' launch, then runs Commands' openUnlock for the signed-in member with the feature as its only argument and answers opened only when unlocks' own read finds the feature open afterwards, scheduling App Home's republish as a Slack click does; the sign-in callback refuses while the flag is off and links an account only by the Slack pair; a daily job deletes the verifier a sign-in that never came back from Slack left behind, once it is a day old.

## entrances
- query getMyProfile: a browser asks for the signed-in person's own website answer, with no arguments
  handler: getMyProfile in convex/website/profile.ts
  trust: browser

- query getLeaderboard: a browser asks for one period's Everyone board as the signed-in member sees it, with the period as its only argument
  handler: getLeaderboard in convex/website/leaderboard.ts
  trust: browser

- mutation openFeature: a browser asks to open one ready feature for the signed-in member, with the feature as its only argument
  handler: openFeature in convex/website/commands.ts
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
  over: getMyProfile for no session, a signed-out and an expired session, a session left over after SLACK_WORKSPACE_ID changes, an unknown person being verified, a failed verification, a member user_change deactivates, the flag off, never created, without its workspace key, switched off under an open session, and SLACK_WORKSPACE_ID unset; getLeaderboard for no session, the flag off, a former member, a member, and an argument beside the period
  via: website reads pass one guard
  because: the shell is public and a JWT outlives sign-out and membership, so every read must recheck the flag, the live session, the workspace and the directory in that order, or a closed site, a signed-out browser or a former member would read a member's kudos (WS3, WS9, WS11, WS14)
  crossing: browser -> domain
  entrances: query getMyProfile, query getLeaderboard
  refuted: memberQuery dropped the check that the session's workspace is the current SLACK_WORKSPACE_ID -> the leftover session after SLACK_WORKSPACE_ID changes read member instead of signed-out (2026-10-13)
  kinds: read, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the session token authorizes only reading the signed-in person's own answer, and the guard rechecks its live session row on every read rather than trusting the token
  checklist: redaction dismissed: a denial carries only its kind, never a profile of zeros or another member's facts
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: a session belongs to one Slack pair for its whole life; a changed workspace reads signed-out rather than carrying over
- website commands pass one guard: A website command answers closed while the website flag is off or its workspace key doesn't exist yet, signed-out without a live session of the deployment's current workspace, verifying, unverified or not-a-member until the directory knows the person as a member, exactly as a read does, and writes nothing at all with any denial; it reaches its handler only with that verified member, taken from the session, and an argument never names a member.
  over: openFeature with the website flag off, the flag on with a flags key but no workspace key, no session, a signed-out session, an unknown person being verified, a failed verification, a member user_change deactivates, and a member named beside the feature, each read through every table and every scheduled function
  via: website commands pass one guard
  because: a mutation is the first public function that can write, so a denial that wrote a workspace key, an exposure or a scheduled job would let anyone on the internet change state through a closed or signed-out call; the guard is memberQuery's in the same order and reads the website flag through the seam's read-only path (WS61, WS11)
  crossing: browser -> domain
  entrances: mutation openFeature
  refuted: memberQuery's guard read the website flag through the seam's writing path instead of its read-only one -> the call with a flags key but no workspace key made a key and answered refused instead of closed (2026-10-14)
  kinds: state, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the session token authorizes only acting as the signed-in member, and the guard rechecks its live session row and the directory on every call rather than trusting the token
  checklist: revalidated-permission dismissed: the flag, the session and the directory are read in the same mutation that runs the command, so no permission is carried from an earlier check
  checklist: redaction dismissed: a denial carries only its kind
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: a session belongs to one Slack pair for its whole life; a changed workspace answers signed-out
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: legal-state-succession dismissed: a denial moves no state, and the guard itself writes nothing
  checklist: supersession-safety dismissed: the guard writes nothing, so nothing late can publish a different value
  checklist: worker-fencing dismissed: no worker runs the guard; each call is one mutation
  checklist: commit-ordered-effects dismissed: a denial issues no effect and schedules nothing
  checklist: resumption-coverage dismissed: no batch operation resumes
- a website command never launches unlocks: While unlocks don't apply to the workspace (xp-levels off, the unlocks flag off, or no launch recorded), openFeature answers refused without running a command, so a website call never records unlocks' launch, writes no unlocks row and publishes no event.
  over: openFeature with xp-levels and unlocks on and no launch recorded, read through every table, every scheduled function and every published event
  via: a website command never launches unlocks
  because: unlocks' launch grandfathers every member at once and belongs to Slack until the product owner switches unlocks on (P77, WS62); a website call that reached openUnlock before the launch would run it through unlocksLiveIn
  crossing: browser -> domain
  entrances: mutation openFeature
  refuted: openFeature no longer checked WS55's gate before running openUnlock -> the unlaunched workspace recorded unlocks' launch (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: the gate is read in the same mutation that would run the command
  checklist: commit-ordered-effects dismissed: a refusal issues no effect at all
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: legal-state-succession dismissed: a refusal moves no state
  checklist: supersession-safety dismissed: a refusal writes nothing
  checklist: worker-fencing dismissed: no worker runs the command; each call is one mutation
  checklist: resumption-coverage dismissed: no batch operation resumes
- a website command is a D17 command: openFeature changes domain tables only through Commands' runCommand: opening a ready feature leaves exactly the domain tables and events a Slack App Home Open of the same feature leaves, besides Slack's receipt, the analytics outbox and scheduled functions, with generated IDs normalised; a locked, unshipped or gated-off feature answers refused and an already open one answers opened, each changing no domain table besides the exposure Slack's click sends; a doubled open opens once and answers opened again; after opened, App Home's republish is scheduled.
  over: openFeature for a ready Leaderboard against receiveHomeClick's Open of the same feature, a Leaderboard locked at level 1, an unshipped Skill tree past level 5, a ready and an open Leaderboard with unlocks or xp-levels switched off after the launch, an already open Leaderboard, a doubled open, and App Home's republished view after it
  via: a website command is a D17 command
  because: Unlocks alone decides what may open (D17, P73, WS62, WS64); a website path that wrote its own state could open what Slack still holds, and the reveal must follow only what Unlocks recorded
  crossing: browser -> domain
  entrances: mutation openFeature
  refuted: openFeature answered opened without reading unlocks' state after the command -> the locked Leaderboard and the unshipped Skill tree answered opened (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: Unlocks reads readiness, the ship flag and its gate in the same mutation that opens
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: supersession-safety dismissed: opening writes openedAt once in its own transaction, and a second open keeps the first
  checklist: commit-ordered-effects dismissed: unlockOpened goes to the in-process bus after commit and App Home's republish is a scheduled function of the same mutation
  checklist: worker-fencing dismissed: no worker owns a member's unlocks; Convex serializes the mutations that touch one row
  checklist: resumption-coverage dismissed: no batch operation resumes
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
- opening on the website grants nothing: openFeature opening a ready feature writes only that feature's openedAt and publishes only unlockOpened, besides the exposure Slack's click sends, so Unlocks' opening grants nothing holds through the website: XP, progress and every other record are as they were.
  over: every table of the schema and every published event, before and after openFeature opens a ready Leaderboard for a member with XP and a level
  via: opening on the website grants nothing
  because: a crate only reveals what is already recorded (P92); if opening on the website granted anything, a member could earn by clicking in a browser what Slack never pays
  crossing: browser -> domain
  entrances: mutation openFeature
  refuted: openFeature also gave the member 10 XP when it opened a feature -> the every-table assertion failed on memberProgress (2026-10-14)
  kinds: state
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: commit-ordered-effects dismissed: opening issues no external effect besides the scheduled App Home republish
  checklist: revalidated-permission dismissed: Unlocks reads readiness, the ship flag and its gate in the same mutation that opens
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: supersession-safety dismissed: openedAt is written once in its own transaction, and a second open keeps the first
  checklist: worker-fencing dismissed: no worker owns a member's unlocks; Convex serializes the mutations that touch one row
  checklist: resumption-coverage dismissed: no batch operation resumes
- a member's home shows only their own facts: getMyProfile's member answer is the signed-in member's own homeFacts with their own sign-in name and picture, never another member's facts.
  over: getMyProfile for a member beside members who gave and received kudos, before and after a kudos lands, and across the member's midnight and the week's turn on a clock tick
  via: WS13 WS15 WS18: a member's home answer projects their own homeFacts
  because: the kudos a member receives stay private (WS18, P65), so the home must read the facts of the session's own Slack pair and nobody else's
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: getMyProfile read homeFacts for another member of the workspace -> the answer carried that member's counts (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer carries only the member's own counts, emoji, refill time, name and face, and a link to the workspace in Slack; it never names another member
- level and XP are invisible while xp-levels is off: getMyProfile's member answer carries no progression while the xp-levels flag is off for the workspace, and while it is on carries exactly the member's own level, XP, the XP their level starts at and the next level starts at, and the XP still to go, from progression's own read, never skill points.
  over: getMyProfile for a member with XP while xp-levels is off, while it is on at level 1, exactly on a level's threshold and past level 5, beside another member with more XP, and switched off under an open session
  via: level and XP are invisible while xp-levels is off
  because: the website never shows more than Slack does and never derives a level or a threshold from XP, so level and XP reach the browser only through progression's own read and only while Slack shows them too (WS47, WS51, WS13, P79)
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: progressionOf no longer returned null while xp-levels is off -> a member with XP read their progression while the flag was off (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer carries only the member's own level and XP figures, never skill points, coins or another member's progress
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
- the website's board is invisible while everyone-board is off: While the everyone-board flag is off for the workspace, getLeaderboard answers not-found and getMyProfile's leaderboard reads off; only while it is on does getLeaderboard answer the board and leaderboard read open.
  over: getLeaderboard and getMyProfile for a member while PostHog has no everyone-board flag, in production while the flag is on in the sandbox only, and with the flag switched off under an open session
  via: WS30: the website's board is invisible while everyone-board is off
  because: the website must never show more than Slack shows (WS30, O33); a board Slack keeps dark must not reach a browser before the owner switches its flag
  crossing: browser -> domain
  entrances: query getLeaderboard, query getMyProfile
  refuted: getLeaderboard read the everyone-board flag but no longer answered not-found while it is off -> 3 of the 4 tests failed, the board answering while PostHog had no flag, in production and after the switch-off (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: not-found carries no board fact, and leaderboard carries only its state and, while locked, the level it opens at
- the website's leaderboard waits for its unlock: While xp-levels is on and unlocks apply to the workspace (the unlocks flag on and its launch recorded), getLeaderboard answers the board and getMyProfile's leaderboard reads open only for a member who has opened the Leaderboard; a member it is ready for reads ready, and one it is locked for reads locked with the level it opens at, both with no board facts; while unlocks don't apply the answer is the everyone-board flag's alone; a website read never records the launch, and a member's row on another member's board never depends on their own unlocks.
  over: getLeaderboard and getMyProfile with xp-levels and unlocks off, unlocks on and launched while xp-levels is off, xp-levels on and unlocks switched off after its launch, both on before the launch, and both on after it for a member at level 1, a member at level 3, a member who opened the Leaderboard, a member who was there at the launch, everyone-board off, and a locked member on an opened member's board
  via: WS52: the website's leaderboard waits for its unlock
  because: the website must never show more than Slack shows (WS52, #103, P76): a board Slack still tells a member opens at level 3 must not reach their browser, and a query that ran P77's launch would record it before the owner switches unlocks on, so the website reads only the query-safe check
  crossing: browser -> domain
  entrances: query getLeaderboard, query getMyProfile
  refuted: leaderboardStateOf answered open for every shipped state while unlocks apply, ignoring stateOf's locked and ready -> the locked and the ready member read the board (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: locked carries only the level unlocks' schedule names and ready carries nothing, so neither carries a board fact
- the website's feature states are Unlocks' facts: getMyProfile's features is null while unlocks don't apply to the workspace (xp-levels off, the unlocks flag off, or no launch recorded) and the leaderboard then is the everyone-board flag's alone; while they apply, each entry's state, readyAt and openedAt are unlocks' own read of the member, its name, opens and level are unlocks' schedule entry, and the leaderboard is the Leaderboard entry's state, or off without one; a website read never records the launch.
  over: getMyProfile with xp-levels and unlocks off, either one on, and both on before the launch, either one switched off after the launch, and both on after it for a member at level 1, a member at level 3, a member who opened the Leaderboard and a member who was there at the launch
  via: the website's feature states are Unlocks' facts
  because: the website never computes a game rule and never shows more than Slack does (WS55, WS56, WS57, P79): comparing a level with a feature's level in the website could show a feature open that Slack still holds, and the nav, the card and the page must read one fact so they can't disagree
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: featureCardsOf read every feature as locked instead of unlocks' state -> the ready, the opened and the grandfathered member read it locked (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: an entry carries only the feature's schedule copy, the member's own state and times, and a hashed key with no member, Slack or workspace ID
- the website shows only shipped features: While unlocks apply, getMyProfile's features has an entry only for a feature whose ship flag is on for the workspace, so a feature that hasn't shipped has no entry whatever the member's level, and with nothing shipped the list is empty.
  over: getMyProfile with skill-tree off for a member past level 5, with skill-tree on for a member at level 5, with everyone-board off, and with no feature shipped
  via: the website shows only shipped features
  because: a member is never shown something they can't get (P78, WS56): a card for an unshipped feature would promise a feature Slack doesn't have
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: featureCardsOf listed every scheduled feature instead of unlocks' shipped ones -> the skill tree showed with skill-tree off and the empty list read six cards (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: an unshipped feature is absent from the answer, not redacted inside it
- a website board row carries only what a board shows: A row of getLeaderboard's board holds exactly its position, rank, tie, name, face, kudos given and whether it is the viewer's own; it never carries a Slack user ID, a member ID, kudos received, XP, a level or a group, and a member who left the boards, a member who only received and a former member are in no row.
  over: getLeaderboard's board with a member who left the boards seen by themselves and by another member, a member who only received, a former member, and a member without a display name
  via: a website board row carries only what a board shows
  because: a board shows only kudos given (G13, P66) and keeps a member's choice to leave it (G22); an ID or a received count in a row would reach every member's browser (WS32, WS33)
  crossing: browser -> domain
  entrances: query getLeaderboard
  refuted: getLeaderboard's rows also carried the member's ID -> the exact-row and the no-ID tests failed (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction declared as a website board row carries only what a board shows
