import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, react, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, publishedHomeBlocks, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, text, userGroupEvent, type ReactionOptions } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import crons from "../crons";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import { openUnlock } from "../unlocks/unlocks";
import type { ActivityAnswer } from "../website/activity";
import type { Denial } from "../website/memberQuery";

const theHugs = vi.hoisted(() => ({ removed: false }));

vi.mock("./reactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reactions")>();
  return { ...actual, isReactionAdded: vi.fn((...args: Parameters<typeof actual.isReactionAdded>) => !theHugs.removed && actual.isReactionAdded(...args)) };
});

vi.mock("../hugs/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hugs/flag")>();
  return { ...actual, hugsShownTo: vi.fn((...args: Parameters<typeof actual.hugsShownTo>) => (theHugs.removed ? Promise.resolve(false) : actual.hugsShownTo(...args))) };
});

vi.mock("../quests/rank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../quests/rank")>();
  return { ...actual, drawRank: vi.fn((key: string) => actual.drawRank(key.replace(/^[^:]+/, (member) => namedIds.get(member) ?? member))) };
});

vi.mock("../website/seen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../website/seen")>();
  return { ...actual, seenKeyOf: vi.fn((member: Parameters<typeof actual.seenKeyOf>[0], crate: string) => actual.seenKeyOf((namedIds.get(member) ?? member) as typeof member, crate)) };
});

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  return { ...actual, drawOf: vi.fn((input: Parameters<typeof actual.drawOf>[0]) => actual.drawOf({ ...input, member: namedIds.get(input.member) ?? input.member })) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const mondayAfter = Date.parse("2026-10-19T10:00:00Z");
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const siteUrl = "https://kudos-site.test";
const hugs = "hugs";
const everyOtherFlag = ["xp-levels", "unlocks", "achievements", "collection", "crests", "crate-store", "crate-rewards", "coins", "store", "quests", "group-quest", "groups", "activity", "everyone-board", "profile-card", "hoggie-avatar", "message-settings", "custom-kudos-emoji", "monday-post", "skill-tree"];
const hugTables = ["hugs", "hugPeople", "hugWeeks", "hugWeekMessages", "hugCounts"] as const;
const reactionEventIds = /^EvHug/;
const hugLookUp = "slack/hugLookups:lookUpHugPeople";
const outboxDelivery = "analytics/drain:";
const identifyDelivery = "analytics/person:identifyNewPeople";
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const carol = { user: "U_CAROL", name: "Carol Diaz", email: "carol@example.com" };
const dana = { user: "U_DANA", name: "Dana Lindqvist", email: "dana@example.com" };
const erin = { user: "U_ERIN", name: "Erin Walsh", email: "erin@example.com" };
const members = [alice, bob, carol, dana];
const ants = "S_ANTS";

type Person = typeof alice;
type TableName = keyof typeof schema.tables;

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let namedIds = new Map<string, string>();
let rowLabels = new Map<string, string>();
let phase = tuesday;
let steps = 0;
let reactions = 0;

beforeEach(() => {
  theHugs.removed = false;
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

const hugsOff: Array<{ condition: string; flag: FlagDefinition[]; turnOff?: () => void; exposed: Exposure[] }> = [
  { condition: "with hugs off", flag: [offForEveryone(hugs)], exposed: exposuresOfTheWalksHugReactionsAt(false) },
  { condition: "while PostHog has no hugs flag", flag: [], exposed: exposuresOfTheWalksHugReactionsAt(false) },
  { condition: "without the flags key, even when PostHog turned hugs on", flag: [onForEveryone(hugs)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", ""), exposed: [] },
  {
    condition: "in production, while hugs is on in the sandbox and for the product owner's email only",
    flag: [asTheShipCreatesIt()],
    turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production"),
    exposed: exposuresOfTheWalksHugReactionsAt(false),
  },
];

describe("SR21: hugs are dark where the flag is off, at the Slack and website boundaries, and only the members it is on for give hugs", { timeout: 240_000 }, () => {
  test.each(hugsOff)("$condition, a walk of kudos, kudos emoji reactions, App Home, the Monday recap and every website read leaves what the same walk leaves without hugs, apart from SR21's list", async ({ flag, turnOff, exposed }) => {
    theHugs.removed = true;
    const withoutHugs = await walkIn(await aliceBobCarolAndDanaInAnts(flag, turnOff));
    freshFakes();
    theHugs.removed = false;

    const walk = await walkIn(await aliceBobCarolAndDanaInAnts(flag, turnOff));

    expect(apartFromSR21sList(walk.seen)).toEqual(apartFromSR21sList(withoutHugs.seen));
    expect(walk.hugs).toEqual({ hugs: [], hugPeople: [], hugWeeks: [], hugWeekMessages: [], hugCounts: [] });
    expect(lookUpsOf(walk.seen)).toEqual([erin.user]);
    expect(lookUpsOf(withoutHugs.seen)).toEqual([]);
    expect(hugExposures(walk)).toEqual(exposed);
  });

  test("with hugs on, the same walk gives hugs, pays XP, shows them on the timeline and sends the Monday recap, so the comparison above can tell", async () => {
    theHugs.removed = true;
    const withoutHugs = await walkIn(await aliceBobCarolAndDanaInAnts([offForEveryone(hugs)]));
    freshFakes();
    theHugs.removed = false;

    const walk = await walkIn(await aliceBobCarolAndDanaInAnts([onForEveryone(hugs)]));

    expect(apartFromSR21sList(walk.seen)).not.toEqual(apartFromSR21sList(withoutHugs.seen));
    expect(walk.hugs.hugs.map(({ giver }) => giver).sort()).toEqual(["<member U_BOB>", "<member U_CAROL>", "<member U_DANA>", "<member U_ERIN>"]);
    expect(recapsTo(bob)).toHaveLength(1);
    expect(timelineKinds(walk, carol)).toContain("hugReceived");
    expect(hugExposures(walk)).toEqual([{ member: alice.user, value: true }, ...exposuresOfTheWalksHugReactionsAt(true)]);
  });

  test("with hugs on for one member's email only, only that member's reactions are hugs, they pay people whose flag is off, and those people's timelines, settings and recaps stay unchanged", async () => {
    theHugs.removed = true;
    const withoutHugs = await walkIn(await aliceBobCarolAndDanaInAnts([onForEmails(hugs, dana.email)]));
    freshFakes();
    theHugs.removed = false;

    const walk = await walkIn(await aliceBobCarolAndDanaInAnts([onForEmails(hugs, dana.email)]));

    expect(walk.hugs.hugs).toEqual([expect.objectContaining({ giver: "<member U_DANA>", onKudos: true })]);
    expect(walk.hugs.hugPeople.map(({ member }) => member).sort()).toEqual(["<member U_BOB>", "<member U_CAROL>"]);
    expect(walk.xp).toEqual({ ...withoutHugs.xp, U_BOB: withoutHugs.xp.U_BOB! + 1, U_CAROL: withoutHugs.xp.U_CAROL! + 1, U_DANA: withoutHugs.xp.U_DANA! + 1 });
    for (const person of [alice, bob, carol]) {
      for (const read of ["activity", "activityPageByPage", "recentKudosReceived", "recentKudosGiven"] as const) {
        expect(walk.seen.answers[person.user]![read], `${person.user}'s ${read}`).toEqual(withoutHugs.seen.answers[person.user]![read]);
      }
      expect(walk.seen.answers[person.user]!.settings).toEqual(withoutHugs.seen.answers[person.user]!.settings);
      expect(walk.seen.settingsTabs[person.user]).toEqual(withoutHugs.seen.settingsTabs[person.user]);
      expect(slack.messagesIn(person.user).filter(isRecap)).toEqual([]);
    }
    for (const person of [bob, carol]) {
      expect(messagesTo(walk.seen, person)).toEqual(messagesTo(withoutHugs.seen, person));
      expect(postHogEventsOf(walk.seen, person)).toEqual(postHogEventsOf(withoutHugs.seen, person));
    }
    expect(walk.seen.answers[alice.user]).toEqual(withoutHugs.seen.answers[alice.user]);
    expect(walk.seen.homes[alice.user]).toEqual(withoutHugs.seen.homes[alice.user]);
    expect(timelineKinds(walk, dana)).toContain("hugGiven");
    expect(walk.seen.settingsTabs[dana.user]).not.toEqual(withoutHugs.seen.settingsTabs[dana.user]);
    expect(recapsTo(dana)).toEqual([expect.stringContaining("You reacted :taco: and gave 1 hug (+1 XP).")]);
    expect(hugExposures(walk)).toEqual([
      { member: bob.user, value: false },
      { member: carol.user, value: false },
      { member: dana.user, value: true },
      { member: erin.user, value: false },
    ]);
  });

  test("the flag is exposed only for a reaction that passes every other part of SR1: once a member's flag turns off, a reaction on a message they hugged or past their hug budget exposes nothing", async () => {
    t = await aliceBobCarolAndDanaInAnts([onForEveryone(hugs)]);
    await t.mutation(internal.workspace.settings.setHugBudget, { workspace: "T1", hugBudget: 2 });
    const [carolsMessage, danasMessage, alicesMessage] = [2, 3, 4].map((hours) => earlierMessage(hours * hourMs));
    await reaction({ user: bob.user, itemUser: carol.user, ts: carolsMessage });

    await hugsAre(offForEveryone(hugs));
    await reaction({ user: bob.user, itemUser: carol.user, ts: carolsMessage, reaction: "taco::skin-tone-2" });
    expect(await exposuresSoFar(), "after a second reaction on the message Bob hugged, within his budget").toEqual([{ member: bob.user, value: true }]);

    await hugsAre(onForEveryone(hugs));
    await reaction({ user: bob.user, itemUser: dana.user, ts: danasMessage });
    await hugsAre(offForEveryone(hugs));
    await reaction({ user: bob.user, itemUser: alice.user, ts: alicesMessage });
    expect(await exposuresSoFar(), "after a reaction past Bob's budget of 2").toEqual([{ member: bob.user, value: true }]);

    await reaction({ user: carol.user, itemUser: alice.user, ts: alicesMessage });
    expect(await exposuresSoFar(), "after Carol's reaction while hugs is off").toEqual([
      { member: bob.user, value: true },
      { member: carol.user, value: false },
    ]);
  });
});

async function hugsAre(flag: FlagDefinition) {
  await flagsFromPostHog(t, postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), flag);
}

async function exposuresSoFar() {
  namedIds = await idsNamedByTheirMember();
  return hugExposures({ postHogEvents: postHog.events() });
}

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: hugs,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

type Exposure = { member: string; value: boolean };

function exposuresOfTheWalksHugReactionsAt(value: boolean): Exposure[] {
  return [bob, carol, dana, erin].map(({ user }) => ({ member: user, value }));
}

async function aliceBobCarolAndDanaInAnts(flag: FlagDefinition[], turnOff?: () => void): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  spotlightPositionsFromTheStart();
  phase = tuesday;
  steps = 0;
  reactions = 0;
  namedIds = new Map();
  rowLabels = new Map();
  t = await flagsFromPostHog(testBackend(), postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...flag);
  turnOff?.();
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, url: "https://t1.slack.com/" }));
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  for (const person of members) {
    await memberChanged(t, "team_join", { id: person.user, profile: { display_name: person.name, email: person.email } });
    await settled();
    const member = await memberOf(person.user);
    namedIds.set(member!, `<member ${person.user}>`);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member: member!, xp: xpToReach(5), pointsSpent: 0 }));
    for (const level of [4, 5]) await reachesLevel(t, member!, level);
    for (const feature of ["book", "leaderboard", "quests", "skillTree"] as const) await t.run((ctx) => openUnlock(ctx, member!, feature));
  }
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", ants)));
  await settled();
  return t;
}

