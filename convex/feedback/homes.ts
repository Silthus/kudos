import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { showHomeTabCommand } from "../bus/commands";
import { kudosHomeOf, type KudosHome } from "../engine/home";
import { progressionHomeOf, type ProgressionHome } from "../progression/progression";
import { progressSettingsOf, type ProgressSettings } from "../progression/settings";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import type { HomeTab } from "./home";

export type HomeFacts =
  | { kind: "member"; tab: HomeTab; kudos: KudosHome; progression: ProgressionHome; settings: ProgressSettings }
  | { kind: "not-a-member" };

export const homeOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }): Promise<HomeFacts | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person === undefined) return null;
    if (person.kind !== "member") return { kind: "not-a-member" };
    const home = await homeRow(ctx, person.member);
    return {
      kind: "member",
      tab: home?.tab ?? "profile",
      kudos: await kudosHomeOf(ctx, workspace, person.member, person.timeZone),
      progression: await progressionHomeOf(ctx, person.member),
      settings: await progressSettingsOf(ctx, person.member),
    };
  },
});

export const showHomeTab = internalMutation({
  args: { command: showHomeTabCommand },
  handler: async (ctx, { command: { member, tab } }): Promise<void> => {
    const home = await homeRow(ctx, member);
    if (home === null) await ctx.db.insert("homes", { member, tab, version: 0 });
    else await ctx.db.patch(home._id, { tab });
  },
});

export const refreshHome = internalMutation({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<void> => {
    await republish(ctx, member);
  },
});

export async function republish(ctx: MutationCtx, member: MemberId) {
  const home = await homeRow(ctx, member);
  if (home === null) await ctx.db.insert("homes", { member, tab: "profile", version: 1 });
  else await ctx.db.patch(home._id, { version: home.version + 1 });
  await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, await chatUserOf(ctx, member));
}

function homeRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("homes")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
