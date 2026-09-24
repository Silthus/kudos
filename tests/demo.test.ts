import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { addDays, weekdayOfKey } from "../convex/lib/time";
import { DEMO_REWARDS } from "../convex/lib/demoStore";
import { requestRedemption } from "../convex/store";
import { all, CONVEX_LIMITS, DEMO_TIMEOUT, NOW, seedTeam, setupConvex, signInAs, TODAY } from "./helpers";

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

  test("seeds, rebuilds and resets within half of Convex's transaction limits", async () => {
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
    vi.setSystemTime(new Date("2026-09-21T21:30:00Z")); // a busy Monday, 23:30 in Berlin: the whole working day is seeded
    await enterDemo();
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    const alex = members.find((m) => m.slackUserId === "UDEMOYOU")!;
    const today = (await all(t, "memberDays")).filter((d) => d.dayKey === "2026-09-21" && d.given > 0);
    expect(today.length).toBeGreaterThan(3);
    expect(today.find((d) => d.memberId === alex._id)).toBeUndefined();
    expect(Math.max(...today.map((d) => d.given))).toBe(4);
  });

  test("never has less than four months of history, even on New Year's Day", async () => {
    vi.setSystemTime(new Date("2026-12-31T23:30:00Z")); // already 1 January 2027 in Berlin
    await enterDemo();
    const days = [...new Set((await all(t, "kudos")).map((k) => k.dayKey))].sort();
    expect(days[0]).toBe("2026-09-03"); // 120 days back
    expect(days.at(-1)! <= "2027-01-01").toBe(true);
  });

  test("playground gives while today is being seeded never double a teammate's day", async () => {
    const demo = await enterDemo();
    await demo.mutation(api.demo.resetDemo, {});
    // Run the reset until the chunk that seeds today is next, then play before it runs.
    for (let i = 0; i < 500; i++) {
      const pending = await t.run(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
      );
      const seed = pending.find((f) => f.name.includes("seedHistory"));
      if (seed && (seed.args[0] as { fromDay: string }).fromDay > addDays(TODAY, -15)) break;
      await runScheduledStep();
    }
    for (const id of ["UDEMOPRIYA", "UDEMOLENA", "UDEMOJONAS", "UDEMOFREYA", "UDEMOSOFIA"]) {
      expect((await demo.mutation(api.demo.simulateMessage, { text: `<@${id}> :taco: thanks`, channelName: "general" })).status).toBe("given");
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);

    const failed = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "failed"),
    );
    expect(failed.map((f) => [f.name, f.state])).toEqual([]);
    const days = await all(t, "memberDays");
    const keys = days.map((d) => `${d.memberId}|${d.dayKey}`);
    expect(new Set(keys).size).toBe(keys.length);
    const givenToday = new Map<string, number>();
    for (const k of (await all(t, "kudos")).filter((k) => k.dayKey === TODAY)) {
      givenToday.set(k.giverId, (givenToday.get(k.giverId) ?? 0) + k.amount);
    }
    for (const d of days.filter((d) => d.dayKey === TODAY)) expect(d.given).toBe(givenToday.get(d.memberId) ?? 0);
    expect(Math.max(...givenToday.values())).toBeLessThanOrEqual(5);
    await demo.mutation(api.demo.refillAllowance, {});
  });
});

