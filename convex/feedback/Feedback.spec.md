# Feedback

Feedback: the indicator on each kudos message as desired state and the private reply to its giver, both written with the outcome and delivered by the adapter afterwards, and the copy every reply is rendered from: the private replies, the welcome message, App Home with its Profile, Leaderboard and Settings tabs and the tab and leaderboard period each member last selected, or only the member's own kudos, without tabs, while the `everyone-board` flag is off, with a link to the website beside the member's own kudos while the website module gives one, the `/hedgehug` replies, and the rows of a board with its improvement line, all naming the product HedgeHug.

## invariants
- private replies reach only the giver: A private reply about a kudos message reaches only its giver: an ephemeral to the message's author beside the message, in the thread for a thread reply and in the channel otherwise, and nobody else, recipients included, is sent anything about it.
  over: every message the app asks Slack to send for a Given, an Over allowance and an Invalid kudos message, posted in a channel and in a thread
  via: R33: replies reach only the giver
  because: R33 keeps feedback private: the giver alone learns what was spent, who was skipped and why, and a recipient or a channel must never get a message the giver did not write; a reply sent to the wrong person or posted publicly would leak allowance and skipped-mention reasons
  refuted: sendPrivateReply posted the reply with chat.postMessage instead of chat.postEphemeral -> all 6 cases failed on their only-an-ephemeral-to-the-giver assertion, with every welcome DM named (2026-10-13)
  kinds: output, message
  checklist: destination-confinement dismissed: the reply goes to the Slack Web API at one configured base URL, with no redirect followed and no destination taken from input
  checklist: message-authenticity dismissed: the reply is outbound; the inbound message it answers is verified by the Slack adapter's signed Slack requests only
  checklist: redaction dismissed: a reply holds only the app's copy and mentions, never the message's text, so there is nothing designated sensitive to scrub
  checklist: input-validation dismissed: the reply is rendered from the engine's outcome, never from outside input
  checklist: retry-recognition dismissed: retrying a reply is the Slack adapter's delivery, which bounds it by its invariant a private reply is tried at most 3 times; a retry resends the same stored reply to the same giver, so it cannot widen who is told
  checklist: duplicate-suppression dismissed: the reply is written once in the evaluation's transaction, and a redelivered event never re-runs the evaluation (R19)
  checklist: keyed-ordering dismissed: one reply per evaluation, with no ordering promised between messages
  checklist: acknowledgment-barrier dismissed: nothing retires work on the reply's acknowledgment
  checklist: commit-ordered-effects dismissed: the reply row and its delivery are scheduled in the evaluation's transaction, and the delivery runs only after it commits
  checklist: retry-classification dismissed: the Slack adapter's delivery classifies failures, by its invariants a private reply is tried at most 3 times and a gone delivery stops for good
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack delivery
  checklist: declared-target-coverage dismissed: a reply has exactly one target, the giver
