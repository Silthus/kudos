# Items

Items: every reward a member has not seen (LP2, `spec/core-loop.md` on `spec/core-loop`), so far the hoggie of a thoughtful pack, earned by its giver for thanking the pack's person, and a level up's three hoggies (LP7). It owns the items `{ workspace, member, source, key, reason, earnedAt, turnedAt? }` (LP4), unique per member, source and key: `earnItem`, called in the mutation that earns the reward, writes one and answers the first for a second earn, changing nothing, whatever `hidden-items` says (LP5, LP6); the grant of a thoughtful pack earns its giver the pack's hoggie with source `hoggie`, the pack's crate key `thoughtful:{pack ID}` and reason `thanks` naming the thanked person and the message; recording a level up earns its member three hoggie items keyed `level:{level}:1`, `:2` and `:3`, the third with `floor` `rare`, each with reason `levelUp` naming the level, whatever `hidden-items`, `level-up-reveal` or `collection` says, and while `hidden-items` is on for the member the level up drops nothing (LP7). `turnedAt` is set once, by the turn or by `markTurned`, which the album's old open of a thoughtful pack and the old level-up drop, for each crate that dropped, call in their own mutation, so a member whose flag turns on finds only what they have not seen, and it never moves (LP5, LP6). The `hidden-items` flag is a member decision off by default, read without exposure and without writing by `hiddenItemsShownTo`. The item board's read, `boardOf`, reads one index range of the member's items not yet turned, oldest earned first, at most 100 with `more`, each face down as its ID, when it was earned and its reason, never its source, key, face or rarity (LP8, LP9); the website's `getAlbum` answers it while `hidden-items` is on, with the thanked person's name and face. The turn, `turn`, run by the website's `turnItem` while `album`, `hidden-items` and `collection` are on for the member, takes one of the member's own items not yet turned and, in one mutation, draws its hoggie through `dropFor` with surface `website` and the item's floor, so a level up's third item never draws below rare, found at once and never waiting in the tray, so the draw stays a pure function of the secret, the member, the crate key and the catalogue version (LP11); counts the find in the album's tallies, records the milestones it completes, marks the item turned and publishes `itemTurned` with its source, the drawn rarity and whether it is new (LP16); and answers the face, the pack bonus the drop paid, 15 XP and no coins while `packs` is on, the page it lands on, `hoggies`, and `again` false (LP10). A turned item answers its found face again with `again` true and nothing applied, writing nothing (LP12); another member's item, a missing one, and a drop that does not land answer nothing. Only this module writes items.

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
