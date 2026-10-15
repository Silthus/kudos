import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { rewardOf } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { crateOpeningOf, rewardKeyOf } from "./crates";
import { journeyStepAppliesTo, questsLiveFor } from "./flag";
import { groupQuestAppliesTo, groupQuestIdOf } from "./groupQuest";
import { crateOpened } from "./pendingCrates";
import type { Quest } from "./step";
import { poolQuestOf } from "./weekly";

export async function openQuestCrate(ctx: MutationCtx, member: MemberId, quest: Quest): Promise<"done" | "refused"> {
  const key = rewardKeyOf(quest);
  if ((await rewardOf(ctx, member, key)) === null || !(await questsLiveFor(ctx, member))) return "refused";
  const { workspace } = await chatUserOf(ctx, member);
  if (quest.kind === "journey" && !(await journeyStepAppliesTo(ctx, workspace, member, quest.step))) return "refused";
  if (quest.kind === "group" && !(await groupQuestAppliesTo(ctx, member))) return "refused";
  if ((await crateOpeningOf(ctx, member, key)) !== null) return "done";
  const at = Date.now();
  await ctx.db.insert("crateOpenings", { member, key, at });
  await crateOpened(ctx, member, key);
  await publish(ctx, { type: "questOpened", workspace, member, quest, ...(await poolQuestNamed(ctx, member, quest)), at });
  return "done";
}

async function poolQuestNamed(ctx: QueryCtx, member: MemberId, quest: Quest) {
  const poolQuest = await poolQuestIdOf(ctx, member, quest);
  return poolQuest === null ? {} : { poolQuest };
}

function poolQuestIdOf(ctx: QueryCtx, member: MemberId, quest: Quest) {
  switch (quest.kind) {
    case "journey":
      return null;
    case "weekly":
      return poolQuestOf(ctx, member, quest);
    case "group":
      return groupQuestIdOf(ctx, quest);
  }
}
