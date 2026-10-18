import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { memberRowsIn, type MemberId } from "../workspace/directory";
import type { CompanyFace } from "./faces";
import { companyProfilesIn } from "./matcher";

export async function storedCompanyFaceOf(ctx: QueryCtx, workspace: string, member: MemberId): Promise<CompanyFace | null | undefined> {
  const row = await ctx.db
    .query("companyFaces")
    .withIndex("by_member", (q) => q.eq("workspace", workspace).eq("member", member))
    .unique();
  return row?.face;
}

async function keepCompanyFaces(ctx: MutationCtx, workspace: string) {
  const matched = await matchedFacesIn(ctx, workspace);
  const stored = await ctx.db
    .query("companyFaces")
    .withIndex("by_member", (q) => q.eq("workspace", workspace))
    .collect();
  for (const row of stored) {
    const face = matched.get(row.member);
    if (face === undefined) await ctx.db.delete(row._id);
    else if (!sameFace(face, row.face)) await ctx.db.patch(row._id, { face });
    matched.delete(row.member);
  }
  for (const [member, face] of matched) await ctx.db.insert("companyFaces", { workspace, member, face });
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

async function matchedFacesIn(ctx: QueryCtx, workspace: string): Promise<Map<MemberId, CompanyFace | null>> {
  const members = await memberRowsIn(ctx, workspace);
  const { matches } = await companyProfilesIn(ctx, workspace, members);
  const faceOf = (member: MemberId) => {
    const profile = matches.get(member)?.profile;
    return profile?.image === undefined ? null : { image: profile.image, colour: profile.colour };
  };
  return new Map(members.filter(({ kind }) => kind === "member").map(({ _id }) => [_id, faceOf(_id)]));
}

function sameFace(one: CompanyFace | null, other: CompanyFace | null) {
  return one?.image === other?.image && one?.colour === other?.colour;
}
