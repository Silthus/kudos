import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { insertAwards, type Award } from "../engine/awards";
import { record } from "../workspace/directory";
import { convexTest } from "convex-test";
import schema from "../schema";
import { modules } from "../test.setup";
import { testBackend, type Backend } from "../../testing/slackBackend";
import type { BoardView } from "./board";

const tuesday = new Date("2026-10-13T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("G14: earlier kudos count on the board", () => {
  test("every earlier award counts once in its allowance day's week, month and all time", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"]);
    await earlierAward(t, "U1", { "U2": 2, "U3": 2 }, { message: "1", day: "2026-10-13" });
    await earlierAward(t, "U1", { "U3": 1 }, { message: "2", day: "2026-10-04" });
    await earlierAward(t, "U1", { "U2": 3 }, { message: "3", day: "2026-09-30" });
    await earlierAward(t, "U2", { "U1": 1 }, { message: "4", day: "2026-10-12" });

    await countEarlierKudos(t);

    expect(shown(await everyoneBoard(t, "U3"))).toEqual(["1 Ann 4", "2 Bob 1"]);
    expect(await totalsOf(t, "U1")).toEqual({ "week:2026-10-12": 4, "week:2026-09-28": 4, "month:2026-10": 5, "month:2026-09": 3, all: 8 });
    expect(await totalsOf(t, "U2")).toEqual({ "week:2026-10-12": 1, "month:2026-10": 1, all: 1 });
  });

  test("running it again, or resuming it after an interruption, changes nothing more", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"]);
    await earlierAward(t, "U1", { "U2": 2 }, { message: "1", day: "2026-10-12" });
    await earlierAward(t, "U2", { "U1": 1 }, { message: "2", day: "2026-10-13" });
    await earlierAward(t, "U1", { "U2": 1 }, { message: "3", day: "2026-10-13" });

    await interruptedAfterFirstPage(t);
    await countEarlierKudos(t);
    await countEarlierKudos(t);

    expect(await totalsOf(t, "U1")).toEqual({ "week:2026-10-12": 3, "month:2026-10": 3, all: 3 });
    expect(await totalsOf(t, "U2")).toEqual({ "week:2026-10-12": 1, "month:2026-10": 1, all: 1 });
    expect(await countEarlierKudos(t)).toMatchObject({ messages: 0 });
  });

  test("a message whose awards span two pages counts all of them, once", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"], ["U3", "Cy"], ["U4", "Di"]);
    await earlierAward(t, "U1", { "U2": 1, "U3": 1, "U4": 1 }, { message: "1", day: "2026-10-13" });

    expect(await countEarlierKudos(t, { pageSize: 2 })).toMatchObject({ messages: 1 });

    expect(await totalsOf(t, "U1")).toEqual({ "week:2026-10-12": 3, "month:2026-10": 3, all: 3 });
  });

  test("a giver's many messages on one day stay within Convex's transaction limits", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    await members(t, ["U1", "Ann"], ["U2", "Bob"]);
    const [ann, bob] = [await memberId(t, "U1"), await memberId(t, "U2")];
    await t.run(async (ctx) => {
      for (let message = 1; message <= 400; message++) {
        await insertAwards(ctx, { workspace: "T1", conversation: "C1", message: `${message}` }, [{ giver: ann, recipient: bob, kudos: 1 }], "2026-10-13", Date.now());
      }
    });

    expect(await countEarlierKudos(t)).toMatchObject({ messages: 400 });

    expect(await totalsOf(t, "U1")).toEqual({ "week:2026-10-12": 400, "month:2026-10": 400, all: 400 });
  });

  test("G44: an award given while the backfill runs counts once", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"]);
    await earlierAward(t, "U1", { "U2": 1 }, { message: "1", day: "2026-10-13" });

    await interruptedAfterFirstPage(t);
    await givenLive(t, "U2", { "U1": 2 }, { message: "2", day: "2026-10-13" });
    await countEarlierKudos(t);

    expect(shown(await everyoneBoard(t, "U1"))).toEqual(["1 Bob 2", "2 Ann (you) 1"]);
    expect(await totalsOf(t, "U2")).toEqual({ "week:2026-10-12": 2, "month:2026-10": 2, all: 2 });
  });

  test("G44: an award the backfill counts before its kudosGiven arrives counts once", async () => {
    const t = testBackend();
    await members(t, ["U1", "Ann"], ["U2", "Bob"]);
    const event = await earlierAward(t, "U1", { "U2": 3 }, { message: "1", day: "2026-10-13" });

    await countEarlierKudos(t);
    await t.mutation(internal.leaderboard.totals.countKudosGiven, { event });

    expect(await totalsOf(t, "U1")).toEqual({ "week:2026-10-12": 3, "month:2026-10": 3, all: 3 });
  });
});

type Person = [user: string, name: string];

async function members(t: Backend, ...people: Person[]) {
  for (const [user, name] of people) {
    await t.run((ctx) => record(ctx, { workspace: "T1", user, entry: { kind: "member", name }, asOf: 0 }));
  }
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

type Given = { message: string; day: string };

async function earlierAward(t: Backend, giverUser: string, kudosTo: Record<string, number>, { message, day }: Given): Promise<KudosGivenEvent> {
  const giver = await memberId(t, giverUser);
  const awards: Award[] = [];
  for (const [user, kudos] of Object.entries(kudosTo)) awards.push({ giver, recipient: await memberId(t, user), kudos });
  const ref = { workspace: "T1", conversation: "C1", message };
  await t.run((ctx) => insertAwards(ctx, ref, awards, day, Date.now()));
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: ref,
    giver,
    awards,
    kudosEmoji: "hedgehog",
    annotations: {},
    allowance: { dailyOpening: 5, dailyLeft: 0 },
    day,
    at: Date.now(),
  };
}

async function givenLive(t: Backend, giverUser: string, kudosTo: Record<string, number>, given: Given) {
  const event = await earlierAward(t, giverUser, kudosTo, given);
  await t.mutation(internal.leaderboard.totals.countKudosGiven, { event });
}

async function countEarlierKudos(t: Backend, args: { pageSize?: number } = {}) {
  return t.action(internal.leaderboard.backfill.countEarlierKudos, args);
}

async function interruptedAfterFirstPage(t: Backend) {
  await t.mutation(internal.leaderboard.backfill.countEarlierKudosPage, { cursor: null, pageSize: 1 });
}

function everyoneBoard(t: Backend, viewer: string) {
  return t.query(internal.leaderboard.totals.everyoneBoard, { workspace: "T1", viewer });
}

function shown(view: BoardView) {
  return view.rows.map((row) => ("gap" in row ? "…" : `${row.rank} ${row.name}${row.viewer ? " (you)" : ""} ${row.value}`));
}

async function totalsOf(t: Backend, user: string) {
  const member = await memberId(t, user);
  const rows = await t.run((ctx) => ctx.db.query("givenTotals").collect());
  return Object.fromEntries(rows.filter((row) => row.member === member).map((row) => [row.period, row.kudos]));
}
