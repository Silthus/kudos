# Catalogue and visual cases

These names and illustrations are fictional prototype cases, not production catalogue or prices. Each named case below is inventoried independently; outcome refers to the web surface, not backend availability. The main element table covers each case's shared art, source, owned/locked/equipped and action states.

## Hedgehog shelf

[Prototype source](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/hedgehogs.ts).

| ID | Visible name | Art/glyph | Outcome | Next |
|---|---|---|---|---|
| `hog-sitting` | Sunday Hog | `HedgehogSitting` | **missing** | F7 |
| `hog-superhero` | Super Hog | `HedgehogSuperhero` | **missing** | F7 |
| `hog-level-up` | 1-Up Hog | `HedgehogLevelUp` | **missing** | F7 |
| `hog-explorer` | Explorer | `HedgehogExplorer` | **missing** | F7 |
| `hog-reading` | Bookworm | `HedgehogReading` | **missing** | F7 |
| `hog-gardener` | Gardener | `HedgehogGardener` | **missing** | F7 |
| `hog-chef` | Chef | `HedgehogChef` | **missing** | F7 |
| `hog-dj` | DJ Hog | `HedgehogDj` | **missing** | F7 |
| `hog-rocket` | Rocket Hog | `HedgehogRocket` | **missing** | F7 |
| `hog-wizard` | Wizard | `HedgehogWizard` | **missing** | F7 |
| `hog-gladiator` | Gladiator | `HedgehogGladiator` | **missing** | F7 |
| `hog-angel` | Angel | `HedgehogAngel` | **missing** | F7 |

## Emoji inventory

[Prototype source](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-items.ts).

| ID | Visible name | Art/glyph | Outcome | Next |
|---|---|---|---|---|
| `emoji-hog` | Hedgehog | `🦔` | **missing** | F6 |
| `emoji-raised-hands` | Raised hands | `🙌` | **missing** | F6 |
| `emoji-star` | Glowing star | `🌟` | **missing** | F6 |
| `emoji-butterfly` | Butterfly | `🦋` | **missing** | F6 |
| `emoji-fire` | Fire | `🔥` | **missing** | F6 |
| `emoji-party` | Party popper | `🎉` | **missing** | F6 |
| `emoji-crown` | Crown | `👑` | **missing** | F6 |
| `emoji-rocket` | Rocket | `🚀` | **missing** | F6 |
| `emoji-trophy` | Trophy | `🏆` | **missing** | F6 |

## Perk nodes

[Prototype source](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/skills-perks.ts).

| ID | Visible name | Art/glyph | Outcome | Next |
|---|---|---|---|---|
| `spark` | Spark | `PerkIcon from skills-icons.tsx` | **present** | Slice 4, not yet live; #193 |
| `rhythm` | Rhythm | `PerkIcon from skills-icons.tsx` | **present** | Slice 4, not yet live; #193 |
| `circle` | Circle | `PerkIcon from skills-icons.tsx` | **present** | Slice 4, not yet live; #193 |
| `flame` | Flame | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `cadence` | Cadence | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `bridge` | Bridge | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `treasurer` | Treasurer | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `focus` | Focus | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `echo` | Echo | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `reserve` | Reserve | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `banker` | Banker | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `spotlight` | Spotlight | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `resonance` | Resonance | `PerkIcon from skills-icons.tsx` | **missing** | F15 |
| `reservoir` | Reservoir | `PerkIcon from skills-icons.tsx` | **missing** | F15 |

## Achievement emblems

[book-emblems.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-emblems.tsx).

| Ladder ID | Hog art | Outcome | Next |
|---|---|---|---|
| `ladderArt` | `Record` | **missing** | F17/F18 |
| `generosity` | `HedgehogHeart` | **present** | Slice 4 emblem exists; metal rosette still F17 |
| `recognition` | `HedgehogStar` | **present** | Slice 4 emblem exists; metal rosette still F17 |
| `connections` | `HedgehogExplorer` | **present** | Slice 4 emblem exists; metal rosette still F17 |
| `dependability` | `HedgehogOrganized` | **present** | Slice 4 emblem exists; metal rosette still F17 |
| `applause` | `HedgehogSuccess` | **present** | Slice 4 emblem exists; metal rosette still F17 |
| `seasons` | `HedgehogHourglass` | **present** | Slice 4 emblem exists; metal rosette still F17 |
| `old-friends` | `HedgehogHandClasp` | **present** | Slice 4 emblem exists; metal rosette still F17 |
| `team-spirit` | `HedgehogPuzzle` | **missing** | F17/F18 |
| `crowd-favourite` | `HedgehogHooligan` | **missing** | F17/F18 |
| `standing-ovation` | `HedgehogScottPilgrim` | **missing** | F17/F18 |
| `amplifier` | `HedgehogMegaphone` | **missing** | F17/F18 |

## Book categories

| Category | Art | Outcome | Next |
|---|---|---|---|
| `categoryArt` | `Record` | **missing** | F16 |
| `giving` | `HedgehogMailbox` | **missing** | F16 |
| `thanked` | `HedgehogKatyPerry` | **missing** | F16 |
| `connections` | `HedgehogCodingGroup` | **missing** | F16 |
| `crowd` | `HedgehogParty` | **missing** | F16 |

Prototype albums use five fictional groups, each shown by the same AlbumSpread component: its group label/crest/photo, numbered roster, missing or collected stickers, completion stamp and privacy note are all missing from slice 4 and belong to F18. The two visible prototype weekly personal-quest kinds, chime-in/group quest and fresh-collection quest are covered by the individual quest-surface rows in the main inventory. The twelve alternate mock quest definitions are data scenarios, not twelve separate production design decisions.
