import type { FunctionReturnType } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, flagsKey, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import { withoutCollectionExposure } from "../../testing/hoggies";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Quest } from "../quests/step";
import schema from "../schema";
import type { Feature } from "../unlocks/feature";

const theCollection = vi.hoisted(() => ({ removed: false }));

vi.mock("../hoggies/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/flag")>();
  return {
    ...actual,
    hoggiesShownTo: vi.fn((...args: Parameters<typeof actual.hoggiesShownTo>) => (theCollection.removed ? Promise.resolve(false) : actual.hoggiesShownTo(...args))),
    hoggiesDropFor: vi.fn((...args: Parameters<typeof actual.hoggiesDropFor>) => (theCollection.removed ? Promise.resolve(false) : actual.hoggiesDropFor(...args))),
  };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const form = { contentType: "application/x-www-form-urlencoded" };
const collection = "collection";
const everyOtherFlag = ["xp-levels", "unlocks", "quests", "everyone-board", "achievements", "activity"];
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const firstThanks: Quest = { kind: "journey", step: "first-thanks" };
const anUndrawnWeeklyQuest: Quest = { kind: "weekly", week: "2026-10-12", slot: 0 };
const opensOf = { [alice.user]: { inSlack: "book", onTheWebsite: "leaderboard" }, [bob.user]: { inSlack: "leaderboard", onTheWebsite: "book" } } satisfies Record<string, { inSlack: Feature; onTheWebsite: Feature }>;

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  theCollection.removed = false;
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

type CollectionOff = { condition: string; collection: FlagDefinition[]; turnOff?: () => void };

