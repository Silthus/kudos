import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHomeBlocks } from "../../testing/slackInteractions";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { publish } from "../bus/publish";
import { recordReward } from "../progression/progression";
import schema from "../schema";
import { grantItem } from "../store/inventory";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const storeFlags = ["xp-levels", "unlocks", "coins", "store", "custom-kudos-emoji"];
const levelSix = 1000;
const shipit = "custom:shipit";
const partyparrot = "custom:partyparrot";
const firstRequest = "0d6f2c1e-8a4b-4c3d-9e2f-1a2b3c4d5e6f";
const secondRequest = "7b9e4f3a-2c1d-4e5f-8a9b-0c1d2e3f4a5b";

type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;
type Caller = Pick<Backend, "mutation">;

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
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

async function storeShipped(backend: Backend = t, ...alsoOn: string[]) {
  await switchWebsite(backend, postHog, true, ...storeFlags);
  await unlocksShippedBeforeAnyoneJoined(backend);
  await switchWebsite(backend, postHog, true, ...storeFlags, ...alsoOn);
}

async function aMemberAtLevelSix(backend: Backend = t) {
  const member = await aMember(backend, juno.user);
  const { asSignedIn, sessionId } = await aSignedInSession(backend, juno);
  await backend.run((ctx) => ctx.db.insert("memberProgress", { member, xp: levelSix, pointsSpent: 0 }));
  await reachesLevel(backend, member, 6);
  return { member, asSignedIn, sessionId };
}

async function aMemberWithTheStoreOpen(coins: number, backend: Backend = t) {
  const signedIn = await aMemberAtLevelSix(backend);
  await opens(backend, signedIn.member, "coins");
  if (coins > 0) await earns(signedIn.member, coins, backend);
  await backend.run(async (ctx) => {
    for (const name of ["shipit", "partyparrot"]) await ctx.db.insert("customKudosEmoji", { workspace: "T1", name, url: `https://emoji.slack-edge.com/T1/${name}/0a1b2c.png`, pickedAt: now.getTime() });
  });
  return signedIn;
}

async function earns(member: MemberId, coins: number, backend: Backend = t) {
  await backend.run((ctx) => recordReward(ctx, "T1", { member, key: `test:earned:${coins}`, xp: 0, coins, item: null, catalogueVersion: "2", at: 0 }));
}

function buyItem(caller: Caller, item = shipit, request = firstRequest) {
  return caller.mutation(api.website.commands.buyItem, { item, request });
}

async function everyTable(backend: Backend = t) {
  return backend.run(async (ctx) => {
    const tables = {} as Record<TableName, Row[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) tables[table] = await ctx.db.query(table).collect();
    return tables;
  });
}

function scheduledFunctions(backend: Backend = t) {
  return backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

async function everythingWritten(backend: Backend = t) {
  return { tables: await everyTable(backend), scheduled: await scheduledFunctions(backend) };
}

function newScheduledFunctions(before: Array<{ _id: string }>, after: Array<{ _id: string; name: string }>) {
  const earlier = new Set(before.map(({ _id }) => _id));
  return after.filter(({ _id }) => !earlier.has(_id));
}

function publishedEvents() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event);
}

async function homeRepublishesFor(user: string) {
  return (await scheduledFunctions()).filter(({ name, args: [args] }) => name === "slack/appHome:publishHome" && (args as { user?: string }).user === user);
}

async function collectionOf(member: MemberId) {
  return (await t.run((ctx) => ctx.db.query("collection").collect())).filter((row) => row.member === member).map(({ item, source }) => ({ item, source }));
}

function coinsOf(member: MemberId) {
  return t.run((ctx) => balanceOf(ctx, member));
}

const exposureTables = ["flagExposures", "analyticsIds", "analyticsOutbox", "analyticsDrain"] as const;

function withoutExposures(tables: Record<TableName, Row[]>) {
  return { ...tables, ...Object.fromEntries(exposureTables.map((table) => [table, []])) };
}

