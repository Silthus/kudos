import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { giveKudos, revokeKudosRow, type GiveInput } from "../convex/engine";
import { NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { notifyGiver: false, notifyReceiver: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type GiveOptions = Partial<Omit<GiveInput, "workspace">> & { giverSlackId: string; recipientSlackIds: string[] };

async function giveAt(iso: string, opts: GiveOptions) {
  vi.setSystemTime(new Date(iso));
  const result = await t.run(async (ctx) =>
    giveKudos(ctx, {
      workspace: (await ctx.db.get(team.workspaceId))!,
      amountEach: 1,
      channelId: "CGENERAL",
      channelName: "general",
      text: "thanks",
      source: "message",
      now: Date.now(),
      messageTs: `${Date.parse(iso) / 1000}`,
      ...opts,
    }),
  );
  expect(result.status, `${iso} ${opts.giverSlackId}`).toBe("given");
}

async function rebuild() {
  await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  vi.setSystemTime(NOW);
}

async function metrics(today = TODAY) {
  const ana = await signInAs(t, team.ana); // the admin
  return await ana.query(api.analytics.successMetrics, { today });
}

const month = async (key: string, today = TODAY) => (await metrics(today)).months.find((m) => m.month === key);

describe("success metrics per month (game spec G18)", () => {
  test("live giving keeps reach, 12+ word notes, thank-backs and participation for the month", async () => {
    await rebuild(); // the workspace is backfilled before anyone gives
    // Ana thanks Ben and Cleo with a real "why"; two days later Ben thanks Ana back (a thank-back).
    await giveAt("2026-09-14T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"], noteWords: 14, amountEach: 2 });
    await giveAt("2026-09-16T09:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"], noteWords: 4 });
    // Four days after Ana's kudos, Cleo's to Ana is no longer a thank-back; Ana gives Ben again.
    await giveAt("2026-09-18T10:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UANA"], noteWords: 12 });
    await giveAt("2026-09-21T10:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"], noteWords: 3 });

    expect(await month("2026-09")).toEqual({
      month: "2026-09",
      toDate: true,
      givers: 3,
      teamSize: 3,
      participation: 1,
      kudos: 5, // one per person recognised in a message, whatever the amount
      recipientsPerGiver: 4 / 3, // Ana → Ben, Cleo; Ben → Ana; Cleo → Ana
      storyShare: 3 / 5, // Ana's first message (2 people) and Cleo's
      reciprocalShare: 1 / 5, // Ben's thank-back
    });
  });

  test("revoking the kudos a thank-back answered makes it an ordinary kudos again", async () => {
    await rebuild();
    await giveAt("2026-09-14T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"], noteWords: 14 });
    await giveAt("2026-09-15T09:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"], noteWords: 4 });
    expect((await month("2026-09"))!.reciprocalShare).toBe(1 / 2);

    await revokeWhere((k) => k.giverId === team.ana);
    expect(await month("2026-09")).toMatchObject({ kudos: 1, recipientsPerGiver: 1, storyShare: 0, reciprocalShare: 0 });
    await revokeWhere(() => true);
    expect(await month("2026-09")).toMatchObject({ givers: 0, kudos: 0, recipientsPerGiver: null, storyShare: null, reciprocalShare: null });
    expect(await t.run((ctx) => ctx.db.query("successStats").collect())).toEqual([]);
  });

  test("a thank-back counts in its own month, even when it answers last month's kudos", async () => {
    await rebuild();
    await giveAt("2026-08-30T10:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    await giveAt("2026-09-01T10:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"] });
    expect(await month("2026-08")).toMatchObject({ kudos: 1, reciprocalShare: 0 });
    expect(await month("2026-09")).toMatchObject({ kudos: 1, reciprocalShare: 1 });
  });

  test("a rebuild recomputes exactly what live giving and revoking maintained", async () => {
    await rebuild();
    await giveAt("2026-07-30T10:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UANA", "UBEN"], noteWords: 20 });
    await giveAt("2026-08-01T10:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UCLEO"], noteWords: 2 });
    await giveAt("2026-08-02T10:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UCLEO"], noteWords: 12, source: "reaction" });
    await giveAt("2026-09-14T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"], noteWords: 14 });
    await giveAt("2026-09-15T09:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"], noteWords: 4 });
    await revokeWhere((k) => k.dayKey === "2026-08-01");
    const live = await metrics();
    expect(live.months.map((m) => m.month)).toEqual(["2026-07", "2026-08", "2026-09"]);

    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("successStats").collect()) await ctx.db.patch(row._id, { pairs: 9, reciprocalRows: 7 });
    });
    await rebuild();
    expect(await metrics()).toEqual(live);
  });

  test("rollups:verify checks a month's success counters against its kudos", async () => {
    await rebuild();
    await giveAt("2026-08-31T10:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    await giveAt("2026-09-01T10:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA", "UCLEO"], noteWords: 12 });
    const verify = () => t.query(internal.rollups.verify, { workspaceId: team.workspaceId, buckets: ["m:2026-09", "w:2026-W36"] });
    expect((await verify()).mismatches).toEqual([]);

    await t.run(async (ctx) => {
      const row = (await ctx.db.query("successStats").collect()).find((r) => r.bucket === "m:2026-09")!;
      await ctx.db.patch(row._id, { pairs: 5, storyRows: 1, reciprocalRows: 0 });
    });
    expect((await verify()).mismatches).toEqual([
      { bucket: "m:2026-09", table: "successStats", key: "m:2026-09", field: "pairs", expected: 2, actual: 5 },
      { bucket: "m:2026-09", table: "successStats", key: "m:2026-09", field: "storyRows", expected: 2, actual: 1 },
      { bucket: "m:2026-09", table: "successStats", key: "m:2026-09", field: "reciprocalRows", expected: 1, actual: 0 },
    ]);
  });

  test("shows the last 12 months from the first month anyone gave, and pools the 3 complete months before this one as the baseline", async () => {
    await rebuild();
    // A year ago and in each of the four months before this one.
    await giveAt("2025-09-10T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"], noteWords: 12 });
    await giveAt("2026-05-12T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"], noteWords: 12 });
    await giveAt("2026-06-10T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"], noteWords: 12 });
    await giveAt("2026-07-08T09:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"] });
    await giveAt("2026-07-09T09:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UANA"] });
    await giveAt("2026-08-12T09:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UBEN"], noteWords: 13 });
    await giveAt("2026-08-13T09:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UCLEO"] });

    const result = await metrics();
    expect(result.ready).toBe(true);
    // September 2025 is outside the window, October 2025 – April 2026 had nothing: the list starts in May.
    expect(result.months.map((m) => [m.month, m.toDate, m.kudos])).toEqual([
      ["2026-05", false, 1],
      ["2026-06", false, 2],
      ["2026-07", false, 2],
      ["2026-08", false, 2],
      ["2026-09", true, 0],
    ]);
    // June–August: 5 givers over 3 × 3 teammates, 6 pairs, 3 of 6 kudos with a story, 1 thank-back (Ben → Cleo).
    expect(result.baseline).toEqual({
      from: "2026-06",
      to: "2026-08",
      months: 3,
      participation: 5 / 9,
      recipientsPerGiver: 6 / 5,
      storyShare: 3 / 6,
      reciprocalShare: 1 / 6,
    });
  });

  test("a departed giver still counts in the team of the months they gave", async () => {
    await rebuild();
    await giveAt("2026-08-12T09:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UBEN"] });
    await giveAt("2026-09-02T09:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"] });
    await t.run((ctx) => ctx.db.patch(team.cleo, { deactivated: true }));
    expect(await month("2026-08")).toMatchObject({ givers: 1, teamSize: 3, participation: 1 / 3 });
    expect(await month("2026-09")).toMatchObject({ givers: 1, teamSize: 2, participation: 1 / 2 });
  });

  test("waits for a rebuild that computed them, and is for admins only", async () => {
    await giveAt("2026-09-14T09:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"] });
    // Rollups backfilled before the success metrics existed: the marker the metrics need is missing.
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { rollupsBackfilledAt: NOW.getTime() }));
    expect(await metrics()).toEqual({ ready: false, months: [], baseline: null });

    await rebuild();
    expect((await metrics()).ready).toBe(true);
    const ben = await signInAs(t, team.ben);
    await expect(ben.query(api.analytics.successMetrics, { today: TODAY })).rejects.toThrow(/Only workspace admins/);

    await t.mutation(internal.rollups.unmarkBackfilled, { workspaceId: team.workspaceId });
    expect((await metrics()).ready).toBe(false);
  });
});

