import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../../testing/fakePostHog";
import { FakeSlack } from "../../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../../testing/flags";
import { testBackend, type Backend } from "../../../testing/slackBackend";
import { opens, reachesLevel } from "../../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../../testing/website";
import { api, internal } from "../../_generated/api";
import type { Command } from "../../commands/commands";
import { recordReward } from "../../progression/progression";
import schema from "../../schema";

const now = new Date("2026-10-14T10:00:00Z");
const minuteMs = 60_000;
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const shopping = ["xp-levels", "unlocks", "quests", "achievements", "coins", "crate-store", "everyone-board"];
const packsFlags = ["collection", "packs"];
const everyKindWaiting = [
  { crate: "unlock:leaderboard", kind: "unlock", n: 1 },
  { crate: "bought:1", kind: "bought", n: 2 },
];

type TableName = keyof typeof schema.tables;
type Caller = Pick<Backend, "mutation" | "query">;
type Collector = Awaited<ReturnType<typeof aCollectorWithEveryKindWaiting>>;

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

function flagsOn(backend: Backend, ...keys: string[]) {
  return switchWebsite(backend, postHog, true, ...keys);
}

async function aShopperIn(backend: Backend, { level, coins, flags = shopping }: { level: number; coins: number; flags?: string[] }) {
  vi.clearAllTimers();
  vi.setSystemTime(now);
  await flagsOn(backend, ...flags);
  await unlocksShippedBeforeAnyoneJoined(backend);
  await bookShippedBeforeAnyoneJoined(backend);
  const member = await aMember(backend, juno.user);
  const { asSignedIn } = await aSignedInSession(backend, juno);
  await backend.run((ctx) => ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: 0 }));
  await reachesLevel(backend, member, level);
  await opens(backend, member, "book");
  if (level >= 6) await opens(backend, member, "coins");
  await backend.run((ctx) => recordReward(ctx, "T1", { member, key: `test:earned:${coins}`, xp: 0, coins, item: null, catalogueVersion: "2", at: 0 }));
  return { backend, member, asSignedIn };
}

async function aShopperWithEveryFeatureOpenIn(backend: Backend, coins: number) {
  const shopper = await aShopperIn(backend, { level: 6, coins });
  for (const feature of ["quests", "leaderboard"] as const) await opens(backend, shopper.member, feature);
  await flagsOn(backend, ...shopping, ...packsFlags);
  return shopper;
}

async function aCollectorWithEveryKindWaiting(backend: Backend = t) {
  const shopper = await aShopperIn(backend, { level: 6, coins: 120 });
  await opens(backend, shopper.member, "quests");
  await flagsOn(backend, ...shopping, ...packsFlags);
  later(3);
  expect(await shopper.asSignedIn.mutation(api.website.commands.buyCrate, { next: 1 })).toEqual({ kind: "bought", crate: "bought:1" });
  later(4);
  return shopper;
}

function later(minutes: number) {
  vi.setSystemTime(now.getTime() + minutes * minuteMs);
}

function secondsLater(seconds: number) {
  vi.setSystemTime(now.getTime() + seconds * 1000);
}

async function packsOf(caller: Caller) {
  const answer = await caller.query(api.website.collection.getCollection, {});
  if (answer.kind !== "collection") throw new Error(`expected the collection, got ${answer.kind}`);
  return { packs: answer.packs, morePacks: answer.morePacks };
}

function openCrate(caller: Caller, crate: string) {
  return caller.mutation(api.website.commands.openCrate, { crate });
}

function openFromAppHome(backend: Backend, command: Command, eventId: string) {
  return backend.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId, user: juno.user, commands: [command] });
}

function renumbered(packs: typeof everyKindWaiting) {
  return packs.map((pack, index) => ({ ...pack, n: index + 1 }));
}

function without(...crates: string[]) {
  return renumbered(everyKindWaiting.filter(({ crate }) => !crates.includes(crate)));
}

async function everythingWritten(backend: Backend = t) {
  return backend.run(async (ctx) => {
    const tables = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) tables[table] = await ctx.db.query(table).collect();
    return { tables, scheduled: await ctx.db.system.query("_scheduled_functions").collect() };
  });
}