describe("the demo's quest history", () => {
  async function alex() {
    return (await t.run((ctx) => ctx.db.query("members").collect())).find((m) => m.slackUserId === "UDEMOYOU")!;
  }

  test("the quest log opens on every week of the year, completed by the seeded kudos, with no DMs", async () => {
    const demo = await enterDemo();
    const log = await demo.query(api.quests.history, { today: TODAY, weeks: 52 });
    // From Alex's first kudos of the year, after the New Year lull, to last week.
    expect(log.weeks[0].weekKey).toBe("2026-09-14");
    expect(log.weeks.at(-1)!.weekKey).toBe("2026-01-05");
    expect(log.weeks).toHaveLength(37);
    // Alive, not perfect: most weeks have a completion, some are clean sweeps, some quests stay open.
    expect(log.totals.weeksWithCompletion).toBeGreaterThan(log.weeks.length / 2);
    expect(log.totals.sweeps).toBeGreaterThan(2);
    expect(log.weeks.flatMap((w) => w.board).filter((q) => !q.done && !q.waived).length).toBeGreaterThan(10);

    // Every completion is the moment one of Alex's own thoughtful seeded kudos met the goal.
    const me = await alex();
    const kudos = await all(t, "kudos");
    // Seeded kudos come with a reason, except Alex's this week: those quests are the playground's.
    const thisWeek = (k: (typeof kudos)[number]) => k.giverId === me._id && k.dayKey >= "2026-09-21";
    expect(kudos.filter((k) => !thisWeek(k)).every((k) => (k.noteWords ?? 0) >= 3)).toBe(true);
    expect(kudos.filter(thisWeek).every((k) => k.noteWords === undefined)).toBe(true);
    const mine = (await all(t, "questCompletions")).filter((c) => c.memberId === me._id);
    for (const c of mine) {
      expect(kudos.some((k) => k.giverId === me._id && k.at === c.completedAt && k.dayKey >= c.weekKey && k.dayKey < addDays(c.weekKey, 7))).toBe(true);
    }
    // Quest logs are private and every visitor is Alex, so teammates only have this week's on record:
    // what their seeded days already met, so their next live kudos doesn't claim it again.
    const theirs = (await all(t, "questCompletions")).filter((c) => c.memberId !== me._id);
    expect(new Set(theirs.map((c) => c.memberId)).size).toBeGreaterThan(2);
    expect(new Set(theirs.map((c) => c.weekKey))).toEqual(new Set(["2026-09-21"]));

    // Their Quest messages are in the collection, but nobody was sent anything.
    const found = (await all(t, "discoveries")).filter((d) => d.memberId === me._id && d.category === "quest_complete");
    expect(found.length).toBeGreaterThan(2);
    expect(found.reduce((n, d) => n + d.timesSeen, 0)).toBe(mine.length);
    expect(await all(t, "notifications")).toHaveLength(0);
  });

  test("Alex's board starts every week open for the playground, even late on a Friday", async () => {
    vi.setSystemTime(new Date("2026-09-25T15:00:00Z"));
    const demo = await enterDemo();
    const me = await alex();
    // Alex did give this week (the leaderboard and Me page show it) ...
    expect((await all(t, "kudos")).some((k) => k.giverId === me._id && k.dayKey >= "2026-09-21")).toBe(true);
    // ... but this week's quests are left for visitors to complete.
    const board = await demo.query(api.quests.mine, { today: "2026-09-25" });
    if (!board.enabled) throw new Error("quests are disabled");
    expect(board.quests.map((q) => [q.status, q.progress]).filter(([s]) => s !== "waived")).toEqual(
      board.quests.filter((q) => q.status !== "waived").map(() => ["active", 0]),
    );
    const res = await demo.mutation(api.demo.simulateMessage, {
      text: "<@UDEMOOSKAR> :taco: thanks for untangling the deploy pipeline on friday, saved my whole afternoon",
      channelName: "general",
    });
    expect(res.status).toBe("given");
    const after = await demo.query(api.quests.mine, { today: "2026-09-25" });
    if (!after.enabled) throw new Error("quests are disabled");
    expect(after.quests.reduce((n, q) => n + q.progress, 0)).toBeGreaterThan(0);
  });

  test("a first seeding overtaken by a reset doesn't record quests for the reset's half-seeded history", async () => {
    await t.mutation(internal.demo.ensureDemoUser, {});
    for (let i = 0; i < 5; i++) await runScheduledStep(); // part-way through the year
    const workspaceId = (await t.run((ctx) => ctx.db.query("workspaces").collect())).find((w) => w.isDemo)!._id;
    await t.run((ctx) => ctx.db.patch(workspaceId, { resettingSince: Date.now() })); // a reset takes the lock
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    expect(await all(t, "questCompletions")).toEqual([]);
  });

  test("a seeding run from before a reset stops and leaves the reset to the fresh run", async () => {
    await enterDemo();
    const workspaceId = (await t.run((ctx) => ctx.db.query("workspaces").collect())).find((w) => w.isDemo)!._id;
    const before = (await all(t, "questCompletions")).length;
    await t.run((ctx) => ctx.db.patch(workspaceId, { resettingSince: Date.now() }));
    await t.mutation(internal.quests.seedDemoHistory, { workspaceId, weekKey: "2026-01-05" }); // the stale run
    const pending = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
    );
    expect(pending).toEqual([]);
    expect(await all(t, "questCompletions")).toHaveLength(before);
  });
});

