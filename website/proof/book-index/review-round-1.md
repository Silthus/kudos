# Review round 1: GPT-6.1 Sol (high), read-only

`codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only` over `git diff origin/main...0d67870`, with spec/website-7.md (WS331, WS332, WS339) and the visual language as the oracle.

## Findings

- **Medium — [website/src/book/BookIndex.tsx:42](website/src/book/BookIndex.tsx:42): Missing visible selection cue.** On wide `/book?page=giving`, Giving gets the primary stripe and `aria-current`, but no visible check mark or “Selected” label. V24 explicitly requires that additional cue. Add it to the current entry and assert that only the current entry displays it.
- **Low — [website/src/book/categories.ts:33](website/src/book/categories.ts:33): Fallback ladders lose catalogue order.** Unkeyed ladders are appended after the last category’s keyed ladders, violating WS332’s ordering rule. Running `chaptersOf` with `[generosity, team-spirit, recognition]` produces Being thanked as `[recognition, team-spirit]`; it should be `[team-spirit, recognition]`. Build the fallback category by filtering the original ladder sequence, and test an unkeyed ladder appearing before a keyed one.

## Responses

1. **Rejected.** The index's current page is a navigation location, not a selection control. It follows the HUD's own screen nav (`Frame.tsx`): a primary mark plus `aria-current="page"` and no check mark. Colour isn't the only signal here either: the current entry also has the selected fill, a heavier weight and the foreground colour, and the select names it. E's index keeps the check mark for "Complete" (E234), which the overview ticket (#290) may bring back, so a check here would mean two things.
2. **Fixed.** `chaptersOf` now groups in the read's order, sending a ladder with no key to the last category that holds a keyed one. Covered by the test "keeps the read's order when a ladder with no category comes before the last category's own" (red before the fix: `expected [ 'Recognition', 'Team Spirit' ] to deeply equal [ 'Team Spirit', 'Recognition' ]`).
