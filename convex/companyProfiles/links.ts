import type { MutationCtx, QueryCtx } from "../_generated/server";
import { chatUserOf, type MemberId } from "../workspace/directory";
import type { CompanyFace } from "./faces";
import { companyProfilesIn, type CompanyProfile, type CompanyProfiles, type MatchedBy } from "./matcher";
import { companyTeamsOf } from "./teams";

export type ProfileChoice = { profile: number; name: string; role: string | null; teams: string[]; face: CompanyFace | null };

export type CompanyProfileSetting = { mine: ProfileChoice | null; by: MatchedBy | null; choices: ProfileChoice[] };

export type SelfLinkRefusal = "matched" | "taken" | "unknown";

export type SelfLinkOutcome = { kind: "linked"; profile: number | null } | { kind: "refused"; reason: SelfLinkRefusal; profile: number | null };

export async function companyProfileSettingOf(ctx: QueryCtx, member: MemberId): Promise<CompanyProfileSetting> {
  const { workspace } = await chatUserOf(ctx, member);
  const { profiles, matches, holders } = await companyProfilesIn(ctx, workspace);
  const choiceOf = await choicesFrom(ctx);
  const mine = matches.get(member);
  const free = profiles.filter(({ profile }) => (holders.get(profile) ?? member) === member);
  return { mine: mine?.profile ? choiceOf(mine.profile) : null, by: mine?.by ?? null, choices: free.map(choiceOf).sort(byName) };
}

export async function linkMyCompanyProfile(ctx: MutationCtx, member: MemberId, profile: number | null): Promise<SelfLinkOutcome> {
  const { workspace } = await chatUserOf(ctx, member);
  const link = await ctx.db
    .query("companyProfileLinks")
    .withIndex("by_member", (q) => q.eq("workspace", workspace).eq("member", member).eq("by", "self"))
    .unique();
  const clearsOwnLink = profile === null && link !== null;
  const refusal = clearsOwnLink ? null : refusalOf(await companyProfilesIn(ctx, workspace), member, profile);
  if (refusal !== null) return { kind: "refused", reason: refusal, profile };
  if (profile === null && link !== null) await ctx.db.delete(link._id);
  else if (profile !== null && link === null) await ctx.db.insert("companyProfileLinks", { workspace, member, profile, by: "self", setBy: member, at: Date.now() });
  else if (profile !== null && link !== null && link.profile !== profile) await ctx.db.patch(link._id, { profile, at: Date.now() });
  return { kind: "linked", profile };
}

function refusalOf({ profiles, matches, holders }: CompanyProfiles, member: MemberId, profile: number | null): SelfLinkRefusal | null {
  const mine = matches.get(member);
  if (mine !== undefined && mine.by !== "self") return "matched";
  if (profile === null) return null;
  if (!profiles.some((each) => each.profile === profile)) return "unknown";
  return (holders.get(profile) ?? member) === member ? null : "taken";
}

export async function choicesFrom(ctx: QueryCtx): Promise<(profile: CompanyProfile) => ProfileChoice> {
  const teamNames = new Map((await companyTeamsOf(ctx)).map(({ team, name }) => [team, name]));
  return ({ profile, firstName, lastName, role, teams, image, colour }) => ({
    profile,
    name: `${firstName.trim()} ${lastName.trim()}`,
    role: role ?? null,
    teams: teams.flatMap((team) => teamNames.get(team) ?? []),
    face: image === undefined ? null : { image, colour },
  });
}

export function byName(one: ProfileChoice, other: ProfileChoice) {
  return one.name.localeCompare(other.name) || one.profile - other.profile;
}
