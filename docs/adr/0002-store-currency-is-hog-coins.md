# 0002: The Store currency is Hog coins, and kudos become a stat

- Status: accepted
- Date: 2026-09-24
- Supersedes: [0001](0001-store-balance-is-received-kudos.md)
- Context: [Grill the gamification mechanics with the human](https://github.com/Silthus/kudos/issues/55)

## Context

ADR 0001 made received kudos the spendable Store balance, so being popular was what paid. The game settled in #55 wants the opposite: the habit it builds is *giving* thoughtful kudos, and it needs a currency for game items (cosmetics, boosters, spree joins, skill resets). Keeping received kudos as money next to a new game currency would mean two balances, two ways to earn, and a Store coupled to the received-visibility setting.

## Decision

- **Hog coins are the only currency.** The Store, game items and the real-rewards workflow are all priced in Hog coins.
- **Kudos are a stat**: given and received counts, still limited by the daily allowance. Nothing is bought with kudos, and nothing in the game changes the allowance.
- **Hog coins come from giving, not from being popular:** 1 per kudos unit in a *qualifying* (thoughtful) kudos, plus level-ups, quests, daily quests, sprees and garden fruit. Receiving earns XP, never coins.
- **Coins never turn into kudos or allowance**, and kudos never turn into coins.
- The balance is its own ledger (earned − spent ± adjustments), maintained in the same transaction as the event that changes it; a revoke takes back the coins its kudos produced and may push the balance below zero, which blocks spending until it recovers (as 0001 already allowed).
- The real-rewards workflow (catalog, request → approve → fulfil, four-eyes, adjustments, Slack approvals) stays, re-priced in coins, behind an admin switch that is **off by default**. The Store opens with built-in game items that apply instantly.
- Existing received-kudos balances are **reset, not converted**: no workspace holds real balances yet.

## Consequences

- The Store no longer reveals received counts, so the rule "the Store can't be on while received kudos are hidden" goes away.
- `balanceOf` (`received + granted − spent`) is replaced; `storeGranted`/`storeSpent` and balance adjustments move to the coin ledger.
- Paying for giving risks turning appreciation into a transaction (Gneezy & Rustichini, see the gamification research). The guard is that only thoughtful kudos pay, the allowance caps it, and the success metrics in #55 (reach, share of notes with a real "why", share of thank-backs) watch for it.
- When Kudos moves into PostHog, the real-rewards Store goes behind a feature flag there.
