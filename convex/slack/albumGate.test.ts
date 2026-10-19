import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, text } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { albumFlag, albumShownTo } from "../album/flag";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import { openUnlock } from "../unlocks/unlocks";

const theAlbum = vi.hoisted(() => ({ removed: false }));
const albumDecisions = vi.hoisted(() => [] as Array<{ by: string }>);

vi.mock("../album/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../album/flag")>();
  return { ...actual, albumShownTo: vi.fn((...args: Parameters<typeof actual.albumShownTo>) => (theAlbum.removed ? Promise.resolve(false) : actual.albumShownTo(...args))) };
});

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  type Subscription = { subscriber: never; only: (event: never) => boolean } | never;
  const withoutTheAlbum = (subscriptions: unknown[]) =>
    subscriptions.map((subscription) => {
      const { subscriber, only } = (typeof subscription === "object" && subscription !== null && "subscriber" in subscription ? subscription : { subscriber: subscription, only: () => true }) as Subscription;
      return getFunctionName(subscriber).startsWith("album/") ? { subscriber, only: (event: never) => !theAlbum.removed && only(event) } : subscription;
    });
  actual.subscribers.kudosGiven = withoutTheAlbum(actual.subscribers.kudosGiven) as typeof actual.subscribers.kudosGiven;
  actual.subscribers.companyTeamsReplaced = withoutTheAlbum(actual.subscribers.companyTeamsReplaced) as typeof actual.subscribers.companyTeamsReplaced;
  actual.subscribers.hugGiven = withoutTheAlbum(actual.subscribers.hugGiven) as typeof actual.subscribers.hugGiven;
  return actual;
});

vi.mock("../analytics/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../analytics/flags")>();
  const recorded = <F extends (...args: never[]) => unknown>(by: string, decide: F) =>
    ((...args: Parameters<F>) => {
      const [, read] = args as unknown as [object, { key: string }];
      if (read.key === "album") albumDecisions.push({ by });
      return decide(...args);
    }) as F;
  return {
    ...actual,
    memberDecision: recorded("memberDecision", actual.memberDecision),
    memberDecisionWithoutWriting: recorded("memberDecisionWithoutWriting", actual.memberDecisionWithoutWriting),
    memberDecisionBeforeWriting: recorded("memberDecisionBeforeWriting", actual.memberDecisionBeforeWriting),
    workspaceDecision: recorded("workspaceDecision", actual.workspaceDecision),
    workspaceDecisionWithoutWriting: recorded("workspaceDecisionWithoutWriting", actual.workspaceDecisionWithoutWriting),
    exposed: recorded("exposed", actual.exposed),
  };
});

vi.mock("../quests/rank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../quests/rank")>();
  return { ...actual, drawRank: vi.fn((key: string) => actual.drawRank(key.replace(/^[^:]+/, (member) => namedIds.get(member) ?? member))) };
});

