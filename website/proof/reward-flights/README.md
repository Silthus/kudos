# Proof: rewards fly into the UI that holds them (#354)

This extends #273's `RewardFlight` to every crate the website reveals. XP flies into the hero's XP bar, or the HUD level ring when the bar is out of view. Across a level-up the old level completes before the new one starts. The skill point a level-up earned flies out of the level ring onto the HUD chip, and the Skill tree crate's points fly onto the chip too.

- `red.txt`: the new `rewardFlights.test.tsx` on the tree before the change. 7 of 8 fail; the one that passes is the guard that a reward-less crate flies nothing.
- `red-spot-check.txt`: the Fable 5.1 sequencing tests (hold the level to the turnover, the skill point from the hero ring, the counted hero XP), 3 failing before that change.
- `green.txt`: `rewardFlights.test.tsx` and `QuestsPage.test.tsx`, all passing.
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on the merged tree.
- `design-spot-check-fable-5.1.md`: the motion check; all six suggestions taken.
- `review-gpt-6.1-sol*.md`: the cross-family review and each finding's outcome.

## Running app

The fixture build (`VITE_SHELL_FIXTURE=…`), served by Vite and driven with T3's preview browser at 1280×800. The fixture read never changes when a crate opens. That is also what production sends, because XP is recorded when a quest finishes, not when its crate opens. So the hold and the fill shown here are the real behaviour.

- `1-journey-xp-flight-light.png` (`member-crossing-into-level-6`): about 380 ms after Done. The hero and HUD hold level 5 at 990 XP, the chip at 1, and `+20 XP` leaves the Journey crate for the hero's XP bar.
- `2-level-up-and-skill-point-light.png`: the old level complete, captured before the Fable changes. It shows the level number flipping early, which the spot check fixed.
- `3-journey-level-up-light.mp4` and `4-journey-level-up-dark.mp4`: the whole sequence, on the code after the spot check. XP into the bar, the bar and both rings complete level 5, a hard cut, level 6 starts with a ding, the hero's XP counts up to 1,010, `+1 skill point` flies out of the hero ring onto the HUD chip, and the chip counts 1 → 2.
- `5-quest-claim-to-hud-ring-light.mp4` (`member-with-quests-at-level-2`, `/quests`): a Claim's `+20 XP` lands on the HUD ring, which fills from 30 to 50 XP.
- `6-journey-into-hero-bar-dark.mp4` (`member-with-quests-at-level-2`, `/`): a same-level Journey crate fills the hero bar from 30 to 50 XP while the number counts up.
- `7-reduced-motion-light.mp4`: `prefers-reduced-motion: reduce`, driven by overriding the page's `matchMedia` for that query, because the preview can't emulate it. Nothing flies, and the end state (level 6, chip 2) fades in.

The Skill tree crate's own flight (points from the crate onto the chip) needs the read to change on open, which the fixture build can't do. `rewardFlights.test.tsx` proves it instead.

## Manual pass

- **Focus and live region:** unchanged. After Done, focus returns to the crate's home, and the announcement is #145's.
- **Accessible names:** the hero bar's and the chip's names follow the held, then live, values. The counting digits are visible text only, and the flights are `aria-hidden`.
- **Reduced motion:** no flight, no fill, no count-up; the targets fade in.
