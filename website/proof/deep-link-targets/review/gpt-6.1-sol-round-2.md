# GPT-6.1 Sol review, round 2

The same call over `933164cd`, with round 1's finding and fix.

## Answer

1. **Medium — website/src/App.tsx:101:** Visit `/quests?quest=1` while `getQuests` returns `ready` or `locked`. The new gate considers this landed, so the hook consumes the target without finding its card. If the member then opens Quests in Slack, the live `quests` answer renders slot 1 but never scrolls or focuses it. The previous hook waited for `quests.kind === "quests"`. Restore that target-specific readiness check and add a `ready → quests` test. Round 1’s connecting fix holds, but doesn’t cover this transition.

VERDICT: fix-first
## Outcome

1. **Fixed, test-first.** Each target waits for its own content: a quest for `getQuests` answering `quests`, a perk for `getSkillTree` answering `tree`, a crate for the page's answer. No target lands while a reveal is open, so a crate opened on the ready page can't have its dialog's focus taken by a quest or perk landing behind it. Red: [red-ready.txt](../red-ready.txt), 2 of 2 fail. Green: [green-ready.txt](../green-ready.txt), 234 of 234 with the Quests, Skill tree, Journey and crate-moment suites.
