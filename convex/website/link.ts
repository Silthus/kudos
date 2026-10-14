import { v, type Infer } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { periodValidator } from "../leaderboard/periods";
import { signInWorkspace } from "../slack/signIn";
import type { Feature } from "../unlocks/feature";
import { scheduled } from "../unlocks/schedule";
import { lookup } from "../workspace/directory";
import { websiteOpen } from "./flag";
import { listedPageOf, routeOf } from "./routes";
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
  handler: async (ctx, { workspace, page }) => {
    const origin = await websiteOrigin(ctx, workspace);
    return origin === null ? null : `${origin}${routeOf(page)}`;
  },
});

export const frontDoorLinksOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  returns: v.union(frontDoorLinksValidator, v.null()),
  handler: async (ctx, { workspace, user }): Promise<FrontDoorLinks | null> => {
    const origin = await websiteOrigin(ctx, workspace);
    if (origin === null) return null;
    const person = await lookup(ctx, workspace, user);
    const open = person?.kind === "member" ? await openFeaturesOf(ctx, { workspace, user, member: person.member }) : [];
    const pages = open.flatMap((feature) => listedLinkOf(origin, feature));
    return { home: `${origin}${routeOf({ page: "home" })}`, pages };
  },
});

function listedLinkOf(origin: string, feature: Feature) {
  const page = listedPageOf(feature);
  return page === null ? [] : [{ label: scheduled(feature).name, url: `${origin}${routeOf(page)}` }];
}

async function websiteOrigin(ctx: QueryCtx, workspace: string): Promise<string | null> {
  const origin = siteOrigin();
  if (origin === null || workspace !== signInWorkspace()) return null;
  return (await websiteOpen(ctx)) ? origin : null;
}

function siteOrigin() {
  const site = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  return site === "" ? null : site;
}
