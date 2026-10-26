import type { QueryCtx } from "../_generated/server";
import type { MessageRef } from "../engine/messageEvent";

export function heldReplyOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("privateReplies")
    .withIndex("by_held_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("held", true))
    .first();
}

export async function replyIsHeld(ctx: QueryCtx, message: MessageRef): Promise<boolean> {
  return (await heldReplyOf(ctx, message)) !== null;
}
