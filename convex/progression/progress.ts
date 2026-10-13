import { v, type Infer } from "convex/values";
import type { KudosGivenEvent, LevelReachedEvent } from "../bus/events";
import { awardIdValidator, type Award, type AwardWithId, type GivenAward } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { Catalogue } from "./catalogue";
import { gateDecisionOf, gateDecisionValidator } from "./gate";
import { levelOf, skillPointsEarnedAt, xpToReach } from "./levels";

export const effectsRecordValidator = v.object({
  award: awardIdValidator,
  side: v.union(v.literal("giver"), v.literal("recipient")),
  member: v.id("members"),
  day: v.string(),
  baseXp: v.number(),
  gate: v.union(gateDecisionValidator, v.null()),
  catalogueVersion: v.string(),
});

export type EffectsRecord = Infer<typeof effectsRecordValidator>;
export type Side = EffectsRecord["side"];

export type MemberProgress = { member: MemberId; xp: number; pointsSpent: number };

export type Standing = { xp: number; level: number; skillPoints: number };

export type Progressed = { state: MemberProgress; effects: EffectsRecord[]; events: LevelReachedEvent[] };

export function progress(state: MemberProgress, event: KudosGivenEvent, catalogue: Catalogue): Progressed {
  const effects = effectsFor(state.member, event.awards, { day: event.day, gate: gateDecisionOf(event.annotations) }, catalogue);
  const next = withXpOf(state, effects);
  return { state: next, effects, events: levelsReached(state, next, event) };
}

export function replay(state: MemberProgress, award: GivenAward, catalogue: Catalogue): Progressed {
  const effects = effectsFor(state.member, [award], { day: award.day, gate: null }, catalogue);
  return { state: withXpOf(state, effects), effects, events: [] };
}

export function sideOf(member: MemberId, { giver, recipient }: Award): Side | null {
  if (member === giver) return "giver";
  if (member === recipient) return "recipient";
  return null;
}

export function standing({ xp, pointsSpent }: MemberProgress): Standing {
  const level = levelOf(xp);
  return { xp, level, skillPoints: skillPointsEarnedAt(level) - pointsSpent };
}

export function xpToNextLevel({ xp, level }: Standing): number {
  return xpToReach(level + 1) - xp;
}

function effectsFor(member: MemberId, awards: AwardWithId[], { day, gate }: Pick<EffectsRecord, "day" | "gate">, catalogue: Catalogue): EffectsRecord[] {
  return awards.flatMap((award) => {
    const side = sideOf(member, award);
    if (side === null) return [];
    return [{ award: award.award, side, member, day, baseXp: catalogue.baseXp[side] * award.kudos, gate, catalogueVersion: catalogue.version }];
  });
}

function withXpOf(state: MemberProgress, effects: EffectsRecord[]): MemberProgress {
  return { ...state, xp: state.xp + effects.reduce((sum, record) => sum + record.baseXp, 0) };
}

function levelsReached(before: MemberProgress, after: MemberProgress, event: KudosGivenEvent): LevelReachedEvent[] {
  const from = levelOf(before.xp);
  const reached = standing(after);
  const { level, skillPoints } = reached;
  if (level === from) return [];
  return [
    {
      type: "levelReached",
      workspace: event.workspace,
      member: after.member,
      level,
      skillPointsGained: skillPointsEarnedAt(level) - skillPointsEarnedAt(from),
      skillPoints,
      xpToNextLevel: xpToNextLevel(reached),
      message: event.message,
      at: event.at,
    },
  ];
}
