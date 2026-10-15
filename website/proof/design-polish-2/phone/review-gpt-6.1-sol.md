1. **Should fix — [BoardCards.tsx:23](/tmp/dp2/review/tree/website/src/leaderboard/BoardCards.tsx:23).** The unshrinkable standing takes space from the `min-w-0` label column. At 320 px with a longer tied rank, such as “You're tied at #123”, the unbreakable “Everyone” heading can overflow its column into the standing. This compromises V24’s readable reflow. **Smallest fix:** add `wrap-anywhere` to the label column so its text stays within the remaining width.

2. **Nit — [phonePolish.test.tsx:59](/tmp/dp2/review/tree/website/src/phonePolish.test.tsx:59) and [line 81](/tmp/dp2/review/tree/website/src/phonePolish.test.tsx:81).** These jsdom tests pin structure and classes; they cannot prove alignment, wrapping, or overflow. **Smallest fix:** retain them as structural checks and supplement with browser measurements at 320, 390, 639 and 640 px, covering a long name, no level, first-kudos nudge, and longer tied rank.

The hero’s 252 px face/ring row fits the 288 px content width at 320 px. The roleless `display: contents` wrapper introduces no meaningful accessibility-tree or focus-order change. Reward-flight attributes and descendant selectors remain valid; `RewardFlight.tsx`, `levelContrast.test.tsx`, and `climbOnReturn` need no corresponding edits. V20’s hedgehog replacement remains deferred by WS340.

Tests and builds were not run.

Verdict: Not mergeable as is; fix the standing’s narrow-screen collision first.

