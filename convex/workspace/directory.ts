import { v, type Infer, type ObjectType } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import { ReportableError } from "../analytics/exceptions";
import { followMembersLater } from "../analytics/person";
import { publish } from "../bus/publish";
import { reconcileMember, reconcileUser } from "../groups/reconcile";
import { memberProfileFieldNames, memberProfileFields, type MemberProfile } from "./memberProfile";

export type MemberId = Id<"members">;

export type MemberFacts =
  | { kind: "member"; member: MemberId; timeZone: string | undefined; admin: boolean }
  | { kind: "bot" }
  | { kind: "not-a-member" };

export const directoryEntryValidator = v.union(
  v.object({ kind: v.literal("member"), name: v.optional(v.string()), timeZone: v.optional(v.string()), admin: v.optional(v.boolean()), ...memberProfileFields }),
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

export async function emailOf(ctx: QueryCtx, member: MemberId): Promise<string | undefined> {
  const row = await ctx.db.get(member);
  return row?.kind === "member" ? row.email : undefined;
}

export type PersonFacts = { workspace: string; user: ChatUserId; admin: boolean } & MemberProfile;

export async function personFactsOf(ctx: QueryCtx, member: MemberId): Promise<PersonFacts | null> {
  const row = await ctx.db.get(member);
  if (row?.kind !== "member") return null;
  return { workspace: row.workspace, user: row.user, admin: row.admin ?? false, ...profileOf(row) };
}

export async function adminsIn(ctx: QueryCtx, workspace: string): Promise<ChatUserId[]> {
  const members = await ctx.db
    .query("members")
    .withIndex("by_admin", (q) => q.eq("workspace", workspace).eq("admin", true))
    .collect();
  return members.filter(({ kind }) => kind === "member").map(({ user }) => user);
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

export const fillProfiles = internalMutation({
  args: { profiles: v.array(v.object({ workspace: v.string(), user: v.string(), profile: v.object(memberProfileFields), asOf: v.number() })) },
  handler: async (ctx, { profiles }) => {
    const changed: MemberId[] = [];
    for (const { workspace, user, profile, asOf } of profiles) {
      const row = await memberRow(ctx, workspace, user);
      if (row?.kind !== "member" || isOlder(asOf, row.asOf) || isOlder(asOf, row.profileAsOf) || !differsFrom(row, profile)) continue;
      await ctx.db.patch(row._id, { ...profile, profileAsOf: asOf });
      changed.push(row._id);
    }
    await followMembersLater(ctx, changed);
  },
});

function differsFrom(row: Doc<"members">, profile: MemberProfile) {
  return memberProfileFieldNames.some((field) => profile[field] !== undefined && row[field] !== profile[field]);
}

export async function record(ctx: MutationCtx, { workspace, user, entry, asOf }: DirectoryRecord) {
  const row = { workspace, user, timeZone: undefined, asOf, ...entry };
  const existing = await memberRow(ctx, workspace, user);
  if (existing === null) {
    await ctx.db.insert("members", row);
    await reconcileUser(ctx, workspace, user, Date.now());
  } else if (!isOlder(asOf, existing.asOf)) {
    await replace(ctx, existing, keepingNewerProfile(existing, row));
    await followMembersLater(ctx, [existing._id]);
  }
}

type MemberRow = WithoutSystemFields<Doc<"members">>;

function keepingNewerProfile(existing: Doc<"members">, row: MemberRow): MemberRow {
  if (existing.kind !== "member" || row.kind !== "member" || !isOlder(row.asOf ?? 0, existing.profileAsOf)) return row;
  return { ...withoutProfile(row), ...profileOf(existing), profileAsOf: existing.profileAsOf };
}

function withoutProfile(row: MemberRow): MemberRow {
  const isProfileField = (field: string) => (memberProfileFieldNames as string[]).includes(field);
  return Object.fromEntries(Object.entries(row).filter(([field]) => !isProfileField(field))) as MemberRow;
}

function profileOf(row: Doc<"members">): MemberProfile {
  return Object.fromEntries(memberProfileFieldNames.flatMap((field) => (row[field] === undefined ? [] : [[field, row[field]]])));
}

export async function currentMembersOf(ctx: QueryCtx, workspace: string): Promise<MemberId[]> {
  const people = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace))
    .collect();
  return people.filter(({ kind }) => kind === "member").map(({ _id }) => _id);
}

export async function teammatesOf(ctx: QueryCtx, workspace: string, member: MemberId): Promise<MemberId[]> {
  return (await currentMembersOf(ctx, workspace)).filter((teammate) => teammate !== member);
}

async function replace(ctx: MutationCtx, existing: Doc<"members">, row: MemberRow) {
  await ctx.db.replace(existing._id, row);
  const membership = { workspace: row.workspace, member: existing._id, at: Date.now() };
  if (existing.kind === "member" && row.kind !== "member") await publish(ctx, { type: "memberLeft", ...membership });
  if (existing.kind !== "member" && row.kind === "member") await publish(ctx, { type: "memberRejoined", ...membership });
  if ((existing.kind === "member") !== (row.kind === "member")) await reconcileMember(ctx, existing._id, Date.now());
}

export function isOlder(asOf: number, known: number | undefined) {
  return known !== undefined && asOf < known;
}

function memberRow(ctx: QueryCtx, workspace: string, user: ChatUserId) {
  return ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
}
