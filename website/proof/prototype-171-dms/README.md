# PROTOTYPE: the welcome DMs, the catch-up welcome and the Monday DM (round 1)

Throwaway. This branch is never merged. It answers one question: what do HedgeHug's new Slack messages look like? Michael picks a variant per message.

Seven messages, three structurally different variants each:

| # | Message | A | B | C |
| --- | --- | --- | --- | --- |
| 1 | Welcome on a first hug | Chat note | Quest card | Journey checklist |
| 2 | Welcome on a first thoughtful kudos given | Chat note | Quest card | Journey checklist |
| 3 | Welcome on a thoughtful kudos received | Chat note | Quest card | Journey checklist |
| 4 | Catch-up welcome | Chat note | Quest card | Journey checklist |
| 5 | Monday DM, standalone, drawn quests | One line | Short list | Spotlight |
| 6 | Monday DM, inside the hugs recap, onboarding quests | One line | Short list | Spotlight |
| 7 | Stop Monday quests: the reply | New message | Edited in place | With undo |

- **A, Chat note:** one section that reads like a person wrote it, one primary button.
- **B, Quest card:** a header, the next onboarding quest as a card with "Show me how", a reward and progress line.
- **C, Journey checklist:** every onboarding quest with its state (done, next, later), and the call to action beside the next one.

Every variant label carries the usage flag it trips and its control, without numbers. Variants 6 and 7 trip `low use: Settings tab message settings`: they send the member to App Home's Settings tab to change or undo a setting.

## Files

- `variants.mts`: the Block Kit of every variant.
- `post.mts`: posts every variant as a DM from the sandbox bot (`different-dog-467`'s workspace). `validate` posts each to the sandbox channel and deletes it at once. Buttons are dead.
- `render.mts` → `render.html`: a Slack-like rendering for stills (`render.html#4B` shows one variant). Real Slack is the truth.
- `shots/`: one still per variant, `<message><variant>.png`.
