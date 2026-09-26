import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { xpForLevel } from "../convex/lib/xp";
import { DEMO_TIMEOUT, setupConvex } from "./helpers";

/** The playground previews the gain DMs (#99) the way Slack would send them. */

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

/** Puts a demo member 1 XP short of their next level. */
const justShortOfNextLevel = (slackUserId: string) =>
  t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((m) => m.slackUserId === slackUserId)!;
    const player = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", member._id as Id<"members">)).unique();
    await ctx.db.patch(player!._id, { xp: xp(player!.level + 1) - 1 });
    return player!.level + 1;
  });
const xp = (level: number) => xpForLevel(level);

test("a level-up shows as your own DM; a receiver's rides in their kudos DM", async () => {
  const demo = await enterDemo();
  const mine = await justShortOfNextLevel("UDEMOYOU");
  const priyas = await justShortOfNextLevel("UDEMOPRIYA");
  const res = await demo.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :seedling: thanks for pairing on the onboarding flow", channelName: "general" });

  const toMe = res.messages.filter((m) => m.toMe && m.category !== "giver_success");
  expect(toMe).toHaveLength(1);
  expect(toMe[0]).toMatchObject({ category: "gains", gainLabel: "Level up" });
  expect(toMe[0].text).toMatch(new RegExp(`^Level ${mine}: `));

  const toPriya = res.messages.find((m) => !m.toMe)!;
  expect(toPriya).toMatchObject({ category: "receiver_success", gainLabel: "Level up" });
  expect(toPriya.gains).toEqual([expect.stringMatching(new RegExp(`^Level ${priyas}: `))]);
});
