import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { withoutExposureOf } from "../../testing/hoggies";
import { memberChanged, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { catalogue, hoggieNamed } from "../album/hoggies/catalogue";
import { drawOf } from "../album/hoggies/draw";
import { recordReward } from "../progression/progression";
import schema from "../schema";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const crateStoreFlags = ["xp-levels", "unlocks", "achievements", "coins", "collection", "crate-store"];
const levelSix = 1000;

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;
type Caller = Pick<Backend, "query" | "mutation">;

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

function flagsOn(...keys: string[]) {
  return switchWebsite(t, postHog, true, ...keys);
}

async function aShopperWith(coins: number, identity = juno) {
  const member = await aMember(t, identity.user);
  const { asSignedIn } = await aSignedInSession(t, identity);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: levelSix, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  await opens(t, member, "book");
  await opens(t, member, "coins");
  if (coins > 0) await t.run((ctx) => recordReward(ctx, "T1", { member, key: `test:earned:${coins}`, xp: 0, coins, item: null, catalogueVersion: "2", at: 0 }));
  return { member, asSignedIn };
}

async function aCrateStoreShopperWith(coins: number) {
  await flagsOn(...crateStoreFlags.filter((flag) => flag !== "collection"));
  await bookShippedBeforeAnyoneJoined(t);
  const shopper = await aShopperWith(coins);
  await flagsOn(...crateStoreFlags);
  return shopper;
}

function buyCrate(caller: Caller, next: number) {
  return caller.mutation(api.website.commands.buyCrate, { next });
}

function openCrate(caller: Caller, crate: string) {
  return caller.mutation(api.website.commands.openCrate, { crate });
}

async function storeOf(caller: Caller) {
  const answer = await caller.query(api.website.collection.getCollection, {});
  if (answer.kind !== "collection") throw new Error(`expected a collection, got ${JSON.stringify(answer)}`);
  return { bought: answer.bought, crateStore: answer.crateStore };
}

function coinsOf(member: MemberId) {
  return t.run((ctx) => balanceOf(ctx, member));
}

async function everyTable() {
  return t.run(async (ctx) => {
    const tables = {} as Record<TableName, Row[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) tables[table] = await ctx.db.query(table).collect();
    return tables;
  });
}

async function everythingWritten() {
  return { tables: withoutExposureOf("crate-store", await everyTable()), scheduled: await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()) };
}

async function dropDrawnFor(member: MemberId, crate: string) {
  const { hoggie, rarity } = await drawOf({ secret: "", member, crate, version: catalogue.version });
  return { hoggie, name: hoggieNamed(hoggie)!.name, rarity, art: { kind: "hoggie", slug: hoggie }, copy: 1, isNew: true };
}

describe("CL27 CL30: a member buys a crate for 50 coins, by the number of crates they bought so far", () => {
  test("with 120 coins, buying crate 1 spends 50, and the Book's collection lists the bought crate and offers crate 2", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(120);
    expect(await storeOf(asSignedIn)).toEqual({ bought: [], crateStore: { price: 50, next: 1 } });

    expect(await buyCrate(asSignedIn, 1)).toEqual({ kind: "bought", crate: "bought:1" });

    expect(await coinsOf(member)).toBe(70);
    expect(await storeOf(asSignedIn)).toEqual({ bought: ["bought:1"], crateStore: { price: 50, next: 2 } });
    expect(await t.run((ctx) => ctx.db.query("coinSpends").collect())).toEqual([expect.objectContaining({ member, coins: 50, for: { crate: "bought:1" }, at: now.getTime() })]);
  });

  test("with 49 coins, buying refuses with no-coins and writes nothing", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(49);
    const before = await everythingWritten();

    expect(await buyCrate(asSignedIn, 1)).toEqual({ kind: "refused", reason: "no-coins" });

    expect(await everythingWritten()).toEqual(before);
    expect(await coinsOf(member)).toBe(49);
  });

  test("the same crate number bought twice buys once and answers the same both times", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(200);

    expect(await buyCrate(asSignedIn, 1)).toEqual({ kind: "bought", crate: "bought:1" });
    const before = await everythingWritten();
    expect(await buyCrate(asSignedIn, 1)).toEqual({ kind: "bought", crate: "bought:1" });

    expect(await everythingWritten()).toEqual(before);
    expect(await coinsOf(member)).toBe(150);
    expect(await storeOf(asSignedIn)).toEqual({ bought: ["bought:1"], crateStore: { price: 50, next: 2 } });
  });

  test("two crates bought in order both succeed, and a number ahead of the next refuses with stale and writes nothing", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(200);

    expect(await buyCrate(asSignedIn, 1)).toEqual({ kind: "bought", crate: "bought:1" });
    expect(await buyCrate(asSignedIn, 2)).toEqual({ kind: "bought", crate: "bought:2" });
    const before = await everythingWritten();
    for (const next of [4, 0, -1, 2.5, Number.NaN]) expect({ next, answer: await buyCrate(asSignedIn, next) }).toEqual({ next, answer: { kind: "refused", reason: "stale" } });

    expect(await everythingWritten()).toEqual(before);
    expect(await coinsOf(member)).toBe(100);
    expect(await storeOf(asSignedIn)).toEqual({ bought: ["bought:1", "bought:2"], crateStore: { price: 50, next: 3 } });
  });

  test("before Coins is open, buying refuses with coins-not-open, the store offers nothing and nothing is written", async () => {
    await flagsOn(...crateStoreFlags);
    await bookShippedBeforeAnyoneJoined(t);
    const member = await aMember(t, juno.user);
    const { asSignedIn } = await aSignedInSession(t, juno);
    await reachesLevel(t, member, 4);
    await opens(t, member, "book");
    const before = await everythingWritten();

    expect(await buyCrate(asSignedIn, 1)).toEqual({ kind: "refused", reason: "coins-not-open" });

    expect(await everythingWritten()).toEqual(before);
    expect(await storeOf(asSignedIn)).toEqual({ bought: [], crateStore: null });
  });

  test.each([
    { condition: "with crate-store off", flags: crateStoreFlags.filter((flag) => flag !== "crate-store") },
    { condition: "with collection off", flags: crateStoreFlags.filter((flag) => flag !== "collection") },
  ])("$condition, buying answers null and writes nothing", async ({ flags }) => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(200);
    await flagsOn(...flags);
    const before = await everythingWritten();

    expect(await buyCrate(asSignedIn, 1)).toBeNull();

    expect(await everythingWritten()).toEqual(before);
    expect(await coinsOf(member)).toBe(200);
  });
});

