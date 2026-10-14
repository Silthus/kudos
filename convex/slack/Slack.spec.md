# Slack

The Slack adapter, the only code that knows Slack: it verifies and acknowledges Slack's requests, normalizes posted and edited messages into countable content for the engine, with their words as ordered segments from the message's rich text, at most its first 2,000, and the channel's visibility, and a message deleted in Slack (a message_deleted, or a message_changed whose message is a tombstone, neither carrying a channel type) into a deletion it hands the engine in the same mutation that records the receipt, which rethrows any failure with a fixed message, since its arguments carry the words, keeps the directory from team_join and user_change in the order Slack sent them, with whether a member is a workspace admin or owner and the email, real name, display name, title and picture Slack gives for them, and fills a person it doesn't know from users.info and, when a maintainer asks, the names it lacks and every known member's email, real name, display name, title and picture from users.list, never logging a Slack answer that can hold them, when a maintainer asks, fills the words of every Given message that has no kudos text yet by reading it from Slack by its exact ts, through conversations.replies on its thread root for a thread reply and conversations.history otherwise, handing a found message's segments to the engine's hydrate and a successful answer without it to the engine as a deletion, leaving a message for a later run on any other answer, one page of messages or one read a job at a time under Slack's Tier 3 limit and after any Retry-After it asks for, with only message refs and the page cursor in its jobs, records the workspace's URL from auth.test, asked after a kudos message the engine doesn't ignore while the URL is unknown and no earlier request is pending, at most one at a time, and when a maintainer asks, builds each kudos's Slack permalink from that URL, the channel and the message's ts, with the thread root for a thread reply, never by a Slack call per message, keeps the workspace's user groups with their handle, name and the people in each from usergroups.list and usergroups.users.list, refreshing one user group from Slack on each subteam_created, subteam_updated and subteam_members_changed and every user group once a day, a Slack plan without user groups answering none and logging nothing, delivers the indicator as a reaction, each private reply as an ephemeral to the giver, the welcome message as a DM, a level-up DM and the DM a ship sweep sends by posting it to the member, with an Open button beside each feature it names and a `Buy` button beside each perk a level-up DM offers, again only while the xp-levels flag is on and the member wants DMs, and leaving out each feature it names that is no longer ready and each line the unlock filter holds back by then, and App Home as a published view of the member's selected tab when they open it, looking the person up again first while the xp-levels flag is on so their admin role is current, when they click in it, after each kudos given, for the giver and every recipient, while the xp-levels flag is on, for every admin after the announcement channel changes, and when their role or membership changes, each tab ending with a link to the website while it is open, except the front door's summary, which ends with its row of website buttons and the hints, published again when the view changed while it was sent, through one delivery path that retries the indicator until it shows and tries every other send at most 3 times, within Slack's per-method rate limits, adds the app to a channel with `/hedgehug`, answers `/hedgehug` with exactly one person mention privately with that person's profile card while the `profile-card` flag is on for the person typing it, from one mutation in the HTTP response when the directory knows them and otherwise through the command's response_url once users.info answers, at most 3 tries within 25 minutes of the command, else the lookup-failed line, a bot or a person who isn't a member getting the not-a-member line and any other text led by a mention the usage line, and as `/hedgehug` while the flag is off, or with `/kudos`, its alias once the manifest registers it, answers `/hedgehug leaderboard`, optionally followed by `week`, `month` or `all`, privately with that period's Everyone board while the `everyone-board` flag is on, or, while the xp-levels and unlocks flags are also on and the member hasn't opened the Leaderboard, with feedback's reply that it is ready to open or opens at level 3, and as `/hedgehug` while it is off, looking a viewer the directory doesn't know up afterwards, at most 3 times, so the board's exposure reaches them, and posts the line a `Buy` clicked in a DM answers with into that DM conversation, tried at most 3 times and only while the skill tree still applies, and turns each click on App Home or on a DM's Open or `Buy` from `/slack/interactivity`, a button or the announcement channel picker, into the platform-neutral command it carries for the one command registry, acknowledged first and then run once per click by its trigger_id, ignoring a click that names a command or a setting the registry doesn't know, such as a removed switch on an App Home published before it was removed. It owns sign-in with Slack: the Auth.js Slack provider asks for `openid profile` in the deployment's own workspace with state and nonce, and maps Slack's claims to the chat identity the website module links by, refusing another workspace, an empty claim or an unset SLACK_WORKSPACE_ID; for a signed-in person the directory doesn't know, verifyMember asks users.info at most 3 times, waiting at least the Retry-After Slack asks for, and writes the directory only from a definite answer, trying again a pending verification whose try was due more than 10 minutes ago from a sweep every 10 minutes, 10 a mutation with the next page scheduled while a page is full. It reports a member's App Home opening, in the mutation that records the event's receipt or, for a person the directory doesn't know yet, once after publishing App Home looks them up, and each command's result, whether or not its reply reaches Slack, looking up a person the directory doesn't know at most 3 times, to the analytics module as usage facts. A usage fact an action records, after looking a person up or for a command, that fails to record is logged with a fixed code and changes nothing the member sees; an opening recorded in the receipt's mutation shares that transaction.

