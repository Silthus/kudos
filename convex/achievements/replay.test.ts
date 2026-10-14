import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEvent } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { KudosGivenEvent } from "../bus/events";
import { unlocksLiveIn } from "../unlocks/launch";
import type { MemberId } from "../workspace/directory";
import { achievementsLiveIn } from "./flag";
import { ladders, type Ladder, type LadderId, type TierId } from "./ladders";

const now = new Date("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60_000;
const catalogue = ladders as unknown as { version: string; ladders: Ladder[] };
const shippedCatalogue = { version: catalogue.version, ladders: [...catalogue.ladders] };
const countedFromMarks: LadderId[] = ["connections", "dependability", "applause", "seasons"];

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "achievements");
});

afterEach(() => {
  catalogue.version = shippedCatalogue.version;
  catalogue.ladders = [...shippedCatalogue.ladders];
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P62: at the Book's launch, achievements count every member's whole history", () => {
  test("kudos given before the launch are counted in award order, and each tier is dated by the award that reached it", async () => {
    const { t, alice, bob } = await withMembers();
    const first = await given(t, alice, bob, { kudos: 1, at: daysAgo(30) });
    const reachingSilver = await given(t, alice, bob, { kudos: 24, at: daysAgo(20) });
    await given(t, alice, bob, { kudos: 5, at: daysAgo(10) });

    await launch(t);
    await settle(t);

    expect(await ladderOf(t, alice, "generosity")).toEqual({ count: 30, earned: [{ tier: "bronze", earnedAt: first.at }, { tier: "silver", earnedAt: reachingSilver.at }] });
    expect(await ladderOf(t, bob, "recognition")).toEqual({ count: 30, earned: [{ tier: "bronze", earnedAt: first.at }, { tier: "silver", earnedAt: reachingSilver.at }] });
  });

  test("the replay runs once per workspace: launching again, and kudos after it, replay nothing again", async () => {
    const { t, alice, bob } = await withMembers();
    const first = await given(t, alice, bob, { kudos: 1, at: daysAgo(3) });
    await launch(t);
    await settle(t);

    await launch(t);
    await count(t, await given(t, alice, bob, { kudos: 1, at: Date.now() }));
    await settle(t);

    expect(await ladderOf(t, alice, "generosity")).toEqual({ count: 2, earned: [{ tier: "bronze", earnedAt: first.at }] });
    expect(await replaysIn(t, "T1")).toHaveLength(ladders.ladders.length);
    expect(await batchesIn(t, "T1")).toHaveLength(1);
  });

  test("each workspace replays its own history", async () => {
    const { t, alice, bob } = await withMembers();
    const [carol, dave] = await t.run(async (ctx) => [
      await ctx.db.insert("members", { workspace: "T2", user: "U_CAROL", kind: "member" }),
      await ctx.db.insert("members", { workspace: "T2", user: "U_DAVE", kind: "member" }),
    ]);
    await given(t, alice, bob, { kudos: 2, at: daysAgo(2) });
    await given(t, carol!, dave!, { kudos: 3, at: daysAgo(1) }, "T2");

    await launch(t);
    await settle(t);

    expect((await ladderOf(t, alice, "generosity")).count).toBe(2);
    expect((await ladderOf(t, carol!, "generosity")).count).toBe(0);
    await t.run(async (ctx) => {
      await unlocksLiveIn(ctx, "T2");
      await achievementsLiveIn(ctx, "T2");
    });
    await settle(t);
    expect((await ladderOf(t, carol!, "generosity")).count).toBe(3);
    expect((await ladderOf(t, alice, "generosity")).count).toBe(2);
  });
});

