import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { claimAtTree, NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/**
 * Bonus days on the admin schedule, the announcement channel and the in-app banner (#97, #55 §G9,
 * G13, G14). Slack is a stubbed `fetch`.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;
type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];

function stubSlackApi(responses: Record<string, unknown> = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("https://slack.com/api/")[1] ?? String(url);
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      return Response.json(responses[method] ?? { ok: true, channel: params.channel, ts: "1.1" });
    }),
  );
}
const drain = () => t.finishAllScheduledFunctions(vi.runAllTimers);
const posts = (channel: string) => calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === channel).map((c) => c.params.text);

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const as = (memberId: Id<"members">) => signInAs(t, memberId);
const FRIDAY = "2026-09-25";
const FRIDAY_TEXT = "Bonus day on Friday, 25 September: all day, every thoughtful kudos earns double XP and Hog coins.";

describe("the admin schedule", () => {
  test("an admin schedules a bonus day in advance; everyone sees it coming on the banner, then on the day", async () => {
    await (await as(team.ana)).mutation(api.boosts.schedule, { day: FRIDAY });
    const ben = await as(team.ben);
    expect(await ben.query(api.boosts.banner, { today: TODAY })).toEqual({ current: null, upcoming: [{ dayKey: FRIDAY, kind: "double", text: FRIDAY_TEXT }] });
    expect(await ben.query(api.boosts.banner, { today: FRIDAY })).toEqual({
      current: { kind: "double", text: "Bonus day today: until midnight, every thoughtful kudos earns double XP and Hog coins." },
      upcoming: [],
    });
    expect(await ben.query(api.boosts.banner, { today: "2026-09-26" })).toEqual({ current: null, upcoming: [] });
  });

  test("needs the game on: there are no XP or coins to double without it (review #3)", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await expect((await as(team.ana)).mutation(api.boosts.schedule, { day: FRIDAY })).rejects.toThrow(/game/);
  });

  test("an admin can't call off another workspace's bonus day", async () => {
    const other = await seedTeam(t, { gameEnabled: true }, "T2");
    const boostId = await (await as(team.ana)).mutation(api.boosts.schedule, { day: FRIDAY });
    await expect((await as(other.ana)).mutation(api.boosts.cancel, { boostId })).rejects.toThrow(/doesn't exist/);
  });

  test("the shared demo's announcement channel can't be changed by visitors (review #4)", async () => {
    const demo = await seedTeam(t, { gameEnabled: true, isDemo: true }, "TDEMO");
    await expect((await as(demo.ana)).mutation(api.boosts.setChannel, { channel: { id: "CX", name: "rude-name" } })).rejects.toThrow(/demo/);
  });

  test("a scheduled day moves with the workspace's timezone and can't be called off once it's today there (review #6)", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.schedule, { day: "2026-09-24" }); // midnight in Berlin
    const settings = (await ana.query(api.admin.overview, {})).settings;
    await ana.mutation(api.admin.updateSettings, { ...settings, timezone: "Asia/Tokyo" });
    vi.setSystemTime(new Date("2026-09-23T16:00:00Z")); // 01:00 on the 24th in Tokyo, still the 23rd in Berlin
    const [boost] = (await ana.query(api.boosts.admin, { today: "2026-09-24" })).boosts;
    await expect(ana.mutation(api.boosts.cancel, { boostId: boost._id })).rejects.toThrow(/started/);
    await t.mutation(internal.kudos.ingestMessage, {
      workspaceId: team.workspaceId,
      botUserId: "UBOT",
      giverSlackId: "UANA",
      text: "<@UBEN> :taco: thanks for the thorough review",
      channelId: "CGENERAL",
      messageTs: "1.0001",
    });
    await claimAtTree(t, team.ana);
    const player = await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique());
    expect(player).toMatchObject({ xp: 40, coins: 2 });
  });

  test("always in advance, within 90 days, one boost a day, and only by admins", async () => {
    const ana = await as(team.ana);
    await expect(ana.mutation(api.boosts.schedule, { day: TODAY })).rejects.toThrow(/in advance/);
    await expect(ana.mutation(api.boosts.schedule, { day: "2027-01-01" })).rejects.toThrow(/90 days/);
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await expect(ana.mutation(api.boosts.schedule, { day: FRIDAY })).rejects.toThrow(/already/);
    await expect((await as(team.ben)).mutation(api.boosts.schedule, { day: "2026-09-28" })).rejects.toThrow();
  });

  test("an admin can call off a bonus day that hasn't started, and the channel hears it", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await drain();
    const [boost] = (await ana.query(api.boosts.admin, { today: TODAY })).boosts;
    await ana.mutation(api.boosts.cancel, { boostId: boost._id });
    await drain();
    expect(posts("CANN")).toEqual([FRIDAY_TEXT, "The bonus day on Friday, 25 September is called off."]);
    expect((await ana.query(api.boosts.admin, { today: TODAY })).boosts).toEqual([]);
    expect(await (await as(team.ben)).query(api.boosts.banner, { today: TODAY })).toEqual({ current: null, upcoming: [] });
  });

  test("a boost that has started can't be called off", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.schedule, { day: "2026-09-24" });
    vi.setSystemTime(new Date("2026-09-24T08:00:00Z"));
    const [boost] = (await ana.query(api.boosts.admin, { today: "2026-09-24" })).boosts;
    await expect(ana.mutation(api.boosts.cancel, { boostId: boost._id })).rejects.toThrow(/started/);
  });
});

describe("the announcement channel", () => {
  test("each boost is announced in the admin's chosen channel", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await drain();
    expect(posts("CANN")).toEqual([FRIDAY_TEXT]);
    expect((await ana.query(api.boosts.admin, { today: TODAY })).boosts).toMatchObject([
      { dayKey: FRIDAY, kind: "double", source: "schedule", by: "Ana", text: FRIDAY_TEXT, announcement: { status: "sent", channel: "announcements" } },
    ]);
  });

  test("a company-wide booster is announced with who activated it", async () => {
    await (await as(team.ana)).mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ben, since: NOW.getTime(), xp: 350, level: 5, coins: 20 }));
    await (await as(team.ben)).mutation(api.store.buyItem, { item: "boosterDouble", expectedPrice: 40 });
    await drain();
    expect(posts("CANN")).toEqual([
      "<@UBEN> activated a Kudos booster: Double. Today is a bonus day: until midnight, every thoughtful kudos earns double XP and Hog coins.",
    ]);
    expect(await (await as(team.cleo)).query(api.boosts.banner, { today: TODAY })).toMatchObject({
      current: { kind: "double", text: "Ben activated a Kudos booster: Double. Today is a bonus day: until midnight, every thoughtful kudos earns double XP and Hog coins." },
    });
  });

  test("when the Kudos app isn't in the channel, the boost still runs and the admin sees why the post failed", async () => {
    stubSlackApi({ "chat.postMessage": { ok: false, error: "not_in_channel" } });
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await drain();
    expect((await ana.query(api.boosts.admin, { today: TODAY })).boosts).toMatchObject([{ dayKey: FRIDAY, announcement: { status: "failed", error: "not_in_channel" } }]);
    expect((await (await as(team.ben)).query(api.boosts.banner, { today: TODAY }))?.upcoming).toHaveLength(1);
  });

  test("without a channel only the banner announces it", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await drain();
    expect(calls.filter((c) => c.method === "chat.postMessage")).toEqual([]);
    expect((await ana.query(api.boosts.admin, { today: TODAY }))).toMatchObject({ channel: null, boosts: [{ announcement: { status: "skipped" } }] });
  });

  test("the admin picks from the channels the Kudos app is in: the only ones it can post in (review #14)", async () => {
    stubSlackApi({
      "users.conversations": {
        ok: true,
        channels: [
          { id: "CRANDOM", name: "random" },
          { id: "CANN", name: "announcements" },
        ],
        response_metadata: { next_cursor: "" },
      },
    });
    expect(await (await as(team.ana)).action(api.boosts.channels, {})).toEqual([
      { id: "CANN", name: "announcements" },
      { id: "CRANDOM", name: "random" },
    ]);
    expect(calls.find((c) => c.method === "users.conversations")?.params).toMatchObject({ types: "public_channel,private_channel", exclude_archived: "true" });
    await expect((await as(team.ben)).action(api.boosts.channels, {})).rejects.toThrow();
  });

  test("the post goes to the channel the boost was announced for, even if the setting changes before it's sent (review #5)", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await ana.mutation(api.boosts.setChannel, { channel: { id: "COTHER", name: "other" } });
    await drain();
    expect(posts("CANN")).toEqual([FRIDAY_TEXT]);
    expect(posts("COTHER")).toEqual([]);
  });

  test("an announcement never waits forever: without Slack to post to, it's recorded as skipped (review #5)", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await t.run(async (ctx) => {
      const install = await ctx.db.query("slackInstallations").first();
      await ctx.db.delete(install!._id);
    });
    await drain();
    expect((await ana.query(api.boosts.admin, { today: TODAY })).boosts).toMatchObject([{ announcement: { status: "skipped" } }]);
  });

  test("a failed post can be sent again once the app is invited (review #5)", async () => {
    stubSlackApi({ "chat.postMessage": { ok: false, error: "not_in_channel" } });
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await drain();
    stubSlackApi();
    const [boost] = (await ana.query(api.boosts.admin, { today: TODAY })).boosts;
    await expect((await as(team.ben)).mutation(api.boosts.repost, { boostId: boost._id })).rejects.toThrow();
    await ana.mutation(api.boosts.repost, { boostId: boost._id });
    await drain();
    expect(posts("CANN")).toEqual([FRIDAY_TEXT]);
    expect((await ana.query(api.boosts.admin, { today: TODAY })).boosts).toMatchObject([{ announcement: { status: "sent", channel: "announcements" } }]);
  });

  test("a start post that went out after its bonus day was called off is followed by the call-off (review #13)", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } });
    const boostId = await ana.mutation(api.boosts.schedule, { day: FRIDAY });
    await t.run((ctx) => ctx.db.delete(boostId)); // called off while the start post was on its way
    await t.mutation(internal.boosts.announced, { boostId, workspaceId: team.workspaceId, dayKey: FRIDAY, channelId: "CANN", outcome: "sent" });
    await drain();
    expect(posts("CANN")).toContain("The bonus day on Friday, 25 September is called off.");
  });

  test("the admin's preview is the text that was announced, not re-dated to today (review #12)", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.boosts.schedule, { day: "2026-09-24" });
    expect((await ana.query(api.boosts.admin, { today: "2026-09-24" })).boosts[0].text).toBe(
      "Bonus day tomorrow, Thursday, 24 September: all day, every thoughtful kudos earns double XP and Hog coins.",
    );
  });

  test("only admins pick the channel", async () => {
    await expect((await as(team.ben)).mutation(api.boosts.setChannel, { channel: { id: "CANN", name: "announcements" } })).rejects.toThrow();
  });
});

describe("the banner", () => {
  test("is empty, not an error, for someone signed out mid-session (review #8)", async () => {
    await (await as(team.ana)).mutation(api.boosts.schedule, { day: FRIDAY });
    expect(await t.query(api.boosts.banner, { today: TODAY })).toBeNull();
  });

  test("is gone while the game is off or hidden", async () => {
    await (await as(team.ana)).mutation(api.boosts.schedule, { day: FRIDAY });
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    expect(await (await as(team.ben)).query(api.boosts.banner, { today: TODAY })).toBeNull();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(await (await as(team.cleo)).query(api.boosts.banner, { today: TODAY })).toBeNull();
  });
});
