# Website reads

The website's signed-in reads, the sign-in callback, and the website links Slack shows, each SITE_URL plus the album address its page lands on (AL67: the root `/` for the home, the Quests page, the skill tree and the Book, the Leaderboard `/leaderboard`, the Book's earned page `/book#milestones`, its Collection `/book#hoggies`, Settings `/settings` with its `?section=`, and no crate, quest, perk, panel or period) with no identity, built only in the website's link module, by websiteLinkOf for one page and by frontDoorLinksOf for App Home's front door (the root, then each feature open for the member on the same unlock path and leaderboard state getMyProfile reads that has a page on the route list, in schedule order, decided by the member's own decision of the website flag, and while the workspace decision is off built on the `/sign-in` entry in front of each address, which starts Sign in with Slack for that page, as does every crate's Open App Home builds on the same origin), and only while the website flag is on, SITE_URL is set and the workspace is the deployment's workspace: every website query is built on memberQuery, which answers signed-out without a live session of the deployment's workspace and verifying, unverified or not-a-member until the directory knows the person as a member, each closed instead while the website flag is off in the workspace decision, answers closed to a member whose own decision of the website flag is off, and calls its handler only with a verified member taken from the session, never from arguments; getMyProfile answers that member with their own homeFacts (kudos left, when they refill, given and received this week and in total) beside their sign-in name, their sign-in picture, else initials, as their face, while getMyFace answers their own face (their company profile cutout on its colour when exactly one company profile matches their Slack real name, else their sign-in picture, else initials) as a read of its own, which the website lays over getMyProfile's face and the viewer's own board rows, so getMyProfile and the boards never read the company profiles, and, only while the xp-levels flag is on for the member, their level and XP from progression's own read with the thresholds of their level and the next, and reads the website clock, a row a cron ticks every 15 minutes, so an open home turns to the new day and the new week without another kudos; getMyProfile also says whether the Everyone board is off, locked, ready or open, whether groupsShownTo answers true for the member, and, only while unlocks apply, lists each shipped feature in the schedule's order with its name, what it opens, its level, the member's state, when it became ready and when it was opened from unlocks' own read, and an opaque key per member and crate that carries no ID, the leaderboard's answer following its entry, and getLeaderboard answers one period's Everyone board as the leaderboard module's rankedBoardOf gives it to that member (every ranked row with its position, rank, tie, display name or "A teammate", face, kudos given and places climbed, the face being the viewer's own as getMyProfile gives it on their row and, on every other row, the directory's Slack picture for that member, else initials, the window's positions, their standing, their improvement line and their peer line), not-found while the everyone-board flag is off for the member, reading that flag without an exposure and following the same clock, and, while unlocks apply (xp-levels on for the member and unlocks' query-safe unlocksAppliedTo true), locked with the level or ready with no board facts until the member has opened the Leaderboard, never running unlocks' launch; getGroupBoards answers one period's Groups and My group boards from the leaderboard module's groupBoardsOf for that member, the My group rows shown as getLeaderboard shows its rows, the Groups board null while it lists no group, and both null while groups don't apply to the member or the Leaderboard isn't open for them; openFeature and openQuestCrate, the website's commands, pass the same guard as a mutation that writes nothing until the member is verified and the website flag is on for them, reading the website flag without making a workspace key, then send the member's website exposure and run their due preview moments, none while a workspace launch is due and never a workspace launch, refuses unless unlocks apply and while a workspace launch the flags made due (unlocks', the Journey's or the Book's) isn't recorded yet, so it never runs unlocks' launch, and, while the quests module's questsApplyTo holds, also unless the Journey has started for the member (its launch or their preview moment), so it never runs the Journey's launch or its join, and, while achievements apply, unless the Book's launch is recorded, then runs Commands' openUnlock for the signed-in member with the feature as its only argument and answers opened only when unlocks' own read finds the feature open afterwards, with the pack bonus its drop paid as the member sees it, or null where it paid none, while `packs` and `collection` are on for the member (CV6), scheduling App Home's republish as a Slack click does; openQuestCrate refuses unless the quests module's questsApplyTo holds and the Journey has started for the member and, while achievements apply, the Book's launch is recorded, so it never runs unlocks' launch, the Journey's launch, its join or the Book's launch, then runs Commands' openQuestCrate with the quest as its only argument and answers opened only when the quests module's crate opening for that quest exists afterwards, with what that crate opening applied as the member sees it, or null when it applied nothing, and, while `packs` and `collection` are on for the member, with the pack bonus its drop paid added to it, from the standing before the held reward to the standing after the bonus (CV6), scheduling App Home's republish; buyPerk, the website's purchase, takes the perk and a UUID the browser makes for the purchase, refuses with no reason kind unless the tree feature's entry on the member's unlock path is open, while a workspace launch the flags made due isn't recorded yet, and, while the quests module's questsApplyTo holds, unless the Journey has started for the member, so it never runs a launch, then runs Commands' buyPerk with the key website:{member}:{request} built from the verified member and that UUID, answers bought or refused with progression's reason kind (owned, level, requires, points, coins, coins-not-open or not-open) from the outcome Commands stores or replays under that key, and schedules App Home's republish after bought; buyItem, the website's item purchase, takes an item's ID and a UUID the browser makes for the purchase, refuses with no reason kind unless the store's inventoryOf would answer the member (the store shown, coins shown and Coins opened), while a workspace launch the flags made due isn't recorded yet, and, while the quests module's questsApplyTo holds, unless the Journey has started for the member, so it never runs a launch, then runs Commands' buyItem with the key website:{member}:{request} built from the verified member and that UUID, answers bought with the item or refused with the store's reason kind (coins-not-open, not-for-sale, owned or no-coins) from the outcome Commands stores or replays under that key, and schedules App Home's republish after bought; buyCrate, the website's crate purchase (CL27, CL30), takes the number of the crate the member is buying, answers null while a workspace launch the flags made due isn't recorded yet, and, while the quests module's questsApplyTo holds, unless the Journey has started for the member, then runs Commands' buyCrate, answers null where Commands answers none (collection or crate-store off), bought with the crate's key for a purchase or a repeat of a number already bought, or refused with its reason kind (stale, coins-not-open or no-coins), and schedules App Home's republish only when the purchase is new; openCrate, the website's open of a crate (CL28, CL30), takes the crate's key and refuses on the same recorded launches; while `packs` is off for the member or `collection` is, it runs Commands' openCrate and answers opened with the crate's stored drop when that crate is the member's bought crate, opened and shown while collection is on, or refused otherwise; while `packs` and `collection` are on for the member it opens any crate key waitingPacksOf can list as one command (CV8): a quest or Journey key, refused unless the quests module's questsApplyTo holds and the Journey has started for the member and the member has that quest's reward record, runs Commands' openQuestCrate and answers opened once its crate opening exists; an `unlock:` key, refused unless unlocks apply and the feature is ready or open for the member, runs Commands' openUnlock and answers opened once the feature is open; a `bought:` key runs Commands' openCrate and answers opened once the member's bought crate is opened; any other key refuses, and every refusal before the command writes nothing; an opened answer carries the whole open's `applied`, the held reward and the pack bonus added as openQuestCrate adds them, as the member sees it, or null where the open paid nothing, and the crate's stored drop, or null where it was opened while collection was off; App Home's republish is scheduled after opened; swapQuest, the website's swap, takes one weekly quest as the read gave it, refuses unless Quests reads open for the member and the same recorded launches openQuestCrate checks hold, so it never runs a launch, then runs Commands' rerollQuest with the quest as its only argument and answers swapped only when the quests module's swap of that week replaced exactly that slot afterwards, so a repeat for the same slot answers swapped again and any other slot refused, scheduling App Home's republish after swapped; setBoardVisibility, the website's leaderboard switch, takes only the setting, refuses unless the Leaderboard is open for the member by the same leaderboard state getMyProfile reads, which also holds while unlocks don't apply, while a workspace launch the flags made due isn't recorded yet, and, while the quests module's questsApplyTo holds, unless the Journey has started for the member, so it never runs a launch, then runs Commands' setLeaderboardVisibility, answers set with the setting the leaderboard module stores afterwards, and schedules App Home's republish only after a change; getSettings answers not-found unless the member has something to set, and otherwise whether they're on the boards while the Leaderboard is open for them by the same leaderboard state, each message kind that applies to them with its place and the places it offers from the message settings module's own read while their own decision of the message-settings flag is on, read without an exposure, and their primary group among their counting groups while groups show to them and they count in more than one, and getMyProfile's settings says whether getSettings would answer them; setMessageSetting, the website's message setting, takes only a kind and a place, refuses unless the member's own decision of the message-settings flag is on, the kind applies to them and offers the place, and the same recorded launches setBoardVisibility checks hold, so it never runs a launch, then runs Commands' setMessageSetting, answers set with the place only when the module's own read finds it afterwards, and schedules App Home's republish only after a change; pickPrimaryGroup, the website's group pick, takes only a group ID, refuses unless groups show to the member, the group is one of their counting groups that Slack still lists them in and the same recorded launches hold, then runs Commands' pickPrimaryGroup with the website as its surface, answers picked only when that group is their primary group afterwards, and schedules App Home's republish only after a change; getQuests answers not-found unless the quests module's questsApplyTo holds, which never runs a launch, locked with Quests' level or ready while the member hasn't opened Quests, and otherwise this week's drawn quests from the quests module's own read, each with its kind, goal, progress, reward (its XP, and its coins only while walletOf answers for the member and the reward pays any, as every quest and Journey reward the website reads), state, whether its reward still waits in its crate, whether it was swapped, its whole weekly quest, the quest that opens its crate while finished and an opaque key per member and crate once finished, with whether this week's swap is used and whether one is available exactly as the quests module's weeklyQuestsOf offers it, beside every earlier week's finished, unopened crate with its week and whether its reward still waits in it, oldest first, from the quests module's read of them, and, only while the quests module's groupQuestAppliesTo holds, the member's group quest from its groupQuestFor read as counts that never name a member: the group's name, the goal, how many took part of the target, whether the member did, the reward, its state, whether its reward still waits in its crate, the quest that opens the member's own crate while it waits and an opaque key per member and crate once they have one, with each earlier week's unopened group crate among those crates under its group's name, and otherwise no group quest and no group crate; getSkillTree answers not-found while the tree feature has no entry on the member's unlock path (unlocks not applying, or its ship flag off), locked with its level or ready while the member hasn't opened it, and otherwise the member's unspent skill points and the tree's rows in level order from progression's own perksOf read, each perk with its ID, name, P94 copy, cost in skill points and coins, the name of the perk it requires, the ID of the perk it upgrades, its state (owned, available, or unavailable with the reason: level, requires, points or coins) and when it was bought, leaving out a retired perk the member doesn't own, beside the wallet's balance while the wallet's walletOf answers one and null otherwise; getMyProfile's skillPoints is that read's unspent skill points while the member has opened the tree, and null otherwise; getMyProfile's coins is the wallet's balance while the wallet's walletOf answers one and null otherwise, and its inventory is the store's inventoryOf answer, each tier item's source with its ladder's name, with an empty `slots` list that a website bundle loaded before #579's deploy reads as no slots, while inventoryOf answers one and null otherwise; getMyProfile's journey is null unless quests apply, and otherwise lists the member's active Journey steps from the quests module's projection, which shows first-thanks active before any activation is stored, each with the module's goal and hint copy, its reward, its state, whether its reward still waits in its crate, the quest that opens its crate while finished and an opaque key per member and crate once finished; getActivity and getRecentKudos answer not-found while the activity flag is off for the signed-in member, read by the member decision without an exposure, and otherwise the activity module's read of that member's own kudos: one entry per kudos they received and one per message they gave with every recipient, newest decided first, in pages behind an opaque cursor, each naming other members by their display name or "A teammate", with the channel's visibility, whether the kudos said why, its Slack permalink once the workspace's URL is known, and its words only while their author is a member, and getActivity's full view, while `hugs` is on for the member, read without an exposure, also answers one entry per hug they gave or received as the activity module reads it (SR11); getRecentKudos is the same read for one direction, at most 10 entries, and never a hug; getSpotlight answers not-found while the activity flag is off for the signed-in member, and otherwise the activity module's spotlight of that member's own workspace: one public kudos that said why, drawn from a seed in [0, 1) or the next one strictly after an opaque cursor, with its giver, its recipients, its Slack permalink and its words, skipped with a cursor after 25 kudos the guard turns away, or empty; getBook answers not-found while the Book's page state is off or Achievements' achievementsOf answers nothing, which never runs a launch, locked with the Book's level or ready while the member hasn't opened the Book, and otherwise the member's own ladders from achievementsOf, each with its name, what it counts, its count, its four tiers with their names, thresholds and earned times, each earned tier with an opaque key per member and tier that carries no ID, each tier's coin reward only while the wallet's walletOf answers for the member and its kudos emoji, by name and art, only while the store's inventoryOf answers, and the next tier with its threshold, beside the member's time zone, with no reward of another kind; getCollection answers not-found while `collection` is off for the member, read without an exposure, and wherever getBook answers not-found, getBook's locked or ready while the member hasn't opened the Book, so a hoggie found before it opens waits there, and otherwise collectionOf for that member: each rarity from common to legendary with its chance, how many catalogue entries of that rarity the member holds and how many the catalogue has, every catalogue hoggie in catalogue order with its name, rarity, art slug, how many the member holds and when they first found it, null for one not held, and for a held one an opaque key per member and first find that carries no ID, beside how many distinct catalogue entries they hold and the catalogue's size, all read from the member's tallies, never their drops, and, while `packs` is on for the member too, read without an exposure, waitingPacksOf as `packs` and `morePacks`, each pack its crate key, kind and place `n` and never what it pays, or no pack and `morePacks` false while a workspace launch the flags made due isn't recorded or the Journey hasn't started for the member while questsApplyTo holds, when openCrate refuses every key (CV7); getProfileCard answers not-found while the member's own decision of the profile-card flag is off, read without an exposure, and otherwise the signed-in member's own profile card from the profile card module's profileCardOf with own set: their display name or "A teammate", their level or null, and their best four medals, none until they have opened the Book, beside the name of their primary group from the groups module's primaryGroupOf while groupsShownTo answers true for them, and null otherwise; getMyProfile's avatar and getProfileCard's avatar are avatarShownOn for the signed-in member, the hoggie with its name, rarity and art, or null, only while `hoggie-avatar` and `collection` are on for them, read without an exposure, and absent otherwise (#537); setAvatar, the website's avatar pick, takes only a hoggie's name or null, refuses on the same recorded launches buyCrate checks, then runs Commands' setAvatar, answers set with the avatar only while it shows to the member and is the one asked for afterwards, and refused otherwise, and schedules App Home's republish only after a change; the sign-in callback admits a person only while the flag is on in the workspace decision or in a known member's own, sending that member's website exposure and running their due preview moments, and links an account only by the Slack pair, a member's first sign-in, one Convex Auth links to no account yet, earning them the welcome item through Items' `earnWelcomeItem` in the same mutation (LP44); a daily job deletes the verifier a sign-in that never came back from Slack left behind, once it is a day old. openThoughtfulPack, the open of a thoughtful pack (AL8), takes only a pack's ID, refuses while `album` is off for the member, read without an exposure, and on the same recorded launches openCrate checks, so it never runs a launch, and otherwise answers the open of that pack for the signed-in member, opened with the tray items the open stored and the pack bonus its drop paid as the member sees it, coins and skill points shown as openQuestCrate shows them, or refused where nothing opens; putIn, the put-in of one tray item (AL11), takes only a tray item's ID and putAllIn takes nothing; both refuse while `album` is off for the member, read without an exposure, and otherwise putIn answers the item placed, or refused where the item is not in the signed-in member's tray, and putAllIn answers the at most 25 items it placed in the put-in order and whether more wait, none at all once the tray is empty; getAlbum lists no waiting pack on those same recorded launches, and while `hidden-items` is on for the member, read without an exposure, it lists no pack and no tray but the item board, each item's thanked person named and faced as a waiting pack's is, and no item on those same launches; turnItem, the turn of one item (LP10), takes only an item's ID, refuses while `album`, `hidden-items` or `collection` is off for the member, each read without an exposure, or while a workspace launch is due, as openThoughtfulPack does, and otherwise answers the turn of that item for the signed-in member, its face, the page it lands on, `again` and the pack bonus its drop paid as the member sees it, and, for the first turn of the welcome item while `welcome-item` and `hidden-items` are on for the member, read without an exposure, `teaches` with the workspace's kudos emoji and its custom picture or null, for the one line that teaches the loop (LP49), or refused for another member's item or a missing one, writing nothing then. A sign-in, and every website command, also makes ready each of the member's features at level 1 that Unlocks makes ready from the start, once unlocks apply to them and no workspace launch the flags made due is unrecorded. arrive, the website's arrival (LP26), takes only the last visit the tab read, refuses while `album` or `hidden-items` is off for the member, each read without an exposure, writing nothing, and otherwise, only when that is the member's stored last visit, moves it forward to the newest instant among their turned items, album stickers, team stickers, first hoggie finds and kudos received, never to the clock, and answers the last visit it then holds; while `hidden-items` is on for the member, getAlbum answers their last visit, or null before their first arrival, and the instant each held person's sticker was put in, and `lastVisitOf` is the one read of the last visit for Slack-side callers.

## entrances
- query getMyProfile: a browser asks for the signed-in person's own website answer, with no arguments
  handler: getMyProfile in convex/website/profile.ts
  trust: browser

- query getMyFace: a browser asks for the signed-in member's own face, with no arguments
  handler: getMyFace in convex/website/face.ts
  trust: browser

- query getLeaderboard: a browser asks for one period's Everyone board as the signed-in member sees it, with the period as its only argument
  handler: getLeaderboard in convex/website/leaderboard.ts
  trust: browser

- query getGroupBoards: a browser asks for one period's Groups and My group boards as the signed-in member sees them, with the period as its only argument
  handler: getGroupBoards in convex/website/groupBoards.ts
  trust: browser

- query getQuests: a browser asks for the signed-in member's quests this week, with no arguments
  handler: getQuests in convex/website/quests.ts
  trust: browser

- query getActivity: a browser asks for one page of the signed-in member's own activity, with a filter, a cursor and a page size as its only arguments
  handler: getActivity in convex/website/activity.ts
  trust: browser

- query getRecentKudos: a browser asks for the signed-in member's last few kudos received or given, with the direction and a size as its only arguments
  handler: getRecentKudos in convex/website/activity.ts
  trust: browser

- query getSpotlight: a browser asks for one kudos for the leaderboard page's spotlight, with a seed or a cursor as its only argument
  handler: getSpotlight in convex/website/activity.ts
  trust: browser

- query getSkillTree: a browser asks for the signed-in member's skill tree, with no arguments
  handler: getSkillTree in convex/website/skillTree.ts
  trust: browser

- query getBook: a browser asks for the signed-in member's Book, with no arguments
  handler: getBook in convex/website/book.ts
  trust: browser

- query getCollection: a browser asks for the hoggies in the signed-in member's Book, with no arguments
  handler: getCollection in convex/website/collection.ts
  trust: browser

- query getAlbum: a browser asks for the signed-in member's own album, with no arguments
  handler: getAlbum in convex/website/album.ts
  trust: browser

- query getAlbumPerson: a browser asks for one person's page in the signed-in member's own album, with the person's member ID as its only argument
  handler: getAlbumPerson in convex/website/album.ts
  trust: browser

- query getAlbumWeek: a browser asks for one week's issue of the signed-in member's own album, optionally naming the Monday that starts the week
  handler: getAlbumWeek in convex/website/album.ts
  trust: browser

- query getAlbumProfile: a browser asks for the kind note and the newest people of the signed-in member's own profile page, with no arguments
  handler: getAlbumProfile in convex/website/album.ts
  trust: browser

- query getAlbumHoggies: a browser asks for the hoggies the signed-in member's own album has found and still hides, with no arguments
  handler: getAlbumHoggies in convex/website/album.ts
- query getLevelUp: a browser asks for one of the signed-in member's own level ups, with the level as its only argument
  handler: getLevelUp in convex/website/album.ts
  trust: browser

- query getThoughtfulBoards: a browser asks for the thoughtful boards of this week, last week, this month or all time with the signed-in member's own row and teams pinned, optionally narrowing the people board to one company team
  handler: getThoughtfulBoards in convex/website/album.ts
  trust: browser

- mutation openThoughtfulPack: a browser asks to open one of the signed-in member's own waiting thoughtful packs, with the pack's ID as its only argument
  handler: openThoughtfulPack in convex/website/album.ts
  trust: browser

- mutation turnItem: a browser asks to turn one of the signed-in member's own face-down items, with the item's ID as its only argument
  handler: turnItem in convex/website/album.ts
  trust: browser

- mutation putIn: a browser asks to put one item of the signed-in member's own tray in, with the tray item's ID as its only argument
  handler: putIn in convex/website/album.ts
  trust: browser

- mutation putAllIn: a browser asks to put the signed-in member's own tray in, at most 25 items a call, with no argument
  handler: putAllIn in convex/website/album.ts
  trust: browser

- mutation unlockTeamSticker: a browser asks to unlock the team sticker of one of the signed-in member's own complete team pages, with the team's slug as its only argument
  handler: unlockTeamSticker in convex/website/album.ts
  trust: browser

- mutation shareItem: a browser asks to share one of the signed-in member's own turned wins into the weekly-post channel, with the item's ID as its only argument
  handler: shareItem in convex/website/itemShare.ts
  trust: browser

- mutation makePet: a browser asks to make one hoggie the signed-in member holds their pet, with the hoggie's slug as its only argument
  handler: makePet in convex/website/album.ts
  trust: browser

- mutation markEmojisSeen: a browser says which of the signed-in member's own earned emojis they have seen, with the emoji IDs as its only argument, at most 500 a call
  handler: markEmojisSeen in convex/website/album.ts
  trust: browser

- query getEmojiMappings: a browser asks, for the maintainer, for the workspace's Slack custom emoji, and behind `standard-emoji` Slack's standard emoji, with the earned emoji each one is mapped to, and the teams, milestones, levels and people to map to, with no arguments
  handler: getEmojiMappings in convex/website/emojiMappings.ts
  trust: browser

- mutation mapSlackEmoji: a browser asks, for the maintainer, to map one Slack custom emoji, or behind `standard-emoji` a standard one, to a team, a person's hype, a milestone, a level or the random drops, or to leave it unmapped, with the emoji's name and its place as its arguments, a person named by the opaque key the read gave
  handler: mapSlackEmoji in convex/website/emojiMappings.ts
  trust: browser

- mutation mapMyEmoji: a browser asks to map one earned emoji to a Slack custom emoji, or behind `standard-emoji` a standard one, from the mini wizard, with the earned emoji's ID as getAlbum or getAlbumPerson gave it and the Slack emoji's name as its only arguments: a member's own held emoji, or, behind `emoji-mapping-in-place`, any app emoji for the maintainer
  handler: mapMyEmoji in convex/website/emojiWizard.ts
  trust: browser

- query getProfileCard: a browser asks for the signed-in member's own profile card, with no arguments
  handler: getProfileCard in convex/website/profileCard.ts
  trust: browser

- mutation openFeature: a browser asks to open one ready feature for the signed-in member, with the feature as its only argument
  handler: openFeature in convex/website/commands.ts
  trust: browser

- mutation openQuestCrate: a browser asks to open one finished quest's or Journey step's crate for the signed-in member, with the quest as its only argument
  handler: openQuestCrate in convex/website/commands.ts
  trust: browser

- mutation buyPerk: a browser asks to buy one perk for the signed-in member, with the perk and the purchase's UUID as its only arguments
  handler: buyPerk in convex/website/commands.ts
  trust: browser

- mutation buyItem: a browser asks to buy one store item for the signed-in member, with the item's ID and the purchase's UUID as its only arguments
  handler: buyItem in convex/website/commands.ts
  trust: browser

- mutation buyCrate: a browser asks to buy the signed-in member's next crate for coins, with the crate's number as its only argument
  handler: buyCrate in convex/website/commands.ts
  trust: browser

- mutation openCrate: a browser asks to open one crate the signed-in member bought, with the crate's key as its only argument
  handler: openCrate in convex/website/commands.ts
  trust: browser

- mutation setBoardVisibility: a browser asks to show or hide the signed-in member on the leaderboards, with the setting as its only argument
  handler: setBoardVisibility in convex/website/commands.ts
  trust: browser

- mutation swapQuest: a browser asks to swap one of this week's quests for the signed-in member, with the weekly quest as its only argument
  handler: swapQuest in convex/website/commands.ts
  trust: browser

- query getSettings: a browser asks for the signed-in member's own settings, with no arguments
  handler: getSettings in convex/website/settings.ts
  trust: browser

- mutation setMessageSetting: a browser asks to move one message kind to one place for the signed-in member, with the kind and the place as its only arguments
  handler: setMessageSetting in convex/website/commands.ts
  trust: browser

- mutation pickPrimaryGroup: a browser asks to make one of the signed-in member's groups their primary group, with the group ID as its only argument
  handler: pickPrimaryGroup in convex/website/commands.ts
  trust: browser



- mutation setAvatar: a browser asks to make a hoggie the signed-in member holds their avatar, or to go back to none, with the hoggie's name or null as its only argument
  handler: setAvatar in convex/website/commands.ts
  trust: browser

- mutation linkMyCompanyProfile: a browser asks to link the signed-in member to one posthog.com profile, or to clear their own link, with the profile's posthog.com ID or null as its only argument
  handler: linkMyCompanyProfile in convex/website/commands.ts
  trust: browser

- mutation linkCompanyProfile: a browser asks, for a workspace admin or owner, to link one teammate to a posthog.com profile or to none, or to clear their admin link, with the teammate's opaque key from the admin's Settings read and the profile's posthog.com ID, none or null as its arguments
  handler: linkCompanyProfile in convex/website/commands.ts
  trust: browser

- mutation setWorkspaceSettings: a browser asks, for the maintainer, to save the workspace's daily allowance, kudos emoji and hug budget, with the three typed values as its arguments
  handler: setWorkspaceSettings in convex/website/commands.ts
  trust: browser

- mutation setWeeklyPost: a browser asks, for the maintainer, to switch the workspace's weekly post on or off, with on as its only argument
  handler: setWeeklyPost in convex/website/commands.ts
  trust: browser

- mutation pickWeeklyPostChannel: a browser asks, for the maintainer, to pick the channel the workspace's weekly post goes to, with the pasted link or ID as its only argument
  handler: pickWeeklyPostChannel in convex/website/commands.ts
  trust: browser

- query getBrowserAnalytics: a browser asks whether, and as whom, the signed-in member's browser sends analytics, with no arguments
  handler: getBrowserAnalytics in convex/website/browserAnalytics.ts
  trust: browser

- mutation arrive: a browser says the signed-in member arrived on the website, with the last visit the tab read as its only argument
  handler: arrive in convex/website/lastVisit.ts
  trust: browser

- query getXpMoment: a browser asks for the signed-in member's XP moment, what was decided since their last visit, with no arguments
  handler: getXpMoment in convex/website/xpMoment.ts
  trust: browser

- mutation endXpMoment: a browser says the signed-in member's XP moment ended, with the last visit and the newest instant the moment read and whether the member skipped it as its arguments
  handler: endXpMoment in convex/website/xpMoment.ts
  trust: browser

## invariants
- the route list is the paths the router serves: The backend's route list holds exactly the paths the website's router serves, so a website link Slack shows never opens the not-found page, and a page that ships adds its path to both in one change.
  over: routeList in convex/website/routes.ts and servedPaths in website/src/route.ts, the list routeOf matches a path against
  via: SW10: the route list is the paths the router serves
  refuted: added /quests to the backend's routeList without adding it to the website router -> the contract test failed listing /quests (2026-10-14)
  because: a link to a path the router doesn't serve lands a member on the not-found page, and a path added to the router alone would leave its links on the root; the website map added /skills and /book to both lists when its router began serving them (SW9, SW10)
  kinds: output
  checklist: destination-confinement dismissed: the list names paths on the deployment's own SITE_URL; no destination comes from input
  checklist: redaction dismissed: a path carries no identity and nothing sensitive
  checklist: commit-ordered-effects dismissed: the lists are constants; comparing them issues no effect
  checklist: circuit-breaker-policy dismissed: no breaker is declared; nothing is sent
  checklist: declared-target-coverage declared as the route list is the paths the router serves
- the router reads every target a link carries: Every target the backend's link function writes into a link, a quest's slot, a perk, a crate, the home's panel and a settings section, is read back by the website's router as the same target, so a Slack link that names a perk, a ready crate, a crate the member bought, the inventory or a settings section lands on it.
  over: the links Slack sent before AL67, as urlOf in convex/website/routes.ts built them then, read through routeOf in website/src/route.ts, for `quest`, `perk` on `/skills`, `crate` on `/quests`, `/leaderboard`, `/book` and `/skills`, `crate=journey` on the root, an earlier week's `crate=weekly:{week}:{slot}` on `/quests`, which the router drops unless its week is a date and its slot a number, an earlier week's group crate `crate=group:{week}` on `/quests`, which the router drops unless its week is a date, a bought crate's `crate=bought:{n}` on `/book/collection`, which the router drops unless n is a safe positive whole number, the crate offer's `crate=store` on `/book/collection`, `panel=inventory` on the root and `section` with `visibility`, `messages`, `group`, `company-profile` or `admin` on `/settings`
  via: #435: the router reads every target a Slack link carries
  refuted: let perkIn in website/src/route.ts answer no perk -> the contract test failed reading /skills?perk=spark (2026-10-15)
  because: map #1 links the level-up DM's `Buy` to a perk and each crate's `Open` to its crate (#435), and a parameter the router dropped would land the member on the plain page with nothing to say why (SW10, SW11)
  kinds: output
  checklist: destination-confinement dismissed: the target is a perk ID, a crate name from a fixed list including the crate offer, a weekly crate of a date and a number, a group crate of a date, a bought crate's safe positive number, or a panel or section name from a fixed list; both sides drop any other value
  checklist: redaction dismissed: a target names a perk or a feature, never a member
  checklist: commit-ordered-effects dismissed: parsing a link issues no effect
  checklist: circuit-breaker-policy dismissed: nothing is sent
  checklist: declared-target-coverage dismissed: the link has one target, the website
- one function builds every website link: websiteLinkOf answers SITE_URL plus the album address the asked page lands on (AL67): the root for the home, the Quests page, the skill tree and the Book, `/leaderboard` for the Leaderboard whatever its period, `/book#milestones` for the Book's earned page, `/book#hoggies` for its Collection, `/settings` with its section, and `/book#level-up/{level}` for a level up's page, never a crate, quest, perk, panel or period, so a link never names a path the website doesn't serve and lands with no rewrite.
  over: websiteLinkOf while the website is open, for every page, the Leaderboard's three periods, and the targets a link drops: a perk, a quest, a feature's crate, the Journey's crate, an earlier week's weekly crate and group crate, a bought crate, the crate offer and the inventory panel; `/settings` with no section and with each of its three sections; a level up's page; and urlOf on the `/sign-in` entry
  via: SW11: one function builds every website link
  refuted: routeOf answered an unlisted page's own path instead of the root -> the three unlisted pages linked to /quests, /skills and /book (2026-10-14)
  because: a link to a page the website doesn't serve yet would land a member on the not-found page, so every message builds its link through one function, which names the album address each page lands on once the old shell is gone, so a link needs no rewrite and Slack's older links still land through the router's old-URL map (SW11, SW13, AL44, AL67)
  kinds: output
  checklist: destination-confinement dismissed: the origin is the deployment's own SITE_URL and the path is one of the fixed album addresses in convex/website/routes.ts; no part of the URL is taken from input
  checklist: redaction dismissed: a link carries no identity, only a path and a period
  checklist: commit-ordered-effects dismissed: the function is a query and issues no effect
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack replies
  checklist: declared-target-coverage dismissed: the link has one target, the website
- a deep link shows only while the website is open: The `/hedgehug leaderboard` board reply ends with a link to the same period's board while the website flag is on, SITE_URL is set and the workspace is the deployment's workspace, and is today's reply, with no link, otherwise; the usage reply never carries one.
  over: the `/hedgehug leaderboard` reply for the week, the month and all time, for a SITE_URL ending in a slash, for a period it doesn't know, and for the month with the website flag off, SITE_URL unset and another workspace
  via: SW13 SW14: the leaderboard reply links to the same board on the web
  refuted: websiteLinkOf answered SITE_URL plus the route without reading the website flag -> the flag-off reply ended with a link (2026-10-14)
  because: a link shown while the website is closed or unconfigured leads a member to a closed page, and with the website off every Slack reply must be byte-for-byte today's (SW11, SW13, SW17, SW25)
  crossing: slack-request -> domain
  entrances: route POST /slack/commands
  kinds: output
  checklist: destination-confinement dismissed: the reply answers the signed slash command's own HTTP request; the link's origin is the deployment's own SITE_URL
  checklist: redaction dismissed: the link carries no identity, only a path and a period
  checklist: commit-ordered-effects dismissed: the reply is the command's HTTP answer; deciding the link writes nothing
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack replies
  checklist: declared-target-coverage dismissed: the reply has one target, the member who asked
- the public surface is exact: Exactly the HTTP routes, Convex Auth's signIn, signOut and isAuthenticated, and the website's signed-in functions are public; every other Convex function is internal.
  over: every Convex function every module of the deployment exports, outside convex/_generated
  via: WS10: the public surface is exact
  because: a public function is an entrance anyone on the internet can call; a new one must fail until a reviewed change adds it, so no domain function is reachable without the session check (WS10, replacing R50)
  crossing: browser -> domain
  entrances: none
  refuted: made prepareWebsiteFlag a public mutation instead of an internal one -> the surface test failed listing it (2026-10-13)
  kinds: read, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: no public function accepts a credential carrying bounded permission; the session is checked by website reads pass one guard
  checklist: redaction dismissed: the test lists function names, nothing is exported or scrubbed
  checklist: canonical-encoding dismissed: function paths are compared as the module glob lists them, sorted; no identity is encoded
  checklist: identity-continuity dismissed: the surface carries no identity across a succession
- website reads pass one guard: A website read checks the live session of the deployment's current workspace, then the directory, then the website flag: it answers signed-out without such a session and verifying, unverified or not-a-member until the directory knows the person as a member, each of them closed instead while the website flag is off in the workspace decision, answers closed to a verified member whose own decision of the website flag is off, and reaches its handler only with a verified member the flag is on for, taken from the session.
  over: getMyProfile for no session, a signed-out and an expired session, a session left over after SLACK_WORKSPACE_ID changes, an unknown person being verified, a failed verification, a member user_change deactivates, the flag off, never created, without its workspace key, switched off under an open session, and SLACK_WORKSPACE_ID unset; getMyFace for no session, the flag off, a former member, and an argument that names another member; getLeaderboard for no session, the flag off, a former member, a member, and an argument beside the period; getGroupBoards for no session and the flag off; getQuests with the flag off, no session, a former member, and an argument that names another member; getBook with the website flag off, no session, a former member, and an argument that names another member; getCollection with the website flag off, no session, a former member, and an argument that names another member; getSkillTree with the flag off, no session, a former member, and an argument that names another member; getProfileCard with the website flag off, no session, a former member, and an argument that names another member; getActivity, getRecentKudos and getSpotlight with the website flag off and the activity flag on, no session, and a member user_change deactivates; getSettings with the website flag off and no session; getBrowserAnalytics with the website flag off, no session, an unknown person being verified and a former member; getAlbum, getAlbumHoggies, getThoughtfulBoards, getAlbumPerson, getAlbumWeek and getAlbumProfile with the website flag off, no session and a former member; getEmojiMappings with the website flag off, no session and a former member
  via: website reads pass one guard
  because: the shell is public and a JWT outlives sign-out and membership, so every read must recheck the live session, the workspace, the directory and the flag, or a closed site, a signed-out browser or a former member would read a member's kudos; the flag comes last because a member's own decision can open the site while the workspace decision keeps it closed, and anyone the directory doesn't know gets the workspace decision (WS3, WS9, WS11, WS14, F19, F27)
  crossing: browser -> domain
  entrances: query getMyProfile, query getMyFace, query getLeaderboard, query getGroupBoards, query getQuests, query getSkillTree, query getBook, query getCollection, query getAlbum, query getAlbumHoggies, query getAlbumPerson, query getAlbumWeek, query getAlbumProfile, query getThoughtfulBoards, query getProfileCard, query getActivity, query getRecentKudos, query getSpotlight, query getSettings, query getBrowserAnalytics, query getEmojiMappings, query getXpMoment
  refuted: memberQuery dropped the check that the session's workspace is the current SLACK_WORKSPACE_ID -> the leftover session after SLACK_WORKSPACE_ID changes read member instead of signed-out (2026-10-13)
  kinds: read, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the session token authorizes only reading the signed-in person's own answer, and the guard rechecks its live session row on every read rather than trusting the token
  checklist: redaction dismissed: a denial carries only its kind, never a profile of zeros or another member's facts
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: a session belongs to one Slack pair for its whole life; a changed workspace reads signed-out rather than carrying over
- website commands pass one guard: A website command answers closed while the website flag is off for the member, or, for a member without an analytics ID yet, while the workspace key doesn't exist yet, signed-out without a live session of the deployment's current workspace, verifying, unverified or not-a-member until the directory knows the person as a member, exactly as a read does, and writes nothing at all with any denial, deciding a member without an analytics ID by a new one it keeps only once the member is admitted, so until then each command decides afresh; it reaches its handler only with that verified member, taken from the session, and an argument never names a member.
  over: openFeature with the website flag off, the flag on with a flags key but no workspace key, no session, a signed-out session, an unknown person being verified, a failed verification, a member user_change deactivates, and a member named beside the feature, each read through every table and every scheduled function; openQuestCrate for a finished Journey step with the website flag off, the flag on with a flags key but no workspace key, no session, a signed-out session, a member user_change deactivates, and a member named beside the quest; buyPerk for an open tree with the website flag off, the flag on with a flags key but no workspace key, no session, a signed-out session, a member user_change deactivates, a member named beside the perk, and a request that isn't a UUID; buyItem for an open store with the website flag off, no session, a signed-out session, a member user_change deactivates, a member named beside the item, an item ID longer than any item's, and a request that isn't a UUID; setBoardVisibility for a board open while unlocks don't apply with the website flag off, no session, a member user_change deactivates, and a member named beside the setting; swapQuest for a swappable week with the website flag off, no session, and a member named beside the quest; setMessageSetting with the website flag off, no session, a member user_change deactivates, and a member named beside the kind; pickPrimaryGroup with no session and a member named beside the group; buyCrate and openCrate for a member with a bought crate with the website flag off, no session, a member user_change deactivates, and a member named beside the crate's number or key; setAvatar with the website flag off, without a session, for a member who left and with a member argument; openThoughtfulPack with the website flag off, without a session, for a member who left and with a member argument; putIn and putAllIn with the website flag off, without a session, for a member who left and with a member argument; unlockTeamSticker for a complete team page with the website flag off, without a session, for a member who left and with a member argument beside the team; markEmojisSeen for an earned emoji with the website flag off, without a session, for a member who left and with a member argument beside the IDs; mapSlackEmoji for the maintainer with the website flag off, without a session, for a member who left and with a member argument beside the emoji and its place; setWeeklyPost for the maintainer with the website flag off, without a session, for a member who left and with a member argument beside on; pickWeeklyPostChannel for the maintainer with the website flag off, without a session, for a member who left and with a member or a workspace argument beside the link; turnItem for a waiting item with the website flag off, without a session, for a member who left and with a member argument beside the item
  via: website commands pass one guard
  because: a mutation is the first public function that can write, so a denial that wrote a workspace key, an exposure or a scheduled job would let anyone on the internet change state through a closed or signed-out call; the guard is memberQuery's in the same order and reads the website flag through the seam's read-only path (WS61, WS11)
  crossing: browser -> domain
  entrances: mutation openFeature, mutation openQuestCrate, mutation buyPerk, mutation buyItem, mutation buyCrate, mutation openCrate, mutation setBoardVisibility, mutation swapQuest, mutation setMessageSetting, mutation pickPrimaryGroup, mutation setAvatar, mutation openThoughtfulPack, mutation putIn, mutation putAllIn, mutation unlockTeamSticker, mutation makePet, mutation markEmojisSeen, mutation mapSlackEmoji, mutation setWeeklyPost, mutation pickWeeklyPostChannel, mutation turnItem, mutation arrive, mutation endXpMoment
  refuted: memberQuery's guard read the website flag through the seam's writing path instead of its read-only one -> the call with a flags key but no workspace key made a key and answered refused instead of closed (2026-10-14)
  kinds: state, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the session token authorizes only acting as the signed-in member, and the guard rechecks its live session row and the directory on every call rather than trusting the token
  checklist: revalidated-permission dismissed: the flag, the session and the directory are read in the same mutation that runs the command, so no permission is carried from an earlier check
  checklist: redaction dismissed: a denial carries only its kind
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: a session belongs to one Slack pair for its whole life; a changed workspace answers signed-out
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: legal-state-succession dismissed: a denial moves no state; past the guard, the member's website exposure and preview moments are each written once and never moved
  checklist: supersession-safety dismissed: a denial writes nothing, and the exposure and preview moments past the guard are written once per member, so nothing late can publish a different value
  checklist: worker-fencing dismissed: no worker runs the guard; each call is one mutation
  checklist: commit-ordered-effects dismissed: a denial issues no effect and schedules nothing
  checklist: resumption-coverage dismissed: no batch operation resumes
- a website command never launches unlocks: While unlocks don't apply to the member (xp-levels off, the unlocks flag off, or neither the launch nor their preview moment recorded), openFeature answers refused without running a command, while the flags made unlocks' launch or the Journey's launch due for the workspace and it isn't recorded yet, both commands answer refused without running a command, even for a member whose preview moment is recorded, while quests apply and the Journey's launch isn't recorded, openFeature answers refused without running a command for any feature, since App Home's republish after any opened answer would record it, and so would the unlockOpened that opening Quests or the Leaderboard publishes, and while quests don't apply or the Journey's launch isn't recorded, openQuestCrate answers refused without running a command; while achievements apply and the Book's launch isn't recorded, every website command answers refused without running a command, since App Home's republish runs it; buyPerk also answers refused without running a command unless the tree is open on the member's own unlock path and, while quests apply to the member, the Journey has started for them, since Commands' buyPerk shows App Home's tree tab; buyItem also answers refused without running a command unless the store's inventoryOf would answer the member and, while quests apply to the member, the Journey has started for them, since Commands' buyItem shows App Home's Inventory tab; setBoardVisibility also answers refused without running a command unless the Leaderboard is open for the member, whether on the unlock path or, while unlocks don't apply, by the everyone-board flag, since App Home's republish after a change would record any launch that is due; swapQuest answers refused without running a command unless Quests reads open for the member, the Journey has started for them and no workspace launch is due, since App Home's republish after swapped would record it; setMessageSetting and pickPrimaryGroup answer refused without running a command while any workspace launch is due or, while quests apply, the Journey hasn't started for the member, since App Home's republish after a change would record it; so a website call never records unlocks', the Journey's or the Book's launch, never schedules the Journey's join, writes no unlocks row and publishes no event.
  over: openFeature with xp-levels and unlocks on and no launch recorded; openFeature for a ready Quests, a ready Leaderboard and an open Leaderboard with quests on, unlocks launched and no Journey launch; openQuestCrate with every flag on and no launch, and with unlocks launched and no Journey launch; openFeature for a ready Leaderboard and openQuestCrate for a finished Journey step with achievements on and no Book launch; buyPerk with xp-levels, unlocks and skill-tree on and no launch, and for an open tree with quests on and no Journey launch, and with achievements on and no Book launch; buyItem for an open store with no unlocks launch recorded, with quests on and no Journey launch, and with achievements on and no Book launch; setBoardVisibility with everyone-board, xp-levels and unlocks on and no launch, and for an open Leaderboard with quests on and no Journey launch, and with achievements on and no Book launch; swapQuest with Quests locked at level 1, ready and not yet opened, the quests flag off, and, for a member whose Quests is open with a drawn week, every flag on and no launch, unlocks launched and no Journey launch, and achievements on and no Book launch, each also through every call to Commands' runCommand; each read through every table, every scheduled function and every published event; buyCrate and openCrate for a member with a bought crate with no unlocks launch recorded, and with quests on and no Journey launch; setAvatar with no unlocks launch recorded and with quests on and no Journey launch; openThoughtfulPack and turnItem with xp-levels and unlocks on and no launch recorded, and with quests on and no Journey launch, each read through every table and every scheduled function
  via: a website command never launches unlocks
  because: unlocks' launch grandfathers every member at once and belongs to Slack until the product owner switches unlocks on (P77, WS62); a website call that reached openUnlock before the launch would run it through unlocksLiveIn
  crossing: browser -> domain
  refuted: setAvatar no longer waited for the recorded launches -> 2 of 32 tests failed: with no unlocks launch recorded, and with quests on and no Journey launch, setting an avatar wrote rows and scheduled jobs instead of answering refused (2026-10-16)
  entrances: mutation openFeature, mutation openQuestCrate, mutation buyPerk, mutation buyItem, mutation buyCrate, mutation openCrate, mutation setBoardVisibility, mutation swapQuest, mutation setMessageSetting, mutation pickPrimaryGroup, mutation setAvatar, mutation openThoughtfulPack, mutation turnItem
  refuted: turnItem did not wait for the recorded launches -> 2 of 17 tests failed: with xp-levels and unlocks on and no unlocks launch recorded, and with quests on and no Journey launch, turning an item answered turned instead of refused (2026-10-21)
  refuted: openThoughtfulPack no longer waited for the recorded launches -> 2 of 31 tests failed: with xp-levels and unlocks on and no unlocks launch recorded, and with quests on and no Journey launch, opening a pack answered opened instead of refused (2026-10-18)
  refuted: the website's buyCrate and openCrate no longer checked noLaunchWaitsFor before running the command -> with no unlocks launch recorded, and with quests on and no Journey launch, buying a crate answered bought instead of null and opening one answered opened instead of refused (2026-10-16)
  refuted: buyItem checked only the store's visibility, not the Journey's and the Book's recorded launches -> with quests on and no Journey launch, and with achievements on and no Book launch, the purchase answered bought (2026-10-15)
  refuted: buyPerk checked only the tree feature's entry on the unlock path, not the Journey's and the Book's recorded launches -> with quests on and no Journey launch the purchase answered bought, and with achievements on and no Book launch the purchase answered bought (2026-10-14)
  refuted: openFeature and openQuestCrate didn't check the Book's recorded launch -> with achievements on and no Book launch, opening a ready Leaderboard and a finished Journey step answered opened, and App Home's republish would record the Book's launch (2026-10-14)
  refuted: openFeature checked the Journey's recorded launch only for Quests -> with quests on, unlocks launched and no Journey launch, opening a ready or open Leaderboard answered opened, and activateJourney or App Home's republish would record the Journey's launch (2026-10-14)
  refuted: openFeature checked only unlocks' gate for Quests, not the Journey's recorded launch -> with unlocks launched and no Journey launch, opening a ready Quests answered opened, and its unlockOpened subscribers would record the Journey's launch and schedule its join (2026-10-14)
  refuted: openQuestCrate checked only questsApplyIn, not the Journey's recorded launch -> with unlocks launched and no Journey launch, the call recorded the Journey's launch and scheduled its join (2026-10-14)
  refuted: swapQuest checked only Quests' own entry, not the recorded launches -> with Quests open and a drawn week, a swap with no unlocks launch, with no Journey launch and with no Book launch reached Commands' rerollQuest (2026-10-14)
  refuted: swapQuest checked only the recorded launches, not Quests' own entry -> a swap with Quests locked at level 1 and one ready and not yet opened reached Commands' rerollQuest (2026-10-14)
  refuted: swapQuest ran Commands' rerollQuest with no gate -> Quests locked, ready, switched off, and each unrecorded launch reached the command (2026-10-14)
  refuted: setBoardVisibility ran Commands' setLeaderboardVisibility with no gate -> with xp-levels and unlocks on and no launch, with quests on and no Journey launch, with achievements on and no Book launch, and for a locked, a ready or a switched-off Leaderboard, the call answered set (2026-10-14)
  refuted: workspaceLaunchDueIn left out the Book's launch -> with achievements on and no Book launch, buyPerk, opening a ready Leaderboard and a finished Journey step's open ran past the guard (2026-10-14)
  refuted: openFeature no longer checked WS55's gate before running openUnlock -> the unlaunched workspace recorded unlocks' launch (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: the gate is read in the same mutation that would run the command
  checklist: commit-ordered-effects dismissed: a refusal issues no effect at all
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: legal-state-succession dismissed: a refusal moves no state
  checklist: supersession-safety dismissed: a refusal writes nothing
  checklist: worker-fencing dismissed: no worker runs the command; each call is one mutation
  checklist: resumption-coverage dismissed: no batch operation resumes
- a website command is a D17 command: openFeature changes domain tables only through Commands' runCommand: opening a ready feature leaves exactly the domain tables and events a Slack App Home Open of the same feature leaves, besides Slack's receipt, the analytics outbox and scheduled functions, with generated IDs normalised; a locked, unshipped or gated-off feature answers refused and an already open one answers opened, each changing no domain table besides the exposure Slack's click sends; a doubled open opens once and answers opened again; after opened, App Home's republish is scheduled. openQuestCrate likewise leaves exactly what Slack's Open of the same Journey step leaves; an active step, an unfinished or never-drawn weekly quest, or a finished step with quests, unlocks or xp-levels switched off answers refused and writes nothing; a doubled open opens once and answers opened again; after opened, App Home's republished view no longer offers the crate. buyPerk likewise leaves exactly what App Home's Buy of the same perk leaves, besides Slack's receipt, the analytics outbox and scheduled functions, with the key's value normalised; it answers bought for an available perk and schedules App Home's republish, whose tree tab no longer offers the perk; an owned perk or no skill points answers refused with owned or points, storing only that refusal, the home tab and the exposure Slack's click sends; a stored refusal replays with its reason after a level up; a ready, locked or gated-off tree answers refused with no reason, writes nothing and stores nothing, so the same request buys once the gate opens; a perk above the member's level, one whose prerequisite they don't own and a retired one answer level, requires and no reason kind; a coin perk the member can't pay for answers coins, and one before Coins opens answers coins-not-open. buyItem likewise leaves exactly what App Home's Buy of the same item leaves, besides Slack's receipt, the analytics outbox and scheduled functions, with the key's value normalised; it answers bought with the item for one on sale and schedules App Home's republish, whose Inventory tab no longer offers it; too few coins, an owned item, and the starter, a silver tier's emoji or an unknown ID answer refused with no-coins, owned and not-for-sale, storing only that refusal, the home tab and the exposure Slack's click sends; a stored refusal replays with its reason after more coins arrive; Coins not opened, or the store or coins flag switched off, answers refused with no reason, writes nothing and stores nothing, so the same request buys once the gate opens. setBoardVisibility likewise leaves exactly what App Home's Settings switch of the same setting leaves, besides Slack's receipt and the analytics outbox; it answers set with the stored setting both ways, also while unlocks don't apply and with the Journey and the Book launched; the same setting twice leaves one change and one republish, and a setting already stored schedules none; a locked or ready Leaderboard, or the everyone-board flag off while unlocks don't apply, answers refused and writes nothing. swapQuest likewise leaves exactly what App Home's Swap of the same quest leaves, besides Slack's receipt, the analytics outbox and scheduled functions; it answers swapped when the week's swap replaced that slot and schedules App Home's republish; a repeat for the same slot answers swapped again, keeping the one swap and the one questSwapped; another slot after the swap and a slot never drawn answer refused and write nothing. setMessageSetting likewise leaves exactly what App Home's Settings pick of the same place leaves, besides Slack's receipt, the analytics outbox and the website's own exposure; it answers set with the stored place, records the usage fact and schedules App Home's republish once, and a repeat changes nothing; message settings off for the member, a kind that doesn't apply and a place the kind doesn't offer answer refused and write nothing. pickPrimaryGroup picks one of the member's counting groups and records the pick once with the website as its surface; a repeat changes nothing, and a group they aren't in, one Slack removed them from before reconciling caught up, an ID that isn't one, or groups off for them answers refused and writes nothing.
  over: openFeature for a ready Leaderboard against receiveHomeClick's Open of the same feature, a Leaderboard locked at level 1, an unshipped Skill tree past level 5, a ready and an open Leaderboard with unlocks or xp-levels switched off after the launch, an already open Leaderboard, a doubled open, and App Home's republished view after it; openQuestCrate for a finished Journey step against receiveHomeClick's Open of the same step, a finished weekly quest, an active step, an unfinished and a never-drawn weekly quest, a finished step with each flag switched off, a doubled open, and App Home's republished view after it; buyPerk for an available perk against receiveHomeClick's Buy of the same perk, the stored key, App Home's republished tree tab, an owned perk, no skill points left, a ready, a locked and a gated-off tree, the same request after the gate opens, a stored refusal after a level up, and a perk above the level, one missing its prerequisite and a retired one; buyItem for an item on sale against receiveHomeClick's Buy of the same item, the stored key, App Home's republished Inventory tab, too few coins, an owned item, the starter, a silver tier's emoji and an unknown ID, Coins not opened, the store and the coins flag switched off, the same request after the gate opens and a stored refusal after more coins arrive; setBoardVisibility for an open Leaderboard against receiveHomeClick's setLeaderboardVisibility, off and on again on a board while unlocks don't apply, the same setting twice, a setting already stored, an open Leaderboard with the Journey and the Book launched, a Leaderboard locked at level 1, a ready one, and the everyone-board flag off; swapQuest for an unfinished weekly quest against receiveHomeClick's Swap of the same quest, the quests module's week after it, a repeat for the same slot, another slot after the swap and a slot never drawn; buyCrate and openCrate of a crate against receiveHomeClick's Buy and Open of the same crate, App Home's republish after each, and a repeated purchase
  via: a website command is a D17 command
  because: Unlocks alone decides what may open (D17, P73, WS62, WS64); a website path that wrote its own state could open what Slack still holds, and the reveal must follow only what Unlocks recorded
  crossing: browser -> domain
  entrances: mutation openFeature, mutation openQuestCrate, mutation buyPerk, mutation buyItem, mutation buyCrate, mutation openCrate, mutation setBoardVisibility, mutation swapQuest, mutation setMessageSetting, mutation pickPrimaryGroup
  refuted: the website's openCrate no longer scheduled App Home's republish after an open -> the crate bought and opened on the website left the rows Slack's leave but one republish fewer than the two the claim names (2026-10-16)
  refuted: buyItem ran Commands' buyItem with only the recorded launches as its gate -> a purchase before Coins opened answered refused with coins-not-open instead of no reason kind (2026-10-15)
  refuted: buyPerk answered progression's below-row refusal as points -> the perk above the member's level answered points instead of level (2026-10-14)
  refuted: openQuestCrate answered opened without reading the quests module's crate opening -> the active step, the unfinished and the never-drawn weekly quest answered opened (2026-10-14)
  refuted: openFeature answered opened without reading unlocks' state after the command -> the locked Leaderboard and the unshipped Skill tree answered opened (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: Unlocks reads readiness, the ship flag and its gate in the same mutation that opens
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: supersession-safety dismissed: opening writes openedAt once in its own transaction, and a second open keeps the first
  checklist: commit-ordered-effects dismissed: unlockOpened goes to the in-process bus after commit and App Home's republish is a scheduled function of the same mutation
  checklist: worker-fencing dismissed: no worker owns a member's unlocks; Convex serializes the mutations that touch one row
  checklist: resumption-coverage dismissed: no batch operation resumes
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
- a skill point bought on the website is spent once: buyPerk keys each purchase website:{member}:{request} on the server, so a repeated request returns the outcome Commands stored under that key and never spends a second skill point: the same request twice buys once and answers bought twice, two requests for two perks with one skill point buy one, and a website request never replays a Slack Buy whose event carries the same string.
  over: buyPerk for one request sent twice with two skill points, two requests for two perks with one skill point, and a request whose string a Slack Buy's event ID carries, each read through perksOwned, the member's skill points and every published perkBought
  via: a skill point bought on the website is spent once
  because: a spent skill point never comes back (P4, P5), and a browser retries after a dropped connection with the same request (WS87), so a retry that reached Commands must return the first outcome rather than buy again (P19, WS88)
  crossing: browser -> domain
  entrances: mutation buyPerk
  refuted: buyPerk built the purchase key with the call's time appended -> the same request sent twice answered refused instead of bought again (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: progression reads the tree, the level, the prerequisite and the points in the same mutation that spends
  checklist: legal-state-succession declared as a skill point bought on the website is spent once
  checklist: supersession-safety dismissed: the outcome is stored once per member and key in the purchase's own transaction, and a repeat returns it
  checklist: commit-ordered-effects dismissed: perkBought goes to the in-process bus after commit and App Home's republish is a scheduled function of the same mutation
  checklist: worker-fencing dismissed: no worker owns a member's purchases; Convex serializes the mutations that touch the member's progress
  checklist: resumption-coverage dismissed: no batch operation resumes
  checklist: separation-of-duties dismissed: no approval policy applies; a member buys their own perk with one action (WS87)
- a coin spent on the website for an item is spent once: buyItem keys each purchase website:{member}:{request} on the server, so a repeated request returns the outcome Commands stored under that key and never spends its coins a second time: the same request twice buys once, answers bought twice and spends the price once, two requests for two items with coins for one buy one, and a website request never replays a purchase from App Home whose event carries the same string.
  over: buyItem for one request sent twice with coins for two items, two requests for two items with coins for one, and a request whose string the event ID of App Home's Buy carries, each read through the collection, the member's balance and every published itemBought
  via: a coin spent on the website for an item is spent once
  because: a spent coin never comes back (ST13), and a browser retries after a dropped connection with the same request (WS87), so a retry that reached Commands must return the first outcome rather than buy again (ST14, WS335)
  crossing: browser -> domain
  entrances: mutation buyItem
  refuted: buyItem built the purchase key with the call's time appended -> the same request sent twice answered refused instead of bought again (2026-10-15)
  kinds: state
  checklist: revalidated-permission dismissed: the store reads Coins, the item's sale, ownership and the balance in the same mutation that spends
  checklist: legal-state-succession declared as a coin spent on the website for an item is spent once
  checklist: supersession-safety dismissed: the outcome is stored once per member and key in the purchase's own transaction, and a repeat returns it
  checklist: commit-ordered-effects dismissed: itemBought goes to the in-process bus after commit and App Home's republish is a scheduled function of the same mutation
  checklist: worker-fencing dismissed: no worker owns a member's purchases; Convex serializes the mutations that touch the member's wallet
  checklist: resumption-coverage dismissed: no batch operation resumes
  checklist: separation-of-duties dismissed: no approval policy applies; a member buys their own item with one action (WS341)
- opening on the website applies what Slack's open applies: openFeature opening a ready feature writes only that feature's openedAt and publishes only unlockOpened, besides the exposure Slack's click sends, so Unlocks' opening grants nothing holds through the website: XP, progress and every other record are as they were, while `packs` is off for the member (with it on, the open's drop also pays its pack bonus once, CV5); openQuestCrate opening a finished quest's crate whose reward counted at its finish writes only one crate opening and publishes only questOpened, and opening a held one leaves the same tables and events Slack's Open of it leaves, applying its reward once, so the quests module's opening a crate applies its held reward once holds through the website too, and a website open after a Slack open applies nothing. openQuestCrate answers opened with applied, `{ xp, coins, from: { xp, level, coins, skillPoints }, to: { xp, level, coins, skillPoints } }`, read from the crate opening the first open stored and never from a live read, so a repeated open, or one after Slack's Open, answers the numbers that open applied; its coins answer 0 while the wallet's coinsVisibleTo is false for the member, and its skill points 0 while getMyProfile's skillPoints is null for them, the tree's page not open or the skill tree not applying in the workspace; applied is null for a crate whose reward counted at its finish, and a refused open answers refused. While `packs` and `collection` are on for the member, each of these opens also pays its drop's pack bonus once, and the answer's applied adds the bonus stored on the drop to the crate opening's: the held reward's XP and coins plus the bonus, from the standing before the held reward to the standing after the bonus, or the bonus alone where nothing was held (CV5, CV6).
  over: every table of the schema and every published event, before and after openFeature opens a ready Leaderboard for a member with XP and a level, before and after openQuestCrate opens a finished Journey step's crate, a held one beside Slack's Open of the same crate on another backend, and a website open after Slack's Open; the answer of a held weekly crate's open crossing a level with Coins and the tree open, with both hidden, and with skill-tree on in the member's own decision but off in the workspace's, a held Journey step's open crossing none, a repeated open after the member's XP, balance and skill points moved on, a website open after Slack's Open, and an open of a crate whose reward counted at its finish
  via: opening on the website applies what Slack's open applies
  because: only a held reward's crate applies anything, and only once (CR3, CR4), beside the pack bonus a drop pays once while `packs` is on (CV5); if opening on the website did other than Slack's Open, a member could earn by clicking in a browser what Slack never pays, or be paid twice across the two
  refuted: openQuestCrate's answer showed applied coins while the wallet's coinsVisibleTo was false -> the hidden-coins case answered 10 coins (2026-10-15)
  refuted: openQuestCrate's answer showed skill points whenever the tree's page read open, without the workspace's skill-tree decision getMyProfile's skillPoints also needs -> with skill-tree on only in the member's own decision, the answer showed 2 and 3 skill points (2026-10-15)
  refuted: openQuestCrate's answer read its to standing from the member's live standing and balance instead of the crate opening's stored applied -> the repeated open answered other numbers than the first (2026-10-15)
  refuted: the website's openQuestCrate applied a held crate's reward again after the command had opened it -> the Slack-parity and the after-Slack case failed on memberProgress and the published events (2026-10-15)
  crossing: browser -> domain
  entrances: mutation openFeature, mutation openQuestCrate
  refuted: openQuestCrate also gave the member 10 XP when it opened a crate -> the every-table assertion failed on memberProgress (2026-10-14)
  refuted: openFeature also gave the member 10 XP when it opened a feature -> the every-table assertion failed on memberProgress (2026-10-14)
  kinds: state
  checklist: legal-state-succession declared as a ready or opened feature is kept for good
  checklist: commit-ordered-effects dismissed: opening issues no external effect besides the scheduled App Home republish
  checklist: revalidated-permission dismissed: Unlocks reads readiness, the ship flag and its gate in the same mutation that opens
  checklist: separation-of-duties dismissed: no approval policy applies; a member opens their own feature with one action (P73)
  checklist: supersession-safety dismissed: openedAt is written once in its own transaction, and a second open keeps the first
  checklist: worker-fencing dismissed: no worker owns a member's unlocks; Convex serializes the mutations that touch one row
  checklist: resumption-coverage dismissed: no batch operation resumes
- quests are invisible where they don't apply: While the quests module's questsApplyTo answers false for the member (quests, xp-levels or unlocks off, or neither the launch nor their preview moment recorded), getQuests answers not-found and getMyProfile's journey is null, whatever quests and Journey steps the member finished, and a website read never records unlocks' or the Journey's launch.
  over: getQuests and getMyProfile with quests, xp-levels or unlocks switched off after a member finished a quest and a Journey step, and with every flag on and nothing launched
  via: quests are invisible where they don't apply
  because: the website never shows more than Slack does and never computes a game rule (WS69, WS70, WS71, #57): a quest fact read while quests don't apply would reach a browser before the owner switches quests on, and a progress, finish or active step derived in the website could disagree with what Slack shows
  crossing: browser -> domain
  entrances: query getQuests, query getMyProfile
  refuted: journeyStepsOf no longer checked questsApplyIn before listing the Journey -> all 4 tests failed, the journey listed with quests, xp-levels or unlocks off and before any launch (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: not-found and null carry no quest fact, locked carries only Quests' level, and a crate key is a hash with no member, Slack or workspace ID
- the bonus quest is a joined member's next Journey step: getQuests' bonus is the first step of the quests module's projected Journey that isn't opened, with the feature Quests' featureOpening maps it to, only while the member's first-thanks activation is stored; a member who hasn't joined reads no bonus, and the read joins nobody; with every step opened it is null.
  over: getQuests for a joined member with first-thanks active, finished and opened, a website-first member with no stored activation, and every step opened; getMyProfile's journey for the step-to-feature mapping
  via: WS317: getQuests' bonus is the Journey's next step
  because: the bonus quest is the Journey's next step (WS317, map #1's progression call 2), and the browser can't tell a projected first-thanks from a stored one (P88), so the server decides whether there is one; showing a Journey step to a member the P91 join hasn't reached would invite them onto a chain no write has started for them, and a website read never joins (WS335)
  crossing: browser -> domain
  entrances: query getQuests, query getMyProfile
  refuted: getQuests' bonus no longer checked the stored first-thanks activation -> the website-first member read first-thanks as their bonus (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the bonus carries the same step facts getMyProfile's journey already answers, plus a feature name
- the Book names nothing unshipped: getBook answers the signed-in member's own ladders exactly as Achievements' achievementsOf gives them, only the catalogue's shipped ladders in its order, each tier with its name, the count it needs and its earned time, and carries no catalogue version, no item ID and no promised reward but a tier's coins while the wallet's walletOf answers for the member and its kudos emoji while the store's inventoryOf answers, earned or not.
  over: getBook with only the catalogue's first two ladders shipped, for a member who earned all four tiers on both; with Coins open, for a member who earned a bronze tier; with the store shown and Coins open; with Coins open and the store off; with the coins flag on and Coins not open
  via: the Book names nothing unshipped
  refuted: getBook passed each tier's promised rewards from achievementsOf through to the answer -> the answer named coins, kudos emoji and hedgehog rewards (2026-10-14)
  because: a tier's promised reward is coins, a kudos emoji or a hedgehog, none of which has shipped, and a ladder or a reward the website names before Slack shows it would tease an unshipped feature (WS90, WS91, P78)
  crossing: browser -> domain
  entrances: query getBook
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer carries only the member's own counts, tier names, thresholds and earned times and their time zone; no reward, catalogue version or other member's fact
- the website card is the member's own Slack card: getProfileCard answers the signed-in member's own profile card exactly as their own `/hedgehug @member` card shows it, the same name, level and best four medals, with no medals until they have opened the Book, no level while xp-levels is off in the workspace decision and "A teammate" without a display name, and carries nothing else beside the group the next bullet but one adds and the avatar avatarShownOn answers: no XP, coins, kudos counts or IDs.
  over: getProfileCard for a member with XP and tiers on five ladders who opened the Book, compared with their own Slack card; for one who earned tiers but hasn't opened the Book, compared the same way; with xp-levels off; and for a member without a display name
  via: PC15: the website reads the member's own profile card
  refuted: getProfileCard read the member's card with own false instead of true -> a member who hadn't opened the Book read medals their own Slack card doesn't show (2026-10-14)
  because: the website's "What teammates see" must show exactly what teammates see in Slack, so the two never disagree, and a card is public only for its name, level and medals (PC15, PC6, PC9, #284)
  crossing: browser -> domain
  entrances: query getProfileCard
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer is the profile card module's card, which holds only the member's name, level and medal names; no XP, coins, kudos counts or IDs
- the website card waits for profile-card: getProfileCard answers not-found while the signed-in member's own decision of the profile-card flag is off, read without an exposure, whatever the workspace decision or the member's progress, so with the flag off the website reads no card.
  over: getProfileCard with profile-card off for everyone, for a member with a tier who opened the Book; and with profile-card on for one email, read by that member and by another
  via: PC15 PC17: getProfileCard follows the member's own profile-card decision
  refuted: getProfileCard answered the card without reading the profile-card flag -> with the flag off for everyone and for a member outside its one email, the member read their card instead of not-found (2026-10-14)
  because: production is live (decision 18) and profile-card starts sandbox-only plus one email, so a member the flag is off for must get today's answer, and every website query reads flags without an exposure (PC12, PC15, PC17)
  crossing: browser -> domain
  entrances: query getProfileCard
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: not-found carries no card fact
- the website card names the primary group while groups show: getProfileCard's group is the name primaryGroupOf gives the signed-in member while groupsShownTo answers true for them, read without an exposure, and null otherwise, so a member without a primary group or whom groups don't show to reads no group.
  over: getProfileCard for a member whose primary group is Ants, for a member with no primary group, and with groups on for one email, read by that member and by another in the same group
  via: WS344 GB32: the card names the member's primary group while groups applies
  refuted: getProfileCard read primaryGroupOf without checking groupsShownTo -> a member groups are off for read Ants on their card instead of no group (2026-10-15)
  because: GB32 puts the member's primary group on their profile card where groups applies and groups are available, and variant E shows it under the name (#284, #294)
  crossing: browser -> domain
  entrances: query getProfileCard
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer adds only the name of the signed-in member's own primary group, gated by their own groups decision, as GB32 puts it on their card; no group ID or other member
- the website's peer line is the board's: getLeaderboard's peer is the peer line rankedBoardOf gives the signed-in member, the percent and their primary group, and null while groups don't show to them, so the website and Slack's board name the same peer line.
  over: getLeaderboard for a member ahead of most of their group this week with groups on, and the same member with groups off
  via: WS344 GB16: getLeaderboard carries the Everyone board's peer line
  refuted: getLeaderboard answered peer null instead of rankedBoardOf's peer -> a member ahead of most of their group read no peer line (2026-10-15)
  because: GB16 adds the peer line right after the Everyone board's improvement line, and the website shows that board (#285, #294)
  crossing: browser -> domain
  entrances: query getLeaderboard
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the peer line holds only a percent rounded down to a multiple of 10 and the name and ID of the member's own primary group; no other member's gain or name
- a member's home shows only their own facts: getMyProfile's member answer is the signed-in member's own homeFacts with their own sign-in name and picture, never another member's facts.
  over: getMyProfile for a member beside members who gave and received kudos, before and after a kudos lands, and across the member's midnight and the week's turn on a clock tick
  via: WS13 WS15 WS18: a member's home answer projects their own homeFacts
  because: the kudos a member receives stay private (WS18, P65), so the home must read the facts of the session's own Slack pair and nobody else's
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: getMyProfile read homeFacts for another member of the workspace -> the answer carried that member's counts (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer carries only the member's own counts, emoji, refill time, name and face, and a link to the workspace in Slack; it never names another member
- level and XP are invisible while xp-levels is off: getMyProfile's member answer carries no progression while the xp-levels flag is off for the member, and while it is on carries exactly the member's own level, XP, the XP their level starts at and the next level starts at, and the XP still to go, from progression's own read; the progression it carries never holds skill points, which reach the answer only as its own skillPoints while the member has opened the tree (WS84).
  over: getMyProfile for a member with XP while xp-levels is off, while it is on at level 1, exactly on a level's threshold and past level 5, beside another member with more XP, and switched off under an open session
  via: level and XP are invisible while xp-levels is off
  because: the website never shows more than Slack does and never derives a level or a threshold from XP, so level and XP reach the browser only through progression's own read and only while Slack shows them too (WS47, WS13, P79; WS84 replaces WS51's skill points)
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: progressionOf no longer returned null while xp-levels is off -> a member with XP read their progression while the flag was off (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the progression carries only the member's own level and XP figures, never skill points, coins or another member's progress
- groups are named only while groupsShownTo answers: getMyProfile's member answer says groups true exactly while groupsShownTo answers true for the signed-in member (the groups flag on in their own decision, read without an exposure, and a group counting in their workspace), and false otherwise, so the website names a group only where the member's boards could show one.
  over: getMyProfile while groups is off beside a counting group, while it is on with no counting group, while it is on with one, and switched off under an open session
  via: groups are named only while groupsShownTo answers
  because: the website never shows more than Slack does and never reads a flag, so a sentence that names the member's group waits for this fact (#417, map #1's #327)
  crossing: browser -> domain
  entrances: query getMyProfile
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the fact is one boolean about the member's own view and names no group or member
- getMyProfile says bookSpread only while book-spread is on: getMyProfile's member answer carries bookSpread true exactly while the book-spread flag is on in the signed-in member's own decision, read without an exposure, and carries no bookSpread key otherwise, so with the flag off, unset, or the flags key missing every answer equals the one before the flag existed and the website keeps today's Book pages.
  over: getMyProfile while book-spread is off, while PostHog has no such flag, in production under the ship's condition for another member's email, without the flags key, and while it is on for everyone, in the sandbox under the ship's condition and for the product owner's email in production
  via: getMyProfile says bookSpread only while book-spread is on
  because: the Book redesign ships dark behind a member decision and widens only once its proofs pass (#584, #587), and the website never reads a flag, so it switches /book on this one field; an additive optional key keeps every flag-off answer byte-equal to main's
  crossing: browser -> domain
  entrances: query getMyProfile
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the fact is one boolean about the member's own view and names no member
- only the allowed workspace signs in, and only while open: A sign-in creates or updates an account only for a profile of the deployment's SLACK_WORKSPACE_ID with a non-empty Slack user, and only while the website flag is on in the workspace decision or in the member's own.
  over: the sign-in callback for a profile from another workspace, an empty Slack user, an unset SLACK_WORKSPACE_ID, and the flag off
  via: WS3 WS6: only the allowed workspace signs in, and only while open
  because: anyone on the internet can start a Slack sign-in, so a person from another workspace, or anybody while the site is dark, must get no account (WS3, WS6)
  crossing: browser -> session
  entrances: route GET /api/auth/callback/slack, route POST /api/auth/callback/slack, action signIn
  refuted: rememberSignedInMember no longer refused while the website flag is off -> the flag-off sign-in created an account (2026-10-13)
  kinds: identity, credential
  checklist: capability-authorization dismissed: the Slack ID token's audience, nonce and state are checked by Auth.js before the callback runs, proven by the handshake test against the mock issuer
  checklist: revalidated-permission declared as website reads pass one guard
  checklist: message-authenticity dismissed: Auth.js verifies the ID token's signature against Slack's published keys before the callback sees a claim
  checklist: encrypted-storage dismissed: no credential is stored by the callback; Convex Auth keeps only hashed verifiers and refresh tokens
  checklist: key-rotation-compatibility dismissed: Slack's signing keys are read from its JWKS on each handshake; JWT_PRIVATE_KEY and JWKS rotate as a pair per deployment
  checklist: canonical-encoding dismissed: the workspace is compared exactly as Slack's team_id claim carries it
  checklist: identity-continuity declared as accounts link only by the Slack pair
  checklist: separation-of-duties dismissed: no approval policy applies to signing in
- a member previews the website by their own decision: While the website flag is off in the workspace decision, a member it names in their own decision signs in, sends their website exposure once with that decision's value, runs their due preview moments of unlocks and the Journey, none while a workspace launch the flags made due (unlocks', the Journey's or the Book's) isn't recorded yet, and reads and acts on the website by their own decisions of every flag, while every other member and every person the directory doesn't know is refused or reads closed and writes nothing; a session from before the preview sends the exposure and runs the preview moments at its first command; App Home's front door links the previewer to their pages through Sign in with Slack and shows another member no link; a website call never records the unlocks launch or the Journey launch.
  over: the sign-in callback, getMyProfile, getLeaderboard, getQuests, openFeature and App Home's front door links for a member an email condition names and a member it doesn't, a person the directory doesn't know, a session from before the preview, the website on for everyone with the other flags on for one email, the website on for the workspace but off in one member's own decision, and unlocks or quests switched on for the workspace after a preview, before its launch is recorded; getSkillTree and buyPerk for a member whose own unlocks decision is off while the workspace's is on; a previewer's sign-in while the Book's launch is due; openQuestCrate on a finished group quest's crate after groups turned off, which groupQuestAppliesTo in convex/quests/groupQuest.ts refuses
  via: F26 F27 F28 F29: a member previews the website by their own decision
  because: Michael opens unfinished work to single members by email in PostHog, so the website must follow the member decision, and a preview must never open the site, move a launch or change what other members get (F15, F16, F21, F22, F25, F26, F27, F28, F29)
  crossing: browser -> session
  entrances: route GET /api/auth/callback/slack, route POST /api/auth/callback/slack, action signIn, query getMyProfile, query getLeaderboard, query getQuests, mutation openFeature, mutation openQuestCrate, query getSkillTree, mutation buyPerk
  refuted: memberQuery's guard read the website flag's workspace decision instead of the member's own -> the previewer read closed, their first command answered closed, and a member off in their own decision read their profile (2026-10-14)
  refuted: unlockPathOf read the workspace's unlock path instead of the member's own -> a member whose own unlocks decision is off read the tree through getSkillTree (2026-10-14)
  refuted: workspaceLaunchDueIn left out the Book's launch -> a previewer's sign-in ran their Journey preview moment while the Book's launch was due (2026-10-14)
  refuted: openQuestCrate's group branch read only group-quest and quests, not groupQuestAppliesTo's groups check -> opening a finished group quest's crate from a stale page after groups turned off answered opened (2026-10-16)
  kinds: identity, state
  checklist: capability-authorization dismissed: the session token authorizes only acting as the signed-in member, and the guard rechecks the live session, the directory and the member's own decision on every call
  checklist: revalidated-permission declared as website reads pass one guard
  checklist: canonical-encoding dismissed: the directory is keyed by Slack's workspace and user ids exactly as the sign-in claims carry them, and the member decision reads the email the directory stores
  checklist: identity-continuity declared as accounts link only by the Slack pair
  checklist: separation-of-duties dismissed: no approval policy applies to signing in or opening one's own feature
  checklist: legal-state-succession dismissed: the exposure and each preview moment are written once per member and never moved
  checklist: supersession-safety dismissed: the exposure and each preview moment are written once per member, so nothing late can publish a different value
  checklist: worker-fencing dismissed: no worker runs the guard; each call is one mutation
  checklist: commit-ordered-effects dismissed: the exposure and the preview moments' events reach the outbox in the same mutation, and a refused sign-in throws, which rolls them back
  checklist: resumption-coverage dismissed: no batch operation resumes
- accounts link only by the Slack pair: A sign-in links to an account only by its Slack workspace and user, never by an email, and keeps the display claims of the latest sign-in on that same account.
  over: a first sign-in and a later sign-in of the same Slack pair with changed and dropped display claims
  via: WS7: accounts link only by the Slack pair
  because: Slack can't vouch for an email a member types elsewhere; linking by email would let another identity take over a member's account (WS7)
  crossing: browser -> session
  entrances: route GET /api/auth/callback/slack
  refuted: a later sign-in of the same Slack pair inserted a new user instead of updating the linked one -> the same-pair sign-in returned another user (2026-10-13)
  kinds: identity
  checklist: capability-authorization dismissed: the account key is Slack's workspace and user from a verified ID token; no credential with bounded permission is accepted
  checklist: canonical-encoding dismissed: the account key is `<workspace>/<user>` exactly as Slack's claims carry them, with no normalisation to disagree on
  checklist: identity-continuity declared as accounts link only by the Slack pair
- the website's board is invisible while everyone-board is off: While the everyone-board flag is off for the member, getLeaderboard answers not-found and getMyProfile's leaderboard reads off; only while it is on does getLeaderboard answer the board and leaderboard read open.
  over: getLeaderboard and getMyProfile for a member while PostHog has no everyone-board flag, in production while the flag is on in the sandbox only, and with the flag switched off under an open session
  via: WS30: the website's board is invisible while everyone-board is off
  because: the website must never show more than Slack shows (WS30, O33); a board Slack keeps dark must not reach a browser before the owner switches its flag
  crossing: browser -> domain
  entrances: query getLeaderboard, query getMyProfile
  refuted: getLeaderboard read the everyone-board flag but no longer answered not-found while it is off -> 3 of the 4 tests failed, the board answering while PostHog had no flag, in production and after the switch-off (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: not-found carries no board fact, and leaderboard carries only its state and, while locked, the level it opens at
- the website's leaderboard waits for its unlock: While xp-levels is on and unlocks apply to the member (the unlocks flag on and its launch or their preview moment recorded), getLeaderboard answers the board and getMyProfile's leaderboard reads open only for a member who has opened the Leaderboard; a member it is ready for reads ready, and one it is locked for reads locked with the level it opens at, both with no board facts; while unlocks don't apply the answer is the everyone-board flag's alone; a website read never records the launch, and a member's row on another member's board never depends on their own unlocks.
  over: getLeaderboard and getMyProfile with xp-levels and unlocks off, unlocks on and launched while xp-levels is off, xp-levels on and unlocks switched off after its launch, both on before the launch, and both on after it for a member at level 1, a member at level 3, a member who opened the Leaderboard, a member who was there at the launch, everyone-board off, and a locked member on an opened member's board
  via: WS52: the website's leaderboard waits for its unlock
  because: the website must never show more than Slack shows (WS52, #103, P76): a board Slack still tells a member opens at a level they haven't reached must not reach their browser, and a query that ran P77's launch would record it before the owner switches unlocks on, so the website reads only the query-safe check
  crossing: browser -> domain
  entrances: query getLeaderboard, query getMyProfile
  refuted: leaderboardStateOf answered open for every shipped state while unlocks apply, ignoring stateOf's locked and ready -> the locked and the ready member read the board (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: locked carries only the level unlocks' schedule names and ready carries nothing, so neither carries a board fact
- the website's feature states are Unlocks' facts: getMyProfile's features is null while unlocks don't apply to the member (xp-levels off, the unlocks flag off, or neither the launch nor their preview moment recorded) and the leaderboard then is the everyone-board flag's alone; while they apply, each entry's state, readyAt and openedAt are unlocks' own read of the member, its level is unlocks' schedule entry, its name and what it opens are that entry as Slack names it for the member's store (the store shown to them or not), and the leaderboard is the Leaderboard entry's state, or off without one; a website read never records the launch.
  over: getMyProfile with xp-levels and unlocks off, either one on, and both on before the launch, either one switched off after the launch, and both on after it for a member at level 1, a member at level 3, a member who opened the Leaderboard and a member who was there at the launch, and Coins ready at level 6 with the store off and on
  via: the website's feature states are Unlocks' facts
  because: the website never computes a game rule and never shows more than Slack does (WS55, WS56, WS57, P79): comparing a level with a feature's level in the website could show a feature open that Slack still holds, and the nav, the card and the page must read one fact so they can't disagree
  crossing: browser -> domain
  entrances: query getMyProfile
  refuted: featureCardsOf read every feature as locked instead of unlocks' state -> the ready, the opened and the grandfathered member read it locked (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: an entry carries only the feature's schedule copy, the member's own state and times, and a hashed key with no member, Slack or workspace ID
- the website shows only shipped features: While unlocks apply, getMyProfile's features has an entry only for a feature whose ship flag is on for the workspace, so a feature that hasn't shipped has no entry whatever the member's level, and with nothing shipped the list is empty; while the tree's ship flag is off or unlocks don't apply, getSkillTree answers not-found and getMyProfile's skillPoints is null, whatever perks the member owns.
  over: getMyProfile with skill-tree off for a member past level 5, with skill-tree on for a member at level 5, with everyone-board off, and with no feature shipped; getSkillTree and getMyProfile's skillPoints with the tree's ship flag switched off after a member opened the tree and bought spark, and with that flag on before unlocks launched
  via: the website shows only shipped features
  because: a member is never shown something they can't get (P78, WS56): a card for an unshipped feature would promise a feature Slack doesn't have
  crossing: browser -> domain
  entrances: query getMyProfile, query getSkillTree
  refuted: featureCardsOf listed every scheduled feature instead of unlocks' shipped ones -> the skill tree showed with skill-tree off and the empty list read six cards (2026-10-14)
  refuted: getSkillTree read progression's memberPerksOf whatever the page state instead of the flag-gated perksOf read -> with the tree's ship flag off a member who owns spark read the tree, and so did a member before the launch (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: an unshipped feature is absent from the answer, not redacted inside it
- a website board row carries only what a board shows: A row of getLeaderboard's board holds exactly its position, rank, tie, name, face, kudos given and whether it is the viewer's own; it never carries a Slack user ID, a member ID, kudos received, XP, a level or a group, and a member who left the boards, a member who only received and a former member are in no row.
  over: getLeaderboard's board with a member who left the boards seen by themselves and by another member, a member who only received, a former member, and a member without a display name
  via: a website board row carries only what a board shows
  because: a board shows only kudos given (G13, P66) and keeps a member's choice to leave it (G22); an ID or a received count in a row would reach every member's browser (WS32, WS33)
  crossing: browser -> domain
  entrances: query getLeaderboard
  refuted: getLeaderboard's rows also carried the member's ID -> the exact-row and the no-ID tests failed (2026-10-13)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction declared as a website board row carries only what a board shows
- a member's activity holds only kudos they gave or received: getActivity and getRecentKudos answer only the kudos the signed-in member received or gave, with the words of exactly those, never a kudos between two other members or its words, except the words of a Given kudos message the member hugged, which getActivity's full view answers on that hug's entry while `hugs` is on for them (SR11), and no entry carries a member ID, an award ID or a Slack user ID.
  over: getActivity and getRecentKudos in both directions for a member beside a private-channel kudos between two other members and one kudos to the member
  via: AT14 AT28: a member's activity holds only kudos they gave or received
  because: a member reads the words of exactly the kudos they gave or received (AT28), and the activity takes no member argument (AT14), so nobody reads another member's private-channel thanks through their own timeline; an ID in an entry would let a browser address another member elsewhere (AT21)
  crossing: browser -> domain
  entrances: query getActivity, query getRecentKudos
  refuted: awardsReceivedNewestFirst read the whole recipient index instead of the member's own awards -> the member's activity listed the kudos between two other members (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction declared as a member's activity holds only kudos they gave or received
- the spotlight draws only public, said-why kudos of the member's workspace: getSpotlight answers only a Given kudos of the signed-in member's own workspace whose words came from a public channel and said why in their newest revision, by an author who is still a member, with neither its giver nor any recipient off the leaderboards, and its answer carries no member ID, award ID or Slack user ID.
  over: getSpotlight from a seed and through Next beside a private-channel kudos, a bare kudos, a kudos that gave nothing, a backfilled kudos with unknown visibility and another workspace's kudos, after an edit drops the reason, after a deletion in Slack, after the author leaves Slack, and while and after a giver or recipient leaves the leaderboards
  via: AT31 AT34: the spotlight draws only public, said-why kudos of the member's workspace
  because: the spotlight shows a kudos's words to the whole workspace, so a private channel's words (AT3, AT26), a kudos without a reason (AT27), another workspace's kudos (AT34) or a member who chose to leave the boards (G22) must never reach it, whatever order the engine and the recompute job run in
  crossing: browser -> domain
  entrances: query getSpotlight
  refuted: drawableKudosOf no longer required the kudos text's visibility to be public -> the spotlight drew a private channel's kudos (2026-10-14)
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction declared as the spotlight draws only public, said-why kudos of the member's workspace
- a browser learns only its own analytics ID: getBrowserAnalytics reaches its handler only through memberQuery's guard, and answers capture with the project's public token, POSTHOG_HOST, the deployment's environment and the session's own member's analytics ID only while `website-analytics` is on for that member in their own decision, read without writing, they already have an analytics ID, and the deployment has POSTHOG_PROJECT_TOKEN and a POSTHOG_HOST that is a web URL; it answers off otherwise, and the read creates nothing.
  over: getBrowserAnalytics for a member the flag is on for, two members in turn, the flag on only for another member's email, the flag off, never created, without the flags key, a member without an analytics ID, without the project token, without POSTHOG_HOST, a POSTHOG_HOST that isn't a URL, and an argument that names another member
  via: a browser learns only its own analytics ID
  refuted: getBrowserAnalytics skipped the website-analytics flag check -> the flag off, never created and on only for another member's email answered capture with the member's ID, 3 of 10 tests red (2026-10-18)
  refuted: configuredHost took any non-empty POSTHOG_HOST -> a host that isn't a URL reached the browser in a capture answer, 1 of 11 tests red (2026-10-18)
  because: the browser sends events to PostHog under the ID it is given, so an ID from any other member would put one member's browsing on another's person, and a read that made an ID would write from a query; the flag keeps the browser half dark until the product owner widens it (MS16, MS17)
  crossing: browser -> domain
  entrances: query getBrowserAnalytics
  kinds: read, identity
  checklist: scoped-reads declared as website reads pass one guard
  checklist: capability-authorization dismissed: the project token is PostHog's public ingestion key, which every browser that captures already holds; the read hands out no credential with more reach
  checklist: redaction dismissed: an off answer carries only its kind, never an ID
  checklist: canonical-encoding dismissed: the analytics ID is answered exactly as the analytics module stored it
  checklist: identity-continuity dismissed: each answer names the session's member as the directory knows them now; a later session for another member reads that member's own ID
- the website runs only its own code: Every HTML response carries the policy header contentSecurityPolicy builds: `script-src 'self'`, `style-src 'self'` and every other directive as before, with `connect-src` widened only by POSTHOG_HOST's origin and, for PostHog's US or EU cloud, its assets host; without a POSTHOG_HOST that is a web URL the policy is the one before browser analytics, and no policy sends violation reports.
  over: contentSecurityPolicy without POSTHOG_HOST and with it empty, with PostHog's US host, its EU host and a host of its own, and GET / with POSTHOG_HOST set and with a POSTHOG_HOST that isn't a URL
  via: the website runs only its own code
  refuted: contentSecurityPolicy dropped PostHog's assets host from connect-src -> the US and EU policies and the served header missed the assets host, 3 of 5 tests red (2026-10-18)
  refuted: configuredHost took any non-empty POSTHOG_HOST -> an HTML response under a host that isn't a URL threw instead of carrying today's policy, 1 of 6 tests red (2026-10-18)
  because: the page must run only the deployment's own scripts and talk only to the deployment and PostHog, so adding analytics opens no door for injected code, and a violation report would leave the browser outside the flag with an unscrubbed URL (MS28, WS25)
  kinds: output
  checklist: destination-confinement declared as the website runs only its own code
  checklist: redaction dismissed: the policy names hosts, never a member or a secret
  checklist: commit-ordered-effects dismissed: building the header writes nothing
  checklist: circuit-breaker-policy dismissed: no breaker is declared; nothing is called
  checklist: declared-target-coverage dismissed: there is no fan-out; one header per HTML response
- a level up's page answers only the member's own level up: getLevelUp answers off while `album` or `level-up-reveal` is off or `hidden-items` is on for the signed-in member, each read without an exposure, so the face-up reveal never shows a level up whose three hoggies wait on the item board (LP25); none while the member has no level up recorded at the level asked or that level up dropped nothing; and otherwise that level, when it was reached and the find each of its crates `level:{level}:1`, `:2` and `:3` dropped, in slot order, each shown as every drop is, with its name, rarity, art, copy and whether it is new, beside the level emojis that level up earned: each level of the emoji catalogue above the member's previous recorded level up, else level 1, and at or below the one asked, named from the registry, as the album answers its emojis, earned at the level up's time; it reads only through indexes, at most two level-up rows, three drop records and one seen-emoji row per level emoji.
  over: a member reaching level 3 with three pinned finds, a find of level 2 found again at level 3, level ups at 4, 10 and 11 with the registry open, a level reached before `level-up-reveal` was on and a level never reached, and a level up that dropped its finds read while `level-up-reveal` or `album` is off or `hidden-items` is on
  via: getLevelUp answers one level up's reveal
  refuted: levelUpBefore answered level 1 whatever level up came before -> level 11's page answered the level 5 emoji that level 4's level up had not earned but level 10's had, 1 of 6 tests red (2026-10-20)
  refuted: levelUpBefore answered level 1 again, once the tests drew for real under a searched secret -> level 11's page again answered the level 5 emoji, 1 of 6 tests red (2026-10-20)
  refuted: levelUpRevealShownTo no longer read hidden-items -> 1 of 7 tests failed: with hidden-items on, a level up that dropped its hoggies answered its reveal instead of off (2026-10-21)
  because: the product owner asked, 2026-10-20, that a level up show its three finds and the emojis it unlocked on one page the level-up DM links to; the page names only what that level up brought, so an emoji earned at an earlier level up never shows as new there, and a bounded read keeps a member with a long history inside a query's limits
  crossing: browser -> domain
  entrances: query getLevelUp
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the answer holds only the member's own finds and the workspace's emoji names, no member ID, Slack ID or kudos words
- the last visit only moves forward: A member's last visit moves only forward, and only at an arrival from the stored one: arrive moves it to the newest instant among the member's turned items, album stickers, team stickers, first hoggie finds and kudos received, and while `xp-moments` is on the newest instant Activity decided, never to the clock, nor past an entry an XP moment has yet to play (an XP moment ends at the newest instant it read); an arrival from any other last visit, a stale tab's or a replayed one, moves nothing, so every tab reads the same one; a move to an earlier instant keeps it; while neither `hidden-items` nor `xp-moments` is on for the member arrive answers refused, writing nothing, and while `hidden-items` is off getAlbum answers no last visit and no sticker's instant.
  over: a first arrival after a sticker's turn and a second from it after the next turn, an arrival after a kudos received, a stale tab's arrival after another tab's, a move to an earlier instant, and an arrival and a read with hidden-items off
  via: LP26: the last visit moves forward once per visit
  refuted: arrive moved the last visit whatever last visit the tab read -> 1 of 5 tests failed: a stale tab's arrival, holding an older last visit, moved it to what another tab had turned since (2026-10-21)
  because: the New labels (LP22) and the teaser's count of kudos since the last visit (LP38) read it; a move to the clock would skip what was decided between the read and the arrival, a stale tab's move would clear another tab's labels in the middle of a visit, and a backward move would label old finds again (LP26)
  crossing: browser -> domain
  entrances: mutation arrive
  kinds: state
  checklist: revalidated-permission dismissed: arrive reads the flags and the session in the same mutation that moves the last visit
  checklist: separation-of-duties dismissed: no approval policy; a member moves only their own last visit
  checklist: legal-state-succession declared as the last visit only moves forward
  checklist: supersession-safety dismissed: an arrival moves the last visit only from the one the tab read, and Convex retries an arrival whose read of it changed before it committed
  checklist: worker-fencing dismissed: no worker owns a last visit; two arrivals conflict on the row they both read, so one retries and finds it moved
  checklist: commit-ordered-effects dismissed: moving the last visit issues no external effect
  checklist: resumption-coverage dismissed: no batch operation resumes; each arrival is one mutation
- an XP moment reads what was decided since the last visit: While `xp-moments` is on for the member, getXpMoment reads Activity above the stored last visit, one index range per source and at most 50 entries, and answers none with the last visit when there is none yet or nothing was decided since it, or else the moment: the kudos received, the hugs on the member's messages that came since it, the kudos given, the hugs given and the level-ups, up to five shown oldest first with every level-up crossed among them and then the newest of the rest, the rest folded into one count with its XP, each with the XP it paid and never a pack's, the climb from the standing before the moment's XP to now, and the waiting items while `hidden-items` is on; a kudos whose XP progression has not recorded yet, decided less than ten minutes ago, waits out of the moment with everything decided after it, so no excerpt pays 0 XP for a kudos that pays, and the read answers none when nothing older remains; while it is off getXpMoment answers off and arrive moves the last visit as before.
  over: a member with no last visit and with nothing since it, a busy return with each kind, a return past five entries, a level-up among newer kudos, hugs on a message before and after the last visit, a kudos whose XP progression waits with one after it, one whose progression never records past ten minutes, xp-moments off, and xp-moments on with hidden-items off
  via: LP27 LP28: getXpMoment plays what happened since the last visit
  refuted: getXpMoment read Activity without the last visit as its lower bound -> 6 of 7 tests failed: a member with nothing since the last visit read a moment instead of none, and a busy return replayed the kudos from before it (2026-10-21)
  because: the core-loop spec plays what happened since the last visit as one XP moment (LP27, LP28); a read without the lower bound would replay old kudos, one that counted a message's earlier hugs would pay them twice, and a level-up left out would hide the climb the takeover celebrates (LP34)
  crossing: browser -> domain
  entrances: query getXpMoment
  kinds: read
  checklist: scoped-reads declared as website reads pass one guard
  checklist: redaction dismissed: the moment holds only the member's own activity entries, as the Activity page shows them, and the norm count, which names nobody
- an XP moment ends at the newest instant it read: endXpMoment moves the member's last visit only from the one the moment read and only to the newest instant it read, never to the clock, so what was decided while it played waits for the next moment; while `xp-moments` is on an arrival, which a read that answered none sends, moves nothing while Activity holds an entry above the stored last visit, so what was decided after that read, or waits on its XP, plays at the next read; a second tab's end of the same moment, an end from an older last visit, or an instant nothing was read at moves nothing and records nothing; each end that moves it records xp moment ended with skipped and the excerpts shown and folded, counted on the server; while `xp-moments` is off it answers refused and writes nothing.
  over: an end while a kudos is decided during the moment, an arrival after a read that answered none with a kudos decided since, a second tab's end and an older moment's end, an end at an instant past what was read, an end that skips with a level crossed, and an end with xp-moments off
  via: LP26 LP35: endXpMoment moves the last visit to the newest instant the moment read
  refuted: endXpMoment moved the last visit to the clock instead of the newest instant the moment read -> 2 of 5 tests failed: the kudos decided while the moment played was skipped by the next moment, and the second tab read a later last visit than the moment it ended (2026-10-21)
  because: LP26 moves the last visit once per visit at the moment's end, to the newest instant it read; a move to the clock would drop entries decided while it played, a stale tab's end would replay or skip another tab's moment (LP35), and a count the browser sent could claim excerpts it never showed (LP36)
  crossing: browser -> domain
  entrances: mutation endXpMoment
  kinds: state
  checklist: revalidated-permission dismissed: endXpMoment reads the flags and the session in the same mutation that moves the last visit
  checklist: separation-of-duties dismissed: no approval policy; a member ends only their own moment
  checklist: legal-state-succession declared as the last visit only moves forward
  checklist: supersession-safety dismissed: an end moves the last visit only from the one the moment read, and Convex retries an end whose read of it changed before it committed
  checklist: worker-fencing dismissed: no worker owns a last visit; two ends conflict on the row they both read, so one retries and finds it moved
  checklist: commit-ordered-effects dismissed: the usage fact is scheduled in the mutation that moves the last visit, so only a committed end records it
  checklist: resumption-coverage dismissed: no batch operation resumes; each end is one mutation
