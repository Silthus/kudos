# Spec: crate rewards apply when the crate is opened

> **Accepted on [#411](https://github.com/Silthus/kudos/issues/411) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/crate-rewards` and is never merged. It answers map #1's decision 23 and builds on decisions 12, 18 and 22. The build runs on the integration branch `spec/crate-rewards`, which the conductor cuts from `main`.
>
> **Rule numbers.** Rules are cited as `CR1`–`CR16`. Progression rules are cited as `P85`, coins rules as `CO9`, hedgehog rules as `HH32`, quieter-messages rules as `QM24`.
>
> Sources: the code on `main` at `32a8c42` (`convex/progression/` `recordReward`, `rewards.ts`, `progress.ts`; `convex/quests/` `finish.ts`, `open.ts`, `crates.ts`, `pendingCrates.ts`, `journey.ts`, `weekly.ts`, `finishedBy.ts`; `convex/wallet/`; `convex/achievements/tierCoins.ts`; `convex/feedback/` `home.ts`, `homes.ts`, `notify.ts`, `replies.ts`; `convex/activity/`; `convex/website/` `quests.ts`, `commands.ts`), the `Progression`, `Quests`, `Wallet`, `WebsiteReads` and `Achievements` component specs, the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P64, P85–P87, P92), the hedgehogs spec (`spec/hedgehogs.md` on `docs/hedgehogs` at `f4518b6`: HH32), and the website conductor's answer (see Further Notes).

## Problem Statement

A member finishes a weekly quest. The success reply says `Quest done: Thank someone new (+20 XP)`, a DM offers a crate with an `Open` button, and App Home lists the crate as waiting. But the XP is already on their bar. If it took them to a new level, the level-up DM came at the finish, before they ever saw the crate. When they open the crate, nothing moves. The crate is a box that was emptied before they got to it.

The product owner, opening crates on the website: "I noticed that when I open an experience crate for quests or something, it seems to have already been applied to my XP bar, but that shouldn't be the case. Only the opening should apply, so that if I open the chests and get the XP, then I actually get them and level up, for example."

Today this is by design: P85 and P92 were amended on #97 so that a quest's reward counts when the quest finishes and the crate only reveals it. This spec reverses that for quest and Journey crates.

## Solution

**A finished quest's or Journey step's reward waits in its crate. Opening the crate applies it.**

The reward record is still written at the finish, keyed as today, so it is paid exactly once. But a record written while `crate-rewards` is on for the member is **held**: it counts toward nothing until its crate is opened. The open, from Slack or the website, adds the XP, credits the coins, and fires `xpRecorded`, `levelReached`, the level-up DM and the unlocks a level makes ready, all at that moment.

Rewards recorded before, and every reward recorded while the flag is off for the member, already counted at their finish. They stay counted, and their crates still only reveal them. Nothing is taken back, nothing is paid twice, and there is no backfill.

Slack and the website word a reward that is waiting as waiting ("+20 XP waiting in your crate"). The website's open answers what the open applied, from which XP and level to which, so map #57 can animate the climb.

One ship, three build tickets, behind the member-decision flag `crate-rewards`, sandbox-only plus the product owner's email first.

## User Stories

**The open is the moment**
1. As a member, I want a finished quest's XP to land on my bar when I open its crate, so that opening it feels like getting something.
2. As a member, I want to level up when the XP from a crate takes me there, so that the crate is what levels me up.
3. As a member, I want the level-up DM and any feature my new level makes ready to arrive when I open the crate, so that the reward and its consequences come together.
4. As a member, I want a crate's coins to reach my wallet when I open it, so that coins and XP behave the same way.
5. As a member, I want a Journey step's crate to work like a weekly quest's crate, so that every quest crate means the same thing.
6. As a member, I want opening the same crate twice to pay once, so that a double click or a second device never pays twice.
7. As a member, I want a crate opened in Slack and one opened on the website to apply the reward the same way, so that it doesn't matter where I open it.
8. As a member, I want a crate from an earlier week to still hold its reward, so that I never lose a reward by opening it late.

