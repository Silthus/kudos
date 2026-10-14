# Design spot check: reward flights (#354), Fable 5.1, read-only

Input: the code on `website/reward-flights` at `8c6a1ec`, stills `1-journey-xp-flight-light.png` and `2-level-up-and-skill-point-light.png`, and #273's spot check.

Timeline then, after Done: the XP lands at 1.05 s, the bar is full at 1.59 s, empty at 1.65 s and refilled at 2.25 s. The skill point hop ran from 1.05 to 2.0 s.

## Must-haves

1. **Hold the level number and the XP text until the bar empties (landing + 600 ms).** "LEVEL 6", the HUD badge, "1,010 XP" and "490 XP to level 7" flipped at 1.05 s while the bar and ring were still completing level 5. Release the hold at the 50% point of `reward-levelling`, so the number flips exactly at the cut.
2. **Start the skill point hop at that restart, from the hero ring, not the bar.** A skill point is earned by the level, so it should come out of the level number as it flips. Use the ring's rect when it's in view, else the HUD avatar.
3. **Make the 100% → 0% cut a hard step.** Between 45% and 50% the bar shrank for 60 ms, which is a backwards fill. Add `49.9% { width: 100% }` (and `stroke-dasharray: 100 100`).

## Nice-to-haves

4. **Count the hero's XP number up with `useCountUp`.** 600 ms matches `reward-filling`, and across a level-up it ends at the restart.
5. **Ding at the restart.** Reuse `.reward-landed` on the hero ring and the HUD avatar.
6. **Count-up: keep as is.**

## Verdict

The flight itself (rise then swoop, ease-in absorption, neutral dots with a card halo, the inverted chip) is right and matches #273's decisions. The sequencing is what stopped it feeling connected: the numbers led the bar, and the skill point left before it was earned.

## Taken

All six. Items 1–3 and 5 are tested in `rewardFlights.test.tsx` and in the level-up case of `QuestsPage.test.tsx`. Item 4 is tested through the hero bar's accessible name, `30 XP …` then `50 XP …`.
