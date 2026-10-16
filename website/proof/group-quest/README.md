# #286: the group quest on the website

Fixture builds of the final tree (`VITE_SHELL_FIXTURE=member-with-quests` with the group fixtures in `website/src/questsFixtures.ts`), served with `vite preview` on ports 11510–11513, shot in the T3 preview browser. Every name on screen is a fixture name.

| State | Light | Dark |
| --- | --- | --- |
| `/quests` in progress, with an earlier group crate waiting | `quests-in-progress-light.png` | `quests-in-progress-dark.png` |
| `/quests` finished, the member's crate to claim | `quests-finished-light.png` | |
| The reveal: "Group quest reward", "You earned 15 coins" | `reveal-15-coins-light.png` | |
| `/quests` finished without the member | `quests-finished-without-you-light.png` | `quests-finished-without-you-dark.png` |
| Home row in progress | `home-row-in-progress-light.png` | |
| Home row claimed | | `home-row-claimed-dark.png` |
| 390 px, `/quests?quest=group` landing with focus on the goal | `phone-390-quest-group-landing-light.png` | `phone-390-quest-group-landing-dark.png` |
| Prototype E's quests page, for comparison | `variant-e-quests-light.png` | |

E's helper faces and names are left out on purpose: P82 keeps the group quest to counts until the product owner changes it in words (WS344, C6).

## V24 manual pass

- **Focus order:** the group card follows the main column (personal quests, then Waiting to open), then How quests work. Its only control is Claim, which is reachable while the member's crate waits. The home row is one link, after the bonus row.
- **Focus visibility:** `?quest=group` puts a visible ring on the card's goal (the 390 px shots). `?crate=group` focuses Claim (test `#435: ?crate={feature} lands on the page's ready crate`).
- **Reduced motion:** the reveal shows its end state at once. Covered by the `WS344 WS348` tests, which run under `prefers-reduced-motion: reduce`, because the preview browser can't emulate it.
- **Screen reader wording:** the progressbar is named "{n} of {target} took part", the region "Group quest · {group}", and the live region says "You opened your group quest reward. You earned 15 coins." (read from the reveal shot's accessibility tree). axe passes in light and dark (`WS339`).

## Design spot check (Fable 5.1)

Five findings, nothing blocking. Fixed in `fc8b3ba0`: one pill row on the claimed home row (1), no reward shown to a member who missed the group quest (2), an even separator on an earlier group crate (3), and "took part" on the home row's count (5). Left for a follow-up: a kind label on the group card (4), because `groupQuestOf` carries no quest kind. The three affected shots above are retaken from `fc8b3ba0`.
