import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import { withoutExposureOf } from "../../testing/hoggies";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aMember, aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { recordReward } from "../progression/progression";
import { openUnlock } from "../unlocks/unlocks";
import schema from "../schema";

const theCrateStore = vi.hoisted(() => ({ removed: false }));

vi.mock("../hoggies/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/flag")>();
  return {
    ...actual,
    crateStoreShownTo: vi.fn((...args: Parameters<typeof actual.crateStoreShownTo>) => (theCrateStore.removed ? Promise.resolve(false) : actual.crateStoreShownTo(...args))),
    crateStoreOpenFor: vi.fn((...args: Parameters<typeof actual.crateStoreOpenFor>) => (theCrateStore.removed ? Promise.resolve(false) : actual.crateStoreOpenFor(...args))),
  };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const form = { contentType: "application/x-www-form-urlencoded" };
const crateStore = "crate-store";
const everyOtherFlag = ["xp-levels", "unlocks", "achievements", "everyone-board", "coins", "collection", "website"];
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const levelSix = 1000;

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let namedIds = new Map<string, string>();
let steps = 0;

beforeEach(() => {
  theCrateStore.removed = false;
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  freshFakes();
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const crateStoreOff: Array<{ condition: string; crateStoreFlag: FlagDefinition[]; turnOff?: () => void }> = [
  { condition: "with crate-store off", crateStoreFlag: [offForEveryone(crateStore)] },
  { condition: "while PostHog has no crate-store flag", crateStoreFlag: [] },
  { condition: "without the flags key, even when PostHog turned crate-store on", crateStoreFlag: [onForEveryone(crateStore)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while crate-store is on in the sandbox and for the product owner's email only", crateStoreFlag: [asTheShipCreatesIt()], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
];

describe("CL31: the crate store is dark where crate-store is off, sells only to the members it is on for, and only a purchase exposes it", { timeout: 120_000 }, () => {
  test.each(crateStoreOff)("$condition, a walk buying and opening crates in Slack and on the website leaves what the same walk leaves without the crate store, apart from the flag's own exposure", async ({ crateStoreFlag, turnOff }) => {
    theCrateStore.removed = true;
    const withoutTheCrateStore = await walkIn(await aliceAndBobWithCoins(crateStoreFlag, turnOff));
    freshFakes();
    theCrateStore.removed = false;

    const walk = await walkIn(await aliceAndBobWithCoins(crateStoreFlag, turnOff));

    expect(walk).toEqual(withoutTheCrateStore);
    expect(JSON.stringify([walk.answers, walk.homes])).not.toMatch(/bought|Buy a crate|crateStore/);
  });

  test("with crate-store on, the same walk buys each member one crate in Slack and one on the website, and opens both", async () => {
    const walk = await walkIn(await aliceAndBobWithCoins([onForEveryone(crateStore)]));

    for (const { user } of [alice, bob]) {
      expect(walk.answers[user]!.buys).toEqual([
        { kind: "bought", crate: "bought:2" },
        { kind: "bought", crate: "bought:2" },
      ]);
      expect(walk.answers[user]!.open).toMatchObject({ kind: "opened", drop: { isNew: expect.any(Boolean) } });
      expect(walk.answers[user]!.collection).toMatchObject({ bought: [], crateStore: { price: 50, next: 3 } });
      expect(walk.homes[user]!.join("\n")).toContain("Buy a crate · 50 🪙");
    }
    expect(walk.tables.coinSpends.map(({ coins, for: paidFor }) => ({ coins, paidFor }))).toEqual([
      { coins: 50, paidFor: { crate: "bought:1" } },
      { coins: 50, paidFor: { crate: "bought:1" } },
      { coins: 50, paidFor: { crate: "bought:2" } },
      { coins: 50, paidFor: { crate: "bought:2" } },
    ]);
  });

  test("with crate-store on for one member's email only, only that member buys, and every other member's Slack calls and reads equal those with it off", async () => {
    const off = await walkIn(await aliceAndBobWithCoins([offForEveryone(crateStore)]));
    freshFakes();

    const onForAlice = await walkIn(await aliceAndBobWithCoins([onForEmails(crateStore, alice.email)]));

    expect(onForAlice.homes.U_BOB).toEqual(off.homes.U_BOB);
    expect(onForAlice.answers.U_BOB).toEqual(off.answers.U_BOB);
    expect(onForAlice.slackCallsTo.U_BOB).toEqual(off.slackCallsTo.U_BOB);
    expect(onForAlice.homes.U_ALICE).not.toEqual(off.homes.U_ALICE);
    expect(onForAlice.answers.U_ALICE).not.toEqual(off.answers.U_ALICE);
    expect(onForAlice.tables.boughtCrates.map(({ member }) => member)).toEqual(["<member U_ALICE>", "<member U_ALICE>"]);
  });

  test("crate-store's exposure is sent once per member and value, only by a purchase in Slack or on the website, never by App Home or the Book's collection", async () => {
    t = await aliceAndBobWithCoins([onForEveryone(crateStore)]);
    namedIds = await idsNamedByTheirMember();
    for (const member of [alice, bob]) {
      await openHome(member.user);
      await (await signedIn(member)).query(api.website.collection.getCollection, {});
    }
    await settleInTimeOrder(t);
    expect(crateStoreExposures()).toEqual({});

    await clickInSlack(alice.user, { type: "buyCrate", next: 1 });
    await clickInSlack(alice.user, { type: "buyCrate", next: 1 });
    await (await signedIn(bob)).mutation(api.website.commands.buyCrate, { next: 1 });
    await settleInTimeOrder(t);

    expect(crateStoreExposures()).toEqual({ [await analyticsIdOf(alice.user)]: [true], [await analyticsIdOf(bob.user)]: [true] });
  });
});

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: crateStore,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

async function aliceAndBobWithCoins(crateStoreFlag: FlagDefinition[], turnOff?: () => void): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  steps = 0;
  t = await testBackendServing(postHog, ...everyOtherFlag.map(onForEveryone), ...crateStoreFlag);
  turnOff?.();
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await bookShippedBeforeAnyoneJoined(t);
  for (const { user } of [alice, bob]) {
    const member = await aMember(t, user);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: levelSix, pointsSpent: 0 }));
    await reachesLevel(t, member, 6);
    for (const feature of ["book", "coins"] as const) await t.run((ctx) => openUnlock(ctx, member, feature, "slack"));
    await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:earned:120", xp: 0, coins: 120, item: null, catalogueVersion: "2", at: 0 }));
  }
  await settleInTimeOrder(t);
  return t;
}

