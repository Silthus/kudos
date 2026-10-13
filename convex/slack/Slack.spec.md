# Slack

<<<<<<< HEAD
The Slack adapter, the only code that knows Slack: it verifies and acknowledges Slack's requests, normalizes posted and edited messages into countable content for the engine, fills the directory from users.info, delivers the indicator as a reaction and each private reply as an ephemeral to the giver, and adds the app to a channel with `/kudos`.
=======
The Slack adapter, the only code that knows Slack: it verifies and acknowledges Slack's requests, normalizes posted messages into countable content for the engine, fills the directory from users.info, delivers the indicator as a reaction, each private reply as an ephemeral to the giver and the welcome message as a DM, publishes App Home when a member opens it, and adds the app to a channel with `/kudos`.
>>>>>>> origin/spec/core-loop

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
