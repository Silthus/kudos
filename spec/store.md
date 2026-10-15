# Spec: kudos emoji, the inventory and the store

> **Accepted on [#31](https://github.com/Silthus/kudos/issues/31) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/store` and is never merged. It is progression stopping point 6. It builds on the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P5, P31, P32, P34, P36, P38, P58, P62, P69, P72–P78, P86–P93), the coins spec (`spec/coins.md` on `docs/coins` at `a659a84`: CO1, CO7, CO10, CO13, CO14, CO16, CO26, CO28–CO30), the per-member flags spec (F16–F25) and the Slack-to-web spec (SW1–SW5). Where this spec and P38, P62 or CO16 differ, this spec wins and says why under "Further Notes".
>
> **Rule numbers.** Rules are cited as `ST1`–`ST36`. Coins rules are cited as `CO10`, progression rules as `P38`, website rules as `WS341`.
>
> **Two stopping points.** 6a (ST1–ST30) is the inventory, the kudos emoji and the store, on `spec/store` behind `store`. 6b (ST31–ST36) is the admin's custom emoji, on `spec/store-custom-emoji` behind `custom-kudos-emoji`. 6b starts once 6a is on `main`.
>
> Sources: ticket #31 and its amendment by #97; map #1's decisions 11, 12, 13 and 18 (quoted under "Further Notes"); the code on `main` at `c70e4a1` (`convex/parser/`, `convex/engine/`, `convex/unlocks/`, `convex/quests/`, `convex/achievements/`, `convex/commands/`, `convex/feedback/`, `convex/website/`); the coins slice planned on #311–#317; the website map's needs (map #57, `spec/website-7.md` on `docs/spec-website-7`: WS335, WS341, WS347, WS348; website tickets #283, #291, #292, #297, #287).

## Problem Statement

Every member thanks people with the same one emoji, the workspace's. Coins pile up from the moment coins ship, and the only things to spend them on are a handful of perk upgrades. The game promises kudos emoji of your own, a loadout to put them in, a store that sells them for coins, and silver achievement tiers that give one (P31, P36, P38, P58), and none of it exists. The silver tier's reward is a promise with nothing behind it. The Journey has no last step. And the website can't draw its character panel, its inventory or its `Buy` button, because no read gives it items and no command buys or equips one.

## Solution

**At level 6, opening Coins also opens the member's inventory: three kudos emoji slots, with the starter 🦔 already in the first one, so a kudos sent with 🦔 counts right away.**

- **Kudos emoji.** A kudos emoji in a member's loadout counts as a kudos for its owner, exactly like the workspace's own emoji: each one in a message with a mention is one kudos per recipient, from the same daily allowance. Nobody else's messages change.
- **The store.** Twelve kudos emoji at 100 🪙 each. Each is shown with its exact look and price before buying, owned once, never a random draw. Buying spends through the wallet's one spend step and is stored under its idempotency key.
- **The loadout.** Three emoji slots. Putting an owned emoji in a slot or taking it out is free and instant. Bought emoji wait in the collection until the member puts them in a slot.
- **Silver tiers** give their ladder's own kudos emoji, including tiers earned before the store existed, silently, into the collection.
- **The Journey's last step**, `your-emoji`: give a kudos that says why with a kudos emoji from your loadout, 40 XP and 20 🪙.
- **Recorded dark, shown behind `store`.** Silver emoji are granted from the deploy whatever any flag says. The flag decides what a member sees, whether their loadout counts, and whether they can buy or equip.
- **For the website:** one read of the slots, the owned items and the catalogue; `buyItem` keyed like `buyPerk`; `equip` and `takeOff`, safe to repeat by state.
- **Later (6b):** workspace admins pick custom emoji that join their workspace's store.

## User Stories

**The inventory**
1. As a member at level 6, I want opening Coins to open my inventory too, so that one moment gives me a balance and something to spend it on.
2. As a member, I want the starter 🦔 already in my first slot when I open my inventory, so that I can use my own kudos emoji right away without setting anything up.
3. As a member, I want to see my three slots, my collection and the store in one App Home tab, so that I find everything about my emoji in one place.
4. As a member, I want each item's source on the items I don't own yet, so that I know how to get it.
5. As a member, I want items I earned before I opened the inventory to wait in my collection (P75), so that opening late costs me nothing.

**Kudos emoji**
6. As a giver, I want an emoji in my loadout to count as a kudos in my messages, so that I can thank people in my own style.
7. As a giver, I want a loadout emoji to cost the same allowance as the workspace's emoji, so that my own emoji are style, not extra kudos.
8. As a giver, I want the workspace's own emoji to keep working whatever my loadout holds.
9. As a recipient, I want a kudos sent with someone's loadout emoji to count for me like any other kudos.
10. As a member, I want my loadout emoji not to work for other people, so that my emoji are mine.
11. As a member, I want the store never to sell an emoji I'd use as an everyday reaction, so that equipping one doesn't turn my ordinary messages into kudos by surprise.

**The store**
12. As a member, I want to see each kudos emoji and its price before buying, so that nothing surprises me (P32).
13. As a member, I want a purchase to take the coins and give the emoji together or not at all.
14. As a member, I want to be told plainly why I can't buy something: not enough coins, I already own it, or it isn't for sale.
15. As a member, I want a repeated click or a retried website request to buy once, so that I never pay twice.
16. As a member, I want an emoji I buy to stay mine for good, even if the store stops selling it (P5).

**The loadout**
17. As a member, I want to put any owned kudos emoji in any of my three slots for free, so that I can change my style whenever I like.
18. As a member, I want to take an emoji out of a slot, including the starter, so that I control which emoji count for me.
19. As a member, I want putting an emoji that's already in another slot to move it, so that one emoji never fills two slots.

**Achievements**
20. As a member, I want a silver tier to give its ladder's kudos emoji, so that the tier's promised reward is real.
21. As a member, I want silver tiers I earned before the store existed to give their emoji once, so that my history counts (P62).
22. As a member, I want a silver tier's DM to name the emoji it gave, while my inventory is open.

**The Journey**
23. As a new member, I want a last Journey step that teaches me to use my own kudos emoji, so that I learn the inventory by doing.
24. As a member, I want that step to pay 40 XP and 20 🪙 once, so that trying it out is worth it.

**Admin custom emoji (6b)**
25. As a workspace admin, I want to pick which of our custom emoji members can unlock, so that our own culture shows in kudos.
26. As a member, I want my workspace's picked custom emoji in the store at the same price, so that buying one works like any other.
27. As a workspace admin, I want to stop selling a custom emoji without taking it from anyone who bought it.

**The product owner and the rollout**
28. As the product owner, I want the store dark behind `store`, on in the sandbox and for my email only, so that I can try it in production first (decisions 11, 18).
29. As the product owner, I want silver emoji granted from the deploy whatever the flag says, so that switching the store on for everyone shows real collections.
30. As the product owner, I want turning `store` off to hide everything and take nothing away, so that a preview is safe to end (F24).
31. As a member who isn't previewing, I want nothing to change for me, including what counts as a kudos, while someone else previews.

**The website and later stopping points**
32. As the website, I want one read of slots, owned items with arrival times and the catalogue with names, art, sources and prices, so that the character panel and inventory need no game rules (WS341).
33. As the website, I want `buyItem` stored under a key I supply, and `equip` and `takeOff` safe to repeat, through D17 (WS335).
34. As the website, I want each silver tier's emoji in `achievementsOf` (WS347).
35. As hedgehogs (#96), I want the collection, the loadout, the catalogue and `buyItem` to take a second item kind and a hedgehog slot without changing their shape.

## Rules

"The store is shown to a member" means ST20's predicate holds for them. "The inventory is open" means the member has opened the `coins` feature (P73). **"The store is visible to a member"** means both. Every member-facing mention of the inventory, a slot, an item or the store needs it (P76). "The deploy" is the moment this slice's code reaches a deployment.

### Items and the catalogue

- **ST1. Items.** The game's items are kudos emoji now and hedgehogs from #96 (P34). Each has a stable ID, a name, its Slack emoji name, its art and exactly one source. IDs are never reused; changing an item's emoji makes a new item. The catalogue is versioned code, version `1`.
- **ST2. The kudos emoji.** Unicode emoji Slack renders by name, none with skin tones:

  | Source | ID | Emoji | Name |
  |---|---|---|---|
  | Starter | `kudos-emoji-hedgehog` | `:hedgehog:` 🦔 | Hedgehog |
  | Store, 100 🪙 | `kudos-emoji-sunflower` | `:sunflower:` 🌻 | Sunflower |
  | Store, 100 🪙 | `kudos-emoji-rocket` | `:rocket:` 🚀 | Rocket |
  | Store, 100 🪙 | `kudos-emoji-glowing-star` | `:star2:` 🌟 | Glowing Star |
  | Store, 100 🪙 | `kudos-emoji-gem` | `:gem:` 💎 | Gem |
  | Store, 100 🪙 | `kudos-emoji-rainbow` | `:rainbow:` 🌈 | Rainbow |
  | Store, 100 🪙 | `kudos-emoji-clover` | `:four_leaf_clover:` 🍀 | Clover |
  | Store, 100 🪙 | `kudos-emoji-doughnut` | `:doughnut:` 🍩 | Doughnut |
  | Store, 100 🪙 | `kudos-emoji-cookie` | `:cookie:` 🍪 | Cookie |
  | Store, 100 🪙 | `kudos-emoji-crown` | `:crown:` 👑 | Crown |
  | Store, 100 🪙 | `kudos-emoji-balloon` | `:balloon:` 🎈 | Balloon |
  | Store, 100 🪙 | `kudos-emoji-cactus` | `:cactus:` 🌵 | Cactus |
  | Store, 100 🪙 | `kudos-emoji-trophy` | `:trophy:` 🏆 | Trophy |
  | Generosity, silver | `kudos-emoji-ribbon` | `:ribbon:` 🎀 | Ribbon |
  | Recognition, silver | `kudos-emoji-sparkling-heart` | `:sparkling_heart:` 💖 | Sparkling Heart |
  | Connections, silver | `kudos-emoji-jigsaw` | `:jigsaw:` 🧩 | Jigsaw |
  | Dependability, silver | `kudos-emoji-anchor` | `:anchor:` ⚓ | Anchor |
  | Applause, silver | `kudos-emoji-confetti` | `:confetti_ball:` 🎊 | Confetti |
  | Seasons, silver | `kudos-emoji-maple-leaf` | `:maple_leaf:` 🍁 | Maple Leaf |
  | `old-friends`, silver | `kudos-emoji-teddy-bear` | `:teddy_bear:` 🧸 | Teddy Bear |

  The silver reward IDs on `main` (`{ladder}-silver-kudos-emoji`) map to these items. The cut and unshipped ladders get theirs when they ship. The list holds no emoji that is an everyday reaction (👍, ✅, 👀, 🎉, 🔥, ❤️, 🙏, 👏, ☕), because every emoji in a giver's loadout makes a message with a mention a kudos.
- **ST3. Sources are disjoint** (P34). A tier's emoji is never sold, the starter is never sold, and a store emoji is never given by a tier.
- **ST4. The workspace's own emoji.** An item whose Slack emoji name is the workspace's kudos emoji works for everyone already (P38). It is not sold or listed in that workspace's store and is never `Not yours yet`. A member who owns it keeps it and can put it in a slot.

### The collection and the loadout

- **ST5. The collection.** A member's collection is the starter 🦔 plus every item granted to them: bought (ST13) or given by a silver tier (ST16). Each granted item arrives once, with its time and source, and is never taken back (P5). The starter is owned by every member and stored nowhere. Its arrival time is when the member opened Coins.
- **ST6. The loadout.** Three kudos emoji slots, `emoji-1`, `emoji-2` and `emoji-3` (#96 adds `hedgehog`). A member who never changed their loadout has the starter in `emoji-1` and the other two empty. Once they change it, the stored loadout is the truth, including a starter taken out.
- **ST7. Equipping.** `equip { item, slot }` puts an owned kudos emoji in a kudos emoji slot, replacing what was there. An item already in another slot moves, so an item fills at most one slot. `takeOff { slot }` empties the slot. Both are free, instant and safe to repeat by state: the same command twice leaves the same loadout. They refuse with `coins-not-open` (the inventory isn't open) or `not-owned`, and change nothing then.

### Kudos emoji count

- **ST8. The loadout parse hook** (P38, D15). A new parse hook claims, for a known giver to whom the store is visible, the Slack emoji names in their loadout as kudos emoji. With the workspace emoji hook, a message's kudos emoji are the union of both. Each occurrence counts as one kudos per recipient and costs allowance exactly like the workspace's emoji. Where the store isn't visible to the giver, the hook claims nothing.
- **ST9. Only the giver's loadout.** The hook reads the giver's loadout and nobody else's. A loadout emoji in someone else's message is an ordinary emoji. Recipients never need to own it.
- **ST10. Edits and retries.** An edit is parsed with the giver's loadout at the edit, like the workspace emoji today. Edit-to-retry of a message the engine has stored still needs a change to its mentions or emoji: equipping an emoji doesn't turn such a message into kudos when it is edited without that change. The engine doesn't store an ordinary message when it is posted, so an edit of a message it never stored is that message's first revision (R21): a message that mentions someone and holds an emoji its giver has since put in a slot becomes kudos when it is edited, even in prose only. This is accepted, as it is for a change of the workspace emoji: it spends only the giver's own allowance on their own loadout emoji, and telling such an edit apart would bring Slack's previous message into the engine for every member, with the store or without it (#347). A pending attempt waiting for a directory recheck is parsed with the loadout when it is evaluated, so equipping in that window can change its cost; this is accepted, as it is for a change of the workspace emoji. Awards already given stay given (ADR-0001), whatever the loadout later holds.
- **ST11. The event says which emoji came from the loadout.** `kudosGiven` gains an optional `loadoutEmoji: string[]`: the distinct kudos emoji in the message that the giver's loadout claimed, including one that is also the workspace's. It is empty or missing when the loadout claimed none. Its `kudosEmoji` field is unchanged.

### The store

- **ST12. What's for sale.** The store lists the ST2 store emoji, minus ST4's, each with its exact emoji and its price, whether or not the member can afford it. An item the member owns is shown as owned, never for sale.
- **ST13. Buying.** `buyItem { item }` is a D17 command whose outcome is stored under its idempotency key in the same mutation as the purchase (CO30). Its checks, in this order: `coins-not-open` (the inventory isn't open), `not-for-sale` (not a store item in the member's workspace, which includes ST4 and an unknown ID), `owned`, `no-coins` (through the wallet's spend step, CO10). A purchase that passes spends the price, adds the item to the collection with source `store`, publishes `itemBought` (P93) and stores `{ kind: "bought", item }`, all in one mutation. A refusal changes nothing and stores `{ kind: "refused", item, reason }`. The same key answers the stored outcome and does nothing else. A bought emoji waits in the collection; it goes in no slot by itself.
- **ST14. Keys.** Slack's key is `slack:` plus the click's trigger, as for `buyPerk`. The website's is `website:{member}:{request}` with a browser UUID (WS88).
- **ST15. Coins stay coins.** A purchase is never refunded or reversed, and an item can't be sold back, given or traded (CO11).

### Silver tiers

- **ST16. Silver tiers give their emoji.** Earning a silver tier writes, in the same mutation, one reward record `{ xp: 0, coins: 0, item: {itemId} }` keyed `tier:{ladder}-silver-kudos-emoji` at the tier's earned time, and adds the item to the collection with source `tier`. This happens whatever any flag says and whatever the member opened (CO1, P75).
- **ST17. Granted back.** A one-off paged job writes the same record and collection row, once, for every silver tier earned before the deploy, with the time it ran. It tells nobody: the items wait in the collection. **The ship runs the job to completion in a deployment before `store` is created or switched on there.** A second run writes nothing, because the reward key exists (P87).
- **ST18. The tier DM.** While the store is visible to the member, a silver tier's DM line says its emoji: `🏅 You earned Generous Soul (Generosity, silver). + :ribbon: Ribbon for your kudos emoji slots`. A batch summary (P62) says the same per tier. Otherwise the line is unchanged.

### The Journey's last step

- **ST19. `your-emoji`** (P89 step 5). It applies to a member while the store is visible to them and their Journey has started: a member predicate, not a workspace one, used alike for its activation, its progress, its App Home and website projection, its DM and its crate. Where it doesn't apply it is silent and unlisted; a reward it already recorded stays recorded (P87).
  - **Activation** is stored once per member, idempotently, by the first of: the Coins opening, an App Home publish, or the Journey's `kudosGiven` subscriber, each finding it applies and unactivated. Its time is that moment, so a member who opened Coins before the store was shown to them is activated when it first is, never at their old opening. No DM.
  - **Finishing.** The first `kudosGiven` whose gate decision is thoughtful and whose `loadoutEmoji` isn't empty finishes it, activating it in the same mutation if needed: the loadout hook claims only where the store is visible (ST8), so such a kudos proves the step applied when it was given, and no qualifying kudos is lost to a late activation.
  - **Copy.** Goal: `Give a kudos that says why with one of your kudos emoji.` Hint, from the member's loadout: `:{first slotted emoji}: is in your slots: use it in a kudos like :{workspace emoji}:. It counts when your message has 5 or more words besides mentions and emoji.`, or, with every slot empty, `Put one of your kudos emoji in a slot in the Inventory tab first.`
  - **Reward** `{ xp: 40, coins: 20, item: null }`, fixed at activation. The Journey catalogue goes to version `2`. Finishing all five steps gives the Journey's hedgehog with #96, not here.

### The flag

- **ST20. Who sees the store.** The store is shown to a member when the `store` flag is on in their member decision and coins are shown to them (CO13), read without an exposure in queries. The mutation that first takes a member down a store path sends their `store` exposure once per value (F25, O36). `store` is not a ship flag in the unlock schedule: the `coins` feature keeps `coins` (CO13).
- **ST21. Coins and inventory.** While the store is shown to a member, the `coins` feature is named `Coins and inventory` and opens `your wallet, the store's kudos emoji and your emoji slots` in every DM, App Home line and `Next:` line. Otherwise it keeps CO13's `Coins` and its wallet-only copy. The feature ID stays `coins`.
- **ST22. Dark where it isn't shown.** Where the store isn't shown to a member, they see nothing of it: no Inventory tab, no slot, no item, no store, no emoji line in a tier DM, no `your-emoji` step, and `inventoryOf` answers null. Their loadout claims nothing (ST8). A stale `Buy`, `Put in slot` or `Take off`, from Slack or the website, writes nothing, spends nothing and publishes nothing. Where the store is shown but the inventory isn't open, the same holds except the stale click is refused with `coins-not-open`. Granting goes on (ST16). Turning the flag off and on again rewrites nothing and shows the same collection and loadout (O35, F24).
- **ST23. Who has it on.** `store` starts on for `environment = sandbox` and for the product owner's email only (decision 18), and stays off for everyone else until the product owner turns it on. A preview never shows in a channel: kudos sent with a previewer's loadout emoji are ordinary kudos, and nothing public names the emoji's source.

### Slack

- **ST24. Opening.** When the store is visible on opening Coins, CO16's DM becomes: `Coins and inventory are open. You already have {balance} 🪙, and 🦔 is in your first kudos emoji slot: use it in a kudos like :{workspace emoji}:.` With a balance of 0, the first sentence is `Coins and inventory are open.` A member who opened Coins before the store was shown to them gets no DM: the Inventory tab and the `your-emoji` step appear in App Home.
- **ST25. The Inventory tab.** App Home gains an `Inventory` tab after `Skill tree`, while the store is visible. In order:
  - the balance: `{balance} 🪙`;
  - `Your kudos emoji`: the three slots, `Slot 1 · 🦔 Hedgehog` with `Take off`, or `Slot 2 · empty`;
  - the line `Each emoji in a slot counts as a kudos, like :{workspace emoji}:.`;
  - `Collection`: each owned emoji not in a slot, with a `Put in slot` menu of the three slots;
  - `Store`: each ST12 item not owned, `🚀 Rocket · 100 🪙` with `Buy`, which asks `Buy 🚀 Rocket for 100 🪙?` before it runs;
  - `Not yours yet`: each tier emoji not owned, with `Silver in {Ladder}`, while the Book is open (P76).

  It is published again after any change to the balance, the collection or the loadout (P68). Refusals show in the tab as `buyPerk`'s do in the skill tree: `You need {price − balance} more 🪙.`, `You already own it.`, `It isn't for sale.`

### For the website (map #57) and hedgehogs (#96)

- **ST26. `inventoryOf(member)`.** An internal query answering null while the store isn't visible to the member, otherwise:

  ```ts
  type ItemId = string;
  type Slot = "emoji-1" | "emoji-2" | "emoji-3"; // #96 adds "hedgehog"
  type Art = { kind: "unicode"; glyph: string } | { kind: "custom"; url: string };
  type Source = { kind: "starter" } | { kind: "store"; price: number } | { kind: "tier"; ladder: LadderId; tier: "silver" };
  type CatalogueItem = { item: ItemId; kind: "kudosEmoji"; name: string; emoji: string; art: Art; source: Source };
  type Inventory = {
    slots: Array<{ slot: Slot; item: ItemId | null }>;
    owned: Array<{ item: ItemId; arrivedAt: number }>;
    catalogue: Array<CatalogueItem & { onSale: boolean }>; // see below, in catalogue order
  };
  ```

  `catalogue` holds every item the member owns or has in a slot, whatever its state (an unpicked custom emoji, a tier item before the Book opens), except custom items ST35 hides, so every ID in `slots` and `owned` has its name and art; plus every item listed in the member's workspace store; plus the tier items they don't own, only while the Book is open (ST25). `onSale` is true exactly for an item `buyItem` could sell them now if they had the coins. The balance stays `walletOf`'s (CO26).
- **ST27. The commands.** D17 gains `buyItem { item }`, `equip { item, slot }` and `takeOff { slot }`. `buyItem` answers `ItemPurchaseOutcome = { kind: "bought"; item } | { kind: "refused"; item; reason: "coins-not-open" | "not-for-sale" | "owned" | "no-coins" }` and stores it by key (ST13). `equip` and `takeOff` store nothing and answer `{ kind: "equipped"; slot; item } | { kind: "takenOff"; slot } | { kind: "refused"; reason: "coins-not-open" | "not-owned" }`. Each answers null, writing nothing, where the store isn't shown (ST22). The website builds its own wrappers on `memberMutation` with WS335's gate: the `coins` feature open and no launch due.
- **ST28. `achievementsOf(member)`.** Each silver tier's reward of kind `kudosEmoji` gains `item: { item, name, emoji, art }` and, on an earned tier, `recordedAt: number | null`, as CO28 does for coins. It is null only for a tier earned before the deploy whose backfill page hasn't run, which ST17 keeps from reaching a member. The website shows it only while `inventoryOf` isn't null.
- **ST29. Quest and Journey facts.** The reward shape stays `{ xp, coins, item }`; `your-emoji` fills `xp: 40, coins: 20, item: null`. Weekly quests still name no items: quest item rewards come with #96, which adds kudos emoji and hedgehogs to the quest pool at once (P86).
- **ST30. Ready for hedgehogs.** The collection, the loadout, the catalogue, `buyItem`, `equip` and `itemBought` take an item kind; #96 adds `hedgehog` items, the `hedgehog` slot and their sources without changing a shape here.

### Admin custom emoji (stopping point 6b)

- **ST31. Picking.** In App Home's `Admin` tab, a workspace administrator (from the directory) picks custom emoji from the workspace's own, through a searchable picker, under `Custom kudos emoji`. Aliases resolve to the emoji they alias. Picking or unpicking is a D17 command, `setCustomKudosEmoji { emoji: string[] }`, safe to repeat by state, refused for a non-admin.
- **ST32. Custom items.** Each picked emoji is a store item in that workspace only: ID `custom:{name}`, its name as `:{name}:`, art `{ kind: "custom", url }` from Slack's list, source `{ kind: "store", price: 100 }`. Everything in ST8–ST15 holds for it. The item is the name, because a message counts by name: if the workspace deletes the emoji and makes a new one under the same name, owners keep the item and it counts with the new art. The art URL is refreshed from Slack's list whenever an admin opens the `Admin` tab.
- **ST33. Unpicking.** An unpicked emoji leaves the store. Members who own it keep it, in their collection and slots, and it still counts (P5). A custom emoji deleted in Slack stays owned; it counts again only if the workspace makes one under the same name.
- **ST34. Scope.** The Slack app gains the bot scope `emoji:read` in both manifests. Until the product owner re-pastes them, the picker says `Reinstall the app to pick custom emoji.` and nothing else changes.
- **ST35. The flag.** `custom-kudos-emoji`, a member decision everywhere, needing the store shown to that member (ST20): the admin's picker, the custom items in a member's store and `inventoryOf`, buying and equipping them, and the loadout hook's claim of a custom emoji are all decided by the member's own decision. So an admin previewing alone can pick and buy, and nobody else sees a custom item. Where it is off for a member, their custom items are hidden and claim nothing, a slot holding one reads as empty and equipping into it replaces it, and they stay owned for when it is on again (F24). It starts sandbox-only plus the product owner's email.
- **ST36. The website.** `inventoryOf` lists custom items like any other. Their art URLs are on `https://emoji.slack-edge.com`, which the website's `img-src` doesn't allow today; the website ticket that shows custom art adds it with a test. 6b's ticket checks that `emoji.list` answers on that host in the sandbox and names any other host it finds.

## Implementation Decisions

- **A store module** (new, deep, `convex/store/`): the item catalogue (ST1–ST4), the `collection` table (member, item, source, arrivedAt; insert-only), the `loadouts` table (member, slot, item; one row per member and slot, written only once a member changes their loadout), the `itemPurchases` table (member, key, outcome), `grantItem` (called by achievements), `buyItem`, `equip`, `takeOff`, `loadoutEmojiOf`, `inventoryOf`, and `storeShownTo`/`storeVisibleTo`. It knows nothing about why an item was earned and spends only through the wallet's `spend` step with `{ item }`. Only the store writes the collection, the loadout and item purchases.
- **The parser** gains the loadout parse hook (ST8) beside `workspace emoji`. `kudosEmoji` hooks stay names-only. The engine asks the loadout hook once more for ST11's `loadoutEmoji`, so the engine still never knows what a loadout is. The hook adds a fixed handful of reads per message (the flag, the unlock, the loadout rows), none per recipient, which keeps the giving mutation within its index-range budget.
- **Bus**: `kudosGiven` gains optional `loadoutEmoji`; `itemBought { workspace, member, item, price, at }` joins the registry (P93).
- **Progression**: the reward record's `item` widens from `null` to `ItemId | null` (P87). `recordReward` is unchanged otherwise.
- **Achievements**: `earnTier` calls the store's `grantItem` and writes ST16's reward record through `recordReward`. The one-off job pages through `earnedTiers` for silver tiers (25 per page, within the 4,096 index ranges and the scheduling limit). `achievementsOf` adds the item (ST28).
- **Quests**: the Journey catalogue at version `2` with `your-emoji`, its copy, its activation on `unlockOpened` for `coins` when the store is shown, and the join for members who opened Coins before (P91), applying per step the way `two-days` follows the Book. Its progress reads `loadoutEmoji` from `kudosGiven`.
- **Unlocks**: the `coins` entry's name and copy become chosen per member (ST21). No schedule version change: what opens and when stays the same.
- **Feedback and the Slack adapter**: the Inventory tab (a new home tab, `inventory`), the opening DM (ST24), the tier DM's emoji (ST18), the tab's refusal lines, and `Put in slot` as a static select over the three slots. App Home's tab bar shows `Inventory` only while the store is visible.
- **Commands (D17)**: `buyItem`, `equip`, `takeOff` (6a) and `setCustomKudosEmoji` (6b). `runCommand`'s answer widens from `PurchaseOutcome | null` to the union of each command's outcome.
- **Flags**: `store` (6a) and `custom-kudos-emoji` (6b), `safeDefault: false`, declared beside the other flags.
- **6b**: the workspace's picked custom emoji in a `customKudosEmoji` table (workspace, name, url, pickedAt, unpickedAt), the Slack `emoji.list` call in the adapter, the external select's options served by the interactivity route, and the manifests' `emoji:read`.
- **Lexicon**: redefine **kudos emoji** (the workspace's emoji plus the emoji in the giver's loadout), **loadout** (a member's three kudos emoji slots, and their hedgehog with #96), **collection** (every item a member owns: the starter, bought and earned), **store** (sells kudos emoji now and hedgehogs with #96 for coins; nothing in it is a random draw) and **cosmetic** (cut: items are kudos emoji and hedgehogs); declare **item** (a kudos emoji or hedgehog a member can own, with a stable ID and one source) and **inventory** (the loadout and the collection together, opened with Coins).
- **Coherence**: the store's component spec with the invariants "only the store writes the collection, the loadout and item purchases", "a purchase spends coins once per idempotency key", "an item is granted to a member at most once", "an item fills at most one slot", and "a loadout emoji counts only for its owner and only where the store is visible"; "the store is dark where it isn't shown" as the gate ticket's oracle.

## Testing Decisions

- **Good tests** enter at the highest seam and check what a member or another module can observe: the Slack calls made, the events published, the records and the rows another module reads. Never private helpers.
- **The Slack boundary is the main seam** (signed events and interactivity through the HTTP router with `convex-test`, Slack stubbed at `fetch`):
  - after opening Coins with the store on, a message `@bob thanks for … :hedgehog:` is a kudos for that recipient and costs one from the allowance; the same message from a member without the store is not a kudos;
  - a message holding the workspace's emoji and a loadout emoji costs two per recipient;
  - `Buy` with and without enough coins, twice with one trigger, and on an owned item;
  - `Put in slot` and `Take off`, then a message with the emoji in and out of the loadout;
  - the opening DM, the Inventory tab, and a silver tier DM with its emoji;
  - the `your-emoji` step finishing on a kudos that says why with 🦔, and not on one with only the workspace's emoji;
  - the whole slice dark with `store` off, not created, the flags key missing, or `coins` off, and on for one member's email only, where every other member's Slack calls equal those with `store` off.

  Prior art: `convex/slack/skillTree.test.ts`, `skillTreeFlag.test.ts`, `defaultKudosEmoji.test.ts`, `previewXpAndBoard.test.ts`, `tierSummaries.test.ts`, `unlocksDm.test.ts`.
- **The modules' internal functions**: `inventoryOf`, `achievementsOf` and the D17 commands' answers, as the website calls them, including the stored outcome on a repeated key; the silver backfill run twice; the Journey join for a member who opened Coins before. Prior art: `convex/website/buyPerk.test.ts`, `convex/achievements/replay.test.ts`, `convex/quests/journey.test.ts`, `existingMembers.test.ts`.
- **The store's invariants**: after any sequence of grants, purchases and equips, every slot holds an owned item, no item fills two slots, no item is granted twice, and the wallet's balance equals its records minus spends.
- **Limits**: the silver backfill under `testBackend({ transactionLimits: true })`; the giving mutation with many recipients and a full loadout, so the hook's reads stay inside the giving mutation's budget.

## Out of Scope

- Hedgehogs, the hedgehog slot, the Journey's hedgehog and quest item rewards (#96).
- Chime-ins and P38's chime-in clause (chime-ins aren't built).
- A per-message choice of emoji style, emoji on the leaderboard or the profile card, and any public line naming where an emoji came from.
- Selling items back, trading, giving away or refunds (ADR-0003).
- Workspace-specific prices; a member uploading emoji.
- Item properties on PostHog events; a later ticket adds `itemBought` to the progression events.

## Review

A GPT-6.1 Sol review (high) of the first draft found 1 blocker, 8 majors and 2 minors. Six were fixed here; five were rejected or narrowed with a reason:

1. **Blocker: 6b's flag mixed a member decision with a workspace one**, so an email-only preview couldn't see its own pick, and a hidden custom emoji kept counting. Fixed: one member decision everywhere, hidden custom items claim nothing and stay owned (ST35).
2. **Major: `your-emoji` had no activation path for members who opened Coins before the store shipped.** Fixed: lazy, idempotent, per-member activation at the moment it first applies (ST19).
3. **Major: a kudos sent before the asynchronous activation would be lost.** Fixed: the qualifying kudos finishes the step and activates it in the same mutation (ST19).
4. **Major: the step reused the Journey's workspace predicate**, which leaks after the flag turns off and hides an email-only preview. Fixed: a member predicate for every use of the step (ST19).
5. **Major: an edit after equipping doesn't award an earlier message.** Rejected as a defect, made explicit: edit-to-retry still needs a change to mentions or emoji, as it does when the workspace emoji changes (ST10). Narrowed at the ship (#347): this holds for a message the engine stored; an edit of one it never stored is its first revision and gives, which ST10 accepts.
6. **Major: a directory recheck reparses with the current loadout.** Accepted and documented (ST10): the window is short, the workspace emoji has the same race, and persisting each attempt's claims adds a table for little.
7. **Major: owned items could lack names and art in `inventoryOf`.** Fixed: `catalogue` covers every owned or slotted item, with `onSale` (ST26).
8. **Major: custom names are reusable.** Narrowed: the item is the name, because messages count by name; a remade emoji counts for its owners with refreshed art (ST32, ST33). A generation ID would let two items claim one name.
9. **Major: WS347's earned-tier page has no event contract.** Rejected for this slice: the website conductor accepted `achievementsOf` with `(ladder, tier)` plus `earnedAt` as the seen key (CO28's note on #297); a tier DM's link to one tier's page is a website-map need, not a store rule.
10. **Minor: the hint promised 🦔 after it was taken out.** Fixed: the hint reads the loadout (ST19).
11. **Minor: split 6a into four ships.** Rejected: everything in 6a is dark behind one flag until the product owner turns it on, the silver backfill must finish before the flag anyway, and each ticket is already its own reviewed pull request into `spec/store`. Four gates and ships would add ceremony and no member-visible step.

## Further Notes

**The product owner's words this spec rests on.**

- Decision 12 (2026-10-13): "things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey", "can we reduce the skill tree to just a single tree?", "Let's lock that design in", corrected to "the onboarding journey is not cut, the rest is as stated". Coins, kudos emoji, hedgehogs, one skill tree and the Book are kept.
- Decision 11 (2026-10-13): "make sure that any new feature going to production, like leveling, the new website, etc. is behind a feature flag."
- Decision 13 (2026-10-13): "I expect you to ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags."
- Decision 18 (2026-10-14): "let's just turn them all on for everyone. I'm going to organically roll this out as we go. Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on. Let's go all in here."

**Calls taken at recommendation** (each recorded with `coherence decide`; ids in the resolution on #31):

1. **Two stopping points.** The admin's custom emoji (6b) needs a new Slack scope, a manifest re-paste and a picker; nothing in 6a needs them. 6a ships first and alone.
2. **The starter is owned by every member and stored nowhere**, and the default loadout is the starter in slot 1 (ST5, ST6). No grant, no backfill and no launch is needed for existing members, and P38's "in the first loadout slot from then" holds by construction.
3. **Silver emoji are granted dark from the deploy and backfilled silently**, completed before the flag goes on (ST16, ST17), as CO7 does for coins. P62's one DM summary is dropped for the same reason: the inventory is almost never open when the store ships, and opening it shows the collection.
4. **The catalogue's content** (ST2): twelve store emoji at 100 🪙 and one silver emoji per shipped ladder, Unicode only, no skin tones, no everyday reactions. The product owner can rename or swap items in a later catalogue version; IDs stay.
5. **A bought emoji goes in no slot by itself** (ST13). Every loadout emoji turns messages with a mention into kudos, so it goes in only when the member puts it there.
6. **Loadout emoji cost allowance like the workspace's** (ST8): P38 says "worth 1 kudos", so they are style, never extra kudos.
7. **The workspace's own emoji is never sold** (ST4).
8. **The store needs coins shown** (ST20): the inventory opens with Coins and spends coins.
9. **The `coins` feature is named per member** (ST21), so nobody whose store is dark is promised slots, and the schedule's version doesn't change.
10. **No DM for members whose Coins was already open** when the store first shows (ST24): the tab and the Journey step say it, and a second opening DM would repeat CO16.
11. **`kudosGiven` carries `loadoutEmoji`** (ST11), so the Journey step needs no loadout read and no race with `takeOff`.
12. **`equip` and `takeOff` store no outcome**: they are safe to repeat by state (WS335), like `openUnlock`.
13. **Weekly quests name no items yet** (ST29): items join the quest pool with hedgehogs, so the draw changes once.
14. **The flag is `store`** (#31's body), sandbox plus the product owner's email (decision 18); 6b gets its own, `custom-kudos-emoji`, because by the time it ships `store` may be on for everyone.
15. **Custom emoji are IDed by name** (ST32): Slack can't rename a custom emoji, only delete and re-add it.

**Casting.** The build tickets run on Opus 5.5 (high); reviews on GPT-6.1 Sol (high).
