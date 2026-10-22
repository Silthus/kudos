import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { memberDecisionWithoutWriting, workspaceDecisionWithoutWriting, type Flag } from "../analytics/flags";
import { personTeamsOf } from "../album/personPage";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import { profileCardOf, type Medal } from "../profileCard/profileCard";
import { isAPersonOf, lookup, nameAndPictureOf, type MemberId } from "../workspace/directory";
import { cardReadsOf, personStatsOf, teamStatsOf, type CardReads, type PersonStats, type TeamStats } from "./linkCardStats";
import { siteOriginFor } from "./link";

export const linkPreviewsFlag = { key: "link-previews", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const richLinkCardsFlag = { key: "rich-link-cards", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export type PersonPreview = { kind: "person"; url: string; page: string; name: string; picture: string | null; teams: string[]; level: number | null; medals: Medal[]; stats?: PersonStats };

export type TeamPreview = { kind: "team"; url: string; page: string; name: string; picture: string | null; people: number; stats?: TeamStats };

export type LinkPreview = PersonPreview | TeamPreview;

type LinkedPage = { kind: "person"; person: string } | { kind: "team"; team: string };

type Unfolding = CardReads & { rich: boolean };

const bookPath = "/book";

export function linkPreviewsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, linkPreviewsFlag, member);
}

export const linkPreviewsOf = internalQuery({
  args: { workspace: v.string(), sharer: v.string(), links: v.array(v.string()) },
  handler: async (ctx, { workspace, sharer, links }): Promise<LinkPreview[]> => {
    const origin = siteOriginFor(workspace);
    if (origin === null || !(await sharerDecisionOf(ctx, workspace, sharer, linkPreviewsFlag))) return [];
    const unfolding = { ...cardReadsOf(ctx, workspace, origin), rich: await sharerDecisionOf(ctx, workspace, sharer, richLinkCardsFlag) };
    const previews: LinkPreview[] = [];
    for (const url of links) {
      const preview = await previewOf(ctx, unfolding, url);
      if (preview !== null) previews.push(preview);
    }
    return previews;
  },
});

async function sharerDecisionOf(ctx: QueryCtx, workspace: string, user: string, flag: Flag<boolean>) {
  const sharer = await lookup(ctx, workspace, user);
  if (sharer?.kind === "member") return memberDecisionWithoutWriting(ctx, flag, sharer.member);
  return workspaceDecisionWithoutWriting(ctx, flag, workspace);
}

async function previewOf(ctx: QueryCtx, unfolding: Unfolding, url: string): Promise<LinkPreview | null> {
  const linked = pageLinkedBy(url, unfolding.origin);
  if (linked === null) return null;
  return linked.kind === "person" ? personPreviewOf(ctx, unfolding, url, linked.person) : teamPreviewOf(ctx, unfolding, url, linked.team);
}

function pageLinkedBy(url: string, origin: string): LinkedPage | null {
  const address = addressOrNull(url);
  if (address === null || address.origin !== new URL(origin).origin || address.pathname !== bookPath) return null;
  const [section, key, ...rest] = address.hash.replace(/^#/, "").split("/");
  const decoded = key === undefined || rest.length > 0 ? null : decodedOrNull(key);
  if (!decoded) return null;
  if (section === "people") return { kind: "person", person: decoded };
  return section === "teams" ? { kind: "team", team: decoded } : null;
}

async function personPreviewOf(ctx: QueryCtx, unfolding: Unfolding, url: string, key: string): Promise<PersonPreview | null> {
  const { workspace, origin, rich } = unfolding;
  const person = ctx.db.normalizeId("members", key);
  if (person === null || !(await isAPersonOf(ctx, workspace, person))) return null;
  const { name, level, medals } = await profileCardOf(ctx, person, { own: false, viewer: null });
  const teams = await personTeamsOf(ctx, workspace, person);
  const preview: PersonPreview = { kind: "person", url, page: pageUrlOf(origin, "people", person), name, picture: await pictureOf(ctx, workspace, person), teams: teams.map((team) => team.name), level, medals };
  return rich ? { ...preview, stats: await personStatsOf(ctx, unfolding, person, level, teams) } : preview;
}

async function pictureOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<string | null> {
  const companyFace = await storedCompanyFaceOf(ctx, workspace, person);
  return companyFace?.image ?? (await nameAndPictureOf(ctx, person)).picture;
}

async function teamPreviewOf(ctx: QueryCtx, unfolding: Unfolding, url: string, key: string): Promise<TeamPreview | null> {
  const team = await ctx.db
    .query("companyTeams")
    .withIndex("by_team", (q) => q.eq("team", key))
    .first();
  if (team === null) return null;
  const { origin, rich } = unfolding;
  const preview: TeamPreview = { kind: "team", url, page: pageUrlOf(origin, "teams", team.team), name: team.name, picture: team.crestImage ?? null, people: team.people.length };
  return rich ? { ...preview, stats: await teamStatsOf(unfolding, team) } : preview;
}

function pageUrlOf(origin: string, section: "people" | "teams", key: string) {
  return `${origin}${bookPath}#${section}/${encodeURIComponent(key)}`;
}

function addressOrNull(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function decodedOrNull(key: string) {
  try {
    return decodeURIComponent(key);
  } catch {
    return null;
  }
}
