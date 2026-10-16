import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, userGroupEvent } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import { openUnlock } from "../unlocks/unlocks";

const theStickerBook = vi.hoisted(() => ({ removed: false }));

vi.mock("../stickers/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stickers/flag")>();
  return {
    ...actual,
    stickersShownTo: vi.fn((...args: Parameters<typeof actual.stickersShownTo>) => (theStickerBook.removed ? Promise.resolve(false) : actual.stickersShownTo(...args))),
  };
});

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  actual.subscribers.kudosGiven = actual.subscribers.kudosGiven.map((subscription) =>
    "subscriber" in subscription || getFunctionName(subscription) !== "stickers/stickers:recordStickers" ? subscription : { subscriber: subscription, only: () => !theStickerBook.removed },
  );
  return actual;
});

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  return { ...actual, drawOf: vi.fn((input: Parameters<typeof actual.drawOf>[0]) => actual.drawOf({ ...input, member: namedIds.get(input.member) ?? input.member })) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const stickerBook = "sticker-book";
const everyOtherFlag = ["xp-levels", "unlocks", "achievements", "collection", "crests", "crate-store", "crate-rewards", "coins", "store", "quests", "group-quest", "groups", "activity", "everyone-board", "profile-card", "hoggie-avatar", "message-settings", "custom-kudos-emoji", "monday-post", "skill-tree"];
const stickerTables = ["stickers", "stickerBackfills"] as const;
const backfillJob = "stickers/backfill:backfillStickers";
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const carol = { user: "U_CAROL", name: "Carol Diaz", email: "carol@example.com" };
const members = [alice, bob, carol];
const ants = "S_ANTS";

type Person = typeof alice;
type TableName = keyof typeof schema.tables;

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let stickerFlag: FlagDefinition[] = [];
let namedIds = new Map<string, string>();
let steps = 0;

beforeEach(() => {
  theStickerBook.removed = false;
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

const stickerBookOff: Array<{ condition: string; flag: FlagDefinition[]; turnOff?: () => void }> = [
  { condition: "with sticker-book off", flag: [offForEveryone(stickerBook)] },
  { condition: "while PostHog has no sticker-book flag", flag: [] },
  { condition: "without the flags key, even when PostHog turned sticker-book on", flag: [onForEveryone(stickerBook)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while sticker-book is on in the sandbox and for the product owner's email only", flag: [asTheShipCreatesIt()], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
];

describe("SB15: the sticker book is dark where sticker-book is off, shows only to the members it is on for, and nothing exposes it", { timeout: 120_000 }, () => {
  test.each(stickerBookOff)("$condition, a walk of kudos, App Home and every website read leaves what the same walk leaves without the sticker book, apart from the sticker records it stores", async ({ flag, turnOff }) => {
    theStickerBook.removed = true;
    const withoutTheStickerBook = await walkIn(await aliceBobAndCarolInAnts(flag, turnOff));
    freshFakes();
    theStickerBook.removed = false;

    const walk = await walkIn(await aliceBobAndCarolInAnts(flag, turnOff));

    expect(walk.seen).toEqual(withoutTheStickerBook.seen);
    expect(JSON.stringify(walk.seen.answers)).not.toMatch(/"stickers"|"albums"/);
    expect(withoutTheStickerBook.stickers).toEqual([]);
    expect(walk.stickers).toHaveLength(6);
  });

  test("with sticker-book on, the same walk shows each member the stickers and group albums of the people they thanked or were thanked by, and exposes nothing", async () => {
    const walk = await walkIn(await aliceBobAndCarolInAnts([onForEveryone(stickerBook)]));

    expect(namesOn(walk.seen.answers.U_ALICE!.collection)).toEqual([bob.name, carol.name]);
    expect(walk.seen.answers.U_ALICE!.collection).toMatchObject({ kind: "collection", albums: [{ name: "Ants", mine: true, held: 1, total: 1 }] });
    expect(walk.seen.answers.U_BOB!.collection).toMatchObject({ stickers: [{ name: carol.name }, { name: alice.name }], albums: [{ name: "Ants", mine: false, held: 2, total: 2 }] });
    expect(stickerBookExposures(walk)).toEqual([]);
  });

  test("with sticker-book on for one member's email only, only that member's getCollection changes, and nothing exposes it", async () => {
    const off = await walkIn(await aliceBobAndCarolInAnts([offForEveryone(stickerBook)]));
    freshFakes();

    const onForAlice = await walkIn(await aliceBobAndCarolInAnts([onForEmails(stickerBook, alice.email)]));

    const { stickers: _stickers, albums, ...aliceCollectionOtherwise } = onForAlice.seen.answers.U_ALICE!.collection as Record<string, unknown>;
    expect(namesOn(onForAlice.seen.answers.U_ALICE!.collection)).toEqual([bob.name, carol.name]);
    expect(albums).toMatchObject([{ name: "Ants", held: 1, total: 1 }]);
    expect(aliceCollectionOtherwise).toEqual(off.seen.answers.U_ALICE!.collection);
    expect(withoutTheCollectionOf(alice, onForAlice.seen)).toEqual(withoutTheCollectionOf(alice, off.seen));
    expect(onForAlice.stickers).toEqual(off.stickers);
    expect(stickerBookExposures(onForAlice)).toEqual([]);
  });

  test("sticker-book off and then on again shows the same stickers, and no backfill runs", async () => {
    t = await aliceBobAndCarolInAnts([onForEveryone(stickerBook)]);
    await kudosOfTheWalk();
    const asAlice = await signedIn(alice);
    const stickersOnce = await stickersAnswered(asAlice);
    const storedOnce = await storedStickerRecords();
    const backfillsOnce = await backfillJobsScheduled();

    await stickerBookIs(offForEveryone(stickerBook));
    expect(await asAlice.query(api.website.collection.getCollection, {})).not.toHaveProperty("stickers");
    await stickerBookIs(onForEveryone(stickerBook));

    expect(stickersOnce).toHaveLength(2);
    expect(await stickersAnswered(asAlice)).toEqual(stickersOnce);
    expect(await storedStickerRecords()).toEqual(storedOnce);
    expect(await backfillJobsScheduled()).toEqual(backfillsOnce);
  });
});

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: stickerBook,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

async function aliceBobAndCarolInAnts(flag: FlagDefinition[], turnOff?: () => void): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  steps = 0;
  namedIds = new Map();
  stickerFlag = flag;
  t = await flagsFromPostHog(testBackend(), postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...stickerFlag);
  turnOff?.();
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await bookShippedBeforeAnyoneJoined(t);
  for (const person of members) {
    await memberChanged(t, "team_join", { id: person.user, profile: { display_name: person.name, email: person.email } });
    await settleInTimeOrder(t);
    const member = await memberOf(person.user);
    namedIds.set(member, `<member ${person.user}>`);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(4), pointsSpent: 0 }));
    await reachesLevel(t, member, 4);
    await t.run((ctx) => openUnlock(ctx, member, "book"));
  }
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", ants)));
  await settleInTimeOrder(t);
  return t;
}

async function stickerBookIs(flag: FlagDefinition) {
  await flagsFromPostHog(t, postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), flag);
}

