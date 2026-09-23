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

## Quests

Specified in [Spec the Quest system](https://github.com/Silthus/kudos/issues/5). The catalog, board draw and evaluator live in `convex/lib/quests.ts` (pure); boards, completions and the engine hooks in `convex/quests.ts`. Quests only measure the member's own *giving*, never what they receive, and progress is never stored: it's recomputed from kudos rows.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Quest** | A weekly goal about the member's own giving, defined in the built-in catalog (`QUESTS`). | "challenge", "mission", "achievement" (don't use these) |
| **Quest week** | Monday 00:00 to Sunday 24:00 in the workspace timezone, the same week as `resolvePeriod("week")`. Identified by its **week key**, the Monday's `YYYY-MM-DD` day key (`weekKeyOfDay`). | a rolling 7-day window |
| **Quest board** | The 3 quests every member of a workspace gets for one quest week. Seeded draw, stored (`questBoards`) the first time a mutation needs it. | — |
| **Note** | The words in a kudos message other than mentions, channel links, URLs and emoji (`countNoteWords`, stored as `kudos.noteWords`). Reactions have no note. | the kudos *text*, the readable preview |
| **Qualifying kudos** | A kudos row whose Note has at least 3 words and that is not Reciprocal. Only qualifying kudos move quest progress. | any kudos: every kudos still counts everywhere else |
| **Reciprocal kudos** | A kudos from G to R where R gave G any kudos in the 72 hours before it. The kudos goes through as normal; it just doesn't move quests. | — |
| **Quest completion** | The stored fact (`questCompletions`) that a member met a quest's goal in a given quest week. Removed again if a revoke means the goal is no longer met. | progress, which is always recomputed |
| **Waived** | A quest on the board that this member can't possibly complete this week (e.g. Unsung hero while received counts are hidden). Shown muted; doesn't count toward a Clean sweep. | "failed": unfinished quests just expire, there is no failed state |
| **Clean sweep** | Completing every non-waived quest on a week's board. | — |
| **Quest message** | A collectible bot message (category `quest_complete`) that can only be obtained by completing a quest. Never Store currency or allowance. | a Store *reward* |
