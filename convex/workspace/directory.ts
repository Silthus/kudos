import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";

export type MemberId = Id<"members">;

export type MemberFacts =
  | { kind: "member"; member: MemberId; timeZone: string | undefined }
  | { kind: "bot" }
  | { kind: "not-a-member" };

export const directoryEntryValidator = v.union(
  v.object({ kind: v.literal("member"), timeZone: v.optional(v.string()) }),
  v.object({ kind: v.literal("bot") }),
  v.object({ kind: v.literal("not-a-member") }),
);

export type DirectoryEntry = Infer<typeof directoryEntryValidator>;

export async function lookup(ctx: QueryCtx, workspace: string, user: ChatUserId): Promise<MemberFacts | undefined> {
  const row = await memberRow(ctx, workspace, user);
  if (row === null) return undefined;
  if (row.kind === "member") return { kind: "member", member: row._id, timeZone: row.timeZone };
  return { kind: row.kind };
}

export async function chatUserOf(ctx: QueryCtx, member: MemberId): Promise<{ workspace: string; user: ChatUserId }> {
  const row = await ctx.db.get(member);
  if (row === null) throw new Error(`no member ${member} in the directory`);
  return { workspace: row.workspace, user: row.user };
}

export const record = internalMutation({
  args: { workspace: v.string(), user: v.string(), entry: directoryEntryValidator },
  handler: async (ctx, { workspace, user, entry }) => {
    const row = { workspace, user, timeZone: undefined, ...entry };
    const existing = await memberRow(ctx, workspace, user);
    if (existing === null) await ctx.db.insert("members", row);
    else await ctx.db.replace(existing._id, row);
  },
});

function memberRow(ctx: QueryCtx, workspace: string, user: ChatUserId) {
  return ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
}
