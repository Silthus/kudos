# Slack

The Slack adapter, the only code that knows Slack: it verifies and acknowledges Slack's requests and hands them to the domain.

## entrances
- route POST /slack/events: Slack delivers an Events API request, an event callback or the URL verification challenge
  handler: slackEvents in convex/slack/events.ts
  trust: slack-request

## invariants
- signed Slack requests only: A request to the Slack events route that Slack did not sign records nothing and reaches no domain function.
  over: the requests slackEvents receives unsigned, signed with another secret, with a body changed after signing, signed more than 5 minutes before or after now, and an unsigned URL verification
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
