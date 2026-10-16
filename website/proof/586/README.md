# #586: the Book's bought crates as a foil-pack stack and one opening scene

Fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-spread`), served with `vite preview`, driven through the T3 preview browser. Made-up members and fixture hoggies only.

| Shot | What it shows |
| --- | --- |
| 01-stack-light-1280 | Four waiting packs stacked below the Crates heading, offset and tilted; Buy a crate stays |
| 02-stack-fanned-light-1280 | After a tap the stack fans out, each pack named "Open pack n" |
| 03-scene-first-open-light-1280 | The scene over the scrim: pack 1 torn, card flipped to Doctor with the rarity rays; packs 2–4 sealed beside it with "Tap to open"; the ribbon and the name only |
| 04-scene-all-open-light-1280 | Every pack open in a row (legendary Wizard glowing); "Put them in the book" focused; no other buttons |
| 05-landing-light-1280 | The book flipped to the rarity hash, the tiles popping with the rarity glow |
| 06-after-landing-light-1280 | The stack gone; the live region read "Doctor, Wizard, Banana and Surfer are in your book." |
| 07-stack-dark-1280 | The stack in dark mode |
| 08-scene-legendary-dark-1280 | "✦ Legendary find ✦ Wizard" in dark mode |
| 09-after-escape-landing-dark-1280 | Esc with one pack open: Wizard landed, three packs left on the stack with focus returned to it |
| 10-stack-light-390 | The stack at 390 px |
| 11-stack-fanned-light-390 | The fan fits the width at 390 px |
| 12-scene-light-390 | The scene wraps into a column at 390 px |
| 13-spread-with-stack-light-1280 | After merging #585: the stack sits below the Book spread's cover |
| 14-spread-after-landing-light-1280 | Esc with Wizard open: the spread flipped to Legendary, Wizard landed, three packs left and the stack focused |

Reduced motion, the refused and unreachable answers, the once-only send, Tab trapping and axe are proven in `website/src/bookPacks.test.tsx`; the preview can't emulate `prefers-reduced-motion`.
