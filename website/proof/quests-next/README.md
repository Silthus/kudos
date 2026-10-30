# The quests panel marks the backend's next quest

Production builds (`vite build` with `VITE_SHELL_FIXTURE=album-quests`, served by `vite preview`) shot in headless Chromium at 1280 × 900 on `/book`. Each build swapped the fixture's quests answer for one of `questsFixtures` (`beforeTheFirstHug`, `firstThanks`, `awaitingTheDraw`) for that build only, then restored `fixtureReads.ts`. Made-up member and teammates.

| Stage | HEAD | main |
| --- | --- | --- |
| Before the first hug, the backend names `first-thanks` | `01-before-the-first-hug-next-is-give-a-kudos.png`: "Give a kudos to someone" is Next with its hint | `main-before-the-first-hug-next-was-the-hug.png`: "Give your first hug" was Next |
| First kudos given, its hoggie not yet identified, the backend names `someone-new` | `02-first-kudos-given-next-is-thank-someone-new.png`: "Thank someone new" is Next with its hint | `main-first-kudos-given-next-was-the-turn.png`: "Identify the hoggie" was Next |
| The three quests done before the week's draw, the backend names none | `03-quests-done-before-the-draw-nothing-is-next.png`: no step is Next | (fixture not on main) |

The page's rows, read in each build (`aria-label`, `data-next`, shown hint), are in `walk-transcript.txt`.
