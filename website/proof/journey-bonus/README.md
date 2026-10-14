# Proof: the Journey's next step as the bonus quest (#274)

WS317 and E076, with WS315 and WS316, ported from variant E's fresh-quest card (`Quests.tsx` and `quests-card.tsx` at `3409ade`).

## Tests

- `red-convex.txt`: the new `getQuests` bonus and `feature` tests against the tree before the change. All 5 fail: `bonus` and `feature` are undefined.
- `red-website.txt`: the new page, home row and axe cases before the UI. 15 of 389 fail.
- `refutations.txt`: two refutations on the finished code.
  - Without the stored first-thanks check in `getQuests`' bonus, the not-joined test fails: a website-first member reads first-thanks as their bonus.
  - Without counting the bonus crate as shown on `/quests`, the failed-Claim test fails: the refusal line shows a second time under the ready pill.
- `red-review-round-1.txt`: the two tests written for the review findings, failing before their fix.
- `green-convex.txt` and `green-website.txt`: the same tests passing.
- The gate: `~/dev/fleet/fleet heavy -- pnpm gate`, linked from the pull request.

## The read

`getQuests`' `quests` answer gains `bonus`. It is the first unopened step of the quests module's projected Journey, with the `feature` that `featureOpening` maps it to. It is `null` unless the member's first-thanks activation is stored. A projected first-thanks (P88) means the P91 join hasn't reached the member, so the website shows no bonus and joins nobody. A query can't write, and the not-joined test checks that `journeySteps` and the scheduled functions are unchanged after the read. `getMyProfile`'s Journey steps carry the same `feature`, as the spec's contract adds.

## Screens

The screens come from the fixture build: `VITE_SHELL_FIXTURE` with the new `weekWithABonus` and `weekWithAFinishedBonus` quests fixtures, served by Vite on 9213 and 9214. The quests fixture was chosen by a local, uncommitted edit of `Root.tsx`. No backend or cloud deployment was touched. The read's behaviour is proven in `convex-test` against Quests' real tables.

1. `1-bonus-active-{light,dark}.png`: `Bonus quest` follows the personal quests, with the line `Your Journey's next step. It stays until you finish it.` The card shows the Leaderboard's hedgehog, `Journey`, a quiet `New` chip, the goal, `+30 XP` and `Go to Leaderboard`.
2. `2-bonus-active-390-{light,dark}.png`: the same card at 390 px. `scrollWidth` is 390, so nothing overflows.
3. `3-home-row-finished-{light,dark}.png`: the home's `Quests this week` ends with the bonus step, `New` and `Claim`, linking to `/quests?quest=journey`.
4. `4-finished-claim-via-quest-link-{light,dark}.png`: `/quests?quest=journey` with a finished step. The page scrolled to the bonus card, and focus is on its heading, with the ring around the text. The step's crate reads `Claim`, primary as the page's first crate.

Variant E at the same state is `prototype/website-ui/screenshots/r9-quests.png` at `3409ade`. Its bonus card sits under a `New` tag and line, with `Open Hedgehog collection` where ours has `Go to Leaderboard`.

## V24 manual pass

- **Focus order:** after the personal quests come the bonus card's `Go to {name}` link, then its `Claim`. Neither is shown when it doesn't apply.
- **Focus visibility:** `?quest=journey` moves focus to the card's heading, and the ring hugs the text (screenshot 4).
- **Reduced motion:** the bonus Claim uses the existing reveal and reward flight, which skip motion under reduced motion. The tests prove the flight from the bonus card's chip. The preview can't emulate reduced motion.
- **Screen-reader wording:** the section is a region named `Bonus quest`. The goal is an `h3` under that `h2`. The home row reads `{goal} New`, or `{goal} New Claim` when finished. The hedgehog is decorative.

## Reviews

- **GPT-6.1 Sol, round 1** (`review/gpt-6.1-sol-round-1.md`). Fixed, test-first: the `Go to` link now stays beside a finished step's `Claim`, and the home row keeps `New` beside `Claim`. Rejected, each recorded in the Coherence journal:
  - A `Go to Quests` link on `/quests` itself does nothing.
  - A hint guides an unfinished step. The home's Journey panel, unchanged by WS72, also shows it only while active.
- **Fable 5.1 design spot check.** It found the screens faithful to variant E. Fixed: `New` and `Swapped` now share one quiet chip, so `New` no longer outweighs `Claim` (V4), and the focused heading's ring hugs its text.
