# Pick which earned emojis count in kudos: proof

## Setup

- **Backend:** HEAD `5b8037cd`, pushed to the sandbox deployment with `convex dev --once`, which added the `kudosEmojiPicks` table and its `by_member_emoji` index. The `kudos-emoji-picks` flag is on in the sandbox only (person property `environment` = `sandbox`), and getAlbum answers Drew's picks.
- **Data:** [`drive.mts`](drive.mts) (`bun`, signed Slack-shaped events to `/slack/events`) joins three synthetic teammates, Drew, Avery and Blake. Drew thanks Blake with the workspace kudos emoji and a reason. That earns Drew the `raised_hands` level 2 emoji, First thank-you (`first-thank-you`, second name `hog-offers-heart`) and a face-down pack for Blake ([drive-1-setup.txt](drive-1-setup.txt)).
- **Session:** [`sign-in.sh`](sign-in.sh) appended a `users` and an `authSessions` row for Drew, with a four-hour expiry, so `convex run --identity` calls the website's own mutations as Drew. Nothing was deleted.
- **Run:** [`live-run.sh`](live-run.sh) drives the messages, calls `pickKudosEmoji`, `turnItem` and `markEmojisSeen` as Drew, and reads `kudosMessages`, `awards` and `hugs` back.

The sandbox workspace allows 3 kudos a day, and Drew spent them on the first three. A later message that counts as kudos still gets a `kudosMessages` row, in state `over-allowance`, plus the reply "This needs 1 kudos … but you have 0 left today". A message that doesn't count gets no row.

## Proof, flag on ([live-run-3-flag-on.txt](live-run-3-flag-on.txt))

Timestamps are shown without their `17931` prefix.

| Message (ts) | Expected | Seen |
| --- | --- | --- |
| `90276.860` "hey @Avery `:raised_hands:`", not picked | no kudos | no row |
| `90337.068` reaction `:raised_hands:` on Avery's message, not picked | a hug | hug row `:raised_hands:` |
| `90577.446` "hey @Avery `:blake-thorn-2-hype:`" | no kudos, since Blake isn't mentioned | no row |
| `90877.619` "@Blake `:blake-thorn-2-hype:`" | counts, since Blake is mentioned | `over-allowance` |
| `91177.874` "@Avery `:first-thank-you:`" | First thank-you always counts | `over-allowance` |
| `91478.057` "@Blake `:hog-offers-heart:`" | First thank-you's second name counts too | `over-allowance` |
| `pickKudosEmoji level:2 picked` | picked | `{"kind":"picked","picks":["level:2"]}` |
| `91789.381` "hey @Avery `:raised_hands:`", picked | counts | `over-allowance` |
| `pickKudosEmoji level:2 unpicked` | unpicked | `{"kind":"picked","picks":[]}` |
| `92100.486` "hey @Avery `:raised_hands:`", unpicked again | no kudos | no row |
| `92411.651` "hey @Avery `:blake-thorn-2-hype:`" | no kudos | no row |
| `92711.826` "@Blake `:blake-thorn-2-hype:`" | counts | `over-allowance` |

## Earlier runs, before the flag

The same cases ran at `e6b11cde`, before the flag existed: [live-run.txt](live-run.txt) and [live-run-2-hype.txt](live-run-2-hype.txt). In the first, Blake's hype emoji gave no kudos even when Blake was mentioned (`88034.231`), because Drew didn't hold it yet. Blake's pack was still face down. The second run turned the pack over with `turnItem`, and then the mentioned hype emoji counted (`90011.893`). Its readout lists every `kudosMessages` row up to then, and the `given` rows there are the first three kudos: `:hedgehug:`, `:first-thank-you:` and `:hog-offers-heart:`.

## Picker in the browser

The fixture build (`VITE_SHELL_FIXTURE=album`) with the album's emoji popup open:

| Behaviour | Evidence |
| --- | --- |
| "Count in kudos · 0 of 5", one chip per emoji usable in Slack, First thank-you named as always counting | [picker-1-before.png](picker-1-before.png) |
| After five presses: "5 of 5", five chips pressed, the other three disabled | [picker-2-five-picked.png](picker-2-five-picked.png) |
