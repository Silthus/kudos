# Spec: the activity timeline, kudos text, and the spotlight

> **Accepted on [#232](https://github.com/Silthus/kudos/issues/232) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/activity-timeline` and is never merged. It **amends R51** of the core loop spec (`spec/core-loop.md` on `docs/spec-core-loop`) by Michael's decision, and **amends R27** for the stored text only. It builds on the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P65, P71, P76, P94, P95), the per-member flags spec (`spec/per-member-flags.md` on `docs/per-member-flags`), and the Slack-to-web spec (`spec/slack-to-web.md` on `docs/slack-to-web`: SW2, SW5, SW9–SW11). Spec #209 (meaningful thank-yous) may later change what "said why" means; this spec reads whatever the gate decision says.
>
> **Rule numbers.** Rules are cited as `AT1`–`AT40`. Core loop rules are cited as `R51`, progression rules as `P76`, Slack-to-web rules as `SW5`, website rules as `WS42`.
>
> Sources: Michael's two decisions (quoted under "Further Notes"); the code on `main` at `384208c` (`convex/slack/normalize.ts`, `convex/engine/`, `convex/progression/`, `convex/unlocks/unlocks.ts`, `convex/website/`, `convex/workspace/directory.ts`, `slack-app/manifest.ts`); map #1's decisions 11, 18 and 19; the reads the website map (#57) named for its spec #233, relayed by the conductor.

## Problem Statement

A member who gets thanked in Slack sees it once, in the channel, and then it scrolls away. The website shows how many kudos they received and gave, but never which ones: not who thanked them, not for what, not the words. A giver can't look back at whom they thanked or what each thank-you earned them. Level-ups arrive as a DM and vanish. There is no place that tells a member's story of recognition.

The words are the best part of a kudos, and the app has never kept them (R51). So even the leaderboard, the one page the whole workspace shares, can only show numbers, never a single thank-you.

## Solution

**The app keeps the words of kudos messages, and nothing else, and shows each member their own story.**

- **Kudos text.** When a message is a kudos message, the app stores its words: the newest revision, keyed to the channel, the message `ts` and the revision, so an edit replaces them and the entry says "edited". Every other message is never stored. A deleted message, a member who leaves Slack, and a data deletion request remove the words; the kudos itself stays (ADR-0001).
- **The activity timeline.** One read answers a member's own timeline, newest first, in pages for infinite scroll: each kudos they received (who, when, in which channel, whether it said why, its words, and a link to it in Slack), each kudos they gave (to whom, the same facts, and what it earned them: XP and any quest it finished), and each level they reached. A filter shows all, only received, or only given.
- **The last few.** The same read with a small limit gives the profile card its last few received or given kudos.
- **The spotlight.** The leaderboard page shows one kudos drawn at random from public channels, with its words, giver, recipients and a link to Slack. Next draws another, never the same one twice in a row.
- **Behind `activity`.** Every read answers nothing while the `activity` flag is off for the signed-in member. Storing the words is not a surface, so it runs for everyone once shipped.
- **The website owns the UI.** The profile card with its Received/Given switch, the activity tab with the infinite timeline, and the spotlight panel on the leaderboard page belong to the website map (#233). This spec delivers the backend reads, ready to render.

## User Stories

**Seeing what I received**
1. As a member, I want to see the kudos I received, newest first, so that I can relive the moments my teammates thanked me.
2. As a member, I want each received kudos to show who gave it and when, so that I remember the moment.
3. As a member, I want to read the giver's words, so that I see what they thanked me for, not only that they did.
4. As a member, I want a link that opens the kudos in Slack, so that I can see the thread around it and reply.
5. As a member, I want to know whether a kudos came from a private channel, so that I'm careful where I share it.
6. As a member, I want to see whether the giver said why, so that the thank-yous with a reason stand out.
7. As a member, I want an edited kudos marked as edited, so that I know the words may differ from what I first saw.
8. As a member, I want a deleted kudos to stay in my timeline as a fact without its words, so that my history stays true while the giver's choice to delete is respected.

**Seeing what I gave**
9. As a giver, I want to see the kudos I gave, newest first, so that I can look back at whom I thanked.
10. As a giver who thanked several people in one message, I want one entry with every recipient, so that one message stays one moment.
11. As a giver, I want each entry to show the XP it earned me, so that I see the game respond to each thank-you.
12. As a giver, I want each entry to show any quest that kudos finished and what it paid, so that I see my quests progress where they happened.
13. As a giver who can't see XP yet, I want no XP in my timeline, so that it never names a number I can't find anywhere (P76).
14. As a giver, I want my own words in each entry, so that I remember what I wrote.

**The timeline**
15. As a member, I want my level-ups as marks in the same timeline, so that I see when my thank-yous added up.
16. As a member, I want the timeline to load more as I scroll, so that I can go back as far as I like without waiting for everything at once.
17. As a member, I want to filter the timeline to received or given, so that I can focus on one side.
18. As a member, I want level-ups only in the full view, so that the filtered views stay about kudos.
19. As a member, I want day dividers in my own time zone, so that "yesterday" means my yesterday.
20. As a member, I want a level-up shown right above the kudos that caused it, and nothing repeated or skipped as I scroll, so that the timeline reads as one story.

**The profile card**
21. As a member, I want my profile card to list my last few received kudos, so that I see the latest gratitude at a glance.
22. As a member, I want to switch the card to the last few kudos I gave, so that I see my own giving too.

**The spotlight**
23. As a member on the leaderboard page, I want to read one real thank-you from my workspace, so that the board shows the gratitude behind the numbers.
24. As a member, I want a Next button that shows another one, so that I can browse a few.
25. As a member, I want Next never to show the same message twice in a row, so that the button always does something.
26. As a member, I want the spotlight to show only messages from public channels, so that a private channel's words never surface to the whole workspace.
27. As a member, I want the spotlight to show only kudos that said why, so that it shows real reasons, not a bare emoji.
28. As a member who left the leaderboards, I want my kudos never in the spotlight, so that leaving the board keeps me off the board page (G22).

**Privacy and data**
29. As Michael, I want only kudos messages' words stored, so that ordinary chat never sits in the app's database.
30. As a giver, I want deleting my kudos message in Slack to delete its words in the app, so that deleting means deleting.
31. As a member who leaves the company, I want the words I wrote removed when Slack deactivates me, so that my words don't outlive my account.
32. As Michael, I want a way to delete a member's or a workspace's stored words on request, so that a data deletion request takes one command.
33. As Michael, I want the words never in logs, product events, exceptions or scheduled jobs, so that they stay in exactly one table.
34. As a member, I want to see only the words of kudos I gave or received, so that nobody reads another member's private-channel thanks through my timeline.

**Rollout**
35. As Michael, I want every read off until the `activity` flag is on for me, so that I can try it before anyone else (decision 18).
36. As Michael, I want the words of kudos given before this ships filled in from Slack, so that my timeline and the spotlight aren't empty on day one.

## Rules

### Kudos text (amends R51 and R27)

- **AT1. R51, amended.** *Only kudos messages' text is stored.* The app stores the words of a message only while its newest revision is a kudos message (the parser returns one: a mention and a kudos emoji). It stores them in one table, the **kudos text**, and nowhere else: never in another table, a scheduled job's arguments, a log line, a product event, an exception or a person property. A message that is ordinary chat is never stored, as today. R51's old wording ("Message text is never stored") is replaced by this rule; the reason is Michael's decision of 2026-10-14 (Further Notes). The words still reach the events mutation in memory, as the parser's text always has.
- **AT2. What is stored.** One row per kudos message, keyed by workspace, channel and message `ts`, holding: the revision it was taken from (the engine's revision, so newest wins exactly as R21 orders revisions), the words as ordered **segments**, the channel's visibility, the author, and the stored revision's own **current gate decision** (the gate hook's verdict on these words, AT24). The segments come from the message's rich text in order, every element counted or not (quotes and code are words too):
  - `text` (with optional `bold`, `italic`, `strike`, `code` flags),
  - `person` (a chat user ID, resolved to a display name at read time),
  - `group` (a user group ID, resolved to its handle at read time),
  - `channel` (a channel mention, shown without a name),
  - `broadcast` (`here`, `channel`, `everyone`),
  - `emoji` (a name, plus the unicode character when Slack sends one),
  - `link` (a URL and its optional label),
  - `break` (a line or block boundary).

  Only the Slack adapter knows Slack's rich text; the engine and every reader see segments.
- **AT3. Visibility.** A row records `public` when Slack delivered the message from a public channel (`channel_type` `channel`), `private` for a private one (`group`), and `unknown` when the app couldn't tell (the backfill, AT35). `unknown` is treated as private everywhere.
- **AT4. Newest revision wins.** A newer revision that is still a kudos message replaces the stored words, revision and current gate decision. An older or equal revision changes nothing. A message with a tombstone (AT6, AT7, AT8) never stores words again, whatever revision arrives. The read marks an entry `edited` when the stored revision is newer than the message's `ts`.
- **AT5. Edited away.** When the newest revision is no longer a kudos message (the emoji or the mentions were removed), its words are deleted. A watermark row keeps no words.
- **AT6. Deleted in Slack.** A `message_deleted` event, or a `message_changed` whose message has subtype `tombstone` (a deleted thread parent), deletes the stored words and leaves a `deleted` tombstone, whatever state the message is in. The awards, spending, indicator and replies stay, and a message deleted while it waits for a directory check still gives (R27, ADR-0001). The tombstone is terminal: a late or redelivered edit of that message stores nothing.
  - **Routing.** Slack sends these under the existing `message.channels` and `message.groups` subscriptions, but without `channel_type` and without the fields an edit has. The adapter recognises them **before** today's channel-type and subtype checks and before the HTTP action's `mayGiveKudos` drop, records the receipt, and hands the engine a `deleted` event with the message ref, in the same one mutation as every event.
  - **Only kudos messages.** The engine writes a tombstone when it knows the message (any `kudosMessages` row, watermark included), or when the event's `previous_message` would have been a kudos candidate (a mention and an emoji), so a deletion that overtakes its own post still wins. Any other deletion stores nothing.
- **AT7. A member who leaves.** When the directory records that a member Slack reported as deactivated (`user_change` with `deleted`) is no longer a member, every word they authored stops being readable at once: the reads answer `removed` for a message whose author the directory no longer knows as a member. The directory's mutation then schedules a bounded, self-rescheduling purge (only IDs in its arguments) that deletes those rows and leaves `removed` tombstones. The kudos stay. Words that mention them stay, because they are the giver's. A member who comes back finds their old words gone; their new kudos are stored again.
- **AT8. On request.** Two maintainer-run internal functions delete stored words and leave `removed` tombstones: every message one member authored, and every message of one workspace. Each deletes in bounded pages and reschedules itself until done, with only IDs in its arguments. A deletion request removes what is stored; it does not stop the app storing a member's later kudos.
- **AT9. Kept while the kudos lives.** Otherwise the words are kept for as long as the kudos is: there is no expiry.
- **AT10. Capture is not flagged.** Storing kudos text runs for every workspace once it reaches `main`. It is data, not a surface, and every reader is behind `activity` (AT37). Without it, the spotlight and the timeline would be empty for kudos given while the flag was off.
- **AT11. Never sent, never logged.** The words never reach PostHog or the logs: no product event, exception, person property or console line carries them.
  - Every function whose arguments or reads carry words logs fixed codes only, and throws errors with fixed messages that never interpolate content.
  - The analytics boundary reports any exception from such a function, a `ReportableError` included, with a fixed message instead of its original one.
  - No native exception reporting path forwards their original messages either.
  - The words are serialised only into the kudos text table.

  Spec #209's classifier, which sends text to the model for judgement only, stays the one exception, under its own spec; its request and thread context bodies are never captured in telemetry either.
### Permalinks

- **AT12. One permalink form.** A kudos entry's `permalink` is built from stored facts, never from a Slack call per message: `{workspace URL}archives/{channel}/p{ts without the dot}`, and for a thread reply the same with `?thread_ts={thread root}&cid={channel}`. This is the form Slack's own `chat.getPermalink` answers; building it avoids a call per entry inside a query.
- **AT13. The workspace URL.** The app records each workspace's URL once from `auth.test` (its `url` field, which needs no new scope) on the workspace's row. It is fetched by an action scheduled when the row lacks it, from the same mutations that already schedule directory work, and by a maintainer-run fill for existing workspaces. Until it is known, `permalink` is `null` and the website hides the link.

### The activity read

- **AT14. Whose.** The activity read answers only the signed-in member's own timeline: the kudos they received, the kudos they gave, and the levels they reached. It takes no member argument; `memberQuery` supplies the member from the session, never from arguments, so no one reads another member's timeline.
- **AT15. Kinds.** Each entry has a `kind`:
  - `kudosReceived`: one per award the member received (one award per message and recipient, R18).
  - `kudosGiven`: one per Given message the member wrote, holding every recipient of it.
  - `levelUp`: one per recorded level-up of the member (`levelUps`, one per level-reached event, P6's highest level when several are crossed at once).

  No other kinds in this spec. Unlocks opened, tiers earned and quests finished outside a kudos are left out until Michael asks; the union is open, and the website ignores a kind it doesn't know.
- **AT16. Order.** Newest first, by a total order: the entry's instant (`at`: the awards' spend instant for kudos, the level-up's instant for a level-up), then kind (`levelUp`, then `kudosGiven`, then `kudosReceived`, so a level-up sits above the kudos that caused it), then the creation order of the entry's first document. Two entries never compare equal.
- **AT17. Filter.** `all` (every kind), `received` (only `kudosReceived`), `given` (only `kudosGiven`). Level-ups appear only in `all`.
- **AT18. Pages.** A page holds at most `limit` entries (1 to 50, default 20). It answers a `cursor` for the next page, or `null` at the end. The cursor is opaque to the website and encodes the last entry's position in AT16's total order, so the next page starts strictly after it, even inside one instant. Each kind reads its own index from that position down (instant, then creation time), at most `limit` entries' rows each, and the read merges them. A given entry's awards are written together by one mutation, so they are adjacent in the giver's index and are read as one entry (at most one message's recipients, which the daily allowance bounds). A page's reads stay within Convex's limits whatever the data.
- **AT19. Indexes.** Additive indexes: awards by recipient and instant, awards by giver and instant, level-ups by member and instant, reward records by member and cause (AT25). No existing row changes shape.
- **AT20. The other person.** An entry names other members as `{ name, face }` by the same rule the leaderboard uses for other members (WS34: the directory's display name, else "A teammate"; the face from that name's initials). When the directory gains members' pictures (map #1's #234), the website map moves this face to it in the same follow-up as the leaderboard's. A member who left Slack shows as "A teammate".
- **AT21. Received entry.** `{ kind: "kudosReceived", key, at, giver, channel, saidWhy, permalink, message }`. Every kudos entry's `key` is a stable opaque string, unique within the member's timeline, for the website's list keys; it carries no ID the website can use elsewhere.
- **AT22. Given entry.** `{ kind: "kudosGiven", key, at, recipients, kudos, channel, saidWhy, permalink, message, earned }`, where `kudos` is the kudos each recipient got (`n`, R18).
- **AT23. Channel.** `{ visibility: "public" | "private" }`, from the kudos text row, and `private` when no row says otherwise. Channel names aren't read: the app has no `channels:read` scope, and the permalink opens the channel.
- **AT24. Said why.** `saidWhy` is the gate decision recorded with the message's awards when they were given (P11: 5 or more words besides mentions, emoji, channel links and URLs; spec #209 may later change what decides it): `true` or `false`, or `null` when no decision was recorded (kudos replayed by the progression backfill). It is history and never changes when the message is edited. The spotlight uses the stored revision's current gate decision instead (AT2, AT31). Copy follows P94 and P95: the website may say a kudos said why; it never calls one thoughtful.
- **AT25. Earned.** A given entry's `earned` is `{ xp, questsDone }` or `null`:
  - `xp` is computed by the same function the success reply's gains line uses (SW2, `giverXpOf` today: base XP), so the timeline and the reply always agree. It includes a perk bonus exactly when the gains line does (#222).
  - `questsDone` lists each weekly quest or Journey step this message finished, with its goal and reward XP (SW3).
    - A reward record written because a kudos message finished a quest or step now carries that message's ref as its **cause**, as an optional field.
    - The entry reads the giver's reward records by that cause.
    - Rewards finished by a recheck, an activation or a later counted instant without a causing message carry no cause, and attach to no entry.
    - Earlier records have no cause, so earlier kudos show no quests.
  - Each part follows the member's view at read time by the gains line's own rule (SW5): `xp` only while XP and levels are shown to the member; quests only while quests apply. `earned` is `null` when no part shows.
- **AT26. Level-up entry.** `{ kind: "levelUp", at, level }`, only while XP and levels are shown to the member (P76). A level-up recorded before `levelUps` existed has no entry: there is no backfill of level marks.
- **AT27. The message.** Each kudos entry carries `message`:
  - `{ kind: "text", segments, edited }` while the kudos text row exists and its author is a member (AT7);
  - `{ kind: "unavailable", reason }` otherwise, where `reason` is `"deleted"` (deleted in Slack, or edited so it is no longer a kudos message, AT5, AT6), `"removed"` (its author left, AT7, or a deletion request, AT8), or `"not-captured"` (given before capture shipped, and the backfill didn't fill it).

  A tombstone row of the message ref remembers why the words are gone (`deleted` or `removed`); no row means `not-captured`. The tombstone holds no words. Person and group segments are resolved for the reader by AT20's name rule and the user group's handle.
- **AT28. Who may read the words.** A member reads the words of exactly the kudos they gave or received, whatever the channel's visibility. A recipient of a private-channel kudos reads its words even if they aren't in that channel: the message is addressed to them, and the giver chose to thank them in writing. Nobody else reads them through any member read.
- **AT29. Time zone.** The activity read also answers the member's `timeZone` (the directory's), so the website draws day dividers in the member's own days.
- **AT30. The last few.** The recent read is the activity read with `filter` `received` or `given`, no cursor, and `limit` 1 to 10 (default 5). It answers the same entries.

### The spotlight

- **AT31. What qualifies.** A kudos message is **drawable** while all of these hold:
  - it is Given;
  - its kudos text row exists with visibility `public`;
  - its author is a member;
  - the stored revision's current gate decision says it said why (AT2), so an edit that drops the reason drops it from the draw;
  - neither the giver nor any recipient has left the leaderboards (G22).

  There is no age limit: every stored message qualifies for as long as it does. Drawability is kept up to date, not checked at read time:
  - The engine recomputes it whenever the message's state, newest revision or words change.
  - Turning `Show me on the leaderboards` off or on schedules a bounded, self-rescheduling job that recomputes it for every message the member gave or received.
  - The read checks the conditions again only as a guard for the moments before such a job finishes.
- **AT32. The draw.** Each drawable row holds a random draw position in `[0, 1)`, assigned when it becomes drawable and cleared when it stops being drawable, in an index by workspace and position. Every walk is bounded to positions `>= 0`, so rows without a position are never read.
  - The read takes either a `seed` in `[0, 1)` (the first draw, which the website picks per page load) or an `after` cursor (Next).
  - The cursor is opaque. It encodes the shown entry's draw position and row ID, so it survives that row being deleted, and it carries no workspace (the read always uses the signed-in member's).
  - The read answers the first drawable row at or after the seed, or strictly after `after` in (position, ID) order, wrapping to the start.
  - Next therefore walks every drawable message once before any repeat, and never shows the same message twice in a row unless only one qualifies.
  - While the guard (AT31) rejects rows, the read skips at most 25. Past that it answers the next row's cursor as `{ kind: "skipped", after }` for the website to call again; it answers `empty` only when the walk has wrapped without finding a row.
- **AT33. The answer.** `{ kind: "empty" }`, `{ kind: "skipped", after }` (AT32), or `{ kind: "kudos", after, at, giver, recipients, permalink, message }` with AT20's people, AT12's permalink and AT27's text message (a drawable row always has words). `after` is the cursor for Next.
- **AT34. Whose workspace.** The spotlight reads only the signed-in member's workspace.

### Backfill

- **AT35. Earlier kudos.** A maintainer-run, resumable action fills the words of every Given message that has neither a kudos text row nor a tombstone.
  - **Fetching.** It fetches each message from Slack by exact `ts`:
    - a thread reply through `conversations.replies` on the stored thread root, with `oldest` and `latest` both the reply's `ts`, `inclusive`;
    - any other message through `conversations.history` with `oldest` and `latest` both its `ts`, `inclusive`, `limit` 1.
  - **Exact match.** A message counts as found only when its `ts` equals the target's. When Slack answers successfully without it, the action writes a `deleted` tombstone. Permission or transient errors leave the message `not-captured` for a later run.
  - **Hydration.** It turns the message into segments through the same adapter function as live events and hands them to a separate engine operation, **hydrate**, never to `observe`. In one mutation, hydrate stores the words with `unknown` visibility (AT3) only if all of these hold:
    - no row or tombstone exists for that message;
    - the message is Given;
    - the fetched revision is at least the engine's newest revision for it;
    - its author is still a member;
    - the revision still parses as a kudos message.

    Hydrate never evaluates, awards or replies.
  - **Pacing.** It paces itself under Slack's Tier 3 limit, honours `Retry-After` through the existing rate-limit table, and its job arguments carry only message refs and the cursor.
- **AT36. Run once, at ship.** The ship runs the backfill on the sandbox and on production once after the merge. It is safe to run again. Backfilled words fill timelines; they never reach the spotlight (`unknown` visibility), which fills from kudos captured live.
### Flag and shipping

- **AT37. One flag.** Every read in this spec answers `{ kind: "not-found" }` while the `activity` flag is off for the signed-in member: the member decision (F16), read without an exposure, as every website query reads flags. It sits behind `memberQuery`'s own guard (the `website` flag), so a closed website still answers `closed`.
- **AT38. Who sees it.** Under decision 18, `activity` stays on in the sandbox and for Michael's email only, until Michael turns it on for everyone. The flag already exists in PostHog; this spec adds no gate ticket.
- **AT39. Production is unchanged for members.** With `activity` off, every website read answers as today and every Slack message members see is byte-for-byte today's. The only production changes are behind the scenes: storing kudos text (AT10), one `auth.test` call per workspace (AT13), and the backfill's Slack reads at ship (AT36).
- **AT40. The R51 test.** The core loop test that proved no text at rest becomes the oracle of AT1 and AT11:
  - an ordinary chat message's text is in no table and no job;
  - a kudos message's words are only in the kudos text table and in no job's arguments;
  - deleting the message, editing it away, or its author leaving leaves them nowhere;
  - with capture on, a forced failure in the events mutation and in hydrate leaves no words in the analytics outbox, a captured exception or the console output.
## The contract for the website (#233)

Three public queries, each built on `memberQuery`, each answering `Denial` first (closed, signed out, verifying, unverified, not a member) and then `{ kind: "not-found" }` while `activity` is off. These names and shapes are what the website renders against; they came from the website conductor's request and answer it as follows:

- The website's `recentKudosOf` is `getRecentKudos`.
- `activityOf` is `getActivity`.
- `messageOf` is not a separate read: every kudos entry carries its `message`, because the words are now stored.
- The random leaderboard message is `getSpotlight`.

```ts
type Person = { name: string; face: Face }; // Face as getMyProfile and getLeaderboard answer it

type Segment =
  | { kind: "text"; text: string; bold?: true; italic?: true; strike?: true; code?: true }
  | { kind: "person"; name: string }
  | { kind: "group"; handle: string }
  | { kind: "channel" }
  | { kind: "broadcast"; range: "here" | "channel" | "everyone" }
  | { kind: "emoji"; name: string; unicode?: string }
  | { kind: "link"; url: string; label?: string }
  | { kind: "break" };

type Message =
  | { kind: "text"; segments: Segment[]; edited: boolean }
  | { kind: "unavailable"; reason: "deleted" | "removed" | "not-captured" };

type Channel = { visibility: "public" | "private" };

type QuestDone = { kind: "weekly"; goal: string; xp: number } | { kind: "journey"; goal: string; xp: number };

type KudosReceived = {
  kind: "kudosReceived"; key: string; at: number;
  giver: Person; channel: Channel; saidWhy: boolean | null; permalink: string | null; message: Message;
};

type KudosGiven = {
  kind: "kudosGiven"; key: string; at: number;
  recipients: Person[]; kudos: number; channel: Channel; saidWhy: boolean | null; permalink: string | null; message: Message;
  earned: { xp: number | null; questsDone: QuestDone[] } | null;
};

type LevelUp = { kind: "levelUp"; at: number; level: number };

type ActivityEntry = KudosReceived | KudosGiven | LevelUp;

// getActivity({ filter: "all" | "received" | "given", cursor: string | null, limit?: number /* 1–50, default 20 */ })
type Activity = { kind: "activity"; entries: ActivityEntry[]; cursor: string | null; timeZone: string | null };

// getRecentKudos({ direction: "received" | "given", limit?: number /* 1–10, default 5 */ })
type RecentKudos = { kind: "recent"; entries: Array<KudosReceived | KudosGiven> };

// getSpotlight({ seed: number /* [0, 1) */ } | { after: string })
type Spotlight =
  | { kind: "empty" }
  | { kind: "skipped"; after: string } // call again with { after }
  | { kind: "kudos"; after: string; at: number; giver: Person; recipients: Person[]; permalink: string | null; message: Extract<Message, { kind: "text" }> };

// Every answer is also `Denial | { kind: "not-found" }`.
```

**What the website does with it** (its spec #233 owns the UI): the profile card calls `getRecentKudos` and switches `direction`; the activity tab calls `getActivity` with `cursor` for infinite scroll and draws day dividers in `timeZone`; the leaderboard page calls `getSpotlight({ seed })` once per page load and `getSpotlight({ after })` for Next, calling again at once on `skipped`; it hides a link whose `permalink` is `null`; it renders segments as plain text with mentions and emoji, never as HTML; it ignores an entry `kind` it doesn't know; it never calls a kudos thoughtful (P95).

## Implementation Decisions

- **The Slack adapter** gains one pure function that turns a Slack message's rich text into segments (AT2), used by live events and the backfill. `messageEventOf` adds the segments and the visibility to the `MessageEvent` it hands the engine, beside today's countable content; `message_deleted` (and a tombstone `message_changed`) normalizes to a new `deleted` event for the engine instead of `null`. The HTTP action passes it to the same one mutation that records the receipt, so the words still never sit in a job.
- **The engine** owns the kudos text, because only the engine knows whether a revision is a kudos message and which revision is newest. `observe` writes or deletes the row in the same mutation that records the revision (AT1, AT4, AT5), with the current gate decision from the annotations it already computes for every revision. It handles the `deleted` event (AT6) and recomputes drawability on every state change (AT31). The row and its tombstone live in one new table keyed like `kudosMessages`. A small module of the engine is the only writer. It also offers `hydrate` for the backfill (AT35), and the reads the website module needs: words by message ref, and the draw index walk.
- **The directory** schedules the engine's bounded "forget the words this member authored" job when it records a deactivated member as no longer a member (AT7). The maintainer functions (AT8) start the same job. The reads suppress a non-member author's words at once, so the job's duration never shows them.
- **Leaderboard settings:** the `Show me on the leaderboards` switch schedules the engine's bounded drawability recompute for that member's messages (AT31).
- **Rewards:** reward records gain an optional `cause` (the finishing message's ref), written by the quest and Journey finish paths when a kudos message finishes them, with an index by member and cause (AT25). Existing records are unchanged.
- **The analytics boundary** reports exceptions from the word-carrying functions (the events mutation, hydrate, the kudos text module) with a fixed message (AT11).
- **The workspace** row gains an optional `url` (AT13). A Slack action fills it from `auth.test`.
- **The activity module** is a new deep module beside the website reads, owning the merge of kinds, the cursor, the page bound and the entry shapes (AT14–AT30). It reads awards, effects records, reward records, level-ups and the kudos text through their own modules' exported reads, never their tables. It has one public seam for the website module: `activityOf(member, { filter, cursor, limit })`, `recentKudosOf(member, { direction, limit })`, `spotlightOf(workspace, { seed } | { after })`. The website module wraps them in `getActivity`, `getRecentKudos` and `getSpotlight` on `memberQuery` with the `activity` check, and declares the three as entrances in its component spec.
- **Progression** exports the gains line's view check (SW5) as a query-safe function, so the activity module and the reply share it. `earned.xp` uses the existing giver XP function (SW2).
- **Flag:** an `activity` flag declaration (`safeDefault: false`) beside the other flag declarations, read with the member decision.
- **Lexicon:** settle **kudos text** (the stored words of a kudos message's newest revision, the only message text stored), **activity** (a member's own timeline of kudos received and given and levels reached), **permalink** (Slack's link to one message, built from the workspace URL), and **spotlight** (one drawable kudos shown on the leaderboard page); amend **kudos message** to say its words are kept while it is one.
- **Coherence:** replace the R51 test with an invariant "only kudos messages' text is stored" (AT1, AT40) in the engine's component spec; add invariants "a member's activity holds only kudos they gave or received" (AT14, AT28) and "the spotlight draws only public, said-why kudos of the member's workspace" (AT31, AT34); declare the three new queries as browser entrances.

## Testing Decisions

- **Good tests** drive the system from the outside: signed Slack events through the HTTP router with `convex-test`, Slack and PostHog stubbed at `fetch`, then the website's public queries called with a signed-in identity, asserting what the member sees. They never assert on internal tables, except the one invariant that by definition is about what is stored (AT40).
- **Kudos text** (Slack boundary):
  - a kudos message's words come back from `getActivity` as segments in order;
  - an edit replaces them and marks `edited`;
  - editing the emoji away answers `deleted`;
  - a real-shaped `message_deleted` payload (no `channel_type`) answers `deleted`, a later edit stores nothing, and a deletion that arrives before its post wins;
  - an ordinary message's text and its deletion are in no table and no job;
  - a deactivated author's words answer `removed` at once and are purged;
  - the maintainer deletion empties a workspace;
  - AT40's forced failures leak nothing. Prior art: `convex/slack/kudosMessages.test.ts` (the R51 test), `edits.test.ts`, `unknownPeople.test.ts`.
- **The activity read** (website boundary): received, given and level-up entries in AT16's total order; paging with `limit` 1 through many entries sharing one instant repeats and skips none; the filters; a given message to three people is one entry with three recipients; `earned` equals the gains line of the same kudos and disappears with `xp-levels` off for the member; `not-found` with `activity` off; another member's kudos never appear. Prior art: `convex/website/leaderboard.test.ts`, `profile.test.ts`, `convex/slack/gainsLine.test.ts`.
- **The spotlight:**
  - only public, given, said-why messages are drawn;
  - an edit that drops the reason drops the message;
  - Next walks all without an immediate repeat and wraps, and a deleted shown row's cursor still advances;
  - a member who left the leaderboards leaves the draw once the job ran, and the guard answers `skipped` meanwhile;
  - `empty` with none.

  Prior art: `leaderboard.test.ts`.
- **Permalinks:** the exact URL for a top-level message and a thread reply, and `null` before the workspace URL is known. Prior art: `deepLinks.test.ts`.
- **The backfill:** a stubbed `conversations.history` and `conversations.replies` fill words with `unknown` visibility. A history answer holding only an earlier message gets `deleted`, never that message's words. A `ratelimited` answer waits for `Retry-After`. Hydrate refuses a message with a newer revision, a tombstone or a non-member author. Prior art: `userGroups.test.ts`, `delivery.test.ts`.
- **Limits:** a page reads at most its bound under `testBackend({ transactionLimits: true })`; the deletion jobs page under Convex's write limits.

## Out of Scope

- **Posting the random top three messages each week** (Michael: "Don't build this feature").
- The website's UI: the profile card, the activity tab, the timeline and the spotlight panel (website map, #233).
- Unlocks opened, tiers earned and quests finished outside a kudos as timeline kinds (AT15).
- Channel names (needs the `channels:read` and `groups:read` scopes and a manifest re-paste).
- Following a public channel that is later made private: its stored rows keep `public` (accepted risk; a follow-up can subscribe to `channel_converted_to_private`).
- Backfilling level-up marks from before `levelUps` existed.
- Other members' timelines, and any write action on an entry (reacting, replying).
- Moving spec #209's classifier to read the stored words.

## Review

A GPT-6.1 Sol review (high) of `a437599` found 2 blockers, 9 majors and 2 minors. All 13 were fixed here:

1. **Blocker: an instant isn't bounded.** Pages now use a total-order cursor that can continue inside one instant (AT16, AT18).
2. **Major: `at` equality doesn't prove which message finished a quest.** Reward records now carry an optional `cause` (AT25).
3. **Major: the gains line is base XP only.** `earned.xp` now uses the gains line's own function, so the two never diverge (AT25).
4. **Major: the historical and the current gate decision were conflated.** The kudos text keeps the current decision, and the spotlight uses it (AT2, AT24, AT31).
5. **Blocker: `message_deleted` has no `channel_type` and is dropped before the engine.** Deletions are now routed explicitly, and tombstones are terminal even when a deletion overtakes its post (AT6).
6. **Major: removed words could be recaptured, and a purge could be unbounded.** Tombstones are now sticky, a departed author's words are suppressed at once, and purges are paged jobs (AT4, AT7, AT8).
7. **Major: errors and logs weren't covered.** Fixed messages and log codes, the boundary's handling, native reporting, and an oracle with forced failures (AT11, AT40).
8. **Major: the history lookup could return an earlier message.** The backfill now fetches by exact `ts` and treats only a successful miss as deleted (AT35).
9. **Major: the backfill can't go through `observe`.** A separate, revision-safe `hydrate` handles it (AT35).
10. **Major: the 25-row skip could starve the draw.** Drawability is now kept up to date on leaderboard switches, and the guard answers `skipped` with a cursor instead of `empty` (AT31–AT33).
11. **Major: Next had no durable cursor.** The cursor now holds the position and row ID (AT32).
12. **Minor: an optional field isn't a sparse index.** Every walk is now bounded to positions `>= 0` (AT32).
13. **Minor: the rollout wording contradicted the backfill and `auth.test`.** AT36 and AT39 were reworded.

The website conductor accepted the contract at `a437599`. The changes since then are `skipped` and the `after` cursor in place of the spotlight's `key`, and it was told.

## Further Notes

**Michael's decisions, verbatim.**

1. The activity feed (2026-10-14, in map #1's conductor thread): "And one important feature of the Mist is an activity feed or something where it lists briefly the last few kudos someone received, and you can switch over to Given. Then you can go deep into a tab on your page to see your activity feed: the kudos you've received, with the nice message and deep link to Slack, and also the kudos you've given, noting the experience and so on. Maybe like a timeline view where you can also see your level-up marks in this infinite-scroll timeline. Make it nice. Use Opus 55. Just Fable for spot check, and then I will iterate as we go when it's deployed." ("the Mist" reads as "the website"; "Opus 55" is Opus 5.5.)
2. Storing kudos text (2026-10-14, relayed by the conductor): "We should maybe change this and actually store the messages with a link to check if they've been edited, so that we can also show a nice random message on the leaderboard page and also allow posting us the random top three messages in a week or something. Don't build this feature. Store the message text and add a random message to the leaderboard as well, where you can click Rotate or Next. I revert my decision to not store any kudos messages. Any other messages that don't match the kudos one should not be stored."

**The calls taken at recommendation** are listed with their journal ids in the resolution on #232.

**Casting.** The build tickets run on Opus 5.5 (high); reviews on GPT-6.1 Sol (high). Michael spot-checks the UI with Fable on the website side and iterates once it is deployed.
