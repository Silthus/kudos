# Message settings

A member's message settings, one value per kind of message HedgeHug sends them (QM12–QM16, QM22, QM27). The catalogue holds seven kinds, each with a stable ID, a label and a one-line description: `kudos-reply`, `tips`, `level-ups`, `new-features`, `quests`, `achievements` and `celebrations`. Every kind is on until the member changes it; a member whose stored progress settings turned DMs off has the four DM kinds off, and one who muted public notices has `celebrations` off, read as defaults with no migration (QM14). The `messageSettings` table keeps one row per member and kind, written only by setMessageSetting, which writes the value asked for and changes nothing when it is already the member's value, so a repeated request needs no request key and stores no outcome (QM15). wantsMessage answers whether a member wants a kind, whatever the `message-settings` flag says (QM22); `Feedback` asks it before a DM or a public section is written and again when Slack takes it (QM16). messageSettingsOf reads each kind with its label, description, whether it applies to the member and whether it is on (QM20, QM27). Today's two App Home switches show and set the effective values through the module: `Mute notices` sets `celebrations`, `Turn off DMs` sets the four DM kinds (QM14). The `message-settings` flag, safe default off, decides by the member decision, with its exposure in the mutations that render App Home, whether App Home's Settings tab lists the kinds and offers setMessageSetting (QM20, QM22).

## invariants
- a message a member turned off is never sent: A DM or public section of a kind the member turned off, or has off from their stored progress settings, is never sent: it is not written, and one already on its way is not sent when Slack takes it, whatever the `message-settings` flag says.
  over: the level-up DM and the public celebration of a level reached through a kudos message with `level-ups` or `celebrations` turned off from App Home; a level-up DM Slack held back while the member turned `level-ups` off; a DM of each of the six notification kinds already on its way, delivered while its kind is on and again once it is off
  via: QM16: a message a member turned off is never sent
  because: members asked for quieter messages (decision 22); a setting a member chose that HedgeHug ignored, or that a queued message slipped past, would break the promise the Settings tab makes the moment they click it (QM16)
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  refuted: wantsNotification in convex/feedback/notify.ts answered true without reading the member's message setting -> 8 of 9 tests failed, the turned-off DMs sent at write and when Slack took them (2026-10-14)
  kinds: output, state
  checklist: revalidated-permission dismissed: no permission is involved; each delivery attempt rereads the member's current setting before Slack is called
  checklist: destination-confinement dismissed: settings decide only whether a message is sent, never where; destinations are today's
  checklist: redaction dismissed: a setting adds nothing to a message; it only withholds one
  checklist: separation-of-duties dismissed: a member sets only their own settings; no approval is involved
  checklist: legal-state-succession dismissed: a setting is a plain on or off value; every value can follow every other
  checklist: supersession-safety dismissed: setMessageSetting writes the value asked for, and each delivery reads the latest committed value
  checklist: worker-fencing dismissed: no worker owns a member's settings
  checklist: commit-ordered-effects dismissed: a setting issues no external effect; the deliveries it gates are scheduled after their own mutations commit
  checklist: resumption-coverage dismissed: setting a kind is one write, not a batch
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: a setting gates one member's messages; nothing fans out
- errors that need action are never silenced: The Over allowance and Invalid replies reach the giver whatever their message settings say, every kind turned off included.
  over: a kudos over the giver's allowance and a kudos naming nobody who can receive kudos, given by a member who turned off every kind that applies to them
  via: QM13: errors that need action are never silenced
  because: a failed kudos the giver never hears about leaves them thinking a teammate was thanked (QM13, user story 30); only a message they can act on keeps the failure visible
  crossing: slack-request -> domain
  entrances: route POST /slack/events, route POST /slack/interactivity
  refuted: tellGiver in convex/engine/engine.ts sent no reply, error replies included, while the giver's kudos-reply setting was off -> the test failed, no Over allowance or Invalid reply sent (2026-10-14)
  kinds: output
  checklist: destination-confinement dismissed: the error replies go where they go today, beside the kudos message to its author
  checklist: redaction dismissed: settings add nothing to an error reply
  checklist: commit-ordered-effects dismissed: the reply is scheduled from the mutation that decided the outcome, as today
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: an error reply goes to one giver; nothing fans out
