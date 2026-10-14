# The Book's ladder details (#281)

WS333, WS339; V4, V16, V24. Website only: `getBook`'s read is unchanged, so the screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`, now answered with every shipped ladder at a different stage) at 1440 × 1200 and 390 px, served by `vite preview` on 127.0.0.1:7912 and driven in the T3 preview browser. No backend, flag or cloud deployment was touched.

| Shot | What it shows |
|---|---|
| `1-overview-every-stage-wide-light.png` | The overview's ladders at every stage: Generosity part-way at bronze (`22 to go for Generous Soul`), Recognition not started, Connections complete (diamond rosette and sparkle, `Diamond earned 8 Sept 2026`, a full bar, `31`, `Complete`, no `Next`), Dependability one tier from complete at gold (`10 to go for Cornerstone`), each incomplete ladder with its ringed neutral `Next` cell. |
| `2-overview-every-stage-wide-dark.png` | The same in dark: bright metal faces with the token rims. |
| `3-thanked-not-started-390-light.png` | Recognition not started: the silhouette in the muted dashed rosette, `Not started`, `1 to go for Noticed`, the `Next` cell on bronze. `scrollWidth` 390. |
| `4-giving-390-dark.png` | The Giving page at 390 px in dark (first screen): the date wraps under the name, the tier grid is two by two. `scrollWidth` 390. |

E at the same state, for comparison: the #259 audit's [category pair](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/screenshots/compare-book-category-light.png) ([dark](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/screenshots/compare-book-category-dark.png)): the right half of each is E.

## Kept from E, and changed on purpose

- **Kept:** E's 28-point rosette with its inner ring, the silhouette until the first tier, the sparkle at the top right for gold and diamond, `{tier} earned {date}` or `Not started` beside the name, `Complete` with a check and a full bar, the `Next` cell's ring and its pill sitting on the ring.
- **Changed:** the rosette's metal comes from the `--medal-{tier}` tokens that the medals already use (they pass 3:1 on the card in both modes), not E's hex pairs. The ring and the `Next` pill are in the foreground colour, not primary (D2). E's requirement sentence (`3 more thoughtful kudos`) is `{n} to go for {tier}` until a unit fact ships. Tier rewards stay out (WS91, WS347).

## Fable 5.1 design spot check

Fable checked the screenshots against E and the visual language. Its findings and what changed:

- **Must fix, the light rosettes lost their metal:** the face mixed the dark light-mode tokens with the cream card, so gold and bronze both read tan, and in dark the face went olive-black under a bright rim. **Fixed:** the face is a relative colour of the token (`oklch(from var(--medal-{tier}) 0.92 calc(c * 1.4) h)` to the token), so it stays bright and keeps its hue in both modes; the rim stays on the token.
- **The sparkle read hollow in dark:** **fixed** on the rosette with the same glint fill. **Kept** on the tier medals, whose sparkle overlaps the metal disk: a glint there falls under 3:1 against the metal in dark (Sol round 2), so the medal keeps slice 4's card-coloured sparkle.
- **`Complete` dropped the count and its bar ran to the edge:** **fixed**, the count sits in the same right slot as `3 of 25`.
- **The unstarted scallops nearly vanished:** **fixed** with a hairline outline in `--muted-foreground`, which also meets 3:1 (Sol's second finding).
- **The `Next` cell's text sat 1 px off:** **fixed** with a transparent border.

## GPT-6.1 Sol review

[`review-round-1.md`](review-round-1.md):

- **The thin inner metal ring sat on the metal gradient (≈1.4:1) and the test measured it against the card:** **fixed** by dropping that decorative ring; the rim and the inner ring each border the card on one side, which is what the test measures.
- **The unstarted scallop outline was `--muted` on `--card` (≈1.1:1) and unmeasured:** **fixed** with the `--muted-foreground` hairline, which the contrast test now measures.

[`review-round-2.md`](review-round-2.md):

- **The tier medals' new glint sparkle fell to ≈1.4:1 against the metal disk it overlaps in dark:** **fixed** by keeping slice 4's card fill on the medal sparkle.
- **The Complete row's count was hidden from screen readers:** **fixed**, the bar is named `Complete, 31 different people thanked`, and the test asserts that name.

[`review-round-3.md`](review-round-3.md): no findings.

## Gate

[`gate.txt`](gate.txt): `~/dev/fleet/fleet heavy -- pnpm gate` on `b190b47` (this branch with `origin/main` and #237 merged): typecheck, 146 test files and 2,447 tests passed, Coherence's spec and lexicon checks, exit 0. Red: [`red.txt`](red.txt) on `d6ab2a4`; green: [`green.txt`](green.txt).

## Manual pass (V24)

- **Focus order:** unchanged. The ladder details add no focusable element.
- **Focus visibility:** nothing new to focus.
- **Reduced motion:** nothing moves. `document.getAnimations()` is empty on the Giving page, and the sparkle is a static path.
- **Screen-reader wording:** each card is an `article` named by the ladder. The headline reads `Bronze earned 14 Oct 2026` or `Not started`. The bar is a `progressbar` named `3 of 25 for Generous Soul`, followed by `22 to go for Generous Soul`. A complete ladder's bar is named `Complete, 31 different people thanked`; its visible `Complete` line and count are hidden from the reader to avoid a repeat. The `Next` pill is read after its tier's text. The emblem and its rosette are `aria-hidden`, because the headline names the tier in words.
