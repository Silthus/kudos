# Slack platform facts for the Kudos core loop

Resolves [issue #5](https://github.com/Silthus/kudos/issues/5). Context: [Wayfinder map #1](https://github.com/Silthus/kudos/issues/1). Researched on 2026-10-13 against Slack's live developer documentation and Help Center.

This is a research handoff for the core-loop grilling and architecture prototype. **Platform facts** below are cited. **Recommendations** and **questions for the spec** are explicitly proposals, not locked product decisions. No workspace data or live Slack API writes were used; no app was installed or configured.

## Findings that affect the next decisions

1. **Edit-to-retry is feasible without a history fetch.** `message_changed` contains the updated message and its original `message.ts`; it can also fire for automatic metadata changes. Deduplicate delivery separately from deciding whether a changed message deserves another attempt. [Changed messages][changed] [Events API][events]
2. **A thread is not a private feedback channel.** A normal reply belongs to the original conversation. `reply_broadcast` controls a reference in the main conversation, not a recipient allowlist. Recipient-specific feedback can be ephemeral, including in an already active thread, or an app-user DM. [Sending messages][sending] [Post message][post-message] [Post ephemeral][ephemeral]
3. **Ephemeral feedback cannot be the durable receipt.** The user must be active and in the conversation; delivery is not guaranteed and the message disappears across sessions. Thread ephemerals only display when an active thread already exists. [Post ephemeral][ephemeral]
4. **User groups are available as a team directory, with caveats.** Read scopes and change events exist, but user groups require a paid plan and cannot include guests or external Slack Connect collaborators. Overlap, team eligibility, and historical scoring are product decisions. [List groups][groups-list] [Membership changes][members-changed] [Create/edit user groups][groups-help]
5. **Sandbox then real is supported by two distinct setups.** One distributed app needs an OAuth install for each workspace and uses one shared Events API URL. Two single-workspace apps can be cloned from one manifest and have independent settings. Neither option is selected by this research. [Distribution][distribution] [HTTP events][http-events] [Manifests][manifests]
6. **Sign in with Slack and installing the bot are separate flows.** OIDC authenticates a person; installation grants the app scopes. Slack forbids combining OIDC and non-OIDC scopes in the same authorization flow. App Home itself uses the installed bot and Slack events. [Sign in with Slack][oidc] [OAuth installation][oauth] [App Home][home]

## 1. Event delivery, message edits, and deletes

### Which subscriptions and scopes are needed?

The subscription name selects the conversation type, but the inner event still has `type: "message"`. For bot subscriptions, visibility depends on the bot's membership and granted scopes. Installing a bot does not let it read arbitrary private conversations or user-to-user DMs. [Message events][message] [Events API][events] [Conversation history access][history]

| Conversation | Subscription | Required history scope | Source |
| --- | --- | --- | --- |
| Public channel | `message.channels` | `channels:history` | [Public-channel messages][message-channels] |
| Private channel | `message.groups` | `groups:history` | [Private-channel messages][message-groups] |
| App-visible one-to-one DM | `message.im` | `im:history` | [DM messages][message-im] |
| App-visible group DM | `message.mpim` | `mpim:history` | [Group-DM messages][message-mpim] |

`app_mention` only captures messages directed at the app. It is insufficient for a loop in which someone mentions a teammate and includes an emoji without mentioning the app. [Public-channel messages][message-channels]

**Recommendation:** start with the conversation types the grilled spec actually accepts. Public-channel kudos needs `message.channels`; add private-channel or DM subscriptions only when required. Channel invitation is part of onboarding if the bot must observe kudos there.

### Normalize message identity before invoking the engine

| Input | Original message identity | Content to inspect | Source |
| --- | --- | --- | --- |
| New `message` | Outer workspace, `event.channel`, `event.ts` | `event.user`, `event.text`, and applicable message blocks | [Message events][message] [Rich text blocks][rich-text] |
| `message` with `subtype: "message_changed"` | Outer workspace, `event.channel`, **`event.message.ts`** | Nested `event.message`; `edited` can identify editor and edit time | [Changed messages][changed] [Message events][message] |
| `message` with `subtype: "message_deleted"` | Outer workspace, `event.channel`, **`event.deleted_ts`** | Deletion notification; original message no longer returns in history | [Deleted messages][deleted] |

A message's `ts` is unique within its channel. The outer `event_id` identifies the delivery's event and is globally unique across workspaces. These are different identities: new events for successive edits still refer to one original message. [Message events][message] [Events API][events]

Edits and deletes can be `hidden: true`. A blanket filter that drops hidden messages would discard the changes needed for edit-to-retry and deletion handling. `message_changed` can also be caused by automatic language/locale detection, so it does not necessarily mean the author changed the kudos content. [Message events][message] [Changed messages][changed]

**Recommendations:**

- Keep delivery deduplication by `event_id` separate from the award ledger keyed by installation/workspace, channel, and original message timestamp.
- Reevaluate the normalized, relevant content on an edit. A metadata-only change should not consume allowance or repeat feedback.
- Preserve committed award state so a later deletion does not require reconstructing a message that Slack no longer serves.
- Specify what accepted-message edits and deletions do to awards. Slack supplies notifications, not kudos reversal, allowance, or XP rules.
- Handle edits and deletes before filtering other message subtypes. Reject app-authored input using bot fields and the installation's bot identity, rather than assuming every bot message has one particular subtype. [Bot message detection][bot-message] [OAuth installation][oauth]

### Acknowledge, verify, and deduplicate

For HTTP Events API delivery, Slack requires an HTTP 2xx acknowledgement within **three seconds** and recommends separating receipt from processing. Failed requests are retried up to three times: nearly immediately, after approximately one minute, and after approximately five minutes. Retries carry `X-Slack-Retry-Num` (`1`, `2`, or `3`) and `X-Slack-Retry-Reason`; headers are case-insensitive. [Events API][events] [Request verification][signatures]

The optional Delayed Events setting extends retries hourly for 24 hours. Slack calls the Events API best effort: by default it will not attempt delivery of events more than two hours late, whereas enabling delayed events allows late delivery. Do not interpret retry support as a guarantee that every message will eventually arrive. [Events API][events]

**Recommendation:** after authenticating a request, durably record or enqueue it, then acknowledge within the deadline. Do not wait for a reaction, DM, or other Slack API call before acknowledgement. Use the retry header for diagnostics; do not discard all retries, because the original attempt might never have been accepted. A persisted duplicate can safely receive a successful acknowledgement without re-awarding.

Signature verification uses the app signing secret, **the raw HTTP body before JSON/form parsing**, and `X-Slack-Request-Timestamp`. Compute HMAC-SHA256 over `v0:{timestamp}:{raw_body}`, prefix the hex digest with `v0=`, and compare against `X-Slack-Signature` using a timing-safe comparison. Slack's recipe rejects timestamps more than five minutes from local time to prevent replays. This signs the HTTP request timestamp, not the original message's timestamp. The old verification token is deprecated. [Request verification][signatures]

An HTTP Events API URL must respond to a `url_verification` challenge before it can be saved. After verification, the same app has **one Events API request URL** for all installed workspaces; route after receipt using the app and installation context. [HTTP events][http-events] [Events API][events]

**Prototype questions:** durable enqueue latency under a cold request; duplicate delivery after a lost acknowledgement; stale edits arriving after a later revision; and delayed input crossing an allowance reset. Last-revision handling and which day owns a delayed award are design proposals to test, not platform promises.

## 2. Mentions and emoji in text and blocks

### Text representation

| Entity | Slack syntax | Meaning for the adapter | Source |
| --- | --- | --- | --- |
| Individual user | `<@U…>` or `<@W…>`; legacy messages may carry a label after `\|` | A user ID, requiring eligibility lookup | [Message formatting][formatting] [Message events][message] |
| User group | `<!subteam^S…>` | A group ID; membership comes from group APIs | [Message formatting][formatting] |
| Broadcast | `<!here>`, `<!channel>`, `<!everyone>` | A broadcast instruction, not a list of eligible people | [Message formatting][formatting] |
| Emoji | `:emoji_name:` | Slack converts retrieved Unicode emoji to colon form | [Message formatting][formatting] |

Slack's formatting guide distinguishes user IDs starting with `U` and `W`, group references beginning with `!subteam`, and special mentions beginning with `!`. An ordinary `@displayname` text fragment is not a stable user identity. Names and group handles can change. [Message formatting][formatting]

**Parser recommendation:** recognize IDs and token kinds, preserve the raw token until classified, and deduplicate recipients. Accepting optional labels on reference tokens is compatibility handling; the current group-formatting guide illustrates the unlabeled form. Do not HTML-decode an escaped `&lt;@U…&gt;` into an actual recipient token before classifying it. Slack reserves `<`, `>`, and `&` for parsing and escapes literal occurrences. [Message formatting][formatting]

### Block representation

Slack's user message composer emits `rich_text` blocks, which can be deeply nested. Typed mention and emoji elements provide a structured representation alongside message text. [Rich text blocks][rich-text] [Rich text sections][rich-section]

| Rich-text element | Fields relevant to Kudos | Source |
| --- | --- | --- |
| `user` | `user_id` | [User element][user-element] |
| `usergroup` | `usergroup_id` | [Usergroup element][usergroup-element] |
| `broadcast` | `range: "here"`, `"channel"`, or `"everyone"` | [Broadcast element][broadcast-element] |
| `emoji` | `name`, optional `unicode`; names can contain a skin-tone suffix | [Emoji element][emoji-element] |

**Recommendation:** normalize text and supported block content in the Slack adapter. Choose one canonical representation per message, with a fallback for supported text-only messages; do not count the same mentions or emoji twice because both `text` and `blocks` represent them. Explicitly grill whether code blocks, quotes, struck-through text, attachments, and forwarded content count. The block tree exposes formatting, but Slack does not define the Kudos interpretation.

### Bots are user identities too

The user mention syntax does not encode whether the recipient is a person or a bot. `users.info` requires `users:read` and returns the user object, whose `is_bot` flag identifies bot users. Slackbot is a documented exception with `is_bot: false`. The current user-object reference describes top-level `is_app_user` as an authorized user of the calling app; do not use it alone as a human-versus-bot discriminator. [User lookup][users-info] [User object][user-object]

Current granular-permission bot messages can be detected by `bot_id` and `bot_profile` in the event. Checking only `subtype: "bot_message"` misses the documented current detection path. [Bot message detection][bot-message]

**Recommendation:** cache recipient metadata, reject bot recipients and the Slackbot system identity where the spec calls for human-only awards, and ignore the app's own output. Never expand broadcasts into everyone in a conversation unless explicitly chosen as a product feature. Expanding a user-group mention into individual award recipients is also a product rule, separate from displaying teams on a leaderboard.

## 3. Feedback surfaces

| Surface | API and scope | Visibility and constraints | Source |
| --- | --- | --- | --- |
| Reaction on the original message | `reactions.add`, `reactions:write`; `channel`, `timestamp`, emoji `name` without wrapping colons | Saved on the message; visible wherever that message is visible. `already_reacted` means that user/reaction combination exists. | [Add reaction][reactions] |
| Ephemeral beside a message | `chat.postEphemeral`, `chat:write`; `channel`, target `user`, message content | Only the target user sees it. Requires channel membership and current activity; delivery is best effort and not persistent across sessions. | [Post ephemeral][ephemeral] |
| Ephemeral inside a thread | Same method, with parent `thread_ts` | Same privacy and delivery constraints; only shown if an active thread already exists. | [Post ephemeral][ephemeral] |
| Ordinary thread reply | `chat.postMessage`, `chat:write`; `channel`, parent `thread_ts` | A message in the original conversation's thread; `reply_broadcast: true` also puts a reference in the main conversation. | [Post message][post-message] [Sending messages][sending] |
| App-user DM | `chat.postMessage`, `chat:write`, with the user ID as `channel` | Opens an app-user 1:1 if needed. Returns the DM channel ID for future sends. Permission failures can return `channel_not_found`. | [Post message][post-message] |
| Explicitly open/resume a DM | `conversations.open`, `im:write` for 1:1, then `chat.postMessage`, `chat:write` | Supply the other user ID, not the bot's own ID. Returns the conversation ID. More than one recipient creates an MPIM and requires its relevant scope. | [Open conversation][open-conversation] [IM write scope][im-write] |

There is **no recipient-private ordinary thread reply** exposed by these APIs. A reply in a private channel inherits that conversation's access; a reply in a public channel does not become private by leaving `reply_broadcast` false. Use an ephemeral or a separate app-user DM when a single person should see feedback. This conclusion follows from the documented conversation/thread model and the separate recipient-targeted ephemeral API. [Sending messages][sending] [Post message][post-message] [Post ephemeral][ephemeral]

`chat.postEphemeral` returns `message_ts`, but it is not a durable message timestamp that can be used with `chat.update`. The documented user-targeted `chat.postMessage` path does not require a separate `conversations.open` call; explicit opening adds an API call and the DM write scope. Neither path grants access to other users' private 1:1 conversations. [Post ephemeral][ephemeral] [Post message][post-message] [Open conversation][open-conversation]

**Recommendations:**

- A success reaction is a compact acknowledgement; it is not the authoritative award ledger. Treat `already_reacted` as the requested visible state already being present.
- If private rejection feedback must be recoverable, use a DM or profile history as the durable surface. Ephemeral-only feedback cannot satisfy a guaranteed-delivery requirement.
- For a top-level rejected kudos with no active thread, do not assume a thread ephemeral can create its own private thread. Choose a channel ephemeral or DM according to the spec.
- For a kudos inside an existing thread, use its parent's `thread_ts` for feedback, but react to the kudos message's own timestamp.
- Keep feedback delivery retryable independently of the committed award. A reaction or DM failure should not spend allowance twice.

**Questions for the spec:** success reaction only or also a reply; rejection ephemeral versus DM; bot receipt emoji; whether edit-to-retry replaces an earlier failure indicator; and whether a failed feedback send should be visible in App Home.

## 4. Slack user groups as teams

`usergroups.list` and `usergroups.users.list` support bot and user tokens with **`usergroups:read`**. The first lists group metadata, can include disabled groups, and can include member IDs using `include_users: true`. The second fetches member IDs for a particular group. `team_id` is needed with an org-level token and ignored with a workspace token. [List groups][groups-list] [List group members][groups-users]

Group identity, name, handle, `auto_type`, member count, and disable state are available. `date_delete` is nonzero for a disabled group; automatic admin/owner groups are distinguishable from custom groups. [Usergroup object][group-object]

The change subscriptions also require `usergroups:read`:

| Event | Information | Caveat | Source |
| --- | --- | --- | --- |
| `subteam_created` | New group's metadata | Bootstrap/refresh membership if needed | [Group created][group-created] |
| `subteam_updated` | Metadata or membership changes; can signal disabling | Its `users` snapshot truncates at 500, while `user_count` remains the full count | [Group updated][group-updated] |
| `subteam_members_changed` | `added_users`, `removed_users`, and previous/current update timestamps | Delta only, not a full group snapshot; timestamps help detect a stale local list | [Membership changed][members-changed] |

User groups require a paid Slack plan. Guests and people from external Slack Connect workspaces cannot join the organization's user groups. Disabled groups remain in the group list; deactivation is not deletion. [Create/edit user groups][groups-help]

**Recommendations:** bootstrap a directory, then refresh an affected group's membership when change events arrive. A refresh is simpler to recover than assuming every delta was received, given best-effort event delivery. Use workspace and group ID for identity; avoid keying teams by mutable names. [Events API][events] [Usergroup object][group-object]

**Questions for the spec:** all custom groups or an allowlist; automatic admin/owner groups; users in multiple teams; members without a team; whether historical awards move when someone switches teams; and what a free sandbox should do before the team feature can be exercised. No team policy is locked here.

## 5. Slack-only profiles

### App Home

App Home is a private space between each user and the app. Its Home tab is a customizable Block Kit view; the Messages tab is the app-user conversation. Enabling Home requires at least one bot permission scope and an installed bot. The Home tab must be enabled in app settings or the manifest. [App Home][home] [Manifest reference][manifest-reference]

`views.publish` creates or updates a Home view for `user_id` with `view.type: "home"`; the method requires **no additional scope** and accepts an optional `hash` to protect against conflicting updates. A Home view supports up to 100 blocks. [Publish view][publish] [App Home][home]

`app_home_opened` has no additional scope requirement but needs a configured, installed bot. It fires when the user opens App Home and reports `tab`, such as `home` or `messages`; a previously published Home view may be included. [App Home opened][home-opened]

**Recommendation:** publish the profile on `app_home_opened` when `tab === "home"`. Keep refresh-on-open as the initial behavior unless a live-updating profile is required. The existing Slack identity and installation context can address the profile; OIDC is a separate service-login concern.

### Slash commands

The **`commands`** bot scope enables slash commands. Slack POSTs a form-encoded payload including the command, argument `text`, actor, workspace, conversation, `response_url`, and `trigger_id`. Verify the signed raw form body before parsing it and acknowledge within 3,000 milliseconds. Responses default to ephemeral; `response_type: "in_channel"` publishes both the response and the invocation. [Commands scope][commands] [Slash commands][slash] [Request verification][signatures]

Custom slash commands **cannot be invoked in message threads**. Commands are not namespaced: if multiple apps install the same command name, Slack invokes the one installed most recently. Enabling the escape option converts user/channel references to stable IDs; manifest field `should_escape` controls that option. [Slash commands][slash] [Manifest reference][manifest-reference]

**Recommendation:** App Home can hold the full profile; a slash command can give a short ephemeral summary or a link to Home. Decide which surface to ship in the profile spec. Two sandbox/production apps installed in the same workspace should use different command names to avoid the documented collision.

## 6. Sign in with Slack versus app installation

| Concern | Authorization and token endpoints | Scope and result | Source |
| --- | --- | --- | --- |
| Install the Slack app | `/oauth/v2/authorize` then `oauth.v2.access` | Bot scopes through `scope`, user scopes through `user_scope`; returns granted scopes, bot token/identity, app ID, and workspace installation context | [OAuth installation][oauth] |
| Sign a person into the service | `/openid/connect/authorize` then `openid.connect.token` | Requires `openid`; optionally `profile` and `email`. Returns access token plus JWT `id_token`; `openid.connect.userInfo` retrieves identity updates | [Sign in with Slack][oidc] [OIDC token][oidc-token] [OIDC user info][oidc-info] |

Slack explicitly rejects combining Sign in with Slack scopes with other scopes in one flow. One app can implement both capabilities, but the two grants are separate. A successful OIDC login is not proof that the bot is installed with the required capabilities. [Sign in with Slack][oidc] [OAuth installation][oauth]

Slack exposes OIDC discovery at `https://slack.com/.well-known/openid-configuration`, including issuer, token endpoint, JWKS, and supported signing algorithms. Identity claims include Slack workspace and user IDs. Slack recommends a standards-compatible OIDC library, matching `state` during the callback and `nonce` in the returned token. The token method documents issuer, audience, and expiry claims. [Sign in with Slack][oidc] [OIDC token][oidc-token]

**Recommendations:** keep an installation/token store separate from authenticated user sessions. Use a validated OIDC identity to address the correct workspace/user account and separately verify that installation exists. Have the OIDC library validate signature, issuer, audience, expiry, and nonce rather than merely decoding a JWT. Do not ask each Slack-event sender to complete OIDC as a prerequisite for inspecting a signed event; the signed callback and bot installation are the adapter's authentication context. The map's requirement to retain Sign in with Slack still needs an explicitly defined service-login use case in the architecture spec.

For install OAuth, validate `state` and the **returned** workspace ID. The requested `team` is not an unconditional restriction if the user is not already signed into that workspace. HTTPS redirects are required, and an explicitly supplied `redirect_uri` must match across authorize and token-exchange steps. [OAuth installation][oauth]

## 7. Sandbox, real workspace, distribution, and manifest

An undistributed app belongs to one associated workspace and cannot be installed in another. A distributed app handles OAuth and gets access tokens for its installs. Activating unlisted distribution is distinct from listing in the Slack Marketplace; Workspace Admin approval can still gate installation. Deactivating distribution removes installs outside the original workspace. [Distribution][distribution]

| Option | Slack facts | Engineering trade-off, not a locked decision |
| --- | --- | --- |
| One distributed app installed in sandbox and real | OAuth per workspace; one Events API URL; app-level setting changes propagate to installations, subject to installed scopes. [Distribution][distribution] [HTTP events][http-events] | Requires installation routing and workspace isolation. Manifest experiments on this app can affect both environments. |
| Separate single-workspace sandbox and production apps | Each app can be installed in its associated workspace; manifests can clone configurations. [Distribution][distribution] [Manifests][manifests] | Independent IDs, credentials, settings, and URLs. Requires keeping manifests aligned and mapping identities to the right environment. |

**Recommendation for the grilling:** choose two apps when independent event URLs and safe configuration experiments matter more than a generalized install flow. Choose one distributed app when multi-workspace installation is itself a requirement. Either setup still needs explicit workspace scoping and sandbox/production data separation in the backend. This research does not configure either choice.

Slack manifests are portable JSON/YAML configurations suitable for version control. For this externally hosted granular-permissions app, the relevant properties are `features.bot_user`, `features.app_home`, `features.slash_commands`, `oauth_config.scopes`, `oauth_config.redirect_urls`, `settings.event_subscriptions`, and `settings.interactivity` when interactive controls are used. A new HTTP event URL must be manually verified in app settings. [Manifests][manifests] [Manifest reference][manifest-reference]

Changing manifest scopes does not upgrade existing tokens. Added scopes require reauthorization; adding an event without the needed installed scope silently produces no matching delivery until the grant is updated. Removing a requested scope does not remove it from existing tokens until revocation/uninstall. [Distribution][distribution] [OAuth installation][oauth]

**Recommendation:** commit one reviewed manifest template with environment-specific URLs, names, and command names rendered for each app. Store signing secrets, OAuth client secrets, and bot tokens outside the public repository. Do not treat a manifest as an installation or credential export. [OAuth credential handling][oauth] [Request signing secret][signatures]

## 8. Rate limits and outbound recovery

Rate limits are evaluated per app, workspace, and API method, with additional channel-level limits for message posting. Published tiers are lower bounds, not exact guaranteed burst quotas. Slack does not publish precise burst capacity. An HTTP 429 includes `Retry-After` in seconds; pause that method for that workspace, rather than blocking unrelated workspaces/methods. [Rate limits][limits]

| Operation | Published limit | Source |
| --- | --- | --- |
| `reactions.add` | Tier 3, 50+ per minute | [Add reaction][reactions] |
| `chat.postEphemeral` | Tier 4, 100+ per minute | [Post ephemeral][ephemeral] |
| `chat.postMessage`, including DMs and thread replies | Generally one message/second per conversation; also a workspace limit described as several hundred/minute, with no exact numeric quota | [Post message][post-message] |
| `conversations.open` | Tier 3, 50+ per minute | [Open conversation][open-conversation] |
| `usergroups.list`, `usergroups.users.list` | Each Tier 2, 20+ per minute | [List groups][groups-list] [List members][groups-users] |
| `users.info`, `views.publish` | Each Tier 4, 100+ per minute | [User lookup][users-info] [Publish view][publish] |
| Events API input | 30,000 deliveries/workspace/app per 60 minutes; `app_rate_limited` reports limiting | [Events API][events] [Rate limits][limits] |

Slack's general message-posting guidance is one message/second per channel across posting mechanisms. The method reference separately assigns ephemerals Tier 4; do not confuse that method quota with permission to send an unlimited burst into one channel. [Rate limits][limits] [Post ephemeral][ephemeral]

The newer one-request/minute and 15-result limits for `conversations.history` apply to new commercially distributed non-Marketplace apps/installations. The current docs exempt Marketplace apps and internal customer-built apps, which retain Tier 3. This is not a blanket limit on all unlisted/internal apps, and it does not apply to `reactions.add`, ephemerals, or DMs. [Conversation history][history] [Rate limits][limits]

**Recommendations:** use a durable outbound queue with independent rate-limit state by workspace/method, plus per-conversation pacing for message sends. Cache user and team metadata. Avoid fetching history on each message or edit when the event already supplies the relevant content. On timeouts and server errors, account for uncertain side-effect completion: Slack's method errors warn that some operations may have succeeded before failure. Reactions offer `already_reacted`; the researched messaging methods do not establish an exactly-once receipt contract. [Add reaction errors][reactions] [Post message errors][post-message]

## 9. Handoff for the core-loop spec and architecture prototype

**Product decisions still to grill:**

- Accepted conversation types, bot invitation, and Slack Connect/guest eligibility.
- Individual mentions versus group expansion; broadcasts; formatting that counts as kudos.
- Award semantics after edit/delete, partial recipient rejection, and the day used for delayed input.
- Public success acknowledgement and private failure surface; whether recoverable feedback is required.
- One distributed app versus two apps; backend sandbox/production separation.
- Profile surface and service-login use case for the retained OIDC requirement.
- Team selection, overlapping membership, unassigned users, disabled groups, and score attribution when membership changes.

**Suggested architecture seams:**

1. Slack ingress verifies signed raw requests, resolves installation, normalizes message identity/content, and records delivery once.
2. The kudos engine decides acceptance, allowance, and edit/delete policy using platform-neutral inputs.
3. Durable domain state records the award result independently of outbound feedback.
4. The Slack adapter delivers reactions, ephemerals, replies, DMs, and Home views with rate-limit handling.
5. A team directory adapter maps Slack group IDs and members into the team's chosen scoring model.
6. OIDC service sessions and OAuth installations remain separate records with an explicit identity join.

These seams are recommendations based on the facts above, not a prototype or implementation. The targeted prototype should demonstrate duplicate deliveries, hidden edit handling, metadata-only changes, out-of-order revisions/deletes, allowance-boundary delays, feedback failure after an award commits, a group snapshot larger than 500, and routing between sandbox and production. Live sandbox proof is still needed for rendering, actual event payloads, grants, membership visibility, and ephemeral behavior; this ticket establishes the documented contract only.

## References

All references are first-party Slack sources, accessed on 2026-10-13. Each citation above links to the document that owns the fact. No private repository or workspace evidence is reproduced here.

[events]: https://docs.slack.dev/apis/events-api/ "Events API: delivery, retries, event IDs, and limits"
[http-events]: https://docs.slack.dev/apis/events-api/using-http-request-urls/ "HTTP event URLs and URL verification"
[message]: https://docs.slack.dev/reference/events/message/ "Message event and subtypes"
[changed]: https://docs.slack.dev/reference/events/message/message_changed/ "Changed message payload and metadata-only changes"
[deleted]: https://docs.slack.dev/reference/events/message/message_deleted/ "Deleted message payload"
[message-channels]: https://docs.slack.dev/reference/events/message.channels/ "Public-channel message subscription"
[message-groups]: https://docs.slack.dev/reference/events/message.groups/ "Private-channel message subscription"
[message-im]: https://docs.slack.dev/reference/events/message.im/ "DM message subscription"
[message-mpim]: https://docs.slack.dev/reference/events/message.mpim/ "Group-DM message subscription"
[signatures]: https://docs.slack.dev/authentication/verifying-requests-from-slack/ "Request signature verification"
[formatting]: https://docs.slack.dev/messaging/formatting-message-text/ "Text mentions, emoji, escaping, and retrieval"
[rich-text]: https://docs.slack.dev/reference/block-kit/blocks/rich-text-block/ "Rich text message blocks"
[rich-section]: https://docs.slack.dev/reference/block-kit/block-elements/rich-text-section-element/ "Rich text section elements"
[user-element]: https://docs.slack.dev/reference/block-kit/block-elements/user-element/ "Structured user mention"
[usergroup-element]: https://docs.slack.dev/reference/block-kit/block-elements/usergroup-element/ "Structured usergroup mention"
[broadcast-element]: https://docs.slack.dev/reference/block-kit/block-elements/broadcast-element/ "Structured broadcast mention"
[emoji-element]: https://docs.slack.dev/reference/block-kit/block-elements/emoji-element/ "Structured emoji"
[users-info]: https://docs.slack.dev/reference/methods/users.info/ "User lookup and scope"
[user-object]: https://docs.slack.dev/reference/objects/user-object/ "User flags and Slackbot exception"
[bot-message]: https://docs.slack.dev/reference/events/message/bot_message/ "Current bot-message detection"
[reactions]: https://docs.slack.dev/reference/methods/reactions.add/ "Reaction posting, scope, errors, and tier"
[ephemeral]: https://docs.slack.dev/reference/methods/chat.postEphemeral/ "Ephemeral and thread-ephemeral constraints"
[post-message]: https://docs.slack.dev/reference/methods/chat.postMessage/ "Messages, thread replies, direct user-ID DMs, and posting limits"
[sending]: https://docs.slack.dev/messaging/sending-and-scheduling-messages/ "Threaded messages versus private ephemeral messages"
[open-conversation]: https://docs.slack.dev/reference/methods/conversations.open/ "Explicit DM opening"
[im-write]: https://docs.slack.dev/reference/scopes/im.write/ "One-to-one DM write scope"
[groups-list]: https://docs.slack.dev/reference/methods/usergroups.list/ "List user groups"
[groups-users]: https://docs.slack.dev/reference/methods/usergroups.users.list/ "List group member IDs"
[group-object]: https://docs.slack.dev/reference/objects/usergroup-object/ "Usergroup identity, automatic groups, and disable state"
[group-created]: https://docs.slack.dev/reference/events/subteam_created/ "Group creation event"
[group-updated]: https://docs.slack.dev/reference/events/subteam_updated/ "Group update event and 500-member truncation"
[members-changed]: https://docs.slack.dev/reference/events/subteam_members_changed/ "Group membership deltas"
[groups-help]: https://slack.com/help/articles/212906697-Create-and-edit-user-groups "Paid-plan and membership constraints for user groups"
[home]: https://docs.slack.dev/surfaces/app-home/ "App Home configuration and views"
[publish]: https://docs.slack.dev/reference/methods/views.publish/ "Home view publication"
[home-opened]: https://docs.slack.dev/reference/events/app_home_opened/ "App Home visit event"
[commands]: https://docs.slack.dev/reference/scopes/commands/ "Slash command scope"
[slash]: https://docs.slack.dev/interactivity/implementing-slash-commands/ "Slash command payloads, responses, threads, and naming"
[oidc]: https://docs.slack.dev/authentication/sign-in-with-slack/ "Sign in with Slack OIDC flow"
[oidc-token]: https://docs.slack.dev/reference/methods/openid.connect.token/ "OIDC token exchange and claims"
[oidc-info]: https://docs.slack.dev/reference/methods/openid.connect.userInfo/ "OIDC identity retrieval"
[oauth]: https://docs.slack.dev/authentication/installing-with-oauth/ "Installation OAuth grants and token handling"
[distribution]: https://docs.slack.dev/app-management/distribution/ "Single-workspace, distributed apps, and reinstall behavior"
[manifests]: https://docs.slack.dev/app-manifests/ "Portable configuration and development app clones"
[manifest-reference]: https://docs.slack.dev/reference/app-manifest/ "Manifest properties"
[limits]: https://docs.slack.dev/apis/web-api/rate-limits/ "Rate limits, 429, Retry-After, and commercial-app distinctions"
[history]: https://docs.slack.dev/reference/methods/conversations.history/ "History visibility and rate-limit exceptions"
