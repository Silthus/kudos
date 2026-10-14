import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { KudosGivenEvent } from "../bus/events";
import { record, type DirectoryEntry } from "../workspace/directory";
import { testBackend, type Backend } from "../../testing/slackBackend";
import type { BoardView } from "./board";
import type { Period } from "./periods";
import { rankedBoardOf } from "./totals";
import { setLeaderboardVisibility } from "./visibility";

const tuesday = new Date("2026-10-13T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the kudosGiven subscriber and this week's Everyone board", () => {
  test("G13: the board counts kudos given, never kudos received", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"]);
    await countKudosGiven(t, kudosGiven("U1", { "U2": 3, "U3": 3 }, { message: "1" }));
    await countKudosGiven(t, kudosGiven("U2", { "U1": 1 }, { message: "2" }));

    expect(shown(await everyoneBoard(t, "U3"))).toEqual(["1 Ann 6", "2 Bob 1"]);
    expect((await rankedBoard(t, "U3")).rows.map(({ rank, name, kudos }) => `${rank} ${name} ${kudos}`)).toEqual(["1 Ann 6", "2 Bob 1"]);
  });

  test("G44: delivering the same kudosGiven twice counts its awards once", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"]);
    const event = kudosGiven("U1", { "U2": 2 });

    await countKudosGiven(t, event);
    await countKudosGiven(t, event);

    expect(shown(await everyoneBoard(t, "U1"))).toEqual(["1 Ann (you) 2"]);
  });

  test("G16: givers with equal totals list by the name the directory knows", async () => {
    const t = testBackend();
    await members(t, ["U1", "Zoe"], ["U2", "Al"], ["U3", "Cy"]);
    await countKudosGiven(t, kudosGiven("U1", { "U3": 2 }, { message: "1" }));
    await countKudosGiven(t, kudosGiven("U2", { "U3": 2 }, { message: "2" }));
    await countKudosGiven(t, kudosGiven("U3", { "U1": 1 }, { message: "3" }));

    expect(shown(await everyoneBoard(t, "U3"))).toEqual(["1 Al 2", "1 Zoe 2", "3 Cy (you) 1"]);
  });

  test("G15: a giver who is no longer a member leaves the board", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"]);
    await countKudosGiven(t, kudosGiven("U1", { "U2": 1 }, { message: "1" }));
    await countKudosGiven(t, kudosGiven("U2", { "U1": 2 }, { message: "2" }));

    await recordInDirectory(t, "U2", { kind: "not-a-member" }, Date.now());

    expect(shown(await everyoneBoard(t, "U1"))).toEqual(["1 Ann (you) 1"]);
  });

  test("this week is the week of the viewer's allowance day, and an award counts in the week of its own", async () => {
    vi.setSystemTime(new Date("2026-10-11T23:30:00Z"));
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob", "Europe/Berlin"], ["U3", "Cy"]);
    await countKudosGiven(t, kudosGiven("U1", { "U3": 1 }, { message: "1", day: "2026-10-11" }));
    await countKudosGiven(t, kudosGiven("U2", { "U3": 1 }, { message: "2", day: "2026-10-12" }));

    expect(shown(await everyoneBoard(t, "U3"))).toEqual(["1 Ann 1"]);
    expect(shown(await everyoneBoard(t, "U2"))).toEqual(["1 Bob (you) 1"]);
  });

  test("a viewer the directory doesn't know isn't ranked", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"]);
    await countKudosGiven(t, kudosGiven("U1", { "U2": 1 }));

    const view = await everyoneBoard(t, "U9");

    expect(shown(view)).toEqual(["1 Ann 1"]);
    expect(view.viewerAbsent).toBe("not-ranked");
  });
});

