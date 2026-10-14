# #417: plural ready names, the Leaderboard's sentence, the proof fixtures

## Tests

- [red.txt](red.txt): the website tests on `main` (`5b895d5`) with this ticket's tests: 12 failing. They expect `Quests are ready` on the ready page, in the nav tip and the palette blurb, `Quests are open` in the reveal, `Quests are ready for you. Open them in Slack's App Home.`, and `See where you stand.` for the Leaderboard.
- [green.txt](green.txt): the same 7 files after the change, 333 of 333 passing, every assertion intact.
- [red-fixtures.txt](red-fixtures.txt) / [green-fixtures.txt](green-fixtures.txt): [check-fixtures.sh](check-fixtures.sh) typechecks each `proof/*/fixture/proof-fixture.tsx` beside `src/`, the way it builds. On `main` all three miss `App` reads (`hud-nav` and `header-phone` five, `feature-gates` one). After: all three typecheck, through `fixtureReadsFor` in `src/fixtureReads.ts`, typed `AppReads`, so a new `App` read is added once in `src/` and tsc demands it there.
- [gate.txt](gate.txt): `pnpm gate` through `fleet heavy`.

## Running app

Chromium (T3 preview), the `feature-gates` and `hud-nav` fixture builds served locally (copy a fixture's three files into `website/`, run `pnpm --dir website exec vite build --config proof.vite.config.ts --outDir <dir>`, serve `<dir>`).

| Shot | What it shows |
|---|---|
| [quests-ready-light.png](quests-ready-light.png) | `/quests?state=ready`: the night band's headline `Quests are ready` |
| [quests-ready-tooltip-dark.png](quests-ready-tooltip-dark.png) | the same in dark mode, with the nav tip `Quests are ready` |
| [quests-reveal-dark.png](quests-reveal-dark.png) | after `Open`: the reveal's `Quests are open` |
| [leaderboard-locked-light.png](leaderboard-locked-light.png) / [leaderboard-locked-dark.png](leaderboard-locked-dark.png) | `/leaderboard?state=locked`: `See where you stand.` |
| [hud-nav-fixture-1280-light.png](hud-nav-fixture-1280-light.png) | the repaired `hud-nav` fixture with `?six=1&path=/quests`: six entries, the ready Leaderboard crate, the skill point chip and the ready pill |
