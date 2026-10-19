import type { QueryCtx } from "../_generated/server";
import type { CompanyFace } from "../companyProfiles/faces";
import { storedHoldersIn, type StoredHolder } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type CompanyTeam, type TeamCrestArt } from "../companyProfiles/teams";
import type { MemberId } from "../workspace/directory";
import { peopleHeldBy } from "./stickers";
import type { TeamSticker } from "./records";

export type TeamState = "progress" | "ready" | "unlocked";

export type TeamPage = {
  team: string;
  name: string;
  art: TeamCrestArt;
  mine: boolean;
  people: MemberId[];
  unmatched: number[];
  held: number;
  total: number;
  state: TeamState;
  unlockedAt: number | null;
};

export type PageOwner = { workspace: string; member: MemberId };

export type StoredMatch = { profile: number; face: CompanyFace | null };

export type TeamPagesAndPeople = { pages: TeamPage[]; held: Set<MemberId>; matchOf: Map<MemberId, StoredMatch> };

export async function teamPagesOf(ctx: QueryCtx, owner: PageOwner): Promise<TeamPage[]> {
  return (await teamPagesAndPeopleOf(ctx, owner)).pages;
}

export async function teamPagesAndPeopleOf(ctx: QueryCtx, { workspace, member }: PageOwner): Promise<TeamPagesAndPeople> {
  const holders = await storedHoldersIn(ctx, workspace);
  const held = await peopleHeldBy(ctx, member);
  const unlocked = await teamStickersOf(ctx, member);
  const teams = await companyTeamsOf(ctx);
  const onPostHogCom = new Set(teams.map(({ team }) => team));
  const listed = teams.map((team) => pageOf(team, member, holders, held, unlocked.get(team.team)));
  const gone = [...unlocked.values()].filter(({ team }) => !onPostHogCom.has(team)).map(goneTeamPageOf);
  return { pages: [...listed, ...gone].sort(inSidebarOrder), held, matchOf: new Map([...holders].map(([profile, { member, face }]) => [member, { profile, face }])) };
}

async function teamStickersOf(ctx: QueryCtx, member: MemberId): Promise<Map<string, TeamSticker>> {
  const stickers = await ctx.db
    .query("teamStickers")
    .withIndex("by_member_team", (q) => q.eq("member", member))
    .collect();
  return new Map(stickers.map(({ team, name, art, emoji, at }) => [team, { team, name, art, emoji, at }]));
}

export function isComplete({ held, total }: Pick<TeamPage, "held" | "total">) {
  return total > 0 && held === total;
}

function pageOf({ team, name, crest, people }: CompanyTeam, member: MemberId, holders: Map<number, StoredHolder>, held: Set<MemberId>, sticker: TeamSticker | undefined): TeamPage {
  const matched = people.flatMap((profile) => holders.get(profile)?.member ?? []);
  const others = matched.filter((person) => person !== member);
  const counted = { held: others.filter((person) => held.has(person)).length, total: others.length };
  const page = { team, name, art: crest, mine: matched.includes(member), people: others, unmatched: people.filter((profile) => !holders.has(profile)), ...counted };
  if (sticker !== undefined) return { ...page, ...shownAsUnlocked(sticker) };
  return { ...page, state: isComplete(counted) ? "ready" : "progress", unlockedAt: null };
}

function goneTeamPageOf(sticker: TeamSticker): TeamPage {
  return { team: sticker.team, mine: false, people: [], unmatched: [], held: 0, total: 0, ...shownAsUnlocked(sticker) };
}

function shownAsUnlocked({ name, art, at }: TeamSticker) {
  return { name, art, state: "unlocked" as const, unlockedAt: at };
}

function inSidebarOrder(one: TeamPage, other: TeamPage) {
  return firstWhere(one.mine, other.mine) || firstWhere(one.state === "ready", other.state === "ready") || other.held - one.held || one.name.localeCompare(other.name) || one.team.localeCompare(other.team);
}

function firstWhere(one: boolean, other: boolean) {
  return Number(other) - Number(one);
}
