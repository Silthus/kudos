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
- The full gate: see the PR.

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
