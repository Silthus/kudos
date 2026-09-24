import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { all, DEMO_TIMEOUT, setupConvex } from "./helpers";

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

test("the playground shows the bot's reaction and guidance for every attempt, like Slack", async () => {
  const demo = await enterDemo();
  const say = (text: string) => demo.mutation(api.demo.simulateMessage, { text, channelName: "general" });

  expect((await say("<@UDEMOPRIYA> :taco: thanks for the review")).attempt).toEqual({
    outcome: "given",
    reaction: "taco",
    guidance: null,
    messageTs: expect.any(String),
  });

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

test("a failed playground message can be fixed by editing it, like in Slack", async () => {
  const demo = await enterDemo();
  const say = (text: string) => demo.mutation(api.demo.simulateMessage, { text, channelName: "general" });
  const edit = (messageTs: string, previousText: string, text: string) =>
    demo.mutation(api.demo.simulateEdit, { messageTs, previousText, text, channelName: "general" });

  await say("<@UDEMOPRIYA> :taco::taco::taco: thanks"); // 2 of 5 left
  const over = "<@UDEMOSAMIR> <@UDEMOAIKO> :taco::taco: heroes of the week";
  const failed = (await say(over)).attempt!;
  expect(failed).toMatchObject({ outcome: "limit", reaction: "hourglass_flowing_sand", messageTs: expect.any(String) });
  expect(failed.guidance).toContain("To fix it, edit your message: use 1 🌮 so each of them gets 1 (2 in total)");

  const fixed = await edit(failed.messageTs, over, "<@UDEMOSAMIR> <@UDEMOAIKO> :taco: heroes of the week");
  expect(fixed.status).toBe("given");
  expect(fixed.attempt).toEqual({ outcome: "given", reaction: "taco", guidance: null, messageTs: failed.messageTs });
  // (Alex also grows a plant for Samir in the demo (#100): a gain DM may ride along.)
  expect(fixed.messages.filter((m) => m.category !== "gains").map((m) => m.to).sort()).toEqual(["Aiko Tanaka", "Alex Rivera", "Samir Haddad"]);
  const attempts = await t.run((ctx) => ctx.db.query("kudosAttempts").collect());
  expect(attempts.map((a) => a.outcome)).toEqual(["given", "given"]);

  const again = await edit(failed.messageTs, "<@UDEMOSAMIR> <@UDEMOAIKO> :taco: heroes of the week", "<@UDEMOSAMIR> :taco: heroes");
  expect(again).toEqual({
    status: "already_given",
    messages: [],
    attempt: { outcome: "given", reaction: "taco", guidance: "Your edit didn't change anything, because the kudos in this message were already sent.", messageTs: failed.messageTs },
  });

  // Only the demo's own messages: anything else is left alone.
  expect((await edit("1.1", ":taco:", "<@UDEMOPRIYA> :taco:")).attempt).toBeNull();
});

test("resetting the demo wipes its kudos attempts", async () => {
  const demo = await enterDemo();
  await demo.mutation(api.demo.simulateMessage, { text: ":taco: nobody", channelName: "general" });
  await demo.mutation(api.demo.resetDemo, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  expect(await t.run((ctx) => ctx.db.query("kudosAttempts").collect())).toEqual([]);
  expect((await all(t, "kudos")).every((k) => k.source === "seed")).toBe(true);
});
