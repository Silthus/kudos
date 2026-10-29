import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, switchWebsite } from "../../testing/website";
import { fromTheNewestDecided } from "../engine/awards";
import { catalogue, type Rarity } from "./hoggies/catalogue";
import { drawOf } from "./hoggies/draw";
import { collectionOf } from "./hoggies/collection";
import { dropsByDecision } from "./hoggies/drops";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";
import { internal } from "../_generated/api";
import type { LevelReachedEvent } from "../bus/events";

const now = new Date("2026-10-20T10:00:00Z");
const rareOrRarer: Rarity[] = ["rare", "epic", "legendary"];

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function aMemberWith(...flags: string[]) {
  await switchWebsite(t, postHog, true, ...flags);
  return aMember(t, "U_JUNO");
}

function dropsOf(member: MemberId) {
  return t.run(async (ctx) => {
    const drops = [];
    for await (const { drop } of dropsByDecision(ctx, member, fromTheNewestDecided, { crests: false })) drops.push(drop);
    return drops.reverse();
  });
}

function cratesOf(member: MemberId) {
  return t.run(async (ctx) => (await ctx.db.query("drops").withIndex("by_member", (q) => q.eq("member", member)).collect()).map(({ crate }) => crate));
}

function copiesHeldBy(member: MemberId) {
  return t.run(async (ctx) => (await collectionOf(ctx, member, { crests: false })).hoggies.reduce((copies, { count }) => copies + count, 0));
}

async function drawnFor(member: MemberId, crate: string, floor?: Rarity) {
  const { hoggie, rarity } = await drawOf({ secret: process.env.HOGGIE_DRAW_SECRET ?? "", member, crate, version: catalogue.version, floor });
  return { hoggie, rarity };
}

describe("a level up drops a hoggie from each of three crates", () => {
  test("reaching a level drops three hoggies into the collection, the third rare or rarer", async () => {
    const member = await aMemberWith("level-up-reveal", "collection");

    await reachesLevel(t, member, 3);

    expect((await dropsOf(member)).map(({ hoggie, rarity }) => ({ hoggie, rarity }))).toEqual([
      await drawnFor(member, "level:3:1"),
      await drawnFor(member, "level:3:2"),
      await drawnFor(member, "level:3:3", "rare"),
    ]);
    expect(await copiesHeldBy(member), "copies in the collection").toBe(3);
  });

  test("over twenty level ups, every third find is rare or rarer", async () => {
    const member = await aMemberWith("level-up-reveal", "collection");

    for (let level = 2; level <= 21; level++) await reachesLevel(t, member, level);

    const thirdFinds = (await dropsOf(member)).filter((_, index) => index % 3 === 2);
    expect(thirdFinds).toHaveLength(20);
    for (const [index, { rarity }] of thirdFinds.entries()) expect(rareOrRarer, `level ${index + 2}'s third find`).toContain(rarity);
  });

  test("each level reached drops its own three", async () => {
    const member = await aMemberWith("level-up-reveal", "collection");

    await reachesLevel(t, member, 2);
    await reachesLevel(t, member, 3);

    expect(await cratesOf(member)).toEqual(["level:2:1", "level:2:2", "level:2:3", "level:3:1", "level:3:2", "level:3:3"]);
    expect(await copiesHeldBy(member), "copies in the collection").toBe(6);
  });

  test("a replayed level-up drops nothing more", async () => {
    const member = await aMemberWith("level-up-reveal", "collection");
    await reachesLevel(t, member, 3);

    await reachesLevel(t, member, 3);

    expect(await cratesOf(member)).toHaveLength(3);
    expect(await copiesHeldBy(member), "copies in the collection").toBe(3);
  });

  test("a level-up first delivered while level-up-reveal was off drops nothing when replayed after it turns on", async () => {
    const member = await aMemberWith("collection");
    await reachesLevel(t, member, 3);
    await switchWebsite(t, postHog, true, "level-up-reveal", "collection");

    await reachesLevel(t, member, 3);

    expect(await cratesOf(member)).toEqual([]);
    expect(await copiesHeldBy(member), "copies in the collection").toBe(0);
  });

  test("the hoggies pay no pack bonus, so they never level the member up again", async () => {
    const member = await aMemberWith("level-up-reveal", "collection", "packs");
    const before = await t.run((ctx) => standingOf(ctx, member));

    await reachesLevel(t, member, 3);
    await settle(t);

    expect(await t.run((ctx) => standingOf(ctx, member))).toEqual(before);
    expect(await cratesOf(member)).toHaveLength(3);
  });

  test.each([
    ["level-up-reveal is off", ["collection"]],
    ["collection is off", ["level-up-reveal"]],
    ["hidden-items is on", ["level-up-reveal", "collection", "hidden-items"]],
  ])("while %s, a level-up drops nothing", async (_, flags) => {
    const member = await aMemberWith(...flags);

    await reachesLevel(t, member, 3);

    expect(await cratesOf(member)).toEqual([]);
    expect(await copiesHeldBy(member), "copies in the collection").toBe(0);
  });
});

describe("HH17: a follower stranded by a rollback earns its level when replayed", () => {
  test("a level up whose follower failed after Unlocks recorded it earns its three hoggies once, however often the failed job is replayed", async () => {
    const member = await aMemberWith("level-up-reveal", "collection");
    const event = { type: "levelReached" as const, workspace: "T1", member, level: 3, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, at: now.getTime() };
    await t.mutation(internal.unlocks.unlocks.makeReady, { event });
    const stranded = await failedFollowerOf(event);

    expect(await t.mutation(internal.bus.replay.replay, { job: stranded })).toBe("replayed");
    await settle(t);
    expect(await t.mutation(internal.bus.replay.replay, { job: stranded })).toBe("already replayed");
    await settle(t);

    expect(await cratesOf(member)).toEqual(["level:3:1", "level:3:2", "level:3:3"]);
    expect(await copiesHeldBy(member), "copies in the collection").toBe(3);
  });
});

async function failedFollowerOf(event: LevelReachedEvent) {
  await settle(t);
  const job = await t.run((ctx) => ctx.scheduler.runAfter(0, internal.album.levelUpHoggies.earnLevelUpHoggies, { event }));
  const missingFunction = vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    throw new Error("the previous version has no such function");
  });
  await settle(t);
  missingFunction.mockRestore();
  const state = await t.run(async (ctx) => (await ctx.db.system.get(job))?.state.kind);
  expect(state, "the follower's job before the replay").toBe("failed");
  return job;
}