describe("CL28 CL30: a bought crate waits until its member opens it, and drops one hoggie", () => {
  test("a bought crate opens once with its drop, a repeated open answers the same drop and writes nothing, and the crate stops waiting", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(50);
    await buyCrate(asSignedIn, 1);
    const drop = await dropDrawnFor(member, "bought:1");

    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "opened", drop });
    await settleInTimeOrder(t);
    const before = await everythingWritten();
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "opened", drop });

    expect((await everythingWritten()).tables).toEqual(before.tables);
    expect(await storeOf(asSignedIn)).toEqual({ bought: [], crateStore: { price: 50, next: 2 } });
    const drops = postHog.productEvents().filter(({ event }) => event === "hoggie dropped");
    expect(drops.map(({ properties }) => properties)).toEqual([expect.objectContaining({ rarity: drop.rarity, is_new: true, crate_kind: "bought" })]);
  });

  test("a crate the member didn't buy, someone else's bought crate and a quest's crate key refuse and write nothing", async () => {
    const { asSignedIn } = await aCrateStoreShopperWith(50);
    const rowansShop = await aShopperWith(50, rowan);
    await buyCrate(rowansShop.asSignedIn, 1);
    const before = await everythingWritten();

    for (const crate of ["bought:1", "bought:2", "journey:first-thanks", "unlock:book"]) expect({ crate, answer: await openCrate(asSignedIn, crate) }).toEqual({ crate, answer: { kind: "refused" } });

    expect(await everythingWritten()).toEqual(before);
  });

  test("with collection off, opening refuses and the crate keeps waiting, and once it is back on the crate opens with its drop", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(50);
    await buyCrate(asSignedIn, 1);
    await flagsOn(...crateStoreFlags.filter((flag) => flag !== "collection"));
    const before = await everythingWritten();

    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "refused" });

    expect(await everythingWritten()).toEqual(before);
    await flagsOn(...crateStoreFlags);
    expect(await storeOf(asSignedIn)).toEqual({ bought: ["bought:1"], crateStore: { price: 50, next: 2 } });
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "bought:1") });
  });

  test("every waiting bought crate is listed, however many wait", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(0);
    const crates = Array.from({ length: 101 }, (_, index) => `bought:${index + 1}`);
    await t.run(async (ctx) => {
      for (const [index, crate] of crates.entries()) await ctx.db.insert("boughtCrates", { member, crate, n: index + 1, boughtAt: now.getTime() });
    });

    expect(await storeOf(asSignedIn)).toEqual({ bought: crates, crateStore: { price: 50, next: 102 } });
  });

  test("with crate-store off, a bought crate stays listed and still opens, and the store is no longer offered", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(50);
    await buyCrate(asSignedIn, 1);
    await flagsOn(...crateStoreFlags.filter((flag) => flag !== "crate-store"));

    expect(await storeOf(asSignedIn)).toEqual({ bought: ["bought:1"], crateStore: undefined });
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "opened", drop: await dropDrawnFor(member, "bought:1") });
    expect(await storeOf(asSignedIn)).toEqual({ bought: undefined, crateStore: undefined });
  });
});

