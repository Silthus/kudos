# 0001: The Store balance is received kudos, not a second currency

- Status: superseded by [0002](0002-store-currency-is-hog-coins.md)
- Date: 2026-09-23
- Context: [Spec the Rewards Store](https://github.com/Silthus/kudos/issues/4) (decisions D1–D4), implemented from [#13](https://github.com/Silthus/kudos/issues/13)

## Context

The Rewards Store lets members turn recognition into rewards (coffee, a donation, a day off). Something has to be spendable. The options were a separate currency ("points" earned by rules of their own) or the kudos a member has already received.

## Decision

A member's spendable **balance** is derived from the kudos they received:

```
balance = members.totalReceived + (members.storeGranted ?? 0) − (members.storeSpent ?? 0)
```

- There is no second currency. Spending increases `storeSpent`; admin or system adjustments change `storeGranted`. **Spending never changes `totalReceived`**, so leaderboards, analytics and Discoveries remain pure recognition.
- All-time received kudos count, including those received before the Store was enabled.
- The balance needs no engine change: `giveKudos` and `revokeKudosRow` already maintain `totalReceived` in the same transaction.
- A balance is a received count in disguise. So the Store **cannot be enabled while `receivedVisibility = "hidden"`**, and received kudos can't be hidden while the Store is on. Balances are shown only to their owner and to admins, whatever the visibility setting.
- A revoke after spending can push a balance below zero. That is allowed; it blocks new redemptions until new kudos arrive.

## Consequences

- One vocabulary: "the tacos people gave me are mine to spend" (the HeyTaco and Bonusly model people already know).
- The Store is coupled to the visibility setting; the admin UI has to explain why "Hidden" is disabled while the Store is on, and vice versa.
- If the read models ever replace `members.totalReceived` ([#3](https://github.com/Silthus/kudos/issues/3)), `balanceOf` in `convex/lib/store.ts` must follow. It is the only place the formula lives.
- Reversing this later (introducing a separate currency) would need a migration of every balance and a new earning model, which is why it is recorded here.
