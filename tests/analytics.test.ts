import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { overviewFor } from "../convex/analytics";
import { giveKudos, revokeKudosRow, type GiveInput } from "../convex/engine";
import { heatSize } from "../convex/lib/buckets";
import { markBackfilled } from "../convex/lib/rebuild";
import { zeroFound } from "../convex/lib/rollups";
import { addDays, type Period } from "../convex/lib/time";
import { NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility: "everyone" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const PERIODS: Period[] = ["week", "month", "quarter", "year", "all"];

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

async function markRollupsBackfilled() {
  await t.run((ctx) => markBackfilled(ctx, team.workspaceId, NOW.getTime()));
}

/**
 * Giving across the previous year, quarter and month, and this month, with reactions, a private
 * channel, a maxed day and a revoke. Today is Wed 2026-09-23 (Berlin).
 */
async function history() {
  await t.run(async (ctx) => {
    for (const [slackUserId, name] of [["UDAN", "Dan"], ["UEVE", "Eve"]]) {
      await ctx.db.insert("members", {
        workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false,
        totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
      });
    }
  });
  await giveAt("2025-11-10T10:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN"], amountEach: 2 });
  await giveAt("2026-07-15T10:00:00Z", { giverSlackId: "UDAN", recipientSlackIds: ["UANA"] });
  await giveAt("2026-08-03T10:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UCLEO"], amountEach: 3, source: "reaction" });
  await giveAt("2026-08-20T10:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UDAN"], channelId: "CDESIGN", channelName: "design" });
  await giveAt("2026-08-28T10:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UANA"], amountEach: 2 }); // after "August to date"
  await giveAt("2026-09-02T07:00:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UBEN", "UCLEO"], amountEach: 2 });
  await giveAt("2026-09-10T16:00:00Z", { giverSlackId: "UCLEO", recipientSlackIds: ["UBEN"], channelId: "GSECRET", channelName: "secret", channelPrivate: true });
  await giveAt("2026-09-14T12:00:00Z", { giverSlackId: "UEVE", recipientSlackIds: ["UANA"], amountEach: 4, channelId: "CRANDOM", channelName: "random" });
  await giveAt("2026-09-21T08:00:00Z", { giverSlackId: "UBEN", recipientSlackIds: ["UANA"], source: "reaction", channelId: "CRANDOM", channelName: "random" });
  await giveAt("2026-09-22T09:00:00Z", { giverSlackId: "UDAN", recipientSlackIds: ["UCLEO"], amountEach: 3, channelId: "CDESIGN", channelName: "design" });
  await giveAt("2026-09-23T09:30:00Z", { giverSlackId: "UANA", recipientSlackIds: ["UEVE"], amountEach: 5 }); // maxes Ana's day
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("kudos").collect()).find((k) => k.dayKey === "2026-09-22")!;
    await revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, row);
  });
  vi.setSystemTime(NOW);
}

async function overviews() {
  const ana = await signInAs(t, team.ana);
  const out: Record<string, unknown> = {};
  for (const period of PERIODS) out[period] = await ana.query(api.analytics.overview, { period, today: TODAY });
  return out;
}