describe("P62: the replay and live counting count every award once", () => {
  test("a kudos given during the replay, whose subscriber runs before the replay finishes, is counted once by the replay's catch-up", async () => {
    const { t, alice, bob } = await withMembers();
    const before = await given(t, alice, bob, { kudos: 1, at: daysAgo(1) });
    await launch(t);

    const during = await given(t, alice, bob, { kudos: 24, at: Date.now() });
    await count(t, during);
    await settle(t);
    await count(t, during);

    expect(await ladderOf(t, alice, "generosity")).toEqual({ count: 25, earned: [{ tier: "bronze", earnedAt: before.at }, { tier: "silver", earnedAt: during.at }] });
  });

  test("a delayed subscriber of a kudos before the launch, running after the replay, counts nothing twice", async () => {
    const { t, alice, bob } = await withMembers();
    const delayed = await given(t, alice, bob, { kudos: 3, at: daysAgo(1) });
    await launch(t);
    await settle(t);

    await count(t, delayed);

    expect(await ladderOf(t, alice, "generosity")).toEqual({ count: 3, earned: [{ tier: "bronze", earnedAt: delayed.at }] });
  });

  test("after the replay, a new kudos is counted live", async () => {
    const { t, alice, bob } = await withMembers();
    await launch(t);
    await settle(t);

    const live = await given(t, alice, bob, { kudos: 1, at: Date.now() });
    await count(t, live);

    expect(await ladderOf(t, bob, "recognition")).toEqual({ count: 1, earned: [{ tier: "bronze", earnedAt: live.at }] });
  });
});

describe("P60 P62: the replay is keyed by the ladder and tier IDs it evaluated", () => {
  test("a tier added to an evaluated ladder is evaluated against full history once, dated by the award that reached it, and the tiers already earned keep their dates", async () => {
    withoutTier("gold");
    const { t, alice, bob } = await withMembers();
    const first = await given(t, alice, bob, { kudos: 1, at: daysAgo(30) });
    const reachingSilver = await given(t, alice, bob, { kudos: 30, at: daysAgo(20) });
    const reachingGold = await given(t, alice, bob, { kudos: 80, at: daysAgo(10) });
    await launch(t);
    await settle(t);
    const launchBatch = (await batchesIn(t, "T1"))[0]!._id;
    expect((await ladderOf(t, alice, "generosity")).earned.map(({ tier }) => tier)).toEqual(["bronze", "silver"]);

    shipped();
    await launch(t);
    await settle(t);
    await launch(t);
    await settle(t);

    expect(await ladderOf(t, alice, "generosity")).toEqual({
      count: 111,
      earned: [
        { tier: "bronze", earnedAt: first.at },
        { tier: "silver", earnedAt: reachingSilver.at },
        { tier: "gold", earnedAt: reachingGold.at },
      ],
    });
    const goldBatch = (await batchesIn(t, "T1")).find(({ _id }) => _id !== launchBatch)!._id;
    expect(await earnedBatches(t, alice, "generosity")).toEqual({ bronze: launchBatch, silver: launchBatch, gold: goldBatch });
    expect(await batchesIn(t, "T1")).toHaveLength(2);
  });

  test("a tier added while its ladder's history is still being counted is evaluated by its own batch after that count finishes, dated by the award that reached it", async () => {
    withoutTier("diamond");
    const t = await flagsLoaded(testBackend());
    const { alice, bob } = await membersIn(t);
    await t.run(async (ctx) => {
      for (let kudos = 0; kudos < 600; kudos++) await ctx.db.insert("awards", awardRow(alice, bob, { kudos: 1, at: daysAgo(30) + kudos }));
    });
    await launch(t);
    const [launchBatch] = await batchesIn(t, "T1");
    const generosity = (await replaysIn(t, "T1")).find(({ ladder }) => ladder === "generosity")!;
    await t.mutation(internal.achievements.replay.replayPage, { replay: generosity._id });

    shipped();
    await launch(t);
    await settle(t);

    const [, diamondBatch] = await batchesIn(t, "T1");
    expect((await ladderOf(t, alice, "generosity")).earned.at(-1)).toEqual({ tier: "diamond", earnedAt: daysAgo(30) + 499 });
    expect(await earnedBatches(t, alice, "generosity")).toEqual({ bronze: launchBatch!._id, silver: launchBatch!._id, gold: launchBatch!._id, diamond: diamondBatch!._id });
    expect((await batchesIn(t, "T1")).map(({ completedAt }) => completedAt)).toEqual([Date.now(), Date.now()]);
  }, 60_000);

  test("a ladder added after the launch replays full history once and leaves the other ladders' tiers alone", async () => {
    withoutLadders("recognition");
    const { t, alice, bob } = await withMembers();
    const first = await given(t, alice, bob, { kudos: 2, at: daysAgo(5) });
    await launch(t);
    await settle(t);
    const generosityBefore = await earnedRows(t, alice, "generosity");
    const afterLaunch = await given(t, alice, bob, { kudos: 1, at: Date.now() });
    await count(t, afterLaunch);
    expect((await ladderOf(t, bob, "recognition")).count).toBe(0);

    shipped();
    await count(t, await given(t, alice, bob, { kudos: 1, at: Date.now() + 1000 }));
    await settle(t);

    expect(await ladderOf(t, bob, "recognition")).toEqual({ count: 4, earned: [{ tier: "bronze", earnedAt: first.at }] });
    expect(await earnedRows(t, alice, "generosity")).toEqual(generosityBefore);
    expect((await ladderOf(t, alice, "generosity")).count).toBe(4);
  });
});