describe("G23: the Everyone board of a period", () => {
  test.each([
    { period: "week" as const, rows: ["1 Cy 1"] },
    { period: "month" as const, rows: ["1 Ann 2", "2 Cy 1"] },
    { period: "all" as const, rows: ["1 Ann 2", "2 Bob 1", "2 Cy 1"] },
  ])("$period ranks the kudos given in it", async ({ period, rows }) => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"], ["U4", "Dee"]);
    await countKudosGiven(t, kudosGiven("U2", { "U4": 1 }, { message: "1", day: "2026-09-20" }));
    await countKudosGiven(t, kudosGiven("U1", { "U4": 2 }, { message: "2", day: "2026-10-01" }));
    await countKudosGiven(t, kudosGiven("U3", { "U4": 1 }, { message: "3", day: "2026-10-13" }));

    expect(shown(await everyoneBoard(t, "U4", period))).toEqual(rows);
  });
});

describe("G18: the improvement line", () => {
  describe("rankedBoardOf compares with the previous period up to the same day", () => {
    test.each([
      { rule: "on a Monday, last week counts only its Monday", now: "2026-10-12T10:00:00Z", period: "week" as const, given: { "2026-10-05": 1, "2026-10-06": 3, "2026-10-12": 2 }, line: { gain: 1 } },
      { rule: "on a Sunday, last week counts all seven days", now: "2026-10-11T10:00:00Z", period: "week" as const, given: { "2026-09-28": 1, "2026-10-04": 1, "2026-10-05": 3 }, line: { gain: 1 } },
      { rule: "in UTC it is still Sunday, so last week counts whole", now: "2026-10-11T23:30:00Z", period: "week" as const, given: { "2026-10-05": 1, "2026-10-06": 2, "2026-10-12": 2 }, line: { gain: 3 } },
      { rule: "in Berlin it is already Monday, so last week counts only its Monday", now: "2026-10-11T23:30:00Z", timeZone: "Europe/Berlin", period: "week" as const, given: { "2026-10-05": 1, "2026-10-06": 2, "2026-10-12": 2 }, line: { gain: 1 } },
      { rule: "the month compares up to the same day of last month", now: "2026-10-13T10:00:00Z", period: "month" as const, given: { "2026-09-13": 1, "2026-09-14": 4, "2026-10-02": 3 }, line: { gain: 2 } },
      { rule: "a 31st compares with the whole of a 30-day month", now: "2026-10-31T10:00:00Z", period: "month" as const, given: { "2026-09-01": 1, "2026-09-30": 2, "2026-10-31": 4 }, line: { gain: 1 } },
      { rule: "a 30th leaves out the 31st of a 31-day month", now: "2026-11-30T10:00:00Z", period: "month" as const, given: { "2026-10-30": 1, "2026-10-31": 5, "2026-11-02": 2 }, line: { gain: 1 } },
      { rule: "a 31st of March compares with the whole of February", now: "2026-03-31T10:00:00Z", period: "month" as const, given: { "2026-02-28": 2, "2026-03-01": 3 }, line: { gain: 1 } },
      { rule: "in UTC it is still October 31st, so September counts whole", now: "2026-10-31T23:30:00Z", period: "month" as const, given: { "2026-09-15": 1, "2026-10-01": 2, "2026-10-20": 3, "2026-11-01": 3 }, line: { gain: 4 } },
      { rule: "in Berlin it is already November 1st, so October counts only its 1st", now: "2026-10-31T23:30:00Z", timeZone: "Europe/Berlin", period: "month" as const, given: { "2026-09-15": 1, "2026-10-01": 2, "2026-10-20": 3, "2026-11-01": 3 }, line: { gain: 1 } },
      { rule: "a January compares with the December before", now: "2027-01-05T10:00:00Z", period: "month" as const, given: { "2026-12-05": 1, "2026-12-06": 4, "2027-01-02": 3 }, line: { gain: 2 } },
      { rule: "without a gain, the best completed week shows", now: "2026-10-13T10:00:00Z", period: "week" as const, given: { "2026-09-28": 4, "2026-10-05": 2, "2026-10-13": 1 }, line: { best: 4 } },
      { rule: "without a gain, the best completed month shows", now: "2026-10-13T10:00:00Z", period: "month" as const, given: { "2026-08-10": 5, "2026-08-11": 1, "2026-09-01": 1, "2026-10-01": 1 }, line: { best: 6 } },
      { rule: "without a gain or a completed period, no line", now: "2026-10-13T10:00:00Z", period: "week" as const, given: {}, line: null },
      { rule: "all time has no line", now: "2026-10-13T10:00:00Z", period: "all" as const, given: { "2026-10-13": 2 }, line: null },
    ])("$rule", async ({ now, timeZone, period, given, line }) => {
      vi.setSystemTime(new Date(now));
      const t = testBackend();
      await members(t, ["U1", "Ann", timeZone], ["U2", "Bob"]);
      for (const [index, [day, kudos]] of Object.entries(given).entries()) await countKudosGiven(t, kudosGiven("U1", { "U2": kudos }, { message: `${index}`, day }));

      expect((await everyoneBoard(t, "U1", period)).improvement).toEqual(line);
      expect((await rankedBoard(t, "U1", period)).improvement).toEqual(line);
    });

    test("G15 G18: places compare with last week's board without the people who are no longer members", async () => {
      const t = testBackend();
      await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"]);
      await countKudosGiven(t, kudosGiven("U3", { "U1": 3 }, { message: "1", day: "2026-10-05" }));
      await countKudosGiven(t, kudosGiven("U2", { "U1": 2 }, { message: "2", day: "2026-10-05" }));
      await countKudosGiven(t, kudosGiven("U1", { "U2": 1 }, { message: "3", day: "2026-10-06" }));
      await countKudosGiven(t, kudosGiven("U1", { "U2": 4 }, { message: "4", day: "2026-10-13" }));
      await countKudosGiven(t, kudosGiven("U2", { "U1": 1 }, { message: "5", day: "2026-10-13" }));

      await recordInDirectory(t, "U3", { kind: "not-a-member" }, Date.now());

      expect((await everyoneBoard(t, "U1")).improvement).toEqual({ gain: 3, places: 1 });
      expect((await rankedBoard(t, "U1")).improvement).toEqual({ gain: 3, places: 1 });
    });
  });
});

