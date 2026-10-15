# Design polish round 2: page by page, beside posthog.com and variant E

Ticket #481. Shot on 2026-10-15 from the fixture builds, served with `vite preview`, in Chromium through the T3 preview at 1280×900 and 390×844, light and dark. Round 1 (#453) put the site on the brand's foundations; this round looks at each page for craft: hierarchy, spacing rhythm, empty and loading states, hover, focus and press, motion, phone layouts and copy.

Fixtures: `member-with-every-feature-open` for the home, `/leaderboard`, `/quests`, `/book`, `/book/earned` and `/activity`; `member-level-7-with-one-skill-point` for the home with a level ring (`home-level7-*`); `member-waiting-for-the-book` for the locked page; `member-with-every-feature-ready` for the ready page (`/skills`), the nav tokens and the not-found page; `signed-out` for sign-in; `error` for the error page. `variant-e-*` are the accepted prototype (`origin/prototype/website-ui` at `3409ade`, `?v=e`) on the same day. posthog.com's reference shots are round 1's, in `../../brand-polish/audit/`.

## Ranked: what a member feels most

| # | What a member feels | Where | Evidence | Fix | PR |
|---|---|---|---|---|---|
| 1 | **On a phone the hero is two big circles before the name.** The 112 px face and the 120 px level ring stack, so a member scrolls past 300 px of discs to read their own name and the one action. E stacks the same, but its hedgehog is the content; the site's face is a grey initials tile for most. | Home, 390 | `home-level7-390-light.png` beside `variant-e-profile-390.png` | Below `sm`, the face and the ring share one row, each a step smaller (96 px face, 96 px ring); the name follows on the next line. Wide screens unchanged. | 1 |
| 2 | **"You're #9" breaks in two** on the phone's Everyone card: "You're" on one line, "#9" under it, the one number the card exists to show. | `/leaderboard`, 390 | `leaderboard-390-light.png` | The standing never wraps. | 1 |
| 3 | **An empty activity page is one grey sentence.** V23 gives every empty state a hedgehog, Max's sentence and one action to Slack. The timeline's empty state has the sentence only, and the recent-kudos card's "Kudos you receive show here." likewise. | `/activity` (empty) | by reading `ActivityPage.tsx` (`data-timeline-empty`) | Max's hedgehog, the sentence, and `Thank someone in Slack` as the one action, for each filter. | 2 |
| 4 | **The story sits in the left two thirds of a wide screen.** The timeline is a 48 rem column pinned left under a full-width tab row, so a 1280 px screen has a third of empty canvas on the right while the chat alternates sides. | `/activity`, 1280 | `activity-1280-light.png` | Centre the header and the timeline column; the tabs stay full width. | 2 |
| 5 | **Max's pages don't agree on their one action.** The error page's action is an outline button, a feature that waits in Slack gets a primary button, and the not-found page gets an underlined text link. | not found, error | `not-found-1280-light.png`, `error-1280-light.png` | One shape for the one action under Max: an outline button, with `Thank someone in Slack` primary where V23 asks for Slack. | 2 |
| 6 | **The home's main column is thin.** After the hero, production's main column is one card that says "See the tiers you've earned." The right rail carries four lively panels. E's home fills the main column with the character panel, which is cross-map (#96, now superseded by the collection). | Home, 1280 | `home-1280-light.png` | The Book panel could carry "14 of 28 tiers earned" and the closest next tier from `getBook`; that adds a read to the home, so it is a follow-up for the Book-as-collection work (#467), which reshapes this panel anyway. | follow-up |
| 7 | **Progress tracks read hollow.** The ring, the XP bar, the quest bars and the Book bars are outlined tracks with an empty inside; E's are a filled muted track under a dark fill. | every bar and ring | `home-level7-1280-light.png` beside `variant-e-profile-1280.png` | A muted track behind the fill, keeping the 3:1 edge. Rejected for this round: `levelContrast.test.tsx` measures every paint on the ring's circles and the bar at 3:1, and the muted track would be measured too; the edge is what V24 asks for, and the gain is small. | rejected |
| 8 | **The header carries three theme buttons** where E has one. WS16 and V6 name the three choices in the header, and the phone already has one cycling button. | header, ≥ `sm` | `home-1280-light.png` | Keep. A spec'd control, out of a polish round's scope. | rejected |

## What already holds

- Hierarchy and type scale: page titles at 800, labels at 11 px 700, body at 400, all RoundHog (round 1). The quests, Book, locked, ready and sign-in pages each lead with one title and one action.
- Hover, focus and press: every link and button shows Quill's `focus-visible` ring (checked with Tab on the home, `focus-*.png`); nav entries, index entries, board tiles and category tiles have hover fills; buttons come from Quill with their press states.
- Motion: pages are static (V9); the only hover motion is the Book index's hedgehog tilt, inside `prefers-reduced-motion: no-preference`.
- Phones: nothing overflows at 390 px (WS300); the nav rail scrolls; the Book picker is a native select.
- Copy: Max speaks on the home line, the empty board and quests, and the error pages (V18).

## Files

Each page at 1280 and 390 px, light and dark: `home`, `home-level7`, `leaderboard`, `quests`, `book`, `book-earned`, `activity`, `locked` (the Book at level 3), `ready` (the skill tree's crate page), `ready-nav-tokens`, `sign-in`, `error`; `not-found-1280-light` only. `variant-e-profile-1280`, `variant-e-profile-390`, `variant-e-leaderboard-1280-dark` and `variant-e-quests-390-dark` are the prototype.
