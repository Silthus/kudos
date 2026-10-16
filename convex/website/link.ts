import { v, type Infer } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { periodValidator } from "../leaderboard/periods";
import { perkValidator } from "../progression/tree";
import { signInWorkspace } from "../slack/signIn";
import type { Feature } from "../unlocks/feature";
import { scheduled } from "../unlocks/schedule";
import { lookup, type MemberId } from "../workspace/directory";
import { websiteOpen, websiteOpenTo } from "./flag";
import { crateTargetValidator, homePanelValidator, listedPageOf, settingsSectionValidator, signInEntry, urlOf, type Page } from "./routes";
import { openFeaturesOf } from "./unlockPath";

const crate = v.optional(crateTargetValidator);

export const pageValidator = v.union(
  v.object({ page: v.literal("home"), panel: v.optional(homePanelValidator), crate }),
  v.object({ page: v.literal("leaderboard"), period: periodValidator, crate }),
  v.object({ page: v.literal("quests"), quest: v.optional(v.number()), crate }),
  v.object({ page: v.literal("skillTree"), perk: v.optional(perkValidator), crate }),
  v.object({ page: v.literal("book"), crate }),
  v.object({ page: v.literal("bookEarned"), crate }),
  v.object({ page: v.literal("bookCollection"), crate }),
  v.object({ page: v.literal("settings"), section: v.optional(settingsSectionValidator) }),
);

const frontDoorLinksValidator = v.object({ origin: v.string(), pages: v.array(v.object({ label: v.string(), url: v.string() })) });

export type FrontDoorLinks = Infer<typeof frontDoorLinksValidator>;

export const websiteLinkOf = internalQuery({
  args: { workspace: v.string(), page: pageValidator },
  returns: v.union(v.string(), v.null()),
  handler: (ctx, { workspace, page }) => websiteLink(ctx, workspace, page),
});

export async function websiteLink(ctx: QueryCtx, workspace: string, page: Page): Promise<string | null> {
  const origin = await websiteOrigin(ctx, workspace);
  return origin === null ? null : urlOf(origin, page);
}

export const frontDoorLinksOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  returns: v.union(frontDoorLinksValidator, v.null()),
  handler: async (ctx, { workspace, user }): Promise<FrontDoorLinks | null> => {
    const person = await lookup(ctx, workspace, user);
    const me = person?.kind === "member" ? { workspace, user, member: person.member } : undefined;
    const origin = await websiteOriginFor(ctx, workspace, me?.member);
    if (origin === null) return null;
    const open = me === undefined ? [] : await openFeaturesOf(ctx, me);
    const pages = open.flatMap((feature) => listedLinkOf(origin, feature));
    return { origin, pages };
  },
});

export async function websiteOriginFor(ctx: QueryCtx, workspace: string, member: MemberId | undefined): Promise<string | null> {
  const site = siteOriginFor(workspace);
  if (site === null) return null;
  const door = await doorFor(ctx, member);
  if (door === null) return null;
  return door === "page" ? site : `${site}${signInEntry}`;
}

type Door = "page" | "sign-in";

async function doorFor(ctx: QueryCtx, member: MemberId | undefined): Promise<Door | null> {
  const workspaceOpen = await websiteOpen(ctx);
  if (member === undefined) return workspaceOpen ? "page" : null;
  if (!(await websiteOpenTo(ctx, member))) return null;
  return workspaceOpen ? "page" : "sign-in";
}

function listedLinkOf(origin: string, feature: Feature) {
  const page = listedPageOf(feature);
  return page === null ? [] : [{ label: scheduled(feature).name, url: urlOf(origin, page) }];
}

export async function websiteOrigin(ctx: QueryCtx, workspace: string): Promise<string | null> {
  const origin = siteOriginFor(workspace);
  if (origin === null) return null;
  return (await websiteOpen(ctx)) ? origin : null;
}

function siteOriginFor(workspace: string) {
  const site = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  return site === "" || workspace !== signInWorkspace() ? null : site;
}