## entrances
- route POST /slack/events: Slack delivers an Events API request, an event callback (a message, a member opening App Home, a member change or a user group change) or the URL verification challenge
  handler: slackEvents in convex/slack/events.ts
  trust: slack-request
- route POST /slack/commands: Slack delivers a slash command a member typed, `/hedgehug` or its alias `/kudos` to add the app to a channel, or with `leaderboard` and an optional `week`, `month` or `all` to see that period's Everyone board, or with a person mention to see that person's profile card
  handler: slackCommands in convex/slack/commands.ts
  trust: slack-request
- route POST /slack/interactivity: Slack delivers a member's click in App Home: a tab, a leaderboard period, the `Show me on the leaderboards` switch, a progression setting, the announcement channel picker, or a link button, whose click names no command and changes nothing
  handler: slackInteractivity in convex/slack/interactivity.ts
  trust: slack-request
- fill missing names: a maintainer runs fillMissingNames once against a deployment, so members the directory recorded before it kept names get the Slack name a board lists ties by
  handler: fillMissingNames in convex/slack/directory.ts
  trust: operator
  control: none — it reads only Slack's users.list with the deployment's own token and only adds a name to a member row that has none, never overwriting a name or any other field
- fill member profiles: a maintainer runs fillMemberProfiles against a deployment once its app has the users:read.email scope, and again whenever they like, so every member the directory already knows gets the email, real name, display name, title and picture Slack gives for them
  handler: fillMemberProfiles in convex/slack/directory.ts
  trust: operator
  control: none — it reads only Slack's users.list with the deployment's own token, writes only those profile fields of a member row the directory already knows and hasn't heard of since the page was asked for, never adds a person and never removes a field
- backfill kudos words: a maintainer runs backfillWords against a deployment once after the kudos text ships, and again whenever they like, so kudos given before it shipped get their words, never reaching the spotlight
  handler: backfillWords in convex/slack/backfill.ts
  trust: operator
  control: none — it reads only Slack's conversations.history and conversations.replies with the deployment's own token, for Given messages the engine already knows, and writes only through the engine's hydrate, which stores words with unknown visibility only where no kudos text or tombstone exists, and the engine's deletion; it never evaluates, awards or replies
- sync user groups: a maintainer runs syncUserGroups against a deployment once its app has the usergroups:read scope, and again whenever they like, so the directory holds every Slack user group with its handle, name and the people in it; a daily cron runs it too
  handler: syncUserGroups in convex/slack/userGroups.ts
  trust: operator
  control: none — it reads only Slack's usergroups.list and usergroups.users.list with the deployment's own token and writes only the directory's user groups and their memberships, never a member row

## invariants
- signed Slack requests only: A request to the Slack events route that Slack did not sign records nothing and reaches no domain function.
  over: the requests slackEvents receives unsigned, signed with another secret, with a body changed after signing or a byte order mark added in front of it, signed more than 5 minutes before or after now, and an unsigned URL verification
  via: R48: a request Slack did not sign gets 401 and records nothing
  because: the route is public, so a forged request must not record a receipt or reach the domain; anyone could otherwise forge kudos (R48)
  crossing: slack-request -> domain
  entrances: route POST /slack/events
  refuted: readSignedBody returned the body whether or not the signature verified -> all 7 rejection cases failed, against the real engine with no processing mock (2026-10-13)
  kinds: identity, credential
  checklist: capability-authorization dismissed: the signing secret proves only that Slack sent the request; no credential carrying bounded permission is accepted
  checklist: revalidated-permission dismissed: nothing is queued between acceptance and processing; the receipt and the processing step run in one transaction
  checklist: message-authenticity declared as signed Slack requests only
  checklist: encrypted-storage dismissed: the signing secret lives only in the deployment's environment variables, never in a row
  checklist: key-rotation-compatibility dismissed: nothing is encrypted; a rotated signing secret replaces the environment variable at once
  checklist: canonical-encoding dismissed: the signature is checked over the raw body as received, never over a re-encoding
  checklist: identity-continuity dismissed: the route carries no member identity across a succession
  checklist: separation-of-duties dismissed: no approval policy applies to receiving an event