describe("analytics on the rollups", () => {
  test("gives exactly what the legacy scans compute, for every period", async () => {
    await history();
    const legacy = await overviews();
    await markRollupsBackfilled();
    expect(await overviews()).toEqual(legacy);
  }, 20_000);

  test("gives the same after the backfill rebuilds every rollup from the source tables", async () => {
    await history();
    const legacy = await overviews();
    await t.run(async (ctx) => {
      for (const table of ["workspaceStats", "memberStats", "pairStats", "channelStats"] as const) {
        for (const row of await ctx.db.query(table).collect()) await ctx.db.delete(row._id);
      }
    });
    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    expect(await overviews()).toEqual(legacy);
  }, 60_000);

  test("once backfilled, reads only the rollups: the source tables can vanish", async () => {
    await history();
    await markRollupsBackfilled();
    const before = await overviews();
    await t.run(async (ctx) => {
      for (const table of ["kudos", "memberDays", "discoveries"] as const) {
        for (const row of await ctx.db.query(table).collect()) await ctx.db.delete(row._id);
      }
    });
    expect(await overviews()).toEqual(before);
  }, 20_000);

  test("before the backfill, analytics keeps computing from the source tables", async () => {
    await history();
    await t.run(async (ctx) => {
      const day = (await ctx.db.query("workspaceStats").collect()).find((w) => w.bucket === "d:2026-09-23")!;
      await ctx.db.patch(day._id, { given: 995 }); // was 5
    });
    const ana = await signInAs(t, team.ana);
    expect((await ana.query(api.analytics.overview, { period: "month", today: TODAY })).kpis.total).toBe(15);
    await markRollupsBackfilled();
    expect((await ana.query(api.analytics.overview, { period: "month", today: TODAY })).kpis.total).toBe(1005);
  }, 20_000);

  test("this month, against August to date for volume and the whole of August for givers", async () => {
    await history();
    await markRollupsBackfilled();
    const ana = await signInAs(t, team.ana);
    const month = await ana.query(api.analytics.overview, { period: "month", today: TODAY });
    expect(month.kpis).toMatchObject({
      total: 15,
      prevTotal: 4, // Aug 1–23: Ben's 3 and Ana's 1; Cleo's Aug 28 is past the offset
      givers: 4, // Ana, Ben, Cleo, Eve; Dan's give was revoked
      prevGivers: 3, // the whole of August: Ben, Ana and Cleo
      receivers: 4,
      teamSize: 5,
      messages: 5,
      maxedDays: 1,
      newGivers: 1, // Eve
      retained: 3,
      topShare: 9 / 15, // Ana alone is the top fifth of 4 givers
    });
    expect(month.kpis.prevParticipation).toBeCloseTo(3 / 5);
    expect(month.truncated).toBe(false);
    expect(month.grain).toBe("day");
    expect(month.volume).toHaveLength(23);
    expect(month.volume.find((d) => d.day === "2026-09-14")).toEqual({ day: "2026-09-14", total: 4, prevTotal: 0 });
    expect(month.volume.find((d) => d.day === "2026-09-20")).toEqual({ day: "2026-09-20", total: 0, prevTotal: 1 });
    expect(month.sources).toEqual([{ name: "Messages", value: 14 }, { name: "Reactions", value: 1 }]);
    expect(month.channels).toEqual([
      { name: "general", value: 9 },
      { name: "random", value: 5 },
      { name: "Private channels", value: 1 },
    ]);
    expect(month.topGivers.map((g) => [g.member?.name, g.value])).toEqual([["Ana", 9], ["Eve", 4], ["Ben", 1], ["Cleo", 1]]);
    expect(month.topReceivers?.map((g) => [g.member?.name, g.value])).toEqual([["Ana", 5], ["Eve", 5], ["Ben", 3], ["Cleo", 2]]);
    expect(month.topPairs?.[0]).toMatchObject({ giver: { name: "Ana" }, receiver: { name: "Eve" }, value: 5 });
    // Wednesday 11:30 Berlin: the heatmap is Monday-first.
    expect(month.heatmap[2][11]).toBe(5);
  }, 20_000);

  test("all time charts whole months from the first active month, with no comparison", async () => {
    await history();
    await markRollupsBackfilled();
    const ana = await signInAs(t, team.ana);
    const all = await ana.query(api.analytics.overview, { period: "all", today: TODAY });
    expect(all.range.start).toBe("2025-11-10");
    expect(all.grain).toBe("month");
    expect(all.volume.map((m) => m.day)).toEqual([
      "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01",
      "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01",
    ]);
    expect(all.volume.map((m) => m.total)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 1, 6, 15]);
    expect(all.volume.every((m) => m.prevTotal === null)).toBe(true);
    expect(all.kpis).toMatchObject({ total: 24, prevTotal: null, givers: 5, receivers: 5, prevGivers: null });
  }, 20_000);

  test("hides who received and who recognizes whom unless received kudos are public", async () => {
    await history();
    await markRollupsBackfilled();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "self" }));
    const ana = await signInAs(t, team.ana);
    const month = await ana.query(api.analytics.overview, { period: "month", today: TODAY });
    expect([month.showPeople, month.topReceivers, month.topPairs]).toEqual([false, null, null]);
    expect(month.topGivers).toHaveLength(4);
  }, 20_000);
});

