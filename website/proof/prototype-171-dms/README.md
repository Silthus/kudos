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

## Round 2: one combined version per message

Michael's pick: B's quest card is the core, with A's warm, personal copy and C's crossed-off onboarding journey mixed in. `round2.mts` holds one version of each message, fitted to the architecture capture (`prototype/monday-quests-architecture`, `docs/architecture/monday-quests.md`):

- The welcomes open with A's note, then B's card: the onboarding journey from C (done crossed off, the next one pointed at, progress such as `0 of 2 days`), the next quest with "Show me how", and the reward line.
- The Monday DM is one message from two sections. The quests section carries "See your quests" and "Stop Monday quests"; with hugs, the recap comes first.
- Stop replaces the DM in place with the stopped copy and a "Turn Monday quests back on" button.
- Link buttons use `dm-link:<kind>:<destination>` action ids, as `dm link clicked` will read them.

`ROUND=1` selects round 1 in `post.mts` and `render.mts`; round 2 is the default. Stills: `shots/round2/<message>.png`, rendered from `render-round2.html`.

Round 2 update: the waiting Hoggies read "An / Two / Three … unidentified Hoggie(s) for your collection is / are waiting for you", with "Identify it now" / "Identify them now" in the welcomes and "Identify them on the website" in the Monday DM. Every welcome counts its welcome hoggie, and the welcome after a first thoughtful kudos also counts the first quest's hoggie.