- signed Slack commands only: A slash command Slack did not sign gets 401, schedules nothing and makes no Slack call.
  over: the commands slackCommands receives unsigned, signed with another secret, with a body changed after signing, and signed more than 5 minutes ago
  via: R48: a command Slack did not sign gets 401 and does nothing
  because: the route is public, so a forged command must not make the app join a channel or post a reply on anyone's behalf (R48)
  crossing: slack-request -> domain
  entrances: route POST /slack/commands
  kinds: identity, credential
  checklist: capability-authorization dismissed: the signing secret proves only that Slack sent the command; no credential carrying bounded permission is accepted
  checklist: revalidated-permission dismissed: joining a public channel needs no permission beyond the bot's own scopes, which Slack checks when the scheduled action calls it
  checklist: message-authenticity declared as signed Slack commands only
  checklist: encrypted-storage dismissed: the signing secret and the bot token live only in the deployment's environment variables, never in a row
  checklist: key-rotation-compatibility dismissed: nothing is encrypted; a rotated signing secret replaces the environment variable at once
  checklist: canonical-encoding dismissed: the signature is checked over the raw form body as received, never over a re-encoding
  checklist: identity-continuity dismissed: the route carries no member identity across a succession
  checklist: separation-of-duties dismissed: no approval policy applies to adding the app to a channel
- signed Slack interactions only: An interaction Slack did not sign gets 401, runs no command, stores nothing and makes no Slack call.
  over: the App Home interactions slackInteractivity receives unsigned, signed with another secret, with a body changed after signing, and signed more than 5 minutes ago
  via: R42: an interaction Slack did not sign gets 401 and does nothing
  because: the route is public and a click names the member it acts for, so a forged interaction could change anyone's privacy settings, take them off the leaderboards, publish anyone's App Home or, for an admin, change the announcement channel (R42, R48, G22, P65, P69)
  crossing: slack-request -> domain
  entrances: route POST /slack/interactivity
  refuted: slackInteractivity read the body without checking the signature -> all 4 rejection cases failed: each muted the member's notices and published App Home (2026-10-13)
  kinds: identity, credential
  checklist: capability-authorization dismissed: the signing secret proves only that Slack sent the interaction; the command always acts on the clicking member, never on a member the payload names, and the admin-only command reads the clicking member's role from the directory
  checklist: revalidated-permission dismissed: the receipt, the directory lookup of the clicking member, each command's flag and the command run in one mutation scheduled after the acknowledgment
  checklist: message-authenticity declared as signed Slack interactions only
  checklist: encrypted-storage dismissed: the signing secret lives only in the deployment's environment variables, never in a row
  checklist: key-rotation-compatibility dismissed: nothing is encrypted; a rotated signing secret replaces the environment variable at once
  checklist: canonical-encoding dismissed: the signature is checked over the raw form body as received, never over a re-encoding
  checklist: identity-continuity dismissed: the route carries no member identity across a succession
  checklist: separation-of-duties dismissed: no approval policy applies to a member changing their own App Home view, leaderboard setting or progression settings, or to an admin's channel pick
