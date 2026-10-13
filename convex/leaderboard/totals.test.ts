import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { record, type DirectoryEntry } from "../workspace/directory";
import { testBackend, type Backend } from "../../testing/slackBackend";
import type { BoardView } from "./board";

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

function everyoneBoard(t: Backend, viewer: string) {
  return t.query(internal.leaderboard.totals.everyoneBoard, { workspace: "T1", viewer });
}

function shown(view: BoardView) {
  return view.rows.map((row) => ("gap" in row ? "…" : `${row.rank} ${row.name}${row.viewer ? " (you)" : ""} ${row.value}`));
}
