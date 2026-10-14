import { v, type Infer, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { memberLeftEventValidator } from "../bus/events";
import { gateDecisionOf, gateDecisionValidator } from "../progression/gate";
import { chatUserOf, lookup } from "../workspace/directory";
import { messageRefValidator, visibilityValidator, wordSegmentValidator, type Annotations, type MessageEvent, type MessageRef } from "./messageEvent";

export const forgetPageSize = 100;

const key = messageRefValidator.fields;

export const kudosTextValidator = v.union(
  v.object({
    ...key,
    kind: v.literal("words"),
    revision: v.int64(),
    author: v.string(),
    edited: v.boolean(),
    segments: v.array(wordSegmentValidator),
    visibility: visibilityValidator,
    gate: v.union(gateDecisionValidator, v.null()),
  }),
  v.object({ ...key, kind: v.literal("tombstone"), why: v.union(v.literal("deleted"), v.literal("no-longer-kudos"), v.literal("removed")) }),
);

type KudosTextRow = Doc<"kudosTexts">;
type StoredWords = Extract<Infer<typeof kudosTextValidator>, { kind: "words" }>;

export type KudosText =
  | ({ kind: "text" } & Pick<StoredWords, "segments" | "edited" | "visibility" | "author" | "gate">)
  | { kind: "unavailable"; reason: "deleted" | "removed" | "not-captured" };

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

export async function forgetWords(ctx: MutationCtx, ref: MessageRef) {
  const row = await kudosTextRow(ctx, ref);
  if (row?.kind === "words") await ctx.db.replace(row._id, { ...ref, kind: "tombstone", why: "no-longer-kudos" });
}

export async function forgetDeleted(ctx: MutationCtx, ref: MessageRef) {
  const row = await kudosTextRow(ctx, ref);
  await write(ctx, row, { ...ref, kind: "tombstone", why: "deleted" });
}

export async function wordsOf(ctx: QueryCtx, ref: MessageRef): Promise<KudosText> {
  const row = await kudosTextRow(ctx, ref);
  if (row === null) return { kind: "unavailable", reason: "not-captured" };
  if (row.kind === "tombstone") return { kind: "unavailable", reason: row.why === "removed" ? "removed" : "deleted" };
  if (await hasLeft(ctx, row.workspace, row.author)) return { kind: "unavailable", reason: "removed" };
  const { segments, edited, visibility, author, gate } = row;
  return { kind: "text", segments, edited, visibility, author, gate };
}

export const forgetWordsOfLeaver = internalMutation({
  args: { event: memberLeftEventValidator },
  handler: async (ctx, { event: { workspace, member } }) => {
    const { user } = await chatUserOf(ctx, member);
    await forgetWordsAuthoredBy(ctx, { workspace, author: user });
  },
});

const authoredArgs = { workspace: v.string(), author: v.string() };

export const forgetAuthoredWords = internalMutation({
  args: authoredArgs,
  handler: forgetWordsAuthoredBy,
});

export async function forgetWordsAuthoredBy(ctx: MutationCtx, { workspace, author }: ObjectType<typeof authoredArgs>) {
  const rows = await ctx.db
    .query("kudosTexts")
    .withIndex("by_author", (q) => q.eq("workspace", workspace).eq("author", author))
    .take(forgetPageSize);
  for (const row of rows) await remove(ctx, row);
  if (rows.length === forgetPageSize) await ctx.scheduler.runAfter(0, internal.engine.kudosText.forgetAuthoredWords, { workspace, author });
}

const workspaceArgs = { workspace: v.string(), cursor: v.union(v.string(), v.null()) };

export const forgetWorkspaceWords = internalMutation({
  args: workspaceArgs,
  handler: forgetWordsInWorkspace,
});

export async function forgetWordsInWorkspace(ctx: MutationCtx, { workspace, cursor }: ObjectType<typeof workspaceArgs>) {
  const rows = await ctx.db
    .query("kudosTexts")
    .withIndex("by_message", (q) => q.eq("workspace", workspace))
    .paginate({ numItems: forgetPageSize, cursor });
  for (const row of rows.page) await remove(ctx, row);
  if (!rows.isDone) await ctx.scheduler.runAfter(0, internal.engine.kudosText.forgetWorkspaceWords, { workspace, cursor: rows.continueCursor });
}

async function remove(ctx: MutationCtx, row: KudosTextRow) {
  if (row.kind === "words") await ctx.db.replace(row._id, { ...refOf(row), kind: "tombstone", why: "removed" });
}

async function hasLeft(ctx: QueryCtx, workspace: string, author: string) {
  const facts = await lookup(ctx, workspace, author);
  return facts !== undefined && facts.kind !== "member";
}

function refOf({ workspace, conversation, message }: KudosTextRow): MessageRef {
  return { workspace, conversation, message };
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
