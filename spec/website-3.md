# Spec: the website's third slice, the unlock path and quests on the home

> **Accepted on 2026-10-13 under the product owner's autonomous directive** (map [#57](https://github.com/Silthus/kudos/issues/57) Notes: "ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags"), with every open call at its recommendation (listed under "Further Notes"). Ticket [#142](https://github.com/Silthus/kudos/issues/142). This file lives on the branch `docs/spec-website-3` and is never merged. It is the target design of the third slice; its implementation tickets are listed under "Slices". Its rules continue the first two slices': `WS1`–`WS28` are in [`spec/website.md`](https://github.com/Silthus/kudos/blob/docs/spec-website/spec/website.md) on `docs/spec-website`, `WS29`–`WS54` in [`spec/website-2.md`](https://github.com/Silthus/kudos/blob/docs/spec-website-2/spec/website-2.md) on `docs/spec-website-2`, and all still hold except where a rule below names the one it changes.
>
> Sources: the first two slices (their specs, the code on `main` at `0c40c11` and on `spec/website-2`: `website/`, `convex/website/`), the visual language ([`docs/website/visual-language.md`](https://github.com/Silthus/kudos/blob/main/docs/website/visual-language.md), V1–V24), the accepted UI prototype #62 (variant E's home, locked cards, crates and quests, `prototype/website-ui` at `3409ade`), the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2`, P72–P95), map #1's unlocks on `main` (`convex/unlocks/`, #99 and ship #105, flag `unlocks`), map #1's commands on `main` (`convex/commands/`, D17), map #1's quests on `spec/quests` (`convex/quests/`: `questsOf` #118, `openQuestCrate` #120, ship #129, flag `quests`, not on `main` yet), and the Octalysis findings #85.

## Problem Statement

Map #1 has shipped progressive unlocks to `main`, dark behind `unlocks`: a member's level makes each shipped feature **ready**, and the member **opens** it with one action from Slack (P73). Map #1's quests and the Journey are landing behind `quests` (#129). The website still shows six plain locked cards that say nothing about a member's real state (WS19). It names features that haven't shipped, which P78 forbids once unlocks apply. It can't open anything, although P73, P85 and P92 name the website as a place to open a crate and give it the reveal animation. And it shows no quest and no Journey step, although a member's onboarding chain starts at level 1.

## Solution

**The home reads its unlock path.** While unlocks apply, each shipped feature's card shows the member's state from Unlocks' own facts:
- **Locked:** `Unlocks at level {n}`.
- **Ready:** a crate labelled with what it unlocks.
- **Open:** a link to its page.

Features that haven't shipped don't appear. While unlocks don't apply, the home is the second slice's, unchanged.

**The website gets its first command: opening a crate.** A ready feature's crate has `Open`. It calls one signed-in mutation, which runs the same D17 command Slack's `Open` runs and then republishes App Home. After the server confirms, the website plays the crate's reveal: once per browser, with Replay, and calm under reduced motion. The HUD's ready pill counts what is ready to open.

**Quests on the website, once map #1's quests reach `main`.** The home gains a **Journey** panel: the member's onboarding steps, each with its goal, its reward and, once finished, its crate. A new **quests page** at `/quests` shows the week's personal quests with their progress and their crates. Quest crates open on the website through D17's `openQuestCrate`. Swapping a quest stays in Slack for now.

Every piece reads facts and sends commands. Unlocks decides what is ready and what may open, and the quests module decides progress and what finished. The website computes neither. No new flag is needed: each piece rides the flag that already gates it in Slack, plus `website`.

## User Stories

**The unlock path on the home**
1. As a member, I want each feature card to say whether it is locked, ready or open for me, so that I know what my level has given me.
2. As a member, I want a locked card to say the level it unlocks at, without a progress tease, so that I know what's coming without being pushed.
3. As a member, I want features that don't exist yet to stay out of sight, so that I'm never shown something I can't get.
4. As a member, I want an open feature's card to take me to its page, or tell me where to find it, so that opening leads somewhere.

**Opening on the website**
5. As a member, I want to open a ready feature on the website with one click, so that I don't have to go back to Slack for it.
6. As a member, I want the crate to say what's inside before I open it, so that opening is a moment, not a gamble.
7. As a member, I want the reveal to play once and then let me replay it, so that it feels special without repeating itself.
8. As a member who prefers reduced motion, I want the end state shown at once, so that the moment doesn't move against my setting.
9. As a member using a keyboard or a screen reader, I want to open, skip and close a crate and hear what opened, so that the moment works for me too.
10. As a member, I want something that becomes ready during my visit to wait in the ready pill, so that nothing interrupts what I'm doing.
11. As a member, I want App Home to show what I opened on the website, so that Slack and the website agree.

**Quests and the Journey**
12. As a new member, I want to see my Journey's current step, what it asks and what it pays, so that I learn how to take part.
13. As a member, I want to see this week's quests with their progress, so that I know what is left.
14. As a member, I want to open a finished quest's or Journey step's crate on the website, so that I see what I earned.
15. As a member, I want quest copy to state what counts, 5 or more words besides mentions and emoji, and never judge my kudos, so that the rules are honest.

**Running it**
16. As the product owner, I want the unlock path to show only where unlocks apply, and quests only where quests apply, so that the website never shows more than Slack does.
17. As the product owner, I want the website's commands to be the same D17 commands Slack runs, and to grant nothing, so that a click on the web can't change what anyone earns.
18. As a developer, I want every new public function on WS10's exact list and behind one guard, so that each new entrance is a reviewed change.

## Rules

Rules continue the second slice's numbering, from `WS55`.

### The unlock path on the home

- **WS55. When unlocks apply.** The website's gate for unlock state is WS52's: `xp-levels` is on (`xpLevelsShownIn`) and `unlocksAppliedIn` answers true, meaning the `unlocks` flag is on and Unlocks recorded the workspace's launch (P77). The website reads only these query-safe checks and never runs the launch. While unlocks don't apply, the home, the nav and `/leaderboard` are the second slice's, unchanged.
- **WS56. The features are Unlocks' facts.** `getMyProfile`'s member answer gains `features`. While unlocks don't apply it is `null`. Otherwise it has one entry per shipped feature, in the schedule's order. Each entry is `{ feature, name, opens, level, state, readyAt, openedAt }`:
  - `state` (`locked`, `ready` or `open`), `readyAt` and `openedAt` come from Unlocks' `unlocksOf`.
  - `name`, `opens` and `level` come from Unlocks' schedule entry (`scheduled`).
  - `seen` is the opaque per-member crate key WS66 uses.

  The website never compares the member's level with a feature's level, and never derives a state from XP (P79). A feature that hasn't shipped has no entry (P78). Basics is not a feature.
- **WS57. The leaderboard answer follows its entry.** While unlocks apply, `getMyProfile.leaderboard` (WS52) is `{ kind }` with the leaderboard entry's `state` as its kind, carrying the entry's `level` only while it is `locked`, or `{ kind: "off" }` when there is no entry. Both come from the same `unlocksOf` read, so the nav, the card and the page can't disagree. `getLeaderboard`'s answers stay WS52's, except its `ready` page (WS67).
- **WS58. Cards in three groups** (V23, V2, V4). While `features` is present, the home's feature section replaces WS19's six plain cards with three groups, each in schedule order and each shown only when it has a card:
  - `Ready for you`: crates (WS64).
  - `Open`: a plain card for each open feature. It links to the feature's web page where the website has one (`/leaderboard`, and `/quests` from WS72) with the second slice's kind of one-sentence copy (WS38). For a feature without a web page, the card reads `Open. Find it in Slack's App Home.` with one action that opens the workspace in Slack.
  - `Still locked`: a calm card with a lock icon, the name, `Unlocks at level {level}`, one sentence on what the feature is, and its hedgehog in silhouette. It never shows "levels to go", a bar or any progress (V23; the prototype's "{n} levels to go" is dropped).

  Each card's name is Unlocks' `name`, so it reads the same as Slack. The one-sentence copy stays the website's, keyed by feature ID, and follows WS19's #85 rules. Until the website can open (ticket 3), a ready card reads `Ready for you. Open it in Slack's App Home.` instead of `Open`. While unlocks don't apply, WS19's plain locked cards stand unchanged, including the plain Quests card (WS55).
- **WS59. The nav lists open pages only.** While unlocks apply, the HUD's screen nav (WS16, WS37) shows `Home` plus each open feature that has a web page, in schedule order. A locked or ready feature has no nav item: no lock badges and no "Lv N" (the prototype's locked nav items are dropped, P78 and V23).
- **WS60. Your own path only.** Unlock state is about the signed-in member alone (P76). Nothing on the website shows or depends on another member's unlocks, and a member's row on other members' boards is unchanged (#103, WS52).

### The website's first command

- **WS61. One guard for commands, and it reads only.** `memberMutation` in `convex/website/memberMutation.ts` runs `memberQuery`'s guard in the same order (WS11) and returns the same denials. The guard writes nothing.
  - Inside a mutation the flag seam would create a missing workspace key (`workspaceKeyOf`). So the guard evaluates `website` through the seam's read-only path (`existingWorkspaceKey`), and a missing key answers `closed`, exactly as WS2 does in a query.
  - A closed, signed-out, verifying, unverified or non-member call returns its denial having written nothing at all.
  - The handler gets the verified member and the member's directory facts (`HomeMember`). An argument never names a member.
- **WS62. `openFeature` is D17's `openUnlock`, behind WS55's gate.** `openFeature({ feature })` in `convex/website/commands.ts` is built on `memberMutation`.
  - **The gate first.** It checks WS55's query-safe gate (`xpLevelsShownIn` and `unlocksAppliedIn`). If it fails, it answers `{ kind: "refused" }` without calling D17, so a website call can never run Unlocks' launch (P77 stays Slack's, WS52). Once the gate passes, the launch is already recorded, so `unlocksLiveIn` inside the command finds it and launches nothing.
  - **The command.** It then calls D17's `runCommand(ctx, workspace, person, { type: "openUnlock", feature })`. It answers `{ kind: "opened" }` only when the gate passed and Unlocks' `stateOf(member, feature)` reads `open` afterwards, and `{ kind: "refused" }` otherwise. After `opened` it calls `republish(ctx, member)`, as Slack's `receiveHomeClick` does, so App Home drops the crate.
  - **Who decides.** Unlocks alone decides whether the feature may open: shown to the member, shipped and ready. It changes nothing for anything else.
  - **What it writes.** The website writes no table itself. The command's own effects are Unlocks': `unlocks.openedAt` and `unlockOpened`. Besides them, the call may write only the exposure Slack's click sends (`unlocksShownTo`, O36) and App Home's scheduled republish.
  - `feature` is validated by Unlocks' `featureValidator`, so the website accepts exactly what Slack accepts.
- **WS63. No idempotency key.** Opening is permanent and idempotent by state (P73), so a doubled or retried `openFeature` opens nothing twice and answers `opened` again. D17's idempotency key belongs to Slack's adapter, which dedupes Slack's redeliveries. The website's calls aren't redelivered, and a retry after an uncertain answer is safe.
- **WS64. WS10's list grows by the commands and the quests read.** WS10's exact list adds `./website/commands.ts:openFeature`. From ticket 5 it adds `./website/quests.ts:getQuests`, and from ticket 7 `./website/commands.ts:openQuestCrate`. WS10's rule text is unchanged: it already covers the website's signed-in functions, reads and commands alike. A website command is always a D17 command:
  - a website mutation changes domain tables only through `runCommand`;
  - its only other writes are the exposure and App Home's republish (WS62);
  - a test compares the domain tables and events a website command leaves with those the same Slack click leaves through `receiveHomeClick`. It excludes Slack's `slackReceipts` row, the analytics outbox and scheduled functions, and normalises generated IDs and times.

### The crate moment

- **WS65. The crate** (V13, V2, V8, V4). A ready feature is a closed crate:
  - It has corner marks and the label `Unlocks: {name}`, so its content is known before it opens (P92).
  - Its sentence is `It opens {opens}.`.
  - It has one `Open` button. On the home every crate's `Open` is outline, because thanking in Slack stays the home's one primary action (WS17, V4, #85). On a ready page (WS67), where opening is the next action, the crate's `Open` is primary.
  - The closed crate nudges once after a beat and never loops.
  - Its art is ported fresh from variant E on Quill tokens and V12's band colours. Variant E's shimmer and its hover lift are dropped.
- **WS66. The reveal follows the server** (V10, V11, V13, V24).
  - **Sending.** `Open` sends `openFeature`, and the crate shows `Opening…` without motion until the answer.
  - **`opened`.** A full-screen dialog plays the reveal. It has the label `Level {level} unlock`, the crate opening once, the headline `{name} is open`, the line `It opens {opens}.`, and two actions:
    - `Go to {name}` for a feature with a web page, or `Find it in Slack's App Home.` otherwise;
    - `Done`.
  - **`refused`.** No reveal. The card shows the feature's current state, with `That couldn't be opened.` in its live region.
  - **A denial** (WS11). No reveal. `Opening…` ends, and the frame follows `getMyProfile`'s own answer to the closed, signed-out or other denial page, as on any read.
  - **An error or no answer.** If the call rejects or the connection drops, `Opening…` ends, the crate is closed again, and its live region says `Couldn't reach HedgeHug. Try again.` with `Open` enabled. A retry is safe (WS63), and if the first call did commit, the reactive read shows the feature open.
  - **Seen.** A crate counts as seen once per member and crate in this browser. The key is an opaque `seen` string the read carries for each crate (WS56, WS70, WS71): a hash the server derives from the member and the crate, so no member or Slack ID reaches the browser (WS33). Two members who share a browser each see their own first reveal.
  - **Replay.** A seen crate never replays by itself. The dialog's end state carries `Replay`. Once the dialog closes, the opened card has no Replay of its own.
  - **Skipping.** Any click, Space or Esc skips to the end state.
  - **Reduced motion** shows the end state at once, with an opacity fade of at most 200 ms.
  - **Focus.** It moves into the dialog. When the dialog closes, it returns to the feature's card, now open, on the home. On a ready page (WS67), where the crate is replaced by the page itself, it moves to the page title (WS24's rule after a state change). A live region says `You opened {name}.`.
  - **Rewards.** The reveal shows only what Unlocks recorded, and opening grants nothing (P92, ADR-0006). It never shows XP, coins or a count.
- **WS67. Ready pages open in place.** `/leaderboard` in its `ready` state shows the crate and its `Open` in place of WS52's sentence "Leaderboard is ready for you. Open it in Slack's App Home.". Once opened it is the board, reactively. Its `locked` state keeps WS52's sentence. `/quests` follows the same rule (WS71).
- **WS68. The ready pill** (V1, V15). While at least one crate is ready (ready features, and from ticket 7 every unopened quest and Journey crate, WS70), the HUD shows a button, `{n} ready` (`1 ready` for one).
  - It takes the first ready crate, features in schedule order before quest crates, and sends the same guarded command its `Open` sends (`openFeature` or `openQuestCrate`).
  - It shows the same `Opening…` state, and the reveal plays only after `opened` (WS66). A refusal, a denial or an error ends as WS66 says.
  - Something that becomes ready during a visit joins the pill and never opens a dialog by itself.
  - At zero the pill is gone.

### Quests on the website, after #129

- **WS69. When quests apply.** The quests module's own query-safe predicate decides, `questsApplyIn(ctx, workspace)`: `quests` is on, `xp-levels` is on and unlocks apply. While it answers false:
  - the home has no Journey panel;
  - `/quests` is the not-found page;
  - while unlocks apply, the Quests feature has no card, because Quests ships with `quests` and an unshipped feature has no entry (WS56, P78);
  - while unlocks don't apply, WS19's plain locked Quests card stands, as it does today (WS55). It names no level and opens nothing.

  `questsApplyIn` implies that unlocks apply, so quests never apply while the home shows WS19's cards.
- **WS70. The quests read.** `getQuests` in `convex/website/quests.ts` is built on `memberQuery` and takes `{}`. It answers:
  - `{ kind: "not-found" }` while quests don't apply;
  - `{ kind: "locked", level }` or `{ kind: "ready" }`, with no quest facts, while the Quests feature isn't open, as WS52 answers for the leaderboard;
  - otherwise `{ kind: "quests", slots, waiting, chatUrl }`.

  `waiting` lists every crate of an earlier week the member finished and hasn't opened, oldest first, because a finished quest's crate stays openable for good (P85). Each entry is `{ goal, reward: { xp }, crate, seen }`. It comes from a domain-owned read of unopened crates across weeks (cross-map need 1), never from the website scanning old weeks.

  `slots` holds this week's drawn personal quests in slot order. It is empty when nothing was drawn (P80). Each slot holds:
  - `slot`;
  - `kind`: `Say why` for thoughtfulness, `Reach out` for breadth;
  - `goal`, the quest pool's copy;
  - `progress`: `{ done, target }`;
  - `reward`: `{ xp }`;
  - `state`: `in-progress`, `finished` or `opened`;
  - `swapped`;
  - `crate`: the D17 `quest` value that opens its crate, present only while it is `finished`;
  - `seen`: the opaque per-member crate key WS66 uses, present once the slot is finished.

  Every value comes from the quests module's facts (`questsOf`'s helpers as #129 ships them). The website computes no progress, feasibility, finish, week boundary or reward. A fact #129 doesn't carry is added by an additive export in `convex/quests/`, the way #133 added `rankedBoardOf`, never derived in `convex/website/` (cross-map need 1). Coins and items show in a reward only once their feature is open (P75), and no shipped feature opens them yet, so a reward shows its XP.
- **WS71. The Journey read.** `getMyProfile`'s member answer gains `journey`. While quests don't apply it is `null`. Otherwise it lists the member's active Journey steps in chain order, each `{ step, goal, hint, reward: { xp }, state, crate, seen }`:
  - `state` is `active`, `finished` or `opened`;
  - `crate` is present only while the step is `finished`;
  - `seen` is present once the step is finished.

  The Journey isn't gated by the Quests feature, since its first step is active from level 1 (P88).
  - **A website-first member.** They may sign in before any kudos or App Home publish has stored the first step's activation. The read still lists `first-thanks` as active, from a query-safe projection the quests module owns: the stored activation, or the step with the catalogue's current reward while none is stored (cross-map need 1). The website never decides which step is active.
  - **Copy.** Goal and hint copy come from the quests module, the same copy App Home's Profile tab shows. Today that copy lives in feedback's `journeyGoals`. The website keeps no copy table for steps (cross-map need 1).
  - A step that isn't active has no entry.
- **WS72. The Journey panel on the home.** While `journey` has an entry, a panel labelled `Journey` (a game object with corner marks, V2) sits after the hero and the counters and before the feature cards, so thanking still leads (#85). It lists each step in chain order:
  - **Active:** the goal, the hint, and `Pays {xp} XP`.
  - **Finished:** a crate labelled `Journey reward · {xp} XP`, with an outline `Open` (WS74, WS65). Until the website can open quest crates (ticket 7), it reads `Ready for you. Open it in Slack's App Home.` instead of `Open`.
  - **Opened:** `✓ Done · You earned {xp} XP`.

  It never shows a step count such as "1 of 5" and never names a step that isn't active. Copy never calls a kudos "thoughtful" and never asks for padding (P95). The home's Quests card, when open, links to `/quests` with `Your quests this week.` and shows no count.
- **WS73. The quests page.** The page is `/quests`, its tab reads `HedgeHug · Quests`, and its nav item shows while Quests is open (WS59).
  - **Header:** `This week`, and `New quests arrive every Monday.`
  - **Quest cards:** one per slot, each a game object with corner marks. It shows:
    - the kind label;
    - the goal;
    - a neutral progress bar exposed as a progressbar labelled `{done} of {target}`;
    - the reward `{xp} XP`;
    - a `Swapped` tag when `swapped`.
  - **A finished quest** is a crate labelled `Quest reward · {xp} XP`, with a primary `Open` for the first one on the page and outline for the rest (V4). Until ticket 7 it reads `Ready for you. Open it in Slack's App Home.` instead.
  - **An opened quest** reads `✓ Done`.
  - **`Waiting to open`:** a section shown only while `waiting` has entries. It lists earlier weeks' crates, each labelled `Quest reward · {xp} XP` with its goal and `Open`.
  - **Fewer quests:** fewer than three cards show when fewer were drawn.
  - **No draw:** the empty state (V23): one hedgehog, Max's sentence "You have no quests this week.", and one action that opens the workspace in Slack.
  - **`How quests work`:** a panel that says "Quests reward thanking someone new, someone you haven't thanked in a while, and thanks that say why. A thanks says why when your message has 5 or more words besides mentions and emoji. New quests arrive every Monday. You can swap one quest a week in Slack's App Home." (P81, P83, P95).
  - **Not on this page:** no swap control, no group quest and no bonus quest.
  - **Updates:** the page is reactive and turns over to the new week on the first clock tick after the member's local Monday midnight (WS15).
- **WS74. Opening a quest crate.** `openQuestCrate({ quest })` in `convex/website/commands.ts` is built on `memberMutation`.
  - **The gate first.** It checks `questsApplyIn` (query-safe, and it implies WS55's gate) and that the Journey's launch is recorded (`journeyShippedAt` isn't null). If either fails, it answers `refused` without calling D17, so a website call never records the Journey's launch or schedules its join (P91 stays Slack's). `openFeature({ feature: "quests" })` makes the same check before WS62's command, because opening Quests publishes `unlockOpened`, whose subscribers would otherwise record the launch.
  - **The command.** It then calls D17's `runCommand` with `{ type: "openQuestCrate", quest }`. It answers `opened` only when the gate passed and the quests module's crate opening for that quest exists afterwards, and `refused` otherwise. After `opened` it calls `republish`, as WS62 does.
  - **Validation.** `quest` is validated by the quests module's `questValidator`.
  - **Who decides.** The quests module alone decides, and opening writes only a crate opening (P85, P92), besides WS62's permitted exposure and republish.
  - **The reveal** follows WS66 with these differences:
    - the label is `Quest reward` or `Journey reward`;
    - the headline is `You earned {xp} XP`, since the XP already counted when the quest finished;
    - the actions are `Done`, plus `See this week's quests` only while the Quests feature is open and the dialog wasn't opened from `/quests`.
  - **Seen** uses the crate's opaque `seen` key from the read.
  - **The ready pill** counts these crates, this week's and `waiting`'s (WS68). On `/quests`, focus returns to the quest's card. On the home, it returns to the Journey step.

### Look, accessibility, order and flags

- **WS75. The look and the checks.** WS23–WS24 and WS54 hold for every new state, ported fresh from variant E:
  - **Copy:** the prototype's "Claim" and "Claimed" become `Open` and `✓ Done` (P85), and its "thoughtful kudos" copy is replaced (P95). Its group quest, bonus quests, reroll link and quest reward chips that fly into the HUD are dropped.
  - **Look:** progress bars and counters are neutral (V4), with no count-ups (V9).
  - **axe:** every state passes axe in light and dark.
  - **Keyboard:** the path covers each crate's `Open` (Enter or Space), skip (Esc), `Replay`, `Done`, `Go to {name}`, the ready pill and focus return.
  - **Tests:** they drive the live-region announcement (V24).
  - **Manual pass:** focus order, focus visibility, reduced motion and screen-reader wording.
- **WS76. Two parts.**
  - **Part A, the unlock path (tickets 1–4).** It needs only what is on `main` and #137.
  - **Part B, quests (tickets 5–8).** It starts only once map #1's quests ship (#129) has merged to `main`.

  The conductor's ship may take Part A alone and Part B in a later ship, or both together. Part A never shows a quest, a Journey step or a Quests card where `quests` is off, so it can't overtake #129.
- **WS77. No new flag.** Every piece is gated by `website` plus the flags that already gate it in Slack:
  - the unlock path by `xp-levels` and `unlocks`;
  - each feature by its own ship flag (`everyone-board` for the leaderboard, `skill-tree` for the skill tree, `quests` for Quests);
  - quests and the Journey by `quests`.

  Opening any piece in production is the product owner's switch on the flag that gates it in Slack, so the website never shows or opens more than Slack does. The website's reads send no exposure (WS30's reading of O36). Its commands send the exposure Slack's click sends, through the module's own code (WS62).

## Implementation Decisions

### Modules

- **Website module (extended, `convex/website/`):**
  - `memberMutation` (new), the command guard, sharing `memberQuery`'s verification.
  - `commands.ts` (new): `openFeature`, and later `openQuestCrate`, each a thin call into D17's `runCommand` plus `republish`.
  - `quests.ts` (new): `getQuests`.
  - `getMyProfile` gains `features` and `journey`, and derives `leaderboard` from `features` while unlocks apply.
- **Unlocks module (unchanged, map #1's):** the website reads `unlocksAppliedIn`, `unlocksOf`, `scheduled` and `stateOf`, and opens through D17's `openUnlock`.
- **Commands module (map #1's):** no code change. Its spec summary gains "and every website command" beside App Home clicks and DM `Open`s (cross-map need 2).
- **Quests module (map #1's, after #129):** the website reads `questsApplyIn` and `questsOf`'s helpers. Where #129 lacks a fact WS70 or WS71 needs, ticket 5 adds an additive export in `convex/quests/`, with App Home's output unchanged and the module's invariants witnessed through it.
- **Website package (extended, `website/`):**
  - the three card groups;
  - the crate and its reveal dialog, with per-browser seen state in `localStorage` keyed per crate;
  - the ready pill;
  - the ready pages;
  - the Journey panel;
  - the `/quests` page.

### Contracts

```ts
// convex/website/memberMutation.ts
export function memberMutation<Args extends PropertyValidators, Result>(definition: {
  args: Args;
  handler: (ctx: MutationCtx, me: VerifiedMember, person: HomeMember, args: ObjectType<Args>) => Promise<Result>;
}): RegisteredMutation<"public", ObjectType<Args>, Promise<Result | Denial>>;
// the guard and its order are memberQuery's (WS11); arguments never name a member

// convex/website/commands.ts
export type CommandAnswer = { kind: "opened" } | { kind: "refused" };
export const openFeature = memberMutation({ args: { feature: featureValidator }, handler: … }); // WS62
export const openQuestCrate = memberMutation({ args: { quest: questValidator }, handler: … }); // WS74, ticket 7

// convex/website/profile.ts (extended)
export type FeatureCard = {
  feature: Feature; name: string; opens: string; level: number;
  state: "locked" | "ready" | "open"; readyAt: number | null; openedAt: number | null;
  seen: string;                                    // WS66: opaque, per member and crate
};
export type JourneyStep = {
  step: string; goal: string; hint: string | null; reward: { xp: number };
  state: "active" | "finished" | "opened"; crate: Quest | null; seen: string | null;
};
export type MemberProfile = {
  /* the first two slices' fields */
  leaderboard: { kind: "off" | "ready" | "open" } | { kind: "locked"; level: number }; // WS52, from features while unlocks apply (WS57)
  features: FeatureCard[] | null;                  // WS56, null while unlocks don't apply
  journey: JourneyStep[] | null;                   // WS71, null while quests don't apply (ticket 5)
};

// convex/website/quests.ts (ticket 5)
export type QuestSlot = {
  slot: number; kind: "Say why" | "Reach out"; goal: string;
  progress: { done: number; target: number }; reward: { xp: number };
  state: "in-progress" | "finished" | "opened"; swapped: boolean; crate: Quest | null; seen: string | null;
};
export type WaitingCrate = { goal: string; reward: { xp: number }; crate: Quest; seen: string }; // P85: earlier weeks
export type QuestsAnswer =
  | { kind: "not-found" } | { kind: "locked"; level: number } | { kind: "ready" }
  | { kind: "quests"; slots: QuestSlot[]; waiting: WaitingCrate[]; chatUrl: string };
export const getQuests = memberQuery(async (ctx, me): Promise<QuestsAnswer> => …);
```

`Quest` is the quests module's own type (`questValidator`), whatever shape #129 gives weekly slots. The website passes it back unchanged as the command's argument and never builds one.

### Data

There is no new table and no migration. The reads use `unlocks`, `unlockLaunches` and `members` (map #1's), and from ticket 5 `journeySteps`, `questDraws`, `rewardRecords` and `crateOpenings` (map #1's). The commands write only what the D17 commands write: `unlocks.openedAt` and a crate opening, plus App Home's scheduled republish. The only state the website keeps is in the browser: which crates were seen (V10).

### The flags

| Flag | Owner | Subject | Gates on the website | State |
|---|---|---|---|---|
| `website` | this map ([957148](https://us.posthog.com/project/662840/feature_flags/957148)) | workspace | the whole site, and every read and command (WS2–WS4, WS61) | sandbox-only |
| `xp-levels` | map #1 ([956733](https://us.posthog.com/project/662840/feature_flags/956733)) | workspace | half of "unlocks apply" (WS55) | sandbox-only |
| `unlocks` | map #1 ([956771](https://us.posthog.com/project/662840/feature_flags/956771)) | workspace | feature states, crates, `openFeature` (WS55–WS68) | sandbox-only |
| `everyone-board` | map #1 ([956734](https://us.posthog.com/project/662840/feature_flags/956734)) | workspace | whether the Leaderboard feature has shipped | sandbox-only |
| `skill-tree` | map #1 | workspace | whether the Skill tree feature has shipped (no web page yet: its open card points to Slack) | not created, reads off |
| `quests` | map #1 (#128) | workspace | whether Quests has shipped, the Journey panel, `/quests`, quest crates (WS69–WS74) | created by #128 on `spec/quests` |

The website creates no flag (WS77). Recommended production order, so a member never sees a crate for something Slack can't show:
1. `everyone-board`, `xp-levels` and `unlocks`, as #105's handoff recommends.
2. `website`.
3. `quests` once #129 has shipped.

While `website` is on in production and `unlocks` has no production condition, the website keeps the second slice's home. WS53 still holds for the leaderboard.

### Coherence

These are proposed declarations. Each ticket writes its part and makes `coherence spec --check` pass.

- **Entrances** (`convex/website/WebsiteReads.spec.md`, renamed or joined by a `WebsiteCommands.spec.md` if the reads spec's summary can't hold commands):
  - `mutation openFeature`: a browser asks to open one ready feature for the signed-in member, with the feature as its only argument. Trust `browser`.
  - `mutation openQuestCrate`: a browser asks to open one finished quest's or Journey step's crate for the signed-in member, with the quest as its only argument. Trust `browser`. Ticket 7.
  - `query getQuests`: a browser asks for the signed-in member's quests this week. Trust `browser`. Ticket 5.
- **Invariants:**
  - *Website reads pass one guard* gains `query getQuests`.
  - *Website commands pass one guard* is new. Crossing `browser -> domain`, entrances `mutation openFeature`, `mutation openQuestCrate`. It is witnessed with no session, with the flag off, with a flags key but no workspace key, and with a non-member, each writing nothing to any table (WS61).
  - *A website command never launches unlocks* (WS62) is new. It is witnessed with `unlocks` on and no launch recorded: `openFeature` answers `refused` and no `unlockLaunches`, `unlocks` row or event appears.
  - *A website command is a D17 command* (WS62, WS64) is new. It runs over every domain table and every published event: `openFeature` leaves exactly what Slack's `Open` for the same feature leaves, compared as WS64 says, and a refused call changes no domain table.
  - *Opening on the website grants nothing* (P92). Unlocks' *opening grants nothing* and the quests module's crate invariant are witnessed through the website's commands.
  - *The website shows only shipped features* (WS56, P78). Crossing `browser -> domain`, entrance `query getMyProfile`. It is witnessed with `skill-tree` off and a member past level 5.
  - *The website's feature states are Unlocks' facts* (WS56, WS57). Crossing `browser -> domain`, entrance `query getMyProfile`.
  - *Quests are invisible where they don't apply* (WS69). Crossing `browser -> domain`, entrances `query getQuests`, `query getMyProfile`.
  - *The public surface is exact* keeps its test, which lists the new functions.
- **Lexicon:** ticket 3 declares **crate** (P92's sense) and **ready pill** (V1, V15) if they aren't declared by then. Ticket 5 reuses `quest`, `Journey` and `reward record` from #118.
- **Journal:** each ticket records its decisions with `coherence decide` and commits the journal with the change.

## Testing Decisions

- **A good test enters at a seam and checks what a member could observe:** what `getMyProfile`, `getQuests` and the commands answer, what they write (read through every table), what the rendered page says and where focus goes. It never tests private helpers.
- **Seams, highest first:**
  1. **The unlock read** with `convex-test`. `getMyProfile.features` and `leaderboard` are tested for:
     - `xp-levels` and `unlocks` in each combination, before and after the launch;
     - a grandfathered member (P77);
     - a level 1 member (Leaderboard locked at level 3);
     - a level 3 member (ready);
     - an opened member;
     - `skill-tree` off with a level 5 member, who has no Skill tree entry;
     - `skill-tree` on.

     The leaderboard entry and `leaderboard` always agree (WS55–WS57).
  2. **The commands** with `convex-test`, for `openFeature` (later `openQuestCrate`):
     - each denial writes nothing;
     - a ready feature opens and App Home's republish is scheduled;
     - a locked, unshipped or already open feature, and `unlocks` off, write nothing beyond what Slack's path writes;
     - a doubled call opens once.

     The same command through Slack's `receiveHomeClick` and through `openFeature` leaves the domain tables and events equal, compared as WS64 says (WS61–WS64, the D17 invariant). Also covered:
     - an unlaunched workspace with `unlocks` on refuses and launches nothing;
     - a flags key with no workspace key answers `closed` and writes nothing;
     - an already open feature with `unlocks` or `xp-levels` switched off answers `refused`, so no reveal plays.
  3. **The public surface test**, listing the new functions (WS64).
  4. **The quests read** (ticket 5) with `convex-test` on `main` after #129:
     - `getQuests` and `getMyProfile.journey` with `quests` off and on;
     - Quests locked, ready and open;
     - no draw, fewer than three quests, a slot in progress, finished and opened, and a swapped slot;
     - last week's finished, unopened crate listed in `waiting` after the Monday turn, and opened from there;
     - a finished Journey step and an opened one;
     - a website-first member with no stored activation, who still sees `first-thanks` active;
     - two members' `seen` keys for the same crate differ, and neither contains an ID.

     Each value equals the quests module's facts read directly (WS69–WS71).
  5. **The browser package** with Vitest and Testing Library, from typed fixtures:
     - the three card groups and their absence while `features` is `null`;
     - the nav;
     - the crate's label, `Opening…`, the reveal after `opened`, and no reveal after `refused`, a denial or an error, with `Open` re-enabled after an error;
     - seen state per `seen` key, two members in one browser, and `Replay`;
     - the ready pill sending the guarded command and revealing only after `opened`;
     - focus return on the home and on a ready page;
     - skip with Esc and Space;
     - reduced motion;
     - focus return and the live region;
     - the ready pill's count and its first crate;
     - the ready page in place on `/leaderboard`;
     - the Journey panel's three states;
     - the `/quests` page's states and empty state;
     - axe in light and dark for every state (WS58–WS75).
- **Proof each ticket owes:**
  - a red test before the change and a green one after;
  - `pnpm gate` green, with heavy runs through `~/dev/fleet/fleet heavy --`;
  - for a ticket that changes what the browser shows, screenshots of the running site in light and dark mode in its pull request, from a disposable local backend on its own ports with the flags on through a recorded local override, plus V24's manual pass;
  - for a command, a recorded run on that local backend that opens a ready feature on the website and shows App Home republished without the crate.

  Each proof ticket adds screenshots from the sandbox and a check that production's flags answer off.

## Slices

Each ticket is a sub-issue of map #57, sized to one agent session. Each merges into the conductor's integration branch for this slice (`spec/website-3`), never into `main` (WS27). The branch starts from `spec/website-2` once #137 has landed there, or from `main` if the second slice has shipped by then, and merges `main` as it moves.

Blocking edges (native on GitHub):
- #137 → #143
- #143 → #144
- #143 and #144 → #145
- #145 → #146
- #143 → #147
- #147 → #148
- #145 and #148 → #149
- #149 → #150

**Part A, the unlock path**
1. [#143](https://github.com/Silthus/kudos/issues/143) **The home's feature cards read their unlock state.** `getMyProfile.features`, `leaderboard` derived from it, the three card groups, and the nav of open pages. Coherence: *the website shows only shipped features*, *the website's feature states are Unlocks' facts*. WS55–WS60. Blocked by #137.
2. [#144](https://github.com/Silthus/kudos/issues/144) **The website's first command: open a ready feature.** `memberMutation` with its read-only flag read, `openFeature` behind WS55's gate and through D17 with App Home's republish, WS10's list, the Commands spec's summary, and the Coherence entrance and invariants (*website commands pass one guard*, *a website command never launches unlocks*, *a website command is a D17 command*, *opening on the website grants nothing*). WS61–WS64. Blocked by 1.
3. [#145](https://github.com/Silthus/kudos/issues/145) **The crate moment.** The crate on the home, the reveal dialog, seen state and Replay, the ready pill, and the ready page in place on `/leaderboard`. WS65–WS68, WS75. Blocked by 1 and 2.
4. [#146](https://github.com/Silthus/kudos/issues/146) **Prove the unlock path on the sandbox.** Merge `origin/main`, deploy the integration branch to `different-dog-467` (the first slice's rules 1 and 2 for the shared sandbox), and check there:
   - a member below level 3 sees `Unlocks at level 3`;
   - a ready member opens the Leaderboard on the website, and App Home drops its crate;
   - a grandfathered member sees it open;
   - production's flags answer off.

   Record screenshots in light and dark. Blocked by 3.

**Part B, quests** (each starts only once map #1's #129 has merged to `main`)

5. [#147](https://github.com/Silthus/kudos/issues/147) **The quests read.** `getQuests` with `waiting`, `getMyProfile.journey` with the website-first projection, the `seen` keys, and any additive export `convex/quests/` needs for WS70–WS71 (cross-map need 1). Coherence: entrance `query getQuests`, invariant *quests are invisible where they don't apply*. WS69–WS71. Blocked by 1, and by #129 cross-map.
6. [#148](https://github.com/Silthus/kudos/issues/148) **The Journey panel and the quests page.** The home's Journey panel, the Quests card's link, `/quests` with its cards, empty state and `How quests work`, and the nav item. WS72–WS73, WS75. Blocked by 5.
7. [#149](https://github.com/Silthus/kudos/issues/149) **Open a quest crate on the website.** `openQuestCrate` through D17, quest and Journey crates in the reveal, and the ready pill counting them. WS74–WS75. Blocked by 3 and 6.
8. [#150](https://github.com/Silthus/kudos/issues/150) **Prove quests on the sandbox.** As ticket 4, checking:
   - the Journey's first step, finished by a kudos that says why;
   - its crate opened on the website;
   - the week's quests with progress;
   - a finished quest's crate opened on the website and gone from App Home;
   - `quests` off in production.

   Blocked by 7.

## Cross-map needs on map #1

This spec edits nothing on map #1. Map #1's conductor reads these from #57.

1. **Quest facts for the website.** Ticket 5 needs, from the quests module as #129 ships it:
   - each weekly slot's progress (`done` and `target`), finish, crate opening, swapped state, and the `quest` value that opens its crate;
   - each Journey step's goal and hint copy, kept in the module and shared with App Home's Profile tab so the two can't drift (today it is feedback's `journeyGoals`);
   - a query-safe Journey projection that lists `first-thanks` as active for a member with no stored activation yet (P88), since activation is written only by a mutation today;
   - a read of every finished, unopened crate across weeks, with its goal, recorded reward and `quest` value (P85), for `waiting` and the ready pill.

   If #129 ships without some of these, ticket 5 adds additive exports in `convex/quests/` with App Home's output unchanged. Map #1's later quest lanes merge `main` and keep them. Map #1's conductor tells this map when #129 merges, so Part B starts.
2. **The website calls D17's commands.** `openUnlock` and `openQuestCrate` run through `runCommand` from the website's own entrance, as P73, P85 and the progression spec's *App Home and images* section already allow ("The website calls the same commands through its own entrance"). The Commands spec's summary names "every website command" beside App Home clicks and DM `Open`s. The website relies on each command's idempotence by state, not on Slack's idempotency key (WS63). Ticket 2 makes the wording change. It is additive and changes no behaviour.
3. **Republishing App Home after a website command.** Ticket 2 uses feedback's existing `republish`, as `receiveHomeClick` does, so App Home drops a crate the member opened on the website.
4. **O36 for website commands.** The website's reads send no exposure. Its commands send the exposure Slack's click sends, from the module's own code. Map #1's conductor records this reading.
5. **Order of the production switches.** #105's recommended order (`everyone-board`, then `xp-levels`, then `unlocks`) still holds. The website adds only that `website` follows them, and `quests` follows #129.

## Out of Scope

- Game rules in the website: it reads facts and sends commands (#57).
- Swapping a quest on the website (P81). It stays in Slack's App Home for now.
- The group quest (P82), which map #1's first quests slice doesn't build, and bonus quests, which the progression spec of record doesn't have.
- The Journey's own hedgehog (P90), coins and items in rewards (P75, P86), and the Coins, Book and Hedgehogs features, which haven't shipped.
- A skill tree page, skill points and perks on the website (WS51 still holds).
- Level-up and achievement band pages (V12), and deep links from Slack's DMs into a crate on the website.
- A quest summary on the home beyond the link card.
- Everything #57 rules out of scope.

## Further Notes

Calls taken at recommendation under the AFK directive:

1. **Every shipped feature's card becomes live**, from Unlocks' `unlocksOf` and schedule, because P79 gives the website exactly those facts. That is the Leaderboard today, the Skill tree when `skill-tree` ships, and Quests with #129. Unshipped features disappear while unlocks apply (P78), which overrides WS19's six plain cards there. While unlocks don't apply, WS19 stands.
2. **Opening happens on the website**, not as a link to App Home. P73, P85 and P92 name the website as a place to open and give it the reveal. Opening grants nothing, so the first web command carries the least risk any command could. It goes through D17's own `runCommand`, so Unlocks and the quests module stay the only deciders.
3. **No new flag.** The website's commands ride the flags that gate the same `Open` in Slack, plus `website`. A separate `website-commands` flag was rejected: it would let the website show a crate Slack can open but the website can't, and production is dark behind `website` anyway.
4. **No idempotency key for website commands**, because both commands are idempotent by state.
5. **The reveal waits for the server**, so a crate never shows something Unlocks didn't record (V13).
6. **Locked cards and the nav tease nothing:** no "levels to go", no locked nav items (V23, P78).
7. **The Journey lives on the home**, apart from the week's quests (#85: "The Journey shows separately"), because its first step is active from level 1, before Quests opens.
8. **Swap stays in Slack** for this slice. It is a one-way choice that deserves its own confirmation design, and its command is still landing on map #1's lane (#123).
9. **Quest copy is the module's**, never a website copy table. Where #129 lacks a fact, an additive export in `convex/quests/` supplies it, the way #133 added `rankedBoardOf`.
10. **Two parts**, so the unlock path ships without waiting for #129, and quests can't reach a branch before their data does.
11. **The prototype's copy is corrected** for P85 (`Open`, not "Claim") and P95 (no "thoughtful"). Its group quest, bonus quests, reroll link, flying reward chips and loops are dropped.
12. **Proof tickets per part** (4 and 8), because the sandbox is shared and each proof needs its own deploy, and the parts can ship apart.

The `to-spec` and `to-tickets` skills can only be started by a human, so this spec follows the earlier slices' layout instead.

**Review.** One read-only GPT-6.1 Sol (high) review found 16 issues, 5 of them blockers, and all 16 are fixed in this revision:
- The command guard reads the flag read-only, because the seam writes a missing workspace key inside a mutation.
- Commands check WS55's or `questsApplyIn`'s gate before D17, so a website call never runs Unlocks' launch, and `opened` needs the gate as well as the post-state.
- The ready pill sends the same guarded command.
- Earlier weeks' finished crates stay openable through `waiting`.
- The two parts' fallback for the Quests card is stated.
- The write invariants separate domain effects from exposure and republish, and the Slack comparison excludes its receipt.
- A website-first member sees the first Journey step.
- Denials and errors end `Opening…`.
- Focus returns to the page title on ready pages.
- Seen state is per member, through an opaque key.
- Quest crates carry their reveal identity.
- Ticket 6 shows a Slack fallback until ticket 7.
- The home keeps thanking as its one primary action.
- `See this week's quests` shows only while Quests is open.
- `getQuests` is on WS64's list.
