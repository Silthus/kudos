# #608 running-app proof

A fresh local Convex backend (ports 13210/13211) running this branch at `cf691c67`, with FakeSlack and FakePostHog on 13212, and the website built against it and uploaded with `static-hosting upload`. Every person is made up, and no profile has a picture, so faces are initials.

Flags: `website` and `message-settings` are on for everyone. `team-pages` is on for Ada (the workspace admin), Sam, Wren and Juno, and off for Oriel. The browser signed in through imported `users`, `authSessions` and `authRefreshTokens` rows.

| Shot | What it shows |
| --- | --- |
| `01-member-unmatched-light-1280.png` | Sam lands on `?section=company-profile`. The section says he isn't matched yet and lists 20 choices, with "4 more. Type a name, role or team to narrow it down." |
| `02-member-search-dark-1280.png` | The search finds Samantha Okafor. |
| `03-member-pending-dark-1280.png` | `This is me` is held while the command is in flight. |
| `04-member-picked-landed-dark-1280.png` | The read shows his own pick with `That isn't me`, and the status says "You're Samantha Okafor on posthog.com." |
| `05-member-picked-light-390.png` | The same at 390 px. The page is 390 px wide, with no overflow. |
| `06-admin-editor-light-390.png` | Ada at 390 px: a bounded teammate list ("6 more teammates") with Sam's editor open. |
| `07-admin-editor-dark-1280.png` | The editor at 1280 px, with "Held by …" on held profiles, `Not on posthog.com` and `Cancel`. |
| `08-admin-matched-landed-light-1280.png` | `Match Sam Okafor to Briar Wexley` landed: "Matched by an admin to Briar Wexley" and "Sam Okafor is matched to Briar Wexley." |
| `09-refused-taken-light-1280.png`, `10-refused-off-dark-1280.png` | The member refusal sentences. |
| `11-admin-refusals-dark-1280.png` | The admin refusal sentences `not-admin`, `unknown` and off, one per row. |

The refusal shots stub the command's HTTP answer in the page, by wrapping `window.fetch` to answer `{ kind: "refused", reason }`. The live read refreshes the choices as soon as anyone else's link lands, so a real race can't be held on screen. The sentences shown were:
- member: `taken` "Someone else already holds that profile. If it's you, ask a workspace admin."; `matched` "You're already matched, so only a workspace admin can change it."; `unknown` "That profile isn't on posthog.com any more."; off "Matching isn't open for you right now."
- admin: `not-admin` "Only workspace admins can match teammates."; `unknown` "That teammate or profile isn't here any more."; off "Matching isn't open for you right now."

## With `team-pages` off, `/settings` is byte-equal to `main`

Oriel (`team-pages` off) opened `/settings` on the same backend twice: once with this branch's build (`index-Chd2S8pJ.js`), and once with `main`'s build at `7fd9e1f3` (`index-C1hT0jnR.js`) uploaded in its place. The rendered DOM was identical:
- `#root` outerHTML: 15,547 characters, sha256 `1d44d55310097dcb535194826060f6e49ec7375eafe613ebe84c6993bc24db99` on both builds.
- `<main>`: sha256 `a40ed04b311d427360693b65e340f115ad9087b26ace5336341ed9bd5de554b6` on both builds.

## Backend answers

From the rig's driver transcript:
- `frontDoorLinksOf().sections` was `["messages","company-profile","admin"]` for Ada, `["messages","company-profile"]` for Sam, Wren and Juno, and `["messages"]` for Oriel.
- Oriel's `getSettings` has no `companyProfile` and no `admin`.
