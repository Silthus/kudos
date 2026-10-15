1. **Should fix — [App.tsx:231](/tmp/dp2/review3/tree/website/src/App.tsx:231).** Deep links can go **placeholder → blank main → page**. Once the profile answers, the placeholder disappears, but unresolved leaderboard and quests reads still return `null` at lines 241 and 251. This undermines holding the page’s shape. Smallest fix: retain a placeholder for those initial reads while preserving already-rendered content during refreshes. Add a transition test with the profile answered and the page read still pending.

2. **Nit — [LoadingPage.tsx:6](/tmp/dp2/review3/tree/website/src/pages/LoadingPage.tsx:6).** The geometry only loosely resembles home. Its hero reserves about 176px, omitting the mobile portrait row and allowance/details; `/leaderboard` also uses an 18rem rail rather than 21rem, and quests puts its heading above both columns. Expect substantial rearrangement when content arrives. Smallest fix: pass the route into the placeholder and adjust the broad structure and responsive height, without reproducing every component.

No V8/V9 violation: the placeholder is static. Non-focusable, `aria-hidden` decorative divs inside the busy main are appropriate; empty divs introduce no inherent axe issue. `aria-busy` does not guarantee a spoken announcement, but a hidden “Loading” line is not required by the quiet-loading contract.

The bars’ token contrast is approximately **1.08:1 light / 1.22:1 dark**—very subtle, with no decorative 3:1 requirement. Existing WS20 assertions, connecting behavior, sign-in redirect handling, and the `loading` fixture remain compatible. Existing axe coverage already includes loading in both themes.

Tests and builds were not run.

Verdict: **Fix the deep-link blank interval before merging.**

