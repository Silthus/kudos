import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { startOfDayUtc } from "../convex/lib/time";
import { seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// NOW is Wed 2026-09-23 in Berlin: "week" is Mon 21 – Wed 23.
let t: ReturnType<typeof setupConvex>;
let team: Team;

async function setup(receivedVisibility: Doc<"workspaces">["receivedVisibility"] = "everyone") {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility });
}
afterEach(() => vi.useRealTimers());

const day = (memberId: Id<"members">, dayKey: string, given: number, received = 0, maxed = false) =>
  t.run(async (ctx) => {
    await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId, dayKey, given, received, maxed });
  });

const kudos = (giverId: Id<"members">, receiverId: Id<"members">, dayKey: string, channelId: string) =>
  t.run(async (ctx) => {
    await ctx.db.insert("kudos", {
      workspaceId: team.workspaceId,
      batchId: `${giverId}-${dayKey}-${channelId}-${Math.random()}`,
      giverId,
      receiverId,
      amount: 1,
      dayKey,
      source: "message",
      channelId,
      text: "thanks for the help with the release",
      at: startOfDayUtc(dayKey, "Europe/Berlin") + 12 * 3_600_000,
    });
  });

const discovery = (memberId: Id<"members">, templateKey: string, dayKey: string) =>
  t.run(async (ctx) => {
    const at = startOfDayUtc(dayKey, "Europe/Berlin") + 9 * 3_600_000;
    await ctx.db.insert("discoveries", {
      workspaceId: team.workspaceId,
      memberId,
      templateKey,
      rarity: "common",
      category: "receiver_success",
      timesSeen: 1,
      firstSeenAt: at,
      lastSeenAt: at,
    });
  });

type Result = Awaited<ReturnType<typeof getTeammate>>;
const row = (r: Result, metric: string) => r.rows.find((x) => x.metric === metric)!;

const UNAVAILABLE = "That teammate isn't available to compare.";

async function getTeammate(memberId: string, period: "week" | "month" | "quarter" | "year" = "week", viewerId = team.ana) {
  const viewer = await signInAs(t, viewerId);
  return await viewer.query(api.compare.teammate.get, { period, today: TODAY, memberId });
}

describe("compare.teammate.get: eligibility", () => {
  test("signed out", async () => {
    await setup();
    await expect(t.query(api.compare.teammate.get, { period: "month", today: TODAY, memberId: team.ben })).rejects.toThrow(
      "Sign in with Slack to continue.",
    );
  });

  test("a teammate in the same workspace is available", async () => {
    await setup();
    const r = await getTeammate(team.ben);
    expect(r.mode).toBe("teammate");
    expect(r.teammate).toMatchObject({ _id: team.ben, name: "Ben" });
  });

  test("yourself, the bot and a deactivated member are not", async () => {
    await setup();
    await t.run((ctx) => ctx.db.patch(team.cleo, { deactivated: true }));
    for (const id of [team.ana, team.bot, team.cleo]) {
      await expect(getTeammate(id)).rejects.toThrow(UNAVAILABLE);
    }
  });

  test("a member of another workspace is not", async () => {
    await setup();
    const other = await seedTeam(t, {}, "T2");
    await expect(getTeammate(other.ben)).rejects.toThrow(UNAVAILABLE);
  });

  test("a removed member, a malformed id and an id from another table fail the same way", async () => {
    await setup();
    const gone: Id<"members"> = team.ben;
    await t.run((ctx) => ctx.db.delete(gone));
    await expect(getTeammate(gone)).rejects.toThrow(UNAVAILABLE);
    await expect(getTeammate("not-an-id")).rejects.toThrow(UNAVAILABLE);
    await expect(getTeammate(team.workspaceId)).rejects.toThrow(UNAVAILABLE);
  });
});

