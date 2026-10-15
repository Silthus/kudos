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
