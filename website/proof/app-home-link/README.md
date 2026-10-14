# #109: App Home links to the website while it is open (WS28)

## Tests

- `red.txt`: the WS28 tests before the change. The link is missing with the flag on and `SITE_URL` set.
- `red-tabs.txt`: the tabbed test before the review fix. The link is missing on Leaderboard and Settings.
- `green.txt`: `convex/slack/appHome.test.ts` after the fix, 22 of 22 passing.
- `gate.txt`: `pnpm gate` on the landed tree.

## Running app

These views come from a disposable local backend (ports 3620/3621), never a cloud deployment.

- **Fakes.** A local fake answered Slack's Web API and PostHog's `/flags/definitions`. Nothing reached real Slack or PostHog.
- **Flag override.** The fake served the `website` flag (`environment` exact `sandbox`, 100%) to this local backend only, with `KUDOS_ENVIRONMENT=sandbox`.
- **Requests.** The `app_home_opened` events and the Leaderboard click were Slack-shaped requests signed with the local backend's own secret.

| File | Flags served | `SITE_URL` | Link |
|---|---|---|---|
| `view-flag-on.json` | `website` | set | yes, last block |
| `view-flag-off.json` | none | set | no, the same view as before #109 |
| `view-site-url-unset.json` | `website` | unset | no |
| `view-tabs-profile.json` | `website`, `everyone-board` | set | yes, last block of the Profile tab |
| `view-tabs-leaderboard.json` | `website`, `everyone-board` | set | yes, after the Leaderboard click |
| `view-tabs-reopened.json` | `website`, `everyone-board` | set | yes, on reopening, on the remembered Leaderboard tab |

- **Block Kit.** `blocks-validate.txt` holds Slack's `blocks.validate` answer for four of the views: all `ok`.
- **Preview.** Paste any view into <https://app.slack.com/block-kit-builder> to see it.
- **No exposure for the website flag (WS4, O36).** The local PostHog fake recorded no `$feature_flag_called` for `website`.
- **What's left for #111.** The real Slack screenshot is #111's sandbox check.

## Review

`review-gpt-6.1-sol.txt`: one finding, held and fixed.
