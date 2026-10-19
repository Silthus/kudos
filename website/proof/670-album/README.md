# #670 proof: the album's retired end state

## The walk in `convex-test` (`convex/album/endState.test.ts`)

Four members at level 6 are set up with every flag on, as production was before #686. Coins is open for three of them and only ready for the fourth. Then the same walk runs twice: once with AL33's nine flags off (the end state) and once with them on. Each walk goes:

1. App Home through signed `app_home_opened`, and the maintainer maps a Slack emoji to a team.
2. Three thoughtful kudos, a short one and two hugs through the signed Slack router.
3. Every album command and read signed in.
4. Every App Home tab.
5. Monday's recaps and post.

Slack and PostHog are stubbed at `fetch`.

| What the album needs | End state vs. the walk with the retired flags on |
|---|---|
| `getAlbum`: packs, tray, stickers, team pages, milestones, emojis, level | equal |
| `openThoughtfulPack`, `putIn`, `putAllIn`, `unlockTeamSticker`, `markEmojisSeen`, `mapSlackEmoji` | equal, except the documented difference: a pack's `applied` shows `coins` and `skillPoints` as 0 while `coins` and `skill-tree` are off |
| `getAlbumHoggies`, `getThoughtfulBoards` (week, and one team over all time), `getAlbumPerson`, `getAlbumWeek`, `getAlbumProfile`, `getEmojiMappings` | equal |
| The thread reply after a thoughtful kudos | equal, except the documented difference: no `+N 🪙` beside the XP while `coins` is off |
| The recap's emoji line, the weekly top thoughtful kudos post | equal |
| Every product event outside the retired features' own | equal |
| App Home, every tab | no coins, store, quests, Journey, skill tree, Book, tiers or level unlocks. With the flags on, the members' tabs show each of them |

The walk found one gap, fixed here: App Home's Settings tab (and the website's Settings, which read the same rows) still described **Level ups** as "When you reach a level, with what it opens for you." and **Public celebrations** as "Your level ups and tiers in the announcement channel." while `unlocks` and `achievements` were off. Red: [`red.txt`](red.txt). Green: [`green.txt`](green.txt).

## The sandbox walk (`different-dog-467`)

AL33's nine flags have been off in the sandbox for everyone since #686 (`groups: []`), and `album` and `album-slack` are on there. So the synthetic members below walk the end state itself. Every Slack event is signed by hand with the sandbox signing secret (`drive.mts`), not clicked. Every website read and command runs through `convex run --identity` with an appended `users` and `authSessions` row per member (`site.py`).

The deploy was a throwaway tree: head `390b4c13` merged with the backends live on the sandbox (#719 `59597995`, #718 `56fa1954`, #722 `fa5829a2`), so no lane's functions dropped. The dry run showed no index added or dropped. It was deployed at 2026-10-19T16:54Z, after a sibling deploy had replaced the first one at 16:40Z.

1. `drive.mts join` (cast A): Ava Lindgren, Ben Achterberg and Cyd Moreno join through signed `team_join`, and each opens App Home.
2. `drive.mts kudos`: Ava thanks Ben and Cyd, and Ben thanks Ava, both thoughtful, in the sandbox's public channel. Cyd says `ty` to Ben. Ben hugs Ava's kudos. Three thoughtful packs are granted (Ava→Ben, Ava→Cyd, Ben→Ava), and `deliverAlbumReply` ran twice to success with no retry.
3. [`thread-replies.json`](thread-replies.json) holds the replies those two grants render (`feedback/albumReplies:albumReply`): "Ben is new in your album · Cyd is new in your album" and "Ava is new in your album", each in the kudos thread with **Open your pack** and an XP gain only, no coins. The sandbox kudos have made-up `ts` values, so Slack has no thread to show them in. #656 proved the reply in real Slack.
4. [`website-walk.json`](website-walk.json), per member:
   - each waiting pack opens into the tray (a sticker and a hoggie each, `applied` with `coins` and `skillPoints` 0), then `putIn` and `putAllIn` answer `placed`, and `markEmojisSeen` answers `seen`;
   - `unlockTeamSticker` answers `refused`, because no sandbox team page holds the synthetic members;
   - `getAlbum` holds the people they thanked, earned hype emojis and the bronze `first-face` and `first-thank-you` milestones;
   - `getAlbumHoggies` counts their finds, and `getThoughtfulBoards` ranks Ava with 2 and Ben with 1;
   - `getAlbumPerson`, `getAlbumWeek` and `getAlbumProfile` answer `person`, `week` and `profile`;
   - `getEmojiMappings` answers `off`, because the sandbox has no `KUDOS_MAINTAINER`. The test covers the maintainer.
5. [`app-home.json`](app-home.json): through signed `showHomeTab` clicks and `feedback/homes:shownHomeOf`, each member is offered Profile, Leaderboard and Settings. The profile carries only their level and XP: `coins`, `skillPoints`, unlocks, quests, the Journey, crates and the Book's hoggies are all `null`. Settings lists After-kudos reply, Level ups ("When you reach a level."), Public celebrations ("Your level ups in the announcement channel.") and the hugs recap. A sibling deploy of `main`'s code had served the old two descriptions minutes before (`settings rows on main before the fix`).

### Covered elsewhere in the end state

#657's sandbox proof (`website/proof/657-album/`) ran the recap's emoji line and the weekly post on the sandbox at 14:21Z and 14:50Z on 2026-10-19, after #686 had turned AL33's flags off at 04:52Z. That proof ran in this end state, so this proof doesn't repeat the once-a-week post.

### By design, not a gap

With the flags off, the sandbox still stores some rows of the retired features for the synthetic members. Nothing shows them:

- readiness rows for the Leaderboard at level 2 (Unlocks spec: "Readiness is recorded whatever the unlocks flag says");
- Book tiers and their coin reward records, since the Book launched in the sandbox (Achievements spec: "From the launch on the subscriber counts every kudos, whatever the flags say later"; AL36: coins keep being credited).

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_APP_ID_FILE=<600 file> SLACK_SIGNING_SECRET_FILE=<600 file> KUDOS_CAST=<fresh letter> bun website/proof/670-album/drive.mts join|kudos|tab <tab>`, then `python3 website/proof/670-album/site.py <identities> <members> <out.json>`.