describe("compare.teammate.get: head-to-head", () => {
  test("you against the teammate over this week to date, day metrics side by side", async () => {
    await setup();
    await day(team.ana, "2026-09-18", 5); // Fri, last week: outside the period
    await day(team.ana, "2026-09-21", 3); // Mon
    await day(team.ana, "2026-09-22", 5, 2, true); // Tue
    await day(team.ben, "2026-09-21", 1, 4);
    await day(team.ben, "2026-09-23", 2, 1);
    await day(team.cleo, "2026-09-22", 5); // a third member never counts

    const r = await getTeammate(team.ben, "week");
    expect(r.range).toEqual({ start: "2026-09-21", end: "2026-09-23", days: 3 });
    expect(row(r, "given")).toMatchObject({ family: "giving", you: { value: 8, locked: null }, benchmark: { value: 3, locked: null }, delta: 5 });
    expect(row(r, "received")).toMatchObject({ family: "receiving", you: { value: 2 }, benchmark: { value: 5 }, delta: -3 });
    expect(row(r, "activeDays")).toMatchObject({ you: { value: 2 }, benchmark: { value: 2 }, delta: 0 });
    expect(row(r, "maxedDays")).toMatchObject({ you: { value: 1 }, benchmark: { value: 0 } });
    expect(row(r, "longestStreak")).toMatchObject({ you: { value: 2 }, benchmark: { value: 1 } });
  });

  test("reach and channels count each side's own giving in the period", async () => {
    await setup();
    await kudos(team.ana, team.ben, "2026-09-21", "C1");
    await kudos(team.ana, team.cleo, "2026-09-22", "C1");
    await kudos(team.ana, team.cleo, "2026-09-15", "C9"); // last week
    await kudos(team.ben, team.ana, "2026-09-21", "C1");
    await kudos(team.ben, team.ana, "2026-09-22", "C2");
    await kudos(team.ben, team.ana, "2026-09-23", "C3");
    await kudos(team.cleo, team.ben, "2026-09-23", "C7"); // received by Ben: not his reach

    const r = await getTeammate(team.ben, "week");
    expect(row(r, "reach")).toMatchObject({ you: { value: 2 }, benchmark: { value: 1 }, delta: 1 });
    expect(row(r, "channels")).toMatchObject({ you: { value: 1 }, benchmark: { value: 3 }, delta: -2 });
  });

  test("the teammate's kudos land in the workspace's local day", async () => {
    await setup();
    const give = (at: number, channelId: string) =>
      t.run(async (ctx) => {
        await ctx.db.insert("kudos", {
          workspaceId: team.workspaceId,
          batchId: `b-${channelId}`,
          giverId: team.ben,
          receiverId: team.cleo,
          amount: 1,
          dayKey: "unused",
          source: "message",
          channelId,
          text: "thanks",
          at,
        });
      });
    await give(Date.UTC(2026, 8, 20, 21, 30), "C-sunday"); // Sun 23:30 in Berlin: last week
    await give(Date.UTC(2026, 8, 20, 22, 30), "C-monday"); // Mon 00:30 in Berlin: this week

    const r = await getTeammate(team.ben, "week");
    expect(row(r, "channels")).toMatchObject({ benchmark: { value: 1 } });
  });

  test("new discoveries are the ones each side first saw in the period", async () => {
    await setup();
    await discovery(team.ana, "t1", "2026-09-22");
    await discovery(team.ben, "t1", "2026-09-10"); // before the week
    await discovery(team.ben, "t2", "2026-09-21");
    await discovery(team.ben, "t3", "2026-09-23");

    const r = await getTeammate(team.ben, "week");
    expect(row(r, "newDiscoveries")).toMatchObject({ family: "receiving", you: { value: 1 }, benchmark: { value: 2 } });
  });
});

describe("compare.teammate.get: the race", () => {
  test("both sides run cumulatively over the whole week, up to today", async () => {
    await setup();
    await day(team.ana, "2026-09-21", 3, 1);
    await day(team.ana, "2026-09-23", 1);
    await day(team.ben, "2026-09-22", 2, 2);

    const { race } = await getTeammate(team.ben, "week");
    expect(race.days).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
    expect(race.you.given).toEqual([3, 3, 4, null, null, null, null]);
    expect(race.benchmark.given).toEqual([0, 2, 2, null, null, null, null]);
    expect(race.you.received).toEqual([1, 1, 1, null, null, null, null]);
    expect(race.benchmark.received).toEqual([0, 2, 2, null, null, null, null]);
  });
});

