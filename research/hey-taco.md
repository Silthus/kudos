# HeyTaco product reference for Kudos

Resolves [Silthus/kudos#6](https://github.com/Silthus/kudos/issues/6). Sources checked on 2026-10-13. Scope: public HeyTaco documentation, product pages, changelog, and the downloadable guides linked by its help center. No installation, authenticated account, or live Slack experiment was performed.

## Findings that matter for the next decisions

- **Daily allowance:** five tacos by default, resetting at midnight in the giver's own time zone, without rollover. Admins can change the limit for one person or everyone. This is a daily allowance, separate from received and redeemable balances. [^S1][^S2][^S3][^S14][^S20]
- **Message accounting:** every mentioned person receives the message's entire taco count. Two recipients and two taco emoji cost four tacos. A message exceeding the daily allowance is not counted. [^S4][^S5]
- **Reaction accounting differs:** a taco reaction gives one taco to each mentioned person, or to the author when there are no mentions. The Slack user guide says a reaction can partially succeed in mention order when the giver lacks enough tacos. [^S6][^S7] (PDF p. 3)
- **Edits are ignored:** adding an emoji or mention after sending does not create an award. HeyTaco tells users to send a new message. Kudos's edit-to-retry requirement is therefore its own design choice. [^S5][^S7] (PDF p. 5)[^M1]
- **Some interaction rules remain unknown:** the checked public sources do not establish message-deletion rollback, reaction-removal rollback, bot-recipient handling, or the DM/ephemeral/channel transport of ordinary award notifications. Do not treat these gaps as established behavior. See the evidence gaps below. [^S5][^S6][^S7][^S8][^S24]
- **Progression has deliberately hidden formulas:** levels are uncapped; 50 Tacotars are collectible; stickers use secret unlock formulas. No numeric XP formula or catalogue of user-unlockable bot messages was found in the progression sources. [^S9][^S10][^S11][^S27]
- **Slack leaderboards rank people and filter by channel.** A Team subscription scopes leaderboards and rewards to selected people; that is distinct from a leaderboard ranking teams against each other, which the checked sources do not establish. [^S12][^S13]

These are reference findings, not decisions for Kudos. The map requires product decisions to go through grilling. [^M1]

## 1. The basic recognition loop

A user posts a message containing a recipient's `@username` and a taco emoji. HeyTaco tracks it when it can see the channel. The docs encourage a specific note of appreciation, but describe the mention and emoji as the two required message elements. [^S15][^S1]

In Slack, awards work in public and private channels where HeyTaco has been added; awards cannot be given in direct messages. Private-channel awards count, but their message content stays out of the public activity feed and profile pages by default. Admins can enable visibility for subsequent private-channel messages. [^S5][^S16][^S17]

For ordinary Workspace subscriptions, giving or receiving a first taco automatically creates a HeyTaco user. Slack Team subscriptions require people to be added manually. [^S13][^S18]

### Allowance and reset

- The default is **five tacos to give per person per day**. The sender can distribute them or give all five to one person. Unused allowance does not carry over. [^S1]
- The official one-pager explicitly says: **“Daily tacos reset at midnight in your time zone.”** The welcome slide deck also says midnight, without naming the zone. Both downloads are linked from the official help center. [^S2][^S3] (slide 5)[^S19]
- Admins can change an individual's allowance under `Admin → People` or everyone's allowance under `Admin → Settings`. The giving frequency cannot be changed to weekly or monthly. [^S14]
- There is no cap on how many tacos a person may receive, according to the official welcome deck. [^S3] (slide 5)
- Lifetime tacos received and redeemable tacos are distinct. Redemption deducts from the redeemable balance, while received totals stay unchanged. [^S20]

**Not established:** how the giver's time zone is obtained, the fallback when absent, daylight-saving handling, the effect of changing zones mid-day, and whether rollover is implemented by a job or calculated from dates. The one-pager establishes the user-facing reset rule, not those implementation details. [^S2]

### Multiple recipients and multiple tacos

For an ordinary message, **cost = recipient count × taco emoji count**. Emoji placement relative to individual mentions is not documented as allocating separate amounts: the stated rule is that each mentioned person receives the total number of tacos in the message. [^S4]

Illustrations derived from that rule, using invented recipient placeholders: [^S4]

```text
@teammate_a @teammate_b thanks! 🌮
=> each receives 1; sender spends 2

@teammate_a @teammate_b thanks! 🌮🌮
=> each receives 2; sender spends 4

@teammate_a @teammate_b @teammate_c thanks! 🌮🌮
=> requests 6; exceeds the default daily allowance of 5
```

The troubleshooting article says HeyTaco will not count a multi-person message if it would exceed the daily limit. The welcome deck illustrates that the over-limit message “won't go through.” Together these support whole-message rejection, rather than distributing what remains, for ordinary messages. [^S5][^S3] (slide 9)

**Not established:** duplicate mentions, user-group mentions, ignored recipients inside a mixed valid/invalid batch, custom emoji aliases, or parsing emoji in quoted text, code, or attachments. The simple accounting rule does not answer these cases. [^S4][^S15]

### Giving through reactions

Taco Reactions are Slack-only and require an admin to enable them. A taco reaction awards the mentioned person; if there are no mentions, it awards the message author. The linked Slack user guide clarifies the multiple-recipient case: every tagged person receives one taco, if allowance permits. [^S6][^S7] (PDF p. 3)

The guide explicitly says that, without enough allowance, the bot gives one taco to each person **in the order they are tagged until the giver runs out**. That differs from the rejection rule for over-limit ordinary messages. The current short reaction article omits this partial-success detail; it does not contradict it. Treat this as guide-level evidence rather than a live-tested guarantee. [^S7] (PDF p. 3)[^S6][^S5]

**Not established:** what happens when a reaction is removed or removed and re-added, or when the underlying message's mentions change after a reaction award. [^S6][^S7]

## 2. What the bot replies, and where

### Ordinary awards

The Slack guide says the giver receives a notification whenever tacos are sent, and a notification explaining why when they are not sent. It also points to the web Activity page to confirm awards. [^S7] (PDF p. 4)

The success screenshot on that page shows the recipient, the awarded amount, the remaining daily allowance, and a `View...` dropdown. Its wording, with the recipient replaced by a placeholder, is: [^S7] (PDF p. 4, first screenshot)

> `{recipient}` received **1 taco** from you. **You have 4 tacos left to give out today.**

The crop does **not** identify a conversation or show an “Only visible to you” label. It therefore cannot establish whether this is a DM, an ephemeral channel message, or another Slack message surface. It also does not prove public delivery. Exact ordinary failure copy and ordinary recipient-notification behavior were not established by the checked sources. [^S7] (PDF p. 4)[^S8]

Users can enable or disable notifications from individual profile settings. The current notification article does not enumerate notification categories or describe their transport. Its Slack instructions refer to the profile in the top-right corner of HeyTaco. [^S8]

### Reactions and other messages

- **User input reactions:** a user's taco reaction is an optional way to give an award. This is not evidence that the bot reacts to every successfully processed message. The checked sources do not specify bot acknowledgement emoji or acknowledgement removal rules. [^S6][^S7]
- **Welcome:** during Slack setup, the installer can choose whether to send a welcome message to the channel. The documented command `@HeyTaco welcome` sends it later. Exact welcome copy is not supplied in the article. [^S21]
- **Stickers:** `/stickers` opens the Slack sticker-giving flow. The browser flow lets the giver choose recipients, channels, and a message, then posts to the chosen channels. [^S10]
- **Custom/collaborative reward redemption:** the redeeming user gets a **direct message** confirming redemption and naming the admins; the admin is notified so they can fulfill it. This proves DM behavior for reward redemption, not for ordinary taco awards. [^S22]
- **Milestones:** birthdays and work anniversaries can be celebrated publicly in a configured channel, privately in a DM, or not at all, according to the person's settings. Public messages tag the person; anniversary messages include years of service. These are separate from ordinary recognition. [^S23][^S25]

## 3. Edits, deletions, self-giving, and bots

### Message edits

HeyTaco **only reads the original message**. An edit adding a taco or a mention is ignored; the remedy is to send a new message. The official guide and welcome deck agree with the current troubleshooting article. [^S5][^S7] (PDF p. 5)[^S3] (slide 9)

This does not establish how HeyTaco displays an already-counted award after a cosmetic edit, nor whether removing a taco in an edit changes historical message text. Avoid deriving a full message-revision contract from the narrower documented rule. [^S5]

### Deletion and reversal

**Unknown:** whether deleting a message reverses its awards, refunds the sender, changes progression or redeemable balances, or removes any acknowledgement. No message-deletion contract was found in the checked giving docs, Slack guide, or targeted help-center searches. Account removal is documented separately and must not be used as evidence of message-deletion behavior. [^S5][^S6][^S7][^S24][^S26]

Similarly, **reaction removal and re-addition are unknown**. The reaction docs explain giving, not undoing. [^S6][^S7]

### Self-giving

The Slack guide explicitly says **“you can't give tacos to yourself”** while describing the reaction-to-author case: a user reacting to their own untagged message does not get a taco. The welcome deck repeats the exception. [^S7] (PDF p. 3)[^S3] (slide 7)

That supports a self-giving prohibition as a product reference. It does not specify the result of a normal message mentioning both the giver and other recipients, whether self-mentions are excluded before checking the allowance, or the error text. [^S7][^S4]

### Bot recipients and bot-authored messages

**Unknown:** whether a bot can receive a taco, whether giving to HeyTaco itself triggers playful copy, whether other bots are handled differently, and whether bot-authored messages can give tacos. Neither the checked giving documentation nor searches for `bot`, `bots`, and `robot` supplied a recipient policy. “Tag a coworker” is guidance, not proof of bot filtering. [^S15][^S24]

## 4. Levels, collectibles, rewards, and fun

### Levels and Tacotars

Levels exist on Slack and Microsoft Teams. Tacotars, the collectible taco characters, are Slack-only in the current help article. Giving and receiving behavior contributes to unlocking them; consistency and spreading appreciation are described as helpful. [^S9]

There are **50 Tacotars**. Each new Tacotar also unlocks a new level, but a level does not necessarily unlock a Tacotar. Levels can keep increasing without a cap and become more challenging. The public catalogue runs from `#1 Taco Initiate` to `#50 Hall of Famer`. [^S9][^S11]

**Unknown:** numeric XP per award, thresholds, a public level curve, and whether receiving and giving contribute equally. The cited sources describe participation-based progression, not an implementable XP formula. [^S9][^S11]

### Unlockable stickers

Stickers are Slack-only consumables that give extra tacos **without consuming the ordinary daily allowance**. Each sticker can be given once; unused recipient capacity is lost. [^S10]

The current help article lists these eight stickers: [^S10]

- **Tacocat:** one person, two tacos.
- **Taco Trophy:** one person, five tacos.
- **Taco High Five:** up to three people, one each.
- **Taco Rockstars:** up to five people, one each.
- **Taco Truck:** up to five people, two each.
- **Taco Piñata:** up to six people, one each.
- **Taco Rain:** up to ten people, one each.
- **Taco Confetti:** one taco to every person with a HeyTaco account in the channel. It increases recipients' received balances but not the giver's given balance.

Every sticker has a different **secret formula**. The docs say consistent, meaningful appreciation and distributing tacos across teammates make unlocking more likely. Locked stickers display **Unlock Energy**, a progress bar with a cryptic hint. Energy can rise and fall; time-window criteria can cause progress to reset. [^S27]

Do not confuse resetting unlock progress with expiring an earned sticker. The February 2026 changelog says earned stickers **no longer expire**. The catalogue also changes: the September and December 2025 entries record renamed/replaced and retired stickers. The main current list above is more suitable than the older `Taco Tree` example still present lower down in the sticker article. [^S28][^S10][^S27]

### Redeemable rewards

HeyTaco supports custom rewards fulfilled by the organization, collaborative rewards funded by pooled tacos, and gift cards fulfilled by HeyTaco. Admins create rewards; users spend redeemable balances. The official guide recommends introducing rewards after the recognition habit is established. [^S29]

Received totals and redeemable balances stay separate: spending a reward does not lower the received total used to describe historical recognition. Admin Taco Bonuses add directly to redeemable balance, use no sender's daily allowance, and do not affect leaderboard totals. [^S20][^S30]

These are product-reference facts, not a recommendation to build a Taco Shop in Kudos. The current map excludes a web UI and separates the core loop, progression, and team leaderboard/profile. [^M1]

### Unlockable or playful messages

- **Confirmed unlock feedback:** the January 2026 changelog mentions clearer sticker unlock messages. It does not publish the full copy or their delivery surface. [^S28]
- **Confirmed message variety:** the May 2026 changelog says milestone messages rotate through several variations. Admins can select/edit birthday and anniversary messages. That is variety and customization, not evidence of messages unlocked by XP. [^S28][^S23]
- **Confirmed playful presentation:** collectible character names, sticker names, cryptic unlock hints, and the documented welcome command provide visible examples of the playful layer. [^S10][^S11][^S27][^S21]
- **Not found:** a public catalogue of user-unlockable ordinary award messages, message unlock thresholds, bot-recipient jokes, or exact over-limit/self-giving bot replies. Treat any proposed Kudos message catalogue as original product work, with separate research into the archived repo if the conductor requests it. [^S9][^S10][^S27][^S24][^M1]

## 5. Leaderboards and teams

- The leaderboard can show **given**, **received**, or, in Slack, **combined** tacos. The marketing example calculates combined as given plus received. [^S12][^S31]
- Time filters are today, this week, this month, this year, all-time, and custom date ranges. Slack supports filtering by **channel**; Microsoft Teams supports filtering by **team**, not individual channel. [^S12]
- **Giver Mode** leaves only the given leaderboard visible to ordinary users. Admins can still see all views. Admins can also disable any or all leaderboards. [^S32][^S33]
- A **Team subscription** selects the people who have access and scopes leaderboards and rewards to that group. Multiple independent Team subscriptions can exist in an organization. In Slack, these members are manually added; in Microsoft Teams the subscription is scoped to a native Team. [^S13]
- **Not established:** a Slack feature ranking teams against each other, team-score formulas, membership changes applied to historical awards, tie-breaking rules, and the time zone/week-start used for leaderboard periods. Channel filtering and subscription scoping do not answer those questions. [^S12][^S13]

The docs explicitly position recognition as appreciation rather than individual performance evaluation. That framing is useful context for grilling a competitive team leaderboard. [^S34]

## 6. Questions and prototype scenarios for Kudos

The following are **research recommendations**, not locked decisions. The related HeyTaco evidence is cited so the conductor can use it when grilling the core loop and shaping the architecture prototype. [^M1]

1. **Allowance clock:** decide whether Kudos also uses the giver's local midnight or a workspace-wide day. If local, specify missing zones, daylight saving, zone changes, and which date applies to delayed/retried events. HeyTaco's published rule supports local midnight but supplies none of those mechanics. [^S2]
2. **Batch accounting:** ask whether an over-limit multi-recipient message rejects the entire batch or partially awards it. If reactions are supported, decide whether they should use the same rule. HeyTaco documents different behavior for messages and reactions. Prototype two recipients/two emoji with three allowance remaining. [^S4][^S5][^S7]
3. **Revision contract:** preserve the map's edit-to-retry intent, then specify eligible retries and whether changing an accepted message can add, remove, or replace awards. Prototype a rejected message edited below the cap, an accepted message edited, a duplicate delivery, and an edit crossing midnight. HeyTaco ignores edits and supplies no retry precedent. [^M1][^S5]
4. **Deletion and recipient policy:** explicitly decide refunds/reversals, self-mentions in mixed batches, bot recipients, and reaction removal. The research leaves these cases open. Prototype them through the kudos engine's interface before depending on Slack transport behavior. [^S4][^S6][^S7][^S24]
5. **Feedback:** choose a success acknowledgement, private failure explanation, remaining-allowance feedback, and recipient notification policy. Avoid assuming HeyTaco's ordinary notices are DMs or ephemeral; the guide establishes content but not transport. [^S7][^S8]
6. **Progression inputs:** keep ordinary giving allowance, recognition totals, and progression conceptually distinct. Choose original XP/level/achievement/message thresholds rather than reverse-engineering secret sticker formulas. If deletion is reversible, specify whether its progression effects also reverse. [^S1][^S9][^S20][^S27]
7. **Team leaderboard:** define what a Kudos team is, whether scores reward giving/receiving/both, whether totals or per-person rates rank teams, and what a membership change does to historical scores. HeyTaco's Slack channel filter and Team subscription are useful references, not a complete team-competition specification. [^S12][^S13]

For the prototype, a small interface returning accepted awards, rejected reasons, and remaining allowance would let the kudos engine own the accounting contract while the Slack adapter chooses reactions and message surfaces. Progression and leaderboard projections should consume accepted awards under explicitly chosen reversal rules. This is a proposed seam to explore, not a claim about HeyTaco's implementation or a prescribed Kudos architecture. [^M1]

## Evidence gaps and method

Primary sources were read directly, including 36 articles across giving, notifications, stickers, progression, leaderboards, admin basics, rewards, and bonus categories, plus targeted linked articles. The official Slack guide was read as text and its notification screenshot inspected; the one-pager and welcome deck supplied the reset and reaction details missing from shorter articles. Downloads came from the links on the official help-center guide page. [^S19]

The help center's targeted searches included `reset`, `midnight`, `timezone`, `time zone`, `UTC`, `edit`, `delete`, `deletion`, `bot`, `bots`, `robot`, `yourself`, `ephemeral`, `notification`, `commands`, and `fun messages`. Search absence is evidence of a research gap, not proof the product lacks the behavior. Relevant example search URLs are included in [^S24].

Authority is strongest for explicit documented rules. Guide screenshots establish only what is visible in their crop. Untimestamped downloadable guides and mutable help articles may lag the product; the dated changelog was used to distinguish expired-sticker history from the current rule. No unverified behavior has been promoted to a fact. [^S7][^S19][^S28]

No Michael input is needed to resolve this research ticket. The unanswered product choices belong in the conductor's subsequent grilling/prototype work, and undocumented HeyTaco edge cases can be probed later if strict parity becomes necessary. No other ticket or map was changed.

## References


[^M1]: [Kudos map #1: destination, notes, and decisions](https://github.com/Silthus/kudos/issues/1).

[^S1]: [How does HeyTaco work?](https://heytaco.com/docs/article/75-how-does-heytaco-work).

[^S2]: [Official HeyTaco one-pager, PDF](https://39811870.fs1.hubspotusercontent-na1.net/hubfs/39811870/HeyTaco_Onepager.pdf), linked by [^S19]. Reset quote is on the single page.

[^S3]: [Official HeyTaco welcome kit, PPTX](https://39811870.fs1.hubspotusercontent-na1.net/hubfs/39811870/HeyTaco_WelcomeKit.pptx), linked by [^S19]. Slide numbers refer to the deck including its initial admin-only slide.

[^S4]: [How do I give tacos to multiple people in one message?](https://heytaco.com/docs/article/31-giving-tacos-to-multiple-people-in-one-message).

[^S5]: [Why isn't HeyTaco seeing my tacos?](https://heytaco.com/docs/article/7-5-reasons-heytaco-wont-see-your-tacos).

[^S6]: [How do taco reactions work?](https://heytaco.com/docs/article/83-how-to-taco-reactions-work).

[^S7]: [Official HeyTaco for Slack user guide, PDF](https://39811870.fs1.hubspotusercontent-na1.net/hubfs/39811870/HeyTacoSlack_UserGuide.pdf), linked by [^S19]. PDF page numbers include the cover; printed page numbers are one lower.

[^S8]: [How can I adjust my notifications?](https://heytaco.com/docs/article/89-how-can-i-adjust-the-notifications-heytaco-sends-me).

[^S9]: [What are Tacotars and levels?](https://heytaco.com/docs/article/91-what-are-tacotars).

[^S10]: [What are Stickers & how to give one?](https://heytaco.com/docs/article/28-what-are-stickers).

[^S11]: [Tacotar catalogue and FAQ](https://heytaco.com/tacotars).

[^S12]: [How do I filter the leaderboard?](https://heytaco.com/docs/article/64-leaderboard-options).

[^S13]: [Workspace and Team subscriptions](https://heytaco.com/docs/article/22-can-i-pay-just-for-my-team-on-slack).

[^S14]: [Can I adjust daily taco limits?](https://heytaco.com/docs/article/78-can-i-adjust-daily-taco-limits).

[^S15]: [How do I give a taco?](https://heytaco.com/docs/article/66-giving-tacos).

[^S16]: [Can I give tacos in a direct message?](https://heytaco.com/docs/article/88-can-i-give-tacos-in-a-direct-message).

[^S17]: [How do tacos in private channels work?](https://heytaco.com/docs/article/60-private-channel-tacos).

[^S18]: [How do I add people to HeyTaco?](https://heytaco.com/docs/article/99-how-do-i-add-people-to-heytaco).

[^S19]: [Welcome Kit & User Guides](https://heytaco.com/docs/article/128-user-guides).

[^S20]: [Redeemable balance versus received balance](https://heytaco.com/docs/article/139-why-is-my-redeemable-balance-different-from-my-recieved-balance).

[^S21]: [How do I add HeyTaco to my workspace?](https://heytaco.com/docs/article/65-adding-heytaco-to-my-workspace).

[^S22]: [Redeeming a Reward](https://heytaco.com/docs/article/81-redeeming-reward).

[^S23]: [Milestone message content and customization](https://heytaco.com/docs/article/119-milestones-recognition-messaging).

[^S24]: Targeted official help-center searches: [deletion](https://heytaco.com/docs/search?query=deletion), [bots](https://heytaco.com/docs/search?query=bots), [robot](https://heytaco.com/docs/search?query=robot), [ephemeral](https://heytaco.com/docs/search?query=ephemeral), [notification](https://heytaco.com/docs/search?query=notification), [fun messages](https://heytaco.com/docs/search?query=fun%20messages).

[^S25]: [Where and when milestone messages are posted](https://heytaco.com/docs/article/120-visibility-notifications).

[^S26]: [What happens when someone leaves or is deactivated?](https://heytaco.com/docs/article/145-what-happens-to-tacos-when-someone-leaves-or-is-deactivated).

[^S27]: [How do I unlock Taco Stickers?](https://heytaco.com/docs/article/100-how-do-i-earn-taco-stickers).

[^S28]: [Official changelog](https://heytaco.com/changelog), especially September/December 2025 and January/February/May 2026.

[^S29]: [Getting started with rewards in HeyTaco](https://heytaco.com/docs/article/112-getting-started-with-rewards-in-heytaco).

[^S30]: [Can admins give bonus tacos to team members?](https://heytaco.com/docs/article/140-can-admins-give-bonus-tacos-to-team-members).

[^S31]: [Gamification product page](https://heytaco.com/features/gamification), illustrative combined leaderboard.

[^S32]: [What is Giver Mode?](https://heytaco.com/docs/article/74-giver-mode).

[^S33]: [How do I disable the leaderboard?](https://heytaco.com/docs/article/79-how-do-i-disable-the-leaderboard).

[^S34]: [HeyTaco Administrator Guide](https://heytaco.com/docs/article/208-heytaco-administrator-guide).
