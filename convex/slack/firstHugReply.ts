import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { escaped } from "./blocks";
import { attemptArgs, sendAtMostOnce, tryAtMostThreeTimes } from "./delivery";

const huggedValidator = v.union(v.object({ kind: v.literal("author"), name: v.optional(v.string()) }), v.object({ kind: v.literal("peopleThanked") }));

type Hugged = Infer<typeof huggedValidator>;

export const deliverFirstHugReply = observedAction({
  args: { workspace: v.string(), user: v.string(), conversation: v.string(), hugged: huggedValidator, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...reply }) => {
    const ephemeral = { channel: reply.conversation, user: reply.user, text: firstHugReplyText(reply.hugged) };
    await tryAtMostThreeTimes(
      attempt,
      (attempt) => sendAtMostOnce(ctx, reply.workspace, "chat.postEphemeral", ephemeral, attempt),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.firstHugReply.deliverFirstHugReply, { ...reply, attempt: retry.attempt }),
    );
  },
});

function firstHugReplyText(hugged: Hugged) {
  return `That was a hug: +1 XP for you and ${huggedPeopleOf(hugged)}. Thank them in a message and say why to earn an item.`;
}

function huggedPeopleOf(hugged: Hugged) {
  if (hugged.kind === "peopleThanked") return "the people thanked";
  return hugged.name === undefined ? "the author" : escaped(hugged.name);
}
