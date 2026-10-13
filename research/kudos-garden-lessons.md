# Lessons from the archived kudos-garden

## Context

Research for [Silthus/kudos issue #4](https://github.com/Silthus/kudos/issues/4), read on 2026-10-13. The source snapshot is `Silthus/kudos-garden@bf4890b612d94bba428c7f432849a2946e813e10`. Source links below are pinned to that commit and require access to the private archive. This public note contains rules and code findings, no workspace records or customer information.

**Recommendation:** keep the emoji-to-recognition loop, transactional allowance accounting, durable attempts, useful private guidance, and pure progression calculations. Rebuild delivery recovery and message eligibility deliberately. The archive supplies implementation evidence, not the restart's product decisions. [D1][D2][D3][S1][M1][P1]

This investigation follows the domain, Slack events, and message catalogue requested in #4. It excludes the game world, gardens, rendering, quests, store, and cosmetics. Quest-related constants and the two existing ADRs are cited only where needed to explain XP qualification, catalogue scope, and recognition's separation from other balances. The destination and architecture constraints come from the [map](https://github.com/Silthus/kudos/issues/1).

Evidence labels used below:

- **Implemented:** observed in source at the pinned revision.
- **Test evidence:** an archived test explicitly covers the behavior; this does not establish a production incident.
- **Gap / inference:** a consequence of the observed code path, not a claim that it happened in production.
- **Proposal / question:** an input to the forthcoming grilling or prototype, not a locked decision.

## Rules the archive implemented

### Giving and allowance

1. **One emoji gives one kudos to each distinct eligible mention.** Two emojis and two eligible teammates give each teammate two kudos and consume four allowance units. User mentions accept Slack-shaped `U` and `W` IDs and optional labels, deduplicate repeated mentions, and preserve encounter order. Emoji matching escapes regex characters, handles adjacent shortcodes and skin tones, and does not match longer names merely containing the configured name. [D1][T1]
2. **Group mentions never expand into recipients.** `@here`, `@channel`, `@everyone`, and user groups are recognized separately. With no individual recipients they produce group guidance; with eligible individuals alongside them, those individuals can still receive. [D1][D2][D3]
3. **Eligibility is filtering, not blanket rejection.** Self, excluded IDs, known bots, and deactivated members are removed. A self mention alongside eligible teammates still rewards the teammates. An attempt with nobody eligible is invalid; a bot or deactivated giver is ignored. The entire eligible request is rejected if it exceeds the remaining allowance, without a partial award. [D2][T2]
4. **Allowance belongs to a workspace day.** Remaining allowance is derived from the giver's daily usage and the workspace's configured limit, clamped at zero. The archive additionally reserves allowance for an excluded feature; the restart need not inherit reservations. Giving writes one recognition row per recipient, their daily and lifetime totals, the giver's totals, and rollups in the calling mutation. [D2][D4][D9]
5. **Old defaults are evidence, not a restart configuration.** New archived installations use a standard `seedling` emoji, daily allowance 5, `Europe/Berlin`, received visibility `self`, reactions disabled, and giver/receiver notifications enabled. Do not silently inherit the timezone, emoji, or visibility choices. [D5]
6. **Award time is processing time.** Slack ingestion passes `workspaceNow(workspace)` to the engine; it does not derive the allowance day from the original message timestamp. A failed message repaired after midnight uses the day on which the repair is processed. This makes first delivery delayed across midnight a product question too. [D3][D4][D6]
7. **Recognition is distinct from XP and spendable balances.** ADR 0002 supersedes ADR 0001's received-kudos balance design and retains given/received kudos as statistics constrained by allowance. Keep that conceptual separation without bringing the excluded currency or store back. [A1][A2]

Calendar views use workspace-local day keys with Monday-start ISO weeks and aligned months, quarters, and years. `resolvePeriod` distinguishes the current period to date, the full period, the full previous period, and the previous period to the same day offset, clamped to its end; all-time has no previous comparison. Local midnight calculation handles DST, including skipped midnight. **Keep:** day-key arithmetic and explicit calendar periods for allowance and leaderboard consistency. The full comparison/reporting surface need not ship in the first core loop. [D4][D8][T8]

### Attempts and edits

- **An attempt has identity and an outcome.** `kudosAttempts` is looked up by workspace, channel, and original message timestamp. Outcomes are `given`, `limit`, or `invalid`; ignored events do not necessarily produce an attempt. Given uses the configured emoji reaction, limit uses an hourglass, invalid uses a cross, with a checkmark fallback if Slack rejects the configured reaction name. [D3][D6][S2]
- **Failed attempts can be repaired by an author edit.** The same attempt record is re-evaluated against current allowance and updated rather than appended. Both failure reactions are considered for cleanup, because the stored reaction can lag a partially completed Slack swap. [D6][T3]
- **Accepted kudos are immutable under edits.** Changing recipients or emoji quantity after success produces private guidance without rewriting awards. A prose-only change is silent; semantic equality compares emoji amount, individual recipients irrespective of order, and group-mention presence. Without previous text, an accepted edit is silent because the code cannot distinguish a typo repair. [D1][D6][T3]
- **Edits do not create a first attempt.** Adding the kudos emoji to a message that never had an attempt is ignored. Removing the emoji from a failed attempt gives an ignored result rather than clearing that attempt. These are important limits of the old edit-to-retry behavior. [D6][T3]
- **Edit ordering has a high-water mark.** Previously handled edit timestamps suppress repeat or older edits, compared with integer microseconds rather than floating-point timestamps. However, the mark is only persisted on a given outcome or another judged attempt, which leaves a cancellation hole described below. [D6]
- **An everyday emoji can be ordinary chatter.** For a fixed set of common emoji, no individual mention means no attempt, reaction, or guidance; other configured emoji still produce no-mention guidance. This avoids treating every casual heart or seedling as a failed award, but the hard-coded list is a policy choice. [D7][T4]

## Slack handling worth retaining, and traps to avoid

### Retain the established behavior

- **Verify the raw body before interpreting it.** The archive checks HMAC-SHA256 signatures over the timestamp and exact request body and accepts timestamps only within five minutes. An unconfigured endpoint allows only URL verification; after configuration even verification must be signed. Slash requests are claimed by signature to suppress replay within that window. [S3][S4][T5]
- **Acknowledge promptly, then process work asynchronously.** Slack documents a three-second acknowledgment requirement and retries failed delivery. The archive follows this shape with an HTTP handler, event-ID claim, and scheduled action. Keep the shape, repair the handoff atomicity. [S4][W1]
- **Use transport dedupe and domain dedupe for different jobs.** Event envelopes are claimed by `event_id`. Message giving additionally checks the author's own message-source award and its durable attempt. Reaction giving checks workspace/channel/message/giver/source, so another person's reaction arriving before the author's message does not suppress that message. These checks survive a replay after midnight, beyond the short-lived event-ID cache. [S5][D3][T2]
- **Parse an edit's nested message, not its event timestamp as message identity.** The adapter uses `message.ts` for the original message and `message.edited.ts` for the edit. It checks old and new text, ignores unchanged text, and requires edit metadata so a non-edit update does not automatically trigger giving. Slack documents nested edited content and notes that a changed message need not have an `edited` property. [S1][S4][D6][W2]
- **Keep directory enrichment from blocking every award.** Unknown mentions get bounded lookups; a newly discovered local teammate is synced before ingestion. Definite missing or external users are excluded, while transient lookup failure retains the benefit of the doubt. Known bots and inactive people remain ineligible. The tests cover an API outage without losing recognition, not verified eligibility of every unknown ID. [D3][S1][D2][T6]
- **Ignore the bot's own confirmation reactions.** The adapter explicitly excludes its own bot user from reaction giving. Custom reaction `invalid_name` falls back to a checkmark, `already_reacted` is acceptable, and reaction failures do not prevent notification delivery. [S1][S2][T4]
- **Keep user-facing replies private and contextual.** Giver-success, limit, and self-error replies are ephemeral in the channel or existing thread. Receiver success and other notifications go by DM. Giver-success alone has an API-error fallback to DM. Normalize `thread_ts === message.ts` as a parent message before deciding where to put guidance; the edit path does this and has a dedicated test. [S2][S6][T3][T5]
- **Do not disconnect a workspace for an individual's sign-in revocation.** Only bot-token revocation or app uninstall deactivates the installation. Directory change events and a daily resync backstop handle deactivations. Install state is browser-bound and consumed once; reinstall updates the installation rather than creating a second workspace. [S1][S3][S7][S10][S11][T6]

### Gaps in the archive, not contracts to copy

1. **Claim and enqueue are separate commits.** `/slack/events` first runs `claimEvent`, then schedules `processEvent` from the HTTP action. If scheduling fails after the claim, Slack's retry sees the claim and does not enqueue work. Scheduled actions also have no automatic retry on transient failure. **Proposal:** persist receipt and schedule its processor in the same mutation, with an explicit recovery path for failed processing. Convex documents that mutation scheduling is atomic and action scheduling is not. [S4][S5][W3]
2. **Outgoing delivery does not have a core retry loop.** The Web API helper converts HTTP 429 into an error string containing `Retry-After`. Core delivery writes `failed`, then subsequent delivery skips every row that is not `pending`. The notification schema lacks delivery scheduling metadata and channel/thread placement. Conversely, a Slack send can succeed before `markDelivery` commits; retrying the work can resend it. **Proposal:** use durable delivery intents with placement and bounded retry policy, preserve Slack error classification, and define the remaining ambiguity if acknowledgment of an external send is lost. Award dedupe alone cannot solve reply delivery. [S3][S5][S6][S8]
3. **Subscribed reaction removal is filtered out at HTTP ingress.** The manifest subscribes to `reaction_removed`, and the processor contains a branch, but `HANDLED_EVENTS` omits it. Running the exact archived pre-filter returned false for removal. Its downstream branch concerns an excluded feature; ordinary reaction removal does not revoke core reaction kudos either. **Proposal:** decide whether removal reverses kudos, then align subscriptions, ingress, and behavior in one test through the actual HTTP route. [S3][S4][S1][D3]
4. **Removing the emoji can fail to advance edit order.** For a failed attempt, a newer edit with no emoji results in an invalid amount, then no verdict; `reattemptKudos` returns before patching `editTs`. An older delayed edit can subsequently pass the old watermark and give kudos after the newer cancellation. **Inference from control flow, not a reproduced Convex scenario. Proposal:** persist the version even when the attempt becomes non-actionable and define cancellation explicitly. [D2][D6]
5. **Out-of-order first edits can be lost.** An edit processed before its original attempt has no attempt to update and returns null. If the original later arrives, it is judged independently; there is no persisted early edit to reconcile. **Inference from the independent scheduled actions and the attempt lookup. Proposal:** decide which content version wins and demonstrate it in the architecture prototype. [S4][D3][D6]
6. **Recipient verification is bounded and permissive.** At most 20 unknown mentions are looked up; additional IDs and temporary lookup failures can be created optimistically as non-bot active members. Message authors with explicit external `user_team` are excluded, but the reaction branch lacks that equivalent check and can also ensure an unknown reactor/author. **Proposal:** make the eligibility evidence explicit at the Slack adapter seam and distinguish unknown from verified local active membership. Test Slack Connect reactions and lookup failures. [D2][D3][D10][S1]
7. **Ephemeral success is not proof of visibility.** Slack says ephemeral messages require an active user and channel membership and do not persist across sessions. Thread ephemerals require an active thread and the parent's timestamp. The archive's DM fallback only responds to a failed API call, not invisible successful delivery, and only applies to giver success. **Proposal:** retain the public confirmation reaction and expose attempt/allowance state in the Slack profile; decide which errors need a durable fallback. [S2][S6][W4]
8. **Reaction context is optional and does extra reads.** The archive fetches exact history text, then falls back to `conversations.replies` and accepts only a matching timestamp. It safely avoids quoting a neighboring message, but the reaction delivery context does not carry a parent-thread timestamp. Slack's current method reference accepts a parent or thread-message timestamp and applies different rate limits by distribution model. **Proposal:** keep exact-match and no-text fallback behavior; validate actual sandbox permissions and thread behavior rather than assuming enrichment always works. [S1][D3][W5]
9. **A raw-text parser treats shortcode and mention strings literally.** It does not exclude quoted or code-formatted text and does not count literal Unicode emoji in `countEmoji`; the ingress also relies on a colon pre-filter. **Proposal:** define which message surfaces count, and normalize supported Slack input at the adapter before sending a platform-neutral award request into the engine. [D1][S4]

## Message catalogue: what exists, and what “unlock” meant

### Shape

**Implemented:** a built-in `Template` has `key`, `category`, `rarity`, and `text`. Every category has five common, three uncommon, two rare, one epic, and one legendary template. There are 72 entries including the excluded quest category, or 60 across `giver_success`, `receiver_success`, `limit_reached`, `allowance_status`, and `self_kudos`. Those are code catalogue sizes, not product usage figures. The exact counts were verified by importing the source. [M1][T7]

Keys are generated as `prefix.rarity.position`, for example `giver.common.1`. This is only stable while existing arrays retain their order: inserting or reordering text can associate an existing discovery key with different content. **Proposal:** author explicit immutable IDs before importing any catalogue into the restart. [M1][D2]

Rarity weights are `55 / 25 / 12 / 6 / 2`. The picker rolls rarity first, then with probability 0.65 chooses from still-undiscovered templates if any exist in that category and rarity; otherwise it uses the full pool. A minimum-rarity option preserves relative weights above the floor. The catalogue is separate from random selection and placeholder rendering, and the picker accepts an injected random function. [M1][T7]

Rendering substitutes `giver`, `recipients`, `amount`, `emoji`, `remaining`, `limit`, `channel`, `user`, `requested`, and the excluded `quest` token. Missing values remain visible as literal placeholders. Giver-success `{amount}` is **per recipient**, whereas `{requested}` is the total allowance cost. The engine builds both Slack and web variants; the restart's Slack adapter should own mentions and formatting. **Proposal:** keep variable validation, and make the per-person versus total amount distinction clear in every template. [M1][D2]

### Discovery is not level eligibility

The picker receives category, discovered keys, randomness, and an optional rarity floor. It receives no level, achievement, or unlock eligibility. Discovering a message records first/last encounter and repetition count per member; the gallery hides undiscovered text. This is encounter-based collection, not a level-gated message-unlock engine. **Proposal:** decide whether “unlockable” means these discoveries, unlocking the right to receive certain templates, or both. [M1][D2][M2]

Discovery is recorded before delivery. A failed Slack notification can therefore leave a discovered message the member never saw. Turning off success notifications also skips their template roll, which affects collection eligibility. Self-only attempts, over-limit attempts, and repeated allowance commands can roll their own categories, so collection can be progressed without successful recognition. **Inference:** unsuccessful actions and command repetition provide a farming path; this is not an observed usage claim. [D2][S6][S9]

**Keep / avoid for content:** keep concise outcome text, contextual error guidance, and a small category catalogue. Avoid positional keys, unresolved placeholders, ambiguous multi-recipient amounts, and collectible error variants without a deliberate eligibility policy. Keep essential numbers and the repair action available regardless of which flavor text is chosen. These proposals follow the renderer, selection rules, and guidance behavior above. [M1][D2][D7]

## XP and levels relevant to progression

The archive gates XP behind a workspace game switch, creates the giver's player record on first giving, and pays receiving XP only to existing players. These are old eligibility rules to grill, not prerequisites already chosen for the restart. [P2]

- **Qualification:** at least three note words, excluding mentions, links, emoji, and punctuation, and no reciprocal recognition within the preceding 72 hours. Unicode letters, numbers, and combining marks are supported by note parsing; this is a word-count heuristic, not evidence of meaningful appreciation. [D1][P3][P2]
- **Giver XP is per recipient per message, not multiplied by emoji amount.** Qualifying first recognition that day starts at 10 XP, reduced by 2 for each earlier qualifying day that week to that person, with floor 2. The second qualifying recognition that day gets base 2; later qualifying ones get base 0 and no bonuses. A non-qualifying line gets 2, even though it does not advance qualifying history. Giving XP is capped at 50 daily and allocated in recipient order. [P1][P2]
- **Bonuses:** a new connection adds 10, a 12-word story adds 5 once per message, a 30-day rekindle adds 5, and a receiver quiet for 14 days adds 5. The quiet-receiver bonus is enabled only when received counts are visible to everyone, so the bonus cannot indirectly disclose a hidden count. **Proposal:** retain privacy-aware scoring, but simplify the rule set until grilling determines what behavior XP should reward. [P1][P2][P3]
- **Receiver XP:** 5 for each distinct qualifying giver per day, capped at 15. Reactions have no note and therefore score as thin giving rather than qualifying receiving. **Proposal:** decide whether reactions should earn XP before using these constants. [D3][P1][P3]
- **Levels:** range 1 through 25. Total XP thresholds for levels 2–5 are 30, 75, 175, and 350; thereafter reaching level `L` adds `50 × (L − 1)` to the threshold. Reached levels are retained when XP is revoked, with progress clamped at zero until XP catches up. [P1][P2]
- **Reversals use earned deltas.** The progression ledger stores scored lines per award batch and recipient. Revoking an award removes exactly its recorded giver/receiver XP rather than recalculating later awards under today's settings. Later awards retain their original earnings. **Keep:** pure scoring plus stored earned effects, even if the restart has much simpler XP rules. [P2]

Neither the consulted XP functions nor catalogue picker define a standalone general achievement engine or level-conditioned message eligibility. Do not label old quest/reward machinery as the restart's achievements or message unlocks. The prototype should give those engines their own deliberate interfaces. [P1][P2][M1]

## Inputs to the next decisions

### Core loop grilling

These questions remain proposals for the conductor's grilling ticket; no human decision is required to complete this research.

1. Keep **all-or-nothing for eligible recipients** when a request exceeds allowance? Should mixed invalid and valid mentions stay silent about excluded people or report them? [D2]
2. Which emoji and allowance defaults, which workspace timezone, and which timestamp determines the day for delayed first delivery and edit repair? What happens to historical daily usage if the timezone changes? [D3][D4][D5]
3. Do edits repair only known failed attempts, or may they initiate kudos on an ordinary message? Does removing an emoji cancel a failure, and do message deletion or reaction removal revoke an accepted award? [D6][S1][D3]
4. Are reactions one permanent award per person per message, or can removal and re-addition restore one? What feedback follows an over-limit reaction, which has no durable message attempt? [D3]
5. What does “unlockable message” mean? Which successful actions qualify for discovery, and can unseen delivery or an error discover a message? [M1][M2][D2]
6. Should progression reward giving, receiving, note quality, breadth, or a simple combination? Do levels survive revocation, and should a new receiver earn XP before giving? [P1][P2]

### Architecture prototype

**Proposed smallest useful exercise:** process one emoji message, replay its envelope, repair a failed attempt by edit, add/remove/re-add a reaction, and simulate a failed reply. Observe allowance, immutable award identity, attempt outcome, progression effect, and delivery state through the modules' interfaces. The archive supplies these concrete scenarios and their missing recovery paths. [T2][T3][T5][S6]

- **Slack adapter seam:** owns signature/envelope validation, event and message identities, edit version strings, Slack membership evidence, mention/emoji normalization, and channel/thread placement. It passes an award request with domain member IDs, origin identity, amount per recipient, note facts, and chosen effective time to the kudos engine. The archive's `GiveInput` exposes Slack IDs and Slack formatting directly; that is coupling to remove for the map's replaceable adapter. [S1][S4][D2]
- **Kudos engine interface:** accepts a request or revised attempt and returns a typed result with accepted awards, remaining allowance, or repairable problem. It hides allowance checks, attempt identity, transactions, and replay rules. Replace generic ingestion `status: string` with typed outcomes already exemplified by `GiveResult`. [D2][D3][D6]
- **Progression seam:** scores accepted awards from explicit facts, then persists earned effects in the same transaction. Its result explains XP changes; it knows neither Slack text nor transport delivery. The old pure functions are the useful starting point, while `earningsText` and old game hooks show coupling to leave behind. [P1][P2]
- **Message-unlock seam:** determines eligibility separately from random selection and rendering; returns stable content identity and unlock/discovery effects. An eligible content selection then becomes a notification intent. Achievement and leaderboard engines consume accepted facts rather than parsing Slack again. These are proposals motivated by the absent eligibility input and the old shared engine imports. [M1][D2]
- **Delivery recovery inside the Slack adapter:** durable notification intents carry recipient, placement, selected content, attempt/version identity, and retry state. Claim-plus-enqueue must be atomic; retrying a reply must not reroll content or award XP again. Demonstrate failure between receipt and scheduling, between award and send, and between successful send and marking delivery. [S4][S5][S6][W3]

### Short keep / avoid list

**Keep:** distinct recipients × emoji quantity; transactional allowance and award ledger; typed failure results; durable attempts and edit semantics; two layers of dedupe; private repair guidance; timezone-aware calendar keys; pure XP rules and recorded reversible effects; small template catalogue with injected randomness. [D1][D2][D3][D4][D6][D7][M1][P1][P2]

**Avoid:** direct reuse of the shared game-coupled engine; Slack-shaped domain inputs; separate receipt claim and enqueue; terminal core notification failures; assumed ephemeral visibility; permissive unknown members without explicit policy; positional catalogue IDs; discovery farming through errors; mistaking discovered messages for level unlocks; importing the old XP constants as settled product choices. [D2][S1][S4][S6][W3][W4][M1][M2][P1]

## Verification and limits

- Read the pinned source, domain helpers, both ADRs, ingestion/attempt paths, notification delivery, and the associated focused test sources. The archive was cloned read-only; no dependencies were installed and no production workspace or data export was accessed.
- Ran Node 24.21.0 directly against the unmodified `convex/lib/parse.ts` and `convex/lib/messages.ts`. Assertions passed for two emojis per two mentions, labelled/deduplicated mentions, skin-tone normalization, prose-only edit equality, note words, catalogue size and key uniqueness, core category size, deterministic picking, and missing-placeholder behavior.
- Executed the exact `HANDLED_EVENTS` and `isWorthProcessing` definitions extracted from `convex/http.ts` using Node's TypeScript stripping. Results: `reaction_added = true`; `reaction_removed = false`; edit removing a prior shortcode = true; glyph-only message = false. This verifies the local filter, not what Slack's live payload normalization will send.
- Archived integration tests were read, not run. No claim here establishes live Slack behavior, a production outage, or deployed correctness. The scheduling/delivery failure gaps are control-flow inferences grounded in the code and current Convex guarantees. Sandbox validation belongs to the architecture prototype.
- Current official Slack and Convex references were checked for acknowledgment/retries, changed-message nesting, ephemeral visibility and thread placement, reaction-message enrichment, and scheduling atomicity. [W1][W2][W3][W4][W5]

To repeat the key source probes without changing the archive, clone the pinned revision in a temporary directory and run:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { countEmoji, mentionedUsers } from '/tmp/kudos-garden-ro/convex/lib/parse.ts';
import { CATALOG } from '/tmp/kudos-garden-ro/convex/lib/messages.ts';
assert.equal(countEmoji('<@U1> <@U2> :taco::taco:', 'taco'), 2);
assert.deepEqual(mentionedUsers('<@U1|person> <@U1> <@W2>'), ['U1', 'W2']);
assert.equal(CATALOG.length, 72);
assert.equal(CATALOG.filter(t => t.category !== 'quest_complete').length, 60);
const raw = fs.readFileSync('/tmp/kudos-garden-ro/convex/http.ts', 'utf8');
const code = raw.slice(raw.indexOf('const HANDLED_EVENTS'), raw.indexOf('/** A 302'));
const worthy = vm.runInNewContext(stripTypeScriptTypes(code) + '; isWorthProcessing');
assert.equal(worthy({ type: 'reaction_added' }), true);
assert.equal(worthy({ type: 'reaction_removed' }), false);
console.log('PASS: parsing, catalogue, and archived reaction-removal filter');
JS
```

## References

All archive references use commit `bf4890b612d94bba428c7f432849a2946e813e10`.

[D1]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/parse.ts#L1-L82
[D2]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/engine.ts#L180-L570
[D3]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/kudos.ts#L62-L294
[D4]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/time.ts#L15-L142
[D5]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/settings.ts#L1-L20
[D6]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/attempts.ts#L20-L183
[D7]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/guidance.ts#L12-L82
[D8]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/periods.ts#L4-L99
[D9]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/engine.ts#L70-L149
[D10]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/engine.ts#L33-L68
[S1]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/slack.ts#L51-L237
[S2]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/slack.ts#L246-L331
[S3]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/slack.ts#L17-L142
[S4]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/http.ts#L22-L134
[S5]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/slackData.ts#L29-L63
[S6]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/slack.ts#L333-L413
[S7]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/slackData.ts#L151-L195
[S8]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/schema.ts#L776-L812
[S9]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/slackData.ts#L675-L692
[S10]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/crons.ts#L6-L9
[S11]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/http.ts#L202-L271
[M1]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/messages.ts#L7-L241
[M2]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/discoveries.ts#L37-L85
[P1]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/xp.ts#L11-L292
[P2]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/game.ts#L58-L347
[P3]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/quests.ts#L34-L196
[A1]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/docs/adr/0001-store-balance-is-received-kudos.md
[A2]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/docs/adr/0002-store-currency-is-hog-coins.md
[T1]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/parse.test.ts#L4-L85
[T2]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/tests/giving.test.ts#L27-L235
[T3]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/tests/fix-by-edit.test.ts#L83-L300
[T4]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/tests/bot-reactions.test.ts#L134-L249
[T5]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/tests/slack.test.ts#L61-L228
[T6]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/tests/review-fixes.test.ts#L24-L94
[T7]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/messages.test.ts#L9-L103
[T8]: https://github.com/Silthus/kudos-garden/blob/bf4890b612d94bba428c7f432849a2946e813e10/convex/lib/periods.test.ts#L5-L94
[W1]: https://docs.slack.dev/apis/events-api/#responding-to-events
[W2]: https://docs.slack.dev/reference/events/message/message_changed/
[W3]: https://docs.convex.dev/scheduling/scheduled-functions
[W4]: https://docs.slack.dev/reference/methods/chat.postEphemeral/
[W5]: https://docs.slack.dev/reference/methods/conversations.replies/
