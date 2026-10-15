# GPT-6.1 Sol review, round 3

The same call over `d41008f8`, with rounds 1 and 2.

## Answer

1. **Medium — website/src/App.tsx:101–102:** Visit `/skills?perk=circle` while the Skill tree is ready, open its crate, let the tree answer, then choose **Go to Skill tree** in the reveal. Landing waits while `revealing`, but `RevealDialog.tsx:210` navigates to plain `/skills` when closing. The pending perk disappears before it can scroll, focus or select; narrow screens never show its drawer. `/quests?quest=1` has the same failure through **Go to Quests**. Preserve the pending target when the reveal navigates to the current destination page, or close without navigating. Add coverage exercising the actual reveal and its primary link; the new ready-to-open tests only replace fixtures.

VERDICT: fix-first
## Outcome

1. **Rejected.** Slack links a quest slot or a perk only while that feature is open: Swap for open Quests, Buy for an open Skill tree. So a target pending on a ready page comes only from a stale link. Pressing `Go to` is the member's own fresh navigation to the plain page. Closing the reveal any other way still lands the target, since the landing waits only while the reveal is open. Both fixes from rounds 1 and 2 hold: the reviewer found nothing else. Recorded as a Coherence decision.