async function walkIn(backend: Backend) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of members) await openHome(user);
  const thanksToBobAndCarol = await thanks(alice, "Thanks for the calm rollback of the billing service", bob, carol);
  const thanksToAlice = await thanks(bob, "Thanks for reviewing the incident write-up so quickly", alice);
  const carolsMessage = earlierMessage(2 * hourMs);
  const danasMessage = earlierMessage(3 * hourMs);
  const danasOldMessage = earlierMessage(25 * hourMs);
  await reaction({ user: bob.user, itemUser: carol.user, ts: carolsMessage });
  await reaction({ user: bob.user, itemUser: carol.user, ts: carolsMessage, reaction: "taco::skin-tone-3" });
  await reaction({ user: dana.user, itemUser: alice.user, ts: thanksToBobAndCarol });
  await reaction({ user: carol.user, itemUser: bob.user, ts: thanksToAlice });
  await reactionOfSomeoneTheDirectoryDoesNotKnow({ user: erin.user, itemUser: alice.user, ts: thanksToBobAndCarol });
  await reaction({ user: alice.user, itemUser: bob.user, ts: thanksToAlice });
  await reaction({ user: alice.user, itemUser: dana.user, ts: danasOldMessage });
  await reaction({ user: dana.user, itemUser: dana.user, ts: danasMessage });
  await reaction({ user: carol.user, itemUser: dana.user, ts: danasMessage, reaction: "tada" });
  await thanks(carol, "Thanks for pairing on the flaky deploy", bob);
  for (const { user } of members) await openHome(user);
  await theRecapSweepRuns();
  await settleUpTo(t, mondayAfter);
  phase = mondayAfter;
  steps = 0;
  namedIds = await idsNamedByTheirMember();
  const settingsTabs: Record<string, unknown> = {};
  for (const { user } of members) settingsTabs[user] = await settingsTabOf(user);
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  for (const member of members) answers[member.user] = await onTheWebsite(member);
  const seen = {
    homes: Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)])),
    settingsTabs,
    answers,
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    postHogEvents: orderFree(withStableIds(postHog.events().map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsInContentOrder(),
    jobsApartFromTheLookUpAndAnalyticsDelivery: await jobsInContentOrder({ apartFrom: [hugLookUp, outboxDelivery, identifyDelivery] }),
  };
  return { seen, hugs: await storedHugs(), xp: await xpOfEveryone(), postHogEvents: postHog.events() };
}

