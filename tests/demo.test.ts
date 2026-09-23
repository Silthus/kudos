import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { all, setupConvex } from "./helpers";

let t: ReturnType<typeof setupConvex>;

beforeEach(() => {
  t = setupConvex();
});
afterEach(() => vi.useRealTimers());

async function enterDemo() {
  const userId = await t.mutation(internal.demo.ensureDemoUser, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
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
    expect((await demo.query(api.me.today, {})).remaining).toBe(3);
  });

  test("resetting wipes playground activity and re-seeds a fresh history", async () => {
    const demo = await enterDemo();
    await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :taco:", channelName: "general" });
    await demo.mutation(api.demo.resetDemo, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const kudos = await all(t, "kudos");
    expect(kudos.every((k) => k.source === "seed")).toBe(true);
    expect(await all(t, "notifications")).toHaveLength(0);
    const alex = await t.run((ctx) =>
      ctx.db.query("members").filter((q) => q.eq(q.field("slackUserId"), "UDEMOYOU")).unique(),
    );
    expect(alex!.totalGiven).toBe(kudos.filter((k) => k.giverId === (alex!._id as Id<"members">)).reduce((s, k) => s + k.amount, 0));
  });
});

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
    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
    expect((await demo.query(api.me.today, {})).remaining).toBe(0);

    await demo.mutation(api.demo.refillAllowance, {});
    expect((await demo.query(api.me.today, {})).remaining).toBe(5);
    expect(await all(t, "kudos")).toHaveLength(seeded);
  });
});