const ROLLUP_TABLES = ["workspaceStats", "memberStats", "pairStats", "channelStats", "messageStats"] as const;

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
    expect(counts).toEqual([0, 0, 0, 0, 0]);

    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    const all = (await t.run((ctx) => ctx.db.query("workspaceStats").collect())).find((w) => w.bucket === "all");
    expect(all?.rollupsBackfilledAt).toBeTypeOf("number");
  });
});

describe("the demo's message finders (#86)", () => {
  test("match the discoveries whenever the gallery reads them: seeded, played, and across a reset", async () => {
    const demo = await enterDemo();
    const workspaceId = await demoWorkspaceId();
    const expectExact = async (step: string) => {
      const { discoveries, stats } = await t.run(async (ctx) => ({
        discoveries: await ctx.db.query("discoveries").collect(),
        stats: await ctx.db.query("messageStats").collect(),
      }));
      const byKey = new Map<string, Set<string>>();
      for (const d of discoveries) byKey.set(d.templateKey, (byKey.get(d.templateKey) ?? new Set()).add(d.memberId));
      const lines = [...byKey].map(([k, s]) => `${k} ${s.size}`);
      const collectors = new Set(discoveries.map((d) => d.memberId)).size;
      lines.push(`* ${collectors}`);
      expect(stats.map((s) => `${s.templateKey} ${s.finders}`).sort(), step).toEqual(lines.sort());
      const g = await demo.query(api.discoveries.gallery, {});
      expect(g.collectors, step).toBe(collectors);
      expect(g.items.filter((i) => i.foundBy > 0).map((i) => `${i.key} ${i.foundBy}`).sort(), step).toEqual(
        lines.filter((l) => !l.startsWith("* ")).sort(),
      );
    };
    await expectExact("seeded");
    expect(new Set((await all(t, "discoveries")).map((d) => d.category)).has("quest_complete")).toBe(true);

    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> <@UDEMOJONAS> :taco::taco: great work", channelName: "design" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000); // teammates thank you back
    await expectExact("played");

    await demo.mutation(api.demo.resetDemo, {});
    let marked = 0;
    for (let i = 0; i < 2000 && (await runScheduledStep()); i++) {
      if ((await t.run((ctx) => ctx.db.get(workspaceId)))!.rollupsBackfilledAt === undefined) continue;
      marked += 1;
      await expectExact(`reset step ${i}`);
    }
    expect(marked).toBeGreaterThan(0);
    await expectExact("reset");
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

// ── The demo store (S5) ───────────────────────────────────────────────────────

const page = { numItems: 100, cursor: null };

/** Every store counter agrees with the redemptions and adjustments behind it. */
async function expectStoreInvariants() {
  const { members, rewards, redemptions, adjustments } = await t.run(async (ctx) => ({
    members: await ctx.db.query("members").collect(),
    rewards: await ctx.db.query("rewards").collect(),
    redemptions: await ctx.db.query("redemptions").collect(),
    adjustments: await ctx.db.query("balanceAdjustments").collect(),
  }));
  const held = (r: { status: string }) => r.status !== "declined" && r.status !== "cancelled";
  for (const m of members) {
    const mine = redemptions.filter((r) => r.memberId === m._id);
    expect(m.storeSpent ?? 0, m.name).toBe(mine.filter(held).reduce((s, r) => s + r.cost, 0));
    expect(m.storeGranted ?? 0, m.name).toBe(adjustments.filter((a) => a.memberId === m._id).reduce((s, a) => s + a.amount, 0));
    expect(m.totalReceived + (m.storeGranted ?? 0) - (m.storeSpent ?? 0), `${m.name}'s balance`).toBeGreaterThanOrEqual(0);
  }
  for (const reward of rewards) {
    const of = redemptions.filter((r) => r.rewardId === reward._id);
    expect(reward.openCount ?? 0, reward.name).toBe(of.filter((r) => r.isOpen).length);
    expect(reward.fulfilledCount ?? 0, reward.name).toBe(of.filter((r) => r.status === "fulfilled").length);
    // Stock left plus stock held by requests is what the catalog started with.
    const initial = DEMO_REWARDS.find((r) => r.name === reward.name)!.stock;
    const holding = of.filter((r) => held(r) && r.stockHeld).length;
    expect(reward.stock === undefined ? undefined : reward.stock + holding, `${reward.name} stock`).toBe(initial);
  }
  return { members, rewards, redemptions, adjustments };
}

const memberNamed = async (name: string) =>
  (await t.run((ctx) => ctx.db.query("members").collect())).find((m) => m.name === name)!;

describe("the demo store", () => {
  test("opens with the six-reward catalog and a year of teammates' redemptions", async () => {
    const demo = await enterDemo();
    const catalog = await demo.query(api.store.catalog, {});
    if (!catalog.enabled) throw new Error("the demo store is closed");
    expect(catalog.rewards.map((r) => [r.emoji, r.name, r.cost])).toEqual([
      ["☕", "Coffee on us", 15],
      ["💚", "Donate €25 to a charity", 25],
      ["🍜", "Team lunch", 40],
      ["🧥", "Hoodie", 60],
      ["🌴", "Half day off", 120],
      ["🥂", "Lunch with the CEO", 200],
    ]);
    const byName = new Map(catalog.rewards.map((r) => [r.name, r]));
    expect(byName.get("Donate €25 to a charity")!.prompt).toBe("Which charity?");
    expect(byName.get("Half day off")!.maxPerMember).toBe(1);
    expect(byName.get("Hoodie")!.stock).toBeGreaterThan(0);
    expect(byName.get("Hoodie")!.stock).toBeLessThan(10); // some went out over the year
    expect(byName.get("Lunch with the CEO")!.stock).toBe(1); // still up for grabs
    expect(catalog.balance).toBeGreaterThanOrEqual(15);

    const { redemptions } = await expectStoreInvariants();
    const statuses = new Set(redemptions.map((r) => r.status));
    expect([...statuses].sort()).toEqual(["approved", "cancelled", "declined", "fulfilled", "pending"]);
    const months = new Set(redemptions.map((r) => new Date(r.requestedAt).toISOString().slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(6); // spread across the year, not bunched up
    expect(redemptions.every((r) => r.requestedAt < NOW.getTime() && r.updatedAt <= NOW.getTime())).toBe(true);

    // The admin queue has teammates' requests waiting, oldest first.
    const open = await demo.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page });
    expect(open.page.length).toBeGreaterThanOrEqual(3);
    expect(open.page.some((r) => r.canDecide)).toBe(true);
    const alex = await memberNamed("Alex Rivera");
    expect(open.page.every((r) => r.requester._id !== alex._id)).toBe(true);
    // Alex has a past of his own too, and Lena granted someone a bonus.
    expect((await demo.query(api.store.myRedemptions, { paginationOpts: page })).page.length).toBeGreaterThan(0);
    expect((await t.run((ctx) => ctx.db.query("balanceAdjustments").collect())).length).toBeGreaterThan(0);
  });

  // Whenever the demo is reset: mid-year, on a Monday morning, on a Sunday, and early in a new year
  // when the window is the 120-day minimum.
  test.each(["2026-09-23T10:00:00Z", "2026-09-28T06:30:00Z", "2026-03-29T10:00:00Z", "2027-01-04T06:00:00Z"])(
    "tells a story with every status, in working hours, whenever it's seeded (%s)",
    async (now) => {
      vi.setSystemTime(new Date(now));
      const demo = await enterDemo();
      const { redemptions } = await expectStoreInvariants();
      expect([...new Set(redemptions.map((r) => r.status))].sort()).toEqual(["approved", "cancelled", "declined", "fulfilled", "pending"]);
      const moments = redemptions.flatMap((r) => r.history.map((h) => h.at));
      for (const at of moments) {
        const berlin = new Date(at).toLocaleString("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "numeric", hour12: false });
        const [weekday, hour] = berlin.split(" ");
        expect(["Sat", "Sun"], `${new Date(at).toISOString()} is on a weekend`).not.toContain(weekday);
        expect(Number(hour), `${new Date(at).toISOString()} is outside working hours`).toBeGreaterThanOrEqual(9);
        expect(Number(hour), `${new Date(at).toISOString()} is outside working hours`).toBeLessThan(18);
        expect(at).toBeLessThan(Date.now());
      }
      // The queue reads in the order people asked, oldest first.
      const open = await demo.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page });
      expect(open.page.map((r) => r.requester.name)).toEqual(["Priya Raman", "Jonas Weber", "Oskar Berg", "Diego Alvarez", "Lena Hoffmann"]);
    },
  );

  test("seeding the store twice changes nothing", async () => {
    await enterDemo();
    const snapshot = () => t.run(async (ctx) => [(await ctx.db.query("rewards").collect()).length, (await ctx.db.query("redemptions").collect()).length]);
    const before = await snapshot();
    await t.mutation(internal.demo.seedStore, { workspaceId: await demoWorkspaceId() });
    expect(await snapshot()).toEqual(before);
  });

  test("a store seed from a reset that was superseded does nothing", async () => {
    await enterDemo();
    const workspaceId = await demoWorkspaceId();
    await t.run(async (ctx) => {
      for (const table of ["rewards", "redemptions", "balanceAdjustments"] as const) {
        for (const row of await ctx.db.query(table).collect()) await ctx.db.delete(row._id);
      }
      await ctx.db.patch(workspaceId, { resettingSince: NOW.getTime() }); // a newer reset is running
    });
    await t.mutation(internal.demo.seedStore, { workspaceId, resetAt: NOW.getTime() - 60_000 });
    expect(await t.run((ctx) => ctx.db.query("rewards").collect())).toEqual([]);
  });

  test("Lena never decides in a real workspace", async () => {
    const team = await seedTeam(t, { storeEnabled: true });
    const { redemptionId } = await t.run(async (ctx) => {
      const rewardId = await ctx.db.insert("rewards", { workspaceId: team.workspaceId, name: "Coffee on us", emoji: "☕", cost: 1, status: "active", createdBy: team.ana, updatedAt: 0 });
      await ctx.db.patch(team.ben, { totalReceived: 5 });
      const workspace = (await ctx.db.get(team.workspaceId))!;
      return await requestRedemption(ctx, { workspace, member: (await ctx.db.get(team.ben))!, rewardId, expectedCost: 1, now: NOW.getTime() });
    });
    await t.mutation(internal.demo.storeTeammateDecision, { redemptionId, action: "approve" });
    expect((await t.run((ctx) => ctx.db.get(redemptionId)))!.status).toBe("pending");
  });

  test("early in the morning, the queue's newest requests are from the workday before, not a minute ago", async () => {
    vi.setSystemTime(new Date("2026-09-24T05:30:00Z")); // Thursday, 07:30 in Berlin: nobody's at work yet
    const demo = await enterDemo();
    const open = await demo.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page });
    const newest = Math.max(...open.page.map((r) => r.requestedAt));
    expect(new Date(newest).toISOString() < "2026-09-23T16:00:00Z").toBe(true); // Wednesday, working hours
  });

  /** The visitor's request for a reward, by name, at its current price. */
  async function redeem(demo: Awaited<ReturnType<typeof enterDemo>>, name: string, answer?: string) {
    const catalog = await demo.query(api.store.catalog, {});
    if (!catalog.enabled) throw new Error("the demo store is closed");
    const reward = catalog.rewards.find((r) => r.name === name)!;
    return await demo.mutation(api.store.redeem, { rewardId: reward._id, expectedCost: reward.cost, answer });
  }

  /** Lets `ms` pass and runs whatever the scheduler had due by then. */
  async function wait(ms: number) {
    vi.advanceTimersByTime(ms);
    await t.finishInProgressScheduledFunctions();
  }

  const mine = async (demo: Awaited<ReturnType<typeof enterDemo>>) => (await demo.query(api.store.myRedemptions, { paginationOpts: page })).page[0];

  test("Lena approves the visitor's request a few seconds later, then fulfils it", async () => {
    const demo = await enterDemo();
    await redeem(demo, "Coffee on us");
    expect(await mine(demo)).toMatchObject({ rewardName: "Coffee on us", status: "pending" });

    await wait(2_900);
    expect((await mine(demo)).status).toBe("pending");
    await wait(3_200); // 3–6 s after the request
    const approved = await mine(demo);
    expect(approved.status).toBe("approved");
    expect(approved.history.at(-1)!.by!.name).toBe("Lena Hoffmann");

    await wait(8_100); // 4–8 s after the approval
    const fulfilled = await mine(demo);
    expect(fulfilled.status).toBe("fulfilled");
    expect(fulfilled.history.map((h) => [h.status, h.by!.name])).toEqual([
      ["pending", "Alex Rivera"],
      ["approved", "Lena Hoffmann"],
      ["fulfilled", "Lena Hoffmann"],
    ]);
    expect(fulfilled.adminNote).toBeTruthy();
    await expectStoreInvariants();
  });

  test("Lena's decisions do nothing once the request has moved on", async () => {
    const demo = await enterDemo();
    const { redemptionId } = await redeem(demo, "Coffee on us");
    await demo.mutation(api.store.cancel, { redemptionId });
    await wait(20_000);
    expect((await mine(demo)).status).toBe("cancelled");

    // Lena fulfils it by hand first; her scheduled approval then has nothing left to do.
    const second = await redeem(demo, "Team lunch");
    const lena = await signInLena();
    await lena.mutation(api.storeAdmin.decide, { redemptionId: second.redemptionId, action: "fulfill" });
    await wait(20_000);
    const failed = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "failed"),
    );
    expect(failed).toEqual([]);
    expect((await mine(demo)).history.map((h) => h.status)).toEqual(["pending", "fulfilled"]);
    await expectStoreInvariants();
  });

  /** Lena's own session, as if she had opened Kudos. */
  async function signInLena() {
    const lena = await memberNamed("Lena Hoffmann");
    return t.withIdentity({ subject: `${lena.userId}|lena` });
  }

  test("the visitor can't approve their own request while Lena is around, but decides teammates'", async () => {
    const demo = await enterDemo();
    const { redemptionId } = await redeem(demo, "Coffee on us");
    await expect(demo.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" })).rejects.toThrow(/Another admin decides/);

    const open = await demo.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page });
    const own = open.page.find((r) => r._id === redemptionId)!;
    expect(own.canDecide).toBe(false);
    const teammate = open.page.find((r) => r.status === "pending" && r.canDecide)!;
    await demo.mutation(api.storeAdmin.decide, { redemptionId: teammate._id, action: "approve" });
    await demo.mutation(api.storeAdmin.decide, { redemptionId: teammate._id, action: "fulfill", note: "Enjoy!" });
    const fulfilled = await demo.query(api.storeAdmin.redemptions, { filter: "fulfilled", paginationOpts: page });
    expect(fulfilled.page.some((r) => r._id === teammate._id)).toBe(true);
    await expectStoreInvariants();
  });

  test("handing back my rewards restores the balance and stock, and keeps the seeded history", async () => {
    const demo = await enterDemo();
    const before = await demo.query(api.store.catalog, {});
    if (!before.enabled) throw new Error("the demo store is closed");
    const seededMine = (await demo.query(api.store.myRedemptions, { paginationOpts: page })).page.map((r) => r._id);

    await redeem(demo, "Hoodie");
    await wait(20_000); // approved and fulfilled by Lena
    await redeem(demo, "Coffee on us"); // still pending
    const { redemptionId } = await redeem(demo, "Team lunch");
    await demo.mutation(api.store.cancel, { redemptionId }); // already refunded
    const spent = await demo.query(api.store.catalog, {});
    if (!spent.enabled) throw new Error("the demo store is closed");
    expect(spent.balance).toBe(before.balance - 60 - 15);

    await demo.mutation(api.demo.handBackRewards, {});
    const after = await demo.query(api.store.catalog, {});
    expect(after).toEqual(before);
    expect((await demo.query(api.store.myRedemptions, { paginationOpts: page })).page.map((r) => r._id)).toEqual(seededMine);
    await wait(20_000); // Lena's pending decisions find nothing left to do
    await expectStoreInvariants();
  });

  test("a reset wipes the store and its counters, then restocks the same story", async () => {
    const demo = await enterDemo();
    const story = async () =>
      (await t.run((ctx) => ctx.db.query("redemptions").collect())).map((r) => `${r.memberId} ${r.rewardName} ${r.status}`).sort();
    const seeded = await story();
    await redeem(demo, "Hoodie");
    await redeem(demo, "Coffee on us");
    await wait(20_000);

    await demo.mutation(api.demo.resetDemo, {});
    let seeding = false;
    for (let i = 0; i < 50 && !seeding; i++) {
      await runScheduledStep();
      const pending = await t.run(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.state.kind === "pending"),
      );
      seeding = pending.some((f) => f.name.includes("seedHistory"));
    }
    expect(seeding).toBe(true);
    const wiped = await t.run(async (ctx) => ({
      tables: await Promise.all((["rewards", "redemptions", "balanceAdjustments"] as const).map(async (table) => (await ctx.db.query(table).collect()).length)),
      counters: (await ctx.db.query("members").collect()).filter((m) => m.storeSpent !== undefined || m.storeGranted !== undefined),
    }));
    expect(wiped).toEqual({ tables: [0, 0, 0], counters: [] });

    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    expect(await story()).toEqual(seeded);
    const { rewards } = await expectStoreInvariants();
    expect(rewards).toHaveLength(6);
  });

  test("handing back rewards only works in the demo", async () => {
    const team = await seedTeam(t);
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.demo.handBackRewards, {})).rejects.toThrow(/only works in the demo workspace/);
  });
});
