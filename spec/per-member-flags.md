# Spec: per-member feature flags, with member email in PostHog

> **Accepted on 2026-10-14 under Michael's autonomous build-and-ship authority** (map [#1](https://github.com/Silthus/kudos/issues/1) Notes: "accept the spec automatically once it's written"), with every call at its recommendation (listed under "Further Notes"). Ticket [#195](https://github.com/Silthus/kudos/issues/195). This file lives on the branch `docs/per-member-flags` and is never merged. Its implementation tickets are sub-issues of #195 on the integration branch `spec/per-member-flags`, shipped by one ship ticket.
>
> A GPT-6.1 Sol review found 13 issues (1 blocker); all were fixed before publishing ("Review" under "Further Notes").
>
> **Amended on 2026-10-14 by Michael's decision 15** (quoted under "Further Notes", Coherence `d-84e4cabe`, ticket [#198](https://github.com/Silthus/kudos/issues/198)): PostHog's person for a member carries their whole profile, not only `email` (F7, F8, F10, F11, user story 10).
>
> Sources: Michael's decision (map decision 14, quoted under "Further Notes"), the PostHog spec ([#69](https://github.com/Silthus/kudos/issues/69), [`spec/posthog.md`](https://github.com/Silthus/kudos/blob/docs/spec-posthog/spec/posthog.md), O7–O10 and O25–O36), the flag seam and every flag declared on `main` at `980210e`, the unlocks launch (P77) and the Journey join (P91), the record-dark calls of the XP and Everyone board gates (Coherence `d-0eb89fc6`), the Slack directory, the website's flag and sign-in (WS rules on `docs/spec-website`), and map decisions 11, 13 and 14.

## Problem Statement

Michael can switch a HedgeHug feature on for a whole environment, and nothing smaller. Every flag (`xp-levels`, `everyone-board`, `unlocks`, `quests`, `skill-tree`, `website`) is evaluated with the workspace as its subject, and PostHog only learns the deployment's `environment`. So the first person to see XP and levels, the boards, quests or the website in the real workspace is everyone. Michael wants a preview list: turn a feature on for himself and a few named colleagues in production, straight from PostHog, try it for real, and only then turn it on for everyone. PostHog can't name a person today, because HedgeHug sends it nothing that names one.

## Solution

HedgeHug learns each member's email from Slack, keeps it in the directory, and sends it to PostHog as the person property `email` of the member's analytics ID, beside the rest of their profile (name, display name, title, Slack IDs, whether they are an admin, their teams). These person properties are the only identifying data PostHog ever receives, and they never ride on an event. Every member-facing flag is then evaluated for the member who would see it, with `environment` and `email` as person properties, so a PostHog release condition `email = someone@example.com` turns a feature on for that one person.

A flag now has two answers. The **member decision** answers for one member and decides everything that member sees or does. The **workspace decision** answers for the workspace and decides only what is shared: what a channel shows, what a person HedgeHug doesn't know sees, and the moments that happen once for the whole workspace (the unlocks launch, the Journey launch). A member who is on while their workspace is off is **previewing**: they see the feature as everyone will, and nobody else sees, receives or earns anything because of it.

When a member leaves the workspace, their profile leaves the directory and PostHog's person; when Slack stops giving their email, the email does.

## User Stories

**Previewing**
1. As Michael, I want to turn a feature on for named members by their email in PostHog, so that I can try it in the real workspace before everyone sees it.
2. As Michael, I want a member I add to a flag's email condition to see the feature at their next App Home open, command, DM or website visit, so that a preview starts without a deploy.
3. As Michael, I want removing a member from the condition to hide the feature from them again without taking away anything they earned or opened, so that a preview is safe to end.
4. As a previewing member, I want the feature to behave as it will for everyone (my level, my boards, my unlocks, my quests, my Journey), so that what I test is what ships.
5. As a member who isn't previewing, I want nothing to change for me while someone else previews: no tab, no DM, no public notice, no reward, no earlier or later unlock, so that a preview is invisible to me.
6. As Michael, I want the existing `environment = sandbox` conditions to keep working unchanged, so that the sandbox stays on and production stays dark until I say otherwise.
7. As Michael, I want switching a flag on for everyone to work exactly as it does today, including the unlocks launch and the Journey launch, so that per-member previews add a step and remove none.
8. As Michael, I want exposures counted per member and value, so that I can see who saw which value of a flag.

