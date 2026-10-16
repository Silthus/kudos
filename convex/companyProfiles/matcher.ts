import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { chatUserOf, memberRowsIn, type MemberId, type MemberRows } from "../workspace/directory";
import { normalisedName } from "./faces";

export type MatchedBy = "name" | "self" | "admin";

export type CompanyProfile = { profile: number; firstName: string; lastName: string; image?: string; colour: string; teams: string[]; role?: string };

export type ProfileMatch = { profile: CompanyProfile; by: MatchedBy } | { profile: null; by: "admin" };

export type CompanyProfiles = { profiles: CompanyProfile[]; matches: Map<MemberId, ProfileMatch>; holders: Map<number, MemberId> };

type Link = Doc<"companyProfileLinks">;

export function publicNameOf({ firstName, lastName }: CompanyProfile) {
  return `${firstName.trim()} ${lastName.trim()}`;
}

export async function companyProfileOf(ctx: QueryCtx, member: MemberId): Promise<ProfileMatch | null> {
  const { workspace } = await chatUserOf(ctx, member);
  return (await companyProfilesIn(ctx, workspace)).matches.get(member) ?? null;
}

export async function companyProfilesIn(ctx: QueryCtx, workspace: string, members?: MemberRows): Promise<CompanyProfiles> {
  const profiles = await currentProfiles(ctx);
  const names = currentMemberNames(members ?? (await memberRowsIn(ctx, workspace)));
  const links = (await linksIn(ctx, workspace)).filter(({ member }) => names.has(member)).sort(earlierFirst);
  const byId = new Map(profiles.map((profile) => [profile.profile, profile]));
  const matches = new Map<MemberId, ProfileMatch>();
  const holders = new Map<number, MemberId>();
  const give = (member: MemberId, profile: CompanyProfile | undefined, by: MatchedBy) => {
    if (profile === undefined || holders.has(profile.profile)) return;
    holders.set(profile.profile, member);
    matches.set(member, { profile, by });
  };
  const adminLinks = links.filter(({ by }) => by === "admin");
  const decidedByAdmin = new Set(adminLinks.map(({ member }) => member));
  for (const { member, profile } of adminLinks) {
    if (profile !== null) give(member, byId.get(profile), "admin");
    if (!matches.has(member)) matches.set(member, { profile: null, by: "admin" });
  }
  const selfLinks = links.filter(({ by, member }) => by === "self" && !decidedByAdmin.has(member));
  for (const { member, profile } of selfLinks) {
    if (profile !== null) give(member, byId.get(profile), "self");
  }
  const linked = new Set(selfLinks.map(({ member }) => member));
  for (const [member, profile] of nameMatches(names, profiles)) {
    if (!decidedByAdmin.has(member) && !linked.has(member)) give(member, profile, "name");
  }
  return { profiles, matches, holders };
}

function nameMatches(names: Map<MemberId, string>, profiles: CompanyProfile[]): Map<MemberId, CompanyProfile> {
  const membersNamed = groupedBy([...names.keys()], (member) => names.get(member)!);
  const profilesNamed = groupedBy(profiles, ({ firstName, lastName }) => normalisedName(`${firstName} ${lastName}`));
  const pairs = new Map<MemberId, CompanyProfile>();
  for (const [name, members] of membersNamed) {
    const namesakes = profilesNamed.get(name) ?? [];
    if (name !== "" && members.length === 1 && namesakes.length === 1) pairs.set(members[0]!, namesakes[0]!);
  }
  return pairs;
}

function groupedBy<Item>(items: Item[], keyOf: (item: Item) => string): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return groups;
}

export async function currentProfiles(ctx: QueryCtx): Promise<CompanyProfile[]> {
  const rows = await ctx.db.query("companyProfiles").collect();
  return rows.flatMap(({ profile, firstName, lastName, image, colour, teams, role }) =>
    profile === undefined ? [] : [{ profile, firstName, lastName, colour, teams: teams ?? [], ...(image !== undefined && { image }), ...(role !== undefined && { role }) }],
  );
}

function currentMemberNames(rows: MemberRows): Map<MemberId, string> {
  return new Map(rows.flatMap((row) => (row.kind === "member" ? [[row._id, normalisedName(row.realName ?? row.name ?? "")] as const] : [])));
}

function linksIn(ctx: QueryCtx, workspace: string): Promise<Link[]> {
  return ctx.db
    .query("companyProfileLinks")
    .withIndex("by_member", (q) => q.eq("workspace", workspace))
    .collect();
}

function earlierFirst(one: Link, other: Link) {
  return one.at - other.at || one._creationTime - other._creationTime;
}