vi.mock("../website/seen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../website/seen")>();
  const named = (id: string) => namedIds.get(id) ?? id;
  return { ...actual, seenKeyOf: vi.fn((member: Parameters<typeof actual.seenKeyOf>[0], crate: string) => actual.seenKeyOf(named(member) as typeof member, crate.replace(/[^:]+/g, named))) };
});

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  return { ...actual, drawOf: vi.fn((input: Parameters<typeof actual.drawOf>[0]) => actual.drawOf({ ...input, member: namedIds.get(input.member) ?? input.member })) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const album = "album";
const everyOtherFlag = ["xp-levels", "unlocks", "achievements", "collection", "crests", "crate-store", "crate-rewards", "coins", "store", "quests", "group-quest", "groups", "activity", "everyone-board", "profile-card", "hoggie-avatar", "message-settings", "custom-kudos-emoji", "monday-post", "skill-tree", "sticker-book", "team-pages", "team-spirit"];
const albumTables = ["thoughtfulPacks", "grantRecords", "grantsTold", "thoughtfulTallies", "albumStickers", "emojiNames", "emojiNameNumbers", "albumHistory", "pairTallies", "weekTallies", "weekPeople", "talliedAwards", "talliedHugs", "trayItems"] as const;
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const carol = { user: "U_CAROL", name: "Carol Diaz", email: "carol@example.com" };
const dana = { user: "U_DANA", name: "Dana Lindqvist", email: "dana@example.com" };
const members = [alice, bob, carol, dana];
const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", profiles: [{ id: 1, firstName: "Alice", lastName: "Moreau", colour: "teal" }, { id: 2, firstName: "Bob", lastName: "Okafor", colour: "red" }] };

type Person = typeof alice;
type TableName = keyof typeof schema.tables;

let slack: FakeSlack;
let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let t: Backend;
let namedIds = new Map<string, string>();
let steps = 0;

beforeEach(() => {
  theAlbum.removed = false;
  albumDecisions.length = 0;
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

const albumOff: Array<{ condition: string; flag: FlagDefinition[]; turnOff?: () => void }> = [
  { condition: "with album off", flag: [offForEveryone(album)] },
  { condition: "while PostHog has no album flag", flag: [] },
  { condition: "without the flags key, even when PostHog turned album on", flag: [onForEveryone(album)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while album is on in the sandbox only", flag: [asTheTicketCreatesIt()], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
];

describe("AL39: the album is dark where album is off, shows only to the members it is on for, and nothing exposes it", { timeout: 180_000 }, () => {
  test.each(albumOff)("$condition, a walk of kudos, App Home, a company sync and every website read leaves what the same walk leaves without the album, apart from the packs, grant records, thoughtful tallies, emoji names and the pair and week tallies it stores and the packs earned events it sends, and getAlbum and getThoughtfulBoards answer off", async ({ flag, turnOff }) => {
    theAlbum.removed = true;
    const withoutTheAlbum = await walkIn(await fourMembers(flag, turnOff), { opening: true });
    freshFakes();
    theAlbum.removed = false;

    const walk = await walkIn(await fourMembers(flag, turnOff), { opening: true });

    expect(walk.seen).toEqual(withoutTheAlbum.seen);
    expect(withoutTheAlbum.albumRows.thoughtfulPacks).toEqual([]);
    expect(walk.albumRows.thoughtfulPacks).toHaveLength(3);
    expect(walk.albumRows.emojiNames.length).toBeGreaterThan(0);
    expect(withoutTheAlbum.albumRows.pairTallies).toEqual([]);
    expect(walk.albumRows.pairTallies.length).toBeGreaterThan(0);
    expect(walk.albumRows.thoughtfulTallies).toEqual([expect.objectContaining({ awards: 2 }), expect.objectContaining({ awards: 1 })]);
    expect(Object.values(walk.boards).every((answer) => !(answer as object).hasOwnProperty("people"))).toBe(true);
    expect(Object.values(walk.boards)).toEqual(Object.values(withoutTheAlbum.boards));
    expect(packsEarnedIn(withoutTheAlbum)).toEqual([]);
    expect(packsEarnedIn(walk)).toEqual([
      { packs_earned: 2, recipients: 2 },
      { packs_earned: 1, recipients: 1 },
    ]);
    expect(Object.values(walk.albums).every((answer) => !(answer as object).hasOwnProperty("packs"))).toBe(true);
    expect(Object.values(walk.albums)).toEqual(Object.values(withoutTheAlbum.albums));
    expect(walk.opened).toEqual(withoutTheAlbum.opened);
    expect(walk.opened).not.toHaveProperty("items");
    expect(walk.albumRows.trayItems).toEqual([]);
    expect(albumDecisions.filter(({ by }) => by === "exposed")).toEqual([]);
    expect(albumExposures(walk)).toEqual([]);
    expect(await decidedWithoutTheWebsite(dana)).toBe(false);
  });

  test("with album on, the same walk shows each giver their waiting packs, getMyProfile says album, and it changes no other answer, call, event or row, and exposes nothing", async () => {
    const off = await walkIn(await fourMembers([offForEveryone(album)]));
    freshFakes();

    const on = await walkIn(await fourMembers([onForEveryone(album)]));

    expect(Object.values(on.seen.answers).map(({ profile }) => profile)).toEqual(members.map(() => expect.objectContaining({ kind: "member", album: true })));
    expect(withoutAlbumOnTheProfiles(on.seen)).toEqual(off.seen);
    expect(on.albums.U_ALICE).toMatchObject({ kind: "album", me: { name: alice.name }, packs: [{ person: "<member U_BOB>" }, { person: "<member U_CAROL>" }], morePacks: false });
    expect(on.albums.U_BOB).toMatchObject({ kind: "album", packs: [{ person: "<member U_ALICE>" }] });
    expect(on.albums.U_CAROL).toMatchObject({ kind: "album", packs: [] });
    expect(on.boards.U_CAROL).toMatchObject({ kind: "boards", people: [{ name: alice.name, thoughtful: 2, rank: 1 }, { name: bob.name, thoughtful: 1, rank: 2 }], teams: [{ team: "lanterns", thoughtful: 3, rank: 1 }] });
    expect(albumExposures(on)).toEqual([]);
    expect(albumDecisions.length).toBeGreaterThan(0);
    expect(albumDecisions.filter(({ by }) => by === "exposed")).toEqual([]);
  });

  test("with album on for one member's email only, only that member's getAlbum answers their album", async () => {
    const onForAlice = await walkIn(await fourMembers([onForEmails(album, alice.email)]));

    expect(onForAlice.albums.U_ALICE).toMatchObject({ kind: "album", packs: [{ person: "<member U_BOB>" }, { person: "<member U_CAROL>" }] });
    expect([onForAlice.albums.U_BOB, onForAlice.albums.U_CAROL, onForAlice.albums.U_DANA]).toEqual([{ kind: "off" }, { kind: "off" }, { kind: "off" }]);
    expect(onForAlice.seen.answers.U_ALICE!.profile).toMatchObject({ album: true });
    expect([onForAlice.seen.answers.U_BOB!.profile, onForAlice.seen.answers.U_CAROL!.profile, onForAlice.seen.answers.U_DANA!.profile].map((profile) => "album" in (profile as object))).toEqual([false, false, false]);
    expect(albumExposures(onForAlice)).toEqual([]);
  });
  test("album off and then on shows each giver the packs they earned while it was off, as they were stored", async () => {
    await walkIn(await fourMembers([offForEveryone(album)]));
    const storedWhileOff = await albumRows();

    await flagsFromPostHog(t, postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), onForEveryone(album));

    expect(withStableIds(await (await signedIn(alice)).query(api.website.album.getAlbum, {}))).toMatchObject({ kind: "album", packs: [{ person: "<member U_BOB>" }, { person: "<member U_CAROL>" }] });
    expect(withStableIds(await (await signedIn(bob)).query(api.website.album.getAlbum, {}))).toMatchObject({ kind: "album", packs: [{ person: "<member U_ALICE>" }] });
    expect(await albumRows()).toEqual(storedWhileOff);
  });
});

function withoutAlbumOnTheProfiles<Seen extends { answers: Record<string, { profile: unknown }> }>(seen: Seen): Seen {
  const answers = Object.fromEntries(Object.entries(seen.answers).map(([user, answer]) => [user, { ...answer, profile: withoutAlbum(answer.profile) }]));
  return { ...seen, answers };
}

function withoutAlbum(profile: unknown) {
  if (typeof profile !== "object" || profile === null || !("album" in profile)) return profile;
  const { album: _, ...rest } = profile;
  return rest;
}

function asTheTicketCreatesIt(): FlagDefinition {
  return { key: album, filters: { groups: [{ properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 }] } };
}

async function fourMembers(flag: FlagDefinition[], turnOff?: () => void): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  spotlightPositionsFromTheStart();
  steps = 0;
  namedIds = new Map();
  t = await flagsFromPostHog(testBackend(), postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...flag);
  turnOff?.();
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  for (const person of members) {
    await memberChanged(t, "team_join", { id: person.user, profile: { display_name: person.name, real_name: person.name, email: person.email } });
    await settleInTimeOrder(t);
    const member = await memberOf(person.user);
    namedIds.set(member, `<member ${person.user}>`);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(5), pointsSpent: 0 }));
    for (const level of [4, 5]) await reachesLevel(t, member, level);
    for (const feature of ["book", "leaderboard", "quests", "skillTree"] as const) await t.run((ctx) => openUnlock(ctx, member, feature, "slack"));
  }
  return t;
}

