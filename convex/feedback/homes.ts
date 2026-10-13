import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { showHomeTabCommand, type CommandResult } from "../bus/commands";
import { levelReachedEventValidator } from "../bus/events";
import { kudosHomeOf, type KudosHome } from "../engine/home";
import { progressionHomeOf, type ProgressionHome } from "../progression/progression";
import { progressSettingsOf, type ProgressSettings } from "../progression/settings";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { chatUserOf, lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import type { HomeTab } from "./home";

export type HomeFacts =
  | {
      kind: "member";
      member: MemberId;
      version: number;
      tab: HomeTab;
      kudos: KudosHome;
      progression: ProgressionHome;
      settings: ProgressSettings;
      admin: AdminHome | null;
    }
  | { kind: "kudos-only"; version: number; kudos: KudosHome }
  | { kind: "not-a-member" };

export type AdminHome = { announcementChannel: string | null };

export const homeOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }): Promise<HomeFacts | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person === undefined) return null;
    if (person.kind !== "member") return { kind: "not-a-member" };
    const home = await homeRow(ctx, person.member);
    const version = home?.version ?? 0;
    const kudos = await kudosHomeOf(ctx, workspace, person.member, person.timeZone);
    if (!(await xpLevelsShownIn(ctx, workspace))) return { kind: "kudos-only", version, kudos };
    return {
      kind: "member",
      member: person.member,
      version,
      tab: home?.tab ?? "profile",
      kudos,
      progression: await progressionHomeOf(ctx, person.member),
      settings: await progressSettingsOf(ctx, person.member),
      admin: person.admin ? { announcementChannel: (await settingsOf(ctx, workspace)).announcementChannel } : null,
    };
  },
});

export function stampOf(facts: HomeFacts | null) {
  if (facts === null) return "unknown";
  return facts.kind === "not-a-member" ? facts.kind : `${facts.kind}@${facts.version}`;
}

export const showHomeTab = internalMutation({
  args: { command: showHomeTabCommand },
  handler: async (ctx, { command: { member, tab } }): Promise<CommandResult> => {
    const home = await homeRow(ctx, member);
    if (home === null) await ctx.db.insert("homes", { member, tab, version: 0 });
    else await ctx.db.patch(home._id, { tab });
    return "done";
  },
});

export const refreshHomeOnLevel = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (await xpLevelsShownIn(ctx, event.workspace)) await republish(ctx, event.member);
  },
});

export async function republishOnRoleChange(ctx: MutationCtx, before: MemberFacts | undefined, after: MemberFacts | undefined) {
  if (before === undefined || after === undefined || roleOf(before) === roleOf(after)) return;
  const member = before.kind === "member" ? before.member : after.kind === "member" ? after.member : null;
  if (member === null) return;
  const { workspace } = await chatUserOf(ctx, member);
  if (await xpLevelsShownIn(ctx, workspace)) await republish(ctx, member);
}

function roleOf(person: MemberFacts) {
  return person.kind === "member" && person.admin ? "admin" : person.kind;
}

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