const collectionOff: CollectionOff[] = [
  { condition: "with collection off", collection: [offForEveryone(collection)] },
  { condition: "while PostHog has no collection flag", collection: [] },
  { condition: "without the flags key, even when PostHog turned collection on", collection: [onForEveryone(collection)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while collection is on in the sandbox and for the product owner's email only", collection: [asTheShipCreatesIt()], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
];

describe("CL18: the collection is dark where collection is off, drops only for the members it is on for, and only a first open exposes it", { timeout: 120_000 }, () => {
  test.each(collectionOff)("$condition, a walk through crates opened in Slack and on the website leaves what the same walk leaves without the collection, apart from the flag's own exposure", async ({ collection, turnOff }) => {
    theCollection.removed = true;
    const withoutTheCollection = await walkIn(await aliceAndBobAtLevelFour(collection, turnOff));
    freshFakes();
    theCollection.removed = false;

    const walk = await walkIn(await aliceAndBobAtLevelFour(collection, turnOff));

    expect(walk).toEqual(withoutTheCollection);
    expect(JSON.stringify(walk.answers)).not.toMatch(/"drop"|"found"/);
    expect(walk.answers.U_ALICE!.collection).not.toMatchObject({ kind: "collection" });
    expect(walk.tables.drops).toEqual([]);
  });

  test("with collection on, the same walk drops a hoggie for every crate opened and shows them", async () => {
    const walk = await walkIn(await aliceAndBobAtLevelFour([onForEveryone(collection)]));

    expect(walk.tables.drops).toHaveLength(6);
    expect(walk.answers.U_ALICE!.opens).toEqual([expect.objectContaining({ drop: expect.objectContaining({ copy: expect.any(Number) }) }), expect.objectContaining({ drop: expect.objectContaining({ copy: expect.any(Number) }) })]);
    expect(walk.homes.U_ALICE!.join("\n")).toContain("Hoggies: ");
    expect(JSON.stringify(walk.answers.U_ALICE!.activity)).toContain('"kind":"found"');
  });

  test("with collection on for one member's email only, only that member's opens drop, and every other member's Slack calls and reads equal those with it off", async () => {
    const off = await walkIn(await aliceAndBobAtLevelFour([offForEveryone(collection)]));
    freshFakes();

    const onForAlice = await walkIn(await aliceAndBobAtLevelFour([onForEmails(collection, alice.email)]));

    expect(onForAlice.dropsOf).toEqual({ U_ALICE: 3, U_BOB: 0 });
    expect(onForAlice.homes.U_BOB).toEqual(off.homes.U_BOB);
    expect(onForAlice.answers.U_BOB).toEqual(off.answers.U_BOB);
    expect(onForAlice.slackCallsTo.U_BOB).toEqual(off.slackCallsTo.U_BOB);
    expect(onForAlice.homes.U_ALICE).not.toEqual(off.homes.U_ALICE);
  });
  test("collection's exposure is sent once per member and value, only by a crate's first successful open, never by a refused open, App Home, the activity or the Book", async () => {
    t = await aliceAndBobAtLevelFour([onForEveryone(collection)], undefined, websiteOpen);
    await hoggiesAliceSees();
    await openInSlack(alice.user, { type: "openUnlock", feature: "coins" });
    await openInSlack(alice.user, { type: "openQuestCrate", quest: anUndrawnWeeklyQuest });
    const asAlice = await signedIn(alice);
    expect(await asAlice.mutation(api.website.commands.openFeature, { feature: "coins" })).toEqual({ kind: "refused" });
    expect(await asAlice.mutation(api.website.commands.openQuestCrate, { quest: anUndrawnWeeklyQuest })).toEqual({ kind: "refused" });
    await settleInTimeOrder(t);
    expect(collectionExposures()).toEqual({});

    await openInSlack(alice.user, { type: "openUnlock", feature: "book" });
    await openInSlack(alice.user, { type: "openUnlock", feature: "book" });
    await openInSlack(alice.user, { type: "openQuestCrate", quest: firstThanks });
    await hoggiesAliceSees();
    await flagsFromPostHog(t, postHog, ...everyFlagWith(offForEveryone(collection), ...websiteOpen));
    await openInSlack(alice.user, { type: "openUnlock", feature: "leaderboard" });
    await openInSlack(bob.user, { type: "openUnlock", feature: "coins" });
    expect(collectionExposures()).toEqual({ [await analyticsIdOf(alice.user)]: [true, false] });
    await openInSlack(bob.user, { type: "openQuestCrate", quest: firstThanks });
    await flagsFromPostHog(t, postHog, ...everyFlagWith(onForEveryone(collection), ...websiteOpen));
    await openInSlack(bob.user, { type: "openUnlock", feature: "leaderboard" });
    await hoggiesAliceSees();

    expect(collectionExposures()).toEqual({ [await analyticsIdOf(alice.user)]: [true, false], [await analyticsIdOf(bob.user)]: [false, true] });
  });
});

describe("CL11: turning collection off hides every hoggie and takes nothing away; on again shows the same", { timeout: 120_000 }, () => {
  test.each(turningOff)("with $state, App Home, the Book's collection and the activity show no hoggie and every drop stays as it was, and on again every hoggie shows as before", async ({ off, on }) => {
    t = await aliceAndBobAtLevelFour([onForEveryone(collection)], undefined, websiteOpen);
    await openInSlack(alice.user, { type: "openUnlock", feature: "book" });
    await openInSlack(alice.user, { type: "openQuestCrate", quest: firstThanks });
    const shownWhileOn = await hoggiesAliceSees();
    const dropsWhileOn = await dropRows();
    expect(shownWhileOn.line).toEqual([expect.stringContaining("Hoggies: 2 of 151")]);
    expect(shownWhileOn.found).toHaveLength(2);

    await off();
    const shownWhileOff = await hoggiesAliceSees();

    expect(shownWhileOff).toEqual({ line: [], collection: expect.not.objectContaining({ kind: "collection" }), found: [] });
    expect(await dropRows()).toEqual(dropsWhileOn);

    await on();
    expect(await hoggiesAliceSees()).toEqual(shownWhileOn);
    expect(await dropRows()).toEqual(dropsWhileOn);
  });

  test.each(turningOff.filter(({ unlocksStayOn }) => unlocksStayOn))("with $state, a crate opened in Slack meanwhile never drops, also when it is opened again once collection is on", async ({ off, on }) => {
    t = await aliceAndBobAtLevelFour([onForEveryone(collection)], undefined, websiteOpen);
    await openInSlack(alice.user, { type: "openUnlock", feature: "book" });
    const dropsWhileOn = await dropRows();

    await off();
    await openInSlack(alice.user, { type: "openUnlock", feature: "leaderboard" });
    await on();
    await openInSlack(alice.user, { type: "openUnlock", feature: "leaderboard" });

    expect(await (await signedIn(alice)).mutation(api.website.commands.openFeature, { feature: "leaderboard" })).toEqual({ kind: "opened", drop: null });
    expect(await dropRows()).toEqual(dropsWhileOn);
  });
});


let t: Backend;
let namedIds = new Map<string, string>();

const everyFlagAnd = (collectionFlag: FlagDefinition) => () => flagsFromPostHog(t, postHog, ...everyFlagWith(collectionFlag, ...websiteOpen));

const turningOff = [
  { state: "collection off", off: everyFlagAnd(offForEveryone(collection)), on: everyFlagAnd(onForEveryone(collection)), unlocksStayOn: true },
  { state: "collection missing in PostHog", off: () => flagsFromPostHog(t, postHog, ...everyFlagWith(...websiteOpen)), on: everyFlagAnd(onForEveryone(collection)), unlocksStayOn: true },
  { state: "the flags key unset", off: async () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", ""), on: async () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey), unlocksStayOn: false },
];
let walkCollection: FlagDefinition[] = [];

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: collection,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

function everyFlagWith(...collectionFlag: FlagDefinition[]) {
  return [...everyOtherFlag.map(onForEveryone), ...collectionFlag];
}

const websiteOpen = [onForEveryone("website")];

async function aliceAndBobAtLevelFour(collectionFlag: FlagDefinition[], turnOff?: () => void, alsoOn: FlagDefinition[] = []): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  sentMessages = 0;
  walkCollection = [...collectionFlag, ...alsoOn];
  t = await testBackendServing(postHog, ...everyFlagWith(...walkCollection));
  turnOff?.();
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await bookShippedBeforeAnyoneJoined(t);
  await journeyShippedBeforeAnyoneJoined(t);
  await giveKudos(alice.user, bob.user);
  await giveKudos(bob.user, alice.user);
  for (const { user } of [alice, bob]) await reachLevelFour(user);
  return t;
}

async function walkIn(backend: Backend) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of [alice, bob]) {
    await openHome(user);
    await openInSlack(user, { type: "openUnlock", feature: opensOf[user]!.inSlack });
    await openInSlack(user, { type: "openQuestCrate", quest: firstThanks });
    await openInSlack(user, { type: "openQuestCrate", quest: firstThanks });
  }
  await flagsFromPostHog(t, postHog, ...everyFlagWith(...walkCollection), onForEveryone("website"));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  for (const member of [alice, bob]) answers[member.user] = await onTheWebsite(member);
  for (const { user } of [alice, bob]) await openHome(user);
  return {
    homes: Object.fromEntries([alice, bob].map(({ user }) => [user, publishedHome(slack, user)])),
    answers,
    slackCallsTo: Object.fromEntries([alice, bob].map(({ user }) => [user, slackCallsAbout(user)])),
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    productEvents: orderFree(withStableIds(postHog.productEvents().filter(({ properties }) => properties.$feature_flag !== collection).map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsWritten(),
    dropsOf: { U_ALICE: await dropCount(alice.user), U_BOB: await dropCount(bob.user) },
  } satisfies Record<string, unknown>;
}

type ActivityPage = FunctionReturnType<typeof api.website.activity.getActivity>;

async function onTheWebsite(identity: { user: string; name: string }) {
  const asSignedIn = await signedIn(identity);
  const opens = [await asSignedIn.mutation(api.website.commands.openFeature, { feature: opensOf[identity.user]!.onTheWebsite }), await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: firstThanks })];
  await settleInTimeOrder(t);
  const activity: ActivityPage[] = [];
  let cursor: string | null = null;
  do {
    const page: ActivityPage = await asSignedIn.query(api.website.activity.getActivity, { filter: "all" as const, cursor, limit: 2 });
    activity.push(page);
    cursor = "cursor" in page ? page.cursor : null;
  } while (cursor !== null);
  return {
    opens,
    activity: withStableIds(activity),
    collection: await asSignedIn.query(api.website.collection.getCollection, {}),
    book: await asSignedIn.query(api.website.book.getBook, {}),
  };
}

