import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { anIdInHalfOf, onForEveryone, onForHalf, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHomeBlocks } from "../../testing/slackInteractions";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { publish } from "../bus/publish";
import { recordReward } from "../progression/progression";
import type { PerkId } from "../progression/tree";
import { balanceOf } from "../wallet/wallet";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const treeFlags = ["xp-levels", "unlocks", "skill-tree"];
const levelFive = 600;
const levelSix = 1000;
const levelSeven = 1500;
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

async function treeShipped(...alsoOn: string[]) {
  await flagsOn(...treeFlags);
  await unlocksShippedBeforeAnyoneJoined(t);
  await flagsOn(...treeFlags, ...alsoOn);
}

async function signedInMember(backend: Backend = t) {
  const member = await aMember(backend, juno.user);
  const { asSignedIn, sessionId } = await aSignedInSession(backend, juno);
  return { member, asSignedIn, sessionId };
}

async function withXp(member: MemberId, xp: number, backend: Backend = t) {
  await backend.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    if (progress === null) await ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 });
    else await ctx.db.patch(progress._id, { xp });
  });
}

async function aMemberWithTheTreeOpen(backend: Backend = t) {
  const signedIn = await signedInMember(backend);
  await withXp(signedIn.member, levelFive, backend);
  await reachesLevel(backend, signedIn.member, 5);
  await opens(backend, signedIn.member, "skillTree");
  return signedIn;
}

async function aMemberWithTheTreeReady() {
  const signedIn = await signedInMember();
  await withXp(signedIn.member, levelFive);
  await reachesLevel(t, signedIn.member, 5);
  return signedIn;
}

function skillTree(caller: Pick<Backend, "query">) {
  return caller.query(api.website.skillTree.getSkillTree, {});
}

async function unlocksOnForTheWorkspaceAndOffFor(member: MemberId) {
  const workspaceKey = await anIdInHalfOf("unlocks", true);
  const analyticsId = await anIdInHalfOf("unlocks", false);
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("workspaceKeys").collect()) await ctx.db.patch(row._id, { workspaceKey });
    for (const row of await ctx.db.query("analyticsIds").collect()) if (row.member === member) await ctx.db.patch(row._id, { analyticsId });
  });
  postHog.withFlags(onForHalf("unlocks"), ...["website", "xp-levels", "skill-tree"].map(onForEveryone));
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
}

