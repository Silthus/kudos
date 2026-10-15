1. **Should fix — [ActivityPage.tsx:111](/tmp/dp2/review2/tree/website/src/pages/ActivityPage.tsx:111): competing primary accents.** The selected filter explicitly retains `border-primary` at line 63; `variant="outline"` does not remove that. The new primary Slack link therefore competes with the selection under V4. Smallest fix: make the Slack action outline—V23 requires an action, but does not require primary styling.

2. **Should fix — [statesPolish.test.tsx:53](/tmp/dp2/review2/tree/website/src/statesPolish.test.tsx:53): the focus test never exercises focus transfer.** Checking `tabindex="-1"` would pass even if the refresh stopped focusing the empty state. Smallest fix: extend the existing activity interaction harness to press “Show new activity,” resolve that read empty, and assert `toHaveFocus()` on the empty container.

3. **Nit — [statesPolish.test.tsx:47](/tmp/dp2/review2/tree/website/src/statesPolish.test.tsx:47): the illustration assertion can pass without a hedgehog.** The selector accepts any SVG, including `SlackLink`’s external-link icon. It also checks neither exactly one illustration nor decorative accessibility. Smallest fix: scope the assertion to the illustration and check its count and hidden semantics.

4. **Nit — [Website.spec.md:3](/tmp/dp2/review2/tree/website/Website.spec.md:3): the new empty-state contract is undocumented.** In this supplied checkout, the activity sentence’s “closing line” describes the populated timeline’s end; it does not explicitly require a line for the empty state. Smallest fix: add a clause describing the empty illustration, filter-specific sentence, Slack action, and focus landing.

The named section is reasonable for the timeline’s empty state; `tabIndex={-1}` and the hedgehog’s empty title are appropriate. Received/given copy remains accurate, though Received’s Slack action invites giving rather than directly filling that filter, as V23 requires. Existing axe coverage reaches the new card in both themes; live-shell and fixture wiring need no additional prop changes. Tests and builds were not run.

Verdict: Not mergeable as is; fix the primary-accent conflict and verify the actual focus transition.