async function walkIn(backend: Backend) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of [alice, bob]) {
    await openHome(user);
    await clickInSlack(user, { type: "buyCrate", next: 1 });
    await clickInSlack(user, { type: "buyCrate", next: 1 });
    await clickInSlack(user, { type: "openCrate", crate: "bought:1" });
  }
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  for (const member of [alice, bob]) answers[member.user] = await onTheWebsite(member);
  for (const { user } of [alice, bob]) await openHome(user);
  return {
    homes: Object.fromEntries([alice, bob].map(({ user }) => [user, publishedHome(slack, user)])),
    answers,
    slackCallsTo: Object.fromEntries([alice, bob].map(({ user }) => [user, slackCallsAbout(user)])),
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    productEvents: orderFree(withStableIds(postHog.productEvents().filter(({ properties }) => properties.$feature_flag !== crateStore).map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsWritten(),
  } satisfies Record<string, unknown>;
}

async function onTheWebsite(identity: { user: string; name: string }) {
  nextStep();
  const asSignedIn = await signedIn(identity);
  const buys = [await asSignedIn.mutation(api.website.commands.buyCrate, { next: 2 }), await asSignedIn.mutation(api.website.commands.buyCrate, { next: 2 })];
  const open = await asSignedIn.mutation(api.website.commands.openCrate, { crate: "bought:2" });
  await settleInTimeOrder(t);
  const collection = withStableIds(await asSignedIn.query(api.website.collection.getCollection, {}));
  return { buys, open, collection };
}

async function signedIn(identity: { user: string; name: string }) {
  const session = await aSignedInSession(t, identity).catch(() => aSession(t, { user: identity.user, name: identity.name }));
  return session.asSignedIn;
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const convexTestId = /^\d+[a-zA-Z]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const positioned = new Set(["cursor", "seen", "eventId", "position"]);

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid") return undefined;
    if (positioned.has(key) && field !== null) return "<position>";
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (convexTestId.test(field)) return stable("document", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

type TableName = keyof typeof schema.tables;

async function rowsWritten() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  const written = withStableIds(withoutExposureOf(crateStore, tables));
  return Object.fromEntries(Object.entries(written).map(([table, rows]) => [table, orderFree(rows)])) as typeof written;
}

async function idsNamedByTheirMember() {
  const named = new Map<string, string>();
  for (const { user } of [alice, bob]) {
    const member = await memberOf(user);
    named.set(member, `<member ${user}>`);
    const analytics = await t.run((ctx) =>
      ctx.db
        .query("analyticsIds")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique(),
    );
    if (analytics !== null) named.set(analytics.analyticsId, `<analytics ID of ${user}>`);
  }
  return named;
}

function slackCallsAbout(user: string) {
  return slack.calls
    .filter((call) => JSON.stringify(call).includes(user))
    .map((call) => JSON.stringify(call))
    .sort();
}

function crateStoreExposures() {
  const exposures = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === crateStore);
  const asPostHogKeepsThem = new Map(exposures.map((exposure) => [exposure.uuid, exposure]));
  const byMember: Record<string, unknown[]> = {};
  for (const { distinct_id, properties } of asPostHogKeepsThem.values()) (byMember[distinct_id] ??= []).push(properties.$feature_flag_response);
  return byMember;
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(tuesday + steps * minuteMs);
}

async function clickInSlack(user: string, command: { type: "buyCrate"; next: number } | { type: "openCrate"; crate: string }) {
  nextStep();
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, staleButtonOf(command)), form));
  await settleInTimeOrder(t);
}

async function openHome(user: string) {
  nextStep();
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
}

async function memberOf(user: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}

async function analyticsIdOf(user: string) {
  const member = await memberOf(user);
  const row = await t.run((ctx) =>
    ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique(),
  );
  return row!.analyticsId;
}

function freshFakes() {
  slack = new FakeSlack().withMember(alice.user, { profile: { email: alice.email } }).withMember(bob.user, { profile: { email: bob.email } });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}