function expectOnlyTheRefusalStored(before: Awaited<ReturnType<typeof everythingWritten>>, after: Awaited<ReturnType<typeof everythingWritten>>, outcome: Row) {
  const unchanged = (tables: Record<TableName, Row[]>) => withoutExposures({ ...tables, itemPurchases: [], homeSelections: [] });
  expect(unchanged(after.tables)).toEqual(unchanged(before.tables));
  expect(after.tables.itemPurchases.slice(before.tables.itemPurchases.length)).toMatchObject([{ outcome }]);
  expect(after.tables.homeSelections.map(({ tab }) => tab)).toEqual(["inventory"]);
  expect(newScheduledFunctions(before.scheduled, after.scheduled).filter(({ name }) => !name.startsWith("analytics/"))).toEqual([]);
  expect(publishedEvents()).toEqual([]);
}

function buyButtonsInHome() {
  return publishedHomeBlocks(slack, juno.user)
    .flatMap((block) => [block.accessory?.value, ...((block as { elements?: Array<{ value?: string }> }).elements ?? []).map(({ value }) => value)])
    .filter((value): value is string => value !== undefined && value.includes("buyItem"))
    .map((value) => (JSON.parse(value) as { item: string }).item);
}

describe("website commands pass one guard", () => {
  describe("WS61 WS335 WS341: an item purchase's denial answers as a read does and writes nothing at all", () => {
    test("with the website flag off, a purchase in an open store answers closed", async () => {
      await storeShipped();
      const { asSignedIn } = await aMemberWithTheStoreOpen(100);
      await switchWebsite(t, postHog, false, ...storeFlags);
      const before = await everythingWritten();

      expect(await buyItem(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("without a session, the purchase answers signed-out", async () => {
      await storeShipped();
      const before = await everythingWritten();

      expect(await buyItem(t)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with a signed-out session, a purchase in an open store answers signed-out", async () => {
      await storeShipped();
      const { asSignedIn, sessionId } = await aMemberWithTheStoreOpen(100);
      await t.run((ctx) => ctx.db.delete(sessionId));
      const before = await everythingWritten();

      expect(await buyItem(asSignedIn)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a member who left the workspace with an open store answers not-a-member", async () => {
      await storeShipped();
      const { asSignedIn } = await aMemberWithTheStoreOpen(100);
      await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
      const before = await everythingWritten();

      expect(await buyItem(asSignedIn)).toEqual({ kind: "not-a-member" });
      expect(await everythingWritten()).toEqual(before);
    });
  });

  test("WS61 WS335: the item and the request are the only arguments, so no call names a member", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(100);
    const before = await everythingWritten();

    await expect(asSignedIn.mutation(api.website.commands.buyItem, { item: shipit, request: firstRequest, member } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
  });

  test("WS61 WS335: an item ID longer than any catalogue or custom emoji ID is rejected before the store and writes nothing", async () => {
    await storeShipped();
    const { asSignedIn } = await aMemberWithTheStoreOpen(100);
    const before = await everythingWritten();

    await expect(buyItem(asSignedIn, `custom:${"x".repeat(200)}`)).rejects.toThrow(/item/);
    expect(await everythingWritten()).toEqual(before);
  });

  test.each(["", "not-a-uuid", "website:someone:else", `${firstRequest}x`])("WS335: an item purchase's request that isn't a UUID (%j) is rejected and writes nothing", async (request) => {
    await storeShipped();
    const { asSignedIn } = await aMemberWithTheStoreOpen(100);
    const before = await everythingWritten();

    await expect(buyItem(asSignedIn, shipit, request)).rejects.toThrow(/request/);
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS62 WS335 P77: with the store's flags on, Coins open and no unlocks launch recorded, an item purchase answers refused and launches nothing", async () => {
    await storeShipped();
    const { asSignedIn } = await aMemberWithTheStoreOpen(100);
    await t.run(async (ctx) => {
      for (const launch of await ctx.db.query("unlockLaunches").collect()) await ctx.db.delete(launch._id);
    });
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: null });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS62 WS335: with achievements on, an open store and no Book launch, an item purchase answers refused and doesn't launch the Book", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(100);
    await flagsOn(...storeFlags, "achievements");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: null });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.bookLaunches).toEqual([]);
    expect(await collectionOf(member)).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
});

describe("a website command is a D17 command", { timeout: 30_000 }, () => {
  test("WS341 ST13: an item on sale is bought for its coins, and App Home's republish is scheduled", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(130);
    const republishedBefore = await homeRepublishesFor(juno.user);
    vi.mocked(publish).mockClear();

    expect(await buyItem(asSignedIn)).toEqual({ kind: "bought", item: shipit });

    expect(await collectionOf(member)).toEqual([{ item: shipit, source: "store" }]);
    expect(await coinsOf(member)).toBe(30);
    expect(publishedEvents()).toEqual([{ type: "itemBought", workspace: "T1", member, item: shipit, price: 100, at: now.getTime() }]);
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
  });

  test("WS335 ST14: the item purchase is stored under the key website:{member}:{request}", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(100);

    await buyItem(asSignedIn);

    const stored = await t.run((ctx) => ctx.db.query("itemPurchases").collect());
    expect(stored).toMatchObject([{ member, key: `website:${member}:${firstRequest}`, outcome: { kind: "bought", item: shipit } }]);
  });

  test("WS335: App Home's republished Inventory tab no longer offers the bought item", async () => {
    await storeShipped();
    const { asSignedIn } = await aMemberWithTheStoreOpen(100);
    await t.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: "Ev_TAB", user: juno.user, commands: [{ type: "showHomeTab", tab: "inventory" }] });
    await settle(t);
    expect(buyButtonsInHome()).toContain(shipit);
    const publishedBefore = slack.callsTo("views.publish").length;

    await buyItem(asSignedIn);
    await settle(t);

    expect(slack.callsTo("views.publish").length).toBeGreaterThan(publishedBefore);
    expect(buyButtonsInHome()).not.toContain(shipit);
  });

  test("WS341 ST13: with too few coins, an item is refused with the reason no-coins, storing only the refusal", async () => {
    await storeShipped();
    const { asSignedIn } = await aMemberWithTheStoreOpen(60);
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: "no-coins" });

    expectOnlyTheRefusalStored(before, await everythingWritten(), { kind: "refused", item: shipit, reason: "no-coins" });
  });

  test("WS341 ST13: an owned item is refused with the reason owned, storing only the refusal", async () => {
    await storeShipped();
    const { asSignedIn } = await aMemberWithTheStoreOpen(250);
    await buyItem(asSignedIn, shipit, secondRequest);
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: "owned" });

    expectOnlyTheRefusalStored(before, await everythingWritten(), { kind: "refused", item: shipit, reason: "owned" });
  });

  test.each([
    ["the starter", "kudos-emoji-hedgehog"],
    ["a silver tier's emoji", "kudos-emoji-ribbon"],
    ["an unknown ID", "kudos-emoji-unicorn"],
  ])("WS341 ST13: %s is refused with the reason not-for-sale, storing only the refusal", async (_, item) => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(100);
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-ribbon", source: "tier", arrivedAt: now.getTime() }));
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyItem(asSignedIn, item)).toEqual({ kind: "refused", reason: "not-for-sale" });

    expectOnlyTheRefusalStored(before, await everythingWritten(), { kind: "refused", item, reason: "not-for-sale" });
  });

  type GateRefusal = { condition: string; arrange: () => Promise<{ asSignedIn: Caller }> };

  const refusedByTheGate: GateRefusal[] = [
    { condition: "Coins not opened yet", arrange: async () => (await storeShipped(), aMemberAtLevelSix()) },
    { condition: "an open store with the store flag switched off", arrange: async () => (await storeShipped(), await aMemberWithTheStoreOpen(100).then(async (signedIn) => (await flagsOn("xp-levels", "unlocks", "coins"), signedIn))) },
    { condition: "an open store with the coins flag switched off", arrange: async () => (await storeShipped(), await aMemberWithTheStoreOpen(100).then(async (signedIn) => (await flagsOn("xp-levels", "unlocks", "store"), signedIn))) },
  ];

  test.each(refusedByTheGate)("WS335 WS341: $condition answers refused with no reason before any command and writes nothing at all", async ({ arrange }) => {
    const { asSignedIn } = await arrange();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: null });

    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS335: a refusal at the store's gate stores nothing, so the same request buys once the gate opens", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(100);
    await flagsOn("xp-levels", "unlocks", "coins");
    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: null });

    await flagsOn(...storeFlags);

    expect(await buyItem(asSignedIn)).toEqual({ kind: "bought", item: shipit });
    expect(await collectionOf(member)).toEqual([{ item: shipit, source: "store" }]);
  });

  test("WS335 ST14: a stored no-coins refusal replays after more coins arrive, and a fresh request buys", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(60);
    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: "no-coins" });

    await earns(member, 100);

    expect(await buyItem(asSignedIn)).toEqual({ kind: "refused", reason: "no-coins" });
    expect(await buyItem(asSignedIn, shipit, secondRequest)).toEqual({ kind: "bought", item: shipit });
  });

  test("WS335 WS64: buying an item on the website leaves the domain tables and events App Home's Buy leaves, besides Slack's receipt", async () => {
    const slackSide = await anOpenStoreIn(testBackend());
    await slackSide.backend.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: "Ev_BUY", user: juno.user, commands: [{ type: "buyItem", item: shipit }] });
    const fromSlack = { tables: await everyTable(slackSide.backend), events: publishedEvents() };
    vi.mocked(publish).mockClear();

    const websiteSide = await anOpenStoreIn(t);
    expect(await buyItem(websiteSide.asSignedIn)).toEqual({ kind: "bought", item: shipit });
    const fromWebsite = { tables: await everyTable(t), events: publishedEvents() };

    expect(comparable(fromWebsite, websiteSide.member)).toEqual(comparable(fromSlack, slackSide.member));
    expect(fromWebsite.events.filter(({ type }) => type === "itemBought")).toHaveLength(1);
    expect(fromWebsite.tables.collection).toHaveLength(1);
  });
});

