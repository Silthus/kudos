import { companyProfilesIn, publicNameOf, type CompanyProfile } from "../companyProfiles/matcher";
import { companyTeamsOf, type CompanyTeam, type TeamCrestArt } from "../companyProfiles/teams";
import { crestNamed } from "../hoggies/catalogue";
import type { QueryCtx } from "../_generated/server";
import type { MemberId, MemberRows } from "../workspace/directory";
import type { AlbumOwner } from "./albums";
import type { HeldSticker } from "./records";

export type CollectedCrest = { crest: string; collectedAt: number };

export type PersonOnPage = { person: MemberId; profile: CompanyProfile; lead: boolean; held: boolean; heldAt: number | null };

export type UnmatchedPerson = { name: string; role: string | null };

export type TeamPageOf = {
  team: string;
  name: string;
  art: TeamCrestArt;
  mine: boolean;
  listed: boolean;
  leads: string[];
  held: number;
  total: number;
  unmatched: number;
  complete: boolean;
  people: PersonOnPage[];
  unmatchedPeople: UnmatchedPerson[];
  crest: { collectedAt: number } | null;
};

export type TeamPagesFrom = { members: MemberRows; stickers: HeldSticker[]; crests: CollectedCrest[] };

type Held = { stickers: Map<MemberId, number>; crests: Map<string, number> };

type Company = { profiles: Map<number, CompanyProfile>; holders: Map<number, MemberId> };

export async function teamPagesOf(ctx: QueryCtx, owner: AlbumOwner, { members, stickers, crests }: TeamPagesFrom): Promise<TeamPageOf[]> {
  const { profiles, holders } = await companyProfilesIn(ctx, owner.workspace, members);
  const company = { profiles: new Map(profiles.map((profile) => [profile.profile, profile])), holders };
  const teams = await companyTeamsOf(ctx);
  const held = { stickers: new Map(stickers.map(({ person, firstAt }) => [person, firstAt])), crests: new Map(crests.map(({ crest, collectedAt }) => [crest, collectedAt])) };
  const onPostHogCom = new Set(teams.map(({ team }) => team));
  const listed = teams.map((team) => listedPageOf(owner.member, team, company, held));
  const unlisted = crests.filter(({ crest }) => !onPostHogCom.has(crest)).flatMap(unlistedPageOf);
  return [...listed, ...unlisted].toSorted(mineFirstThenByName);
}

function listedPageOf(owner: MemberId, { team, name, crest, leads, people }: CompanyTeam, { profiles, holders }: Company, held: Held): TeamPageOf {
  const onTeam = people.flatMap((id) => profiles.get(id) ?? []);
  const matched = onTeam.flatMap((profile) => {
    const person = holders.get(profile.profile);
    return person === undefined || person === owner ? [] : [personOf(person, profile, leads, held)];
  });
  const unmatched = onTeam.filter(({ profile }) => !holders.has(profile));
  const heldCount = matched.filter((person) => person.held).length;
  const collectedAt = held.crests.get(team);
  return {
    team,
    name,
    art: crest,
    mine: onTeam.some(({ profile }) => holders.get(profile) === owner),
    listed: true,
    leads: leads.flatMap((id) => profiles.get(id) ?? []).map(publicNameOf),
    held: heldCount,
    total: matched.length,
    unmatched: unmatched.length,
    complete: matched.length > 0 && heldCount === matched.length,
    people: matched,
    unmatchedPeople: unmatched.map((profile) => ({ name: publicNameOf(profile), role: profile.role ?? null })),
    crest: collectedAt === undefined ? null : { collectedAt },
  };
}

function personOf(person: MemberId, profile: CompanyProfile, leads: number[], { stickers }: Held): PersonOnPage {
  const heldAt = stickers.get(person) ?? null;
  return { person, profile, lead: leads.includes(profile.profile), held: heldAt !== null, heldAt };
}

function unlistedPageOf({ crest, collectedAt }: CollectedCrest): TeamPageOf[] {
  const entry = crestNamed(crest);
  if (entry === undefined) return [];
  return [
    {
      team: crest,
      name: entry.name,
      art: { kind: "crest", slug: crest },
      mine: false,
      listed: false,
      leads: [],
      held: 0,
      total: 0,
      unmatched: 0,
      complete: false,
      people: [],
      unmatchedPeople: [],
      crest: { collectedAt },
    },
  ];
}

function mineFirstThenByName(first: TeamPageOf, second: TeamPageOf) {
  return Number(second.mine) - Number(first.mine) || first.name.localeCompare(second.name);
}