describe("P58 P62: Connections, Dependability, Applause and Seasons replay on their own once added", () => {
  test("added after the launch, the four ladders replay full history once, each tier dated by the award that reached it, and Generosity's and Recognition's tiers stay as they were", async () => {
    withoutLadders(...countedFromMarks);
    const { t, alice, bob } = await withMembers();
    const { carol, dave } = await moreMembers(t);
    const firstMonth = await given(t, alice, bob, { kudos: 1, at: daysAgo(40) });
    await given(t, alice, carol, { kudos: 1, at: daysAgo(40) + 1 });
    const thirdPerson = await given(t, alice, dave, { kudos: 1, at: daysAgo(40) + 2 });
    await given(t, alice, bob, { kudos: 2, at: daysAgo(10) });
    await launch(t);
    await settle(t);
    const generosityBefore = await earnedRows(t, alice, "generosity");
    const recognitionBefore = await earnedRows(t, bob, "recognition");
    expect(await replaysIn(t, "T1")).toHaveLength(ladders.ladders.length);

    shipped();
    await launch(t);
    await settle(t);
    await launch(t);
    await settle(t);

    expect(await ladderOf(t, alice, "connections")).toEqual({ count: 3, earned: [{ tier: "bronze", earnedAt: thirdPerson.at }] });
    expect(await ladderOf(t, alice, "dependability")).toEqual({ count: 2, earned: [] });
    expect(await ladderOf(t, alice, "applause")).toEqual({ count: 1, earned: [] });
    expect(await ladderOf(t, alice, "seasons")).toEqual({ count: 2, earned: [{ tier: "bronze", earnedAt: firstMonth.at }] });
    expect(await earnedRows(t, alice, "generosity")).toEqual(generosityBefore);
    expect(await earnedRows(t, bob, "recognition")).toEqual(recognitionBefore);
    expect(await replaysIn(t, "T1")).toHaveLength(ladders.ladders.length);
    expect(await batchesIn(t, "T1")).toHaveLength(2);
  });
});

describe("P62: one launch batch with a completion barrier", () => {
  test("every tier one launch earns carries its batch, and the batch completes only when all its replays have", async () => {
    const { t, alice, bob } = await withMembers();
    await given(t, alice, bob, { kudos: 25, at: daysAgo(1) });
    await launch(t);
    const [batch] = await batchesIn(t, "T1");
    const replays = await replaysIn(t, "T1");
    const last = replays.pop()!;

    for (const { _id } of replays) await replayToTheEnd(t, _id);
    expect((await batchesIn(t, "T1"))[0]!.completedAt).toBeUndefined();
    await replayToTheEnd(t, last._id);

    expect((await batchesIn(t, "T1"))[0]!.completedAt).toBe(Date.now());
    expect(await earnedBatches(t, alice, "generosity")).toEqual({ bronze: batch!._id, silver: batch!._id });
    expect(await earnedBatches(t, bob, "recognition")).toEqual({ bronze: batch!._id, silver: batch!._id });
  });

  test("a tier earned live after the replay carries no batch", async () => {
    const { t, alice, bob } = await withMembers();
    await launch(t);
    await settle(t);

    await count(t, await given(t, alice, bob, { kudos: 1, at: Date.now() }));

    expect(await earnedBatches(t, alice, "generosity")).toEqual({ bronze: undefined });
  });
});

