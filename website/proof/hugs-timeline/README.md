# #580 proof: hugs on the activity timeline

## Tests

- `red.txt`: `activityHugs.test.tsx` and `activity/timeline.test.tsx` on the red commit `d54ba362`: 15 failing, 30 passing.
- `green.txt`: the same two files after the change: 45 of 45. A later round added the emoji-precedence test, which fails with the picture and the name map swapped.
- The full gate on the final tree is in the PR description.

## Running app

The app ran on a fresh local Convex backend (ports 12710/12711, the fake Slack and PostHog on 12712), built from this branch. It was driven only by signed Slack requests (`rig-driver.mts`, `rig-transcript.txt`):

- These flags were on for everyone, scoped to that local backend only: `xp-levels`, `unlocks`, `website`, `activity`, `message-settings`, `hugs`.
- The kudos emoji was `hedgehug`. Its custom-emoji picture was a `customEmoji` row pointing at a public Slack emoji image.
- Seven synthetic members took part. Ann's hugs came from five givers on one post, two on another, and one on the kudos she received. Ann gave one hug on a post and one on a kudos.

Ann's browser was signed in with imported `users`, `authSessions` and `authRefreshTokens` rows. `rig.sh` doesn't set the auth keys: also set `JWT_PRIVATE_KEY` and `JWKS` on the backend, as `testing/handshake/disposableBackend.ts` does. The site was a `vite build` against the backend, served by `vite preview` on 12713.

| Shot | What it shows |
| --- | --- |
| `1-activity-light.png`, `2-activity-dark.png` | Every hug row beside a kudos row, after the Fable 5.1 spot check |
| `3-show-new-activity-dark.png` | Gus hugs Ann's launch post while her page is open: "Show new activity" appears and the shown rows stay put |
| `4-moved-row-once-dark.png`, `5-moved-row-once-light.png` | After "Show new activity": the row reads "Gus and 5 others · 6 hugs" once, at the top |
| `6-phone-390-dark.png` | The same timeline at 390 px |

Shots 3–5 were taken before the Fable polish (the layout differs, the behaviour doesn't).

## Reviews

- `review-round-1.md`: GPT-6.1 Sol. Finding 2 was taken: a test now pins the picture before the name map. Finding 1 was rejected with a reason, and stays a follow-up for map #1. See the PR.
- Fable 5.1 design spot check: all five findings were taken. Received rows now share one text column at a fixed face-column width. The counts don't split when the headline wraps. Headlines are regular weight. "Open in Slack" sits on the headline line. The faces align to the first line.

## After #576 merged (`main` at `fd448f7b`)

I ran the rig again on `092a17fa`, the branch merged with `main`, which has the versioned cursors ([`rig-transcript-main.txt`](rig-transcript-main.txt)).

- `9-main-show-new-activity-dark.png`: a live hug raises "Show new activity".
- `10-main-moved-row-once-dark.png`: after the click, the row reads "Gus and 5 others · 6 hugs" once, at the top.
- `7-settings-hugs-recap-light.png`, `8-settings-hugs-recap-dark.png`: the real `/settings` read's `hugs-recap` description draws `:hedgehug:` as the quiet chip, because the read carries no picture. A standard shortcode becomes its character (`SettingsPage.test.tsx`).