async function domainTablesOf(backend: Backend) {
  const { tables } = await everythingWritten(backend);
  const domain = ["drops", "crateOpenings", "pendingCrates", "unlocks", "boughtCrates", "memberProgress", "rewardRecords", "hoggieTallies"] as const;
  return Object.fromEntries(domain.map((table) => [table, tables[table].map(withoutGeneratedFields)]));
}

function withoutGeneratedFields({ _id, _creationTime, ...row }: Record<string, unknown>) {
  return row;
}

describe("CV7: every waiting pack in getCollection", { timeout: 60_000 }, () => {
  test("lists a ready feature and a bought crate, oldest waiting first, with no amount", async () => {
    const { asSignedIn } = await aCollectorWithEveryKindWaiting();

    expect(await packsOf(asSignedIn)).toEqual({ packs: everyKindWaiting, morePacks: false });
  });

  test("drops each pack once it is opened, from App Home or on the website, renumbering the rest", async () => {
    const { backend, asSignedIn } = await aCollectorWithEveryKindWaiting();

    await openFromAppHome(backend, { type: "openUnlock", feature: "leaderboard" }, "Ev_FEATURE");
    expect(await packsOf(asSignedIn), "after App Home opened the feature").toEqual({ packs: without("unlock:leaderboard"), morePacks: false });
    await openCrate(asSignedIn, "bought:1");
    expect(await packsOf(asSignedIn), "after every open").toEqual({ packs: [], morePacks: false });
  });

  test("leaves out features not ready yet", async () => {
    const atLevelTwo = await aShopperIn(testBackend(), { level: 2, coins: 0 });
    await flagsOn(atLevelTwo.backend, ...shopping, ...packsFlags);
    expect(await packsOf(atLevelTwo.asSignedIn), "at level 2, with Quests and Coins still locked").toEqual({ packs: [{ crate: "unlock:leaderboard", kind: "unlock", n: 1 }], morePacks: false });
  });

  test("lists 50 of 60 bought crates in the order they were bought, says more wait, answers the same on every read, and stays inside Convex's limits", async () => {
    const { asSignedIn } = await aShopperWithEveryFeatureOpenIn(t, 60 * 50);
    const limited = await aShopperWithEveryFeatureOpenIn(testBackend({ transactionLimits: true }), 60 * 50);
    for (let next = 1; next <= 60; next++) {
      secondsLater(next);
      await asSignedIn.mutation(api.website.commands.buyCrate, { next });
      await limited.asSignedIn.mutation(api.website.commands.buyCrate, { next });
    }
    const fifty = Array.from({ length: 50 }, (_, index) => ({ crate: `bought:${index + 1}`, kind: "bought", n: index + 1 }));

    expect(await packsOf(asSignedIn)).toEqual({ packs: fifty, morePacks: true });
    expect(await packsOf(asSignedIn), "a second read").toEqual({ packs: fifty, morePacks: true });
    expect(await packsOf(limited.asSignedIn), "the read with transaction limits").toEqual({ packs: fifty, morePacks: true });
  });

  test("orders crates bought in one instant by their number, so the 50 listed are the first 50 bought", async () => {
    const { asSignedIn } = await aShopperWithEveryFeatureOpenIn(t, 60 * 50);
    for (let next = 1; next <= 60; next++) await asSignedIn.mutation(api.website.commands.buyCrate, { next });

    expect(await packsOf(asSignedIn)).toEqual({ packs: Array.from({ length: 50 }, (_, index) => ({ crate: `bought:${index + 1}`, kind: "bought", n: index + 1 })), morePacks: true });
  });

  test("with packs off, getCollection answers the collection with no packs and no morePacks", async () => {
    const { asSignedIn } = await aCollectorWithEveryKindWaiting();
    await flagsOn(t, ...shopping, "collection");
    const answer = await asSignedIn.query(api.website.collection.getCollection, {});

    expect(answer).toMatchObject({ kind: "collection", bought: ["bought:1"] });
    expect(answer).not.toHaveProperty("packs");
    expect(answer).not.toHaveProperty("morePacks");
  });
});

