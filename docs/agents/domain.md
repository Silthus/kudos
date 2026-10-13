# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

Coherence is the source of truth for vocabulary and decisions. This repo has no `GLOSSARY.md`.

## Before exploring, read these

- **`lexicon.json`** at the repo root: the domain vocabulary, with each term's definition and the names it rejects. `npx --no -- coherence query lexicon <term>` shows one term with its live uses.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.
- **The Coherence journal**: `npx --no -- coherence journal` lists the recorded decisions; `journal <id>` shows one with what it cites.

## Use the lexicon's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as `lexicon.json` defines it. A rejected name fails `pnpm gate`, and so does its plural.

If the concept you need isn't in the lexicon yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap. Settle it with the Coherence practice `settle a domain term` (`npx --no -- coherence query practice "settle a domain term"`): `lexicon propose`, then `lexicon apply` with the human's words for anything they ruled.

## Record ADRs through Coherence

An ADR is written only for a decision that is hard to reverse, surprising without context, and the result of a real trade-off. ADRs live in `docs/adr/` as `NNNN-slug.md`, numbered in sequence.

Every ADR is referenced from Coherence:

1. Write the ADR.
2. Record it with `coherence decide "ADR-NNNN (docs/adr/NNNN-slug.md): <what was chosen>" --over ... --because ...`.
3. Put the decision's id into the ADR.
4. Cite the decision (`--cite <id>`) from the lexicon entries and later decisions that rest on it.

Smaller decisions skip the ADR and go straight to `coherence decide`. Commit the journal with the change.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (awards are permanent), but worth reopening because…_
