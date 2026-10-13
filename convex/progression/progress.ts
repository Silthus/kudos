import { v, type Infer } from "convex/values";
import type { KudosGivenEvent, LevelReachedEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import type { Catalogue } from "./catalogue";
import { gateDecisionOf, gateDecisionValidator } from "./gate";
import { levelOf } from "./levels";

export const effectsRecordValidator = v.object({
  award: v.id("awards"),
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
  const effects = effectsFor(state.member, event, catalogue);
  const xp = state.xp + effects.reduce((sum, record) => sum + record.baseXp, 0);
  const next = { ...state, xp };
  return { state: next, effects, events: levelsReached(state, next, event) };
}

export function standing({ xp, pointsSpent }: MemberProgress): Standing {
  const level = levelOf(xp);
  return { xp, level, skillPoints: level - 1 - pointsSpent };
}

function effectsFor(member: MemberId, event: KudosGivenEvent, catalogue: Catalogue): EffectsRecord[] {
  const gate = gateDecisionOf(event.annotations);
  return event.awards.flatMap(({ award, giver, recipient, kudos }) => {
    const sides: Array<[Side, MemberId]> = [["giver", giver], ["recipient", recipient]];
    return sides
      .filter(([, sideMember]) => sideMember === member)
      .map(([side]) => ({ award, side, member, day: event.day, baseXp: catalogue.baseXp[side] * kudos, gate, catalogueVersion: catalogue.version }));
  });
}

function levelsReached(before: MemberProgress, after: MemberProgress, event: KudosGivenEvent): LevelReachedEvent[] {
  const from = levelOf(before.xp);
  const level = levelOf(after.xp);
  if (level === from) return [];
  return [{ type: "levelReached", workspace: event.workspace, member: after.member, level, skillPointsGained: level - from, message: event.message, at: event.at }];
}
