# Show 5 more on the leaderboard (#275, WS320)

- `red.txt`: `website/src/LeaderboardPage.test.tsx` with the new tests on `main`'s `BoardList`/`BoardLine` (8 failing).
- `green.txt`: the same tests, plus the axe cases in `accessibility.test.tsx`, passing on the branch.
- `gate.txt`: the summary of `pnpm gate` on the branch, merged with `main`.
- `review-gpt-6.1-sol.txt`: the GPT-6.1 Sol review of `9165db8`. `red-review-findings.txt`: the two tests for findings 1 and 2, failing before the fix.
  1. A revealed row refocused itself when a live update remounted it. **Fixed:** a focus request now fires once, on the press (`useFocusOnReveal`).
  2. The footer went away once every row was shown. **Fixed:** `Show the whole board` is offered from the board's first window, as before (WS320: unchanged).
  3. Contrast was unmeasured. **Fixed in part:** the chevron's paint, `muted-foreground` on `card`, is measured at 3:1 in both modes (`levelContrast.test.tsx`). **Rejected for the dashed rules:** they are decorative dividers, like each row's `border-t`, and variant E draws them the same way (Coherence `d-6d4834b9`).
- Screenshots come from the `member-with-the-board` fixture build (`VITE_SHELL_FIXTURE`), whose board is `midBoard`: you at No. 9 of 13, window No. 6–12.
  - `window-light.png`, `window-dark.png`: the first window. `Show 2 more above` stands where the `…` gap marker stood, and `Show 1 more below` sits under No. 12.
  - `revealed-above-focus-light.png`: after `Show 2 more above` by keyboard. Rows No. 4–5 are in place, the gap is gone, and the focus ring is on the first revealed row.
  - `window-390-light.png`, `revealed-below-390-dark.png`: at 390 px, before and after `Show 1 more below`. The page is 390 px wide, with no horizontal overflow.
- `variant-e-light.png`, `variant-e-dark.png`, `variant-e-390-dark.png`: the accepted prototype's variant E (`3409ade`, `#/leaderboard/everyone`) showing its `Show 5 more below` MoreLine, for comparison.
- V24 manual pass: Tab reaches each `Show n more` button in reading order. Enter grows the list, and focus lands on the first revealed row, shown by the focus ring. The chevron is hidden from assistive tech, so a screen reader reads "Show 2 more above, button". Nothing animates, so reduced motion has no other end state.
