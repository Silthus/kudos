# GPT-6.1 Sol review of PR #457, round 1

`codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only` over the diff against main at c1b6ede3, with the brand guidelines, the visual language and the website spec as oracles.

1. **Medium — [website/src/crates/RevealDialog.tsx:208](/tmp/i453/review-tree/website/src/crates/RevealDialog.tsx:208):** Moment headlines still use `font-bold` (700). That now selects RoundHog **SemiBold**, whereas rewritten V5 requires moment headlines at **Bold 800**. Changing `PageTitle` misses these headings. **Fix:** use `font-extrabold` here.

2. **Medium — [website/src/palette/CommandPalette.tsx:151](/tmp/i453/review-tree/website/src/palette/CommandPalette.tsx:151):** “Every word” still has a second typeface: command names, aliases and keyboard hints explicitly use `font-mono`. The same override remains in `Frame.tsx:90`, `pages/SignedOutPage.tsx:40` and `activity/KudosMessage.tsx:56`. Changing `--font-sans` cannot override those descendant utilities; the new stylesheet-only test misses them. **Fix:** explicitly use RoundHog for these elements, including semantic `code` and `kbd` elements.

3. **Low — [website/src/nav/ScreenNav.tsx:14](/tmp/i453/review-tree/website/src/nav/ScreenNav.tsx:14):** V5 now specifies navigation at Medium 500, but `lg:font-medium` applies only on desktop. On mobile, inactive entries inherit 400 and ready entries use `font-semibold` (600), which selects the available 700 face. **Fix:** apply `font-medium` across breakpoints and remove the ready entry’s conflicting weight.

4. **Low — [website/src/levelUp/levelUp.css:56](/tmp/i453/review-tree/website/src/levelUp/levelUp.css:56):** The level-up headline still has its own `letter-spacing: -0.02em`. It never receives `.hud-display`, so this visible moment headline misses V5’s new −0.025em display tracking. **Fix:** update this declaration or share the display tracking rule.

5. **Low — [website/src/LeaderboardPage.test.tsx:312](/tmp/i453/review-tree/website/src/LeaderboardPage.test.tsx:312):** This test and the one at line 436 still claim ranks render “in Inter.” Their assertions only check tabular figures and absence of `.hud-display`; both remain satisfied when the inherited font becomes RoundHog. **Fix:** rename them to describe the surviving requirement—tabular figures without display styling—and remove the obsolete Inter claim.

No high findings.
