# #297 Tier rewards and the achievement page (WS347)

## Red and green

- `red-convex.txt`: 8 failing in `convex/website/book.test.ts` before `getBook` gave tiers their rewards and seen keys.
- `red-website.txt`: 13 failing in `website/src/tierRewards.test.tsx` before the reward lines and `/book/earned`.
- `green.txt`: both files, 41 tests passing, with no assertion changed and no test skipped.

## Running app

These screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`). For the shots only, its opened Book answered `bookFixtures.withCoins`, the shape `getBook` gives while `walletOf` answers. That fixture change is not committed.

| | light | dark |
|---|---|---|
| earned page, 1440 px | `1-earned-wide-light.png` | `2-earned-wide-dark.png` |
| earned page, 390 px | `3-earned-390-light.png` | `4-earned-390-dark.png` |
| ladder cards | `5-ladders-wide-light.png` | `6-ladders-wide-dark.png` |
| overview shelf | `7-shelf-wide-light.png` | `8-shelf-wide-dark.png`, `9-shelf-390-dark.png` (390 px) |

`e-moment-achievement-dark.png` is variant E's achievement moment, for comparison.

- **First visit:** `data-moment="fresh"`, and the tier's key is stored as `hedgehug.seen.<key>`.
- **Reload:** `data-moment="seen"`, with `document.getAnimations()` empty.
- **390 px:** `scrollWidth` is 390, so nothing scrolls sideways.

## V24 manual pass

- **Focus order:** on `/book/earned`, the nav comes first, then `Back to Slack`, then `See achievements`. This order holds at every width: the 390 px layout stacks in DOM order, after `flex-col-reverse` was dropped. On a ladder card, the reward line is text inside the tier cell, so it adds no tab stop. On the shelf, each entry stays one link.
- **Focus visibility:** both actions are Quill buttons with the shared focus ring, and shelf links keep their `focus-visible` outline.
- **Reduced motion:** every animation lives inside `@media (prefers-reduced-motion: no-preference)` and only under `[data-moment="fresh"]`, and none is infinite. A test reads `earned.css` to check this. The preview can't emulate the preference.
- **Screen-reader wording:** the page title is `You earned First Thanks`, and the list `Tiers earned` reads `Bronze · Generosity` and `+10 coins`. A ladder tier reads `Reward: 10 coins`. A shelf entry's name ends `, reward 10 coins`.
- **Contrast:**
  - The band ink `#141414` on lemon `#ffce1c` is about 12:1, measured by a test.
  - Medals sit on a card-coloured plaque, and the existing metal tests prove 3:1 against the card in both modes.
  - The coin glyph is drawn in muted-foreground on the card, about 7:1 in light and dark.
- **axe:** the earned page, a category page with reward lines and the shelf pass axe in light and dark (`tierRewards.test.tsx`).

## Reviews

- `review-round-1.md`: GPT-6.1 Sol, one finding, rejected with its reason (the tier DM's link is map #1's).
