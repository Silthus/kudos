# Milestones puts the next steps first

Branch `feat/milestones-next-steps`. The walk ran on a production build (`VITE_SHELL_FIXTURE=album vite build`), served through `vite preview` behind a private Coder link and driven in a headless browser. The page reads the typed album fixtures. The member is midway: 6 of 20 medals, and one team (Kettle Works) ready to unlock.

## Tests

The rendered album shell at `/book#milestones`:

- `milestones.test.tsx`, `AL51: Milestones puts the next steps first: what to do, the closest medal of every milestone, then the medals earned`:
  - The lede and the tally.
  - "Do this next" lists each team that is ready to unlock, linked to its page, plus thanking someone in Slack.
  - "Closest medals" holds one row per milestone, closest first, each with its hint, progress and emoji.
  - A newcomer sees every bronze and no Earned section. A milestone whose medals are all earned drops out. With every medal earned, the section says so.
  - "Earned" lists the earned medals, newest first.
- `milestoneBeat.test.tsx` (LP19a, unchanged): the medal the turn just unlocked stays in its row of Closest medals while the unlock animation plays.

## Walk

- `1-desktop-top.png`: 1440 px. The lede, the tally `6 of 20 medals` by metal, Do this next (`Unlock Kettle Works`, `Thank someone in Slack and say why`), then Closest medals.
- `2-desktop-full.png`: the whole page, ending with the six earned medals and their Add to Slack and In Slack states.
- `3-unlock-link-lands-on-team.png`: clicking `Unlock Kettle Works` lands on `/book#teams/kettle-works`.
- `4-phone-390-full.png`: 390 px, with no horizontal overflow (`scrollWidth` 390). The progress count wraps under its bar.
- `5-newcomer-desktop-full.png`: a newcomer with nothing earned and no team ready. Do this next keeps only the Slack card, Closest medals shows every bronze, and there is no Earned section. A temporary local swap of the fixture album produced this build. The swap was not committed.
- `live-run-page-text.txt`: the rendered text of the midway page.

## The unlock beat, two tiers of one milestone (at `be291bf9`)

The same production build, with a temporary local fixture that was not committed. The album has items waiting, and turning one reaches Familiar faces (silver) and Full of friends (gold), both on the people milestone.

- `6-two-tier-beat.webm`: the whole turn, from the click to the settled page.
- `6a-silver-pops.png`: Familiar faces pops in its Closest medals row.
- `6b-gold-waits-in-the-row.png`: the first beat has ended. Familiar faces has moved to Earned, and the same row now shows Full of friends, still as next, waiting for its beat. This is the target the second beat pops.
- `6c-gold-pops.png`: Full of friends pops in that row.
- `6d-settled.png`: the turn is over and the item board is back. The people row shows its next tier, Everyone's album (diamond).
- `6e-settled-after-later-full.png`: after Later. Earned lists Familiar faces and Full of friends, and neither one is still pinned under Closest medals.
