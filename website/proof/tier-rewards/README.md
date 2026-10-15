# #297 Tier rewards and the achievement page (WS347)

## Red and green

- `red-convex.txt`: 8 failing in `convex/website/book.test.ts` before `getBook` gave tiers their rewards and seen keys.
- `red-website.txt`: 13 failing in `website/src/tierRewards.test.tsx` before the reward lines and `/book/earned`.
- `green.txt`: both files, 41 tests passing, with no assertion changed and no test skipped.

### Kudos emoji rewards (store #347)

- `red-convex-emoji.txt`: 1 failing. Before the change, `getBook` gave no silver tier its kudos emoji. Its sibling, the emoji staying hidden while the store is off, already held.
- `red-website-emoji.txt`: 4 failing in `tierRewards.test.tsx`: the ladder card, the shelf, the earned page and a joined sentence.
- `green-emoji.txt`: both files, 55 tests passing.

## Running app

These screenshots come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`). For the shots only, its opened Book answered `bookFixtures.withCoins`, the shape `getBook` gives while `walletOf` answers. That fixture change is not committed.

| | light | dark |
|---|---|---|
| earned page, 1440 px | `1-earned-wide-light.png` | `2-earned-wide-dark.png` |
| earned page, 390 px | `3-earned-390-light.png` | `4-earned-390-dark.png` |
| ladder cards | `5-ladders-wide-light.png` | `6-ladders-wide-dark.png` |
| overview shelf | `7-shelf-wide-light.png` | `8-shelf-wide-dark.png`, `9-shelf-390-dark.png` (390 px) |

Kudos emoji rewards come from `bookFixtures.withStore`, with Generosity's silver earned newest, for the shots only:

| | light | dark |
|---|---|---|
| earned page, silver, 1440 px | `10-earned-emoji-wide-light.png` | `11-earned-emoji-wide-dark.png` |
| earned page, silver, 390 px | `12-earned-emoji-390-light.png` | `13-earned-emoji-390-dark.png` |
| ladder cards | `14-ladders-emoji-wide-light.png` | `15-ladders-emoji-wide-dark.png` |
| overview shelf | `16-shelf-emoji-wide-light.png` | `17-shelf-emoji-390-dark.png` (390 px) |

On the shelf, the date line and a reserved reward row sit together at the bottom of each entry. So every date row lines up while any shelved tier shows a reward, keeping #433's alignment.

`e-moment-achievement-dark.png` is variant E's achievement moment, for comparison. E's moment, like this page, gives the emoji as the tier's reward.

- **First visit:** `data-moment="fresh"`, and the tier's key is stored as `hedgehug.seen.<key>`.
- **Reload:** `data-moment="seen"`, with `document.getAnimations()` empty.
- **390 px:** `scrollWidth` is 390, so nothing scrolls sideways.

## V24 manual pass

- **Focus order:** on `/book/earned`, the nav comes first, then `Back to Slack`, then `See achievements`. This order holds at every width: the 390 px layout stacks in DOM order, after `flex-col-reverse` was dropped. On a ladder card, the reward line is text inside the tier cell, so it adds no tab stop. On the shelf, each entry stays one link.
- **Focus visibility:** both actions are Quill buttons with the shared focus ring, and shelf links keep their `focus-visible` outline.
- **Reduced motion:** every animation lives inside `@media (prefers-reduced-motion: no-preference)` and only under `[data-moment="fresh"]`, and none is infinite. A test reads `earned.css` to check this. The preview can't emulate the preference.
- **Screen-reader wording:** the page title is `You earned First Thanks`, and the list `Tiers earned` reads `Bronze · Generosity` and `+10 coins`. A ladder tier reads `Reward: 10 coins`. A shelf entry's name ends `, reward 10 coins` or `, reward the Teddy Bear emoji`. The emoji glyph is `aria-hidden`, so a screen reader hears the emoji's name, not its glyph.
- **Contrast:**
  - The band ink `#141414` on lemon `#ffce1c` is about 12:1, measured by a test.
  - Medals sit on E's night plaque (`--band-lemon-ink`), and the reward pill is lemon on that ink. A test proves 3:1 for every metal on the ink, in light and dark.
  - The coin glyph is drawn in muted-foreground on the card, about 7:1 in light and dark.
- **axe:** the earned page, a category page with reward lines and the shelf pass axe in light and dark (`tierRewards.test.tsx`).

## Reviews

- `review-round-1.md`: GPT-6.1 Sol, one finding, rejected with its reason (the tier DM's link is map #1's).
- `review-round-2.md`: GPT-6.1 Sol, after the emoji rewards: no findings.
- `fable-spot-check.md`: Fable 5.1, ship with fixes. The must-fix is fixed: the plaque and pill were white on lemon at about 1.5:1, and are now on the night ink. The polish items were skipped, each with its reason.
