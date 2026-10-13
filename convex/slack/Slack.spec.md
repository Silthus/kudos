# Slack

The Slack adapter, the only code that knows Slack: it verifies and acknowledges Slack's requests, normalizes posted messages into countable content for the engine, fills the directory from users.info, delivers the indicator as a reaction, each private reply as an ephemeral to the giver and the welcome message as a DM, retrying the indicator and the replies within Slack's per-method rate limits, publishes App Home when a member opens it, and adds the app to a channel with `/kudos`.

## entrances
- route POST /slack/events: Slack delivers an Events API request, an event callback (a message or a member opening App Home) or the URL verification challenge
  handler: slackEvents in convex/slack/events.ts
  trust: slack-request
- route POST /slack/commands: Slack delivers a slash command a member typed, `/kudos` to add the app to a channel
  handler: slackCommands in convex/slack/commands.ts
  trust: slack-request

## invariants
- signed Slack requests only: A request to the Slack events route that Slack did not sign records nothing and reaches no domain function.
  over: the requests slackEvents receives unsigned, signed with another secret, with a body changed after signing or a byte order mark added in front of it, signed more than 5 minutes before or after now, and an unsigned URL verification
  via: R48: a request Slack did not sign gets 401 and records nothing
  because: the route is public, so a forged request must not record a receipt or reach the domain; anyone could otherwise forge kudos (R48)
  crossing: slack-request -> domain
  entrances: route POST /slack/events
  refuted: removed the 401 return for a request whose signature does not verify in slackEvents -> all 6 rejection cases failed on their 401 and no-receipt assertions (2026-10-13)
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
- a gone delivery stops for good: A delivery whose message or channel is gone (message_not_found, channel_not_found, not_in_channel) is not tried again, and the awards and spending of its message stay.
  over: reactions.add and chat.postEphemeral answering message_not_found, channel_not_found and not_in_channel
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
