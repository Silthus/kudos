# Spec: the sticker book: stickers of teammates and group albums in the Book

> **Accepted on [#54](https://github.com/Silthus/kudos/issues/54) (2026-10-16) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/sticker-book` and is never merged. It answers the product owner's "It's both" (map #1, decision 27) and re-specs the groups spec's stopping point 4 (G31–G36, G46) to fit inside today's Book, which became a collection with decision 25. The build runs on the integration branch `spec/sticker-book`, which the conductor cuts from `main`.
>
> **Rule numbers.** Rules are cited as `SB1`–`SB27`. Collection rules are cited as `CL15`, groups rules as `G31`, progression rules as `P58`, achievements as the Achievements component spec says them.
>
> **Two stopping points.** 1 (SB1–SB17) is stickers and group albums in the Book, behind `sticker-book`. 2 (SB18–SB26) is completed albums and the Team Spirit ladder, behind `team-spirit`. Stopping point 2 starts once stopping point 1 is on `main`. SB27 holds for both.
>
> Sources: ticket #54 and its amendment from #86; map #1's decisions 12, 18, 22, 25, 26 and 27; the groups spec (`spec/groups.md` at `662ec98`: G2, G4, G5, G31–G36, G44, G46); the collection spec (`spec/collection.md` on `docs/collection` at `4143cd7`: CL13, CL15, CL22–CL26, CL33); the code on `main` at `99854ab` (`convex/hoggies/` `collection.ts`; `convex/website/` `collection.ts`, `book.ts`, `faces.ts`, `seen.ts`; `convex/groups/` `groups.ts`, `reconcile.ts`; `convex/achievements/` `ladders.ts`, `tierEmoji.ts`; `convex/store/catalogue.ts`; `convex/bus/publish.ts`; `convex/activity/activityFlag.ts`; `convex/schema.ts`); the Hoggies, Achievements and Groups component specs; and the lexicon's `sticker`, `sticker book`, `crest`, `roster` and `group`.

## Problem Statement

The Book is a collection now: every crate drops a hoggie, and a full roster of hoggies collects a team crest. None of it has anything to do with the people a member thanks. Kudos is about colleagues, yet the place where members collect things doesn't show who they've thanked, who thanked them, or how far they've reached across the company.

The groups spec designed a private sticker book of people with an album for every Slack user group and a Team Spirit ladder. Decision 25 shelved it for crests. The product owner, 2026-10-16: "The sticker album was the idea that you can collect these hockeys and so on, but you can also collect teams and team members, right? It's both, so start that, please."

## Solution

**The Book collects people too: a sticker of every teammate you thanked or who thanked you, and an album for every group to fill.**

- **Stickers.** A member holds one sticker of each colleague they gave a kudos to or got one from, chime-ins and every kudos before this ships included. One per person, kept forever.
- **Group albums.** Every group (a Slack user group that counts for Kudos) is an album in every member's Book, their own groups and every other one, showing which of its people the member holds and how many are left.
- **One Book.** Stickers and group albums join the hoggies and team crests in the Book's collection, through the same read. Team crests are PostHog teams of hoggies you find in crates; group albums are your workspace's Slack groups of people you thank. The Book names them apart.
- **Private.** Only the member sees their own stickers and albums.
- **Team Spirit (stopping point 2).** An album is complete once the member holds a sticker of every other person in the group, and it stays complete. The Team Spirit ladder counts completed albums: 1, 2, 4 and 8.
- **Dark first.** Each stopping point ships behind its own member-decision flag, on in the sandbox and for the product owner's email only (decision 18).

## User Stories

**Stickers**
1. As a member, I want a sticker of every colleague I've thanked, so that I can see my web of thanks grow.
2. As a member, I want a sticker of every colleague who thanked me, so that being thanked counts as a connection too.
3. As a member, I want kudos from before the sticker book existed to count, so that my history isn't wasted.
4. As a member, I want a chime-in to count like a kudos message, so that every way of thanking connects us.
5. As a member, I want one sticker per person however often we thank each other, so that the book counts people, not kudos.
6. As a member, I want to keep a sticker after that person leaves the workspace, so that I never lose what I collected.
7. As a member, I want to see when I got each sticker, so that I can remember when we first connected.
8. As a member, I want new stickers marked new in the Book, so that I notice them the way I notice new hoggies and tiers.
9. As a member, I want each sticker to show the person's name and face, so that I recognise them.
10. As a member, I want to see how many stickers I hold, so that I have a number to grow.

**Group albums**
11. As a member, I want an album for every group, not only mine, so that I'm nudged to thank people across the company.
12. As a member, I want an album to show who in the group I hold and who I don't yet, so that I know whom to thank next.
13. As a member, I want an album's progress as held of total, so that I can see how close I am.
14. As a member, I want my own groups' albums first, so that I start with the people I work with every day.
15. As a member, I want an album to follow the group as people join and leave, so that it matches the team as it is now.
16. As a member, I want an album never to count me as one of its people, so that I can complete my own group.
17. As a member, I want albums to disappear when the workspace has no groups, so that I'm not shown something I can't fill.

**One Book, kept apart**
18. As a member, I want stickers and albums in the same Book as my hoggies and crests, so that everything I collect is in one place.
19. As a member, I want team crests and group albums named differently, so that I can tell collecting hoggies from collecting colleagues.
20. As a member, I want stickers to have no rarity, so that no colleague is worth less than another.
21. As a member, I want my sticker book private, so that nobody sees who I haven't thanked.
22. As a member, I want nobody told that I hold their sticker, so that thanking stays about the thanks.

**Completed albums and Team Spirit**
23. As a member, I want an album marked complete once I hold everyone in it, so that I can finish something.
24. As a member, I want a completed album to stay complete when new people join, so that I don't lose what I earned.
25. As a member, I want an album to read complete when its last missing person leaves the group, so that I'm not stuck on someone who's gone.
26. As a member, I want the Team Spirit achievement for completing albums, so that crossing groups is rewarded.
27. As a member, I want albums I completed before Team Spirit shipped to count, so that I'm credited for what I already did.
28. As a member, I want Team Spirit's tiers to pay like every other ladder's, so that it's worth chasing.
29. As a member, I want to hear about a Team Spirit tier the way I hear about other tiers, through my message settings, so that it's no noisier than the rest.

**Rollout**
30. As the product owner, I want the sticker book behind its own flag, on for the sandbox and me first, so that I try it before anyone else sees it.
31. As the product owner, I want Team Spirit behind a second flag, so that the albums can ship before the ladder does.
32. As a member, I want nothing to change for me while the flags are off, so that unfinished work never leaks.
33. As a member, I want every kudos counted once toward my stickers and albums, so that a Slack retry or a replay never inflates them.

## Rules

"`sticker-book` is on for a member" means the flag answers true in their member decision. "The Book's collection is shown" means `getCollection` answers `{ kind: "collection" }` for the member today: `collection` is on for them and the Book is open (CL15).

### Stopping point 1: stickers and group albums

#### Stickers

- **SB1. Stickers.** A member holds one sticker of each other member they gave a Given award to or received one from, chime-ins included, whatever its gate decision. One sticker per pair of owner and person, kept forever, also after that person leaves the workspace, is deactivated or is no longer a member. A sticker has no rarity and no copies: it says only who and since when. Stickers are not items and not hoggies.
- **SB2. The sticker record.** A sticker is stored as one insert-only record `{ member, person, firstAward, firstAt }`, unique per member and person. `firstAward` is the pair's earliest Given award, in award order, in either direction, and `firstAt` its time. One award gives up to two stickers: the giver's of the recipient and the recipient's of the giver. Only the stickers module writes sticker records.
- **SB3. The earliest award, read when written.** Whoever writes a pair's sticker, the live subscriber or the backfill, first reads the pair's earliest committed award in each direction (the awards' giver-and-recipient index, one row each) and records the earlier of the two. An award commits before its `kudosGiven` is published, and awards are never changed, so every award earlier in award order is already readable: two messages' subscribers running in reverse order, thanks in the opposite direction and one person named twice in a message all record the same `firstAward`. A sticker that exists is never written again.
- **SB4. Live.** A `kudosGiven` subscriber records the stickers of the message's awards, at most 50 awards per mutation (about 4 index ranges and 2 writes each), each mutation scheduling the next, so a kudos to hundreds of members stays inside Convex's limits. A redelivered `kudosGiven` or a retried subscriber writes nothing new.
- **SB5. Earlier kudos (the backfill).** Every earlier Given award gives its stickers. An internal job pages through a workspace's awards in award order, 50 per mutation, each scheduling the next and keeping where it stopped in its own record, and reads to the last award. The ship worker starts it in every workspace at deploy, and the first `kudosGiven` subscriber run in a workspace without a backfill record starts it there. It and the live subscriber can run at the same time, since both write by SB3. Running it again changes nothing. It tells nobody.
- **SB6. Recorded whatever the flag says.** Stickers and the backfill are recorded whatever `sticker-book` says, as the Book counts every kudos whatever its flags say. The flag decides only what is shown, so turning it on later needs no backfill and turning it off takes nothing away.

#### Group albums

- **SB7. Albums.** A member has a **group album** for every counting group (G1), their own groups and every other one, a group with no other people included. An album's **people** are the people in the group's Slack user group, as the user group copy holds them now, who are members (R5), other than the album's owner. Its progress is `held`, how many of its people the owner holds a sticker of, out of `total`, its people's count.
- **SB8. Albums follow the group.** An album is derived when it is read, never stored in stopping point 1: from the workspace's user groups and group mode (which groups count, G1), the user group copy's people of each counting group, the workspace's members, and the owner's stickers. Groups exposes this as one read, `countingGroupsWithPeopleIn(workspace)`; the stickers module never reads Groups' or the directory's tables itself. Someone joining adds a person; someone leaving removes one; a group that stops counting (G5) drops out of every Book. Nothing is written when groups change.
- **SB9. No groups, no albums.** Albums are shown only while groups are shown to the member (`groupsShownTo`: the `groups` flag and at least one counting group, G4). Without them the Book shows the stickers only.

#### Showing it

- **SB10. Who sees what.** Stickers and albums are shown while `sticker-book` is on for the member and the Book's collection is shown. Stickers recorded before the Book opened or before the flag turned on wait there (ADR-0006). Only the member sees their own: every read takes the member from the website's guard, never from an argument.
- **SB11. `getCollection` gains people.** While `sticker-book` is on for the member, the collection answer gains:

  ```ts
  type Teammate = { name: string; face: MemberFace; former: boolean }; // the website's member face, as the leaderboard shows people
  type Sticker = Teammate & { key: string; firstAt: number; seen: string };
  type AlbumPerson = Teammate & { key: string; held: boolean };
  type GroupAlbum = { group: GroupId; name: string; mine: boolean; held: number; total: number; people: AlbumPerson[] };
  // { kind: "collection"; ...today's fields; stickers?: Sticker[]; albums?: GroupAlbum[] }
  ```

  - `stickers` is every sticker the member holds, newest `firstAt` first. `key` is `seenKeyOf(member, "sticker:{person}")`, stable and opaque, never a member ID, so the website can match an album's person to its sticker. `seen` is `seenKeyOf(member, "sticker:{person}:{firstAt}")`, so the Book marks new arrivals as it marks new hoggies and tiers.
  - `albums` is present only while groups are shown (SB9): every counting group, the member's own groups first (`mine: true`), then by name. `people` is the album's people by name, each with `held`.
  - A sticker's name and face are the person's as the directory has them now. A person who is no longer a member has `former: true` and the face and name the directory keeps for them, which can be the nameless `A teammate` with initials; nothing about them is kept by this module beyond the sticker. They drop out of every album.

  With `sticker-book` off the answer has no `stickers` and no `albums` field, exactly as `main` answers. `getCollection`'s other answers (`not-found`, `PageWaits`) are unchanged, so stickers need `collection` on, as it is for everyone in production (decision 26). `getBook` and its overview name no stickers or albums.
- **SB12. The read budget.** The people part of `getCollection` reads a fixed number of index ranges plus one per counting group: the member's stickers, the workspace's members (one range, so no person is looked up on their own), its user groups and group mode, and each counting group's people. Its documents are the member's stickers, the workspace's members and user groups, and the counting groups' memberships, so it is bounded by the workspace's size, never by anyone's kudos history. Its documents and its answer grow with the counting groups' memberships added up, so the supported size is stated in memberships: a workspace of up to 2,000 members with up to 6,000 counting-group memberships in total (about 10,000 documents and an answer under 2 MiB), well inside Convex's 32,000-document and 8 MiB limits. The album ticket proves that size with `transactionLimits: true` and asserts the answer's size. A workspace beyond it needs album people paged, a follow-up this spec doesn't build.
- **SB13. Naming it apart.** Team crests and group albums are different things and are always named so: a **team crest** is a PostHog team's crest you collect by finding every hoggie on its roster in crates; a **group album** is one of your workspace's Slack groups, collected by thanking its people. Copy never calls an album a team or a crest a group. Stickers are people, never hoggies.
- **SB14. Nobody is told.** Recording a sticker sends no message, reply, DM, App Home republish or product event in this spec. The recipient isn't told they're in someone's book.

#### Rollout

- **SB15. The flag.** `sticker-book`, a member decision, `safeDefault: false`. It starts on for `environment = sandbox` and the product owner's email only, copying the `activity` flag's email condition (decision 18). It is read without exposure, as `activity` is: only queries decide it, so it writes nothing. With it off, unset or the flags key missing, every Slack call, website answer and product event equals `main`'s, and every table equals `main`'s apart from the sticker records and the backfill's records (SB6).
- **SB16. Widening.** After the product owner has tried it on the website (map #57 builds the Book's Stickers and Group albums sections against SB11), the conductor asks him before turning `sticker-book` on in production. No backfill runs when it widens (SB6).
- **SB17. Coherence.** A `Stickers` component spec carries the invariants **a sticker is recorded once with its pair's earliest award** (refuted by a redelivered `kudosGiven`, the backfill or two messages' subscribers in reverse order writing a second sticker or a later `firstAward`), **the sticker book is private** (refuted by a read answering another member's stickers), and, as the gate's oracle, **the sticker book is dark where `sticker-book` is off**.

### Stopping point 2: completed albums and Team Spirit

- **SB18. Completing an album.** An album is complete when it has at least one person and the owner holds a sticker of every one of them. Completion is recorded once, as an insert-only record `{ member, group, award, at, people, told }` unique per member and group: `award` and `at` are the award whose check found it (SB19), `people` the album's `total` then, and `told` whether its tiers may be announced (SB22). A recorded album stays complete when people join or the group stops counting. An album of a group that doesn't count can't be completed (G5).
- **SB19. When it is checked: after a new sticker, never by a sweep.** When the live subscriber (SB4) records a new sticker for a member, it schedules one check for that member, keyed by the award that gave the sticker, once per member per subscriber mutation. The check reads the member's albums by SB8, so an album whose last missing person left (or was deactivated) is recorded at the member's next new sticker; until then it already reads as complete (SB24). The check reads the user group copy, never the reconciled `memberGroups`, so a reconcile still running can't make an album look complete. The check pages by group name, recording at most 25 completions per mutation and scheduling the rest with its cursor, so its writes and the jobs it schedules stay bounded. The backfill (SB5) schedules no checks.
- **SB20. Counted where it is recorded.** The check calls Achievements in the same mutation, once per recorded completion, so recording, counting, tiers and their rewards commit together. Each check mutation publishes one `albumsCompleted { workspace, member, message, award, groups: Array<{ group, people }>, at, told }` for the completions it recorded, which analytics projects as one `album completed` product event per group, with `people` and `told`, never names.
- **SB21. Team Spirit.** A new ladder, `team-spirit`, named `Team Spirit`, counting `group albums completed` (`group album completed` for one), with bronze `Team Spirit` at 1, silver `All Hands` at 2, gold `Tight-Knit` at 4 and diamond `Unbreakable Crew` at 8. Its rewards follow every ladder's: bronze 10 coins, silver its kudos emoji, the new store item `handshake` (`:handshake:`, 🤝, `Handshake`, tier `team-spirit` silver), diamond 100 coins, and gold's and diamond's hedgehogs stay never granted and never shown (CL32).
  - **A completion ladder.** Team Spirit counts completions, not awards. The ladder catalogue marks it so: the Book's launch replay and the live award counting skip it entirely, so adding it writes no replay, batch or counted award.
  - **Counted once.** A completion counts once per member and group, keyed by the completion record. A count that reaches a tier's count earns the tier with every rule a tier follows today (earned once, never taken back, its coins and emoji paid once), its cause being the completion's `award`, the real award whose check found it, and dated by the completion's `at`. A tier added to Team Spirit later is found from the completion records in their order, as an award ladder's is found from its counted awards.
- **SB22. Told or silent.** A member's first check after `team-spirit` turns on for them stores that they were checked, in the same mutation, and every completion it records is silent (`told: false`): albums history already covered count, and the tiers they earn are stored hidden, so no notice, summary or public line ever names them. Every later completion is `told: true`, and its tiers are told to the member privately through the tier notices, under the completion's message, aggregated per member and message, and following the member's message settings. Team Spirit tiers never get a public line, so a member-only rollout shows nothing to anyone else.
- **SB23. Albums completed before.** Only albums complete at a member's first check count from before: an album filled earlier but joined by someone new since, without the member thanking them, waits like any other. Nothing records completions while `team-spirit` is off.
- **SB24. Showing it.** While `team-spirit` is on for the member: `getCollection`'s albums gain `complete: boolean` (recorded, or `held === total` with `total > 0`) and `completedAt: number | null` with `seen: string | null` (`seenKeyOf(member, "album:{group}:{completedAt}")`) for recorded ones; a recorded album of a group that stopped counting is no longer listed but still counts; `getBook` answers the Team Spirit ladder, which the website puts under Connections. With it off nothing of Team Spirit shows anywhere: `getBook`, App Home's Book facts, the inventory's tier item list (the `handshake` emoji) and other members' profile cards (Team Spirit medals) all answer as stopping point 1 does, each reading one predicate, `teamSpiritShownTo(viewer)`.
- **SB25. The flag.** `team-spirit`, a member decision, `safeDefault: false`, sandbox plus the product owner's email. The check reads it with exposure and does nothing for a member it is off for; queries read it without exposure. With it off, unset or the flags key missing, every Slack call, website answer, product event and table equals stopping point 1's apart from the flag's own exposure row and `$feature_flag_called` event. Turning it off after completions keeps them and their tiers and hides them; on again shows them, with nothing told twice. Widening asks the product owner first; members are checked at their next new sticker, so widening needs no backfill.
- **SB26. Coherence.** The `Stickers` spec gains **a completed album stays complete** (refuted by a join un-completing it, or a second completion record for a member and group) and **Team Spirit is dark where `team-spirit` is off** as the gate's oracle. The Achievements spec's prose gains the completion ladder that the replay and award counting skip.

### What this changes

- **SB27. The collection and groups specs.** CL33 said the sticker book gave way to crests. It comes back beside them: the Book collects hoggies, crests and people, and nothing about crates, drops, rarities, rosters or crests changes. G31 and G33–G36, G44 and G46 stand as amended here: the sticker book lives in the Book's collection instead of a Sticker book tab (G35, G42); its read is `getCollection` instead of App Home; the sticker line in the success reply (G32) is out of scope; albums complete at the owner's next new sticker instead of on membership changes (G34); and Team Spirit's bronze is any one completed album instead of the primary group's (G36).

## Implementation Decisions

- **A new module, `stickers`**, owns sticker records, the backfill and its records, the `kudosGiven` subscriber, `stickersShownTo` (the `sticker-book` flag) and the reads `stickersOf(member)` and `albumsOf(member)`. In stopping point 2 it also owns completion records, the first-check records, the check job and `albumsCompleted`. It knows nothing about the website; the website's `getCollection` calls its reads.
- **Groups** exposes `countingGroupsWithPeopleIn(workspace)`: the counting groups (G1, from the user groups and group mode, empty ones included), each with the members (R5) in its user group copy, reading the workspace's members in one range through the directory.
- **Engine**: an exported read of a pair's earliest award in one direction, from the giver-and-recipient index.
- **Website**: `getCollection` gains `stickers` and `albums` (SB11) while `sticker-book` is on. Stopping point 2 adds `complete`, `completedAt` and `seen` to albums and the Team Spirit ladder to `getBook`.
- **Bus**: the stickers subscriber joins `kudosGiven`; stopping point 2 adds `albumsCompleted`, subscribed by analytics only.
- **Achievements** (stopping point 2): the `team-spirit` ladder marked as a completion ladder, skipped by the replay and the award counter; a count step keyed by the completion record that earns tiers caused by the completion's award; `teamSpiritShownTo` applied to the Book facts, App Home, the profile card's medals and, through the store, the inventory's tier items. **Feedback**: tier notices skip a public line for Team Spirit. **Store**: the `handshake` kudos emoji as Team Spirit's silver reward.
- **Schema**: `stickers` by member and person, and by member and `firstAt`; `stickerBackfills` by workspace. Stopping point 2: `albumCompletions` by member and group, and `albumChecks` by member.
- **Lexicon**: declare **group album** (one Slack group's people in a member's sticker book, distinct from a team crest) and, in stopping point 2, **Team Spirit**; redefine **Book** with hoggies, crests and stickers, and **sticker book** as part of the Book's collection, its albums completing at the owner's next new sticker. One term at a time. `sticker` stays as defined.
- **Coherence**: a `Stickers` component spec with SB17's and SB26's invariants. A journal decision quotes decision 27.

## Testing Decisions

- **Good tests** drive the system from the outside: kudos given through the signed Slack event router (messages and chime-ins), the website's member queries with `convex-test`, Slack and PostHog stubbed at `fetch`. They assert what the website answers, never tables, except the every-table equality the flag's dark proof uses. Times come from `settleInTimeOrder`.
- **Ticket 1, stickers** (prior art: `convex/website/collection.test.ts`, `convex/achievements/replay.test.ts`, `convex/groups/attribution.test.ts`): a kudos gives the giver a sticker of each recipient and each recipient one of the giver; a chime-in does the same; a second kudos between the same two adds none and keeps `firstAt`; two messages whose subscribers run in reverse order, a thanks back the other way, and one person named twice all record the earliest award; a redelivered `kudosGiven` adds none; earlier kudos show once the backfill runs, also with kudos given while it runs; a kudos to 300 members stays under the limits with `transactionLimits: true`; a person who left keeps their sticker as `former`; another member's call never answers my stickers.
- **Ticket 2, albums** (prior art: `convex/website/groupBoards.test.ts`, `convex/groups/primaryGroups.test.ts`): every counting group is an album with held and total, empty ones included, my groups first; I am never one of my album's people; a bot or a deactivated person in a user group is not a person; a join and a departure change the album on the next read; a group that stops counting disappears; no groups shown means no `albums` field; a workspace of 2,000 members with 6,000 counting-group memberships answers inside the limits, its answer under 2 MiB.
- **Ticket 3, the gate** proves `sticker-book` at the Slack and website boundaries: off, unset and missing-key equal `main` apart from the sticker tables; on for one member's email only changes only that member's `getCollection`.
- **Ticket 4, completions and Team Spirit** (prior art: `convex/achievements/oldFriends.test.ts`, `tierCoins.test.ts`, `tierEmoji.test.ts`, `convex/feedback/tierNotices` tests): the first check records every complete album silently and its tiers are never announced, also in a later summary; after it, thanking the last missing person completes the album once and tells its tier privately under that message, with no public line; a join afterwards keeps it complete; the last missing person leaving shows `complete` at once and records at the next new sticker; 1, 2, 4 and 8 completions earn bronze to diamond once each with coins and `handshake` paid once; a redelivered `kudosGiven` records nothing twice; adding the ladder runs no replay; a member completing 60 albums at once stays under the limits.
- **Ticket 5, the gate** proves `team-spirit`: off, unset and missing-key equal stopping point 1 in every Slack call, answer, event and table apart from the exposure, on the Book, App Home, the inventory and another member's profile card; on for one email only changes only that member.

## Review

A GPT-6.1 Sol review (high) of the first draft found 12 majors and 4 minors. All 16 are fixed. A final read confirmed 15 and found #3 only partly fixed; it is fixed now:

1. **Major: live delivery could keep a later `firstAward`.** Subscribers run in any order. Both writers now read the pair's earliest committed award before inserting, so the backfill and the live subscriber can run together (SB3, SB5).
2. **Major: `memberGroups` can't list counting groups.** Groups now exposes `countingGroupsWithPeopleIn`, which starts from the user groups and group mode, empty groups included (SB7, SB8).
3. **Major: one lookup per person broke the range budget.** The workspace's members are read in one range, so ranges are fixed plus one per counting group. The final read found the documents and bytes still unbounded across overlapping groups, so SB12 now states the supported size in total memberships and proves it, with album paging as a follow-up.
4. **Major: completion work wasn't bounded in schedules and writes.** A check records at most 25 completions per mutation, and each mutation publishes one `albumsCompleted` (SB19, SB20).
5. **Major: a partial reconcile could fake a completion.** Checks read the user group copy, never `memberGroups`. The daily sweep is gone (SB19).
6. **Major: tiers need an award cause.** Every completion is found by a check keyed by a real award, and that award is the tier's cause (SB18, SB21).
7. **Major: a new ladder triggers the award replay.** Team Spirit is a completion ladder that the replay and the award counting skip (SB21).
8. **Major: Team Spirit leaked through inventory, App Home and profile cards.** One predicate, `teamSpiritShownTo`, guards every surface (SB24).
9. **Major: exposure broke table equality.** The oracle exempts the flag's own exposure, as the collection's does (SB25).
10. **Major: silence wasn't durable.** Completions store `told`, and silent tiers are stored hidden, so no notice or summary names them (SB18, SB22).
11. **Major: live notices lacked a message and could post publicly.** Notices go under the completion's message, aggregated per member and message, and Team Spirit gets no public line (SB22).
12. **Major: a first check could run against a partial backfill.** The backfill schedules no checks. A check runs only after a live new sticker, and SB23 limits the promise to albums complete at the first check.
13. **Minor: former members become nameless.** `former: true` and the directory's nameless face, with no kept snapshot (SB11).
14. **Minor: historical credit promised more than was stored.** Narrowed to albums complete at the first check (SB23).
15. **Minor: analytics lacked the album's size.** `people` is recorded on the completion and the event (SB18, SB20).
16. **Minor: stopping point 1 had no UI.** Map #57 accepted the contract and builds the Book's sections, and widening waits for the owner to try them (SB16).

## Out of Scope

- The website's sections and art for stickers and albums (map #57 builds them against `getCollection`).
- A daily sweep that completes albums without a new sticker.
- The `New sticker: {recipient}` part of the success reply (G32): the Book's new marks do that job, and decision 22 asks for quieter Slack. A later ticket can add it as a gains line part once a subscriber can join the reply's hold.
- An App Home line for stickers or albums.
- Rarities, duplicates or trading for stickers; stickers as kudos emoji, avatars or store items.
- Showing anyone else's sticker book, or telling a recipient they were stickered.
- Albums of anything but counting groups (channels, crests, teams).
- What gold and diamond tiers give instead of a hedgehog (CL32's follow-up).
- Group auras (#55).

## Further Notes

**The product owner's words this spec builds on, verbatim:**

1. Decision 27, 2026-10-16: "The sticker album was the idea that you can collect these hockeys and so on, but you can also collect teams and team members, right? It's both, so start that, please."
2. Decision 25, 2026-10-15: the Book collects hoggies and team crests; "once you collect the whole team, you collect this crest sticker in the book".
3. Decision 18, 2026-10-14: "Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on."
4. Decision 12, 2026-10-13: kept "the Book (stickers and achievements)".

**The website conductor's answer** (map #57, 2026-10-16) accepted the contract. `stickers?` and `albums?` are optional on the collection answer and absent while the flag is off. `Teammate.face` reuses the website's `MemberFace`. Everything renders on `/book/collection`, with no new route, as in-page sections (Hoggies, Team crests, Stickers, Group albums) and a jump list. `getBook`'s overview names no sticker counts until the website asks. SP1 needs no counts: the website derives `stickers.length` and each album's `held`/`total`. `team-spirit` goes under Connections. The naming rule (SB13) goes into its copy, and the BookPage tests that forbid "sticker|album" stay until the flag is on. After the review, an album person gained `former` and SP2 albums gained `complete`. The website is told in the resolution.

**Calls taken at recommendation** are listed with their journal IDs in the resolution on #54.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
