# Spec: the collection: hoggies and team crests from loot crates

> **Accepted on [#454](https://github.com/Silthus/kudos/issues/454) (2026-10-15) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/collection` and is never merged. It answers map #1's decision 25 and builds on decisions 12, 18, 22 and 23. The build runs on the integration branch `spec/collection`, which the conductor cuts from `main` once crate rewards (#424) has merged.
>
> **Rule numbers.** Rules are cited as `CL1`–`CL35`. Crate rewards rules are cited as `CR3`, progression rules as `P35`, hedgehog rules as `HH2`, store rules as `ST13`, coins rules as `CO10`.
>
> **Three stopping points.** 1 (CL1–CL22) is the drop and the Book's hoggies, behind `collection`. 2 (CL23–CL27) is team crests, behind `crests`. 3 (CL28–CL32) is coin-bought crates, behind `crate-store`. Each starts once the one before is on `main`. CL33–CL35 say what this replaces and hold for all three.
>
> Sources: ticket #454 and map #1's decisions 12, 18, 22, 23 and 25 (quoted under "Further Notes"); the code on `main` at `f20c731` (`convex/quests/` `open.ts`, `crates.ts`, `pendingCrates.ts`, `weekly.ts`; `convex/unlocks/unlocks.ts`; `convex/website/` `commands.ts`, `book.ts`; `convex/achievements/ladders.ts`; `convex/store/`; `convex/wallet/`; `convex/analytics/projections.ts`); the crate rewards spec (`spec/crate-rewards.md` on `docs/crate-rewards` at `c077551`: CR3, CR14), the earlier rarity design (`spec/progression.md` on `docs/spec-progression` P35, cut on `docs/spec-progression-v2`), the hedgehogs spec (`spec/hedgehogs.md` on `docs/hedgehogs` at `f4518b6`), the accepted website prototype (`prototype/website-ui`, `book-album.tsx`), `docs/website/visual-language.md` (V21, V22), ADR-0005, and `@posthog/brand` 0.13.0 as `website/package.json` pins it, with brand.posthog.com's hoggie and crest lists (154 hoggies and 59 crests on 2026-10-15, 151 and 55 of them in 0.13.0).

## Problem Statement

A member opens a crate and already knows what's inside: the quest said `+20 XP`, so the crate says `+20 XP`. The website map is turning the open into a loot box, with a lid that bursts and rewards that fly to the header (#452), but there's nothing in the box a member didn't know about. There's also nothing to collect: the Book shows achievement ladders, the sticker book never shipped, hedgehogs were specced as avatars but never built, and the skill tree is now hidden in production.

The product owner, 2026-10-15 (decision 25): the Book becomes a collection of hoggies and team crests, with rarities brought back and duplicates allowed, and "every chest should contain one" collectible, unknown until it is opened.

## Solution

**Every crate a member opens drops one hoggie, drawn by rarity at the open. The Book collects them.**

- **The hoggies.** Every hoggie in the `@posthog/brand` version the repository pins, 151 of them, each with one of five rarities: common, uncommon, rare, epic, legendary. Rarities and their drop weights are versioned catalogue data. The art is the package's, named by slug and never committed.
- **The drop.** Opening a weekly quest's, a Journey step's or a feature's crate draws one hoggie at that moment, never before: a rarity by its weight, then one hoggie of that rarity. The draw is a pure function of the member, the crate and the catalogue version, so a retried open draws the same. It is stored once, so a repeated open answers the same. Duplicates count up.
- **The Book.** The website's Book gains the hoggies: every hoggie, owned ones with their count, the others as silhouettes, and each rarity's chance.
- **The reveal.** The website's crate opens answer what dropped, with its rarity, whether it's new and how many the member now has, so #452's reveal fills its collectible slot. App Home names the latest hoggie found.
- **Team crests (stopping point 2).** Each team crest has a roster of hoggies. A member holding every hoggie on a roster has collected the team, and its crest joins the Book at the drop that completed it.
- **Coin-bought crates (stopping point 3).** A member buys a crate for 50 🪙. It waits like any crate and drops a hoggie when opened.
- **Dark first.** Each stopping point ships behind its own member-decision flag, on in the sandbox and for the product owner's email only (decision 18).

## User Stories

**The drop**
1. As a member, I want every crate I open to give me a hoggie, so that opening a crate is exciting even when I know its XP.
2. As a member, I want not to know which hoggie is inside until I open the crate, so that the open is a surprise.
3. As a member, I want rarer hoggies to drop less often, so that finding a legendary one means something.
4. As a member, I want to see the chance of each rarity, so that I know the odds before I open anything.
5. As a member, I want a weekly quest's, a Journey step's and a new feature's crate all to drop a hoggie, so that every crate means the same thing.
6. As a member, I want a crate opened twice, from a double click, a second device or a retried request, to drop once and show the same hoggie, so that I can't lose or duplicate a drop by accident.
7. As a member, I want a crate I open in Slack and one I open on the website to drop the same way, so that it doesn't matter where I open it.
8. As a member, I want a crate from an earlier week to still drop a hoggie when I open it, so that opening late costs me nothing.
9. As a member, I want duplicates to count up, so that a second Rocket is still worth having.
10. As a member, I want my crate's XP and coins to arrive as they do today beside the hoggie, so that the drop adds to the reward and replaces nothing.

**The Book's hoggies**
11. As a member, I want the Book to show every hoggie, the ones I have with how many and the ones I don't as silhouettes, so that I know what's left to find.
12. As a member, I want to see each hoggie's rarity in the Book, so that I can show off the rare ones.
13. As a member, I want to see how many of all the hoggies I have, and how many of each rarity, so that I can track my progress.
14. As a member, I want to see when I first found each hoggie, so that the Book has a history.
15. As a member, I want hoggies I found never to be taken away, so that they are mine for good.
16. As a member who opened crates before the Book was open to me, I want those hoggies waiting in the Book when it opens, so that nothing I found is lost.

**The reveal**
17. As a member opening a crate on the website, I want the hoggie to burst out with its rarity, so that the open feels like a loot box.
18. As a member, I want the reveal to say when a hoggie is new to me and how many I have now, so that a duplicate reads as a duplicate.
19. As a member opening a crate in Slack, I want App Home to name the hoggie I found, so that I see it without going to the website.
20. As the website's builder, I want the open's answer to carry the drop, stored once, so that a repeated or replayed open never shows a different hoggie.
21. As the website's builder, I want one read of the whole catalogue with counts, rarities and chances, so that the Book's pages need no game rules.

**Team crests (stopping point 2)**
22. As a member, I want each team crest to show the hoggies on its team, so that I know what collecting the team takes.
23. As a member, I want to collect a team's crest once I hold every hoggie on its team, so that finishing a set gives me something more.
24. As a member, I want the crest to arrive at the open that completed the team, in the same reveal, so that I notice it.
25. As a member, I want to see how far along each team I am, so that I know which crests are close.
26. As a member, I want a crest I collected to stay collected, so that it never goes away.

**Coin-bought crates (stopping point 3)**
27. As a member, I want to buy a crate with coins, so that my coins have something fun to buy.
28. As a member, I want to see the crate's price before I buy, and be told plainly when I can't afford it, so that I never guess.
29. As a member, I want a bought crate to wait until I open it, like any crate, so that the open stays the moment.
30. As a member, I want a repeated `Buy` click or a retried request to buy once, so that I never pay twice.

**Rollout**
31. As the product owner, I want each stopping point behind its own flag, on in the sandbox and for my email only (decision 18), so that I try it before anyone else.
32. As the product owner, I want production unchanged while the flag is off, so that shipping is dark.
33. As the product owner, I want turning a flag off to take nothing away, so that ending a preview is safe.
34. As a member who isn't previewing, I want nothing to change for me while someone else previews.

## Rules

"`collection` is on for a member" means the flag answers true in their member decision. "The Book is open" means the member opened the `book` feature (P73), as `getBook` reads it today.

### Stopping point 1: the drop and the Book's hoggies

#### The catalogue

- **CL1. Hoggies.** A hoggie is an official PostHog hedgehog illustration from `@posthog/brand`, collected in the Book. Its ID is its slug in the pinned package, its name is the package's name for it, and it has exactly one rarity. A hoggie with numbered variants is one hoggie, drawn as its first variant. Hoggies are not items: they fill no slot, are never sold, granted by the store or used as kudos emoji.
- **CL2. The catalogue.** The hoggie catalogue is versioned code. Version `1` holds every hoggie in `@posthog/brand` 0.13.0, 151 of them, with the rarities in the appendix. IDs are never reused and a hoggie never leaves the catalogue. A later version can add hoggies (the three on brand.posthog.com that 0.13.0 lacks arrive with a package bump) or change rarities and weights. A change applies to draws from then on, never to a stored drop.
- **CL3. Rarities.** Five, from P35: common, uncommon, rare, epic, legendary. Each is shown as a coloured square and its word, `⬜ Common`, `🟩 Uncommon`, `🟦 Rare`, `🟪 Epic`, `🟧 Legendary`, so it never reads by colour alone. Rarity says nothing about any kudos.
- **CL4. Weights.** Version `1` weights the rarities common 50, uncommon 28, rare 14, epic 6, legendary 2. They add up to 100, so each is its rarity's chance per drop in percent. Every rarity holds at least one hoggie, so every weight can be drawn.
- **CL5. The art.** A hoggie's art is `{ kind: "hoggie"; slug }`. The website draws it from the package it bundles (ADR-0005). Every answer carries slugs, never URLs. The repository commits no art, and Slack shows a hoggie's name and rarity, never its picture. The catalogue's test proves every slug has art in the pinned package; should one ever lack it, the website draws a silhouette.

#### The drop

- **CL6. Which crates drop.** A crate drops a hoggie when a member opens it themselves while `collection` is on for them. Its **crate key** names it:
  - a weekly quest's crate, `weekly:{week}:{slot}`, and a Journey step's crate, `journey:{step}`: the reward keys `openQuestCrate` already uses;
  - a feature's crate, `unlock:{feature}`, opened by `openUnlock`.

  A feature opened by a launch (`keepOpen` with `byLaunch`) opened no crate and drops nothing. Tiers and levels have no crate and drop nothing.
- **CL7. At the open, once.** The drop is drawn and stored in the mutation of the crate's first successful open, after the open's own writes (CR3's `applied` included) and before `questOpened` or `unlockOpened` is published. A refused open, and every open after the first, draws nothing and writes no drop record. (A repeated website open still republishes App Home, as it does on `main`.) `collection` is read there with exposure, only for an open that succeeds, so its exposure is sent only where it decides something.
- **CL8. The draw.** The draw is a pure function of a deployment secret, the member's ID, the crate key and the catalogue version:
  1. `d = SHA-256("{secret}:{member}:{crateKey}:{version}")`, through Web Crypto;
  2. `r`, its first 4 bytes as an unsigned integer divided by 2³², picks the rarity whose cumulative weight range, in CL3's order, holds `r × 100`;
  3. `h`, its next 4 bytes likewise, picks the hoggie at index `floor(h × n)` among that rarity's `n` hoggies, in catalogue order.

  The secret is the Convex environment variable `HOGGIE_DRAW_SECRET`, set once per deployment and never changed, so nobody who knows the algorithm, the catalogue and a member's IDs can compute an unopened crate's hoggie. Where it is unset (local backends and tests) the draw uses the empty string. An open retried by Convex draws the same hoggie, and no read answers a drop before the open.
- **CL9. The drop record.** A drop is stored as one insert-only record `{ member, crate, hoggie, rarity, n, copy, catalogueVersion, at }`, unique per member and crate key. `n` is the member's drop sequence: 1 for their first drop, then one more for each, so it totally orders a member's drops even within one millisecond. `copy` is how many of that hoggie the member holds with this one, so the first is `1`. `at` is the open's time. Beside the history, the module keeps a **tally** per member and hoggie, `{ member, hoggie, count, firstAt, firstN }`, and one per member, `{ member, drops }`, written in the drop's mutation, so a drop and every read stay bounded by the catalogue's size, never the member's history. Only the hoggies module writes drop records and tallies.
- **CL10. Duplicates count up.** A member holds a hoggie's tally `count`, which equals its drop records. Nothing converts, trades or spends a duplicate in this spec.
- **CL11. Nothing is taken back.** A drop record is never changed or deleted. Turning `collection` off hides the hoggies and stops new drops. It takes nothing away, and turning it on again shows the same hoggies. A crate opened while `collection` was off stays without a drop: nothing draws for it later.
- **CL12. The crate's reward is unchanged.** The drop adds to what the open does today. A quest's or Journey step's XP and coins apply as crate rewards says (CR3), and a feature opens as P73 says. Coins come out of crates through their rewards; this stopping point drops no random coins.

#### Showing it

- **CL13. Who sees what.** A drop is shown in the open that made it while `collection` is on for the member, whether or not the Book is open: it is what the crate held. The Book's hoggies (CL15, CL17) are shown while `collection` is on and the Book is open. Hoggies found before the Book opened wait there (ADR-0006).
- **CL14. The open's answer.** The website's `openQuestCrate` and `openFeature` answers gain `drop` while `collection` is on for the member:

  ```ts
  type HoggieArt = { kind: "hoggie"; slug: string };
  type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
  type Drop = { hoggie: string; name: string; rarity: Rarity; art: HoggieArt; copy: number; isNew: boolean };
  // openQuestCrate: { kind: "opened"; applied: Applied | null; drop: Drop | null } | { kind: "refused" }
  // openFeature:    { kind: "opened"; drop: Drop | null } | { kind: "refused" }
  ```

  `Drop` is one type, identical in every answer that carries it (and in `openCrate`'s, CL30, and the activity's, CL21). `drop` is read from the stored drop record after the command runs, never drawn again, so a repeated or replayed call answers the same. `isNew` is `copy === 1`. It is null where the crate has no drop (opened while `collection` was off). While `collection` is off for the member, the answers have no `drop` field at all, exactly as `main` answers. `applied` stays as CR14 says.
- **CL15. `getCollection`.** A website member query:

  ```ts
  type CollectionAnswer =
    | { kind: "not-found" } // collection off for the member
    | PageWaits // the Book isn't open yet, as getBook answers
    | {
        kind: "collection";
        rarities: Array<{ rarity: Rarity; chance: number; owned: number; total: number }>;
        hoggies: Array<{ hoggie: string; name: string; rarity: Rarity; art: HoggieArt; count: number; firstAt: number | null; seen: string | null }>;
        owned: number; // distinct hoggies held
        total: number; // hoggies in the catalogue
      };
  ```

  `rarities` is in CL3's order, common first and legendary last, `chance` its weight. `PageWaits` is exactly `getBook`'s. `hoggies` is every catalogue hoggie, in catalogue order, with `count` 0 and `firstAt` null for one not held. `seen` is the website's member-scoped seen key `seenKeyOf(member, "hoggie:{hoggie}:{firstAt}")` for a held hoggie, so the Book can mark new arrivals as it marks new tiers. It reads the member's tallies through one index range, at most one row per catalogue hoggie, never the drop history.
- **CL16. App Home.** While `collection` is on and the Book is open, both App Home views (the profile and the front door's summary) carry one line after the crates: `Hoggies: {owned} of {total} · last found: {name} ({⬜ Common})`, with a link to the Book on the website. A member with no drop sees `Hoggies: 0 of 151 · every crate you open drops one.` A crate opened in Slack sends no new message (decision 22): the open's App Home republish shows the line.
- **CL17. Events.** The drop publishes `hoggieDropped { workspace, member, crate, hoggie, rarity, copy, at }` on the bus, and analytics projects it as the product event `hoggie dropped` with `rarity`, `is_new` and `crate_kind` (`weekly`, `journey` or `unlock`, and `bought` from stopping point 3), never the hoggie's name. Nothing else subscribes in this stopping point.

#### Rollout

- **CL18. The flag.** `collection`, a member decision, `safeDefault: false`. It starts on for `environment = sandbox` and the product owner's email only (decision 18). With it off, unset or the flags key missing, every Slack call, website read and table write equals `main`'s, apart from the flag's own exposure row and its `$feature_flag_called` event. Queries read it without exposure.
- **CL19. Widening.** After the product owner has tried it, the conductor asks him before turning `collection` on in production. No backfill runs when it widens (CL11).
- **CL20. Coherence.** The hoggies module's component spec carries the invariants **a crate drops at most one hoggie** (refuted by a second open writing a second drop, or a retried open drawing a different hoggie), **a drop never changes** (refuted by a later catalogue version changing a stored drop's rarity in a read) and, as the gate's oracle, **the hoggies are dark where `collection` is off**.
- **CL21. The activity.** While `collection` is on for the member, their activity timeline gains a `found` entry for each drop, at its drop record's `at`: `{ kind: "found"; at; key; drop: Drop }`, `key` encoding only a position, as the activity's other entries do. It shows under the `all` filter only, never `received` or `given`. A page reads the member's drops through one more index range on `by_member_at` (`member`, `at`, then `n`), from the cursor down, at most one more than the page size, and each entry is read whole from its drop record (its crest included, CL24), so a page adds at most its size plus one document reads and one range, far inside the activity's read budget. With the flag off the timeline equals `main`'s.

### Stopping point 2: team crests

- **CL22. Crests.** A crest is a team's crest from `@posthog/brand`, with the team's name. Its ID is its slug in the pinned package. The catalogue goes to version `2` with the 54 crests 0.13.0 holds, apart from `a-default-crest`, a placeholder with no team. Each crest has a **roster**: two to four hoggies from the appendix. Every version `1` hoggie is on exactly one roster, so a member who holds every one of them holds every crest. A published roster never changes: later versions can add crests with rosters of hoggies they add, never move, add or remove a hoggie on a published roster, so a collected crest can't be uncollected. Rarities and weights don't change in version `2`.
- **CL23. Collecting a team.** A member has collected a crest once their tallies hold at least one of every hoggie on its roster. It was collected at the `firstAt` of the roster hoggie with the highest `firstN`: the drop that completed it. Tallies only grow and rosters never change, so a collected crest stays collected and is collected once. It is read from the tallies, never stored as its own record. A member who held a whole roster before version `2` shipped has collected it at that earlier time, silently.
- **CL24. The reveal.** A drop drawn under catalogue version `2` or later stores, at its insert, `crest`: the crest it completed, when it is `copy` 1 and the tallies then hold every other hoggie on its roster, or null. `Drop` gains `crest: { crest: string; name: string; art: { kind: "crest"; slug: string } } | null`, read from the drop record, so a repeated call answers the same and no drop from before version `2` ever answers a crest. Crests are recorded on drops whatever `crests` says, as part of the drop, and shown only by CL25.
- **CL25. Showing crests.** While `crests` and `collection` are on and the Book is open, `getCollection` gains `crests: Array<{ crest; name; art; roster: string[]; held: number; collectedAt: number | null; seen: string | null }>`, in catalogue order, `held` counting the roster hoggies held, `seen` keyed `crest:{crest}:{collectedAt}`. App Home's line gains ` · {n} crests`. With `crests` off, `getCollection` and the drop answer have no `crests` and no `crest`.
- **CL26. The flag.** `crests`, a member decision, `safeDefault: false`, sandbox plus the product owner's email, read without exposure in queries and with exposure in the open that would answer a `crest`. It shows only: crests are derived, so nothing is written behind it.

### Stopping point 3: coin-bought crates

- **CL27. Buying.** `buyCrate { next }`, a D17 command, sells the member's crate number `next` for 50 🪙, the price being catalogue data. It is safe to repeat by state, as `equip` is: `next` must be the member's bought crates so far plus one. A `next` already bought answers `{ kind: "bought", crate: "bought:{next}" }` again and writes nothing, so a double click, a second device or a retried request buys once. Any other `next` refuses with `stale`. Then it checks `coins-not-open` (coins aren't visible to the member, CO13), then the wallet's spend step with `{ crate }` (`no-coins`, CO10). A purchase that passes spends the price, stores the bought crate `{ member, crate: "bought:{next}", boughtAt }` and publishes `crateBought`, all in one mutation. A refusal writes nothing. It answers null and writes nothing where `crate-store` or `collection` is off for the member.
- **CL28. A bought crate waits.** It is a crate like any other (CL6): it waits until the member opens it with `openCrate { crate }`, a D17 command, and its open draws the drop by CL7–CL9. `openCrate` refuses, writing nothing, a crate that isn't the member's bought crate or is already opened (a repeat answers its stored drop instead), and while `collection` is off for the member, so the crate keeps waiting and drops when it's back on. Turning `crate-store` off stops buying only: bought crates stay listed and openable while `collection` is on. A bought crate holds no XP and no coins, and never expires.
- **CL29. Slack.** App Home lists waiting bought crates under `Waiting to open` with `Open` while `collection` is on, and, while `crate-store` is on and coins are visible, the hoggies line gains a `Buy a crate · 50 🪙` button carrying `next`, which asks `Buy a crate for 50 🪙?` before it runs. A `no-coins` refusal shows in App Home as `You need {price − balance} more 🪙.`; a `stale` click shows nothing new, since the republish already shows the crate.
- **CL30. The website.** `getCollection` gains `bought: string[]`, the member's waiting bought crates, whenever it answers a collection, and `crateStore: { price: number; next: number } | null`, null where `crate-store` is off or coins aren't visible. The website's `buyCrate { next }` answers `{ kind: "bought"; crate: string } | { kind: "refused"; reason: "stale" | "coins-not-open" | "no-coins" } | null`, and `openCrate { crate }` answers `{ kind: "opened"; drop: Drop } | { kind: "refused" }`.
- **CL31. The flag.** `crate-store`, a member decision, `safeDefault: false`, sandbox plus the product owner's email, read with exposure in `buyCrate`.

### What this replaces

- **CL32. Hedgehogs (#96).** Superseded: hedgehog avatars, hedgehog items, the `hedgehogs` unlock's collection and quest items are not built. Hoggies are what members collect. The level 7 `hedgehogs` entry in the unlock schedule and the gold and diamond tiers' `hedgehog` rewards stay as they are on `main`: never granted, and never shown (`getBook` already drops them). A later ticket decides what those tiers give instead.
- **CL33. The sticker book and its albums (#54).** Replaced by team crests (CL22–CL26). They were never built, so nothing moves.
- **CL34. The store's kudos emoji (#31) and tier rewards.** Unchanged and kept: owned kudos emoji stay owned, the store stays behind `store`, bronze and diamond tiers keep paying coins and silver tiers their kudos emoji. Coins gain crates to buy (CL27), and hoggies are never sold.
- **CL35. The skill tree.** Hidden in production by the conductor (`skill-tree` sandbox-only, decision 25). Nothing here changes it.

## Implementation Decisions

- **A new module, `hoggies`**, owns the hoggie catalogue (with rarities, weights and, from stopping point 2, crests and rosters), the draw, the drop records, `hoggiesShownTo` (the `collection` flag), the drop reads (`dropOf(member, crateKey)`, `hoggiesOf(member)`) and, in stopping point 3, bought crates. It knows nothing about why a crate was opened. It exposes one write, `dropFor(ctx, member, crateKey, at)`, which reads the flag with exposure, draws, inserts and publishes, or does nothing where the crate already dropped or `collection` is off.
- **Quests**: `openQuestCrate` calls `dropFor` after its own writes, for a first successful open. **Unlocks**: `openUnlock` calls it for a member's own open, never `keepOpen` from a launch.
- **Website**: `openQuestCrate` and `openFeature` answer `drop` from `dropOf` after `runCommand`, beside CR14's `applied`. `getCollection` is a new member query, gated like `getBook`. Stopping point 3 adds `buyCrate` and `openCrate` through `runCommand`.
- **Feedback**: App Home's hoggies line (CL16) in both views, from `hoggiesOf`. No DM, reply or notice changes.
- **Activity**: a third stream beside kudos received and given, read through the hoggies module's exported `dropsNewestFirst(member, before)`, never its table (CL21).
- **Analytics**: the `hoggie dropped` projection (CL17).
- **Wallet** (stopping point 3): a spend record's `paid for` gains `{ crate }`. The spend step is unchanged.
- **Schema**: `drops` with indexes `by_member_crate` and `by_member_at` (`member`, `at`, `n`); `hoggieTallies` by member and hoggie; `dropTallies` by member. Stopping point 3: `boughtCrates` by member and crate.
- **Catalogue data**: the appendix as code, with a test that every slug exists in the pinned package and every rarity holds a hoggie, and (version `2`) that rosters partition the hoggies, two to four each.
- **Lexicon**: declare **hoggie** and **crest** and **drop record**; redefine **rarity** (a hoggie's), **drop** (one hoggie per opened crate, drawn at the open) and **crate** (its open can drop a hoggie that nobody knows before); widen **Book** with the hoggies and crests; **sticker book** and **sticker** stay as written until a human retires them (#54 is shelved). One term at a time.
- **Coherence**: a `Hoggies` component spec with CL20's invariants. Quests' invariant on opening a crate (on `main` **opening a crate grants nothing**, after crate rewards **opening a crate applies its held reward once**) gains in its prose that the open also drops at most one hoggie, decided at the open, and the Unlocks spec says the same of a member's own feature open. A journal decision quotes decision 25.

## Testing Decisions

- **Good tests** drive the system from the outside: signed Slack interactivity payloads through the HTTP router for App Home's `Open`, and the website's member mutations and queries, with `convex-test`, Slack and PostHog stubbed at `fetch`. They assert what the website answers and what Slack is asked to publish, never tables, except the every-table equality the flag's dark proof uses. Times come from `settleInTimeOrder`.
- **Ticket 1, the drop** (prior art: `convex/website/openQuestCrate.test.ts`, `convex/quests/crates.test.ts`, `journey.test.ts`, `convex/unlocks/unlocks.test.ts`): opening a weekly quest's, a Journey step's and a feature's crate from App Home and from the website each answers one drop; a second open, a website open after a Slack open, and a replayed request answer the same drop and write nothing; a launch-opened feature drops nothing; with `collection` off nothing drops and every table equals `main`'s; the same member, crate and version draw the same hoggie in two fresh backends; over 10,000 crate keys each rarity's share is within one percentage point of its weight; a member's second drop of one hoggie has `copy` 2 and `isNew` false; the exposure is sent once per member and value, only on a successful open. The answer's `applied` stays as CR14.
- **Ticket 2, the Book and App Home** (prior art: `convex/website/book.test.ts`, `progressionHome.test.ts`): `getCollection` answers `not-found` with the flag off, the Book's `PageWaits` before it opens, and every hoggie with counts, first times, rarity totals and chances after; a drop found before the Book opened shows once it opens; App Home's line, byte for byte, with no drop, after drops, in both views, and absent with the flag off or the Book closed.
- **Ticket 3, the activity** (prior art: `convex/website/activity.test.ts`, `activityEarned.test.ts`): a `found` entry per drop in time order between kudos entries, under `all` only, paging across a cursor without repeats, absent with the flag off; a page of a member with many kudos and drops stays under the limits with `transactionLimits: true`.
- **Ticket 4, crests** (prior art: the same files): a roster completed by its last hoggie answers `crest` on that drop only, and again on a repeated call; two roster hoggies dropped in the same millisecond complete the crest on the higher `n`; a duplicate never answers a crest; `getCollection`'s `held` and `collectedAt`; a member holding a roster before version `2` shows it collected at the earlier time and no drop answers it; with `crests` off nothing shows, and the drop records still carry their crests.
- **Ticket 5, coin-bought crates** (prior art: `convex/website/buyPerk.test.ts`, the store's `buyItem` tests): buy with and without enough coins; the same `next` twice (a Slack double click with two trigger IDs, and two website calls) buys once; a stale `next` refuses; two crates bought in order; the bought crate waits, opens once and drops with `crate_kind` `bought`; an open with `collection` off refuses and the crate waits; with `crate-store` off a bought crate still opens; the wallet's balance equals its records minus spends; `crate-store` off answers null and writes nothing.
- The gate tickets prove each flag at the Slack and website boundaries: off, unset and missing-key equal `main`; on for one member's email only changes only that member.

## Out of Scope

- The website's reveal, its collectible slot and the Book's pages (map #57: #452, #453 and the tickets it cuts against `getCollection`).
- Trading or exchanging duplicates, giving hoggies away, or converting duplicates into anything.
- Hoggies as avatars, kudos emoji or store items; selling hoggies.
- A hoggie's picture in Slack.
- Random coin drops; crates from tiers or levels; what gold and diamond tiers give instead of a hedgehog.
- Pity timers, guaranteed rarities or rising chances.
- Mapping workspace groups to crests (V21's team mapping stays the website's), and the sticker book.
- Expiring crates or reminders about unopened ones.

## Appendix: catalogue version 1 rarities and version 2 rosters

**Legendary (6):** `dr-manhattan`, `final-evolution`, `rocket`, `superhero`, `transformer`, `wizard`

**Epic (15):** `angel`, `back-to-the-future`, `driving-hogzilla`, `evel`, `gladiator`, `jack-dawson`, `katy-perry`, `level-up`, `oprah`, `pope`, `reaper`, `scott-pilgrim`, `steve-jobs`, `terminator`, `the-bride`

**Rare (30):** `70s-dance`, `996`, `ape`, `art-thief`, `boombox`, `business-evolution`, `campfire-cowboy`, `caveman`, `cool-car`, `desk-wizard`, `director`, `dj`, `doc-brown`, `einstein-group`, `gatsby`, `hogpatch`, `im-the-driver`, `mountie`, `mr-potato-head`, `noir`, `pinata`, `puzzle`, `reading-is-magic`, `robot`, `roller-coaster`, `rose`, `sailor`, `two-player`, `will-smith`, `x-ray`

**Uncommon (40):** `basketball-coach`, `burning-money`, `cake`, `caribana`, `chef`, `climber`, `coding-group`, `cowboy-lasso`, `dadd-ai`, `data-thief`, `doctor`, `drake-nah`, `drake-yah`, `dynamite`, `einstein`, `explorer`, `float`, `football-coach`, `football-player`, `gravedigger`, `greek`, `haha-bizzniss`, `hand-clasp`, `hipster`, `judge`, `lemon-wrangler`, `lifeguard`, `loops`, `namaste`, `pit-viper`, `reporter`, `safari`, `scientist`, `scorpion`, `soapbox`, `surfer`, `swimmer`, `tourist`, `town-crier`, `traffic-controller`

**Common (60):** `asleep`, `ball`, `banana`, `beaker`, `burger`, `card`, `cereal`, `chart`, `coconut`, `code-bubble`, `coffee-cup`, `coffee-run`, `commuter`, `construction`, `croissant`, `cursor`, `doll-house`, `error`, `experiment`, `gardener`, `heart`, `honey`, `hooligan`, `hoot`, `hot-popcorn`, `hourglass`, `ipad`, `lemonade`, `magnifying-glass`, `mailbox`, `megaphone`, `money`, `office-worker`, `organized`, `panic`, `party`, `pearl-necklace`, `phone-call`, `reading`, `remote-work`, `research`, `self-driving`, `selfie`, `shocked`, `sitting`, `sleepy`, `soccer-coach`, `speaker`, `stamp-approved`, `stamp-denied`, `star`, `stop`, `success`, `sunburn`, `survey`, `toilet`, `traffic-police`, `trenchcoat`, `waiter`, `workflows`

Catalogue order within a rarity is the order above.

**Rosters (version 2).** Thematic where a hoggie fits the team, filled so each roster mixes rarities: at most one legendary, and at least one common or uncommon.

| Crest | Team | Hoggies |
|---|---|---|
| `ai-gateway` | AI Gateway | `transformer`, `traffic-controller`, `cursor` |
| `ai-observability` | AI Observability | `robot`, `noir`, `magnifying-glass` |
| `ai-research` | AI Research | `research`, `scientist`, `einstein`, `reading-is-magic` |
| `analytics-platform` | Analytics Platform | `einstein-group`, `hourglass`, `coffee-cup` |
| `apm` | APM | `roller-coaster`, `dynamite` |
| `batch-exports` | Batch Exports | `coffee-run`, `waiter` |
| `billing` | Billing | `money`, `burning-money`, `gatsby` |
| `blitzscale` | Blitzscale | `rocket`, `level-up`, `pit-viper` |
| `builder-relations` | Builder Relations | `hand-clasp`, `puzzle`, `honey` |
| `clickhouse` | Clickhouse | `x-ray`, `doll-house`, `gravedigger` |
| `client-libraries` | Client Libraries | `dj`, `code-bubble`, `coding-group` |
| `cloud-foundations` | Cloud Foundations | `construction`, `climber` |
| `cloud-platform` | Cloud Platform | `float`, `remote-work`, `katy-perry` |
| `conversations` | Conversations | `mailbox`, `phone-call`, `speaker` |
| `customer-analytics` | Customer Analytics | `oprah`, `commuter`, `selfie` |
| `customer-success-eu` | Customer Success EU | `gladiator`, `croissant`, `hooligan` |
| `customer-success-na` | Customer Success NA | `mountie`, `burger`, `football-player` |
| `data-modeling` | Data Modeling | `organized`, `mr-potato-head`, `office-worker` |
| `data-tools` | Data Tools | `dr-manhattan`, `doc-brown`, `data-thief` |
| `demand-gen` | Demand Gen | `cowboy-lasso`, `town-crier`, `lemonade` |
| `dev-experience` | Dev Experience | `996`, `cereal`, `hipster` |
| `editorial` | Editorial | `reporter`, `greek`, `soapbox` |
| `error-tracking` | `Error Tracking` | `error`, `panic`, `stop`, `reaper` |
| `experiments` | Experiments | `experiment`, `beaker`, `doctor` |
| `feature-flags` | Feature Flags | `drake-nah`, `drake-yah`, `card` |
| `forward-deployed-engineering` | Forward Deployed Engineering | `explorer`, `safari`, `campfire-cowboy` |
| `graphics` | Graphics | `jack-dawson`, `art-thief`, `caribana` |
| `growth` | Growth | `final-evolution`, `ape`, `caveman`, `success` |
| `gtm-engineering` | GTM Engineering | `trenchcoat`, `ipad` |
| `ingestion` | Ingestion | `chef`, `toilet` |
| `managed-warehouse` | Managed Warehouse | `swimmer`, `the-bride` |
| `marketing` | Marketing | `megaphone`, `party`, `cake` |
| `mcp-analytics` | MCP Analytics | `pope`, `banana` |
| `new-business-sales` | New Business Sales | `steve-jobs`, `business-evolution`, `haha-bizzniss` |
| `onboarding` | Onboarding | `tourist`, `sitting` |
| `people-ops` | People & Ops | `heart`, `namaste`, `coconut` |
| `platform-features` | Platform Features | `superhero`, `pearl-necklace` |
| `platform-ux` | Platform UX | `rose`, `ball` |
| `posthog-desktop` | Posthog Desktop | `evel`, `asleep`, `two-player` |
| `product-analytics` | Product Analytics | `chart`, `back-to-the-future`, `sailor` |
| `product-lead-sales-east` | Product Lead Sales East | `dadd-ai`, `will-smith` |
| `product-led-sales-west` | Product Led Sales West | `lemon-wrangler`, `scorpion` |
| `replay` | Replay | `director`, `hot-popcorn`, `sleepy` |
| `security` | Security | `traffic-police`, `stamp-denied`, `judge` |
| `self-driving` | Self-driving | `self-driving`, `driving-hogzilla`, `cool-car`, `im-the-driver` |
| `support` | Support | `lifeguard`, `angel` |
| `surveys` | Surveys | `survey`, `stamp-approved`, `star` |
| `talent` | Talent | `basketball-coach`, `football-coach`, `soccer-coach` |
| `warehouse-sources` | Warehouse Sources | `pinata`, `hoot` |
| `web-analytics` | Web Analytics | `surfer`, `sunburn` |
| `website` | Website | `hogpatch`, `gardener` |
| `wizard-docs` | Wizard & Docs | `wizard`, `desk-wizard`, `reading` |
| `workflows` | Workflows | `workflows`, `loops`, `terminator` |
| `youtube` | Youtube | `scott-pilgrim`, `boombox`, `70s-dance`, `shocked` |

Published rosters are frozen (CL22). Hoggies a later package adds can form new crests' rosters.

## Review

A GPT-6.1 Sol review (high) of the first draft found 9 majors and 3 minors. All 12 were fixed:

1. **Major: `drop: null` broke flag-off equality with `main`.** The answers have no `drop` field while `collection` is off (CL14).
2. **Major: bought crates had no rollback contract.** `openCrate` refuses while `collection` is off and the crate waits. Turning `crate-store` off stops buying only, and the open checks ownership (CL28).
3. **Major: a Slack double click could buy two crates**, since Slack keys commands by trigger. `buyCrate { next }` is safe to repeat by state (CL27).
4. **Major: swapping roster hoggies could take a crest away.** Published rosters are frozen (CL22).
5. **Major: old drops could answer a crest.** A drop records its crest at insert, only under version `2` or later (CL24).
6. **Major: drops in the same millisecond could hide a crest.** A per-member drop sequence `n` orders them (CL9, CL23).
7. **Major: reads grew with a member's history.** Tallies per member and hoggie bound the drop and every read (CL9, CL15).
8. **Major: the activity's read budget lacked an index and its crest lookups.** It has `by_member_at`, and crests are read from the drop record (CL21, CL24).
9. **Major: a public algorithm let anyone compute an unopened crate.** The draw is keyed by a deployment secret (CL8).
10. **Minor: a repeated website open still republishes App Home.** The guarantee covers drop records. The republish stays as on `main` (CL7).
11. **Minor: `crate_kind` had no value for bought crates.** It gains `bought` (CL17).
12. **Minor: the website's buy contract was incomplete.** `buyCrate`'s request, answer and reasons are spelled out (CL30).

## Further Notes

**The product owner's words this spec builds on, verbatim** (decision 25, 2026-10-15, relayed by map #57's conductor on #454):

1. "Hide the skill tree from production for now… We don't need to undo it."
2. Coins: "You can have them in chests as well, and then maybe you can buy loot chests with those coins."
3. The Book: members collect hoggies and team crests; "once you collect the whole team, you collect this crest sticker in the book"; keep it super simple, and "bring back the rarity system we had originally scrapped"; duplicates allowed ("collect multiples"), exchanging may come later.
4. Crates: "Every chest should contain one" collectible, chosen at random by rarity, unknown until opened.
5. The loot box (#452): "You don't know what you get before you open the crate, so I want this kind of addictive loot box style."
6. Decision 18 (2026-10-14): "Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on."
7. Decision 12 (2026-10-13) cut "drops, rarities"; decision 25 brings rarities back for hoggies, and drops come back as one per opened crate, not the old per-kudos chance (P40–P44 stay cut).

**The website conductor's answer** (map #57, 2026-10-15) accepted the contract: `drop` is a sibling of `applied`, and the reveal plays the rewards, then the hoggie card with its rarity; `Drop` stays identical on `openQuestCrate`, `openFeature` and `openCrate`; `getCollection` is its own query, feeding a Collection page in the Book, with `PageWaits` exactly as `getBook` answers; `rarities` runs common to legendary and the website groups hoggies by rarity itself; the website maps slugs to art from `@posthog/brand` 0.13.0 itself and draws a silhouette for a slug without art. It asked for the drop on the activity timeline in stopping point 1 if the read budget allows, which it does (CL21). Map #57 owns amending its visual language: V13 (a crate "never decides" what it holds) and "There are no rarity colours" give way to CL3 and CL8.

**Calls taken at recommendation** are listed with their journal IDs in the resolution on #454.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
