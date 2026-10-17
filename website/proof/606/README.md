# #606: every crate a pack, with XP and coin chips

Fixture builds (`VITE_SHELL_FIXTURE=member-with-packs` and `member-with-more-packs`), served with `vite preview`, driven through the T3 preview browser. Made-up members and fixture hoggies only. The fixture's `openCrate` answers a deterministic `applied` per crate key (40–160 XP in steps of 5, 5–30 coins) from a running standing, and its member read never moves, so the HUD returns to the fixture's numbers once a landing is done.

| Shot | What it shows |
| --- | --- |
| 01-stack-every-kind-light-1280 | Five waiting packs of every kind (a Journey, two weekly and two bought crates) stacked below the spread; Buy a crate stays |
| 02-stack-fanned-light-1280 | After a tap the stack fans out, each pack named "Open pack n" as listed |
| 03-scene-first-open-chips-light-1280 | Pack 1 revealed (Banana) with "+130 XP" and "+5 coins" chips under its card; the HUD pinned at the answer's from |
| 04-scene-all-open-chips-light-1280 | Every pack open, each with its chips; "✦ Legendary find ✦ Wizard"; "Put them in the book" focused (taken before the row-gap fix in the second commit) |
| 05-landing-chips-fly-to-hud-light-1280 | After Put them in the book: the spread flipped to Uncommon, Doctor landed with the glow, "+75 XP" flying to the level ring and "+18 coins" to the coin counter; the HUD already turned over to level 7 from the first pack |
| 06-put-them-in-the-book-light-1280.mp4 | The whole landing: each hoggie flies to its tile, then its chips fly to the HUD, the level ring turns over once and the coins count up |
| 07-after-landing-light-1280 | The stack gone, focus on the page title; the live region read "Banana, Doctor, Doctor, Doctor and Wizard are in your book." and the level-up region "You reached level 7." |
| 08-stack-dark-1280 | The stack in dark mode |
| 09-scene-legendary-chips-dark-1280 | "✦ Legendary find ✦ Wizard" with "+115 XP" and "+5 coins" in dark mode |
| 10-escape-landing-chip-flight-dark-1280 | Esc with one pack open: the "+115 XP" chip flying to the HUD over the Legendary spread; four packs stayed on the stack, focused afterwards |
| 11-stack-light-390 | The stack at 390 px |
| 12-stack-fanned-light-390 | The fan fits the width at 390 px |
| 13-scene-chips-light-390 | The scene in one column at 390 px, chips under each opened card |
| 14-quests-claim-opens-the-scene-light-1280 | Claim on /quests opens the same scene: the weekly crate's pack revealed with its chips, the other four packs sealed beside it, no old reveal |
| 15-quests-escape-chip-flies-to-hud-light-1280 | Esc on /quests: no spread, so the hoggie flies to the Book's nav entry and the "+75 XP" chip to the level ring; the address stays `/quests` |
| 16-stack-more-packs-light-1280 | With `morePacks`, the stack says "5 packs waiting + more" |

Reduced motion, hidden coins, a null `applied`, the packs-absent path, the ready feature card on the home, `?crate=journey`, the once-only send and the HUD's from/to pins are proven in `website/src/bookPackRewards.test.tsx`; the preview can't emulate `prefers-reduced-motion`.