describe("rankedBoardOf: the whole Everyone board beside G17's window", () => {
  test("every ranked member in order, with position, rank, tie and member, and the window's positions", async () => {
    const t = testBackend();
    await members(t, ["U1", "Zoe"], ["U2", "Al"], ["U3", "Cy"]);
    await countKudosGiven(t, kudosGiven("U1", { "U3": 2 }, { message: "1" }));
    await countKudosGiven(t, kudosGiven("U2", { "U3": 2 }, { message: "2" }));
    await countKudosGiven(t, kudosGiven("U3", { "U1": 1 }, { message: "3" }));

    const ranked = await rankedBoard(t, "U3");

    expect(ranked).toEqual({
      rows: [
        { position: 1, rank: 1, tied: true, member: await memberId(t, "U2"), name: "Al", picture: null, kudos: 2, viewer: false, climbed: null },
        { position: 2, rank: 1, tied: true, member: await memberId(t, "U1"), name: "Zoe", picture: null, kudos: 2, viewer: false, climbed: null },
        { position: 3, rank: 3, tied: false, member: await memberId(t, "U3"), name: "Cy", picture: null, kudos: 1, viewer: true, climbed: null },
      ],
      window: [1, 2, 3],
      standing: { kind: "ranked", position: 3, rank: 3 },
      improvement: { gain: 1 },
    });
  });

  test("a member without a display name has no name, and still ranks as App Home ranks them", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"]);
    await recordInDirectory(t, "U2", { kind: "member" }, 0);
    await countKudosGiven(t, kudosGiven("U2", { "U1": 2 }, { message: "1" }));

    const { rows } = await rankedBoard(t, "U1");

    expect(rows).toEqual([{ position: 1, rank: 1, tied: false, member: await memberId(t, "U2"), name: undefined, picture: null, kudos: 2, viewer: false, climbed: null }]);
  });

  test("each row carries the member's Slack picture for the website, and null when the directory has none", async () => {
    const t = testBackend();
    await recordInDirectory(t, "U1", { kind: "member", name: "Ann", picture: "https://avatars.example.com/ann-192.png" }, 0);
    await members(t, ["U2", "Bob"]);
    await countKudosGiven(t, kudosGiven("U1", { "U2": 2 }, { message: "1" }));
    await countKudosGiven(t, kudosGiven("U2", { "U1": 1 }, { message: "2" }));

    const { rows } = await rankedBoard(t, "U2");

    expect(rows.map(({ name, picture }) => ({ name, picture }))).toEqual([
      { name: "Ann", picture: "https://avatars.example.com/ann-192.png" },
      { name: "Bob", picture: null },
    ]);
  });

  test("G17: a viewer who gave nothing is not ranked, and the window is the top three", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"], ["U4", "Dee"], ["U5", "Eve"]);
    for (const [index, user] of ["U1", "U2", "U3", "U4"].entries()) await countKudosGiven(t, kudosGiven(user, { "U5": 4 - index }, { message: `${index}` }));

    const ranked = await rankedBoard(t, "U5");

    expect(ranked.rows).toHaveLength(4);
    expect(ranked.window).toEqual([1, 2, 3]);
    expect(ranked.standing).toEqual({ kind: "not-ranked" });
  });

  describe("G22: a member who left the boards is on nobody's board, their own included", () => {
    test("rankedBoardOf: a viewer who left is in no row, stands as left, and keeps their gain without places", async () => {
      const t = testBackend();
      await members(t, ["U1", "Ann"], ["U2", "Bob"]);
      await countKudosGiven(t, kudosGiven("U2", { "U1": 2 }, { message: "1", day: "2026-10-06" }));
      await countKudosGiven(t, kudosGiven("U1", { "U2": 3 }, { message: "2" }));
      await countKudosGiven(t, kudosGiven("U2", { "U1": 1 }, { message: "3" }));
      await countKudosGiven(t, kudosGiven("U1", { "U2": 1 }, { message: "4", day: "2026-10-06" }));
      await t.run(async (ctx) => setLeaderboardVisibility(ctx, await memberIdIn(ctx, "U1"), false));

      const ranked = await rankedBoard(t, "U1");

      expect(ranked.rows.map(({ name }) => name)).toEqual(["Bob"]);
      expect(ranked.standing).toEqual({ kind: "left" });
      expect(ranked.improvement).toEqual({ gain: 2 });
    });
  });
});