describe("website commands pass one guard", () => {
  test("WS61: with the website flag off, buying a crate and opening a bought one answer closed and write nothing at all", async () => {
    const { asSignedIn } = await aCrateStoreShopperWith(100);
    await buyCrate(asSignedIn, 1);
    await switchWebsite(t, postHog, false, ...crateStoreFlags);
    const before = await everythingWritten();

    expect(await buyCrate(asSignedIn, 2)).toEqual({ kind: "closed" });
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "closed" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61: without a session both answer signed-out, and for a member who left both answer not-a-member, writing nothing at all", async () => {
    const { asSignedIn } = await aCrateStoreShopperWith(100);
    await buyCrate(asSignedIn, 1);
    const before = await everythingWritten();

    expect(await buyCrate(t, 2)).toEqual({ kind: "signed-out" });
    expect(await openCrate(t, "bought:1")).toEqual({ kind: "signed-out" });
    expect(await everythingWritten()).toEqual(before);
    await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
    const left = await everythingWritten();
    expect(await buyCrate(asSignedIn, 2)).toEqual({ kind: "not-a-member" });
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "not-a-member" });
    expect(await everythingWritten()).toEqual(left);
  });

  test("WS61: the crate's number and the crate are the only arguments, so no call names a member", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(100);
    const before = await everythingWritten();

    await expect(asSignedIn.mutation(api.website.commands.buyCrate, { next: 1, member } as never)).rejects.toThrow(/member/);
    await expect(asSignedIn.mutation(api.website.commands.openCrate, { crate: "bought:1", member } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS62 P77: with no unlocks launch recorded, buying a crate answers null and opening one refused, and neither launches anything", async () => {
    const { asSignedIn } = await aCrateStoreShopperWith(100);
    await buyCrate(asSignedIn, 1);
    await t.run(async (ctx) => {
      for (const launch of await ctx.db.query("unlockLaunches").collect()) await ctx.db.delete(launch._id);
    });
    const before = await everythingWritten();

    expect(await buyCrate(asSignedIn, 2)).toBeNull();
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS62 P91: with quests on and no Journey launch, buying a crate answers null and opening one refused, and neither launches the Journey", async () => {
    const { asSignedIn } = await aCrateStoreShopperWith(100);
    await buyCrate(asSignedIn, 1);
    await flagsOn(...crateStoreFlags, "quests");
    const before = await everythingWritten();

    expect(await buyCrate(asSignedIn, 2)).toBeNull();
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "refused" });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
  });
});

describe("a website command is a D17 command", () => {
  test("CL27: a crate bought and opened on the website leaves the rows App Home's Buy and Open of the same crate leave, and schedules App Home's republish", async () => {
    const { member, asSignedIn } = await aCrateStoreShopperWith(100);
    const inSlack = await aShopperWith(100, rowan);
    const republishes = async () => (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).filter(({ name, args: [args] }) => name === "slack/appHome:publishHome" && (args as { user?: string }).user === juno.user).length;
    const republishedBefore = await republishes();

    await buyCrate(asSignedIn, 1);
    await openCrate(asSignedIn, "bought:1");
    for (const [eventId, command] of [["Ev_BUY", { type: "buyCrate" as const, next: 1 }], ["Ev_OPEN", { type: "openCrate" as const, crate: "bought:1" }]] as const) {
      await t.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId, user: rowan.user, commands: [command] });
    }

    const rowsOf = async (who: MemberId) => {
      const tables = await everyTable();
      const own = (table: "boughtCrates" | "coinSpends" | "drops") => tables[table].filter((row) => row.member === who).map(({ _id, _creationTime, member: _, ...row }) => row);
      return { boughtCrates: own("boughtCrates"), coinSpends: own("coinSpends"), boughtCratesDropped: own("drops").filter(({ crate }) => String(crate).startsWith("bought:")).map(({ crate }) => crate) };
    };
    expect(await rowsOf(member)).toEqual(await rowsOf(inSlack.member));
    expect(await rowsOf(member)).toMatchObject({ boughtCrates: [{ crate: "bought:1", n: 1, openedAt: now.getTime() }], boughtCratesDropped: ["bought:1"] });
    expect(await republishes()).toBe(republishedBefore + 2);
  });

  test("CL27: a repeated purchase of the same crate schedules no republish", async () => {
    const { asSignedIn } = await aCrateStoreShopperWith(100);
    await buyCrate(asSignedIn, 1);
    const before = await everythingWritten();

    await buyCrate(asSignedIn, 1);

    expect(await everythingWritten()).toEqual(before);
  });
});