describe("P62: a long history replays within Convex's transaction limits", () => {
  test("a member who gave 2,100 kudos, one at a time, replays every one of them", async () => {
    withoutLadders(...countedFromMarks);
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    const { alice, bob } = await membersIn(t);
    await t.run(async (ctx) => {
      for (let kudos = 0; kudos < 2100; kudos++) await ctx.db.insert("awards", awardRow(alice, bob, { kudos: 1, at: daysAgo(30) + kudos }));
    });

    await launch(t);
    await settle(t);

    const generosity = await ladderOf(t, alice, "generosity");
    expect(generosity.count).toBe(2100);
    expect(generosity.earned).toEqual([
      { tier: "bronze", earnedAt: daysAgo(30) },
      { tier: "silver", earnedAt: daysAgo(30) + 24 },
      { tier: "gold", earnedAt: daysAgo(30) + 99 },
      { tier: "diamond", earnedAt: daysAgo(30) + 499 },
    ]);
  }, 120_000);
});

describe("P61 P62: a tier added to a ladder counted from marks is dated by the award that first reached it", () => {
  test("Connections bronze, added after the launch, is dated by the third person thanked, not by a later kudos to someone already thanked", async () => {
    withoutTier("bronze");
    const { t, alice, bob } = await withMembers();
    const { carol, dave } = await moreMembers(t);
    await given(t, alice, bob, { kudos: 1, at: daysAgo(9) });
    await given(t, alice, carol, { kudos: 1, at: daysAgo(8) });
    const thirdPerson = await given(t, alice, dave, { kudos: 1, at: daysAgo(7) });
    await given(t, alice, bob, { kudos: 1, at: daysAgo(6) });
    await launch(t);
    await settle(t);

    shipped();
    await launch(t);
    await settle(t);

    expect(await ladderOf(t, alice, "connections")).toEqual({ count: 3, earned: [{ tier: "bronze", earnedAt: thirdPerson.at }] });
  });
});

describe("P58 P62: the people, days and months you thanked count within Convex's transaction limits", () => {
  test("a member who thanked 3 of 30 people every day for 300 days replays all four ladders, and the next kudos counts live", async () => {
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    const { alice } = await membersIn(t);
    const people = await t.run(async (ctx) => {
      const inserted: MemberId[] = [];
      for (let person = 0; person < 30; person++) inserted.push(await ctx.db.insert("members", { workspace: "T1", user: `U_PERSON_${person}`, kind: "member" }));
      return inserted;
    });
    const thanksOnDay = (day: number) => [0, 1, 2].map((nth) => ({ recipient: people[(3 * day + nth) % people.length]!, at: daysAgo(300 - day) + nth }));
    await t.run(async (ctx) => {
      for (let day = 0; day < 300; day++) for (const { recipient, at } of thanksOnDay(day)) await ctx.db.insert("awards", awardRow(alice, recipient, { kudos: 1, at }));
    });

    await launch(t);
    await settle(t);
    await count(t, await given(t, alice, people[0]!, { kudos: 1, at: Date.now() }));

    expect(await ladderOf(t, alice, "connections")).toEqual({
      count: 30,
      earned: [
        { tier: "bronze", earnedAt: thanksOnDay(0)[2]!.at },
        { tier: "silver", earnedAt: thanksOnDay(1)[2]!.at },
        { tier: "gold", earnedAt: thanksOnDay(3)[2]!.at },
        { tier: "diamond", earnedAt: thanksOnDay(7)[2]!.at },
      ],
    });
    expect((await ladderOf(t, alice, "dependability")).count).toBe(301);
    expect((await ladderOf(t, alice, "dependability")).earned.at(-1)).toEqual({ tier: "diamond", earnedAt: thanksOnDay(249)[0]!.at });
    expect((await ladderOf(t, alice, "applause")).count).toBe(300);
    expect((await ladderOf(t, alice, "applause")).earned.at(-1)).toEqual({ tier: "diamond", earnedAt: thanksOnDay(99)[2]!.at });
    expect(await ladderOf(t, alice, "seasons")).toEqual({
      count: 11,
      earned: [
        { tier: "bronze", earnedAt: thanksOnDay(0)[0]!.at },
        { tier: "silver", earnedAt: Date.parse("2026-02-01T10:00:00Z") },
        { tier: "gold", earnedAt: Date.parse("2026-05-01T10:00:00Z") },
      ],
    });
  }, 120_000);
});

