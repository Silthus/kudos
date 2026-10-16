# Workspace

Workspace: the settings with their defaults and the directory of the workspace's people, with the name each one goes by, whether each member is a workspace admin or owner and the email, real name, display name, title and picture Slack gives for a member, none of which a member who leaves keeps, and the workspace's user groups with their handle, name and the member count Slack gives, and the people in each, kept only for an enabled user group that isn't one of Slack's automatic admin and owner groups and only up to 5,000, so that dropping every one of them for others stays within one mutation's writes, each membership it drops and each change to whether a user group keeps members going into Groups' transition log with its instant, and the workspace's custom emoji with their image and, for an alias, the name of the emoji it aliases, each listing forgetting the custom emoji it no longer names and noting whether the app lacked the emoji:read scope, each answer from Slack changing nothing an answer asked for later already wrote, a member count included, whichever of the listing and the members list wrote it, which the engine reads directly, scheduling analytics to follow a member whose directory entry changes and the people a user group's members change touches, having Groups reconcile a person's primary group when the directory first records them or they stop or start being a member, and the people a user group's members change or a disabled user group touches in Groups' pages, publishing memberLeft when a later directory record says a member no longer is one, and memberRejoined when one says they are one again; setting or clearing the announcement channel, which the setAnnouncementChannel command does for admins only and pickAnnouncementChannel does for a maintainer, both only where XP and levels are shown, and both republishing the admins' App Home; and the workspace's URL, an https origin Slack answers, which the website's permalinks read, with the time a request for it was claimed, so only one is pending, released when it fails and lapsing after 10 minutes.

## entrances
- forget a member's words: a maintainer runs forgetWordsOfMember with a workspace and a Slack user ID when that member asks for their data to be deleted, so every kudos message they wrote loses its stored words and keeps a removed tombstone, and the backfill never fills the words of a kudos message they wrote, while their later kudos are stored live (AT8)
  handler: forgetWordsOfMember in convex/workspace/wordDeletion.ts
  trust: operator
  control: none — it takes only IDs, deletes only stored words, records a word-free deletion request for the member and leaves the kudos, the awards and every other row as they are; the member's later kudos are stored live as before
- forget a workspace's words: a maintainer runs forgetWordsOfWorkspace with a workspace ID when the workspace asks for its data to be deleted, so every kudos message of that workspace loses its stored words and keeps a removed tombstone, and the backfill never fills the words of a kudos message of it (AT8)
  handler: forgetWordsOfWorkspace in convex/workspace/wordDeletion.ts
  trust: operator
  control: none — it takes only an ID, deletes only that workspace's stored words, records a word-free deletion request for the workspace and leaves the kudos, the awards and every other row as they are
- pick a workspace's announcement channel: a maintainer runs pickAnnouncementChannel with a workspace ID and a channel ID, or none to clear it, when none of the workspace's admins can pick it in App Home, so the next level-up notice is posted there, or nowhere in public once cleared, and the admins' App Home is republished with it
  handler: pickAnnouncementChannel in convex/workspace/settings.ts
  trust: operator
  control: none — it takes only IDs, refuses a workspace Kudos doesn't know, saves the channel exactly as an admin's pick would, and only where XP and levels are shown in the workspace; it skips only the admin check, which a maintainer has no Slack member to pass
- set a workspace's star budget: a maintainer runs setStarBudget with a workspace ID and a whole number, so each member there gives at most that many stars on their day instead of 10 (SR6); there is no admin control for it yet
  handler: setStarBudget in convex/workspace/settings.ts
  trust: operator
  control: none — it takes only an ID and a whole number of 0 or more, refusing any other, and writes only the workspace row's starBudget

## invariants
- only admins set the announcement channel: Only a member the directory knows as a workspace admin or owner can set or clear the announcement channel from Slack; a command from anyone else, or from an admin Slack has since removed, changes nothing.
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
