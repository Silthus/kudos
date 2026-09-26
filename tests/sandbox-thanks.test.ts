import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { DEMO_YOU } from "../convex/demo";
import { RECIPROCAL_WINDOW_MS } from "../convex/lib/quests";
import { workspaceNow } from "../convex/lib/time";
import { DEMO_TIMEOUT, seedTeam, setupConvex, signInAs } from "./helpers";

/**
 * The sandbox's "A teammate thanks you" (#179): a teammate gives the visitor a thoughtful kudos
 * through the real engine, so the demo has a seed to plant at the offering stone.
 */

let t: ReturnType<typeof setupConvex>;

vi.setConfig({ testTimeout: DEMO_TIMEOUT });
beforeEach(() => {
  t = setupConvex();
});
afterEach(() => vi.useRealTimers());

async function enterDemo() {
  const userId = await t.mutation(internal.demo.ensureDemoUser, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  return t.withIdentity({ subject: `${userId}|s` });
}

/** The demo visitor's seeds still to plant, and the workspace's clock. */
const visitor = () =>
  t.run(async (ctx) => {
    const you = (await ctx.db.query("members").collect()).find((m) => m.slackUserId === DEMO_YOU)!;
    const workspace = (await ctx.db.get(you.workspaceId))!;
    const unplanted = (await ctx.db.query("seeds").collect()).filter((s) => s.receiverId === you._id && s.plantedAt === undefined);
    return { you, now: workspaceNow(workspace), unplanted: unplanted.length };
  });

test("a teammate thanks you thoughtfully: a seed waits for you, its DM says so, and planting it feeds the tree", async () => {
  const demo = await enterDemo();
  expect((await demo.query(api.tree.state, {}))!.seedsToPlant).toBe(0);

  const thanked = await demo.mutation(api.demo.beThanked, {});

  expect(thanked).not.toBeNull();
  expect(thanked!.from.name).toMatch(/^\p{L}+ \p{L}+$/u);
  expect(thanked!.text).toMatch(/^@Alex \S+ (\S+ ){2,}\S+/u); // a Note of 3+ words
  const row = await t.run(async (ctx) => (await ctx.db.query("kudos").order("desc").take(1))[0]);
  expect(row).toMatchObject({ source: "playground", channelName: "general", amount: 1 });
  expect(thanked!.messages).toEqual([
    expect.objectContaining({ toMe: true, category: "receiver_success", text: expect.stringContaining(thanked!.from.name), seeds: "1 seed to plant at the tree" }),
  ]);

  const before = (await demo.query(api.tree.state, {}))!;
  expect(before.seedsToPlant).toBe(1);
  expect(await demo.mutation(api.demo.beThanked, {})).not.toBeNull();
  expect((await demo.query(api.tree.state, {}))!.seedsToPlant).toBe(2);
  expect(await demo.mutation(api.tree.plantSeeds, {})).toMatchObject({ planted: 2 });
  const after = (await demo.query(api.tree.state, {}))!;
  expect(after.seedsToPlant).toBe(0);
  expect(after.sap).toBeGreaterThan(before.sap);
});

test("the giver is never someone you thanked in the last 72 h: it's the teammate who thanked you longest ago", async () => {
  const demo = await enterDemo();
  await demo.mutation(api.demo.simulateMessage, {
    text: "<@UDEMOPRIYA> <@UDEMOJONAS> <@UDEMOLENA> :seedling: thanks for carrying the launch with me",
    channelName: "general",
  });

  for (let i = 0; i < 4; i++) {
    const { you, now } = await visitor();
    const expected = await t.run(async (ctx) => {
      const kudos = await ctx.db.query("kudos").collect();
      const thankedLately = new Set(kudos.filter((k) => k.giverId === you._id && k.source !== "spree" && k.at > now - RECIPROCAL_WINDOW_MS).map((k) => k.receiverId));
      const teammates = (await ctx.db.query("members").collect()).filter(
        (m) => m.workspaceId === you.workspaceId && !m.isBot && m._id !== you._id && !thankedLately.has(m._id),
      );
      const lastThanked = (id: string) => Math.max(-1, ...kudos.filter((k) => k.giverId === id && k.receiverId === you._id).map((k) => k.at));
      teammates.sort((a, b) => lastThanked(a._id) - lastThanked(b._id) || a.name.localeCompare(b.name));
      return { first: teammates[0].name, thankedLately: [...thankedLately] };
    });
    expect(expected.thankedLately.length).toBeGreaterThanOrEqual(3);

    const thanked = await demo.mutation(api.demo.beThanked, {});
    expect(thanked?.from.name).toBe(expected.first);
    const { unplanted } = await visitor();
    expect(unplanted).toBe(i + 1); // never a thank-back: every one sows a seed
  }
});

test("only a demo visitor can be thanked from the sandbox", async () => {
  const team = await seedTeam(t);
  const ben = await signInAs(t, team.ben);
  await expect(ben.mutation(api.demo.beThanked, {})).rejects.toThrow(/only works in the demo workspace/);
});
