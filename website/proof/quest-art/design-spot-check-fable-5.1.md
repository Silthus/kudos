# Fable 5.1 design spot check (#273 reward flight)

Requested by the conductor; run read-only on Claude Fable 5.1 (high) at 12:15 UTC, 2026-10-14.

## Findings and what was done

- **Chip lands last and triggers the bump.** Taken: particle delays 0–200 ms, the chip at 260 ms; the bump and fill fire when the last of the seven ends, which is the chip.
- **Absorb instead of fade out.** Taken: an 85 % keyframe at full opacity and scale 0.6, ending at scale 0.4 and opacity 0.
- **Rise then swoop.** Taken: midpoint at 0.3 of the horizontal and 0.7 of the vertical distance, plus the arc.
- **Neutral inverted chip in both themes; particle sizes 4/6/8 px.** Taken: foreground background, background text, a 2 px card halo; it was nearly invisible in dark mode.
- **Ring easing `cubic-bezier(.3,1.4,.5,1)`.** Not taken: the overshoot would briefly show more XP than the member has. Kept `cubic-bezier(.2,.8,.2,1)`.
- **In-app motion toggle could strand a flight.** No such toggle exists; `data-motion` mirrors the media query. Each flight reads the preference as it starts.
- **Across a level-up the ring shows the new level during the reveal.** Noted as a follow-up for the next flight ticket (feature, Journey, coins, skill points): fill to the end of the old level, then show the new one.
