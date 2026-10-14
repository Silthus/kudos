import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, memberDecision, workspaceDecision, type Flag } from "../analytics/flags";
import { lookup, type MemberId } from "../workspace/directory";

export const everyoneBoardFlag = { key: "everyone-board", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function everyoneBoardShownIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return workspaceDecision(ctx, everyoneBoardFlag, workspace);
}

export async function isEveryoneBoardShownTo(ctx: MutationCtx, workspace: string, member: MemberId | undefined) {
  if (member === undefined) return everyoneBoardShownIn(ctx, workspace);
  const shown = await memberDecision(ctx, everyoneBoardFlag, member);
  await exposed(ctx, everyoneBoardFlag, member, shown);
  return shown;
}

const viewerArgs = { workspace: v.string(), user: v.string() };

export const isEveryoneBoardShown = internalMutation({
  args: viewerArgs,
  returns: v.object({ shown: v.boolean(), viewerKnown: v.boolean() }),
  handler: async (ctx, { workspace, user }) => {
    const person = await lookup(ctx, workspace, user);
    const shown = await isEveryoneBoardShownTo(ctx, workspace, person?.kind === "member" ? person.member : undefined);
    return { shown, viewerKnown: person !== undefined };
  },
});

export const exposeEveryoneBoard = internalMutation({
  args: { ...viewerArgs, shown: v.boolean() },
  handler: async (ctx, { workspace, user }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await isEveryoneBoardShownTo(ctx, workspace, person.member);
  },
});
