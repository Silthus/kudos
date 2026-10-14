# Review: GPT-6.1 Sol (high), read-only, round 1

Run with `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only` on a frozen copy of `9a0b907`, with the spec, the ticket and the brief as the oracle. The first attempt stopped at "model is at capacity"; the second answered. The answer, verbatim:

- **major — convex/website/buyPerk.test.ts:354:** The weakened assertion accepts behavior forbidden by WS88’s query-safe gate and `WebsiteReads.spec.md:140` (“writes nothing and stores nothing”). The analytics exclusions concern D17 equivalence, not gate refusals. **Fix:** make the gate evaluate member flags without writing and restore the strict assertion.

- **minor — convex/website/buyPerk.test.ts:147:** Even if an analytics exception were approved, this helper permits an ID for any member, a duplicate ID for an already identified member, and unlimited new `identifyNewPeople` jobs. **Fix:** constrain the exact member, existing-ID case, and job count, arguments and scheduling.

- **major — website/proof/sandbox-4/sandbox-deploy.txt:22:** The log exposes the Convex team/project identifiers and dashboard path. Personal-name references also remain in `README.md:24` and the new journal’s lines 4–5. **Fix:** replace these with placeholders throughout the committed artifacts.

- **major — website/proof/sandbox-4/README.md:61:** “Job rows are identical” and “no … republish was scheduled” exceed the evidence. The artifact contains grouped counts for only the newest 200 jobs; replacement jobs can leave those counts unchanged. **Fix:** capture stable pseudonymized job IDs and timestamps across the complete proof interval, then compare additions.

- **major — website/proof/sandbox-4/README.md:38:** No artifact establishes the one-human/one-bot roster or prior self-kudos refusals. Those unsupported assertions justify skipping the sandbox’s central purchase and earned-tier checks; they also do not address the brief’s permitted internal paths. **Fix:** add redacted supporting evidence and explain the internal-path limitation, or qualify these states as unexercised rather than impossible.

- **minor — website/proof/sandbox-4/README.md:42:** The claimed append-only session creation, exact row counts and expiry have no supporting artifact. Refresh logs establish neither append-only behavior nor those details. **Fix:** add sanitized before/after session metadata without credentials, or remove the unsupported specifics.

- **minor — website/proof/sandbox-4/README.md:26:** Generic `Server Error` responses do not establish that production lacks these functions. **Fix:** provide sanitized missing-function diagnostics or deployment-version evidence, or report only the observed errors.

- **minor — website/proof/sandbox-4/README.md:80:** The claimed review links to `review-gpt-6.1-sol.md`, which is absent. **Fix:** commit the actual review and dispositions, or remove the completed-review claim.

## Dispositions

1. **Major, fixed.** WS88's gate checks "with query-safe reads", and the invariant says a refusal at the gate "writes nothing and stores nothing". The test change is reverted, and `buyPerk`'s gate now reads through a read-only view of the mutation's context (`queryOnly` in `convex/website/commands.ts`), so the gate's member decision can't write a first analytics ID. Red: [`red-r1.txt`](red-r1.txt). Green: [`green-r1.txt`](green-r1.txt). Decision `d-909985ae` is replaced by the decision recorded with the fix.
2. **Minor, moot.** The helper it names is gone with the revert.
3. **Major, partly fixed.** The Convex team and project names and the dashboard path in `sandbox-deploy.txt` are redacted. **Rejected:** the owner's first name, as the person who decided production is live. It isn't the sandbox member's displayed name or picture, which no screenshot shows, and it already appears in 27 committed proof and journal files.
4. **Major, fixed.** [`launch-and-purchase-tables.txt`](launch-and-purchase-tables.txt) now lists every scheduled function created after the deploy finished, each with its ID, creation time, name and state, read with `--limit`, which takes the newest rows. The proof run created none.
5. **Major, fixed.** The tables file now carries the roster (one `member` row and one `bot` row) and every stored kudos message's author, mentions and state: each names only its own author and is `invalid`. The README says the open states were not exercised on the sandbox, rather than impossible, and why no internal path reaches them without hand-written rows.
6. **Minor, fixed.** The tables file carries the proof user's session and refresh-token rows, with creation and expiry times and no IDs or tokens.
7. **Minor, fixed.** [`public-functions.txt`](public-functions.txt) lists each deployment's public functions from `convex function-spec`, read-only: production has `getMyProfile` and lacks `getSkillTree`, `getBook` and `buyPerk`.
8. **Minor, fixed.** This file.
