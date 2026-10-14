import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { periodValidator } from "../leaderboard/periods";
import { signInWorkspace } from "../slack/signIn";
import { websiteOpen } from "./flag";
import { routeOf, type Page } from "./routes";

export const pageValidator = v.union(
  v.object({ page: v.literal("home") }),
  v.object({ page: v.literal("leaderboard"), period: periodValidator }),
  v.object({ page: v.literal("quests") }),
  v.object({ page: v.literal("skillTree") }),
  v.object({ page: v.literal("book") }),
);

export const websiteLinkOf = internalQuery({
  args: { workspace: v.string(), page: pageValidator },
  returns: v.union(v.string(), v.null()),
  handler: (ctx, { workspace, page }) => websiteLink(ctx, workspace, page),
});

async function websiteLink(ctx: QueryCtx, workspace: string, page: Page): Promise<string | null> {
  const origin = siteOrigin();
  if (origin === null || workspace !== signInWorkspace()) return null;
  return (await websiteOpen(ctx)) ? `${origin}${routeOf(page)}` : null;
}

function siteOrigin() {
  const site = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  return site === "" ? null : site;
}
