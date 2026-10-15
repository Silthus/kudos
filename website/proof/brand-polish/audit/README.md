# Brand audit: HedgeHug against brand.posthog.com and posthog.com

Ticket #453. Shot on 2026-10-15 from the fixture builds (`VITE_SHELL_FIXTURE=member-with-every-feature-open`, `member-waiting-for-the-book` for the locked page, `member-with-every-feature-ready` for the ready page and the crate, `signed-out` for sign-in), served with `vite preview`, in Chromium through the T3 preview at 1280×900 and 390×844, light and dark. `posthog-com-1280-*.png` are the live posthog.com home on the same day, for comparison.

## What the brand says

- **Type.** RoundHog is "PostHog's brand typeface", shipped as Regular 400, Medium 500, SemiBold 700 and Bold 800 ("the PostHog app's type scale"). posthog.com sets every word in it: body 400 at 16/24, lead paragraphs 500 at 17, `h2` 700 at 24 with −0.025em tracking, `h1` 800 at 36 with −0.025em.
- **Colour.** Twelve brand colours, each with a core, lighter and darker tone (`@posthog/brand/colors`). posthog.com's surfaces: light canvas `#EEEFE9`, cards `#FDFDF8`, borders `#BFC1B7`, text `#111827` with `#374151` secondary; dark canvas `#1E1F23`, raised surfaces `#2D2E37`, borders `#3E424F`, text `#FAFAFA` with `#AEB3C4` secondary and `#626674` muted. Primary actions are the orange `#F54E00` and the amber family (`#EB9D2A` / `#CD8407` with a `#B17816` border).
- **Shape.** posthog.com's radii are 4 to 8 px, borders are 1 px (buttons 1.5 px), raised cards and buttons carry a 2 px hard bottom edge, and there is no gradient or glow on the canvas.
- **Logo, hoggies, crests.** Hoggies are `Hedgehog<Name>` components with `size` and `title`; crests come as a full illustration and a `.Mini` badge. The standard logo never sits on a dark background, and the logomark stands alone only at small sizes.

## Where the site departs, ranked by visible impact

| # | Departure | Evidence | Fix | PR |
|---|---|---|---|---|
| 1 | **Body type is Inter.** RoundHog is confined to titles (V5); every other word on every page is Inter. posthog.com sets everything in RoundHog. The site also loads one face, `RoundHog-Bold.woff2`, at weight 700, while the brand's scale puts Bold at 800. Display tracking is −0.01em against posthog.com's −0.025em. | every `*-1280-light.png` next to `posthog-com-1280-light.png` | Load the four upright faces from `@posthog/brand/fonts` at 400/500/700/800, make RoundHog the site's `--font-sans`, drop `@fontsource-variable/inter`, set page titles to 800 with −0.025em tracking. Rewrite V5. | 1 |
| 2 | **Surfaces are Quill's app tokens, not posthog.com's.** The light canvas is a near-white neutral with faint borders (the leaderboard's list rules nearly vanish), and both modes add a primary-tinted radial glow (`.hud-root`) that posthog.com never shows. The dark canvas is a blue-black (`oklch(0.187 … 264)`) where posthog.com's is a neutral `#1E1F23` with `#3E424F` borders. | `home-1280-light.png`, `leaderboard-1280-light.png`, `sign-in-1280-light.png`, `home-1280-dark.png` | Override Quill's surface tokens (`--background`, `--card`, `--border`, `--muted`, `--input`, `--muted-foreground`) with posthog.com's light and dark values, remove the glow. Keep Quill's primary (orange light, amber dark), which posthog.com shares. Reword V3 and V7. | 2 |
| 3 | **Shapes are rounder than the brand.** Cards are 12 px (`rounded-xl` on Quill's 0.58 rem base), HUD chips and the Jump-to-me group are pills, the palette chip is a dashed monospace pill. posthog.com's cards and buttons are 4 to 8 px rounded rectangles. | `home-1280-light.png` header, `quests-1280-light.png` | Set `--radius` to 0.375 rem so Quill's scale follows (buttons 1 px, cards 10 px), make the HUD chips 6 px rectangles, keep `rounded-full` for faces, rings, pips and the ready token. | 3 |
| 4 | **Panel labels read as developer chrome.** `hud-label` is 10 px Inter 600 with 0.14 em tracking. | every panel heading | In RoundHog: 11 px, 700, 0.08 em. Rides with PR 1. | 1 |
| 5 | **The hero's fallback face is a 128 px grey disc.** With no company profile cutout the initials tile is the largest shape on the page. | `home-1280-light.png`, `home-390-light.png` | 112 px, a 1 px border in `--border` on the muted tile, initials in RoundHog 700. Rides with PR 3. | 3 |

## What already holds

- The only raw hexes outside the tokens file are the Slack glyph's four brand colours on the sign-in button. Everything else reads a Quill token, the moment bands (V12, all four are brand colours) or the medal metals (V16).
- Hoggies come from `@posthog/brand/hoggies` with `size` and an empty `title` where decorative, and the HedgeHug logo is `HedgehogHeart` beside the wordmark, above the name on the sign-in card and as the favicon (V17).
- Max is the Town Crier and speaks only where V18 allows.
- The crate reveal (`crate-*.png`) is #452's and is not audited here.
- `/skills` (`skills-*.png`) is shot for completeness and is not polished: the product owner is hiding the skill tree.

## Files

Each page at 1280 and 390 px, light and dark: `home`, `leaderboard`, `quests`, `book`, `book-earned`, `activity`, `skills`, `locked` (the Book at level 3), `ready` (the skill tree's crate page), `ready-nav-tokens` (the board with two ready tokens in the nav), `crate` (the reveal's end state) and `sign-in` (no 390 dark). `posthog-com-1280-light.png` and `posthog-com-1280-dark.png` are the reference.
