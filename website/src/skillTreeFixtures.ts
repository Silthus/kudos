import type { SkillTreeRead } from "./skillTreeRead";
import type { MySkillTree, PerkNode, ShellState, SkillTreeAnswer, TreeRow } from "./shell";

const chatUrl = "https://app.slack.com/client/T1";

const sparkBoughtAt = Date.parse("2026-10-13T09:30:00Z");

const rhythmBoughtAt = Date.parse("2026-10-14T08:00:00Z");

const flameBoughtAt = Date.parse("2026-10-14T09:00:00Z");

const spark = { perk: "spark", name: "Spark", copy: "+5 XP the first time each day you thank someone and say why.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;

const rhythm = { perk: "rhythm", name: "Rhythm", copy: "+2 XP each time you thank someone and say why, once per person a day.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;

const circle = { perk: "circle", name: "Circle", copy: "+5 XP the first time each week you thank a person and say why.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;

const flame = { perk: "flame", name: "Flame", copy: "Spark gives +8 XP instead of +5.", cost: { skillPoints: 1, coins: 150 }, requires: "Spark", upgrades: "spark" } as const;

const cadence = { perk: "cadence", name: "Cadence", copy: "Rhythm gives +3 XP instead of +2.", cost: { skillPoints: 1, coins: 200 }, requires: "Rhythm", upgrades: "rhythm" } as const;

const bridge = {
  perk: "bridge",
  name: "Bridge",
  copy: "Circle gives +8 XP instead of +5 when the person isn't in your primary group. Without a primary group, everyone counts.",
  cost: { skillPoints: 1, coins: 150 },
  requires: "Circle",
  upgrades: "circle",
} as const;

const treasurer = { perk: "treasurer", name: "Treasurer", copy: "+2 🪙 each time you thank someone and say why, once per person a day.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;

const banker = { perk: "banker", name: "Banker", copy: "Treasurer gives +4 🪙 instead of +2.", cost: { skillPoints: 2, coins: 250 }, requires: "Treasurer", upgrades: "treasurer" } as const;

const available = { state: "available", reason: null, ownedAt: null } as const;

const owned = (ownedAt: number) => ({ state: "owned", reason: null, ownedAt }) as const;

const unavailable = (reason: NonNullable<PerkNode["reason"]>) => ({ state: "unavailable", reason, ownedAt: null }) as const;

function tree(skillPoints: number, ...perks: PerkNode[]): SkillTreeAnswer {
  return { kind: "tree", skillPoints, coins: null, rows: [{ level: 5, perks }], chatUrl };
}

function treeWithCoins(skillPoints: number, coins: number | null, rows: TreeRow[]): SkillTreeAnswer {
  return { kind: "tree", skillPoints, coins, rows, chatUrl };
}

export const skillTreeFixtures = {
  withPoints: tree(2, { ...spark, ...available }, { ...rhythm, ...available }, { ...circle, ...available }),
  withOnePoint: tree(1, { ...spark, ...available }, { ...rhythm, ...available }, { ...circle, ...available }),
  sparkOwned: tree(1, { ...spark, ...owned(sparkBoughtAt) }, { ...rhythm, ...available }, { ...circle, ...available }),
  noPointsLeft: tree(0, { ...spark, ...unavailable("points") }, { ...rhythm, ...owned(rhythmBoughtAt) }, { ...circle, ...owned(sparkBoughtAt) }),
  belowTheRow: tree(0, { ...spark, ...unavailable("level") }, { ...rhythm, ...unavailable("level") }, { ...circle, ...unavailable("level") }),
  needsABase: tree(1, { ...spark, ...available }, { ...rhythm, requires: "Spark", ...unavailable("requires") }, { ...circle, ...available }),
  upgradeAvailable: tree(1, { ...spark, ...available }, { ...rhythm, requires: "Spark", ...available }, { ...circle, ...available }),
  everyState: tree(1, { ...spark, ...owned(sparkBoughtAt) }, { ...rhythm, ...available }, { ...circle, requires: "Rhythm", ...unavailable("requires") }),
  costlyPerk: tree(3, { ...spark, cost: { skillPoints: 2, coins: 0 }, ...available }, { ...rhythm, ...available }, { ...circle, ...available }),
  everyRow: treeWithCoins(3, 180, [
    { level: 5, perks: [{ ...spark, ...owned(sparkBoughtAt) }, { ...rhythm, ...owned(rhythmBoughtAt) }, { ...circle, ...available }] },
    { level: 7, perks: [{ ...flame, ...owned(flameBoughtAt) }, { ...cadence, ...available }, { ...bridge, ...unavailable("requires") }, { ...treasurer, ...available }] },
    { level: 9, perks: [{ ...banker, ...unavailable("requires") }] },
  ]),
  upgradeForCoins: treeWithCoins(1, 150, [
    { level: 5, perks: [{ ...spark, ...owned(sparkBoughtAt) }, { ...rhythm, ...unavailable("points") }, { ...circle, ...unavailable("points") }] },
    { level: 7, perks: [{ ...flame, ...available }, { ...cadence, ...unavailable("requires") }, { ...bridge, ...unavailable("requires") }, { ...treasurer, ...available }] },
  ]),
  tooFewCoins: treeWithCoins(1, 40, [
    { level: 5, perks: [{ ...spark, ...owned(sparkBoughtAt) }, { ...rhythm, ...available }, { ...circle, ...available }] },
    { level: 7, perks: [{ ...flame, ...unavailable("coins") }, { ...cadence, ...unavailable("requires") }, { ...bridge, ...unavailable("requires") }, { ...treasurer, ...available }] },
  ]),
  coinPerkOwnedWhileCoinsHidden: treeWithCoins(1, null, [
    { level: 5, perks: [{ ...spark, ...available }, { ...rhythm, ...available }, { ...circle, ...available }] },
    { level: 7, perks: [{ ...treasurer, copy: "", ...owned(sparkBoughtAt) }] },
  ]),
  locked: { kind: "locked", level: 5 },
  ready: { kind: "ready" },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MySkillTree>;

export function fixedSkillTree(answer: MySkillTree): SkillTreeRead {
  return (asking) => (asking ? answer : undefined);
}

export function fixtureSkillTreeFor(visitor: ShellState): SkillTreeRead {
  return fixedSkillTree(skillTreeAnswerFor(visitor));
}

function skillTreeAnswerFor(visitor: ShellState): MySkillTree {
  if (visitor.kind !== "member") return skillTreeFixtures.notFound;
  const card = visitor.features?.find(({ feature }) => feature === "skillTree");
  if (card === undefined) return skillTreeFixtures.notFound;
  if (card.state === "locked") return { kind: "locked", level: card.level };
  if (card.state === "ready") return skillTreeFixtures.ready;
  return openTreeWith(visitor.skillPoints ?? 0);
}

function openTreeWith(skillPoints: number): SkillTreeAnswer {
  if (skillPoints === 0) return skillTreeFixtures.noPointsLeft;
  if (skillPoints === 1) return skillTreeFixtures.sparkOwned;
  return skillTreeFixtures.withPoints;
}
