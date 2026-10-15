# Proof: the climb on the open, and +N XP waiting (#450)

Map #1's crate rewards (#477) make a quest's reward count when its crate opens, and `openQuestCrate` answers `applied: { xp, coins, from, to } | null` from the stored opening. This builds on #452's loot-box reveal: a flight now carries the answer's `applied`, the HUD pins at `from` per kind (level ring, skill point chip, coins chip) until that token lands and then shows the live value, a crossed level turns over once with #413's celebration, and `applied: null` keeps the burst but flies as a rehearsal with no hold and no count. Quest cards, the bonus card, the home's quest rows, earlier weeks' crates and a finished Journey step say `+N XP waiting` while `waiting` is true.

## Tests

- `red.txt`: `crateClimb.test.tsx` on `main` before the change: 4 of 10 failing. The across-level and within-level climbs pass on `main` because #452's arithmetic hold happens to produce the same numbers; the stored-answer climb (the read already past `to`), the no-climb reveal and both `waiting` rows are red.
- `green.txt`: 10 of 10 after.
- #413's climb on return skips `waiting` entries: `climbOnReturn.test.tsx` "never flies a quest's XP that waits in an unopened crate" (since #477).
- `gate.txt`: `~/dev/fleet/fleet heavy -- pnpm gate` on the merged tree.

## Running app

The loot-crate fixture (`website/proof/loot-crates/fixture/`) gained `?applied=across|within|null` on the open's answer and `?waiting=1` on the finished slots and earlier weeks' crates. Driven in T3's preview browser at 1280×800, light.

- `1-waiting-rows-light.png`: `/quests` with `+20 XP waiting` on the finished card and the earlier week's crate, and plain `+20 XP` on the in-progress and claimed cards.
- `2-climb-across-level-6-light.mp4` and `2-climb-finish-level-6-light.png`: `applied` from level 5 (990 XP, 1 skill point, 226 coins) to level 6 (1,010 XP, 2, 236) on a read already at level 6: the HUD holds level 5, 1 and 226 from the answer, `+20 XP` lands and the ring turns over to level 6 with the celebration, `+1 skill point` and `+10 coins` land and count up, and the finish lists the three chips.
- `3-no-climb-samples.json`: `applied: null`, sampled from inside the page every few hundred ms through one reveal: the crate charges, bursts `+20 XP` and `+10 coins`, flies both, and the HUD reads level 6, 2 and 236 from the first sample to the last with no fill or levelling class on the frame.

## Calls

- `applied: null` keeps the loot-box burst and flies the tokens as a rehearsal (no hold, no fill, no count), rather than ending on a motionless finish, so flag-off members keep the moment the product owner asked for while the header stays honest.
- The finished Journey step on the home says `+N XP waiting` beside the four places the ticket names, since the step carries `waiting` and the line is the step's promised pay, not the crate's surprise.
- The hold pins at the first unlanded flight's `from` per kind; feature crates (no `applied`) keep #452's arithmetic hold for the Skill tree's points.