- the indicator converges: After any number of failed, timed-out, rate-limited, repeated or late deliveries, a kudos message shows exactly the latest indicator the app wants on it, and none of the app's earlier ones.
  over: indicator deliveries whose reactions.add or reactions.remove answers an error, an HTTP 5xx or a timeout, a timed-out add that landed, a removal Slack already made, and a desired indicator that changes while a delivery is retrying
  via: R32 R35: the indicator is retried until the message shows it
  because: the indicator is desired state (R32): a giver reads the reaction as the outcome, so a lost or stale reaction would say Given for a message that is Over allowance, or say nothing at all
  refuted: reactionStepsTo in convex/slack/delivery.ts never removes the app's earlier reactions -> 4 of 7 cases failed: the landed timed-out add, the latest indicator after a failed removal, the stale add that landed late, and no_reaction counting as removed (2026-10-13)
  kinds: message
  checklist: destination-confinement dismissed: every delivery goes to Slack's API at one configured base URL, with no redirect followed and no destination taken from input
  checklist: message-authenticity dismissed: deliveries are outbound; the inbound message they answer is verified by signed Slack requests only
  checklist: input-validation dismissed: what is delivered is the feedback module's desired indicator and rendered reply, never outside input
  checklist: retry-recognition declared as the indicator converges
  checklist: duplicate-suppression declared as the indicator converges
  checklist: keyed-ordering declared as the indicator converges
  checklist: acknowledgment-barrier dismissed: nothing retires work on a delivery's acknowledgment; awards and spending commit before any delivery runs
  checklist: retry-classification declared as a gone delivery stops for good
- a private reply is tried at most 3 times: A private reply is sent to Slack at most 3 times on any failure, an unknown result included, and each retry waits at least the Retry-After Slack asked for.
  over: chat.postEphemeral answering an error, an HTTP 5xx, a 429 with Retry-After or a timeout after the reply landed, every time and twice before a success
  via: R35: a private reply is tried at most 3 times
  because: an ephemeral cannot be read back or deleted, so every retry risks a duplicate the giver sees; 3 tries bounds that worst case while a passing Slack failure still reaches the giver (R35, D3)
  refuted: deliverPrivateReply in convex/slack/delivery.ts allowed 4 attempts instead of 3 -> the 4 always-failing cases sent 4 replies (2026-10-13)
  kinds: message
  checklist: destination-confinement dismissed: every delivery goes to Slack's API at one configured base URL, with no redirect followed and no destination taken from input
  checklist: message-authenticity dismissed: deliveries are outbound; the inbound message they answer is verified by signed Slack requests only
  checklist: input-validation dismissed: what is delivered is the feedback module's desired indicator and rendered reply, never outside input
  checklist: retry-recognition dismissed: an ephemeral cannot be read back, so a retry after an unknown result cannot tell whether the first landed; R35 accepts a duplicate only the giver sees and bounds it with this invariant
  checklist: duplicate-suppression declared as a private reply is tried at most 3 times
  checklist: keyed-ordering dismissed: one reply per evaluation, with no ordering promised between messages
  checklist: acknowledgment-barrier dismissed: nothing retires work on a delivery's acknowledgment; awards and spending commit before any delivery runs
  checklist: retry-classification declared as a gone delivery stops for good
- a level-up DM is tried at most 3 times: A level-up DM is tried at most 3 times on any failure of posting it to the member, an unknown result included, each retry waits at least the Retry-After Slack asked for and posts nothing once the member turned DMs off, and no attempt changes the member's XP or level.
  over: chat.postMessage answering an error, an HTTP 5xx or a network failure every time, chat.postMessage answering a 429 with Retry-After once, and a post held by a 429 while the member turns DMs off
  via: R34 R35: a level-up DM is tried at most 3 times
  because: a posted DM cannot be told apart from a lost one after an unknown result, so every retry risks a duplicate the member sees; 3 tries bounds that while a passing Slack failure still reaches them, and the level was earned when the award was recorded, so delivery must never take it back (R34, R35, P63)
  refuted: deliverDirectMessage rescheduled every retry as attempt 1, so the 3-attempt bound never applied -> 2 of 3 cases failed: the always-failing post and the always-failing open each tried 5 times (2026-10-13); witnessed again after retries began carrying the opened conversation: the same break failed 2 of 4 cases the same way (2026-10-13)
  kinds: message
  checklist: destination-confinement dismissed: every delivery goes to Slack's API at one configured base URL, with no redirect followed and no destination taken from input
  checklist: message-authenticity dismissed: deliveries are outbound; the kudos message that earned the level is verified by signed Slack requests only
  checklist: input-validation dismissed: what is delivered is the feedback module's rendered notification for a member from the directory, never outside input
  checklist: retry-recognition dismissed: chat.postMessage is not idempotent and its result can be unknown, so a retry cannot tell whether the first landed; R35 accepts a duplicate only the member sees and bounds it with this invariant
  checklist: duplicate-suppression declared as a level-up DM is tried at most 3 times
  checklist: keyed-ordering dismissed: one DM per level reached, with no ordering promised between DMs
  checklist: acknowledgment-barrier dismissed: nothing retires work on a delivery's acknowledgment; effects records and progress commit before any delivery runs
  checklist: retry-classification declared as a gone delivery stops for good
