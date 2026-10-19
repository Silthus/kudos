# #656 sandbox proof: the thread reply after a thoughtful kudos

## Head run (`head/`)

Branch `album/12` at `d1546843` (origin/main merged), merged in a never-pushed proof tree with the #698 lane's deployed proof tree `e6ec0b55` (which carries album/fix-697 and album/fix-687, live on the sandbox), hand-deployed to the sandbox `different-dog-467` at 2026-10-19T10:50:06Z, functions only, with no index added or dropped. Flags: `album` 970572 and `album-slack` 971675 at `environment = sandbox`, 100%; `album-slack` has no production condition (the conductor widens it).

1. `drive.mts join` with `KUDOS_CAST=B` and `C` signs `team_join` events by hand (not a Slack click) with the sandbox signing secret: Odile Farrow (giver), Wren Halloway, Tamsin Reed per cast.
2. Cast B's Tamsin is put in cast B's Odile's album as a history sticker: one `albumStickers` row `{ from: "history" }` appended with `convex import --append`. Nothing was deleted.
3. `drive.mts on` (cast B): the bot posts a stand-in message in the sandbox channel, and a signed `message` event with that `ts` gives a thoughtful kudos from Odile to Wren and Tamsin. Both kudos read `given` (`kudos-states-on.txt`). Slack's `conversations.replies` (sandbox bot token) returns one reply from the app in the thread (`head/on-output.json`):
   - `*Wren is new in your album*` with Wren's hype emoji as a `context` block's `image` element (`/emoji/hype.png` on the sandbox site: synthetic members have no cutout or Slack picture);
   - `*A pack for thanking Tamsin*` / "Tamsin is already in your album, so this pack holds a hoggie.", with Tamsin's hype emoji (her first thoughtful pack: a history sticker earns none, AL23);
   - `Open your pack` to `/book#packs` (action `album-open-packs`), and the gains line `+20 XP`.

   So `chat.postMessage` answered `ok: true` with the image elements in place (AL29). A short kudos (`ty`, also `given`) to Wren on a second stand-in got no reply in its thread.
4. `drive.mts off` (cast C): with `album-slack`'s sandbox condition at 0% (10:52Z, restored to 100% at 10:52:53Z), a thoughtful kudos from Odile to Tamsin was `given` and its grant recorded a `new` pack, and its thread had no reply 20 s later (`head/off-recheck.txt`).
5. A `context` block whose `image` uses the transform production stores for posthog.com cutouts (`c_limit,w_160,f_auto,q_auto`, on Cloudinary's demo image) was accepted by Slack (`cloudinary-f-auto-picture.txt`). Production's hype pictures come from posthog.com cutouts on Cloudinary for most members and from Slack-hosted pictures for the rest (measured read-only, counts private). A post with pictures Slack still refuses for its blocks is sent once more without them.

Synthetic members match no posthog.com team in the sandbox, so team lines are proven by `convex/feedback/albumReplies.test.ts`, not here.

## First run (`on-output.json`, `off-output.json`, at `14cce973`)

The first run's "on" step matches the head run. Its "off" step proves nothing: the sandbox's 3-kudos daily allowance made that kudos `over-allowance`, so no pack was granted with or without the flag. The head run's step 4 replaces it.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> SLACK_SIGNING_SECRET_FILE=<600 file> SLACK_BOT_TOKEN_FILE=<600 file> KUDOS_CAST=<fresh letter> bun website/proof/656-album/drive.mts join|on|off` (one cast per day per step that gives kudos: the sandbox allows 3).
