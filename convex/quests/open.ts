import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { rewardOf } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { crateOpeningOf, rewardKeyOf } from "./crates";
import { questsLiveIn } from "./flag";
import { crateOpened } from "./pendingCrates";
import type { Quest } from "./step";
import { poolQuestOf } from "./weekly";

export async function openQuestCrate(ctx: MutationCtx, member: MemberId, quest: Quest): Promise<"done" | "refused"> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await questsLiveIn(ctx, workspace))) return "refused";
  const key = rewardKeyOf(quest);
  if ((await rewardOf(ctx, member, key)) === null) return "refused";
  if ((await crateOpeningOf(ctx, member, key)) !== null) return "done";
  const at = Date.now();
  await ctx.db.insert("crateOpenings", { member, key, at });
  await crateOpened(ctx, member, key);
  await publish(ctx, { type: "questOpened", workspace, member, quest, ...(await poolQuestNamed(ctx, member, quest)), at });
  return "done";
}

async function poolQuestNamed(ctx: QueryCtx, member: MemberId, quest: Quest) {
  const poolQuest = quest.kind === "weekly" ? await poolQuestOf(ctx, member, quest) : null;
  return poolQuest === null ? {} : { poolQuest };
}