type Walk = Awaited<ReturnType<typeof walkIn>>;
type Seen = Walk["seen"];

function apartFromSR21sList(seen: Seen) {
  const { slackReceipts, analyticsIds, flagExposures, analyticsOutbox, ...tables } = seen.tables as Record<string, Array<Record<string, unknown>>>;
  return {
    ...seen,
    slackCalls: seen.slackCalls.filter((call) => !isLookUpOf(erin, call)),
    postHogEvents: seen.postHogEvents.filter((event) => !isHugsExposure(event) && !isIdentifyOfTheLookedUp(event)),
    tables: {
      ...tables,
      slackReceipts: slackReceipts!.filter(({ eventId }) => !reactionEventIds.test(String(eventId))),
      analyticsIds: analyticsIds!.filter(({ member }) => member !== `<member ${erin.user}>`),
      flagExposures: flagExposures!.filter(({ flag }) => flag !== hugs),
      analyticsOutbox: analyticsOutbox!.filter((row) => !isHugsExposure(row) && !isIdentifyOfTheLookedUp({ ...row, distinct_id: row.distinctId })),
    },
  };
}

function isIdentifyOfTheLookedUp({ event, distinct_id }: { event?: unknown; distinct_id?: unknown }) {
  return event === "$identify" && distinct_id === `<analytics ID of ${erin.user}>`;
}