describe("a coin spent on the website for an item is spent once", { timeout: 30_000 }, () => {
  test("WS335 ST14: the same request twice buys once, answers bought twice and spends its coins once", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(250);

    expect(await buyItem(asSignedIn)).toEqual({ kind: "bought", item: shipit });
    vi.setSystemTime(now.getTime() + 60_000);
    expect(await buyItem(asSignedIn)).toEqual({ kind: "bought", item: shipit });

    expect(await collectionOf(member)).toEqual([{ item: shipit, source: "store" }]);
    expect(await coinsOf(member)).toBe(150);
    expect(publishedEvents().filter(({ type }) => type === "itemBought")).toHaveLength(1);
  });

  test("WS335: two requests for two items with coins for one buy one", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(150);

    const answers = [await buyItem(asSignedIn, shipit, firstRequest), await buyItem(asSignedIn, partyparrot, secondRequest)];

    expect(answers).toEqual([
      { kind: "bought", item: shipit },
      { kind: "refused", reason: "no-coins" },
    ]);
    expect(await collectionOf(member)).toEqual([{ item: shipit, source: "store" }]);
    expect(await coinsOf(member)).toBe(50);
  });

  test("WS335: a website request never replays a Slack Buy whose event carries the same string", async () => {
    await storeShipped();
    const { member, asSignedIn } = await aMemberWithTheStoreOpen(250);
    await t.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: firstRequest, user: juno.user, commands: [{ type: "buyItem", item: partyparrot }] });

    expect(await buyItem(asSignedIn)).toEqual({ kind: "bought", item: shipit });
    expect((await collectionOf(member)).map(({ item }) => item).sort()).toEqual([partyparrot, shipit]);
  });
});

async function anOpenStoreIn(backend: Backend) {
  await storeShipped(backend);
  const { member, asSignedIn } = await aMemberWithTheStoreOpen(130, backend);
  return { backend, member, asSignedIn };
}

function comparable({ tables, events }: { tables: Record<TableName, Row[]>; events: unknown[] }, member: Id<"members">) {
  const domain = { ...tables, slackReceipts: [], analyticsOutbox: [], analyticsDrain: [], itemPurchases: tables.itemPurchases.map((row) => ({ ...row, key: "<key>" })) };
  return normalised({ domain, events }, member);
}

const generatedKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalised(value: unknown, member: Id<"members">): unknown {
  if (value === member) return "<member>";
  if (typeof value === "string" && generatedKey.test(value)) return "<generated key>";
  if (Array.isArray(value)) return value.map((item) => normalised(item, member));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_id" && key !== "_creationTime")
      .map(([key, field]) => [key, normalised(field, member)]),
  );
}