describe("GB18: places climbed", () => {
  test("a row that rose since last week up to the same day says how many places, and a row that fell, stayed or is new says nothing", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"], ["U4", "Dee"], ["U5", "Eve"], ["U6", "Fay"], ["U9", "Viv"]);
    for (const [index, [user, kudos]] of [["U1", 5], ["U2", 4], ["U3", 3], ["U4", 2], ["U5", 1]].entries()) {
      await countKudosGiven(t, kudosGiven(user as string, { "U9": kudos as number }, { message: `last-${index}`, day: "2026-10-06" }));
    }
    await countKudosGiven(t, kudosGiven("U5", { "U9": 10 }, { message: "after-the-same-day", day: "2026-10-07" }));
    for (const [index, [user, kudos]] of [["U1", 6], ["U5", 5], ["U2", 4], ["U6", 3], ["U3", 2]].entries()) {
      await countKudosGiven(t, kudosGiven(user as string, { "U9": kudos as number }, { message: `this-${index}` }));
    }

    const { rows } = await rankedBoard(t, "U9");

    expect(rows.map(({ position, name, climbed }) => ({ position, name, climbed }))).toEqual([
      { position: 1, name: "Ann", climbed: null },
      { position: 2, name: "Eve", climbed: 3 },
      { position: 3, name: "Bob", climbed: null },
      { position: 4, name: "Fay", climbed: null },
      { position: 5, name: "Cy", climbed: null },
    ]);
  });

  test("a 31st compares the month's rows with the whole of a 30-day month", async () => {
    vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U9", "Viv"]);
    await countKudosGiven(t, kudosGiven("U1", { "U9": 2 }, { message: "1", day: "2026-09-01" }));
    await countKudosGiven(t, kudosGiven("U2", { "U9": 3 }, { message: "2", day: "2026-09-30" }));
    await countKudosGiven(t, kudosGiven("U1", { "U9": 1 }, { message: "3", day: "2026-10-31" }));
    await countKudosGiven(t, kudosGiven("U2", { "U9": 2 }, { message: "4", day: "2026-10-31" }));
    await countKudosGiven(t, kudosGiven("U1", { "U9": 2 }, { message: "5", day: "2026-10-31" }));

    const { rows } = await rankedBoard(t, "U9", "month");

    expect(rows.map(({ name, climbed }) => ({ name, climbed }))).toEqual([
      { name: "Ann", climbed: 1 },
      { name: "Bob", climbed: null },
    ]);
  });

  test("all time has no places climbed", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U9", "Viv"]);
    await countKudosGiven(t, kudosGiven("U1", { "U9": 2 }, { message: "1", day: "2026-10-06" }));
    await countKudosGiven(t, kudosGiven("U2", { "U9": 3 }, { message: "2" }));

    const { rows } = await rankedBoard(t, "U9", "all");

    expect(rows.map(({ name, climbed }) => ({ name, climbed }))).toEqual([
      { name: "Bob", climbed: null },
      { name: "Ann", climbed: null },
    ]);
  });

  test("G22: a viewer who left the boards sees the places everyone else sees, compared without them", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"]);
    await countKudosGiven(t, kudosGiven("U1", { "U3": 3 }, { message: "1", day: "2026-10-06" }));
    await countKudosGiven(t, kudosGiven("U2", { "U3": 2 }, { message: "2", day: "2026-10-06" }));
    await countKudosGiven(t, kudosGiven("U2", { "U3": 2 }, { message: "3" }));
    await t.run(async (ctx) => setLeaderboardVisibility(ctx, await memberIdIn(ctx, "U1"), false));

    expect((await rankedBoard(t, "U1")).rows.map(({ name, climbed }) => ({ name, climbed }))).toEqual([{ name: "Bob", climbed: null }]);
    expect((await rankedBoard(t, "U3")).rows.map(({ name, climbed }) => ({ name, climbed }))).toEqual([{ name: "Bob", climbed: null }]);
  });
});