async function walkIn(backend: Backend) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of members) await openHome(user);
  await kudosOfTheWalk();
  for (const { user } of members) await openHome(user);
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  for (const member of members) answers[member.user] = await onTheWebsite(member);
  const seen = {
    homes: Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)])),
    answers,
    slackCallsTo: Object.fromEntries(members.map(({ user }) => [user, slackCallsAbout(user)])),
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    productEvents: orderFree(withStableIds(postHog.productEvents().map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsWrittenApartFromStickers(),
  };
  return { seen, stickers: await storedStickerRecords(), postHogEvents: postHog.events() };
}

async function kudosOfTheWalk() {
  await thanks(alice, bob, carol);
  await thanks(bob, alice);
  await thanks(carol, bob);
}

async function onTheWebsite(person: Person) {
  nextStep();
  const asSignedIn = await signedIn(person);
  const read = async <T>(answer: Promise<T>) => withStableIds(await answer);
  return {
    collection: await read(asSignedIn.query(api.website.collection.getCollection, {})),
    book: await read(asSignedIn.query(api.website.book.getBook, {})),
    profile: await read(asSignedIn.query(api.website.profile.getMyProfile, {})),
    card: await read(asSignedIn.query(api.website.profileCard.getProfileCard, {})),
    quests: await read(asSignedIn.query(api.website.quests.getQuests, {})),
    settings: await read(asSignedIn.query(api.website.settings.getSettings, {})),
    skillTree: await read(asSignedIn.query(api.website.skillTree.getSkillTree, {})),
    activity: await read(asSignedIn.query(api.website.activity.getActivity, { filter: "all", cursor: null })),
    recentKudos: await read(asSignedIn.query(api.website.activity.getRecentKudos, { direction: "received" })),
    spotlight: await read(asSignedIn.query(api.website.activity.getSpotlight, { seed: 0 })),
    leaderboard: await read(asSignedIn.query(api.website.leaderboard.getLeaderboard, { period: "week" })),
    groupBoards: await read(asSignedIn.query(api.website.groupBoards.getGroupBoards, { period: "week" })),
  };
}

