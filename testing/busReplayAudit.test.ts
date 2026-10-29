import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { analyticsIdOf } from "../convex/analytics/person";
import type { HugGivenEvent, LevelReachedEvent, ThoughtfulPacksGrantedEvent, UnlockOpenedEvent } from "../convex/bus/events";
import { kudosGivenEventWithAward } from "./busEvents";
import { FakeSlack } from "./fakeSlack";
import { flagsLoaded, flagsOnForEveryone, journeyShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "./flags";
import { pendingJobs, testBackend, type Backend } from "./slackBackend";

const now = new Date("2026-10-13T10:00:00Z");
let backend: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
});

afterEach(async () => {
  if (backend !== undefined) {
    await backend.run(async (ctx) => {
      for (const job of await ctx.db.system.query("_scheduled_functions").collect()) {
        if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
      }
    });
  }
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("research: a repeated analytics fact creates fresh product-event UUIDs", async () => {
  const { t, giver, message } = await fixture();
  const event: HugGivenEvent = { type: "hugGiven", workspace: "T1", giver, message, onKudos: false, day: "2026-10-13", at: now.getTime() };
  await t.mutation(internal.analytics.subscribers.recordHugGiven, { event });
  await t.mutation(internal.analytics.subscribers.recordHugGiven, { event });
  const rows = await t.run(async (ctx) => (await ctx.db.query("analyticsOutbox").collect()).filter(({ event }) => event === "hug given"));
  expect(rows).toHaveLength(2);
  expect(rows[0]!.uuid).not.toBe(rows[1]!.uuid);
});

test("research: repeating quest judgment duplicates its marker even with quests off", async () => {
  const { t, giver, recipient } = await fixture();
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient));
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
  expect(await t.run((ctx) => ctx.db.query("questsJudged").collect())).toHaveLength(2);
  expect(await t.run((ctx) => ctx.db.query("rewardRecords").collect())).toHaveLength(0);
});

test("research: the legacy first-hug welcome schedules the same reply twice", async () => {
  const { t, giver, recipient, message } = await fixture("onboarding", "hidden-items");
  const event: HugGivenEvent = { type: "hugGiven", workspace: "T1", giver, message, first: true, onKudos: false, day: "2026-10-13", at: now.getTime() };
  await t.run((ctx) => ctx.db.insert("hugs", { ...message, giver, author: recipient, onKudos: false, emoji: "taco", day: event.day, at: event.at }));
  await t.mutation(internal.welcome.welcome.welcomeOnHug, { event });
  await t.mutation(internal.welcome.welcome.welcomeOnHug, { event });
  expect(await pendingJobs(t, "slack/firstHugReply:deliverFirstHugReply")).toBe(2);
});

test("research: the coins-opening subscriber schedules duplicate DMs", async () => {
  const { t, giver } = await fixture("xp-levels", "unlocks", "coins");
  const event: UnlockOpenedEvent = { type: "unlockOpened", workspace: "T1", member: giver, feature: "coins", at: now.getTime() };
  await t.mutation(internal.feedback.coins.tellCoinsOpened, { event });
  await t.mutation(internal.feedback.coins.tellCoinsOpened, { event });
  expect(await pendingJobs(t, "slack/directMessages:deliverDirectMessage")).toBe(2);
});

test("research: replaying an absorbed item grant falls through to a second reply", async () => {
  const { t, giver, recipient, message } = await fixture("album", "album-slack");
  await t.run(async (ctx) => {
    const reply = await ctx.db.insert("privateReplies", { ...message, to: "U_GIVER", given: [{ text: "Kudos counted." }], lines: [], gains: { xp: 10 }, held: true });
    await ctx.db.insert("oneReplies", { reply, left: "2 left", awaitsItems: true });
  });
  const event: ThoughtfulPacksGrantedEvent = { type: "thoughtfulPacksGranted", workspace: "T1", giver, message, outcomes: [{ recipient, outcome: "new" }], at: now.getTime() };
  await t.mutation(internal.feedback.albumReplies.replyAfterTheGrant, { event });
  expect(await pendingJobs(t, "slack/delivery:deliverPrivateReply")).toBe(1);
  expect(await pendingJobs(t, "slack/albumReplies:deliverAlbumReply")).toBe(0);
  await t.mutation(internal.feedback.albumReplies.replyAfterTheGrant, { event });
  expect(await pendingJobs(t, "slack/albumReplies:deliverAlbumReply")).toBe(1);
});

test("research: replaying an older level overwrites the newer public section", async () => {
  const { t, giver, message } = await fixture("xp-levels");
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", announcementChannel: "C_ANNOUNCE" }));
  const event: LevelReachedEvent = { type: "levelReached", workspace: "T1", member: giver, message, level: 2, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 80, at: now.getTime() };
  await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event });
  await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: { ...event, level: 3 } });
  await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event });
  const rows = await t.run((ctx) => ctx.db.query("publicReplies").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]!.version).toBe(3);
  expect(rows[0]!.sections[0]!.line.at(-1)).toEqual({ text: " reached level 2." });
});

test("research: replaying a quests opening in a later week creates another draw", async () => {
  const { t, giver } = await fixture("xp-levels", "unlocks", "quests");
  const event: UnlockOpenedEvent = { type: "unlockOpened", workspace: "T1", member: giver, feature: "quests", at: now.getTime() };
  await t.mutation(internal.quests.weekly.drawWeeklyQuests, { event });
  vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
  await t.mutation(internal.quests.weekly.drawWeeklyQuests, { event });
  const draws = await t.run((ctx) => ctx.db.query("questDraws").collect());
  expect(draws.map(({ week }) => week).sort()).toEqual(["2026-10-12", "2026-10-19"]);
});

async function fixture(...flags: string[]) {
  flagsOnForEveryone(new FakeSlack().fetch, ...flags);
  const t = backend = await flagsLoaded(testBackend());
  if (flags.includes("unlocks")) await unlocksShippedBeforeAnyoneJoined(t);
  if (flags.includes("quests")) await journeyShippedBeforeAnyoneJoined(t);
  const { giver, recipient } = await t.run(async (ctx) => ({
    giver: await ctx.db.insert("members", { workspace: "T1", user: "U_GIVER", kind: "member", timeZone: "UTC" }),
    recipient: await ctx.db.insert("members", { workspace: "T1", user: "U_RECIPIENT", kind: "member", timeZone: "UTC" }),
  }));
  await t.run(async (ctx) => {
    await analyticsIdOf(ctx, giver);
    await analyticsIdOf(ctx, recipient);
  });
  return { t, giver, recipient, message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" } };
}
