# #188 review: GPT-6.1 Sol (high), read-only

One round, `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only`, over `git diff origin/spec/website-4...5e863cf` (the ticket commit), with `spec/website-4.md` (WS84-WS86, WS94), the ticket and the visual language as the oracle.

## Its answer

1. **Minor — `website/src/skills/PerkDetails.tsx:31` — WS94, V24.** The drawer has neither a registered trigger nor an explicit `finalFocus`. When activation doesn’t focus the node, Escape restores the previously focused element instead. Confirmed against installed Quill/Base UI. Pass the initiating node’s ref to `DrawerContent.finalFocus`, or use `DrawerTrigger`.

2. **Minor — `website/src/pages/SkillTreePage.tsx:46` — WS85.** First-load selection is recalculated on every update until the user explicitly selects a node. If the initially selected perk becomes owned through Slack, selection silently moves to another perk. Initialize and retain the selected perk ID; choose a fallback only if that perk disappears.

3. **Minor — `website/src/liveShell.test.tsx:197` — WS85, ticket’s read/test contract.** The tests claiming to exercise `getSkillTree` use a `watchQuery` mock that ignores the query reference and returns the same fixture for every endpoint. Calling the wrong endpoint would still pass. Record and assert the requested function, and return fixtures by query reference.

Verdict: Changes requested for three minor defects.

## What was done

1. **Held, fixed.** The drawer now returns focus through `finalFocus` to the node of the selected perk, held in a ref map, so Esc lands on the node even when the press did not focus it (Safari). Red: `return focus to the node on Esc even when the press didn't focus it` in [`red-review.txt`](red-review.txt).
2. **Held, fixed.** The first-load selection is now chosen once into state, and the fallback applies only when that perk is gone. Red: `keeps the first-load selection when that perk turns owned elsewhere`.
3. **Held, fixed.** The live shell's fake `watchQuery` records each requested function, and the skill tree test asserts `website/skillTree:getSkillTree` was asked. The implementation already asked for it, so this strengthens the test and has no red.