function buyPerk(caller: Caller, perk: PerkId = "spark", request = firstRequest) {
  return caller.mutation(api.website.commands.buyPerk, { perk, request });
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

function perksOwnedBy(member: MemberId) {
  return t.run((ctx) =>
    ctx.db
      .query("perksOwned")
      .withIndex("by_member_perk", (q) => q.eq("member", member))
      .collect(),
  );
}

async function skillPointsOf(member: MemberId) {
  return (await t.query(internal.progression.perks.perksOf, { member }))?.skillPoints;
}

const exposureTables = ["flagExposures", "analyticsIds", "analyticsOutbox", "analyticsDrain"] as const;

function withoutExposures(tables: Record<TableName, Row[]>) {
  return { ...tables, ...Object.fromEntries(exposureTables.map((table) => [table, []])) };
}

describe("website commands pass one guard", () => {
  describe("WS61 WS88: a purchase's denial answers as a read does and writes nothing at all", () => {
    test("with the website flag off, an open tree's purchase answers closed", async () => {
      await treeShipped();
      const { asSignedIn } = await aMemberWithTheTreeOpen();
      await switchWebsite(t, postHog, false, ...treeFlags);
      const before = await everythingWritten();

      expect(await buyPerk(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with a flags key but no workspace key yet, the purchase answers closed and makes no key", async () => {
      postHog.withFlags({ key: "website", filters: { groups: [{ properties: [], rollout_percentage: 100 }] } });
      await t.action(components.posthog.lib.refreshFlagDefinitions, {});
      await aMember(t, juno.user);
      const { asSignedIn } = await aSession(t, juno);
      const before = await everythingWritten();

      expect(await buyPerk(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everythingWritten()).toEqual(before);
      expect(before.tables.workspaceKeys).toEqual([]);
    });

    test("without a session, the purchase answers signed-out", async () => {
      await treeShipped();
      const before = await everythingWritten();

      expect(await buyPerk(t)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("with a signed-out session, an open tree's purchase answers signed-out", async () => {
      await treeShipped();
      const { asSignedIn, sessionId } = await aMemberWithTheTreeOpen();
      await t.run((ctx) => ctx.db.delete(sessionId));
      const before = await everythingWritten();

      expect(await buyPerk(asSignedIn)).toEqual({ kind: "signed-out" });
      expect(await everythingWritten()).toEqual(before);
    });

    test("a member who left the workspace with an open tree answers not-a-member", async () => {
      await treeShipped();
      const { asSignedIn } = await aMemberWithTheTreeOpen();
      await memberChanged(t, "user_change", { id: juno.user, team_id: "T1", deleted: true });
      const before = await everythingWritten();

      expect(await buyPerk(asSignedIn)).toEqual({ kind: "not-a-member" });
      expect(await everythingWritten()).toEqual(before);
    });
  });

  test("WS61 WS88: the perk and the request are the only arguments, so no call names a member", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    const before = await everythingWritten();

    await expect(asSignedIn.mutation(api.website.commands.buyPerk, { perk: "spark", request: firstRequest, member } as never)).rejects.toThrow(/member/);
    expect(await everythingWritten()).toEqual(before);
  });

  test.each(["", "not-a-uuid", "website:someone:else", `${firstRequest}x`])("WS88: a request that isn't a UUID (%j) is rejected and writes nothing", async (request) => {
    await treeShipped();
    const { asSignedIn } = await aMemberWithTheTreeOpen();
    const before = await everythingWritten();

    await expect(buyPerk(asSignedIn, "spark", request)).rejects.toThrow(/request/);
    expect(await everythingWritten()).toEqual(before);
  });
});

describe("a website command never launches unlocks", () => {
  test("WS62 WS88 P77: with xp-levels, unlocks and skill-tree on and no launch recorded, the purchase answers refused and launches nothing", async () => {
    await flagsOn(...treeFlags);
    const { asSignedIn } = await signedInMember();
    const before = await everythingWritten();

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "refused", reason: null });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.unlockLaunches).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS62 WS88 P91: with quests on, an open tree and no Journey launch, the purchase answers refused and neither launches the Journey nor joins anyone", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await flagsOn(...treeFlags, "quests");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "refused", reason: null });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.journeyLaunches).toEqual([]);
    expect(await perksOwnedBy(member)).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS62 WS88: with achievements on, an open tree and no Book launch, the purchase answers refused and doesn't launch the Book", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await flagsOn(...treeFlags, "achievements");
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "refused", reason: null });
    expect(await everythingWritten()).toEqual(before);
    expect(before.tables.bookLaunches).toEqual([]);
    expect(await perksOwnedBy(member)).toEqual([]);
    expect(publishedEvents()).toEqual([]);
  });
});

describe("a website command is a D17 command", () => {
  test("WS88: an available perk is bought for its skill point, and App Home's republish is scheduled", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    const republishedBefore = await homeRepublishesFor(juno.user);
    vi.mocked(publish).mockClear();

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "bought" });

    expect(await perksOwnedBy(member)).toMatchObject([{ perk: "spark", boughtAt: now.getTime() }]);
    expect(await skillPointsOf(member)).toBe(0);
    expect(publishedEvents()).toEqual([{ type: "perkBought", workspace: "T1", member, perk: "spark", at: now.getTime() }]);
    expect(await homeRepublishesFor(juno.user)).toHaveLength(republishedBefore.length + 1);
  });

  test("WS88: the purchase is stored under the key website:{member}:{request}", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();

    await buyPerk(asSignedIn);

    const stored = await t.run((ctx) => ctx.db.query("perkPurchases").collect());
    expect(stored).toMatchObject([{ member, key: `website:${member}:${firstRequest}`, outcome: { kind: "bought", perk: "spark" } }]);
  });

  test("WS88: App Home's republished Skill tree tab shows the perk owned", async () => {
    await treeShipped();
    const { asSignedIn } = await aMemberWithTheTreeOpen();
    await t.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: "Ev_TAB", user: juno.user, commands: [{ type: "showHomeTab", tab: "skillTree" }] });
    await settle(t);
    expect(buyButtonsInHome()).toContain("spark");
    const publishedBefore = slack.callsTo("views.publish").length;

    await buyPerk(asSignedIn);
    await settle(t);

    expect(slack.callsTo("views.publish").length).toBeGreaterThan(publishedBefore);
    expect(buyButtonsInHome()).not.toContain("spark");
    expect(publishedHomeBlocks(slack, juno.user).map((block) => JSON.stringify(block)).join("\n")).toMatch(/Spark/);
  });

  test("WS88: an owned perk is refused with the reason owned, storing only the refusal", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await withXp(member, levelSix);
    await reachesLevel(t, member, 6);
    await buyPerk(asSignedIn, "spark", secondRequest);
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "refused", reason: "owned" });

    expectOnlyTheRefusalStored(before, await everythingWritten(), { kind: "refused", perk: "spark", reason: "owned" });
  });

  test("WS88: with no skill points left, a perk is refused with the reason points, storing only the refusal", async () => {
    await treeShipped();
    const { asSignedIn } = await aMemberWithTheTreeOpen();
    await buyPerk(asSignedIn, "spark", secondRequest);
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyPerk(asSignedIn, "rhythm")).toEqual({ kind: "refused", reason: "points" });

    expectOnlyTheRefusalStored(before, await everythingWritten(), { kind: "refused", perk: "rhythm", reason: "no-skill-points" });
  });

  type GateRefusal = { condition: string; arrange: () => Promise<{ asSignedIn: Caller }> };

  const refusedByTheGate: GateRefusal[] = [
    { condition: "a ready Skill tree the member hasn't opened", arrange: async () => (await treeShipped(), aMemberWithTheTreeReady()) },
    { condition: "a Skill tree still locked at level 1", arrange: async () => (await treeShipped(), signedInMember()) },
    { condition: "an open tree with skill-tree switched off", arrange: async () => (await treeShipped(), await aMemberWithTheTreeOpen().then(async (signedIn) => (await flagsOn("xp-levels", "unlocks"), signedIn))) },
    { condition: "an open tree with unlocks switched off", arrange: async () => (await treeShipped(), await aMemberWithTheTreeOpen().then(async (signedIn) => (await flagsOn("xp-levels", "skill-tree"), signedIn))) },
    { condition: "an open tree with xp-levels switched off", arrange: async () => (await treeShipped(), await aMemberWithTheTreeOpen().then(async (signedIn) => (await flagsOn("unlocks", "skill-tree"), signedIn))) },
  ];

  test.each(refusedByTheGate)("WS88: $condition answers refused with no reason before any command and writes nothing at all", async ({ arrange }) => {
    const { asSignedIn } = await arrange();
    const before = await everythingWritten();
    vi.mocked(publish).mockClear();

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "refused", reason: null });

    expect(await everythingWritten()).toEqual(before);
    expect(publishedEvents()).toEqual([]);
  });

  test("WS88: a refusal at the gate stores nothing, so the same request buys once the gate opens", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await flagsOn("xp-levels", "unlocks");
    expect(await buyPerk(asSignedIn)).toEqual({ kind: "refused", reason: null });

    await flagsOn(...treeFlags);

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "bought" });
    expect(await perksOwnedBy(member)).toMatchObject([{ perk: "spark" }]);
  });

  test("WS88 P19: a stored refusal replays with its reason after a level up, and a fresh request buys", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await buyPerk(asSignedIn, "spark", secondRequest);
    expect(await buyPerk(asSignedIn, "rhythm")).toEqual({ kind: "refused", reason: "points" });

    await withXp(member, levelSix);
    await reachesLevel(t, member, 6);

    expect(await buyPerk(asSignedIn, "rhythm")).toEqual({ kind: "refused", reason: "points" });
    expect(await buyPerk(asSignedIn, "rhythm", "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f")).toEqual({ kind: "bought" });
  });

  test("WS89 WS64: buying on the website leaves the domain tables and events App Home's Buy leaves, besides Slack's receipt", async () => {
    const slackSide = await anOpenTreeIn(testBackend());
    await slackSide.backend.mutation(internal.slack.receipts.receiveHomeClick, {
      workspace: "T1",
      eventId: "Ev_BUY",
      user: juno.user,
      commands: [{ type: "buyPerk", perk: "spark" }],
    });
    const fromSlack = { tables: await everyTable(slackSide.backend), events: publishedEvents() };
    vi.mocked(publish).mockClear();

    const websiteSide = await anOpenTreeIn(t);
    expect(await buyPerk(websiteSide.asSignedIn)).toEqual({ kind: "bought" });
    const fromWebsite = { tables: await everyTable(t), events: publishedEvents() };

    expect(comparable(fromWebsite, websiteSide.member)).toEqual(comparable(fromSlack, slackSide.member));
    expect(fromWebsite.events.filter(({ type }) => type === "perkBought")).toHaveLength(1);
    expect(fromWebsite.tables.perksOwned).toHaveLength(1);
  });
});

