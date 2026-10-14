import type { SkillTreeRead } from "./skillTreeRead";
import type { MySkillTree, PerkNode, SkillTreeAnswer } from "./shell";

const chatUrl = "https://app.slack.com/client/T1";

const sparkBoughtAt = Date.parse("2026-10-13T09:30:00Z");

const rhythmBoughtAt = Date.parse("2026-10-14T08:00:00Z");

const spark = { perk: "spark", name: "Spark", copy: "+5 XP the first time each day you thank someone and say why.", cost: { skillPoints: 1 }, requires: null } as const;

const rhythm = { perk: "rhythm", name: "Rhythm", copy: "+2 XP each time you thank someone and say why, once per person a day.", cost: { skillPoints: 1 }, requires: null } as const;

const circle = { perk: "circle", name: "Circle", copy: "+5 XP the first time each week you thank a person and say why.", cost: { skillPoints: 1 }, requires: null } as const;

const available = { state: "available", reason: null, ownedAt: null } as const;

const owned = (ownedAt: number) => ({ state: "owned", reason: null, ownedAt }) as const;

const unavailable = (reason: NonNullable<PerkNode["reason"]>) => ({ state: "unavailable", reason, ownedAt: null }) as const;

function tree(skillPoints: number, ...perks: PerkNode[]): SkillTreeAnswer {
  return { kind: "tree", skillPoints, rows: [{ level: 5, perks }], chatUrl };
}

export const skillTreeFixtures = {
  withPoints: tree(2, { ...spark, ...available }, { ...rhythm, ...available }, { ...circle, ...available }),
  withOnePoint: tree(1, { ...spark, ...available }, { ...rhythm, ...available }, { ...circle, ...available }),
  sparkOwned: tree(1, { ...spark, ...owned(sparkBoughtAt) }, { ...rhythm, ...available }, { ...circle, ...available }),
  noPointsLeft: tree(0, { ...spark, ...unavailable("points") }, { ...rhythm, ...owned(rhythmBoughtAt) }, { ...circle, ...owned(sparkBoughtAt) }),
  belowTheRow: tree(0, { ...spark, ...unavailable("level") }, { ...rhythm, ...unavailable("level") }, { ...circle, ...unavailable("level") }),
  needsABase: tree(1, { ...spark, ...available }, { ...rhythm, requires: "Spark", ...unavailable("requires") }, { ...circle, ...available }),
  upgradeAvailable: tree(1, { ...spark, ...available }, { ...rhythm, requires: "Spark", ...available }, { ...circle, ...available }),
  costlyPerk: tree(3, { ...spark, cost: { skillPoints: 2 }, ...available }, { ...rhythm, ...available }, { ...circle, ...available }),
  locked: { kind: "locked", level: 5 },
  ready: { kind: "ready" },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MySkillTree>;

export function fixedSkillTree(answer: MySkillTree): SkillTreeRead {
  return (asking) => (asking ? answer : undefined);
}
