# Spec: the website's seventh slice, every gap to the accepted prototype

> **Accepted on 2026-10-14 under the product owner's autonomous directive** (map [#57](https://github.com/Silthus/kudos/issues/57) Notes: "ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags"), with every open call at its recommendation (listed under "The calls"). Ticket [#265](https://github.com/Silthus/kudos/issues/265). This file lives on the branch `docs/spec-website-7` and is never merged. Its rules continue the earlier slices': `WS1`–`WS28` in [`spec/website.md`](https://github.com/Silthus/kudos/blob/docs/spec-website/spec/website.md), `WS29`–`WS54` in [`spec/website-2.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-2/spec/website-2.md), `WS55`–`WS77` in [`spec/website-3.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-3/spec/website-3.md), `WS78`–`WS96` in [`spec/website-4.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-4/spec/website-4.md), `WS97`–`WS114` in [`spec/website-5.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-5/spec/website-5.md) and `WS200`–`WS227` in [`spec/website-6.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-6/spec/website-6.md). All still hold except where a rule below names the one it changes.
>
> Sources: the product owner's request of 2026-10-14 ("Can you please make sure that it truly looks like the prototype and you're not leaving out stuff?"); the audit [#259](https://github.com/Silthus/kudos/issues/259) ([report](https://github.com/Silthus/kudos/blob/research/prototype-fidelity/research/prototype-fidelity/README.md) at `88fef01`: 340 rows, groups F1–F24, decision queue C1–C12), which is this spec's inventory; the accepted prototype #62's variant E (`prototype/website-ui` at `3409ade`); the code on `main` at `2fe2a5a` and on `spec/website-4` at `97b8534` (ship #193, in flight); the visual language V1–V24; and map #1's progression spec of record (`docs/spec-progression-v2`).

## Problem Statement

The product owner opened the live website and asked whether it truly looks like the prototype they accepted. It doesn't. The #259 audit compared every reachable screen, panel, control and moment of variant E with `main` and with the fourth slice: of 340 elements, 97 are present, 16 are coming in open tickets, 11 are cut by a decision the product owner made in words, and 216 are missing.

Most of the missing elements were dropped by rules the website's own specs wrote: the nav shows open pages only (WS59), the board has no "show 5 more" (WS43), Swap and the leaderboard setting stay in Slack (WS46, WS73), the Book has no categories or totals (WS92), and so on. The product owner never asked for those drops. The rest wait for game features map #1 hasn't shipped yet: coins, the inventory, hedgehogs, groups, the sticker albums, the rest of the skill tree and the tier rewards. Unshipped is not the same as cut.

There is also one defect. With all five pages open, the header is 422 px wide on a 390 px phone, so the whole page scrolls sideways.

## Solution

**Restore variant E.** Every element the audit lists as missing returns, except the 11 cuts that carry the product owner's own words (D1–D6 in the audit), and except the prototype's own tooling (C12).

- **The defect first:** the nav becomes a scroll rail on narrow screens, so the header never overflows (WS300).
- **What `main` can show today, most visible first:** the full HUD nav with locked, ready and next entries; the command palette; the standalone sign-in card and the display-size titles; quest art, `Claim` and quest links; the Journey as the bonus quest on `/quests`; `Show 5 more` on the board; the routed locked and ready pages and the richer reveal.
- **Two writes move to the web:** Swap on `/quests` and `Show me on the leaderboards` on `/leaderboard`. Each is a D17 command behind `memberMutation`, exactly like the commands already on the website, and never runs a launch (WS335).
- **After ship #193:** the compact skill tree with its legend and counts, and the Book with its page index, category pages, ladder details and overview.
- **After map #1 ships their facts:** the hedgehog avatar, the character panel and inventory, the collection, the public card's group and medals, group boards and the group quest, the rest of the skill tree, the sticker albums and the tier rewards. Each has a published ticket that names the exact read or command it needs from map #1. The moment pages with no planned facts stay in the fog (Cross-map needs).

Each ticket is its own pull request from `main`, because production is live. No new flag is needed: each piece rides the flags that already gate its facts (WS337).

## The calls

The audit put twelve questions to the product owner. Each is taken at its recommendation under the AFK directive, and each is recorded so the conductor can flip it if the product owner answers otherwise. "Restore" means port variant E's element; an agent-written WS, V or P rule alone doesn't cut anything.

| Call | Taken at recommendation | Rules | Flipping it means |
|---|---|---|---|
| **C1** HUD discoverability | Restore E: locked, ready and next nav entries; `Profile` with its user icon; icon-only entries at intermediate widths; the mobile rail with a selected pill; the avatar links to the profile; a separate `Sign out`; the header's shadow; a one-off pop-in. Sign-out stays reachable at every width, where E hides it below `md`. | WS300–WS304 | Drop WS301's locked and ready entries, keep `Home` and the account menu. |
| **C2** Palette | Build E's palette on the real route list and read gates, with E's playful replies where their copy is still true. | WS305–WS308 | Drop the palette ticket, or drop WS307 only. |
| **C3** Sign-in | Restore E's standalone card with the hand-clasp hedgehog, the full-width button and the landing hint. The copy names only what every member has. | WS309 | Keep the current BrandSays page. |
| **C4** Retained game features | The round-9 kept list stands: coins, gear, hedgehog avatars, groups and boards, profile medals, sticker albums and tier rewards are dependencies, not cuts. | WS340–WS347 | Close the cross-map tickets for whichever the product owner cuts. |
| **C5** Home shape | Restore E's open hero, the first-kudos nudge and the hero's `Spend skill points`, beside #237's panels. The hero keeps #236's invitation, because E's nudge says the same thing. | WS311–WS313 | Drop WS311–WS313's ticket. |
| **C6** Quests | Restore quest hedgehogs, `Claim` and the claimed card. The group quest's helper row stays anonymous: P82's "counts, never names" stands until the product owner changes it in words. | WS314–WS316, WS344 | Drop the art and keep `Open`; or let map #1 supply helper names. |
| **C7** Board controls | Restore `Show 5 more` now. Rank-change arrows wait for a map #1 read of last week's rank (WS344). | WS320 | Keep the whole board only. |
| **C8** Writes | Swap and leaderboard visibility get web commands through D17, like Slack's. Equip and Buy follow the same rule when their facts ship. | WS318, WS321, WS335 | Keep both in Slack and drop those two tickets. |
| **C9** Skill tree | Restore the owned count, the page's resource chips, the legend, compact nodes and a strong `Can buy` outline (in the foreground colour, because D2 keeps primary for one next action). Perk copy stays P94's, word for word, never E's mock effects. Later rows wait for their facts (WS345). | WS326–WS330 | Keep slice 4's wide neutral nodes. |
| **C10** Book | Restore the page index, categories, overview totals, the closest next tier, the recently earned shelf, rosettes and the ringed `Next` cell (neutral, per D2). Paper styling is for the albums only; achievement cards stay plain Quill cards (V2). Named album gaps wait for #54's read and stay a question for the product owner. | WS331–WS334, WS346 | Keep slice 4's flat list; drop WS334. |
| **C11** Moments | Keep delivering in stages. The standalone moment pages return as their facts ship: the hedgehog reveal with hedgehogs, the achievement page with tier rewards. Level-up, kudos and App Home tour pages are fog until map #1 plans their facts. Motion stays one-off, never looping (D1). | WS325, WS339 | Replace the moment pages with `/activity` and `/quests` for good. |
| **C12** Prototype tooling | The level scrubber, the variant picker, the moment picker and the fake sign-in footer stay out of production. | WS338 | none |

## The gap groups

Each audit group, its verdict and its ticket. **Now** builds on `main`. **After #193** waits for the fourth slice's ship. **Cross-map** waits for map #1. **Fog** has no planned map #1 facts yet. Ticket numbers are in Slices.

| Group | What it ports | Verdict | Rules | Ticket |
|---|---|---|---|---|
| F0 | Description and social metadata | Not a prototype gap (neither has it). No ticket. | — | — |
| F1 | HUD nav and mobile layout | **Now.** The overflow defect alone first. | WS300–WS304 | 1, 2 |
| F2 | Command palette | **Now.** | WS305–WS308 | 3 |
| F3 | Sign-in card and title sizes; the hero's open shape | **Now**; the hero part after #238. | WS309–WS313 | 4, 5 |
| F4 | Equipped hedgehog avatar | **Cross-map** (#96) | WS340 | 16 |
| F5 | Character panel and slot picker | **Cross-map** (#31, #96) | WS341 | 18 |
| F6 | Inventory, equipment and prices | **Cross-map** (#30, #31) | WS341 | 17, 19 |
| F7 | Hedgehog shelf | **Cross-map** (#96) | WS342 | 20, 21 |
| F8 | Public card's group and medals | **Cross-map** (#53, #52) | WS343 | 22 |
| F9 | Quest art, `Claim`, quest links; Swap on the web | **Now.** Coin, emoji and hedgehog rewards are cross-map (WS348). | WS314–WS316, WS318, WS319, WS348 | 6, 7, 31 |
| F10 | Group quest | **Cross-map** (#52) | WS344 | 25 |
| F11 | Fresh-unlock bonus quest | **Now**: map #1's progression call 2 made the Journey the bonus quest chain, and its facts are on `main`. | WS317 | 8 |
| F12 | Group boards and full home standings | **Cross-map** (#52) | WS344 | 23, 24 |
| F13 | `Show 5 more` and the visibility switch | **Now** | WS320–WS322 | 9, 10 |
| F14 | Compact perk tree and legend | **After #193** | WS326–WS330 | 12 |
| F15 | Later perk rows, upgrades and the ledger | **Cross-map** (#30, #39) | WS345 | 26, 27 |
| F16 | Book index and categories | **After #193** | WS331, WS332 | 13 |
| F17 | Ladder details and overview; tier rewards | **After #193**; rewards cross-map (#30, #31, #96) | WS333, WS334, WS347 | 14, 15, 30 |
| F18 | Sticker albums | **Cross-map** (#54) | WS346 | 28, 29 |
| F19 | Routed locked and ready pages, the richer reveal | **Now**. The standalone unlock page (E303) is fog. | WS323–WS325 | 11 |
| F20 | Level-up band page | **Fog**: no planned read | — | — |
| F21 | Achievement earned page | **Cross-map** (tier rewards) | WS347 | 30 |
| F22 | Received-kudos and quest pages | **Fog**: no planned event read; `/activity` and `/quests` serve meanwhile | — | — |
| F23 | New-hedgehog reveal | **Cross-map** (#96) | WS342 | 21 |
| F24 | App Home tour page | **Fog**: needs a map #1 link | — | — |

**Coming elsewhere, not repeated here:** the panels in place (#237), the right rail (#238), the recent-kudos card, `/activity` and the spotlight (#248–#251), and the skill tree and the Book themselves (#193). Where this spec reaches into their files, Slices names it.

## User Stories

**Finding my way**
1. As a member, I want the nav to show every page I can reach, the ones still locked with their level, and the ones ready with their crate, so that I know what's coming and where it will be.
2. As a member on a phone, I want the header to fit my screen, so that the page never scrolls sideways.
3. As a member who uses the keyboard, I want a command palette, so that I can jump to any page, change the theme or sign out without the mouse.
4. As a member who followed a link from Slack, I want the sign-in page to tell me where I'll land, so that I trust the link.

**Quests**
5. As a member, I want each quest to show its picture and a clear `Claim` once I've finished it, so that the page reads at a glance.
6. As a member, I want to swap a quest on the website, so that I don't have to go back to Slack for it.
7. As a member, I want my Journey's next step on the quests page as a bonus quest, so that all my quests are in one place.

**The leaderboard**
8. As a member, I want to see five more rows above or below me without opening the whole board, so that I can look around my spot.
9. As a member, I want to switch myself on or off the leaderboards on the website, so that I control my visibility where I see the board.

**Locked, ready and moments**
10. As a member below a feature's level, I want its page to show the feature's picture, its level and one sentence, so that I know what it is without being pushed.
11. As a member who opens a crate, I want to see what the feature holds and open the next ready one straight away.

**The skill tree and the Book**
12. As a member, I want the skill tree to show how many perks I own, a legend and compact nodes, so that the tree reads like the one I saw.
13. As a member, I want the Book split into categories with an overview of what I've earned, so that I can find a ladder fast.

**Later, with map #1's features**
14. As a member, I want my equipped hedgehog as my avatar, my gear and inventory, my hedgehog shelf, my group on my card, group boards, the group quest, every perk, my sticker albums and my tier rewards, each as soon as its feature ships.

**Running it**
15. As the product owner, I want each change to land in production as soon as it is complete and proven, so that the site catches up with the prototype step by step.
16. As the product owner, I want the website never to run a launch or decide a game rule, so that the web never does more than Slack.

## Rules

Rules continue the activity slice's numbering, from `WS300`.

### The HUD (F1, C1)

- **WS300. The header never overflows.** At every viewport width from 320 px, with every nav entry the member can have, the ready pill, the chips, the avatar, the theme control and `Sign out`, the document's `scrollWidth` equals the viewport width.
  - Below `lg`, the nav is its own row under the bar: a horizontal scroll rail (`overflow-x-auto`) that never wraps, with its entries in one line.
  - Below `sm`, the bar itself is compact: the wordmark shows the logo alone (the name stays its accessible name), the theme control is one button that cycles light, dark and system with its current choice in its name, and the chips show their glyph and number only. If the controls still don't fit beside the logo, they wrap to a second row of the bar, right-aligned; nothing is clipped or hidden.
  - On load, the rail scrolls the current entry into view without animation.
  - The rail is not a focus trap: Tab moves through its entries in order, and each focused entry scrolls into view.
  - This fixes the defect the audit measured (422 px at 390 px with five pages open), which `spec/website-4`'s two new entries cause.
- **WS301. The nav lists every shipped feature with a page, in schedule order.** This changes WS59. While unlocks apply, the nav shows `Profile` (WS302), then each feature in `getMyProfile.features` that has a web page, in Unlocks' schedule order, in its state:
  - **open:** a link to its page, as today;
  - **ready:** a button showing the crate glyph and the feature's name, named `{name}: unlock ready. Open its crate`, which opens that feature's crate through `openFeature` and the reveal, exactly as the home's crate does (WS65–WS67);
  - **locked:** not a link. A focusable entry with the lock icon and the name, `aria-disabled="true"`, named `{name}, locked. Unlocks at level {level}`, with the tooltip `Unlocks at level {level}`. The first locked entry in schedule order is the next unlock: it also shows a neutral `Lv {level}` badge, and its tooltip starts `Next unlock · {name}`. Other locked entries are muted.

  Locked entries never show progress, a bar or levels to go (D3). A feature that hasn't shipped has no entry, because it has no facts (P78), and that is not a cut. While unlocks don't apply (`features` is `null`), the nav is today's (WS59's fallback through `getMyProfile.leaderboard`).
- **WS302. Labels and widths.**
  - The first entry reads `Profile` with the user icon and links to `/`. The tab reads `HedgeHug · Profile`, and every `Go to Home` action reads `Back to your profile`. This changes WS16's and WS37's `Home` and WS204's "the screen nav keeps `Home` current", which now keeps `Profile` current.
  - From `xl`, entries show their icon and label. From `lg` to `xl`, they show the icon only, with the label as the accessible name and a tooltip.
  - Below `lg` (the rail of WS300), entries show icon and label, and the current entry is a filled round pill instead of the underline (E013). From `lg`, the current entry keeps the primary underline.
- **WS303. The right of the bar.** In order: the palette chip (WS305), the skill point chip (WS84), the coins chip when coins ship (WS341), the ready pill (WS68), the avatar, the theme control and `Sign out`.
  - **The avatar** links to `/` and is named `{name}, level {n}` (`{name}` without a level while `progression` is `null`). It keeps WS99's ring.
  - **`Sign out`** is its own outline icon button (the leave icon), named `Sign out`, at every width, so signing out never depends on the keyboard-only palette. It does what the account menu's item does today. The account menu goes.
  - **The header** gains E's one-pixel bottom shadow (E026).
- **WS304. A one-off pop-in.** When `openFeature` answers `opened` in this browser tab, the new nav entry and any chip it brings pop in once, as E's `PopIn` does. Never on an ordinary visit or a reload, and never under reduced motion (V8, V9, V11).

### The command palette (F2, C2)

- **WS305. Opening it.** `Ctrl K` (`⌘ K` on Apple platforms) or the dashed chip in the bar toggles the palette.
  - The chip shows the platform's shortcut text, is named `Open the command palette`, and shows from `sm`.
  - The shortcut does nothing while focus is in a text field outside the palette.
  - The palette is a modal dialog on a backdrop: a prompt glyph, a text field named `Command`, and an `Esc` hint. Focus moves to the field on opening and returns to what opened it on closing.
- **WS306. Its commands come from the website's own route list and reads.** Never from prototype state.
  - **Pages:** `profile` (aliases `home`, `me`), `quests`, `lb` (aliases `leaderboard`, `board`; flags `--week`, `--month`, `--all` choose the period, WS37), `book` (alias `achievements`) and `skills` (aliases `perks`, `tree`) once ship #193 lists them, `activity` once #249 lists it, and `inventory` and `collection` when their pages ship (WS341, WS342).
  - **A page command follows its nav entry (WS301):** open navigates; ready opens the feature's crate; locked prints `{name} unlocks at level {level}. You're level {n}.` and stays open; a feature that hasn't shipped is an unknown command.
  - **Shell:** `theme light`, `theme dark`, `theme system` (WS16's three choices), `signout`, and `help`.
  - **As the member types,** the list suggests matching commands, each with its icon, usage, one-line blurb and aliases. Up and Down move the selection, Tab completes it, Enter runs it.
  - **`help`** lists every command the member can run, with a footer of the keys: `↑↓ select · Tab complete · ↵ run · Esc close`.
  - **An unknown command** shows Max with `No command "{input}". Type help to see them all.` (V18).
- **WS307. The playful replies.** E's hidden commands and witty replies port where their copy is still true: each reply names nothing cut (D6) or unshipped, states no count or threshold, and reads or writes nothing. The ticket lists each reply it keeps and drops the rest. Stale copy such as "12 ladders" or "three trees" never ships.
- **WS308. Keyboard and screen readers.** The field is a combobox controlling a listbox, with `aria-activedescendant` for the selection. A status line (a polite live region) speaks what a command printed. The palette passes axe in light and dark.

### Sign-in and display size (F3, C3)

- **WS309. The sign-in page stands alone.** The signed-out page drops the HUD bar and shows E's card (E039–E048), centred and narrow (`max-w-sm`), with the theme control at the top right of the page:
  - the hand-clasp hedgehog at 112 px, then `HedgeHug` and `Thanks a Hog`;
  - `Sign in to see your kudos, your level and everything you've unlocked. Only members of your Slack workspace can sign in.` It names nothing a member might not have (E044's list waits for no fact, so it isn't used);
  - the primary `Sign in with Slack`, large and full width, with the four-colour Slack glyph;
  - while a deep link waits (WS37, #157's `redirectTo`), `You'll land on {path} afterwards.`, with the path in a code style. Only a path in the website's route list is shown; anything else shows no hint.

  The closed page, the error pages and the not-a-member page keep their BrandSays layout. E's "Prototype: no real sign-in happens." never ships (WS338).
- **WS310. Display titles.** Page titles take variant E's display sizes, in RoundHog bold:
  - `/quests`, and once they are on `main`, `/skills`, `/book` and `/activity`: E's `text-4xl` with `leading-none` (`Quests.tsx` and `Skills.tsx`, line 31 and 67);
  - `/leaderboard`'s headline: E's `clamp(1.75rem, 5vw, 3rem)` with a 0.95 line height and balanced wrapping (`Leaderboard.tsx`, line 66).

  `PageTitle` takes the size as one option, so every page sets it the same way. Ticket 4 sets it for the pages on `main`; #193 and #249 set it for theirs (Slices).

### The home's shape (F3, C5)

- **WS311. The open hero.** The hero drops its bordered card for E's open header: no border, background or corner marks, with E's spacing from `Profile.tsx` (E064). Everything inside stays as #236 built it (WS98).
- **WS312. The first-kudos nudge.** While the member's lifetime given count is 0, a panel under the hero shows E's `FirstKudosNudge`: the message icon, `Give your first kudos in Slack`, E's sentence with the member's kudos emoji, and the page's primary `Thank someone in Slack`. While it shows, the hero's own action becomes an outline button, so the page keeps one primary element (V4). It goes once the member has given a kudos.
- **WS313. Spending points from the hero.** While the Skill tree is open and `skillPoints` is above 0, the hero shows an outline link `Spend {n} skill points` (`Spend 1 skill point`) to `/skills`, after the allowance row. #237's Skill tree panel keeps its count too.

### Quests (F9, F11, C6, C8)

- **WS314. Quest art.** Each personal quest card on `/quests` carries a 64 px hedgehog for its kind, from E's quest catalogue (`quests-data.ts`): one hoggie per kind label (`Say why`, `Reach out`, `Join in`), keyed in the website. It is decorative (empty title). Once the quest's crate is opened, the hedgehog turns greyscale with a check badge, and the card is muted, with its text still at 4.5:1 (E182, V24).
- **WS315. `Claim`.** A finished quest's crate action reads `Claim` (E181). It opens the crate through the existing full-screen reveal (D4, WS74). The first finished quest in slot order has the primary `Claim`; any others are outline. An opened quest shows a check and `Claimed`. Earlier weeks' crates (`waiting`) read `Claim` too. This changes WS73's `Open` and its `Done`. The ready pill is unchanged (WS68). When the reveal closes after a `Claim`, the reward's chip (`+{xp} XP`) flies once from the card to the HUD avatar, as E's `flyToHud` does (E184); never under reduced motion, and never on a reload.
- **WS316. Quest links.** `/quests?quest={slot}` (`1` to `3`) or `/quests?quest=journey` scrolls that card into view and moves focus to its heading, once, after the answer lands (E194). An unknown value is ignored. `routeAt` keeps the parameter, and `routeList` is unchanged because the path is the same. Slack may link to it later (Cross-map needs).
- **WS317. The bonus quest is the Journey's next step.** Map #1's progression call 2 made the prototype's "bonus quest for each freshly unlocked feature" and the Journey one chain. So `/quests` shows, after the personal quests, a section `Bonus quest` with the Journey's first unfinished step as E's fresh-quest card:
  - a `New` tag while the step is `active`, the step's goal and hint (WS71), its reward `{xp} XP`;
  - a link to the page of the feature the step belongs to, when that feature has one and is open (`Go to {name}`). The step's feature comes from Quests' own mapping, `featureOpening(step)` in `convex/quests/step.ts`, composed into the Journey's steps as an additive `feature` field, never derived in the browser (WS13);
  - while the step is `finished`, its crate with `Claim` (WS315).

  With every step opened, the section is absent. The home's Journey panel is unchanged (WS72). The home's `Quests this week` (#238, WS109) gains the same step as its last row, with E's `New` tag, linking to `/quests?quest=journey` (E076).
- **WS318. `swapQuest` is D17's `rerollQuest`.** `swapQuest({ quest })` in `convex/website/commands.ts` is built on `memberMutation` (WS61), following WS335:
  - `quest` is a whole weekly quest, `{ kind: "weekly", week, slot }`, validated by Quests' `weeklyQuestValidator`. The browser takes it from the read (WS319), never builds it.
  - **The gate first.** It answers `{ kind: "refused" }` without calling D17 unless Quests is open for the member and the quests launch is recorded: the gate `openQuestCrate` already uses (`questsLaunchedFor`).
  - **The command.** `runCommand(ctx, workspace, person, { type: "rerollQuest", quest }, "website:swapQuest:{member}:{week}:{slot}")`. D17 ignores the key for this command, so the key only labels the call. It answers `{ kind: "swapped" }` when, afterwards, the week's swap replaced exactly that slot, and `{ kind: "refused" }` otherwise. After `swapped` it republishes App Home.
  - **Retries are safe by state, with no request ID.** Quests allows one swap a week, so a repeated call for the same slot finds the swap already there and answers `swapped`, and a call for another slot answers `refused`. Quests alone decides whether the swap may happen (one per week, an unfinished slot, a replacement exists). The website writes no table itself.
- **WS319. Swap on the page.** `getQuests`' `quests` answer gains two additive facts, both from Quests' `weeklyQuestsOf` and `drawnWeekOf` (on `main`):
  - each slot gains `quest: WeeklyQuest`, its whole identity, so an unfinished slot can be swapped (today only a finished slot carries its `crate`);
  - the answer gains `swap: { used: boolean; available: boolean }`: `used` while this week's swap exists, and `available` exactly as `weeklyQuestsOf`'s `swapAvailable`.

  The page then shows:
  - **The header,** while the week has slots: `1 swap left this week` while `available`, `Swap used this week` while `used`, and nothing otherwise (every slot finished, or no replacement to offer), with the swap icon (E176).
  - **Each in-progress card,** while `available`, a muted link-style `Swap` button titled `Swap this quest for another. One swap a week.` One press swaps, as in E and in Slack's App Home.
  - **Sending** reads `Swapping…`, disabled, until the answer. **`swapped`:** the reactive read shows the new quest with its `Swapped` tag; a polite live region says `Swapped. Your new quest: {goal}.`; focus moves to the new card's heading. **`refused`:** `That quest couldn't be swapped.` **A denial:** the frame follows `getMyProfile` (WS11). **An error or no answer:** `Couldn't reach HedgeHug. Try again.`, and pressing `Swap` again sends the same quest, which is safe (WS318).
  - **`How quests work`** drops "swap in Slack" and says `You can swap one quest a week.`

### The leaderboard (F13, C7, C8)

- **WS320. Show 5 more.** This changes WS43's "no show 5 more stepping". The windowed list gains `Show {n} more above` over the window while rows above it are hidden, and `Show {n} more below` under it while rows below are hidden, with `n` the smaller of 5 and the hidden rows on that side. Each press grows the window in place from `rows`, and focus moves to the first revealed row. The gap marker updates. `Show the whole board`, `Jump to me` and `Back to my spot` are unchanged; `Back to my spot` also restores the first window.
- **WS321. The visibility switch.** `How it counts` replaces WS46's read-only status with a Quill switch, `Show me on the leaderboards`, checked from the read's `onTheBoards`.
  - **The command:** `setBoardVisibility({ visible })` in `convex/website/commands.ts`, on `memberMutation`, following WS335.
    - **Its gate:** the Leaderboard is open for the member by `leaderboardStateOf`, which also covers the board while unlocks don't apply; no workspace launch is due (`workspaceLaunchDueIn`); and while quests apply to the member, their Journey has started (`journeyStartedFor`). So the call and App Home's republish after it can't record the P77 launch or the P91 join. It refuses with `{ kind: "refused" }` before D17 otherwise.
    - **Then** `runCommand(..., { type: "setLeaderboardVisibility", visible }, "website:setBoardVisibility:{member}")`, which D17 ignores for this command. It answers `{ kind: "set", visible }` with the setting stored afterwards, and republishes App Home after a change.
    - **Retries:** setting a value is idempotent, so the same call twice leaves one change. The browser never resends by itself: after an error, only the member's next toggle sends again, with the value the member then chose, so a stale retry can't overwrite a newer change from another tab.
  - **The switch** is disabled while the call is pending, and its position always follows the reactive `onTheBoards`, never the value sent. A polite live region says `You're on the leaderboards.` or `You're off the leaderboards.` after `set`; `That couldn't be changed.` after `refused`; and `Couldn't reach HedgeHug. Try again.` after an error. A denial follows `getMyProfile` (WS11).
  - **Copy:** the `left` line on the board becomes E's `You're off the board by choice. Switch on "Show me on the leaderboards" to come back.`, and the mention of Settings in Slack goes from the page.
- **WS322. How it counts names what never ranks.** `Only kudos given count. Kudos received, XP, levels and achievements never rank anyone.` once the Book is on `main`, and `coins` joins the list when coins ship (E165).

### Locked, ready and the reveal (F19, C11)

- **WS323. The locked page.** A feature page whose state is `locked` (WS52, WS79) shows the feature's hedgehog in silhouette with a lock badge, the feature's name, `Unlocks at level {level}`, the feature's sentence from `features.ts`, and `Back to your profile`. No generic Max, no blurred preview, no levels to go and no progress (D3, E282, E283).
- **WS324. The ready page.** A feature page whose state is `ready` shows E's night band: a dark band in both modes, holding the large headline `{name} is ready`, the feature's sentence, and the crate with its primary `Open` (WS67). The band's text and the crate's border meet V24's contrast in both modes, measured by a test.
- **WS325. A richer reveal.** After a feature crate's reveal (WS66), the end state adds:
  - **what waits:** a short checklist of what the feature holds, from `features.ts`, two or three lines per feature, naming only shipped facts and quoting P94 where it names a perk (E295);
  - **the next crate:** while other crates are ready, `Open the next one` and `{n} more ready`, opening the next ready crate in the ready pill's order (E296).

  Quest and Journey reveals are unchanged. The reveal still plays only after the server answers `opened` (WS66).

### The skill tree (F14, C9; after ship #193)

- **WS326. The header.** Under `Perks`, the line `{owned} of {total} perks owned`, with `total` the perks in `getSkillTree`'s answer, never E's 14. Beside it, E's resource chips: skill points to spend and `LV {n}`. The coins chip joins when coins ship. This changes WS85's and WS94's "no counts".
- **WS327. The legend.** Above the tree, `Owned`, `Can buy` and `Locked`, each with its node look in small. `Upgraded` joins when upgrades ship (WS345).
- **WS328. Compact nodes.** Each perk is E's compact square node with its icon, a check badge when owned, a lock badge when unavailable, the name as a caption under it, and its cost as E's pill with the skill point glyph. An available node has E's strong outline, drawn in the foreground colour, not primary: several nodes can be available at once, and the product owner's accepted D2 keeps primary for the one next action, the selection or "you" (V4). Primary stays on the selection's ring and on `Buy` (WS87). Every state stays readable without colour (V24).
- **WS329. Your perks.** The ledger's heading adds `{n} active`, and the panel adds `Permanent · always on.`
- **WS330. A one-off purchase pop.** After `bought` (WS87), the bought node pops once, as E's purchase does. Never under reduced motion. The rest of WS87 is unchanged.

### The Book (F16, F17, C10; after ship #193)

- **WS331. The page index.** `/book` gains E's index: on wide screens a sticky left column with the Book icon, `Overview`, then one entry per category with its emblem; on narrow screens a native select with option groups (E235). The current page has E's stripe. The page is `/book?page=overview` (canonical, with no query) or `/book?page={category}`; an unknown value shows the overview. `routeList` is unchanged. The sticker albums join the index with WS346.
- **WS332. Category pages.** E's four categories group the shipped ladders: `Giving`, `Being thanked`, `Connections` and `Crowd`, with E's blurbs. The website keys each ladder ID to its category in one table (`book/categories.ts`), beside the emblem table (WS92). A category with no shipped ladder has no entry; a shipped ladder with no category key goes to the last category with a ladder, and a test fails for any shipped ladder ID missing from the table. Each category page shows its heading, its blurb and its ladders, in catalogue order. Blurbs name only shipped things: `Crowd`'s chime-in sentence waits for chime-ins.
- **WS333. Ladder details.** Each ladder card adds:
  - a rosette in the metal of the highest earned tier around the emblem, with E's static sparkle for gold and diamond (E247, V16);
  - the latest earned tier's date beside the ladder's name (E249);
  - under the bar, `{at − count} to go for {tier name}`, from the read's numbers only. E's full sentence with a unit waits for a unit fact (Cross-map needs);
  - after the fourth tier, `Complete` and a full bar (E252);
  - the `Next` tier cell with E's ring in the foreground colour and its neutral `Next` tag. Every incomplete ladder has a `Next` cell, so primary would mark many things at once, which D2 rules out (V4). This deviates from E257 on the product owner's own D2.

  Rewards on tiers wait for their kinds (WS91, WS347).
- **WS334. The overview.** `/book` opens on E's overview. This changes WS92's single list and the "no totals" reading of P61 for the member's own Book. It shows only the member's own facts (WS93):
  - `{earned} of {total} tiers earned` across the shipped ladders, with a neutral bar;
  - the closest next tier: the ladder with the smallest `at − count`, ties in catalogue order, with its emblem, the tier's name and `{at − count} to go`;
  - the recently earned shelf, `Newest first`: the latest earned tier of each ladder, newest first, five on wide screens and three on narrow ones, each with its medal, name and date; the newest carries `New` when it was earned in the last 7 days (E's `TrophyShelf`);
  - one tile per category with E's art, its emblem, `{earned} of {total}` and a neutral bar;
  - E's book-reading hedgehog.

  Received totals stay private, and nothing names another member (#85). Map #1 is told that the website's own Book shows these totals (Cross-map needs).

### Every web write, the look, and the order

- **WS335. Every web write is a D17 command.** `openFeature`, `openQuestCrate`, `buyPerk`, `swapQuest`, `setBoardVisibility`, and later `equip` and `buy` (WS341, WS342) all follow WS61–WS64 and WS88:
  - built on `memberMutation`, so a denied call writes nothing, and no argument names a member;
  - **a gate before D17, per command,** that answers `refused` unless the command's own condition holds and no workspace launch it could touch is due. A website call never records the P77 launch or a workspace's Journey launch and never schedules the P91 join, the way #189's `buyPerk` refuses. The conditions:
    - `openFeature`: the feature is `ready` (WS62);
    - `openQuestCrate`: the quest's reward is recorded, which can happen before Quests opens for a Journey step (WS71, WS74);
    - `buyPerk`: the Skill tree is open (WS88);
    - `swapQuest`: Quests is open (WS318);
    - `setBoardVisibility`: the Leaderboard is open, including while unlocks don't apply (WS321);
    - later `equip` and `buy`: the feature that holds the item is open (WS341, WS342);
  - `memberMutation`'s own admission is unchanged: it may run the member's own preview moments (#204, map #1's per-member flags spec), which it already skips while a workspace launch is due. Those are the member's preview, not a workspace launch;
  - one `runCommand`. Where D17 stores outcomes by key (`buyPerk`), the key is `website:{member}:{request}` from a browser UUID (WS88). Where it doesn't (`openUnlock`, `openQuestCrate`, `rerollQuest`, `setLeaderboardVisibility`), the command must be safe to repeat by state, and its retry rule says so (WS63, WS318, WS321);
  - an answer read from the domain's state afterwards, never guessed;
  - App Home's republish after a change, and the exposure Slack's click sends (O36);
  - WS10's exact list grows by each command, and a test compares the tables and events the website's call leaves with those Slack's click leaves (WS64).
- **WS336. Each ticket is its own pull request from `main`.** As WS113: no integration branch; review with a green gate; complete when it merges. Its proof is a local run in light, dark and 390 px before the merge, and a read-only check of the live site after its deploy, never writing production data or changing a flag. Where a ticket edits a file that `spec/website-4` or an open ticket (#237, #238, #248–#251) also edits, whichever merges second merges `main` and keeps both.
- **WS337. No new flag.** Every piece rides the flags that already gate its facts:
  - the whole website on `website`;
  - nav states and the reveal on `xp-levels` and `unlocks`;
  - quests, Swap and the bonus quest on `quests`;
  - the board, `Show 5 more` and the visibility switch on `everyone-board`;
  - the skill tree on `skill-tree`, the Book on `achievements`;
  - each cross-map piece on the flag map #1 ships it behind (`coins`, `store`, `hedgehogs`, `perks`, and the groups flags).

  All of the website's current flags are on in production, so each merge is its release. Reads send no exposure (O36).
- **WS338. Prototype tooling stays out.** The level scrubber, the variant picker, the moment picker, the mock levels and the fake sign-in footer never ship (C12). Mock names, prices, thresholds and balances are never production data.
- **WS339. Motion and the look.** WS23, WS24, WS54, WS75, WS94 and WS112 hold for every new element. Motion is one-off with a reduced-motion end state, and nothing loops (D1). Rings, bars and counts stay neutral, and primary marks only the next action, the selection or "you" (D2, V4). Every new element passes axe in light and dark, and every non-text element meets 3:1, measured by a test from the theme tokens (V24).

### Later ports, after map #1's facts (C4, C11)

Each rule names what the website needs from map #1. The website composes it; it never computes it (WS13).

- **WS340. The hedgehog avatar (F4).** Once hedgehogs ship (#96), the member's equipped hedgehog replaces the face in the HUD avatar, the hero's 168 px portrait with its name, `What teammates see`, and the viewer's own podium and list rows (E020, E053, E068, E153). Other members keep their faces (V19). **Needs:** each member's equipped hedgehog, as a catalogue ID with its name, in `homeFacts` and in the board's viewer row.
- **WS341. The character panel and the inventory (F5, F6).** Once the inventory, kudos emoji and coins ship (#30, #31), the home's main slot holds E's two-sided `Character · 4 slots` and `Inventory` panel: the portrait with the hedgehog slot and three emoji slots, the centre-stage picker, the owned items, `Not yours yet` with how to earn each, and prices in coins. The coins chip joins the HUD. **Needs:** a read of the member's owned and equipped items with their slots and the coin balance; the commands to equip and take off an item and to buy one with an idempotency key; the catalogue's names, art keys, sources and prices. Equip and Buy follow WS335. A purchase is never a crate (V13).
- **WS342. The hedgehog shelf and its reveal (F7, F23).** Once hedgehogs ship (#96), `/collection` shows E's shelf: every hedgehog with its art and source, owned or silhouetted, `Equip` for an owned one, `Buy for {n} coins` for a store one, and E's new-hedgehog reveal once per new hedgehog. **Needs:** the catalogue with sources, the member's owned hedgehogs with the time each arrived, and the commands of WS341. `/collection` joins `routeList`.
- **WS343. The public card's group and medals (F8).** Once the profile card and groups ship (#53, #52), `What teammates see` adds the member's primary group and their best four tier medals, exactly as teammates see them in Slack (E057, E070, E071). **Needs:** the profile card read for a member, as Slack shows it, never another member's private Book.
- **WS344. Groups on the website (F10, F12).** Once groups ship (#52): the Groups and My group board cards with their stories and crests on `/leaderboard`, the My group and Groups rows in `Where you stand`, the private most-improved-group card, and the group quest on `/quests` and the home. Rank-change arrows join when a read carries last week's rank (C7). The group quest shows counts, never names (P82). Helper names and E's helper row appear only after the product owner changes P82 in words (C6); a read that supplies names is not enough. **Needs:** the group boards' ranked rows, the viewer's group and standing, last week's ranks, and the group quest's progress and reward.
- **WS345. The rest of the skill tree (F15).** Once the row-7 upgrades and the rest of the tree ship (#30, #39): rows 7, 9 and 12, the upgrade connectors, the replaced base's caption, the upgrade-aware ledger, coin costs, `Upgraded` in the legend, and `Switch on for today` for focus and spotlight. **Needs:** every row's perks in `perksOf` with upgrade links and coin costs, and the switch-on command, following WS335.
- **WS346. The sticker albums (F18).** Once the sticker book ships (#54): the albums in the Book's index, mine first; E's numbered two-page spreads on paper; the mapped team photo from the company source or the no-photo state (D5: no uploads); collected and missing stickers; `Complete` with its date; and the privacy line. Named gaps (E277) wait for the product owner's answer to C10. **Needs:** each album's roster, the member's stickers with their facts, completion with its date, and the team-photo mapping.
- **WS347. Tier rewards and the achievement page (F17 rewards, F21).** Once tier reward kinds ship (#30, #31, #96): each tier's reward line on the Book and in the reveal, the recently earned shelf's rewards, and E's achievement-earned page reached from the tier DM. **Needs:** each tier's stored reward in `achievementsOf`, and the earned-tier event for the page and its seen key.

- **WS348. Quest rewards beyond XP (E179, E180, E301).** Once coins, kudos emoji or hedgehogs ship as quest and Journey rewards (#30, #31, #96), each quest card, the bonus quest, the home's quest rows and the crate's label show the reward's coin glyph and value, emoji glyph or hedgehog art and name, and the reveal's end state shows one chip per reward kind, after the server answers `opened` (WS66). A reward kind shows only while its feature has shipped for the member. **Needs:** each quest's and Journey step's recorded reward with its kinds in `questsOf` and the Journey's facts, as the crate already records them (P85).

## Implementation Decisions

### Modules

- **Website package (`website/`):**
  - **One module answers "which pages, in which state":** `nav/entries.ts`, `navEntriesOf(member)`, returns `Profile` and each shipped feature with a page, in schedule order, as open, ready or locked with its level and the next-unlock mark. The nav (WS301), the palette's page commands (WS306) and the locked and ready pages (WS323, WS324) all read it, so the three can never disagree, and its tests cover every state once. It replaces `openWebPagesOf`.
  - `Frame.tsx` and `nav/`: the scroll rail, the entries by state and the next-unlock badge (WS300–WS304). `AccountMenu.tsx` goes.
  - `palette/`: the dialog, the command registry built from `navEntriesOf`, `route.ts` and the theme, and the keyboard model (WS305–WS308).
  - `pages/SignedOutPage.tsx` and `PageTitle.tsx` (WS309, WS310).
  - `home/Hero.tsx` and a new `home/FirstKudosNudge.tsx` (WS311–WS313).
  - `pages/QuestsPage.tsx` with quest art, `Claim`, the quest target, the bonus quest and Swap (WS314–WS319).
  - `leaderboard/BoardList.tsx` and `leaderboard/SidePanels.tsx` (WS320–WS322).
  - `pages/WaitsPage.tsx`, `pages/ReadyPage.tsx` and `crates/RevealDialog.tsx` (WS323–WS325).
  - `skills/` and `book/` from ship #193 (WS326–WS334).
- **Convex (`convex/website/`):**
  - `commands.ts` gains `swapQuest` and `setBoardVisibility` (WS318, WS321). WS10's list and its test grow by both.
  - `quests.ts`: `getQuests` gains each slot's `quest` and the week's `swap`, and the Journey's steps gain `feature` (WS317, WS319), all additive.
  - No other module changes. Every domain fact comes from map #1's existing exports: `weeklyQuestsOf` and the Journey's step-to-feature mapping in `convex/quests/`, `rerollQuest` and `setLeaderboardVisibility` through D17's `runCommand`.

### Contracts

```ts
// convex/website/quests.ts (additive)
type QuestSlot = /* as today */ & { quest: WeeklyQuest };
type QuestsAnswer = /* … */ | { kind: "quests"; /* as today */ swap: { used: boolean; available: boolean } };
type JourneyStep = /* as today */ & { feature: Feature | null };

// convex/website/commands.ts (new)
swapQuest({ quest: WeeklyQuest }): { kind: "swapped" } | { kind: "refused" } | Denial;
setBoardVisibility({ visible: boolean }): { kind: "set"; visible: boolean } | { kind: "refused" } | Denial;
```

`getMyProfile`, `getLeaderboard`, `getSkillTree` and `getBook` don't change.

### Data

There is no new table, field or migration. The browser stores nothing new.

### The flags

| Flag | Owner | Gates in this slice | Production |
|---|---|---|---|
| `website` | this map (957148) | everything | on |
| `xp-levels` | map #1 (956733) | nav states, the avatar's level, `LV {n}` | on |
| `unlocks` | map #1 (956771) | nav states, locked and ready pages, the reveal | on |
| `quests` | map #1 (957184) | quest art, `Claim`, Swap, the bonus quest | on |
| `everyone-board` | map #1 (956734) | `Show 5 more`, the visibility switch | on |
| `skill-tree` | map #1 | the compact tree | on |
| `achievements` | map #1 | the Book's index, categories, details and overview | on |
| `coins`, `store`, `hedgehogs`, `perks`, groups | map #1 | the cross-map tickets | as map #1 ships them |

The website creates no flag (WS337), and no ticket changes one.

### Coherence

Each ticket rewrites its part of `website/Website.spec.md` and `convex/website/WebsiteReads.spec.md`, makes `coherence spec --check` pass, records its decisions with `coherence decide`, and commits the journal with the change.

- **Invariants witnessed again:** *the website shows only shipped features* (a feature with no facts has no nav entry, palette command or panel); *received stays private* (the overview and the palette show no received count); *a website command is a D17 command* (WS335's equal-to-Slack test for `swapQuest` and `setBoardVisibility`); *the website never runs a launch* (each new command's gate is tested with `unlockLaunches` and the Journey launch unrecorded).
- **Lexicon:** "command palette", "rail" and "overview" are UI words used only in this file and the website's components. A ticket that writes one of them into a Coherence spec declares it first (memory: a third undeclared use fails the gate).

## Testing Decisions

- **A good test enters at the page and checks what a member could observe:** what the page says, which entries it holds in which order, each element's accessible name and state, and where links and crates lead. It never tests private helpers.
- **Seams, highest first:**
  1. **Pages through `App`,** with Vitest and Testing Library from typed fixtures (`renderApp`): the nav for unlocks not applying and for each feature locked, next, ready and open; the palette's commands, keys and replies; sign-in with and without a deep link; quests with art, `Claim`, the target, the bonus quest and every Swap answer; the board's stepping and the switch's every answer; the locked and ready pages and the reveal's end state; the tree and the Book once #193 is on `main`. axe in light and dark for every state.
  2. **The commands through `convex-test`:** each new command's gate refusing before D17 with launches unrecorded (and `unlockLaunches` still empty afterwards), its answers, its key, App Home's republish, a denial writing nothing, and the equal-to-Slack comparison (WS335).
  3. **The header's width in a real browser:** jsdom has no layout, so WS300 is proved in each nav ticket's pull request by rendering the fixture build at 320, 390 and 1440 px with six nav entries and the pill, and reading `document.documentElement.scrollWidth`. The audit's fixture entry (`research/prototype-fidelity/fixture-*.tsx`) is the model. A unit test also pins the rail's classes (`overflow-x-auto`, no wrap) so a refactor can't drop them silently.
  4. **Contrast:** a test computes 3:1 for every new non-text element and 4.5:1 for the muted claimed card and the night band, from the theme tokens, in light and dark (WS339).
- **Proof each ticket owes:** a red test before the change and a green one after; `pnpm gate` green, with heavy runs through `~/dev/fleet/fleet heavy --`; screenshots in light, dark and 390 px beside variant E at the same state, from a disposable local backend on its own ports or the fixture build; V24's manual pass; and after the merge and deploy, a read-only check of production.

## Slices

Each ticket is a sub-issue of map #57 and its own pull request from `main` (WS336). Casting: UI and commands on Opus 5.5 (high), reviewed by GPT-6.1 Sol (high); tickets 2, 3, 13, 15, 18, 21 and 29 also get a Fable 5.1 design spot check. The order puts the most visible gaps first.

**Now, on `main`:**
1. **The header fits a phone** (WS300). The overflow defect alone: the rail, the compact bar, its classes, and the browser width proof. Blocked by nothing.
2. **The HUD nav, as in variant E** (WS301–WS304), with `navEntriesOf`. Blocked by 1.
3. **The command palette** (WS305–WS308). Blocked by 2.
4. **The sign-in card and display titles** (WS309, WS310) for the pages on `main`. Blocked by nothing.
5. **The open hero, the first-kudos nudge and spending points** (WS311–WS313). Blocked by #238, the last open home ticket, and by #193 for `skillPoints`.
6. **Quest art, `Claim`, the reward flight and quest links** (WS314–WS316). Blocked by nothing.
7. **Swap on the website** (WS318, WS319). Blocked by 6.
8. **The Journey's next step as the bonus quest**, on `/quests` and in the home's quest rows (WS317). Blocked by 6 and #238.
9. **Show 5 more on the board** (WS320). Blocked by nothing.
10. **Show me on the leaderboards, on the web** (WS321, WS322). Blocked by nothing.
11. **The locked and ready pages and the richer reveal** (WS323–WS325). Blocked by 2, for `navEntriesOf`.

**After ship #193:**
12. **The compact skill tree** (WS326–WS330). Blocked by #193.
13. **The Book's index and category pages** (WS331, WS332). Blocked by #193.
14. **Ladder details** (WS333). Blocked by #193.
15. **The Book's overview** (WS334). Blocked by 13 and 14.

**Cross-map, after map #1 ships the facts.** Each is blocked in text by the map #1 ticket, never natively, so map #1's tickets are untouched, and natively by the website tickets it builds on. Each starts only once its facts are on `main`.
16. **The hedgehog avatar** (WS340). After #96.
17. **The inventory, read only, and the coins chip** (WS341). After #30 and #31.
18. **The character panel and equipping** (WS341). After #31; blocked by 17, and its hedgehog slot by 16.
19. **Buying kudos emoji in the inventory** (WS341). After #31; blocked by 17.
20. **The hedgehog shelf, read only** (WS342). After #96; blocked by 16.
21. **Equipping and buying on the shelf, and the new-hedgehog reveal** (WS342). After #96; blocked by 18, 19 and 20.
22. **The public card's group and medals** (WS343). After #53 and #52.
23. **Group boards on the leaderboard** (WS344). After #52.
24. **Group rows in `Where you stand`** (WS344). After #52; blocked by 23 and #238.
25. **The group quest** (WS344). After #52; blocked by 6.
26. **The later perk rows and upgrades** (WS345). After #30 and #39; blocked by 12.
27. **The upgrade-aware ledger and `Switch on for today`** (WS345). After #39; blocked by 26.
28. **The sticker albums' index and read** (WS346). After #54; blocked by 13.
29. **Album spreads, team photos and completion** (WS346). After #54; blocked by 28.
30. **Tier rewards and the achievement page** (WS347). After #30, #31 and #96; blocked by 14.
31. **Quest rewards beyond XP** (WS348). After #30, #31 or #96, for whichever reward kind ships; blocked by 6.

**Extra scope for open tickets** (the conductor adds it, or the ticket that lands second does it):
- **#238:** the `Quests this week` row of a finished quest reads `Claim` (E074) and links to `/quests?quest={slot}` (WS315, WS316); the `left` line's Settings sentence follows WS321.
- **#249:** WS302 renames the screen nav's `Home` to `Profile`; `/activity`'s title takes WS310's size.
- **#193:** when it merges `main`, it keeps WS300's rail with its two new entries and WS301's states for `/skills` and `/book`, and gives `/skills` and `/book` WS310's title size.

There is no sandbox proof ticket and no integration branch: each ticket proves itself locally and then live (WS336). The conductor decides whether a `ship` ticket is needed.

## Cross-map needs on map #1

This map never edits map #1's tickets. The conductor relays these.

**Facts the published tickets wait for** (each planned by a map #1 spec ticket):
1. **Hedgehogs (#96):** each member's equipped hedgehog (catalogue ID and name) in `homeFacts` and the board's viewer row; the hedgehog catalogue with sources; the member's owned hedgehogs with arrival times; `equip` and `buy` commands through D17, with `buy` storing its outcome by an idempotency key the website can supply as `website:{member}:{request}`, as `buyPerk` does. Tickets 16, 20, 21.
2. **Coins, kudos emoji and the store (#30, #31):** the coin balance; the owned and equipped items with their slots; the catalogue's names, art keys, sources and prices; `equip`, `takeOff` and `buy` through D17, `buy` keyed as above. Tickets 17–19.
3. **The profile card (#53) and groups (#52):** the profile card read as Slack shows it (group, best four tiers); the group boards' ranked rows, the viewer's group and standing; the group quest's progress and reward, as counts. Tickets 22–25.
4. **Last week's rank** for rank-change arrows on boards and in `Where you stand` (C7). Not planned yet: an addition to #52 or the Everyone board.
5. **The rest of the tree (#30 row 7, #39):** every row's perks in `perksOf`, with upgrade links and coin costs, and the switch-on command. Tickets 26, 27.
6. **The sticker book (#54):** each album's roster, the member's stickers with their facts, completion with its date, and the team-photo mapping. Tickets 28, 29.
7. **Tier rewards (#30, #31, #96):** each tier's stored reward in `achievementsOf`, and the earned-tier event with a seen key. Ticket 30.
8. **Quest reward kinds:** each quest's and Journey step's recorded reward with its kinds, in `questsOf` and the Journey's facts. Ticket 31.

**Notes for map #1** (no website ticket waits on them):
9. **P61:** the website's own Book now shows the member's own totals, closest next tier and recently earned shelf (WS334, C10). Received totals stay private, and nothing names another member.
10. **A unit for each ladder,** so the Book can say E's full requirement sentence (`3 more thoughtful kudos`) instead of `3 to go` (WS333).
11. **Quest links:** Slack may link a quest to `/quests?quest={slot}` or `?quest=journey` (WS316). The path is already on `routeList`.

**Fog** (no planned map #1 facts; the conductor keeps these on #57):
- **F20, the level-up page:** needs a read of one level-up (level, time, XP, what opened) with a seen key, and the level-up DM linking to it.
- **F22, the received-kudos and quest pages:** needs a read of one kudos event with its gains and an event link from Slack. `/activity` and `/quests` serve meanwhile (C11).
- **E303, the standalone unlock page:** needs the level-up DM's and App Home's `Open` to link a feature's unlock page instead of the profile.
- **F24, the App Home tour page:** needs App Home's first-open link to a tour route. Today's link goes straight to the profile.
- **HUD event tray (E304):** live notifications for level-ups, tiers and kudos in the HUD, beyond crates. Needs the same event reads.
- **F0:** description and social metadata, a product choice, not a gap.

## Out of Scope

- **Everything the round-9 cut removed** (D6): boosters, group auras, drops, rarities, titles, quips, cards, workday streaks and streak freezes.
- **Member photo uploads** (D5), looping motion and count-ups (D1), primary progress (D2), locked-page progress teasers (D3), and the in-place quest crate (D4).
- **Prototype tooling** (WS338).
- **Game rules in the website.** It reads facts and sends commands (#57).

## Further Notes

1. **The calls** are in "The calls", each taken at the audit's recommendation: restore variant E, except what carries the product owner's own words.
2. **`Profile`, not `Home`** (C1). E's label returns. The route stays `/`.
3. **Sign-out at every width** (C1). E hides its sign-out button below `md` and offers it only in the palette, which a phone can't open by keyboard. Production keeps it visible everywhere.
4. **The sign-in sentence** (C3) names no feature list, because the signed-out page can't know what a member has.
5. **The hero keeps #236's invitation** (C5). E's first-kudos nudge returns beside it, and takes the page's one primary action while it shows.
6. **`Claim` replaces `Open` on quest crates** (C6). The reveal stays full-screen (D4).
7. **The Journey is the bonus quest** (F11), following map #1's progression call 2, so the prototype's fresh-unlock quest is buildable now.
8. **Swap and the leaderboard setting move to the web** (C8). Both stay in Slack too.
9. **The Book's overview shows totals** (C10) for the member's own Book only. Achievement cards stay plain Quill cards; paper is for the albums.
10. **Moment pages arrive with their facts** (C11). Their fog entries are listed above.
11. **No new flag, one pull request per ticket from `main`** (WS336, WS337).
12. **Two places stay neutral where E used primary:** the skill tree's available nodes and the Book's `Next` cells. Several of each show at once, and the product owner's accepted D2 keeps primary for one next action, the selection or "you". Both keep E's ring or outline in the foreground colour.
13. **The overflow defect is ticket 1 on `main`**, though it only shows with `spec/website-4`'s two extra pages. The rail is right for any number of entries, and #193 keeps it when it merges `main`.

**Review.** GPT-6.1 Sol (high), read-only. Round 1 made 15 findings (1 blocker, 12 major, 2 minor). 14 are fixed in this revision:
- Each web command now has its own gate (WS335): `openFeature` needs `ready`, `openQuestCrate` a recorded reward, the rest their open page.
- Swap gets each slot's whole `quest` and `swap: { used, available }`, so an unfinished slot can be swapped and `Swap used this week` is true only when it is (WS318, WS319).
- The visibility switch's gate covers the board while unlocks don't apply, and refuses while a workspace launch is due (WS321).
- D17 ignores keys for `rerollQuest` and `setLeaderboardVisibility`, so neither takes a request ID. Swap is safe by state; the switch never resends by itself (WS318, WS321, WS335).
- The group quest never shows helper names until the product owner changes P82 in words (WS344).
- E076 (the bonus row on the home), E184 (the reward flight) and E303 (the unlock page, now fog) have owners.
- Quest rewards beyond XP have their own rule and ticket (WS348, ticket 31).
- Available nodes and `Next` cells stay neutral under D2 (WS328, WS333).
- Ticket 11 waits for ticket 2, and the shelf's actions wait for the inventory's commands. The cross-map tickets are split into read, equip and buy steps (Slices).
- The bar fits 320 px: a compact bar below `sm` that may wrap (WS300).
- The trophy shelf is E's: the latest tier per ladder, five or three (WS334).
- The title sizes are E's real ones (WS310).

Rejected, with reason: the blocker that `memberMutation`'s admission writes before the command's gate. It runs only the member's own preview moments, which #204 shipped on purpose under map #1's per-member flags spec, and it already skips them while a workspace launch is due. WS335 now says so.

The `to-spec` and `to-tickets` skills can only be started by a human, so this spec follows the earlier slices' layout instead.
