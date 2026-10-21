import { v, type Infer } from "convex/values";

export const mentionValidator = v.union(
  v.object({ kind: v.literal("person"), user: v.string() }),
  v.object({ kind: v.literal("group"), group: v.string() }),
  v.object({ kind: v.literal("broadcast"), range: v.string() }),
);

const annotationValueValidator = v.union(v.string(), v.number(), v.boolean());

export const annotationsValidator = v.record(v.string(), v.union(annotationValueValidator, v.record(v.string(), annotationValueValidator)));

export const messageRefValidator = v.object({ workspace: v.string(), conversation: v.string(), message: v.string() });

const styleFlag = v.optional(v.literal(true));

export const wordSegmentValidator = v.union(
  v.object({ kind: v.literal("text"), text: v.string(), bold: styleFlag, italic: styleFlag, strike: styleFlag, code: styleFlag }),
  v.object({ kind: v.literal("person"), user: v.string() }),
  v.object({ kind: v.literal("group"), group: v.string() }),
  v.object({ kind: v.literal("channel") }),
  v.object({ kind: v.literal("broadcast"), range: v.string() }),
  v.object({ kind: v.literal("emoji"), name: v.string(), unicode: v.optional(v.string()) }),
  v.object({ kind: v.literal("link"), url: v.string(), label: v.optional(v.string()) }),
  v.object({ kind: v.literal("break") }),
);

export const visibilityValidator = v.union(v.literal("public"), v.literal("private"));

export const wordsValidator = v.object({ segments: v.array(wordSegmentValidator), visibility: visibilityValidator });

export const countableContentValidator = v.object({ mentions: v.array(mentionValidator), emoji: v.array(v.string()), mentionsBeforeEmoji: v.optional(v.array(v.number())) });

export const messageEventValidator = v.object({
  kind: v.union(v.literal("posted"), v.literal("edited")),
  ref: messageRefValidator,
  threadRoot: v.optional(v.string()),
  author: v.string(),
  revision: v.int64(),
  at: v.number(),
  content: countableContentValidator.extend({ text: v.string() }),
  words: wordsValidator,
});

export const fetchedMessageValidator = v.object({
  ref: messageRefValidator,
  author: v.string(),
  revision: v.int64(),
  edited: v.boolean(),
  content: messageEventValidator.fields.content,
  segments: v.array(wordSegmentValidator),
});

export const messageDeletedValidator = v.object({ kind: v.literal("deleted"), ref: messageRefValidator, wasKudosCandidate: v.boolean() });

export type ChatUserId = string;
export type Mention = Infer<typeof mentionValidator>;
export type Annotations = Infer<typeof annotationsValidator>;
export type MessageRef = Infer<typeof messageRefValidator>;
export type MessageEvent = Infer<typeof messageEventValidator>;
export type MessageContent = MessageEvent["content"];
export type FetchedMessage = Infer<typeof fetchedMessageValidator>;
export type MessageDeleted = Infer<typeof messageDeletedValidator>;
export type WordSegment = Infer<typeof wordSegmentValidator>;
export type Words = Infer<typeof wordsValidator>;
export type Visibility = Infer<typeof visibilityValidator>;
export type CountableContent = Infer<typeof countableContentValidator>;

export function countableOf({ mentions, emoji, mentionsBeforeEmoji }: CountableContent): CountableContent {
  return { mentions, emoji, ...(mentionsBeforeEmoji && { mentionsBeforeEmoji }) };
}
