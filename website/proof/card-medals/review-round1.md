Three findings hold:

1. **P2 — The flag-off answer does not gate the panel.** [ProfileCardPanel.tsx:10](/tmp/i284/review/tree/website/src/home/ProfileCardPanel.tsx:10) renders “What teammates see”, “Public” and “Everyone can see this card” even when `getProfileCard` returns `not-found`. This contradicts the conductor’s explicit gating instruction. **Fix:** return nothing for `not-found` and update the test that currently requires the panel to remain visible.

2. **P2 — Loading and failed reads look like a successful card without medals.** [ProfileCardPanel.tsx:8](/tmp/i284/review/tree/website/src/home/ProfileCardPanel.tsx:8) collapses both states to `[]`. A member with an opened Book and four public medals sees an apparently complete, medal-free card when the subscription fails. **Fix:** distinguish loading and failure visibly; mark loading as busy and show an error message for failure. Test an actual query `Error` through the live shell with independent responses per query.

3. **P2 — An unopened Book entry does not prove teammates can see medals.** [ProfileCardPanel.tsx:22](/tmp/i284/review/tree/website/src/home/ProfileCardPanel.tsx:22) bases that promise solely on the member’s unlock path. During a member-only achievements rollout, the Book can be locked on that path while workspace achievements are off; `bookAppliesIn` then suppresses medals in Slack too. **Fix:** use wording that states only the own-card restriction, or obtain authoritative workspace visibility before asserting teammate visibility. Cover this rollout state in a test.

The home-only subscription, returned medal order, private-Book separation, row presentation and group deferral look correct. Isolated panel axe checks passed in both modes; medal contrast was at least **3.91:1**. The full suite was not run because this checkout lacks dependencies.

**Verdict: Request changes for read-state handling and misleading copy.**