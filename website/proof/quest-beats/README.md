# Proof: each finished quest gets its own beat in the XP moment

`bun website/proof/quest-beats/drive.mts seed` joins three made-up members on the sandbox `different-dog-467` by signed `team_join` (Pip Hollow, Wren Calder, Tam Ferris, Slack IDs starting `U0PRFQB`), appends a `users` row and a last visit for Pip, and has Wren thank Pip, Pip thank Wren, and Pip thank Tam. Pip's kudos finish two Monday-path quests: "Give a kudos that says why." and "Thank someone you haven't thanked before.", each worth 50 XP and an unidentified hoggie. The script then prints a sign-in snippet for an incognito tab on `/book#me`. Every event is a signed Slack-shaped request, not a Slack click. The page body is blurred in the stills so that no workspace count shows.

The sandbox ran this branch merged with the open one-reply lane, because a deploy of this branch alone would have dropped that lane's index.

## Flag `quest-beats` on (a fresh cast)

- `on-0-cards.png`: the visit's cards and the orb. The bar starts at level 1, `20 XP to level 2`, before both the cards' and the quests' XP. The cards' 30 XP carry it into level 2.
- `on-1-sealed-quest-charges.png`: once the cards' XP has streamed in, the first quest shows sealed. Its ring charges and the seal shakes.
- `on-2-burst.png`: the seal bursts in gold confetti and `Quest complete` shows.
- `on-3-bonus-streams-into-bar.png`: `Give a kudos that says why.` with `+50 XP`. The chip streams into the bar as its own stream, and the bar moves from `70` to `20 XP to level 3`.
- `on-4-hoggie-comes-out.png`: an unidentified hoggie drops out of the quest.
- `on-5-second-quest-crosses-level.png`: the second quest charges for a shorter time. Its 50 XP carry the bar across into level 3.
- `on-6-second-hoggie.png`: the second quest's hoggie.
- `on-7-takeover.png`: after the quests, the level-up takeover plays `You reached level 3!`.

## Flag off (today's sequence, the first cast)

- `off-0-cards.png`: the same cards, with no quest beat. The bar already holds the quests' XP (`200 XP to level 4`, level 3).
- `off-1-no-takeover-items-wait.png`: the moment ends straight on the item board. No level-up takeover plays, though the cards say level 2 and level 3 were reached, because the climb begins after them. The quest beats fix this when the flag is on.
- `off-2-emoji-unlock.png`: the emoji unlock that follows, unchanged.
