import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { signInWorkspace } from "../slack/signIn";
import { websiteOpen } from "./flag";

export const websiteLinkOf = internalQuery({
  args: { workspace: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: (ctx, { workspace }) => websiteLink(ctx, workspace),
});

async function websiteLink(ctx: QueryCtx, workspace: string): Promise<string | null> {
  const root = siteRoot();
  if (root === null || workspace !== signInWorkspace()) return null;
  return (await websiteOpen(ctx)) ? root : null;
}

function siteRoot() {
  const site = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  return site === "" ? null : `${site}/`;
}
