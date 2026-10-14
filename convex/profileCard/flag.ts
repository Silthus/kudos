import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { exposed, memberDecision, workspaceDecision, type Flag } from "../analytics/flags";
import { lookup, type MemberId } from "../workspace/directory";

export const profileCardFlag = { key: "profile-card", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function isProfileCardShownTo(ctx: MutationCtx, workspace: string, member: MemberId | undefined): Promise<boolean> {
  if (member === undefined) return workspaceDecision(ctx, profileCardFlag, workspace);
  const shown = await memberDecision(ctx, profileCardFlag, member);
  await exposed(ctx, profileCardFlag, member, shown);
  return shown;
}

export const exposeProfileCard = internalMutation({
  args: { workspace: v.string(), user: v.string(), shown: v.boolean() },
  handler: async (ctx, { workspace, user }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await isProfileCardShownTo(ctx, workspace, person.member);
  },
});
