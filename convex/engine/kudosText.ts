import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { gateDecisionOf, gateDecisionValidator } from "../progression/gate";
import { messageRefValidator, visibilityValidator, wordSegmentValidator, type Annotations, type FetchedMessage, type MessageEvent, type MessageRef } from "./messageEvent";

const key = messageRefValidator.fields;

export const kudosTextValidator = v.union(
  v.object({
    ...key,
    kind: v.literal("words"),
    revision: v.int64(),
    author: v.string(),
    edited: v.boolean(),
    segments: v.array(wordSegmentValidator),
    visibility: v.union(visibilityValidator, v.literal("unknown")),
    gate: v.union(gateDecisionValidator, v.null()),
  }),
  v.object({ ...key, kind: v.literal("tombstone"), why: v.union(v.literal("deleted"), v.literal("no-longer-kudos")) }),
);

type KudosTextRow = Doc<"kudosTexts">;
type StoredWords = Extract<Infer<typeof kudosTextValidator>, { kind: "words" }>;

export type KudosText =
  | ({ kind: "text" } & Pick<StoredWords, "segments" | "edited" | "visibility" | "author" | "gate">)
  | { kind: "unavailable"; reason: "deleted" | "not-captured" };

export async function keepWords(ctx: MutationCtx, event: MessageEvent, annotations: Annotations) {
  if (event.words === undefined) return;
  const row = await kudosTextRow(ctx, event.ref);
  if (row !== null && !mayStoreWordsOver(row, event.revision)) return;
  await write(ctx, row, {
    ...event.ref,
    kind: "words",
    revision: event.revision,
    author: event.author,
    edited: event.kind === "edited",
    segments: event.words.segments,
    visibility: event.words.visibility,
    gate: gateDecisionOf(annotations),
  });
}

export async function keepFetchedWords(ctx: MutationCtx, fetched: FetchedMessage, annotations: Annotations) {
  if ((await kudosTextRow(ctx, fetched.ref)) !== null) return false;
  await ctx.db.insert("kudosTexts", {
    ...fetched.ref,
    kind: "words",
    revision: fetched.revision,
    author: fetched.author,
    edited: fetched.edited,
    segments: fetched.segments,
    visibility: "unknown",
    gate: gateDecisionOf(annotations),
  });
  return true;
}

export async function forgetWords(ctx: MutationCtx, ref: MessageRef) {
  const row = await kudosTextRow(ctx, ref);
  if (row?.kind === "words") await ctx.db.replace(row._id, { ...ref, kind: "tombstone", why: "no-longer-kudos" });
}

export async function forgetDeleted(ctx: MutationCtx, ref: MessageRef) {
  const row = await kudosTextRow(ctx, ref);
  await write(ctx, row, { ...ref, kind: "tombstone", why: "deleted" });
}

export async function hasKudosText(ctx: QueryCtx, ref: MessageRef) {
  return (await kudosTextRow(ctx, ref)) !== null;
}

export async function wordsOf(ctx: QueryCtx, ref: MessageRef): Promise<KudosText> {
  const row = await kudosTextRow(ctx, ref);
  if (row === null) return { kind: "unavailable", reason: "not-captured" };
  if (row.kind === "tombstone") return { kind: "unavailable", reason: "deleted" };
  const { segments, edited, visibility, author, gate } = row;
  return { kind: "text", segments, edited, visibility, author, gate };
}

function mayStoreWordsOver(row: KudosTextRow, revision: bigint) {
  if (row.kind === "tombstone") return row.why === "no-longer-kudos";
  return revision > row.revision;
}

async function write(ctx: MutationCtx, row: KudosTextRow | null, value: Infer<typeof kudosTextValidator>) {
  if (row === null) await ctx.db.insert("kudosTexts", value);
  else await ctx.db.replace(row._id, value);
}

async function kudosTextRow(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("kudosTexts")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
