# Proof: quest art, Claim, the reward flight and quest links (#273)

WS314–WS316 on `/quests`, ported from variant E (`Quests.tsx`, `quests-parts.tsx`, `quests-claim.tsx`, `quests-data.ts` at `3409ade`).

- `red.txt`: the new and changed tests run against `main` (`2fe2a5a`): 52 of 199 fail.
- `green.txt`: the same 199 tests on this branch, all passing.
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate`, green (133 files, 2123 tests, Coherence clean). jsdom's canvas notices are stripped.
- Screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-quests`, quests `weekWithLastWeeksCrate`), served by Vite on port 7212 and driven with T3's preview browser:
  - `1-quests-{light,dark}.png`: one quest in progress (Say why), one finished with the primary `Claim` (Reach out), one claimed and swapped (greyscale hedgehog with a check, muted card, `Claimed`), and last week's crate with an outline `Claim`.
  - `2-quests-390-{light,dark}.png`: the same at a 390 px phone width.
  - `3-quest-link-slot-2-390-light.png`: `/quests?quest=2` at 390 px, scrolled to slot 2 with focus on its heading.
  - `4-reward-flight-{light,dark}.png`: after a `Claim`'s reveal closes, the `+20 XP` chip in flight from the card to the HUD avatar, its animation paused mid-air; focus is back on the card. The fixture read never turns the quest to opened, so the card still reads `Claim`.
- Variant E at the same state: the #259 audit's `research/prototype-fidelity/screenshots/prototype-quests-{light,dark}.png` on `research/prototype-fidelity`.

## V24 manual pass

- **Focus order:** each card's only stop is its `Claim`; a claimed card has none. After the reveal's `Done`, focus returns to the claimed card.
- **Focus visibility:** a quest link's heading takes the focus ring (screenshot 3).
- **Reduced motion:** the flight never mounts (tested); the reveal keeps its reduced end state.
- **Screen-reader wording:** the hedgehog and the flying chip are `aria-hidden`; the card reads kind, goal, `1 of 1`, `+20 XP`, then `Claim` or `Claimed`.
