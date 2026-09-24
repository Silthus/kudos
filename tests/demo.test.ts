import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { addDays, weekdayOfKey } from "../convex/lib/time";
import { all, CONVEX_LIMITS, DEMO_TIMEOUT, NOW, setupConvex, TODAY } from "./helpers";

let t: ReturnType<typeof setupConvex>;

vi.setConfig({ testTimeout: DEMO_TIMEOUT });

beforeEach(() => {
  // Every demo transaction must fit Convex's limits, as it would on a real deployment.
  t = setupConvex({ transactionLimits: true });
});
afterEach(() => vi.useRealTimers());

async function enterDemo() {
  const userId = await t.mutation(internal.demo.ensureDemoUser, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  return t.withIdentity({ subject: `${userId}|s` });
}

describe("the demo workspace", () => {
  test("is created once and always signs visitors in as the same demo admin", async () => {
    const first = await t.mutation(internal.demo.ensureDemoUser, {});
    const second = await t.mutation(internal.demo.ensureDemoUser, {});
    expect(first).toBe(second);
    const viewer = await t.withIdentity({ subject: `${first}|s` }).query(api.session.viewer, {});
    expect(viewer).toMatchObject({ status: "ready", member: { name: "Alex Rivera", isAdmin: true }, workspace: { isDemo: true } });
  });

  test("seeds history whose totals and daily rollups agree with the raw kudos", async () => {
    await enterDemo();
    const [kudos, days, members] = await Promise.all([
      all(t, "kudos"),
      all(t, "memberDays"),
      t.run((ctx) => ctx.db.query("members").collect()),
    ]);
    expect(kudos.length).toBeGreaterThan(500);

    const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);
    for (const m of members) {
      expect(m.totalGiven).toBe(sum(kudos.filter((k) => k.giverId === m._id)));
      expect(m.totalReceived).toBe(sum(kudos.filter((k) => k.receiverId === m._id)));
      expect(m.totalMaxedDays).toBe(days.filter((d) => d.memberId === m._id && d.maxed).length);
    }
    const byDay = new Map<string, number>();
    for (const k of kudos) byDay.set(`${k.giverId}|${k.dayKey}`, (byDay.get(`${k.giverId}|${k.dayKey}`) ?? 0) + k.amount);
    for (const d of days.filter((d) => d.given > 0)) {
      expect(d.given).toBe(byDay.get(`${d.memberId}|${d.dayKey}`));
      expect(d.given).toBeLessThanOrEqual(5);
    }
  });

  test("the playground runs messages through the real engine", async () => {
    const demo = await enterDemo();
    const res = await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :taco::taco: great work", channelName: "general" });
    expect(res.status).toBe("given");
    expect(res.messages.map((m) => [m.to, m.category])).toEqual([
      ["Alex Rivera", "giver_success"],
      ["Priya Raman", "receiver_success"],
    ]);
    expect((await demo.query(api.me.today, { today: TODAY })).remaining).toBe(3);
  });

  test("resetting wipes playground activity and re-seeds a fresh history", async () => {
    const demo = await enterDemo();
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :taco:", channelName: "general" });
    await demo.mutation(api.demo.resetDemo, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    const kudos = await all(t, "kudos");
    expect(kudos.every((k) => k.source === "seed")).toBe(true);
    expect(await all(t, "notifications")).toHaveLength(0);
    const alex = await t.run((ctx) =>
      ctx.db.query("members").filter((q) => q.eq(q.field("slackUserId"), "UDEMOYOU")).unique(),
    );
    expect(alex!.totalGiven).toBe(kudos.filter((k) => k.giverId === (alex!._id as Id<"members">)).reduce((s, k) => s + k.amount, 0));
    // The rollup rebuild after seeding recomputes the giving profile from the fresh history.
    const days = (await all(t, "memberDays")).filter((d) => d.memberId === alex!._id && d.given > 0);
    expect(alex!.lastActiveDay).toBe(days.map((d) => d.dayKey).sort().at(-1));
    expect(alex!.givenByWeekday!.reduce((a, b) => a + b, 0)).toBe(alex!.totalGiven);
  });
});

/** Every day from `from` through `to`, inclusive. */
function daysFrom(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

describe("a year of demo history", () => {
  test("covers 1 January up to now, with kudos on every workday and nothing in the future", async () => {
    await enterDemo();
    const kudos = await all(t, "kudos");
    const days = new Set(kudos.map((k) => k.dayKey));
    expect([...days].sort()[0]).toBe("2026-01-01");
    const quietWorkdays = daysFrom("2026-01-01", addDays(TODAY, -1)).filter((d) => weekdayOfKey(d) < 5 && !days.has(d));
    expect(quietWorkdays).toEqual([]);
    expect(kudos.filter((k) => k.at > NOW.getTime())).toEqual([]);
    expect(days.has(TODAY)).toBe(true);
  });

  test("has the rhythm of a real team: quiet weekends and holidays, launches, and growth", async () => {
    await enterDemo();
    const perDay = new Map<string, number>();
    for (const k of await all(t, "kudos")) perDay.set(k.dayKey, (perDay.get(k.dayKey) ?? 0) + k.amount);
    const year = daysFrom("2026-01-01", addDays(TODAY, -1));
    /** Average kudos per workday (or per weekend day) between two days. */
    const average = (from: string, to: string, weekend = false) => {
      const days = year.filter((d) => d >= from && d <= to && (weekdayOfKey(d) >= 5) === weekend);
      return days.reduce((s, d) => s + (perDay.get(d) ?? 0), 0) / days.length;
    };

    expect(average("2026-01-01", TODAY, true)).toBeLessThan(0.3 * average("2026-01-01", TODAY));
    // New Year, Easter (Good Friday to Easter Monday) and the August summer holidays are quiet.
    expect(average("2026-01-01", "2026-01-06")).toBeLessThan(0.6 * average("2026-01-12", "2026-01-30"));
    expect(average("2026-04-03", "2026-04-06")).toBeLessThan(0.6 * average("2026-04-13", "2026-04-30"));
    expect(average("2026-08-03", "2026-08-21")).toBeLessThan(0.7 * average("2026-06-29", "2026-07-31"));
    // The spring launch week, the team offsite and the autumn release week stand out.
    expect(average("2026-03-16", "2026-03-20")).toBeGreaterThan(1.3 * average("2026-03-02", "2026-03-13"));
    expect(perDay.get("2026-06-25")!).toBeGreaterThan(1.5 * average("2026-06-01", "2026-06-24"));
    expect(average("2026-09-07", "2026-09-11")).toBeGreaterThan(1.2 * average("2026-08-24", "2026-09-04"));
    // And the team gives a little more as the year goes on.
    expect(average("2026-05-04", "2026-06-19")).toBeGreaterThan(1.05 * average("2026-01-12", "2026-02-27"));
  });

  test("seeds, rebuilds and resets well within Convex's transaction limits", async () => {
    const half = Object.fromEntries(Object.entries(CONVEX_LIMITS).map(([k, n]) => [k, n / 2]));
    t = setupConvex({ transactionLimits: half });
    const demo = await enterDemo();
    await demo.mutation(api.demo.resetDemo, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    const failed = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind !== "success"),
    );
    expect(failed.map((f) => [f.name, f.state])).toEqual([]);
    expect((await all(t, "kudos")).map((k) => k.dayKey).sort()[0]).toBe("2026-01-01");
  });

  test("leaves today's allowances for the playground", async () => {
    await enterDemo();
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    const alex = members.find((m) => m.slackUserId === "UDEMOYOU")!;
    const today = (await all(t, "memberDays")).filter((d) => d.dayKey === TODAY);
    expect(today.find((d) => d.memberId === alex._id)?.given ?? 0).toBe(0);
    expect(Math.max(...today.map((d) => d.given))).toBeLessThan(5);
  });
});

const ROLLUP_TABLES = ["workspaceStats", "memberStats", "pairStats", "channelStats"] as const;

async function rollupLines() {
  return await t.run(async (ctx) => {
    const lines: string[] = [];
    for (const table of ROLLUP_TABLES) {
      for (const row of await ctx.db.query(table).collect()) {
        const { _id, _creationTime, ...rest } = row as Record<string, unknown>;
        delete rest.rollupsBackfilledAt;
        lines.push(`${table} ${JSON.stringify(Object.fromEntries(Object.entries(rest).sort()))}`);
      }
    }
    return lines.sort();
  });
}

async function demoWorkspaceId() {
  return (await t.run((ctx) => ctx.db.query("workspaces").collect())).find((w) => w.isDemo)!._id;
}

describe("the demo's read-model rollups", () => {
  test("are built from the seeded history, and a backfill over it equals what live gives maintain", async () => {
    const demo = await enterDemo();
    const workspaceId = await demoWorkspaceId();
    const all = (await t.run((ctx) => ctx.db.query("workspaceStats").collect())).find((w) => w.bucket === "all");
    expect(all?.rollupsBackfilledAt).toBeTypeOf("number");
    expect(all?.given).toBe((await t.run((ctx) => ctx.db.query("kudos").collect())).reduce((n, k) => n + k.amount, 0));

    // Live playground activity on top of the seeded history is maintained transactionally.
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> <@UDEMOJONAS> :taco::taco: great work", channelName: "design" });
    await demo.mutation(api.demo.simulateReaction, { authorSlackUserId: "UDEMOLENA", messageText: "shipped!", messageKey: "k1" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000); // teammates thank you back
    await demo.mutation(api.demo.refillAllowance, {});
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOAIKO> :taco: thanks", channelName: "general" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    const maintained = await rollupLines();

    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    expect(await rollupLines()).toEqual(maintained);

    // And both agree with the legacy computation, sampled across the seeded months.
    const buckets = ["d:2026-09-22", "w:2026-W38", "m:2026-08", "m:2026-09", "w:2026-W22"];
    expect(await t.query(internal.rollups.verify, { workspaceId, buckets })).toEqual({ checked: buckets, mismatches: [] });
  });

  test("a reset wipes every rollup row before the fresh history is seeded", async () => {
    const demo = await enterDemo();
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :taco:", channelName: "general" });
    await demo.mutation(api.demo.resetDemo, {});
    let seeding = false;
    for (let i = 0; i < 50 && !seeding; i++) {
      vi.runOnlyPendingTimers();
      await t.finishInProgressScheduledFunctions();
      const pending = await t.run(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
      );
      seeding = pending.some((f) => f.name.includes("seedHistory"));
    }
    expect(seeding).toBe(true);
    const counts = await t.run(async (ctx) =>
      Promise.all(ROLLUP_TABLES.map(async (table) => (await ctx.db.query(table).collect()).length)),
    );
    expect(counts).toEqual([0, 0, 0, 0]);

    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    const all = (await t.run((ctx) => ctx.db.query("workspaceStats").collect())).find((w) => w.bucket === "all");
    expect(all?.rollupsBackfilledAt).toBeTypeOf("number");
  });
});

describe("a demo reset during a running backfill", () => {
  test("stops the stale run, so the marker is only ever set on rollups that match the kudos", async () => {
    await enterDemo();
    const workspaceId = await demoWorkspaceId();
    await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId });
    for (let i = 0; i < 44; i++) await runScheduledStep();
    await t.mutation(internal.demo.startDemoReset, {});

    let marked = 0;
    for (let i = 0; i < 500 && (await runScheduledStep()); i++) {
      const state = await t.run(async (ctx) => ({
        all: (await ctx.db.query("workspaceStats").collect()).find((w) => w.bucket === "all"),
        given: (await ctx.db.query("kudos").collect()).reduce((n, k) => n + k.amount, 0),
        resetting: (await ctx.db.get(workspaceId))!.resettingSince !== undefined,
        mirrored: (await ctx.db.get(workspaceId))!.rollupsBackfilledAt,
      }));
      // The workspace's copy of the marker (read by `me`) never claims more than the `all` row's.
      if (state.mirrored !== undefined) {
        expect(state.resetting, `step ${i}: marked while the reset is still running`).toBe(false);
        expect(state.mirrored, `step ${i}`).toBe(state.all?.rollupsBackfilledAt);
      }
      if (state.all?.rollupsBackfilledAt !== undefined) {
        marked += 1;
        expect(state.resetting, `step ${i}: marked while the reset is still running`).toBe(false);
        expect(state.all.given, `step ${i}`).toBe(state.given);
      }
    }
    expect(marked).toBeGreaterThan(0);
    const workspace = await t.run((ctx) => ctx.db.get(workspaceId));
    expect(workspace!.resettingSince).toBeUndefined();
    expect(workspace!.rollupsBackfilledAt).toBeTypeOf("number");
  });
});