**Email in PostHog**
9. As Michael, I want each member's email on their PostHog person, so that I can find a member and target them in PostHog's flag editor.
10. As Michael, I want each member's PostHog person to carry their profile (email, name, display name, title, Slack user and team ID, whether they are an admin, their teams), so that I can filter and analyse by person and by team in PostHog. As a member, I want what I wrote never to reach PostHog, so that analytics never reads my kudos.
11. As a member, I want my email never to appear in an event's properties, an error or a log line, so that only the person profile holds it.
12. As a member, I want PostHog to follow when my Slack email changes, so that a preview condition keeps meaning me.
13. As a member who leaves the workspace, I want my email removed from HedgeHug and from my PostHog person, so that it doesn't outlive my membership.
14. As Michael, I want emails sent only while capture is on, so that a local run, a test or a half-configured deployment sends nothing.

**The website**
15. As a previewing member, I want to sign in to the website and use it while it is dark for everyone else, so that the website can be previewed like any other feature.
16. As a member or visitor who isn't previewing, I want the website to look exactly as closed as it does today while it is dark, so that nothing leaks early.
17. As a previewing member, I want App Home's website link to show for me alone, so that I can get there from Slack.

**Operating**
18. As Michael, I want to re-paste the app manifest once and run one backfill to get every existing member's email, so that previews work for the whole workspace on day one.
19. As Michael, I want the ship's handoff to show me how to add an `email` condition to a flag, so that I can start a preview without reading code.
20. As a developer, I want one seam that gives the member decision and the workspace decision of any flag, so that a new slice picks the right one without a new mechanism.

## Rules

Each rule is a testable statement; tests cite it (`F7`). Core loop rules are cited as `R12`, progression and unlock rules as `P77`, PostHog rules as `O34`, website rules as `WS10`.

### Email in the directory

- **F1. The directory keeps a member's email.** A member's directory entry holds the email Slack gives for them (`profile.email`), when Slack gives one. A bot, a person from another workspace and a person who is not a member have no email in the directory. A member without an email is a member as before: nothing in the core loop reads it.
- **F2. Slack keeps it fresh.** The email is taken from every place the directory already learns about a member: `users.info` (unknown people and the refresh on App Home opening), `team_join` and `user_change`, with the directory's existing newest-wins ordering. A changed email replaces the old one; an answer without an email removes it.
- **F3. Backfill.** One internal action pages through `users.list` and writes each known member's email (adding a missing one and replacing a changed one, never touching a person the directory doesn't know). It is safe to run again, and the ship runs it once after the manifest gains the scope.
- **F4. The scope.** Both app manifests (sandbox and real) gain the bot scope `users:read.email`. Slack sends `profile.email` only with it; without it, F1–F3 store nothing and every rule below behaves as for members without an email.
- **F5. Leaving drops it.** When a member stops being a member (the directory publishes `memberLeft`), their entry keeps no email. A member who rejoins gets it back from Slack like any other change.
- **F6. Email-bearing answers are never logged.** Every path that reads a Slack answer that can hold an email (`users.info`, `users.list`, `team_join`, `user_change`) logs only a fixed code and allowlisted fields (O25), never the answer, a parse error's text or an error that quotes it.

### Email in PostHog (amends O7, O10 and O12)

