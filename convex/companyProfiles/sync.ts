import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { normalisedName } from "./faces";

const teamPages = "https://better-animal-d658c56969.strapiapp.com/api/teams";
const cutouts = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+\.png)$/;
const cutoutSize = "c_limit,w_160,f_auto,q_auto/";
const mostPages = 10;

const profileColours: Record<string, string> = {
  blue: "#2F80FA",
  green: "#6AA84F",
  lilac: "#8567FF",
  "lime-green": "#96E5B6",
  orange: "#EB9D2A",
  purple: "#B62AD9",
  red: "#F54E00",
  salmon: "#F35454",
  seagreen: "#30ABC6",
  "sky-blue": "#2EA2D3",
  teal: "#29DBBB",
  yellow: "#F7A501",
};
const neutralColour = "#EEEFE9";

const companyProfile = v.object({
  firstName: v.string(),
  lastName: v.string(),
  normalisedName: v.string(),
  image: v.optional(v.string()),
  colour: v.string(),
  team: v.optional(v.string()),
});

type CompanyProfile = Infer<typeof companyProfile>;

type Read = { kind: "read"; profiles: CompanyProfile[] } | { kind: "failed"; reason: "unreachable" | "malformed" | "empty" };

export const syncCompanyProfiles = observedAction({
  args: {},
  handler: async (ctx): Promise<null> => {
    const read = await readTeamPages();
    if (read.kind === "failed") {
      console.warn("companyProfiles.read_failed", { reason: read.reason });
      return null;
    }
    await ctx.runMutation(internal.companyProfiles.sync.replaceCompanyProfiles, { profiles: read.profiles });
    return null;
  },
});

export const replaceCompanyProfiles = internalMutation({
  args: { profiles: v.array(companyProfile) },
  handler: async (ctx, { profiles }) => {
    for (const previous of await ctx.db.query("companyProfiles").collect()) await ctx.db.delete(previous._id);
    for (const profile of profiles) await ctx.db.insert("companyProfiles", profile);
  },
});

async function readTeamPages(): Promise<Read> {
  const teams: Team[] = [];
  let pageCount = 1;
  for (let page = 1; page <= pageCount; page++) {
    const response = await pageOf(page);
    if (response === undefined) return { kind: "failed", reason: "unreachable" };
    const parsed = teamsPage(await response.json().catch(() => undefined));
    if (parsed === undefined || !isConsistent(parsed, page, pageCount)) return { kind: "failed", reason: "malformed" };
    pageCount = parsed.pageCount;
    teams.push(...parsed.teams);
  }
  const profiles = profilesOf(teams);
  return profiles.length === 0 ? { kind: "failed", reason: "empty" } : { kind: "read", profiles };
}

async function pageOf(page: number): Promise<Response | undefined> {
  const url = new URL(teamPages);
  url.searchParams.set("fields[0]", "slug");
  url.searchParams.set("populate[profiles][fields][0]", "firstName");
  url.searchParams.set("populate[profiles][fields][1]", "lastName");
  url.searchParams.set("populate[profiles][fields][2]", "color");
  url.searchParams.set("populate[profiles][populate][avatar][fields][0]", "url");
  url.searchParams.set("pagination[pageSize]", "100");
  url.searchParams.set("pagination[page]", String(page));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return response.ok ? response : undefined;
  } catch {
    return undefined;
  }
}

type TeamProfile = { id: number; firstName: string; lastName: string; colour: unknown; cutout: unknown };
type Team = { slug?: string; profiles: TeamProfile[] };

type TeamsPage = { teams: Team[]; page: number; pageCount: number };

function teamsPage(body: unknown): TeamsPage | undefined {
  const page = at(body, "meta", "pagination", "page");
  const pageCount = at(body, "meta", "pagination", "pageCount");
  const data = at(body, "data");
  if (typeof page !== "number" || typeof pageCount !== "number" || !Array.isArray(data)) return undefined;
  const teams = data.map(teamOf);
  return teams.every((team) => team !== undefined) ? { teams, page, pageCount } : undefined;
}

function isConsistent(parsed: TeamsPage, page: number, pageCountSoFar: number) {
  const firstPage = page === 1;
  const pageCountHolds = firstPage ? Number.isInteger(parsed.pageCount) && parsed.pageCount >= 1 && parsed.pageCount <= mostPages : parsed.pageCount === pageCountSoFar;
  const teamsHold = firstPage || parsed.teams.length > 0;
  return parsed.page === page && pageCountHolds && teamsHold;
}

function teamOf(team: unknown): Team | undefined {
  const slug = at(team, "attributes", "slug");
  const profiles = at(team, "attributes", "profiles", "data");
  if ((typeof slug !== "string" && slug !== null && slug !== undefined) || !Array.isArray(profiles)) return undefined;
  const parsed = profiles.map(profileOf);
  if (!parsed.every((profile) => profile !== undefined)) return undefined;
  return typeof slug === "string" ? { slug, profiles: parsed } : { profiles: parsed };
}

function profileOf(profile: unknown): TeamProfile | undefined {
  const id = at(profile, "id");
  const firstName = at(profile, "attributes", "firstName");
  const lastName = at(profile, "attributes", "lastName");
  if (typeof id !== "number" || typeof firstName !== "string" || typeof lastName !== "string") return undefined;
  return { id, firstName, lastName, colour: at(profile, "attributes", "color"), cutout: at(profile, "attributes", "avatar", "data", "attributes", "url") };
}

function profilesOf(teams: Team[]): CompanyProfile[] {
  const seen = new Set<number>();
  const profiles: CompanyProfile[] = [];
  for (const team of teams) {
    for (const profile of team.profiles) {
      const image = sizedCutout(profile.cutout);
      const name = normalisedName(`${profile.firstName} ${profile.lastName}`);
      if (seen.has(profile.id) || name === "") continue;
      seen.add(profile.id);
      profiles.push({
        firstName: profile.firstName,
        lastName: profile.lastName,
        normalisedName: name,
        ...(image !== undefined && { image }),
        colour: colourOf(profile.colour),
        ...(team.slug !== undefined && { team: team.slug }),
      });
    }
  }
  return profiles;
}

function sizedCutout(cutout: unknown) {
  const parts = typeof cutout === "string" ? cutouts.exec(cutout) : null;
  return parts === null ? undefined : `${parts[1]}${cutoutSize}${parts[2]}`;
}

function colourOf(name: unknown) {
  return typeof name === "string" && Object.hasOwn(profileColours, name) ? profileColours[name]! : neutralColour;
}

function at(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (typeof current === "object" && current !== null ? (current as Record<string, unknown>)[key] : undefined), value);
}
