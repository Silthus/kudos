# Groups

Groups: which of the workspace's user groups count as groups (an enabled user group that isn't one of Slack's automatic admin and owner groups and, in allowlist mode, is on the allowlist), read from the user group copy the directory keeps and never from Slack, and each member's primary group, kept with the groups they count in as one row per member: a member without one who joins groups gets the smallest of them (the member count Slack gives the copy, then name, then Slack ID; a group whose count the copy doesn't know yet comes last) and keeps it while it counts and they are in it, and losing it falls back to the smallest group left, or none, without a DM. Each members list the user group copy keeps reconciles everyone it lists and everyone it dropped, and a disabled group everyone it cleared, in scheduled pages of 100 people that share each group's row and hand the rest to a new page after 1,000 directory rows or 8,000 memberships; the directory reconciles a member inline when it first records them or they stop or start being a member; setGroupMode, for workspace admins and owners where the `groups` flag applies in their member decision and refused for anyone else, stores the group mode, every group or allowlist mode, with the allowlist (the groups picked, the stored allowlist, even an empty one, when the command names none, or every group that counts when none was ever stored), stamps each group that goes on or off the allowlist with that instant, kept apart from the copy's own change instant so a later members list can't move it, and, when any group starts or stops counting, reconciles every directory member in scheduled pages of 100 people that hand the rest on after 8,000 memberships, and groupModeShownTo gives the Admin tab the mode, the allowlist and every enabled custom group by name; so each change takes effect when it is recorded, the daily sync heals whatever a page missed, and all of it runs whatever the `groups` flag says. Every change of a primary group is inserted into the primary group history with its cause and its instant: for a fallback, when the member left their primary group (the instant it stopped counting, the earliest cause still in force of being disabled and leaving the allowlist, the instant of the copy write or directory record a page carries when that write touched it, or else the latest instant the copy recorded a change to it); for a default, the instant its page or the directory carries, or the latest change to the groups joined; the new primary group's own membership instant, or the latest instant the copy changed it or put it back on the allowlist, when later, a fallback whose new group comes later than the departure being recorded as none at the departure and the new group at that later instant; never after now and never before the member's latest entry; and publishes primaryGroupChanged; primaryGroupAt reads the entry in force at an instant, the latest one at or before it. availableIn, groupsShownTo (the `groups` flag, safe default off, in the member decision, and groups available; groupsShownAndExposedTo makes the same decision in the mutation that decides what a member sees and sends one exposure per member and value), primaryGroupOf, countingPrimaryGroupOf (the primary group only while it counts), countingGroupsOf and primaryMembersOf are direct reads for the boards, the pickers and the website, and reconcileMember is for the writes that depend on a member's primary group to call first. Every Given kudos message gets one attribution from the kudosGiven subscriber, whatever the `groups` flag says: it first reconciles the giver and everyone the message names, the giver first, in pages of 100 that hand the rest to a scheduled run of itself, then reads the giver's primary group at the spend instant from the history, or none, and each recipient's the same way, and inserts the attribution once per message with its kudos, allowance day, spend instant and each award's stored gate decision, and publishes awardsAttributed with the same facts; a redelivered kudosGiven finds the attribution and does nothing. pickPrimaryGroup reconciles the member and stores a pick of one of their counting groups from that instant with the cause `picked`; a pick of anything else, or of their current primary group, changes nothing; groupChoiceOf gives the pickers a member's counting groups and primary group, or nothing for a member in none.

## invariants
- the primary group history is insert-only: Once a change of a member's primary group is recorded in the history, nothing changes or deletes it; a later change is a new entry.
  over: every module under convex that isn't a test, read as source
  via: GB9: the primary group history is only ever inserted, never changed or deleted
  refuted: recordChange patched the member's latest history entry instead of inserting a new one -> the test failed on its assertion that the history module never patches, replaces or deletes a row (2026-10-14)
  because: attribution reads the history at each kudos message's spend instant (GB9, GB10), so a past entry that changed would move kudos already given to another group, which the spec rules out (user stories 13 and 25)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; only the internal reconciliation records a change
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an entry is only ever inserted; a member's current primary group lives on their row, and its change and the entry commit in one mutation
  checklist: supersession-safety dismissed: entries are never replaced; a later change is a later entry, and the read takes the latest at or before the instant
  checklist: worker-fencing dismissed: no worker owns a member's history; Convex serializes the mutations that touch one member's row
  checklist: commit-ordered-effects dismissed: recording a change has no external effect; primaryGroupChanged is scheduled in the same mutation
  checklist: resumption-coverage dismissed: each page reconciles its people from the recorded facts, so a page that runs again finds nothing left to change and records nothing
- a member's primary group is one of the groups they count in: A member's primary group is always one of the groups they are in that count, and a member in none, or no longer a member, has none.
  over: every directory member's primary group after each of a member leaving their primary group, a group being disabled, a member being deactivated, a disabled group coming back and the member returning, delivered as signed subteam and user_change events
  via: GB5: a member's primary group is always one of their counting groups, or none when they have none
  refuted: reconcile kept a member's primary group whether or not it was still one of the groups they count in -> the test failed listing 9 primary groups across the five steps that were a group the member had left, a disabled one, or kept after deactivation (2026-10-14)
  because: GB5 and GB8: the boards divide a group's kudos by its primary-group members and attribution counts a kudos for the giver's primary group, so a primary group the member left, or one that stopped counting, would credit a group with kudos and members it no longer has
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; reconciliation reads the copy and the directory itself
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a member's primary group is recomputed from the recorded facts on every reconciliation; any group they count in may follow any other, or none
  checklist: supersession-safety dismissed: reconciliation reads the facts as recorded when it runs, never a value carried from an earlier page, so a late page leaves what a later one wrote
  checklist: worker-fencing dismissed: no worker owns a member; Convex serializes the mutations that touch one member's row
  checklist: commit-ordered-effects dismissed: reconciliation has no external effect
  checklist: resumption-coverage dismissed: a page reconciles each of its people completely in one mutation, so a page that fails leaves them as they were, and the next change that touches them, or a write that depends on them, reconciles them from the recorded facts
- only an admin where groups applies changes the group mode: A setGroupMode from a member who isn't a workspace admin or owner, or from an admin to whom the `groups` flag doesn't apply, changes neither the group mode nor anyone's primary group, and neither sees the group mode in the Admin tab.
  over: setGroupMode as a forged button and as a forged group picker selection from a member who isn't an admin, and as a forged button from an admin with `groups` off, each delivered as a signed Slack interaction after the group mode was set once
  via: GB26: only admins where `groups` applies set the group mode
  refuted: setsGroupMode let a member through when they were an admin or the `groups` flag applied to them, instead of both -> 2 of 3 tests failed on their assertions: the forged setGroupMode from a member who isn't an admin set the group mode, and the admin with `groups` off saw it in the Admin tab (2026-10-14)
  because: GB26 and GB27: the group mode is shared by the whole workspace and decides which groups everyone's kudos count for, so a member who could forge it could archive every group, and the `groups` flag keeps the setting dark until it widens (GB29)
  kinds: identity, state
  checklist: capability-authorization dismissed: the command acts on the workspace the signed payload names, and setGroupMode reads the clicking member's admin role from the directory and the `groups` flag from their member decision in the same mutation
  checklist: revalidated-permission dismissed: the role and the flag are read in the mutation that writes the group mode, never carried from the click or from the published Admin tab
  checklist: separation-of-duties dismissed: no approval policy applies to an admin's group mode
  checklist: legal-state-succession dismissed: any group mode and allowlist may follow any other
  checklist: supersession-safety dismissed: each setGroupMode writes the whole mode and allowlist it computed from the stored ones in one mutation, and reconciliation reads the stored mode when it runs
  checklist: worker-fencing dismissed: no worker owns the group mode; Convex serializes the mutations that write its row
  checklist: commit-ordered-effects dismissed: the reconciliation pages and the Admin tab republish are scheduled in the mutation that writes the mode, so they run only if it commits
  checklist: resumption-coverage dismissed: a reconciliation page reconciles each of its people from the recorded facts, so a failed page leaves them for the next change or write that depends on them
  checklist: identity-continuity dismissed: the command names no member; it carries only the mode and the group IDs
  checklist: canonical-encoding dismissed: group IDs are compared as the strings the picker carries against the stored copy rows of the workspace; anything else is dropped
- in allowlist mode only the groups on the allowlist count: In allowlist mode a group that isn't on the allowlist is no member's counting group or primary group once its reconciliation ran, a member whose primary group left the allowlist falls back to the smallest allowed group they are in, and every group counts again when the mode goes back to every group, with the history kept.
  over: an admin switching to allowlist mode, picking two of three groups, picking none, switching back to every group and to allowlist mode again, delivered as signed Slack interactions, with each member's counting groups, primary group and history read after each step
  via: GB1, GB8: in allowlist mode only the groups an admin picks count
  refuted: countsAsGroup counted every enabled custom group in allowlist mode too -> 4 of 5 tests failed on their assertions: the groups left out still counted, so no member fell back and picking none left groups available (2026-10-14)
  because: GB1, GB3, GB5 and GB8: the allowlist keeps interest groups and on-call aliases off the boards (call 8), so a group outside it that still counted would get kudos attributed and a place on the Groups board
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; reconciliation reads the stored group mode itself
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: any group mode and allowlist may follow any other; a member's primary group follows from the recorded facts after each
  checklist: supersession-safety dismissed: reconciliation reads the group mode stored when it runs, never one carried in its arguments, so a page of an earlier switch applies the latest one
  checklist: worker-fencing dismissed: no worker owns a member; Convex serializes the mutations that touch one member's row
  checklist: commit-ordered-effects dismissed: setGroupMode has no external effect; its pages are scheduled in its own mutation
  checklist: resumption-coverage dismissed: each page hands the rest of the directory to the next page, and a write that depends on a member's primary group reconciles them first
- an attribution is insert-only: Once a kudos message's attribution is recorded, nothing changes or deletes it, and a redelivered kudosGiven records nothing more.
  over: every module under convex that isn't a test, read as source
  via: GB10: an attribution is only ever inserted, never changed or deleted
  refuted: a redelivered kudosGiven replaced the message's attribution instead of finding it and returning -> the test failed on its assertion that the attribution module never patches, replaces or deletes a row (2026-10-14)
  because: a kudos message counts for a group once, for good (GB10, GB30); an attribution that changed would move kudos already given to another group or count it twice, and the group totals and the group quest follow it
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; only the internal kudosGiven subscriber records an attribution
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an attribution has no later state; it is inserted whole in one mutation
  checklist: supersession-safety dismissed: nothing replaces an attribution; the subscriber looks it up by its message first and returns when it is there
  checklist: worker-fencing dismissed: no worker owns a message; Convex serializes the subscriber runs that read and insert one message's attribution
  checklist: commit-ordered-effects dismissed: recording an attribution has no external effect; awardsAttributed is scheduled in the same mutation
  checklist: resumption-coverage dismissed: a subscriber run that fails records nothing, and its retry or a redelivery records the attribution once
- an attribution follows the history at the spend instant: A kudos message counts for the giver's primary group in force at its spend instant after reconciling the giver, never for one picked or fallen back to later, so a subscriber that runs late or a replay gives the same group; a change recorded in the same millisecond as the spend applies to it.
  over: kudos messages whose subscriber runs after a later pick, after a pick in the same millisecond, and twice, read through awardsAttributed
  via: GB9, GB10: the history at the spend instant wins over a later change
  refuted: the attribution read each person's primary group in force when the subscriber ran instead of at the spend instant -> the test of a pick saved after the spend failed, the kudos counted for Gardeners instead of Zebras (2026-10-14)
  because: switching groups never moves past kudos (user stories 13 and 25); reading the primary group when the subscriber runs instead would move a kudos to whatever group the giver picked in between
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the subscriber reads the history itself
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: the history is insert-only, so the entry in force at an instant never changes once later entries exist
  checklist: supersession-safety dismissed: the attribution is keyed by its message and never replaced; a replay finds it
  checklist: worker-fencing dismissed: no worker owns a member; Convex serializes the mutations that touch one member's history
  checklist: commit-ordered-effects dismissed: the read and the attribution commit in one mutation with awardsAttributed scheduled in it
  checklist: resumption-coverage dismissed: reconciling the giver records the change at the instant its cause was recorded, so a page that hasn't reached them yet changes nothing the attribution reads
- a pick stores only one of the member's counting groups: A primary group pick is stored only when the picked group is one of the member's counting groups at the instant of the pick, after reconciling them against the recorded facts; a pick of a group they left stores nothing and records no picked entry.
  over: a Save in the welcome message for a group the member left in Slack, for one the copy dropped before any reconciliation page reached them, for the group already primary, and for one of their groups, delivered as signed interactivity payloads
  via: GB19: the welcome message's group block
  refuted: pickPrimaryGroup stored the pick without reconciling the member first -> the test failed on its assertion that the history holds no picked entry, finding default, picked and fallback (2026-10-14)
  because: GB2 and GB7: a pick applies to kudos from the instant it is saved, so a pick stored against a membership the copy had already dropped would attribute kudos to a group the member had left until a page reached them
  kinds: state
  checklist: revalidated-permission dismissed: the pick acts on the clicking member only, whom the adapter resolves from the signed payload
  checklist: separation-of-duties dismissed: no approval policy applies to a member's own pick
  checklist: legal-state-succession dismissed: any counting group may follow any other as primary group
  checklist: supersession-safety dismissed: the pick reads the member's row in its own mutation, which Convex serializes with every reconciliation of that member
  checklist: worker-fencing dismissed: no worker owns a member; Convex serializes the mutations that touch one member's row
  checklist: commit-ordered-effects dismissed: the history entry, primaryGroupChanged and the scheduled product event commit with the pick in one mutation
  checklist: resumption-coverage dismissed: a pick is one mutation over one member and resumes nothing
- slice 1 is invisible where groups doesn't apply: With the `groups` flag off, missing in PostHog, unread without the flags key, or on in the sandbox only while in production, the welcome messages, every App Home tab and the `/hedgehug leaderboard` replies for this week, this month and all time read exactly as in a workspace without groups, and a welcome Save, a Settings pick or a group mode click left from while it was on stores nothing, updates no message and republishes App Home unchanged.
  over: one story of kudos over two weeks by members in two groups, one of them in both and one of them an admin, with everyone-board and xp-levels on, read in each of the four off states beside the same story in a workspace without user groups, and a stale welcome Save, Settings pick, group mode button and allowlist pick in each
  via: GB29: slice 1 is invisible where groups doesn't apply
  refuted: groupsShownTo answered groups available without reading the groups flag -> 3 of 9 tests failed on their assertion that the story reads as in a workspace without groups, in the off, missing and production states, the boards and the peer line showing (2026-10-14)
  because: decision 18 ships slice 1 to production dark, sandbox and the owner's email only (GB29), so a member it doesn't apply to must meet main's welcome, App Home and replies and no group, while the facts keep recording (GB11)
  kinds: message, state
  checklist: revalidated-permission dismissed: the flag is read in the member decision on every publish, welcome, command and click, in the mutation that decides what the member sees
  checklist: separation-of-duties dismissed: the flag is switched in PostHog by the owner, outside this deployment
  checklist: legal-state-succession dismissed: while off, a click writes no primary group, history entry or group mode; the facts the subscribers record are written whatever the flag says
  checklist: supersession-safety dismissed: the flag value is read fresh on every request; nothing stored records it except the exposure, which is per value
  checklist: worker-fencing dismissed: one mutation reads the flag and decides; no lease or ownership applies
  checklist: commit-ordered-effects dismissed: App Home is published, the welcome posted and the command answered after the mutation that read the flag commits
  checklist: resumption-coverage dismissed: no batch resumes from a checkpoint; the welcome's request decides only the flag for each member of its page, and a delivery the flag applied to decides groups again, with its own exposure, before it posts
  checklist: destination-confinement dismissed: the gate adds no destination; the welcome goes to the member, App Home to its viewer and the reply to the command's own response
  checklist: message-authenticity dismissed: every command, event and click is verified by the Slack signature before the gate is reached
  checklist: input-validation dismissed: the gate reads only the workspace and user Slack sent; a click's group ID is normalized before any read
  checklist: retry-recognition dismissed: a redelivered event or click is recognized by its receipt before the gate runs, and the gate changes nothing a retry could repeat except the exposure, which is deduplicated
  checklist: duplicate-suppression dismissed: one exposure per member, flag and value, deduplicated in the mutation that sends it (O36)
  checklist: keyed-ordering dismissed: the flag is read fresh on every request, so the order of requests does not change what a later one sees
  checklist: acknowledgment-barrier dismissed: the command acknowledges with its reply, and events and clicks are acknowledged before the gate runs in their scheduled functions
  checklist: retry-classification dismissed: reading the flag never throws (O33); a failure to read answers the safe default, so the gate adds no failure to classify
- each groups decision sends one exposure per member and value: The mutation that decides what a member sees of groups, App Home's publish, the welcome's request and its delivery, a pick, the group mode or the `/hedgehug leaderboard` reply before it reads the group boards, sends one `groups` exposure per member and value, and the member decision turns groups on for the member whose email it names and for nobody else.
  over: a member meeting groups in the welcome, every App Home tab and the replies while on, again while on, then twice while off, and a flag on for one member's email beside a member it doesn't name
  via: O36: the groups exposure
  refuted: groupsApplyTo decided the groups flag without sending its exposure -> both tests failed on their assertion, finding no groups exposure for the member (2026-10-14)
  because: GB29 reads each flag in the mutation that decides what a member sees with one exposure per member and value (O35, O36), so PostHog can tell who met groups and with what value, the way it does for the Everyone board
  kinds: state
  checklist: revalidated-permission dismissed: the exposure names only the member the decision was made for
  checklist: separation-of-duties dismissed: no approval policy applies to an exposure
  checklist: legal-state-succession dismissed: an exposure row is inserted once per member, flag and value and never changed
  checklist: supersession-safety dismissed: a later value adds its own exposure and leaves the earlier one
  checklist: worker-fencing dismissed: each exposure is read and inserted in the deciding mutation, which Convex serializes with any other that reads the same member, flag and value
  checklist: commit-ordered-effects dismissed: the exposure and its outbox event commit with the decision in one mutation
  checklist: resumption-coverage dismissed: no batch resumes from a checkpoint; each decision sends its own exposure
