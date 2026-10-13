# Feedback

Feedback: the indicator on each kudos message as desired state and the private reply to its giver, both written with the outcome and delivered by the adapter afterwards; notifications as DM intents to one member that honour their DM setting (on unless turned off), sent first for each levelReached; the one public reply per kudos message as desired state, whose sections modules set and whose routing (the announcement channel, muted notices and hidden levels) feedback decides; and the copy every reply is rendered from: the private replies, the welcome message, the level-up DM, the public level notice, App Home and the `/hedgehug` replies, all naming the product HedgeHug.

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
- one public reply per kudos message: A kudos message gets at most one public reply in each place it is celebrated, its thread or the announcement channel: the reply is posted once and then edited in place as sections arrive, however many members level up through the message and whenever their sections arrive, and a post whose outcome is unknown, or that failed after Slack accepted it, is never posted again.
  over: every public reply the app asks Slack to post or edit for a kudos message: one member and two members levelling up through it, a level reached after the reply was posted, one reached while the post is in flight, a post whose answer is lost and one that failed after Slack accepted it
  via: D18: the one public reply
  refuted: setPublicSection also scheduled a delivery while the reply was still posting -> the two-members test found 2 posts in the thread where 1 belongs (2026-10-13)
  because: D18 keeps the channel calm: progress from one kudos message is celebrated in one reply that grows, and a second reply in the thread, from two subscribers racing to post or from a retried post that had landed, would repeat the celebration for everyone in the channel
  kinds: message, output
  checklist: destination-confinement dismissed: the reply goes to the Slack Web API at one configured base URL, to the kudos message's conversation or the workspace's announcement channel, with no redirect followed and no destination taken from a request
  checklist: message-authenticity dismissed: the reply is outbound; the kudos message behind it is verified by the Slack adapter's signed Slack requests only
  checklist: redaction dismissed: a section holds only the app's copy and a member mention, never the kudos message's text or its giver as giver (R45: a recipient's notice states only their progress)
  checklist: input-validation dismissed: sections are set from levelReached, which Convex validates at the subscriber's boundary and only progression publishes
  checklist: retry-recognition declared as one public reply per kudos message
  checklist: duplicate-suppression declared as one public reply per kudos message
  checklist: keyed-ordering dismissed: sections are keyed by member and replaced in place, and every delivery re-reads the latest version after it lands and edits again when it changed, so the last edit Slack shows is the latest desired reply
  checklist: acknowledgment-barrier dismissed: a reply is claimed as sending before chat.postMessage and leaves that state only on Slack's known answer: posted with its ts, or back to posting on a known failure; anything else leaves it sending, never posted again
  checklist: commit-ordered-effects dismissed: the reply row and its delivery are scheduled in the subscriber's transaction, and the delivery runs only after it commits
  checklist: retry-classification dismissed: the Slack adapter's delivery classifies failures; a known failure of the post or an edit is retried at most 3 times, a gone destination stops, and a post with no known result stops for good
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack delivery
  checklist: declared-target-coverage dismissed: a reply has exactly one target, chosen by routing
