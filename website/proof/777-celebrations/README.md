# #777 proof: a workspace switches public celebrations off

Head `e3471ca8` (the branch merged with `main`), merged in a throwaway tree with the live lane Silthus/personal#156's proof head so its `featuredNewGivers` table and functions stayed live. It was hand-deployed to the sandbox `different-dog-467` on 2026-10-22 at 07:05 UTC. The dry run added `celebrationsSwitches.by_workspace` and dropped nothing. The served bundle was checked (`index-DIXfOi0I.js`). Flag `celebrations-switch` (PostHog 982882) is on at `environment = sandbox`. Every Slack event below is signed by hand with the sandbox signing secret (`drive.mts`), not a Slack click.

## A level up with the switch on, then off, in a made-up workspace

The made-up workspace `T0PRF158WKS` keeps the sandbox's own state as it was. Its announcement channel is the sandbox's real channel `C0C9N9A4SE4`, so Slack's `conversations.history` shows what was posted there.

1. `1-join.json`, `1b-join-lu.json`: signed `team_join`s for Ada (admin), Gil, Rae, Kai and Lu. Ada's signed App Home click picked the announcement channel.
2. A first kudos takes its giver to level 2 through the first-thanks top-up, which carries no kudos message. So Lu and Rae got a `memberProgress` row at 95 XP (`seeded-member-progress.jsonl`), and their next kudos crosses level 3 (100 XP) with its message.
3. **Switch on (control).** `2-level-on.json`: Lu thanked Kai. `3-history-after-level-on.json`: the channel's newest app post is `:tada: <@U0PRF158LUU> reached level 3.`
4. **Switch off.** `4-switch-off.json`: Ada's signed App Home click `setPublicCelebrations {on: false}`. `5-switch-row-after-off.jsonl`: the workspace's row reads `on: false`.
5. `6-level-off.json`: Rae thanked Kai. `8-rae-level-up.jsonl`: Rae reached level 3. `7-history-after-level-off.json`: the channel's newest app post is still Lu's. `10-public-replies-of-made-up-workspace.jsonl`: the workspace's only public reply is Lu's, so nothing was written for Rae. `9-rae-level-up-dm-job.jsonl`: Rae's own `level-reached` DM job still ran. Real Slack can't deliver a DM to a made-up user, but the job shows it was sent.
6. `11-switch-on.json`: Ada switched it on again.

## The maintainer's switch in the website's Settings, in the sandbox's own workspace

`12-join-maintainer.json`: a made-up member, Mae, joined the sandbox workspace with a signed `team_join`. `KUDOS_MAINTAINER` was set to Mae for the walk. A `users`, `authSessions` and `authRefreshTokens` row signed an incognito browser tab in as Mae.

- `settings-1-on.png`: the Public celebrations panel after the weekly post panel, switched on.
- `settings-2-off.png`: after a click on the switch, "Switched off. Nobody can pick public celebrations until they're switched on again."
- `settings-3-messages-while-off.png`: Mae's own Messages panel while off. It lists After-kudos reply, Level ups and Weekly hugs recap, and no Public celebrations row.
- `settings-4-on-again.png`: switched on again, "Switched on. Teammates who chose them get them again." The Messages panel lists Public celebrations again.
- `13-switch-rows-after-walk.jsonl`: both workspaces' rows read `on: true` after the walk.

These stills show the panel copy of `e3471ca8`. Review round 1 changed the panel's first line to follow the switch (`I don't celebrate anyone's progress in public. …` while off); `website/src/publicCelebrations.test.tsx` covers it.

## Review round 1

- `red-review-round-1.txt`: the three new tests failing before the fixes (launch gate, Admin tab without a channel, panel copy while off).
- `red-launch-gate-confirmed.txt`: the launch test failing with the gate removed again.
- `refuted-tier-write-check.txt`: the new tier test failing with `setPublicSection`'s switch check removed.
- `green-review-round-1.txt`: the four touched test files passing (58 tests).