/** Run the scheduled functions due now; false once nothing is left. */
async function runScheduledStep() {
  const pending = await t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
  );
  if (pending.length === 0) return false;
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
  return true;
}

describe("demo abuse protection", () => {
  test("reactions only work on messages by real demo teammates", async () => {
    const demo = await enterDemo();
    await expect(
      demo.mutation(api.demo.simulateReaction, { authorSlackUserId: "UAAAAJUNK", messageText: "x", messageKey: "k" }),
    ).rejects.toThrow(/teammate/);
  });

  test("shared demo settings are read-only", async () => {
    const demo = await enterDemo();
    const settings = { emojiName: "taco", emojiGlyph: "🌮", unitSingular: "kudos", unitPlural: "kudos", dailyLimit: 99, timezone: "UTC", receivedVisibility: "everyone" as const, reactionsEnabled: true, notifyGiver: true, notifyReceiver: true };
    await expect(demo.mutation(api.admin.updateSettings, settings)).rejects.toThrow(/demo/);
  });

  test("a second reset while one is running is ignored", async () => {
    const demo = await enterDemo();
    await demo.mutation(api.demo.resetDemo, {});
    await demo.mutation(api.demo.resetDemo, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    const days = await all(t, "memberDays");
    const keys = days.map((d) => `${d.memberId}|${d.dayKey}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("sharing the demo", () => {
  test("visitors can refill the shared allowance; seeded history stays intact", async () => {
    const demo = await enterDemo();
    const seeded = (await all(t, "kudos")).length;
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :taco::taco::taco::taco::taco:", channelName: "general" });
    expect((await demo.query(api.me.today, { today: TODAY })).remaining).toBe(0);

    await demo.mutation(api.demo.refillAllowance, {});
    expect((await demo.query(api.me.today, { today: TODAY })).remaining).toBe(5);
    expect(await all(t, "kudos")).toHaveLength(seeded);
  });
});
