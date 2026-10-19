# #657 sandbox proof: the recap's emoji line and the weekly top thoughtful kudos post

Branch `album/13` at `7ebbbce7` (origin/main merged), hand-deployed from a detached proof tree to the sandbox `different-dog-467` at 2026-10-19T14:21Z, functions only. The deploy added `grantsTold.by_workspace_at`, `teamStickers.by_workspace_at` and `thoughtfulPacks.by_giver_at`, and replaced a stale `randomEmojis` index with main's `emojiClasses` indexes (both owning lanes had merged). Flags: `album` and `album-slack` (971675) at `environment = sandbox`, 100%. Every event below is signed by hand with the sandbox signing secret (`drive.mts`), not a Slack click.

## The weekly post (`week.json`, `monday-post.json`)

1. `drive.mts join` (cast A) adds four synthetic members with signed `team_join` events.
2. `drive.mts week` sends signed kudos dated last Wednesday (2026-10-14), so they fall in the week the post covers (Monday 2026-10-12 to Sunday, Europe/Berlin):
   - Ines → Theo, thoughtful, public channel, hugged by Mira and the sandbox's human member (2 hugs);
   - Theo → Mira and Ines, thoughtful, public channel, hugged once (1 hug, 2 recipients);
   - Mira → Ines, thoughtful, in a private channel (`channel_type: group`), hugged twice;
   - Ines → Mira, `ty` (short).

   All thoughtful ones read `given`, `grantsTold` holds their `at` and recipients, and the private one's words are stored as `private`.
3. The sandbox has no counting user group (every group there is disabled), so the Monday post can't be switched on. One proof group row, `Proof Hedgehogs` (`S0PRF657HOG`, enabled), was appended with `convex import --append`, as earlier lanes seeded theirs; the daily group sync disables it again. Nothing was deleted.
4. `drive.mts post-on`: a signed App Home click by the workspace's admin switched the Monday post on (generation 3).
5. `convex run slack/mondayPost:postMondayPost '{"workspace":"<sandbox>","generation":3}'` claimed the week 2026-10-19 (`outcome: posted`). Slack's `conversations.history` returns the post (`monday-post.json`): `ok: true`, the headline, **1. Ines Varga** thanked **Theo Brandt** with the quote and its `Open in Slack` link, then **2. Theo Brandt** thanked **Mira Solberg** and **Ines Varga**. The private kudos, hugged twice, appears nowhere. No team sticker was unlocked in that week in the sandbox (the new field is written from this deploy on), so the team sticker rows are proven by `convex/feedback/albumMoments.test.ts` only.
6. `drive.mts post-off` switched the Monday post off again (generation 4, `on: false`), as it was.

The permalinks point at made-up `ts` values: backdated signed messages have no real Slack message behind them.

## The recap's emoji line (`recap-week.json`)

The sandbox's synthetic members can't receive DMs (`chat.postMessage` to their user ID answers `channel_not_found`), and the human member's recap for last week was already sent this morning. So the recap runs for the human member in an earlier week:

1. `drive.mts recap-week` sends a signed thoughtful kudos dated 2026-09-30 from the human member to a new synthetic member (Nell Okafor), and a plain message of theirs that Ines hugs. The grant recorded the human member's first pack for Nell at 2026-09-30 and the registry named `nell-okafor-hype`: a hype emoji earned in the week 2026-09-28.
2. The hug opened the human member's hug week 2026-09-28 (`recap: waiting`). `convex run hugs/recap:sweep '{}'` scheduled it, and it went `waiting → sent` on its first try: Slack answered `ok: true` to the recap carrying its `context` block with the hype emoji's `image` element. The sandbox bot has no `im:history`, so the DM can't be read back here; reading it in Slack is on the by-eye list.

The rendering itself (pictures, names, `:name:` only where Slack has the emoji, at most nine pictures) is proven by `convex/feedback/albumMoments.test.ts`.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> KUDOS_HUMAN=<human user> SLACK_APP_ID=<app> SLACK_SIGNING_SECRET_FILE=<600 file> SLACK_BOT_TOKEN_FILE=<600 file> KUDOS_CAST=<fresh letter> bun website/proof/657-album/drive.mts join|week|post-on|post-off|read-post|recap-week`.
