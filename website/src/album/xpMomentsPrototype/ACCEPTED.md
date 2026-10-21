# XP moments: the accepted sequence

Throwaway prototype for Silthus/personal#98, accepted by Michael on 2026-10-21. It lives on `prototype/xp-moments` only and is never merged. This file is the answer the spec takes. The code beside it is the primary source.

Run it: `VITE_SHELL_FIXTURE=album vite build`, then `vite preview`, and open `/?variant=I&scenario=busy&pace=brisk&levelup=takeover`.

## The sequence (variant I, "Mystery orb", Brisk pace)

1. **Arrive.** When a member comes back, the page settles (600 ms), then dims. The canvas starts under the top bar. The XP bar stays lit while the rest of the top bar fades back.
2. **The scene.** Up to five Slack-style excerpts (kudos received, hugs on your message, kudos you gave, level-ups) and one fold line ("+12 more kudos and hugs · +140 XP") fly out of a glowing orb in the centre. They form a ring around it: 370 by 196 px on desktop, tilted up to 7°, overlapping a little, 170 ms apart. The excerpts keep their own "+N XP" chips.
3. **The mystery orb.** The orb reads "? XP · Tap to collect", and a ring around it counts down. A click anywhere collects. So does the timeout: 2 s plus 0.7 s per excerpt (6.2 s for six). Skip and `Esc` jump to the end state.
4. **Dissolve.** Each excerpt dissolves left to right into fine dust and glowing XP particles, 140 ms apart, with a 720 ms sweep. The XP particles fly into the orb, which counts up from +0 to the total, with a small bump as they land.
5. **Into the bar.** After a 550 ms beat, the orb swells and streams into the top-bar XP bar, which fills particle by particle. Crossing a level pops the level pill.
6. **Level-up takeover**, only when a level was crossed. Gold sparks fly off the level pill. A gold "Level N" badge drops from the top bar to the centre with a shockwave, gold rays (one pass) and gold confetti. Then "You reached level N!", and the unlocks pop in one by one: N new items (face down), the skill point (from level 5), and the level badge. Then "Level N+1 is X XP away". **It stays until the member clicks.**
7. **The board on the same canvas.** "+178 XP from 16 moments since Mon 09:12", "Level 7 · +3 items · +1 skill point", then "6 items wait". The round, face-down items react on hover, and the level's items carry a gold "Level N" tag. "Pick one to turn it over" hands off to the item board (Silthus/personal#97). "Later" is a quiet link.

The last visit moves forward when the sequence reaches the level-up or the board, or on Skip. Reduced motion shows the board at once. Nothing shows what an item holds.

## Where it came from

- Round 1: three boxed sequences (centre stage, away feed, toasts under the bar). Michael picked the centre stage, but on the whole canvas.
- Round 2: a scattered canvas with a particle dissolve. Michael liked E's orb and F's crumble.
- Round 3: orb and crumble, closer to the centre.
- Round 4: a bit further out, "? XP" until the tap, particles instead of blocks, then the orb flies to the bar.
- Round 5: the level-up beat. The takeover won, and it stays until a click.
