# Hover measurement (Chromium, T3 preview, 1280 × 900, light)

On the fixture build (`member-with-every-feature-open`), with the pointer over "Open the Book" (`preview_hover`), `preview_evaluate` read the arrow:

| Read | Value |
|---|---|
| `link.matches(':hover')` | true |
| `getComputedStyle(arrow).translate` | `2px` |
| `getComputedStyle(arrow).transitionProperty` | `transform, translate, scale, rotate` |
| `matchMedia('(prefers-reduced-motion: reduce)').matches` | false |

Tailwind v4 moves with the `translate` property, so `transform` stays `none`. The preview can't emulate reduced motion; the `motion-safe:` variant is pinned by `arrowLinks.test.tsx`. `home-rest-1280-light.png` and `home-hover-open-the-book-1280-light.png` are the two states.
