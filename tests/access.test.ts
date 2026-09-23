import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { all, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

const give = (text: string, workspaceId = team.workspaceId, ts = `${Math.random()}`) =>
  t.mutation(internal.kudos.ingestMessage, { workspaceId, botUserId: "UBOT", giverSlackId: "UANA", text, channelId: "C1", messageTs: ts });

const settings = {
  emojiName: "taco",
  emojiGlyph: "🌮",
  unitSingular: "kudos",
  unitPlural: "kudos",
  dailyLimit: 5,
  timezone: "Europe/Berlin",
  receivedVisibility: "self" as const,
  reactionsEnabled: true,
  notifyGiver: true,
  notifyReceiver: true,
};

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
});
afterEach(() => vi.useRealTimers());

describe("signed-out visitors", () => {
  test("see the landing state and no workspace data", async () => {
    expect(await t.query(api.session.viewer, {})).toEqual({ status: "signedOut" });
    await expect(t.query(api.me.overview, { period: "30d" })).rejects.toThrow(/Sign in/);
    await expect(t.query(api.leaderboard.get, { period: "week", metric: "given" })).rejects.toThrow(/Sign in/);
  });

  test("never learn secrets from the setup status", async () => {
    vi.stubEnv("SLACK_CLIENT_SECRET", "shh");
    expect(JSON.stringify(await t.query(api.session.setupStatus, {}))).not.toContain("shh");
    vi.unstubAllEnvs();
  });
});

describe("members", () => {
  test("can't use admin functions", async () => {
    const ben = await signInAs(t, team.ben);
    await expect(ben.query(api.admin.overview, {})).rejects.toThrow(/admins/);
    await expect(ben.mutation(api.admin.updateSettings, settings)).rejects.toThrow(/admins/);
    await expect(ben.mutation(api.admin.setAdmin, { memberId: team.ben, isAdmin: true })).rejects.toThrow(/admins/);
  });

  test("can't use the demo playground in a real workspace", async () => {
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.demo.simulateMessage, { text: "<@UANA> :taco:", channelName: "general" })).rejects.toThrow(/demo/);
  });
});

describe("received kudos visibility", () => {
  const setVisibility = (receivedVisibility: "hidden" | "self" | "everyone") =>
    t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility }));

  test("'hidden' removes received counts from the personal page", async () => {
    await give("<@UBEN> :taco:");
    await setVisibility("hidden");
    const ben = await signInAs(t, team.ben);
    const me = await ben.query(api.me.overview, { period: "7d" });
    expect(me.totals.received).toBeNull();
    expect(me.cadence.every((d) => d.received === null)).toBe(true);
  });

  test("'self' shows your own received kudos but keeps the leaderboard on giving", async () => {
    await give("<@UBEN> :taco:");
    const ben = await signInAs(t, team.ben);
    expect((await ben.query(api.me.overview, { period: "7d" })).totals.received).toBe(1);
    const board = await ben.query(api.leaderboard.get, { period: "week", metric: "received" });
    expect(board.metric).toBe("given");
    expect(board.rows.map((r) => r.member.name)).toEqual(["Ana"]);
  });

  test("'everyone' enables the received leaderboard and people analytics", async () => {
    await give("<@UBEN> :taco::taco:");
    await setVisibility("everyone");
    const cleo = await signInAs(t, team.cleo);
    const board = await cleo.query(api.leaderboard.get, { period: "week", metric: "received" });
    expect(board.rows.map((r) => [r.member.name, r.value])).toEqual([["Ben", 2]]);
    expect((await cleo.query(api.analytics.overview, { period: "7d" })).topReceivers).not.toBeNull();
  });

  test("non-admins don't see who receives most while it's private", async () => {
    await give("<@UBEN> :taco:");
    const cleo = await signInAs(t, team.cleo);
    const analytics = await cleo.query(api.analytics.overview, { period: "7d" });
    expect(analytics.topReceivers).toBeNull();
    expect(analytics.topPairs).toBeNull();
  });
});

describe("admins", () => {
  test("can change settings, with validation", async () => {
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.admin.updateSettings, { ...settings, emojiName: ":Star:", dailyLimit: 3 });
    expect(await t.run((ctx) => ctx.db.get(team.workspaceId))).toMatchObject({ emojiName: "star", dailyLimit: 3 });
    await expect(ana.mutation(api.admin.updateSettings, { ...settings, dailyLimit: 0 })).rejects.toThrow(/between 1 and 100/);
    await expect(ana.mutation(api.admin.updateSettings, { ...settings, timezone: "Mars/Olympus" })).rejects.toThrow(/timezone/);
    await expect(ana.mutation(api.admin.updateSettings, { ...settings, emojiName: "no spaces" })).rejects.toThrow(/shortcode/);
  });

  test("can't remove their own admin role", async () => {
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.admin.setAdmin, { memberId: team.ana, isAdmin: false })).rejects.toThrow(/own admin/);
  });

  test("can't touch another workspace", async () => {
    const other = await seedTeam(t, {}, "T2");
    await give("<@UBEN> :taco:", other.workspaceId);
    const [foreignKudos] = await all(t, "kudos");
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.admin.revoke, { kudosId: foreignKudos._id })).rejects.toThrow(/not found/);
    await expect(ana.mutation(api.admin.setAdmin, { memberId: other.ben, isAdmin: true })).rejects.toThrow(/not found/);
  });

  test("only see their own workspace on the leaderboard", async () => {
    const other = await seedTeam(t, {}, "T2");
    await give("<@UBEN> :taco:", other.workspaceId);
    const ana = await signInAs(t, team.ana);
    expect((await ana.query(api.leaderboard.get, { period: "week", metric: "given" })).rows).toHaveLength(0);
  });
});
