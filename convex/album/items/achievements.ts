import type { MutationCtx } from "../../_generated/server";
import type { ReachedTier } from "../milestones";
import type { CrateKey } from "../hoggies/crateKey";
import type { MemberId } from "../../workspace/directory";
import { completedTeamRarities, earnHoggieItem, milestoneRarities } from "../hoggies/rarityCaps";

type Achiever = { workspace: string; member: MemberId };

type FilledTeam = { team: string; name: string };

export async function earnTeamItem(ctx: MutationCtx, { workspace, member }: Achiever, { team, name }: FilledTeam, at: number): Promise<void> {
  const key: CrateKey = `team:${team}`;
  await earnHoggieItem(ctx, { workspace, member, key, reason: { kind: "team", team, name }, earnedAt: at }, completedTeamRarities);
}

export async function earnTierItem(ctx: MutationCtx, { workspace, member }: Achiever, { milestone, tier }: ReachedTier, at: number): Promise<void> {
  const key: CrateKey = `milestone:${milestone}:${tier}`;
  await earnHoggieItem(ctx, { workspace, member, key, reason: { kind: "milestone", milestone, tier }, earnedAt: at }, milestoneRarities[tier]);
}
