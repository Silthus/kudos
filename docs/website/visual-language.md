# The website's visual language

How the website looks and moves. It builds on the direction accepted in [#62](https://github.com/Silthus/kudos/issues/62) (variant E: a game HUD on PostHog's design system) and was settled in grilling [#63](https://github.com/Silthus/kudos/issues/63). Specs cite the rules as `V1` to `V24`. Why the website is PostHog-only is in [ADR-0005](../adr/0005-the-website-is-posthog-branded-and-posthog-sourced.md).

The parts: components and tokens from `@posthog/quill`, icons from `@posthog/icons`, hedgehogs and the RoundHog font from `@posthog/brand`, and faces and team photos from posthog.com's team pages.

## Frame, colour and type

- **V1. The HUD frame.** Every signed-in screen has the same top bar: the HedgeHug wordmark, the screen nav, skill points and coins once unlocked, the ready pill, and the member's hedgehog avatar with its level ring.
- **V2. Corner marks frame game objects only.** These are the home hero, the character and inventory panel, skill tree nodes, quest cards, crates and moments: things the member owns or can act on. Reading surfaces stay plain Quill cards and tables: the leaderboard list, achievement pages, albums, sign-in, errors and empty states. The small uppercase label is used only as a panel's label.
- **V3. Colour comes from Quill's tokens.** There are two named exceptions, each defined once as tokens with light and dark values: the moment bands (V12) and the medal metals (V16). There are no rarity colours.
- **V4. Primary marks one thing:** the next action, the selection, or "you". Progress bars, owned items and counters are neutral.
- **V5. RoundHog is for display only.** That covers the wordmark, page titles, the level number, moment headlines, and the one big stat on a hero or moment. Everything else is Inter, and numbers in tables use tabular figures.

## Light and dark

- **V6.** The first visit follows the system setting. The header toggle overrides it and persists per browser, and the command palette offers "Use system setting".
- **V7.** Every surface comes from theme tokens, except the moment bands, which keep their brand colour in both modes (V12).

## Motion

- **V8. No infinite animation**, anywhere: no shimmer, pulse, glow or wobble. A closed crate nudges once after a beat.
- **V9. Pages are static.** Ordinary page visits render numbers, bars and rings at their values, without count-ups or fills.
- **V10. A moment plays in full the first time it is seen.** After that it opens on its end state with a short fade and a Replay button. Any tap, click or Esc skips a crate or moment to its end.
- **V11. Reduced motion** shows the end state at once, with an opacity fade of at most 200 ms.

## Moments, crates and live events

- **V12. Band pages.** A level-up or achievement deep link from Slack lands on a full-width band page in one brand colour:

  | Band | Ink | Contrast |
  |---|---|---|
  | tangerine `#ff5c1c` | `#141414` | 5.97:1 |
  | lemon `#ffce1c` | `#141414` | 12.4:1 |
  | blue `#106fb2` | `#ffffff` | 5.33:1 |
  | night `#141414` | `#ffffff` | 18.4:1 |

- **V13. Crates show their reward.** Unlocks and quest rewards open as a crate in a full-screen reveal. The label shows what is inside before it opens ("Quest reward · 40 XP · 10 coins", "Unlocks: Leaderboard"). Opening reveals what the member has already earned and never decides it.
- **V14. Kudos received is quiet.** It leads with the giver's face, name and message. XP and the new sticker count follow quietly below, with no crate or chest.
- **V15. Nothing interrupts a visit.** An event that happens while the member is on the site, such as a level up, joins the HUD's ready pill, and the member opens it when they want.

## Achievements

- **V16. Medals.** A tier is a neutral metal medal (bronze, silver, gold or diamond) with one to four pips, and lists print the tier's word beside it. Gold and diamond carry a static sparkle. A ladder with no tier yet shows its emblem as a silhouette, with the next tier's requirement.

## Hedgehogs and Max

- **V17. A hedgehog always carries meaning.** It appears in exactly these places:
  - the member's equipped hedgehog, as their avatar
  - a collectable on the shelf
  - an emblem that identifies something: an achievement ladder, a Book category, or the crest of a group that maps to no team
  - one illustration per empty state, locked teaser, error page or moment

  There are no decorative hedgehogs in page headers.
- **V18. Max is the one hedgehog that speaks.** He narrates the home insight line, which states facts and never forecasts, and he writes the copy of empty states and errors. Max is never collectable and never anyone's avatar.

## People and teams

- **V19. Faces.** Lists and albums show each person's face. A face is the person's company profile cutout on its own colour, in a circle. Without a company profile it falls back to the Slack photo, and then to initials on a muted tile.
- **V20. The game avatar.** The equipped hedgehog is the member's avatar on the HUD, on the home hero and on profile cards, where the face sits small beside the name. "You" is marked in lists by the primary ring plus a "You" label.
- **V21. Matching.** A member uses a company profile when their Slack real name matches the profile's first plus last name exactly and uniquely, normalised for case, accents and spacing. A group maps to a team when its handle or name, without a `team-` prefix, matches the team's slug or name, normalised.
- **V22. Team photos.** A group that maps to a team shows the team's crest and its team photo, in a 16:10 cover crop credited "Photo from posthog.com", with no caption. Otherwise it shows a hedgehog crest and "No team photo yet". Members don't upload team photos.

## Locked and empty states

- **V23. States.**
  - **Locked:** a feature below its level is a calm card with a lock icon, "Unlocks at level N", one sentence on what the feature is, and its hedgehog in silhouette. It never teases progress.
  - **Ready:** a feature the member's level has made ready is a crate (V13).
  - **Empty:** one hedgehog, one sentence from Max, and one action, which always points to giving thanks in Slack and never to a reward.

## Accessibility

- **V24. WCAG 2.2 AA in both modes.**
  - **Contrast:** 4.5:1 for text, and 3:1 for icons, borders and rings.
  - **Colour is never the only signal:**
    - "you" is a ring plus a label
    - a tier is a metal plus pips plus its word
    - a locked state is a lock plus text
    - a selection is a primary border plus `aria-current` or `aria-pressed`
  - **Keyboard:** crates and moments work with the keyboard (Enter or Space opens, Esc skips) and announce what happened in a live region, such as "You opened Quests".
  - **Proof:** each page is checked with axe in both modes.