async function walkIn(backend: Backend, { opening = false } = {}) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of members) await openHome(user);
  await kudosOfTheWalk();
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settleInTimeOrder(t);
  for (const { user } of members) await openHome(user);
  const opened = opening ? await aliceOpensHerFirstPack() : null;
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  const albums: Record<string, unknown> = {};
  const boards: Record<string, unknown> = {};
  for (const member of members) {
    answers[member.user] = await onTheWebsite(member);
    albums[member.user] = withStableIds(await (await signedIn(member)).query(api.website.album.getAlbum, {}));
    boards[member.user] = withStableIds(await (await signedIn(member)).query(api.website.album.getThoughtfulBoards, {}));
  }
  const seen = {
    homes: Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)])),
    answers,
    slackCallsTo: Object.fromEntries(members.map(({ user }) => [user, slackCallsAbout(user)])),
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    productEvents: orderFree(withStableIds(postHog.productEvents().filter((event) => !isPacksEarned(event)).map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsWrittenApartFromTheAlbum(),
  };
  return { seen, albums, boards, opened, albumRows: await albumRows(), postHogEvents: postHog.events() };
}

async function aliceOpensHerFirstPack() {
  nextStep();
  const alicesMember = await memberOf(alice.user);
  const first = await t.run(async (ctx) => (await ctx.db.query("thoughtfulPacks").collect()).find(({ giver }) => giver === alicesMember)?._id ?? null);
  return (await signedIn(alice)).mutation(api.website.album.openThoughtfulPack, { pack: first ?? (await aPackIdNamingNoPack()) });
}

