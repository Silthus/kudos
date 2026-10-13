# Slack

The Slack adapter, the only code that knows Slack: it verifies and acknowledges Slack's requests, normalizes posted and edited messages into countable content for the engine, keeps the directory from team_join and user_change in the order Slack sent them and fills a person it doesn't know from users.info, delivers the indicator as a reaction, each private reply as an ephemeral to the giver, the welcome message as a DM, a level-up DM by opening the member's DM conversation and posting to it, and App Home as a published view when a member opens it, looking the person up again first, while the xp-levels flag is on, so their admin role is current, and again whenever their home's version changes, publishing once more when a newer version came in meanwhile; it turns a member's App Home click from `/slack/interactivity` into a command for the command registry while the xp-levels flag is on, and otherwise only republishes their App Home, applying each click once by its trigger and ignoring one that names a command or a setting the registry doesn't know, such as a removed switch on an App Home published before it was removed, and keeps whether a member is a workspace admin or owner in the directory, republishing a member's App Home when that role or their membership changes; all through one delivery path that retries the indicator until it shows and tries every other send at most 3 times, within Slack's per-method rate limits, and adds the app to a channel with `/hedgehug`, or with `/kudos`, its alias once the manifest registers it. It reports a member's App Home opening, in the mutation that records the event's receipt or, for a person the directory doesn't know yet, once after publishing App Home looks them up, and each command's result, whether or not its reply reaches Slack, looking up a person the directory doesn't know at most 3 times, to the analytics module as usage facts. A usage fact an action records, after looking a person up or for a command, that fails to record is logged with a fixed code and changes nothing the member sees; an opening recorded in the receipt's mutation shares that transaction.

## entrances
- route POST /slack/events: Slack delivers an Events API request, an event callback (a message or a member opening App Home) or the URL verification challenge
  handler: slackEvents in convex/slack/events.ts
  trust: slack-request
- route POST /slack/commands: Slack delivers a slash command a member typed, `/hedgehug` or its alias `/kudos` to add the app to a channel
  handler: slackCommands in convex/slack/commands.ts
  trust: slack-request
- route POST /slack/interactivity: Slack delivers a member's click in App Home, a tab, a progression setting or the announcement channel picker
  handler: slackInteractivity in convex/slack/interactivity.ts
  trust: slack-request

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
- signed Slack interactions only: An interaction Slack did not sign gets 401, dispatches no command, changes no setting and makes no Slack call.
  over: the interactions slackInteractivity receives unsigned, signed with another secret, with a body changed after signing, and signed more than 5 minutes ago
  via: R42: an interaction Slack did not sign gets 401 and does nothing
  because: the route is public and a click names the member it acts for, so a forged interaction could change anyone's privacy settings or, for an admin, the announcement channel (R42, P65, P69)
  crossing: slack-request -> domain
  entrances: route POST /slack/interactivity
  refuted: slackInteractivity read the body without checking the signature -> all 4 rejection cases failed: each muted the member's notices and published App Home (2026-10-13)
  kinds: identity, credential
  checklist: capability-authorization dismissed: the signing secret proves only that Slack sent the interaction; the acting member is the one Slack names, and an admin-only command checks the directory itself
  checklist: revalidated-permission dismissed: the command runs in the request itself, right after the signature is checked; nothing is queued in between
  checklist: message-authenticity declared as signed Slack interactions only
  checklist: encrypted-storage dismissed: the signing secret lives only in the deployment's environment variables, never in a row
  checklist: key-rotation-compatibility dismissed: nothing is encrypted; a rotated signing secret replaces the environment variable at once
  checklist: canonical-encoding dismissed: the signature is checked over the raw form body as received, never over a re-encoding
  checklist: identity-continuity dismissed: the route carries no member identity across a succession
  checklist: separation-of-duties dismissed: no approval policy applies to a member's own settings or an admin's channel pick
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
- a level-up DM is tried at most 3 times: A level-up DM is tried at most 3 times on any failure of opening the member's DM conversation or posting to it, an unknown result included, each retry waits at least the Retry-After Slack asked for and posts to the conversation already opened, and no attempt changes the member's XP or level.
  over: conversations.open and chat.postMessage answering an error, an HTTP 5xx or a network failure every time, chat.postMessage answering a 429 with Retry-After once, and a post held by a 429 and then failing
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
