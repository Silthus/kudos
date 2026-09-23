/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../convex/schema";
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

export function setupConvex() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  return convexTest(schema, modules);
}

export async function member(t: ReturnType<typeof convexTest>, id: Id<"members">) {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

export async function all<T extends "kudos" | "memberDays" | "notifications" | "discoveries" | "slackEvents" | "questBoards" | "questCompletions">(
  t: ReturnType<typeof convexTest>,
  table: T,
) {
  return await t.run((ctx) => ctx.db.query(table).collect());
}
