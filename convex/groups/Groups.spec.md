# Groups

Groups: which of the workspace's user groups count as groups (an enabled user group that isn't one of Slack's automatic admin and owner groups), read from the user group copy the directory keeps and never from Slack, and each member's primary group, kept with the groups they count in as one row per member: a member without one who joins groups gets the smallest of them (the member count Slack gives the copy, then name, then Slack ID; a group whose count the copy doesn't know yet comes last) and keeps it while it counts and they are in it, and losing it falls back to the smallest group left, or none, without a DM. Each members list the user group copy keeps reconciles everyone it lists and everyone it dropped, and a disabled group everyone it cleared, in scheduled pages of 100 people that share each group's row and hand the rest to a new page after 1,000 directory rows or 8,000 memberships; the directory reconciles a member inline when it first records them or they stop or start being a member; so each change takes effect when it is recorded, the daily sync heals whatever a page missed, and all of it runs whatever the `groups` flag says. Every change of a primary group is inserted into the primary group history with its cause and its instant, the latest instant the copy recorded a change to one of the groups the member joined or left (the directory's own instant for a change it reconciles inline), never before the member's latest entry, and publishes primaryGroupChanged; primaryGroupAt reads the entry in force at an instant, the latest one at or before it. availableIn, groupsShownTo (the `groups` flag, safe default off, in the member decision, and groups available), primaryGroupOf, countingGroupsOf and primaryMembersOf are direct reads for the boards, the pickers and the website, and reconcileMember is for the writes that depend on a member's primary group to call first.

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
