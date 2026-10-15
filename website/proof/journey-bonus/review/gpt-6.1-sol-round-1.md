1. **Medium — [QuestsPage.tsx:201](website/src/pages/QuestsPage.tsx:201), also line 237.** An active `first-quest` bonus omits `Go to Quests` despite Quests being open. Finished steps also lose their feature link entirely. WS317 requires the link whenever the feature has an open page, without either exception. Remove the current-page exclusion and render the link independently of `Claim`. Update the test that explicitly expects no self-page link.

2. **Low — [QuestsPage.tsx:235](website/src/pages/QuestsPage.tsx:235).** A finished `first-thanks` or `two-days` bonus hides its supplied hint. WS317 limits `New` to active steps, but requires the step’s goal and hint. Render every non-null hint and add a finished-step assertion.

3. **Low — [QuestsPanel.tsx:43](website/src/home/QuestsPanel.tsx:43).** When the bonus finishes, its home row replaces `New` with `Claim`. WS317/E076 requires the bonus row’s `New` tag; the active-only restriction applies to the card. Retain the tag alongside the finished action, and correct `RightRail.test.tsx:217`, which currently asserts its absence.

VERDICT: fix first