describe("a skill point bought on the website is spent once", () => {
  test("WS87 WS88 P19: the same request twice buys once and answers bought twice", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await withXp(member, levelSix);
    await reachesLevel(t, member, 6);
    expect(await skillPointsOf(member)).toBe(2);

    expect(await buyPerk(asSignedIn)).toEqual({ kind: "bought" });
    vi.setSystemTime(now.getTime() + 60_000);
    expect(await buyPerk(asSignedIn)).toEqual({ kind: "bought" });

    expect(await perksOwnedBy(member)).toMatchObject([{ perk: "spark", boughtAt: now.getTime() }]);
    expect(await skillPointsOf(member)).toBe(1);
    expect(publishedEvents().filter(({ type }) => type === "perkBought")).toHaveLength(1);
  });

  test("WS88: two requests for two perks with one skill point buy one", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();

    const answers = [await buyPerk(asSignedIn, "spark", firstRequest), await buyPerk(asSignedIn, "rhythm", secondRequest)];

    expect(answers).toEqual([{ kind: "bought" }, { kind: "refused", reason: "points" }]);
    expect(await perksOwnedBy(member)).toMatchObject([{ perk: "spark" }]);
    expect(await skillPointsOf(member)).toBe(0);
  });

  test("WS88: a website request never replays a Slack Buy whose event carries the same string", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await withXp(member, levelSix);
    await reachesLevel(t, member, 6);
    await t.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: firstRequest, user: juno.user, commands: [{ type: "buyPerk", perk: "spark" }] });

    expect(await buyPerk(asSignedIn, "rhythm")).toEqual({ kind: "bought" });
    expect((await perksOwnedBy(member)).map(({ perk }) => perk).sort()).toEqual(["rhythm", "spark"]);
  });
});

