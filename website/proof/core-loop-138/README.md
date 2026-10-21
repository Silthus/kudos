# Sandbox proof: the first-thanks top-up and its XP moment

Silthus/personal#138, on the sandbox deployment `different-dog-467`, with the branch's backend live there and every core-loop flag on.

## Cast

Two newcomers, who join through a signed `team_join` and never visit the website before their first kudos:

- `U0PRF138NEWB` (Juno Firstthanks)
- `U0PRF138NEWC` (Ines Firstday)

A teammate, `U0PRF138MATE` (Remy Helper), receives the kudos.

`drive.mts` sends the signed Slack events: `KUDOS_CAST=B|C bun drive.mts join`, then `first-kudos`. `drive-output.txt` holds what the sandbox answered.

## Read back after the first kudos

The same for both newcomers:

- `memberProgress`: the giver has 20 XP (level 2). Each kudos gives the recipient 5 XP, so Remy ends at 10 after both.
- `rewardRecords`: one `first-thanks` record per giver: 10 XP, 0 coins, no item, catalogue version `onboarding-1`. Its cause is the kudos message.
- `levelUps`: one row at level 2 per giver.
- One `slack/directMessages:deliverDirectMessage` job per giver, carrying the notification `{ kind: "level-reached", level: 2, xpToNextLevel: 80 }`.

  The sandbox's Slack can't deliver a DM to a synthetic user, so the job and its notification are the evidence.
- `getXpMoment` run as the newcomer answers:
  - `kind: "moment"`, 20 XP;
  - excerpts `kudosGiven` at 20 XP and `levelUp`;
  - a climb from level 1 at 0 XP to level 2 at 20 XP.

## Stills

The newcomer signs in with imported `users`, `authSessions` and `authRefreshTokens` rows, and opens the website for the first time.

The sandbox's weekly rank card is masked in both stills.

1. `1-xp-moment-first-thanks-excerpt.png`: the XP moment before collecting.
   - "Kudos you gave" shows the first kudos' excerpt with its **+20 XP** chip: 10 XP for the kudos and 10 XP for the top-up.
   - The "Level up" excerpt shows "You reached level 2!".
2. `2-level-2-takeover.png`: after collecting, the level-2 takeover.
   - 3 new items unlocked, waiting face down.
   - `:raised_hands:` unlocked.
   - "Level 3 is 80 XP away".
