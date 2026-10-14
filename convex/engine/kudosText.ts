import { v, type Infer, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { memberLeftEventValidator, type MemberLeftEvent } from "../bus/events";
import { withholdingWords } from "../analytics/exceptions";
import { gateDecisionOf, gateDecisionValidator } from "../progression/gate";
import { chatUserOf, lookup } from "../workspace/directory";
import { dropFromSpotlight } from "./spotlightDraws";
import { messageRefValidator, visibilityValidator, wordSegmentValidator, type Annotations, type FetchedMessage, type MessageEvent, type MessageRef } from "./messageEvent";

export const forgetPageSize = 10;

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
  v.object({ ...key, kind: v.literal("tombstone"), why: v.union(v.literal("deleted"), v.literal("no-longer-kudos"), v.literal("removed")) }),
);

type KudosTextRow = Doc<"kudosTexts">;
type StoredWords = Extract<Infer<typeof kudosTextValidator>, { kind: "words" }>;

export type KudosText =
  | ({ kind: "text" } & Pick<StoredWords, "segments" | "edited" | "visibility" | "author" | "gate">)
  | { kind: "unavailable"; reason: "deleted" | "removed" | "not-captured" };

export async function keepWords(ctx: MutationCtx, event: MessageEvent, annotations: Annotations) {
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
  if (row?.kind === "words") await write(ctx, row, { ...ref, kind: "tombstone", why: "no-longer-kudos" });
}

export async function removeWords(ctx: MutationCtx, ref: MessageRef) {
  const row = await kudosTextRow(ctx, ref);
  if (row !== null) await remove(ctx, row);
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
  if (row.kind === "tombstone") return { kind: "unavailable", reason: row.why === "removed" ? "removed" : "deleted" };
  if (await hasLeft(ctx, row.workspace, row.author)) return { kind: "unavailable", reason: "removed" };
  const { segments, edited, visibility, author, gate } = row;
  return { kind: "text", segments, edited, visibility, author, gate };
}

export const forgetWordsOfLeaver = internalMutation({
  args: { event: memberLeftEventValidator },
  handler: withholdingWords(async (ctx: MutationCtx, { event: { workspace, member } }: { event: MemberLeftEvent }) => {
    const { user } = await chatUserOf(ctx, member);
    await recordDeletionRequest(ctx, { workspace, author: user });
    await forgetWordsAuthoredBy(ctx, { workspace, author: user });
  }),
});

type DeletionRequest = { workspace: string; author: string | null };

export async function recordDeletionRequest(ctx: MutationCtx, request: DeletionRequest) {
  if (!(await isRequested(ctx, request))) await ctx.db.insert("wordDeletionRequests", request);
}

export async function deletionRequested(ctx: QueryCtx, { workspace, author }: { workspace: string; author: string }) {
  return (await isRequested(ctx, { workspace, author })) || (await isRequested(ctx, { workspace, author: null }));
}

async function isRequested(ctx: QueryCtx, { workspace, author }: DeletionRequest) {
  const request = await ctx.db
    .query("wordDeletionRequests")
    .withIndex("by_author", (q) => q.eq("workspace", workspace).eq("author", author))
    .first();
  return request !== null;
}

const authoredArgs = { workspace: v.string(), author: v.string() };

export const forgetAuthoredWords = internalMutation({
  args: authoredArgs,
  handler: withholdingWords(forgetWordsAuthoredBy),
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
  handler: withholdingWords(forgetWordsInWorkspace),
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
  if (row.kind === "words") await write(ctx, row, { ...refOf(row), kind: "tombstone", why: "removed" });
}

async function hasLeft(ctx: QueryCtx, workspace: string, author: string) {
  const facts = await lookup(ctx, workspace, author);
  return facts !== undefined && facts.kind !== "member";
}

function refOf({ workspace, conversation, message }: MessageRef): MessageRef {
  return { workspace, conversation, message };
}

function mayStoreWordsOver(row: KudosTextRow, revision: bigint) {
  if (row.kind === "tombstone") return row.why === "no-longer-kudos";
  return revision > row.revision;
}

async function write(ctx: MutationCtx, row: KudosTextRow | null, value: Infer<typeof kudosTextValidator>) {
  if (row === null) await ctx.db.insert("kudosTexts", value);
  else await ctx.db.replace(row._id, value);
  if (value.kind === "tombstone") await dropFromSpotlight(ctx, refOf(value));
}

async function kudosTextRow(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("kudosTexts")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
