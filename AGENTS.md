# Kudos

Peer recognition for Slack: teammates thank each other with the kudos emoji within a daily allowance, and earn XP, levels, unlockable messages and achievements; teams compete on a leaderboard. The backend runs on Convex. Slack is the first chat platform, and only its adapter knows about Slack.

This repository is public: keep customer names, customer data and usage numbers out of every file, commit, branch, issue and pull request.

## Stack

- Convex, TypeScript (strict), Vitest.
- pnpm only, never npm or yarn. `npx --no -- <bin>` runs an installed binary.

## Gate

`pnpm gate` runs the typecheck, the tests, and Coherence's spec and vocabulary checks. It is the ship-to-main gate: green locally before a pull request merges to `main`. CI runs it on every pull request, beside the Coherence workflow in fail mode.

## Coherence

Coherence guards this repository's specs, vocabulary and invariants. Its hooks (`.claude/settings.json`, `.codex/hooks.json`) bring specs, practices and findings into the session.

- Ask it before changing an area: `npx --no -- coherence query practice`, `query component <folder>`, `query status`, `query invariants <path>`.
- Record decisions, defects and practice steps in its journal (`coherence decide`, `defect`, `enact`), and commit the journal with the change.
- No spec exists yet. The first domain code writes the entry spec (`<Name>.spec.md` with its trust levels) and declares its entrances. The grammar is in `node_modules/@posthog/coherence/docs/spec.md`.

## Agent skills

### Issue tracker

Issues, specs and the Wayfinder map live in GitHub Issues for `Silthus/kudos`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, each string equal to its role. See `docs/agents/triage-labels.md`.

### Domain docs

Coherence is the source of truth. The domain vocabulary is Coherence's `lexicon.json` at the root (`coherence query lexicon <term>`); there is no `GLOSSARY.md`. Architecture decisions are ADRs in `docs/adr/`, and each one is recorded by a `coherence decide` record that names its path while the ADR names the record's id. See `docs/agents/domain.md`.
