import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { crestNamed } from "../hoggies/catalogue";

export type TeamCrestArt = { kind: "crest"; slug: string } | { kind: "image"; url: string } | null;

export type CompanyTeam = { team: string; name: string; crest: TeamCrestArt; leads: number[]; people: number[] };

export async function companyTeamsOf(ctx: QueryCtx): Promise<CompanyTeam[]> {
  const teams = await ctx.db.query("companyTeams").collect();
  return teams.map(({ team, name, crestImage, leads, people }) => ({ team, name, crest: crestArtOf(team, crestImage), leads, people }));
}

export async function crestImagesOf(ctx: QueryCtx): Promise<Map<string, string | undefined>> {
  return new Map((await ctx.db.query("companyTeams").collect()).map(({ team, crestImage }) => [team, crestImage]));
}

export function crestArtOf(team: string, crestImage: Doc<"companyTeams">["crestImage"]): TeamCrestArt {
  if (crestNamed(team) !== undefined) return { kind: "crest", slug: team };
  return crestImage === undefined ? null : { kind: "image", url: crestImage };
}
