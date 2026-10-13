# Spec: the core kudos loop on Slack

> **Draft for approval on [#12](https://github.com/Silthus/kudos/issues/12), map [#1](https://github.com/Silthus/kudos/issues/1).** This file lives on the branch `docs/spec-core-loop` and is never merged. Once Michael approves it, it is published as a `wayfinder:spec` issue under #12, and the rules reach the repository through Coherence with the implementation slices (see "Where the spec lives").
>
> Sources: the rules from the core loop grilling ([#8 handoff](https://github.com/Silthus/kudos/issues/8)), the accepted architecture ([#11 handoff](https://github.com/Silthus/kudos/issues/11), [brief](https://github.com/Silthus/kudos/blob/prototype/architecture/prototype/architecture.md) §3 and §12), the four research reports linked from the map, ADR-0001 and the Coherence lexicon.

## Problem Statement

A team on Slack wants to thank each other often and lightly, inside the conversation where the help happened. Today there is no Kudos app running: the old deployment is shut down, and nothing on `main` turns a thank-you into recognition. A teammate who writes "thanks @Alice :taco:" gets nothing back, nobody keeps a record, and there is no budget that keeps kudos meaningful.

## Solution

A member writes a normal Slack message in a channel the app is in, mentions one or more teammates and adds the kudos emoji (`:taco:` by default). Every recipient gets one kudos per kudos emoji, paid from the giver's daily allowance (3 a day by default, reset at the giver's local midnight). The app answers right beside the message: the kudos emoji as a reaction when kudos were given, an hourglass when the giver doesn't have enough left, a red X when nobody in the message can receive kudos, and a private line that says what happened and how many kudos are left. A message that didn't give kudos can be fixed by editing it. Awards are permanent. It runs on a Convex deployment connected to a new Slack app, first in a sandbox workspace and then in the real one.

## User Stories

**Giving**
1. As a member, I want to thank a teammate by mentioning them and adding the kudos emoji in a normal message, so that recognition happens where the work happened.
2. As a giver, I want several teammates in one message to each receive the kudos, so that I can thank a group of helpers at once.
3. As a giver, I want to give more than one kudos to each recipient by repeating the kudos emoji, so that I can show how much the help meant.
4. As a giver, I want the cost to be recipients × kudos emoji, so that I can predict what a message spends.
5. As a giver, I want to see the kudos emoji appear as a reaction on my message when kudos were given, so that I know it worked without reading anything.
6. As a giver, I want a private line telling me who got how many kudos and how many I have left today, so that I can plan the rest of my day.
7. As a giver, I want to be told when that was my last kudos for today and how many I get at midnight, so that I know when I can give again.
8. As a giver, I want my daily allowance to reset at midnight in my own time zone, so that "today" means my day.
9. As a giver, I want kudos in a thread reply to work like kudos in the channel, so that I can thank people where the discussion is.
10. As a giver in a thread, I want the private line inside the thread, so that the feedback stays next to my message.
11. As a giver, I want a thread reply that I also send to the channel to count once, so that I don't pay twice.
12. As a giver, I want mentioning the same person twice to count once, so that a typo doesn't cost me double.
13. As a giver, I want my kudos emoji inside code, quotes or struck-through text not to count, so that I can talk about kudos without giving them.
14. As a giver, I want a message with the kudos emoji but no mention, or a mention but no kudos emoji, to be treated as ordinary chat, so that the app stays quiet when I'm not giving.

**Being told no**
15. As a giver, I want a message that costs more than I have left to give nothing at all, so that kudos are never split arbitrarily.
16. As a giver over my allowance, I want an hourglass on the message and a private line with the cost, what I have left, and how to fix it, so that I can edit it or wait.
17. As a giver, I want a message where nobody can receive kudos to get a red X and a private line with the reasons, so that I can tag the right person.
18. As a giver, I want to be told privately which mentions were skipped and why (myself, a bot, a group or `@here`, someone who isn't an active member), so that I'm not surprised the count is lower.
19. As a giver, I want the other recipients to still get their kudos when some mentions are skipped, so that one wrong tag doesn't spoil the message.

**Editing**
20. As a giver, I want to fix a message that gave nothing by editing its mentions or kudos emoji, so that I don't have to repost it.
21. As a giver, I want a successful retry to swap the hourglass or red X for the kudos reaction, so that the message shows what finally happened.
22. As a giver, I want removing the kudos emoji from a failed message to withdraw it and clear its reaction, so that I can back out.
23. As a giver, I want a retry to spend from the day of the edit, so that editing after midnight uses the new day's allowance.
24. As a giver, I want an edit that only fixes a typo to change nothing, so that tidying up doesn't re-trigger anything.
25. As a giver, I want editing a message that already gave kudos to change nothing, and to be told so when I changed the mentions or kudos emoji, so that I know to send a new message.
26. As a recipient, I want kudos I received to stay mine when the giver edits or deletes the message, so that recognition doesn't vanish (ADR-0001).

**Robustness**
27. As a giver, I want a message never to give kudos twice, however often Slack redelivers it or I edit it, so that the record is right.
28. As a giver, I want a message whose recipients Slack can't confirm right now to give later, on the day I posted it, so that a Slack hiccup doesn't lose my kudos.
29. As a giver, I want such a message to stay silent if it can never be confirmed, so that I'm not told something wrong.
30. As a giver, I want the reaction on my message always to match what happened, even when delivery was retried, so that I never see an hourglass beside given kudos.
31. As a giver, I want a failed feedback delivery never to change my kudos, so that a Slack outage can't double-spend or double-award.

**Channels**
32. As a member, I want to add the app to a public channel by typing `/kudos` there, so that my team can give kudos in it.
33. As a member in a private channel, I want `/kudos` to tell me how to invite the app, so that I know what to do.
34. As a member, I want kudos in DMs and group DMs to be ignored, so that private conversations stay private.
35. As a member of a shared channel, I want only people of my own workspace to give and receive, so that external guests don't use our allowance.

**Workspace and operations**
36. As a workspace, I want the base allowance (3) and the workspace emoji (`:taco:`) as settings with defaults, so that an admin surface can change them later without a migration.
37. As a workspace, I want settings changed mid-day to apply from the next evaluation, so that a lower base or a new emoji behaves predictably.
38. As Michael, I want the app installed into a sandbox workspace first, on its own deployment, so that I can prove it before the real install.
39. As Michael, I want only signed Slack requests to reach the domain, so that nobody can forge kudos.
40. As Michael, I want message text never stored, so that data deletion and the public repository stay simple.
41. As a later module (progression, achievements, leaderboard), I want a `kudosGiven` domain event with the awards and allowance facts, so that I can react without the engine knowing me.
42. As a later module, I want parse hooks and a perks hook, so that I can add unlocked kudos emoji and allowance bonuses without changing the engine.

## Rules

Each rule is a testable statement. The tests name the rule (`R7`). "Spec 1" means this spec: it registers no perk contributors and only the workspace emoji parse hook.

### Kudos messages

- **R1. Countable content.** Only the message's own rich text counts. Mentions and emoji inside inline code, code blocks, quotes, struck-through text, attachments, file shares and forwarded messages don't count.
- **R2. Kudos message.** A message is a kudos message when its countable content has at least one mention and at least one kudos emoji of its author. A new message that isn't one is ordinary chat: no reaction, no reply, nothing stored. An edit to a message the app already tracks follows the edit rules (R21–R24), which may record its revision or withdraw it.
- **R3. Kudos emoji.** A giver's kudos emoji are the workspace emoji (`:taco:` unless changed) plus whatever the registered parse hooks add for that giver (spec 1: none). Each occurrence counts its value (spec 1: 1). An emoji outside the giver's set is ordinary chat. When two parse hooks claim the same emoji, the highest value counts (D15).
- **R4. Per recipient and cost.** Each recipient receives the sum of the kudos emoji values in the message (`n`). The cost is recipients × `n`.
- **R5. Only messages by members.** Messages authored by bots (including Slackbot and the app itself) and by people who aren't members are ignored. A member is an active human of the installed workspace, guests included; bots, deactivated people and people from another workspace (Slack Connect) are not members.
- **R6. Where.** Public and private channels the app is a member of, including thread replies, count. DMs and group DMs are ignored. In a shared channel only members of the installed workspace give and receive.
- **R7. Thread broadcasts.** A thread reply also sent to the channel is one message: it is evaluated once, and its feedback goes into the thread.

### Recipients

- **R8. Recipients.** Recipients are the individual mentions of members other than the giver, in the order they first appear. A person mentioned twice receives once.
- **R9. Skipped mentions.** The giver, bots (Slackbot and the app included), user groups, `@here`/`@channel`/`@everyone`, deactivated people and people from another workspace are skipped mentions. Everyone else still receives.
- **R10. Invalid.** A kudos message whose mentions are all skipped has the outcome Invalid.

### Allowance

- **R11. Daily allowance.** The opening daily allowance is the workspace base (default 3) plus the giver's daily bonus from the perks hook (spec 1: 0). What is left is the opening minus what the giver spent on that allowance day, never below 0. Nothing carries over.
- **R12. Allowance day.** The allowance day is the calendar date of the spend instant in the giver's Slack time zone, or UTC when the directory has no time zone. It turns at local midnight.
- **R13. Spend instant.** A posted message spends at its posted time, even when it is evaluated later (R29). A retry spends at the time of the edit. When the first event the app sees for a message is an edit, it spends at the time of that edit (D5).
- **R14. Weekly allowance (D19).** The weekly allowance is the giver's weekly bonus from the perks hook (spec 1: 0). Its week starts at Monday 00:00 in the giver's time zone and contains the allowance day. What is left is that size minus what was spent from it that week, never below 0.
- **R15. All or nothing.** When the cost is at most the daily left plus the weekly left, the outcome is Given: the daily allowance pays first and the weekly allowance pays the rest. Otherwise the outcome is Over allowance and nothing is spent. There are no partial awards.
- **R16. Settings at evaluation.** The settings in force when a message is evaluated apply, including for a retry and a late check. A base lowered below what a giver already spent leaves 0. A changed workspace emoji makes the old one ordinary chat from the next evaluation, also for a message waiting on a directory check (R29); existing awards don't change.
- **R17. One giver, one budget.** Two kudos messages of the same giver evaluated at the same time never spend more than the allowance: the second sees the first's spend.

### Awards and the domain event

- **R18. Awards.** A Given outcome writes one award per recipient with `n` kudos, the allowance day and the spend instant. Awards are only ever inserted, never changed or deleted (ADR-0001).
- **R19. At most once.** A message gives kudos at most once, whatever Slack redelivers, however often the giver edits it, and however often feedback delivery is retried.
- **R20. `kudosGiven`.** Every Given outcome publishes exactly one `kudosGiven` event in the same transaction as its awards, carrying the awards, the first kudos emoji in the message, the annotations, the allowance facts after the award (opening daily, daily left, weekly left), the allowance day and the spend instant. Spec 1 registers no subscribers.

### Edits and deletions

- **R21. Revisions.** Each message has ordered revisions (Slack: `edited.ts`, else the message `ts`). A revision at or below the newest seen for that message is ignored, including an original that arrives after its edit and a late edit that arrives after a newer one.
- **R22. Fingerprint.** An edit that leaves the recipients-relevant mentions and the kudos emoji unchanged is ignored, as is a change Slack makes without an `edited` block (thread metadata, unfurls).
- **R23. Retry.** An edit that changes the mentions or kudos emoji of a message that hasn't given kudos (no outcome yet, Over allowance, Invalid, or withdrawn) is evaluated as a new kudos message, whatever the message's age.
- **R24. Withdrawal.** An edit after which a message that hasn't given kudos is no longer a kudos message (no kudos emoji left, or no mention left) withdraws its attempt: its indicator is cleared and no reply is sent.
- **R25. Indicator swap.** A retry that gives kudos replaces the hourglass or red X with the kudos reaction. A retry that fails again shows the new outcome's indicator and reply.
- **R26. Accepted messages.** An edit to a message that gave kudos changes no award and spends nothing. When the edit changes the mentions or kudos emoji, the giver gets the accepted-message reply; otherwise nothing is sent.
- **R27. Deletions.** Deleting a message changes nothing and is never undone (ADR-0001). A message deleted while it waits for a directory check still gives when the check succeeds.

### Members the app can't check

- **R28. Directory.** The app keeps a directory of the workspace's people (member, bot or not a member, plus time zone). `team_join` and `user_change` keep it fresh, deactivation and time zone changes included. Eligibility is read from the directory at evaluation.
- **R29. Unknown people.** When the author or a mentioned person isn't in the directory, the message waits: nothing is given or spent, and the app looks the people up. It rechecks with successive delays of 1 min, 5 min, 30 min, 2 h and 6 h, so the checks fall 1, 6, 36, 156 and 516 minutes after the first miss (D6). When the lookup succeeds, the message is evaluated with the spend instant of the revision that waited (R13): the posted time for a post, the edit time for a retry.
- **R30. Abandoned.** When the last recheck still can't confirm everyone, the message is abandoned: no reaction, no reply, nothing spent.
- **R31. Superseded.** A newer revision that arrives while a message waits is handled by the edit rules (R21–R24).

### Feedback

- **R32. Indicator.** A message carries at most one of the app's indicator reactions: the first kudos emoji the giver used for Given (never a check mark), `:hourglass_flowing_sand:` for Over allowance, `:x:` for Invalid, and none while waiting, after a withdrawal or after abandonment. The indicator is desired state: after any number of retried or late deliveries, the message shows exactly the latest one.
- **R33. Private replies.** Every reply is an ephemeral to the giver beside the message: in the thread for a thread reply, in the channel otherwise. There is no DM fallback. Recipients get nothing extra.
- **R34. Feedback is separate from awards.** A delivery that fails or repeats never re-runs an evaluation and never changes awards or allowance.
- **R35. Delivery retries.** Reactions are retried until the message shows the desired indicator, honouring `Retry-After`. A private reply is tried at most 3 times on any failure, including an unknown result, honouring `Retry-After` (D3); the worst case is a duplicate ephemeral only the giver sees. A delivery whose message or channel is gone (`message_not_found`, `channel_not_found`, the app removed from the channel) stops for good; awards and spending stay.

### Copy

- **R36. The copy.** The app speaks as "I", plain and short. Replies name the unit with the word "kudos", never the emoji. The numbers and the "edit to retry" instruction always stay.

| Reply | Text |
| --- | --- |
| Given | `{recipients} got {n} kudos from you. You have {left} kudos left today.` |
| Given, nothing left | `{recipients} got {n} kudos from you. That was your last kudos for today, and you'll have {daily} more at midnight.` |
| Given, with skipped mentions | the Given line, then one line per reason: `I skipped {mentions}: {reason}.` |
| Over allowance | `This needs {cost} kudos ({people} × {n} kudos emoji), but you have {left} left today. Edit the message to give fewer and I'll try again, or edit it after midnight when you have {daily} again.` |
| Invalid | `Nobody in this message can receive kudos: {reasons}. Tag a teammate and edit the message to try again.` |
| Accepted message edited | `This message already gave kudos, so your edit doesn't change them. To give more, send a new message.` |

| Reason | Text |
| --- | --- |
| self | `you can't give kudos to yourself` |
| bot | `bots don't receive kudos` |
| not a member | `{name} isn't an active member of this workspace` |
| group or broadcast | `@here, @channel and user groups don't receive kudos, so tag people individually` |

- **R37. Placeholders.** `{recipients}` and `{mentions}` list people as Slack mentions joined as `A`, `A and B`, `A, B and C`. `{people}` reads `1 person` or `{k} people`. `{n}` is the kudos per recipient, `{cost}` the total. `{left}` is the daily allowance left. `{daily}` is the giver's opening daily allowance (workspace base + daily bonus; spec 1: the base). `{reasons}` joins the distinct reasons with `, ` and ` and `.
- **R38. Weekly allowance in the copy (D19).** While the giver's weekly allowance size is 0 (always in spec 1), the copy is exactly the table above. When it is above 0, `You have {left} kudos left today.` becomes `You have {left} kudos left today and {weekly} bonus kudos left this week.`, the Over allowance line reads `but you have {left} left today and {weekly} bonus kudos left this week`, and the "nothing left" line shows only when both are 0.

### Getting into channels

- **R39. `/kudos` in a public channel.** The app joins the channel and replies privately: `I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on.` When it is already a member: `I'm already in this channel. Mention teammates with a kudos emoji to give kudos.`
- **R40. `/kudos` in a private channel the app isn't in.** It replies privately: `I can't join private channels by myself. Type /invite @Kudos here and I'll start counting kudos.`
- **R41. `/kudos` in a DM or group DM.** It replies privately: `I only count kudos in channels. Run /kudos in the channel you want me in.`

### Ingress and data

- **R42. Signed requests only.** Every Slack request is verified with the signing secret (HMAC-SHA256 over the raw body, timestamp within 5 minutes) before anything is parsed or stored. A request that fails gets 401 and records nothing.
- **R43. Acknowledge fast, once.** A verified event is acknowledged within 3 s. A redelivery of the same event (`team_id` + `event_id`) is acknowledged and does nothing. Receipts are kept for 7 days and then deleted daily; the revision check (R19, R21), not the receipt, prevents a second award.
- **R44. Internal domain.** Only HTTP routes are public. Every domain function is internal (L1).
- **R45. No text at rest.** Message text is never stored, neither in a table nor in a scheduled job's arguments. It reaches the parser in memory and is dropped (L4).

## Implementation Decisions

### Modules (spec 1 builds the blue part of the brief's map)

- **Slack adapter**, the only code that knows Slack: ingress (verify, normalize, accept), directory sync (`users.info`, `team_join`, `user_change`), delivery (reactions, ephemerals, rate limits), and the `/kudos` command.
- **Workspace**: settings with defaults and the members directory.
- **Kudos parser** with parse hooks; spec 1 registers the workspace emoji hook.
- **Kudos engine**: observe, recheck, the allowance (daily and weekly pools), awards, publishing `kudosGiven`.
- **Feedback**: the indicator as desired state, private replies as intents, and the copy (D4).
- **Event bus and hooks**: `publish`, the registry (empty subscriber list), the perks hook (no contributors), the parse hook list.

Each module's state is its own: the adapter owns receipts and delivery state; workspace owns settings and members; the engine owns kudos messages, awards and allowance spending; feedback owns indicators and private replies. One Convex deployment serves one workspace (D9), and every row still carries its workspace.

### Interfaces

These are the locked contracts from the architecture brief (§3), trimmed to the decision-rich parts. They come from the prototype on `prototype/architecture`.

**Chat adapter → kudos engine**

```ts
type MessageRef = { workspace: WorkspaceId; conversation: string; message: string };
type Mention = { kind: "person"; user: ChatUserId } | { kind: "group" } | { kind: "broadcast" };

type MessageEvent = {
  kind: "posted" | "edited";
  ref: MessageRef;
  threadRoot?: string;
  author: ChatUserId;
  revision: bigint;
  at: number;
  content: { mentions: Mention[]; emoji: string[]; text: string };
};

interface KudosEngine {
  observe(event: MessageEvent): Observation;
  recheck(ref: MessageRef): Observation;
}

type Observation =
  | { kind: "ignored"; why: "not-a-member" | "ordinary-chat" | "stale-revision" | "unchanged" }
  | { kind: "awaiting-directory"; users: ChatUserId[]; retryInMs: number }
  | { kind: "abandoned" }
  | { kind: "withdrawn" }
  | { kind: "already-given"; toldGiver: boolean }
  | { kind: "evaluated"; outcome: Outcome };
```

`ref` identifies the message, not the delivery. `content` holds only countable rich text (R1) and every emoji name, because only the parser knows a giver's kudos emoji. `observe` throws for no domain case, runs in one mutation and never calls the network.

**Chat message → kudos message (the parser)**

```ts
type ParseContext = { workspace: WorkspaceId; giver: MemberId | undefined };
type KudosMessage = {
  mentions: Mention[];
  kudosEmoji: Array<{ name: string; kudos: number }>;
  perRecipient: number;
  annotations: Record<string, string | number | boolean>;
};
type ParseHook = {
  name: string;
  kudosEmoji?(context: ParseContext): Array<{ name: string; kudos: number }>;
  annotate?(content: MessageContent, context: ParseContext): Annotations;
};
interface KudosParser { parse(content: MessageContent, context: ParseContext): KudosMessage | null }
```

`null` is ordinary chat. The engine stores the text-free content (the mentions, every emoji name in order) and the annotations, never the text. A recheck re-applies the kudos emoji hooks and the settings in force at that time to the stored content (R16); the annotate hooks, which need the text, are not rerun. The fingerprint that tells a retry from a prose edit is computed from mentions plus kudos emoji, never from annotations.

**Engine → workspace and perks (direct reads)**

```ts
interface Directory { lookup(workspace: WorkspaceId, user: ChatUserId): MemberFacts | undefined }
type MemberFacts =
  | { kind: "member"; member: MemberId; timeZone: string | undefined }
  | { kind: "bot" }
  | { kind: "not-a-member" };

interface Settings { of(workspace: WorkspaceId): { baseAllowance: number; kudosEmoji: string } }
interface Perks { of(giver: MemberId, day: DayKey): { dailyBonus: number; weeklyBonus: number } }
```

`undefined` means unknown, which parks the message (R29). `Perks` sums its contributors; spec 1 has none, so both bonuses are 0.

**Domain events**

```ts
type KudosGivenEvent = {
  type: "kudosGiven";
  workspace: WorkspaceId;
  message: MessageRef;
  giver: MemberId;
  awards: Array<{ giver: MemberId; recipient: MemberId; kudos: number }>;
  kudosEmoji: string;
  annotations: Annotations;
  allowance: { dailyOpening: number; dailyLeft: number; weeklyLeft: number };
  day: DayKey;
  at: number;
};
interface EventBus { publish(event: DomainEvent): void }
```

`publish` schedules each registered subscriber in the publisher's transaction (D12), so the jobs commit with the awards. A mutation subscriber then runs exactly once. A subscriber that calls the network is an action, which Convex runs at most once, so it runs through a retrying runner (the Workpool component); spec 1 has no subscribers, so Workpool is installed with the first action subscriber. Event shapes only grow by adding fields. Spec 1 publishes only `kudosGiven` (D14) to an empty registry.

**Engine → feedback → delivery**

```ts
interface Feedback {
  setIndicator(ref: MessageRef, indicator: { emoji: string } | null): void;
  replyPrivately(ref: MessageRef, threadRoot: string | undefined, to: ChatUserId, reply: Reply): void;
}
type Reply =
  | { kind: "given"; outcome: GivenOutcome; daily: number; weekly: number }
  | { kind: "over-allowance"; outcome: OverAllowanceOutcome; daily: number; weekly: number }
  | { kind: "invalid"; outcome: InvalidOutcome }
  | { kind: "accepted-message-edited" };
```

Written in the engine's mutation, delivered by an action afterwards. The feedback module renders `Reply` into text segments with member placeholders; the adapter turns placeholders into Slack mentions. The indicator row holds the desired reaction and a version; delivery reconciles the message's reactions to it, treating `already_reacted` and `no_reaction` as success. (`Reply` carries `daily` and `weekly` for R37–R38; the brief's `base` became `daily`.)

**Slack ingress**

```ts
type Normalized = { receiptKey: string; event: MessageEvent | null };
function normalize(envelope: SlackEnvelope): Normalized;
```

The receipt key is `team_id/event_id`; message identity is `(team, channel, message ts)`. `message_changed` reads the nested message. Bot-authored messages, DMs and deletions normalize to `null`. The HTTP action drops a new message with no mention or no emoji before any mutation, but always passes `message_changed`, because an edit can withdraw.

The HTTP action calls one mutation that records the receipt and runs `observe` in the same transaction, then acknowledges. That keeps the text out of every scheduled job's arguments (R45) and makes the receipt and the evaluation atomic. The mutation never calls the network, so the acknowledgment stays well inside 3 s; directory lookups and delivery are scheduled from it with text-free arguments. (The brief's map draws this as a direct call in the same mutation; its §4.1 sequence scheduled a separate step, which would have put the text into a job's arguments.)

### Data (sketch from the prototype)

`workspaces` (settings), `members` (directory, keyed by workspace and chat user id), `kudosMessages` (per message: revision, fingerprint, the parsed kudos message, spend instant, check count, state: watermark, awaiting-directory, abandoned, given, over-allowance, invalid, withdrawn), `awards` (insert-only), allowance spending per giver per day and per giver per week, `indicators`, `privateReplies`, `slackReceipts`. A watermark row is a small tombstone that keeps "newest revision wins" true when an edit arrives first or a message stops being a kudos message.

### The Slack app

- **Two single-workspace apps from one manifest template (D9)**: sandbox and real, each pointed at its own Convex deployment. The bot token and signing secret live only in that deployment's environment variables. No OAuth install flow, no installations table.
- **The manifest asks for every spec 1 scope up front** so the sandbox install never needs reauthorization: `channels:history`, `groups:history`, `reactions:write`, `chat:write`, `users:read`, `channels:join`, `commands`. Bot events: `message.channels`, `message.groups`, `team_join`, `user_change`. One slash command, `/kudos`, with escaping on. Routes: `/slack/events` and `/slack/commands`.
- **Sign in with Slack is not wired (D8).** Members are keyed by workspace and Slack user id, the OIDC `team_id` and `user_id` claims.
- **`/kudos` stays in the adapter.** Joining a channel is a platform capability, not a domain decision, so spec 1 doesn't build the D17 command registry yet; it arrives with the first domain command (spec 2). The `/kudos` copy is rendered by the feedback module like every other reply (D4).

### Deployments and pipeline

- The core loop lands slice by slice on an integration branch (proposed: `integration/core-loop`), each slice as a reviewed pull request with the gate green. The conductor's `ship` ticket merges it to `main`.
- The integration branch deploys itself to the sandbox deployment from GitHub Actions with a scoped deploy key on every push. `main` deploys to the real deployment the same way, wired by the `ship` ticket.
- Proposed reading of D9 against #15: two Convex projects, each with its own production deployment. #15 provisions the sandbox one; the `ship` ticket or #16 provisions the real one.

### Where the spec lives

This spec is the product spec: it becomes the `wayfinder:spec` issue under #12, and its rule numbers are what tests and tickets cite. Coherence's entry spec is a different thing: a structural reading of the code (components, entrances with handlers that must resolve, invariants with enforcement and a witnessed refutation), so it cannot be written before the code exists. `coherence query practice "adopt Coherence"` puts it right after the first components land. So:

- **Slice 1 writes the Coherence entry spec** (`Kudos.spec.md` with its trust levels), declares the `/slack/events` entrance by hand (Coherence doesn't detect Convex entrances), adds `convex/_generated` to `ignore`, and records a `coherence decide` that names this spec issue as the source of the core loop rules.
- **Each later slice adds its component spec and the invariants it makes true** (for example, awards are insert-only, every domain function is internal, no stored text), through the practice "declare a requirement" with a witnessed refutation.
- **Each slice settles the new terms it uses** in `lexicon.json`: directory, indicator, revision, domain event, hook, parse hook, annotation (from #11), and weekly allowance (new here). Existing definitions that assume one budget or one kudos per emoji are revised in the slice that first contradicts them: outcome and daily allowance (the weekly allowance), recipient, kudos emoji and kudos message (an emoji's value), and retry (spending from both allowances).

## Testing Decisions

- **A good test enters at a seam and checks what a member or a later module could observe**: the HTTP response, the Slack Web API calls made, the rows another module reads, the events published. It never reaches into private helpers or asserts on internal table layouts beyond the module's own interface.
- **Seams (L7), highest first:**
  1. **The Slack boundary.** Signed requests through the HTTP router with `convex-test`, and the Slack Web API stubbed at the global `fetch`. Covers R1, R5–R7, R22 (the `edited` block), R32–R35, R39–R45, and one end-to-end path per outcome.
  2. **The engine's internal functions** with a seeded directory and settings, entering with `MessageEvent` and reading `Observation`, the feedback intents, the awards and the published events. Covers the rule tables: R2–R4, R8–R31, R36–R38. The copy is tested here as rendered segments, without Slack.
- **Time is controlled** with fake timers; time zone cases include a giver east and west of UTC, a message just before local midnight, a retry after midnight, and a Monday boundary for the weekly allowance.
- **No text at rest (R45)** is checked against the application tables and the scheduled functions' arguments.
- **The weekly allowance and the copy variant (R14, R38)** are tested by registering a test perk contributor at the engine seam; production registers none.
- **Prior art:** none on `main` yet. The prototype's 15 scenarios (`prototype/architecture/scenarios.ts`) are the model for the edit, revision and delivery cases and should be ported as tests, not copied as code.
- **Sandbox checks are acceptance criteria**, run against the sandbox deployment and recorded on the slice's pull request:
  - Web Crypto HMAC verifies in a deployed HTTP action, and the acknowledgment stays under 3 s.
  - A `thread_broadcast` arrives as one event.
  - Struck-through and code-styled emoji carry `style` flags in rich text.
  - `message_changed` without an `edited` block covers metadata changes.
  - A thread ephemeral reaches the giver.
- **The gate** (`pnpm gate`: typecheck, tests, Coherence spec and lexicon checks) is green on every slice.

## Out of Scope

- Progression (XP, levels, unlockable messages and emoji, achievements, perks, quips) and the D10/D11 questions: spec 2. Spec 1 builds only the seams they plug into. The locked rules spec 2 and 3 inherit from #11 stay in force: a module needing another's derived state subscribes to its events (L10), one public reply per kudos message as desired state (D18), progression uses the `day` on `kudosGiven` (D20) and is a pure reducer over domain events (D21), and interactions route through a command registry (D17).
- The team leaderboard, App Home and the profile: spec 3.
- The go-live in the real workspace: #16 and the conductor's `ship` ticket.
- An admin surface for the base allowance and the workspace emoji, an admin reversal of awards, observability, and data deletion when someone leaves.
- Giving by user reaction, group super kudos, auto-joining every public channel, DMs, a web UI, Sign in with Slack, a second chat platform, a multi-workspace distributed app, migrating kudos-garden data.

## Further Notes

- **Changes to #8 carried here:** the weekly allowance (D19, R14, R15, R38) and `{daily}` in place of `{base}` in the copy; both read exactly as #8 while bonuses are 0.
- **Calls this spec makes (each open to Michael's veto):** the `/kudos` copy (R39–R41, not grilled); withdrawal also when the last mention is removed (R24; #8 named only the emoji); the weekly line appears only when the weekly allowance is above 0 (R38); the D17 registry deferred to spec 2; receipt and evaluation in one mutation so text never sits in a job (R45); the deployment and pipeline reading above.
- **Follow-ups outside this spec:** #15 should be blocked by slice 1, because it installs the app from the manifest slice 1 writes, and its first deployment of slice 1 is a manual deploy (slice 2 automates it). The `ship` ticket owns the real deployment, the `main` deploy workflow and the merge of the integration branch.
