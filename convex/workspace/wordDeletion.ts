import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { withholdingWords } from "../analytics/exceptions";
import { forgetWordsAuthoredBy, forgetWordsInWorkspace, recordDeletionRequest } from "../engine/kudosText";

export const forgetWordsOfMember = internalMutation({
  args: { workspace: v.string(), user: v.string() },
  handler: withholdingWords(async (ctx: MutationCtx, { workspace, user }: { workspace: string; user: string }) => {
    await recordDeletionRequest(ctx, { workspace, author: user });
    await forgetWordsAuthoredBy(ctx, { workspace, author: user });
  }),
});

export const forgetWordsOfWorkspace = internalMutation({
  args: { workspace: v.string() },
  handler: withholdingWords(async (ctx: MutationCtx, { workspace }: { workspace: string }) => {
    await recordDeletionRequest(ctx, { workspace, author: null });
    await forgetWordsInWorkspace(ctx, { workspace, cursor: null });
  }),
});
