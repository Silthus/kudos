# Leaderboard

Leaderboard: totals of kudos given per member by day, week, month and all time, fed by the kudosGiven subscriber once per message and by a one-off backfill of the awards given before it shipped, and the Everyone board for this week, this month or all time, ranked and windowed by a pure board function, with the viewer's improvement line against the previous period up to the same day, and the same board whole for the website through rankedBoardOf (every ranked member with their position, rank and tie, the window's positions, and the viewer's standing), and each member's `Show me on the leaderboards` setting, which leaves them off every board. The board ships behind the workspace flag `everyone-board`, safe default off: its totals count while the flag is off, and a member sees the board, the App Home tabs or the `/hedgehug leaderboard` reply only while it is on, with one exposure per member and value from the mutation that decides what they see.

## invariants
- the leaderboard counts kudos given, never kudos received: A board ranks members by the kudos they gave in the period, and kudos a member received never add to their total or put them on a board.
  over: the totals and this week's Everyone board after one member gives kudos to two others in one message and one of them gives kudos back, seen by the member who only received
  via: G13: the board counts kudos given, never kudos received
  because: the leaderboard rewards what a member controls, giving (G13, G15); counting kudos received would turn it into the popularity contest the groups spec rules out and rank most people at the bottom of a list they can't climb
  refuted: countKudosGiven also added each award's kudos to its recipient's period totals -> the test failed on its board assertion, with the member who gave back at 4 and the member who only received ranked 3rd with 3 (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: counting needs no permission; the subscriber runs on the engine's own kudosGiven event, and the board query reads only totals
  checklist: separation-of-duties dismissed: no approval policy applies to counting kudos or showing a board
  checklist: legal-state-succession dismissed: a total only grows by addition; no actors compete for a terminal decision about one subject
  checklist: supersession-safety dismissed: every count adds to a total and nothing displaces a later value; Convex serializes the mutations that touch one total row
  checklist: worker-fencing dismissed: each subscriber run is one serialized mutation; no lease or ownership applies
  checklist: commit-ordered-effects dismissed: counting issues no external effect; the board is read when a member asks for it
  checklist: resumption-coverage dismissed: this invariant is about which kudos count, not about a batch; the backfill's resumption is covered by every award counts once, live or backfilled
- the improvement line never states a loss: The viewer's line under a board reports kudos gained and places climbed, never kudos or places lost; without a gain it names their best completed period, or nothing.
  over: the improvement line of a viewer who gave fewer kudos than last period up to the same day, or kept a gain while falling in position
  via: G18: the improvement line
  because: the line is there to encourage (G18); a line that told a member they gave less, or dropped places, would turn a private nudge into a reproach
  kinds: state
  checklist: revalidated-permission dismissed: the line is computed for the viewer from totals when they ask; no permission applies
  checklist: separation-of-duties dismissed: no approval policy applies to showing a member their own progress
  checklist: legal-state-succession dismissed: the line is derived on every read and holds no state of its own
  checklist: supersession-safety dismissed: the line is derived on every read; nothing is written that a later value could displace
  checklist: worker-fencing dismissed: one read-only query computes the line; no lease or ownership applies
  checklist: commit-ordered-effects dismissed: computing the line issues no external effect
  checklist: resumption-coverage dismissed: no batch resumes from a checkpoint; the line is computed in one query
- a member who left the boards is on nobody's board: A member whose `Show me on the leaderboards` setting is off is on no viewer's Everyone board for any period, their own included, which says `You're not on the leaderboards. You can change that in Settings.` in place of their rows and keeps their gain line without places; turned on again, they are back.
  over: this week's, this month's and all time's Everyone board seen by the member who turned the setting off and by another member, through `/hedgehug leaderboard` and the Leaderboard tab
  via: G22: a member who left the boards is on nobody's board, their own included
  because: leaving the boards is the member's own choice (G22); a board that still listed them, to anyone, would show the standing they asked to keep private
  refuted: entryOf no longer left out the members whose setting is off -> the test failed on the other member's board, with the member who left ranked 1st with 3 (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: the setting is read on every board, in the query that renders it
  checklist: separation-of-duties dismissed: no approval policy applies to a member leaving or rejoining the boards
  checklist: legal-state-succession dismissed: the setting is on or off; the command sets it to the value the clicked button carries, so a repeated click changes nothing
  checklist: supersession-safety dismissed: the latest click wins; Convex serializes the mutations that write one member's setting row
  checklist: worker-fencing dismissed: one serialized mutation writes the setting; no lease or ownership applies
  checklist: commit-ordered-effects dismissed: the board is read when it is viewed; App Home is published after the setting commits
  checklist: resumption-coverage dismissed: no batch resumes from a checkpoint; the setting is one row per member
- every award counts once, live or backfilled: The totals count each Given message's awards exactly once, whether the kudosGiven subscriber or the backfill of earlier kudos reaches the message first, and however often either runs.
  over: the totals after the backfill counts one earlier award, is interrupted, a member gives kudos while it is stopped and the subscriber counts them, and the backfill runs again over every award
  via: G44: an award given while the backfill runs counts once
  because: G14 counts every award given before the leaderboard shipped and G44 counts each award once; the backfill and the subscriber both reach awards given while it runs, and a second count would rank that giver above what they gave
  refuted: countGiven no longer skipped a message its countedKudosGiven row marks as counted -> the test failed on its board assertion, with the kudos given while the backfill was stopped counted twice for their giver (2026-10-13)
  kinds: state
  checklist: revalidated-permission dismissed: counting needs no permission; the backfill is an internal function the ship ticket runs once from the CLI
  checklist: separation-of-duties dismissed: no approval policy applies to counting kudos
  checklist: legal-state-succession dismissed: a message is counted or not; the countedKudosGiven row is written in the same transaction as the totals it adds to
  checklist: supersession-safety dismissed: every count adds to a total and nothing displaces a later value; Convex serializes the subscriber's and the backfill's mutations on one message's countedKudosGiven row
  checklist: worker-fencing dismissed: each page of the backfill and each subscriber run is one serialized mutation; no lease or ownership applies
  checklist: commit-ordered-effects dismissed: counting issues no external effect
  checklist: resumption-coverage dismissed: the backfill keeps no checkpoint; a resumed run starts again from the first award, and every message it already counted is skipped by its countedKudosGiven row
- the Everyone board is invisible while everyone-board is off: Without the flags key, without an everyone-board flag in PostHog, or in production while the flag is on in the sandbox only, `/hedgehug leaderboard` does what `/hedgehug` does, App Home shows only the member's own kudos, without tabs, and a button left from while the flag was on changes no setting and republishes App Home without tabs.
  over: `/hedgehug leaderboard month` and App Home opened in each of the three off states, and a Leaderboard and a Settings click left from App Home published while the flag was on
  via: #83: the Everyone board is invisible while everyone-board is off
  refuted: isEveryoneBoardShownTo answered true without reading the everyone-board flag -> all 7 tests under the describe failed on their assertions, the command answering with the board and App Home showing its tab bar (2026-10-13)
  because: every new member-facing slice reaches production behind a flag whose safe default is off (the owner's rule, 2026-10-13; O33), so with the flag off a member must see exactly the core loop's App Home and `/hedgehug`, and nothing of the board
  kinds: message, state
  checklist: revalidated-permission dismissed: the flag is read for the workspace in the mutation that decides what the member sees, on every command, opening and click
  checklist: separation-of-duties dismissed: the flag is switched in PostHog by the owner, outside this deployment
  checklist: legal-state-succession dismissed: the gate writes no board state of its own; while off, a click writes no selection or setting
  checklist: supersession-safety dismissed: the flag value is read fresh on every request; nothing stored records it except the exposure, which is per value
  checklist: worker-fencing dismissed: one mutation reads the flag and decides; no lease or ownership applies
  checklist: commit-ordered-effects dismissed: App Home is published after the mutation that read the flag commits; the command replies after its mutation returns
  checklist: resumption-coverage dismissed: no batch resumes from a checkpoint; the totals the board reads keep counting while it is off
  checklist: destination-confinement dismissed: the gate adds no destination; the command still answers its own response or `/hedgehug`'s, and App Home is published to the member who opened or clicked it
  checklist: message-authenticity dismissed: every command, event and click is verified by the Slack signature before the gate is reached
  checklist: input-validation dismissed: the gate reads only the workspace and user Slack sent; the command's arguments and the click's command are validated as before
  checklist: retry-recognition dismissed: a redelivered event or click is recognized by its receipt before the gate runs, and the gate itself changes nothing a retry could repeat except the exposure, which is deduplicated
  checklist: duplicate-suppression dismissed: one exposure per member, flag and value, deduplicated in the mutation that sends it (O36)
  checklist: keyed-ordering dismissed: the flag is read fresh on every request, so the order of requests does not change what a later one sees
  checklist: acknowledgment-barrier dismissed: the command acknowledges with its reply or `/hedgehug`'s empty 200, and events and clicks are acknowledged before the gate runs in their scheduled functions
  checklist: retry-classification dismissed: reading the flag never throws (O33); a failure to read answers the safe default, so the gate adds no failure to classify
