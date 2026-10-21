# Hoggie forge sandbox proof

Head `0d89c70e` (feat/hoggie-forge with `main` merged) was deployed by hand to the sandbox `different-dog-467` on 2026-10-21, merged with `core-loop/129` (#755), whose functions were live there; the dry run deleted no index. Flag `hoggie-forge` 980536 is at 100% for `environment = sandbox` only, read for real from PostHog.

1. `drive.mts` signs one `team_join` for a made-up member (`cast.mts`) with the sandbox signing secret (`drive-output.txt`).
2. `seed.mts` writes the rows `testing/hoggies.ts` `holds()` would, appended with `convex import --append`: seven Bananas (common), two Cakes (uncommon), four Rockets (legendary), one Ape (rare) and every Epic, under `bought:proof-forge-<n>` crate keys. A `users`, `authSessions` and `authRefreshTokens` row sign the browser in, and an `analyticsIds` row gives the member decision its ID.
3. **Run 1, on rows the base code's shape wrote.** Banana's entry offers `Forge 3 into an Uncommon` with `Keeps one Banana. Gives an Uncommon you don't have yet.` (`1-banana-ready.png`). The click plays the fuse (`2-forge-fuse.png`); the reveal rests, ends, and the entry steps to the forged Hand Clasp, which now says `4 copies forge into a Rare you don't have yet.` (`4-stepped-to-hand-clasp.png`). Banana went from 7 copies to 4.
4. **Run 2, on the tally run 1 wrote.** Forge from four Bananas: `Forged: Data Thief · Uncommon · New` (`3-forged-reveal.png`). Banana keeps one copy.
5. **Entry states.** Ape, a rare with every Epic held, says `You hold every Epic.` (`5-ape-every-epic-held.png`); Rocket, a legendary with four copies, says nothing of forging (`6-rocket-legendary-no-forge.png`); Banana at one copy and Cake at two say `4 copies forge into …`.
6. **The API.** Through `convex run --identity` as the member: run 2's own request again answers Data Thief and spends nothing (`forgeHoggie-resend.json`); a fresh request on one Banana, a legendary Rocket and a malformed request `a:b` answer `refused` (`forgeHoggie-banana-one-copy.json`, `forgeHoggie-rocket-legendary.json`, `forgeHoggie-malformed.json`).
7. **Analytics.** PostHog received exactly two `hoggie dropped` events with `crate_kind = forge`, rarity uncommon, `is_new` true, surface website and no pack XP, one per forge and none for the resend (`posthog-forge-events.txt`).
8. **Reduced motion.** With `matchMedia` stubbed in the tab (the preview can't emulate the media feature), a forge of four Balls mounted the reveal straight in its `shown` phase with `Forged: Swimmer · Uncommon · New` and no fuse, flash or burst (`reduced-motion-phase-trace.txt`).

Run:
- `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/hoggie-forge/drive.mts`
- `bun website/proof/hoggie-forge/seed.mts <member id> <out dir>`, then `convex import --append --format jsonLines --table <table> -y <out dir>/<table>.jsonl` for `drops`, `hoggieTallies` and `dropTallies`.
