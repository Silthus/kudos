# Feedback

Feedback: the indicator on each kudos message as desired state and the private reply to its giver, both written with the outcome and delivered by the adapter afterwards; notifications as DM intents to one member that honour their DM setting (on unless turned off): one level-up DM per level up Unlocks records, sent from the mutation that makes its features ready and naming each of them with an Open button; the one public reply per kudos message as desired state, whose sections modules set and whose routing (the announcement channel and muted notices) feedback decides; App Home as desired state: one homes row per member holds the tab shown and a version that every change to what it shows bumps (a level reached, a feature made ready, a command), with a Profile tab (allowance, level, XP to the next level, skill points saved from level 5 once the skill tree is open, each ready feature with what it opens and an Open button, the next shipped feature still locked, kudos given and received), a Settings tab (muting notices, DMs) and, for workspace admins and owners, an Admin tab with the announcement channel picker; all of it about XP and levels shown only while the xp-levels flag is on, with App Home falling back to the core loop's allowance, totals and hints while it is off; and the copy every reply is rendered from: the private replies, the welcome message, the level-up DM (which names saved skill points, for the skill tree, only from level 5 and only once the member has opened the skill tree, and each feature the level up made ready with what it opens, as App Home does), the public level notice, App Home and the `/hedgehug` replies, all naming the product HedgeHug. The unlock filter asks Unlocks' stateOf before any line that tells a member about their own progress in a feature, and leaves the line out until that member has opened the feature; Unlocks' own lines, the ready crates and Next, are exempt, and the filter never changes what is earned or stored.

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
- a feature's lines wait for its opening: A member is told nothing about their own progress in a feature, in a DM or in App Home, until they have opened it: while the feature is unshipped, and while it is only ready, the level-up DM and the Profile tab name none of it, its ready crate and the Next line aside, and once it is open they show it in full; what the member earned for it is stored all the same.
  over: the level-up DMs and App Home views the app asks Slack to send to a member reaching levels 5 and 6, with the skill tree unshipped, shipped and ready, and opened, and the member's stored skill points
  via: P76: a feature's lines wait for its opening
  because: P76 keeps a member's view in step with what they chose to open, and P78 says a feature that hasn't shipped is never named or teased; skill points belong to the skill tree, which hasn't shipped, so a level-up DM that named saved skill points would tease a feature nobody can open, while P4 and P75 still earn the points from level 5 so the tree finds them when it opens
  kinds: output
  checklist: destination-confinement dismissed: the DM and App Home go to Slack's API at one configured base URL, to the member's own DM conversation and App Home, with no destination taken from input
  checklist: redaction dismissed: the filter leaves lines out by the member's own unlock state, and nothing designated sensitive is scrubbed from what remains
  checklist: commit-ordered-effects dismissed: the filter reads unlock state in the mutation or query that renders the DM or App Home, and the DM's delivery is scheduled in that mutation and runs only after it commits
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack delivery
  checklist: declared-target-coverage dismissed: a DM and an App Home each have exactly one target, the member they are about