- a gone delivery stops for good: A delivery whose message or channel is gone (message_not_found, channel_not_found, not_in_channel, is_archived), or whose reaction can never show (not_reactable, invalid_name), is not tried again, and the awards and spending of its message stay.
  over: reactions.add and chat.postEphemeral answering message_not_found, channel_not_found and not_in_channel, and reactions.add answering is_archived, not_reactable and invalid_name
  via: R35: a delivery whose message or channel is gone stops for good
  because: retrying a deleted message or a channel the app left can never succeed and only burns Slack's rate limit for the deliveries that can; the kudos were given when the message was evaluated, so feedback failing must not take them back (R34, R35)
  refuted: attemptCall in convex/slack/delivery.ts no longer classified message_not_found, channel_not_found and not_in_channel as gone -> all 6 cases retried and failed on their one-call assertion (2026-10-13)
  kinds: message
  checklist: destination-confinement dismissed: every delivery goes to Slack's API at one configured base URL, with no redirect followed and no destination taken from input
  checklist: message-authenticity dismissed: deliveries are outbound; the inbound message they answer is verified by signed Slack requests only
  checklist: input-validation dismissed: what is delivered is the feedback module's desired indicator and rendered reply, never outside input
  checklist: retry-recognition dismissed: a gone message or channel is never retried, so there is no retry to recognize
  checklist: duplicate-suppression dismissed: a gone delivery sends nothing more
  checklist: keyed-ordering dismissed: a gone delivery sends nothing more, so there is nothing to order
  checklist: acknowledgment-barrier dismissed: nothing retires work on a delivery's acknowledgment; awards and spending commit before any delivery runs
  checklist: retry-classification declared as a gone delivery stops for good
- a failed directory check is tried again: A directory check that throws, its recheck exhausting Convex's retries on a write conflict or timing out included, is checked again 10 seconds, 1, 5 and 30 minutes later, at most 4 more times, so a kudos from a giver the directory didn't know still gives once a check succeeds.
  over: a check whose recheck fails once, and a check whose recheck fails every time
  via: a failed directory check is tried again
  because: under load the recheck can exhaust Convex's write-conflict retries with the analytics drain and other rechecks; a failed action is never retried by Convex, so without its own retry the message waits as awaiting-directory forever and its kudos never gives (#382, df-1a6af5a1); the bound keeps a check that always fails from rescheduling itself forever
  refuted: checkDirectory's failure retry ladder in convex/slack/directory.ts emptied -> both cases went red: the kudos never gave and the check ran once instead of 5 times (2026-10-14)
  kinds: message
  checklist: destination-confinement dismissed: the check asks only Slack's users.info at the one configured base URL, with no destination taken from input
  checklist: message-authenticity dismissed: the check is a scheduled job with only the message's ref and attempt in its arguments; the message it rechecks was verified by signed Slack requests only
  checklist: input-validation dismissed: a retry carries the same ref and attempt as the check that failed, plus a count it sets itself
  checklist: retry-recognition declared as a message gives kudos at most once
  checklist: duplicate-suppression dismissed: a retry rechecks only while the message still awaits the directory at the same attempt, so a retry after a newer revision or an evaluation changes nothing
  checklist: keyed-ordering dismissed: each retry carries its message's attempt, and an older attempt's retry is ignored
  checklist: acknowledgment-barrier dismissed: nothing retires work on the check's success; the message stays awaiting-directory until a recheck commits
  checklist: retry-classification dismissed: every error the check throws is retried the same way, at most 4 times, since a write conflict and a mutation timeout look alike from the action; an action Convex itself stops (its own timeout or a lost worker) never reaches the retry
