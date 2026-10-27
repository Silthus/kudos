# Kudos

Peer recognition for Slack: teammates thank each other with the kudos emoji within a daily allowance, and earn XP, levels, unlockable messages and achievements; teams compete on a leaderboard. The backend runs on Convex. Slack is the first chat platform, and only its adapter knows about Slack.

This repository is public: keep customer names, customer data and usage numbers out of every file, commit, branch, issue and pull request.

## Stack

- Convex, TypeScript (strict), Vitest.
- pnpm only, never npm or yarn. `npx --no -- <bin>` runs an installed binary.

## Gate

`pnpm gate` runs the typecheck, the tests, and Coherence's spec and vocabulary checks. It is the ship-to-main gate: green locally before a pull request merges to `main`. CI runs it on every pull request, beside the Coherence workflow in fail mode.

## Slack manifest changes

Every push to `main` deploys to production at once, but the Slack app's manifest changes only when a person pastes it in. A pull request whose diff touches `slack-app/` or `convex/feedback/naming.ts` can change the rendered manifest, and nothing it renders is exempt. Before such a pull request merges, a person applies its manifest to the real app:

1. When the pull request opens, and again whenever a later commit changes the rendered JSON, render it from the pull request's head: `node slack-app/render-manifest.ts real <URL>`. Take the URL from the latest production deploy: `gh run view "$(gh run list -w 'Deploy production' -s success -L 1 --json databaseId -q '.[0].databaseId')" --log | grep -om1 'https://[a-z0-9-]*\.convex\.site'`. When the JSON equals what `main` renders, nothing is owed.
2. Post one comment on the pull request. It says what changed and why, holds the whole rendered JSON in a `json` code block, and gives the steps: open HedgeHug at https://api.slack.com/apps, paste the JSON over its App Manifest and save, then reinstall the app to the workspace when Slack asks. It names any one-off run the change needs after the reinstall, which the agent runs after the go-ahead.
3. Ask the user in this chat to apply it, with a link to the latest such comment. Keep working on everything else, but do not merge until the user says in this chat that the latest manifest is saved and the app reinstalled. A go-ahead given before the latest comment does not count.

When the change removes a scope or event the running code still uses, or adds or moves a route, flip the order: merge, wait for the `Deploy production` run to pass, then ask for the manifest. Slack checks the request URLs when the manifest is saved, and production serves a new route only after the deploy.

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