describe("compare.teammate.get: privacy follows receivedVisibility", () => {
  async function withActivity(visibility: Doc<"workspaces">["receivedVisibility"]) {
    await setup(visibility);
    await day(team.ana, "2026-09-21", 2, 3);
    await day(team.ben, "2026-09-22", 4, 5);
    await discovery(team.ana, "t1", "2026-09-21");
    await discovery(team.ben, "t2", "2026-09-22");
    return await getTeammate(team.ben, "week");
  }

  test.each([
    ["hidden", "hidden"],
    ["self", "private"],
  ] as const)("%s: received-derived rows are locked on both sides and never sent", async (visibility, reason) => {
    const r = await withActivity(visibility);
    for (const metric of ["received", "newDiscoveries"]) {
      expect(row(r, metric)).toEqual({
        metric,
        family: "receiving",
        you: { value: null, locked: reason },
        benchmark: { value: null, locked: reason },
        delta: null,
      });
    }
    expect(r.race.you.received).toBeNull();
    expect(r.race.benchmark.received).toBeNull();
    // Giving is public in Slack channels, so it stays comparable.
    expect(row(r, "given")).toMatchObject({ you: { value: 2, locked: null }, benchmark: { value: 4, locked: null } });
  });

  test("everyone: received and new discoveries are compared", async () => {
    const r = await withActivity("everyone");
    expect(row(r, "received")).toMatchObject({ you: { value: 3, locked: null }, benchmark: { value: 5, locked: null }, delta: -2 });
    expect(row(r, "newDiscoveries")).toMatchObject({ you: { value: 1 }, benchmark: { value: 1 } });
  });
});

describe("compare.candidates.list", () => {
  test("signed out", async () => {
    await setup();
    await expect(t.query(api.compare.candidates.list, {})).rejects.toThrow("Sign in with Slack to continue.");
  });

  test("everyone you can compare with, by name: not you, the bot, deactivated members or other workspaces", async () => {
    await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(team.cleo, { deactivated: true });
      await ctx.db.patch(team.ben, { title: "Engineer", realName: "Ben Baker" });
      await ctx.db.insert("members", {
        workspaceId: team.workspaceId,
        slackUserId: "UAARON",
        name: "aaron",
        isAdmin: false,
        isBot: false,
        deactivated: false,
        totalGiven: 0,
        totalReceived: 0,
        totalMaxedDays: 0,
      });
    });
    await seedTeam(t, {}, "T2");

    const list = await (await signInAs(t, team.ana)).query(api.compare.candidates.list, {});
    expect(list.map((m) => m.name)).toEqual(["aaron", "Ben"]);
    expect(list[1]).toEqual({ _id: team.ben, name: "Ben", realName: "Ben Baker", title: "Engineer" });
  });
});

describe("Leaderboard entry point", () => {
  test("rows offer Compare only for teammates you can compare with: not yourself, not someone who left", async () => {
    await setup();
    await day(team.ana, "2026-09-21", 3);
    await day(team.ben, "2026-09-21", 2);
    await day(team.cleo, "2026-09-21", 1);
    await t.run((ctx) => ctx.db.patch(team.cleo, { deactivated: true })); // gave this week, then left

    const ana = await signInAs(t, team.ana);
    const { rows } = await ana.query(api.leaderboard.get, { period: "week", metric: "given", today: TODAY });
    expect(rows.map((r) => [r.member.name, r.comparable])).toEqual([
      ["Ana", false],
      ["Ben", true],
      ["Cleo", false],
    ]);
  });
});

describe("compare.teammate.get: bounded reads", () => {
  test("too many kudos to count the teammate's reach and channels: only their side goes blank", async () => {
    await setup();
    await kudos(team.ana, team.cleo, "2026-09-22", "C4");
    await t.run(async (ctx) => {
      const base = startOfDayUtc("2026-09-21", "Europe/Berlin");
      for (let i = 0; i < 2_001; i++) {
        await ctx.db.insert("kudos", {
          workspaceId: team.workspaceId,
          batchId: `b${i}`,
          giverId: team.ben,
          receiverId: i % 2 ? team.ana : team.cleo,
          amount: 1,
          dayKey: "2026-09-21",
          source: "playground",
          channelId: "C1",
          text: "thanks",
          at: base + i * 1_000,
        });
      }
    });
    const r = await getTeammate(team.ben, "week");
    expect(r.truncated).toBe(true);
    // Both sides cover the same days, so a capped read only makes the capped side uncountable:
    // somebody else's heavy giving never blanks your own numbers.
    for (const metric of ["reach", "channels"]) {
      expect(row(r, metric)).toMatchObject({ you: { value: 1, locked: null }, benchmark: { value: null, locked: null }, delta: null });
    }
  });
});
