# Parser

Kudos parser: turns a chat message's countable content into a kudos message, with parse hooks deciding a giver's kudos emoji and adding annotations.

## invariants
- a kudos message gives as many kudos as its most repeated kudos emoji: A kudos message gives each recipient as many kudos as the kudos emoji it holds most often, whichever hook claims it, the workspace's kudos emoji, a store emoji the giver owns or an emoji they earned in the album: different kudos emojis in one message add nothing to each other, while each repeat of one emoji gives one more (R4 as amended).
  over: a kudos message holding the workspace's kudos emoji beside the giver's team emoji, the workspace's kudos emoji twice beside it, and the team emoji three times beside the workspace's kudos emoji, read through the recipient's kudos
  via: a message gives each recipient as many kudos as its most repeated kudos emoji
  because: one message is one thank-you, and since every earned album emoji counts as a kudos emoji (AL34 as amended by #746) a giver who adds their team emoji beside the workspace's would pay a teammate twice and spend twice the allowance for the same thanks; a repeat of one emoji is how a giver says more
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; the count is read in the mutation that decides the kudos
  checklist: separation-of-duties dismissed: no approval policy; a giver's own message decides what it gives
  checklist: legal-state-succession dismissed: the count writes nothing; the message's once-check decides whether it gives (a message gives kudos at most once)
  checklist: supersession-safety dismissed: the count writes nothing that a later write could displace
  checklist: worker-fencing dismissed: no worker owns the count; it runs inside the giving mutation
  checklist: commit-ordered-effects dismissed: the count issues no external effect
  checklist: resumption-coverage dismissed: no batch counts kudos emoji; a message waiting on the directory is counted again by the same parse when rechecked