- a stranded directory check is checked again: A message still awaiting the directory 86 minutes and 10 seconds after its directory check was due, the span of that check's 4 failure retries with each of its 5 tries running up to Convex's 10-minute action time limit, because Convex stopped the check or all 5 tries failed, gets one fresh check from a sweep every 10 minutes, which counts as one of its directory checks, so a message whose checks keep getting stranded is abandoned once they run out, at most 10 messages a mutation with the next page scheduled while a page is full, while a message whose next check is still ahead, or that has no due time because it waited since before due times were recorded, is left alone, so its kudos still gives once a check succeeds.
  over: a check Convex stopped before it ran, a check whose 5 tries all failed, a stopped check 86 minutes after it was due, a message waiting for its next check after the directory still didn't know a person, a message without a due time, a message whose fresh checks keep failing through 9 sweeps, two sweeps before the fresh check runs, and one more stranded message than a page holds
  via: a stranded directory check is checked again
  because: a check that Convex itself stops or times out never reaches the failure retry, and one whose 5 tries all fail stops for good, so the message waits as awaiting-directory forever and its kudos never gives (#382, #395); waiting out every failure retry and 5 tries that each run to the action limit keeps a live check from being doubled, the due time the engine records keeps a message that waits hours for its next check from being checked early, a check Convex's queue still holds 86 minutes after it was due counts as stranded, and its duplicate can only move the message along its ladder, never give twice, and a row from before the due times has a live job of its own or none to lose (production held no stranded rows on 2026-10-14); 10 rows a mutation keep a page of messages with many mentions within Convex's 16 MiB read limit
  refuted: recheckStranded in convex/slack/directory.ts no longer scheduled a check for the stranded messages it took -> 4 of 8 cases went red: the stopped, the exhausted and the 11 stranded kudos never gave, and two sweeps scheduled no check (2026-10-14)
  kinds: message
  checklist: destination-confinement dismissed: the fresh check asks only Slack's users.info at the one configured base URL, with no destination taken from input
  checklist: message-authenticity dismissed: the sweep is started by Convex's own cron and schedules a check with only the message's ref and attempt; the message was verified by signed Slack requests only
  checklist: input-validation dismissed: the sweep reads only the engine's own rows and passes their stored ref and attempt
  checklist: retry-recognition declared as a message gives kudos at most once
  checklist: duplicate-suppression dismissed: the sweep moves each message it hands a check to due now, so a second run leaves it alone until that check is stranded too, and a check after a newer revision or an evaluation changes nothing
  checklist: keyed-ordering dismissed: the fresh check carries the message's current attempt, and an older attempt's check is ignored
  checklist: acknowledgment-barrier dismissed: nothing retires work on the check's success; the message stays awaiting-directory until a recheck commits
  checklist: retry-classification dismissed: a stranded message is checked again whatever stopped its check, since a lost worker, a timeout and 5 failed tries all leave the same row
- a stranded verification is tried again: A pending verification whose next users.info try was due more than 10 minutes ago, Convex's action time limit, because Convex stopped the try or its attempt failed to record, is tried again by a sweep every 10 minutes, the stranded try counting as one of its 3, so a verification stranded on its last try reads unverified, while a verification waiting out the Retry-After Slack asked for, or one without a due time from before due times were recorded, is left alone, so the person reads member, not-a-member or unverified instead of verifying for good.
  over: a verification Convex stopped before it ran, one stopped 10 minutes before the sweep, one waiting out a 30-minute Retry-After, one without a due time, two sweeps before the fresh try runs, one more stranded verification than a page holds, and one stopped on its third try after 2 failed ones
  via: a stranded verification is tried again
  because: signing in again starts no verification while one is pending, so a try Convex stops, or one whose recordAttempt fails, left the person verifying for good (#382, #395); counting the stranded try keeps the bound of 3 even for a try that never records
  refuted: tryAgainCountingTheStrandedTry in convex/slack/verifyMember.ts no longer scheduled the fresh try -> 3 of 7 cases went red: the stopped person kept reading verifying, two sweeps and a page and one more asked Slack nothing (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the try asks users.info again and writes the directory only from a definite answer
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: the sweep keeps the verification pending with one more try counted, or moves it to failed when that was its last; recordAttempt alone deletes it
  checklist: supersession-safety dismissed: a fresh sign-in after a failed verification resets the row in its own transaction, and the sweep only reads pending rows
  checklist: worker-fencing dismissed: one cron runs the sweep, and it moves each verification it retries to due now, so a second run leaves it alone
  checklist: commit-ordered-effects dismissed: the try is scheduled by the sweep's mutation and runs only after it commits
  checklist: resumption-coverage dismissed: a page that fails ends only that run; the next run finds every stranded verification still pending and overdue
