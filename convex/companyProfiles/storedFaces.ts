import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { memberRowsIn, type MemberId } from "../workspace/directory";
import type { CompanyFace } from "./faces";
import { companyProfilesIn } from "./matcher";

export type StoredCompanyMatch = { face: CompanyFace | null; profile: number | null };

export async function storedCompanyFaceOf(ctx: QueryCtx, workspace: string, member: MemberId): Promise<CompanyFace | null | undefined> {
  return (await storedCompanyMatchOf(ctx, workspace, member))?.face;
}

export async function storedCompanyMatchOf(ctx: QueryCtx, workspace: string, member: MemberId): Promise<StoredCompanyMatch | undefined> {
  const row = await ctx.db
    .query("companyFaces")
    .withIndex("by_member", (q) => q.eq("workspace", workspace).eq("member", member))
    .unique();
  return row === null ? undefined : { face: row.face, profile: row.profile ?? null };
}

async function keepCompanyFaces(ctx: MutationCtx, workspace: string) {
  const matched = await matchesIn(ctx, workspace);
  const stored = await ctx.db
    .query("companyFaces")
    .withIndex("by_member", (q) => q.eq("workspace", workspace))
    .collect();
  for (const row of stored) {
    const match = matched.get(row.member);
    if (match === undefined) await ctx.db.delete(row._id);
    else if (!sameMatch(match, { face: row.face, profile: row.profile ?? null })) await ctx.db.patch(row._id, storedFieldsOf(match));
    matched.delete(row.member);
  }
  for (const [member, match] of matched) await ctx.db.insert("companyFaces", { workspace, member, ...storedFieldsOf(match) });
}

export const keepCompanyFacesIn = internalMutation({
  args: { workspace: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspace }) => {
    await keepCompanyFaces(ctx, workspace);
    return null;
  },
});

export async function keepCompanyFacesLater(ctx: MutationCtx, workspace: string) {
  await ctx.scheduler.runAfter(0, internal.companyProfiles.storedFaces.keepCompanyFacesIn, { workspace });
}

export async function keepCompanyFacesInEveryWorkspaceLater(ctx: MutationCtx) {
  for (const workspace of await workspacesWithFacesToKeep(ctx)) await keepCompanyFacesLater(ctx, workspace);
}

async function workspacesWithFacesToKeep(ctx: QueryCtx) {
  const workspaces = new Set((await ctx.db.query("workspaces").collect()).map(({ workspace }) => workspace));
  for (let row = await firstFaceAfter(ctx, ""); row !== null; row = await firstFaceAfter(ctx, row.workspace)) workspaces.add(row.workspace);
  return workspaces;
}

function firstFaceAfter(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("companyFaces")
    .withIndex("by_member", (q) => q.gt("workspace", workspace))
    .first();
}

async function matchesIn(ctx: QueryCtx, workspace: string): Promise<Map<MemberId, StoredCompanyMatch>> {
  const members = await memberRowsIn(ctx, workspace);
  const { matches } = await companyProfilesIn(ctx, workspace, members);
  const matchOf = (member: MemberId): StoredCompanyMatch => {
    const profile = matches.get(member)?.profile ?? null;
    return { face: profile?.image === undefined ? null : { image: profile.image, colour: profile.colour }, profile: profile?.profile ?? null };
  };
  return new Map(members.filter(({ kind }) => kind === "member").map(({ _id }) => [_id, matchOf(_id)]));
}

function storedFieldsOf({ face, profile }: StoredCompanyMatch) {
  return { face, profile: profile ?? undefined };
}

function sameMatch(one: StoredCompanyMatch, other: StoredCompanyMatch) {
  return one.face?.image === other.face?.image && one.face?.colour === other.face?.colour && one.profile === other.profile;
}
