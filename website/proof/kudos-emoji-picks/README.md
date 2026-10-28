# Pick which earned emojis count in kudos: proof

## Setup

- **Backend:** this branch, pushed to the sandbox deployment with `convex dev --once`. That added the `kudosEmojiPicks` table and its `by_member_emoji` index.
- **Data:** [`drive.mts`](drive.mts) (`bun`, signed Slack-shaped events to `/slack/events`) joins three synthetic teammates: Drew, Avery and Blake. Drew thanks Blake with the workspace kudos emoji and a reason, which earns Drew the `raised_hands` level 2 emoji, First thank-you (`first-thank-you`, second name `hog-offers-heart`) and a face-down pack for Blake ([drive-1-setup.txt](drive-1-setup.txt)).
- **Session:** [`sign-in.sh`](sign-in.sh) appended a `users` and an `authSessions` row for Drew, with a four-hour expiry, so `convex run --identity` calls the website's own mutations as Drew. Nothing was deleted.
- **Run:** [`live-run.sh`](live-run.sh) drives the messages, calls `pickKudosEmoji`, `turnItem` and `markEmojisSeen` as Drew, and reads `kudosMessages`, `awards` and `hugs` back ([live-run.txt](live-run.txt), [live-run-2-hype.txt](live-run-2-hype.txt)).

The sandbox workspace allows 3 kudos a day, and Drew spent them on the first three. A later message that counts as kudos still gets a `kudosMessages` row, in state `over-allowance`, plus the reply "This needs 1 kudos … but you have 0 left today". A message that doesn't count gets no row.

## Proof

| Message (ts) | Expected | Seen |
| --- | --- | --- |
| `4920.571` Drew → Blake `:hedgehug:` with a reason | the kudos emoji always counts | `given`, award |
| `6399.296` Drew → Avery `:first-thank-you:` | First thank-you always counts | `given`, award |
| `6699.497` Drew → Blake `:hog-offers-heart:` | First thank-you's second name counts too | `given`, award |
| `7433.727` "hey @Avery `:raised_hands:`", not picked | no kudos | no row |
| `7493.895` reaction `:raised_hands:` on Avery's message, not picked | a hug | hug row `:raised_hands:` |
| `7734.117` "hey @Avery `:blake-thorn-2-hype:`" | no kudos, since Blake isn't mentioned | no row |
| `8034.231` "@Blake `:blake-thorn-2-hype:`" before Drew turns Blake's pack | no kudos, since Drew doesn't hold it yet | no row |
| `8334.365`, `8634.515` First thank-you again, both names | counts | `over-allowance` |
| `pickKudosEmoji level:2 picked` | picked | `{"kind":"picked","picks":["level:2"]}` |
| `8945.733` "hey @Avery `:raised_hands:`", picked | counts as kudos | `over-allowance`, reply "This needs 1 kudos" |
| `pickKudosEmoji level:2 unpicked` | unpicked | `{"kind":"picked","picks":[]}` |
| `9256.563` "hey @Avery `:raised_hands:`", unpicked again | no kudos | no row |
| `turnItem` ×2 and `markEmojisSeen` for Blake's hype | Drew holds Blake's hype emoji | `{"kind":"seen","ids":["hype:…"]}` |
| `9711.747` "hey @Avery `:blake-thorn-2-hype:`", held | no kudos, since Blake isn't mentioned | no row |
| `0011.893` "@Blake `:blake-thorn-2-hype:`", held | counts, since Blake is mentioned | `over-allowance` |

The message timestamps are shown without their `179318`/`179319` prefix.

The `7xxx`–`9256` rows come from [live-run.txt](live-run.txt), which an earlier version of `live-run.sh` wrote; it read awards and hugs but not `kudosMessages`. [live-run-2-hype.txt](live-run-2-hype.txt) lists every `kudosMessages` row in the proof channel after the whole run, the earlier ones included. An earlier dry run sent `5798`–`6099` (hey with an unheld hype emoji, a reaction with it, and a mention with it). None of them left a row, and their output wasn't kept.

## Picker in the browser

The fixture build (`VITE_SHELL_FIXTURE=album`) with the album's emoji popup open:

| Behaviour | Evidence |
| --- | --- |
| "Count in kudos · 0 of 5", one chip per emoji usable in Slack, First thank-you named as always counting | [picker-1-before.png](picker-1-before.png) |
| After five presses: "5 of 5", five chips pressed, the other three disabled | [picker-2-five-picked.png](picker-2-five-picked.png) |