describe("rollup edge cases", () => {
  const workspaceRow = (bucket: string, values: Partial<Doc<"workspaceStats">> = {}) =>
    t.run(async (ctx) => {
      await ctx.db.insert("workspaceStats", {
        workspaceId: team.workspaceId, bucket, given: 0, kudosRows: 0, messages: 0, givers: 0, receivers: 0, giverDays: 0,
        cappedGiven: 0, maxedDays: 0, fromReactions: 0, fromMessages: 0, heat: new Array(heatSize(bucket)).fill(0),
        found: zeroFound(), ...values,
      });
    });
  const overview = async (period: Period, today = TODAY) =>
    (await signInAs(t, team.ana)).query(api.analytics.overview, { period, today });

  test("a tie for the last top channel goes to the first name, however the rows were created", async () => {
    await markRollupsBackfilled();
    await t.run(async (ctx) => {
      const channel = (name: string, amount: number) =>
        ctx.db.insert("channelStats", { workspaceId: team.workspaceId, bucket: "m:2026-09", channel: name, amount });
      await channel("alpha", 5);
      for (let i = 1; i <= 7; i++) await channel(`c${i}`, 10 + i);
      await channel("zulu", 5); // created last: first among the 5s on a descending index
    });
    const { channels } = await overview("month");
    expect(channels).toHaveLength(8);
    expect(channels.at(-1)).toEqual({ name: "alpha", value: 5 });
  });

  test("all time starts at the first kudos, not at a day that only saw bot messages", async () => {
    await markRollupsBackfilled();
    await workspaceRow("d:2026-01-05", { found: { ...zeroFound(), common: 1 } });
    await workspaceRow("m:2026-01", { found: { ...zeroFound(), common: 1 } });
    await workspaceRow("d:2026-03-10", { given: 3 });
    await workspaceRow("m:2026-03", { given: 3 });
    const all = await overview("all");
    expect(all.range.start).toBe("2026-03-10");
    expect(all.volume[0]).toEqual({ day: "2026-03-01", total: 3, prevTotal: null });
  });

  test("a client still on an earlier day sees the kudos given up to that day", async () => {
    await markRollupsBackfilled();
    await workspaceRow("d:2026-09-10", { given: 4 });
    await workspaceRow("d:2026-09-20", { given: 6 });
    await workspaceRow("m:2026-09", { given: 10 });
    const month = await overview("month", "2026-09-15");
    expect(month.kpis.total).toBe(4);
    expect(month.volume.reduce((n, d) => n + d.total, 0)).toBe(4);
  });

  test("says which period it describes, so the page words it for the data on screen", async () => {
    expect((await overview("quarter")).period).toBe("quarter");
  });
});

/** Counts what a query reads through `ctx.db`: documents, their JSON size and index ranges. */
function counting<T extends object>(target: T, tally: { docs: number; bytes: number; ranges: number }): T {
  const count = (result: unknown) => {
    const docs = Array.isArray(result) ? result : result && typeof result === "object" && "_id" in result ? [result] : [];
    tally.docs += docs.length;
    tally.bytes += docs.reduce((n: number, d) => n + JSON.stringify(d).length, 0);
  };
  return new Proxy(target, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop, obj) as unknown;
      if (value && typeof value === "object") return counting(value, tally); // ctx.db
      if (typeof value !== "function") return value;
      if (prop === Symbol.asyncIterator) {
        return () => {
          tally.ranges += 1;
          const it = (value as () => AsyncIterator<unknown>).call(obj);
          return {
            next: async () => {
              const r = await it.next();
              if (!r.done) count(r.value);
              return r;
            },
            [Symbol.asyncIterator]() {
              return this;
            },
          };
        };
      }
      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(obj, args);
        if (result instanceof Promise) {
          tally.ranges += 1;
          return result.then((r) => (count(r), r));
        }
        return result && typeof result === "object" ? counting(result, tally) : result;
      };
    },
  });
}

