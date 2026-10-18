import type { MutationCtx, QueryCtx } from "../_generated/server";
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

export async function keepCompanyFaces(ctx: MutationCtx, workspace: string) {
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

export async function keepCompanyFacesInEveryWorkspace(ctx: MutationCtx) {
  const workspaces = new Set((await ctx.db.query("workspaces").collect()).map(({ workspace }) => workspace));
  for (const workspace of workspaces) await keepCompanyFaces(ctx, workspace);
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
