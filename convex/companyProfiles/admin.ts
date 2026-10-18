import type { MutationCtx, QueryCtx } from "../_generated/server";
import { peopleIn, personFactsOf, type MemberId } from "../workspace/directory";
import { byName, choicesFrom, type ProfileChoice } from "./links";
import { companyProfilesIn, currentProfiles, type MatchedBy } from "./matcher";
import { keepCompanyFacesLater } from "./storedFaces";

export type MemberMatch = { member: MemberId; name: string; profile: number | null; by: MatchedBy | null };

export type HeldProfile = ProfileChoice & { heldBy: MemberId | null; by: MatchedBy | null };

export type WorkspaceMatches = { members: MemberMatch[]; profiles: HeldProfile[] };

export type AdminLinkTarget = number | "none" | null;

export type AdminLinkRefusal = "not-admin" | "unknown";

export type AdminLinkOutcome = { kind: "linked"; member: MemberId } | { kind: "refused"; reason: AdminLinkRefusal; member: MemberId | null };

type Caller = { member: MemberId; admin: boolean };

export async function workspaceMatchesOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceMatches> {
  const { profiles, matches, holders } = await companyProfilesIn(ctx, workspace);
  const people = await peopleIn(ctx, workspace);
  const choiceOf = await choicesFrom(ctx);
  const members = [...people].flatMap(([member, { name, former }]) => {
    if (former) return [];
    const match = matches.get(member);
    return [{ member, name: name ?? "", profile: match?.profile?.profile ?? null, by: match?.by ?? null }];
  });
  const held = profiles.map((profile) => {
    const holder = holders.get(profile.profile) ?? null;
    return { ...choiceOf(profile), heldBy: holder, by: holder === null ? null : matches.get(holder)!.by };
  });
  return { members: members.sort(memberByName), profiles: held.sort(byName) };
}

export async function linkCompanyProfile(ctx: MutationCtx, workspace: string, caller: Caller, member: MemberId | null, profile: AdminLinkTarget): Promise<AdminLinkOutcome> {
  if (!caller.admin) return { kind: "refused", reason: "not-admin", member };
  if (member === null || !(await isCurrentMemberOf(ctx, workspace, member)) || !(await isKnownProfile(ctx, profile))) return { kind: "refused", reason: "unknown", member };
  const link = await adminLinkOf(ctx, workspace, member);
  if (profile === null) {
    if (link !== null) await ctx.db.delete(link._id);
    await keepCompanyFacesLater(ctx, workspace);
    return { kind: "linked", member };
  }
  const linked = profile === "none" ? null : profile;
  if (linked !== null) await deleteOtherAdminLinksTo(ctx, workspace, linked, member);
  const change = { profile: linked, setBy: caller.member, at: Date.now() };
  if (link === null) await ctx.db.insert("companyProfileLinks", { workspace, member, by: "admin", ...change });
  else if (link.profile !== linked) await ctx.db.patch(link._id, change);
  await keepCompanyFacesLater(ctx, workspace);
  return { kind: "linked", member };
}

async function isCurrentMemberOf(ctx: QueryCtx, workspace: string, member: MemberId) {
  return (await personFactsOf(ctx, member))?.workspace === workspace;
}

async function isKnownProfile(ctx: QueryCtx, profile: AdminLinkTarget) {
  if (typeof profile !== "number") return true;
  return (await currentProfiles(ctx)).some((each) => each.profile === profile);
}

function adminLinkOf(ctx: QueryCtx, workspace: string, member: MemberId) {
  return ctx.db
    .query("companyProfileLinks")
    .withIndex("by_member", (q) => q.eq("workspace", workspace).eq("member", member).eq("by", "admin"))
    .unique();
}

async function deleteOtherAdminLinksTo(ctx: MutationCtx, workspace: string, profile: number, member: MemberId) {
  const links = await ctx.db
    .query("companyProfileLinks")
    .withIndex("by_profile", (q) => q.eq("workspace", workspace).eq("profile", profile))
    .collect();
  for (const link of links) if (link.by === "admin" && link.member !== member) await ctx.db.delete(link._id);
}

function memberByName(one: MemberMatch, other: MemberMatch) {
  return one.name.localeCompare(other.name) || one.member.localeCompare(other.member);
}
