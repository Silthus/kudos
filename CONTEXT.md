# Kudos domain glossary

The shared vocabulary of the Kudos codebase. Use these words in code, tests, UI copy and tickets, and avoid the ones marked as "not". Each feature area has its own section; add a section rather than redefining a term.

Decisions that are hard to reverse live in [`docs/adr/`](docs/adr/).

## Rewards Store

Specified in [Spec the Rewards Store](https://github.com/Silthus/kudos/issues/4). Core rules live in `convex/lib/store.ts`; every balance, stock or redemption change goes through `convex/store.ts`.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Store** | Where members spend Hog coins: built-in game items that apply instantly, plus, if an admin switches them on (off by default), real rewards with the redemption workflow. Priced only in Hog coins ([ADR 0002](docs/adr/0002-store-currency-is-hog-coins.md)). | — |
| **Reward** | An item in the catalog that members can request by spending their balance. Archived, never deleted. | "prize" or "item" (don't use these) |
| **Balance** | A member's Hog coins available to spend. Private to the member and admins. It can go negative when a revoke takes back coins already spent. Until the Store moves to Hog coins, the code still derives it from received kudos ([ADR 0001](docs/adr/0001-store-balance-is-received-kudos.md), superseded by [ADR 0002](docs/adr/0002-store-currency-is-hog-coins.md)). | *received*, which is only a stat |
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
| **Quest board** | The 3 quests every member of a workspace gets for one quest week. Seeded draw per workspace-week (`pickBoard`) that keeps at most one of last week's quests and, where it can, avoids the board from two weeks before; stored (`questBoards`) the first time a mutation needs it and never changed after. | — |
| **Note** | The words in a kudos message other than mentions, channel links, URLs and emoji (`countNoteWords`, stored as `kudos.noteWords`). Reactions have no note. | the kudos *text*, the readable preview |
| **Qualifying kudos** | A kudos row whose Note has at least 3 words and that is not Reciprocal. Only qualifying kudos move quest progress. | any kudos: every kudos still counts everywhere else |
| **Reciprocal kudos** | A kudos from G to R where R gave G any kudos in the 72 hours before it. The kudos goes through as normal; it just doesn't move quests. | — |
| **Quest completion** | The stored fact (`questCompletions`) that a member met a quest's goal in a given quest week. Removed again if a revoke means the goal is no longer met. | progress, which is always recomputed |
| **Waived** | A quest on the board that this member can't possibly complete this week (e.g. Unsung hero while received counts are hidden). Shown muted; doesn't count toward a Clean sweep. | "failed": unfinished quests just expire, there is no failed state |
| **Clean sweep** | Completing every non-waived quest on a week's board. | — |
| **Quest message** | A collectible bot message (category `quest_complete`) that can only be obtained by completing a quest. Never Store currency or allowance. | a Store *reward* |

## Compare

Specified in [Spec Compare stats](https://github.com/Silthus/kudos/issues/6). Pure rules (metrics, visibility, distributions) live in `convex/lib/compare.ts`; one query per benchmark in `convex/compare/`. The page is `/compare?vs=…&period=…`.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Comparison** | The viewer ("You"), one benchmark, one period and a fixed metric set, shown as a scoreboard and a race chart. | a leaderboard *rank* |
| **Benchmark** | What you're compared against: exactly one of **Past you** (your own previous period), **Team** (the participant distribution) or **Teammate** (one other member). Always drawn in the neutral benchmark ink (`--color-benchmark`). | "opponent", "rival" (don't use these) |
| **Period** | A calendar period from `resolvePeriod`: week, month, quarter or year (default month). Compare has no "all time": it has no previous period and rewards tenure. | a rolling window |
| **Previous period** | The previous calendar bucket up to the same day offset as today (`previousToDate`): on a Wednesday, Mon–Wed against last Mon–Wed. The race chart also shows how the whole previous bucket finished. | the full previous bucket that per-member leaderboard deltas use |
| **Participant** | An active, non-bot member whose value for the metric is above 0 in the period: the population the leaderboard ranks. In the Team benchmark the giving metrics (given, active days, maxed days) share one population, the givers, and received has the receivers. | every member |
| **Team distribution** | The Team benchmark's median, middle half (p25–p75) and most, over the participants other than you, drawn as a **range strip**. Fewer than 2 teammates: none (a median of one is their number); 2–4: the median only; from 5: the rest and your percentile (share strictly below you). Never names anybody. | a leaderboard |
| **Active day** / **Maxed day** | A day with `given > 0` / a day on which the member used their whole allowance (`memberDays.maxed`). | — |
| **Longest streak** | The longest run of consecutive active days inside the period, clipped to it. | the all-time streak on the member row |
| **Reach** | Distinct teammates you gave kudos to in the period. | *received* |
| **Channels** | Distinct channel ids you gave in (ids, because names change). | channel names |
| **Quests completed** | Your Quest completions whose `completedAt` falls on a day of the period (workspace timezone), so a quest week straddling a month, quarter or year edge splits by day. Only ever your own: Past you shows it; Teammate and Team lock it (`personal`, Quest spec D10). Absent while quests are off. | a teammate's or the team's quest count (never shown) |
| **New discoveries** | Bot messages whose first sighting (`discoveries.firstSeenAt`) falls in the period. | the whole collection |
| **Received-derived metric** | A metric that reveals kudos somebody received: *received* and *new discoveries*. Follows `receivedVisibility`; your own discoveries stay yours to see. | giving metrics, which are always visible |
| **Locked row** | A scoreboard row whose values the viewer may not see. The server sends `value: null` and the reason (`hidden`: the workspace hides received counts; `private`: each member sees only their own; `personal`: quests, which are never shown for anyone but yourself); the row is shown with a lock, never dropped. | a metric that isn't offered in a mode, which is simply absent |

## Kudos attempts

Specified in [Slack: bot reactions confirm every kudos attempt](https://github.com/Silthus/kudos/issues/50). Recording lives in `convex/attempts.ts`; reactions and the guidance copy in `convex/lib/guidance.ts`.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Attempt** | A Slack message (or playground message) that carries the kudos emoji. Recorded once per message (`kudosAttempts`, keyed by workspace + channel + message ts) with who tried and how it ended. Messages without the emoji are never attempts. | *reaction-based giving*, which reacts to someone else's message and has no attempt |
| **Outcome** | How an attempt ended: `given` (every mentioned person got the full amount), `limit` (it would have exceeded the giver's remaining allowance: nothing was given) or `invalid` (nobody valid was mentioned: no mention, only group mentions like @here, only yourself, only bots/the app, only deactivated or unknown people, incl. other workspaces' guests). Giving stays all-or-nothing per message. | — |
| **Bot reaction** | The reaction the Kudos bot puts on the attempt's message: the kudos emoji for `given` (✅ `white_check_mark` if Slack rejects a custom emoji), ⏳ `hourglass_flowing_sand` for `limit`, ❌ `x` for `invalid`. Recorded on the attempt only once Slack shows it. | a member's kudos-emoji reaction, which gives kudos |
| **Guidance** | The ephemeral note to the giver on a failed attempt: how a valid kudos works, with the multiplication (`2 people × 2 🌮 = 4 🌮`) for `limit` and a one-line example for `invalid`. Not rarity-rolled; it rides along with the rolled "limit reached" / "self kudos" reply when there is one. | a rarity-rolled *bot message* |

## Game

Specified in [the game spec](https://github.com/Silthus/kudos/issues/55#issuecomment-5812632101) (settled in [Grill the gamification mechanics with the human](https://github.com/Silthus/kudos/issues/55)). The game is an optional layer on top of kudos whose one purpose is to make appreciating others a daily habit. It only rewards *thoughtful* giving: the Quests' **Qualifying kudos** rule (`hasNote` + no thank-back, `lib/quests.ts`) is the one definition of "counts". The XP rules, the level curve, titles and the game areas are pure in `convex/lib/xp.ts`; the switch, players, the ledger and its rebuild live in `convex/game.ts`, called from the engine's give and revoke.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Game** | The optional layer of XP, levels, Hog coins, the skill tree, gardens, sprees and boosters. A workspace switches it on; a member becomes a player by giving their first kudos. | the kudos engine, which works with or without it |
| **Game switch** | The admin setting `gameEnabled` (off for new workspaces, on in the demo); also the kill switch. Switching it on plays the kudos history so far through the rules (a rebuild). Switching it off opens a **game pause**: kudos given until it's back on never earn anything, not even in a rebuild. | the Quests switch, which is separate |
| **Player** | A member who has given at least one kudos while the game is on (a `players` row). Before that they can receive kudos, but nothing accrues. A player stays a player. | *joining*, which is only for sprees |
| **Hiding the game** | A member setting that removes the game from their view while kudos keep working. XP keeps accruing, so coming back never costs anything. | leaving the workspace |
| **XP** | Progress points that set your level. Earned by giving and by receiving thoughtful kudos, and by quests. Never spent, never lost except when the kudos behind it is revoked. | Hog coins, which are spent |
| **XP event** | One row of the game ledger (`gameEvents`), written in the same transaction as the kudos that earned it: a `give` event per batch for the giver, with one **line** per recipient row, and a `receive` event per row that earned its receiver XP. A revoke takes back exactly the lines of the rows it removes; later kudos keep what they earned. Hog coins will ride the same events. | the kudos rows themselves |
| **Rebuild** (game) | Playing a member's surviving kudos history through the XP rules and replacing their events (`internal.game.rebuildWorkspace`): the backfill when the game is switched on, the demo year, and the repair tool. Without revokes it writes exactly what the live path wrote; after revokes it re-scores later kudos against the history that survived, and it scores the Unsung bonus by today's received-visibility setting. One member per transaction, so a member too big to rebuild can't stop the others. | the read-model rollups' rebuild |
| **Level** | A rank derived from total XP (30, 75, 175, 350, then 50 × L more per level, up to 25), with a **title** (Seedling, Sprout, Gardener, Grove keeper, Elder hog). A level reached is kept even if a revoke takes the XP back. Shown on your profile, never ranked against others. | a leaderboard *rank* |
| **Earnings reply** | The giver's reply to a kudos, ephemeral where they gave it (in the thread, if any; no longer a DM), itemising what it earned while the game is on: "+25 XP · new connection +10 · a real why +5", or how a kudos without a reason could earn more. | the receiver's DM |
| **Level-up DM** | The DM for reaching a level: its title and the skill point it grants. Never for members who hide the game. | a DM per XP earned (never sent) |
| **Locked area** | A game area the member hasn't reached yet, shown visible but locked with the level it opens at and one line on how to get there (`Locked`, `GAME_AREAS`). Only the next level's areas are shown. | a hidden feature |
| **Hog coin** | The only currency, shown as a gold coin with Max the hedgehog. A thoughtful kudos earns the giver 1 per kudos given; level-ups, quests, daily quests, sprees and garden fruit earn more. Spent in the Store. Never turns into kudos or allowance, and kudos never turn into coins. | kudos, which are only a stat |
| **Skill tree** | Four branches of permanent abilities a member picks with skill points. There are never enough points to take every skill, so each member's tree is a choice. | *perks* that come automatically with a level (not used) |
| **Skill point** | Earned one per level-up and spent on a skill in the skill tree. A reset returns all points and costs Hog coins. | XP |
| **Garden** | A member's own garden of plants, each grown for one teammate they recognise. Others see the plants but not whom they're for. | the team garden |
| **Plant** | Grown in your garden for one teammate. It grows when you recognise that person again in a later week and can't be rushed. Only the teammate sees that it's for them. | a *reward* |
| **Dormant** | A plant whose teammate you haven't recognised for a while: it stops growing and fruiting until you recognise them again. Plants never die. | deleted |
| **Team garden** | The workspace's shared garden. It grows from how many different people give thoughtful kudos, never from who receives. Its milestones can trigger bonus days. | a member's garden |
| **Daily quest** | One small thoughtful-giving goal per day, on top of the weekly quest board. Missing it costs nothing. | the weekly *quest board* |
| **Booster** | A consumable, bought with Hog coins, that makes recognition better for a while or for someone else. Some are company-wide and announced with who activated them. | a skill, which is permanent |
| **Bonus day** | A day on which thoughtful kudos earn extra, announced in advance. Triggered by a team-garden milestone, an admin, or a company-wide booster. | a *streak* (the game has none) |
| **Super kudos** | A special kudos emoji a member can use a limited number of times a month once they've taken its skill. It gives the usual amount; the receiver gets a unique celebration. | giving more kudos |
| **Kudos spree** | What a thoughtful kudos becomes when enough teammates join it: 5, then 10, 20, 50 and 100 people (the **tiers**). Each tier reached pays the waiting joins out to the receiver and is celebrated in the kudos' thread. | reaction-giving |
| **Join** (a spree) | Choosing to add your kudos to someone else's thoughtful kudos, by clicking the bot's reaction and confirming. It reserves one of today's kudos per person named and uses one of your monthly **spree joins** (5 a month by default). The kudos only reaches the receiver when the next tier is reached; if it isn't, the spree join comes back. | *becoming a player* |
| **Reaction-giving** | An admin setting: reacting with the kudos emoji to a plain message gives its author a bare kudos. Separate from sprees. | joining a spree |
| **Game item** | Something in the Store that applies instantly and needs no approval: a cosmetic, a booster, extra spree joins, a skill-tree reset. | a *reward*, which an admin fulfils |
| **Success metrics** | How admins judge whether the game works, per workspace month: *reach* (distinct recipients per active giver, should rise), *says why* (share of kudos with a 12+ word Note, should rise), *thank-backs* (share of Reciprocal kudos, must not rise) and participation. A kudos counts once per person recognised, whatever its amount. Admins only, on Analytics, with a CSV export; kept in the `successStats` rollup. | the Analytics KPIs, which follow the selected period |
| **Baseline** | The success metrics pooled over the three complete months before the current one: what the game is compared against. Recorded before the game launches; the workspace switch is the kill switch if the metrics move the wrong way. | a *benchmark* in Compare |
