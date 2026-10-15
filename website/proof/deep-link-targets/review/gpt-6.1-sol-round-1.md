# GPT-6.1 Sol review, round 1

`codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only` over the diff against `main` at `35823b3a`, with #435, `spec/website-7.md` and `spec/slack-to-web.md` as the oracle.

## Answer

1. **Medium — website/src/App.tsx:96**: With a cached member profile, visit `/quests?quest=1`, `/skills?perk=spark`, or a crate link while its page query is unavailable. `LiveApp` returns `{ kind: "connecting" }`, which passes `!busy`. The hook then marks the route handled before finding a target (`website/src/linkTarget.ts:36`). When data arrives after reconnection, it never scrolls, focuses, or selects the target. This regresses existing quest links, which previously waited for `quests.kind === "quests"`. **Fix:** gate targeting on the actual destination content being rendered; never consume targets during transient connection states. Add a focused `undefined → connecting → successful answer` test that asserts arrival.

VERDICT: fix-first
## Outcome

1. **Fixed, test-first.** A page whose read answers `connecting` hasn't landed, so the hook keeps its target until the content renders. Red: [red-connecting.txt](../red-connecting.txt), 3 of 3 fail (perk, quest and Journey crate). Green: [green-connecting.txt](../green-connecting.txt).