describe("success metrics in a 500-member workspace", () => {
  const MEMBERS = 500;
  const DEPARTED = 100;

  test("read 12 months of rollups, the members and each departed giver's months, within a fixed budget", { timeout: 120_000 }, async () => {
    // 504 members, 12 + 12 month rows, 12 month rows per departed giver, the viewer's session.
    t = setupConvex({ transactionLimits: { documentsRead: MEMBERS + 4 + 24 + 12 * DEPARTED + 10 } });
    team = await seedTeam(t, { rollupsBackfilledAt: NOW.getTime(), successBackfilledAt: NOW.getTime() });
    const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`).slice(-9); // Jan–Sep
    const earlier = ["2025-10", "2025-11", "2025-12"];
    await t.run(async (ctx) => {
      for (const month of [...earlier, ...months]) {
        const bucket = `m:${month}`;
        const base = { workspaceId: team.workspaceId, bucket };
        await ctx.db.insert("workspaceStats", {
          ...base, given: 900, kudosRows: 600, messages: 400, givers: 300, receivers: 400, giverDays: 800, cappedGiven: 900,
          maxedDays: 10, fromReactions: 100, fromMessages: 800, heat: new Array(168).fill(0), found: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
        });
        await ctx.db.insert("successStats", { ...base, pairs: 450, storyRows: 150, reciprocalRows: 60 });
        // Other buckets of the workspace stay unread.
        await ctx.db.insert("successStats", { ...base, bucket: `m:2024-${month.slice(5)}`, pairs: 1, storyRows: 1, reciprocalRows: 1 });
      }
      for (let i = 0; i < MEMBERS; i++) {
        const departed = i < DEPARTED;
        const memberId = await ctx.db.insert("members", {
          workspaceId: team.workspaceId, slackUserId: `USCALE${i}`, name: `Scale ${i}`, isAdmin: false, isBot: false,
          deactivated: departed, totalGiven: departed ? 20 : 0, totalReceived: 0, totalMaxedDays: 0,
        });
        if (!departed) continue;
        // Every month, plus week and year rows the query must not read.
        for (const month of [...earlier, ...months]) {
          await ctx.db.insert("memberStats", { workspaceId: team.workspaceId, memberId, bucket: `m:${month}`, given: 2, received: 0, maxedDays: 0, activeDays: 1 });
        }
        await ctx.db.insert("memberStats", { workspaceId: team.workspaceId, memberId, bucket: "w:2026-W38", given: 2, received: 0, maxedDays: 0, activeDays: 1 });
        await ctx.db.insert("memberStats", { workspaceId: team.workspaceId, memberId, bucket: "y:2026", given: 20, received: 0, maxedDays: 0, activeDays: 9 });
      }
    });

    const result = await metrics();
    expect(result.months).toHaveLength(12);
    // 3 original teammates + 400 current + the 100 departed who gave that month.
    expect(result.months[0]).toMatchObject({ month: "2025-10", givers: 300, teamSize: 503, participation: 300 / 503, recipientsPerGiver: 1.5, storyShare: 0.25, reciprocalShare: 0.1 });
    expect(result.baseline).toMatchObject({ from: "2026-06", to: "2026-08", months: 3, participation: 300 / 503 });
  });
});

async function revokeWhere(match: (k: import("../convex/_generated/dataModel").Doc<"kudos">) => boolean) {
  await t.run(async (ctx) => {
    const workspace = (await ctx.db.get(team.workspaceId))!;
    for (const row of (await ctx.db.query("kudos").collect()).filter(match)) await revokeKudosRow(ctx, workspace, row);
  });
}
