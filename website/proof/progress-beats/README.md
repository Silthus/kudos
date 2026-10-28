# Proof: each quest or milestone that progressed gets its own beat in the XP moment

`bun website/proof/progress-beats/drive.mts seed` joins four made-up members on the sandbox `different-dog-467` by signed `team_join` (Pip Hollow, Wren Calder, Tam Ferris, Ivo Brandt, Slack IDs starting `U0PRFPB`), and writes a sign-in snippet for Pip and for Ivo. Every event is a signed Slack-shaped request, not a Slack click. The page body is blurred in the stills so that no workspace count shows.

- Pip visits, then thanks Wren and Tam. Since the visit, Pip finished two journey quests, moved `Say why on 2 different days` from 0 to 1 of 2, and reached `First thank-you`.
- Ivo thanks Wren before the visit, and Tam and Pip after it. Since the visit, Ivo moved the thoughtful kudos milestone `Generous soul` from 1 to 3 of 25.

The sandbox ran this branch merged with the open lanes live there at the time (one-reply, hide-kudos-taken-back, configurable kudos emojis), because a deploy of this branch alone would have dropped their functions and indexes.

## Flag `progress-beats` on

- `on-0-cards.png`: Pip's cards and the orb.
- `on-1-quest-progress.png`: after the two quest beats, `Quest progress`, `Say why on 2 different days`, the bar at `1 of 2`.
- `on-2-milestone-progress.png`: `Milestone progress`, `First thank-you`, `1 of 1`.
- `on-3-takeover-after-the-beats.png`: after the progress beats, the level-up takeover.
- `on-4-milestone-from-last-visit.png`: Ivo's `Generous soul` beat opens where it stood at the last visit, `1 of 25`.
- `on-5-milestone-moved-to-now.png`: its bar moves to now, `3 of 25`.

## Flag off (today's sequence, a fresh cast)

getXpMoment answers `progressed: []`.

- `off-1-takeover-where-the-beats-were.png`: at the moment the progress beats played with the flag on, the takeover plays.
- `off-2-takeover-end.png`: the takeover's end, unchanged.
