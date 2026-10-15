# #287 Quest rewards beyond XP: coins (WS348)

## Red and green

- `red-convex.txt`: 2 failing in `convex/website/quests.test.ts` (WS348) before `getQuests` and `getMyProfile` carried a reward's coins. The two hiding cases already held: coins flag off, and Coins not open yet.
- `red-website.txt`: 8 failing in `website/src/questRewardKinds.test.tsx` before the cards, rows, crate label, Journey line and reveal chips showed coins.
- `red-website-flight.txt`: 2 failing (the hold and the reduced-motion fade) before the coins rode as a reward kind into the header's coins chip.
- Green: both files, 56 tests, with no assertion weakened and no test skipped. The full gate is in `gate.txt`.
- After Sol's review, a mutation check. With `rewardShown`'s visibility check removed, the coins-flag-off test and the before-Coins-open test both fail.

## Running app

These shots come from the fixture build (`VITE_SHELL_FIXTURE`). For the shots only, the fixture's quests answered `questsFixtures.weekPayingCoins`, for a level-6 member with 236 coins and the `your-emoji` Journey step. That fixture swap is not committed.

| | |
|---|---|
| `/quests`, 1280 px | `1-quests-wide-light.png`, `2-quests-wide-dark.png` |
| XP flying while the header chip holds 226 of 236 | `3-flight-xp-then-coins-held-dark.png` |
| reveal end state | `4-reveal-end-dark.png` |
| `+10 coins` flying to the chip (animations paused for the shot) | `5-coins-flight-dark.png` |
| home: Journey crate label, Journey line, quest rows | `6-home-wide-light.png` |
| home quest rows at 390 px | `7-home-390-dark.png` (`scrollWidth` 390) |

Read in the browser:

- The reveal heading reads "You earned 20 XP and 10 coins". The `Rewards` list holds `+20 XP` and `+10 coins`. The live region reads "You opened your quest reward. You earned 20 XP and 10 coins."
- After both flights land, the header chip reads "236 coins to spend".

## V24 manual pass

- **Focus order:** the coin values are text inside each card's reward line, row link or crate label, so they add no tab stop. The reveal still focuses its first action, Done, and the chips are a plain list.
- **Focus visibility:** no new focusable element.
- **Reduced motion:** the chips use `moment-line`, which animates only under `data-motion="full"` and inside `prefers-reduced-motion: no-preference`. Under reduced motion, no flight starts, and the chip shows the balance at once with `reward-faded` (tested). Nothing loops.
- **Screen-reader wording:** a value reads "10 coins": the glyph is `aria-hidden`, and the word is `sr-only`. The reveal's list is labelled `Rewards`. The header chip keeps #442's "N coins to spend". A home row link reads its goal, then "10 coins", then "Claim".
- **Contrast:** the glyph is #442's `CoinGlyph` on the card, already measured at 3:1 in light and dark (`inventory.test.tsx`).
- **axe:** `/quests`, the open reveal and the home with coin rewards pass in light and dark (`questRewardKinds.test.tsx`).

## Reviews

- `review-round-1.md`: GPT-6.1 Sol, two findings. One was fixed (vacuous negative tests). One was rejected with its reason (the reveal keeping coins when the flag flips mid-reveal).
- `fable-spot-check.md`: Fable 5.1.

## Scope change after #446 merged: crates are loot boxes

The product owner's call, relayed by map #57's conductor: "You don't know what you get before you open the crate."

- **A closed crate's label shows no reward** (journal `d-694cb2b4`). The follow-up PR drops the coins #446 added to `RewardCrate`'s label. The label's older "Journey reward · 40 XP" text predates #287 and stays for #452 to remove. `red-loot-box.txt` shows the new test failing against `main`'s `RewardCrate` at `f20c7315`.
- **The reveal belongs to Fable lane #452** (journal `d-09562e9d`). The follow-up returns `RevealDialog`'s headline and its live-region line to their pre-#446 wording and removes the `Rewards` chips. So `4-reveal-end-dark.png` shows a state that no longer ships. The coins flight onto the header chip after the reveal closes stays, as does every quest card, bonus card, waiting card, home row and the active Journey line.
