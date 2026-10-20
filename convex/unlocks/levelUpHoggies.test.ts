import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, switchWebsite } from "../../testing/website";
import { fromTheNewestDecided } from "../engine/awards";
import { catalogue, type Rarity } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import { dropsByDecision } from "../hoggies/drops";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

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

async function drawnFor(member: MemberId, crate: string, floor?: Rarity) {
  const { hoggie, rarity } = await drawOf({ secret: process.env.HOGGIE_DRAW_SECRET ?? "", member, crate, version: catalogue.version, floor });
  return { hoggie, rarity };
}

describe("a level up drops a hoggie from each of three crates", () => {
  test("reaching a level drops three hoggies into the collection, the third rare or rarer", async () => {
    const member = await aMemberWith("level-up-hoggies", "collection");

    await reachesLevel(t, member, 3);

    expect((await dropsOf(member)).map(({ hoggie, rarity }) => ({ hoggie, rarity }))).toEqual([
      await drawnFor(member, "level:3:1"),
      await drawnFor(member, "level:3:2"),
      await drawnFor(member, "level:3:3", "rare"),
    ]);
  });

  test("over twenty level ups, every third find is rare or rarer", async () => {
    const member = await aMemberWith("level-up-hoggies", "collection");

    for (let level = 2; level <= 21; level++) await reachesLevel(t, member, level);

    const thirdFinds = (await dropsOf(member)).filter((_, index) => index % 3 === 2);
    expect(thirdFinds).toHaveLength(20);
    for (const [index, { rarity }] of thirdFinds.entries()) expect(rareOrRarer, `level ${index + 2}'s third find`).toContain(rarity);
  });

  test("each level reached drops its own three", async () => {
    const member = await aMemberWith("level-up-hoggies", "collection");

    await reachesLevel(t, member, 2);
    await reachesLevel(t, member, 3);

    expect(await cratesOf(member)).toEqual(["level:2:1", "level:2:2", "level:2:3", "level:3:1", "level:3:2", "level:3:3"]);
  });

  test("a replayed level-up drops nothing more", async () => {
    const member = await aMemberWith("level-up-hoggies", "collection");
    await reachesLevel(t, member, 3);

    await reachesLevel(t, member, 3);

    expect(await cratesOf(member)).toHaveLength(3);
  });

  test("the hoggies pay no pack bonus, so they never level the member up again", async () => {
    const member = await aMemberWith("level-up-hoggies", "collection", "packs");
    const before = await t.run((ctx) => standingOf(ctx, member));

    await reachesLevel(t, member, 3);
    await settle(t);

    expect(await t.run((ctx) => standingOf(ctx, member))).toEqual(before);
    expect(await cratesOf(member)).toHaveLength(3);
  });

  test.each([
    ["level-up-hoggies is off", ["collection"]],
    ["collection is off", ["level-up-hoggies"]],
  ])("while %s, a level-up drops nothing", async (_, flags) => {
    const member = await aMemberWith(...flags);

    await reachesLevel(t, member, 3);

    expect(await cratesOf(member)).toEqual([]);
  });
});
