/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../convex/schema";
import { claimOfferings } from "../convex/offerings";
import { workspaceNow } from "../convex/lib/time";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { DEFAULT_SETTINGS } from "../convex/lib/settings";

export const modules = import.meta.glob(["../convex/**/*.*s", "!../convex/**/*.test.ts"]);

/** 2026-09-23 10:00 UTC — a Wednesday, noon in Berlin. */
export const NOW = new Date("2026-09-23T10:00:00Z");
/** NOW's day key in the default workspace timezone, as the web client passes it to reactive queries. */
export const TODAY = "2026-09-23";

export type Team = Awaited<ReturnType<typeof seedTeam>>;

/** A connected Slack workspace with Ana, Ben, Cleo and the Kudos bot. */
export async function seedTeam(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<Doc<"workspaces">> = {},
  teamId = "T1",
) {
  return await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      slackTeamId: teamId,
      name: `Team ${teamId}`,
      isDemo: false,
      status: "active",
      ...DEFAULT_SETTINGS,
      // A workspace installed before the seedling became the default (#168): it keeps its taco.
      emojiName: "taco",
      emojiGlyph: "🌮",
      // Reaction-giving is off for new installs since #94; these tests' workspace has it on.
      reactionsEnabled: true,
      ...overrides,
    });
    await ctx.db.insert("slackInstallations", {
      workspaceId,
      botToken: "xoxb-test",
      botUserId: "UBOT",
      appId: "A1",
      installedBySlackUserId: "UANA",
      scope: "",
    });
    const member = (slackUserId: string, name: string, extra: Partial<Doc<"members">> = {}) =>
      ctx.db.insert("members", {
        workspaceId,
        slackUserId,
        name,
        isAdmin: false,
        isBot: false,
        deactivated: false,
        totalGiven: 0,
        totalReceived: 0,
        totalMaxedDays: 0,
        ...extra,
      });
    const ana = await member("UANA", "Ana", { isAdmin: true });
    const ben = await member("UBEN", "Ben");
    const cleo = await member("UCLEO", "Cleo");
    const bot = await member("UBOT", "Kudos", { isBot: true });
    return { workspaceId, ana, ben, cleo, bot };
  });
}

/** Signs a member in (Convex Auth identities are "<userId>|<sessionId>"). */
export async function signInAs(t: ReturnType<typeof convexTest>, memberId: Id<"members">) {
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    await ctx.db.patch(memberId, { userId });
    return userId;
  });
  return t.withIdentity({ subject: `${userId}|session` });
}

/**
 * Offers a member's appreciation at the tree (#157): claims the Hog coins their thoughtful kudos left
 * waiting there, as pressing "Offer your appreciation" at the offering stone does.
 */
export async function claimAtTree(t: ReturnType<typeof setupConvex>, memberId: Id<"members">) {
  return await t.run(async (ctx) => {
    const player = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
    const workspace = player && (await ctx.db.get(player.workspaceId));
    if (!player || !workspace) return null;
    const waiting = await ctx.db
      .query("offerings")
      .withIndex("by_member_claimedAt_createdAt", (q) => q.eq("memberId", memberId).eq("claimedAt", undefined))
      .collect();
    return await claimOfferings(ctx, workspace, player, waiting, "player", workspaceNow(workspace));
  });
}

/**
 * Entering the demo seeds a year of history and rebuilds its rollups: ~15 s under convex-test on an
 * idle machine, and a reset seeds it twice. Every test that enters or resets the demo takes this
 * timeout, sized for a loaded machine running the files in parallel, so load alone never fails it.
 */
export const DEMO_TIMEOUT = 180_000;

/** Convex's per-transaction limits (see https://docs.convex.dev/production/state/limits). */
export const CONVEX_LIMITS = {
  bytesRead: 16 * 2 ** 20,
  bytesWritten: 16 * 2 ** 20,
  documentsRead: 32_000,
  documentsWritten: 16_000,
  databaseQueries: 4_096,
  functionsScheduled: 1_000,
};

/** `transactionLimits`: enforce Convex's limits (`true`) or tighter ones; off by default. */
export function setupConvex(options: { transactionLimits?: boolean | Partial<typeof CONVEX_LIMITS> } = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  return convexTest({ schema, modules, ...options });
}

export async function member(t: ReturnType<typeof convexTest>, id: Id<"members">) {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

export async function all<T extends "kudos" | "memberDays" | "notifications" | "discoveries" | "slackEvents" | "questBoards" | "questCompletions" | "gameEvents" | "players">(
  t: ReturnType<typeof convexTest>,
  table: T,
) {
  return await t.run((ctx) => ctx.db.query(table).collect());
}