- **F7. The person profile.** O10 is amended: a member's profile is sent to PostHog as the person properties of their analytics ID, and nowhere else:
  - `email`, `name` (Slack's real name), `display_name` and `title`, each when the directory holds it;
  - `slack_user_id` and `slack_team_id`;
  - `is_admin` (a workspace admin or owner);
  - `teams`: the handles of the member's user groups that the directory keeps members for, sorted, when they are in any;
  - `environment`.

  None of them appears in a product event's properties, an exception, a log line or a log export, and they ride only in F8's person events. The rest of O10 stands: message text, mentions, avatars, time zones, emoji names, Slack bodies, secrets and Convex document IDs stay never-sent, and channel, message and thread IDs too. O7 is amended only so far: the analytics ID is still never derived from the profile, and F8's person events are the only ones that carry both.
- **F8. PostHog's person follows the directory.** While capture is on (O26), whenever a member's profile (F7) differs from the last one recorded for their analytics ID, the analytics module records one person event in the outbox, with O2's properties and no others: `$identify` with `$set` of every key the profile has, the first time; `$set` with `$set` of every key it has and `$unset` of every key it lacks, when anything changed. A key goes away when Slack stops giving it (F2), and a member who left (F5) keeps only `environment`, so leaving unsets every identifying key. A repeated profile records nothing; a change back to an earlier one is a change. Each is recorded by a job that the mutation creating the analytics ID, changing the directory or changing a user group's members schedules for the people it touched (one shared job for every analytics ID still waiting for its first) (O13's durability, without a profile read weighing on a domain mutation); the job reads within a budget and hands the rest to the next one. Only a person event that carries its analytics ID's current fingerprint is sent or retried, so a released or retried older one never lands after a newer one, and one a drain sent after losing its claim has the current profile recorded again, so PostHog never ends on an older profile.
- **F9. Catching up.** A daily pass, after the daily user group sync, and the backfill (F3), record the person event missing for every analytics ID whose last recorded profile differs from the directory's, including members who left while capture was off, so PostHog converges within a day of capture being on. A user group renamed while it keeps members runs the pass too. A person event that is given up (O19: rejected, exhausted or expired) clears what was recorded for its analytics ID, so the next pass records it again.
- **F10. What leaving removes.** Leaving removes the email and every other identifying key from the member's PostHog person (F8), and so from flag targeting and PostHog's person list. Deleting the person and their events from PostHog, which also removes any copy of the profile PostHog kept with events ingested while it was set, is data deletion and stays with "Operating it" on map #1 (it needs a key with person-write scope).
- **F11. O12 is amended:** besides the numbers, booleans and fixed values a taxonomy addition lists, a member's person may hold F7's profile keys, and only through F8.

### Two decisions per flag (amends O33 and O34)

- **F12. A flag no longer has one subject.** O33 is amended: a flag is declared once with its key, its values and its safe default, and the seam answers it two ways. The **member decision** evaluates it with the member's analytics ID as distinct ID and the person properties `environment` and, when the directory holds one, `email`. The **workspace decision** evaluates it with the workspace key as distinct ID and `environment` only. Both keep O33's safe defaults: no key, no cached definitions, an undeclared value or a condition local evaluation can't answer gives the safe default, and reading never throws.
- **F13. Allowed targeting.** O34 is amended: a release condition may use rollout percentage, `environment` and `email`. An `email` condition never matches the workspace decision, and never matches a member without an email in the directory. Cohorts, experience continuity and other properties stay out, because local evaluation can't answer them.
- **F14. A member without an analytics ID.** In a query, the member decision for a member who has no analytics ID yet answers the workspace decision (a query can't create the ID). A mutation creates the ID, as today.
- **F15. Nothing changes until a condition names someone.** With only `environment` conditions at 100% rollout (every flag in PostHog today), the member decision equals the workspace decision for every member, so every surface, launch and exposure value is what it was before this spec.

### Which decision decides what

- **F16. What one member sees or does follows the member decision.** Every App Home section, tab and click, every command reply, ephemeral reply and DM to one member, every website page for a signed-in member, every button they press (open an unlock, swap a quest, open a crate) and every exposure is decided by the member decision of the member it is for, except what F18 and F19 give the workspace decision.
- **F17. What one member gets follows the member decision.** Writes that concern one member and depend on a flag are decided by that member's decision: whether a feature has shipped for them (the ship flags behind the unlock schedule), readiness stored by a level up or the ship sweep (P78), weekly quest draws, quest progress and finishes, swaps, crate openings and Journey steps. A member who isn't previewing earns, draws and opens nothing because someone else previews. Recording that never depends on a flag stays as it is: XP and levels are recorded dark (`d-0eb89fc6`), and readiness is stored whatever the unlocks flag says (P72). What a preview paid a previewing member (quest and Journey rewards, their XP) is theirs for good (ADR-0002), and shows wherever their level shows.
- **F18. What a channel shows or the workspace shares follows the workspace decision.** A public reply or notice that everyone in a channel sees (the public level notice, any public line a later slice adds) shows a flagged section only when its flag is on in the workspace decision, even when the member it is about is previewing; a level reached through a reward (a quest, a Journey step) is announced in public only when the rewarding feature is on in the workspace decision too. A setting the whole workspace shares (the announcement channel, any later workspace setting) is shown and changed only when its flag is on in the workspace decision, so a previewing admin can't change it. A preview never shows in a channel and never changes what other members get.
- **F19. A person HedgeHug doesn't know follows the workspace decision.** A viewer who isn't a member in the directory (an unknown clicker, the unlock filter for an unknown viewer, an unknown `/hedgehug leaderboard` caller) gets the workspace decision, as today.
- **F20. Dependencies are per decision.** A feature that needs another (quests need XP and levels and unlocks; the unlock schedule needs each ship flag) is shown to a member when every flag it needs is on in that member's decision, and is live for the workspace when every flag it needs is on in the workspace decision. A member decision never mixes in another flag's workspace decision.

### Workspace moments and previews

- **F21. Workspace moments follow the workspace decision.** The unlocks launch (P77) and the Journey launch with its join of members who existed then (P91) happen at the first mutation that sees their flag on in the workspace decision, as before, with the features shipped in the workspace decision then. A preview never starts, moves or repeats them.
- **F22. A preview gets the moment alone.** The first mutation that shows unlocks to a previewing member (in Slack or on the website) opens, for that member alone, every feature shipped in their member decision then, at that moment and without a DM, as P77 does for a member who existed at the launch. The first mutation that shows quests to a previewing member joins that member alone to the Journey, as P91 joins a member who existed at the Journey launch. Each is stored once per member and moment and never repeats. A query never runs it: until a mutation has, a website page shows the member's stored facts as they are.
- **F23. The workspace moment later adds only what is missing.** When the workspace moment comes, it treats a member who previewed like every other member who exists then, fact by fact: an opening they already have keeps its first `openedAt` and a Journey step they already have keeps its activation and pays nothing again, while a feature or step that became due since their preview is added as for everyone else. It publishes and sends nothing for a fact it didn't add.
- **F24. Ending a preview takes nothing away.** When a member's condition is removed, the member decision turns off and they are shown nothing of the feature, exactly as when a workspace flag turns off today. Everything they earned, opened or finished stays, and shows again with the same times if they are added back or the feature goes on for everyone (ADR-0002, ADR-0006).

### Exposures (amends O36)

- **F25. Exposures are per member decision.** `$feature_flag_called` is sent once per member, flag and value of their member decision, from the mutation in which they first enter the flagged path (O36 as before), so a previewing member's exposure carries `true` while everyone else's carries `false`. The workspace decision is never an exposure, and a query never sends one.

### The website's flag

- **F26. Signing in.** The sign-in callback admits a person when the `website` flag is on in the workspace decision, or when the directory knows them as a member and it is on in their member decision. Anyone else is refused as when the website is closed. The admitting mutation sends the member's `website` exposure and runs their due preview moments (F22).
- **F27. Reading.** A visitor without a live session gets what they get today: `closed` while the workspace decision is off, the sign-in page when it is on, so the closed website looks the same to everyone until a condition names someone (F15). A signed-in member whose `website` member decision is off is answered `closed`. Every page and command of a signed-in member decides its flags by that member's decision (F16).
- **F28. The way in for a previewer.** App Home shows the website link to the member whose Home it is when the `website` flag is on in their member decision. While the workspace decision is off, that link leads to an entry that starts Sign in with Slack directly, so a previewer never needs a sign-in button on the closed page.
- **F29. Sessions from before a preview.** A member who was signed in before their preview began sends their `website` exposure and runs their due preview moments at their next website command (a mutation), since website pages are queries.

## Implementation Decisions

### Modules

- **Slack adapter (extended).** The Slack user it reads gains `profile.email`; its directory entry for a member carries `email` when Slack gave one (F1, F2). It gains the backfill action over `users.list` (F3), paging like the existing name fill. Both manifests gain `users:read.email` (F4); the manifest test pins it. The `users.info` failure log stops printing the error and the user ID (F6).
- **Workspace directory (extended).** A member entry and row gain an optional `email`. Recording an entry whose email differs from the stored one, including a member leaving or an email disappearing, tells the analytics module in the same mutation (F5, F8). It stays the only owner of the email; no other module stores a copy.
- **Analytics (extended).** Records the `$identify` and `$set` person events in the outbox (F8) and remembers, per analytics ID, a one-way fingerprint of the profile last recorded (or that none is), never the profile itself, so a repeated profile records nothing. It reads the profile from the directory and the member's user groups (F7). Giving up a person event clears that fingerprint (F9). A daily cron runs the catch-up pass (F9). The flag seam gains the two decisions (F12–F14).
- **Each flag's module (changed).** `xp-levels`, `everyone-board`, `unlocks`, `quests` and the ship flags move their member-facing reads to the member decision and keep the workspace decision only where F18, F19 and F21 say. The public level notice learns whether a reward reached the level and which feature paid it (F18). The Admin tab's shared settings and the `/hedgehug` command that changes the announcement channel ask the workspace decision (F18). Unlocks and quests gain the preview moment and add only missing facts at the workspace moment (F22, F23).
- **Website (changed, by the website map).** F26–F29. See "What changes for the website map" below.

### The seam (sketch)

```ts
type Flag<V extends string | boolean> = { key: string; safeDefault: V; values: readonly V[] };
function memberDecision<V>(ctx: QueryCtx | MutationCtx, flag: Flag<V>, member: MemberId): Promise<V>;     // F12, F14
function workspaceDecision<V>(ctx: QueryCtx | MutationCtx, flag: Flag<V>, workspace: string): Promise<V>; // F12
function exposed<V>(ctx: MutationCtx, flag: Flag<V>, member: MemberId, value: V): Promise<void>;           // F25, unchanged
```

The member decision reads the member's email from the directory and passes `{ environment, email }` as person properties; a member with no email passes `{ environment }` only, which makes an `email` condition inconclusive in the component's local evaluator, so it falls through to the flag's other conditions and otherwise to the safe default (F13). Each module keeps its named helpers (`xpLevelsShownTo`, `questsShownTo`, `unlocksShownTo`, ...) and changes what they ask; callers that need the workspace decision say so by name (for example `unlocksLaunchIn`, `publicSectionsShownIn`).

### Previews (sketch)

The preview moment is one stored row per member and moment, written in the mutation that first shows the feature to a member whose workspace decision is off. For unlocks it opens, with `byLaunch: true` and no DM, the features shipped in the member's decision (the existing `keepOpen` is already idempotent per feature). For quests it runs the existing single-member Journey join for that member. The workspace moments keep their stored launch rows; their per-member work (opening each shipped feature, activating each Journey step) already skips a fact that exists, and the Journey's join of existing members must also include a member created before the launch who previewed, adding only their missing steps (F23).

### Data (sketch)

`members.email` (optional, member rows only); `analyticsIds` gains the fingerprint of the last profile recorded; `previewMoments` (member, moment: `unlocks` or `journey`, at). None of them holds O10's other data. No new environment variable.

### No gate ticket

Nothing changes for any member until a release condition names someone (F15): the member decision equals the workspace decision under `environment` conditions at 100%, the preview moments only run when the two differ, and capture already decides whether anything reaches PostHog. The emails themselves are what Michael asked to send. So the plan adds no flag. The ship proves F15 by reading every flag in PostHog project 662840 before it deploys: each must have only `environment` conditions at 100% rollout, or the ship stops and says which flag differs.

### What changes for the website map (#57)

The website's backend lives in `convex/website/` and is the website map's. Its follow-up graduates from this spec's ship, against `main` as of website slice 3 (`980210e`):

1. **Sign-in** (`signIn.ts`): resolve the identity and look the person up before deciding, then admit by F26; send the `website` exposure and run the member's due preview moments in that mutation.
2. **The guard** (`memberQuery.ts`, `websiteOpenWithoutWriting`): without a session, answer as today (F27). With one, run session, workspace and directory first, then answer `closed` for a verified member whose `website` member decision is off. The WS rule "while closed, every read answers closed" becomes this order.
3. **Guarded commands** (`memberMutation.ts`, `commands.ts` `openFeature`): the same guard, plus F29 (exposure and due preview moments for a session from before the preview) before the command runs, so a previewer's Open works and a non-previewer's still refuses without writing.
4. **Reads** (`profile.ts`, `unlockPath.ts` `unlockPathShownIn`, `leaderboardStateOf`, `featureCardsOf`): `xp-levels`, `everyone-board` and `unlocks` by the signed-in member's decision (F16, F20), including the unlock path's dependency on the unlocks launch, which becomes "the member has their launch or their preview moment".
5. **The link** (`link.ts`, App Home): by the Home member's decision, pointing at the direct sign-in entry while the workspace decision is off (F28).
6. **Exposure**: the `website` flag now sends exposures (F25), replacing "a workspace-wide surface flag sends no exposure".
7. **Until then**, the website keeps the workspace decision and keeps working: this spec's ship changes no `convex/website/` function except where a helper it calls is renamed, so a previewing member sees the website only when it is on for the workspace.

## Testing Decisions

- **A good test enters at a seam and checks what a member or Michael could observe**: the Slack calls and views HedgeHug makes for two members in one workspace, the rows another function reads, and the requests PostHog receives. It never mocks the seam: flag definitions are served by the fake PostHog's definitions endpoint and evaluated by the real component, as the existing flag tests do.
- **Seams, highest first:**
  1. **The Slack boundary** (signed requests through the HTTP router with `convex-test`, the `fetch` stub answering Slack and PostHog): an `email` condition naming one of two members shows the feature to that member alone in App Home, commands, DMs and replies; the other member's Slack calls are byte-for-byte what they are with the flag off; a public level notice stays plain, also for a level a previewed quest reward reached; a previewing admin can't change the announcement channel (F16–F20, F15 for the unchanged case). `user_change`, `team_join` and `users.info` with and without `profile.email`, a malformed answer, and a member leaving (F1–F6).
  2. **The analytics module's functions**: the seam's two decisions with an `email` condition, a member without email, a member without an analytics ID in a query, and the workspace decision never matching `email` (F12–F14); `$identify`, `$set` and `$unset` recorded once per change through the outbox and the drain, nothing with capture off and the catch-up afterwards, a given-up person event recorded again, and never a profile key in any other event, exception or log (F7–F9, extending the existing O10 test that scans every PostHog request body).
  3. **The unlocks and quests modules**: the preview moment for a previewing member, the workspace moment afterwards adding only a feature or Journey step that became due since, a member who isn't previewing earning, drawing and opening nothing, and a preview ending (F21–F24).
- **Prior art:** `convex/analytics/flags.test.ts`, the `*Flag.test.ts` files in `convex/slack`, the P77 test in `unlocksFlag.test.ts`, `quests/existingMembers.test.ts`, the fake PostHog and its flag fixtures in `testing/`, and the directory tests behind `unknownPeople.test.ts`.
- **Invented addresses only.** Every test and proof uses addresses under `example.com`. No real email appears in a test, a fixture, a commit, a pull request or an issue.
- **Sandbox proof** is an acceptance criterion of the ship, recorded without any email: with an `email` condition naming the sandbox's test member, that member sees the feature and a second member doesn't, and PostHog's person for the first member shows the property (checked by the worker, not pasted).
- **The gate** (`pnpm gate`) is green on every ticket. The analytics component spec's invariant "only allowlisted properties leave the deployment" gains its email clause (F7) with a witnessed refutation.

## Out of Scope

- **Group targeting.** Targeting a Kudos group by its key needs group analytics (O9, O30), still off.
- **Rollouts below 100% with workspace moments.** A percentage buckets each member by analytics ID and the workspace by its key, so the two can differ in either direction. The handoff recommends `email` conditions for previews and 100% for switching on.
- **Remote evaluation.** Every flag still evaluates locally; PostHog's stored person properties are never read back.
- **Deleting a leaving member's PostHog person and events, and the rest of their HedgeHug data** (awards, XP, analytics ID). It stays with "Operating it" on map #1 (F10).
- **A sign-in button on the closed website page.** A previewer comes in through App Home's link (F28).
- **Experiments.**

## Further Notes

**Michael's decision** (2026-10-14, in map #1's conductor thread, verbatim): "And for the preview list, please do send member mail addresses to PostHog so we can enable flags on a per-user basis, not just on a per-workspace basis, directly in PostHog." It amends O10 (F7), O12 (F11) and O34 (F13). Coherence records it as `d-95bd1bd3`, and the calls below as `d-c540549c`, `d-fbf026bf`, `d-78653214`, `d-54f92e49`, `d-bd597104`, `d-6cd17786`, `d-681c4915`, `d-f44f6457`, `d-9e9b6a20`, `d-fde0c1df` and `d-c0674c41`, each citing it.

**Michael's decision 15** (2026-10-14, in map #1's conductor thread, verbatim): "Please make sure that you add name, mail, and so on to the people properties, and their Slack user ID and also teams, so we can properly filter, get some analytics data going, and so on." It widens F7 from `email` alone to the whole profile, and with it F8, F10, F11 and user story 10; message text stays never-sent, and event properties stay as they are. Coherence records it as `d-84e4cabe`.

**Calls this spec makes (accepted with it, each at the recommendation)**
1. **Two decisions, not one subject per flag** (F12). The member decision decides all member-facing behavior; the workspace decision decides only shared things. Over moving every flag to the member subject alone, which would let a preview start the unlocks and Journey launches for the whole workspace and pay hidden members Journey rewards.
2. **A preview changes nothing for anyone else** (F16–F18, F21): per-member writes follow the member decision, channels and workspace moments follow the workspace decision. Over running workspace mechanics when any member is on, which writes and rewards dark for members who aren't previewing.
3. **A previewing member gets the workspace moment alone** (F22, F23), so a preview of unlocks keeps what P77 keeps and a preview of quests includes the Journey. Over showing previewers the feature without the launch's openings or the Journey until the workspace switches on, which would make a preview test something other than what ships.
4. **Public channel content follows the workspace decision** (F18). Over following the member it is about, which would announce a preview in a channel.
5. **PostHog's email converges to the directory's** (F8, F9): `$identify` once, `$set` on a change, `$unset` when it goes away, through the outbox, with a fingerprint of the last recorded value and a daily catch-up that also repairs given-up events. Over adding `email` to every event (which F7 forbids), `$set` on every event, or a once-per-value rule that would never resend a lost update.
6. **The member decision passes the email from the directory as a person property** (F12), because local evaluation never reads PostHog's stored person; sending it to PostHog is for finding and naming members there.
7. **A member without an email is evaluated without it** (F13), so an `email` condition never matches them and other conditions still do. Over sending an empty string, which would make `is not set` conditions behave differently from PostHog's own persons.
8. **A query falls back to the workspace decision for a member without an analytics ID** (F14). Over the safe default, which would hide a feature that is on for everyone from a member who has never had an event.
9. **Leaving unsets the email on the person; deleting the person and their events stays with "Operating it"** (F10). Over deleting the person here, which needs a person-write key, deletes all their history, and breaks a rejoin that reuses the analytics ID (PostHog refuses a deleted distinct ID until it is reset).
10. **No gate flag** (F15): the change is infrastructure and nothing changes until a condition names someone. The ship proves it by reading every flag's conditions before deploying.
11. **The website keeps its workspace decision until the website map graduates** (F26–F29 are the website map's work), and the closed page stays as it is: a previewer enters through App Home's link, which starts sign-in directly (F27, F28). Over answering `signed-out` to every visitor, which would show production's dark website a sign-in page before anyone previews.
12. **The backfill is one rerunnable action** (F3), run by the ship after the manifest re-paste. Over a recurring sweep, since `user_change` keeps emails fresh afterwards.
13. **Shared workspace settings follow the workspace decision** (F18), so a previewing admin can't move the announcement channel. Over letting the Admin tab follow the member decision, which would let one preview change every member's notices.
14. **A reward-reached level is announced only when the rewarding feature is on for the workspace** (F18). Over announcing it by `xp-levels` alone, which would reveal a quests preview in the announcement channel.

**Review.** A GPT-6.1 Sol review of the first draft found a blocker (a previewed quest reward could reach a level announced in public; now F18) and 12 majors, all fixed: the person deletion broke a rejoin and needed a new key (dropped, F10); the preview's workspace moment skipped facts that became due since (F23 adds them); leaving or losing an email while capture was off had no cleanup (F8, F9); a fingerprint advanced before delivery could suppress an email for good (F9); a Slack parse error could log an email (F6); a previewing admin could change the announcement channel (F18); a website-only preview couldn't run its moments or exposures (F26, F29); the website handoff predated slice 3 (refreshed); answering `signed-out` to every visitor broke F15 (F27, F28); and the PostHog deletion facts were wrong (moot with F10).

**Changes to earlier specs**
- **PostHog (#69):** O7 (the analytics ID is sent with an email in F8's events only), O10 (F7), O12 (F11), O33 (F12), O34 (F13), O36 (F25). O26 is unchanged: nothing is recorded while capture is off, and F9 catches up afterwards. The flags stopping point's seam sketch gains the two decisions.
- **Unlocks (P77) and quests (P91):** the moments stay workspace moments (F21) and gain the preview moment (F22, F23). P72 and ADR-0006 are unchanged.
- **Website (WS rules, map #57):** see "What changes for the website map".

**Vocabulary to settle in Coherence** (each in the ticket that first uses it): **member decision**, **workspace decision**, **preview** (a member whose member decision is on while the workspace decision is off) and **preview moment**; amend **flag** (no fixed subject), **analytics ID** (sent with an email in person events only) and **directory** (holds a member's email).
