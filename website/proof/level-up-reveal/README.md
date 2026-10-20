# Level-up hoggies on the sandbox (#743)

PR #743's head `4bf80bf4` was deployed to the sandbox by hand at 2026-10-20T11:46Z. The PostHog flag `level-up-reveal` (975599) is on for `environment = sandbox` only. Members levelled up through Slack-shaped kudos events, signed with the sandbox's signing secret. Nobody clicked in real Slack.

## What ran

[`drive.mts`](drive.mts) sends signed `team_join` and kudos `message` events, each with a unique `event_id`.

1. **Data HEAD creates.** Fresh synthetic members Odile (`U0PRFLU1GVRA`) and Tamsin (`U0PRFLU1TAMA`) joined, and Odile thanked Tamsin twice. Odile reached level 2.
2. **Data the base code wrote.** Rosalind (`U0PRF661GVRA`) was already at level 2, with a level-2 level up and three thoughtful-pack drops recorded by earlier code, and `packs` on. She thanked Fenwick (`U0PRF661FNWA`) three times. She reached level 3 and he reached level 2.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> [KUDOS_CAST=A | KUDOS_GIVER=<user> KUDOS_RECIPIENT=<user> KUDOS_TIMES=3] bun website/proof/level-up-reveal/drive.mts`

## What the sandbox stored

[`reads.json`](reads.json) holds `levelUps`, `drops`, held copies, `memberProgress` and flag exposures for the four members, read with `convex data` after the run.

- Each new level up recorded `level:{level}:1` to `:3`, three drops, and each third find is rare or rarer (epic three times).
- Rosalind's earlier level-2 level up (recorded before the deploy) dropped nothing afterwards. Only her new level 3 did.
- No level drop carries a pack bonus. Rosalind's earlier thoughtful drops kept theirs, and her XP is 110, the kudos' XP alone. No fresh member was exposed to `packs`.
- Each member's `level-up-reveal` exposure is `true`.
