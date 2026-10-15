# Fable 5.1 design spot check (read-only, light, dark and 390 px beside variant E)

**Verdict: ship with fixes.**

1. **Must-fix, V24 contrast: fixed.** In light mode, the plaque and the `+10 coins` pill were white on lemon, about 1.5:1. Both now use `--band-lemon-ink`, E's night plaque, in both themes, and the pill's text is lemon. A test checks the CSS and proves 3:1 for every metal on the ink.
2. **Polish, the medal reads as a button: skipped.** The page uses the Book's own `Medal`, the one every tier cell and the shelf use (WS94, V16). A bigger ring at 84 px would add a second medal language. Left for a design pass on `Medal` itself.
3. **Polish, the shelf wraps at 390 px: skipped.** The stacked tier and date on narrow screens is #290's accepted layout (its own Fable round asked for it). The reward line follows that entry's height.
4. **Polish, the kicker's tone: skipped.** A muted ink on lemon needs its own contrast proof. The kicker stays in the band's ink, at about 12:1.

D2, the reduced-motion gate, the once-per-tier keys and the absence of loops were checked and found fine.
