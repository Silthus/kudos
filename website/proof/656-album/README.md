# #656 sandbox proof: the thread reply after a thoughtful kudos

Branch `album/12` at `bc7ae5ee` (origin/main merged), merged in a never-pushed proof tree with album/fix-697 at `98333038` (its `fillThoughtfulBoards` was live on the sandbox), hand-deployed to the sandbox `different-dog-467` at 2026-10-19T09:55:26Z, functions only, with no index added or dropped. Flags: `album` 970572 and `album-slack` 971675 at `environment = sandbox`, 100%.

1. `drive.mts join` signs three `team_join` events by hand (not a Slack click) with the sandbox signing secret: Odile Farrow (giver), Wren Halloway, Tamsin Reed.
2. Tamsin is put in Odile's album as a history sticker: one `albumStickers` row `{ from: "history" }` appended with `convex import --append`. Nothing was deleted.
3. `drive.mts on`: the bot posts a stand-in message in the sandbox channel, and a signed `message` event with that `ts` gives a thoughtful kudos from Odile to Wren and Tamsin. Slack's `conversations.replies` (sandbox bot token) then returns one reply from the app in the thread, `on-output.json`:
   - `*Wren is new in your album*` with Wren's hype emoji as a `context` block's `image` element (`/emoji/hype.png` on the sandbox site: Wren has no posthog.com cutout or Slack picture);
   - `*A pack for thanking Tamsin*` / "Tamsin is already in your album, so this pack holds a hoggie.", with Tamsin's hype emoji (her first thoughtful pack: a history sticker earns none, AL23);
   - `Open your pack` to `/book#packs`, and the gains line `+20 XP`.

   So `chat.postMessage` answered `ok: true` with the image elements in place (AL29). A short kudos (`ty`) to Wren on a second stand-in got no reply in its thread.
4. `drive.mts off`: with `album-slack`'s sandbox condition at 0% (restored to 100% at 09:58Z), a thoughtful kudos from Odile to Tamsin, a `nextWeek` outcome the reply would have named, got no reply in its thread, checked again 20 s later (`off-output.json`).

Synthetic members match no posthog.com team in the sandbox, so the new person's team lines are proven by `convex/feedback/albumReplies.test.ts`, not here.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> SLACK_BOT_TOKEN_FILE=<600 file> KUDOS_CAST=A bun website/proof/656-album/drive.mts join|on|off`

**Round 1 review fixes.** The sandbox bot posted a `context` block whose `image` element uses the transform production stores for posthog.com cutouts (`c_limit,w_160,f_auto,q_auto`, on Cloudinary's demo image), in the same thread: Slack answered `ok: true` and echoed the image element (`cloudinary-f-auto-picture.txt`). Production's hype pictures come from posthog.com cutouts on Cloudinary for most members and from Slack-hosted pictures for the rest, measured read-only with the counts kept private. A post Slack still refuses for its blocks is sent once more without its pictures.
