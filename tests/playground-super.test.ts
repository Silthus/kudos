import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { DEMO_TIMEOUT, setupConvex } from "./helpers";

/** The playground runs Super kudos and emoji variants (#98) through the same path as Slack. */

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

/** Gives the demo visitor the Herald skills and the golden emoji, as if taken and bought. */
const heraldWithGolden = () =>
  t.run(async (ctx) => {
    const you = (await ctx.db.query("members").collect()).find((m) => m.slackUserId === "UDEMOYOU")!;
    const player = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", you._id)).unique())!;
    await ctx.db.patch(player._id, { skills: { ...(player.skills ?? {}), emoji_variants: 1, super_kudos: 1, encore: 1, spotlight: 1 } });
    await ctx.db.insert("itemPurchases", { workspaceId: you.workspaceId, memberId: you._id, item: "emojiGolden", price: 60, month: "2026-09", at: Date.now() });
  });

const WHY = "for pairing with me all afternoon on the onboarding flow and catching the timezone bug before release";

test("a Super kudos: the receiver's celebration, the giver's note and the Super kudos reaction", async () => {
  const demo = await enterDemo();
  await heraldWithGolden();
  const res = await demo.mutation(api.demo.simulateMessage, { text: `<@UDEMOPRIYA> :seedling-super: ${WHY}`, channelName: "general" });
  expect(res.status).toBe("given");
  expect(res.attempt).toMatchObject({ outcome: "given", reaction: "seedling-super" });
  const toPriya = res.messages.find((m) => !m.toMe)!;
  expect(toPriya.superKudos).toMatchObject({ kind: "celebration" });
  expect(toPriya.superKudos!.text).toContain("A Super kudos from Alex");
  const mine = res.messages.find((m) => m.toMe && m.category === "giver_success")!;
  expect(mine.superKudos).toMatchObject({ kind: "sent" });
  // The demo has no Slack channel to post to: it says what Spotlight does, never that it posted (review #12).
  expect(mine.superKudos!.text).toContain("In a real workspace, Spotlight features it in the announcement channel.");
});

test("a demo reset wipes the Super kudos and takes off what everyone wore", async () => {
  const demo = await enterDemo();
  await heraldWithGolden();
  await demo.mutation(api.demo.simulateMessage, { text: `<@UDEMOPRIYA> :seedling-super: ${WHY}`, channelName: "general" });
  await t.run(async (ctx) => {
    const you = (await ctx.db.query("members").collect()).find((m) => m.slackUserId === "UDEMOYOU")!;
    await ctx.db.patch(you._id, { look: { frame: "frameSunrise" } });
  });
  await demo.mutation(api.demo.resetDemo, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
  expect(await t.run((ctx) => ctx.db.query("superKudos").collect())).toEqual([]);
  expect((await t.run((ctx) => ctx.db.query("members").collect())).filter((m) => m.look !== undefined)).toEqual([]);
});

test("an emoji variant gives for its owner in the playground", async () => {
  const demo = await enterDemo();
  await heraldWithGolden();
  const res = await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :seedling-golden: thanks for the review", channelName: "general" });
  expect(res.status).toBe("given");
  const rows = await t.run((ctx) => ctx.db.query("kudos").withIndex("by_workspace_at").order("desc").take(1));
  expect(rows[0]).toMatchObject({ variant: "golden", source: "playground" });
  expect(await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :seedling-rainbow: thanks", channelName: "general" })).toMatchObject({ status: "no_kudos" });
});
