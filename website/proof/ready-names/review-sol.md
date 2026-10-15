# GPT-6.1 Sol review of #417 (codex exec, high, read-only)

Prompt:

> You are reviewing a pull request in the public repo Silthus/kudos (HedgeHug website, React + TypeScript). Read-only: do not run tests, do not edit files.
> 
> Inputs (in /tmp/i417):
> - ticket.md: the ticket (#417) this PR resolves. It is the oracle together with the spec excerpt.
> - spec-excerpt.md: the spec rules WS323/WS324 and the nav-entries module rule.
> - diff.patch: the diff against main.
> The worktree is /home/coder/dev/kudos-wt/polish-276; read any file there for context (website/src/...).
> 
> Conductor constraints: the website must never read a flag; show the Leaderboard's groups clause only if the member's reads already carry groups facts, else drop it. No new flag.
> 
> Review for: correctness bugs, copy that still says "is" for a plural feature name anywhere in website/src (ready/open/locked surfaces, aria labels, palette), anything the ticket asked that is missing, tests that don't prove what they claim, and fixture wiring that would still break. Report each finding as: severity (high/medium/low), file:line, the problem, a concrete failure scenario, and a suggested fix. If nothing holds, say "no findings". Be concise.

Verdict: **no findings**.

## Round 2 (the groups fact, after merging main)

Prompt:

> You are reviewing round 2 of a pull request in the public repo Silthus/kudos (HedgeHug: Convex backend + React website). Read-only: do not run tests, do not edit files.
> 
> Inputs (in /tmp/i417):
> - ticket.md: ticket #417, the oracle together with the spec.
> - diff2.patch: the whole PR diff against main (round 1 already had no findings; round 2 adds the groups fact).
> The worktree is /home/coder/dev/kudos-wt/polish-276; read any file there (convex/groups/groups.ts, convex/website/profile.ts, convex/website/WebsiteReads.spec.md, website/src/features.ts ...).
> 
> New conductor instruction for item 2: groups are on main, dark behind the `groups` flag. Show the Leaderboard's groups clause only while `groupsShownTo` answers true for the member, and keep it hidden otherwise. The website must never read a flag itself. Production is live: a website query must never send a flag exposure or write.
> 
> Review for: correctness of getMyProfile's new `groups` field (is groupsShownTo query-safe, no exposure, no write; read cost on a reactive query), any website surface that still shows the Leaderboard sentence without passing the member's groups fact, places that construct a MemberProfile and could miss the field, test quality (do the tests prove the claim, is the refutation meaningful), and spec accuracy. Report each finding as: severity (high/medium/low), file:line, the problem, a concrete failure scenario, and a suggested fix. If nothing holds, say "no findings". Be concise.

Verdict: **no findings**.
