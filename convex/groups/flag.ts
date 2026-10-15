import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { exposed, memberDecision, type Flag } from "../analytics/flags";
import { lookup, type MemberId } from "../workspace/directory";

export const groupsFlag = { key: "groups", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function groupsApplyTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const applies = await memberDecision(ctx, groupsFlag, member);
  await exposed(ctx, groupsFlag, member, applies);
  return applies;
}

export const exposeGroups = internalMutation({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await groupsApplyTo(ctx, person.member);
  },
});
