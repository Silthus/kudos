# #741 proof: the maintainer picks the weekly post's channel

## Reviewed head (`3e9ee275`, after the design pass, two review rounds and two final reads)

The head was hand-deployed to `different-dog-467` on 2026-10-20 at about 07:27 UTC (dry run: no index dropped), and the served bundle was checked (`index-BKXczggf.js`).

- **Website pick, on a row the earlier code wrote** (`head/1-…` to `head/5-…`, plus the recording on the PR). `KUDOS_MAINTAINER` was set to the synthetic maintainer again for the walk and removed afterwards, and a fresh session and refresh token were imported. The panel opened with no status line. A non-link was refused. A missing channel got real Slack's `channel_not_found`, shown as "I couldn't find that channel…", and the link stayed in the field. The sandbox's public channel was joined and picked: "Picked #kudos-test.", and the field emptied. The stored check went from pick 1 (`not-found`) to pick 2 (`picked`) (`head/sandbox-settings-after.json`).
- **Weekly post, on rows this head created** (`weekly-post-head.json`, `claim-head.json`, `made-up-settings-head-after.json`). The first made-up workspace's week was already claimed, so a second one, `T0PRF741WK2`, was set up the same way (`KUDOS_MADE_UP=T0PRF741WK2 KUDOS_CAST=B drive.mts join`, `week`), with its missing announcement channel `C0PRF741ANB` and an enabled proof group. The row the website pick writes, `channelCheck: { channel, pick: 1, outcome: checking }`, was appended by hand. Then the deployed `checkPickedChannel` with `pick: 1` picked `kudos-test` through the real join. Ada's signed click switched the post on, and the job claimed the week 2026-10-19 with `channel: C0C9N9A4SE4, outcome: posted`. `conversations.history` returned the post in the picked channel. Ada switched it off again (generation 2).
- **Cross-version.** A `convex deploy --dry-run` of `main` against the sandbox refused the made-up workspace's row with "extra field `channel`", so a revert after a pick needs the new fields cleared or the schema kept. This head deployed over rows `main` and the earlier head wrote.

## Before review (`93d410f3`)

Branch `album/fix-741` at `93d410f3`, hand-deployed to the sandbox `different-dog-467` on 2026-10-20 at about 06:24 UTC (dry run: no index added or dropped), with the website uploaded and the served bundle checked (`index-mGNMmSat.js`). Flag `weekly-post-channel` (975090) is on at `environment = sandbox`, 100%. Every Slack event below is signed by hand with the sandbox signing secret (`drive.mts`), not a Slack click.

## Red, green and the gate

- `red-convex.txt`: the first backend tests, failing before the change (no `pickWeeklyPostChannel`, no `channelPick` in the read).
- `red-website.txt`: the panel tests, failing before the picker existed.
- `green.txt`: the same files passing after it (65 tests).
- `gate.txt`: `fleet heavy -- pnpm gate` on `93d410f3`: 292 files, 5,037 tests, Coherence spec and lexicon clean.

## The website pick, in the sandbox's own workspace (`1-…` to `5-…`, plus the recording on the PR)

1. A synthetic member, Mae Proof, joined with a signed `team_join`. `KUDOS_MAINTAINER` was set to them for the walk and removed afterwards. The sandbox has no counting group, so one enabled proof group (`S0PRF741HOG`) was appended, as #657 did. The daily group sync disables it again.
2. A `users`, `authSessions` and `authRefreshTokens` row signed the browser in as Mae (incognito tab).
3. `1-unpicked.png`: the panel offers the picker, and the post goes to the announcement channel.
4. `2-not-a-link.png`: `#kudos-test` is refused as not a channel link. Nothing is stored or asked of Slack.
5. `3-not-found.png`: a link to a channel that doesn't exist (`C0PRF741NOPE`). Real Slack answered `channel_not_found` to the join, and the panel says so.
6. `4-picked.png`, `5-picked-dark.png`: the link to the sandbox's public channel. The real join answered its name, and the panel reads "Picked. From now on I post it in #kudos-test.", with the sentence above linking `#kudos-test`.

The sandbox has only one real channel, which is also its announcement channel, so this pick leaves the sandbox's own post where it was (`sandbox-settings-after.json`).

## A weekly post in the picked channel (`claim.json`, `weekly-post.json`)

This week's post for the sandbox workspace was already claimed by #657, and a claim is never deleted. So the post ran in a made-up second workspace, `T0PRF741WKS`, whose announcement channel (`C0PRF741ANN`) doesn't exist:

1. `drive.mts join` added an admin, Ada, and two members, Gil and Rae. `drive.mts week` sent one thoughtful public kudos from Gil to Rae, dated last Wednesday. An enabled proof group (`S0PRF741SEC`) was appended.
2. The website signs in only the sandbox's own workspace, so the row its pick writes, `channelCheck: { channel: C0C9N9A4SE4, outcome: checking }`, was appended by hand. Then the deployed `slack/mondayPost:checkPickedChannel` ran: the real join picked `kudos-test` (`made-up-settings-after.json`).
3. `drive.mts post-on`: Ada's signed App Home click switched the post on (generation 1).
4. `convex run slack/mondayPost:postMondayPost` claimed the week 2026-10-19 with `channel: C0C9N9A4SE4, outcome: posted`. Slack's `conversations.history` of the picked channel returns the post: ":trophy: Last week's top thoughtful kudos 1. Gil Proof thanked Rae Proof: …". Without the pick, it would have gone to the missing announcement channel.
5. `drive.mts post-off`: Ada switched it off again (generation 2), so the job booked for 2026-10-26 posts nothing.

## Not proven live

- A real private channel's refusal (`method_not_supported_for_channel_type`): the sandbox has no private channel the bot can be pointed at. The tests cover it with Slack's documented answer.
