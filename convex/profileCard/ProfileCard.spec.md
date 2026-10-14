# Profile card

The profile card: one member's name, level and best four medals, computed live by profileCardOf from current state each time it is shown and never stored (PC6–PC10, G28–G30). It reads the directory's display name, else "A teammate"; the member's level while `xp-levels` is on in the workspace decision; and, while the Book applies and its launch is recorded, the predicate `achievementsOf` shares, each ladder's highest earned tier, held-back tiers included, sorted diamond, gold, silver, bronze with ties in the ladder catalogue's order, the first four kept. It follows what has shipped, never the viewer's or the member's unlocks, except that a member's own card has no medals until they have opened the Book (P76). It only reads, through the other modules' exported functions, so a query and a mutation both call it, and reading it never records a workspace launch, a preview moment or an exposure. The `profile-card` flag, safe default off, decides whether `/hedgehug @member` shows it: the member decision with its exposure for a person the directory knows as a member, the workspace decision otherwise.

## invariants
- a profile card shows only name, level and medals: A profile card shows the member's name, their level and at most four medals with their tier names, and nothing else: no XP, coins, perks, skill points, kudos counts, quests, stickers or streak.
  over: the whole reply `/hedgehug @member` answers for a member with XP and tiers on five ladders, for one who earned nothing, for a mention carrying Slack's label, and with `xp-levels` off
  via: PC1 PC5 PC7 PC8: /hedgehug @member answers that member's profile card
  because: any member can look up any teammate (PC1), so the card is public; only what is public by design may show (G28, P65, P66), and a card that let XP, coins or kudos counts through would publish what each member was promised stays theirs
  refuted: bestMedalsOf kept the best five medals instead of four -> the five-ladder test failed on its reply, a fifth medal on the card (2026-10-14)
  kinds: read, output
  checklist: scoped-reads dismissed: the mentioned person is looked up in the command's own workspace only, so another workspace's person is never found and gets the not-a-member line; every field the card shows is public by design to that workspace
  checklist: redaction declared as a profile card shows only name, level and medals
  checklist: destination-confinement dismissed: the card goes back only in the command's HTTP response or to the response_url Slack signed into the command; no destination is taken from anywhere else or followed
  checklist: commit-ordered-effects dismissed: computing a card issues no external effect; the reply is sent after the mutation that computed it commits
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: the card is sent to one viewer; nothing fans out
- a card follows what has shipped, except an own card's medals wait for the Book: A profile card's level shows while `xp-levels` is on in the workspace decision and its medals while the Book applies and is launched there, whatever the viewer's or the member's unlocks, except that a member's own card shows no medals until they have opened the Book; reading a card launches nothing.
  over: own and teammate cards before and after the member opened the Book, an opened own card whose member's own achievements decision is off, a teammate's card neither member unlocked, tiers earned while notices were held back, `achievements` off, `achievements` just turned on with no Book launch recorded, and `xp-levels` off
  via: PC9: a card follows what has shipped, except an own card's medals wait for the Book
  because: every viewer must see the same card of a teammate (P76, PC9), and P76 keeps a member's own progress about a feature silent until they open it; a card that launched the Book would ship it to the workspace from a read
  refuted: medalsShownIn waited for the member's own Book opening on every card, a teammate's included -> 2 of 6 tests failed, a teammate's card without the medals they earned (2026-10-14)
  refuted: medalsShownIn read the member's Book opening through Unlocks' stateOf, which follows the member's own achievements decision -> the own card opened while the Book applied lost its medals once that decision turned off (2026-10-14)
  kinds: read
  checklist: scoped-reads dismissed: the card reads one member's tiers, level and Book opening, named by the mention in the command's own workspace; the flags it reads are that workspace's decisions
  checklist: redaction declared as a profile card shows only name, level and medals
- a mention answers today's command while profile-card is off: While `profile-card` is off for the person typing it, `/hedgehug` with text led by a mention answers byte for byte what `/hedgehug` answers: it joins the channel, answers today's join line, and looks up no mentioned person.
  over: `/hedgehug` with one person mention, two mentions, an unknown person and a bot, with the flag off, compared with `/hedgehug` alone by HTTP response and Slack calls
  via: PC11 PC17: the profile-card flag
  because: production is live (decision 18); a flag that is off must change nothing a member sees until it is widened (PC11, PC17)
  refuted: isProfileCardShownTo answered true without reading the profile-card flag -> 6 of 7 tests failed, the flag-off commands answering a card or the usage line instead of joining (2026-10-14)
  kinds: output
  checklist: destination-confinement dismissed: the join path answers only the response_url Slack signed into the command, as it does today
  checklist: redaction dismissed: with the flag off no card is computed, so nothing about the mentioned person is read or sent
  checklist: commit-ordered-effects dismissed: the join is today's scheduled action; the flag decision commits before it is scheduled
  checklist: circuit-breaker-policy dismissed: no failure history diverts or suppresses a call
  checklist: declared-target-coverage dismissed: the reply goes to one viewer; nothing fans out
