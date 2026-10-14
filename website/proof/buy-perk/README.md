# #189: buy a perk on the website

`buyPerk({ perk, request })` sends D17's `buyPerk` from the website behind the tree's gate, under the server-built key `website:{member}:{request}` (WS88, WS89). The skill tree page's available perk gets one primary `Buy for {n} skill point(s)` with its pending purchase `{ perk, request }` (WS87).

## Tests, red then green

- **Backend, red:** [`red-backend.txt`](red-backend.txt). `convex/website/buyPerk.test.ts` against a stub that always refused: 15 of 29 fail. The 14 that pass are the denials and the refusals a stub already gives. Those are proved by the refutations below.
- **Refutation of the launch gate:** [`refuted-launch-gate.txt`](refuted-launch-gate.txt). With the gate checking only the tree's page state, the P91 and Book tests fail: the purchase answered `bought` with quests or achievements on and no launch recorded, because Commands' `buyPerk` runs `showHomeTab`, whose slices run `questsLiveIn` and `achievementsLiveIn`.
- **Backend, green:** [`green-backend.txt`](green-backend.txt). The same file, 29 passing, none skipped.
- **Reason kinds:** [`red-reason-kinds.txt`](red-reason-kinds.txt). `buyPerkCatalogue.test.ts` swaps the catalogue to reach `level`, `requires` and a retired perk. Mapping `below-row` to `points` fails it.
- **The Book's launch in the sibling commands:** [`red-book-launch.txt`](red-book-launch.txt). With achievements on and no Book launch, `openFeature` and `openQuestCrate` answered `opened`, and App Home's republish would then record the Book's launch. Both now refuse (defect `df-19b45892`, closed with its guard).
- **WS10's list:** [`red-public-surface.txt`](red-public-surface.txt), then green with `./website/commands.ts:buyPerk` added.
- **Website, red:** [`red-website.txt`](red-website.txt). 42 of 244 fail before the Buy action existed. **Green:** [`green-website.txt`](green-website.txt), 244 passing.
- **Found in the running app, red then green:**
  - [`red-refusal-visible.txt`](red-refusal-visible.txt) → [`green-refusal-visible.txt`](green-refusal-visible.txt). When App Home's Buy won the race, the read turned the perk owned and the refusal's line went with the Buy button. It now stays in the perk's details.
  - [`red-stale-refusal.txt`](red-stale-refusal.txt) → [`green-stale-refusal.txt`](green-stale-refusal.txt). After a level up the drawer offered Buy under the old `No skill points to spend.` ([`found-stale-refusal-narrow-dark.png`](found-stale-refusal-narrow-dark.png)). A refusal's line now shows only while the read still can't sell the perk.
- **Coherence:** the entrance `mutation buyPerk`. *Website commands pass one guard*, *a website command never launches unlocks* and *a website command is a D17 command* gain it, and the new invariant *a skill point bought on the website is spent once* is witnessed by a refutation (the key with the call's time appended).

- **Review:** [`review-gpt-6.1-sol.md`](review-gpt-6.1-sol.md). One read-only round of GPT-6.1 Sol (high), with the spec as the oracle. The narrow-screen finding held and is fixed: the drawer reopens on `bought` and a page-level status speaks while it is closed. The axe coverage finding held. The blocker (App Home's scheduled republish meeting a flag switched on in between) is rejected with its reason.

## Running app

A disposable local backend on 6110 (cloud) and 6111 (site), storage under `/tmp`, never the shared 3210 and never a cloud deployment. The mock Slack issuer and flag server ran on 6112 with `MOCK_FLAGS_ON=xp-levels,unlocks,skill-tree`, a local override on this backend only. Unlocks launched from the shell for `U_NOBODY` before Juno joined (no Journey or Book launch: `quests` and `achievements` stayed off). Juno was imported with 1,000 XP (level 6, 2 skill points) and an open Skill tree, then signed in through the real Convex Auth handshake in the T3 preview browser.

To show `Buying…`, an unanswered call and a lost race for real, the backend process was paused with `SIGSTOP` and resumed with `SIGCONT`.

| State | Light | Dark |
|---|---|---|
| Spark available, 2 points: the line, then one primary `Buy for 1 skill point` | [light](1-available-wide-light.png) | [dark](1-available-wide-dark.png) |
| `Buying…` while the backend is paused | [light](4-buying-wide-light.png) (Rhythm) | [dark](2-buying-wide-dark.png) (Spark) |
| Bought: Spark owned in place, the HUD chip and the header drop to 1, `You bought Spark.` in the status, focus on the Spark heading | [light](3-bought-wide-light.png) | [dark](3-bought-wide-dark.png) |
| No answer within 10 s: `Couldn't reach HedgeHug. Try again.` with Buy enabled | [light](5-unreachable-wide-light.png) | [dark](5-unreachable-wide-dark.png) |
| The retry resent the same pair: `You bought Rhythm.`, chip 0, one stored purchase | | [dark](6-retry-bought-wide-dark.png) |
| Refused: App Home's Buy of Rhythm spent the last point first, so Circle answers `That couldn't be bought. No skill points to spend.` | [light](7-refused-points-wide-light.png) | [dark](7-refused-points-wide-dark.png) |
| Phone (390 px): Circle's drawer with Buy | [light](8-available-narrow-drawer-light.png) | [dark](8-available-narrow-drawer-dark.png) |
| Phone: bought in the drawer, focus on its heading | [light](9-bought-narrow-drawer-light.png) | [dark](9-bought-narrow-drawer-dark.png) |

- **App Home republished with the perk owned:** [`running-app-spark.txt`](running-app-spark.txt). The App Home view the mock recorded after the website bought Spark is the Skill tree tab with `✅ *Spark* · Owned` and `You have *1 skill point* to spend.`. Beside it are the stored purchase under `website:{member}:{request}`, the owned perk and `pointsSpent: 1`.
- **Every purchase of the run:** [`running-app-purchases.txt`](running-app-purchases.txt). The retry of Rhythm stored one purchase. The two races stored App Home's `bought` under `slack:Ev_…` beside the website's refusal under `website:…`: once `owned` for Circle, once `no-skill-points`. The key spaces never collide.

## V24 manual pass

- **Focus order:** from the selected Rhythm node, Tab reached Circle and then `Buy for 1 skill point`, with `:focus-visible` on each stop. Enter bought Rhythm, and focus landed on `h2#perk-details-title` (`Rhythm`), also `:focus-visible`, with `You bought Rhythm.` in the status and the chip named `0 skill points to spend`.
- **Not by colour alone:** Buy is the page's one primary button. `Buying…` is a label, not only a dimmed button. A refusal and an unreachable server are words in the details and the status.
- **Motion:** buying plays nothing: no crate, reveal, count-up or burst (V13, V8, V9). The drawer's slide is Quill's own.
- **Screen-reader wording:** the status says `You bought {name}.`, `That couldn't be bought.` plus the reason, or `Couldn't reach HedgeHug. Try again.`. It sits inside the details, so it is heard in the modal drawer too.
- **axe** passes in light and dark for buying, bought, refused and unreachable on a wide screen, and for buying and refused in the drawer (`website/src/accessibility.test.tsx`).
- **Non-text contrast (by eye):** the primary Buy and the muted `Buying…` stand clear of the card in both modes.
