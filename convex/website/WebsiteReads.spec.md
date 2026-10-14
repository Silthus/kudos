# Website reads

The website's signed-in reads, the sign-in callback, and the website links Slack shows, each SITE_URL plus a page's route from the route list (the root `/`, the Leaderboard `/leaderboard` with `?period=month` or `?period=all`, the Quests page `/quests`, any page not listed yet resolving to the root) with no identity, built only in the website's link module, by websiteLinkOf for one page and by frontDoorLinksOf for App Home's front door (the root, then each feature open for the member on the same unlock path and leaderboard state getMyProfile reads that has a page on the route list, in schedule order, decided by the member's own decision of the website flag and each starting Sign in with Slack with its page's route while the workspace decision is off), and only while the website flag is on, SITE_URL is set and the workspace is the deployment's workspace: every website query is built on memberQuery, which answers signed-out without a live session of the deployment's workspace and verifying, unverified or not-a-member until the directory knows the person as a member, each closed instead while the website flag is off in the workspace decision, answers closed to a member whose own decision of the website flag is off, and calls its handler only with a verified member taken from the session, never from arguments; getMyProfile answers that member with their own homeFacts (kudos left, when they refill, given and received this week and in total) beside their sign-in name, their face (their company profile cutout on its colour when exactly one company profile matches their Slack real name, else their sign-in picture, else initials), and, only while the xp-levels flag is on for the member, their level and XP from progression's own read with the thresholds of their level and the next, and reads the website clock, a row a cron ticks every 15 minutes, so an open home turns to the new day and the new week without another kudos; getMyProfile also says whether the Everyone board is off, locked, ready or open, and, only while unlocks apply, lists each shipped feature in the schedule's order with its name, what it opens, its level, the member's state, when it became ready and when it was opened from unlocks' own read, and an opaque key per member and crate that carries no ID, the leaderboard's answer following its entry, and getLeaderboard answers one period's Everyone board as the leaderboard module's rankedBoardOf gives it to that member (every ranked row with its position, rank, tie, display name or "A teammate", face and kudos given, the window's positions, their standing and their improvement line), not-found while the everyone-board flag is off for the member, reading that flag without an exposure and following the same clock, and, while unlocks apply (xp-levels on for the member and unlocks' query-safe unlocksAppliedTo true), locked with the level or ready with no board facts until the member has opened the Leaderboard, never running unlocks' launch; openFeature and openQuestCrate, the website's commands, pass the same guard as a mutation that writes nothing until the member is verified and the website flag is on for them, reading the website flag without making a workspace key, then send the member's website exposure and run their due preview moments, none while a workspace launch is due and never a workspace launch, refuses unless unlocks apply and while a workspace launch the flags made due isn't recorded yet, so it never runs unlocks' launch, and, while the quests module's questsApplyTo holds, also unless the Journey has started for the member (its launch or their preview moment), so it never runs the Journey's launch or its join, then runs Commands' openUnlock for the signed-in member with the feature as its only argument and answers opened only when unlocks' own read finds the feature open afterwards, scheduling App Home's republish as a Slack click does; openQuestCrate refuses unless the quests module's questsApplyTo holds and the Journey has started for the member, so it never runs unlocks' launch, the Journey's launch or its join, then runs Commands' openQuestCrate with the quest as its only argument and answers opened only when the quests module's crate opening for that quest exists afterwards, scheduling App Home's republish; getQuests answers not-found unless the quests module's questsApplyTo holds, which never runs a launch, locked with Quests' level or ready while the member hasn't opened Quests, and otherwise this week's drawn quests from the quests module's own read, each with its kind, goal, progress, reward, state, whether it was swapped, the quest that opens its crate while finished and an opaque key per member and crate once finished, beside every earlier week's finished, unopened crate with its week, oldest first, from the quests module's read of them; getMyProfile's journey is null unless quests apply, and otherwise lists the member's active Journey steps from the quests module's projection, which shows first-thanks active before any activation is stored, each with the module's goal and hint copy, its reward, its state, the quest that opens its crate while finished and an opaque key per member and crate once finished; the sign-in callback admits a person only while the flag is on in the workspace decision or in a known member's own, sending that member's website exposure and running their due preview moments, and links an account only by the Slack pair; a daily job deletes the verifier a sign-in that never came back from Slack left behind, once it is a day old.

## entrances
- query getMyProfile: a browser asks for the signed-in person's own website answer, with no arguments
  handler: getMyProfile in convex/website/profile.ts
  trust: browser

- query getLeaderboard: a browser asks for one period's Everyone board as the signed-in member sees it, with the period as its only argument
  handler: getLeaderboard in convex/website/leaderboard.ts
  trust: browser

- query getQuests: a browser asks for the signed-in member's quests this week, with no arguments
  handler: getQuests in convex/website/quests.ts
  trust: browser

- mutation openFeature: a browser asks to open one ready feature for the signed-in member, with the feature as its only argument
  handler: openFeature in convex/website/commands.ts
  trust: browser

- mutation openQuestCrate: a browser asks to open one finished quest's or Journey step's crate for the signed-in member, with the quest as its only argument
  handler: openQuestCrate in convex/website/commands.ts
  trust: browser

## invariants
- the route list is the paths the router serves: The backend's route list holds exactly the paths the website's router serves, so a website link Slack shows never opens the not-found page, and a page that ships adds its path to both in one change.
  over: routeList in convex/website/routes.ts and servedPaths in website/src/route.ts, the list routeOf matches a path against
  via: SW10: the route list is the paths the router serves
  refuted: added /quests to the backend's routeList without adding it to the website router -> the contract test failed listing /quests (2026-10-14)
  because: a link to a path the router doesn't serve lands a member on the not-found page, and a path added to the router alone would leave its links on the root; the website map adds /skills and /book to both lists in the pull requests that ship them (SW9, SW10)
  kinds: output
  checklist: destination-confinement dismissed: the list names paths on the deployment's own SITE_URL; no destination comes from input
  checklist: redaction dismissed: a path carries no identity and nothing sensitive
  checklist: commit-ordered-effects dismissed: the lists are constants; comparing them issues no effect
  checklist: circuit-breaker-policy dismissed: no breaker is declared; nothing is sent
  checklist: declared-target-coverage declared as the route list is the paths the router serves
- one function builds every website link: websiteLinkOf answers SITE_URL plus the asked page's route, the Leaderboard keeping its period, and a page not on the route list resolves to the root, so a link never names a path the website doesn't serve.
  over: websiteLinkOf while the website is open, for the root, the Leaderboard's three periods, the Quests page, and the two pages not listed yet
  via: SW11: one function builds every website link
  refuted: routeOf answered an unlisted page's own path instead of the root -> the three unlisted pages linked to /quests, /skills and /book (2026-10-14)
  because: a link to a page the website doesn't serve yet would land a member on the not-found page, so every message builds its link from the route list through one function, and a page shipped later switches its links on with its route (SW11, SW13)
  kinds: output
  checklist: destination-confinement dismissed: the origin is the deployment's own SITE_URL and the path comes from the route list; no part of the URL is taken from input
  checklist: redaction dismissed: a link carries no identity, only a path and a period
  checklist: commit-ordered-effects dismissed: the function is a query and issues no effect
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack replies
  checklist: declared-target-coverage dismissed: the link has one target, the website
- a deep link shows only while the website is open: The `/hedgehug leaderboard` board reply ends with a link to the same period's board while the website flag is on, SITE_URL is set and the workspace is the deployment's workspace, and is today's reply, with no link, otherwise; the usage reply never carries one.
  over: the `/hedgehug leaderboard` reply for the week, the month and all time, for a SITE_URL ending in a slash, for a period it doesn't know, and for the month with the website flag off, SITE_URL unset and another workspace
  via: SW13 SW14: the leaderboard reply links to the same board on the web
  refuted: websiteLinkOf answered SITE_URL plus the route without reading the website flag -> the flag-off reply ended with a link (2026-10-14)
  because: a link shown while the website is closed or unconfigured leads a member to a closed page, and with the website off every Slack reply must be byte-for-byte today's (SW11, SW13, SW17, SW25)
  crossing: slack-request -> domain
  entrances: route POST /slack/commands
  kinds: output
  checklist: destination-confinement dismissed: the reply answers the signed slash command's own HTTP request; the link's origin is the deployment's own SITE_URL
  checklist: redaction dismissed: the link carries no identity, only a path and a period
  checklist: commit-ordered-effects dismissed: the reply is the command's HTTP answer; deciding the link writes nothing
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack replies
  checklist: declared-target-coverage dismissed: the reply has one target, the member who asked
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
- website reads pass one guard: A website read checks the live session of the deployment's current workspace, then the directory, then the website flag: it answers signed-out without such a session and verifying, unverified or not-a-member until the directory knows the person as a member, each of them closed instead while the website flag is off in the workspace decision, answers closed to a verified member whose own decision of the website flag is off, and reaches its handler only with a verified member the flag is on for, taken from the session.
  over: getMyProfile for no session, a signed-out and an expired session, a session left over after SLACK_WORKSPACE_ID changes, an unknown person being verified, a failed verification, a member user_change deactivates, the flag off, never created, without its workspace key, switched off under an open session, and SLACK_WORKSPACE_ID unset; getLeaderboard for no session, the flag off, a former member, a member, and an argument beside the period; getQuests with the flag off, no session, a former member, and an argument that names another member
  via: website reads pass one guard
  because: the shell is public and a JWT outlives sign-out and membership, so every read must recheck the live session, the workspace, the directory and the flag, or a closed site, a signed-out browser or a former member would read a member's kudos; the flag comes last because a member's own decision can open the site while the workspace decision keeps it closed, and anyone the directory doesn't know gets the workspace decision (WS3, WS9, WS11, WS14, F19, F27)
  crossing: browser -> domain
  entrances: query getMyProfile, query getLeaderboard, query getQuests
  refuted: memberQuery dropped the check that the session's workspace is the current SLACK_WORKSPACE_ID -> the leftover session after SLACK_WORKSPACE_ID changes read member instead of signed-out (2026-10-13)
  kinds: read, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the session token authorizes only reading the signed-in person's own answer, and the guard rechecks its live session row on every read rather than trusting the token
  checklist: redaction dismissed: a denial carries only its kind, never a profile of zeros or another member's facts
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: a session belongs to one Slack pair for its whole life; a changed workspace reads signed-out rather than carrying over
- website commands pass one guard: A website command answers closed while the website flag is off for the member, or, for a member without an analytics ID yet, while the workspace key doesn't exist yet, signed-out without a live session of the deployment's current workspace, verifying, unverified or not-a-member until the directory knows the person as a member, exactly as a read does, and writes nothing at all with any denial, deciding a member without an analytics ID by a new one it keeps only once the member is admitted, so until then each command decides afresh; it reaches its handler only with that verified member, taken from the session, and an argument never names a member.
  over: openFeature with the website flag off, the flag on with a flags key but no workspace key, no session, a signed-out session, an unknown person being verified, a failed verification, a member user_change deactivates, and a member named beside the feature, each read through every table and every scheduled function; openQuestCrate for a finished Journey step with the website flag off, the flag on with a flags key but no workspace key, no session, a signed-out session, a member user_change deactivates, and a member named beside the quest
  via: website commands pass one guard
  because: a mutation is the first public function that can write, so a denial that wrote a workspace key, an exposure or a scheduled job would let anyone on the internet change state through a closed or signed-out call; the guard is memberQuery's in the same order and reads the website flag through the seam's read-only path (WS61, WS11)
  crossing: browser -> domain
  entrances: mutation openFeature, mutation openQuestCrate
  refuted: memberQuery's guard read the website flag through the seam's writing path instead of its read-only one -> the call with a flags key but no workspace key made a key and answered refused instead of closed (2026-10-14)
  kinds: state, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the session token authorizes only acting as the signed-in member, and the guard rechecks its live session row and the directory on every call rather than trusting the token
  checklist: revalidated-permission dismissed: the flag, the session and the directory are read in the same mutation that runs the command, so no permission is carried from an earlier check
  checklist: redaction dismissed: a denial carries only its kind
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: a session belongs to one Slack pair for its whole life; a changed workspace answers signed-out
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: legal-state-succession dismissed: a denial moves no state; past the guard, the member's website exposure and preview moments are each written once and never moved
  checklist: supersession-safety dismissed: a denial writes nothing, and the exposure and preview moments past the guard are written once per member, so nothing late can publish a different value
  checklist: worker-fencing dismissed: no worker runs the guard; each call is one mutation
  checklist: commit-ordered-effects dismissed: a denial issues no effect and schedules nothing
  checklist: resumption-coverage dismissed: no batch operation resumes
- a website command never launches unlocks: While unlocks don't apply to the member (xp-levels off, the unlocks flag off, or neither the launch nor their preview moment recorded), openFeature answers refused without running a command, while the flags made unlocks' launch or the Journey's launch due for the workspace and it isn't recorded yet, both commands answer refused without running a command, even for a member whose preview moment is recorded, while quests apply and the Journey's launch isn't recorded, openFeature answers refused without running a command for any feature, since App Home's republish after any opened answer would record it, and so would the unlockOpened that opening Quests or the Leaderboard publishes, and while quests don't apply or the Journey's launch isn't recorded, openQuestCrate answers refused without running a command, so a website call never records unlocks' or the Journey's launch, never schedules the Journey's join, writes no unlocks row and publishes no event.
  over: openFeature with xp-levels and unlocks on and no launch recorded; openFeature for a ready Quests, a ready Leaderboard and an open Leaderboard with quests on, unlocks launched and no Journey launch; openQuestCrate with every flag on and no launch, and with unlocks launched and no Journey launch; each read through every table, every scheduled function and every published event
  via: a website command never launches unlocks
  because: unlocks' launch grandfathers every member at once and belongs to Slack until the product owner switches unlocks on (P77, WS62); a website call that reached openUnlock before the launch would run it through unlocksLiveIn
  crossing: browser -> domain
  entrances: mutation openFeature, mutation openQuestCrate
  refuted: openFeature checked the Journey's recorded launch only for Quests -> with quests on, unlocks launched and no Journey launch, opening a ready or open Leaderboard answered opened, and activateJourney or App Home's republish would record the Journey's launch (2026-10-14)
  refuted: openFeature checked only unlocks' gate for Quests, not the Journey's recorded launch -> with unlocks launched and no Journey launch, opening a ready Quests answered opened, and its unlockOpened subscribers would record the Journey's launch and schedule its join (2026-10-14)
  refuted: openQuestCrate checked only questsApplyIn, not the Journey's recorded launch -> with unlocks launched and no Journey launch, the call recorded the Journey's launch and scheduled its join (2026-10-14)
  refuted: openFeature no longer checked WS55's gate before running openUnlock -> the unlaunched workspace recorded unlocks' launch (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: the gate is read in the same mutation that would run the command
  checklist: commit-ordered-effects dismissed: a refusal issues no effect at all
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: legal-state-succession dismissed: a refusal moves no state
  checklist: supersession-safety dismissed: a refusal writes nothing
  checklist: worker-fencing dismissed: no worker runs the command; each call is one mutation
  checklist: resumption-coverage dismissed: no batch operation resumes
- a website command is a D17 command: openFeature changes domain tables only through Commands' runCommand: opening a ready feature leaves exactly the domain tables and events a Slack App Home Open of the same feature leaves, besides Slack's receipt, the analytics outbox and scheduled functions, with generated IDs normalised; a locked, unshipped or gated-off feature answers refused and an already open one answers opened, each changing no domain table besides the exposure Slack's click sends; a doubled open opens once and answers opened again; after opened, App Home's republish is scheduled. openQuestCrate likewise leaves exactly what Slack's Open of the same Journey step leaves; an active step, an unfinished or never-drawn weekly quest, or a finished step with quests, unlocks or xp-levels switched off answers refused and writes nothing; a doubled open opens once and answers opened again; after opened, App Home's republished view no longer offers the crate.
  over: openFeature for a ready Leaderboard against receiveHomeClick's Open of the same feature, a Leaderboard locked at level 1, an unshipped Skill tree past level 5, a ready and an open Leaderboard with unlocks or xp-levels switched off after the launch, an already open Leaderboard, a doubled open, and App Home's republished view after it; openQuestCrate for a finished Journey step against receiveHomeClick's Open of the same step, a finished weekly quest, an active step, an unfinished and a never-drawn weekly quest, a finished step with each flag switched off, a doubled open, and App Home's republished view after it
  via: a website command is a D17 command
  because: Unlocks alone decides what may open (D17, P73, WS62, WS64); a website path that wrote its own state could open what Slack still holds, and the reveal must follow only what Unlocks recorded
  crossing: browser -> domain
  entrances: mutation openFeature, mutation openQuestCrate
  refuted: openQuestCrate answered opened without reading the quests module's crate opening -> the active step, the unfinished and the never-drawn weekly quest answered opened (2026-10-14)
  refuted: openFeature answered opened without reading unlocks' state after the command -> the locked Leaderboard and the unshipped Skill tree answered opened (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: Unlocks reads readiness, the ship flag and its gate in the same mutation that opens
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: supersession-safety dismissed: opening writes openedAt once in its own transaction, and a second open keeps the first
  checklist: commit-ordered-effects dismissed: unlockOpened goes to the in-process bus after commit and App Home's republish is a scheduled function of the same mutation
  checklist: worker-fencing dismissed: no worker owns a member's unlocks; Convex serializes the mutations that touch one row
  checklist: resumption-coverage dismissed: no batch operation resumes
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
- opening on the website grants nothing: openFeature opening a ready feature writes only that feature's openedAt and publishes only unlockOpened, besides the exposure Slack's click sends, so Unlocks' opening grants nothing holds through the website: XP, progress and every other record are as they were; openQuestCrate opening a finished quest's crate writes only one crate opening and publishes only questOpened, so the quests module's opening a crate grants nothing holds through the website too.
  over: every table of the schema and every published event, before and after openFeature opens a ready Leaderboard for a member with XP and a level, and before and after openQuestCrate opens a finished Journey step's crate
  via: opening on the website grants nothing
  because: a crate only reveals what is already recorded (P92); if opening on the website granted anything, a member could earn by clicking in a browser what Slack never pays
  crossing: browser -> domain
  entrances: mutation openFeature, mutation openQuestCrate
  refuted: openQuestCrate also gave the member 10 XP when it opened a crate -> the every-table assertion failed on memberProgress (2026-10-14)
  refuted: openFeature also gave the member 10 XP when it opened a feature -> the every-table assertion failed on memberProgress (2026-10-14)
  kinds: state
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: commit-ordered-effects dismissed: opening issues no external effect besides the scheduled App Home republish
  checklist: revalidated-permission dismissed: Unlocks reads readiness, the ship flag and its gate in the same mutation that opens
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: supersession-safety dismissed: openedAt is written once in its own transaction, and a second open keeps the first
  checklist: worker-fencing dismissed: no worker owns a member's unlocks; Convex serializes the mutations that touch one row
  checklist: resumption-coverage dismissed: no batch operation resumes
- quests are invisible where they don't apply: While the quests module's questsApplyTo answers false for the member (quests, xp-levels or unlocks off, or neither the launch nor their preview moment recorded), getQuests answers not-found and getMyProfile's journey is null, whatever quests and Journey steps the member finished, and a website read never records unlocks' or the Journey's launch.
  over: getQuests and getMyProfile with quests, xp-levels or unlocks switched off after a member finished a quest and a Journey step, and with every flag on and nothing launched
  via: quests are invisible where they don't apply
  because: the website never shows more than Slack does and never computes a game rule (WS69, WS70, WS71, #57): a quest fact read while quests don't apply would reach a browser before the owner switches quests on, and a progress, finish or active step derived in the website could disagree with what Slack shows
  crossing: browser -> domain
  entrances: query getQuests, query getMyProfile
  refuted: journeyStepsOf no longer checked questsApplyIn before listing the Journey -> all 4 tests failed, the journey listed with quests, xp-levels or unlocks off and before any launch (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: not-found and null carry no quest fact, locked carries only Quests' level, and a crate key is a hash with no member, Slack or workspace ID
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
- level and XP are invisible while xp-levels is off: getMyProfile's member answer carries no progression while the xp-levels flag is off for the member, and while it is on carries exactly the member's own level, XP, the XP their level starts at and the next level starts at, and the XP still to go, from progression's own read, never skill points.
  over: getMyProfile for a member with XP while xp-levels is off, while it is on at level 1, exactly on a level's threshold and past level 5, beside another member with more XP, and switched off under an open session
  via: level and XP are invisible while xp-levels is off
  because: the website never shows more than Slack does and never derives a level or a threshold from XP, so level and XP reach the browser only through progression's own read and only while Slack shows them too (WS47, WS51, WS13, P79)
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: progressionOf no longer returned null while xp-levels is off -> a member with XP read their progression while the flag was off (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer carries only the member's own level and XP figures, never skill points, coins or another member's progress
- only the allowed workspace signs in, and only while open: A sign-in creates or updates an account only for a profile of the deployment's SLACK_WORKSPACE_ID with a non-empty Slack user, and only while the website flag is on in the workspace decision or in the member's own.
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
- a member previews the website by their own decision: While the website flag is off in the workspace decision, a member it names in their own decision signs in, sends their website exposure once with that decision's value, runs their due preview moments of unlocks and the Journey, none while a workspace launch the flags made due isn't recorded yet, and reads and acts on the website by their own decisions of every flag, while every other member and every person the directory doesn't know is refused or reads closed and writes nothing; a session from before the preview sends the exposure and runs the preview moments at its first command; App Home's front door links the previewer to their pages through Sign in with Slack and shows another member no link; a website call never records the unlocks launch or the Journey launch.
  over: the sign-in callback, getMyProfile, getLeaderboard, getQuests, openFeature and App Home's front door links for a member an email condition names and a member it doesn't, a person the directory doesn't know, a session from before the preview, the website on for everyone with the other flags on for one email, the website on for the workspace but off in one member's own decision, and unlocks or quests switched on for the workspace after a preview, before its launch is recorded
  via: F26 F27 F28 F29: a member previews the website by their own decision
  because: Michael opens unfinished work to single members by email in PostHog, so the website must follow the member decision, and a preview must never open the site, move a launch or change what other members get (F15, F16, F21, F22, F25, F26, F27, F28, F29)
  crossing: browser -> session
  entrances: route GET /api/auth/callback/slack, route POST /api/auth/callback/slack, action signIn, query getMyProfile, query getLeaderboard, query getQuests, mutation openFeature, mutation openQuestCrate
  refuted: memberQuery's guard read the website flag's workspace decision instead of the member's own -> the previewer read closed, their first command answered closed, and a member off in their own decision read their profile (2026-10-14)
  kinds: identity, state
  checklist: capability-authorization dismissed: the session token authorizes only acting as the signed-in member, and the guard rechecks the live session, the directory and the member's own decision on every call
  checklist: revalidated-permission declared as website reads pass one guard
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them, and the member decision reads the email the directory stores
  checklist: identity-continuity declared as accounts link only by the Slack pair
  checklist: separation-of-duties dismissed: no approval policy applies to signing in or opening one's own feature
  checklist: legal-state-succession dismissed: the exposure and each preview moment are written once per member and never moved
  checklist: supersession-safety dismissed: the exposure and each preview moment are written once per member, so nothing late can publish a different value
  checklist: worker-fencing dismissed: no worker runs the guard; each call is one mutation
  checklist: commit-ordered-effects dismissed: the exposure and the preview moments' events reach the outbox in the same mutation, and a refused sign-in throws, which rolls them back
  checklist: resumption-coverage dismissed: no batch operation resumes
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
- the website's board is invisible while everyone-board is off: While the everyone-board flag is off for the member, getLeaderboard answers not-found and getMyProfile's leaderboard reads off; only while it is on does getLeaderboard answer the board and leaderboard read open.
  over: getLeaderboard and getMyProfile for a member while PostHog has no everyone-board flag, in production while the flag is on in the sandbox only, and with the flag switched off under an open session
  via: WS30: the website's board is invisible while everyone-board is off
  because: the website must never show more than Slack shows (WS30, O33); a board Slack keeps dark must not reach a browser before the owner switches its flag
  crossing: browser -> domain
  entrances: query getLeaderboard, query getMyProfile
  refuted: getLeaderboard read the everyone-board flag but no longer answered not-found while it is off -> 3 of the 4 tests failed, the board answering while PostHog had no flag, in production and after the switch-off (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: not-found carries no board fact, and leaderboard carries only its state and, while locked, the level it opens at
- the website's leaderboard waits for its unlock: While xp-levels is on and unlocks apply to the member (the unlocks flag on and its launch or their preview moment recorded), getLeaderboard answers the board and getMyProfile's leaderboard reads open only for a member who has opened the Leaderboard; a member it is ready for reads ready, and one it is locked for reads locked with the level it opens at, both with no board facts; while unlocks don't apply the answer is the everyone-board flag's alone; a website read never records the launch, and a member's row on another member's board never depends on their own unlocks.
  over: getLeaderboard and getMyProfile with xp-levels and unlocks off, unlocks on and launched while xp-levels is off, xp-levels on and unlocks switched off after its launch, both on before the launch, and both on after it for a member at level 1, a member at level 3, a member who opened the Leaderboard, a member who was there at the launch, everyone-board off, and a locked member on an opened member's board
  via: WS52: the website's leaderboard waits for its unlock
  because: the website must never show more than Slack shows (WS52, #103, P76): a board Slack still tells a member opens at level 3 must not reach their browser, and a query that ran P77's launch would record it before the owner switches unlocks on, so the website reads only the query-safe check
  crossing: browser -> domain
  entrances: query getLeaderboard, query getMyProfile
  refuted: leaderboardStateOf answered open for every shipped state while unlocks apply, ignoring stateOf's locked and ready -> the locked and the ready member read the board (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: locked carries only the level unlocks' schedule names and ready carries nothing, so neither carries a board fact
- the website's feature states are Unlocks' facts: getMyProfile's features is null while unlocks don't apply to the member (xp-levels off, the unlocks flag off, or neither the launch nor their preview moment recorded) and the leaderboard then is the everyone-board flag's alone; while they apply, each entry's state, readyAt and openedAt are unlocks' own read of the member, its name, opens and level are unlocks' schedule entry, and the leaderboard is the Leaderboard entry's state, or off without one; a website read never records the launch.
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