describe("GB35: the Everyone board at scale", () => {
  test("1,500 members giving every day for two months: the month board and its comparison read within Convex's transaction limits", async () => {
    vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    const t = testBackend({ transactionLimits: true });
    const everyone = await aWorkspaceOf(t, 1_500);
    const september = { month: "2026-09", days: 30, kudos: (index: number) => 1 + (index % 5) };
    const october = { month: "2026-10", days: 31, kudos: (index: number) => 1 + ((index + 1) % 5) };
    await eachGaveDaily(t, everyone, september);
    await eachGaveDaily(t, everyone, october);
    await theDaysOf(t, everyone, september);

    const ranked = await rankedBoard(t, "U0000", "month");

    expect(ranked.rows).toHaveLength(1_500);
    expect(ranked.rows[0]).toMatchObject({ name: "Member 0003", kudos: 155, climbed: 300 });
    expect(ranked.rows.filter(({ climbed }) => climbed === 300)).toHaveLength(1_200);
    expect(ranked.rows.filter(({ climbed }) => climbed === null)).toHaveLength(300);
    expect(ranked.improvement).toEqual({ gain: 32, places: 300 });
  }, 120_000);
});

type Person = [user: string, name: string, timeZone?: string];

async function members(t: Backend, ...people: Person[]) {
  for (const [user, name, timeZone] of people) await recordInDirectory(t, user, { kind: "member", name, ...(timeZone && { timeZone }) }, 0);
}

