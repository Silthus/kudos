# Spec: the website's fourth slice, the skill tree and the Book

> **Accepted on 2026-10-14 under the product owner's autonomous directive** (map [#57](https://github.com/Silthus/kudos/issues/57) Notes: "ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags"), with every open call at its recommendation (listed under "Further Notes"). Ticket [#183](https://github.com/Silthus/kudos/issues/183). This file lives on the branch `docs/spec-website-4` and is never merged. It is the target design of the fourth slice; its implementation tickets are listed under "Slices". Its rules continue the first three slices': `WS1`–`WS28` are in [`spec/website.md`](https://github.com/Silthus/kudos/blob/docs/spec-website/spec/website.md) on `docs/spec-website`, `WS29`–`WS54` in [`spec/website-2.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-2/spec/website-2.md) on `docs/spec-website-2`, `WS55`–`WS77` in [`spec/website-3.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-3/spec/website-3.md) on `docs/spec-website-3`, and all still hold except where a rule below names the one it changes.
>
> Sources: the first three slices (their specs, the code on `main` at `c2b6924` and on `spec/website-3`, part A: `unlockPathOf`, `getMyProfile.features`, `openFeature`, the crate and the ready pill), the visual language ([`docs/website/visual-language.md`](https://github.com/Silthus/kudos/blob/main/docs/website/visual-language.md), V1–V24), the accepted UI prototype #62 (variant E's skill tree and Book, `prototype/website-ui` at `3409ade`), the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P4, P5, P18, P19, P58–P62, P65, P72–P79, P93–P95), and map #1's stopping point 4: spec [#29](https://github.com/Silthus/kudos/issues/29), its tickets [#159](https://github.com/Silthus/kudos/issues/159) (`perksOf`, `buyPerk`) and [#163](https://github.com/Silthus/kudos/issues/163) (`achievementsOf`, the Book), its gate [#170](https://github.com/Silthus/kudos/issues/170) and its ship [#171](https://github.com/Silthus/kudos/issues/171), built on `spec/skill-tree-achievements` and not on `main` yet.

## Problem Statement

Map #1 is building the skill tree's first row and the Book's achievements, dark behind `skill-tree` and `achievements` (#171). A member at level 5 opens the Skill tree and buys `spark`, `rhythm` or `circle` with a skill point; a member at level 4 opens the Book and sees the tiers they earned on each ladder, with the date each was earned. Slack shows both in App Home tabs. The website shows neither. Its home has a Skill tree card that points to Slack once open (WS58), and a Book card whose sentence names stickers, which haven't shipped (P78). The HUD has no skill points, although V1 puts them there once the Skill tree is open. And although #29 hands the website `perksOf`, `achievementsOf` and `buyPerk` for exactly this, the website has no page that reads them.

## Solution

**Two new pages, each the web page of a shipped feature.** `/skills` is the Skill tree and `/book` is the Book. Each follows its feature's unlock the way `/leaderboard` does: not found while the feature hasn't shipped, a calm locked page below its level, its crate in place while ready, and the page itself once open. The home's open card, the nav and the crate's `Go to {name}` lead to them.

**The skill tree page reads `perksOf`.** It shows the member's skill points to spend and the tree's shipped rows, today one row of three perks at level 5, each with P94's copy word for word, its cost and its state: owned, can buy, or why it can't be bought right now. Skill points also appear in the HUD once the Skill tree is open.

**Buying a perk happens on the web.** A perk's details carry one primary action, `Buy for 1 skill point`. It runs the same D17 `buyPerk` command App Home's `Buy` runs, with a key the browser makes for that purchase, so a retry returns the first outcome. Buying is not a crate: the perk turns owned in place, and a live region says so.

**The Book page reads `achievementsOf`.** It lists the member's own shipped ladders, each with its count and four tiers. An earned tier shows its medal, its name and the date it was earned. The next tier shows the count it needs. A tier's promised reward stays out of sight until its kind (coins, kudos emoji, hedgehogs) has shipped, because unshipped things are never named (P78).

Every piece reads facts and sends commands. Progression decides what a perk costs and whether it can be bought, and Achievements decides counts, tiers and dates. The website computes none of them. No new flag is needed: each page rides `website` plus the flag that gates its feature in Slack.

## User Stories

**The pages and the way in**
1. As a member, I want the Skill tree and the Book to have their own pages once I open them, so that I can see them where I see the rest of my Kudos.
2. As a member below a feature's level, I want its page to say the level it opens at, without a progress tease, so that I know what's coming without being pushed.
3. As a member whose Skill tree or Book is ready, I want to open its crate right on its page, so that opening leads straight to it.
4. As a member, I want the Book's card to describe only what the Book holds today, so that I'm never promised stickers that don't exist yet.

**The skill tree**
5. As a member, I want to see how many skill points I have to spend, on the tree and in the HUD, so that I know when I can buy a perk.
6. As a member, I want each perk described exactly as Slack describes it, so that the web never promises more than a perk pays.
7. As a member, I want each perk to say whether I own it, can buy it, or why I can't, so that I know what my choice is.
8. As a member, I want perks of levels that haven't shipped to stay out of sight, so that I'm never shown something I can't get.
9. As a member, I want to buy a perk on the website with one action after reading what it does, so that I don't have to go back to Slack for it.
10. As a member, I want to be told before I buy that a spent skill point never comes back, so that I choose knowing it is for good.
11. As a member whose connection drops while buying, I want a retry to buy at most once, so that I never lose a second point.
12. As a member using a keyboard or a screen reader, I want to choose a perk, buy it and hear that I own it, so that buying works for me too.

**The Book**
13. As a member, I want to see each ladder's tiers, which ones I earned and when, so that I can look back on what I reached.
14. As a member, I want a ladder I haven't reached yet to show what its first tier needs, so that I know it exists without being pushed.
15. As a member, I want tiers to read as milestones, never as goals someone set me, so that thanking stays about the person I thank.
16. As a member, I want my Book to stay mine, so that the kudos I receive stay private.

**Running it**
17. As the product owner, I want each page to show only where its feature applies in Slack, so that the website never shows more than Slack does.
18. As the product owner, I want buying on the web to be the same D17 command App Home runs, so that a click on the web can't change what anyone earns beyond what Slack's `Buy` changes.
19. As a developer, I want every new public function on WS10's exact list and behind one guard, so that each new entrance is a reviewed change.

## Rules

Rules continue the third slice's numbering, from `WS78`.

### The pages and the way in

- **WS78. Two feature pages.** The Skill tree's page is `/skills`, its tab `HedgeHug · Skill tree`. The Book's page is `/book`, its tab `HedgeHug · Book`. Each is the web page of its feature, keyed by Unlocks' feature IDs `skillTree` and `book`. The router learns both paths; every other path is still the not-found page (WS1).
- **WS79. One page state per feature, from the unlock path.** The website derives a feature page's state from the same `unlocksOf` read that carries `getMyProfile.features` (WS56), through one function, `featurePageOf(path, feature)`, which generalises WS57's `leaderboardStateOf`:
  - `off` while unlocks don't apply (`path` is `null`) or the feature has no entry, because it hasn't shipped (P78);
  - `locked` with the feature's level, `ready`, or `open`, from the entry's `state`.

  The leaderboard keeps its own pre-unlocks answer (WS30, WS57) on top of this function. The Skill tree and the Book have none: each feature's own predicate already requires unlocks to apply (#159, #163), so where unlocks don't apply both are `off`. The nav, the home's cards and the pages read the same entry, so they can't disagree. The website never compares a level with a feature's level (WS56).
- **WS80. Each page's read answers like `getLeaderboard`.** `getSkillTree` (WS83) and `getBook` (WS90) answer:
  - `{ kind: "not-found" }` while the page state is `off`, and the page renders the not-found page;
  - `{ kind: "locked", level }` or `{ kind: "ready" }`, with no facts, while the feature isn't open;
  - otherwise their facts.

  The locked page shows one hedgehog and Max's sentence `{name} opens at level {level}.` with `Go to Home` (WS52's locked page). The ready page shows the feature's crate in place, with a primary `Open` (WS67). Once opened it becomes the page reactively.
- **WS81. The pages join the home, the nav and the crate.** The website's page registry (`webPageOf`) gains the Skill tree and the Book, so:
  - the nav lists each one while it is open (WS59), in schedule order: `Home`, `Leaderboard`, `Book`, `Skill tree`;
  - the home's `Open` card links to the page, with `Spend skill points on perks you choose.` for the Skill tree and `See the tiers you've earned.` for the Book, and never shows a count (WS38's kind of sentence);
  - the reveal's action reads `Go to Skill tree` or `Go to Book` (WS66).

  The Skill tree's `Open. Find it in Slack's App Home.` card (WS58) is gone.
- **WS82. The Book's card names only what has shipped.** The website's own sentence for the Book's locked card becomes `Achievements you earn as you thank colleagues and they thank you.` It never names stickers or albums until the sticker book ships (P78, #163). The crate's `It opens {opens}.` already follows Unlocks' schedule, whose `opens` #163 rewrites to name achievements alone.

### The skill tree

- **WS83. The skill tree read.** `getSkillTree` in `convex/website/skillTree.ts` is built on `memberQuery` and takes `{}`. Besides WS80's answers it answers `{ kind: "tree", skillPoints, rows, chatUrl }`:
  - `skillPoints` is the member's unspent skill points (P4).
  - `rows` holds the tree's shipped rows in level order, each `{ level, perks }`, and each perk is `{ perk, name, copy, cost, requires, state, reason, ownedAt }`:
    - `perk` is the perk's stable ID, the value `buyPerk` takes;
    - `name` and `copy` are the catalogue's, `copy` being P94's words;
    - `cost` is `{ skillPoints }`, with no coins, since coins haven't shipped (P78);
    - `requires` is the name of the perk it upgrades, or `null`;
    - `state` is `owned`, `available` or `unavailable`;
    - `reason` is set only while `unavailable`, from P19's checks: `level` (the member is below the row), `requires` (the base perk isn't owned) or `points` (not enough skill points);
    - `ownedAt` is set only while `owned`.

  Every value comes from progression's `perksOf(member)` (#159). The website computes no cost, state, reason or point count, and keeps no perk copy of its own. A fact `perksOf` doesn't carry is added by an additive export beside it, the way #133 added `rankedBoardOf`, never derived in `convex/website/` (cross-map need 1). A perk of a row that hasn't shipped is absent, because the catalogue doesn't hold it (P78).
- **WS84. Skill points in the HUD.** `getMyProfile`'s member answer gains `skillPoints`: the member's unspent points from the same `perksOf` read while the Skill tree's page state is `open`, and `null` otherwise. While it is present the HUD shows a chip with a skill point glyph and `{n}`, whose accessible name is `{n} skill points to spend` (`1 skill point to spend` for one), linking to `/skills` (V1). It shows `0` too, so the HUD doesn't jump when the last point is spent. This replaces WS51: skill points now show exactly where Slack shows them, once the Skill tree is open (P76).
- **WS85. The skill tree page.** While `getSkillTree` answers `tree`:
  - **Header:** the label `Skill tree`, the RoundHog title `Perks`, and one line, `{n} skill points to spend` (`1 skill point to spend`, `No skill points to spend`).
  - **The tree:** a panel labelled `Perk tree` holds one band per shipped row, headed `Level {level}`, with that row's perks side by side. Each perk is a node, a game object with corner marks (V2): its icon, its name, and its cost as a skill point glyph with `{n}` while it isn't owned. The node's look follows its state, never by colour alone (V24):
    - **owned:** a neutral filled node with a check mark (V4);
    - **available:** an outlined node, with `Can buy` in its accessible name;
    - **unavailable:** a muted node, with its reason in its accessible name.

    Each node is a button with `aria-pressed` for the selection, and the selected one carries the primary ring (V4). An upgrade sits below its base, joined by a line, once a row with upgrades ships. Today there is one row and no lines.
  - **Details:** the selected perk's details sit beside the tree on wide screens and in a drawer on narrow ones. They show its name, its P94 copy, `Level {level} or higher`, its cost, and then exactly one of:
    - `Owned since {date}` for an owned perk;
    - the buy action (WS87) for an available one;
    - its reason for an unavailable one: `Opens at level {level}.`, `Needs {requires} first.`, or `No skill points to spend. Each level from 5 on gives one.`

    On first load the first available perk is selected, or the first perk when none is.
  - **Your perks:** a list, in purchase order, of the perks the member owns, each with its name and P94 copy. With none, it reads `Perks you buy show here, and they're yours for good.`
  - **How perks work:** a panel that says "Perks give bonus XP when you thank someone and say why. Bonuses count when your message has 5 or more words besides mentions and emoji. Every level from 5 on gives one skill point. A spent skill point never comes back, and there's no respec." (P4, P5, P94, P95).
  - **Not on this page:** later rows, locked rows teasing their level, coins, the perk count "{n} of 14", and the prototype's legend entry `Upgraded`, until upgrades ship.
- **WS86. Perk copy is P94's, word for word.** Each perk's description is the `copy` the read carries, which is P94's line for that perk. The website adds no paraphrase, summary or tooltip of its own. No copy on these pages calls a kudos "thoughtful", says the app checked a reason, or tells a member to resend or pad a message (P95). The prototype's "+2 XP on every thoughtful kudos you give" and similar lines are dropped.

### Buying a perk

- **WS87. Buying in the page.** An available perk's details hold one primary button, `Buy for 1 skill point` (`Buy for {n} skill points` for a larger cost), with the line `A spent skill point never comes back.` above it. It is the page's one primary action (V4). Selecting a perk and pressing Buy are two actions, so no confirmation dialog is added.
  - **Sending.** The button sends `buyPerk` (WS88) and reads `Buying…`, disabled and without motion, until the answer.
  - **`bought`.** The perk turns owned in place, reactively from `getSkillTree`, and the HUD's chip and the header's count drop. A live region says `You bought {name}.` and focus moves to the details' heading. There is no crate, reveal or animation: buying a perk is not a crate (V13).
  - **`refused`.** Nothing changes. The details show the perk's current state, and the live region says `That couldn't be bought.` followed by the reason the read now shows.
  - **A denial** (WS11). `Buying…` ends, and the frame follows `getMyProfile`'s own answer to the denial page, as on any read.
  - **An error or no answer.** If the call rejects or the connection drops, `Buying…` ends, and the live region says `Couldn't reach HedgeHug. Try again.` with the button enabled. A retry sends the same `request` (WS88), so it returns the first outcome if the first call did commit.
  - **The key's life.** The browser makes a fresh `request` when the member presses Buy on a perk, keeps it across retries after an error, and drops it after any definite answer (`bought`, `refused` or a denial).
- **WS88. `buyPerk` is D17's `buyPerk`, behind the Skill tree's gate.** `buyPerk({ perk, request })` in `convex/website/commands.ts` is built on `memberMutation` (WS61).
  - **Arguments.** `perk` is validated by progression's perk validator (#159), so the website accepts exactly what Slack accepts. `request` is a UUID string the browser makes (`crypto.randomUUID()`), validated as one. An argument never names a member.
  - **The gate first.** It checks the Skill tree's page state with query-safe reads: WS55's gate and the Skill tree's entry `open` in `unlocksOf`. If that fails it answers `{ kind: "refused" }` without calling D17, so a website call can never run Unlocks' launch (WS62).
  - **The key.** The command's platform-neutral idempotency key is `website:{member}:{request}`, built on the server from the verified member and the request. A member's key can't collide with another member's or with Slack's, and a repeated call with the same request returns the first outcome stored under that key (P19).
  - **The command.** It then calls D17's `runCommand(ctx, workspace, person, { type: "buyPerk", perk, key })`, as #159 defines it. It answers `{ kind: "bought" }` when the stored outcome is a purchase and `{ kind: "refused" }` otherwise. After `bought` it calls `republish(ctx, member)`, so App Home's Skill tree tab shows the perk owned.
  - **Who decides.** Progression alone decides whether the perk may be bought: opened Skill tree, level, prerequisite, not owned, and the points (P19). The website writes no table itself. Besides the command's own effects (the points spent, the owned perk, the stored outcome and `perkBought`), the call may write only the exposure Slack's click sends (O36) and App Home's scheduled republish.
  - **No refund, no undo.** The website offers no way to undo a purchase, because none exists (P4, P5).
- **WS89. WS10's list grows by the new functions.** WS10's exact list adds `./website/skillTree.ts:getSkillTree`, `./website/book.ts:getBook` and `./website/commands.ts:buyPerk`. WS10's rule text is unchanged. WS64's comparison holds for `buyPerk`: the domain tables and events a website purchase leaves equal those the same purchase through App Home's `Buy` leaves, excluding Slack's `slackReceipts` row, the analytics outbox and scheduled functions, normalising generated IDs, times and the idempotency key's value.

### The Book

- **WS90. The Book read.** `getBook` in `convex/website/book.ts` is built on `memberQuery` and takes `{}`. Besides WS80's answers it answers `{ kind: "book", ladders, timeZone }`:
  - `timeZone` is the member's IANA time zone from the directory, the zone their days count in, so the page prints each date as Slack does.
  - `ladders` holds each shipped ladder in the catalogue's order, each `{ ladder, name, counts, count, tiers, next }`:
    - `ladder` is its stable ID (P60), and `name` and `counts` are the catalogue's copy (`Generosity`, `Kudos given`);
    - `count` is the member's count on that ladder;
    - `tiers` holds its four tiers in order, each `{ tier, name, at, earnedAt }`: `tier` is `bronze`, `silver`, `gold` or `diamond`, `name` is the tier's name (`First Thanks`), `at` the count it needs, and `earnedAt` the stored earned time, or `null`;
    - `next` is the first tier not earned, as `{ tier, at }`, or `null` once all four are.

  Every value comes from Achievements' `achievementsOf(member)` (#163). The website computes no count, tier, threshold or date, and keeps no ladder copy of its own. A fact `achievementsOf` doesn't carry is added by an additive export beside it, never derived in `convex/website/` (cross-map need 2). A ladder that hasn't shipped is absent: today Generosity and Recognition (#163), then Connections, Dependability, Applause, Seasons and Old Friends (#165, #166). Team Spirit and the chime-in ladders appear only once they ship (P78).
- **WS91. Rewards wait for their kind.** A tier's promised reward (P58) is a coin amount, a kudos emoji or a hedgehog, and none of those has shipped, so naming one would tease an unshipped feature (P78). `getBook` carries no reward in this slice, and the page names none. Once a reward's kind ships and its feature is open for the member (P75), a later ticket adds the reward to each tier from `achievementsOf`'s stored promise, the way WS70 shows a quest's coins only once Coins is open.
- **WS92. The Book page.** While `getBook` answers `book`:
  - **Header:** the label `Book`, the RoundHog title `Achievements`, and one line, `Tiers you earn by thanking colleagues and being thanked. Each one is yours for good.`
  - **Ladders:** one plain Quill card per ladder, in the read's order. Achievement pages are reading surfaces, so no corner marks (V2). Each card shows:
    - the ladder's emblem, a hedgehog keyed by ladder ID (V17), in silhouette while no tier is earned (V16);
    - its name and what it counts;
    - while `next` is set, a neutral bar from 0 to the next tier's `at` at `count`, exposed as a progressbar labelled `{count} of {at} for {tier name}` (V4);
    - its four tiers in order. An earned tier shows its medal, its word (`Bronze`), its name and `Earned {date}`, the date printed in `timeZone` (`14 Oct 2026`). The next tier shows its medal unearned, its word, its name, `At {at}` and a neutral `Next` tag. A later tier shows its medal unearned, its word, its name and `At {at}`.
  - **Medals** (V16, V3): a neutral metal disc for the tier with one to four pips, gold and diamond with a static sparkle, and the tier's word printed beside it, so colour is never the only signal (V24). An unearned medal is an outline of the same shape. The four metals are tokens with light and dark values, defined once.
  - **Copy** (P61): it celebrates tiers and may show the next count. It never totals tiers across ladders, never ranks ladders by the closest next tier, never promises that every tier can be reached, and never suggests whom to thank or ask.
  - **Not on this page:** albums and stickers, titles, the prototype's trophy shelf, "closest next tier" card, category pages, tier totals and reward lines (WS91).
- **WS93. Your own Book only.** The Book page shows the signed-in member's own ladders. Recognition's count is kudos received, so it shows only to the member themselves (WS18, #85). The website shows no other member's Book or tiers. Other members' tiers on a profile card come with the profile card (#53), which reads `achievementsOf` when it lands.

### Look, accessibility, order and flags

- **WS94. The look and the checks.** WS23–WS24, WS54 and WS75 hold for every new state, ported fresh from variant E:
  - **Copy:** the prototype's perk lines are replaced by P94's (WS86), and its titles, coin rewards, `{n} of 14 perks owned`, locked later rows and achievement categories are dropped.
  - **Look:** owned nodes, bars and counts are neutral (V4), with no count-ups and no burst on purchase (V8, V9). Medal metals are V3's named exception. Primary marks only the Buy action and the selected node.
  - **axe:** every state passes axe in light and dark, including each metal's 3:1 against its card (V24).
  - **Keyboard:** the path covers the perk nodes (Tab, Enter or Space to select), the details drawer (Esc closes it, and focus returns to the node), `Buy`, the HUD's skill point chip, and the Book's cards in reading order.
  - **Tests:** they drive the live-region announcements of a purchase, a refusal and an error.
  - **Manual pass:** focus order, focus visibility, reduced motion and screen-reader wording, for both pages.
- **WS95. After #171, except the first ticket.** The facts these pages read, `perksOf`, `achievementsOf` and `buyPerk`, and the Book's ship flag, reach `main` only with map #1's ship #171. Tickets 2–7 start only once #171 has merged to `main`. Ticket 1 needs only Unlocks' facts on `main` and part A of the third slice, and proves itself with the Skill tree, whose ship flag `skill-tree` is already on `main`.
- **WS96. No new flag.** Every piece is gated by `website` plus the flags that already gate it in Slack:
  - both pages and the HUD's chip by `xp-levels` and `unlocks` (WS55);
  - the Skill tree, its read, the chip and `buyPerk` by `skill-tree`;
  - the Book and its read by `achievements`.

  Opening either page in production is the product owner's switch on the flag that gates it in Slack, so the website never shows or sells more than Slack does. The reads send no exposure (WS30's reading of O36). `buyPerk` sends the exposure Slack's `Buy` sends, through progression's own code (WS88).

## Implementation Decisions

### Modules

- **Website module (extended, `convex/website/`):**
  - `unlockPath.ts`: `featurePageOf(path, feature)`, with `leaderboardStateOf` built on it.
  - `skillTree.ts` (new): `getSkillTree`, a projection of `perksOf`.
  - `book.ts` (new): `getBook`, a projection of `achievementsOf`.
  - `commands.ts`: `buyPerk`, a thin call into D17's `runCommand` plus `republish`.
  - `getMyProfile` gains `skillPoints`.
- **Progression module (map #1's, after #171):** the website reads `perksOf` and opens nothing new. Where `perksOf` lacks a fact WS83 needs, ticket 2 adds an additive export beside it, with App Home's output unchanged and the module's invariants witnessed through it.
- **Achievements module (map #1's, after #171):** the website reads `achievementsOf`. Where it lacks a fact WS90 needs, ticket 5 adds an additive export beside it, the same way.
- **Unlocks and Commands modules (map #1's):** no code change. The website runs `buyPerk` through `runCommand`, which the Commands spec's summary already allows for "every website command" (#144).
- **Website package (extended, `website/`):**
  - the router's `/skills` and `/book`, and the page registry's two new entries;
  - a generic feature page frame for the `locked` and `ready` states, shared with `/leaderboard`;
  - the skill tree page, its nodes, details and drawer, and the Buy action;
  - the HUD's skill point chip;
  - the Book page, its ladder cards and the medal.

### Contracts

```ts
// convex/website/unlockPath.ts (extended)
export type FeaturePage = { kind: "off" } | { kind: "locked"; level: number } | { kind: "ready" } | { kind: "open" };
export function featurePageOf(path: UnlockPath, feature: Feature): FeaturePage; // WS79
export type PageWaits = Extract<FeaturePage, { kind: "locked" | "ready" }>;

// convex/website/skillTree.ts (ticket 2)
export type PerkNode = {
  perk: PerkId; name: string; copy: string; cost: { skillPoints: number }; requires: string | null;
  state: "owned" | "available" | "unavailable";
  reason: "level" | "requires" | "points" | null;   // only while unavailable
  ownedAt: number | null;                           // only while owned
};
export type SkillTreeAnswer =
  | { kind: "not-found" } | PageWaits
  | { kind: "tree"; skillPoints: number; rows: { level: number; perks: PerkNode[] }[]; chatUrl: string };
export const getSkillTree = memberQuery(async (ctx, me): Promise<SkillTreeAnswer> => …);

// convex/website/book.ts (ticket 5)
export type Tier = "bronze" | "silver" | "gold" | "diamond";
export type LadderCard = {
  ladder: LadderId; name: string; counts: string; count: number;
  tiers: { tier: Tier; name: string; at: number; earnedAt: number | null }[];
  next: { tier: Tier; at: number } | null;
};
export type BookAnswer = { kind: "not-found" } | PageWaits | { kind: "book"; ladders: LadderCard[]; timeZone: string };
export const getBook = memberQuery(async (ctx, me): Promise<BookAnswer> => …);

// convex/website/commands.ts (ticket 4)
export type PurchaseAnswer = { kind: "bought" } | { kind: "refused" };
export const buyPerk = memberMutation({ args: { perk: perkValidator, request: v.string() }, handler: … }); // WS88

// convex/website/profile.ts (extended, ticket 2)
export type MemberProfile = { /* the first three slices' fields */ skillPoints: number | null }; // WS84
```

`PerkId`, `perkValidator` and `LadderId` are progression's and Achievements' own types as #159 and #163 ship them. The website passes `perk` back unchanged as the command's argument and never builds one.

### Data

There is no new table and no migration. The reads use map #1's tables behind `perksOf`, `achievementsOf` and `unlocksOf`, and the directory's time zone. `buyPerk` writes only what D17's `buyPerk` writes, plus App Home's scheduled republish. The only state the website keeps is in the browser: the pending purchase's `request` while it waits for an answer.

### The flags

| Flag | Owner | Subject | Gates on the website | State |
|---|---|---|---|---|
| `website` | this map ([957148](https://us.posthog.com/project/662840/feature_flags/957148)) | workspace | the whole site, every read and command (WS2–WS4, WS61) | sandbox-only |
| `xp-levels` | map #1 ([956733](https://us.posthog.com/project/662840/feature_flags/956733)) | workspace | half of "unlocks apply" (WS55) | sandbox-only |
| `unlocks` | map #1 ([956771](https://us.posthog.com/project/662840/feature_flags/956771)) | workspace | the other half, and the page states (WS79) | sandbox-only |
| `skill-tree` | map #1 (#159, #170) | workspace | the Skill tree: `/skills`, `getSkillTree`, the HUD's chip, `buyPerk` | exists, sandbox-only (#170) |
| `achievements` | map #1 (#163, #170) | workspace | the Book: `/book`, `getBook` | exists, sandbox-only (#170) |

The website creates no flag (WS96). Recommended production order, so a member never sees a page for something Slack can't show:
1. `everyone-board`, `xp-levels` and `unlocks`, as #105's handoff recommends.
2. `website`, after #115.
3. `quests` once #129 has shipped, and `skill-tree` and `achievements` once #171 has shipped, each independently.

### Coherence

These are proposed declarations. Each ticket writes its part and makes `coherence spec --check` pass.

- **Entrances** (`convex/website/WebsiteReads.spec.md`):
  - `query getSkillTree`: a browser asks for the signed-in member's skill tree. Trust `browser`. Ticket 2.
  - `query getBook`: a browser asks for the signed-in member's Book. Trust `browser`. Ticket 5.
  - `mutation buyPerk`: a browser asks to buy one perk for the signed-in member, with the perk and a request ID as its only arguments. Trust `browser`. Ticket 4.
- **Invariants:**
  - *Website reads pass one guard* gains `query getSkillTree` and `query getBook`.
  - *Website commands pass one guard* gains `mutation buyPerk`.
  - *A website command never launches unlocks* gains `mutation buyPerk`, witnessed with `unlocks` on and no launch recorded.
  - *A website command is a D17 command* gains `buyPerk`, compared with App Home's `Buy` as WS89 says.
  - *A skill point bought on the website is spent once* (WS88, P4, P19) is new. Crossing `browser -> domain`, entrance `mutation buyPerk`. It witnesses progression's *a skill point is spent once and never refunded* through the website: the same request twice buys once and answers `bought` twice, and two requests for two perks with one point buy one and refuse the other.
  - *The website shows only shipped features* is witnessed again with `skill-tree` and `achievements` each off: `/skills` and `/book` read `not-found`, and `skillPoints` is `null`.
  - *The Book names nothing unshipped* (WS90, WS91, P78) is new. Crossing `browser -> domain`, entrance `query getBook`. It is witnessed with only #163's two ladders shipped: the answer holds exactly those ladders and no reward.
  - *The public surface is exact* keeps its test, which lists the new functions.
- **Lexicon:** `skill point`, `perk`, `ladder`, `tier` and `achievement` are declared. `Book` is declared by #163. No new term is needed.
- **Journal:** each ticket records its decisions with `coherence decide` and commits the journal with the change.

## Testing Decisions

- **A good test enters at a seam and checks what a member could observe:** what `getMyProfile`, `getSkillTree`, `getBook` and `buyPerk` answer, what they write (read through every table), what the rendered page says and where focus goes. It never tests private helpers.
- **Seams, highest first:**
  1. **The page state** with `convex-test`: `featurePageOf` through `getMyProfile` and each page read, for unlocks not applying, the feature unshipped, locked, ready and open. The nav entry, the home card and the page always agree (WS79). The leaderboard's answers are unchanged.
  2. **The skill tree read** with `convex-test` on `main` after #171: a member who hasn't opened the Skill tree, one with points and no perks, one who owns `spark`, one with no points left, and `skill-tree` off. Each value equals `perksOf` read directly, and `skillPoints` in `getMyProfile` equals the read's (WS83, WS84).
  3. **The purchase** with `convex-test`: each denial writes nothing; an available perk is bought and App Home's republish is scheduled; an owned perk, no points, an unopened Skill tree and `skill-tree` off are refused and change no domain table; the same request twice buys once and answers `bought` twice; two requests for two perks with one point buy one; an unlaunched workspace with `unlocks` on refuses and launches nothing. The same purchase through App Home's `Buy` and through `buyPerk` leaves equal domain tables and events, compared as WS89 says.
  4. **The Book read** with `convex-test` on `main` after #171: before and after the Book is opened, a ladder with no tier, earned tiers with their dates, all four tiers earned (`next` is `null`), and `achievements` off. Each value equals `achievementsOf` read directly, and no reward appears (WS90, WS91).
  5. **The public surface test**, listing the new functions (WS89).
  6. **The browser package** with Vitest and Testing Library, from typed fixtures:
     - the two routes, their tabs, and the not-found, locked and ready pages, with the crate opening in place;
     - the nav, the home's open cards and `Go to {name}`;
     - the Book's locked card sentence;
     - the HUD chip, its count and accessible name, and its absence while `skillPoints` is `null`;
     - the skill tree's nodes in each state, the selection, the details on wide screens and the drawer on narrow ones, `Your perks` and `How perks work`;
     - `Buying…`, `bought` with the live region and focus, `refused` with its reason, an error with retry reusing the request, and a fresh request after a definite answer;
     - the Book's ladder cards, medals, earned dates in the member's time zone, the `Next` tag, the progressbar's label, and a ladder in silhouette;
     - axe in light and dark for every state (WS78–WS94).
- **Proof each ticket owes:**
  - a red test before the change and a green one after;
  - `pnpm gate` green, with heavy runs through `~/dev/fleet/fleet heavy --`;
  - for a ticket that changes what the browser shows, screenshots of the running site in light and dark mode in its pull request, from a disposable local backend on its own ports with the flags on through a recorded local override, plus V24's manual pass;
  - for the purchase, a recorded run on that local backend that buys a perk on the website and shows App Home's Skill tree tab republished with it owned.

  The proof ticket adds screenshots from the sandbox and a check that production's flags answer off.

## Slices

Each ticket is a sub-issue of map #57, sized to one agent session. Each merges into the conductor's integration branch for this slice, **`spec/website-4`**, never into `main` (WS27). The branch starts from `spec/website-3` (part A has landed there), or from `main` once the third slice's part A has shipped (#151), and merges `main` as it moves. Tickets 2–7 also wait for map #1's #171 on `main` (WS95), and the branch merges `main` once #171 has.

Blocking edges (native on GitHub):
- ticket 1 → tickets 2 and 5
- ticket 2 → ticket 3
- ticket 3 → ticket 4
- ticket 5 → ticket 6
- tickets 4 and 6 → ticket 7

The frontier is ticket 1. After #171 and ticket 1, the skill tree lane (2 → 3 → 4) and the Book lane (5 → 6) run in parallel.

1. **The Skill tree and Book pages follow their unlock.** `featurePageOf` with `leaderboardStateOf` built on it, `/skills` and `/book` in the router with their tabs, the locked page and the ready page's crate in place shared with `/leaderboard`, the page registry, the nav, the home's open cards and `Go to {name}`, and the Book's locked-card sentence. Until tickets 3 and 6, an open page shows one hedgehog, `{name} is open. Find it in Slack's App Home.` and one action that opens the workspace in Slack. Proven with the Skill tree, whose ship flag is on `main`. WS78–WS82. Blocked by nothing on this map (part A has landed on `spec/website-3`); no cross-map condition.
2. **The skill tree read.** `getSkillTree` from `perksOf`, `getMyProfile.skillPoints`, any additive export progression needs for WS83, and the Coherence entrance. WS80, WS83, WS84. Blocked by 1, and by #171 on `main` cross-map.
3. **The skill tree page.** The tree, its nodes, the details and drawer, `Your perks`, `How perks work`, and the HUD's skill point chip; an available perk's details read `Buy it in Slack's App Home.` until ticket 4. WS84–WS86, WS94. Blocked by 2, and by #171 on `main` cross-map.
4. **Buy a perk on the website.** `buyPerk` behind the Skill tree's gate and through D17 with the server-built key and App Home's republish, WS10's list, the Buy action with its states and key life, and the Coherence entrance and invariants (*website commands pass one guard*, *a website command never launches unlocks*, *a website command is a D17 command*, *a skill point bought on the website is spent once*). WS87–WS89. Blocked by 3, and by #171 on `main` cross-map.
5. **The Book read.** `getBook` from `achievementsOf` with the member's time zone, any additive export Achievements needs for WS90, and the Coherence entrance and invariant *the Book names nothing unshipped*. WS80, WS90, WS91, WS93. Blocked by 1, and by #171 on `main` cross-map.
6. **The Book page.** The header, the ladder cards, the medal tokens in light and dark, earned dates, the `Next` tag and bar, and the silhouette. WS92–WS94. Blocked by 5, and by #171 on `main` cross-map.
7. **Prove the skill tree and the Book on the sandbox.** Merge `origin/main`, deploy the integration branch to `different-dog-467` (the first slice's rules 1 and 2 for the shared sandbox), and check there:
   - a member below level 5 sees `/skills` locked at level 5, and one below level 4 sees `/book` locked at level 4;
   - a ready member opens the Skill tree on its page, sees the three perks with P94's copy and their skill points in the HUD, buys `spark`, and App Home's Skill tree tab shows it owned;
   - a member with the Book open sees the replayed tiers with their historical dates, in light and dark;
   - production's `skill-tree` and `achievements` answer off.

   Record screenshots in light and dark. Blocked by 4 and 6, and by #171 on `main` cross-map.

## Cross-map needs on map #1

This spec edits nothing on map #1. Map #1's conductor reads these from #57.

1. **Perk facts for the website.** Ticket 2 needs, from `perksOf(member)` as #159 ships it: the unspent skill points; each catalogue perk's ID, display name, P94 copy, row, cost, prerequisite, state and, while it can't be bought, P19's reason as a kind; and each owned perk's time. If #159 ships without some of these, ticket 2 adds additive exports beside `perksOf`, with App Home's output unchanged. Map #1's later skill tree lanes merge `main` and keep them.
2. **Achievement facts for the website.** Ticket 5 needs, from `achievementsOf(member)` as #163 ships it: each shipped ladder's ID, name and what it counts, in catalogue order; the member's count; each tier's ID, name, count and `earnedAt`; and the next tier. It reads the member's time zone from the directory. If #163 ships without some of these, ticket 5 adds additive exports beside `achievementsOf`, the same way.
3. **The website calls `buyPerk` through D17.** Ticket 4 runs `buyPerk` through `runCommand` from the website's entrance with the platform-neutral key `website:{member}:{request}`, as #159 asks ("a request ID from the website's entrance"). The website relies on the key for P19's "returns the first result". It sends the exposure Slack's `Buy` sends, from progression's own code (O36), and republishes App Home through feedback's `republish`.
4. **Tier rewards on the website, later.** When #30, #31 and #96 grant coins, kudos emoji and hedgehogs, the Book shows each tier's reward once its kind's feature is open (WS91). Map #1's conductor tells this map when each ships.
5. **Order of the production switches.** #105's order still holds. `skill-tree` and `achievements` follow `website`'s switch only in the sense that the website shows them once both are on; they stay independent of each other (#170).
6. **Map #1's conductor tells this map when #171 merges**, so tickets 2–7 start.

## Out of Scope

- Game rules in the website: it reads facts and sends commands (#57).
- Rows of the tree beyond row 5, coins in a perk's cost, `focus`'s switch command (P22), and upgrades, until their stopping points ship.
- Tier rewards on the page (WS91), until their kinds ship.
- The sticker book and its albums in the Book, and the Team Spirit and chime-in ladders, until #54 and #32 ship.
- The achievement and level-up band pages (V12), achievement moments on the website (V10), and deep links from Slack's tier DMs into the Book. They need #167's DMs on `main` and a deep link added there.
- Other members' Books and tiers on profile cards (#53).
- Bonus XP lines from perks on the website, and the gate hint (P15), which are Slack's.
- Everything #57 rules out of scope.

## Further Notes

Calls taken at recommendation under the AFK directive:

1. **Two pages, `/skills` and `/book`**, each the web page of its feature, following the architecture prototype's real paths (#64). The Book's page is its achievements page, because achievements are all the Book holds until the sticker book ships; albums join `/book` later rather than living on a second page.
2. **One page state from the unlock path** (`featurePageOf`), generalising the leaderboard's gate, so the nav, the card and the page can't disagree, and the Skill tree's and the Book's predicates (feature flag, `xp-levels`, unlocks applying) are read through the same entry Unlocks lists.
3. **Buying happens on the web.** #159 and #29 name the website as a place to call `buyPerk` through its own entrance, the accepted prototype designs the buy action, and P19's idempotency key makes a retried purchase safe. The quest swap stayed in Slack because its command was still landing; `buyPerk` lands with #171, before ticket 4 starts.
4. **The website's idempotency key** is `website:{member}:{request}`, with `request` a browser UUID kept across retries. WS63's "no key" doesn't fit a purchase, because buying is not idempotent by state across different perks, and P19 asks for the first result.
5. **No confirmation dialog.** Selecting a perk shows its details and the line `A spent skill point never comes back.`; Buy is the second action. A modal on top would be a third step for every purchase.
6. **Buying is not a crate** (V13): no reveal, only the owned state and a live region.
7. **Skill points in the HUD once the Skill tree is open**, replacing WS51, because V1 places them there "once unlocked" and P76 keeps them out of sight before.
8. **Only shipped rows**, so today one row of three perks. The prototype's 14-node tree with locked rows is dropped (P78).
9. **No tier rewards on the page in this slice** (WS91). The ticket asked for each tier's promised reward, but every reward kind is unshipped, and P78 forbids naming them; the reward joins when its kind ships.
10. **No totals or "closest next tier"** on the Book (P61), and no category pages, since seven ladders fit one page.
11. **The Book's own Recognition count stays on the member's own page** (WS18, #85), and no other member's Book is shown.
12. **No new flag** (WS96), as WS77 called it: the pages ride the flags that gate the same features in Slack.
13. **Ticket 1 runs before #171**, so the website lane has a frontier while map #1 builds, and the sandbox's Skill tree, which `skill-tree` already ships there, gets its page states now.

The `to-spec` and `to-tickets` skills can only be started by a human, so this spec follows the earlier slices' layout instead.
