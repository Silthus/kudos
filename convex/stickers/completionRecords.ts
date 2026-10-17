import { v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { awardIdValidator } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { RecordedCompletion } from "./teamPages";

export const teamPageCompletionValidator = v.object({
  member: v.id("members"),
  team: v.string(),
  name: v.string(),
  crestImage: v.optional(v.string()),
  award: awardIdValidator,
  at: v.number(),
  people: v.number(),
  told: v.boolean(),
});

export const teamPageCheckValidator = v.object({ member: v.id("members"), at: v.number(), finished: v.boolean() });

export type TeamPageCompletion = Infer<typeof teamPageCompletionValidator>;

export async function completionsOf(ctx: QueryCtx, member: MemberId): Promise<RecordedCompletion[]> {
  const completions = await completionRecordsOf(ctx, member);
  return completions.map(({ team, name, crestImage, at }) => ({ team, name, ...(crestImage !== undefined && { crestImage }), at }));
}

export async function teamsCompletedBy(ctx: QueryCtx, member: MemberId): Promise<string[]> {
  return (await completionRecordsOf(ctx, member)).map(({ team }) => team);
}

export async function completionRecordsInOrder(ctx: QueryCtx, member: MemberId) {
  const completions = await completionRecordsOf(ctx, member);
  return completions.toSorted((first, second) => first._creationTime - second._creationTime).map(({ award, at, told }) => ({ award, at, told }));
}

function completionRecordsOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("teamPageCompletions")
    .withIndex("by_member_team", (q) => q.eq("member", member))
    .collect();
}
