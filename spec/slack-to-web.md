# Spec: Slack shows what a kudos earned, and points to the website

> **Accepted on [#210](https://github.com/Silthus/kudos/issues/210) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/slack-to-web` and is never merged. It amends P71 of the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`) and builds on the per-member flags spec (`spec/per-member-flags.md` on `docs/per-member-flags`, F16 and F28). Spec #209 (meaningful thank-yous) builds on its gains line.
>
> **Rule numbers.** Rules are cited as `SW1`–`SW24`. Progression rules are cited as `P71`, per-member flag rules as `F28`, website rules as `WS78`, core loop rules as `R36`.
>
> Sources: Michael's three decisions (quoted under "Further Notes"); the code on `main` at `19223ef` (`convex/feedback/` replies, home, notify and welcome, `convex/slack/appHome.ts`, `convex/website/link.ts`, `website/src/route.ts` and `website/src/features.ts`); the route contract the website map (#57) relayed on #210; map #1's decisions 11, 14 and 17.

## Problem Statement

A giver thanks a teammate, and Slack answers with how many kudos they gave and how many are left. It never says what the thank-you earned them. XP, the number the whole game grows from, is invisible at the moment it is earned; a member learns about it only when a level-up DM arrives, or by opening App Home and comparing numbers.

Meanwhile the website has grown a home, a leaderboard, and soon quests, a skill tree and a Book. App Home repeats much of it in Slack's narrower blocks: the totals, the full leaderboard tab, the website link at the very bottom. Slack's messages talk about levels, quests and unlocks, but none of them leads to the page that shows them. A member who wants to see more has to know the website exists and find it.

## Solution

**Slack shows the gain, and points to where it lives.**

- **The gains line.** The success reply's extras line now starts with what the kudos earned its giver: `+20 XP`. A quest the kudos finished joins the same line with its own reward: `+20 XP · Quest done: Thank someone new (+50 XP)`. Each part shows only what the giver can see.
- **App Home as the front door.** For a member whose `website` decision is on, App Home's Profile tab becomes a short summary: kudos left today, level, anything waiting (ready crates, finished quests, the next Journey step, the week's quests), and a row of buttons that open the website: Home, then each open feature that has a page. The Leaderboard tab gives way to its button. Settings and Admin stay, because the website has no equal yet. A member whose `website` decision is off keeps today's App Home, unchanged.
- **Deep links.** Every Slack message to one member about something the website shows ends with a link to that page: the success reply, the welcome DM, level-up and unlock DMs, quest and Journey DMs, and the leaderboard reply. Links appear only while the member's `website` decision is on.
- **One route list.** The links come from one list of the website's pages, `SITE_URL` plus each route, and the list holds only routes the website already serves. A test keeps it equal to the website's router, so a link turns on in the same change that ships its page.

## User Stories

**The gains line**
1. As a giver, I want the success reply to tell me how much XP my kudos earned me, so that I feel the game respond to my thank-you.
2. As a giver who thanked three people at once, I want the XP for the whole message in one number, so that I don't have to add it up.
3. As a giver who finished a quest with this kudos, I want the reply to say which quest and what it paid, so that I see the quest working.
4. As a giver, I want the gains on one line under the reply, so that the reply stays short.
5. As a member who can't see XP and levels yet, I want the reply to stay as it is today, so that it never names a number I can't find anywhere.
6. As a member who hasn't opened Coins or the Book, I want the line never to mention them, so that the app only talks about what I can see (P76).
7. As a giver, I want the number in the reply to be exactly what I earned, so that App Home and the website agree with it.

