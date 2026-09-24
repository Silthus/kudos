import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { all, setupConvex } from "./helpers";

let t: ReturnType<typeof setupConvex>;

// Entering the demo seeds its history and rebuilds its rollups: slow under convex-test.
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  t = setupConvex();
});
afterEach(() => vi.useRealTimers());

async function enterDemo() {
  const userId = await t.mutation(internal.demo.ensureDemoUser, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  return t.withIdentity({ subject: `${userId}|s` });
}

test("the playground shows the bot's reaction and guidance for every attempt, like Slack", async () => {
  const demo = await enterDemo();
  const say = (text: string) => demo.mutation(api.demo.simulateMessage, { text, channelName: "general" });

  expect((await say("<@UDEMOPRIYA> :taco: thanks for the review")).attempt).toEqual({ outcome: "given", reaction: "taco", guidance: null });

  const limit = await say("<@UDEMOPRIYA> <@UDEMOJONAS> :taco::taco: great release"); // 4 asked, 4 left → given
  expect(limit.attempt?.outcome).toBe("given");
  const over = await say("<@UDEMOSAMIR> <@UDEMOAIKO> :taco: heroes of the week"); // 2 asked, 0 left
  expect(over.status).toBe("limit");
  expect(over.attempt).toMatchObject({ outcome: "limit", reaction: "hourglass_flowing_sand" });
  expect(over.attempt?.guidance).toContain("You've given all 5 🌮 you have for today");

  await demo.mutation(api.demo.refillAllowance, {});
  const times = await say("<@UDEMOSAMIR> <@UDEMOAIKO> :taco::taco::taco: heroes of the week");
  expect(times.attempt?.guidance).toContain("2 people × 3 🌮 = 6 🌮, but you have 5 left today.");

  const nobody = await say(":taco: great job everyone");
  expect(nobody.attempt).toMatchObject({ outcome: "invalid", reaction: "x" });
  expect(nobody.attempt?.guidance).toContain("“@alex 🌮 thanks for the review!”");
  expect((await say("<@UDEMOYOU> :taco: I deserve this")).attempt?.outcome).toBe("invalid");

  expect(await say("lunch anyone?")).toEqual({ status: "no_kudos", messages: [], attempt: null });

  // Each simulated message is its own attempt, even within the same millisecond.
  const attempts = await t.run((ctx) => ctx.db.query("kudosAttempts").collect());
  expect(attempts.map((a) => a.outcome)).toEqual(["given", "given", "limit", "limit", "invalid", "invalid"]);
  expect(new Set(attempts.map((a) => a.messageTs)).size).toBe(6);
});

test("resetting the demo wipes its kudos attempts", async () => {
  const demo = await enterDemo();
  await demo.mutation(api.demo.simulateMessage, { text: ":taco: nobody", channelName: "general" });
  await demo.mutation(api.demo.resetDemo, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  expect(await t.run((ctx) => ctx.db.query("kudosAttempts").collect())).toEqual([]);
  expect((await all(t, "kudos")).every((k) => k.source === "seed")).toBe(true);
});