function isHugsExposure({ event, properties }: { event?: unknown; properties?: unknown }) {
  return event === "$feature_flag_called" && (properties as Record<string, unknown>).$feature_flag === hugs;
}

function isLookUpOf(person: Person, call: string) {
  const { method, args } = JSON.parse(call) as { method: string; args: { user?: string } };
  return method === "users.info" && args.user === person.user;
}

function lookUpsOf(seen: Seen) {
  return seen.slackCalls.filter((call) => isLookUpOf(erin, call)).map(() => erin.user);
}

function hugExposures({ postHogEvents }: Pick<Walk, "postHogEvents">): Exposure[] {
  const userOf = new Map([...namedIds].map(([id, name]) => [id, name.replace(/^<analytics ID of (\w+)>$/, "$1")]));
  return postHogEvents
    .filter(isHugsExposure)
    .map(({ distinct_id, properties }) => ({ member: userOf.get(distinct_id) ?? distinct_id, value: properties.$feature_flag_response as boolean }))
    .toSorted((a, b) => a.member.localeCompare(b.member));
}

function messagesTo(seen: Seen, person: Person) {
  return seen.slackCalls.filter((call) => {
    const { method, args } = JSON.parse(call) as { method: string; args: { channel?: string; user?: string } };
    return method.startsWith("chat.") && (args.channel === person.user || args.user === person.user);
  });
}

