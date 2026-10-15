# Wallet

Wallet: a member's coins, knowing nothing about why they were earned or what they buy (CO9–CO12): it keeps one cached balance per member, credited by progression in the same mutation that writes a coin-bearing effects or reward record, Achievements' tier coins included, or, for a held reward, in the mutation that opens its crate first (CR8), so a read never sums history; it keeps insert-only spend records, each with the member, the coins, what they paid for (`{ perk }` or `{ item }`) and the time; its one spend step, called inside a purchase's own mutation, either debits the price and writes one spend record, or answers `no-coins` and writes nothing, so the balance never goes below 0, while a price of 0 answers `spent` and writes nothing; a credit or spend that isn't a whole number of coins is refused with an error, so its mutation, record included, writes nothing; `walletOf` gives the website a member's `{ balance }`, or null while coins aren't visible to them (CO26), visible meaning the `coins` flag is on in their member decision, XP and levels and unlocks apply to them, and they have opened Coins (CO13); coins never expire, are never transferred, refunded or turned into kudos, allowance or XP, and a spend is never reversed (ADR-0003, P30); only this module writes the balance or a spend record.

## invariants
- a balance is what the records add up to: A member's balance equals the coin lines on their effects records plus the coins on their reward records, a held reward's counted from its crate opening's `applied` once opened and not before (CR8), minus the coins they spent, after every kudos, reward and spend, and it never goes below 0: a spend the balance can't cover answers `no-coins` and writes nothing.
  over: every step of a sequence of kudos that say why and don't, a quest reward with coins and the same reward again with its key, a held quest reward with coins unopened, opened and opened again beside one that counted at its finish, a reward without coins, spends the balance covers and spends it can't, down to a balance of 0 and a spend from nothing, spends of a negative price, a fraction and NaN, rewards of a negative and a fractional amount, a spend of 0, read through balanceOf and the effects, reward and spend records after each step, and every stored row around a refused spend
  via: CO9 CO10: a member's balance equals their coin lines and reward coins minus their spends, and never goes below 0
  because: the balance is a cached sum so a read never sums history (CO9); a credit missed, applied twice or applied without its record would show coins nobody earned or hide coins they did, and a spend past the balance would take a member below 0, which P30 forbids
  refuted: recordReward no longer credited the wallet with the reward's coins -> the step-by-step case and the spend case read a balance short of the reward's coins (2026-10-14)
  kinds: storage, state
  checklist: scoped-reads dismissed: walletOf reads one member's row by the member it is given; the website's guard decides which member that is
  checklist: revalidated-permission dismissed: nothing is queued; a spend runs inside the purchase's own mutation and reads the balance there
  checklist: encrypted-storage dismissed: a balance and spend records are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: credit and spend take only internal arguments from progression and purchases, checked by the record validators; nothing from outside reaches them
  checklist: revision-preservation dismissed: the balance is a cache of the records, which are insert-only and keep the history
  checklist: separation-of-duties dismissed: no approval policy; a member spends their own coins in their own purchase
  checklist: legal-state-succession declared as a balance is what the records add up to
  checklist: supersession-safety dismissed: Convex serializes the mutations that read and write one member's wallet row, so no late write displaces another
  checklist: worker-fencing dismissed: no worker owns a wallet; every write is one mutation
  checklist: commit-ordered-effects dismissed: the wallet issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched; the credit is written in the mutation that writes its record
  checklist: resumption-coverage dismissed: the batches that write the wallet, Achievements' launch replay and tier evaluation pages, which pay the tiers they earn, and its tier backfill, credit only through recordReward, whose key makes a page retried, or a run resumed or repeated from the start, credit nothing twice
  checklist: declared-target-coverage dismissed: the writers are recordEffects and recordReward through progression's record and recordReward, both covered by the oracle's steps
  checklist: completion-evidence dismissed: nothing waits on a credit; it commits with its record or not at all
- only the wallet writes the balance: No module but the wallet writes a member's cached balance or a spend record, and a spend record, once written, is never changed or deleted.
  over: every module under convex/, outside its tests and the generated code
  via: CO12: only the wallet writes the balance and the spend records, and spends are never changed
  because: one writer keeps the balance equal to its records (CO12); a second module patching the balance, or a spend changed or deleted, would refund or mint coins outside a record, which CO11 forbids
  refuted: progression's record wrote the wallets table itself instead of crediting through the wallet -> the detector found convex/progression/progression.ts writing wallets (2026-10-14)
  kinds: storage
  checklist: scoped-reads dismissed: the invariant is about writes
  checklist: encrypted-storage dismissed: a balance and spend records are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the tables' schema validators check every row the wallet writes
  checklist: revision-preservation declared as only the wallet writes the balance
  checklist: commit-ordered-effects dismissed: the wallet issues no external effect
  checklist: durable-dispatch-intent dismissed: nothing is dispatched
  checklist: declared-target-coverage dismissed: the detector reads every module under convex/ for the two table names
  checklist: completion-evidence dismissed: nothing waits on a write
