import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { withholdingWords } from "../analytics/exceptions";
import { forgetWordsAuthoredBy, forgetWordsInWorkspace } from "../engine/kudosText";

export const forgetWordsOfMember = internalMutation({
  args: { workspace: v.string(), user: v.string() },
  handler: withholdingWords((ctx: MutationCtx, { workspace, user }: { workspace: string; user: string }) => forgetWordsAuthoredBy(ctx, { workspace, author: user })),
});

export const forgetWordsOfWorkspace = internalMutation({
  args: { workspace: v.string() },
  handler: withholdingWords((ctx: MutationCtx, { workspace }: { workspace: string }) => forgetWordsInWorkspace(ctx, { workspace, cursor: null })),
});