function postHogEventsOf(seen: Seen, person: Person) {
  return seen.postHogEvents.filter((event) => event.distinct_id === `<analytics ID of ${person.user}>` && !isHugsExposure(event));
}

function timelineKinds(walk: Walk, person: Person) {
  return ((walk.seen.answers[person.user]!.activity as { entries?: Array<{ kind: string }> }).entries ?? []).map(({ kind }) => kind);
}

function isRecap({ text }: { text?: unknown }) {
  return String(text).startsWith(":taco: Your week in hugs");
}

function recapsTo(person: Person) {
  return slack
    .messagesIn(person.user)
    .filter(isRecap)
    .map(({ text }) => String(text));
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
    activityPageByPage: await read(everyPageOf(asSignedIn)),
    recentKudosReceived: await read(asSignedIn.query(api.website.activity.getRecentKudos, { direction: "received" })),
    recentKudosGiven: await read(asSignedIn.query(api.website.activity.getRecentKudos, { direction: "given" })),
    spotlight: await read(asSignedIn.query(api.website.activity.getSpotlight, { seed: 0 })),
    leaderboards: await read(Promise.all(periods.map((period) => asSignedIn.query(api.website.leaderboard.getLeaderboard, { period })))),
    groupBoards: await read(Promise.all(periods.map((period) => asSignedIn.query(api.website.groupBoards.getGroupBoards, { period })))),
  };
}

const periods = ["week", "month", "all"] as const;

async function everyPageOf(asSignedIn: Awaited<ReturnType<typeof signedIn>>) {
  const pages: Record<string, unknown[]> = {};
  for (const filter of ["all", "received", "given"] as const) {
    pages[filter] = [];
    let cursor: string | null = null;
    do {
      const page: ActivityAnswer | Denial = await asSignedIn.query(api.website.activity.getActivity, { filter, cursor, limit: 1 });
      pages[filter].push(page);
      cursor = "cursor" in page ? page.cursor : null;
    } while (cursor !== null && pages[filter].length < 50);
  }
  return pages;
}

async function signedIn(person: Person) {
  const identity = { user: person.user, name: person.name };
  const { asSignedIn } = await aSignedInSession(t, identity).catch(() => aSession(t, identity));
  return asSignedIn;
}

async function settingsTabOf(user: string) {
  await openHome(user);
  const settings = publishedHomeBlocks(slack, user)
    .flatMap((block) => [...(block.type === "actions" ? (block.elements as BlockAction[]) : []), ...(block.accessory ? [block.accessory as BlockAction] : [])])
    .find((element) => "text" in element && (element.text as { text: string }).text === "Settings");
  if (settings === undefined) return "no Settings tab";
  nextStep();
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, settings!), { contentType: "application/x-www-form-urlencoded" }));
  await settled();
  return withStableIds(publishedHome(slack, user));
}

