Findings against the supplied `diff.patch`; line numbers refer to that snapshot:

1. **Medium — website/src/crates/RevealDialog.tsx:124 — An already-queued crate opens twice.** If Leaderboard and Book answers arrive together while the ready list still contains Book, clicking “Open the next one” sends another Book command despite its reveal already being queued. I reproduced two consecutive “Book is open” reveals. **Fix:** advance to an existing queued reveal without resending its command, and deduplicate queued crates by `seen`. Add a test with overlapping answers and a stale ready list.

2. **Medium — website/src/crates/RevealDialog.tsx:128 — Tab escapes while the next crate opens.** The button remains focusable with `aria-disabled`, but `actionSelector` at line 202 excludes it from the focus trap. Clicking it and pressing Tab moved focus to `BODY` in the reproduction. **Fix:** include focusable, aria-disabled buttons in the trap. Test Tab and Shift+Tab during a deferred response.

3. **Medium — website/src/crates/RevealDialog.tsx:119 — A profile update removes the focused pending button.** When the last other crate leaves the ready list before its command resolves, `NextCrate` returns `null`, removing “Opening…”. The app then attempts to focus the underlying, inert page’s h1. **Fix:** retain the requested crate and its button until the attempt settles or its queued reveal takes over. The existing focus test never updates the profile during the request.

4. **Medium — website/src/crates/RevealDialog.tsx:113 — Retries can target a crate that is no longer ready.** `asked` permanently overrides `othersReady[0]`. After an unreachable Quests attempt, opening Quests in Slack and receiving a profile update leaves Book ready, but this button still retries Quests. I reproduced that incorrect target. **Fix:** retain `asked` while pending or queued; after failure, reconcile it with the current ready list.

5. **Medium — website/src/crates/RevealDialog.tsx:127 — The new separator fails V24.** Its default `border-t` uses `--border` against `--card`, measuring approximately **1.41:1 light / 1.20:1 dark**, below the specified 3:1. The new contrast tests omit this border. **Fix:** use a border color meeting 3:1 in both modes and include it in the token-based checks.

6. **Low — website/src/featureGates.test.tsx:173 — The crate-border test can pass with an invisible border.** It compares `band-night-edge` with `band-night` without checking that the rendered outline uses that token. Removing the `.night-band` override or outline stroke assignment leaves this test green while the outline falls back to night-on-night, approximately 1:1. **Fix:** verify the rendered border’s color binding as well as its ratio.

The checklist names shipped facts and quotes P94 correctly. The existing hold on queued claimed-reward flights remains intact. The checkout advanced during review; its newer code appears to address findings 2–4.

**Verdict: request changes on the supplied diff.**