**What waits and what doesn't**
9. As a member, I want my kudos XP and bonuses to keep counting at once, so that only crates wait.
10. As a member, I want achievement tier coins to keep arriving with the tier, since they have no crate, so that nothing waits without a box to open.
11. As a member, I want rewards I already have to stay, so that the change never takes XP, a level or coins away from me.
12. As a member with unopened crates from before the change, I want them to stay counted, so that opening them never pays twice.
13. As a member, I want a crate never to expire, so that a busy week doesn't cost me a reward.
14. As a member whose quests are hidden for a while, I want my waiting rewards to still be there when quests come back, so that a flag change never loses them.

**Telling me it's waiting**
15. As a giver whose kudos finished a quest, I want the reply to say the XP is waiting in my crate, so that I know to open it.
16. As a member, I want the quest-finished DM to say the reward waits in the crate, so that the `Open` button has a reason.
17. As a member, I want App Home's waiting crates to show what each holds, so that I know what opening them gives me.
18. As a member, I want my activity to show a quest's XP as waiting until I open it, and as earned after, so that the timeline stays true.

**The website**
19. As a member on the website, I want each crate to say whether opening it will move my bar, so that the page shows the right promise.
20. As a member on the website, I want to see my XP climb from where it was to where the crate takes it, and the level-up if there is one, so that the open feels like a reward.
21. As the website's builder, I want the open's answer to say exactly what this open applied, from which XP and level to which, so that I animate the truth and never guess.
22. As the website's builder, I want a repeated or replayed open to answer the same, so that a reconnecting socket never animates a second climb from different numbers.

**Rollout**
23. As the product owner, I want the change behind `crate-rewards`, sandbox plus my email first (decision 18), so that I try it before anyone else.
24. As the product owner, I want production byte-for-byte unchanged while `crate-rewards` is off, so that shipping is dark.
25. As the product owner, I want turning the flag off later to strand nobody's rewards, so that rolling back is safe.

## Rules

### Holding a reward

- **CR1. Which rewards wait.** A reward record for a weekly quest or a Journey step that is written while `crate-rewards` is on for its member is **held**. It is written exactly as today (keyed by what it pays for, with its XP, coins, item, catalogue version and cause, once per key), with one more field set at insert: `held: true`. Reward records stay insert-only (P87). Achievement tier coins (keyed `tier:`) have no crate and are never held. Unlock crates hold no reward and are unchanged. When group quests arrive, their crates hold their rewards by this rule.
- **CR2. A held reward counts for nothing yet.** Writing a held record adds no XP to the member's progress, so no level or skill point. It credits no coins, grants no item, and publishes no `xpRecorded` and no `levelReached`. Everything else the finish does stays as today: `questFinished` with the promised reward, the Journey's `first-quest` (a weekly quest finished still finishes it, and its reward is held too), the pending-crate index row, the quest DMs, the success reply's gains line, and the `quest finished` product event.
- **CR3. The open applies it.** `openQuestCrate`, opening a crate whose reward is held and has no crate opening yet, does everything it does today and, in the same mutation:
  1. stores on the crate opening what it applied and the member's standing on both sides of it: `applied: { xp, coins, item, from, to }`, where `from` and `to` are each `{ xp, level, coins, skillPoints }` (coins being the wallet balance and skill points the unspent ones), read just before and just after the open in the same mutation;
  2. adds the XP to the member's progress;
  3. credits the coins through the wallet;
  4. grants the item, once quest items have reached `main` (HH32). If the member owns it by the open, the open credits the coins the quest would have paid without an item instead, and `applied` records those coins and no item;
  5. publishes `xpRecorded`, then one `levelReached` without a kudos message for each level the XP crosses, as a reward's level does today (P64): the announcement-channel notice, the level-up DM, Unlocks' readiness and the activity's level-up mark all follow, at the open's time;
  6. then publishes `questOpened` as today.

  A second open writes and publishes nothing. Slack's `Open` and the website's open both run `openQuestCrate`, so they apply alike.