describe("CV8: openCrate opens any listed pack", { timeout: 60_000 }, () => {
  test("opens each kind, answering and leaving what the kind's own command answers and leaves", async () => {
    const byOwnCommand = await aCollectorWithEveryKindWaiting(testBackend());
    const byOpenCrate = await aCollectorWithEveryKindWaiting(t);
    const ownCommands: Record<string, (collector: Collector) => Promise<unknown>> = {
      "unlock:leaderboard": ({ asSignedIn }) => asSignedIn.mutation(api.website.commands.openFeature, { feature: "leaderboard" }),
      "bought:1": ({ asSignedIn }) => openCrate(asSignedIn, "bought:1"),
    };

    for (const { crate } of everyKindWaiting) {
      const answer = await openCrate(byOpenCrate.asSignedIn, crate);
      expect(answer, crate).toEqual(await ownCommands[crate]!(byOwnCommand));
      expect(answer, crate).toEqual({ kind: "opened", applied: { xp: expect.any(Number), coins: expect.any(Number), from: expect.any(Object), to: expect.any(Object) }, drop: expect.objectContaining({ copy: expect.any(Number) }) });
    }
    expect(await domainTablesOf(t), "the tables the opens leave").toEqual(await domainTablesOf(byOwnCommand.backend));
  });

  test("answers a repeat with the same drop and applied, and writes nothing more", async () => {
    const { asSignedIn } = await aCollectorWithEveryKindWaiting();
    const first = [];
    for (const { crate } of everyKindWaiting) first.push(await openCrate(asSignedIn, crate));
    expect(first, "the first opens").toEqual(everyKindWaiting.map(() => expect.objectContaining({ kind: "opened" })));
    const before = await everythingWritten();
    later(10);

    for (const [index, { crate }] of everyKindWaiting.entries()) expect(await openCrate(asSignedIn, crate), crate).toEqual(first[index]);
    expect((await everythingWritten()).tables, "tables after the repeats").toEqual(before.tables);
  });

  test("answers drop null and applied null for a crate opened elsewhere while collection was off", async () => {
    const { member, asSignedIn } = await aShopperIn(t, { level: 6, coins: 0 });
    await opens(t, member, "quests");
    await flagsOn(t, ...shopping, ...packsFlags);

    expect(await openCrate(asSignedIn, "unlock:quests"), "a feature opened while collection was off").toEqual({ kind: "opened", applied: null, drop: null });
  });

  test.each([
    { why: "a Journey step's crate", crate: "journey:first-thanks" },
    { why: "a weekly quest's crate", crate: "weekly:2026-10-12:0" },
    { why: "a locked feature", crate: "unlock:skillTree" },
    { why: "a crate not bought yet", crate: "bought:2" },
    { why: "a group crate", crate: "group:a-group:2026-10-12" },
    { why: "an unknown feature", crate: "unlock:nothing" },
    { why: "a key of no kind", crate: "nothing" },
  ])("refuses $why and writes nothing", async ({ crate }) => {
    const { member, asSignedIn } = await aShopperIn(t, { level: 6, coins: 120 });
    await opens(t, member, "quests");
    await flagsOn(t, ...shopping, ...packsFlags);
    later(1);
    expect(await asSignedIn.mutation(api.website.commands.buyCrate, { next: 1 })).toEqual({ kind: "bought", crate: "bought:1" });
    const before = await everythingWritten();

    expect(await openCrate(asSignedIn, crate)).toEqual({ kind: "refused" });
    expect(await everythingWritten(), "everything after the refusal").toEqual(before);
  });

  test("refuses every key while collection is off, writing nothing", async () => {
    const { backend, asSignedIn } = await aCollectorWithEveryKindWaiting();
    await flagsOn(backend, ...shopping, "packs");
    const before = await everythingWritten();

    for (const { crate } of everyKindWaiting) expect(await openCrate(asSignedIn, crate), crate).toEqual({ kind: "refused" });
    expect(await everythingWritten(), "everything after the refusals").toEqual(before);
  });

  test("with packs off, opens bought crates only, as before", async () => {
    const { asSignedIn } = await aCollectorWithEveryKindWaiting();
    await flagsOn(t, ...shopping, "collection");
    const before = await everythingWritten();

    for (const crate of ["unlock:leaderboard"]) expect(await openCrate(asSignedIn, crate), crate).toEqual({ kind: "refused" });
    expect(await everythingWritten(), "everything after the refusals").toEqual(before);
    expect(await openCrate(asSignedIn, "bought:1")).toEqual({ kind: "opened", drop: expect.objectContaining({ copy: 1 }) });
  });
});
