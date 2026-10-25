# #786 proof: unlocked emojis fly into the emoji button, and the button says New

Branch `feat/animate-unlocked-emojis` at `90c24865`. The walk ran on the Vite dev server against a local proof fixture. The fixture was not committed. It was a member just past level 10, holding the level-10 emoji unseen, a team one turn from unlocking, and a face-down sticker of a person whose hype emoji the turn unlocks.

## Tests

The rendered album shell, on fake time:

- `turnSequence.test.tsx`:
  - The team emoji springs out of the seal and lands in the emoji button. It is marked seen once, and no emoji dialog follows.
  - The top bar counts each emoji when it lands: the hype emoji first, then the team emoji.
- `milestoneBeat.test.tsx`: the medal's emoji springs out of the medal and lands.
- `xpMoment.test.tsx`:
  - The takeover's emoji hops and then flies. The top bar counts it back only when it lands.
  - Continue before it lands restores the count.
- `albumShell.test.tsx`:
  - The emoji button always shows its label.
  - New clears when the popup opens and stays cleared on the next visit.
  - A newcomer with no emojis sees no New.
  - New returns when a new emoji is earned.

Gate (`gate-90c24865.txt`): `pnpm gate` passed, with 338 test files and 5839 tests.

## Walk

- `fixture-takeover-then-turn.mp4`:
  - The level-up takeover. The level-10 emoji hops, and a copy flies to the button. The button count goes 12 → 11 → 12.
  - Then a sticker turn. The hype emoji springs from the sticker and the team emoji from its seal, each with its `:name:` caption. Each flies home, and no emoji dialog follows.
- `1-takeover-labelled-button-with-new.png`: the takeover beside the labelled `12 Emojis` button and its New label.
- `2-team-emoji-leaves-the-seal.png`: the team emoji in its spring-and-hold, above the seal that just unlocked.
- `3-new-label-390.png`: a 390 px phone. The label is hidden as designed, and the New label sits on the button's corner.
- Opening the popup cleared New. The opened ids stayed in `localStorage` under `hedgehug:emojis-opened:<member>`.