- **CR4. Rewards from before stay counted.** A reward record without `held` counted at its finish, as today. Its crate's open applies nothing more and stores no `applied`. No reward is taken back, and none is applied twice. There is no backfill: every record written before the deploy, and every record written while the flag is off for the member, is one of these, opened or not.
- **CR5. The record decides, not the flag.** Once held, a reward waits for its open whatever `crate-rewards` says later. Turning the flag off changes only the rewards finished afterwards. Turning it off and on again rewrites nothing.
- **CR6. Nothing expires.** A crate stays openable for good (P85), and so does its held reward. While an open is refused (Quests doesn't apply to the member, or a Journey step's feature doesn't, such as `two-days` without the Book), the reward waits and applies at the first open that succeeds. A member who leaves keeps their held rewards unapplied. If they come back, they can open them.
- **CR7. What doesn't change.** Effects records (kudos XP, perk bonuses, kudos coins) count at once, as today. The leaderboard counts kudos, never XP, so it is unaffected. Book ladders count kudos, people and days, never XP or levels, so tiers are unaffected, and tier coins pay at the tier. A member's level, XP to the next level and skill points show only what counted, wherever they show (App Home, the website, the skill tree), so a held reward shows in none of them until it is opened.
- **CR8. One writer.** Progression applies a held reward, as it applies every reward today. Quests asks progression to apply it from `openQuestCrate`, and the wallet stays the only writer of the balance (CO12). A balance stays equal to what the records add up to (CO9), now counting a held record's coins from its crate opening's `applied` instead of from the record.

### Telling a waiting reward

A reward is **waiting** while its record is held and its crate has no opening. Once opened, every line reads as today.

- **CR9. The success reply's gains line** names a quest whose reward is waiting as `Quest done: {goal} (+20 XP waiting in your crate)`, or `(+20 XP, +10 🪙 waiting in your crate)` while coins are visible (CO19). The words follow the record the subscriber's mutation wrote, as the line does today.
- **CR10. The quest DMs** (`quest-finished`, `weekly-quest-finished` and the join's `journey-joined`) say `**20 XP** waits in your crate.` instead of `You earned **20 XP**.` for a waiting reward, beside today's `Open` button. The wording is decided at delivery from the record and its opening, like the DM's other delivery checks, so a crate opened before the DM went out reads `You earned`.
- **CR11. App Home** adds ` · +20 XP waiting` to each waiting crate's line (this week's, earlier weeks' and the Journey's). Opening a crate in Slack sends no new message: App Home's republish (from `xpRecorded`) shows the new XP and level, and a level crossed sends today's level-up DM (decision 22 keeps Slack quiet).
- **CR12. The activity.** Each `earned.questsDone` entry gains `waiting: boolean`, true while the reward waits. Read without writing.

### The website

- **CR13. `getQuests`.** Each finished quest, Journey step and earlier week's crate gains `waiting: boolean`, true while its reward waits, so the page can say opening it will move the bar.
- **CR14. `openQuestCrate`'s answer.** `{ kind: "opened", applied: { xp, coins, from: { xp, level, coins, skillPoints }, to: { xp, level, coins, skillPoints } } | null }`, or `{ kind: "refused" }` as today. `applied` is read from the crate opening that CR3 stored once, never derived from a live read, so a repeated or replayed call answers the same numbers even after the member's XP, balance or skill points moved on. While coins aren't visible to the member (CO14), `applied.coins`, `from.coins` and `to.coins` answer 0. While the skill tree doesn't apply to them, both `skillPoints` answer 0. It is `null` for a crate whose reward counted at its finish (CR4), which the website reveals without a climb. The live reads (`getMyProfile`, the wallet) show the state after the open. Map #57 owns the animation. `openFeature`'s answer is unchanged.

### Rollout

- **CR15. The flag.** `crate-rewards`, a member decision, `safeDefault: false`. It starts on for `environment = sandbox` and the product owner's email only (decision 18). It is read in the mutation that writes a weekly quest's or Journey step's reward record, with exposure, only where Quests applies to the member, so its exposure is sent only where it decides something. Nothing else reads it: the record decides everything after (CR5). With it off, unset or the flags key missing, every Slack call, read and table write equals `main`'s.
- **CR16. Widening.** After the product owner has tried it, the conductor asks him before turning `crate-rewards` on in production. No sweep or backfill runs when it widens (CR4).

## Implementation Decisions

- **Reward records** gain an optional `held: v.optional(v.literal(true))`, set only at insert. The insert-only invariant is unchanged.
- **Progression** (`convex/progression/progression.ts`): `recordReward` takes whether the reward is held. For a held reward it inserts the record and stops: no credit, no `saveProgress`, no publish. A new `applyHeldReward(ctx, workspace, record, at)` adds the XP (`rewarded()`), credits the coins, saves progress, publishes `xpRecorded` and `levelReached`, and returns what it applied with the standing before and after (`standingOf` plus the balance). Tier coins (`achievements/tierCoins.ts`) keep calling `recordReward` unheld.
- **Quests**: `finishQuest` reads `crate-rewards` (with exposure) and passes `held`. `openQuestCrate` reads the record; when it is held and unopened, it calls `applyHeldReward` and stores `applied` on the new crate opening. Crate openings gain an optional `applied` object, set only at insert. The flag module sits beside `quests/questsFlag.ts`, like `activity/activityFlag.ts`.
- **Items** (once #365 lands, whichever ticket lands second wires it): the finish of a held reward with an item writes the record with the item and grants nothing. The open grants it, or credits the quest's coins when it is owned by then (CR3.4). HH32's "owned by the finish" substitution stays at the finish.
- **Feedback**: the gains line (`replies.ts`), the quest DM lines (`home.ts` `finishedQuestCrateOf`, `finishedWeeklyQuestCrateOf`, the join's lines) and App Home's waiting crate lines read `waiting` from Quests (a `rewardWaits(member, key)` read). The DM's delivery query decides it at delivery. No notification argument changes, so jobs queued before the deploy deliver.
- **Activity**: `questsFinishedByMessage` returns `waiting` per quest, and `QuestDone` gains it.
- **Website**: `getQuests` maps `waiting` onto slots, Journey steps and waiting crates. `openQuestCrate` answers a new `CrateAnswer` type with `applied`, read from the crate opening after `runCommand`.
- **Analytics**: unchanged. `quest finished` and `quest opened` already carry their times, and `level reached` fires from the open by CR3.
- **Coherence.**
  - `Quests`: the invariant **opening a crate grants nothing** (P92) becomes **opening a crate applies its held reward once**: it applies a held reward's XP, coins and levels exactly once, at the first open, and applies nothing for a reward that counted at its finish. Refute it by applying on a second open, and by applying an unheld record. The prose for P85 and P92 follows CR1–CR6.
  - `Progression`: the prose for P87 follows CR1–CR3, and a new invariant **a held reward counts only from its open** (refuted by `recordReward` crediting or saving progress for a held record).
  - `Wallet`: **a balance is what the records add up to** counts a held record's coins from its opening's `applied` (CR8), with a held reward opened and unopened in its `over`.
  - `WebsiteReads`: **opening on the website grants nothing** becomes **opening on the website applies what Slack's open applies**: the website open and Slack's `Open` of the same held crate leave the same tables and events. The answer's shape is declared beside it.
  - The lexicon: `crate` and `reward record` drop "never grants anything" and "counts toward XP and levels" for CR1–CR4. `held reward` is declared.
  - A journal decision records the reversal of P92's #97 amendment, quoting decision 23.

## Testing Decisions

- **Good tests** drive the system from the outside: signed Slack events and interactivity payloads through the HTTP router, and the website's member mutations and queries, with `convex-test`, Slack and PostHog stubbed at `fetch`. They assert what Slack is asked to post or publish and what the website reads answer, plus the wallet and progression reads, never tables directly, except the every-table assertions the amended invariants already use. Times come from `settleInTimeOrder`. Exact-count tests name every scheduled job (repo memory).
- **Ticket 1** (prior art: `convex/quests/crates.test.ts`, `finish.test.ts`, `journey.test.ts`, `convex/wallet/wallet.test.ts`, `convex/website/openQuestCrate.test.ts`): with the flag on, a weekly quest and a Journey step finished by a kudos leave XP, level and balance unchanged and send no level-up DM. Opening each from App Home applies them once, with a level-up DM and a reward-level notice for a crossed level. A second open, and a website open after a Slack open, apply nothing. A reward finished with the flag off, then opened with it on, applies nothing at the open. One finished with it on, then opened with it off, applies at the open. An open refused while Quests is off applies later, when Quests is back. Tier coins pay at the tier with the flag on. With the flag off, every Slack call and table equals `main`'s.
- **Ticket 2** (prior art: `convex/slack/gainsLine.test.ts`, the quest DM tests, `progressionHome.test.ts`, `convex/website/activityEarned.test.ts`): each waiting wording byte for byte, with coins visible and not. The DM decided at delivery after an open reads `You earned`. Opened crates read as today. The activity's `waiting` flips at the open.
- **Ticket 3** (prior art: `convex/website/quests.test.ts`, `openQuestCrate.test.ts`, `commands.test.ts`): `waiting` on each crate kind. The open's answer for a held reward, with a level crossed and without; the same answer on a repeated call; `null` for an unheld one; `refused` as today.
- The gate ticket proves the flag: off, unset and missing-key equal `main`; on for one member's email only changes only that member; exposures once per member and value.

## Out of Scope

- The website's reveal and climb animation, the more effectful level-up animation and the XP climb on return (map #57, decision 23).
- A Slack message when a crate is opened (decision 22 keeps Slack quiet; App Home's republish and the level-up DM carry it).
- Applying rewards recorded before the change at their open, or any clawback.
- Expiring crates, or reminders about unopened ones.
- Holding kudos XP, bonuses, or tier coins.
- New analytics properties.

## Review

_Filled in after the GPT-6.1 Sol review._

## Further Notes

**The product owner's words this spec builds on, verbatim.**

1. Crate rewards (map #1, decision 23, 2026-10-14, on #411): "I noticed that when I open an experience crate for quests or something, it seems to have already been applied to my XP bar, but that shouldn't be the case. Only the opening should apply, so that if I open the chests and get the XP, then I actually get them and level up, for example."
2. Every new feature behind a flag (decision 11, 2026-10-13): "make sure that any new feature going to production, like leveling, the new website, etc. is behind a feature flag."
3. All in (decision 18, 2026-10-14): "Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on."
4. The cut (decision 12, 2026-10-13): "things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey", corrected to "the onboarding journey is not cut, the rest is as stated". Quests, the Journey, coins and hedgehogs are kept, so their crates are the ones that hold rewards.

**The website conductor's answer** (map #57, 2026-10-14) accepted the contract with one addition, folded into CR3 and CR14: `from` and `to` also carry `coins` and `skillPoints`, stored rather than derived, because the website's reward flights (#354) count coins into the coins chip and land skill points on their counter. `waiting` keeps one name and meaning in all three places. The website sends `openQuestCrate` once over HTTP, holds the header at `from` during a reveal and animates to `to`, reveals without a climb for `applied: null`, and its climb on return (#413) skips `earned.questsDone` entries with `waiting: true`, so held XP climbs on the open, never on return. Map #57 tickets "the reveal climbs on the open" once this spec publishes.

**The calls taken at recommendation** are listed with their journal IDs in the resolution on #411.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
