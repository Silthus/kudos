import type { QueryCtx } from "../_generated/server";
import { storedHoldersIn } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type CompanyTeam } from "../companyProfiles/teams";
import type { MemberId } from "../workspace/directory";
import { peopleHeldBy } from "./stickers";

export type TeamPage = { team: string; name: string; mine: boolean; people: MemberId[]; held: number; total: number };

export type PageOwner = { workspace: string; member: MemberId };

export async function teamPagesOf(ctx: QueryCtx, { workspace, member }: PageOwner): Promise<TeamPage[]> {
  const holders = await storedHoldersIn(ctx, workspace);
  const held = await peopleHeldBy(ctx, member);
  const pages = (await companyTeamsOf(ctx)).map((team) => pageOf(team, member, holders, held));
  return pages.sort(inSidebarOrder);
}

export function isComplete({ held, total }: Pick<TeamPage, "held" | "total">) {
  return total > 0 && held === total;
}

function pageOf({ team, name, people }: CompanyTeam, member: MemberId, holders: Map<number, MemberId>, held: Set<MemberId>): TeamPage {
  const matched = people.flatMap((profile) => holders.get(profile) ?? []);
  const others = matched.filter((person) => person !== member);
  return { team, name, mine: matched.includes(member), people: others, held: others.filter((person) => held.has(person)).length, total: others.length };
}

function inSidebarOrder(one: TeamPage, other: TeamPage) {
  return firstWhere(one.mine, other.mine) || firstWhere(isComplete(one), isComplete(other)) || other.held - one.held || one.name.localeCompare(other.name) || one.team.localeCompare(other.team);
}

function firstWhere(one: boolean, other: boolean) {
  return Number(other) - Number(one);
}
