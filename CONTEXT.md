# Kudos domain glossary

The shared vocabulary of the Kudos codebase. Use these words in code, tests, UI copy and tickets, and avoid the ones marked as "not". Each feature area has its own section; add a section rather than redefining a term.

Decisions that are hard to reverse live in [`docs/adr/`](docs/adr/).

## Rewards Store

Specified in [Spec the Rewards Store](https://github.com/Silthus/kudos/issues/4). Core rules live in `convex/lib/store.ts`; every balance, stock or redemption change goes through `convex/store.ts`.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Store** | A workspace's rewards catalog plus the redemption workflow. Admins switch it on or off (`workspaces.storeEnabled`, off by default). It can't be on while received kudos are hidden. | — |
| **Reward** | An item in the catalog that members can request by spending their balance. Archived, never deleted. | "prize" or "item" (don't use these) |
| **Balance** | What a member can spend: `totalReceived + granted − spent` (`balanceOf`). Private to the member and admins. It can go negative when spent kudos are revoked. See [ADR 0001](docs/adr/0001-store-balance-is-received-kudos.md). | *received*, a lifetime recognition count that spending never reduces |
| **Redemption** | One member's request for one reward, with the cost and reward details frozen at request time. | "order" or "purchase" (don't use these) |
| **Hold / debit** | The cost is subtracted from the balance as soon as a redemption is created. | — |
| **Refund** | When a pending or approved redemption is declined or cancelled, the cost goes back to the balance and stock is restored. | *revoke*, which undoes a *kudos* (engine) |
| **Grant / adjustment** | An audited, admin- or system-made change to a balance, with a reason. | *kudos*: a grant is not recognition and never appears on leaderboards |
| **Decider** | The admin who approves, fulfils or declines a redemption. | *requester*, the member who redeemed |
