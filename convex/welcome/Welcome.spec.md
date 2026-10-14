# Welcome

Welcome: the first kudosGiven subscriber. It records each member it welcomes and asks feedback for the welcome message the first time a Given award names them, as giver or recipient, with the counterpart by Slack user (the giver for a recipient, the recipients for a giver), and publishes memberWelcomed for each member it welcomes. It welcomes at most 100 members per mutation, each with its welcome row, its delivery and its memberWelcomed, and schedules itself with the event and a cursor over the event's members for the rest (QM10).

## invariants
- welcomed at most once: A member gets the welcome message at most once, ever, whatever Slack redelivers and whichever Given awards name them later.
  over: the welcome messages sent for a first Given award, a redelivery of the Slack event that gave it, later awards that name the same members as giver or recipient, and one Given award naming more members than one page welcomes (QM10)
  via: a member is welcomed at most once, whatever Slack redelivers and whichever awards follow
  because: the welcome is a one-time introduction (R42, R44); without the record of who was welcomed, every Given award naming a member would DM them again and turn the welcome into noise
  refuted: removed the isWelcomed check in welcomeNewMembers -> the test failed on its one-welcome-per-member assertion with 3, 3 and 2 welcomes (2026-10-13)
  kinds: message, state
  checklist: revalidated-permission dismissed: the welcome needs no permission beyond the bot's chat:write scope, which Slack checks when the DM is sent
  checklist: destination-confinement dismissed: the DM goes only to the welcomed member's own Slack user id through Slack's API at one configured base URL, and no response can redirect it
  checklist: message-authenticity dismissed: the kudosGiven event comes from the engine's own transaction, never from outside; the Slack event behind it is covered by signed Slack requests only
  checklist: input-validation dismissed: the subscriber's argument is checked by the kudosGiven event validator, and only the engine publishes the event
  checklist: separation-of-duties dismissed: no approval policy applies to welcoming a member
  checklist: legal-state-succession declared as welcomed at most once
  checklist: supersession-safety dismissed: a welcome is never replaced; the first record stands and every later decision only skips the member
  checklist: retry-recognition dismissed: the subscriber is a mutation Convex runs exactly once; a retried delivery repeats only the DM, which R44 bounds at 3 tries
  checklist: duplicate-suppression declared as welcomed at most once
  checklist: keyed-ordering dismissed: no ordered transport carries the welcome
  checklist: worker-fencing dismissed: no lease or ownership change applies; each subscriber run is one serialized mutation
  checklist: acknowledgment-barrier dismissed: nothing acknowledges the welcome; the Slack event is acknowledged after the mutation that records its award commits
  checklist: commit-ordered-effects dismissed: the DM is scheduled from the subscriber's mutation, and Convex runs a scheduled action only after that mutation commits
  checklist: resumption-coverage dismissed: a page schedules the next one with the same event and the next cursor in the mutation that welcomes its own members, so the pages walk the event's fixed list of members in order and none is left out; a page run again only skips members already welcomed
  checklist: retry-classification dismissed: the Slack adapter's delivery path classifies the DM's failures, retrying every failure, an unknown result included, until 3 tries (R44) and stopping on a gone answer, by its invariant a gone delivery stops for good
- a welcome never schedules past Convex's limit: No mutation of the welcome subscriber schedules 1,000 functions or more, however many new members one Given award names, since each page welcomes at most 100 members (QM10).
  over: one Given award naming 700 new members besides its giver, under a base allowance a maintainer raised, run with Convex's transaction limits on and each welcome page's scheduled functions counted
  via: a welcome never schedules past Convex's limit: one kudos naming 700 new members welcomes each of them once, and no welcome mutation schedules 1,000 functions or more
  because: Convex refuses a mutation that schedules more than 1,000 functions, so one unpaged loop over hundreds of new members, scheduling a delivery and a memberWelcomed subscriber for each, would roll the welcome back and welcome nobody
  refuted: raised membersPerPage in welcomeNewMembers to 100,000 -> the test failed with Convex's "Scheduled too many functions in a single function execution (limit: 1000)" from the first page's requestWelcome (2026-10-14)
  kinds: budget
  checklist: bounded-admission dismissed: nothing admits concurrent work; each page is one serialized mutation
  checklist: fair-admission dismissed: no contenders wait for capacity; the pages run in the order they are scheduled
  checklist: rate-budget dismissed: no time-window budget applies; Slack's rate limits are the delivery path's
  checklist: memory-budget dismissed: no evaluator allocates against a memory budget
  checklist: execution-budget declared as a welcome never schedules past Convex's limit
  checklist: circuit-breaker-policy dismissed: no dependency failures open or close anything here
