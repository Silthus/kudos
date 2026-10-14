import { v, type Infer } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { periodValidator } from "../leaderboard/periods";
import { signInWorkspace } from "../slack/signIn";
import type { Feature } from "../unlocks/feature";
import { scheduled } from "../unlocks/schedule";
import { lookup, type MemberId } from "../workspace/directory";
import { websiteOpen, websiteOpenTo } from "./flag";
import { listedPageOf, routeOf, signInAsk, type Page } from "./routes";
import { openFeaturesOf } from "./unlockPath";

export const pageValidator = v.union(
  v.object({ page: v.literal("home") }),
  v.object({ page: v.literal("leaderboard"), period: periodValidator }),
  v.object({ page: v.literal("quests") }),
  v.object({ page: v.literal("skillTree") }),
  v.object({ page: v.literal("book") }),
);

const frontDoorLinksValidator = v.object({ home: v.string(), pages: v.array(v.object({ label: v.string(), url: v.string() })) });

export type FrontDoorLinks = Infer<typeof frontDoorLinksValidator>;

export const websiteLinkOf = internalQuery({
  args: { workspace: v.string(), page: pageValidator },
  returns: v.union(v.string(), v.null()),
  handler: (ctx, { workspace, page }) => websiteLink(ctx, workspace, page),
});

export async function websiteLink(ctx: QueryCtx, workspace: string, page: Page): Promise<string | null> {
  const origin = await websiteOrigin(ctx, workspace);
  return origin === null ? null : linkTo(origin, page);
}

export const frontDoorLinksOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  returns: v.union(frontDoorLinksValidator, v.null()),
  handler: async (ctx, { workspace, user }): Promise<FrontDoorLinks | null> => {
    const origin = siteOriginFor(workspace);
    if (origin === null) return null;
    const person = await lookup(ctx, workspace, user);
    const me = person?.kind === "member" ? { workspace, user, member: person.member } : undefined;
    const door = await doorFor(ctx, me?.member);
    if (door === null) return null;
    const open = me === undefined ? [] : await openFeaturesOf(ctx, me);
    const pages = open.flatMap((feature) => listedLinkOf(origin, feature, door));
    return { home: linkTo(origin, { page: "home" }, door), pages };
  },
});

type Door = "page" | "sign-in";

async function doorFor(ctx: QueryCtx, member: MemberId | undefined): Promise<Door | null> {
  const workspaceOpen = await websiteOpen(ctx);
  if (member === undefined) return workspaceOpen ? "page" : null;
  if (!(await websiteOpenTo(ctx, member))) return null;
  return workspaceOpen ? "page" : "sign-in";
}

function listedLinkOf(origin: string, feature: Feature, door: Door) {
  const page = listedPageOf(feature);
  return page === null ? [] : [{ label: scheduled(feature).name, url: linkTo(origin, page, door) }];
}

function linkTo(origin: string, page: Page, door: Door = "page") {
  const route = routeOf(page);
  if (door === "page") return `${origin}${route}`;
  return `${origin}${route}${route.includes("?") ? "&" : "?"}${signInAsk}`;
}

async function websiteOrigin(ctx: QueryCtx, workspace: string): Promise<string | null> {
  const origin = siteOriginFor(workspace);
  if (origin === null) return null;
  return (await websiteOpen(ctx)) ? origin : null;
}

function siteOriginFor(workspace: string) {
  const site = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  return site === "" || workspace !== signInWorkspace() ? null : site;
}
