# Spec: the website's activity feed, the last few kudos, the timeline and the spotlight

> **Accepted on 2026-10-14 under the product owner's autonomous directive** (map [#57](https://github.com/Silthus/kudos/issues/57) Notes: "ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags"), with every open call at its recommendation (listed under "Further Notes"). Ticket [#233](https://github.com/Silthus/kudos/issues/233). This file lives on the branch `docs/spec-website-6` and is never merged. Its rules start at `WS200`, so they never collide with the fifth slice's (`WS97` onward, [`spec/website-5.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-5/spec/website-5.md) on `docs/spec-website-5`, written in parallel by [#231](https://github.com/Silthus/kudos/issues/231)). `WS1`–`WS28` are in [`spec/website.md`](https://github.com/Silthus/kudos/blob/docs/spec-website/spec/website.md), `WS29`–`WS54` in [`spec/website-2.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-2/spec/website-2.md), `WS55`–`WS77` in [`spec/website-3.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-3/spec/website-3.md) and `WS78`–`WS96` in [`spec/website-4.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-4/spec/website-4.md). All of them still hold, except where a rule below names the one it changes.
>
> Sources: the product owner's two decisions of 2026-10-14 (quoted under "Further Notes"); **map #1's contract**, [`spec/activity-timeline.md`](https://github.com/Silthus/kudos/blob/6a088dc/spec/activity-timeline.md) at `6a088dc` on `docs/activity-timeline` (the conductor moved this spec from `a437599` after #232's review), section "The contract for the website (#233)", rules `AT1`–`AT40` ([#232](https://github.com/Silthus/kudos/issues/232)); the code on `main` at `2f30796` (`website/src/route.ts`, `convex/website/routes.ts`, `website/src/LiveApp.tsx`, `website/src/home/`, `website/src/leaderboard/SidePanels.tsx`, `website/src/SlackLink.tsx`, `website/src/Face.tsx`); the fifth slice's spec at `b836797` (WS97, WS107, WS108: the slot under `What teammates see`); the visual language ([`docs/website/visual-language.md`](https://github.com/Silthus/kudos/blob/main/docs/website/visual-language.md), V1–V24, especially V9, V14, V19 and V24); the accepted prototype #62's variant E (`prototype/website-ui` at `3409ade`) for the visual language; and the progression spec of record (`docs/spec-progression-v2` at `4bfc420`: P76, P94, P95).

## Problem Statement

A member who gets thanked in Slack sees it once, in the channel, and then it scrolls away. The website's home counts the kudos a member gave and received, but never shows a single one: not who thanked them, not for what, not the words. A giver can't look back at whom they thanked or what each thank-you earned them, and level-ups arrive as a DM and vanish. The leaderboard, the one page the whole workspace shares, shows only numbers.

Map #1's #232 now keeps the words of kudos messages and hands the website three reads: the last few kudos, a member's whole activity in pages, and a random kudos from a public channel. The website has no surface for any of them.

## Solution

**Three surfaces, each a projection of one of #232's reads, all behind the `activity` flag through the member decision.**

- **The last few kudos on the home.** A card in the home's right rail, directly under `What teammates see` (WS108's slot), lists the member's last three kudos. A two-way switch flips it between `Received` and `Given`. Each row leads with the other person's face and name, then the words, then when. `See all activity` opens the Activity tab on the same side.
- **An Activity tab on the member's own page.** The home and a new page, `/activity`, share a pair of tabs, `Character` and `Activity`. The Activity tab is a timeline, newest first, grouped by day in the member's own time zone: each kudos they received with the giver's words and a link to it in Slack; each kudos they gave with every recipient, their own words, and what it earned them (XP and any quest it finished); and a mark for every level they reached. A filter shows `All`, `Received` or `Given`. It loads more as the member scrolls, with a visible `Load more` button that always works, and focus stays where the member put it.
- **A spotlight on `/leaderboard`.** The top of the board's side column shows one real thank-you, drawn at random from public channels, with its words, giver and recipients and a link to Slack. `Next` shows another. It never rotates by itself.

The words are shown exactly as they were written, as text: a message never becomes HTML. A link to Slack shows only while #232 knows the workspace's address. The website computes no game rule: XP, quests, levels, who said why, and which kudos may be drawn are #232's facts, read and shown.

## User Stories

**The last few kudos**
1. As a member, I want my home to list the last few kudos I received, so that I see the latest gratitude at a glance.
2. As a member, I want to switch that list to the last few kudos I gave, so that I see my own giving too.
3. As a member, I want each one to show who thanked me (or whom I thanked) with their face, so that I recognise the moment before I read it.
4. As a member, I want a short version of the words, so that the card stays brief and I can go deeper on the Activity tab.
5. As a member, I want to know the card is only mine, so that I'm not worried teammates see what I received.

**The Activity tab**
6. As a member, I want my activity on a tab of my own page, so that it sits next to my character and not somewhere else.
7. As a member, I want every kudos I received, newest first, with the giver's words, so that I can relive what people thanked me for.
8. As a member, I want a link that opens each kudos in Slack, so that I can see the thread around it and reply.
9. As a member, I want every kudos I gave with all its recipients and my own words, so that I can look back at whom I thanked.
10. As a giver, I want each kudos I gave to show the XP it earned me and any quest it finished, so that I see the game respond to each thank-you.
11. As a member, I want my level-ups as marks in the same timeline, so that I see when my thank-yous added up.
12. As a member, I want day headings in my own time zone, so that "Yesterday" means my yesterday.
13. As a member, I want to filter to received or given, so that I can focus on one side.
14. As a member, I want more to load as I scroll, so that I can go back as far as I like.
15. As a keyboard or screen-reader member, I want a `Load more` button and to keep my place when more loads, so that the timeline works without a mouse.
16. As a member, I want new kudos that arrive while I read not to push the list under me, so that I don't lose my place.
17. As a member, I want a deleted or edited message marked as such, so that I know why words are missing or may differ.
18. As a member, I want to know when a kudos came from a private channel, so that I'm careful where I share it.

**The spotlight**
19. As a member on the leaderboard page, I want to read one real thank-you from my workspace, so that the board shows the gratitude behind the numbers.
20. As a member, I want a `Next` button, so that I can read a few more.
21. As a member, I want the spotlight never to move by itself, so that I can read at my own pace.

**Running it**
22. As the product owner, I want every surface hidden until `activity` is on for me, so that I can preview it before anyone else.
23. As the product owner, I want no message ever rendered as HTML, so that a kudos can't inject script or markup into the website.
24. As the product owner, I want each ticket its own pull request from `main`, so that production gets each piece complete.

## Rules

### What the website reads

- **WS200. Three reads, exactly #232's.** The website calls only the three queries #232's contract defines, with exactly its arguments and answer shapes, and adds no backend read of its own:
  - `getRecentKudos({ direction, limit: 3 })` feeds the last-kudos card (WS205);
  - `getActivity({ filter, cursor, limit: 20 })` feeds the Activity tab (WS212);
  - `getSpotlight({ seed })`, then `getSpotlight({ after })`, feeds the spotlight (WS219), calling again at once on `skipped`.

  Each answers a `Denial` (WS11) or `{ kind: "not-found" }` first. The website's TypeScript types for the answers are imported from `convex/website/`, the way `shell.ts` imports `QuestsAnswer` today, never redeclared. A fact the website needs and the contract lacks is a cross-map need, never derived in `website/`.
- **WS201. The flag shows itself through the reads.** The `activity` flag (PostHog 958437) is read by #232's queries through the member decision (AT37). The website reads no flag and gains no field on `getMyProfile`. Each surface shows only while its own read answers its content kind:
  - while `getRecentKudos` answers `not-found` (or hasn't answered yet), the last-kudos card renders nothing and leaves no gap, as WS108 reserves;
  - while it answers `not-found`, the home shows no `Character`/`Activity` tabs (WS204);
  - while `getActivity` answers `not-found`, `/activity` shows the not-found page (WS1);
  - while `getSpotlight` answers `not-found`, the leaderboard page has no spotlight panel.

  A `Denial` from any of them is already the frame's, because `getMyProfile` answers the same denial first (WS11).
- **WS202. Unknown entry kinds are skipped.** An entry whose `kind` is not `kudosReceived`, `kudosGiven` or `levelUp` is dropped before rendering, with no placeholder and no error. The types make the three known kinds exhaustive in the renderer, and one test feeds an unknown kind through the fixture build.

### The member's page and its tabs

- **WS203. The Activity tab is a page.** The Activity tab is the page `/activity`, its browser tab `HedgeHug · Activity`. The router's `routeAt` gains `/activity`, read with an optional `filter` query (WS212), and `routeList` in `convex/website/routes.ts` gains `/activity` in the same pull request, so SW10's test stays green. Slack's page validator (`pageValidator` in `convex/website/link.ts`) is unchanged: whether Slack links `/activity` is map #1's later choice. A signed-out deep link to `/activity` gets sign-in and returns there (#157).
- **WS204. Two tabs on the member's page.** While `activity` answers on the home (WS201), the top of the home's main column and of `/activity` holds a pair of tabs: `Character` (to `/`) and `Activity` (to `/activity`).
  - They are links in a `nav` labelled `Your page`, styled as Quill's line tabs, and the current one carries `aria-current="page"`. They are not ARIA tabs, because each is its own address.
  - Following one moves in place and focuses the new page's title, as the router's links do since #134.
  - The screen nav keeps `Home` as the current item on `/activity`, because Activity is a tab of the member's page, not a screen of its own. The nav gains no entry.
  - On `/activity` the tabs always show, because the page itself exists only while `getActivity` answers.

### The last-kudos card

- **WS205. Its place.** The card sits in the home's right rail directly under `What teammates see` (WS108's reserved slot) and above the Quests and Leaderboard panels (WS97). The rail is built by the fifth slice's #238 (after #236 and #237), so the card's ticket waits for #238 on `main` and puts the card in the slot it leaves. On narrow screens it follows the rail's order after the main column (WS97).
- **WS206. Its frame.** A plain Quill card (a reading surface, no corner marks, V2) labelled `Recent kudos`, with `Only you see these` and a lock glyph at its right, the leaderboard's private-panel label (WS45). Under the label, a two-way switch, `Received` and `Given`, built as Quill's toggle group with radio semantics (one is always selected, arrow keys move between them). `Received` is selected on every page load; the choice isn't kept.
- **WS207. Its rows.** It reads `getRecentKudos({ direction, limit: 3 })` through the page's own subscription and lists the entries in the read's order, each a row with:
  - **received:** the giver's face (V19) and `{giver} thanked you`;
  - **given:** the first recipient's face, with up to two more stacked behind it, and `You thanked {names}` (WS209's list);
  - the words, clamped to two lines with links shown as text (WS211), with `Edited` after them when edited;
  - when, as a `<time>`: `Today`, `Yesterday` or a short date (`12 Oct`), in the browser's time zone, because this read carries none;
  - no XP, quest, `Said why` tag, channel or Slack link: the card is brief, and the Activity tab holds the rest.

  A row isn't a link. Under the rows, `See all activity` links to `/activity?filter=received` or `/activity?filter=given`, following the switch. It arrives with the page it links to (ticket 2).
- **WS208. Its empty states.** With no entries, the card says, in Max's voice and without a hedgehog:
  - **Received:** `Kudos you receive show here.` It never asks anyone to thank the member (WS101).
  - **Given:** `Kudos you give show here, with what each one earned.`

  `See all activity` still shows once it exists (WS207).
- **WS209. People are named as #232 names them.** Every person shown is a `Person` (`{ name, face }`, AT20): `name` as given (`A teammate` for one who left), `face` through the existing `MemberFace`, initials until the directory's pictures arrive (cross-map need 2). A list of names reads `Ana`, `Ana and Ben`, `Ana, Ben and Cleo`, or `Ana, Ben and 3 others` beyond three, built with `Intl.ListFormat` in the browser's language. On the card and the timeline the member's own role is the entry's kind, so the copy says `you` for them. The spotlight's people carry no identity, so it shows every `Person` exactly as supplied, the member included.

### The kudos message

- **WS210. One renderer, text only.** One component, `KudosMessage`, renders every `Message` on every surface.
  - **Segments become React text and elements, never HTML.** No `dangerouslySetInnerHTML`, `innerHTML` or HTML parsing anywhere on these surfaces. Each segment kind renders as:
    - `text`: its text, inside `strong`, `em`, `s` or `code` for each flag it carries;
    - `person`: `@{name}` as plain styled text, never a link;
    - `group`: `@{handle}` as plain styled text;
    - `channel`: `#channel`, muted, because #232 reads no channel names (AT23);
    - `broadcast`: `@here`, `@channel` or `@everyone`;
    - `emoji`: its `unicode` when present, else `:{name}:` as text (custom emoji images aren't loaded);
    - `link`: on the timeline and the spotlight, a link only when its URL parses with the `http:` or `https:` scheme, opened in a new tab with `rel="noreferrer"` and an `(opens in a new tab)` hint, showing its `label` or else its URL; any other scheme renders the label or URL as plain text. On the card every link segment renders as text, so nothing focusable hides behind the clamp (WS211);
    - `break`: a line break.
  - **`unavailable`** renders one muted italic line instead of words: `deleted` → `This message was deleted in Slack.`, `removed` → `The words of this message were removed.`, `not-captured` → `The words of this kudos are from before HedgeHug kept them.`
  - **`edited`** adds a muted `Edited` after the words.
  - An unknown segment kind renders nothing.
- **WS211. Clamping.** The card clamps the words to two lines with CSS line clamping, so a screen reader still reads them all, and asks `KudosMessage` for text-only links, so no focus target sits in the clipped part. The timeline and the spotlight show the whole message with live links.

### The Activity tab

- **WS212. The page.** `/activity` shows:
  - the tabs (WS204);
  - the label `Activity` and the RoundHog title `Your kudos story`, then one line, `Kudos you received and gave, and the levels you reached. Only you see this page.`;
  - the filter: a toggle group labelled `Show`, with `All`, `Received` and `Given`. It is the address's `filter` query: `all` is canonical with no query, and an unknown value reads as `all`, the way `/leaderboard`'s `period` works (WS37, WS39). Changing it replaces the address, starts the timeline again from its newest page (WS214), keeps focus on the filter, and says `Showing {all activity | kudos you received | kudos you gave}.` in the page's live region;
  - the timeline (WS213).
- **WS213. The timeline.** An ordered list in the read's order (AT16, never re-sorted by the website), with a day heading before the first entry of each day in the answer's `timeZone` (the browser's zone while it is `null`): `Today`, `Yesterday`, then the weekday and date (`Monday, 12 Oct`, and with the year once it isn't this year). A vertical rule joins the entries. Each entry is an `article` labelled by its first line, with its time (`14:05`, a `<time>` in the same zone):
  - **Kudos received** (V14, quiet): the giver's face and `{giver} thanked you`; then the words (WS210); then a quiet line of tags: `Private channel` while the channel's visibility is `private`, and `Said why` while `saidWhy` is `true`; then `Open in Slack` while `permalink` isn't `null` (WS218). No XP or count: the received side never shows numbers (#85).
  - **Kudos given:** up to three recipient faces and `You thanked {names}` (WS209), with `· {n} kudos each` while `kudos` is more than 1; the words; the same tags; then, while `earned` isn't `null`, a quiet `Earned` line with `+{xp} XP` while `xp` isn't `null`, and one `Finished {goal} · +{xp} XP` per quest done (`Journey step:` before a Journey step's goal); then `Open in Slack`. No crate, burst or count-up (V9, V13).
  - **Level-up mark:** a neutral marker on the rule, the level number in RoundHog inside a small ring, and `You reached level {level}`. It is a mark, not a moment: no animation, band or Replay (V10, V12 stay with Slack's deep links).

  Copy never calls a kudos thoughtful, never says the app checked a reason, and never asks the member to send more or to pad a message (P95). `Said why` is the only wording for `saidWhy`.
- **WS214. Pages and freshness.** The timeline is a snapshot the member extends, so nothing moves under a reader or a focused element:
  - **Pages are one-shot reads.** Each page is one `getActivity({ filter, cursor, limit: 20 })` query read once (Convex's `client.query`, not a subscription). The first asks `cursor: null`; each next one asks with the `cursor` the page before it answered. The cursor is a position in AT16's total order, so pages never repeat or skip an entry, even inside one instant (AT18). Shown entries never change or reorder by themselves.
  - **One live watch.** The page also subscribes to `getActivity({ filter, cursor: null, limit: 20 })`. Once the current timeline's first page has been read (never before, and again after each reset), and while the watch holds an entry whose identity (WS215) isn't shown, or a shown entry whose content differs from the shown copy (an edit, a deletion, a removed author), a `Show new activity` button appears above the list, an outline button, never primary, and the live region says `New activity.` once. The watch never inserts or replaces an entry itself. A watch answer that arrives first is kept and compared once the first page lands.
  - **An empty timeline takes the watch directly.** While nothing is shown and the first page has answered, entries the watch gains are shown at once, because there is no place to keep.
  - **`Show new activity`** starts the timeline again from its newest page, as a filter change does, and moves focus to the first entry, or to the empty sentence.
  - **Accepted:** an edit or deletion of an entry older than the newest page shows on the next reset or visit. The card, which is live, and Slack show it at once.
  - The watch ends when the member leaves the page or changes the filter, and a read answered after that is dropped.
- **WS215. Entry identity.** A kudos entry is identified by its `kind` and `key` (AT21: a stable list key, used only to tell entries apart); a level-up by `levelUp`, its `at` and its `level`. The watch's comparison and React's list keys use it.
- **WS216. Loading more.** While the last page answered a `cursor`:
  - **A `Load more` button** always shows after the list, an outline button, never primary.
  - **Infinite scroll:** an intersection observer on the list's end reads the next page once the end comes within one screen of the viewport, unless a read is pending or the last one failed. After a page lands, if the end is still within one screen (a short page, or a page of only unknown kinds), it reads the next one.
  - **While loading,** the button reads `Loading…` with `aria-disabled="true"` (so a focused button keeps focus), and the list shows nothing extra: no skeleton, shimmer or spinner (V8).
  - **When it loads,** the new entries append below, and the live region says `Loaded {n} more.` If the member pressed `Load more`, the page added entries, and focus is still on the button, focus moves to the first new entry's article. Otherwise focus stays where the member put it.
  - **When it fails,** the button reads `Try again`, and the live region says `Couldn't load more. Try again.` Scrolling doesn't retry by itself.
  - **At the end** (`cursor` is `null`), the button is replaced by the closing line `That's the start of your activity.` (focusable with `tabindex="-1"`). If the button had focus when it went, focus moves to that line, never to the page title.

  The website always asks for 20 (AT18 allows 1 to 50).
- **WS217. Empty, first load and first failure.** While the first page loads, the page shows its header, tabs and filter, and the list area says nothing. If the first read fails (on arrival, after a filter change or after `Show new activity`), the list area says `Couldn't load your activity.` with an outline `Try again` that reads the first page again with `cursor: null`; the live region says the same once, and focus stays where it was. With no entries the list says, in Max's voice: `All` → `Your activity shows here once you thank someone or reach a level.`; `Received` → `Kudos you receive show here.`; `Given` → `Kudos you give show here, with what each one earned.`
- **WS218. Open in Slack.** `Open in Slack` is a plain link with an external glyph, opening the entry's `permalink` in a new tab with `rel="noreferrer"`, an `(opens in a new tab)` hint, and an accessible name that says which kudos (`Open in Slack: the kudos from {giver}` or `…: your kudos to {names}`). While `permalink` is `null` there is no link and no placeholder (AT13).

### The spotlight

- **WS219. The draw.** Each draw is one `getSpotlight` query read once, not a subscription, so the panel never changes without a press:
  - On each mount of the leaderboard page's board (`getLeaderboard` answered `board`), the page picks one `seed` with `Math.random()` and reads `getSpotlight({ seed })`.
  - `Next` reads `getSpotlight({ after })` with the `after` of the kudos shown, holding the shown kudos until the new answer, so the panel never blanks.
  - **`skipped`** is read again at once with its own `after`, showing nothing new in between (AT32: a member's leaderboard opt-out is still being applied). One press or mount reads at most 10 `skipped` answers in a row; past that the attempt stops and keeps the last `skipped` cursor as its **resume point**.
  - **A stopped or failed attempt** (10 skips, or an error): after `Next`, the shown kudos stays, the live region says `Couldn't find another thank-you. Try again.`, and the next press of `Next` reads from the resume point when there is one (else from the shown kudos's `after`). On mount, the panel shows Max's line `Couldn't find a thank-you just now.` with an outline `Try again`, which reads from the resume point, or with a fresh `seed` after an error. A `kudos`, `empty` or `not-found` answer clears the resume point.
  - The spotlight is never drawn on the locked, ready or not-found leaderboard pages, and a read answered after the page unmounts is dropped.
  - **Accepted:** a shown kudos deleted in Slack keeps its words in the open panel until `Next` or a reload (cross-map need 5).
- **WS220. The panel.** While the last draw answered `kudos`, the top of the board's side column (above `Only you see these`, WS45) holds a plain Quill card (a reading surface, V2) labelled `A thank-you from your workspace`, with:
  - the giver's face, then `{giver} thanked {names}` (WS209, every person as supplied);
  - the whole message (WS210), set a little larger than body text as a quote, with `Edited` when edited;
  - its date in the browser's zone (`12 Oct`) and `Open in Slack` while `permalink` isn't `null` (WS218);
  - one outline `Next` button.

  On narrow screens it follows the board, where the side column goes (WS45). It shows no XP, rank, count or `Said why` tag: every drawable kudos said why (AT31), and the board never ranks received kudos (WS46).
- **WS221. Next, and never by itself.** `Next` is the panel's only control. There is no timer, carousel or auto-rotation (V8, WCAG 2.2.2). After a press, the message area (a polite live region, `aria-atomic`, live only after the first press) announces the new thank-you; when the answer's `after` equals the one shown, because only one kudos qualifies, it says `That's the only one so far.` instead. While the next answer loads, `Next` is `aria-disabled`.
- **WS222. Empty.** While the draw answers `empty`, the panel shows Max's line `Thank-yous from public channels show here.` and no `Next`. The spotlight fills only from kudos captured live in public channels that said why, never from the backfill (AT36), so a new workspace, and production right after #232 ships, start empty. While `getSpotlight` answers `not-found`, there is no panel and no gap. The product owner's "Rotate or Next" is the one `Next` button.

### Look, accessibility and order

- **WS223. The look and the checks.** WS23, WS24, WS54 and WS75 hold for every new state:
  - **Look:** reading surfaces stay plain (V2). Primary appears nowhere on these surfaces, except the tabs' and the toggle groups' current item (V4). Numbers use tabular figures (V5). The level mark's numeral is RoundHog (V5). Faces follow V19. Every colour is a theme token in light and dark (V7).
  - **Motion:** none. Pages, loaded entries and spotlight changes appear at once, for everyone. That already meets reduced motion (V11).
  - **Phones:** at 390 px the rail card, the timeline and the spotlight fit without horizontal scrolling, long words and URLs wrap (`overflow-wrap: anywhere`), and touch targets are at least 24 by 24 px (WCAG 2.5.8).
  - **axe:** every state passes axe in light and dark: the card in both directions and empty, the timeline with all three kinds, each `unavailable` reason, an edited message, a private channel, a null permalink, loading, failed and ended, and the spotlight with one and with a changed entry.
  - **Keyboard:** the path covers the tabs, the card's switch and `See all activity`, the filter, every `Open in Slack`, `Show new activity`, `Load more` and its focus move, and `Next`.
  - **Manual pass:** focus order, focus visibility, screen-reader wording of the live regions, and reduced motion, on both modes and a phone width.
  - **Fable spot-check:** before a UI ticket's pull request leaves draft, its worker runs one design review with `delegate_task` (`providerInstanceId: claudeAgent`, model `claude-fable-5-1`) on the ticket's light, dark and phone screenshots, fixes what holds, and records the rest with a reason in the pull request.
- **WS224. A message never becomes markup.** The website's component spec gains the invariant *a kudos message renders as text* (WS210): crossing `domain -> browser`, witnessed by rendering a message whose text segments hold `<script>`, `<img src=x onerror=…>` and an HTML entity, and whose links use `javascript:` and `data:` URLs. The test asserts the DOM holds those strings as text, no `script` or `img` element exists, and no `href` has a scheme other than `http:` or `https:`.
- **WS225. Each ticket is its own pull request from `main`.** Production is live (#57 Notes), so this slice has no integration branch, as the fifth slice (WS113). Each ticket branches from `main`, merges to `main` after review with a green gate, and is complete when it merges. Its proof is a local run in light and dark before the merge, and a read-only check of the live site after its deploy, never writing production data or changing a flag. Every ticket also waits for map #1's #232 ship on `main` (WS226).
- **WS226. After #232's ship.** The three reads, their types and the `activity` flag's declaration reach `main` only with map #1's #232 ship. No ticket of this slice starts before that ship has merged to `main`.
- **WS227. No new flag.** Every surface rides `website` (the whole site) and `activity` (958437, through the member decision, AT37), which #232's reads check. The website creates and changes no flag. `activity` stays sandbox-only until the product owner adds his own email to it to preview (#204, F15) and then switches it for everyone.

## Implementation Decisions

### Modules

- **Website package (extended, `website/`):**
  - `route.ts`: `/activity` with its `filter`, and `activityHref(filter)`, the way `leaderboardHref` works.
  - `activity/KudosMessage.tsx`: the one renderer (WS210), with `People.tsx` for faces and name lists (WS209). Deep: every surface hands it a `Message`, and it alone knows segments, schemes and unavailable copy.
  - `activity/timeline.ts`: the timeline as a pure reducer over explicit state, owning the pages read, the next cursor, the load status and who asked, the watch's comparison (`Show new activity`), entry identity and the end (WS214–WS216). It knows nothing of React or Convex, so its tests drive it with plain answers.
  - `activity/useTimeline.ts`: the hook that runs the reducer, issues the one-shot reads and the watch through the functions the app hands it, and drops answers that arrive after a reset or unmount.
  - `home/RecentKudosCard.tsx` (WS205–WS208), `home/MemberTabs.tsx` (WS204), `pages/ActivityPage.tsx` (WS212–WS217), `leaderboard/Spotlight.tsx` (WS219–WS222).
  - `App` gains two live hooks and two one-shot readers as props, the way it takes `useLeaderboard` and `useQuests` today, so the fixture build and the tests drive them: `useRecentKudos(direction | undefined)`, `useActivityWatch(filter | undefined)`, `readActivity(args)` and `drawSpotlight(ask)`. `LiveApp` implements the hooks with memoized `useQueries` requests (the live shell's lesson from ship #138) and the readers with `useConvex().query`.
  - `shell.ts` re-exports the answer types from `convex/website/` and gains their fixtures.
- **Website module (`convex/website/`):** `routes.ts`'s `routeList` gains `/activity`. Nothing else: the reads are #232's.
- **Map #1's modules:** no change. The activity module, the kudos text and the reads are #232's.

### Contracts

```ts
// website/src/route.ts (extended)
export type ActivityFilter = "all" | "received" | "given";
export type Route = /* today's routes */ | { page: "activity"; filter: ActivityFilter };
export function activityHref(filter: ActivityFilter): string; // "/activity" for all, else "/activity?filter={filter}"

// convex/website/routes.ts (extended)
export const routeList: readonly string[] = ["/", "/leaderboard", "/quests", "/activity"]; // plus /skills and /book once ship #193 lands

// The answers, imported from #232's convex/website/ modules (names as #232 ships them)
type RecentAnswer = RecentKudos | { kind: "not-found" } | Denial;
type ActivityAnswer = Activity | { kind: "not-found" } | Denial;
type SpotlightAnswer = Spotlight | { kind: "not-found" } | Denial;

// website/src/App.tsx (extended props)
useRecentKudos: (direction: "received" | "given" | undefined) => RecentAnswer | undefined;          // live
useActivityWatch: (filter: ActivityFilter | undefined) => ActivityAnswer | undefined;                 // live, cursor null, limit 20
readActivity: (args: { filter: ActivityFilter; cursor: string | null }) => Promise<ActivityAnswer>; // one-shot, limit 20
drawSpotlight: (ask: { seed: number } | { after: string }) => Promise<SpotlightAnswer>;              // one-shot

// website/src/activity/timeline.ts
export type EntryId = string; // "{kind}:{key}" or "levelUp:{at}:{level}" (WS215)
export type TimelineState = {
  filter: ActivityFilter;
  entries: ActivityEntry[]; timeZone: string | null;
  cursor: string | null;                              // the next page's, from the last page read
  status: "first" | "idle" | "loading" | "failed" | "end";
  askedBy: "button" | "scroll" | null;                // decides focus (WS216)
};
export type TimelineEvent =
  | { kind: "reset"; filter: ActivityFilter }
  | { kind: "asked"; by: "button" | "scroll" }
  | { kind: "read"; answer: Activity }
  | { kind: "failed" };
export function timeline(state: TimelineState, event: TimelineEvent): TimelineState;
export function hasNewActivity(state: TimelineState, watch: Activity | undefined): boolean; // WS214
```

`undefined` from a hook means "not asked" or "not answered yet". The fixture build answers from typed fixtures with the same shapes.

### Data

No table, migration or backend write. The browser keeps only the chosen direction, the filter (in the address), the timeline's entries and next cursor, and the spotlight's shown `after`, all in the page's memory.

### The flags

| Flag | Owner | Subject | Gates on the website | State |
|---|---|---|---|---|
| `website` | this map ([957148](https://us.posthog.com/project/662840/feature_flags/957148)) | member decision once #204 ships | the whole site | on in production |
| `activity` | map #1 ([958437](https://us.posthog.com/project/662840/feature_flags/958437)) | member decision (AT37) | the card, the tabs, `/activity` and the spotlight, through #232's reads | sandbox-only; the product owner previews it by email (F15) |

The website creates no flag (WS227).

### Coherence

Proposed declarations; each ticket writes its part and makes `coherence spec --check` pass.

- **Entrances:** none new on the website's backend. #232 declares `query getRecentKudos`, `query getActivity` and `query getSpotlight` in `convex/website/WebsiteReads.spec.md`.
- **Website component spec (`website/Website.spec.md`):**
  - *A kudos message renders as text* (WS224), new, ticket 1.
  - *The website shows activity only while its read answers* (WS201): with `activity` off, no card, no tabs, no spotlight, and `/activity` reads not found. Ticket 1 for the card, extended by tickets 2 and 3.
  - *Received stays private* is witnessed again: received kudos appear only on the member's own home and `/activity`, and the spotlight shows only #232's drawable kudos.
- **Lexicon:** `kudos text`, `activity`, `permalink` and `spotlight` are declared by #232's ship. The website's copy and code use them. No new term.
- **Journal:** each ticket records its decisions with `coherence decide` and commits the journal with the change.

## Testing Decisions

- **A good test enters at a seam and checks what a member could observe:** the rendered page, its words, links, focus and live-region text, from the read's typed answers. It never tests private helpers, except `timeline` and `hasNewActivity`, which are the timeline's interface.
- **Seams, highest first:**
  1. **The browser package with Vitest and Testing Library, through `App` and the fixture hooks:** the card in both directions, empty and not-found; the tabs on `/` and `/activity` with `aria-current`; `/activity`'s filter and address; each entry kind with each tag, `earned` with and without XP and quests, each `unavailable` reason, a null permalink, an unknown kind skipped; the card's links rendered as text; day headings in a fixture time zone across a midnight; `Load more` by button (focus moves) and by scroll (focus stays, with a stubbed `IntersectionObserver`), loading, failure, a page of only unknown kinds, and the end with focus moving from the button to the closing line; a failed first page and its `Try again`; a pending `Load more` the member tabbed away from, keeping their focus; `Show new activity` for a new entry, a changed entry and a new entry inside the newest instant; the spotlight with `Next`, `skipped` followed at once, ten skips and the resume point on the next press and on the mount's `Try again`, the same `after` twice, `empty`, a failed draw and not-found; and axe in light and dark for every state (WS223).
  2. **`timeline` and `hasNewActivity`:** pages appended in order with each next cursor; a reset dropping everything; a failure and its retry; the end; `askedBy` for focus; the watch raising new activity for an unseen identity (also one sorting after the shown head inside one instant), for a changed shown entry, and never for an identical one; an empty timeline taking the watch; no comparison before the first page of the current generation lands.
  3. **The text invariant (WS224),** through `KudosMessage` and through a whole timeline page.
  4. **SW10's route test**, with `/activity` in both lists.
- **Prior art:** `website/src/LeaderboardPage.test.tsx` (periods in the address, focus on navigation), `website/src/QuestsPage.test.tsx`, `website/src/accessibility.test.tsx`, `website/src/liveShell.test.tsx` (the real hooks over a fake watch), `website/src/routeList.test.tsx`.
- **Proof each ticket owes:**
  - a red test before the change and a green one after;
  - `pnpm gate` green, heavy runs through `~/dev/fleet/fleet heavy --`;
  - screenshots of the running site in light, dark and at a phone width, from a disposable local backend on its own ports (6510/6511) with synthetic data and `activity` on through a recorded local override, and the manual pass (WS223);
  - the Fable 5.1 spot-check, its findings fixed or answered (WS223);
  - after the deploy, a read-only check that production serves the shell and that `/activity` reads not found while `activity` is off there.

## Slices

Each ticket is a sub-issue of map #57 and its own pull request from `main` (WS225). Each waits for map #1's #232 ship on `main` (WS226). Casting: Opus 5.5 (high) to build, GPT-6.1 Sol (high) to review, and a Fable 5.1 design spot-check before a UI ticket leaves draft (WS223).

Blocking edges (native on GitHub): ticket 1 → tickets 2 and 3; tickets 2 and 3 → ticket 4.

1. **The last few kudos on the home.** `KudosMessage` and `People` with the text invariant, `useRecentKudos` in `App`, `LiveApp` and the fixtures, and the `Recent kudos` card with its switch, rows and empty states, in WS108's slot. `See all activity` waits for ticket 2, so the card never links to a page that doesn't exist yet. WS200–WS202, WS205–WS211, WS223, WS224. Blocked by #238 (the fifth slice's right rail, which leaves the slot), and by #232's ship on `main`.
2. **The Activity tab: the timeline with infinite scroll.** `/activity` in `routeAt` and `routeList`, the `Character`/`Activity` tabs, the card's `See all activity`, the filter, the `timeline` reducer, `useActivityWatch` and `readActivity`, the three entry kinds with day headings, `Open in Slack`, `Load more` with infinite scroll and focus, `Show new activity`, and the empty states. WS200–WS204, WS207, WS212–WS218, WS223. Blocked by ticket 1 and #232's ship on `main`.
3. **The spotlight on `/leaderboard`.** `drawSpotlight`, the seed per board mount, `skipped` followed at once, the panel at the top of the side column, `Next` and its live region, the empty panel and failed draws. WS200, WS201, WS219–WS223. Blocked by ticket 1 and #232's ship on `main`.
4. **Prove the activity feed on the sandbox.** Deploy `main` to `different-dog-467` (the shared sandbox's rules 1 and 2), sign in with a proof session, give and edit and delete kudos through signed Slack-shaped requests, and record, in light and dark and at a phone width: the card both ways, the timeline with all three kinds and loading more, a deleted message, and the spotlight with `Next`. Check that production's `activity` answers off and the surfaces are hidden there. Hand the product owner the one switch he owns: add his email to `activity` to preview. Blocked by tickets 2 and 3 and #232's ship on `main`.

## Cross-map needs on map #1

This spec edits nothing on map #1. Map #1's conductor reads these from #57.

1. **#232's ship tells this map when it merges to `main`,** with the module paths and exported type names of the three reads' answers, so ticket 1 imports them.
2. **Faces for other members.** `Person.face` is initials until the directory keeps Slack pictures (map #1's #234); AT20 moves it there in the same follow-up as the leaderboard's. The website renders whatever `Face` carries, so no website change is needed when it lands.
3. **`/activity` on Slack's route list.** `routeList` gains `/activity` in ticket 2. Map #1 may link it (for example from a level-up DM or the success reply) whenever it likes; until `activity` is on for a member, the page reads not found.
4. **Copy follows #209.** If spec #209 changes what "said why" means, the website's `Said why` tag keeps reading `saidWhy` as #232 answers it; only the wording would follow, in a ticket.
5. **A pinned spotlight read, later.** A `getSpotlight({ pinned: after })` that answers the shown kudos while it stays drawable would let the panel drop a kudos deleted in Slack at once, without moving by itself. Not needed now (WS219 accepts the gap until `Next`); worth adding if the product owner asks for live updates.
6. **Quests on earlier kudos.** `questsDone` lists only quests a kudos finished after #232 shipped, and `earned.xp` is the gains line's base XP. The timeline shows exactly that and promises nothing for earlier entries.

## Out of Scope

- Posting the week's random top three messages (the product owner: "Don't build this feature").
- Other members' activity, and any action on an entry (reacting, replying, hiding).
- Unlocks opened, tiers earned and quests finished outside a kudos as timeline marks, until #232 adds those kinds (AT15); the timeline skips unknown kinds meanwhile.
- Channel names, custom emoji images, and search within the timeline.
- Restoring the timeline's scroll position on back navigation.
- Auto-rotating the spotlight, and showing it on the home.
- Anything #57 rules out of scope, and game rules in the website.

## Further Notes

**The product owner's decisions, verbatim** (2026-10-14, relayed through map #1):

1. "And one important feature of the Mist is an activity feed or something where it lists briefly the last few kudos someone received, and you can switch over to Given. Then you can go deep into a tab on your page to see your activity feed: the kudos you've received, with the nice message and deep link to Slack, and also the kudos you've given, noting the experience and so on. Maybe like a timeline view where you can also see your level-up marks in this infinite-scroll timeline. Make it nice. Use Opus 55. Just Fable for spot check, and then I will iterate as we go when it's deployed." ("the Mist" is the website; "Opus 55" is Opus 5.5.)
2. "We should maybe change this and actually store the messages with a link to check if they've been edited, so that we can also show a nice random message on the leaderboard page and also allow posting us the random top three messages in a week or something. Don't build this feature. Store the message text and add a random message to the leaderboard as well, where you can click Rotate or Next. I revert my decision to not store any kudos messages. Any other messages that don't match the kudos one should not be stored."

**Calls taken at recommendation** under the AFK directive (journal ids in #233's resolution):

1. **The Activity tab is its own page, `/activity`**, with `Character`/`Activity` link tabs on the member's page, over ARIA tabs inside `/`: each tab has an address Slack and a browser can return to, and the router, SW10's list and focus-on-navigation already work per page.
2. **The website reads no flag**: each surface shows while its read answers, over a new `getMyProfile.activity` field. #232's reads already answer `not-found` while `activity` is off, so a second answer could only disagree.
3. **Three entries on the card**, over the contract's default of five: the rail is narrow, and "briefly" is the product owner's word. The card shows no XP, tags or links; the tab holds them.
4. **The timeline is a snapshot of one-shot page reads plus one live watch of the newest page, with `Show new activity` instead of live insertion**, over fixed-cursor subscriptions per page (an entry pushed out of the live first page loses its source, review round 1) and over Convex's paginated hook (the contract's cursor is its own): entries never move under a reader or a focused element, and the cost is that an older entry's edit shows on the next reset.
5. **Infinite scroll plus an always-visible `Load more`**, over scroll alone, so keyboard and screen-reader members can load more and focus is placed only when they asked.
6. **One `Next` button and no auto-rotation**, reading the product owner's "Rotate or Next" as one control: moving content violates V8 and WCAG 2.2.2.
7. **The spotlight sits at the top of the board's side column**, over above the board: the board stays the page's subject, and the thank-you is the first thing beside it.
8. **`Said why` shows as a quiet tag on timeline entries, never on the card or the spotlight**, because AT24 allows it, it explains why one kudos earned more than another, and every spotlight kudos said why.
9. **Links in messages open only for `http:` and `https:`**; every other scheme is text. Person and group mentions are never links. The card shows every link as text, so the clamp hides no focus target (review round 1).
10. **Each ticket is its own PR from `main`** (production is live), and the card waits for #238 so it lands in WS108's slot, over placing it under today's profile card first (the conductor's instruction).
11. **A sandbox proof ticket** closes the slice, as every earlier slice did, because `activity` is off in production and only the sandbox can show it running.
12. **Spotlight draws are one-shot reads, not subscriptions** (review round 1): a subscribed `seed` draw changes answer when a new kudos lands between the seed and the shown one, which would rotate the panel without a press. A deleted shown kudos keeps its words until `Next` (cross-map need 5).
13. **`skipped` is followed at once, up to 10 times per press**, then the attempt stops and the next press resumes from the last `skipped` cursor (review round 2), so a stuck opt-out job can never loop the page and a long run of skipped rows is still walked through.
14. **The empty spotlight shows Max's line, not nothing**, because it fills only from live public kudos (AT36): Michael's first preview in production is likely to be empty, and an empty panel tells him why.