async function theRecapSweepRuns() {
  const job = crons.crons["schedule each member's weekly hugs recap"];
  if (job === undefined) throw new Error("no cron job schedules each member's weekly hugs recap");
  nextStep();
  await t.mutation(makeFunctionReference<"mutation">(job.name), {});
  await settled();
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const convexTestId = /^\d+[a-zA-Z_]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const createdInTheSameMillisecond = /(\d{13})\.\d+$/;
const opaque = new Set(["cursor", "eventId"]);

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid") return undefined;
    if (key === "eventId" && typeof field === "string" && reactionEventIds.test(field)) return field;
    if (opaque.has(key) && typeof field === "string") return stable(key, field);
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (rowLabels.has(field)) return rowLabels.get(field);
    if (containsANamedId(field)) return withNamedIds(field);
    if (createdInTheSameMillisecond.test(field)) return field.replace(createdInTheSameMillisecond, "$1.<tie>");
    if (convexTestId.test(field)) return stable("document", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

function containsANamedId(field: string) {
  return [...namedIds.keys()].some((id) => field.includes(id));
}

function withNamedIds(field: string) {
  return [...namedIds].reduce((named, [id, name]) => named.replaceAll(id, name), field);
}

async function rowsInContentOrder() {
  rowLabels = new Map();
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  const inContentOrder = Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b)))]));
  rowLabels = new Map(Object.entries(inContentOrder).flatMap(([table, rows]) => rows.map((row, index) => [String(row._id), `<${table} ${index + 1}>`] as const)));
  return withStableIds(inContentOrder);
}

function contentOf(row: Record<string, unknown>) {
  return JSON.stringify(withStableIds(row), (key, field) => (opaque.has(key) || convexTestId.test(String(field)) ? undefined : field));
}

async function jobsInContentOrder({ apartFrom }: { apartFrom: string[] }) {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const jobs = scheduled.filter(({ name }) => !apartFrom.some((left) => name.startsWith(left))).map(({ name, args, scheduledTime, state }) => ({ name, args, scheduledTime, state: state.kind }));
  return withStableIds(jobs.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b))));
}

async function storedHugs() {
  const rows = await t.run(async (ctx) => {
    const stored = {} as Record<(typeof hugTables)[number], Array<Record<string, unknown>>>;
    for (const table of hugTables) stored[table] = await ctx.db.query(table).collect();
    return stored;
  });
  return withStableIds(rows);
}

async function xpOfEveryone() {
  const xp: Record<string, number> = {};
  for (const { user } of [...members, erin]) {
    const member = await memberOf(user);
    if (member === undefined) continue;
    const progress = await t.run((ctx) =>
      ctx.db
        .query("memberProgress")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique(),
    );
    xp[user] = progress?.xp ?? 0;
  }
  return xp;
}

async function idsNamedByTheirMember() {
  const named = new Map<string, string>();
  for (const { user } of [...members, erin]) {
    const member = await memberOf(user);
    if (member === undefined) continue;
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

function spotlightPositionsFromTheStart() {
  let drawn = 0;
  vi.spyOn(Math, "random").mockImplementation(() => ((drawn += 1) * 0.618_033_988_7) % 1);
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(phase + steps * minuteMs);
}

async function settled() {
  await settleUpTo(t, Date.now());
}

function earlierMessage(beforeMs: number) {
  return slackTs(tuesday - beforeMs);
}

async function thanks(giver: Person, why: string, ...recipients: Person[]) {
  nextStep();
  const ts = `${Date.now() / 1000}.${String(steps).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settled();
  return ts;
}

async function reaction(options: ReactionOptions) {
  nextStep();
  reactions += 1;
  await react(t, { eventId: `EvHug${reactions}`, ...options });
  await settled();
}

async function reactionOfSomeoneTheDirectoryDoesNotKnow(options: ReactionOptions & { user: string }) {
  if (!theHugs.removed) return reaction(options);
  nextStep();
  reactions += 1;
  await t.mutation(internal.workspace.directory.fillEntry, { workspace: "T1", user: erin.user, entry: { kind: "member", name: erin.name, email: erin.email, displayName: erin.name }, asOf: Date.now() });
  await settled();
}

async function openHome(user: string) {
  nextStep();
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settled();
}

async function memberOf(user: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row?._id;
}

function slackTs(at: number) {
  return `${Math.floor(at / 1000)}.000100`;
}

function freshFakes() {
  slack = new FakeSlack();
  for (const person of [...members, erin]) slack.withMember(person.user, { profile: { display_name: person.name, email: person.email } });
  slack.withUserGroup(ants, { name: "Ants", users: [alice.user, carol.user] });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}