async function hoggiesAliceSees() {
  await openHome(alice.user);
  const asSignedIn = await signedIn(alice);
  const activity = await asSignedIn.query(api.website.activity.getActivity, { filter: "all", cursor: null, limit: 10 });
  return {
    line: publishedHome(slack, alice.user).filter((line) => line.includes("Hoggies:")),
    collection: await asSignedIn.query(api.website.collection.getCollection, {}),
    found: "entries" in activity ? activity.entries.filter((entry) => entry.kind === "found") : [],
  };
}

async function signedIn(identity: { user: string; name: string }) {
  const session = await aSignedInSession(t, identity).catch(() => aSession(t, { user: identity.user, name: identity.name }));
  return session.asSignedIn;
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const convexTestId = /^\d+[a-zA-Z]+$/;
const keyedId = /^([a-z]+):(\d+[a-zA-Z]+)$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const positioned = new Set(["cursor", "seen", "eventId", "position"]);
const activityPosition = /^\d+(\.\d+)?_\d_[\d.]+$/;

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid") return undefined;
    if (positioned.has(key) && field !== null) return "<position>";
    if (typeof field !== "string") return field;
    if (activityPosition.test(field)) return "<position>";
    if (namedIds.has(field)) return namedIds.get(field);
    if (keyedId.test(field)) return field.replace(keyedId, (_, kind: string, id: string) => `${kind}:${stable("document", id)}`);
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
  const written = withStableIds(withoutCollectionExposure(tables));
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

function dropRows() {
  return t.run(async (ctx) => ({
    drops: await ctx.db.query("drops").collect(),
    hoggieTallies: await ctx.db.query("hoggieTallies").collect(),
    dropTallies: await ctx.db.query("dropTallies").collect(),
  }));
}

async function dropCount(user: string) {
  const member = await memberOf(user);
  return t.run(async (ctx) => (await ctx.db.query("drops").collect()).filter((drop) => drop.member === member).length);
}

function slackCallsAbout(user: string) {
  return slack.calls
    .filter((call) => JSON.stringify(call).includes(user))
    .map((call) => JSON.stringify(call))
    .sort();
}

function collectionExposures() {
  const exposures = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === collection);
  const asPostHogKeepsThem = new Map(exposures.map((exposure) => [exposure.uuid, exposure]));
  const byMember: Record<string, unknown[]> = {};
  for (const { distinct_id, properties } of asPostHogKeepsThem.values()) (byMember[distinct_id] ??= []).push(properties.$feature_flag_response);
  return byMember;
}

let sentMessages = 0;

async function giveKudos(giver: string, recipient: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(" thanks for untangling the release notes today "), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

async function reachLevelFour(user: string) {
  const member = await memberOf(user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp: 300 });
  });
  const message = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };
  for (const level of [2, 3, 4]) {
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: { type: "levelReached", workspace: "T1", member, level, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, message, at: Date.now() } });
  }
  await settleInTimeOrder(t);
}

async function openInSlack(user: string, command: { type: "openUnlock"; feature: Feature } | { type: "openQuestCrate"; quest: Quest }) {
  vi.setSystemTime(Date.now() + minuteMs);
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, staleButtonOf(command)), form));
  await settleInTimeOrder(t);
}

async function openHome(user: string) {
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
