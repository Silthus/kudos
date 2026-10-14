# #251: the activity feed on the sandbox

The activity feed running end to end on the sandbox deployment, on real data that came in through Slack-shaped events (WS200–WS227, AT36–AT39). No product code changed.

## What ran

1. **Deploy.** `main` at `32a8c42` went to the sandbox by hand at 16:43 UTC on 2026-10-14. It used the same five steps as `deploy-sandbox.yml`. That workflow's run for `a0cfba6` passed its gate but skipped every deploy step, because `main` had moved on. The proof ran right after this deploy, and the sandbox still served its bundle when the proof ended.
2. **Members, the normal way.** [`drive.mts`](drive.mts) and [`amend.mts`](amend.mts) share [`slackEvents.mts`](slackEvents.mts), which signs every request with the sandbox's own signing secret, read from a file and never printed. It sends:
   - a `team_join` for each of four synthetic members (Avery Hedge, Blake Thorn, Casey Moss, Drew Bramble), which records them as directory `member`s;
   - ten days of kudos, dated through each message's `ts`:
     - Blake thanks Avery in the public channel, with a reason;
     - Casey thanks Avery in a private channel (`channel_type: group`), once without a reason;
     - Avery thanks two or three teammates at once, once without a reason;
   - one edit (`message_changed`) and one deletion (`message_deleted`) in each channel;
   - two live public kudos today.

   Every event has a unique `event_id`. No directory, member or activity row was written by hand.

   The first run edited and deleted only public kudos ([`drive-output.txt`](drive-output.txt)). [`amend.mts`](amend.mts) then edited and deleted two of Casey's private kudos ([`amend-output.txt`](amend-output.txt)). `drive.mts` now does both in one run.

   The first run's messages carried the kudos emoji without its Unicode, so they show `:hedgehog:`, the shortcode fallback (WS210). Real Slack sends the Unicode, and the private edit shows 🦔. The driver now sends it too.

   The proof member Avery reached level 2 and level 3 by giving.
3. **Session.** An append-only proof session for Avery, as #136 and #249 did: one `users`, one `authSessions` and one `authRefreshTokens` row, each with a 4-hour expiry. The sandbox's one real person's session was never used.
4. **Reads.** The three reads ran under that session. Their answers are in [`reads.json`](reads.json), with the workspace address and IDs redacted:
   - `getRecentKudos` answers both ways;
   - `getActivity` answers its first page of 20 with a cursor;
   - `getSpotlight` answers a seed draw.
5. **Launch rule.** The website ran no P77, P91 or Book launch: the launch rows are the same before and after ([`launch-rows.txt`](launch-rows.txt)). Opening Avery's own Leaderboard crate, to reach `/leaderboard`, is a member's opening, not a launch.

## Screenshots

| Surface | Light | Dark | 390 px |
| --- | --- | --- | --- |
| Last-kudos card, Received | [card-received-light](card-received-light.png) | [card-received-dark](card-received-dark.png) | [card-received-phone-dark](card-received-phone-dark.png) |
| Last-kudos card, Given | [card-given-light](card-given-light.png) | [card-given-dark](card-given-dark.png) | [card-given-phone-light](card-given-phone-light.png) |
| `/activity`: received, given with `Earned`, private channel, level 3 | [activity-light](activity-light.png) | [activity-dark](activity-dark.png) | [activity-phone-light](activity-phone-light.png) |
| `/activity`, `Given` filter | | | [activity-given-phone-light](activity-given-phone-light.png) |
| `/activity`: `Load more` | [after](activity-loaded-more-deleted-edited-light.png) | [before](activity-load-more-before-dark.png), [after](activity-loaded-more-deleted-edited-dark.png) | [after](activity-loaded-more-private-edited-phone-light.png) |
| `/activity`: public deleted and edited, level 2, Journey step | [light](activity-loaded-more-deleted-edited-light.png) | [dark](activity-loaded-more-deleted-edited-dark.png) | |
| `/activity`: private deleted | [activity-private-deleted-light](activity-private-deleted-light.png) | | |
| `/activity`: private edited | | | [activity-loaded-more-private-edited-phone-light](activity-loaded-more-private-edited-phone-light.png) |
| Spotlight, then `Next` | [spotlight-light](spotlight-light.png) | [spotlight-dark](spotlight-dark.png), [after Next](spotlight-after-next-dark.png) | [spotlight-phone-light](spotlight-phone-light.png) |

[`activity-load-more.mp4`](activity-load-more.mp4) records `Load more` on `/activity`.

**Not captured:** the private deleted and edited kudos have one mode each (above), and loading more has no 390 px "before" shot. The light, dark and phone rows above already cover the same components in every mode.

**What is blurred:** in the leaderboard screenshots, the board row of the sandbox's one real person is blurred in the page before capture. No recording of `Next` is kept: its frames couldn't be checked for that row.

## What the sandbox can't show

- **A perk bonus row under `Earned`:** the sandbox has no `perksOwned` row, and Avery is below the Skill tree's level 5.
- **The spotlight's empty state:** public kudos were captured live on the sandbox before this proof, so a draw is never empty there. #250 proved it locally ([`../spotlight/empty-light.png`](../spotlight/empty-light.png), [`../spotlight/empty-dark.png`](../spotlight/empty-dark.png)).

## Production, read-only

See [`production-reads.txt`](production-reads.txt). The three reads answer `not-found` for every member except the product owner, whose email is on `activity` (958437). The flag has no production-wide condition, so the card, the Activity tab, `/activity` and the spotlight are hidden for everyone else.

## Re-running

```sh
KUDOS_SITE=<sandbox .convex.site URL> KUDOS_WORKSPACE=<team ID> \
KUDOS_PUBLIC_CHANNEL=<public channel ID> KUDOS_PRIVATE_CHANNEL=<any private channel ID> \
SLACK_SIGNING_SECRET_FILE=<file holding the sandbox signing secret> \
bun website/proof/activity-sandbox/drive.mts
```

The member IDs are fixed, so a second run adds more history to the same four members.
