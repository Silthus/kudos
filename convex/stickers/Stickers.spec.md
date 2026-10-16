# Stickers

Stickers: the people a member collects in the Book (SB1–SB6, decision 27): one sticker of each other member they gave a kudos award to or received one from, kept forever, also after that person leaves. It owns the insert-only sticker records `{ member, person, firstAward, firstAt }`, unique per member and person, where `firstAward` is the pair's earliest award in award order in either direction and `firstAt` its time; the `sticker-book` flag, a member decision off by default, read without exposure by `stickersShownTo`; the kudosGiven subscriber `recordStickers`, which records the stickers of at most 50 of a message's awards per mutation, each mutation scheduling the next, and starts the workspace's backfill when it has none; and the backfill, `startStickerBackfill` and its page `backfillStickers`, which pages one workspace's awards in award order, 50 per mutation, keeping its cursor in the workspace's backfill record and reading to the last award. Both writers go through `recordStickersOf`, which reads whether each of the pair's two stickers exists, and, for a missing one, the pair's earliest award in each direction through the engine's `earliestAwardFrom`, recording the earlier, so either can run first and run again. Stickers and the backfill are recorded whatever the flag says; nothing is told to anyone when a sticker is recorded. `stickersNewestFirst` answers one member's stickers, newest `firstAt` first, which the website's `getCollection` shows while `sticker-book` is on for the member, with each person's name and face as the directory has them now. Only this module writes sticker and backfill records.

## invariants
- a sticker is recorded once with its pair's earliest award: Every member holds at most one sticker of each person, and its `firstAward` and `firstAt` are the pair's earliest award in award order in either direction, however often and in whatever order the live subscriber and the backfill record it.
  over: a second kudos between the same two and a thanks back, two messages whose subscribers run in reverse order, a thanks back the other way recorded before the thanks it answers, one person named twice in a message, a redelivered kudosGiven and the backfill run twice, compared record for record, the backfill over earlier kudos, its start by the first kudos, and a kudos given between two of its pages with its own subscriber held back, read through getCollection and the stored firstAward
  via: a sticker is recorded once with its pair's earliest award
  because: a sticker says since when two people have thanked each other (SB2, user story 7): if a subscriber running late or a redelivery wrote a second sticker or a later award, the Book would count one colleague twice, show the wrong first time and mark an old sticker new again
  kinds: storage, state
  checklist: scoped-reads dismissed: the invariant is about what is written, not which records a read returns; the sticker book is private covers the read
  checklist: revalidated-permission dismissed: recording a sticker needs no permission; the awards it reads were decided when they were given
  checklist: encrypted-storage dismissed: sticker records are game data, not confidential
  checklist: key-rotation-compatibility dismissed: nothing is encrypted
  checklist: input-validation dismissed: the subscriber and the backfill take only internal arguments, checked by the kudosGiven validator and the workspace string
  checklist: revision-preservation dismissed: a sticker is never revised; it is inserted once and never changed
  checklist: separation-of-duties dismissed: no approval policy
  checklist: legal-state-succession declared as a sticker is recorded once with its pair's earliest award
  checklist: supersession-safety dismissed: no late write displaces a sticker; a write that finds the sticker writes nothing, and Convex retries a mutation whose read of the sticker changed before it committed
  checklist: worker-fencing dismissed: no worker owns a sticker; the subscriber and the backfill may run together because both read the earliest award before writing
  checklist: commit-ordered-effects dismissed: recording a sticker issues no external effect
  checklist: durable-dispatch-intent dismissed: the subscriber is scheduled in the giving mutation and each page schedules the next in its own mutation, so the work commits with its cause or not at all
  checklist: resumption-coverage declared as a sticker is recorded once with its pair's earliest award
  checklist: declared-target-coverage dismissed: the writers are recordStickers and backfillStickers, both reached by the oracle through recordStickersOf
  checklist: completion-evidence dismissed: nothing waits on a sticker; the backfill record's isDone says the backfill read to the last award
- the sticker book is private: A member's stickers are answered only to that member, who is taken from the website's guard, never from an argument.
  over: getCollection signed in as each of three members who hold stickers of one another, and the same call given another member's ID
  via: the sticker book is private
  because: the sticker book shows who a member has and hasn't thanked (SB10, user story 21): a read answering another member's stickers would show that member's gaps to anyone who asked
  kinds: read
  checklist: scoped-reads declared as the sticker book is private
  checklist: redaction dismissed: the read answers the member's own stickers whole or not at all; nothing inside a sticker is scrubbed
