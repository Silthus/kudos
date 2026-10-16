# #291: the character panel and equipping

The proof for WS341's Character side and in-place equipping. The screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-inventory`). Its commands answer `equipped` and `takenOff` without changing the fixture.

## Tests

- [`red-convex.txt`](red-convex.txt): `convex/website/equip.test.ts` before the commands existed, 16 of 16 failing.
- [`green-convex.txt`](green-convex.txt): the same file after the change, 16 of 16 passing. It covers the guard, the gate before D17 with no launch recorded, the answers, repeat safety, App Home's republish, and the equal-to-Slack comparison.
- [`refutation-no-gate.txt`](refutation-no-gate.txt): the gate replaced by `true`. With quests on and no Journey launch, or achievements on and no Book launch, equip answered `equipped`, and 2 tests failed.
- [`red-website.txt`](red-website.txt): `website/src/characterPanel.test.tsx` on `main`'s tree, 27 of 27 failing.
- [`red-review-round-1.txt`](red-review-round-1.txt): the review's race findings as tests before their fix, 3 failing: a late answer closing a newer picker or slot choice, and a second command sent after switching sides.
- [`gate.txt`](gate.txt): `pnpm gate` green on the tree merged with the latest `main` (with #292's Buy): 4711 tests, the typecheck, and Coherence's checks.
- [`red-merge-292.txt`](red-merge-292.txt): Sol's read of the #292 merge as 2 failing tests: a stale purchase line during a retry, and a purchase lost across a turn to the Character side. Both pass after the fix.
- [`green-website.txt`](green-website.txt): that file and #283's `inventory.test.tsx` after the review fixes, 51 of 51 passing.

## Screenshots

| State | Light | Dark |
| --- | --- | --- |
| Character side, 1440 px | [character-light.png](character-light.png) | |
| Picker on a filled slot | [picker-light.png](picker-light.png) | |
| Picker on an empty slot (no Take off) | | [picker-empty-slot-dark.png](picker-empty-slot-dark.png) |
| Inventory side, slot choice open | [inventory-slot-choice-light.png](inventory-slot-choice-light.png) | [inventory-slot-choice-dark.png](inventory-slot-choice-dark.png) |
| 390 px, picker open | | [picker-390-dark.png](picker-390-dark.png) |
| 390 px, after Escape (focus back on the slot) | [escape-focus-390-light.png](escape-focus-390-light.png) | |

At 390 px, `document.documentElement.scrollWidth` read 390.

## V24 manual pass

- **Focus order:** the side toggle, then the stage (picker: Take off, Done, the tiles), then Emoji 1 to 3. On the Inventory side: the toggle, the owned tiles, then the slot choice and Cancel.
- **Focus visibility:** a slot shows the foreground outline when focus returns after Escape (`:focus-visible` read true).
- **Focus placement:** opening the picker focuses the slot's current emoji, or the first one for an empty slot. Opening the slot choice focuses the first empty slot. Closing returns focus to the slot or tile that opened it.
- **Reduced motion:** the preview can't emulate it. A test pins the pop and both turns inside `@media (prefers-reduced-motion: no-preference)`, with no infinite animation.
- **Screen-reader wording:** slots read "Emoji 2: Rocket. Change it". Picker tiles read "Equip Hedgehog in Emoji 2, moves it from Emoji 1" or "Keep Rocket in Emoji 2". Owned tiles read "Take off Rocket, in Emoji 2" (pressed) or "Wear Sunflower". Each change is spoken through the panel's polite live region.
