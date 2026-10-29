import type { MutationCtx } from "../../_generated/server";
import type { ReachedTier } from "../milestones";
import type { MilestoneTier } from "../records";
import type { Rarity } from "../hoggies/catalogue";
import type { CrateKey } from "../hoggies/crateKey";
import type { MemberId } from "../../workspace/directory";
import { earnItem } from "./ledger";

type Achiever = { workspace: string; member: MemberId };

type FilledTeam = { team: string; name: string };

const teamFloor: Rarity = "rare";

const tierFloors: Record<MilestoneTier, Rarity> = { bronze: "uncommon", silver: "rare", gold: "epic", diamond: "legendary" };

export async function earnTeamItem(ctx: MutationCtx, { workspace, member }: Achiever, { team, name }: FilledTeam, at: number): Promise<void> {
  const key: CrateKey = `team:${team}`;
  await earnItem(ctx, { workspace, member, source: "hoggie", key, floor: teamFloor, reason: { kind: "team", team, name }, earnedAt: at });
}

export async function earnTierItem(ctx: MutationCtx, { workspace, member }: Achiever, { milestone, tier }: ReachedTier, at: number): Promise<void> {
  const key: CrateKey = `milestone:${milestone}:${tier}`;
  await earnItem(ctx, { workspace, member, source: "hoggie", key, floor: tierFloors[tier], reason: { kind: "milestone", milestone, tier }, earnedAt: at });
}
