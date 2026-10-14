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

# Round 2, on a frozen copy of `ca06e81`

The same command, over the read-only gate (`06d7e56`), the front-door test (`2e56706`) and the README. A faulty retry check reran it, so three answers came back. Each, verbatim:

## Answer 1

No product-code findings. `queryOnly` preserves Convex’s required reader methods, `db.system`, and context members. First-ID flag differences follow F14’s query fallback: the gate matches the page, and D17 still decides the purchase. `/skills` is correct; `frontDoor.test.ts:333` retains the reachable Journey-to-home coverage.

- **Minor — [README.md:3](website/proof/sandbox-4/README.md:3):** “Every artifact” was captured on the final deploy contradicts the earlier committed flag answers and review/test logs. **Fix:** limit the claim to refreshed sandbox calls, snapshots and screenshots; identify historical evidence separately.
- **Minor — [README.md:51](website/proof/sandbox-4/README.md:51), [review-gpt-6.1-sol.md:28](website/proof/sandbox-4/review-gpt-6.1-sol.md:28):** Session timestamps now support existence and expiry, but both snapshots follow session creation. They cannot establish append-only setup, so disposition 6 remains partly unresolved. **Fix:** add sanitized pre-creation evidence with stable pseudonyms, or remove the append-only claim and qualify the disposition.

## Answer 2

No product-code findings in `queryOnly` or the `/skills` expectation. Convex 1.46’s reader methods and context members are preserved. Without an analytics ID, query and mutation flag decisions can differ; WS88 requires the page’s query-safe gate first.

- **Minor — convex/slack/frontDoor.test.ts:320:** The changed expectation is correct, but no test now covers a ready feature whose page is unlisted falling back to home. The Journey test uses a different helper. **Fix:** retain `/skills` coverage and add an unlisted-route fallback case.

- **Minor — website/proof/sandbox-4/README.md:11:** Workspace fallback occurs only without an analytics ID; identified members retain their member decision, including email conditions. **Fix:** qualify the explanation.

- **Minor — website/proof/sandbox-4/README.md:51:** “Two appended refresh-token rows with the same expiry” contradicts the snapshots, which show additional refresh rows expiring November 13. A pre-creation snapshot is also absent, so append-only creation remains unproven despite disposition 6. **Fix:** distinguish the manually created rows from later refreshes and provide before/after evidence, or remove the unsupported claim.

- **Minor — website/proof/sandbox-4/README.md:3:** “Every artifact” captured on the final deploy at 09:06–09:10 is false: flag definitions are from 08:16, and earlier red/green logs remain. **Fix:** scope this statement to the fresh sandbox captures.

## Answer 3

`queryOnly`’s Convex reader construction is sound, and `/skills` is the correct destination. Three findings:

- **Major — [commands.ts:95](convex/website/commands.ts:95):** The Journey guard checks workspace flags, but D17 evaluates member flags. With Quests enabled only for the buyer’s email and no Journey start recorded, `buyPerk` succeeds and `showHomeTab → questsLiveFor` starts their preview and joins the Journey. Reproduced with the actual handlers, both with and without an existing analytics ID: `bought`, a new Journey preview, and `first-thanks` activation. This violates WS62’s prohibition on website-triggered joins. **Fix:** preflight the member-scoped side effects without writing, including first-ID/email targeting, and refuse before D17 if it would start the Journey.

- **Minor — [frontDoor.test.ts:320](convex/slack/frontDoor.test.ts:320):** Updating the expectation removes the ready-feature fallback coverage. The remaining Journey-to-home test uses `questCratePageOf`, bypassing `readyCratePageOf`’s no-page fallback. **Fix:** retain `/skills` and add a focused ready-feature case without a listed page.

- **Minor — [README.md:3](website/proof/sandbox-4/README.md:3):** “Every artifact” coming from the final deploy at 09:06–09:10 is incorrect: the flag artifacts and review red/green artifacts were committed before that deploy. **Fix:** limit this provenance statement to the final sandbox screenshots and call/table captures, and distinguish earlier evidence.

## Dispositions, round 2

1. **`queryOnly` and `/skills`:** all three answers found the reader construction sound and `/skills` correct.
2. **Major (answer 3), not fixed here, a follow-up for #193.** The finding is plausible from the code, though I didn't reproduce it: `questsLiveFor` runs a member's Journey preview moment (`previewOnce`, which joins them) when their member decision is on and the workspace has no Journey launch. The website's gate checks the workspace's decisions and launches, so a member previewing `quests` through an email condition could have their preview moment run by `buyPerk`'s D17 command. The Book's preview has the same shape.
   - **It is shared:** `openFeature` and `openQuestCrate`, already on `main`, have the same workspace-scoped gate.
   - **It isn't reachable today:** every flag answers on at workspace level on both deployments ([`flag-answers.txt`](flag-answers.txt)), so the gate already requires the workspace's launches. No preview moment runs after a workspace launch is recorded.
   - **The fix needs a member-scoped preflight** that reads the member decision, email included, without writing a first analytics ID. That belongs in map #1's flag seam, and must land before a flag the website's commands reach gets an email-only condition (#204).
3. **Minor (answers 2 and 3), rejected:** coverage of a ready feature whose page isn't listed. On `spec/website-4` every feature with a crate (Quests, Leaderboard, Book, Skill tree) has a listed page, so the fallback has no real instance. The invariant *one function builds every website link* still covers an unlisted page resolving to the root.
4. **Minor (answer 2), fixed:** the README now says the gate falls back to the workspace's decision only for a member with no analytics ID.
5. **Minor (all), fixed:** the README scopes which artifacts come from the final deploy.
6. **Minor (answers 1 and 2), fixed:** the README separates the session rows this ticket imported from the refresh tokens Convex Auth added, and says there is no read from before the session's creation.
