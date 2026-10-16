# Store

Store: a member's items and the store that sells them for coins, knowing nothing about why an item was earned (ST1–ST30): it keeps the versioned item catalogue, version 1, the starter 🦔, twelve store kudos emoji at 100 🪙 and one silver tier's kudos emoji per shipped ladder, each with a stable ID, a name, its Slack emoji name, its art and one source; the insert-only collection of items granted to a member, each once with its time and source, beside the starter every member owns and nobody stores, arriving when they opened Coins; the loadout of three kudos emoji slots, the starter in the first until a member changes it; the loadout parse hook, which claims the giver's loadout emoji as kudos emoji only where the store is visible to them; `inventoryOf`, which gives the website a member's slots, owned items and catalogue, or null while the store isn't visible to them; `buyItem`, the D17 command that sells a store emoji for its price, checking in order that Coins is open, that the item is sold in the member's workspace (never the starter, a tier's emoji, an unknown ID or the workspace's own emoji), that the member doesn't own it, and that the wallet's one spend step, with `{ item }`, covers it, and on success spends, adds the item to the collection with source `store`, in no slot, and publishes `itemBought`, storing the outcome, bought or refused with its reason, under the idempotency key in the same mutation, so the same key answers the stored outcome and does nothing else, and answering null, writing nothing, where the store isn't shown to the member; `equip` and `takeOff`, the D17 commands that put an owned kudos emoji in a slot, moving it out of any other slot, or empty a slot, free and safe to repeat by state, storing no outcome, refusing with `coins-not-open` or `not-owned` and changing nothing then, and answering null, writing nothing, where the store isn't shown to the member, the first change writing all three of the member's slots so a taken-out starter stays out; and `storeShownTo`, the `store` flag on in the member's decision with coins shown to them, and `storeVisibleTo`, shown with Coins opened; the workspace's custom kudos emoji (ST31–ST35): `setCustomKudosEmoji`, the D17 command that sets which of the workspace's own custom emoji are picked, at most 20, each alias resolved to the emoji it aliases and any other name left out, safe to repeat by state and changing nothing for anyone but a workspace admin from the directory to whom the store is shown with `custom-kudos-emoji` on in their own member decision, nor while the app lacks `emoji:read`; the Admin tab's picker for that admin, which asks for a reinstall while the app lacks `emoji:read` and refreshes each picked emoji's art from the workspace's list; and each picked emoji as a store item of that workspace only, `custom:{name}` named `:{name}:` with custom art at 100 🪙, which leaves the store when unpicked and stays owned and counting in its owners' slots, and which, where `custom-kudos-emoji` is off for a member, is hidden from them, claims nothing and reads as an empty slot until it is on again; retired slots (RS1–RS7 on #566): where `slots-retired` is on in the member's decision with the store shown to them, the loadout parse hook claims every kudos emoji the member owns in place of their loadout, the store lists and sells only the workspace's picked custom emoji, App Home's Inventory tab lists every owned emoji with no slot, `Put in slot` or `Take off`, `equip` and `takeOff` answer null and write nothing, `inventoryOf` answers no slots, and the stored loadout stays as it was for when the flag is off again; only this module writes the collection, the loadout and item purchases.

## invariants
- only the store writes the collection, the loadout and item purchases: No module but the store writes a member's collection, loadout or item purchases, only `equip` and `takeOff` write the loadout, and a collected item or a stored purchase, once written, is never changed or deleted.
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
- every slot holds an owned item: Each of a member's kudos emoji slots is empty or holds an item the member owns, because `equip` puts only an owned item in a slot and nothing takes an owned item back.
  over: a seeded sequence of grants, equips of owned, unowned and unknown items and take-offs, read after each step through inventoryOf's slots and owned items
  via: ST7: every slot holds an owned item
  because: every emoji in a slot counts as a kudos for its owner (ST8); a slot holding an item the member doesn't own would let them thank people with an emoji they never bought or earned (ST3, ST7, ST13)
  refuted: equip no longer checked that the member owns the item -> a slot held a rocket the member never owned after the sequence's first equip (2026-10-15)
  kinds: state
  checklist: scoped-reads dismissed: equip reads the clicking member's own collection and slots by member
  checklist: revalidated-permission dismissed: nothing is queued; equip checks the store, Coins and ownership in its own mutation
  checklist: separation-of-duties dismissed: no approval policy; a member fills their own slots
  checklist: legal-state-succession declared as every slot holds an owned item
  checklist: supersession-safety dismissed: Convex serializes the mutations that read and write one member's slots, so a second equip sees the first
  checklist: worker-fencing dismissed: no worker; every equip is one mutation
  checklist: commit-ordered-effects dismissed: equip issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: resumption-coverage dismissed: equip is no batch
  checklist: declared-target-coverage dismissed: equip is the one path that puts an item in a slot, held by the first invariant
  checklist: completion-evidence dismissed: nothing waits on an equip; the answer names the slot and item
- an item fills at most one slot: Putting an item in a slot takes it out of any other slot in the same mutation, so no item fills two of a member's slots.
  over: a seeded sequence of grants, equips into filled, empty and the same slots, and take-offs, read after each step through inventoryOf's slots
  via: ST7: an item fills at most one slot
  because: an item is owned once (ST5), so it counts once and shows once; an emoji in two slots would hold a slot for nothing and give the website two slot entries for one item (ST7, ST26)
  refuted: equip put the item in the slot without taking it out of the slot it was in -> 🦔 filled two slots after step 31 of the sequence (2026-10-15)
  kinds: state
  checklist: scoped-reads dismissed: equip reads and writes the clicking member's own slots by member
  checklist: revalidated-permission dismissed: nothing is queued; equip runs in the clicking member's mutation
  checklist: separation-of-duties dismissed: no approval policy; a member fills their own slots
  checklist: legal-state-succession declared as an item fills at most one slot
  checklist: supersession-safety dismissed: Convex serializes the mutations that read and write one member's slots, so a second equip sees the first
  checklist: worker-fencing dismissed: no worker; every equip is one mutation
  checklist: commit-ordered-effects dismissed: equip issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: resumption-coverage dismissed: equip is no batch
  checklist: declared-target-coverage dismissed: equip and takeOff are the only writers of slots, held by the first invariant
  checklist: completion-evidence dismissed: nothing waits on an equip; the answer names the slot and item
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
- with slots retired, an owned kudos emoji counts only for its owner and only where the store is visible: Where `slots-retired` is on in the giver's member decision, the loadout parse hook claims every kudos emoji the giver owns, the starter, bought, tier-earned and shown custom ones, whatever their loadout holds, and nothing they don't own, only while the store is visible to them, so the same emoji in a message from a member who doesn't own it, from an owner whose slots aren't retired and haven't slotted it, or from the owner with the store or coins off, is an ordinary emoji.
  over: messages from their owner with slots retired holding an owned 🚀 in no slot, a 🦔 taken out of the slots with a tier's 🎀, an owned custom emoji after it left the store with `custom-kudos-emoji` on and off, and emoji the owner doesn't own; the same 🚀 from a member who doesn't own it and from an owner whose slots aren't retired; and the owner's owned emoji with the store or coins off, read through the giver's replies and the published kudosGiven events
  via: RS2: with slots retired, every kudos emoji the giver owns counts
  because: every owned kudos emoji turns a message with a mention into a kudos once slots retire (RS2); claiming an emoji the giver doesn't own, or claiming where the store is dark, would spend allowance on messages nobody meant as kudos and leak the preview into everyone's counts (ST9, ST22, ST23)
  refuted: everyOwnedEmojiOf in convex/store/inventory.ts claimed every catalogue emoji beside the owned ones -> 1 of 6 tests failed on its assertion: Alice's message with 🌻 and 🎀, neither owned, was a kudos (2026-10-16)
  kinds: state
  checklist: scoped-reads declared as with slots retired, an owned kudos emoji counts only for its owner and only where the store is visible
  checklist: revalidated-permission dismissed: a recheck waiting on the directory parses with the owned emoji when it is evaluated, which ST10 accepts for the loadout
  checklist: separation-of-duties dismissed: no approval policy; a giver's own items decide their own kudos emoji
  checklist: legal-state-succession dismissed: the hook writes nothing but the flag's exposure
  checklist: supersession-safety dismissed: the hook writes nothing but the flag's exposure
  checklist: worker-fencing dismissed: the hook runs inside the giving mutation
  checklist: commit-ordered-effects dismissed: the hook issues no external effect; the exposure is captured through the outbox after the giving mutation commits
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: resumption-coverage dismissed: the hook is no batch
  checklist: declared-target-coverage dismissed: the parser asks every hook for every message, the loadout hook among them
  checklist: completion-evidence dismissed: nothing waits on a claim
- with slots retired, the store sells no standard kudos emoji: Where `slots-retired` is on in the member's decision, App Home's store lists, and `buyItem` sells, only the workspace's picked custom kudos emoji; a stale `Buy` of a standard store emoji is refused `not-for-sale` and spends nothing, while every emoji the member owned stays listed among their kudos emoji, and a member whose slots aren't retired still buys the standard ones.
  over: a member with slots retired owning 🚀 and 🎀 with a picked custom emoji, through App Home's Inventory tab, a stale Buy of 🌻 and a Buy of the custom emoji; and a member whose slots aren't retired buying 🚀, read through the published App Home, the balance and the collection
  via: RS3 RS4: with slots retired, the store stops selling standard emoji and owners keep theirs
  because: the product owner retired the slots so that owning many common emoji can't turn ordinary messages into kudos (call 9 on #558); a standard emoji still sold would let a member buy exactly that, and the owned ones must stay theirs (P5, ST15)
  refuted: storeItemsIn in convex/store/inventory.ts kept the standard catalogue on the shelf with slots retired -> 2 of 3 tests failed on their assertions: the Inventory tab's Store listed the twelve standard emoji and a stale Buy of 🌻 spent 100 🪙 (2026-10-16)
  kinds: state, output
  checklist: scoped-reads dismissed: the store reads the clicking member's own decision, collection and workspace
  checklist: revalidated-permission dismissed: buyItem rereads the flag decision in the click's own mutation before it spends
  checklist: destination-confinement dismissed: App Home goes only to the member it is about
  checklist: redaction dismissed: items and prices are game data, not confidential
  checklist: separation-of-duties dismissed: no approval policy; a member buys for themselves
  checklist: legal-state-succession dismissed: the flag changes no stored state
  checklist: supersession-safety dismissed: each click and render rereads the flag decision in its own transaction
  checklist: worker-fencing dismissed: no worker; every purchase is one mutation
  checklist: commit-ordered-effects dismissed: a purchase issues no external effect; itemBought's subscribers are scheduled in its transaction
  checklist: resumption-coverage dismissed: a purchase is no batch
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: buyItem is the one path that sells an item, and App Home's store and inventoryOf list through the same shelf
- the store is dark wherever it isn't shown: A member for whom `store` is off in the member decision, not created, or undecided because the flags key is missing, or for whom `coins`, `xp-levels` or `unlocks` is off, sees nothing of the store in any Slack call: no Inventory tab, slot, item, Store, tier emoji line or `your-emoji` step, `Coins` keeps CO13's name, `inventoryOf` answers null and their loadout claims nothing, while a silver tier they earn still grants its emoji; with `store` on for one member's email only, every other member's Slack calls, and which of their messages are kudos, equal those with `store` off, and no public message names the store (ST20, ST22, ST23).
  over: one walk down every store path (Coins' readiness and opening, App Home and its Inventory tab, a silver tier's DM, a Buy, two Put in slot and a Take off, and a kudos with only loadout emoji) for a member with `store` on for their email, off, not created, on while the flags key is missing, and on with `coins`, `xp-levels` or `unlocks` off; the previewer once each of `coins`, `xp-levels` and `unlocks` turns off after their slots were filled; and the other members' side of both members' walks, with every public message, with `store` on for the first member's email and off
  via: ST20 ST22 ST23: the store is dark wherever it isn't shown
  refuted: storeShownTo in convex/store/visibility.ts answered whether coins apply to the member, ignoring their store decision -> 3 of 8 tests failed on their assertions: with store off and not created, the walk's Slack calls named the store and its emoji, and with store on for one member's email only, the other member's calls named them too (2026-10-15)
  because: decision 11 ships every new feature dark behind its flag and decision 18 starts `store` for the sandbox and the product owner only (ST23); an Inventory tab, a slot or a tier emoji line shown where the store isn't shown would preview the store to members the product owner hasn't chosen, and a loadout emoji counted there would spend allowance on messages nobody meant as kudos
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  kinds: output, state
  checklist: revalidated-permission dismissed: no permission is involved; each store path reads the member decision in the mutation or query that renders or acts
  checklist: destination-confinement dismissed: the DMs and App Home go to Slack's API at one configured base URL, to the member's own conversations, with no destination taken from input
  checklist: redaction dismissed: the store's lines are left out by the member's own flag decision, and nothing designated sensitive is scrubbed from what remains
  checklist: separation-of-duties dismissed: no approval policy; a member sees and acts on only their own items
  checklist: legal-state-succession dismissed: the invariant is about what is shown and claimed, not about the order of stored states
  checklist: supersession-safety dismissed: every path rereads the flag decision in its own transaction
  checklist: worker-fencing dismissed: no worker owns a member's items
  checklist: commit-ordered-effects dismissed: App Home reads the flag in the mutation that renders it, and each DM's delivery query reads it before Slack is called, after the mutation that wrote the DM committed
  checklist: resumption-coverage dismissed: no batch shows the store; the silver backfill tells nobody (ST17)
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: a DM and an App Home each have exactly one target, the member they are about
- turning the store off takes nothing away: Turning `store` off and on again rewrites nothing and shows the same collection, loadout and activity, an earned `your-emoji` hidden from the activity while it is off; a stale `Buy`, `Put in slot` or `Take off` clicked where the store isn't shown, from a store published while it was on or with `coins`, `xp-levels` or `unlocks` off, writes nothing, spends nothing and publishes no domain event; the `store` exposure goes once per member and value, and none where `coins`, `xp-levels` or `unlocks` is off (ST22, O35, O36).
  over: a member who bought, slotted and took off kudos emoji and finished `your-emoji` with `store` on for their email, through App Home and their activity with it off and on again; stale `Buy`, `Put in slot` and `Take off` clicks after the flag turned off and with `store` off or on with `coins`, `xp-levels` or `unlocks` off, read through every stored row and the domain events published; and the exposures of a member with the flag on for their email and one without, through the flag turned off and on again
  via: ST22 O35 O36: the store flag turned off and on, its stale clicks and its exposure
  refuted: equip in convex/store/equipping.ts no longer asked whether the store is shown to the member before filling a slot -> 2 of 10 tests failed on their assertions: a stale Put in slot with store off, and one from a store published while it was on, wrote the member's loadout (2026-10-15)
  because: ST22 and F24 promise that ending a preview takes nothing away and that a store the member can't see can't change; Slack keeps a published view's buttons and menus until the next publish, so a stale click would otherwise spend coins or fill a slot the member can no longer see
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  kinds: state, output
  checklist: revalidated-permission dismissed: no permission is involved; buyItem, equip and takeOff reread the store predicate in the click's mutation before they write
  checklist: destination-confinement dismissed: a click changes only the clicking member's own items, and App Home goes only to them
  checklist: redaction dismissed: items and slots are game data, not confidential
  checklist: separation-of-duties dismissed: a member buys and slots only their own items; no approval is involved
  checklist: legal-state-succession dismissed: the flag changes no stored state, so there is no succession to guard
  checklist: supersession-safety dismissed: each click rereads the flag decision and the member's rows in its own transaction
  checklist: worker-fencing dismissed: no worker owns a member's items
  checklist: commit-ordered-effects dismissed: itemBought is published from the mutation that buys and its subscribers run after it commits
  checklist: resumption-coverage dismissed: one click is one mutation, not a batch
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: a click changes one member's items; nothing fans out
- only an admin who sees the picker picks custom kudos emoji: `setCustomKudosEmoji` changes the workspace's custom kudos emoji only for a workspace admin from the directory to whom the store is shown with `custom-kudos-emoji` on in their own member decision; for a member who isn't an admin, and for an admin with `custom-kudos-emoji` off, not created or the store off, it writes nothing, the Admin tab shows no picker and the picker's search answers no options.
  over: a member who isn't an admin, with a stale pick and a search; an admin with `custom-kudos-emoji` off, not created, and with the store off, with the Admin tab, a stale pick and a search; read through the stored custom kudos emoji, the published App Home and the search's answer
  via: ST31: only an admin who sees the picker picks custom kudos emoji
  because: ST31 lets only workspace administrators choose which custom emoji the workspace's store sells, and ST35 makes the picker each admin's own preview; a member who picks would put any custom emoji on sale for everyone, and a picker where the flag is off would preview the custom store to admins the product owner hasn't chosen
  refuted: picksCustomKudosEmoji no longer asked whether the clicking member is a workspace admin -> 1 of 4 tests failed on its assertions: a member who isn't an admin picked :shipit: with a stale pick (2026-10-15)
  crossing: slack-request -> domain
  entrances: route POST /slack/interactivity
  kinds: state, output
  checklist: revalidated-permission dismissed: the click's mutation reads the admin role from the directory and the member decision before it writes; nothing is queued
  checklist: destination-confinement dismissed: a pick changes only the clicking admin's own workspace, and the search answers only the request it was asked in
  checklist: redaction dismissed: custom emoji names and art are visible to everyone in the workspace in Slack already
  checklist: separation-of-duties dismissed: no approval policy; one admin's pick stands, as for the announcement channel and the group mode
  checklist: legal-state-succession dismissed: picking sets the whole picked set from the click, so any order of clicks leaves the last click's set
  checklist: supersession-safety dismissed: Convex serializes the mutations that read and write a workspace's custom kudos emoji, so a second click sees the first
  checklist: worker-fencing dismissed: no worker; every pick is one mutation
  checklist: commit-ordered-effects dismissed: a pick issues no external effect; the admins' App Home is published by a job scheduled in its transaction
  checklist: resumption-coverage dismissed: a pick is no batch
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: setCustomKudosEmoji is the one writer of the custom kudos emoji, and the search reads them through the same admin and flag check
- custom kudos emoji are dark where custom-kudos-emoji isn't on for the member: where `custom-kudos-emoji` is off, not created or unread for want of the flags key, or on with the store not shown to the member, no Slack call to the member names a custom kudos emoji or the picker, the picker's search answers them no options, `inventoryOf` lists them no custom item, their custom kudos emoji claim nothing, and their stale picks, `Buy` and `Put in slot` clicks pick, buy and slot nothing and spend no coins; turning it on again shows the same slots and items; with it on for one admin's email only, that admin picks, buys and gives with a custom kudos emoji, every other member's distinct Slack calls, kudos and `inventoryOf` equal those with it off, and nothing said in a channel names where the admin's emoji came from (ST23); the `custom-kudos-emoji` exposure goes once per member and value, and none where the store isn't shown (ST35, ST23, O36, F24, F25).
  over: an admin who picked two custom kudos emoji and a member who bought one and put it in a slot, then the flag off, not created and without the flags key, and the store or coins off for that member, and an admin to whom the store isn't shown, each walking the Admin tab, the picker's search, a stale pick, the Inventory tab, a stale `Buy` and `Put in slot` and a kudos with the custom kudos emoji, read through every Slack call to them, the search's answer, `inventoryOf`, the kudos given and the stored custom kudos emoji, collection, loadouts, bought items, wallets and coin spends; an admin previewing alone, compared with the flag off, and what was said in a channel; and the exposures of a previewing admin, a member with it off, a member and an admin the store isn't shown to, through the flag turned on for that member
  via: ST35 O36: custom kudos emoji are dark wherever custom-kudos-emoji isn't on for the member, and its exposure goes once per member and value
  refuted: customKudosEmojiShownTo and customKudosEmojiShownAndExposedTo no longer read the member's custom-kudos-emoji decision -> 4 of 7 tests failed on their assertions: with the flag off or not created a member's custom kudos emoji showed and claimed, an admin previewing alone was no longer alone, and the exposure went true for a member it is off for (2026-10-15)
  because: ST35 makes custom kudos emoji each member's own preview, needing the store, and decision 18 ships them on for the sandbox and the product owner's email only; a leak would show a custom emoji, sell it or count it as kudos for members the product owner hasn't chosen, and F24 promises that ending the preview takes nothing away
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  kinds: output, state
  checklist: revalidated-permission dismissed: every path rereads the member decision and the store predicate in the query or mutation that renders, sells, slots or claims
  checklist: destination-confinement dismissed: App Home and the search's answer go only to the member who opened or typed, through Slack's API at one configured base URL
  checklist: redaction dismissed: custom emoji names and art are visible to everyone in the workspace in Slack already; hiding them is the member's flag decision, not a scrub
  checklist: separation-of-duties dismissed: no approval policy; each member sees and acts on only their own items
  checklist: legal-state-succession dismissed: the flag changes no stored state, so there is no succession to guard
  checklist: supersession-safety dismissed: each click, render and kudos rereads the flag decision in its own transaction
  checklist: worker-fencing dismissed: no worker owns a member's items or the picked custom kudos emoji
  checklist: commit-ordered-effects dismissed: App Home reads the flag in the mutation that renders it; the search answers from a query before anything is sent
  checklist: resumption-coverage dismissed: no batch shows custom kudos emoji; republishing the admins' App Home renders each one through the same decision
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: a render, a click or a kudos has one member as its target, and the admins' republish renders each admin through their own decision
