import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { exposed, flag, type Flag } from "../analytics/flags";
import { lookup, type MemberId } from "../workspace/directory";

export const everyoneBoardFlag = { key: "everyone-board", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;

export async function isEveryoneBoardShownTo(ctx: MutationCtx, workspace: string, member: MemberId | undefined) {
  const shown = await flag(ctx, everyoneBoardFlag, { workspace });
  if (member !== undefined) await exposed(ctx, everyoneBoardFlag, member, shown);
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
  handler: async (ctx, { workspace, user, shown }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await exposed(ctx, everyoneBoardFlag, person.member, shown);
  },
});
