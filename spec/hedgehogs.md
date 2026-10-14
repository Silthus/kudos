# Spec: hedgehogs, the collectable avatars

> **Accepted on [#96](https://github.com/Silthus/kudos/issues/96) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/hedgehogs` and is never merged. It is progression stopping point 7. It builds on the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P5, P31, P34, P36, P39, P58, P62, P65, P72–P78, P86–P93), the coins spec (`spec/coins.md` on `docs/coins` at `a659a84`: CO1, CO7, CO10, CO13, CO26, CO28, CO30), the store spec (`spec/store.md` on `docs/store` at `c5d848a`: ST1, ST5–ST7, ST13–ST17, ST20, ST22, ST25–ST30) and the profile card spec (`spec/profile-card.md` on `docs/profile-card` at `ae08632`: PC9, PC14, PC15). Where this spec and P39, P86, P90 or ST26 differ, this spec wins and says why under "Further Notes".
>
> **Rule numbers.** Rules are cited as `HH1`–`HH34`. Store rules are cited as `ST13`, coins rules as `CO30`, progression rules as `P39`, profile card rules as `PC14`, website rules as `WS340`.
>
> **Two stopping points.** 7a (HH1–HH29) is the hedgehogs themselves, on `spec/hedgehogs` behind `hedgehogs`. 7b (HH30–HH34) is quest item rewards, kudos emoji and hedgehogs alike, on `spec/quest-items` behind `quest-items`. 7b starts once 7a is on `main`.
>
> Sources: ticket #96 and its amendment by #97; map #1's decisions 11, 12, 13 and 18 (quoted under "Further Notes"); the code on `main` at `d0abca6` (`convex/unlocks/`, `convex/achievements/`, `convex/quests/`, `convex/feedback/`, `convex/website/`, `convex/engine/`); the store slice planned on #341–#347 and the profile card on #305–#307; the website map's needs (map #57, `spec/website-7.md` on `docs/spec-website-7`: WS340–WS342, WS347, WS348; website tickets #282, #284, #287, #291, #293, #297–#300), whose conductor accepted this contract on 2026-10-14; the accepted website prototype's catalogue (`prototype/website-ui`, `hedgehogs.ts`, `book-rewards.ts`), and the `@posthog/brand` package the website already bundles.

## Problem Statement

Every member has a face in HedgeHug, but it's their Slack picture: nothing in the game is theirs to show. The game promises collectable hedgehogs as avatars, earned from levels, achievement tiers, the Journey and quests, or bought with coins (P39), and none of it exists. Level 7 opens a feature with nothing behind it, gold and diamond tiers promise a hedgehog that never arrives, the Journey's end has no reward, and coins have nothing worth saving for beyond a kudos emoji. The website can't draw the avatar in its header, its hedgehog shelf, its reveal or its `Buy` button, because no read gives it hedgehogs and no command equips or buys one.

## Solution

**Every member has a hedgehog avatar from level 1, the starter Sunday Hog, on App Home, their profile card and the website. At level 7 they open their hedgehog collection and pick any hedgehog they own as their avatar, for free.**

- **Where hedgehogs come from.** Levels 7, 10, 15, 20 and 30; each shipped ladder's gold and diamond tiers; finishing the Journey; and five in the store, at 120, 300, 700, 1,500 and 3,000 🪙. Each hedgehog has exactly one source, and the shelf shows how to get the ones you don't have.
- **Earned dark, shown behind `hedgehogs`.** Hedgehogs are granted from the deploy, whatever any flag says, and everything earned before the deploy is granted back silently, so switching the flag on shows real collections.
- **Official art.** Every hedgehog is an official PostHog hedgehog. Slack shows it from Convex storage; the website draws the same hedgehog from the package it already bundles.
- **For the website:** the equipped hedgehog for `getMyProfile` and the board's viewer row, a read of the collection and catalogue, and the store's `equip` and keyed `buyItem` taking hedgehogs.
- **Later (7b):** a weekly quest can name a kudos emoji or a hedgehog as its reward instead of its coins.

## User Stories

**The avatar**
1. As a member, I want a hedgehog avatar from my first day, so that I have a face in the game before I've earned anything.
2. As a member, I want my avatar on App Home's first tab, so that I see who I am in the game every time I open it.
3. As a member, I want my avatar on my profile card, so that teammates who look me up see the hedgehog I picked.
4. As a member, I want my avatar in the website's header, on its home page and on my own row on the board, so that it's the same me everywhere.
5. As a teammate, I want other members' rows on the board to keep their faces, so that I still recognise people.

**Opening the collection**
6. As a member at level 7, I want to open Hedgehogs with one click, so that the collection is mine when I'm ready for it.
7. As a member, I want hedgehogs I earned before level 7 to wait in my collection (P75), so that opening late costs me nothing.
8. As a member, I want the opening DM to show me how many hedgehogs I have, so that I know there's something to pick.
9. As a member, I want a `Hedgehogs` tab in App Home with my avatar, my collection, the store's hedgehogs and the ones I don't have yet, so that I find everything about hedgehogs in one place.

**Picking**
10. As a member, I want to pick any hedgehog I own as my avatar for free and at once, so that I can change my look whenever I like.
11. As a member, I want picking the same hedgehog twice to change nothing, so that a double click is harmless.
12. As a member, I want my avatar never to be empty, so that I always have a face.

**Earning**
13. As a member, I want a hedgehog at levels 7, 10, 15, 20 and 30, so that levelling keeps giving me something to show.
14. As a member, I want each gold and diamond tier to give its ladder's hedgehog, so that the Book's promised rewards are real.
15. As a member, I want tiers and levels I reached before hedgehogs existed to give their hedgehogs once, silently (P62), so that my history counts.
16. As a member, I want finishing the Journey to give the Journey's own hedgehog (P90), so that onboarding ends with something to keep.
17. As a member, I want a DM line with the hedgehog's picture when one arrives after I opened Hedgehogs, so that I notice it.
18. As a member, I want to see each hedgehog's source on the ones I don't own, so that I know how to get it.

**Buying**
19. As a member, I want to see each store hedgehog with its picture and exact price before buying (P32).
20. As a member, I want a purchase to take the coins and give the hedgehog together or not at all.
21. As a member, I want to be told plainly why I can't buy a hedgehog: not enough coins, I already own it, it isn't for sale, or Hedgehogs or Coins isn't open yet.
22. As a member, I want a repeated click or a retried website request to buy once, so that I never pay twice.
23. As a member, I want a hedgehog I buy to stay mine for good (P5).

**The product owner and the rollout**
24. As the product owner, I want hedgehogs dark behind `hedgehogs`, on in the sandbox and for my email only, so that I can try them in production first (decisions 11, 18).
25. As the product owner, I want every hedgehog granted from the deploy whatever the flag says, so that switching the flag on for everyone shows real collections.
26. As the product owner, I want turning `hedgehogs` off to hide everything and take nothing away, so that a preview is safe to end (F24).
27. As a member who isn't previewing, I want nothing to change for me while someone else previews, including their profile card as I see it.
28. As the product owner, I want the art served from our own Convex deployment and checked in the sandbox in a DM, App Home and the profile card, so that Slack shows it before anyone else sees it.

**The website**
29. As the website, I want the member's equipped hedgehog with its ID, name and art, so that the header, the home page and the board's viewer row need no game rules (WS340).
30. As the website, I want one read of the hedgehog catalogue with sources, the owned hedgehogs with arrival times and the equipped one, so that the shelf, the reveal and the character panel's hedgehog slot need no game rules (WS341, WS342).
31. As the website, I want `equip` and a keyed `buyItem` for hedgehogs through D17 (WS335).
32. As the website, I want each gold and diamond tier's hedgehog in `achievementsOf` (WS347), and the profile card's `hedgehog` (PC14).

**Quest items (7b)**
33. As a member, I want a weekly quest to sometimes name a kudos emoji or hedgehog I don't own as its reward, so that quests lead to things worth having.
34. As a member, I want a quest whose item I already own by the time I finish to pay its coins instead (P86), so that I never get nothing.
35. As the website, I want each quest's item reward with its kind, name and art in `questsOf` (WS348).

## Rules

"Hedgehogs are shown to a member" means HH13's predicate holds for them. "Hedgehogs are open" means the member has opened the `hedgehogs` feature (P73). **"Hedgehogs are visible to a member"** means both. Every member-facing mention of the collection, of picking, of a hedgehog arriving or of the store's hedgehogs needs visibility (P76). The avatar alone needs only HH13, because it belongs to the Basics (P72's level 1). "The deploy" is the moment this slice's code reaches a deployment.

### Hedgehogs and the catalogue

- **HH1. Hedgehogs are items** (ST1, ST30). A hedgehog is an item of kind `hedgehog`: a stable ID, a name, its art and exactly one source. IDs are never reused. The item catalogue goes to version `2`.
- **HH2. The catalogue.** Every hedgehog is an official PostHog hedgehog, named by its `@posthog/brand` hoggie slug:

  | Source | ID | Hoggie | Name |
  |---|---|---|---|
  | Starter | `hedgehog-sunday` | `sitting` | Sunday Hog |
  | Level 7 | `hedgehog-super` | `superhero` | Super Hog |
  | Level 10 | `hedgehog-rocket` | `rocket` | Rocket Hog |
  | Level 15 | `hedgehog-one-up` | `level-up` | 1-Up Hog |
  | Level 20 | `hedgehog-climber` | `climber-1` | Climber Hog |
  | Level 30 | `hedgehog-final-form` | `final-evolution` | Final Form Hog |
  | Store, 120 🪙 | `hedgehog-bookworm` | `reading` | Bookworm Hog |
  | Store, 300 🪙 | `hedgehog-explorer` | `explorer` | Explorer Hog |
  | Store, 700 🪙 | `hedgehog-chef` | `chef` | Chef Hog |
  | Store, 1,500 🪙 | `hedgehog-lifeguard` | `lifeguard` | Lifeguard Hog |
  | Store, 3,000 🪙 | `hedgehog-wizard` | `wizard-1` | Wizard Hog |
  | Generosity, gold | `hedgehog-honey` | `honey` | Honey Hog |
  | Generosity, diamond | `hedgehog-angel` | `angel` | Angel Hog |
  | Recognition, gold | `hedgehog-director` | `director` | Director Hog |
  | Recognition, diamond | `hedgehog-gatsby` | `gatsby` | Gatsby Hog |
  | Connections, gold | `hedgehog-tourist` | `tourist` | Tourist Hog |
  | Connections, diamond | `hedgehog-safari` | `safari` | Safari Hog |
  | Dependability, gold | `hedgehog-gardener` | `gardener-1` | Gardener Hog |
  | Dependability, diamond | `hedgehog-mountie` | `mountie` | Mountie Hog |
  | Applause, gold | `hedgehog-boombox` | `boombox` | Boombox Hog |
  | Applause, diamond | `hedgehog-dj` | `dj` | DJ Hog |
  | Seasons, gold | `hedgehog-campfire` | `campfire-cowboy` | Campfire Hog |
  | Seasons, diamond | `hedgehog-surfer` | `surfer` | Surfer Hog |
  | `old-friends`, gold | `hedgehog-coffee` | `coffee-cup` | Coffee Hog |
  | `old-friends`, diamond | `hedgehog-phone-call` | `phone-call` | Phone-call Hog |
  | The Journey | `hedgehog-party` | `party` | Party Hog |

  The gold and diamond reward IDs on `main` (`{ladder}-gold-hedgehog`, `{ladder}-diamond-hedgehog`) map to these items. The cut and unshipped ladders get theirs when they ship. The list holds no hoggie that depicts a real person, a weapon, smoking or a joke at someone's expense.
- **HH3. Sources are disjoint** (P34). A tier's, a level's, the Journey's and the starter hedgehog are never sold, and a store hedgehog is never given by anything else.
- **HH4. The art.** Each hedgehog's art is `{ kind: "hoggie"; slug; url }`. The slug names the hoggie in the `@posthog/brand` version the repository pins. `url` is that hoggie's PNG in the deployment's Convex storage, or null until it is uploaded there. The repository commits no art.
- **HH5. Uploading the art.** A maintainer script uploads each catalogue hedgehog's PNG from the pinned package into the deployment's Convex storage, with its content type, once per content hash, and stores the slug, the storage ID and the hash. Running it again uploads nothing that's already there. The deploy workflow runs it after every deploy, in the sandbox and in production, so a new catalogue version's art follows its code. Only the store writes the art table.
- **HH6. Slack shows the stored art.** Wherever Slack shows a hedgehog's picture, it uses the storage URL. A hedgehog whose `url` is null shows its name without a picture: a missing upload never breaks a message or a view.

### The collection and the avatar

- **HH7. The collection** (ST5). Every member owns the starter, stored nowhere. Its arrival time is the moment they opened Hedgehogs. Every other hedgehog arrives in the collection once, through the store's grant, with its time and source, and is never taken back (P5).
- **HH8. The hedgehog slot** (ST6). The loadout gains the slot `hedgehog`. A member who never picked one has the starter there. Once they pick, the stored slot is the truth. The slot is never empty.
- **HH9. Picking** (ST7). `equip { item, slot: "hedgehog" }` puts an owned hedgehog in the hedgehog slot, replacing the one there. It is free and instant. It writes the loadout change but stores no command outcome, and it is safe to repeat by state: picking the hedgehog already in the slot writes nothing. It refuses with `hedgehogs-not-open` (Hedgehogs isn't open), `not-owned`, or `wrong-slot` (a hedgehog for an emoji slot, or a kudos emoji for the hedgehog slot), and changes nothing then. `takeOff { slot: "hedgehog" }` always refuses with `wrong-slot`.
- **HH10. The avatar.** A member's avatar is the hedgehog in their hedgehog slot. Who sees it follows HH13 for the person looking, never anyone's unlocks (P76). A member sees their own avatar from level 1 while hedgehogs are shown to them; a viewer sees another member's avatar on the profile card while hedgehogs are shown to the viewer.

### Earning hedgehogs (recorded dark)

- **HH11. Granted from the deploy, whatever the flags say** (CO1, ST16). From the deploy on, each of these grants its hedgehog into the collection at that moment, for every member, from level 1, whatever any flag says and whatever the member opened:
  - **Levels.** Reaching a level, through a kudos or a reward record, grants the hedgehog of every catalogue level at or below it that the member doesn't own yet, so a jump over two levels grants both. Source `level`. The granting mutation itself writes HH22's DM and republishes App Home, so neither can run before the grant.
  - **Tiers.** Earning a gold tier writes, in the same mutation, one reward record `{ xp: 0, coins: 0, item }` keyed `tier:{ladder}-gold-hedgehog` at the tier's earned time, and grants its hedgehog with source `tier`. A diamond tier does the same keyed `tier:{ladder}-diamond-hedgehog`, beside CO7's coins record.
  - **The Journey** (P90). The mutation that finishes a member's fifth Journey step, in any order, grants the Journey's hedgehog with source `journey`. It is not a step reward: no reward record and no crate of its own.
- **HH12. Granted back.** A one-off paged job grants, once, every hedgehog a member earned before the deploy: each catalogue level at or below their level, each gold and diamond tier they earned (with HH11's reward records), and the Journey's hedgehog for a member with all five steps finished. It runs with the time it ran and tells nobody. The hedgehogs wait in the collection. **The ship runs the job to completion in a deployment before `hedgehogs` is created or switched on there.** A second run writes nothing, because the store grants an item at most once and the reward keys exist (P87). The job keeps no completion state: every run walks every member from the first, so sources added to it before the ship are covered by the ship's run.

### The flag

- **HH13. Who sees hedgehogs.** Hedgehogs are shown to a member when the `hedgehogs` flag is on in their member decision and the store is shown to them (ST20, which needs coins shown, CO13). Queries read it without an exposure. The mutation that first takes a member down a hedgehogs path sends their `hedgehogs` exposure once per value (F25, O36).
- **HH14. Hedgehogs ships with the predicate.** The unlock schedule's `hedgehogs` feature ships to a member exactly when HH13 holds for them: for the readiness a level up stores, for the ship sweep (P78), for `Next:` lines and for `openUnlock`. So a member past level 7 gets Hedgehogs ready, with the sweep's one DM, at the first hourly sweep after both `hedgehogs` and `store` are on for them, in whichever order they turned on. The schedule's version doesn't change.
- **HH15. Dark where it isn't shown.** Where hedgehogs aren't shown to a member, they see nothing of them: no avatar on their App Home, no `Hedgehogs` tab, crate, `Next:` line or DM line, no store hedgehog, no hedgehog in a tier DM, `avatarOf` and `hedgehogsOf` answer null, and a profile card they look up has no image. A stale `Equip` or `Buy`, from Slack or the website, writes nothing, spends nothing and publishes nothing. Where hedgehogs are shown but not open, the member sees their avatar on App Home and on profile cards, and Unlocks tells them of the feature as P73 and P74 say (the ready crate with `Open`, the `Next:` line, the readiness DM); they see nothing of the collection, picking or the store's hedgehogs, and a stale click is refused with `hedgehogs-not-open`. Granting goes on (HH11). Turning the flag off and on again rewrites nothing and shows the same collection and avatar (O35, F24).
- **HH16. Who has it on.** `hedgehogs` starts on for `environment = sandbox` and for the product owner's email only (decision 18), and stays off for everyone else until the product owner turns it on. A preview never shows in a channel: Slack's public replies and notices carry no avatar.

### The store's hedgehogs

- **HH17. What's for sale.** While hedgehogs are visible to a member, their store lists the HH2 store hedgehogs, each with its art and price, whether or not they can afford it. A hedgehog they own shows as owned, never for sale.
- **HH18. Buying** (ST13, CO30). `buyItem { item }` on a hedgehog is the same D17 command, stored by its idempotency key in the same mutation as the purchase (ST14's keys). Its checks, in this order: `hedgehogs-not-open`, `coins-not-open`, `not-for-sale` (any hedgehog that isn't a store hedgehog), `owned`, `no-coins` (the wallet's spend step, CO10). A purchase that passes spends the price, grants the hedgehog with source `store`, publishes `itemBought` (P93) and stores `{ kind: "bought", item }`, all in one mutation. A refusal changes nothing and stores `{ kind: "refused", item, reason }`. The same key answers the stored outcome and does nothing else. A bought hedgehog waits in the collection; it doesn't become the avatar by itself. A purchase is never refunded (ST15).

### Slack

- **HH19. The avatar in App Home.** While hedgehogs are shown to the member, the first section of App Home's first tab, whether the member's own tab or the front door's summary, carries their avatar as an image accessory with the alt text `{name}, your hedgehog`.
- **HH20. Opening Hedgehogs.** Opening Hedgehogs (P73) sends one DM, unless the member turned progression DMs off (P63): `Hedgehogs are open. You have {n} hedgehogs: pick your avatar in the Hedgehogs tab.`, or, with only the starter, `Hedgehogs are open. Sunday Hog is your avatar: earn more from levels, achievements and the Journey, or buy one with 🪙.` A context block with the avatar's art follows.
- **HH21. The `Hedgehogs` tab.** App Home gains a `Hedgehogs` tab after `Inventory` (or after `Skill tree` where the Inventory tab isn't shown), while hedgehogs are visible. In order:
  - `Your hedgehog`: a section with the avatar's name and art;
  - `Change your hedgehog`: a select of every owned hedgehog, shown when the member owns more than one;
  - `Collection`: the owned hedgehogs, each its art and name, in context blocks of up to 5;
  - `Store`: each store hedgehog not owned, as a section `{name} · {price} 🪙` with its art and a `Buy` button, which asks `Buy {name} for {price} 🪙?` before it runs;
  - `Not yours yet`: one section listing each other hedgehog not owned with its source, `Rocket Hog · level 10`, `Honey Hog · Generosity gold` (tier hedgehogs only while the Book is open, P76), `Party Hog · finish the Journey`.

  It is published again after any change to the collection, the avatar or the balance (P68). Refusals show in the tab as the Inventory tab's do: `You need {price − balance} more 🪙.`, `You already own it.`, `It isn't for sale.` The tab stays within Slack's 100-block view limit with every hedgehog owned.
- **HH22. A hedgehog arrives.** A hedgehog granted while hedgehogs are visible to the member is told in a DM line `+ {name} for your hedgehogs` followed by a context block with its art, written by the granting mutation: its own DM for a level hedgehog (`Level {n}: {name} joined your hedgehogs.`), a line in the tier DM and its batch summary for a tier hedgehog (ST18's way), and a line in the finished-step DM of the Journey's last step for the Journey's hedgehog. Whether a line is told is decided when the grant is written and carried with the DM intent; delivery rechecks the DM setting and visibility only to drop the line, never to add one. A hedgehog granted before the member opened Hedgehogs is told only in HH20's count. Backfilled hedgehogs are told by nothing.
- **HH23. The profile card** (PC14). While hedgehogs are shown to the viewer, the card's first section carries the member's avatar as an image accessory with the alt text `{name}'s hedgehog, {hedgehog name}`, and `getProfileCard` gains `hedgehog: { id, name, art }`. Otherwise both are absent, as PC14's "not shipped".

### For the website (map #57)

- **HH24. `avatarOf(member)`.** An internal read answering `{ item: ItemId; name: string; art: HedgehogArt }`, or null while hedgehogs aren't shown to the member. The website composes it into `getMyProfile` as `hedgehog` and into `getLeaderboard`'s viewer row, as it composes `walletOf` (CO26). The engine's `homeFacts` doesn't change. Other rows keep their faces (WS340, V19).
- **HH25. `hedgehogsOf(member)`.** An internal query answering null while hedgehogs aren't visible to the member, otherwise:

  ```ts
  type HedgehogArt = { kind: "hoggie"; slug: string; url: string | null };
  type HedgehogSource =
    | { kind: "starter" }
    | { kind: "level"; level: number }
    | { kind: "tier"; ladder: LadderId; tier: "gold" | "diamond" }
    | { kind: "journey" }
    | { kind: "quest" } // 7b
    | { kind: "store"; price: number };
  type Hedgehogs = {
    equipped: ItemId;
    owned: Array<{ item: ItemId; arrivedAt: number }>;
    catalogue: Array<{ item: ItemId; kind: "hedgehog"; name: string; art: HedgehogArt; source: HedgehogSource; onSale: boolean }>;
  };
  ```

  `catalogue` is in catalogue order and holds every owned hedgehog with its source, whatever the member opened (as ST26 lists owned tier items), plus the store, level and Journey hedgehogs, the tier hedgehogs they don't own only while the Book is open, and the quest hedgehogs (7b) they don't own only while Quests is open. `onSale` is true exactly for a hedgehog `buyItem` could sell them now if they had the coins. `owned` includes the starter. An `owned` entry's `item` and `arrivedAt` make the reveal's seen key, scoped to the member with the website's `seenKeyOf(member, …)` as its other seen keys are (WS342). `inventoryOf` stays kudos emoji only (ST26): the character panel's hedgehog slot reads `equipped`.
- **HH26. The commands.** HH9's `equip` and `takeOff` and HH18's `buyItem`. `buyItem` answers ST27's `ItemPurchaseOutcome` with `hedgehogs-not-open` added to its reasons; `equip` and `takeOff` add `hedgehogs-not-open` and `wrong-slot` to theirs. On a hedgehog or the hedgehog slot, each answers null, writing nothing, where hedgehogs aren't shown (HH15). The website builds its own wrappers on `memberMutation` with WS335's gate: the `hedgehogs` feature open and no launch due.
- **HH27. `achievementsOf(member)`.** Each gold and diamond tier's reward of kind `hedgehog` gains `item: { item, name, art }` and, on an earned tier, `recordedAt: number | null`, as ST28 does. It is null only for a tier earned before the deploy whose backfill page hasn't run, which HH12 keeps from reaching a member. The website shows it only while `hedgehogsOf` isn't null.
- **HH28. The Journey's facts.** The Journey's facts gain `hedgehog: { item, name, art, arrivedAt: number | null }` for the Journey's hedgehog while hedgehogs are visible, `arrivedAt` null until all five steps are finished. Step rewards keep `{ xp, coins, item }` unchanged.
- **HH29. Events.** Granting a hedgehog publishes nothing new: `itemBought` covers purchases, and the website reads arrivals from `hedgehogsOf`.

### Quest item rewards (stopping point 7b)

- **HH30. Quest-pool items.** The catalogue goes to version `3` with six quest items, in this order: `hedgehog-puzzle` (`puzzle`, Puzzle Hog), `kudos-emoji-dove` (`:dove_of_peace:` 🕊️, Dove), `hedgehog-mailbox` (`mailbox`, Mailbox Hog), `kudos-emoji-kite` (`:kite:` 🪁, Kite), `hedgehog-selfie` (`selfie`, Selfie Hog), `kudos-emoji-hibiscus` (`:hibiscus:` 🌺, Hibiscus). Their source is `quest`. They are never sold (HH3, ST3).
- **HH31. Naming an item at the draw** (P86). While `quest-items` is on for the member, a weekly draw names at most one item: the quest in the draw's third slot names the first quest item, in catalogue order, that the member doesn't own and whose kind is visible to them at the draw: a kudos emoji while the store is visible (shown and Coins open, ST20), a hedgehog while hedgehogs are visible (shown and Hedgehogs open). Its reward is then `{ xp: 20, coins: 0, item }` instead of `{ xp: 20, coins: 10, item: null }`, fixed at the draw with the catalogue version. A draw with fewer than three quests, or no such item, names none. A reroll of the third slot names an item by the same rule at the reroll. The group quest and Journey steps name no items.
- **HH32. Finishing.** Finishing a quest that names an item writes its reward record with the item and grants it with source `quest`, in the same mutation. If the member owns the item by then, the record is `{ xp: 20, coins: 10, item: null }` instead (P86). The grant happens whatever the flags say then (P75). Finishing answers the recorded reward, not the drawn one, to everything that tells of it.
- **HH33. Slack and the website.** An unfinished quest shows the reward it was drawn with; a finished one, its crate, its DM and the success reply show its reward record. An item shows only while its kind is visible to the member (HH31's predicates, checked at each render and delivery); otherwise the line shows the reward's XP and coins alone, and the recorded item stays owned. A quest that names an item shows it where it shows the reward: App Home's quest row `20 XP · Puzzle Hog`, the finished-quest DM and the success reply's part `Quest done: Thank someone new (+20 XP, Puzzle Hog)`. `questsOf` gives the item as `{ item, kind, name, art }`, with ST26's art for a kudos emoji and HH4's for a hedgehog (WS348).
- **HH34. The flag.** `quest-items`, a member decision, starts sandbox-only plus the product owner's email. Off, draws name no items, exactly as on `main`. A quest drawn with an item keeps it after the flag turns off, and its reward waits like any earning.

## Implementation Decisions

- **The store module** (from #31) owns hedgehogs, because it already owns items, the collection, the loadout and purchases: the hedgehog half of the item catalogue (HH2, HH30), the `hedgehog` slot in `loadouts`, `grantItem` for every source, `buyItem` and `equip` for hedgehogs, the art table (slug, storage ID, content hash, uploadedAt) and its internal upload mutations, `avatarOf`, `hedgehogsOf` and `hedgehogsShownTo`/`hedgehogsVisibleTo`. It still knows nothing about why an item was earned. Only the store writes the collection, the loadout, item purchases and the art table.
- **The level grant** is the store's subscriber on `levelReached` (P93), catching up every catalogue level at or below the level reached.
- **Achievements**: `earnTier` for gold and diamond tiers writes HH11's reward record through `recordReward` and calls `grantItem`. `achievementsOf` adds the item (HH27).
- **Quests**: the mutation that finishes a Journey step calls `grantItem` for the Journey's hedgehog when it finishes the fifth. 7b: the quest pool's draw and reroll name items (HH31), `finish` grants them (HH32), and `questsOf` adds the item (HH33).
- **The backfill** (HH12) is one internal paged job, 25 members per page, under the 4,096 index ranges and the scheduling limit. Each ticket that adds a source adds it to the job.
- **Unlocks**: a schedule entry ships through a predicate rather than a bare flag, so `hedgehogs` uses HH13's (HH14). The other entries keep their flags.
- **Feedback and the Slack adapter**: the avatar accessory on App Home's first tab (HH19), the opening DM (HH20), the `Hedgehogs` home tab with its select, its `Buy` confirm and its refusal lines (HH21), the arrival lines (HH22), and an image or context block helper that drops the picture when `url` is null (HH6).
- **The profile card module**: the avatar on the card and in `getProfileCard` (HH23).
- **Commands (D17)**: `equip`, `takeOff` and `buyItem` accept hedgehogs and the `hedgehog` slot (HH26). No new command.
- **The art script and the deploy workflow**: a maintainer script reads the pinned `@posthog/brand` PNGs, uploads through an internal upload URL and records each upload (HH5). The deploy workflow runs it after deploy, for the sandbox and production.
- **Flags**: `hedgehogs` (7a) and `quest-items` (7b), `safeDefault: false`, declared beside the other flags.
- **Lexicon**: declare **hedgehog** (a collectable avatar item, an official PostHog hedgehog with one source) and **avatar** (the hedgehog in a member's hedgehog slot, shown on App Home, the profile card and the website). Widen **loadout** and **inventory** with the hedgehog slot, and **collection** and **store** with hedgehogs.
- **Coherence**: the store's component spec gains the invariants "a member's hedgehog slot always holds a hedgehog they own", "a hedgehog is granted to a member at most once" (a case of the store's item invariant) and "a hedgehog purchase spends coins once per idempotency key". The gate ticket's oracle is "hedgehogs are dark where they aren't shown".

## Testing Decisions

- **Good tests** enter at the highest seam and check what a member or another module can observe: the Slack calls made, the events published, and the records and rows another module reads. They never test private helpers.
- **The Slack boundary is the main seam** (signed events and interactivity through the HTTP router with `convex-test`, Slack stubbed at `fetch`):
  - App Home's first tab carries Sunday Hog for a level 1 member with `hedgehogs` on, and nothing with it off;
  - reaching level 7 makes Hedgehogs ready, opening it sends HH20's DM with the count, and the tab lists Super Hog in the collection;
  - picking Super Hog in the select changes the avatar on the next publish, and twice changes nothing;
  - `Buy` with and without enough coins, twice with one trigger, on an owned hedgehog, and on a tier hedgehog;
  - a gold tier DM with its hedgehog line while Hedgehogs is open, and none before;
  - finishing the fifth Journey step grants Party Hog, in either step order;
  - a level hedgehog's DM and App Home's republish never run before its grant, and a tier DM queued before Hedgehogs opened gains no hedgehog line when delivered after;
  - `/hedgehug @member` shows the member's avatar for a viewer with `hedgehogs` on, and today's card for a viewer without it;
  - the whole slice dark with `hedgehogs` off, not created, the flags key missing, or `store` or `coins` off, and on for one member's email only, where every other member's Slack calls equal those with `hedgehogs` off.

  Prior art: `convex/slack/skillTree.test.ts`, `skillTreeFlag.test.ts`, `tierSummaries.test.ts`, `unlocksDm.test.ts`, and the store slice's Inventory tab tests on `spec/store`.
- **The modules' internal functions**: `avatarOf`, `hedgehogsOf`, `achievementsOf` and the D17 commands' answers, as the website calls them, including the stored outcome on a repeated key and `wrong-slot`; the backfill run twice; a level jump from 6 to 11 granting two hedgehogs. Prior art: `convex/website/buyPerk.test.ts`, `convex/achievements/replay.test.ts`, `convex/quests/journey.test.ts`.
- **The store's invariants**: after any sequence of grants, purchases and picks, the hedgehog slot holds an owned hedgehog, no item is granted twice, and the wallet's balance equals its records minus spends.
- **The art**: the catalogue's test checks every slug exists in the pinned package, every PNG is within Slack's image limits, and IDs and sources are unique and disjoint. The upload script is tested against a local backend: a second run uploads nothing. The first ticket's sandbox proof shows a storage URL rendering in a DM, App Home and a profile card. If Slack refuses it, that ticket serves the PNGs from an HTTP route on the deployment's site URL instead, records the change with `coherence decide`, and HH4's `url` points there.
- **Limits**: the backfill under `testBackend({ transactionLimits: true })`; the `Hedgehogs` tab with every hedgehog owned stays under 100 blocks.
- **7b**: the draw names the first unowned visible item in the third slot, names none with `quest-items` off, and a quest finished after its item was bought pays coins. Prior art: `convex/quests/draw.test.ts`, `swap.test.ts`, `finish.test.ts`.

## Out of Scope

- Hedgehogs for the cut and unshipped ladders (Team Spirit, Crowd Favourite, Standing Ovation, Amplifier), which arrive with their ladders.
- Hedgehogs on public replies, notices or other members' board rows, in Slack or on the website.
- Member uploads, animated art, frames or any other cosmetic around the avatar.
- Selling hedgehogs back, trading them or giving them away (ADR-0003, ST15).
- The group quest naming an item (HH31).
- Item properties on PostHog events; a later analytics ticket adds `itemBought`.
- The website's pages, routes and moments (`/collection`, the reveal): map #57 owns them.

## Review

A GPT-6.1 Sol review (high) of the first draft found 1 blocker, 8 majors and 1 minor. Eight were fixed; two were narrowed with a reason:

1. **Blocker: shown-but-unopened hid Hedgehogs' own crate and `Next:` line.** Fixed: Unlocks tells of the feature as P73 and P74 say; only the collection, picking and the store's hedgehogs wait for the opening (HH15).
2. **Major: 7b's "visible" meant shown, and projections ignored flags turning off.** Fixed: visible means shown and open, checked at the draw and again at every render and delivery (HH31, HH33).
3. **Major: a quest whose item was owned by the finish still showed the item.** Fixed: finished quests, crates, DMs and replies show the reward record (HH32, HH33).
4. **Major: the level grant raced Unlocks' level-up DM and App Home's republish.** Fixed: the granting mutation writes its own DM and republishes (HH11, HH22).
5. **Major: a queued DM could announce a hedgehog granted before the opening.** Fixed: the line is decided at the grant and only dropped at delivery (HH22).
6. **Major: owned tier hedgehogs before the Book opens.** Narrowed: owned items are always in the catalogue with their source, as ST26 already does for owned tier emoji and the website accepted; unowned tier hedgehogs wait for the Book (HH25).
7. **Major: a growing backfill with a completion marker could skip sources.** Fixed: the job keeps no completion state and every run walks every member; the ship runs it once all sources have landed (HH12).
8. **Major: 7a isn't buildable on today's `main` and is too broad.** Narrowed: `spec/hedgehogs` is cut only after the store ship #347 merges (which brings coins, the store and `your-emoji`), the profile card ticket waits for its ship #307, and 7a is already seven reviewed pull requests into one integration branch behind one flag.
9. **Major: reveal seen keys weren't member-scoped.** Fixed: the website scopes them with its `seenKeyOf(member, …)` (HH25).
10. **Minor: equipping "stores nothing" contradicted the stored slot.** Fixed: it writes the loadout but stores no command outcome (HH9).

## Further Notes

**The product owner's words this spec rests on.**

- Decision 12 (2026-10-13): "things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey", "can we reduce the skill tree to just a single tree?", "Let's lock that design in", corrected to "the onboarding journey is not cut, the rest is as stated". Coins, kudos emoji, hedgehogs, one skill tree and the Book are kept.
- Decision 11 (2026-10-13): "make sure that any new feature going to production, like leveling, the new website, etc. is behind a feature flag."
- Decision 13 (2026-10-13): "I expect you to ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags."
- Decision 18 (2026-10-14): "let's just turn them all on for everyone. I'm going to organically roll this out as we go. Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on. Let's go all in here."
- The website map (#57, WS300–WS348) asked that the website "truly looks like the prototype", which makes the hedgehog avatar, the shelf and the reveal binding needs.

**Calls taken at recommendation** (each recorded with `coherence decide`; IDs in the resolution on #96):

1. **Two stopping points.** Quest item rewards change the weekly draw for kudos emoji and hedgehogs alike, and nothing in 7a needs them. 7a ships first and alone; 7b gets its own flag, because by the time it ships `hedgehogs` may be on for everyone.
2. **Hedgehogs are shown only where the store is shown** (HH13): buying spends coins, and the hedgehog slot is the store's loadout. One chained predicate keeps every surface consistent, and the unlock schedule ships Hedgehogs through it (HH14).
3. **The avatar is Basics** (HH10, HH19): it shows from level 1 wherever hedgehogs are shown, as P72 lists the starter avatar at level 1. The collection and picking wait for level 7.
4. **The catalogue's content** (HH2): the starter, five level, five store, fourteen tier and one Journey hedgehog, 26 in all. The names follow the accepted prototype. Where the prototype gave one hoggie two sources (Gardener, DJ and Angel as tier and store rewards), the tier keeps it and the store takes Explorer, Lifeguard and Wizard. The product owner can rename or swap hedgehogs in a later catalogue version; IDs stay.
5. **The art lives in Convex storage, uploaded from the pinned package by the deploy workflow** (HH4, HH5): the repository commits no art, as with the app icon (decision 10). Slack reads the storage URL; the website draws the bundled hoggie from its slug.
6. **The starter is owned by every member and stored nowhere** (HH7, HH8), as ST5 does for 🦔.
7. **Granted dark from the deploy and backfilled silently before the flag** (HH11, HH12), as CO7 and ST17 do. P62's one DM summary is dropped for the same reason ST17 drops it: almost nobody has Hedgehogs open when they ship, and opening shows the collection.
8. **Level hedgehogs catch up** (HH11): a level reached grants every catalogue level at or below it, so a jump never skips one. They write no reward record: the collection row is the record, as level hedgehogs pay no XP or coins. Their DM is the granting mutation's own, not a line in Unlocks' level-up DM, because the two are separate subscribers with no order between them (HH22).
9. **The Journey's hedgehog is a grant, not a step reward** (HH11, HH28). P90 gives it for finishing all five steps, so the fifth finish grants it whatever the order. Step rewards keep their shape.
10. **A bought hedgehog doesn't become the avatar by itself** (HH18), consistent with ST13, so the reveal and the pick stay the member's choice.
11. **`hedgehogsOf` is its own read, not part of `inventoryOf`** (HH25). Hedgehogs open on their own (P73, any order), while `inventoryOf` is null until Coins is open. The website conductor accepted it.
12. **`avatarOf` composes into the website's reads; `homeFacts` stays the engine's** (HH24), so the kudos engine never learns about hedgehogs. The website conductor accepted it.
13. **`takeOff` on the hedgehog slot refuses with `wrong-slot`** (HH9): an avatar is never empty.
14. **The profile card's avatar follows the viewer's decision** (HH23): the card is a private reply, so a previewing viewer can see it without anyone else seeing a preview.
15. **One `Hedgehogs` tab in App Home** (HH21), not part of `Inventory`, for the same reason as call 11. It stays inside Slack's 100-block limit by grouping the collection in context blocks.
16. **No public line carries an avatar** (HH16): it keeps a preview out of channels and needs no new public copy.
17. **7b names at most one item a week, in the third slot, first unowned visible item in catalogue order** (HH31): deterministic per member and week, so the draw stays stored and replayable, and items stay a treat beside coins.
18. **The flags are `hedgehogs`** (#96's body) **and `quest-items`**, sandbox plus the product owner's email (decision 18).

**Casting.** The build tickets run on Opus 5.5 (high); reviews on GPT-6.1 Sol (high).
