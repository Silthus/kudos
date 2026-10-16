# Spec: the sticker book: stickers of teammates and group albums in the Book

> **Accepted on [#54](https://github.com/Silthus/kudos/issues/54) (2026-10-16) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/sticker-book` and is never merged. It answers the product owner's "It's both" (map #1, decision 27) and re-specs the groups spec's stopping point 4 (G31–G36, G46) to fit inside today's Book, which became a collection with decision 25. The build runs on the integration branch `spec/sticker-book`, which the conductor cuts from `main`.
>
> **Rule numbers.** Rules are cited as `SB1`–`SB27`. Collection rules are cited as `CL15`, groups rules as `G31`, progression rules as `P58`, achievements as the Achievements component spec says them.
>
> **Two stopping points.** 1 (SB1–SB16) is stickers and group albums in the Book, behind `sticker-book`. 2 (SB17–SB25) is completed albums and the Team Spirit ladder, behind `team-spirit`. Stopping point 2 starts once stopping point 1 is on `main`. SB26–SB27 hold for both.
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
25. As a member, I want an album to complete when its last missing person leaves the group, so that I'm not stuck on someone who's gone.
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
- **SB2. The sticker record.** A sticker is stored as one insert-only record `{ member, person, firstAt, firstAward }`, unique per member and person, where `firstAward` is the earliest Given award, in award order, between the two in either direction, and `firstAt` its time. One award gives up to two stickers: the giver's of the recipient and the recipient's of the giver. Only the stickers module writes sticker records.
- **SB3. Live.** A `kudosGiven` subscriber records the stickers of the message's awards, at most 100 awards per mutation, each mutation scheduling the next, so a kudos to hundreds of members stays inside Convex's limits. It writes a sticker only where none exists for the pair, so a redelivered `kudosGiven`, a retried subscriber and the backfill never write one twice.
- **SB4. Earlier kudos (the backfill).** Every earlier Given award gives its stickers, in award order. The first `kudosGiven` subscriber run in a workspace without a sticker backfill starts it, and the ship worker starts it in every workspace at deploy. It pages through the workspace's awards, 100 per mutation, each scheduling the next, keeping where it stopped in its own record, and reads to the last award, so it catches every award given while it ran. Until a workspace's backfill has finished, the live subscriber records nothing there (the backfill reaches those awards), so a sticker's `firstAward` is always the pair's earliest. Running it again changes nothing. It tells nobody.
- **SB5. Recorded whatever the flag says.** Stickers and the backfill are recorded whatever `sticker-book` says, as the Book counts every kudos whatever its flags say. The flag decides only what is shown, so turning it on later needs no backfill and turning it off takes nothing away.

#### Group albums

- **SB6. Albums.** A member has a **group album** for every counting group (G1), their own groups and every other one. An album's **people** are the group's current members (G2) other than the album's owner. Its progress is `held`, how many of its people the owner holds a sticker of, out of `total`, its people's count. An album with no people (a group of just its owner) has `total` 0.
- **SB7. Albums follow the group.** An album is derived when it is read, from the groups the Groups module reconciled and the owner's stickers, never stored in stopping point 1. Someone joining adds a person; someone leaving removes one; a group that stops counting (G5) drops out of every Book. Nothing is written when groups change.
- **SB8. No groups, no albums.** Albums are shown only while groups are shown to the member (`groupsShownTo`: the `groups` flag and at least one counting group, G4). Without them the Book shows the stickers only.

#### Showing it

- **SB9. Who sees what.** Stickers and albums are shown while `sticker-book` is on for the member and the Book's collection is shown. Stickers recorded before the Book opened or before the flag turned on wait there (ADR-0006). Only the member sees their own: every read takes the member from the website's guard, never from an argument.
- **SB10. `getCollection` gains people.** While `sticker-book` is on for the member, the collection answer gains:

  ```ts
  type Teammate = { name: string; face: Face }; // teammateOf, as the leaderboard and activity show people
  type Sticker = Teammate & { key: string; firstAt: number; seen: string };
  type AlbumPerson = Teammate & { key: string; held: boolean };
  type GroupAlbum = { group: GroupId; name: string; mine: boolean; held: number; total: number; people: AlbumPerson[] };
  // { kind: "collection"; ...today's fields; stickers?: Sticker[]; albums?: GroupAlbum[] }
  ```

  - `stickers` is every sticker the member holds, newest `firstAt` first. `key` is `seenKeyOf(member, "sticker:{person}")`, stable and opaque, never a member ID, so the website can match an album's person to its sticker. `seen` is `seenKeyOf(member, "sticker:{person}:{firstAt}")`, so the Book marks new arrivals as it marks new hoggies and tiers.
  - `albums` is present only while groups are shown (SB8): every counting group, the member's own groups first (`mine: true`), then by name. `people` is the album's people by name, each with `held`.
  - A person who left keeps their sticker and drops out of every album. A sticker's name and face are the person's as the directory has them now.

  With `sticker-book` off the answer has no `stickers` and no `albums` field, exactly as `main` answers. `getCollection`'s other answers (`not-found`, `PageWaits`) are unchanged, so stickers need `collection` on, as it is for everyone in production (decision 26).
- **SB11. The read budget.** The people part of `getCollection` reads the member's stickers through one index range, the workspace's reconciled group rows through one more (`memberGroups` gains an index by workspace), and each person it names once. It never reads awards or the group history, so it is bounded by the workspace's size, never by anyone's kudos history.
- **SB12. Naming it apart.** Team crests and group albums are different things and are always named so: a **team crest** is a PostHog team's crest you collect by finding every hoggie on its roster in crates; a **group album** is one of your workspace's Slack groups, collected by thanking its people. Copy never calls an album a team or a crest a group. Stickers are people, never hoggies.
- **SB13. Nobody is told.** Recording a sticker sends no message, reply, DM, App Home republish or product event in this spec. The recipient isn't told they're in someone's book.

#### Rollout

- **SB14. The flag.** `sticker-book`, a member decision, `safeDefault: false`. It starts on for `environment = sandbox` and the product owner's email only, copying the `activity` flag's email condition (decision 18). It is read without exposure, as `activity` is: only queries decide it. With it off, unset or the flags key missing, every Slack call, website answer and product event equals `main`'s, and every table equals `main`'s apart from the sticker records and the backfill's record (SB5).
- **SB15. Widening.** After the product owner has tried it, the conductor asks him before turning `sticker-book` on in production. No backfill runs when it widens (SB5).
- **SB16. Coherence.** A `Stickers` component spec carries the invariants **a sticker is recorded once and kept** (refuted by a redelivered `kudosGiven` or the backfill writing a second sticker for a pair, or a later award moving `firstAt`), **the sticker book is private** (refuted by a read answering another member's stickers), and, as the gate's oracle, **the sticker book is dark where `sticker-book` is off**.

### Stopping point 2: completed albums and Team Spirit

- **SB17. Completing an album.** An album is complete when the owner holds a sticker of every one of its people and it has at least one person. Completion is recorded once, as an insert-only record `{ member, group, at }` unique per member and group, and the album stays complete when people join or the group stops counting. An album of a group that doesn't count can't be completed (G5).
- **SB18. When it is checked.** Albums are checked for completion:
  1. after the stickers module records a new sticker for a member, by a job for that member, scheduled once per member per subscriber mutation, so a kudos completes the album it filled within moments; and
  2. by a daily sweep of every workspace, after the daily user group sync, which checks every member's albums, so someone leaving a group (or being deactivated) completes the albums they were the last missing person of within a day.

  Each check reads the workspace's reconciled group rows once and the member's stickers and completions, and pages by documents read, never by a fixed member count, so it stays inside Convex's limits in a large workspace. A completion found by a member's job is dated by the newest `firstAt` among the album's people's stickers, and one found by the sweep by the sweep's run.
- **SB19. `albumCompleted`.** Recording a completion publishes `albumCompleted { workspace, member, group, at, found: "sticker" | "sweep" }` once, in the same mutation.
- **SB20. Team Spirit.** A new ladder in the ladder catalogue, `team-spirit`, named `Team Spirit`, counting `group albums completed` (`group album completed` for one), with bronze `Team Spirit` at 1, silver `All Hands` at 2, gold `Tight-Knit` at 4 and diamond `Unbreakable Crew` at 8. Its rewards follow every ladder's: bronze 10 coins, silver its kudos emoji, the new store item `handshake` (`:handshake:`, 🤝, `Handshake`, source tier `team-spirit` silver), and gold and diamond's hedgehogs stay never granted and never shown (CL32), diamond paying its 100 coins.
- **SB21. Counting Team Spirit.** Achievements subscribes to `albumCompleted` and counts each completion once per member and group, keyed by the group, so a redelivered event counts once. A completion that takes the count to a tier's count earns the tier, dated by the completion's `at`, with every rule a tier follows today (earned once, never taken back, hidden while the Book doesn't apply, its coins and emoji paid once). Team Spirit counts no award: when the ladder is new to a workspace, its replay over the awards counts nothing and finishes at once.
- **SB22. Albums completed before.** The first check of a member after `team-spirit` turns on for them, whichever check it is, records every album already complete, so albums that history already covers count (G46), and stores that the member was checked. The completions a first check records, and the tiers they earn, are told to nobody, as the tier coin backfill tells nobody. After it, tiers earned by completions a member's job finds after a new sticker are told as every tier is, through the tier notices and the member's message settings; those the sweep finds are told to nobody.
- **SB23. Showing it.** While `team-spirit` is on for the member: `getCollection`'s albums gain `completedAt: number | null` and `seen: string | null` (`seenKeyOf(member, "album:{group}:{completedAt}")`), and a completed album of a group that stopped counting is no longer listed but still counts; `getBook` answers the Team Spirit ladder like any other. With it off, `getBook` has no Team Spirit ladder and albums have no `completedAt`, exactly as stopping point 1 answers.
- **SB24. The flag.** `team-spirit`, a member decision, `safeDefault: false`, sandbox plus the product owner's email. The checks (SB18) read it with exposure for each member they decide for and do nothing for a member it is off for, so with it off no completion, count or tier is written and every Slack call, website answer, product event and table equals stopping point 1's. Queries read it without exposure. Widening asks the product owner first; the daily sweep evaluates newly covered members within a day, so widening needs no backfill run by hand.
- **SB25. Coherence.** The `Stickers` spec gains **a completed album stays complete** (refuted by a join un-completing it, or a second completion record for a member and group), and **Team Spirit is dark where `team-spirit` is off** as the gate's oracle; the Achievements spec's prose gains the ladder that counts completions, not awards.

### What this changes

- **SB26. The collection spec.** CL33 said the sticker book gave way to crests. It comes back beside them: crests stay what they are, and the Book collects hoggies, crests and people. Nothing about crates, drops, rarities, rosters or crests changes.
- **SB27. The groups spec.** G31 and G33–G36 and G44 and G46 stand as amended here: the sticker book lives in the Book's collection instead of a Sticker book tab (G35, G42), its website read is `getCollection` instead of App Home, the sticker line in the success reply (G32) is out of scope, and Team Spirit's bronze is any one completed album instead of the primary group's (G36).

## Implementation Decisions

- **A new module, `stickers`**, owns sticker records, the backfill and its record, the `kudosGiven` subscriber, `stickersShownTo` (the `sticker-book` flag), and the reads `stickersOf(member)` and `albumsOf(member)`. In stopping point 2 it also owns album completion records, the per-member check, the daily sweep and `albumCompleted`. It knows nothing about the website; the website's `getCollection` calls its reads.
- **Groups**: `memberGroups` gains an index by workspace, so the stickers module reads every counting group's members in one range. Groups exposes a read of a workspace's reconciled group rows (the counting groups, each with its members); the stickers module never reads Groups' tables itself.
- **Website**: `getCollection` gains `stickers` and `albums` (SB10) while `sticker-book` is on; stopping point 2 adds `completedAt` and `seen` to albums and lets `getBook` answer Team Spirit. People are shown through `teammateOf`, as the leaderboard does.
- **Bus**: the stickers subscriber joins `kudosGiven`; stopping point 2 adds `albumCompleted`, subscribed by Achievements and analytics (`album completed`, with `found` and the group's people count, never names).
- **Achievements** (stopping point 2): the `team-spirit` ladder and its tier names; a subscriber counting `albumCompleted`; the ladder counts nothing in the award replay. **Store**: the `handshake` kudos emoji as Team Spirit's silver reward.
- **Crons** (stopping point 2): the daily album sweep after the user group sync.
- **Schema**: `stickers` by member and person, and by member and `firstAt`; `stickerBackfills` by workspace; stopping point 2: `albumCompletions` by member and group, and `albumChecks` by member (the first check, SB22).
- **Lexicon**: declare **group album** (one Slack group's people in a member's sticker book, distinct from a team crest) and, in stopping point 2, **Team Spirit**; redefine **Book** with hoggies, crests and stickers, and **sticker book** as part of the Book's collection. One term at a time. `sticker` stays as defined.
- **Coherence**: a `Stickers` component spec with SB16's and SB25's invariants. A journal decision quotes decision 27.

## Testing Decisions

- **Good tests** drive the system from the outside: kudos given through the signed Slack event router (messages and chime-ins), the website's member queries with `convex-test`, Slack and PostHog stubbed at `fetch`. They assert what the website answers, never tables, except the every-table equality the flag's dark proof uses. Times come from `settleInTimeOrder`.
- **Ticket 1, stickers** (prior art: `convex/website/collection.test.ts`, `convex/achievements/replay.test.ts`, `convex/groups/attribution.test.ts`): a kudos gives the giver a sticker of each recipient and each recipient one of the giver; a chime-in does the same; a second kudos between the same two adds none and keeps `firstAt`; a redelivered `kudosGiven` adds none; earlier kudos show once the backfill runs, in award order, with the earliest `firstAt`, including awards given while it ran; a kudos to 300 members stays under the limits with `transactionLimits: true`; a person who left keeps their sticker; another member's call never answers my stickers.
- **Ticket 2, albums** (prior art: `convex/website/groupBoards.test.ts`, `convex/groups/primaryGroups.test.ts`): every counting group is an album with held and total, my groups first; I am never one of my album's people; a join and a departure change the album on the next read; a group that stops counting disappears; no groups shown means no `albums` field; a workspace of 2,000 members in 50 groups answers inside the limits.
- **Ticket 3, the gate** proves `sticker-book` at the Slack and website boundaries: off, unset and missing-key equal `main` apart from the sticker tables; on for one member's email only changes only that member's `getCollection`.
- **Ticket 4, completions** (prior art: `convex/achievements/oldFriends.test.ts`, `convex/groups/attribution.test.ts`): thanking the last missing person completes the album at once and once; a join afterwards keeps it complete; the last missing person leaving completes it at the next sweep; a group that stops counting can't complete; a second sweep writes nothing.
- **Ticket 5, Team Spirit** (prior art: `convex/achievements/achievements.test.ts`, `tierCoins.test.ts`, `tierEmoji.test.ts`): 1, 2, 4 and 8 completions earn bronze to diamond once each, with coins and the `handshake` emoji paid once; a redelivered `albumCompleted` counts once; albums complete before the flag count silently on the first check; a tier from a new sticker is told through the tier notices; the award replay of the new ladder counts nothing.
- **Ticket 6, the gate** proves `team-spirit`: off, unset and missing-key equal stopping point 1 in every table; on for one email only changes only that member.

## Out of Scope

- The website's pages, sections and art for stickers and albums (map #57, against `getCollection`).
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

**Calls taken at recommendation** are listed with their journal IDs in the resolution on #54.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
