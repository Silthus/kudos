import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import { currentMemberOfUser, directoryRecordArgs, isOlder, memberRowsIn, recordIfUnknown, type DirectoryRecord, type MemberId } from "./directory";

export type ListedMember = { user: ChatUserId; name: string | undefined };

export const keepListedMembers = internalMutation({
  args: { listings: v.array(v.object(directoryRecordArgs)) },
  handler: async (ctx, { listings }) => {
    for (const listing of listings) await keepListing(ctx, listing);
  },
});

export async function unknownListedMembersIn(ctx: QueryCtx, workspace: string): Promise<ListedMember[]> {
  const known = new Set((await memberRowsIn(ctx, workspace)).map(({ user }) => user));
  return (await listedMembersIn(ctx, workspace)).filter(({ user }) => !known.has(user));
}

export async function listedMembersIn(ctx: QueryCtx, workspace: string): Promise<ListedMember[]> {
  const listed = await ctx.db
    .query("listedMembers")
    .withIndex("by_user", (q) => q.eq("workspace", workspace))
    .collect();
  return listed.flatMap(({ user, entry }) => (entry.kind === "member" ? [{ user, name: entry.name }] : []));
}

export async function recordListedMember(ctx: MutationCtx, workspace: string, user: ChatUserId): Promise<MemberId | null> {
  const listed = await listedRow(ctx, workspace, user);
  if (listed?.entry.kind !== "member") return null;
  await recordIfUnknown(ctx, { workspace, user, entry: listed.entry, asOf: listed.asOf });
  return (await currentMemberOfUser(ctx, workspace, user))?.member ?? null;
}

async function keepListing(ctx: MutationCtx, { workspace, user, entry, asOf }: DirectoryRecord) {
  const existing = await listedRow(ctx, workspace, user);
  if (existing === null) await ctx.db.insert("listedMembers", { workspace, user, entry, asOf });
  else if (!isOlder(asOf, existing.asOf)) await ctx.db.patch(existing._id, { entry, asOf });
}

function listedRow(ctx: QueryCtx, workspace: string, user: ChatUserId) {
  return ctx.db
    .query("listedMembers")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
}
