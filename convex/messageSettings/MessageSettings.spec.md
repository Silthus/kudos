# Message settings

A member's message settings, one place per kind of message HedgeHug sends them (QM12–QM16, QM22–QM27). The catalogue holds seven kinds, each with a stable ID, a label and a one-line description: `kudos-reply`, `tips`, `level-ups`, `new-features`, `quests`, `achievements` and `celebrations`. Every kind is on until the member changes it; a member whose stored progress settings turned DMs off has the four DM kinds off, and one who muted public notices has `celebrations` off, read as defaults with no migration (QM14). Each kind is one choice of place among those it allows (QM23, decision 24): `kudos-reply` in the channel (default), as a DM or none; `level-ups`, `quests` and `achievements` as a DM (default), in the channel or none; `new-features` as a DM or none; `celebrations` in the announcement channel or none; `tips` follows its reply, or none. None is off. The `messageSettings` table keeps one row per member and kind, written only by setMessageSetting, which writes the place asked for and changes nothing when it is already the member's place, so a repeated request needs no request key and stores no outcome (QM15); a row stored before places read `on` as the kind's default place and off as none. placeOf answers where a member gets a kind and wantsMessage whether they get it at all, whatever the `message-settings` flag says (QM22). `Feedback` asks wantsMessage before a DM or a public section is written and again when Slack takes it (QM16). messageSettingsOf reads each kind with its label, description, whether it applies to the member, whether it is on, its place and the places it allows (QM20, QM27); App Home's Settings tab shows one picker per kind with those places. In the channel is an ephemeral to the member beside the kudos message that caused it, in its thread for a thread reply (QM24): a level up carries `levelReached.message`, a tier its kudos, and a weekly quest or Journey step a kudos finishes carries that kudos; a message with no kudos behind it (a level a reward reaches, a ship sweep, a tier summary, a Journey join, an activation or a recheck), or one Slack refuses beside it with `user_not_in_channel`, `channel_not_found` or `not_in_channel`, arrives as a DM in the same attempt, while every other delivery classifies those errors as before (QM25). The after-kudos reply as a DM goes to the giver's user, held for Quests as before. A `Buy` clicked in an ephemeral is answered as an ephemeral to the clicker in that conversation, falling back to their DM, and one clicked in a DM answers in the DM (QM26). Today's two App Home switches show and set the effective values through the module: `Mute notices` sets `celebrations`, `Turn off DMs` sets the four DM kinds (QM14). The `message-settings` flag, safe default off, decides by the member decision, with its exposure in the mutations that render App Home, whether App Home's Settings tab lists the kinds and offers setMessageSetting (QM20, QM22). `Feedback` asks it for the after-kudos reply too, when the reply is written and again when Slack takes it, a reply held for Quests included: with `kudos-reply` off a Given reply that skipped nobody is not sent, and one that skipped a mention is sent with its skip lines only, without the gains line, the hint or the link (QM17); with `tips` off the hint is left out of the extras line (QM18). While `message-settings` is on in the member decision when Slack takes it, read without exposure, the success reply and every DM of a tunable kind, the tier summaries included, end with the footer `Change what I send you` linking App Home, then `in App Home's Settings tab.`; never a public reply or notice, an Over allowance, Invalid or accepted-message-edited reply, a reply holding only skip lines, the welcome, a `Buy` answer or a command reply (QM21).

## invariants
- a message a member turned off is never sent: A DM of a kind the member turned off, or has off from their stored progress settings, is never sent: it is not written while the kind is off, and one already on its way is not sent once it is off when Slack takes it; a member's section is left out of every public reply posted or edited while their `celebrations` is off, as muted notices are today. Both hold whatever the `message-settings` flag says.
  over: the level-up DM and the public celebration of a level reached through a kudos message with `level-ups` or `celebrations` turned off from App Home; a level-up DM Slack held back while the member turned `level-ups` off; a DM of each of the six notification kinds already on its way, delivered while its kind is on and again once it is off; and a DM of each kind written while it is off, turned on again before Slack would take it
  via: QM16: a message a member turned off is never sent
  because: members asked for quieter messages (decision 22); a setting a member chose that HedgeHug ignored, or that a queued message slipped past, would break the promise the Settings tab makes the moment they click it (QM16)
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  refuted: wantsNotification in convex/feedback/notify.ts answered true without reading the member's message setting -> 8 of 9 tests failed, the turned-off DMs sent at write and when Slack took them (2026-10-14)
  refuted: notify in convex/feedback/notify.ts wrote every DM whatever the member's message setting, leaving only the delivery re-check -> 6 of 15 tests failed, each DM written while its kind was off sent once it was on again (2026-10-14)
  kinds: output, state
  checklist: revalidated-permission dismissed: no permission is involved; each delivery attempt rereads the member's current setting before Slack is called
  checklist: destination-confinement dismissed: a place only picks between the member's own DM and an ephemeral only they see beside the kudos message that caused it; nothing is posted where others can see it
  checklist: redaction dismissed: a setting adds nothing to a message; it only withholds one
  checklist: separation-of-duties dismissed: a member sets only their own settings; no approval is involved
  checklist: legal-state-succession dismissed: a setting is a plain on or off value; every value can follow every other
  checklist: supersession-safety dismissed: setMessageSetting writes the value asked for, and each delivery reads the latest committed value
  checklist: worker-fencing dismissed: no worker owns a member's settings
  checklist: commit-ordered-effects dismissed: a setting issues no external effect; the deliveries it gates are scheduled after their own mutations commit
  checklist: resumption-coverage dismissed: setting a kind is one write, not a batch
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: a setting gates one member's messages; nothing fans out
- errors that need action are never silenced: The Over allowance and Invalid replies, and the skip lines of a Given reply that skipped a mention, reach the giver whatever their message settings say, every kind turned off included.
  over: a kudos over the giver's allowance, a kudos naming nobody who can receive kudos, and a kudos to a teammate that also named a bot and a user group, given by a member who turned off every kind that applies to them
  via: QM13: errors that need action are never silenced
  because: a failed kudos, or a mention skipped in a kudos that thanked someone else, that the giver never hears about leaves them thinking a teammate was thanked (QM13, QM17, user story 30); only a message they can act on keeps the failure visible
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  refuted: tellGiver in convex/engine/engine.ts sent no reply, error replies included, while the giver's kudos-reply setting was off -> the test failed, no Over allowance or Invalid reply sent (2026-10-14)
  refuted: successReplyWritten in convex/feedback/replies.ts dropped the skip lines of a Given reply while the giver's kudos-reply setting was off -> 1 of 2 tests failed, the kudos that skipped a bot and a group sent no reply (2026-10-14)
  kinds: output
  checklist: destination-confinement dismissed: the error replies go where they go today, beside the kudos message to its author
  checklist: redaction dismissed: settings add nothing to an error reply
  checklist: commit-ordered-effects dismissed: the reply is scheduled from the mutation that decided the outcome, as today
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: an error reply goes to one giver; nothing fans out
- the after-kudos reply and its tips honour their settings: A Given reply is checked against the giver's `kudos-reply` and `tips` settings when it is written and again when Slack takes it, a reply held for Quests included: with `kudos-reply` off only its skip lines are sent, and nothing when it skipped nobody, and with `tips` off its extras line has no hint; a reply or a hint written while its kind was off is not sent once the kind is on again.
  over: a kudos with `kudos-reply` off; a reply held for Quests that skipped nobody and one that skipped a bot, released after `kudos-reply` turned off; a kudos and a held reply with `tips` off for a giver the hint applies to; and a reply and a hint written while their kind was off, turned on again before Slack would take them
  via: QM17 QM18: the after-kudos reply and its tips honour their settings
  because: the after-kudos reply is the most frequent message HedgeHug sends; a member who turned it or its tips off and still gets them sees the Settings tab ignored on every kudos they give (QM17, QM18)
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  refuted: privateReply in convex/feedback/replies.ts no longer rechecked the giver's kudos-reply setting when Slack took the reply -> 2 of 7 tests failed, both held replies released after kudos-reply turned off sent the Given line and gains (2026-10-15)
  kinds: output, state
  checklist: revalidated-permission dismissed: no permission is involved; each delivery attempt rereads the giver's current settings before Slack is called
  checklist: destination-confinement dismissed: the settings decide only which lines are sent, never where; the reply goes where it goes today
  checklist: redaction dismissed: a setting adds nothing to a reply; it only withholds lines
  checklist: separation-of-duties dismissed: a member sets only their own settings; no approval is involved
  checklist: legal-state-succession dismissed: each setting is a plain on or off value; every value can follow every other
  checklist: supersession-safety dismissed: each delivery attempt reads the latest committed settings
  checklist: worker-fencing dismissed: no worker owns a reply; each delivery attempt rereads the settings
  checklist: commit-ordered-effects dismissed: the reply is scheduled from the mutation that wrote it, as today
  checklist: resumption-coverage dismissed: one reply is one write, not a batch
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: a reply goes to one giver; nothing fans out
- the settings footer is only on private messages a member can tune: The footer that links App Home's Settings tab ends the success reply and every DM of a tunable kind while `message-settings` is on in the member decision when Slack takes it, and never ends a public reply or notice, an Over allowance, Invalid or accepted-message-edited reply, or anything while the flag is off.
  over: the success reply and a DM of each of the six notification kinds with the flag on, the level-up DM and its public celebration in the announcement channel, the Over allowance, Invalid and accepted-message-edited replies with the flag on, the success reply and level-up DM with the flag off, and a level-up DM written while the flag was off and taken by Slack after it turned on
  via: QM21: the footer says where to change what I send you
  because: the footer tells one member where their own settings are; on a public message it would show a member decision in the shared announcement channel (F18), and on an error it would suggest the error can be turned off (QM13, QM21)
  crossing: slack-request -> domain
  entrances: route POST /slack/events
  refuted: settingsFooterFor in convex/feedback/settingsFooter.ts answered the footer for every member, whatever their message-settings decision -> 1 of 11 tests failed, the success reply with the flag off ended with the footer (2026-10-15)
  kinds: output
  checklist: destination-confinement dismissed: the footer adds a line to private messages only; it never changes where a message goes
  checklist: redaction dismissed: the footer holds a fixed link to App Home and no member data
  checklist: commit-ordered-effects dismissed: the footer is decided in the delivery query, after the mutation that wrote the message committed
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: each footer goes to the one member its message goes to
- message settings are dark wherever message-settings is off: A member for whom `message-settings` is off in the member decision, not created, or undecided because the flags key is missing, sees nothing of message settings in any Slack call: no `What I send you` rows in App Home's Settings tab, no footer on a reply or DM, and no setMessageSetting button, so every Slack call for a member with no stored setting is today's (QM22, QM30). With the flag on for one member's email only, that member sees the rows and the footers, and every other member's Slack calls equal those with the flag off.
  over: every Slack call of one walk down every message path (the success reply, the welcome, Journey and weekly quest DMs, level-up DMs, the Coins DM, Book tier DMs, the public celebrations in the announcement channel and App Home's Settings tab) for two members with `message-settings` off, not created, and on while the flags key is missing, and the same walk with it on for one member's email only
  via: QM22 QM30: message settings are dark wherever message-settings is off
  refuted: settingsFooterFor in convex/feedback/settingsFooter.ts answered the footer for every member, whatever their message-settings decision -> 3 of 4 tests failed on their assertions: with the flag not created, with the flags key missing, and for the other member while the flag was on for one email only, replies and DMs ended with the footer (2026-10-15)
  because: decision 11 ships every new feature dark behind its flag and decision 18 starts `message-settings` for the sandbox and the product owner only; a row or a footer shown where the flag is off would preview settings to members the product owner hasn't chosen, and QM30 promises production byte-for-byte unchanged until the flag turns on
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  kinds: output
  checklist: destination-confinement dismissed: the replies, DMs and App Home go to Slack's API at one configured base URL, to the member's own conversations, with no destination taken from input
  checklist: redaction dismissed: the rows and the footer are left out by the member's own flag decision, and nothing designated sensitive is scrubbed from what remains
  checklist: commit-ordered-effects dismissed: App Home reads the flag in the mutation that renders it, and each delivery query reads it before Slack is called, after the mutation that wrote the message committed
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack delivery
  checklist: declared-target-coverage dismissed: a reply, a DM and an App Home each have exactly one target, the member they are about
- turning message-settings off changes no setting: Turning `message-settings` off and on again rewrites no stored message setting, and each one stays honoured throughout; a setMessageSetting from a Settings tab published while the flag was on, clicked once it is off for the member, writes nothing, records no `message setting changed` and publishes no domain event, and the click shows today's tab; the flag's exposure goes once per member and value (QM15, QM22, QM28).
  over: a member who turned `level-ups`, `celebrations` and `kudos-reply` off with the flag on, through a level up and App Home with it off and App Home with it on again; a stale `Turn off` and a stale setMessageSetting clicked after the flag turned off, with and without App Home opened in between; and the exposures of a member with the flag on for their email and one without, through the flag turned off and on again
  via: QM22: the message-settings flag turned off and on, its stale clicks and its exposure
  refuted: isMessageSettingShownTo in convex/commands/commands.ts accepted setMessageSetting whatever the member's message-settings decision, asking only whether the kind applies -> 2 of 4 tests failed on their assertions: a stale `Turn off` clicked after the flag turned off stored a setting and recorded `message setting changed` (2026-10-15)
  because: QM22 promises that turning the flag off never re-sends what a member turned off and never shows them settings; Slack keeps a published view's buttons until the next publish, so a stale `Turn off` would otherwise store a setting the member can no longer see or change
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  kinds: state, output
  checklist: revalidated-permission dismissed: no permission is involved; the click's mutation rereads the member decision before it writes
  checklist: destination-confinement dismissed: the click changes only the clicking member's own settings, and App Home goes only to them
  checklist: redaction dismissed: a setting holds a kind and on or off, no member data
  checklist: separation-of-duties dismissed: a member sets only their own settings; no approval is involved
  checklist: legal-state-succession dismissed: a setting is a plain on or off value; every value can follow every other
  checklist: supersession-safety dismissed: setMessageSetting writes the value asked for, and every read takes the latest committed value
  checklist: worker-fencing dismissed: no worker owns a member's settings
  checklist: commit-ordered-effects dismissed: `message setting changed` is scheduled from the mutation that changed the setting and runs only after it commits
  checklist: resumption-coverage dismissed: one click is one write, not a batch
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: a click changes one member's settings; nothing fans out
- a Buy never answers in public: The answer to a `Buy` reaches only the member who clicked it: a `Buy` clicked in an ephemeral, such as a level up delivered in the channel, is answered as an ephemeral to the clicker in that conversation, in its thread when it has one, falling back to their DM when Slack refuses the ephemeral, and is never posted with `chat.postMessage` to the conversation; one clicked in a DM answers in the DM.
  over: a `Buy` clicked in a level up delivered in the channel inside a thread, the same click with Slack refusing the ephemeral with `channel_not_found`, and a `Buy` clicked in a level-up DM
  via: QM26: a Buy never answers in public
  because: an ephemeral's conversation is a channel others read; posting the purchase answer there would tell the channel what one member bought, from a message only they could see (QM26)
  crossing: slack-request -> domain
  entrances: route POST /slack/interactivity
  refuted: receiveHomeClick in convex/slack/receipts.ts dropped the ephemeral container, so deliverPurchaseReply posted the answer with chat.postMessage to the clicked ephemeral's channel -> 2 of 3 tests failed, the in-channel Buy and its refused-ephemeral fallback (2026-10-15)
  kinds: output
  checklist: revalidated-permission dismissed: no permission is involved; the purchase runs for the clicking member only, as before
  checklist: destination-confinement dismissed: the answer goes to the clicker's own DM or to an ephemeral addressed to the clicker in the conversation of the message they clicked, a conversation Slack named in the signed request
  checklist: redaction dismissed: the answer holds only what the clicker bought or why not, shown to them alone
  checklist: commit-ordered-effects dismissed: the answer is scheduled from the mutation that records the purchase and sent after it commits
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: one click has one answer to one member
