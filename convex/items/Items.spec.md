# Items

Items: every reward a member has not seen (LP2, `spec/core-loop.md` on `spec/core-loop`), a thoughtful pack's hoggie and, where the grant decided the pack holds one, the sticker of the pack's person, each earned by the pack's giver for thanking that person, a level up's three hoggies (LP7), and the welcome item (LP44). It owns the items `{ workspace, member, source, key, reason, earnedAt, turnedAt? }` (LP4), unique per member, source and key: `earnItem`, called in the mutation that earns the reward, writes one and answers the first for a second earn, changing nothing, whatever `hidden-items` says (LP5, LP6); the grant of a thoughtful pack earns its giver the pack's hoggie with source `hoggie`, the pack's crate key `thoughtful:{pack ID}` and reason `thanks` naming the thanked person and the message, and where the pack holds a sticker the sticker with source `sticker`, the pack ID as key and the same reason, so a thanks earns one or two items; recording a level up earns its member three hoggie items keyed `level:{level}:1`, `:2` and `:3`, the third with `floor` `rare`, each with reason `levelUp` naming the level, whatever `hidden-items`, `level-up-reveal` or `collection` says, and while `hidden-items` is on for the member the level up drops nothing (LP7). `turnedAt` is set once, by the turn or by `markTurned`, which the album's old open of a thoughtful pack and the old level-up drop, for each crate that dropped, call for the hoggie, and the album's old put-in and put-all-in call for a pack's sticker and a tray hoggie's item, each in their own mutation, so a member whose flag turns on finds only what they have not seen, and it never moves (LP5, LP6). The `hidden-items` flag is a member decision off by default, read without exposure and without writing by `hiddenItemsShownTo`. The item board's read, `boardOf`, reads one index range of the member's items not yet turned, oldest earned first, at most 100 with `more`, each face down as its ID, when it was earned and its reason, never its source, key, face or rarity (LP8, LP9); the website's `getAlbum` answers it while `hidden-items` is on, with the thanked person's name and face, and answers a hype emoji not yet seen as not yet earned while an item thanking its person waits on the board, or while more items wait than the board shows, and the album's `hypeEarnedBy`, for the person's page and the earned emojis Slack counts, holds a hype emoji not yet seen only while an item of the first pack thanking its person still waits face down, through this module's `hypeWaitsForItsItem`, so no emoji moment, page or kudos shows it before the turn that brings it (LP14), and a hype emoji the old put-in earned keeps counting in Slack while a later thanks to the same person waits (LP6); and while `hidden-items` is on it answers a milestone tier whose emoji the member has not seen as not yet earned, its emoji too, and a seen one with `unlockedAt`, the later of its reaching and its emoji's seen mark, so a tier reached away from the board, such as a thoughtful-giving tier reached in Slack, waits for the next turn (LP14, LP22). The turn, `turn`, run by the website's `turnItem` while `album`, `hidden-items` and `collection` are on for the member, takes one of the member's own items not yet turned and, in one mutation, for a hoggie draws it through `dropFor` with surface `website` and the item's floor, so a level up's third item never draws below rare, found at once and never waiting in the tray, so the draw stays a pure function of the secret, the member, the crate key and the catalogue version (LP11); and counts the find in the album's tallies, landing on `hoggies` with the pack bonus the drop paid, 15 XP and no coins while `packs` is on; for a sticker runs the album's put-in of the pack sticker, `putStickerIn`, which records it, counts the new face and publishes `stickerPutIn`, pays nothing, lands on the member's first team page holding the person, one the sticker filled before any other, else the person's own page, and unlocks each team page the sticker filled through the album's `unlockReadyTeamsAmong`, its team emoji marked seen (LP13, LP14, LP19); the first item turned from thanking a person unlocks that person's hype emoji, marked seen and answered with the person's name, except a hoggie turned while that person's sticker item waits, which leaves it to the sticker's turn so it unlocks beside the sticker (LP14); every turn records the milestone tiers it reaches (LP13) and, through `unlockMilestoneTiers`, unlocks every tier the member has earned whose emoji they have not seen, those it reached and those reached away from the board, marking each emoji seen so it unlocks once (LP14, LP19a), marks the item turned and publishes `itemTurned` with its source, a hoggie's drawn rarity, and whether the hoggie or the face is new (LP16); and it answers the face, what it paid, the page it lands on, what it unlocked (the team stickers, the hype emoji and the milestone tiers) and `again` false (LP10). A turned item answers its face again with `again` true, nothing applied and nothing unlocked, writing nothing (LP12); another member's item, a missing one, and a drop that does not land answer nothing. The welcome item (LP44) is a hoggie item with the crate key `welcome:first`, of the `welcome` crate kind, which has no pack band, so its draw stays the same pure function and its turn pays no XP, with a `rare` floor that `dropFor` draws at or above, and reason `welcome`; `earnWelcomeItem`, which the website's sign-in callback calls at a member's first sign-in, one Convex Auth links to no account yet, and the Slack adapter's verification calls once users.info verifies a person the directory did not know at their first sign-in (the check that sign-in started carries `firstSignIn`, kept when its tries fail, so a later sign-in's check that verifies them earns it), and the welcome nudge will call when it is sent, earns it in its caller's mutation only while `welcome-item` and `hidden-items` are both on for the member, read without exposure and without writing by `welcomeItemShownTo` (LP50), so a member who signed in before the flag earns none, and nothing expires it. `lessonAfter` answers, for the first turn of the welcome item while both flags are on, the workspace's kudos emoji and its custom picture or null, for the one line that teaches the loop (LP49), and nothing for a replay or any other item. `newestTurnOf` answers the instant of the member's newest turn from one index range, or none, for Website reads' last visit (LP26). A tray item the album's old open put in the tray and the old put-in has not put in waits face down (LP23): beside each tray item it writes, the old open earns its item with the pack's reason and earning instant, for a sticker the pack's sticker item and for a hoggie a hoggie item keyed `tray:{tray item ID}`, and it puts in the tray only what is not yet turned, so a pack whose items turned while `hidden-items` was on opens into an empty tray with nothing applied; the turn of a tray hoggie item finishes the old put-in of its tray item from the drop the open recorded, through the album's `placeFromTheTray`, landing on `hoggies` and paying nothing, and a sticker's turn marks its pack's waiting tray sticker put in. While `hidden-items` is on for the member, the website's `openThoughtfulPack`, `putIn` and `putAllIn` refuse and write nothing; their code stays until the flag is everyone's. `fillItems` (LP24), an internal mutation run by hand once per deployment and again after the flag widens, walks every member in creation order, one member a mutation, and earns, at most 100 of a kind a mutation with the next scheduled from its cursor, each pack the member has not opened its items as the grant does, and each tray item not yet put in its item as the open does; `earnItem` makes a rerun earn nothing, and it deletes nothing. The share (LP51 to LP56): while `item-share`, a member decision off by default read without exposure and without writing by `itemShareShownTo`, is on for the member, the turn, through `recordWinOf`, records a win in the share ledger `itemShares` `{ workspace, member, item, win, wonAt, sharedAt? }` for a turned hoggie drawn epic or legendary, or else for the first team page the turned sticker completed, its team's name and crest art, one row per item; nothing is recorded while the flag is off. `shareOffersTo` answers getAlbum's `shares`, the member's newest 10 wins not yet shared, from one index range, only while `hidden-items` and `item-share` are on for the member and the workspace has a weekly-post channel, the Monday post's switchable channel, through `weeklyPostChannelOf`. The website's `shareItem`, through `shareWin`, shares only the signed-in member's own win not yet shared, under the same conditions: it sets `sharedAt` and schedules `postItemShare` in one mutation, so a win is shared at most once from any device, and the album stops offering it. `postItemShare` reads the card through `shareCardOf` and posts it once into the weekly-post channel with no new scope: the lead, the winner in bold, then for a thanks ` thanked ` and the thanked person in bold with the quoted thanks only for a public kudos, for a level up ` reached level N`, and for the welcome item nothing, then ` and found a legendary {name}`, ` and found an epic {name}` or ` and completed the {team} page`; the hoggie's art at `/share/{hoggie}.png` or the team's crest as the picture; and an Open HedgeHug link to the album; never a colleague's face. It retries only a rate-limited send, at most three times, and resends without the picture once if Slack refuses the blocks. Only this module's `earnItem` writes items.

## invariants
- an item is earned once per member, source and key: A thoughtful kudos earns its giver exactly one item for each pack it grants, whatever `hidden-items` says, and an earn of the same member, source and key again, from a redelivered event or any other writer, adds nothing; an item earned while the flag is off waits on the item board once it turns on.
  over: a thoughtful kudos and the same Slack event redelivered, read on the giver's item board with hidden-items on; a thoughtful kudos given while hidden-items is off, read on the board once it turns on
  via: LP5 LP7: a thanks in Slack earns its pack's hoggie as one item
  because: every writer of an item earns it where the reward is decided and the backfill and retried pages overlap them (LP5), so a second earn that added a row would put one hoggie on the board twice and pay its band twice; and an item earned only while the flag is on would leave a member whose flag turns on without the packs they earned before (LP6)
  refuted: the grant earned each pack's hoggie twice and earnItem no longer looked up the member's earlier item of that source and key -> 2 of 2 tests failed: one thoughtful kudos put two items on the board, and the item earned while hidden-items was off waited twice (2026-10-21)
  kinds: storage, state
  checklist: scoped-reads dismissed: the invariant is about what is written; the board's read is the item board names only when and whom
  checklist: revalidated-permission dismissed: earning an item needs no permission; the awards the grant follows were decided when they were given
  checklist: encrypted-storage dismissed: items are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: earnItem takes only internal arguments, checked by the grant's kudosGiven validator and the items table's validator
  checklist: revision-preservation dismissed: an item is never revised; it is inserted once and only its turnedAt is set, once
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as an item is earned once per member, source and key
  checklist: supersession-safety dismissed: no late write displaces an item; a second earn finds the first by its member, source and key and writes nothing, and Convex retries a mutation whose read of that range changed before it committed
  checklist: worker-fencing dismissed: no worker owns an item; two earns of one key conflict on the range they both read, so one retries and finds the other's
  checklist: commit-ordered-effects dismissed: earning an item issues no external effect
  checklist: durable-dispatch-intent dismissed: the item is earned in the grant's own mutation, beside the pack it is keyed by, so it commits with its cause or not at all
  checklist: resumption-coverage dismissed: the grant's pages and their resumption are the album's a message's packs are told once; each page earns the items of the packs it grants
  checklist: declared-target-coverage dismissed: the only writer in this slice is the thoughtful pack grant, reached by the oracle through kudos given at the Slack boundary
  checklist: completion-evidence dismissed: nothing waits on an item's earn; the board reads the stored items
- the item board names only when and whom: While `hidden-items` is on for the member, getAlbum answers the item board of their own items not yet turned, oldest earned first, at most 100 with `more` past them, each naming only its ID, when it was earned and whom it thanked, never a face it holds, a rarity or a source, and answers no packs and no tray beside it.
  over: two thoughtful kudos to two people read on the board in earning order, every board item's keys, and 101 waiting items over two messages, read through getAlbum with album, collection, packs and hidden-items on
  via: LP8 LP9 LP17: with hidden-items on, getAlbum answers the item board and no packs or tray
  because: the board is the face-down moment of the core loop (LP9): an item that named its source or rarity would give the surprise away before the turn, and packs or a tray beside the board would show the same reward twice (LP17); the read stays one range of at most 101 rows however many items wait (LP8)
  refuted: boardOf's face-down item also carried the item's source -> 1 of 2 tests failed: a board item's keys were earnedAt, item, reason and source instead of only the first three (2026-10-21)
  kinds: read, output
  checklist: scoped-reads dismissed: the board reads only the signed-in member's own items by an equality on the member, under the website's memberQuery guard; the album is private covers reading across members
  checklist: destination-confinement dismissed: the board goes only to the signed-in browser that asked; nothing is sent elsewhere
  checklist: redaction declared as the item board names only when and whom
  checklist: commit-ordered-effects dismissed: the board is a query; it writes nothing and issues no effect
  checklist: circuit-breaker-policy dismissed: no breaker is declared; nothing is sent
  checklist: declared-target-coverage dismissed: getAlbum is the only read of the board
- a turn draws the hoggie and pays once: The first turn of a member's own item draws its hoggie at the turn, found at once, pays the pack's 15 XP, takes the item off the board and sends one item turned naming its source, rarity and whether it is new.
  over: one thoughtful kudos with every album flag on, its item turned through turnItem, read through getAlbum's level and board, getAlbumHoggies' found hoggies, the draw for the pack's crate key and the item turned events PostHog receives
  via: LP10 LP11 LP16: turnItem draws the hoggie at the turn, pays the pack's 15 XP and sends item turned
  because: a hoggie item has no drop until its turn (LP11), so a turn that left the drop waiting in the tray would answer a hoggie the member never finds, and a turn that paid nothing or sent nothing would lose the pack's XP and the core loop's measure (LP16)
  refuted: the turn passed waits true to dropFor, so its drop waited in the tray -> 1 of 1 tests failed: getAlbumHoggies found no hoggie after the turn instead of the drawn one (2026-10-21)
  kinds: state
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it, so no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy; a member turns their own item with one click
  checklist: legal-state-succession declared as a turn draws the hoggie and pays once
  checklist: supersession-safety dismissed: turnedAt is set once and never moved, and Convex retries a turn whose read of the item or its drop changed before it committed
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read, so one retries and finds it turned
  checklist: commit-ordered-effects dismissed: itemTurned is published in the turn's mutation, and the bus schedules its subscribers only when that mutation commits
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
- a replayed turn applies nothing: Turning an item already turned answers the same face with `again`, pays nothing, drops nothing and sends nothing more, and two items turned at once both land.
  over: one item turned twice, read as the second answer beside the first, the member's XP and the item turned and hoggie dropped events PostHog receives; two items turned concurrently, read on the board
  via: LP12: a replayed turn answers the same face and applies nothing
  because: the Convex client resends a mutation after a reconnect (LP12), so a replay that paid or published again would double the pack's XP and count one turn twice
  refuted: the turn no longer checked turnedAt, so a turned item was turned again -> 1 of 2 tests failed: the second turn answered again false with the bonus applied instead of again true and nothing applied (2026-10-21)
  kinds: state, message
  checklist: revalidated-permission dismissed: a replay reads the flags, the session and the item's owner again in its own mutation
  checklist: destination-confinement dismissed: itemTurned goes only to the subscribers the bus registers; Analytics' outbox posts only to the configured POSTHOG_HOST
  checklist: message-authenticity dismissed: the turn's input is the browser's item ID, checked against the signed-in member's own items by the turn refuses and writes nothing
  checklist: input-validation dismissed: turnItem's argument is checked by its v.id validator, and the fact by its own event validator
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as a turn draws the hoggie and pays once
  checklist: supersession-safety dismissed: a turn that finds the item turned answers its stored drop and writes nothing, and Convex retries a mutation whose read of the item changed before it committed
  checklist: retry-recognition declared as a replayed turn applies nothing
  checklist: duplicate-suppression declared as a replayed turn applies nothing
  checklist: keyed-ordering dismissed: the fact carries the turn's instant, and PostHog orders events by it, not by delivery
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read
  checklist: acknowledgment-barrier dismissed: the answer goes back to the browser only when the turn's mutation commits
  checklist: commit-ordered-effects dismissed: itemTurned is published in the turn's mutation, and the bus schedules its subscribers only when that mutation commits
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
  checklist: retry-classification dismissed: nothing is sent here; the drain classifies PostHog's answers
- the turn refuses and writes nothing: turnItem refuses another member's item, a missing item, and any item while `hidden-items`, `album` or `collection` is off for the member, and writes nothing then; the same item turns once the flag is back.
  over: another member's item, an item deleted before its turn, and an item turned with hidden-items off, with album off and with collection off, each read through every table and every scheduled function before and after, then turned with every flag back on
  via: LP10: turnItem refuses and writes nothing
  because: an item ID reaches the browser, so a turn that accepted another member's ID would reveal and take their reward, and a turn while the flags are off would show a dark feature (LP10)
  refuted: the turn checked only that the item exists, never that it is the signed-in member's own -> 1 of 4 tests failed: another member's item answered turned instead of refused (2026-10-21)
  refuted: turnItem no longer read hidden-items before turning -> 1 of 4 tests failed: with hidden-items off the turn answered turned instead of refused (2026-10-21)
  refuted: turnItem no longer read collection before turning -> 1 of 18 tests failed: with collection off the turn answered turned instead of refused (2026-10-21)
  crossing: browser -> domain
  entrances: mutation turnItem
  kinds: identity, state
  checklist: capability-authorization dismissed: the session token authorizes only acting as the signed-in member, rechecked by the website's memberMutation guard on every call; the item ID grants nothing by itself
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it
  checklist: canonical-encoding dismissed: the item is named by its Convex document ID, compared as the validator parsed it, and its owner by the member ID the session resolved
  checklist: identity-continuity dismissed: an item belongs to one member for its whole life; a turn by anyone else is refused
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession dismissed: a refusal moves no state
  checklist: supersession-safety dismissed: a refusal writes nothing, so nothing late can publish a different value
  checklist: worker-fencing dismissed: no worker runs the turn; each call is one mutation
  checklist: commit-ordered-effects dismissed: a refusal issues no effect and schedules nothing
  checklist: resumption-coverage dismissed: no batch operation resumes
- the old open marks its item turned: With `hidden-items` off, getAlbum answers no item board and the album's open of a thoughtful pack opens it into the tray as before, and marks the pack's hoggie item turned, so the opened pack's item no longer waits once the flag turns on.
  over: one thoughtful kudos with hidden-items off, read through getAlbum, opened through openThoughtfulPack, then read on the board once hidden-items turns on
  via: LP6: with hidden-items off, packs, the tray and the open stay as today, and the open marks the item turned
  because: the flag can go either way (LP6): an open that left its item waiting would show a member whose flag turns on a hoggie they already opened, and turning it would draw the same hoggie again
  refuted: openThoughtfulPack no longer marked the pack's hoggie item turned -> 1 of 1 tests failed: once hidden-items turned on, the opened pack's item still waited on the board (2026-10-21)
  kinds: state
  checklist: revalidated-permission dismissed: the open reads the pack's giver and the flags in its own mutation, as the album's open of a thoughtful pack does
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as the old open marks its item turned
  checklist: supersession-safety dismissed: markTurned sets turnedAt only on an item not yet turned, so a later turn or open moves nothing
  checklist: worker-fencing dismissed: no worker owns an item; an open and a turn of one item conflict on the row they both read, so one retries and finds it turned
  checklist: commit-ordered-effects dismissed: marking the item turned issues no external effect
  checklist: resumption-coverage dismissed: no batch operation resumes; each open is one mutation
- a thanks earns its hoggie and, where its pack holds one, its sticker: A thoughtful kudos earns its giver, for each pack it grants, the pack's hoggie and, when the grant decided the pack holds the person's sticker, that sticker as a second item, each once per member, source and key; a pack whose person's sticker already waits earns only its hoggie.
  over: one thoughtful kudos to a new face and the same Slack event redelivered, and a second thanks to that person the next week while their sticker waits, read through the giver's stored items
  via: LP7: a thanks earns its hoggie and, where the pack holds one, the person's sticker
  because: the sticker is the other half of what a thanks brings (LP7): a grant that earned no sticker item would leave the person out of the album while the old open is dark, and one that earned it for a pack holding none would put a face in the album twice
  refuted: the grant earned the sticker item for every pack, whether or not it holds a sticker -> 1 of 2 tests failed: a thanks whose person's sticker already waited earned a second sticker item beside its hoggie (2026-10-21)
  kinds: storage, state
  checklist: legal-state-succession declared as an item is earned once per member, source and key
  checklist: supersession-safety dismissed: a second earn finds the first by its member, source and key and writes nothing
  checklist: commit-ordered-effects dismissed: earning an item issues no external effect
  checklist: durable-dispatch-intent dismissed: the items are earned in the grant's own mutation, beside the pack they are keyed by
  checklist: declared-target-coverage dismissed: the thoughtful pack grant is the only writer of a sticker item, reached by the oracle through kudos given at the Slack boundary
  checklist: scoped-reads dismissed: the earn reads only the giver's own items by an equality on the member
  checklist: revalidated-permission dismissed: earning an item needs no permission; the awards the grant follows were decided when they were given
  checklist: encrypted-storage dismissed: items are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: earnItem takes only internal arguments, checked by the grant's kudosGiven validator and the items table's validator
  checklist: revision-preservation dismissed: an item is never revised; it is inserted once and only its turnedAt is set, once
  checklist: separation-of-duties dismissed: no approval policy
  checklist: worker-fencing dismissed: no worker owns an item; two earns of one key conflict on the range they both read, so one retries and finds the other's
  checklist: resumption-coverage dismissed: the grant's pages and their resumption are the album's a message's packs are told once; each page earns the items of the packs it grants
  checklist: completion-evidence dismissed: nothing waits on an item's earn; the board reads the stored items
- a sticker's turn is today's put-in: The first turn of a member's own sticker item puts the person in their album once, sends one album sticker collected and one item turned with source sticker, no rarity and is_new, pays nothing and answers the person's first team page, else their own page; a replay answers the same face and changes nothing.
  over: a thoughtful kudos to a person on a team page and one to a person on none, their sticker items turned through turnItem, read through getAlbum's people, every table and scheduled function before and after a replay, and the item turned and album sticker collected events PostHog receives
  via: LP13: a sticker's turn is today's put-in
  because: the turn replaces the put-in while hidden-items is on (LP13, LP23): a turn that skipped the put-in's tally or its stickerPutIn would break album sticker collected's series, and one that landed nowhere would leave the member looking for the face they just turned
  refuted: putStickerIn no longer published stickerPutIn -> 1 of 2 tests failed: the sticker's turn sent no album sticker collected (2026-10-21)
  kinds: state, message
  checklist: legal-state-succession declared as a turn draws the hoggie and pays once
  checklist: supersession-safety dismissed: recordPackSticker writes a person's album sticker once, and turnedAt is set once
  checklist: commit-ordered-effects dismissed: stickerPutIn and itemTurned are published in the turn's mutation, and the bus schedules their subscribers only when it commits
  checklist: retry-recognition declared as a replayed turn applies nothing
  checklist: duplicate-suppression declared as a replayed turn applies nothing
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it, so no permission is carried from an earlier check
  checklist: destination-confinement dismissed: stickerPutIn and itemTurned go only to the subscribers the bus registers; Analytics' outbox posts only to the configured POSTHOG_HOST
  checklist: message-authenticity dismissed: the turn's input is the browser's item ID, checked against the signed-in member's own items by the turn refuses and writes nothing
  checklist: input-validation dismissed: turnItem's argument is checked by its v.id validator, and each fact by its own event validator
  checklist: separation-of-duties dismissed: no approval policy
  checklist: keyed-ordering dismissed: the facts carry the turn's instant, and PostHog orders events by it, not by delivery
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read, so one retries and finds it turned
  checklist: acknowledgment-barrier dismissed: the answer goes back to the browser only when the turn's mutation commits
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
  checklist: retry-classification dismissed: nothing is sent here; the drain classifies PostHog's answers
- a filled team unlocks with the turn that fills it: The turn of the sticker that fills the last place on a team page answers that team, unlocks its team sticker with its team emoji marked seen in the same mutation, and a replay changes nothing.
  over: a thoughtful kudos to the two other people on a member's team, their stickers turned one after the other, then the second turned again, read through the answers, getAlbum's teams and emojis, and every table and scheduled function before and after the replay
  via: LP14 LP19: a sticker that fills a team unlocks its team sticker and team emoji on that page
  because: emojis unlock with the turn that brings them (LP14): a filled page left ready would wait for a click the core loop no longer offers, and a team emoji left unseen would play again in the arrival's emoji moment
  refuted: unlockReadyTeamsAmong unlocked the team sticker without marking its team emoji seen -> 1 of 1 tests failed: the team emoji read unseen after the turn that filled its team (2026-10-21)
  kinds: state
  checklist: legal-state-succession declared as a filled team unlocks with the turn that fills it
  checklist: supersession-safety dismissed: only a page that reads ready unlocks, and an unlocked page never reads ready again
  checklist: commit-ordered-effects dismissed: the unlock issues no external effect
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it, so no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read, so one retries and finds it turned
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
- a hype emoji unlocks with its person's first item turned: While `hidden-items` is on, a hype emoji not yet seen reads unearned in getAlbum while an item thanking its person waits, and on getAlbumPerson's page and to the earned-emoji check that lets it count in Slack while an item of the first pack thanking its person waits, so one the old put-in earned keeps counting while a later thanks waits; a hoggie turned while that person's sticker item still waits answers none and leaves it waiting, so it unlocks beside the sticker; otherwise the first item turned from thanking the person answers the emoji with the person's name and marks it seen, and a later item for that person answers none; with the flag off the hype emoji is earned and unseen from the thanks, on the person's page and in Slack, as before.
  over: one thoughtful kudos read through getAlbum's emojis before its items turn, its hoggie item then its sticker item turned; a thanks whose pack holds no sticker because the album's history holds the person, its hoggie turned; the person's page read and a kudos with the hype emoji posted through the signed Slack boundary before and after the sticker turns; and the same kudos with hidden-items off, read on the album, the person's page and in Slack; and a thanks put in through the old flow, then a later thanks to the same person waiting once hidden-items is on, with the person's page read and a kudos with the hype emoji posted
  via: LP14: the first item turned from thanking a person unlocks their hype emoji once
  because: an emoji shown before its item turned would give the item away and play its unlock twice (LP14), and the flag can go either way, so the old flow keeps its hype emoji (LP6)
  refuted: isHeldForItsItem held no hype emoji, so getAlbum answered it earned while its item waited -> 1 of 2 tests failed: the hype emoji read earned before any item thanking its person turned (2026-10-21)
  refuted: a hoggie's turn unlocked the thanked person's hype emoji while that person's sticker item still waited face down -> 1 of 4 tests failed: the hoggie's turn answered the hype the sticker's turn should bring (2026-10-21)
  refuted: the person page and Slack's earned-emoji check counted a packed person's hype emoji earned while its thanks item still waited face down -> 1 of 4 tests failed: the person page read the hype emoji earned and Slack counted it before its item turned (2026-10-21)
  refuted: hypeEarnedBy held every unseen hype emoji of a packed person, whether or not its first pack still waited face down -> 1 of 5 tests failed: a hype emoji the old put-in earned read unearned on the person's page and gave no kudos in Slack while a later thanks waited (2026-10-21)
  kinds: read, state
  checklist: legal-state-succession dismissed: a seen emoji stays seen; the hold reads the board and the seen rows fresh
  checklist: supersession-safety dismissed: the turn writes the emoji's seen row once, in the mutation that turns the item
  checklist: redaction dismissed: the hold only withholds a reward until its turn; it names nothing more
  checklist: commit-ordered-effects dismissed: marking an emoji seen issues no external effect
  checklist: scoped-reads dismissed: getAlbum reads only the signed-in member's own board and seen emojis by an equality on the member, under the website's memberQuery guard
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it, so no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read, so one retries and finds it turned
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
- every turn answers the milestone tiers it unlocks: A turn, a hoggie's or a sticker's, answers exactly the milestone tiers it recorded in its own mutation, the teams tier among them when it filled a team, and before them every tier reached away from the board whose emoji the member has not seen, such as the thoughtful-giving tier its thanks reached in Slack.
  over: a thoughtful kudos to the two other people on a member's team, which reaches the first thoughtful tier in Slack, a hoggie item turned, then both sticker items, read through the answers and the milestone tiers stored at each turn's instant
  via: LP13 LP14: every turn answers the milestone tiers it unlocks
  because: milestones stay inline in the turn so their unlock plays in its sequence (LP13, LP19a): a turn that recorded a tier without answering it would leave the beat with nothing to play, and a thoughtful-giving tier reached in Slack plays as a follow-up of the next turn (LP14)
  refuted: the turn answered every tier it recorded but the first -> 1 of 1 tests failed: a turn's answer missed a tier stored at its instant (2026-10-21)
  refuted: unlockMilestoneTiers answered only the tiers recordMilestonesOf wrote in the turn -> 1 of 1 tests failed: the hoggie's turn answered no tier instead of the thoughtful tier its thanks reached in Slack (2026-10-21)
  kinds: state, output
  checklist: legal-state-succession dismissed: the turn records each tier once through the album's recordMilestonesOf and answers a tier only while its emoji's seen mark is missing, writing that mark in the same mutation
  checklist: commit-ordered-effects dismissed: recording a tier issues no external effect
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it, so no permission is carried from an earlier check
  checklist: destination-confinement dismissed: stickerPutIn and itemTurned go only to the subscribers the bus registers; Analytics' outbox posts only to the configured POSTHOG_HOST
  checklist: redaction dismissed: the answer names only what the member's own turn unlocked
  checklist: separation-of-duties dismissed: no approval policy
  checklist: supersession-safety dismissed: turnedAt is set once and never moves, and Convex retries a turn whose reads changed before it committed
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read, so one retries and finds it turned
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
  checklist: circuit-breaker-policy dismissed: no breaker is declared; nothing is sent
  checklist: declared-target-coverage dismissed: turnItem is the only mutation that turns an item, reached by the oracle through a signed-in website session
- a milestone tier unlocks once, in the turn that brings it: While `hidden-items` is on, getAlbum answers a milestone tier the member reached but whose emoji they have not seen as not yet earned, with its emoji unearned, so no emoji moment shows it; the turn that unlocks it answers it once and marks its emoji seen, and getAlbum then answers it earned from its reaching with `unlockedAt` at the turn; with the flag off a tier is earned with its emoji unseen from its reaching, as before.
  over: a sticker item turned that reaches the first people tier and its replay; a thoughtful kudos whose first thoughtful tier waits through getAlbum before the giver's next turn, that turn and the one after it; the same kudos with hidden-items off
  via: LP14 LP19a: each milestone tier unlocks once, in the turn that brings it
  because: each unlock plays once, wherever it plays first, and marks its emoji seen (LP14): a tier answered earned before its turn would pop its emoji over the landed page before its beat, which #104 saw with the first people tier, and a tier answered by two turns would play its beat twice; the flag can go either way, so the old flow keeps its emoji moment (LP6)
  refuted: milestonesHeldForTheirTurn answered getAlbum's milestones unchanged -> 2 of 3 tests failed: the thoughtful tier read earned before the giver's next turn, and a tier the turn unlocked read no unlockedAt (2026-10-21)
  kinds: read, state
  checklist: legal-state-succession dismissed: a seen emoji stays seen; the hold reads the stored tiers and their emojis' seen rows fresh on every read
  checklist: supersession-safety dismissed: the turn writes each tier emoji's seen row once, in the mutation that turns the item, and Convex retries a turn whose read of that row changed before it committed
  checklist: redaction dismissed: the hold only withholds a medal until its turn; it names nothing more
  checklist: commit-ordered-effects dismissed: marking an emoji seen issues no external effect
  checklist: scoped-reads dismissed: getAlbum reads only the signed-in member's own tiers and seen emojis by an equality on the member, under the website's memberQuery guard
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it, so no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read, so one retries and finds it turned
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
- the old put-in marks its sticker item turned: With `hidden-items` off, the album's put-in and put-all-in put a pack's sticker in as before and mark its sticker item turned, so once the flag turns on only the stickers not put in wait.
  over: one thoughtful kudos to two people, both packs opened with hidden-items off, one sticker put in, read on the board once hidden-items turns on, then the rest put all in and read again
  via: LP6: the old put-in and put-all-in mark the sticker item turned
  because: the flag can go either way (LP6): a put-in that left its item waiting would show a member whose flag turns on a face already in their album
  refuted: the album's put-in no longer marked the sticker item turned -> 1 of 1 tests failed: a sticker put in with hidden-items off still waited on the board once the flag turned on (2026-10-21)
  kinds: state
  checklist: legal-state-succession declared as the old open marks its item turned
  checklist: supersession-safety dismissed: markTurned sets turnedAt only on an item not yet turned
  checklist: commit-ordered-effects dismissed: marking the item turned issues no external effect
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it, so no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read, so one retries and finds it turned
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
- a level up earns its three hoggies as items: Recording a level up earns its member three hoggie items keyed by the level's slots `level:{level}:1`, `:2` and `:3`, the third with a rare floor, each with reason `levelUp` naming the level and shown on the item board with that level, once per member, source and key, whatever `hidden-items` says; while `hidden-items` is on the level up drops nothing, and while it is off the old drop stands and marks the item of each crate it dropped turned, so a member whose flag turns on finds only the level items they have not seen.
  over: a kudos in Slack that takes its giver to level 2 with hidden-items on, read through the stored items, getAlbum's board, the drop records and getAlbumHoggies; level ups at 2 and 3 with 3 replayed; the same kudos with hidden-items off, and with hidden-items and level-up-reveal off, read on the board once hidden-items turns on
  via: LP6 LP7: a level up earns its three hoggies as items
  refuted: earnLevelUpItems no longer gave the third item its rare floor -> 1 of 4 tests failed: the giver's stored level:2:3 item had no floor (2026-10-21)
  refuted: the old level-up drop no longer marked its items turned -> 1 of 4 tests failed: with hidden-items off, the three dropped items still waited on the board once it turned on (2026-10-21)
  because: a level up's three hoggies are a reward the member has not seen until they turn it (LP7, LP32), so a level up that dropped them while the board is on would show the same reward twice, one that earned no items would leave the level's hoggies off the board, and an item left waiting after the old drop showed its hoggie would draw it a second time once the flag turns on (LP6)
  kinds: storage, state
  checklist: scoped-reads dismissed: the items are the member's own, written for the member the level up names
  checklist: revalidated-permission dismissed: nothing is queued; hidden-items and level-up-reveal are read in the mutation that records the level up
  checklist: encrypted-storage dismissed: items are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: levelReached is checked by its event validator at the subscriber's boundary, and the item by the items table's validator
  checklist: revision-preservation dismissed: an item is never revised; only its turnedAt is set, once
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as an item is earned once per member, source and key
  checklist: supersession-safety dismissed: a level up is recorded once per member and level, its items are earned in that mutation, and a replay finds the record and writes nothing
  checklist: worker-fencing dismissed: no worker owns a level up; Convex serializes the mutations that touch one member's level-up rows
  checklist: commit-ordered-effects dismissed: earning an item issues no external effect
  checklist: durable-dispatch-intent dismissed: the items are earned in the level up's own mutation, so they commit with it or not at all
  checklist: resumption-coverage dismissed: no batch earns them, and turning hidden-items on runs no backfill
  checklist: declared-target-coverage dismissed: makeReady is the only caller, reached by the oracle through a kudos at the Slack boundary and through levelReached
  checklist: completion-evidence dismissed: nothing waits on the earn; the board reads the stored items
- a level item is drawn at its turn above its floor and pays nothing: Turning a level item draws its hoggie from its own crate at the turn, the third never below rare, answers nothing applied, leaves the member's XP and level as they were and takes the item off the board.
  over: a member's level 3 items turned one by one through turnItem with album, collection, packs and hidden-items on, read through the answers, the draw for each crate key and floor, getAlbum's level and board; the third item of each level up from 2 to 21, turned
  via: LP11 LP20: a level item is drawn at its turn, pays no XP, and the third never draws below rare
  refuted: the turn no longer handed the item's floor to dropFor -> 2 of 2 tests failed: the third item's turned hoggie was not the rare-floor draw, and level 10's third item turned below rare (2026-10-21)
  because: a level up's third hoggie was promised rare or rarer (LP7), so a turn that dropped the floor would hand out a common one, and a turn that paid a pack bonus would add XP that could level the member up again from inside their own level up
  kinds: state
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the same mutation that turns it
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as a turn draws the hoggie and pays once
  checklist: supersession-safety dismissed: turnedAt is set once and never moved
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read
  checklist: commit-ordered-effects dismissed: itemTurned is published in the turn's mutation, and the bus schedules its subscribers only when that mutation commits
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
- the welcome item is earned once, at the first sign-in: A member's first sign-in earns them exactly one welcome item, a hoggie item keyed `welcome:first` with a rare floor and reason `welcome`, while `welcome-item` and `hidden-items` are both on for them; a person the directory does not know yet earns it when users.info verifies the check their first sign-in started, also at a later sign-in's check after every try of that one failed, since they never saw the album as a member; a later sign-in earns nothing more, a member who signed in before the flag earns none, and with either flag off the first sign-in earns nothing.
  over: a team_join member's first sign-in and a second sign-in on the account it made, read on the board and in the items table; a newcomer's first sign-in verified by users.info, then signing in again; a newcomer whose first sign-in's checks all failed, verified at a later sign-in; a sign-in with welcome-item off followed by one on the same account once it is on; a first sign-in with welcome-item off and one with hidden-items off
  via: LP44 LP50: a member's first sign-in earns one welcome item
  because: the welcome item is the newcomer's first reward (LP44): a second earn would hand a returning member another rare hoggie, an earn for a member who signed in before the flag would surprise everyone who already uses the website, and an earn while either flag is off would leave a dark feature's item waiting (LP50)
  refuted: earnWelcomeItem no longer read welcome-item and hidden-items before earning -> 3 of 4 tests failed: the member who signed in before the flag, and the first sign-ins with welcome-item off and with hidden-items off, each earned a welcome item (2026-10-21)
  refuted: a verification that found the member never earned the welcome item, whether or not it came from their first sign-in -> 1 of 6 tests failed: a person the directory learnt of only by verifying their first sign-in earned no welcome item (2026-10-21)
  refuted: a verification whose tries all failed cleared the first-sign-in mark -> 1 of 6 tests failed: a newcomer whose first sign-in's checks all failed earned no welcome item when a later sign-in verified them (2026-10-21)
  kinds: storage, state, identity
  checklist: scoped-reads dismissed: the earn reads only the signing-in member's own item of that key
  checklist: revalidated-permission dismissed: both flags are read in the sign-in's own mutation
  checklist: encrypted-storage dismissed: items are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the earn takes only the member the directory resolved from the sign-in claims, checked by allowedSignIn
  checklist: revision-preservation dismissed: the item is inserted once and only its turnedAt is set, once
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as an item is earned once per member, source and key
  checklist: supersession-safety dismissed: a second earn finds the first by its member, source and key and writes nothing
  checklist: worker-fencing dismissed: no worker owns the item; two sign-ins conflict on the range they both read, so one retries and finds the other's
  checklist: commit-ordered-effects dismissed: earning the item issues no external effect
  checklist: durable-dispatch-intent dismissed: the item is earned in the sign-in's own mutation, beside the account it creates, so it commits with it or not at all; for a newcomer the first sign-in leaves a firstSignIns row beside its verification row, and the mutation that records the verified lookup earns the item and deletes both together; the mark lives in its own table so a revert's schema still reads every verification row
  checklist: resumption-coverage dismissed: no batch operation resumes; each sign-in is one mutation
  checklist: declared-target-coverage dismissed: the sign-in callback is the only writer in this slice; the welcome nudge joins it in a later slice through the same earnWelcomeItem
  checklist: completion-evidence dismissed: nothing waits on the earn; the board reads the stored item
  checklist: canonical-encoding dismissed: the member is the directory's, keyed by Slack's workspace and user ids exactly as the sign-in claims carry them
  checklist: identity-continuity dismissed: the first sign-in is the one Convex Auth links to no account; every later sign-in of the same Slack pair links to that account
  checklist: capability-authorization dismissed: no capability is presented; the callback runs only inside Convex Auth's sign-in
- the welcome item turns at least rare and teaches the loop once: The first turn of the welcome item draws its hoggie at or above rare, pays no XP, and answers the workspace's kudos emoji for the line that teaches the loop only while `welcome-item` is still on; a replayed turn and the turn of any other item answer no lesson.
  over: a first sign-in's welcome item turned through turnItem with every album flag on, read beside the rare-floored draw for its crate key and the member's XP; the same item turned again, then a thanks item's turn; the welcome item turned after welcome-item turned off
  via: LP11 LP44 LP49: the welcome item turns at least rare, pays no XP and teaches the loop once
  because: the welcome item is promised rare (LP44, LP46), so a turn that drew below the floor would break the nudge's one spoiler, a turn that paid XP would reward signing in rather than thanking (LP11), and a lesson on every turn would turn one sentence into a tutorial (LP49)
  refuted: lessonAfter taught the loop on a replayed turn too -> 1 of 3 tests failed: the replayed turn of the welcome item answered teaches (2026-10-21)
  refuted: earnWelcomeItem earned the welcome item without its rare floor -> 1 of 3 tests failed: the turn's hoggie was not the rare-floored draw for its crate key (2026-10-21)
  kinds: state, output
  checklist: revalidated-permission dismissed: the flags, the session and the item's owner are read in the turn's own mutation
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as a turn draws the hoggie and pays once
  checklist: supersession-safety dismissed: turnedAt is set once and never moved
  checklist: worker-fencing dismissed: no worker owns an item; two turns of one item conflict on the row they both read
  checklist: commit-ordered-effects dismissed: the lesson is part of the answer and issues no effect
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
  checklist: scoped-reads dismissed: the lesson reads only the signed-in member's own item and their workspace's settings
  checklist: destination-confinement dismissed: the answer goes only to the signed-in browser that asked
  checklist: redaction dismissed: the lesson carries only the workspace's kudos emoji and its picture, which every member already sees in Slack
  checklist: circuit-breaker-policy dismissed: nothing is sent
  checklist: declared-target-coverage dismissed: turnItem is the only turn
- the old flow refuses while hidden-items is on: While `hidden-items` is on for the member, the website's openThoughtfulPack, putIn and putAllIn answer refused and write nothing, and once it is off each opens and puts in as today.
  over: two thoughtful packs, one opened into the tray with hidden-items off, then the other's open, the tray item's put-in and put-all-in with it on, read through every table, and each again once it is off
  via: LP23: with hidden-items on, the open, put-in and put-all-in refuse and write nothing
  refuted: keepsTheTray read only album, never hidden-items, before the open, put-in and put-all-in -> 1 of 1 tests failed: with hidden-items on the open answered opened instead of refused (2026-10-21)
  because: the item board is the one place a thanks's reward shows while the flag is on (LP23): an open beside it would draw a hoggie outside the turn and show it face up, and a put-in would land a face no turn brought
  kinds: state
  checklist: revalidated-permission dismissed: the flags and the session are read in the mutation that opens or puts in, so no permission is carried from an earlier check
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as the old flow refuses while hidden-items is on
  checklist: supersession-safety dismissed: a refusal writes nothing, so nothing it leaves can displace a later write
  checklist: worker-fencing dismissed: no worker owns a pack or a tray item; each command is one mutation
  checklist: commit-ordered-effects dismissed: a refusal issues no effect
  checklist: resumption-coverage dismissed: no batch operation resumes; each command is one mutation
- a tray item waits face down and its turn is the put-in: A tray item not yet put in waits on the item board for thanking its person, and its turn puts it in from the tray: the sticker puts the person in, the hoggie is found from the drop the open recorded with nothing applied, no drop is added, the member's XP stays and the tray empties; a tray item put in while the flag is off no longer waits once it is on.
  over: one thoughtful kudos opened into the tray with hidden-items off, read on the board once it is on, both items turned through turnItem, then read through getAlbum's level, board and people, getAlbumHoggies, the drop records and the tray once the flag is off again; a tray put all in with the flag off, read on the board once it is on
  via: LP23: a tray item not yet put in waits face down, and its turn finishes today's put-in
  refuted: the turn of a tray hoggie item answered its drop without putting its tray item in -> 1 of 2 tests failed: getAlbumHoggies found no hoggie after the tray hoggie's turn instead of the tray's (2026-10-21)
  refuted: the old put-in of a tray hoggie no longer marked its tray item turned -> 1 of 2 tests failed: a tray hoggie put in with hidden-items off still waited on the board once it turned on (2026-10-21)
  because: a tray item is a reward the member has not put in (LP23): one that waited nowhere would be lost while the tray is hidden, a turn that drew again would draw a second hoggie for one pack, and a turn that applied the pack's bonus again would pay the open's XP twice
  kinds: state
  checklist: revalidated-permission dismissed: the flags, the session and the item's and tray item's owner are read in the turn's own mutation
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as a tray item waits face down and its turn is the put-in
  checklist: supersession-safety dismissed: the turn finishes only a tray item not yet put in, and the put-in marks its item turned, so neither moves the other once done
  checklist: worker-fencing dismissed: no worker owns an item; a turn and a put-in of one tray item conflict on the row they both read, so one retries and finds it put in
  checklist: commit-ordered-effects dismissed: the put-in and the turn issue no external effect beyond the bus events they publish in their mutation
  checklist: resumption-coverage dismissed: no batch operation resumes; each turn is one mutation
- a flag reversal never counts anything twice: A pack whose items all turned while `hidden-items` is on is opened by its last turn, so with the flag off it no longer waits, and its hoggie is found once and paid once; a pack whose hoggie turned with the flag on opens into only its sticker once it is off, and the hoggie is found once; a tray hoggie turned with the flag on leaves only its sticker in the tray once it is off.
  over: one thoughtful kudos whose two items turn with hidden-items on, then read and put all in with it off, through getAlbum's packs, the week tallies' hoggies found, the hoggie tallies and getAlbum's level; one thoughtful kudos whose hoggie alone turns with the flag on, then its pack opened and put all in with it off; one pack opened with the flag off, its tray hoggie turned with it on, then the tray read and put all in with it off
  via: LP23: a flag reversal never counts anything twice
  refuted: the old open put a pack's hoggie in the tray even when its item had turned -> 2 of 3 tests failed: a pack whose items all turned still waited, and a pack whose hoggie turned opened into its hoggie again (2026-10-21)
  refuted: the turn no longer opened a pack once its last item turned -> 1 of 3 tests failed: the pack still waited to open into nothing once the flag was off (2026-10-21)
  because: the flag can go either way while it is sandbox-only (LP6, LP23): an open that put a turned hoggie in the tray would count its find a second time at the put-in, and its sticker would wait to be put in twice
  kinds: state
  checklist: revalidated-permission dismissed: the open reads the items' turnedAt in its own mutation
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as a flag reversal never counts anything twice
  checklist: supersession-safety dismissed: turnedAt and the pack's openedAt are each set once and never moved, so a later open reads what the turn left
  checklist: worker-fencing dismissed: no worker owns an item; an open and a turn of one pack's items conflict on the rows they both read
  checklist: commit-ordered-effects dismissed: no external effect is issued twice; each find publishes once, in the mutation that counts it
  checklist: resumption-coverage dismissed: no batch operation resumes; each open and turn is one mutation
- fillItems earns every waiting pack and tray item once: fillItems earns each pack a member has not opened its hoggie and sticker items and each tray item not yet put in its item, once, so they wait on the board and turn; a rerun earns nothing; a member with more than 100 of a kind continues in the next mutation, one member a mutation.
  over: two thoughtful packs, one opened into the tray, whose items predate the ledger, filled twice and read through the items table and the board, each turned; 101 packs and 101 tray items for one member and one of each for another, under Convex's transaction limits, read after the first mutation and after every scheduled one
  via: LP24: fillItems earns every pack not yet opened and every tray item not yet put in, once
  refuted: fillItems moved on after each kind's first page, never continuing from its cursor -> 1 of 2 tests failed: the member with 101 packs and 101 tray items held 200 items instead of 202 (2026-10-21)
  because: packs and tray items from before the ledger are rewards no board would show once the flag turns on (LP24): a fill that earned them twice would put one hoggie on the board twice, and one that read every pack of a member in one mutation would fail Convex's limits for the members who saved the most
  kinds: storage, state
  checklist: scoped-reads dismissed: the fill reads each member's own packs and tray by an equality on the member
  checklist: revalidated-permission dismissed: the fill runs by hand as an internal mutation and needs no member's permission
  checklist: encrypted-storage dismissed: items are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: fillItems takes only its own step, checked by its validator
  checklist: revision-preservation dismissed: the fill only inserts items it finds missing and deletes and patches nothing
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as an item is earned once per member, source and key
  checklist: supersession-safety dismissed: an earn that a grant, an open or an earlier fill already made finds that item and writes nothing
  checklist: worker-fencing dismissed: the fill and a grant or open earning the same item conflict on the range they both read, so one retries and finds the other's
  checklist: commit-ordered-effects dismissed: the fill issues no external effect
  checklist: durable-dispatch-intent dismissed: each step schedules the next in its own mutation, so the walk continues exactly when the step commits
  checklist: resumption-coverage declared as fillItems earns every waiting pack and tray item once
  checklist: declared-target-coverage dismissed: fillItems is run by hand and is the only backfill, reached by the oracle as the internal mutation
  checklist: completion-evidence dismissed: the walk ends when no member follows; the board reads the stored items
- a shared win posts one card into the weekly-post channel: While `hidden-items` and `item-share` are on for the member and the workspace has a weekly-post channel, the press of Share on a win the member turned posts exactly one card into that channel: the winner and the thanked person in bold, the quoted thanks only for a public kudos, ` reached level N` for a level-up hoggie and the find alone for the welcome item, then the legendary or epic find or the completed team page, the hoggie's art or the team's crest, and an Open HedgeHug link, never a colleague's face; once pressed the win is offered on no device and a second press, from any session, refuses and posts nothing.
  over: a public thanks turned legendary, pressed and read through getAlbum in two sessions, pressed again from both; a private-channel thanks turned epic; the sticker that completes a team page beside the page's earlier sticker; a level-up hoggie and the welcome item, each turned and pressed through the signed-in website and read in the fake Slack's posts
  via: LP51 LP53 LP54: Share posts a turned win into the weekly-post channel, the thanks first
  refuted: shareWin no longer refused a win already shared -> 1 of 5 tests failed: a second press of the shared win answered shared instead of refused (2026-10-21)
  because: LP51 lets a member show a rare find or a finished team page to the workspace at the moment it lands, and LP53 and LP54 make the card say who thanked whom first, so a post that repeated, quoted a private kudos or showed a colleague's face would spam the channel or leak what was not public
  kinds: message, output, state
  checklist: destination-confinement dismissed: a card goes only to the weekly-post channel, the public channel the maintainer picked or else the announcement channel, and quotes a kudos only when it was posted in a public channel
  checklist: message-authenticity dismissed: the press arrives through the website's memberMutation guard, which resolves the signed-in member from the session; the card follows only kudos the Slack adapter verified by their signed Slack requests
  checklist: redaction dismissed: the card names only the winner, the thanked person, a public quote, a hoggie's catalogue name and rarity or a team's name and crest, never a face or an item still face down
  checklist: input-validation dismissed: shareItem takes only an item ID, checked by its validator and matched to the signed-in member's own win
  checklist: retry-recognition dismissed: sharedAt is set before the post is scheduled, and each delivery attempt is sent once
  checklist: duplicate-suppression declared as a shared win posts one card into the weekly-post channel
  checklist: keyed-ordering dismissed: one card per win, with no order promised between wins
  checklist: acknowledgment-barrier dismissed: nothing waits on Slack's answer; the win stays shared whatever Slack answers
  checklist: commit-ordered-effects dismissed: the card is posted by an action scheduled from the mutation that sets sharedAt, so it runs only after that commit
  checklist: retry-classification dismissed: the delivery retries only a rate-limited send, at most three times, resends once without the picture when Slack refuses the blocks, and gives up on a lost answer rather than risk a second card
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack delivery
  checklist: declared-target-coverage dismissed: a card has exactly one target, the weekly-post channel
  checklist: revalidated-permission dismissed: the flags, the channel and the win's owner are read in the press's own mutation, and read again by shareCardOf before the card is posted
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession dismissed: a win moves once, from unshared to shared, in the press's mutation, and never back
  checklist: supersession-safety dismissed: no late write displaces a share; two presses read the same row, so one commits and the other retries and finds it shared
  checklist: worker-fencing dismissed: no worker owns a win; concurrent presses conflict on the row they both read
  checklist: resumption-coverage dismissed: one card per press, scheduled in the press's mutation; a rate-limited send reschedules itself with its attempt count
- Share is offered only for its owner's win and only with a weekly-post channel: getAlbum offers Share only for a turned hoggie drawn epic or legendary or a sticker that completed a team page, only to the member who turned it and only while the workspace has a weekly-post channel; a rare find, a sticker that completes no page and a replayed turn offer nothing, and another member's press of a win, or any press without the channel, refuses and posts nothing.
  over: a rare find, a sticker that completes no page and a replayed turn read through getAlbum, another member pressing a win; a legendary find in a workspace without a weekly-post channel, pressed, then the same win once the workspace has one
  via: LP51 LP52: Share is offered only for a win, only to its owner and only with a weekly-post channel
  refuted: shareWin no longer checked that the win is the signed-in member's own -> 1 of 2 tests failed: another member's press of the win answered shared instead of refused (2026-10-21)
  because: an item ID reaches the browser, so a press that accepted another member's item would post their win in their name, and Share offered for every turn or with nowhere to post would nag the member and post what LP52 does not count as a win
  crossing: browser -> domain
  entrances: mutation shareItem
  kinds: identity, state
  checklist: capability-authorization dismissed: the session token authorizes only acting as the signed-in member, rechecked by the website's memberMutation guard on every call; the item ID grants nothing by itself
  checklist: revalidated-permission dismissed: the flags, the channel, the session and the win's owner are read in the same mutation that shares it
  checklist: canonical-encoding dismissed: the item is named by its Convex document ID, compared as the validator parsed it, and its owner by the member ID the session resolved
  checklist: identity-continuity dismissed: a win belongs to the member who turned it for its whole life; a press by anyone else is refused
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession dismissed: a refusal moves no state; a share moves sharedAt once from unset
  checklist: supersession-safety dismissed: a refused press writes nothing, so nothing it could displace
  checklist: worker-fencing dismissed: no worker owns a win; the owner is checked in the press's mutation
  checklist: commit-ordered-effects dismissed: a refused press schedules nothing; an accepted one schedules its card in its own mutation
  checklist: resumption-coverage dismissed: a press is a single mutation; nothing resumes
- the share is dark unless item-share and hidden-items are on for the member: With `item-share` off, absent from PostHog or on only for another member's email, getAlbum offers no Share for a legendary find, the press refuses and nothing is posted, and once `item-share` is on the same win is offered, because the win is recorded whatever the flag answers (a recorder never reads a flag); a win turned while `hidden-items` was on is neither offered nor shared once it is off for the member.
  over: a legendary find turned and pressed in three item-share off states, then read with item-share on; a legendary find turned with every flag on, then pressed and read with hidden-items off for the member
  via: LP56: the share is behind item-share, and needs hidden-items on for the member
  refuted: the sharing channel no longer read hidden-items for the member -> 1 of 4 tests failed: getAlbum still offered shares once hidden-items was off for the member (2026-10-21)
  refuted: the sharing channel no longer read item-share for the member -> 3 of 4 tests failed: each item-share off state offered Share for the legendary find (2026-10-21)
  because: LP56 ships the share dark behind its flag, and the share has no sense without the hidden items it follows: a win recorded or offered with either off would show a dark feature or post into a workspace that never opted in
  kinds: state, output
  checklist: destination-confinement dismissed: with either flag off nothing is posted
  checklist: redaction dismissed: with either flag off nothing is answered or posted
  checklist: commit-ordered-effects dismissed: with either flag off nothing is scheduled
  checklist: circuit-breaker-policy dismissed: no breaker is declared for Slack delivery
  checklist: declared-target-coverage dismissed: the flags gate the one recorder, the one read and the one press of the share
  checklist: legal-state-succession dismissed: with either flag off nothing moves
  checklist: revalidated-permission dismissed: both flags are read in the turn, the read and the press, and again by shareCardOf before the card is posted
  checklist: separation-of-duties dismissed: no approval policy
  checklist: supersession-safety dismissed: with either flag off nothing is written that a later write could displace
  checklist: worker-fencing dismissed: no worker owns a win
  checklist: resumption-coverage dismissed: with either flag off nothing is scheduled to resume
