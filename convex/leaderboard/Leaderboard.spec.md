# Leaderboard

Leaderboard: totals of kudos given per member by day, week, month and all time, fed by the kudosGiven subscriber once per message, and the Everyone board for this week, ranked and windowed by a pure board function.

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
  checklist: resumption-coverage dismissed: no batch resumes from a checkpoint; the backfill of earlier kudos (G14) is its own ticket
