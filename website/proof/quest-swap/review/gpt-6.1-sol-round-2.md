
1. **Low — [questSwap.ts:30](/tmp/i288/review-tree/website/src/quests/questSwap.ts:30): refusal-focus fix is incomplete.** If refusal arrives before the read removes Swap, this clears `pressed` while it remains connected; subsequent removal leaves focus on the body. Retain the reference until removal or deliberate focus movement, and test reply-before-read. Also guard recovery by week: a late previous-week refusal currently focuses the new week’s same-numbered heading.

Round-1 findings: **1:** rejection acceptable given the existing rare scan and recorded follow-up. **2:** resolved. **3:** resolved. **4:** original line/landing leak resolved. **5:** resolved.

Verified hook scenarios with a source harness; Vitest dependencies are absent.