function namesOn(collection: unknown) {
  return ((collection as { stickers?: Array<{ name: string }> }).stickers ?? []).map(({ name }) => name).sort();
}

type Seen = Awaited<ReturnType<typeof walkIn>>["seen"];

function withoutTheCollectionOf(person: Person, seen: Seen) {
  const { collection: _collection, ...answers } = seen.answers[person.user]!;
  return { ...seen, answers: { ...seen.answers, [person.user]: answers } };
}

async function stickersAnswered(reader: Awaited<ReturnType<typeof signedIn>>) {
  const answer = await reader.query(api.website.collection.getCollection, {});
  if (!("stickers" in answer)) throw new Error(`expected stickers, got ${JSON.stringify(answer)}`);
  return answer.stickers;
}

async function signedIn(person: Person) {
  const identity = { user: person.user, name: person.name };
  const { asSignedIn } = await aSignedInSession(t, identity).catch(() => aSession(t, identity));
  return asSignedIn;
}

function stickerBookExposures({ postHogEvents }: { postHogEvents: ReturnType<FakePostHog["events"]> }) {
  return postHogEvents.filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === stickerBook);
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const convexTestId = /^\d+[a-zA-Z_]+$/;
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

async function rowsWrittenApartFromStickers() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) if (!(stickerTables as readonly string[]).includes(table)) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  const written = withStableIds(tables);
  return Object.fromEntries(Object.entries(written).map(([table, rows]) => [table, orderFree(rows)]));
}

function storedStickerRecords() {
  return t.run(async (ctx) => (await ctx.db.query("stickers").collect()).map(({ member, person, firstAward, firstAt }) => ({ member, person, firstAward, firstAt })));
}

function backfillJobsScheduled() {
  return t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ name }) => name === backfillJob).length);
}

async function idsNamedByTheirMember() {
  const named = new Map<string, string>();
  for (const { user } of members) {
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

function nextStep() {
  steps += 1;
  vi.setSystemTime(tuesday + steps * minuteMs);
}

async function thanks(giver: Person, ...recipients: Person[]) {
  nextStep();
  await post(t, [section(...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(steps).padStart(6, "0")}` });
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

function freshFakes() {
  slack = new FakeSlack();
  for (const person of members) slack.withMember(person.user, { profile: { display_name: person.name, email: person.email } });
  slack.withUserGroup(ants, { name: "Ants", users: [alice.user, carol.user] });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}
