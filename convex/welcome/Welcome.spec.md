# Welcome

Welcome: the first kudosGiven subscriber. It records each member it welcomes and asks feedback for the welcome message the first time a Given award names them, as giver or recipient.

## invariants
- welcomed at most once: A member gets the welcome message at most once, ever, whatever Slack redelivers and whichever Given awards name them later.
  over: the welcome messages sent for a first Given award, a redelivery of the Slack event that gave it, and later awards that name the same members as giver or recipient
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
  checklist: resumption-coverage dismissed: no batch resumes from a checkpoint
  checklist: retry-classification dismissed: R44 retries every failure, an unknown result included, until 3 tries; no failure is classified terminal before the bound