async function recordInDirectory(t: Backend, user: string, entry: DirectoryEntry, asOf: number) {
  await t.run((ctx) => record(ctx, { workspace: "T1", user, entry, asOf }));
}

async function memberId(t: Backend, user: string) {
  return t.run((ctx) => memberIdIn(ctx, user));
}

async function memberIdIn(ctx: QueryCtx, user: string) {
  const row = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return row!._id;
}

type Options = { message?: string; day?: string };

function kudosGiven(giverUser: string, kudosTo: Record<string, number>, { message = "1", day = "2026-10-13" }: Options = {}) {
  return async (t: Backend): Promise<KudosGivenEvent> => {
    const giver = await memberId(t, giverUser);
    const awards = [];
    for (const [user, kudos] of Object.entries(kudosTo)) {
      const recipient = await memberId(t, user);
      awards.push({ award: await awardRow(t, { message, giver, recipient, kudos, day }), giver, recipient, kudos });
    }
    return {
      type: "kudosGiven",
      workspace: "T1",
      message: { workspace: "T1", conversation: "C1", message },
      giver,
      awards,
      via: "message",
      kudosEmoji: "hedgehog",
      annotations: {},
      skippedMentions: 0,
      retry: false,
      inThread: false,
      allowance: { dailyOpening: 5, dailyLeft: 0 },
      day,
      at: Date.now(),
    };
  };
}

async function countKudosGiven(t: Backend, event: (t: Backend) => Promise<KudosGivenEvent>) {
  await t.mutation(internal.leaderboard.totals.countKudosGiven, { event: await event(t) });
}

function everyoneBoard(t: Backend, viewer: string, period?: Period) {
  return t.query(internal.leaderboard.totals.everyoneBoard, { workspace: "T1", viewer, ...(period && { period }) });
}

function rankedBoard(t: Backend, viewer: string, period: Period = "week") {
  return t.run((ctx) => rankedBoardOf(ctx, "T1", viewer, period));
}

async function aWorkspaceOf(t: Backend, count: number) {
  return t.run(async (ctx) => {
    const everyone: Array<Id<"members">> = [];
    for (let index = 0; index < count; index += 1) {
      const number = String(index).padStart(4, "0");
      everyone.push(await ctx.db.insert("members", { workspace: "T1", user: `U${number}`, kind: "member", name: `Member ${number}`, asOf: 0 }));
    }
    return everyone;
  });
}

type DailyGiving = { month: string; days: number; kudos: (index: number) => number };

async function eachGaveDaily(t: Backend, everyone: Array<Id<"members">>, { month, days, kudos }: DailyGiving) {
  await t.run(async (ctx) => {
    for (const [index, member] of everyone.entries()) {
      const runningTotal = Array.from({ length: days }, (_, day) => kudos(index) * (day + 1));
      await ctx.db.insert("givenTotals", { workspace: "T1", member, period: `month:${month}`, kudos: kudos(index) * days, runningTotal });
    }
  });
}

async function theDaysOf(t: Backend, everyone: Array<Id<"members">>, { month, days, kudos }: DailyGiving) {
  for (let day = 1; day <= days; day += 1) {
    await t.run(async (ctx) => {
      for (const [index, member] of everyone.entries()) await ctx.db.insert("givenByDay", { workspace: "T1", member, day: `${month}-${String(day).padStart(2, "0")}`, kudos: kudos(index) });
    });
  }
}

function shown(view: BoardView) {
  return view.rows.map((row) => ("gap" in row ? "…" : `${row.rank} ${row.name}${row.viewer ? " (you)" : ""} ${row.value}`));
}

type AwardRow = { message: string; giver: Id<"members">; recipient: Id<"members">; kudos: number; day: string };

function awardRow(t: Backend, award: AwardRow) {
  return t.run((ctx) => ctx.db.insert("awards", { workspace: "T1", conversation: "C1", ...award, at: Date.now() }));
}
