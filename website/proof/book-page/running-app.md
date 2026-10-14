# The Book page in the running app (#191)

A disposable `convex-local-backend` on 127.0.0.1:5810 (cloud) and 5811 (site), deployed from this branch with `convex dev --once`, with the website built against it and uploaded through `static-hosting upload`. The handshake mock (`testing/handshake/serveMockSlack.ts`) ran on 5812 as Slack's OIDC issuer and PostHog's flag definitions. No cloud deployment was touched.

**Flag override, local only:** `MOCK_FLAGS_ON=xp-levels,unlocks,achievements` on the mock, beside the mock's own `website` flag. Nothing else serves these flags on.

## Steps

1. `convex run feedback/unlockFilter:unopenedReplyOf '{"workspace":"TALLOWED","user":"U_NOBODY","feature":"book"}'` launched unlocks (and with them the Book) for a placeholder user before anyone joined.
2. `convex import --table members`: Juno (`U_JUNO`, Europe/Berlin) and Rowan (`U_ROWAN`).
3. `convex import --table awards`: three kudos from Juno to Rowan, at 2026-09-14T22:30Z (day 2026-09-15 in Berlin), 2026-09-22T09:00Z and 2026-10-06T09:00Z.
4. Each award counted through Achievements' own `achievements/achievements:countKudosGiven`, with its own day and time, as the engine counts a kudos. `earnedTiers` then held Juno's Generosity bronze and Seasons bronze, both earned 2026-09-14T22:30Z, and Rowan's Recognition bronze.
5. In the T3 preview browser, `/book` → **Sign in with Slack** ran the real Convex Auth handshake against the mock and signed Juno in. The page showed Max's `Book opens at level 4.` with `Go to Home` → `1-locked-light.png`.
6. `convex import --table unlocks` of `{member: Juno, feature: "book", readyAt}` made the Book ready. The open page followed: the Book's crate in place with a primary `Open` → `2-ready-light.png`.
7. The page's own `Open` sent `openFeature("book")`. After the reveal, the page became the Book from `getBook`, with focus on the title `Achievements` → `3-book-light.png` and `4-book-dark.png` (1280×1720, the whole page).

## What the screenshots show

- **A ladder at bronze, with a tier date:** Generosity. Bronze `First Thanks` shows a filled bronze medal with one pip and `Earned 15 Sept 2026`. The kudos was given at 22:30 UTC on 14 Sep, which is 15 Sep in Juno's zone, so the date is printed in the read's `timeZone`, not in UTC. Silver carries the neutral `Next` tag and `At 25`, and the bar reads `3 of 25` (`progressbar "3 of 25 for Generous Soul"`).
- **A ladder with no tier yet:** Recognition. Its emblem is a silhouette, all four medals are dashed outlines, and Bronze carries `Next` and `At 1`.
- **A second ladder at bronze:** Seasons bronze `First Chapter` was earned by the same 14 Sep kudos and shows the same date.
- All seven shipped ladders show in the catalogue's order. There's no total, no closest next tier and no reward.

## Every metal

The local history reaches only bronze, so `5-every-metal-light-fixture.png` and `6-every-metal-dark-fixture.png` come from the fixture build (`VITE_SHELL_FIXTURE=member-with-the-book-opened`, with `Root.tsx` pointed at `bookFixtures.everyTierEarned` for the shot only; that edit was reverted and isn't committed). They show the four metals in both modes, each with its pips, gold and diamond with the static sparkle, and the tier's word beside it.

## Manual pass (V24)

- **Focus order and visibility:** the Book page has no control of its own. Arriving after the reveal puts focus on the `Achievements` title (`document.activeElement` is the `h1`). The keyboard path is the HUD's nav, theme and account menu, then the cards in reading order.
- **Screen-reader wording:** each ladder is an `article` named by its heading, with its counts line, the progressbar `"{count} of {at} for {tier name}"`, and the list `"{ladder} tiers"`, whose items read `Bronze First Thanks Earned 15 Sept 2026` or `Silver Generous Soul At 25 Next`. The medal and the emblem are `aria-hidden`, because the tier's word and the ladder's name carry the same meaning.
- **Reduced motion:** the page has no animation at all (`document.getAnimations()` is empty). The preview can't emulate `prefers-reduced-motion`, so there is nothing more to check there.
- **Contrast:** the medal metals are tested at 3:1 against Quill's card in both modes (`medalMetals.test.tsx`). Bars and outlines use `muted-foreground`, which is above 3:1 on the card in both modes.