describe("CO14 CO24: a coin perk bought from the website", () => {
  test("with coins shown and Coins not opened yet, a request for flame is refused, stores coins-not-open and spends nothing", async () => {
    await treeShipped("coins");
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await withXp(member, levelSeven);
    await reachesLevel(t, member, 7);
    expect(await buyPerk(asSignedIn, "spark")).toEqual({ kind: "bought" });
    vi.mocked(publish).mockClear();
    const before = await everythingWritten();

    expect(await buyPerk(asSignedIn, "flame", secondRequest)).toEqual({ kind: "refused", reason: null });
    expectOnlyTheRefusalStored(before, await everythingWritten(), { kind: "refused", perk: "flame", reason: "coins-not-open" });
  });
});

describe("CO24 CO30: a purchase spends once per idempotency key", () => {
  test("the same website request twice buys flame once, answers bought both times and spends its coins once", async () => {
    await treeShipped("coins");
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await withXp(member, levelSeven);
    await reachesLevel(t, member, 7);
    await opens(t, member, "coins");
    await buyPerk(asSignedIn, "spark");
    await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins: 300, item: null, catalogueVersion: "2", at: 0 }));

    expect(await buyPerk(asSignedIn, "flame", secondRequest)).toEqual({ kind: "bought" });
    expect(await buyPerk(asSignedIn, "flame", secondRequest)).toEqual({ kind: "bought" });

    expect(await t.run((ctx) => balanceOf(ctx, member))).toBe(150);
    expect((await t.run((ctx) => ctx.db.query("coinSpends").collect())).map(({ coins, for: paidFor }) => ({ coins, for: paidFor }))).toEqual([{ coins: 150, for: { perk: "flame" } }]);
    expect(await skillPointsOf(member)).toBe(1);
  });
});

