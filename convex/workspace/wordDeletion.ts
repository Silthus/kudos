import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { forgetWordsAuthoredBy, forgetWordsInWorkspace } from "../engine/kudosText";

export const forgetWordsOfMember = internalMutation({
  args: { workspace: v.string(), user: v.string() },
  handler: (ctx, { workspace, user }) => forgetWordsAuthoredBy(ctx, { workspace, author: user }),
});

export const forgetWordsOfWorkspace = internalMutation({
  args: { workspace: v.string() },
  handler: (ctx, { workspace }) => forgetWordsInWorkspace(ctx, { workspace, cursor: null }),
});
