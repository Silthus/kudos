# Album

Album: the collection-first core loop of the album spec (AL1–AL73, `spec/album.md` on `docs/album`), whose first slice is thoughtful packs (AL1–AL6; AL7's crate key comes with the open), the emoji name registry (AL25) and the `album` flag (AL39). It owns the insert-only thoughtful packs `{ workspace, giver, recipient, week, message, holdsSticker, at }`, unique per giver, recipient and the giver's Monday-start week as `givingWeekOf` reckons it from the kudos day; the kudosGiven subscriber `grantThoughtfulPacks`, which the bus schedules only for a message whose gate decision says thoughtful and which grants at most 50 of the message's recipients per mutation, each mutation scheduling the next, never in the giving mutation; one insert-only grant record per message and recipient `{ giver, message, recipient, outcome }`, whose outcome is `new` when the pack holds the recipient's sticker, `held` when the giver's album already holds them, `waiting` when an earlier pack of the giver holds it and `nextWeek` when the giver already earned that recipient's pack this week, so no pack is made; the told marker, one per message, written by the first page that finds a grant record for every recipient, which publishes `thoughtfulPacksGranted` `{ giver, message, outcomes }` once, which Analytics projects as `packs earned` with `packs_earned`, the outcomes other than `nextWeek`, and `recipients`; the album stickers `{ member, person, from, pack?, at }`, unique per member and person, which this slice only reads to decide a pack's sticker; and the emoji name registry `{ workspace, emoji, person?, name }`, unique per workspace on the emoji and on the name and never rewritten, whose shared names, the level emojis 5, 10, 15, 20 and 25, the five milestones' gold names and every company team's name, are reserved the first time a workspace's registry is used and, for a company team the copy holds later, by `reserveTeamNamesAfterTheSync` after each company sync in every workspace whose registry is in use, and whose hype names are allocated at a person's first thoughtful pack from the slug of their full name as the directory holds it, else their display name, after reserving any company team whose name's slug ends in `-hype`, so a sync whose reservation hasn't run yet can't lose a team's name to a hype name; each name is the slug of its source with the first free number where it is taken or a standard emoji name, the numbering kept per stem so an allocation costs a few index ranges. Packs, grant records, the told marker and names are recorded whatever `album` says (AL3). The `album` flag is a member decision off by default, read without exposure by `albumShownTo`; the website's `getAlbum` answers `{ kind: "off" }` while it is off for the signed-in member and, while it is on, the member's name, face and person, their level and their waiting packs, oldest first, at most 50 with `morePacks`. Only this module writes packs, grant records, told markers, album stickers and emoji names.

## invariants
- a thoughtful pack is earned once per giver, person and week: A giver holds at most one thoughtful pack for each recipient in each of their weeks, earned only by a thoughtful kudos to someone else, however often and in whatever order the grant runs, and no later edit or deletion of the message takes one back.
  over: a thoughtful kudos to three people, a second thoughtful kudos to one of them the same week, a short kudos, a short kudos back, a hug, the next week's thoughtful kudos to the same person, two messages whose grants run in reverse order and each again as a redelivered kudosGiven, and a message edited to two words and then deleted, read through getAlbum's waiting packs
  via: a thoughtful pack is earned once per giver, person and week
  because: the thoughtful bar is one pack per giver, person and week (AL1, AL2, map Q12): a redelivered kudosGiven, a second message or two grants racing that made a second pack would let a member farm one teammate for packs, and a pack taken back by an edit would break awards are permanent (ADR-0001)
  refuted: packFor never found the week's earlier pack of the giver for that recipient -> 2 of 5 tests failed: a second thoughtful kudos the same week earned a fourth pack, and two messages' grants rerun in reverse order earned a second pack for the shared recipient (2026-10-18)
  kinds: storage, state
  checklist: scoped-reads dismissed: the invariant is about what is written, not which records a read returns; the album is private covers the read
  checklist: revalidated-permission dismissed: granting a pack needs no permission; the awards it follows were decided when they were given
  checklist: encrypted-storage dismissed: packs and grant records are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the grant takes only internal arguments, checked by the kudosGiven validator and the page's start
  checklist: revision-preservation dismissed: a pack is never revised; it is inserted once and never changed
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as a thoughtful pack is earned once per giver, person and week
  checklist: supersession-safety dismissed: no late write displaces a pack; a grant that finds the message's grant record or the week's pack writes no pack, and Convex retries a mutation whose read of either changed before it committed
  checklist: worker-fencing dismissed: no worker owns a pack; two grants of one giver conflict on the week's pack they both read, so one retries and finds the other's
  checklist: commit-ordered-effects dismissed: granting a pack issues no external effect
  checklist: durable-dispatch-intent dismissed: the grant is scheduled in the subscriber run the giving mutation schedules, and each page schedules the next in its own mutation, so the work commits with its cause or not at all
  checklist: resumption-coverage declared as a message's packs are told once
  checklist: declared-target-coverage dismissed: the only writer is grantThoughtfulPacks, reached by the oracle through kudos given at the Slack boundary and by rerunning its held runs
  checklist: completion-evidence dismissed: nothing waits on a pack; getAlbum reads the stored packs
- a message's packs are told once: `thoughtfulPacksGranted` is published once per thoughtful kudos message, by the page that finds a grant record for every recipient, with every recipient's outcome, however the message's pages run, retry or are redelivered, so `packs earned` is sent once per message whatever order Analytics runs in.
  over: a thoughtful kudos to three people and a second to one of them, read as the `packs earned` events PostHog receives; a message to 121 people over three pages with every page held, its last page run first, then the whole message, then its last page again; and the album's dark walk, where Analytics' subscriber runs beside the grant
  via: a message's packs are told once
  because: the bus schedules each subscriber independently (`convex/bus/publish.ts`), so a consumer reading the packs at its own time could count a message before its grant ran (AL6, review finding 1): telling the message's outcomes once, after its last grant record, keeps `packs earned` exact, and a second publish from a retried page would count one message's packs twice
  refuted: the grant published thoughtfulPacksGranted without reading the message's told marker -> 1 of 2 tests failed: the 121-person message's last page run again sent a second packs earned (2026-10-18)
  kinds: state, queue, message
  checklist: revalidated-permission dismissed: telling a message's packs needs no permission; the awards were decided when they were given
  checklist: destination-confinement dismissed: the fact goes only to the subscribers the bus registers; Analytics' outbox posts only to the configured POSTHOG_HOST
  checklist: message-authenticity dismissed: the fact's input is the kudosGiven event the engine publishes in its own transaction, never outside input
  checklist: input-validation dismissed: the grant's arguments are checked by the kudosGiven validator, and the fact by its own event validator
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession dismissed: the told marker is inserted once, by the page that finds every grant record and no marker, and never changed
  checklist: supersession-safety dismissed: a page that finds the marker publishes nothing, and Convex retries a mutation whose read of the marker or the grant records changed before it committed
  checklist: retry-recognition declared as a message's packs are told once
  checklist: duplicate-suppression declared as a message's packs are told once
  checklist: keyed-ordering dismissed: the fact carries the kudos instant, and PostHog orders events by it, not by delivery
  checklist: worker-fencing dismissed: no worker owns a message; two pages of one message conflict on the marker they both read
  checklist: acknowledgment-barrier dismissed: nothing acknowledges the fact to its source; the Slack event was acknowledged when the engine's transaction committed
  checklist: commit-ordered-effects dismissed: the fact is published in the mutation that writes the marker, and the bus schedules its subscribers only when that mutation commits
  checklist: durable-dispatch-intent dismissed: each page is scheduled by the one before it in its own mutation, so the work to tell the message commits with its cause or not at all
  checklist: resumption-coverage declared as a message's packs are told once
  checklist: retry-classification dismissed: nothing is sent here; the drain classifies PostHog's answers
  checklist: graceful-drain dismissed: no pool is drained; each page is one scheduled mutation
  checklist: cancellation-release dismissed: nothing holds a resource a cancelled page must release
  checklist: bounded-admission dismissed: each page grants at most 50 recipients and reads the message's grant records in one index range
  checklist: fair-admission dismissed: no queue is shared between members; each message's pages run on their own
  checklist: completion-evidence declared as a message's packs are told once
- the album is private: Every album read answers only the signed-in member's own album, taken from the website's guard, never from an argument.
  over: getAlbum signed in as each of four members who thanked one another, each answering their own name, person and the waiting packs they earned, and the same call given another member's ID
  via: the album is private
  because: the album shows whom a member has thanked and who is still left (AL40, user story 13): a read answering another member's packs would show that member's giving to anyone who asked
  crossing: browser -> domain
  entrances: query getAlbum
  refuted: getAlbum's waiting packs read every giver's packs from the signed-in member's ID on, a gte instead of eq -> 1 of 2 tests failed: a member's getAlbum answered packs other members earned (2026-10-18)
  kinds: read
  checklist: scoped-reads declared as the album is private
  checklist: redaction dismissed: the read answers the member's own album whole or not at all; nothing inside it is scrubbed
- the album is dark where album is off: With `album` off, missing in PostHog, unread without the flags key, or in production while it is on in the sandbox only, every Slack call, website answer, product event and table row a walk of kudos, App Home, a company sync and the website's reads leaves equals what the same walk leaves without the album, apart from the packs, grant records, told markers and emoji names it stores whatever the flag says (AL3, AL4, AL25) and the `packs earned` events Analytics sends for them (AL6), and getAlbum answers no album; with it on for one member's email only, only that member's getAlbum answers their album; turned on later, getAlbum shows the packs earned while it was off; and only queries decide `album`, so nothing exposes it.
  over: four members at level 5 with the Book, Leaderboard, Quests and skill tree open and every other flag on, each opening App Home before and after three kudos, two of which say why, then a company sync, then reading getCollection, getBook, getMyProfile, getProfileCard, getQuests, getSettings, getSkillTree, getActivity, getRecentKudos, getSpotlight, getLeaderboard, getGroupBoards and getAlbum, in each of the four off states beside the same walk with the album's subscribers removed and no album shown; `album` on for everyone as the positive control, beside the walk with it off, and for one member's email; off with the walk's packs stored and then on; every `album` decision, recorded with whether a query made it, and the decision itself without the flags key
  via: AL39: the album is dark where album is off, shows only to the members it is on for, and nothing exposes it
  because: production is live and the album ships dark behind `album` (AL39) until the conductor widens it one flag at a time (AL64–AL66): a changed answer, Slack call or event where it is off would show members a feature nobody turned on for them, and an exposure from a read would count members who never saw it; packs are recorded whatever the flag says (AL3), so turning it on needs no backfill
  refuted: albumShownTo answered true for every member whatever album decided -> 5 of 7 tests failed: in all four off states getAlbum answered an album with packs, and with it on for one email only every other member's getAlbum answered theirs (2026-10-18)
  kinds: state, output
  checklist: revalidated-permission dismissed: getAlbum decides `album` for the signed-in member on every read, never from a stored value
  checklist: legal-state-succession dismissed: the flag decides only what is shown; packs, grant records and names are written the same whatever it says (AL3), so turning it off and on again changes no record
  checklist: supersession-safety dismissed: the flag is read fresh in the query that shows the album; nothing about it is stored
  checklist: worker-fencing dismissed: no worker reads the flag; the grant and the name reservation run whatever it says
  checklist: commit-ordered-effects dismissed: reading the flag issues no effect and sends no exposure
  checklist: destination-confinement dismissed: the decision withholds one answer; where Slack calls and answers go is unchanged
  checklist: redaction dismissed: the decision answers `{ kind: "off" }` rather than scrubbing content inside an album
  checklist: circuit-breaker-policy dismissed: the flag is read from the PostHog component's cached definitions, never by calling PostHog per read
  checklist: declared-target-coverage dismissed: the only surface is getAlbum; the oracle's walk reads it beside every other member read of the website, App Home, the Slack calls and the product events
  checklist: separation-of-duties dismissed: the flag is switched in PostHog, outside this deployment
  checklist: resumption-coverage dismissed: the flag starts no batch; the grant runs whatever it says, and nothing is backfilled when it turns on
- an earned emoji's name never moves: Every earned emoji has at most one name in its workspace's registry and every name at most one emoji; a shared name is reserved before any hype name can take it, and no join, departure, rename or later sync changes or reassigns a name once given.
  over: the first thoughtful kudos reserving the level, milestone and company team names before the hype name of the person it thanked; no name before any thoughtful kudos and none from a short kudos; a person whose display name differs from their full name; a team named like a hype emoji, synced with its reservation job stopped, before that person's first pack; two namesakes, and a third who joins and leaves after both were named; a person renamed after their hype name was given, beside a namesake of the old name named later; a name with accents and two with no Latin letter; a team named like a milestone's gold, one named like a standard emoji, one with no Latin letter, a team the copy gains in a later sync and a team renamed in the sync after; and the slug's rules over spaces, symbols, accents and 80 characters, read as the names grants give
  via: an earned emoji's name never moves
  because: a member adds an earned emoji to Slack by hand under the name HedgeHug gives it (AL28, AL31), and a workspace admin adds the shared set once (AL32): a name recomputed from today's directory, or a shared name a hype emoji took first, would rename an emoji someone already uploaded and point it at another person or team (AL25, review finding 9)
  refuted: allocate named an emoji again whenever it was asked, without reading whether the registry already named it -> 1 of 7 tests failed: the sync after a team was reserved wrote a second name for it, which the registry's unique read refused (2026-10-18)
  kinds: storage, state
  checklist: scoped-reads dismissed: the invariant is about what is written; no read of the registry answers a member yet
  checklist: revalidated-permission dismissed: naming an emoji needs no permission; it follows a grant or a sync
  checklist: encrypted-storage dismissed: emoji names are public in the workspace, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: names are slugs built here from the directory's name or the company copy's team name, never taken from a request
  checklist: revision-preservation dismissed: a name is never revised; it is inserted once and never changed
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as an earned emoji's name never moves
  checklist: supersession-safety dismissed: an allocation that finds the emoji named writes nothing, and Convex retries a mutation whose read of the emoji, the name or its numbering changed before it committed
  checklist: worker-fencing dismissed: no worker owns a name; two allocations of one workspace conflict on the names and numbering they both read
  checklist: commit-ordered-effects dismissed: naming an emoji issues no external effect
  checklist: durable-dispatch-intent dismissed: the reservation after a sync is scheduled by the bus from the sync's own mutation, so it commits with its cause or not at all
  checklist: resumption-coverage dismissed: the reservation after a sync reads the whole company copy and names each team not yet named, so a later sync covers any it missed
  checklist: declared-target-coverage dismissed: the writers are the grant's hype allocation and the two reservations, all reached by the oracle through kudos at the Slack boundary and the posthog.com sync
  checklist: completion-evidence dismissed: nothing waits on a name
