# Store

Store: a member's items and the store that sells them for coins, knowing nothing about why an item was earned (ST1–ST30): it keeps the versioned item catalogue, version 1, the starter 🦔, twelve store kudos emoji at 100 🪙 and one silver tier's kudos emoji per shipped ladder, each with a stable ID, a name, its Slack emoji name, its art and one source; the insert-only collection of items granted to a member, each once with its time and source, beside the starter every member owns and nobody stores, arriving when they opened Coins; the loadout of three kudos emoji slots, the starter in the first until a member changes it; the loadout parse hook, which claims the giver's loadout emoji as kudos emoji only where the store is visible to them; `inventoryOf`, which gives the website a member's slots, owned items and catalogue, or null while the store isn't visible to them; `buyItem`, the D17 command that sells a store emoji for its price, checking in order that Coins is open, that the item is sold in the member's workspace (never the starter, a tier's emoji, an unknown ID or the workspace's own emoji), that the member doesn't own it, and that the wallet's one spend step, with `{ item }`, covers it, and on success spends, adds the item to the collection with source `store`, in no slot, and publishes `itemBought`, storing the outcome, bought or refused with its reason, under the idempotency key in the same mutation, so the same key answers the stored outcome and does nothing else, and answering null, writing nothing, where the store isn't shown to the member; and `storeShownTo`, the `store` flag on in the member's decision with coins shown to them, and `storeVisibleTo`, shown with Coins opened; only this module writes the collection, the loadout and item purchases.

## invariants
- only the store writes the collection, the loadout and item purchases: No module but the store writes a member's collection, loadout or item purchases, and a collected item or a stored purchase, once written, is never changed or deleted.
  over: every module under convex/, outside its tests and the generated code
  via: ST5 ST6 ST13: only the store writes the collection, the loadout and item purchases, and the collection and purchases are insert-only
  because: one writer keeps an item granted once and owned for good (ST5, P5); a second module inserting into the collection could grant an item twice, and a change or delete would take back an item a member owns
  refuted: grantItem moved an owned item's arrival time with a patch -> the detector found a patch in convex/store/inventory.ts (2026-10-14)
  refuted: the website's buyPerk wrapper also stored an item purchase under its request key -> the detector found convex/website/commands.ts writing itemPurchases (2026-10-15)
  kinds: storage
  checklist: scoped-reads dismissed: the invariant is about writes
  checklist: encrypted-storage dismissed: items and slots are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the tables' schema validators check every row the store writes
  checklist: revision-preservation declared as only the store writes the collection, the loadout and item purchases
  checklist: commit-ordered-effects dismissed: the store issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: declared-target-coverage dismissed: the detector reads every module under convex/ for the two table names
  checklist: completion-evidence dismissed: nothing waits on a write
- an item is granted to a member at most once: Granting an item a member already owns writes nothing and answers that nothing was granted, so the collection holds each item once per member with its first arrival.
  over: a tier item granted, then granted again later, read through grantItem's answers and inventoryOf's owned items
  via: ST5: an item is granted to a member at most once
  because: an item is owned once, never stacked (ST5); a second row would list it twice and break the website's one entry per owned item (ST26)
  refuted: grantItem inserted an item without looking for the member's earlier row -> the second grant answered true and inventoryOf listed the ribbon twice (2026-10-14)
  kinds: storage, state
  checklist: scoped-reads dismissed: a grant reads one member's row for one item by the member and item it is given
  checklist: revalidated-permission dismissed: nothing is queued; a grant runs inside its caller's mutation
  checklist: encrypted-storage dismissed: items are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: grantItem takes only internal arguments, checked by the collection's validator
  checklist: revision-preservation dismissed: the collection is insert-only, guarded by the first invariant
  checklist: separation-of-duties dismissed: no approval policy; the game grants items
  checklist: legal-state-succession declared as an item is granted to a member at most once
  checklist: supersession-safety dismissed: Convex serializes the mutations that read and write one member's collection row for an item, so a second grant sees the first
  checklist: worker-fencing dismissed: no worker owns a collection; every grant is one mutation
  checklist: commit-ordered-effects dismissed: a grant issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: resumption-coverage dismissed: a batch that grants, retried or resumed, finds the row it wrote and grants nothing twice
  checklist: declared-target-coverage dismissed: grantItem is the one writer of the collection, held by the first invariant
  checklist: completion-evidence dismissed: nothing waits on a grant; it commits with its caller or not at all
