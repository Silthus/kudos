# #667 sandbox proof: the album's Leaderboard

Branch `album/23`, website built from `c93ca8a1` and uploaded to the sandbox `different-dog-467` with the deploy workflow's `static-hosting upload` step only. Functions were left as the live lanes deployed them; `getThoughtfulBoards` (#655) was already there. `album` flag 970572 is at `environment = sandbox`, 100%.

1. `drive.mts` signs Slack-shaped events with the sandbox signing secret (not a Slack click). Five synthetic members join in Europe/Berlin. Aster thanks three people with a reason, Briar two, Corin two, Dune one, Ember one, and Ember also sends a short `ty`. Output: `drive-output.txt`.
2. Their tallies (`thoughtful-tallies-sandbox.jsonl`) are 3, 2, 2, 1 and 1 in week `2026-10-19`. The short kudos added nothing.
3. `users` and `authSessions` rows were appended for the five, and each linked their own posthog.com profile through `website/commands:linkMyCompanyProfile`: Aster and Ember to an Onboarding profile, Briar to a profile on four teams, Corin to Query Performance, Dune to a profile on Customer Analytics and Web Analytics.
4. `setBoardVisibility {"visible": false}` as Ember answered `refused`: the synthetic member's old Leaderboard unlock isn't open. That is why the page points to Settings instead of carrying its own switch. A `leaderboardSettings` row `{ member: Ember, visible: false }` was appended instead.
5. `getThoughtfulBoards` through `convex run --identity` (`getThoughtfulBoards-sandbox.json`; posthog.com faces and crest pictures redacted) answers the boards the page renders: as Dune, people tied for the lead, Dune pinned at 7=, Onboarding first with 5, Dune's two teams pinned and tied; as Ember, `onTheBoards: false`, no Ember row, Onboarding still pinned as Ember's team; `{"team":"onboarding"}` narrows people to Aster and Briar, as the page's `Who gave` does from the full answer.
6. The browser walk (Dune, then Ember, through appended `authRefreshTokens` rows) is in the PR. Faces in the published captures are blurred through each picture's style before capture, because the synthetic givers show real posthog.com team photos.

Other lanes gave kudos in the same week during the walk, so the live boards gained rows between captures.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/667-leaderboard/drive.mts`