async function aPackIdNamingNoPack() {
  const [giver, recipient] = [await memberOf(alice.user), await memberOf(bob.user)];
  return t.run(async (ctx) => {
    const pack = await ctx.db.insert("thoughtfulPacks", { workspace: "T1", giver, recipient, week: "none", message: { workspace: "T1", conversation: "none", message: "none" }, holdsSticker: false, at: 0 });
    await ctx.db.delete(pack);
    return pack;
  });
}

async function kudosOfTheWalk() {
  await thanks(alice, "Thanks for the calm rollback of the billing service", bob, carol);
  await thanks(bob, "Thanks for reviewing the incident write-up so quickly", alice);
  await thanks(carol, "ty", bob);
}

async function decidedWithoutTheWebsite(person: Person) {
  const member = await memberOf(person.user);
  return t.run(async (ctx) => {
    const decided = await albumShownTo(ctx, member);
    expect(albumFlag.safeDefault).toBe(decided);
    return decided;
  });
}

function albumExposures({ postHogEvents }: { postHogEvents: ReturnType<FakePostHog["events"]> }) {
  return postHogEvents.filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === album);
}

function isPacksEarned({ event }: { event?: unknown }) {
  return event === "packs earned";
}

function packsEarnedIn({ postHogEvents }: { postHogEvents: ReturnType<FakePostHog["events"]> }) {
  return postHogEvents.filter(isPacksEarned).map(({ properties }) => ({ packs_earned: properties.packs_earned, recipients: properties.recipients }));
}

async function rowsWrittenApartFromTheAlbum() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) if (!(albumTables as readonly string[]).includes(table)) rows[table] = await ctx.db.query(table).collect();
    rows.analyticsOutbox = rows.analyticsOutbox.filter((row) => !isPacksEarned(row));
    return rows;
  });
  const inContentOrder = Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b)))]));
  return withStableIds(inContentOrder);
}

function albumRows() {
  return t.run(async (ctx) => {
    const rows = {} as Record<(typeof albumTables)[number], unknown[]>;
    for (const table of albumTables) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

async function thanks(giver: Person, why: string, ...recipients: Person[]) {
  nextStep();
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(steps).padStart(6, "0")}` });
  await settleInTimeOrder(t);
}

function freshFakes() {
  slack = new FakeSlack();
  for (const person of members) slack.withMember(person.user, { profile: { display_name: person.name, real_name: person.name, email: person.email } });
  postHog = postHogDeciding();
  postHogCom = new FakePostHogCom().withTeams(lanterns);
  const chat = slack.fetch;
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : chat(input, init))));
}

const convexTestId = /^\d+[a-zA-Z_]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const createdInTheSameMillisecond = /(\d{13})\.\d+$/;
const opaque = new Set(["cursor", "eventId"]);

function spotlightPositionsFromTheStart() {
  let drawn = 0;
  vi.spyOn(Math, "random").mockImplementation(() => ((drawn += 1) * 0.618_033_988_7) % 1);
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(tuesday + steps * minuteMs);
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

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid") return undefined;
    if (opaque.has(key) && typeof field === "string") return stable(key, field);
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (createdInTheSameMillisecond.test(field)) return field.replace(createdInTheSameMillisecond, "$1.<tie>");
    if (convexTestId.test(field)) return stable("document", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function contentOf(row: Record<string, unknown>) {
  return JSON.stringify(withStableIds(row), (key, field) => (opaque.has(key) || convexTestId.test(String(field)) ? undefined : field));
}

async function signedIn(person: Person) {
  const identity = { user: person.user, name: person.name };
  const { asSignedIn } = await aSignedInSession(t, identity).catch(() => aSession(t, identity));
  return asSignedIn;
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
