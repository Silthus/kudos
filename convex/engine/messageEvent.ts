import { v, type Infer } from "convex/values";

export const mentionValidator = v.union(
  v.object({ kind: v.literal("person"), user: v.string() }),
  v.object({ kind: v.literal("group") }),
  v.object({ kind: v.literal("broadcast") }),
);

export const annotationsValidator = v.record(v.string(), v.union(v.string(), v.number(), v.boolean()));

export const messageRefValidator = v.object({ workspace: v.string(), conversation: v.string(), message: v.string() });

export const messageEventValidator = v.object({
  kind: v.union(v.literal("posted"), v.literal("edited")),
  ref: messageRefValidator,
  threadRoot: v.optional(v.string()),
  author: v.string(),
  revision: v.int64(),
  at: v.number(),
  content: v.object({ mentions: v.array(mentionValidator), emoji: v.array(v.string()), text: v.string() }),
});

export type ChatUserId = string;
export type Mention = Infer<typeof mentionValidator>;
export type Annotations = Infer<typeof annotationsValidator>;
export type MessageRef = Infer<typeof messageRefValidator>;
export type MessageEvent = Infer<typeof messageEventValidator>;
export type MessageContent = MessageEvent["content"];
export type CountableContent = Omit<MessageContent, "text">;
