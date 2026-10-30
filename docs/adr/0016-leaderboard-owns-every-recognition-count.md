# Leaderboard owns every recognition count, each in the member's own week

One Leaderboard row per member and period holds kudos given, kudos received, hugs given and hugs received. Leaderboard fills it by following `kudosGiven`, `hugGiven` and `hugReceived`. Every board, place and weekly count reads that row through Leaderboard's seam: the Leaderboard page, the player card, the link card and the hugs section of the Monday DM. `Album`'s board tallies and thoughtful boards retire. Each count lands in the day, week and month of the member it counts, in their own time zone, so a hug received on Sunday night lands in the recipient's week even when it is already Monday for the giver.

Before this, four modules each counted part of it, and they disagreed: `Album` put a received hug in the giver's week, while Hugs put it in the recipient's. We chose one owner over counts kept beside each feature, and the member's own week over the giver's, because a member's "first hug received this week" bonus and their board must agree. Received counts of a large group kudos are counted in pages of 100 recipients, so `Engine`'s giving mutation is untouched.

Shaped in [docs/architecture/hugs-hook.md](../architecture/hugs-hook.md), and brought into the repo with `spec/hugs-hook.md`. Coherence journal decision: `d-e0c4b91a`.