async function moreMembers(t: Backend) {
  const [carol, dave] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_DAVE", kind: "member" }),
  ]);
  return { carol: carol!, dave: dave! };
}

async function withMembers() {
  const t = await flagsLoaded(testBackend());
  return { t, ...(await membersIn(t)) };
}

async function membersIn(t: Backend) {
  await t.run((ctx) => unlocksLiveIn(ctx, "T1"));
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  return { alice: alice!, bob: bob! };
}

function launch(t: Backend) {
  return t.run((ctx) => achievementsLiveIn(ctx, "T1"));
}

function daysAgo(days: number) {
  return now.getTime() - days * dayMs;
}

function awardRow(giver: MemberId, recipient: MemberId, { kudos, at }: { kudos: number; at: number }, workspace = "T1") {
  return { workspace, conversation: "C1", message: `${at}`, giver, recipient, kudos, day: new Date(at).toISOString().slice(0, 10), at };
}

async function given(t: Backend, giver: MemberId, recipient: MemberId, { kudos, at }: { kudos: number; at: number }, workspace = "T1"): Promise<KudosGivenEvent> {
  return t.run(async (ctx) => {
    const row = awardRow(giver, recipient, { kudos, at }, workspace);
    const award = await ctx.db.insert("awards", row);
    const event = kudosGivenEvent(giver, recipient, { workspace, at, day: row.day, message: { workspace, conversation: row.conversation, message: row.message } });
    return { ...event, awards: [{ award, giver, recipient, kudos }] };
  });
}

async function count(t: Backend, event: KudosGivenEvent) {
  await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
}

async function replayToTheEnd(t: Backend, replay: Id<"bookReplays">) {
  for (let page = 0; page < 10; page++) await t.mutation(internal.achievements.replay.replayPage, { replay });
}

async function ladderOf(t: Backend, member: MemberId, ladder: LadderId) {
  const facts = await t.run(async (ctx) => {
    const count = await ctx.db
      .query("ladderCounts")
      .withIndex("by_member_ladder", (q) => q.eq("member", member).eq("ladder", ladder))
      .unique();
    return { count: count?.count ?? 0, earned: await earnedRowsIn(ctx, member, ladder) };
  });
  return { count: facts.count, earned: facts.earned.map(({ tier, earnedAt }) => ({ tier, earnedAt })) };
}

function earnedRows(t: Backend, member: MemberId, ladder: LadderId) {
  return t.run((ctx) => earnedRowsIn(ctx, member, ladder));
}

async function earnedRowsIn(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], member: MemberId, ladder: LadderId) {
  const order: TierId[] = ["bronze", "silver", "gold", "diamond"];
  const rows = await ctx.db
    .query("earnedTiers")
    .withIndex("by_member_ladder_tier", (q) => q.eq("member", member).eq("ladder", ladder))
    .collect();
  return rows.sort((one, other) => order.indexOf(one.tier) - order.indexOf(other.tier));
}

async function earnedBatches(t: Backend, member: MemberId, ladder: LadderId) {
  return Object.fromEntries((await earnedRows(t, member, ladder)).map(({ tier, batch }) => [tier, batch]));
}

function batchesIn(t: Backend, workspace: string) {
  return t.run((ctx) =>
    ctx.db
      .query("bookBatches")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .collect(),
  );
}

function replaysIn(t: Backend, workspace: string) {
  return t.run((ctx) =>
    ctx.db
      .query("bookReplays")
      .withIndex("by_workspace_ladder", (q) => q.eq("workspace", workspace))
      .collect(),
  );
}

function withoutTier(tier: TierId) {
  catalogue.ladders = shippedCatalogue.ladders.map((ladder) => ({ ...ladder, tiers: ladder.tiers.filter((entry) => entry.tier !== tier) }));
}

function withoutLadders(...without: LadderId[]) {
  catalogue.ladders = shippedCatalogue.ladders.filter((entry) => !without.includes(entry.ladder));
}

function shipped() {
  catalogue.ladders = [...shippedCatalogue.ladders];
}
