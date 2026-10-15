# Proof: crates open like a loot box (#452)

The product owner asked for the crate opening to feel like a video game: the crate opens, the rewards come out as big `+10 XP` and `+1 coin` tokens, and they fly up into the UI. This ticket rebuilds the reveal on top of #354's flights and #413's HUD fills, for feature crates and quest crates alike.

**The sequence.** The crate charges (shakes, the seam glows), the lid bursts off with a flash and a ring, the hog rises, and each reward pops out of the crate as a big glowing token with sparks and a shimmer. Each token then flies into the HUD home that holds it: XP into the level ring, the skill point onto its chip, coins onto the coins chip. The header stays in view above the scrim so the tokens have somewhere to land, each home dings and counts up on arrival, and a crossed level turns over before the next token leaves. The finish is the headline, the chips and Done. A closed crate names only its kind. Skipping with Esc, Space or a click lands every reward at once. Reduced motion shows the finish and every value at once.

**The collectible slot.** Map #1's collection (`spec/collection.md`, ticket #454) will answer `drop` beside `opened`. The reveal already bursts that drop out last as a hoggie card: the hoggie by slug from `@posthog/brand`, a rarity glow and label, `New!` or `×{copy}`, and a brighter flare for legendary. No read carries a drop yet: the website types it `drop?: Drop | null` and the proof fixture supplies one. Wiring the real drop is #467.

## Tests

- `red.txt`: `lootCrates.test.tsx` on `main` before the change, 11 of 11 failing.
- `green.txt`: the same file after, 13 of 13 passing (two tests were added for the drop's card).
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on the landed tree.

The older flight tests moved to the new timeline: `rewardFlights.test.tsx`, the flight describes in `QuestsPage.test.tsx` and `questRewardKinds.test.tsx`, the axe test on the flight, and the crate label in `JourneyPanel.test.tsx`. Each keeps its assertions on holding, filling, the level turnover and the count-ups, now reached through the reveal's phases.

## Running app

The proof fixture (`fixture/`, copied into `website/` and built with `vite build --config proof.vite.config.ts`) renders `App` on a member crossing into level 6 with 236 coins. `?path=/quests` claims a quest paying 20 XP and 10 coins, `?crate=feature&path=/` opens the Skill tree crate, and `?drop=epic|legendary|rare|common` adds a fixture-only drop. Driven with T3's preview browser; the preview can't emulate reduced motion, so that run overrides `matchMedia` in the page.

| What | File |
|---|---|
| Quest crate, epic drop, light, 1280 px: the burst with three tokens and the card, before the token row moved into flow | `0-first-cut-burst-light.png`, `0-first-cut-quest-epic-light.mp4` |
| Quest crate, legendary drop, light, 1280 px: the whole sequence and the finish | `2-quest-legendary-light.mp4`, `2-quest-legendary-finish-light.png` |
| Quest crate, epic drop, dark, 1280 px | `3-quest-epic-dark.mp4`, `3-quest-epic-finish-dark.png` |
| Quest crate, rare drop, light, 390 px: the header wraps and the reveal's headroom follows | `4-quest-rare-390-light.mp4`, `4-quest-rare-finish-390-light.png` |
| Feature crate (Skill tree), light, 1280 px: the skill point bursts out and flies onto its chip | `5-feature-skill-tree-light.mp4`, `5-feature-skill-tree-finish-light.png` |
| Quest crate, common duplicate drop, reduced motion: the static finish with every value landed | `6-quest-common-reduced-motion-light.png` |

In every run the HUD held level 5, 1 skill point and 226 coins from the answer until each token landed, then showed level 6, 2 and 236, and the live region said what opened.

## Manual pass

- **Keyboard:** Enter and Space open, Esc and Space skip to the finish, Esc on the finish closes, Tab stays inside the dialog; unchanged, proven by the existing tests.
- **Live region:** the one `role="status"` announces the open and its rewards after the finish; the level-up region announces the crossed level.
- **Reduced motion:** no charge, burst, flight or count-up; the finish fades in with the values at once.
- **Contrast:** the tokens and the card are night on the night scrim with a brand-colour border; the words inside are white on night.

## Calls

- A closed crate's label names only its kind. The quest card keeps the pay the quest promised (WS348); hiding that too is the product owner's call.
- The flight plays inside the reveal for every crate, however it was opened, replacing #354's flight after Done. The ready pill's and the next crate's opens fly too.
- Each token's glow comes from the band colours (XP lemon, skill point blue, coins tangerine) and a drop's from its rarity; V3's "no rarity colours" line waits for #467.
- The flight pins its reward when the tokens burst, not when the answer arrives, so a Skill tree crate's skill point, whose read lands after the answer, is held and flown.
- A crate this browser has seen before opens on the finish at once with the crate's recorded XP and coins and no flight; the skill point it once earned is a level-up consequence the crate alone can't name, so that finish lists XP, coins and the drop only (checked live by sampling the page over a seen-before and a fresh reveal).