describe("reads at scale", () => {
  const MEMBERS = 500;

  /** 500 members and two busy years of rollups: every row a year of analytics could touch. */
  async function seedTwoBusyYears() {
    await t.run(async (ctx) => {
      const workspaceId = team.workspaceId;
      const ids: Id<"members">[] = [];
      for (let i = 0; i < MEMBERS; i++) {
        ids.push(
          await ctx.db.insert("members", {
            workspaceId, slackUserId: `U${i}`, name: `Member ${String(i).padStart(3, "0")}`, isAdmin: false, isBot: false,
            deactivated: false, totalGiven: 100 + i, totalReceived: 100 + i, totalMaxedDays: 3,
          }),
        );
      }
      const stat = (bucket: string, given: number): Omit<Doc<"workspaceStats">, "_id" | "_creationTime"> => ({
        workspaceId, bucket, given, kudosRows: given, messages: given, givers: MEMBERS, receivers: MEMBERS, giverDays: given,
        cappedGiven: given, maxedDays: 1, fromReactions: 0, fromMessages: given, heat: new Array(heatSize(bucket)).fill(1),
        found: zeroFound(),
      });
      const buckets = new Set<string>();
      for (let day = "2025-01-01"; day <= "2026-12-31"; day = addDays(day, 1)) {
        await ctx.db.insert("workspaceStats", stat(`d:${day}`, 150));
        buckets.add(`m:${day.slice(0, 7)}`);
      }
      for (const b of [...buckets, "q:2025-Q4", "q:2026-Q4", "y:2025", "y:2026"]) await ctx.db.insert("workspaceStats", stat(b, 5000));
      await ctx.db.insert("workspaceStats", { ...stat("all", 100_000), rollupsBackfilledAt: NOW.getTime() });
      for (const bucket of ["y:2025", "y:2026", "m:2026-12", "m:2026-11"]) {
        for (const [i, memberId] of ids.entries()) {
          await ctx.db.insert("memberStats", { workspaceId, memberId, bucket, given: 50 + i, received: 50 + i, maxedDays: 2, activeDays: 40 });
        }
      }
      for (let i = 0; i < 5000; i++) {
        await ctx.db.insert("pairStats", { workspaceId, bucket: "y:2026", giverId: ids[i % MEMBERS], receiverId: ids[(i * 7 + 1) % MEMBERS], amount: 1 + (i % 40) });
      }
      for (let i = 0; i < 300; i++) await ctx.db.insert("channelStats", { workspaceId, bucket: "y:2026", channel: `c${i}`, amount: 1 + i });
    });
  }

  async function measure(period: Period, today: string) {
    return await t.run(async (ctx) => {
      const tally = { docs: 0, bytes: 0, ranges: 0 };
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const result = await overviewFor(counting(ctx, tally), workspace, period, today);
      if (process.env.READS_LOG) (await import("node:fs")).appendFileSync(process.env.READS_LOG, `${period} (today ${today}): ${JSON.stringify(tally)}\n`);
      return { result, tally };
    });
  }

  test("a year stays within ~2.4k small documents, exact and untruncated", async () => {
    await seedTwoBusyYears();
    const { result, tally } = await measure("year", "2026-12-31");
    // 500 members, 500 + 500 member rows for this and last year, 365 + 365 days, the top pairs and channels.
    expect(tally.docs).toBeGreaterThan(2_200);
    expect(tally.docs).toBeLessThanOrEqual(2_400);
    expect(tally.bytes).toBeLessThan(1024 * 1024);
    expect(tally.ranges).toBeLessThan(50);
    expect(result.truncated).toBe(false);
    expect(result.volume).toHaveLength(365);
    expect(result.kpis).toMatchObject({ total: 365 * 150, prevTotal: 365 * 150, givers: MEMBERS, retained: MEMBERS, newGivers: 0 });
    expect(result.topPairs?.[0].value).toBe(40);
    expect(result.channels).toHaveLength(8);
  }, 60_000);

  test("a month and all time read far less", async () => {
    await seedTwoBusyYears();
    const month = await measure("month", "2026-12-31");
    expect(month.tally.docs).toBeGreaterThan(1_500);
    expect(month.tally.docs).toBeLessThanOrEqual(1_600);
    expect(month.result.volume).toHaveLength(31);
    const all = await measure("all", "2026-12-31");
    expect(all.tally.docs).toBeGreaterThan(500);
    expect(all.tally.docs).toBeLessThanOrEqual(600);
    expect(all.result.volume).toHaveLength(24);
    expect(all.result.kpis.total).toBe(100_000);
  }, 60_000);
});
