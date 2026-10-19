# #694 proof: a member without a team never lands on an empty home

## Why the home was empty

Read-only against production (`convex data`, dumps deleted afterwards):

- The member's `companyFaces` row exists and holds no `profile`.
- The copy of posthog.com holds no profile with the member's name.
- posthog.com's profiles API lists the member's profile with no team, and the team page they belong to lists four other people.

The copy keeps only the profiles that posthog.com's team pages list, so the matcher has nothing to match. The matcher is right; the team placement is posthog.com's own data and changes on posthog.com. The same gap hit every member the matcher can't match, so the home and the team board are fixed for all of them.

## Tests

- `red.txt`: the new overview, team board and shell tests failing on the tree before the change (11 red).
- `green.txt`: the same 70 tests passing after it.
- `gate-7ae5dad1.txt`: `pnpm gate` under `fleet heavy` on the merge of `origin/main`.

## Running app

1. Fixture build: `VITE_SHELL_FIXTURE=album-without-a-team npx --no -- vite` in `website/`, at 1440×900 in light and dark: `/` and `/leaderboard`. The prototype (`prototype/website-redesign` at `0ac9e96d`, `?variant=5`) at the same viewport for the side by side.
2. Sandbox `different-dog-467`: the website built from `3f838023` and uploaded with the deploy workflow's `static-hosting upload` step only, so the functions stayed as the live lanes deployed them. A synthetic member with no posthog.com match signed in through appended `authSessions` and `authRefreshTokens` rows. `/` showed the overview and `/leaderboard` listed all 57 teams. Pictures hosted on posthog.com's Cloudinary were blurred through each picture's style before capture.
