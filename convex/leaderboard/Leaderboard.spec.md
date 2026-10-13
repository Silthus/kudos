# Leaderboard

Leaderboard: totals of kudos given per member by day, week, month and all time, fed by the kudosGiven subscriber once per message and by a one-off backfill of the awards given before it shipped, and the Everyone board for this week, this month or all time, ranked and windowed by a pure board function, with the viewer's improvement line against the previous period up to the same day.

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
