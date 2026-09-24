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

## Compare

Specified in [Spec Compare stats](https://github.com/Silthus/kudos/issues/6). Pure rules (metrics, visibility, distributions) live in `convex/lib/compare.ts`; one query per benchmark in `convex/compare/`. The page is `/compare?vs=…&period=…`.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Comparison** | The viewer ("You"), one benchmark, one period and a fixed metric set, shown as a scoreboard and a race chart. | a leaderboard *rank* |
| **Benchmark** | What you're compared against: exactly one of **Past you** (your own previous period), **Team** (the participant distribution) or **Teammate** (one other member). Always drawn in the neutral benchmark ink (`--color-benchmark`). | "opponent", "rival" (don't use these) |
| **Period** | A calendar period from `resolvePeriod`: week, month, quarter or year (default month). Compare has no "all time": it has no previous period and rewards tenure. | a rolling window |
| **Previous period** | The previous calendar bucket up to the same day offset as today (`previousToDate`): on a Wednesday, Mon–Wed against last Mon–Wed. The race chart also shows how the whole previous bucket finished. | the full previous bucket that per-member leaderboard deltas use |
| **Participant** | An active, non-bot member whose value for the metric is above 0 in the period: the population the leaderboard ranks. | every member |
| **Active day** / **Maxed day** | A day with `given > 0` / a day on which the member used their whole allowance (`memberDays.maxed`). | — |
| **Longest streak** | The longest run of consecutive active days inside the period, clipped to it. | the all-time streak on the member row |
| **Reach** | Distinct teammates you gave kudos to in the period. | *received* |
| **Channels** | Distinct channel ids you gave in (ids, because names change). | channel names |
| **New discoveries** | Bot messages whose first sighting (`discoveries.firstSeenAt`) falls in the period. | the whole collection |
| **Received-derived metric** | A metric that reveals kudos somebody received: *received* and *new discoveries*. Follows `receivedVisibility`; your own discoveries stay yours to see. | giving metrics, which are always visible |
| **Locked row** | A scoreboard row whose values the viewer may not see. The server sends `value: null` and the reason (`hidden`: the workspace hides received counts; `private`: each member sees only their own); the row is shown with a lock, never dropped. | a metric that isn't offered in a mode, which is simply absent |

## Kudos attempts

Specified in [Slack: bot reactions confirm every kudos attempt](https://github.com/Silthus/kudos/issues/50). Recording lives in `convex/attempts.ts`; reactions and the guidance copy in `convex/lib/guidance.ts`.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Attempt** | A Slack message (or playground message) that carries the kudos emoji. Recorded once per message (`kudosAttempts`, keyed by workspace + channel + message ts) with who tried and how it ended. Messages without the emoji are never attempts. | *reaction-based giving*, which reacts to someone else's message and has no attempt |
| **Outcome** | How an attempt ended: `given` (every mentioned person got the full amount), `limit` (it would have exceeded the giver's remaining allowance: nothing was given) or `invalid` (nobody valid was mentioned: no mention, only group mentions like @here, only yourself, only bots/the app, only deactivated or unknown people, incl. other workspaces' guests). Giving stays all-or-nothing per message. | — |
| **Bot reaction** | The reaction the Kudos bot puts on the attempt's message: the kudos emoji for `given` (✅ `white_check_mark` if Slack rejects a custom emoji), ⏳ `hourglass_flowing_sand` for `limit`, ❌ `x` for `invalid`. Recorded on the attempt only once Slack shows it. | a member's kudos-emoji reaction, which gives kudos |
| **Guidance** | The ephemeral note to the giver on a failed attempt: how a valid kudos works, with the multiplication (`2 people × 2 🌮 = 4 🌮`) for `limit` and a one-line example for `invalid`. Not rarity-rolled; it rides along with the rolled "limit reached" / "self kudos" reply when there is one. | a rarity-rolled *bot message* |

## Design system

Specified in [Spec the PostHog restyle](https://github.com/Silthus/kudos/issues/54) (resolution comment); foundation built in [#57](https://github.com/Silthus/kudos/issues/57). The base is PostHog's *product* UI (Lemon), with posthog.com's window chrome saved for moments. Tokens live in `src/index.css`; primitives in `src/components/ui.tsx`; the shell in `src/components/AppShell.tsx`; theme logic in `src/lib/theme.ts`.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Token** | A semantic colour role defined once per theme as `--k-<role>` in `src/index.css` and exposed to Tailwind as `<utility>-<role>` (`bg-surface`, `text-text-2`, `border-border-bold`). Roles: `bg` (scene), `sidebar`, `surface` / `surface-2` / `surface-3`, `border` / `border-bold`, `text` / `text-2` / `text-3`, `accent`, `link`, `on-fill`, `success` / `warning` / `danger`, `series-*`, `r-*` (rarity), `brand`. Components never use raw hex. `tests/theme-tokens.test.ts` holds every text role to 4.5:1 on every background in both themes. | a *v1 alias* |
| **v1 alias** | A temporary old token name (`ink`, `panel`, `cream`, `muted`, `faint`, `saffron`, `teal`, `up`, `down`, `benchmark`…) pointed at a new role so every page restyled at once. Pages drop them in their own pass; R10 deletes them. The shell and primitives already may not use them (`tests/design-system.test.ts`). | a *token* |
| **Theme preference** | Light, Dark or System (default), stored in `localStorage["kudos.theme"]` (absent = System). `resolveTheme(pref, systemDark)` turns it into the painted **theme**, set as `<html data-theme>`; the inline script in `index.html` does this before first paint so nothing flashes. | the painted theme, which is always light or dark |
| **Accent** | The brand colour for active, focus and brand moments: `#F54E00` in light, `#F7A501` in dark. Never body text: text links use **link**. | a *series* colour, a *status* colour |
| **Status** | `success` / `warning` / `danger`. Always shipped with an icon and a word; never used as a data series. | *series* |
| **Series** | Chart colours: `series-given` (orange), `series-received` (blue), `series-neutral` (the benchmark ink every Compare benchmark wears). | *status*, *accent* |
| **Rarity colour / pip** | `r-common` … `r-legendary`, for fills, borders and the **pip** only; rarity text uses the text tokens. Rarity is never colour alone: the word is always shown, and the pip's shape grows with the tier (ring, dot, diamond, sparkle, star). | — |
| **Card** | A flat surface: 1px `border`, 10px radius (`rounded-window`), no shadow or blur. What pages are made of. | a *window* |
| **Window** | posthog.com chrome (slim title bar, optional tint, close button, 200 ms pop-in) for moments only: dialogs, discovery reveals, celebrations, stamps, the mobile More sheet. `Dialog` is a Window on a native `<dialog>`. | a *card* |
| **Button variants** | `primary` / `secondary`: Lemon 3D (face, 1px border, 3px frame; hover lifts 1px, press sinks 2px). `tertiary`: flat. `cta`: posthog.com orange, public pages only. `danger`: destructive. | — |
| **Locked** | The `locked` utility: dashed `border-bold` outline, faint hatch, `text-3`, shown with a lock icon for something not yet available. Copy says "Reach X to use this", never "unlock". | hidden: locked things are shown, never dropped |
| **KudosMark** | Our own mark: an orange speech bubble carrying a star (also the favicon). Not a hedgehog, not PostHog's logo; the sidebar badge says "PostHog edition" in text only. | PostHog art, which never enters the repo (#52) |
