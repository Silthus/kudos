import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { all, DEMO_TIMEOUT, setupConvex, TODAY } from "./helpers";

/**
 * The playground's kudos spree (#94, game spec §G16): a teammate's thoughtful kudos sits at 4 of 5
 * joiners, so one click on the bot's reaction and Join reaches the first tier.
 */

let t: ReturnType<typeof setupConvex>;

// Every test here enters the demo (see DEMO_TIMEOUT).
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

/** Runs what's due now, never a spree's 24 h deadline. */
async function settle() {
  for (let i = 0; i < 6; i++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }
}

test("a teammate's thoughtful kudos waits at 4 of 5; one Join reaches the first tier", async () => {
  const demo = await enterDemo();
  await demo.mutation(api.demo.openSpree, {});
  const post = (await demo.query(api.demo.spreePost, { today: TODAY }))!;
  expect(post).toMatchObject({
    author: "Freya Lindqvist",
    joiners: 4,
    next: 5,
    status: "open",
    joined: false,
    prompt: "Join Freya Lindqvist's kudos for Priya Raman? Uses 1 kudos today + 1 of your 5 spree joins this month · 4/5 joined",
  });
  expect(post.text).toContain("@Priya");

  const res = await demo.mutation(api.demo.simulateSpreeJoin, { attemptId: post.attemptId });
  await settle();
  expect(res.text).toBe("You joined Freya Lindqvist's kudos for Priya Raman · 5 joined: it's a spree of 5!");
  expect(res.thread).toBe("🎉 Freya Lindqvist's kudos for Priya Raman became a spree of 5! Next: 10 within 24 hours.");
  // Priya's pooled kudos arrive in one DM, rolled at Uncommon or rarer; Alex's gain DM says what the tier paid.
  const priya = res.messages.find((m) => m.to === "Priya Raman");
  expect(priya).toMatchObject({ category: "receiver_success" });
  expect(priya?.rarity).not.toBe("common");
  expect(res.messages.find((m) => m.toMe)?.text).toContain("A spree you joined reached 5");
  expect((await all(t, "kudos")).filter((k) => k.source === "spree")).toHaveLength(5);
  expect(await demo.query(api.demo.spreePost, { today: TODAY })).toMatchObject({ joiners: 5, next: 10, tier: 1, joined: true, prompt: null });
});

test("Not now and a second visit: the next visitor finds a fresh spree at 4 of 5, and nothing is farmed", async () => {
  const demo = await enterDemo();
  await demo.mutation(api.demo.openSpree, {});
  const first = (await demo.query(api.demo.spreePost, { today: TODAY }))!;
  // Opening again while it's still waiting for the viewer changes nothing.
  await demo.mutation(api.demo.openSpree, {});
  expect((await demo.query(api.demo.spreePost, { today: TODAY }))?.attemptId).toBe(first.attemptId);

  const xpBefore = (await demo.query(api.game.mine, {})).player?.xp;
  await demo.mutation(api.demo.simulateSpreeJoin, { attemptId: first.attemptId });
  await settle();
  await demo.mutation(api.demo.openSpree, {});
  const next = (await demo.query(api.demo.spreePost, { today: TODAY }))!;
  expect(next.attemptId).not.toBe(first.attemptId);
  expect(next).toMatchObject({ joiners: 4, next: 5, joined: false });
  // Starting over took back what the last spree paid, and its kudos.
  expect((await demo.query(api.game.mine, {})).player?.xp).toBe(xpBefore);
  expect((await all(t, "kudos")).filter((k) => k.source === "spree")).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("sprees").collect())).toHaveLength(1);
});

test("resetting the demo wipes its sprees", async () => {
  const demo = await enterDemo();
  await demo.mutation(api.demo.openSpree, {});
  await demo.mutation(api.demo.resetDemo, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  expect(await t.run((ctx) => ctx.db.query("sprees").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("spreeJoins").collect())).toEqual([]);
});
