# Spec: product events for progression and the leaderboard

> **Accepted on [#79](https://github.com/Silthus/kudos/issues/79) (2026-10-14) under the map's autonomous build-and-ship authority** (map [#1](https://github.com/Silthus/kudos/issues/1), decisions 11 and 13), with every open call at its recommendation (listed under "Further Notes"). This file lives on the branch `docs/posthog-progression-events` and is never merged. It is stopping point 5 of the [PostHog spec](https://github.com/Silthus/kudos/blob/0068a996e96a651f4b46484a32116f959c2e3b30/spec/posthog.md) (#69): the addition to its taxonomy (O6) for everything that has shipped since the core loop's events (#75). Its implementation tickets are sub-issues of #79 on the integration branch `spec/posthog-progression-events`.
>
> Sources: the PostHog spec (#69, rules O1–O40, on `docs/spec-posthog` at `0068a99`); the progression spec of record ([`spec/progression.md` at `4bfc420`](https://github.com/Silthus/kudos/blob/4bfc420/spec/progression.md), #86 with the Octalysis amendment #97); the groups spec (#14, with #86's amendments); the code on `main` at `97c479e`: XP and levels (#80), the Everyone board (#81), unlocks (#105), quests and the Journey (#129), and the analytics module that shipped with #75; the flag rule (map decision 11); the conductor notes on #79; and the Coherence lexicon.

## Problem Statement

PostHog sees the core loop: kudos given and received, failed attempts, welcomes, App Home opens and `/hedgehug`. It sees nothing of the game that has shipped on top of it since. Michael can't tell how fast members level up, whether they open the features their level makes ready, whether quests get finished and their crates opened, whether the Journey's steps carry new members along, how often the leaderboard is looked at, or how many members leave it. The Octalysis amendment (#97) also rests on claims nobody can check yet: that base XP stays the largest source of XP, and that members say why when they thank someone. All of it is dark in production today, so the events must also answer a second question: when a feature is switched on, what happens next.

## Solution

Every fact of progression and the leaderboard that has shipped becomes a product event in the PostHog spec's taxonomy: named from the lexicon, projected by one allowlisted projection per event, recorded in the analytics outbox in the subscriber transaction its domain event schedules, and sent by the existing drain. Levels reached, unlocks made ready and opened, quests drawn, swapped and finished, crates opened, leaderboard views, and members leaving or rejoining the leaderboard each get one event. `kudos given` also says whether the giver said why. Nothing names a member, carries a Slack ID or any text a member wrote.

Analytics stays on while a feature is dark, because events record what happened. A dark feature's own rules keep its facts from happening, so it sends nothing. The one exception is XP and levels, which are recorded dark in production, so `level reached` flows from production now. Analytics observes and never acts: it changes nothing a member sees and never wakes a dark feature.

## User Stories

1. As Michael, I want to see when members reach each level, so that I can tell whether the level curve paces the game the way P3 intends.
2. As Michael, I want to see which levels come from kudos and which from quest or Journey rewards, so that I can check that base XP stays the largest source (P2, #97).
3. As Michael, I want to see whether a kudos said why, so that I can check how often members meet the gate (P11) without seeing a word they wrote.
4. As Michael, I want to see when a feature is made ready for a member and when they open it, so that I can tell whether `Open` is understood and how long a ready feature waits.
5. As Michael, I want unlocks opened by the launch told apart from ones a member opened, so that P77's openings don't pass for member actions.
6. As Michael, I want to see which quests are drawn, swapped and finished, so that I can tell which quests members take on and which they drop.
7. As Michael, I want to see what each finished quest and Journey step paid, so that I can compare quest XP with base XP.
8. As Michael, I want to see when a finished quest's crate is opened, so that I know whether crates are a moment members come back for.
9. As Michael, I want to see how the Journey's steps carry a new member, step by step, so that I can find the step where members stall.
10. As Michael, I want to see how often members look at the leaderboard, for which period and from where, so that I know whether it matters.
11. As Michael, I want to see how many members leave the leaderboard and come back, so that I notice if it makes people uncomfortable.
12. As Michael, I want events from a feature that is dark in production never to reveal it to a member, so that analytics can stay on while a feature waits for its switch.
13. As a member, I want the game's events to carry nothing that identifies me or anything I wrote, so that the game is measured without watching me.
14. As Michael, I want each later stopping point to know which events it adds, so that the taxonomy stays whole as the game grows.

## Rules

Each rule is a testable statement; tests cite it (`E3`). PostHog rules are cited as `O12`, progression rules as `P45`, groups rules as `G10`, core loop rules as `R12`. Every event here follows O1–O5 and O7–O15: lexicon names, O2's properties, one fact one event, the fact's time, the analytics ID as `distinct_id`, nothing from O10, one projection per event, no person properties, recorded with its fact, a stable identity, and never blocking the domain.

### The taxonomy addition (O6)

- **E1. Progression's events.**

  | Event | Sent for | On whom | Properties besides O2 |
  |---|---|---|---|
  | `level reached` | each `levelReached`: one per member for the awards of one kudos message they are named in, or for one reward record, that cross a level, for the highest level reached (P6) | the member | `level`, `skill_points_gained`, `via` (`kudos`, `reward`) |
  | `unlock made ready` | each `unlockReady` (P73 at a level up, P78 at a ship) | the member | `feature` |
  | `unlock opened` | each `unlockOpened` (P73, P77) | the member | `feature`, `by` (`member`, `launch`) |
  | `quest drawn` | each quest in a stored weekly draw (P80) | the member | `quest` |
  | `quest swapped` | each stored swap (P81) | the member | `replaced`, `quest` |
  | `quest finished` | each `questFinished` (P85, P87) | the member | `kind` (`weekly`, `journey`), `quest`, `xp`, `coins` |
  | `crate opened` | each `questOpened` (P85, P92) | the member | `kind` (`weekly`, `journey`), `quest` |
  | `journey step activated` | each Journey step stored as active (P88, P91) | the member | `step` |

  `via` is `reward` when the level was crossed by a reward record, which has no kudos message (P64, P87), and `kudos` otherwise. `feature` is one of `quests`, `leaderboard`, `book`, `skill tree`, `coins`, `hedgehogs` (P72). `by` is `launch` for the openings P77 stores when unlocks first ship and `member` for an `Open`. `quest` is the quest pool's stable ID for a weekly quest (for example `say-why-two-days`) and the step's ID for a Journey step (for example `first-thanks`); `replaced` is the pool ID of the quest a swap took out. `xp` and `coins` are what the reward record holds (P86, P87). `step` is the Journey step's ID. A Journey step is never drawn: `journey step activated` records when it becomes active, whether from the start (`first-thanks`), at its feature's opening, or by the Journey's join for members already playing (P91), which launch openings don't announce.
- **E2. The leaderboard's events.**

  | Event | Sent for | On whom | Properties besides O2 |
  |---|---|---|---|
  | `leaderboard viewed` | each accepted request to see a board that today's rules let the member see: choosing the App Home Leaderboard tab, a period on it, or `/hedgehug leaderboard` with a board in its reply | the member | `board` (`everyone`), `period` (`week`, `month`, `all`), `surface` (`app home`, `command`) |
  | `leaderboard left` | `Show me on the leaderboards` turned off (G22) | the member | none |
  | `leaderboard joined` | `Show me on the leaderboards` turned back on | the member | none |

  The event records the request, once, in the mutation that accepts it, not the App Home publish that follows: a publish can be retried, superseded or fail, and recording there would count one request several times. Eligibility is whatever the board's own rules decide today (G23, P76 through `isLeaderboardShownTo` and the unlock filter): a request they don't show a board for (the board dark, Leaderboard ready but not opened while unlocks apply, an unknown period) sends nothing, and one they do, including where unlocks don't apply, is a view. Opening App Home onto a tab it already shows is `app home opened` only. A setting that doesn't change (on while already on, the first setting stored at its default) sends nothing.
- **E3. `kudos given` grows** `thoughtful`: true when the giver's gate decision (P12) says the message counts as thoughtful (P11), false otherwise. Only the boolean is sent, never the word count or anything the gate read (O10).
- **E4. The version stays.** Every addition is new events or a new property on `kudos given`; no existing event changes its meaning, so `taxonomy_version` stays 1 (O2, O6).

### Where the events come from

- **E5. From domain events.** Each progression event is projected from the domain event that makes its fact true, recorded by an analytics subscriber in the transaction the bus schedules for it (O13). Domain events grow only additively (D14): `questFinished` and `questOpened` gain the weekly quest's pool ID, `questFinished` gains the reward's `xp` and `coins`, and quests publishes three new ones, `questsDrawn`, `questSwapped` and `journeyStepActivated`, whose only subscriber is analytics. A field added to an existing domain event is optional in its validator, so a subscriber job queued before the deploy still runs.
- **E6. From usage facts.** The leaderboard's events are usage facts recorded with the mutation that accepts the request or changes the setting, like `app home opened` (O13). A command answered in an action records through one internal mutation once it knows it showed a board. Recording is isolated: a recording failure is logged with a fixed code and never rolls back the member's change, their interaction or their reply (O15, O20), for example by recording in a scheduled internal mutation of its own.
- **E7. Exactly once.** Each fact sends its event once (O4): a level up, readiness, opening, draw, swap, finish and crate opening are each stored once, and their domain events are published only when they are; a redelivered or retried Slack request that finds the fact already stored publishes and records nothing. Slack doesn't redeliver slash commands or interaction payloads, so each accepted request records once; a member asking again is a new request and a new view (as for `command used`, #69).
- **E8. No history.** Events start when this stopping point ships. Nothing replays earlier levels, unlocks, quests or views, and backfills send nothing: P10's progression backfill and the leaderboard's backfill publish no domain events (O4: an event is recorded at its fact, never by a replay).

### Dark features

- **E9. Sent whatever the flag.** An event is sent whenever its fact happens, while its feature's flag is on or off. Analytics reads no feature flag and has no flag of its own.
- **E10. A dark feature's facts happen only as its own rules allow.** In production today every progression flag is off: unlocks, quests and the Everyone board record nothing (#105, #129, #81), so they send nothing, while XP and levels are recorded dark (#80), so production sends `level reached` and `thoughtful` while `xp-levels` is off. Where a mix of flags is on (for example `quests` on and `unlocks` off, where readiness is still stored), or a job queued before a switch-off still runs (the Journey's join), analytics sends whatever facts happen. It never filters by flag.
- **E11. Analytics never reveals a dark feature.** Recording an event writes only the analytics outbox (and an analytics ID or workspace key the first time): it publishes no domain event, sends no exposure (O36), republishes no App Home, schedules nothing but the drain, and changes no row another module reads. So no event can make a dark feature ready, opened, shown or named to a member (P76, P78), and with capture on or off a member sees the same Slack calls.
- **E12. No dark marker.** Events carry no property saying whether their feature was switched on. A flag's switch-on is dated by its PostHog activity history, and production insights about a feature start from it.

### Later stopping points

- **E13. Each later stopping point adds its events** with the code that makes them true, as acceptance criteria on its tickets (O6), from the list under "Events for later stopping points". The groups stopping point (#52) brings `group_key` (O9) and the `POSTHOG_GROUP_ANALYTICS` switch (O30), off by default; nothing here sends either, because no domain group exists yet.

## Implementation Decisions

### Modules

- **Analytics (extended)**: one projection per new event, pure and table-tested, beside the core loop's; analytics subscribers for `levelReached`, `unlockReady`, `unlockOpened`, `questsDrawn`, `questSwapped`, `questFinished`, `questOpened` and `journeyStepActivated`; usage facts for the leaderboard's events; `thoughtful` in the `kudos given` projection, read from the gate decision in the event's annotations. Its component spec gains the new events and E11 as an invariant.
- **Quests (extended)**: publishes `questsDrawn` when a weekly draw is stored, `questSwapped` when a swap is stored and `journeyStepActivated` where a Journey step's activation is inserted (one place today), and adds the pool ID and the reward to the events it already publishes. It knows nothing of PostHog.
- **Leaderboard, Commands and the Slack adapter (extended)**: report a shown board and a changed `Show me on the leaderboards` setting as platform-neutral usage facts.
- **Progression and unlocks**: unchanged. Their domain events already carry what the projections need.

### Contracts

Domain events, additive to the registry (`convex/bus/events.ts`):

```ts
type QuestFinishedEvent = { /* today's fields */ poolQuest?: QuestId; reward?: { xp: number; coins: number } };
type QuestOpenedEvent = { /* today's fields */ poolQuest?: QuestId };
type QuestsDrawnEvent = { type: "questsDrawn"; workspace: string; member: MemberId; week: string; quests: QuestId[]; at: number };
type QuestSwappedEvent = { type: "questSwapped"; workspace: string; member: MemberId; week: string; replaced: QuestId; swappedIn: QuestId; at: number };
type JourneyStepActivatedEvent = { type: "journeyStepActivated"; workspace: string; member: MemberId; step: JourneyStep; at: number };
```

`poolQuest` is set for weekly quests and absent for Journey steps, whose ID is already in `quest.step`. The bus's registry gains the analytics subscribers; `unlockReady` and `questOpened`, whose subscriber lists are empty today, get their first.

Usage facts (`convex/analytics/projections.ts`):

```ts
type UsageFact =
  | /* app home opened, command used */
  | { kind: "leaderboardViewed"; workspace: string; member: MemberId; board: "everyone"; period: Period; surface: "app-home" | "command"; at: number }
  | { kind: "leaderboardVisibilityChanged"; workspace: string; member: MemberId; visible: boolean; at: number };
```

Projections, one per event, each listing every property by name (O11):

```ts
function projectLevelReached(event: LevelReachedEvent): ProductEvent;           // via: event.message ? "kudos" : "reward"
function projectUnlockReady(event: UnlockReadyEvent): ProductEvent;
function projectUnlockOpened(event: UnlockOpenedEvent): ProductEvent;           // by: event.byLaunch ? "launch" : "member"
function projectQuestsDrawn(event: QuestsDrawnEvent): ProductEvent[];           // one quest drawn per quest
function projectQuestSwapped(event: QuestSwappedEvent): ProductEvent;
function projectQuestFinished(event: QuestFinishedEvent): ProductEvent;
function projectQuestOpened(event: QuestOpenedEvent): ProductEvent;             // crate opened
function projectJourneyStepActivated(event: JourneyStepActivatedEvent): ProductEvent;
```

Feature IDs map to the spaced names of E1 in one table (`skillTree` → `skill tree`), like `outcome` today.

### What this stopping point doesn't need

No new table, no new environment variable, no new flag, no person property and no new cron. The outbox, the drain, the analytics IDs and the exposures of #75 carry everything.

## Testing Decisions

- **A good test enters at a seam and checks what Michael or a member could observe**: the PostHog requests the drain makes and the Slack calls a member sees. It never asserts on private helpers.
- **Seams, highest first:**
  1. **The Slack boundary**, as in #75: signed Slack requests through the HTTP router with `convex-test`, the one `fetch` stub that answers Slack's Web API and PostHog's `/batch/`, the scheduled drain run, and the PostHog requests read back. Each ticket proves its events end to end from a member's action: a kudos that crosses a level, an `Open` click, a swap, a kudos that finishes a quest, a crate's `Open`, a tab or period choice, `/hedgehug leaderboard`, the settings toggle. The privacy invariant's whole-loop test grows to cover each new event (O10).
  2. **The analytics module's projections** as rule tables (E1–E3), including the feature-name table and `via`, `by` and `kind`.
- **Exactly once (E7)** is tested by repeating the member's action and redelivering its Slack request: the second sends nothing.
- **Dark (E9–E11)** is tested with the flags key and every flag off, with the flags key missing, with a mix (`quests` on and `unlocks` off), with every flag on, and with the Journey's join queued before a switch-off: a kudos that crosses a level sends `level reached` while `xp-levels` is off, a feature sends exactly the facts it stored, and with capture on and off every Slack call a member gets is the same.
- **Isolation (E6)** is tested by making the recording fail: the member's tab, period or setting change, the interaction's answer and every Slack call stay as they would without analytics.
- **Prior art:** `convex/analytics/coreLoopFacts.test.ts`, `kudosGiven.test.ts`, `projections.test.ts`, the flag tests in `convex/slack/*Flag.test.ts`, and `testing/fakePostHog.ts`, `testing/flags.ts` and `settleInTimeOrder` in `testing/slackBackend.ts` (convex-test's plain settle can run a later job before an earlier one).
- **The gate** (`pnpm gate`) is green on every ticket. The analytics component spec declares E11 as an invariant with a witnessed refutation.

## Out of Scope

- Events for features that haven't shipped: perks, skill points spent, coins, the store, kudos emoji, hedgehogs, achievements, chime-ins, the weekly reserve, the profile card, groups, group boards and the Book. They are listed under "Events for later stopping points" as acceptance criteria for their stopping points.
- `xp earned`. The PostHog spec planned one per effects record. Base XP is 10 per kudos given and 5 per kudos received (P1), which `kudos given` and `kudos received` already count, and the only other XP today is quest and Journey rewards, which `quest finished` carries. The skill tree's stopping point (#29) brings it with bonus XP.
- Person properties such as `level` (O12). Insights break members down by level through cohorts of `level reached`.
- Website events. The website map (#57) instruments its own surfaces; an `Open` on the website publishes the same domain events and sends the same events here.
- Progression's settings (muting notices, turning DMs off), the level-up DM and public notices as events. They are a follow-up if Michael wants them.
- A dashboard for these events. The operations stopping point (#76) owns dashboards; this spec adds the facts a product dashboard can use.

## Events for later stopping points

Acceptance criteria for the conductor to fold into each stopping point's tickets when it plans them, in this taxonomy's style. Names and properties are proposals; each stopping point confirms them against its code (O6). Cut systems (boosters, auras, drops, rarities, titles, quips, cards, streaks, freezes, decision 12) have none.

| Stopping point | Events and properties |
|---|---|
| Skill tree's first row and achievements (#29) | `skill point spent` (`perk`); `perk bought` (`perk`, a catalogue ID) from `perkBought`; `achievement earned` (`ladder`, `tier`) from `achievementEarned`; `xp earned` per effects record with bonus XP (`source` (`given`, `received`), `base_xp`, `bonus_xp`); `unlock opened` already covers `skill tree` and `book` |
| Coins (#30) | `coins earned` per effects record or reward record with coins (`coins`, `source` (`given`, `received`, `quest`, `journey`, `tier`)); `quest finished` already carries `coins` |
| Kudos emoji and the store (#31) | `item bought` (`item`, `price`) from `itemBought`; `kudos emoji equipped` (`slot`); `kudos given`'s `default_kudos_emoji` stays the only emoji fact, never the emoji's name |
| Hedgehogs (#96) | `item bought` covers hedgehogs; `avatar picked` (`item`) |
| Chime-ins (#32) | `chime-in given` (`kudos`); `chime-in threshold reached` (`threshold`); `kudos received` gains `via` (`message`, `chime-in`) |
| Weekly reserve (#35) | `kudos given` gains `weekly_reserve_spent` |
| The rest of the tree (#39) | `perk switched on` (`perk`) for `focus` |
| Groups and the group boards (#52) | `group_key` on every event attributed to a group (O9); the `POSTHOG_GROUP_ANALYTICS` switch (O30), off; `primary group picked` (`by`: `welcome`, `settings`, `default`); `leaderboard viewed` gains `board` `group`; `quest finished` gains `kind` `group` |
| The profile card (#53) | `profile card viewed` (`surface`) |
| Sticker book, albums and Team Spirit (#54) | `sticker earned`; `album completed`; Team Spirit's tiers through `achievement earned` |

## Further Notes

**Calls this spec makes (accepted with it, each at the recommendation, each recorded with `coherence decide`)**

1. **Events for a dark feature are sent whenever their fact happens** (E9, E10), with no flag on analytics and no dark marker on events (E12). A dark feature's own rules keep its facts from happening; only `level reached` and `thoughtful` flow from production while dark, because XP is recorded dark. Gating analytics behind a flag would hide what did happen, and a marker would make analytics read every feature's flag.
2. **Analytics observes, never acts** (E11), and that is this stopping point's gate: instead of a "behind the flag" ticket, the gate ticket proves that recording changes nothing a member sees and never wakes a dark feature, with every flag off, the flags key missing and every flag on.
3. **No new flag.** Events need none, and E11 makes them invisible to members. Nothing for the conductor to create in PostHog.
4. **No `xp earned` yet**, because base XP is already counted by the kudos events and the only other XP today is quest rewards (Out of Scope). The skill tree's stopping point adds it with bonus XP.
5. **No person properties** (O12): `level` as a person property would need nested `$set` support in the outbox for a breakdown cohorts already give.
6. **Quests publish new domain events**, `questsDrawn`, `questSwapped` and `journeyStepActivated`, whose only subscriber is analytics, like `attemptFailed`. Analytics never reads quests' tables (P93's intent: build on derived events).
7. **Weekly quests are named by their pool ID**, carried on `questFinished` and `questOpened`, because the slot key (week and slot) says nothing about the quest. Journey steps are named by their step ID; `kind` keeps the two apart where IDs coincide (`someone-new`).
8. **New domain event fields are optional** (E5), so a subscriber job queued before the deploy doesn't fail on its arguments.
9. **A quest crate's opening is `crate opened`, a ready feature's is `unlock opened`**, following the domain events. Opening an unlock changes what the member sees; opening a quest crate only reveals (P92).
10. **Launch openings are sent, marked `by: launch`** (E1), because they are what members got, and an `Open` funnel filters them out.
11. **Leaderboard views count requests to see a board** (E2), not App Home opens onto a tab already shown, and carry `board` now so group boards add a value instead of a property.
12. **No history** (E8): nothing is replayed, so production's events about the game start at this ship.
13. **Groups' `group_key` and the group analytics switch wait for #52**, since no domain group exists.
14. **`journey step activated` gets its own domain event** (E1, E5), published where the activation is inserted, because `unlock opened` misses `first-thanks` and the join's activations, so it can't be the Journey's denominator.
15. **A leaderboard view is an accepted, eligible request**, recorded once where it is accepted (E2), not at the App Home publish, which retries and compares; eligibility follows the board's rules as they are, unlocks applying or not.
16. **Usage-fact recording is isolated from the member's change** (E6), because a throw in the same mutation would roll back the change itself.
17. **Thin tickets on one integration branch**, each proven at the Slack boundary, with the ship merging `main` first. The `to-spec` and `to-tickets` skills aren't installed on this devbox, so the spec and the breakdown follow their shape by hand.
