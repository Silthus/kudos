import { v, type Infer, type ObjectType } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import { ReportableError } from "../analytics/exceptions";

export type MemberId = Id<"members">;

export type MemberFacts =
  | { kind: "member"; member: MemberId; timeZone: string | undefined; admin: boolean }
  | { kind: "bot" }
  | { kind: "not-a-member" };

export const directoryEntryValidator = v.union(
  v.object({ kind: v.literal("member"), name: v.optional(v.string()), timeZone: v.optional(v.string()), admin: v.optional(v.boolean()) }),
  v.object({ kind: v.literal("bot") }),
  v.object({ kind: v.literal("not-a-member") }),
);

export type DirectoryEntry = Infer<typeof directoryEntryValidator>;

export async function lookup(ctx: QueryCtx, workspace: string, user: ChatUserId): Promise<MemberFacts | undefined> {
  const row = await memberRow(ctx, workspace, user);
  if (row === null) return undefined;
  if (row.kind === "member") return { kind: "member", member: row._id, timeZone: row.timeZone, admin: row.admin ?? false };
  return { kind: row.kind };
}

export async function chatUserOf(ctx: QueryCtx, member: MemberId): Promise<{ workspace: string; user: ChatUserId }> {
  const row = await ctx.db.get(member);
  if (row === null) throw new ReportableError("no such member in the directory");
  return { workspace: row.workspace, user: row.user };
}

export async function adminsIn(ctx: QueryCtx, workspace: string): Promise<ChatUserId[]> {
  const members = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace))
    .filter((q) => q.and(q.eq(q.field("kind"), "member"), q.eq(q.field("admin"), true)))
    .collect();
  return members.map(({ user }) => user);
}

export const directoryRecordArgs = { workspace: v.string(), user: v.string(), entry: directoryEntryValidator, asOf: v.number() };

export type DirectoryRecord = ObjectType<typeof directoryRecordArgs>;

export const fillEntry = internalMutation({
  args: directoryRecordArgs,
  handler: async (ctx, directoryRecord) => {
    if ((await memberRow(ctx, directoryRecord.workspace, directoryRecord.user)) === null) await record(ctx, directoryRecord);
  },
});

export const nameMembersWithoutName = internalMutation({
  args: { names: v.array(v.object({ workspace: v.string(), user: v.string(), name: v.string() })) },
  handler: async (ctx, { names }) => {
    for (const { workspace, user, name } of names) {
      const row = await memberRow(ctx, workspace, user);
      if (row?.kind === "member" && row.name === undefined) await ctx.db.patch(row._id, { name });
    }
  },
});

export async function record(ctx: MutationCtx, { workspace, user, entry, asOf }: DirectoryRecord) {
  const row = { workspace, user, timeZone: undefined, asOf, ...entry };
  const existing = await memberRow(ctx, workspace, user);
  if (existing === null) await ctx.db.insert("members", row);
  else if (!isOlder(asOf, existing.asOf)) await ctx.db.replace(existing._id, row);
}

function isOlder(asOf: number, known: number | undefined) {
  return known !== undefined && asOf < known;
}

function memberRow(ctx: QueryCtx, workspace: string, user: ChatUserId) {
  return ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
}
