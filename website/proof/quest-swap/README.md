# Proof: swap a quest on the website (#288)

WS318, WS319 and WS335 on `/quests`, ported from variant E's `RerollButton` and header line (`Quests.tsx` at `3409ade`), with the spec's words (`Swap`, not `Reroll`).

## Tests

- `red-convex.txt`: the new `swapQuest` and `getQuests` tests and WS10's grown list against the tree before the change: 23 of 46 fail.
- `red-website.txt`: the new page tests before the UI: 10 of 15 fail.
- `refutations.txt`: three refutations on the finished code:
  - With `swapQuest`'s gate removed, the six gate tests fail: Quests locked, ready, or switched off, and each unrecorded launch, reach D17.
  - With only the Quests-open check removed, the locked and ready tests fail.
  - Without the quests module's "a quest for anyone fits" check, `getQuests` for a member with 33,000 awards hits Convex's 32,000-document read limit.
- `red-proof-findings.txt`: two defects the running app found, each pinned by a failing test before its fix:
  - The live region read `…2 times..`, because pool goals already end with a period.
  - A refused swap's line vanished when another surface's swap landed at the same moment.
- `green.txt`: the same tests passing. `publicSurface.test.ts` timed out at 5 s in that batch (the box's load average was 77), then passed alone. It also passes in the gate.
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on `6416d36` (merged with `main`): 158 files, 2812 tests, Coherence clean.

## Running app

The app ran on a disposable local backend: ports 8110/8111, instance `i288`, storage under `/tmp/i288`. The mock Slack issuer ran on 8112 with `MOCK_FLAGS_ON=xp-levels,unlocks,quests`, beside `website`, which the mock serves on. These flag overrides were local to that backend. No PostHog project and no cloud deployment were touched.

- Unlocks launched through `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know.
- The Journey launched through `quests/weekly:drawWeeklyQuests` for a placeholder member.
- Then the members joined, Juno signed in through the mock's Sign in with Slack, Quests was made ready by an `unlocks` row, and the page's own `Open` drew the week.
- `local-rows-after.txt`: one launch row each for unlocks and the Journey, both recorded before any website call. None was added by the website.

Screenshots:

1. `1-swap-left-{light,dark}.png`: the header reads `1 swap left this week` with the swap icon, and each quest in progress has a muted `Swap`. `How quests work` ends `You can swap one quest a week.`
2. `2-swapping-dark.png`: the backend was paused with `SIGSTOP` after the press. The pressed card reads `Swapping…`, and every `Swap` is inert.
3. `3-swapped-{light,dark}.png`: after the answer, slot 1 shows its new quest tagged `Swapped`, the header reads `Swap used this week`, and no `Swap` is left. One `questSwaps` row exists for slot 1. Juno's App Home, which the mock records, was republished with the new quest and no Swap button.
4. `4-swap-left-390-{light,dark}.png`: the same page at 390 px. `scrollWidth` is 390, so nothing overflows.
5. `5-keyboard-swapped-390-dark.png`: Swap pressed with Enter. Focus lands on the new quest's heading with `:focus-visible`, and the live region reads `Swapped. Your new quest: Thank someone and say why, 2 times.`
6. `6-refused-after-slack-swap-390-{light,dark}.png`: a real race. With the backend paused, Slack's App Home Swap of slot 2 (`receiveHomeClick`) was queued first, then the page's Swap of slot 0 was pressed. Slack's swap landed, the website's answered `refused`, and slot 0's card says `That quest couldn't be swapped.`

Variant E at the same state: the #259 audit's `research/prototype-fidelity/screenshots/prototype-quests-{light,dark}.png` on `research/prototype-fidelity`. It has the `1 reroll left this week` header line with the refresh icon, and a muted `Reroll` before each in-progress quest's action.

## V24 manual pass

- **Focus order:** the nav, then each in-progress card's `Swap`, in slot order. A finished card's only stop is its `Claim`, and a claimed card has none.
- **Focus visibility:** after a keyboard swap, the new heading takes the focus ring (screenshot 5). After a mouse swap, focus moves there without a ring, as Chromium's `:focus-visible` decides.
- **Reduced motion:** the swap has no motion.
- **Screen-reader wording:**
  - The button reads `Swap`, with the title `Swap this quest for another. One swap a week.` The icons are `aria-hidden`.
  - `Swapping…` is `aria-disabled`, so focus stays on it.
  - The polite status region says `Swapped. Your new quest: {goal}`.
  - A refusal or an unreachable server is a visible line on the card.

## Review round 1

Two lanes reviewed a frozen copy of the PR: GPT-6.1 Sol (high) in `review/gpt-6.1-sol-round-1.md`, and a fresh-eyes Opus 5.5 reviewer that never saw the build.

Fixed, each with a failing test first (`review/red-round-1.txt`):
- A refusal or an unreachable server now also reaches the live region.
- A swap that commits after the 10 s budget clears its `Try again`, announces the new quest and moves focus to it.
- Lines and the pending swap are keyed by week and slot, so the Monday turn drops them.
- When a refusal removes the pressed Swap, focus moves to the card's heading.
- The P77 and P91 tests now have Quests open with a drawn week, so only the missing launch refuses. `review/refutation-launch-checks.txt`: with only the Quests-open check left, both fail, as does the Book test.

Rejected, with a reason recorded in the Coherence journal:
- **The fallback scan.** On a day when no undrawn quest for anyone fits, `swapAvailable` still reads the member's lifetime awards. It is reachable only past 32,000 awards from one giver. Slack's App Home publish and Swap already run the same scan for that member. Bounding it needs an awards index by giver, recipient and time in Quests' draw path. That is a follow-up.
- **Republishing App Home after a refused swap at the Monday turn.** WS318 republishes after `swapped`, and the new-week sweep republishes after the draw.

## Review round 2

GPT-6.1 Sol (high) reviewed the fixes in `review/gpt-6.1-sol-round-2.md`. All five round-1 findings are resolved, and it accepts the fallback-scan rejection. It found one more low defect, pinned by two failing tests (`review/red-round-2.txt`) and fixed:
- When the refusal came before the read took Swap away, focus still dropped. The hook now keeps the pressed button until it leaves the page or focus moves elsewhere.
- A late refusal from last week focused the new week's card in the same slot. The hook now moves focus only to a card that still shows the line's quest.

The swarm's two-round budget ends here. Then `main` (#355 and others) was merged in, keeping both sides' commands, and the gate ran on the merged tree.
