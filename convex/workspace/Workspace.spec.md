# Workspace

Workspace: the settings with their defaults and the directory of the workspace's people, with the name each one goes by, whether each member is a workspace admin or owner and the email, real name, display name and title Slack gives for a member, none of which a member who leaves keeps, and the workspace's user groups with their handle and name and the people in each, kept only for an enabled user group that isn't one of Slack's automatic admin and owner groups, each answer from Slack changing nothing an answer asked for later already wrote, which the engine reads directly, scheduling analytics to follow a member whose directory entry changes and the people a user group's members change touches, publishing memberLeft when a later directory record says a member no longer is one, and memberRejoined when one says they are one again; setting or clearing the announcement channel, which the setAnnouncementChannel command does for admins only.

## entrances
- forget a member's words: a maintainer runs forgetWordsOfMember with a workspace and a Slack user ID when that member asks for their data to be deleted, so every kudos message they wrote loses its stored words and keeps a removed tombstone, and the backfill never fills the words of a kudos message they wrote before the request (AT8)
  handler: forgetWordsOfMember in convex/workspace/wordDeletion.ts
  trust: operator
  control: none — it takes only IDs, deletes only stored words, records a word-free deletion request for the member and leaves the kudos, the awards and every other row as they are; the member's later kudos are stored live as before
- forget a workspace's words: a maintainer runs forgetWordsOfWorkspace with a workspace ID when the workspace asks for its data to be deleted, so every kudos message of that workspace loses its stored words and keeps a removed tombstone, and the backfill never fills the words of a kudos message of it given before the request (AT8)
  handler: forgetWordsOfWorkspace in convex/workspace/wordDeletion.ts
  trust: operator
  control: none — it takes only an ID, deletes only that workspace's stored words, records a word-free deletion request for the workspace and leaves the kudos, the awards and every other row as they are

## invariants
- only admins set the announcement channel: Only a member the directory knows as a workspace admin or owner can set or clear the announcement channel; a command from anyone else, or from an admin Slack has since removed, changes nothing.
  over: setAnnouncementChannel commands from a member who isn't an admin, sent as a channel pick and as a button the member never saw, and from an admin removed by a later user_change
  via: P69: only workspace admins and owners set the announcement channel
  because: the announcement channel decides where every member's level-up notice is posted for the whole workspace (P64, P69, d-c98c9372); if any member could set it, one person could move everyone's celebrations into a channel of their choosing, and a removed admin must lose that power at once
  crossing: slack-request -> domain
  entrances: route POST /slack/interactivity
  refuted: setAnnouncementChannel no longer checked that the member is an admin -> both cases failed: the member who isn't an admin moved the next level-up notice to their channel, and so did the removed admin (2026-10-13)
  kinds: identity, state
  checklist: capability-authorization dismissed: no credential carrying bounded permission is accepted; the acting member is the one Slack names in the signed payload, and the role is read from the directory
  checklist: revalidated-permission declared as only admins set the announcement channel
  checklist: canonical-encoding dismissed: no key or digest is derived from the command
  checklist: identity-continuity dismissed: no identity succession is undertaken; a member is one Slack user in one workspace
  checklist: separation-of-duties dismissed: no approval policy applies; one admin's pick is the whole operation
  checklist: legal-state-succession dismissed: the channel is a single value that any admin may replace or clear from any prior value, with no forbidden transition
  checklist: supersession-safety dismissed: the command writes the channel in its own transaction; nothing late publishes it
  checklist: worker-fencing dismissed: no worker owns the setting
  checklist: commit-ordered-effects dismissed: the command issues no external effect; the notices that later go to the channel are posted after their own transactions commit
  checklist: resumption-coverage dismissed: no batch operation resumes
