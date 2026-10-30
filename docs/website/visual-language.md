# The album's visual language

How the album looks and moves. The album is the website a member gets while `album` is on for them: a calm Team yearbook where people are the collection and hoggies are the surprise ([ADR-0009](../adr/0009-the-album-is-collection-first.md), rules AL39–AL57 of the album spec). It re-implements the prototype accepted on [#625](https://github.com/Silthus/kudos/issues/625) ([`PROTOTYPE.md`][prototype] at `0ac9e96d`) on PostHog's own parts, as [ADR-0005](../adr/0005-the-website-is-posthog-branded-and-posthog-sourced.md) still requires: components and tokens from `@posthog/quill`, icons from `@posthog/icons`, hedgehogs and the RoundHog font from `@posthog/brand`, and faces from posthog.com's team pages. Every page meets WCAG 2.2 AA in both themes.

Specs cite these rules as `VA1` to `VA62`. Each rule is one line and ends with what follows it: the album shell on `main` ([#671](https://github.com/Silthus/kudos/pull/671), in `website/src/album/`), or, for a page a later ticket builds, the prototype's component and screenshot with the AL rule that ticket builds. Where the shell doesn't follow a rule yet, the rule says so. The old shell keeps following `V1` to `V24` until ticket 25 deletes it; the last section says which of them the album keeps. Settled on [#660](https://github.com/Silthus/kudos/issues/660) under map [#624](https://github.com/Silthus/kudos/issues/624)'s full-autonomy grant; Coherence journal decisions `d-4a23c449` (the numbering), `d-956c065f` (no endless loops) and `d-c351c907` (the citations).

## The frame

- **VA1. A top bar and a sidebar, no tabs.** The top bar holds, in order, the HedgeHug mark and wordmark, the XP bar, the packs button, the tray, Activity and Leaderboard, the emoji button, the member's face and name, and the settings cog; the sidebar and the page sit below it. *Follows:* [`TopBar.tsx`][topbar], [`AlbumShell.tsx`][shell]; shot [`shell-topbar-hover`][shot-topbar]; AL42.
- **VA2. The XP bar is slim and says the next level in words**, a level pill, a 6 px track and "290 XP to level 7", at its value on every visit. *Follows:* `XpBar` in [`TopBar.tsx`][topbar]; AL42.
- **VA3. The packs button shows two pack wrappers and the waiting count**, accent-tinted while a pack waits and muted with "Say thanks to earn one" while none does. *Follows:* `PacksButton` in [`TopBar.tsx`][topbar]; shots [`ready-to-unlock`][shot-ready], [`milestones`][shot-milestones].
- **VA4. Activity and Leaderboard are icon buttons whose label slides open on hover and focus**, and stays open on the current one. *Follows:* `PageLinks` in [`TopBar.tsx`][topbar] and `.al-icon-label` in [`album.css`][css]; shot [`shell-topbar-hover`][shot-topbar]; AL42.
- **VA5. The sidebar reads search, your team, the teams, then the deeper pages.** Your team leads as a card with its crest, count and progress bar; ten teams follow by progress, each a crest, a name and its state, then "Show N more"; `Hoggies` and `Milestones` sit below a rule. *Follows:* [`Sidebar.tsx`][sidebar]; shot [`ready-to-unlock`][shot-ready]; AL42.
- **VA6. The frame's surfaces are layered by token:** the top bar is the card colour at 88% over a 12 px blur and sticks to the top, the sidebar takes the chrome colour, and the page is the flat canvas. *Follows:* `.al-top`, `.al-side`, `.al-shell` in [`album.css`][css].
- **VA7. A panel opens under its button as a card**, one at a time, and closes on `Escape`, which hands focus back to the button, or on a press outside. *Follows:* [`usePopover.ts`][popover], `.al-popover` in [`album.css`][css]; shot [`emoji-popup`][shot-emoji-popup].
- **VA8. `Getting started` is one slim strip on the home page only**, "Getting started · n of 4", a dashed circle per step still to do and a filled tick per step done, and the next step named; it leaves once all four are done. *Follows:* [`GettingStarted.tsx`][started]; AL42.
- **VA9. A page opens with its title**, an eyebrow above it where the page has a kind to name ("Your team", "Your profile"), and quiet lines below, centred in a column at most 52 rem wide. *Follows:* `Page` and `PersonPage` in [`pages.tsx`][pages], `.al-page-body` in [`album.css`][css]; shots [`ready-to-unlock`][shot-ready], [`milestones`][shot-milestones].

## Colour and type

- **VA10. Surfaces are posthog.com's in each mode**, the canvas, card, muted, chrome and border values in `index.css`, and the canvas stays flat. *Follows:* [`index.css`][index-css], `.al-shell` in [`album.css`][css].
- **VA11. One album accent marks what moves you forward**: the XP and team progress fills, held pips, waiting packs and tray counts, the ready chip, "Show N more", eyebrows, the packs button's current-page ring and a page's one primary action. *Follows:* `--al-accent` and its uses in [`album.css`][css]; shot [`ready-to-unlock`][shot-ready].
- **VA12. The accent comes in two strengths**: `--al-accent` (`#c94812` light, `#ff7a45` dark) for wide fills, its 14% tint `--al-accent-soft`, and marks that need 3:1; `--al-accent-ink` (`#a33a0c`, `#ff9a6e`) for text at 4.5:1 on the card, chrome, canvas and that tint, and for small solid marks: the count bubbles on the packs and tray, held pips and the dashed step rings. *Follows:* [`album.css`][css], [`albumAccessibility.test.tsx`][a11y-test].
- **VA13. The album's green, `--al-done`, marks only a finished `Getting started` step**; it is not the uncommon rarity's green. *Follows:* `--al-done` and `.al-started-step[data-done]` in [`album.css`][css].
- **VA14. Gold marks complete and unlocked**: a complete team's progress bar turns gold, its seal turns gold foil only once unlocked, and the gold medal is gold; gold fills take dark ink, and gold text uses a dark gold that meets 4.5:1 on the card, never `--medal-gold` on light. *Follows:* the gold bar of a complete team in the prototype's [`shell.css`][proto-shell-css], the foil and `--r6t-gold` in its [`team.css`][proto-team-css]; shots [`team-claimed`][shot-claimed], [`ready-to-unlock`][shot-ready]; tickets 17 (AL45) and 21 (AL51); the shell's sidebar bar stays accent on a complete team.
- **VA15. Rarity colours and medal metals keep their tokens and always sit beside their word**: a hoggie's rarity on its plate's edge and word, its glow in the opening and the rarity strip, a medal's metal beside its tier's word. *Follows:* `--rarity-*` and `--medal-*` in [`index.css`][index-css]; shots [`hoggies-sticky`][shot-hoggies], [`milestones`][shot-milestones]; tickets 18 and 21.
- **VA16. Every colour the album adds is a token on `.al-shell` with a dark value under `.dark .al-shell`**, confetti, foil, ray and card-frame palettes included, never a literal in a component; only a shadow may use black at a low alpha. *Follows:* [`album.css`][css], whose two literals are shadows.
- **VA17. RoundHog sets every word but emoji names and code (VA21)**, at the brand's four weights only: 400 for body, 500 for emphasis, 700 for headings and controls, and 800 for the wordmark and page titles; RoundHog has no 600. *Follows:* `--font-sans` and the font faces in [`index.css`][index-css], `.al-brand` in [`album.css`][css], [`PageTitle.tsx`][page-title]; the shell's top-bar buttons, member link, menu links, chips and initials still ask for 600.
- **VA18. Counts use tabular figures**, so a level, an XP line or a count that ticks never shifts its neighbours. *Follows:* the prototype's [`shell.css`][proto-shell-css]; the shell's top-bar counts don't yet, which a follow-up on the shell closes.
- **VA19. Page titles are display type, 800, tracked at −0.025em.** *Follows:* `hud-display` in [`PageTitle.tsx`][page-title] and [`index.css`][index-css].
- **VA20. Labels are uppercase and tracked**: an eyebrow at 12 px, 800, tracked 0.08em in accent ink, and a sidebar heading at 11 px, 700, tracked 0.06em in the quiet colour. *Follows:* `.al-eyebrow`, `.al-side-heading` in [`album.css`][css].
- **VA21. An emoji's name is set in the monospace stack between colons**, `:workflows:`, beside its picture. *Follows:* the prototype's [`EmojiShelf.tsx`][proto-emoji-shelf]; shots [`emoji-popup`][shot-emoji-popup], [`unlock-moment`][shot-unlock]; ticket 20 (AL31).

## Light and dark

- **VA22. The first visit follows the system setting**, the theme control in the sidebar's foot overrides it per browser, and a script in the page's head sets the theme before the first paint. *Follows:* `Footer` in [`AlbumShell.tsx`][shell], [`ThemeControl.tsx`][theme-control], `theme-*.js` loaded from [`index.html`][index-html].
- **VA23. Every album page, panel and moment renders in light and dark from tokens.** The prototype is light only, so each UI ticket gives its own colours their dark values. *Follows:* `.dark .al-shell` in [`album.css`][css], [`albumAccessibility.test.tsx`][a11y-test]; AL55.

## Motion

- **VA24. Pages are still.** An ordinary visit renders every number, bar, ring and seal at its value; counts move only inside a moment. *Follows:* `XpBar` in [`TopBar.tsx`][topbar], `TeamList` in [`Sidebar.tsx`][sidebar].
- **VA25. No animation loops forever**: anything that repeats stops on its still end state within 5 seconds of starting, so a 2.4–3.4 s cycle plays at most twice and the foil's 6 s slide becomes one pass under 5 s. *Follows:* the shell, which has no loop ([`album.css`][css]); the UI tickets, for the prototype's seventeen loops listed below.
- **VA26. A pack, put-in or unlock moment starts only from the member's own act**, never from following a link; an emoji earned and not yet seen plays as a moment on the member's next album visit, once the page has settled (AL26). *Follows:* the prototype's [`PackOpening.tsx`][proto-opening], [`UnlockMoment.tsx`][proto-unlock], [`EmojiMoments.tsx`][proto-emoji-moments]; AL26, AL45, AL47, AL54.
- **VA27. A click or tap advances a moment by one beat; `Escape`, or a visible Skip, jumps it to its end state.** *Follows:* the prototype's [`PackOpening.tsx`][proto-opening] (a click turns the next card, `Escape` closes) and [`UnlockMoment.tsx`][proto-unlock] (a click moves on from the name and the emoji), where a visible Skip is still to build, and where the unlock moment's `Escape` still advances like a click and neither works before the name shows; tickets 17–20.
- **VA28. Moments never overlap**: emoji moments wait for pack opening, putting in and the sticker unlock to end, then play one at a time; a hype emoji shown in its pack and a team emoji shown in its unlock count as seen there and never play again. *Follows:* the prototype's [`EmojiMoments.tsx`][proto-emoji-moments], [`PackOpening.tsx`][proto-opening], [`UnlockMoment.tsx`][proto-unlock]; AL54, ticket 20.
- **VA29. An emoji moment plays once per emoji on any device**, because its seen mark is stored with the album (`markEmojisSeen`), not in the browser. *Follows:* `seen` on `emojis` in [`answer.ts`][answer]; AL26, AL40, AL41, ticket 20.
- **VA30. Entrances ease out and landings overshoot**: a count-up eases out over 900 ms, and a stamp or landing press uses a springy curve such as `cubic-bezier(0.2, 0.9, 0.3, 1.4)`. *Follows:* `useCountUp` in the prototype's [`motion.ts`][proto-motion], the stamp in its [`moment.css`][proto-moment-css].
- **VA31. The frame's own motion is short**: an icon button's label and the drawer's chevron move in 160 ms, ease out. *Follows:* `.al-icon-label`, `.al-side-toggle svg` in [`album.css`][css].
- **VA32. Reduced motion shows every end state at once**, with at most a 200 ms opacity fade and no flight, ring, sparkle, confetti, ray or count-up; the frame's transitions stop. *Follows:* the `prefers-reduced-motion` block in [`album.css`][css]; AL55, where the prototype's 240–300 ms fades shorten to 200 ms.

The prototype's seventeen loops that VA25 bounds, at `0ac9e96d` under `round-5/`: `shell/opening.css` lines 327, 337, 401, 1071 and 1112 (the sealed pack's bob, breath and nudge, the rarity burst, "Something rare…"); `shell/shell.css` 249 (the packs button's halo); `shell/tray.css` 70 and 347 (the tray's bob, a slot's beckon); `shell/emoji.css` 124 and 555 (the emoji button's dot, the emoji moment's rays); `pages/team/team.css` 545, 610, 635, 675 and 805 (the foil, the ready seal's halo, shimmer and late halo, the unlock button's nudge); `pages/team/moment.css` 88 (the unlock rays); `pages/milestones/milestones.css` 393 (the next medal's glow).

## Packs, putting in and the team sticker

- **VA33. A closed pack names whom you thanked for it**, with their face and "For thanking <name>", and never says whether it holds their sticker or which hoggie. *Follows:* the prototype's [`PackOpening.tsx`][proto-opening]; shot [`shell-hype-in-opening`][shot-opening]; AL47, ticket 18.
- **VA34. Opening flips a binder's cards one turn at a time**: rip the booster, flip the person card, then the hoggie, which glows in its rarity's colour before it flips and carries a foil sheen that grows with its rarity, each turn with one shine sweep and one ring. *Follows:* the prototype's [`Cards.tsx`][proto-cards], [`opening.css`][proto-opening-css]; shot [`shell-hype-in-opening`][shot-opening]; AL47, ticket 18.
- **VA35. Confetti is sized to the moment**: none for a pack that adds nobody new, a modest burst for a new person or a new emoji, a big gold burst for "Team complete!" and the sticker unlock, and rarity-coloured sparkles only for a rare, epic or legendary hoggie, more the rarer it is. *Follows:* the prototype's [`Celebration.tsx`][proto-celebration], [`PackOpening.tsx`][proto-opening], [`UnlockMoment.tsx`][proto-unlock]; AL47, tickets 17, 18 and 20.
- **VA36. A new card says so on the card**: a "New in your album" ribbon on a person, "New" on a hoggie, the team bar ticking from its old count to its new one, and, for a first-time person, their hype emoji's picture and Slack name alone, in its own row under their card, never wider than the card and never over it, a long name wrapping, with no "unlocked" and no add-it prompt (#718, #719). *Follows:* the prototype's [`Cards.tsx`][proto-cards], [`HypeReveal.tsx`][proto-hype]; shot [`shell-hype-in-opening`][shot-opening]; AL47.
- **VA37. Opened cards fly up into the top bar's tray**, never straight into the album. *Follows:* the prototype's [`Flights.tsx`][proto-flights], [`Tray.tsx`][proto-tray]; shot [`tray-open`][shot-tray]; AL47, ticket 19.
- **VA38. Putting in is one deliberate flight per card**: it lifts out of the tray, holds, flies on a curve to its slot, which glows first, and lands with a press, a ring and sparkles; the counts tick on landing. *Follows:* the prototype's [`putIn.tsx`][proto-put-in], [`Flights.tsx`][proto-flights]; shot [`shell-put-in-flight`][shot-flight]; AL47, ticket 19.
- **VA39. A ready team sticker is grey but alive**: the crest in grey inside a seal whose segments are all filled in the accent, a "Ready to unlock" ribbon, a shimmer that stops within 5 seconds (VA25), and "Unlock the <team> sticker" as the page's primary action. *Follows:* the prototype's [`TeamSticker.tsx`][proto-team-sticker], [`team.css`][proto-team-css]; shot [`ready-to-unlock`][shot-ready]; AL45, ticket 17.
- **VA40. The unlock moment runs about 5 seconds**: the page dims and the sticker lifts to the centre, colour spreads through the grey crest like ink, then a stamp, light rays, one foil shine and gold confetti, "<Team> sticker unlocked" and then the team emoji by about 4 seconds, and on "Put it on the page" the sticker flies back to its place in under one. *Follows:* the prototype's [`UnlockMoment.tsx`][proto-unlock], [`moment.css`][proto-moment-css]; shot [`unlock-moment`][shot-unlock]; AL45, ticket 17.
- **VA41. An unlocked team sticker is gold foil** with "Unlocked <date>" and its emoji, still. *Follows:* the prototype's [`TeamSticker.tsx`][proto-team-sticker]; shot [`team-claimed`][shot-claimed]; AL45, AL20.
- **VA42. An emoji moment pops the emoji to the centre** with its picture, its name and why it was earned, says "use it in Slack" only once Slack has it, and flies into the emoji button. *Follows:* the prototype's [`EmojiMoments.tsx`][proto-emoji-moments]; shot [`shell-emoji-moment`][shot-emoji-moment]; AL31, AL54, ticket 20.

## The collection

- **VA43. A team page is a class photo**: the team's faces as tiles on one warm sheet of photo paper, uncollected people as silhouettes, and the team's seal pinned to its corner, ringed by one segment per person; every face carries its name, so no caption repeats them. *Follows:* the prototype's [`ClassPhoto.tsx`][proto-class-photo]; shot [`ready-to-unlock`][shot-ready]; AL45, ticket 17.
- **VA44. A hoggie is a field-guide plate**: found ones in full art with their name, rarity word and edge, spares with "×n", and hidden ones as grey silhouettes saying "Not found yet". *Follows:* the prototype's [`Collection.tsx`][proto-collection]; shot [`hoggies-sticky`][shot-hoggies]; AL50, ticket 21.
- **VA45. `Hoggies` leads with a lit shelf of your rarest finds, then "The collection" bar sticks under the top bar** with All, Found, Still hidden and Spares and the rarity strip, each rarity found of its total and the one you're in marked; a hoggie's detail is a centred card with previous and next. *Follows:* the prototype's [`Showcase.tsx`][proto-showcase], [`RarityStrip.tsx`][proto-rarity-strip], [`HoggieDetail.tsx`][proto-hoggie-detail]; shots [`hoggies-sticky`][shot-hoggies], [`hoggies-detail`][shot-hoggie-detail]; AL50, ticket 21.
- **VA46. Milestones leads with the next steps, then the medals earned**: a tally of the medals earned per metal, each tile topped in its metal; `Closest medals` as one bordered list, the closest row warm, each with its tier emblem, a metal dot, the hint in bold, a slim amber-to-accent bar and the count to go in accent ink; `Earned` as cards with the emoji and its Slack state under the words. *Follows:* [`Milestones.tsx`](../../website/src/album/Milestones.tsx) and [`milestones.css`](../../website/src/album/milestones.css), from variant A of the round-1 prototype on `prototype/milestones-overview`; AL51.
- **VA47. The album shows how far you are toward what isn't yours yet**: a team's "4 of 5", the next medal's ring and count, and each locked emoji in grey with how to unlock it and your progress. *Follows:* `TeamState` in [`Sidebar.tsx`][sidebar]; the prototype's [`EmojiShelf.tsx`][proto-emoji-shelf]; shots [`emoji-popup`][shot-emoji-popup], [`milestones`][shot-milestones].

## People, weeks and boards

- **VA48. A person's page is their yearbook entry**: their face, your history with them (first thanked, kudos and hugs both ways, your best message quoted), their teams as chips, and their hype emoji or the line that unlocks it. *Follows:* `PersonPage` in [`pages.tsx`][pages] (the chips); the prototype's [`PersonParts.tsx`][proto-person]; shot [`team-person-hype`][shot-person]; AL46, ticket 17.
- **VA49. Activity is a weekly edition**: week tabs, each with a sparkline, over one issue per week of "This week in your album", its tallies, the kudos of the week, every other kudos you gave and got that week as a line with the people, the weekday and the words in quotes, new faces, hoggies from packs and quiet hugs, each list of people cut at twelve with "and N more". *Follows:* the prototype's [`WeeklyEdition.tsx`][proto-activity]; shot [`activity-B`][shot-activity]; AL48, ticket 22.
- **VA50. The leaderboard sets the people board and the team board side by side**, your row and your team pinned as "you" (VA61), and "Who gave" narrows the people board to one team. *Follows:* the prototype's [`SideBySide.tsx`][proto-leaderboard]; shot [`leaderboard-C`][shot-leaderboard]; AL49, ticket 23.
- **VA51. The profile is your yearbook page**: your face, name, team, level and XP bar, the last kind note someone sent you, your weekly rank and your team's, your album at a glance, your coolest finds, and your best milestones with the closest next one. *Follows:* the prototype's [`ProfilePage.tsx`][proto-profile]; shot [`profile-after-put-in`][shot-profile]; AL52, ticket 24.

## Hedgehogs, faces and empty states

- **VA52. A hedgehog always carries meaning**: the sitting hedgehog as the HedgeHug mark and on the `Hoggies` entry, a hoggie, a milestone's emblem, and Max on error and not-found pages; a team's crest is the team's art, and nobody's avatar is a hedgehog. *Follows:* `HedgehogSitting` in [`TopBar.tsx`][topbar] and [`Sidebar.tsx`][sidebar]; shot [`shell-topbar-hover`][shot-topbar].
- **VA53. Max writes only the album's error and not-found pages.** *Follows:* `ErrorPage` and `NotFoundPage` inside [`AlbumShell.tsx`][shell] and [`pages.tsx`][pages].
- **VA54. A person is their face**: the posthog.com cutout on its own colour or else their Slack photo, in a circle, and their initials in a muted circle when they have neither or the picture fails to load; the member's own face is their avatar in the top bar. *Follows:* `MemberFace` in [`Face.tsx`][face], used by [`TopBar.tsx`][topbar]; shot [`ready-to-unlock`][shot-ready].
- **VA55. An empty state is one quiet sentence that says how it fills**, pointing to giving thanks wherever a thank-you fills it, with no Max and no hedgehog. *Follows:* `PacksButton` ("Say thanks to earn one"), `TrayButton` and `EmojiButton` in [`TopBar.tsx`][topbar], the packs page in [`pages.tsx`][pages].

## Phone

- **VA56. Below 64 rem the frame folds**: the top bar keeps the mark, XP, packs, tray and emojis and folds Activity, Leaderboard, the member and Settings into a menu behind the face; the sidebar becomes a "Teams and pages" drawer that closes once a link in it is followed; nothing scrolls sideways at 390 px. *Follows:* `Menu` in [`TopBar.tsx`][topbar], [`Sidebar.tsx`][sidebar], the narrow block in [`album.css`][css], "AL55: the phone layout" in [`albumShell.test.tsx`][shell-test]; the 390 px width is proved in a browser, #671's sandbox proof for the shell and each UI ticket's for its page.

## Accessibility

- **VA57. WCAG 2.2 AA contrast in both themes**: 4.5:1 for text, and 3:1 for icons, fills, rings and the border of a control only its border identifies, such as a search field. *Follows:* [`albumAccessibility.test.tsx`][a11y-test]; the sidebar's search field border, about 1.5:1 on the chrome in light, doesn't yet.
- **VA58. Colour is never the only signal**: a team's state is pips with "n of m", the word "Ready" or a tick named "Unlocked"; a medal is a metal and its word; a rarity is a colour and its word; a locked emoji is grey and says how to unlock it. *Follows:* `TeamState` in [`Sidebar.tsx`][sidebar]; shots [`milestones`][shot-milestones], [`emoji-popup`][shot-emoji-popup].
- **VA59. The current page carries `aria-current` and a visible mark that differs from the surface under it**: an icon button keeps its label open and filled, the member's link and Settings are filled, the packs button takes an inset accent ring, your team's card takes a foreground border, and a sidebar entry takes a fill plus weight 700. *Follows:* `aria-current` across [`TopBar.tsx`][topbar] and [`Sidebar.tsx`][sidebar], [`album.css`][css]; a sidebar entry's fill (`--muted`) equals the chrome in light, so only its weight shows there yet.
- **VA60. A selection, such as a filter, a week tab or "Who gave", differs from its siblings by more than a change of hue**: a solid fill, a thicker dark border, a ring plus weight 700, or a label such as "Showing", each at 3:1, and it carries `aria-pressed`, `aria-selected` or `aria-current`. *Follows:* the prototype's [`WeeklyEdition.tsx`][proto-activity] (a thicker dark border and `aria-pressed` on the week tab), [`hoggies.css`][proto-hoggies-css] (a solid fill on the filter), [`RarityStrip.tsx`][proto-rarity-strip] (a ring, weight 700 and `aria-current`), [`SideBySide.tsx`][proto-leaderboard] ("Showing" on Who gave); AL48–AL50, tickets 21–23.
- **VA61. "You" is a ring or tint plus a "You" or "Your team" label**, on your row and your team on the boards and wherever else a list holds you. *Follows:* the prototype's [`SideBySide.tsx`][proto-leaderboard]; shot [`leaderboard-C`][shot-leaderboard]; AL49, ticket 23.
- **VA62. Everything works by keyboard**: Tab walks the top bar, then the sidebar, then the page, a 2 px focus ring shows on every control but never on the title focus lands on, panels open with `Enter` and close with `Escape`, and moments start with `Enter` or `Space`, skip with `Escape` (VA27) and say what happened in a live region. *Follows:* `:focus-visible` in [`album.css`][css], "AL55: the album is usable by keyboard alone" in [`albumAccessibility.test.tsx`][a11y-test]; tickets 17–20 for moments.

## The old shell's rules

The old shell follows `V1` to `V24` as they were written at [`6ffc01b9`][old-rules] until ticket 25 deletes it. In the album:

| Rule | In the album |
|---|---|
| V1 The HUD frame | Replaced by the top bar and sidebar (VA1–VA9). |
| V2 Corner marks | Broken: no corner marks; packs, cards, seals and medals are drawn as the objects they are (VA3, VA34, VA39, VA46). |
| V3 Colour from Quill, posthog.com surfaces | Surfaces hold (VA10); the album adds its accent, green and gold (VA11–VA14); rarity and medal tokens hold (VA15); the moment bands and team colours aren't used. |
| V4 Primary marks one thing | Replaced: the album accent fills progress too (VA11). |
| V5 RoundHog | Holds, with the album's own tracking and label sizes (VA17–VA21). |
| V6 System theme, header toggle, palette | Holds with the toggle in the sidebar's foot and no command palette (VA22). |
| V7 Surfaces from tokens | Holds (VA16, VA23). |
| V8 No infinite animation | Loosened: a shimmer or glow may repeat but stops within 5 seconds (VA25). |
| V9 Pages are static | Holds (VA24). |
| V10 A moment plays in full once per browser | Replaced: moments start from the member's act, advance by click and skip by `Escape` (VA26, VA27); an emoji's seen is stored (VA29). |
| V11 Reduced motion | Holds (VA32). |
| V12 Band pages | Broken: the album has no band pages; old level and achievement links land on album pages (AL44). |
| V13 Crates | Replaced by packs (VA33–VA38). |
| V14 Kudos received is quiet | Holds: being thanked plays no moment; Activity and the profile show it (VA49, VA51). |
| V15 Nothing interrupts a visit | Replaced: pack, put-in and unlock moments wait for the member's act, and only unseen emojis play on a visit, once the page settles and one at a time (VA26, VA28). |
| V16 Medals | Replaced by the next-steps-first Milestones page (VA46). |
| V17 Hedgehogs carry meaning | Replaced: a different mark and list (VA52). |
| V18 Max | Narrowed: Max writes only error and not-found pages, with no insight line and no empty states (VA53). |
| V19 Faces | Holds (VA54). |
| V20 The game avatar | Broken: the face is the avatar (VA54); "you" is VA61. |
| V21 Matching | Holds; it is Company Profiles' matcher, not a look (AL18). |
| V22 Team photos | Replaced: a team page is a class photo of faces (VA43); members still upload no team photos. |
| V23 Locked, ready and empty states | Locked and ready retire with level unlocks (ADR-0009); empty states are replaced by VA55; the album shows progress toward what isn't yours yet (VA47). |
| V24 WCAG 2.2 AA | Holds (VA57–VA62). |

[prototype]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/PROTOTYPE.md
[old-rules]: https://github.com/Silthus/kudos/blob/6ffc01b9/docs/website/visual-language.md
[shell]: ../../website/src/album/AlbumShell.tsx
[topbar]: ../../website/src/album/TopBar.tsx
[sidebar]: ../../website/src/album/Sidebar.tsx
[started]: ../../website/src/album/GettingStarted.tsx
[pages]: ../../website/src/album/pages.tsx
[popover]: ../../website/src/album/usePopover.ts
[answer]: ../../website/src/album/answer.ts
[css]: ../../website/src/album/album.css
[shell-test]: ../../website/src/album/albumShell.test.tsx
[a11y-test]: ../../website/src/album/albumAccessibility.test.tsx
[index-html]: ../../website/index.html
[index-css]: ../../website/src/index.css
[page-title]: ../../website/src/PageTitle.tsx
[theme-control]: ../../website/src/ThemeControl.tsx
[proto-shell-css]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/shell.css
[proto-motion]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/motion.ts
[proto-opening]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/PackOpening.tsx
[proto-opening-css]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/opening.css
[proto-cards]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/Cards.tsx
[proto-celebration]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/Celebration.tsx
[proto-hype]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/HypeReveal.tsx
[proto-flights]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/Flights.tsx
[proto-tray]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/Tray.tsx
[proto-put-in]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/putIn.tsx
[proto-emoji-shelf]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/EmojiShelf.tsx
[proto-emoji-moments]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/shell/EmojiMoments.tsx
[proto-class-photo]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/team/ClassPhoto.tsx
[proto-team-sticker]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/team/TeamSticker.tsx
[proto-unlock]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/team/UnlockMoment.tsx
[proto-team-css]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/team/team.css
[proto-moment-css]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/team/moment.css
[proto-collection]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/hoggies/Collection.tsx
[proto-milestone-row]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/milestones/MilestoneRow.tsx
[shot-topbar]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/shell-topbar-hover.png
[shot-ready]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/ready-to-unlock.png
[shot-unlock]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/unlock-moment.png
[shot-claimed]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/team-claimed.png
[shot-milestones]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/milestones.png
[shot-hoggies]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/hoggies-sticky.png
[shot-flight]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/shell-put-in-flight.png
[shot-opening]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/shell-hype-in-opening.png
[shot-emoji-popup]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/emoji-popup.png
[shot-emoji-moment]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/shell-emoji-moment.png
[shot-tray]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-5/tray-open.png
[face]: ../../website/src/Face.tsx
[proto-showcase]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/hoggies/Showcase.tsx
[proto-rarity-strip]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/hoggies/RarityStrip.tsx
[proto-hoggie-detail]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/hoggies/HoggieDetail.tsx
[proto-hoggies-css]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/hoggies/hoggies.css
[proto-person]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/team/PersonParts.tsx
[proto-activity]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-4/pages/activity/WeeklyEdition.tsx
[proto-leaderboard]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-4/pages/leaderboard/SideBySide.tsx
[proto-profile]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/round-5/pages/profile/ProfilePage.tsx
[shot-hoggie-detail]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-5/hoggies-detail.png
[shot-person]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-6/team-person-hype.png
[shot-activity]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-4/activity-B.png
[shot-leaderboard]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-4/leaderboard-C.png
[shot-profile]: https://github.com/Silthus/kudos/blob/0ac9e96d/website/src/prototype/shots/round-5/profile-after-put-in.png
