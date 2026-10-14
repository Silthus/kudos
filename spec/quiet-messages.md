# Spec: quieter messages

> **Accepted on [#353](https://github.com/Silthus/kudos/issues/353) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/quiet-messages` and is never merged. It answers map #1's decision 22 and builds on decisions 11, 12 and 18. The build runs on the integration branch `spec/quiet-messages`, which the conductor cuts from `main`.
>
> **Rule numbers.** Rules are cited as `QM1`–`QM30`. Progression rules are cited as `P64`, core loop rules as `R33`, Slack-to-web rules as `SW13`, website rules as `WS335`.
>
> Sources: the code on `main` at `493995e` (`convex/feedback/` publicReplies, replies, notify, welcome, tierNotices and home's `Settings` and `Admin` tabs; `convex/slack/` publicReplies, directMessages, welcome, interactivity; `convex/welcome/`; `convex/progression/settings.ts`; `convex/website/link.ts`), the `Feedback` and `Welcome` component specs, the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: P63–P65, P69), the Slack-to-web spec (`spec/slack-to-web.md` on `docs/slack-to-web`), #209's teaching amendment, the activation definition (three kudos given), and the website conductor's answer (map #57, 2026-10-14, folded into QM12, QM15 and QM27).

## Problem Statement

HedgeHug talks too much, and sometimes in the wrong place. A member wrote, from a production thread: "the slack messages are too much tbh gets noisy and annoying. I get a message from the app anyways so no need to display in the thread". The public `🎉 {member} reached level 2.` landed in a work thread, under someone else's message, because no announcement channel was picked, and HedgeHug then falls back to the thread under the kudos message.

Beyond that one notice, a member can't shape what HedgeHug sends them. Today there are two switches: mute public notices, or turn every progress DM off. There's nothing in between, and nothing says where to change it.

The welcome DM is the first thing a new member reads, and it's a usage note. It doesn't say what HedgeHug is, why the website is worth a visit, or what to do next. Activation (three kudos given) depends on that next step.

## Solution

**Four small, separately shipped slices, quietest first.**

1. **Never post in a work thread** (a live fix). Public celebrations (level ups, achievement tiers) go only to the workspace's one announcement channel. With none picked, nothing is posted publicly. The `Admin` tab's "Use threads" option goes.
2. **A better welcome** (live). One version for a first recipient ("{giver} just thanked you") and one for a first giver ("your first kudos just landed"). A shared body says what HedgeHug is and what the website shows, and a clear next step leads to activation. Welcoming many members at once is paged, so it stays within Convex's scheduling limit.
3. **Members choose what they get** (behind `message-settings`). App Home's Settings tab lists each kind of message (the after-kudos reply, tips, level ups, new features, quests and the Journey, Book tiers, public celebrations), each on or off. Every message a member can tune ends with a footer that says where to change it. Errors that need action now stay and can't be turned off.
4. **Members choose where it arrives** (behind `message-settings`). For the kinds a kudos message causes, each member picks a DM or the in-channel reply only they see.

## User Stories

**No more thread posts**
1. As a member, I want HedgeHug never to post in a work thread, so that a conversation about work isn't interrupted by a level up.
2. As a member, I want public celebrations to appear only in the channel my workspace picked for them, so that I know where to look and where not to.
3. As a member in a workspace with no announcement channel, I want no public celebration at all, so that nothing lands where nobody asked for it.
4. As someone who manages the workspace, I want the `Admin` tab to say plainly that nothing is celebrated in public until I pick a channel, so that I understand the choice.
5. As someone who manages the workspace, I want to stop public celebrations again after picking a channel, so that I can turn them off for the workspace.
6. As a member, I want a celebration that was waiting to be posted in a thread when the fix shipped to stay unposted, so that the fix holds from the moment it's live.
7. As a member, I want a kudos given inside the announcement channel to be celebrated as a post in that channel, not in its thread, so that the rule has no exceptions.

**The welcome**
8. As a member thanked for the first time, I want the welcome to start with who thanked me, so that it reads as a moment, not as a manual.
9. As a member who gave their first kudos, I want the welcome to say it landed and with whom, so that I know it worked.
10. As a new member, I want one line on what HedgeHug is, so that I understand why it's in my Slack.
11. As a new member, I want to learn that kudos earn XP and unlock things, but only for features that are on, so that the welcome never promises what I can't see.
12. As a new member, I want one clear first step, so that I know exactly what to do next.
13. As a first recipient, I want the step to be "thank someone who helped you lately", with how to do it, so that I can pass it on.
14. As a first giver, I want the step to be "thank two more teammates this week", so that I reach the habit that makes HedgeHug stick.
15. As a new member, I want to know my daily allowance and when it refills, so that I don't run out by surprise.
16. As a new member, I want a "See your progress" button to the website when the website is open to me, so that I see what HedgeHug shows beyond Slack.
17. As a new member, I want an "Open App Home" link, so that I can find HedgeHug in Slack again.
18. As a new member, I want the welcome once, ever, so that it stays an introduction.
19. As the product owner, I want a kudos that names hundreds of new members to welcome each of them without breaking Convex's limits, so that a large first kudos never fails.

**Choosing what I get**
20. As a member, I want a Settings tab that lists each kind of message HedgeHug sends me, so that I can see what I can change.
21. As a member, I want each kind with a short description, so that I know what turning it off means.
22. As a member, I want to turn the after-kudos reply off, so that giving kudos is quiet when I don't care about the numbers.
23. As a member who turned the after-kudos reply off, I still want to hear when someone I mentioned was skipped, so that I'm never left thinking a kudos landed when it didn't.
24. As a member, I want to turn tips off on their own, so that I keep the reply but lose the advice.
25. As a member, I want to turn level up DMs off, so that I hear nothing about levels I'll see in App Home anyway.
26. As a member, I want to turn new-feature DMs off, so that I discover features at my own pace.
27. As a member, I want to turn quest and Journey DMs off, so that a finished quest waits for me in App Home and on the website.
28. As a member, I want to turn Book tier DMs off, so that achievements don't interrupt me.
29. As a member, I want to keep my level ups and tiers out of the announcement channel, so that my progress stays mine.
30. As a member, I want errors that need me now (over my allowance, nobody valid mentioned) to always reach me, so that a failed kudos is never silent.
31. As a member, I want my settings to apply to messages already on their way, so that turning something off takes effect at once.
32. As a member who turned all DMs off before, I want those DMs to stay off, so that the new settings don't undo my old choice.
33. As a member, I want sensible defaults that change nothing until I change them, so that HedgeHug doesn't go silent on me without my choice.
34. As a member, I want each message I can tune to tell me where to change it, so that I find the setting at the moment it annoys me.
35. As a member, I want only the settings for features I have, so that the tab doesn't list messages I can't get.

**Choosing where it arrives**
36. As a giver, I want the after-kudos reply as a DM instead of in the channel, so that the channel stays clear for me.
37. As a member, I want my level ups, quest finishes and Book tiers in the channel where the kudos happened, visible only to me, so that I see them in context.
38. As a member who chose in-channel, I want a message with no kudos behind it to come as a DM, so that it still reaches me.
39. As a member who isn't in the kudos message's channel, I want an in-channel message to come as a DM, so that it isn't lost.
40. As a member who clicks `Buy` on an in-channel level up, I want the answer only I can see, so that my purchase is never posted in public.

**Rollout, the website and analytics**
41. As the product owner, I want the thread fix live for everyone at once, since it's a fix, so that the noise stops now.
42. As the product owner, I want the settings behind `message-settings`, sandbox-only plus my email, so that I try them first (decision 18).
43. As the product owner, I want production byte-for-byte unchanged while `message-settings` is off, so that shipping is dark.
44. As the product owner, I want an event when a member changes a setting, so that I see which messages annoy people.
45. As the website's builder, I want the settings in one module with stable IDs, labels and descriptions, so that a web Settings page can wrap them later (WS335).
46. As the website's builder, I want setting a message setting to be safe to repeat, so that the web command needs no request key.

## Rules

### Stopping point 1: never post in a work thread (live)

- **QM1. One place for public celebrations.** Every public reply about a kudos message (its level sections and its tier sections) is posted only in the workspace's announcement channel, as a top-level message, and then edited in place as today: one public reply per kudos message in each place, so a channel picked anew between two sections gets its own post for the later ones, as today. It is never posted in the kudos message's thread or beside it in the kudos message's conversation. A kudos message posted in the announcement channel itself, in a thread or not, is celebrated as a top-level post in it.
- **QM2. No channel, no celebration.** While no announcement channel is picked, a level or tier earned through a kudos message is not celebrated in public, and no public reply row is stored for it. Its DM, App Home and the website are unchanged. The notices that already go only to the announcement channel (a level a reward reaches, P64; a launch batch's tier summary) keep their rules.
- **QM3. What is in flight when the fix lands.** A stored public reply is never posted and never edited again when it has a thread, or when its channel is its kudos message's own conversation and that conversation isn't the announcement channel. A top-level reply in the announcement channel is unaffected, even when the kudos was posted there. If it was waiting to be posted, its delivery finds nothing to show and stops, as a reply with no sections does today. If it was already posted, it stays in Slack as it is. Nothing is deleted from Slack.
- **QM4. The `Admin` tab.** The "Use threads" button and its line go. With no channel picked, the channel picker reads: `I don't celebrate {what} in public yet. Pick a channel to celebrate them there.` With one picked: `I celebrate {what} in this channel.`, then the line `Or stop celebrating them in public.` with a `Stop posting` button that clears the channel (the same `setAnnouncementChannel` command with no channel, still limited to those allowed to set the channel). `{what}` stays today's ("level ups", plus "and achievements" where the Book applies).
- **QM5. A fix, not a feature.** QM1–QM4 ship live, behind no flag (decision 11 covers new features, and this removes a misplaced post). Every other surface is unchanged. In a workspace with no channel picked, public celebrations stop until someone who manages the workspace picks one.

### Stopping point 2: the welcome (live)

- **QM6. Two versions.** The welcome message knows why the member is welcomed, as Welcome already does (`as` on memberWelcomed): a first **recipient** is welcomed by the giver's name, a first **giver** by the recipients'. A member named as giver is welcomed as a giver, as today.
- **QM7. The copy.** Rendered as Block Kit sections with a plain-text `text` fallback. Lines in order, each present only under its condition:
  1. Recipient: `🎉 *<@giver> just thanked you with a kudos!*`. Giver: `🎉 *Your first kudos just landed with {recipients}!*`, where `{recipients}` is up to three mentions joined as `<@a>`, `<@a> and <@b>`, `<@a>, <@b> and <@c>`, with `and {n} more` replacing the last name beyond three.
  2. `Welcome to HedgeHug, where we thank each other for the help that usually goes unnoticed.`
  3. While `xp-levels` is shown to the member: `Every kudos you give or receive earns XP.`, followed in the same paragraph, while unlocks are shown to them, by `As you level up you unlock {features}.`, where `{features}` names, in this order and joined like the recipients, each of `weekly quests` (Quests applies to the member), `a skill tree` (the skill tree applies) and `the Book of achievements` (the Book applies). The sentence is left out when it names none.
  4. Recipient: `👉 *Your first step:* thank someone who helped you lately. Mention them and add :{emoji}: to your message in any channel I'm in. Say why you're thanking them: it means more.` Giver: `👉 *Next step:* thank two more teammates this week. Say why you're thanking them: it means more.`
  5. `You have {n} kudos a day, and they refill at midnight your time.` (the workspace's base allowance).
  6. While the welcome's website link answers (QM8): `The HedgeHug website shows your kudos and progress in one place.`
  7. Buttons: `See your progress` (primary style) linking to the website while its link answers, then `Open App Home` linking to App Home (`slack://app?team=…&id=…&tab=home`). If Slack refuses a `slack://` URL in a button, `Open App Home` stays a link in the last line, as today.

  Today's `/hedgehug` line goes: App Home's hint already says it. The `:{emoji}:` is the workspace's kudos emoji.
- **QM8. The website link.** The welcome's website link comes from the same member-aware door the front door uses (the welcomed member's member decision for `website`, with the sign-in entry for a previewer while the workspace decision is off), not from the workspace-only link. It is decided at each delivery attempt. While it answers nothing, lines 6 and the button are left out, so the welcome has no website.
- **QM9. Rendered at delivery.** Each delivery attempt renders the welcome from current state (flags, allowance, emoji, the door), as today. The welcome request carries only what can't be read later: the member, why they were welcomed, and the giver or the recipients by Slack user. These arguments are optional, so a welcome queued before the deploy (with only workspace, user and attempt) still delivers. It renders the shared body with a neutral header, `👋 *Welcome to HedgeHug!*`, and the recipient's step.
- **QM10. Welcomed once, in pages.** A member is still welcomed at most once, ever. The welcome subscriber welcomes at most 100 members per mutation, each with its welcome row, its delivery and its memberWelcomed, and schedules itself for the rest. So none of its mutations schedules 1,000 functions or more, even for a kudos that names hundreds of new members (possible with a maintainer-raised base allowance). This rule covers the welcome subscriber only: the `Progression` component's kudosGiven subscriber also schedules per named member (`xpRecorded`, `levelReached`), about 2,800 functions for 700 new recipients, and paging it is a separate safety ticket outside this spec.
- **QM11. No flag.** The rewrite changes an existing message rather than adding a feature, and every line that names a feature follows that feature's flags (QM7). It ships live. `member welcomed` is captured as today.

### Stopping point 3: choosing what I get (behind `message-settings`)

- **QM12. The kinds.** One catalogue, each kind with a stable ID, a label and a one-line description, the same words in App Home and, later, on the website:

  | ID | Label | Description | Messages |
  | --- | --- | --- | --- |
  | `kudos-reply` | After-kudos reply | What a kudos you gave earned you, right after you send it. | the Given success reply and its gains line |
  | `tips` | Tips | Short tips on earning more, like saying why you're thanking someone. | the success reply's hint (P15), and #209's teaching lines when they ship |
  | `level-ups` | Level ups | When you reach a level, with what it opens for you. | the level-up DM |
  | `new-features` | New features | When a new feature is ready for you to open. | the ship sweep's DM |
  | `quests` | Quests and Journey | When you finish a quest or a Journey step. | the Journey step, Journey joined and weekly quest DMs |
  | `achievements` | Book tiers | When you earn an achievement tier. | the tier DM and the tier summary DMs |
  | `celebrations` | Public celebrations | Your level ups and tiers in the announcement channel. | the member's sections of public replies and notices |

- **QM13. What can't be turned off.** Errors that need action now stay where they are, always: the Over allowance and Invalid replies and the accepted-message-edited reply. Nor can the welcome, the answer to a `Buy`, App Home or a `/hedgehug` reply be turned off.
- **QM14. Defaults: today.** Every kind is on and arrives where it arrives today, until the member changes it. The quiet comes from the thread fix and from the member's choice, not from silencing what members get today. A member who turned DMs off with today's switch has `level-ups`, `new-features`, `quests` and `achievements` off. A member who muted public notices has `celebrations` off. Both are read as defaults, with no migration. Today's two switches, while they show (flag off), display the effective values from the module and write through it: `Mute notices` sets `celebrations`, and `Turn off DMs` sets the four DM kinds. So switching back after the flag was on never leaves a stored per-kind setting overriding the switch.
- **QM15. The setting.** A member's message setting is one value per kind: on or off (and, from QM23, a place). Setting it is safe to repeat: it writes the value asked for, and a second identical request changes nothing. No outcome is stored and no request key is needed.
- **QM16. Honoured twice.** A message of a kind the member turned off is not written, and a message already on its way is checked again when Slack takes it, as the DM setting is today. A DM, a reply or a section that its checks leave empty is not sent.
- **QM17. The after-kudos reply off.** With `kudos-reply` off, a Given reply that skipped nobody is not sent. One that skipped a mention is sent with its skip lines only, without the gains line, the hint or the link, so the giver still learns who wasn't thanked (R33's reply, shortened).
- **QM18. Tips off.** With `tips` off, the success reply's hint is left out of its extras line. With `kudos-reply` off, there are no tips either.
- **QM19. Celebrations off.** With `celebrations` off, the member's sections are left out of every public reply and notice, as muted notices are today.
- **QM20. The Settings tab.** While `message-settings` is on in the member decision, the Settings tab shows, whatever `xp-levels` and `everyone-board` say, so a member with only the core loop can still reach `kudos-reply`. The tab's notification switches give way to a group, `What I send you`. It has one row per kind that applies to the member: `*{label}* — {description}` with a `Turn off` or `Turn on` button, and the line says `Off` when it is. A kind applies while its feature shows to the member: `kudos-reply` always, `tips` while the skill tree applies, `level-ups` while `xp-levels` shows, `new-features` while unlocks show, `quests` while Quests applies to the member, opened or not, since Journey steps finish and DM before Quests is opened, `achievements` while the Book applies and is open, and `celebrations` while `xp-levels` is on in the workspace decision. The leaderboard switch stays as it is. While the flag is off, the tab is byte-for-byte today's.
- **QM21. The footer.** While `message-settings` is on in the member decision when Slack takes the message, each **private** message of a kind the member can tune (an ephemeral or a DM, never a public reply or notice) ends with one last line: `<slack://app?team=…&id=…&tab=home|Change what I send you> in App Home's Settings tab.` It is never on a message of QM13's list, and never in the announcement channel, which a member decision may not shape (F18). A message whose checks leave it empty gets no footer, and so isn't sent.
- **QM22. The flag.** `message-settings`, declared like the others (`safeDefault: false`), starts on for `environment = sandbox` and the product owner's email only (decision 18). It decides whether the rows (QM20) and the footer (QM21) show. A stored setting is honoured whatever the flag says, so turning the flag off never re-sends what a member turned off. With no stored setting, delivery is today's. So while the flag is off for everyone, production is byte-for-byte unchanged. Exposure is sent from the mutations that render App Home and from the delivery queries without one, as other flags do.

### Stopping point 4: choosing where it arrives (behind `message-settings`)

- **QM23. Places.** `kudos-reply` arrives **in the channel** (default) or **as a DM**. `level-ups`, `quests` and `achievements` arrive **as a DM** (default) or **in the channel**. `tips` follows its reply. `new-features` and `celebrations` have no choice. A Settings row with a choice gets a second button, `Send as a DM` or `Send in the channel`, and its line names the place.
- **QM24. In the channel.** An in-channel message is an ephemeral to the member beside the kudos message that caused it, in its thread for a thread reply, exactly where private replies go (R33). Only the member sees it. A kudos message's context reaches each notification explicitly: `levelReached.message` for a level up, the kudos for a tier, and, for a weekly quest or Journey step a kudos finishes, an optional kudos reference carried through the quest notification calls. Reward records stay as they are, and a level a reward reaches stays without a message (P64).
- **QM25. When in-channel can't be.** A message with no kudos message behind it (a level a reward reaches, a ship sweep, a summary on opening the Book or at a launch batch) arrives as a DM. So does one Slack refuses as an ephemeral because the member can't see the conversation (`user_not_in_channel`, `channel_not_found`, `not_in_channel`). The same goes for the Journey join, an activation or a recheck, which have no kudos context. Today's delivery folds `channel_not_found` and `not_in_channel` into `gone` and drops the error, so the ephemeral path gets a delivery answer that keeps Slack's error, while every existing delivery keeps today's classification.
- **QM26. A `Buy` never answers in public.** A `Buy` clicked in an in-channel level up is answered as an ephemeral to the clicker in that conversation, falling back to their DM, and never as a message others can see. A `Buy` clicked in a DM answers in the DM, as today.

### Shared

- **QM27. One module.** The catalogue, the defaults, the legacy fallbacks and the settings live in one platform-neutral module. Its interface is what the Slack adapter, `Feedback` and later a website read and command need: the settings of a member with each kind's ID, label, description, whether it applies, whether it's on and its place; whether a member wants a given kind (and where); and setting one kind. The website's WS335 page can wrap it as a `getMessageSettings` read and a `setMessageSetting` command on `memberMutation`, gated by `message-settings` (the website conductor's answer, 2026-10-14). This spec builds neither.
- **QM28. Analytics.** A changed setting records a usage fact that projects to the product event `message setting changed` with `kind`, `on` and, from QM23, `place`. A repeated request that changes nothing records nothing. Recording is scheduled apart from the click and never delays App Home.
- **QM29. The product name.** Every message names the product HedgeHug, as today.
- **QM30. What each stopping point leaves alone.** Stopping point 1 changes only where public replies go and the `Admin` tab. Stopping point 2 changes only the welcome. Stopping points 3 and 4 change nothing for a member with no stored setting while the flag is off for them.

## Implementation Decisions

- **`Feedback`'s public replies (stopping point 1).** The routing that picks a public reply's destination answers "the announcement channel, top level" or "nowhere". The thread fallback goes. The desired-reply query shows no sections for a row whose destination isn't the announcement channel at top level (QM3), so the existing delivery's "nothing to show" path stops it. The row's validator keeps its optional thread field for stored rows. No schema change.
- **Home's `Admin` tab** loses `threadLines` and the "Use threads" action, and gains the QM4 copy and the `Stop posting` action (the existing `setAnnouncementChannel` command with no channel).
- **Welcome (stopping point 2).** The subscriber passes `as` and the counterpart (the giver's Slack user, or the recipients' users) into the welcome request and pages its loop at 100 members, scheduling itself with a cursor over the event's members. `tierNotices`' `membersPerPage` is the prior art. `Feedback`'s welcome query renders QM7 from the member's flag reads and the member-aware website door (`frontDoorLinksOf`'s origin, or a shared function both use). The Slack adapter's welcome delivery sends blocks plus text. Its new arguments are optional, and an old-shape job renders QM9's neutral version.
- **Home's tabs.** The Settings tab shows while `message-settings` is on in the member decision, beside today's conditions (QM20). Today's switches read and write through the module (QM14).
- **A new message settings module** (a deep module beside progression and workspace) owns the catalogue (QM12), the defaults and legacy fallbacks (QM14), and the reads and writes (QM15, QM27). Its storage is a new `messageSettings` table, one row per member and kind (`member`, `kind`, `on`, optional `place`), indexed by member and kind. Today's `progressSettings` rows stay and are only read as fallbacks. The module's write is the only writer of the new table. Today's `setProgressSettings` command keeps working while the flag is off. A new `setMessageSetting` D17 command (kind, on, optional place) takes over in the Settings tab while it's on.
- **`Feedback`** asks the module, never the table: `notify` and `linesStillWanted` per notification kind (mapping the six notification kinds to four message kinds), the tier summaries, the success reply's write and its delivery query (QM17, QM18), and the public reply's sections (QM19, replacing the direct `muteNotices` read). The footer (QM21) is one line both DMs and replies append, decided in the same delivery queries.
- **Stopping point 4** adds a destination to DM intents and the success reply: the kudos message's conversation and thread root, carried where the notification has a kudos message (`levelReached.message`, the tier notice's kudos, and a new optional kudos reference on the weekly quest and Journey step notifications a kudos finishes; QM24). The Slack adapter posts an ephemeral there, and on QM25's errors it posts the same lines as a DM within the same attempt budget. For that, the delivery gains an answer that keeps Slack's error code for this path only (QM25). The success reply as a DM posts to the giver's user ID. The interactivity path learns that a click's container can be an ephemeral in a conversation, and routes the purchase answer per QM26.
- **The flag**: `messageSettingsFlag` (`message-settings`, `safeDefault: false`), read like `profile-card`: the member decision with exposure in the mutations that render App Home, without exposure in delivery queries.
- **Analytics**: a `messageSettingChanged` usage fact and its projection (QM28), scheduled from the command's mutation.
- **Coherence.**
  - `Feedback`'s spec: the prose and the invariant "one public reply per kudos message" lose the thread. A new invariant, **a public celebration is never posted in a work thread** (QM1–QM3), is refuted by restoring the thread fallback. The `Admin` tab copy in the prose follows QM4.
  - Welcome's spec: "welcomed at most once" gains the paged case (QM10) in its `over`, and a new invariant, **a welcome never schedules past Convex's limit**, is proven with transaction limits on.
  - A component spec for the message settings module: **a message a member turned off is never sent** (QM16), **errors that need action are never silenced** (QM13, QM17), and, in stopping point 4, **a `Buy` never answers in public** (QM26).
  - The lexicon: `announcement channel` and `public reply` drop "instead of the thread" and "under a kudos message", and `welcome message` gains its two versions (stopping points 1 and 2). `message setting` is declared, and `dm setting` becomes an alias of it (stopping point 3).
- **No manifest change.** `chat:write` covers ephemerals and DMs, and no scope is added.

## Testing Decisions

- **Good tests** drive the system from the outside: signed Slack events and interactivity payloads through the HTTP router with `convex-test`, Slack and PostHog stubbed at `fetch`. They assert what Slack is asked to post, update or publish, never tables. Times come from `settleInTimeOrder`. Exact-count tests name every scheduled job (repo memory).
- **Stopping point 1** (prior art: `convex/slack/publicNotices.test.ts`, `tierNotices.test.ts`): a level and a tier reached through a kudos in a thread and in a channel with no announcement channel post nothing. With one picked, they post one top-level message there, edited as sections arrive. A kudos posted inside the announcement channel's thread is celebrated at top level. A reply stored for a thread before the fix and still posting is never posted, and one already posted is never edited. The `Admin` tab shows QM4's copy and `Stop posting` clears the channel, and only for those allowed to set it.
- **Stopping point 2** (prior art: `convex/slack/welcome.test.ts`, `frontDoor.test.ts`): both versions, byte for byte, with every flag combination that changes line 3 and with the door open, as a previewer's sign-in entry, and closed. One, two, three and five recipients. Welcomed once. The paging case: one kudos naming 700 new members (base allowance raised in the test) welcomes each exactly once, with `testBackend({ transactionLimits: true })`, and each welcome mutation's `_scheduled_functions` count stays under 1,000 (the welcome subscriber's own, not the `Progression` component's; QM10). A welcome queued with the old arguments delivers QM9's neutral version.
- **Stopping point 3** (prior art: `convex/slack/progressionHome.test.ts`, `levelUpDm.test.ts`, `gainsLine.test.ts`, `gateHint.test.ts`): each kind off stops its messages, both at write and when turned off while a message waits. `kudos-reply` off still sends skip lines. Legacy `dms: false` and `muteNotices: true` are honoured. With the flag off, today's switches show and set the effective values, even over a per-kind setting stored while it was on. A core-loop-only member with the flag on gets the Settings tab. The footer never shows in a public reply. The Settings rows show per applying kind. The footer appears on tunable messages only, only while the flag is on. With the flag off, every Slack call equals `main`'s. The event fires once per real change. Repeated `setMessageSetting` clicks change nothing.
- **Stopping point 4** (prior art: `convex/slack/delivery.test.ts`, `kudosMessages.test.ts`): the reply as a DM. A level up in the channel, in a thread and at top level. A rewarded level and a ship sweep falling back to DM. `user_not_in_channel`, `channel_not_found` and `not_in_channel` falling back to DM, while existing deliveries classify them as today. A weekly quest finished by a kudos lands beside it, and a Journey join lands as a DM. A `Buy` clicked in an ephemeral answered privately, never by `chat.postMessage` to the channel.
- The message settings module gets no tests of its own: the boundaries cover it.

## Out of Scope

- A web Settings page (WS335 on map #57): the website wraps QM27 later.
- Choosing a Slack channel per member for one's own notices. "Where" means a DM or the in-channel ephemeral.
- Workspace-level defaults, and quiet hours.
- #209's teaching and nudges themselves: they join the `tips` kind when they ship.
- Reward animations that fly into the UI (moved to the website map by decision 22).
- Deleting public replies already posted in threads.
- A digest that batches several messages into one.

## Review

A GPT-6.1 Sol review (high) of the first draft found 8 majors and 2 minors. All 10 were fixed here:

1. **Major: switching back to today's switches could leave a stored setting overriding them.** They now show effective values and write through the module (QM14).
2. **Major: a member-gated footer could reach the shared announcement channel.** The footer is private-only (QM21).
3. **Major: a core-loop-only member had no Settings tab to reach.** `message-settings` shows it on its own (QM20).
4. **Major: the `quests` row waited for Quests' opening, while Journey DMs arrive before it.** It now shows while Quests applies (QM20).
5. **Major: reward records carry no kudos message.** Quest notifications carry an optional kudos reference instead, and rewarded levels stay message-free (QM24).
6. **Major: paging the welcome doesn't bound the whole kudos.** QM10 is scoped to the welcome subscriber. The `Progression` component's per-member scheduling (about 2,800 for 700 recipients) is a follow-up outside this spec.
7. **Major: welcomes queued before the deploy lack the new arguments.** They are optional, with a neutral version (QM9).
8. **Major: the delivery drops `channel_not_found` and `not_in_channel` into `gone`.** The ephemeral path keeps the error, and existing deliveries are unchanged (QM25).
9. **Minor: one public reply is per place.** A channel picked anew gets its own post, as today (QM1).
10. **Minor: the in-flight rule also matched valid posts in the announcement channel.** It now names threads, and conversations that aren't the announcement channel (QM3).

## Further Notes

**The product owner's words this spec builds on, verbatim.**

1. Quieter messages (map #1, decision 22, 2026-10-14): "the messages are a bit too much and spammy. Maybe we could limit it to either private messages or in-app messages." "Especially, I believe the reach level 2 is too much. That should be in the general configured channel and not in the thread. There should be one channel to be configured for this thing [...] where these global events happen." "It's probably nice to just have DMs and only have [ephemeral] messages for things where they go wrong and the user needs to act immediately, right? For gaining XP and so on, we can have DMs to the user from the app. Or even better, also leave the [ephemeral] messages and allow the user to adjust the settings, and say this in the footer to give them the option in the in-app settings. This should be a Slack app home settings page where they can turn on or turn off the various messages and choose the channel where they want to receive what message notifications."
2. Every new feature behind a flag (decision 11, 2026-10-13): "make sure that any new feature going to production, like leveling, the new website, etc. is behind a feature flag."
3. All in (decision 18, 2026-10-14): "Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on."
4. The cut (decision 12): the kinds list only what the game kept: no boosters, streaks, drops or titles.

**The calls taken at recommendation** are listed with their journal IDs in the resolution on #353.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