**App Home as the website's front door**
8. As a member with the website, I want App Home to show the few things I check in Slack, so that I see my day's state in a glance.
9. As a member with the website, I want buttons to the website's pages in App Home, so that I can go straight to my leaderboard, quests, skills or Book.
10. As a member with the website, I want the buttons to list only features I have opened and the website has a page for, so that no button leads to a locked or missing page.
11. As a member with the website, I want ready crates and finished quests in App Home with their Open buttons, so that I can collect a reward in one click without signing in.
12. As a member with the website, I want to keep swapping a weekly quest from App Home, so that I don't lose a choice the website doesn't offer yet.
13. As a member with the website, I want my settings and, as an admin, the announcement channel in App Home, so that I can still change them while the website can't.
14. As a member without the website, I want App Home exactly as it is today, so that nothing points me at a site I can't enter.
15. As a member, I want the Leaderboard tab replaced by a button only once the website shows the leaderboard, so that I never lose the board.
16. As a member, I want App Home to keep teaching how to give kudos and how to add the app to a channel, so that Slack still explains Slack.

**Deep links**
17. As a giver, I want the success reply to link to my progress on the website, so that I can see the XP land.
18. As a new member, I want the welcome DM to tell me the website exists and link to it, so that I find it on day one.
19. As a member who levels up, I want the DM to link to my home on the website, so that I can see what the level brought.
20. As a member with something ready, I want the DM to link to where the website shows it, so that I can open it there if I like.
21. As a member who finished a quest, I want the DM to link to my quests, so that I can see the rest of my week.
22. As a member who asked for the leaderboard, I want the reply to link to the same board on the website, so that I can see more than Slack shows.
23. As a member whose website decision is off, I want no links at all, so that nothing leads me to a closed page.
24. As a member who opens a link while signed out, I want to land on the exact page after signing in, so that the link keeps its promise (website #157).

**Robustness**
25. As Michael, I want no link to a page the website doesn't serve yet, so that a Slack message never leads to the not-found page.
26. As Michael, I want a page's links to switch on in the same change that ships its route, so that nobody has to remember a second step.
27. As Michael, I want everything here dark until the existing flags are on, so that production is unchanged until I switch it (decision 11).

## Rules

### The gains line (amends P71)

- **SW1. What the line starts with.** A Given success reply (R36) shows the giver's gains as the first parts of its extras line (P71): `+{xp} XP`, the base XP the message gave its giver (P1: 10 per kudos, summed over every award of the message, so `@a @b :taco:` shows `+20 XP`). P71's parts follow in its order, joined with ` · `: coins earned (once Coins is opened), a new sticker (once the Book is opened), each quest done. When none applies, there is no extras line, as today.
- **SW2. One source for the number.** Progression computes the XP part from the same catalogue and the same award kudos its effects record uses (P7), through one function both call. The reply has no formula of its own, so the line always equals the sum of the message's giver-side effects records.
- **SW3. Quests show what they paid.** Each quest-done part names its goal and its reward: `Quest done: {goal} (+{xp} XP)`, for a weekly quest and a Journey step alike. A quest's XP is never added into the base `+{xp} XP`, so each number says where it came from.
- **SW4. One line.** P71 allows one extras line. A held reply (Feedback's quests hold) joins its quest-done parts onto the same line as the gains, instead of adding a second line: `+20 XP · Quest done: Thank someone new (+50 XP)`.
- **SW5. Each part follows the giver's view.** The XP part shows while XP and levels are shown to the giver (`xp-levels`, by the giver's member decision once per-member flags ship, F16); quest parts while quests apply, as today; coins and the sticker by P76. With `xp-levels` off and no quest done, the reply is byte-for-byte today's. The XP part is decided in the mutation that writes the reply; the quest parts keep today's check at delivery.
- **SW6. What the line leaves out.** It never names a level reached (the level-up DM and the public notice do, P6), the recipients' XP, or a feature the giver hasn't opened. The meaningful bonus belongs to spec #209, which adds its own part to this line through the same parts list and sets its position and copy.
- **SW7. Honest copy.** The line states numbers and quest goals only. It follows P95: it never calls a kudos thoughtful, and P15's hint stays the last part when it applies.

### The website's pages (the shared contract)

- **SW8. The route list.** Slack links to these pages and no others. The origin is the deployment's `SITE_URL`.

  | Page | Route | Feature | On `main` at `19223ef` |
  |---|---|---|---|
  | Home | `/` | none | yes |
  | Leaderboard | `/leaderboard`, `/leaderboard?period=month`, `/leaderboard?period=all` (week is the bare path) | `leaderboard` | yes |
  | Quests | `/quests` | `quests` | no: website ship #152 |
  | Skill tree | `/skills` | `skillTree` | no: website ship #193 |
  | Book | `/book` | `book` | no: website ship #193 |

  Coins and hedgehogs have no page. Every other path is the website's not-found page; there are no other parameters, tabs or anchors.
- **SW9. Listed only once served.** The backend keeps the route list as one module beside the website's link. It holds exactly the routes the website's router serves. A contract test in the gate checks both directions: every listed route resolves to its page in the website's router, and every feature page the website's router knows is listed. The change that adds a route to the router therefore adds it to the list, and its Slack links switch on with it.
- **SW10. One way to build a link.** One function in the website module answers a link for a member and a page: `SITE_URL` plus the page's route, or nothing. It answers nothing while the member's `website` decision is off, while `SITE_URL` is unset, or when the workspace isn't the website's sign-in workspace, exactly as App Home's website link does today. A page that isn't listed yet resolves to Home. No other module builds a website URL.
- **SW11. Whose decision.** "The member's `website` decision" is whatever the website link reads: the workspace decision today, the member decision once the website map moves the link per member (F28, #204). This spec changes no decision; every rule below follows the link function.

### Deep links

- **SW12. Which message links where.** Each message ends with one link, labelled as below, to the page its subject lives on:

  | Message | Page | Label |
  |---|---|---|
  | Given success reply | Home | `See your progress on the web` |
  | Welcome DM | Home | `Open HedgeHug on the web` |
  | Level-up DM | Home | `See your level on the web` |
  | Features-shipped DM (ready crates) | Home | `See what's ready on the web` |
  | Quest finished, weekly quest finished and Journey joined DMs | Quests | `See your quests on the web` |
  | Tier DM (achievements, once it exists) | Book | `See your Book on the web` |
  | `/hedgehug leaderboard [month\|all]` reply | Leaderboard, same period | `See the full leaderboard on the web` |

  While Quests or Book isn't listed (SW9), its messages link to Home with the label `Open HedgeHug on the web`.
- **SW13. Where the link sits.** In the success reply, the link is the last part of the extras line (SW1), after P15's hint when that applies, so a reply with no other extras gets an extras line holding only the link. In a DM or a command reply, it is the last line, as Slack link text, after any Open button.
- **SW14. Not everywhere.** The over-allowance, invalid and edited-message replies, the `/hedgehug` channel replies, the public reply and every public notice carry no link. A channel shows a workspace's moment to everyone, and per-member decisions can't govern it (F18).
- **SW15. Off is today.** A member whose `website` decision is off, or a deployment without `SITE_URL`, gets every message byte-for-byte as today.
- **SW16. Decided at render.** A DM decides its link when it is delivered (with the rest of its lines), the success reply when it is written, the leaderboard reply when it is answered. The link function is safe to call from a query and sends no exposure (F25 exposures come from mutations).

### App Home as the front door

- **SW17. Two homes.** A member whose `website` decision is off sees today's App Home, unchanged. A member whose decision is on sees the front door (SW18–SW22).
- **SW18. Tabs.** The front door has Profile (the summary), then Settings and Admin when today's rules show them. A tab whose feature has a listed page is replaced by that page's button: the Leaderboard tab goes now, and the Skill tree and Book tabs (progression stopping point 4, #171) go once `/skills` and `/book` are listed. A remembered tab that is gone opens as Profile, as today's rule for a tab whose flag is off.
- **SW19. The summary**, top to bottom:
  1. The allowance line, as today.
  2. Level and XP to the next level, and skill points saved from level 5, as today's Profile shows them (P67, P76).
  3. What is waiting, as today's Profile shows it, each with its own button: ready unlock crates with Open, the next locked feature (`Next: …`), the week's quests with their progress, Swap and Open, and the active Journey steps. These stay in Slack because a click there collects a reward without signing in, and the website can't swap a quest yet (website spec 3: "Swapping a quest stays in Slack for now").
  4. The website buttons (SW20).
  5. The two how-to hints, as today.

  The kudos totals and the closing `Open HedgeHug on the web` link line are gone: the website's home shows the totals, and the buttons replace the link.
- **SW20. The buttons.** One row of link buttons: `Open HedgeHug` to Home, always; then one button per feature that is open for the member and has a listed page, in unlock schedule order (Quests, Leaderboard, Book, Skill tree), each labelled with the feature's name. "Open" is the state the website's own navigation reads (`webPageOf` over the member's feature states), so App Home and the website's nav show the same pages. Before unlocks apply for the member, the Leaderboard counts as open while the Everyone board is shown to them, as the website does.
- **SW21. Same triggers.** The front door is published on the same triggers as today's App Home; no new trigger is added. A route added to the list shows at the member's next publish.
- **SW22. Settings and Admin unchanged.** Their content and commands are today's. They move to the website only when the website gains an equal, in a later spec.

### Flags and shipping

- **SW23. No new flag.** The gains line is gated by `xp-levels` (SW5); links and the front door by `website` (SW10, SW17). Both are dark in production today, so the ship changes nothing in production until Michael switches them, and with both off every Slack call is byte-for-byte today's. No gate ticket is needed.
- **SW24. Routes that ship later.** `/quests`, `/skills` and `/book` switch on when the website change that adds each route also adds it to the list (SW9). The Skill tree and Book tabs, and the tier DM's Book link, need #171's code on `main`, so one follow-up ticket carries them after #171 ships.

## Implementation Decisions

- **Progression** gains one exported function: the giver's base XP for a Given outcome's awards, using the catalogue in force. Its effects records use the same function (SW2). Nothing about effects changes.
- **Feedback's reply** stops treating the extras line as opaque text. It becomes an ordered list of parts (XP, quest done, later coins, sticker, #209's bonus, P15's hint, the link), rendered with ` · ` as one line. The held reply's quest-done parts are stored as parts and joined at delivery, so SW4 holds without a second line. `QuestDone` carries the reward XP.
- **Line segments** gain a link kind: `{ link: { url, label } }`. The Slack adapter renders it as `<url|label>`; it is the only place that knows Slack's link syntax.
- **The website module** gains the route list (SW8, SW9) beside `link.ts`, and the link function (SW10) generalising today's `websiteLinkOf` to take a page. `websiteLinkOf`'s callers move to it. The website map owns `convex/website/`; this spec adds to it the way earlier cross-map needs did, additively.
- **Notifications** (`NotificationLine`) gain a link line kind, decided in `linesStillWanted` when the DM is delivered. The welcome message gains the same final link.
- **App Home's** desired state takes the member's website decision and listed pages: `renderHome` picks today's view or the front door. The front door reuses today's Profile parts and drops the totals; `tabsOf` drops a tab whose feature has a listed page; a new home line kind holds the button row (Slack `actions` with URL buttons, which need no interactivity handler).
- **The open features** for SW20 come from the same read the website's profile uses for its feature states, exported from where it lives today, so both sides answer from one place.
- **Lexicon:** settle **gains line** (the success reply's first extras parts), **route list** (the website pages Slack may link), **deep link** (a link from a Slack message to a listed page) and **front door** (App Home for a member with the website), and amend **app home** and **website**.

## Testing Decisions

- **Good tests** drive the Slack boundary from the outside: signed events, commands and App Home openings through the HTTP router with `convex-test`, Slack and PostHog stubbed at `fetch`, asserting the exact Slack calls. They never assert on internal tables or renderer internals.
- **The gains line:** a kudos to two people with `xp-levels` on posts an ephemeral whose last line is `+20 XP`; with a weekly quest finished it is `+20 XP · Quest done: … (+N XP)` on one line; with `xp-levels` off the ephemeral equals today's byte-for-byte. A property-style test sums the giver's effects records and compares them with the line (SW2). Prior art: `replies.test.ts`, the quests hold tests in `convex/quests/`, `xpLevelsFlag.test.ts`.
- **Deep links:** with `website` on and `SITE_URL` set, each message in SW12 ends with its link; with `website` off, or `SITE_URL` unset, each equals today's. The leaderboard reply keeps its period in the link. Prior art: `levelUpDm.test.ts`, `unlocksDm.test.ts`, `welcome.test.ts`, `leaderboard.test.ts`.
- **The route list contract (SW9):** one test imports the website's router and the backend's list and checks both directions. It is the enforcement for SW9 and runs in `pnpm gate`.
- **App Home:** with `website` off, `views.publish` equals today's view; with it on, the view has no Leaderboard tab, no totals, and a button row whose URLs are `SITE_URL` plus each open listed page in schedule order. Prior art: `appHome.test.ts`, `homeTabBar.test.ts`, `progressionHome.test.ts`, `unlocksHome.test.ts`.
- **The ship's proof** runs the sandbox with `website` and `xp-levels` on and records one success reply, one level-up DM and App Home before and after, plus the production-semantics proof with both off (memory: recording proxy).

## Out of Scope

- Moving Settings or Admin to the website (SW22), and swapping quests on the website.
- The meaningful bonus, its copy and its teaching (spec #209).
- Links in public replies and notices (SW14).
- A website page for coins, hedgehogs or another member.
- Changing which decision the `website` flag uses (#204, F28).
- Any new flag (SW23).

## Further Notes

**Michael's decisions (2026-10-14, map #1's conductor thread), verbatim:**

> In general we should show the giver what they gained for giving that kudos in the success message (if we aren't already).

> the web ui is coming really well along. I want you to restructure the app home to send to that instead of duplicating information there.

> Also messages should carry deep links to the website

**The route contract** was relayed by map #1's conductor from the website map (#57) on #210 and is recorded on #57. SW8 quotes it.

### What the website map (#57) must do

1. **Add each route to the list when it ships it.** #152 adds `/quests`, #193 adds `/skills` and `/book`, each in the change that adds the route to the router. The contract test (SW9) fails until it does, which is the point.
2. **Keep the deep-link promise:** a signed-out deep link survives sign-in and lands on the exact address (#157, already merged), including through F28's direct sign-in entry for a previewer: that entry must carry the destination path, or a previewer's deep link ends on Home.
3. **Optionally** read the website's own `webPages` hrefs from the shared route list, so there is one list instead of two kept equal by a test.

### Calls

Each call is recorded with `coherence decide` and cites Michael's decisions (`d-` ids in the resolution on #210).

1. The XP part is the base XP of the whole message, computed by Progression (SW1, SW2), over reading effects records after they are written, which would hold every reply for a subscriber.
2. Quest parts carry their own XP and are never summed into the base (SW3), over one total that hides where XP came from.
3. The gains line leaves out level ups and recipients' XP (SW6), over a longer line that repeats the level-up DM.
4. Links are gated in code by a route list kept equal to the website's router by a test (SW9), over follow-up tickets per route, which someone must remember to dispatch.
5. An unlisted page falls back to Home (SW10, SW12), over sending no link.
6. One link per message, last (SW13), over links on every noun.
7. No links in public messages (SW14).
8. Waiting items, quests with Swap and the Journey stay in App Home's summary (SW19), over sending them to the website: a click in Slack collects a reward without signing in, and the website can't swap yet.
9. The Leaderboard tab gives way to a button now; the Skill tree and Book tabs follow once their routes are listed (SW18).
10. No new flag and no gate ticket (SW23).
11. The tier DM's Book link and the Skill tree and Book tabs ride one follow-up ticket after #171 (SW24).
