import type { QueryCtx } from "../_generated/server";
import { thoughtfulMovedSince } from "../album/milestones";
import { twoDaysMovedSince } from "../quests/onboarding";
import type { Moved } from "../quests/progress";
import { mondayQuestsMovedSince } from "../quests/weekly";
import type { MemberId } from "../workspace/directory";

export type Progressed = Moved & { kind: "quest" | "milestone" };

export async function progressedSince(ctx: QueryCtx, member: MemberId, since: number, until: number): Promise<Progressed[]> {
  const quests = [...(await twoDaysMovedSince(ctx, member, since, until)), ...(await mondayQuestsMovedSince(ctx, member, since, until))];
  const milestones = await thoughtfulMovedSince(ctx, member, since, until);
  return [...quests.map((moved) => ({ kind: "quest" as const, ...moved })), ...milestones.map((moved) => ({ kind: "milestone" as const, ...moved }))];
}
