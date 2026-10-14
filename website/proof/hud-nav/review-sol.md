# GPT-6.1 Sol review, round 1 (on 72de98f)

No high-severity findings.

1. **Medium — [website/src/nav/nav.css:4](website/src/nav/nav.css:4): Ready entries lose their keyboard focus ring.** The unlayered `box-shadow` overrides Tailwind’s layered `focus-visible:ring-2`, while `outline-none` removes the native outline. **Scenario:** Tab onto a ready crate; its outline remains the same as when unfocused. **Fix:** preserve the ring when composing shadows, or add an explicit focus-visible outline, and verify it visually (V24).

2. **Medium — [website/src/nav/ScreenNav.tsx:101](website/src/nav/ScreenNav.tsx:101): Later locked entries fail the specified contrast thresholds.** At 55% opacity, their labels have roughly 2.6:1 contrast in light mode and 3.0:1 in dark mode, below V24’s 4.5:1 text requirement. **Scenario:** Book is next and Skill tree remains locked. **Fix:** use a readable muted colour and extend the contrast test to later locked entries; it currently measures only the next lock (WS339).

3. **Medium — [website/src/nav/ScreenNav.tsx:69](website/src/nav/ScreenNav.tsx:69): A pending nav open keeps inviting the member to open its crate.** **Scenario:** Hold `openFeature` pending: the entry still displays its name, announces “unlock ready,” and retains its entrance/shimmer animation. **Fix:** show and announce `Opening…` and suppress motion until the answer, matching the crate behavior WS301 imports from WS66; test with a deferred response.

4. **Medium — [website/src/nav/ScreenNav.tsx:57](website/src/nav/ScreenNav.tsx:57): A failed open of a later ready entry can produce no visible feedback.** **Scenario:** On `/quests`, with Leaderboard and Skill tree ready, opening Skill tree refuses or rejects. The entry ignores failure states, and the header checks only Leaderboard’s attempt; only the hidden live region reports failure. **Fix:** display the attempted entry’s refusal or connection error in the HUD and test both responses (WS301/WS66).

5. **Medium — [website/src/nav/ScreenNav.tsx:39](website/src/nav/ScreenNav.tsx:39): The pop-in can replay without another opening.** **Scenario:** Open Skill tree, finish its reveal, pass through a connecting state, then restore the same member. The remounted nav link and chip both retain `nav-pop`, restarting their animations. **Fix:** consume each visual pop-in after its first presentation instead of retaining permanent freshness (WS304).

6. **Medium — [website/src/nav/ScreenNav.tsx:128](website/src/nav/ScreenNav.tsx:128): Current-entry scrolling misses locked/ready deep links and subsequent opening at the same URL.** **Scenario:** Load `/skills` on a narrow screen with Skill tree ready at the rail’s far end, then open it through the ready pill. Initially there is no current marker; after opening, the effect does not rerun because `current` is unchanged. **Fix:** retain route identity across entry states and scroll when the current entry becomes available (WS300).

7. **Low — [website/src/nav/hud.test.tsx:158](website/src/nav/hud.test.tsx:158): The motion tests verify class names rather than the promised animation behavior.** **Scenario:** Delete the `.nav-pop` animation rule; the tests still pass although nothing pops in. The “ordinary visit or reload” test also exercises only a fresh initial render. **Fix:** add a browser check for an actual animation that finishes once, including remount and reduced-motion scenarios.

Verdict: request changes for the six medium-severity defects.
