# #414: custom workspace emoji drawn as pictures

From the fixture build (`VITE_SHELL_FIXTURE=member-with-every-feature-open`), 1280 px wide.

- `red.txt`: the new renderer tests and the widened CSP test failing on `main` (`0c260af5`) before the change.
- `green.txt`: the same tests passing after it.
- `gate.txt`: `pnpm gate` on the branch.
- `activity-light.png`, `activity-dark.png`: `/activity`. Ada's kudos draws `:hedgehug:` as its picture at text size (16.8 px on 14 px text). `:partyparrot:` carries a picture URL that doesn't exist, so the browser's failed load falls back to the `:partyparrot:` chip.
- `recent-kudos-light.png`, `recent-kudos-dark.png`: the home's Recent kudos card, with the picture leading the clamped words.
- `spotlight-light.png`, `spotlight-dark.png`: the leaderboard's "A thank-you from your workspace".
- `hosts.txt`: read-only HEAD requests to both hosts. A standard emoji file on `a.slack-edge.com` answers 200 with `cross-origin-resource-policy: cross-origin` and no redirect. The root of `emoji.slack-edge.com` redirects, which says nothing about its emoji files. That custom emoji pictures load from these two hosts comes from map #1's observation after `syncCustomEmoji` ran on both deployments. This proof did not read a real workspace emoji URL.

The fixture pictures use the site's own `/favicon.svg`, so no workspace's emoji URL appears in this public repository.