- a purchase spends coins once per idempotency key: `buyItem` stores its outcome under its idempotency key in the mutation that spends, so the same key, delivered again, answers the stored outcome and spends, grants and publishes nothing, whatever the member's balance, collection or the item named since; a refused key stays refused after the member earns the coins.
  over: a purchase repeated with its key, the same key naming another item, a refusal for coins repeated after earning them, and a new key buying again, read through buyItem's answers, the collection, the spend records and the balance against its records
  via: a purchase spends coins once per idempotency key
  because: a retried website request or a click delivered twice must never pay twice (ST13, ST14, CO30); a key that bought again, or a refused one that bought later, would spend coins the member never meant to spend
  refuted: buyItem answered a stored outcome only for a refused key -> the repeated bought key ran the purchase again and answered owned (2026-10-15)
  kinds: state, storage
  checklist: scoped-reads dismissed: a purchase reads the clicking member's own stored outcome by member and key
  checklist: revalidated-permission dismissed: nothing is queued; a purchase checks the store and Coins in its own mutation
  checklist: encrypted-storage dismissed: purchases are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the command validator checks the item is a string; an unknown ID is refused not-for-sale
  checklist: revision-preservation dismissed: purchases are insert-only, guarded by the first invariant
  checklist: separation-of-duties dismissed: no approval policy; a member spends their own coins
  checklist: legal-state-succession declared as a purchase spends coins once per idempotency key
  checklist: supersession-safety dismissed: Convex serializes the mutations that read and write one member's purchase row for a key, so a second delivery sees the first
  checklist: worker-fencing dismissed: no worker; every purchase is one mutation
  checklist: commit-ordered-effects dismissed: a purchase issues no external effect; itemBought's subscribers are scheduled in its transaction
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: resumption-coverage dismissed: a purchase is no batch
  checklist: declared-target-coverage dismissed: buyItem is the one path that spends coins for an item, held by the first invariant and the wallet's
  checklist: completion-evidence dismissed: the stored outcome is the evidence; the caller reads it back under the same key
- a loadout emoji counts only for its owner and only where the store is visible: The loadout parse hook claims a giver's own loadout emoji as kudos emoji only while the store is visible to that giver, so the same emoji in anyone else's message, or in theirs while the store is off, coins are off, the flag is missing or Coins is unopened, is an ordinary emoji.
  over: messages with 🦔 from its owner with the store visible, from another member, from a member with Coins open and the store not shown, and from the owner with the store off, not created and coins off, read through the giver's replies and the published kudosGiven events
  via: ST8 ST9 ST22: a loadout emoji counts only for its owner and only where the store is visible
  because: every loadout emoji turns a message with a mention into a kudos (ST8); claiming it for someone else, or where the store is dark, would spend allowance on messages nobody meant as kudos and leak a preview into everyone's counts (ST9, ST22, ST23)
  refuted: loadoutEmojiOf claimed the loadout without asking whether the store is visible to the giver -> 🦔 counted in another member's message, from a member without the store, and with the store off, not created and coins off (2026-10-14)
  kinds: state
  checklist: scoped-reads declared as a loadout emoji counts only for its owner and only where the store is visible
  checklist: revalidated-permission dismissed: a recheck waiting on the directory parses with the loadout when it is evaluated, which ST10 accepts
  checklist: separation-of-duties dismissed: no approval policy; a giver's own loadout decides their own kudos emoji
  checklist: legal-state-succession dismissed: the hook writes nothing
  checklist: supersession-safety dismissed: the hook writes nothing
  checklist: worker-fencing dismissed: the hook runs inside the giving mutation
  checklist: commit-ordered-effects dismissed: the hook issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: resumption-coverage dismissed: the hook is no batch
  checklist: declared-target-coverage dismissed: the parser asks every hook for every message, the loadout hook among them
  checklist: completion-evidence dismissed: nothing waits on a claim
