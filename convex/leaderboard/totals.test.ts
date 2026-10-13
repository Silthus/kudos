import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { record, type DirectoryEntry } from "../workspace/directory";
import { testBackend, type Backend } from "../../testing/slackBackend";
import type { BoardView } from "./board";
import type { Period } from "./periods";

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

describe("G18: the improvement line compares with the previous period up to the same day", () => {
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
  });
});

type Person = [user: string, name: string, timeZone?: string];

async function members(t: Backend, ...people: Person[]) {
  for (const [user, name, timeZone] of people) await recordInDirectory(t, user, { kind: "member", name, ...(timeZone && { timeZone }) }, 0);
}

async function recordInDirectory(t: Backend, user: string, entry: DirectoryEntry, asOf: number) {
  await t.run((ctx) => record(ctx, { workspace: "T1", user, entry, asOf }));
}

async function memberId(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

type Options = { message?: string; day?: string };

function kudosGiven(giverUser: string, kudosTo: Record<string, number>, { message = "1", day = "2026-10-13" }: Options = {}) {
  return async (t: Backend): Promise<KudosGivenEvent> => {
    const giver = await memberId(t, giverUser);
    const awards = [];
    for (const [user, kudos] of Object.entries(kudosTo)) awards.push({ giver, recipient: await memberId(t, user), kudos });
    return {
      type: "kudosGiven",
      workspace: "T1",
      message: { workspace: "T1", conversation: "C1", message },
      giver,
      awards,
      kudosEmoji: "hedgehog",
      annotations: {},
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

function shown(view: BoardView) {
  return view.rows.map((row) => ("gap" in row ? "…" : `${row.rank} ${row.name}${row.viewer ? " (you)" : ""} ${row.value}`));
}