function buyButtonsInHome() {
  return publishedHomeBlocks(slack, juno.user)
    .map((block) => block.accessory?.value)
    .filter((value): value is string => value !== undefined && value.includes("buyPerk"))
    .map((value) => (JSON.parse(value) as { perk: string }).perk);
}

function expectOnlyTheRefusalStored(before: Awaited<ReturnType<typeof everythingWritten>>, after: Awaited<ReturnType<typeof everythingWritten>>, outcome: Row) {
  const unchanged = (tables: Record<TableName, Row[]>) => withoutExposures({ ...tables, perkPurchases: [], homeSelections: [] });
  expect(unchanged(after.tables)).toEqual(unchanged(before.tables));
  expect(after.tables.perkPurchases.slice(before.tables.perkPurchases.length)).toMatchObject([{ outcome }]);
  expect(after.tables.homeSelections.map(({ tab }) => tab)).toEqual(["skillTree"]);
  expect(newScheduledFunctions(before.scheduled, after.scheduled).filter(({ name }) => !name.startsWith("analytics/"))).toEqual([]);
  expect(publishedEvents()).toEqual([]);
}

async function anOpenTreeIn(backend: Backend) {
  await switchWebsite(backend, postHog, true, ...treeFlags);
  await unlocksShippedBeforeAnyoneJoined(backend);
  const { member, asSignedIn } = await aMemberWithTheTreeOpen(backend);
  return { backend, member, asSignedIn };
}

function comparable({ tables, events }: { tables: Record<TableName, Row[]>; events: unknown[] }, member: Id<"members">) {
  const domain = { ...tables, slackReceipts: [], analyticsOutbox: [], analyticsDrain: [], perkPurchases: tables.perkPurchases.map((row) => ({ ...row, key: "<key>" })) };
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

describe("F26 F27 F28 F29: a member previews the website by their own decision", () => {
  test("F27: a member whose own unlocks decision is off, while the workspace's is on, reads no Skill tree, and their purchase answers refused with no reason and writes nothing at all", async () => {
    await treeShipped();
    const { member, asSignedIn } = await aMemberWithTheTreeOpen();
    await unlocksOnForTheWorkspaceAndOffFor(member);
    const before = await everythingWritten();

    expect(await skillTree(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await buyPerk(asSignedIn)).toEqual({ kind: "refused", reason: null });
    expect(await everythingWritten()).toEqual(before);
  });
});
