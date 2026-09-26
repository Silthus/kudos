import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { DEMO_YOU } from "../convex/demo";
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

/** The demo visitor, and the seeds to plant waiting for a member (the visitor by default). */
const visitor = () =>
  t.run(async (ctx) => {
    const you = (await ctx.db.query("members").collect()).find((m) => m.slackUserId === DEMO_YOU)!;
    return { you };
  });
const unplanted = (slackUserId = DEMO_YOU) =>
  t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((m) => m.slackUserId === slackUserId)!;
    return (await ctx.db.query("seeds").collect()).filter((s) => s.receiverId === member._id && s.plantedAt === undefined).length;
  });

/** A thank that went through, narrowed. */
async function thankedBy(demo: Awaited<ReturnType<typeof enterDemo>>) {
  const res = await demo.mutation(api.demo.beThanked, {});
  if (res.status !== "thanked") throw new Error(`not thanked: ${res.status}`);
  return res;
}

test("a teammate thanks you thoughtfully: a seed waits for you, its DM says so, and planting it feeds the tree", async () => {
  const demo = await enterDemo();
  const { you } = await visitor();
  expect((await demo.query(api.tree.state, {}))!.seedsToPlant).toBe(0);

  const thanked = await thankedBy(demo);

  expect(thanked.from.name).toMatch(/^\p{L}+ \p{L}+$/u);
  expect(thanked.text).toMatch(/^@Alex \S+ (\S+ ){2,}\S+/u); // a Note of 3+ words
  const row = await t.run(async (ctx) => (await ctx.db.query("kudos").order("desc").take(1))[0]);
  expect(row).toMatchObject({ receiverId: you._id, source: "playground", channelName: "general", amount: 1 });
  expect(thanked.messages).toEqual([
    expect.objectContaining({ toMe: true, category: "receiver_success", text: expect.stringContaining(thanked.from.name), seeds: "1 seed to plant at the tree" }),
  ]);

  const before = (await demo.query(api.tree.state, {}))!;
  expect(before.seedsToPlant).toBe(1);
  await thankedBy(demo);
  expect((await demo.query(api.tree.state, {}))!.seedsToPlant).toBe(2);
  expect(await demo.mutation(api.tree.plantSeeds, {})).toMatchObject({ planted: 2 });
  const after = (await demo.query(api.tree.state, {}))!;
  expect(after.seedsToPlant).toBe(0);
  expect(after.sap).toBeGreaterThan(before.sap);
});

test("the giver is never someone you just thanked, each thank is someone new, and three a day is the most", async () => {
  const demo = await enterDemo();
  await demo.mutation(api.demo.simulateMessage, {
    text: "<@UDEMOPRIYA> <@UDEMOJONAS> <@UDEMOLENA> :seedling: thanks for carrying the launch with me",
    channelName: "general",
  });

  const givers = [];
  for (let i = 0; i < 3; i++) {
    givers.push((await thankedBy(demo)).from.name);
    expect(await unplanted()).toBe(i + 1); // never a thank-back: every one sows a seed
  }
  expect(new Set(givers).size).toBe(3);
  expect(givers).not.toEqual(expect.arrayContaining(["Priya Raman"]));
  expect(givers).not.toEqual(expect.arrayContaining(["Jonas Weber"]));
  expect(givers).not.toEqual(expect.arrayContaining(["Lena Hoffmann"]));

  expect(await demo.mutation(api.demo.beThanked, {})).toEqual({ status: "capped" });
  expect(await unplanted()).toBe(3);
});

test("Refill my kudos starts your day over: the teammates' thanks go too, so thanking them back counts again", async () => {
  const demo = await enterDemo();
  for (let i = 0; i < 3; i++) await thankedBy(demo);
  const thanked = await demo.mutation(api.demo.beThanked, {});
  expect(thanked.status).toBe("capped");

  await demo.mutation(api.demo.refillAllowance, {});
  expect(await unplanted()).toBe(0);

  const again = await thankedBy(demo);
  const giver = await t.run(async (ctx) => (await ctx.db.query("members").collect()).find((m) => m.name === again.from.name)!);
  await demo.mutation(api.demo.refillAllowance, {});
  const theirs = await unplanted(giver.slackUserId);
  await demo.mutation(api.demo.simulateMessage, { text: `<@${giver.slackUserId}> :seedling: thanks for the thoughtful review`, channelName: "general" });
  expect(await unplanted(giver.slackUserId)).toBe(theirs + 1); // not a thank-back any more: it sows their seed
});

test("only a demo visitor can be thanked from the sandbox", async () => {
  const team = await seedTeam(t);
  const ben = await signInAs(t, team.ben);
  await expect(ben.mutation(api.demo.beThanked, {})).rejects.toThrow(/only works in the demo workspace/);
});
