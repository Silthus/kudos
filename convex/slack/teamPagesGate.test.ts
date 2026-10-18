import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage as PostHogComTeam } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { withoutExposureOf } from "../../testing/hoggies";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, staleMenuOptionOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, text, userGroupEvent } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { teamPagesFlag, teamPagesShownTo } from "../companyProfiles/flag";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import { openUnlock } from "../unlocks/unlocks";
import type { Command } from "../commands/commands";

const teamPagesRemoved = vi.hoisted(() => ({ removed: false }));
const teamPagesDecisions = vi.hoisted(() => [] as Array<{ by: string; inAQuery: boolean; inALinkCommand: boolean }>);
const linkCommandRunning = vi.hoisted(() => ({ running: false }));

vi.mock("../companyProfiles/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../companyProfiles/flag")>();
  return {
    ...actual,
    teamPagesShownTo: vi.fn((...args: Parameters<typeof actual.teamPagesShownTo>) => (teamPagesRemoved.removed ? Promise.resolve(false) : actual.teamPagesShownTo(...args))),
    teamPagesApplyTo: vi.fn((...args: Parameters<typeof actual.teamPagesApplyTo>) => (teamPagesRemoved.removed ? Promise.resolve(false) : actual.teamPagesApplyTo(...args))),
  };
});

vi.mock("../analytics/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../analytics/flags")>();
  const recorded = <F extends (...args: never[]) => unknown>(by: string, decide: F) =>
    ((...args: Parameters<F>) => {
      const [ctx, read] = args as unknown as [object, { key: string }];
      if (read.key === "team-pages") teamPagesDecisions.push({ by, inAQuery: !("scheduler" in ctx), inALinkCommand: linkCommandRunning.running });
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
  return { ...actual, seenKeyOf: vi.fn((member: Parameters<typeof actual.seenKeyOf>[0], crate: string) => actual.seenKeyOf((namedIds.get(member) ?? member) as typeof member, namedWithin(crate))) };
});

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  return { ...actual, drawOf: vi.fn((input: Parameters<typeof actual.drawOf>[0]) => actual.drawOf({ ...input, member: namedIds.get(input.member) ?? input.member })) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const form = { contentType: "application/x-www-form-urlencoded" };
const teamPages = "team-pages";
const everyOtherFlag = [
  "xp-levels",
  "unlocks",
  "achievements",
  "collection",
  "crests",
  "crate-store",
  "crate-rewards",
  "coins",
  "store",
  "quests",
  "group-quest",
  "groups",
  "activity",
  "everyone-board",
  "profile-card",
  "hoggie-avatar",
  "message-settings",
  "custom-kudos-emoji",
  "monday-post",
  "skill-tree",
  "sticker-book",
  "hugs",
  "book-spread",
];
const companyTables = ["companyProfiles", "companyTeams", "companyProfileLinks"] as const;
const exposureDelivery = ["analytics/drain:drain", "analytics/drain:recover", "analytics/person:identifyNewPeople"];
const deliveringMore = ["analytics/drain:drain", "analytics/drain:recover"];
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const carol = { user: "U_CAROL", name: "Carol Diaz", email: "carol@example.com" };
const dana = { user: "U_DANA", name: "Dana Lindqvist", email: "dana@example.com" };
const members = [alice, bob, carol, dana];
const ants = "S_ANTS";

const aliceProfile = { id: 1, firstName: "Alice", lastName: "Moreau", colour: "blue", cutout: aCutout("alice"), role: "Product Engineer" };
const robertProfile = { id: 2, firstName: "Robert", lastName: "Okafor", colour: "orange", cutout: aCutout("robert"), role: "Team Lead" };
const carolProfile = { id: 3, firstName: "Carol", lastName: "Diaz", colour: "teal", cutout: aCutout("carol") };
const danaProfile = { id: 4, firstName: "Dana", lastName: "Lindqvist", colour: "lilac", cutout: aCutout("dana") };
const patProfile = { id: 5, firstName: "Pat", lastName: "Quill", colour: "green", cutout: aCutout("pat") };
const hedgerow: PostHogComTeam = { slug: "hedgerow", name: "Hedgerow", leads: [2], profiles: [aliceProfile, robertProfile, carolProfile] };
const lantern: PostHogComTeam = { slug: "lantern", name: "Lantern", crest: aCutout("lantern-crest"), leads: [5], profiles: [danaProfile, patProfile] };

type Person = typeof alice;
type TableName = keyof typeof schema.tables;
type Reader = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];

let slack: FakeSlack;
let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let t: Backend;
let teamPagesFlagged: FlagDefinition[] = [];
let namedIds = new Map<string, string>();
let steps = 0;
let linkAnswers: unknown[] = [];
let keyOf: (person: Person) => string = () => "an unknown teammate";

beforeEach(() => {
  teamPagesRemoved.removed = false;
  teamPagesDecisions.length = 0;
  linkCommandRunning.running = false;
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

const refusedWhileOff = { kind: "refused", reason: null };
const closedWithoutTheFlagsKey = { kind: "closed" };

const teamPagesOff: Array<{ condition: string; flag: FlagDefinition[]; turnOff?: () => void; linkAnsweredWhileOff: object }> = [
  { condition: "with team-pages off", flag: [offForEveryone(teamPages)], linkAnsweredWhileOff: refusedWhileOff },
  { condition: "while PostHog has no team-pages flag", flag: [], linkAnsweredWhileOff: refusedWhileOff },
  { condition: "without the flags key, even when PostHog turned team-pages on", flag: [onForEveryone(teamPages)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", ""), linkAnsweredWhileOff: closedWithoutTheFlagsKey },
  { condition: "in production, while team-pages is on in the sandbox and for the product owner's email only", flag: [asTheShipCreatesIt()], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production"), linkAnsweredWhileOff: refusedWhileOff },
];

describe("CV28: team pages are dark where team-pages is off, show only to the members it is on for, ignore links while it is off, and only the two link commands expose it", { timeout: 180_000 }, () => {
  test.each(teamPagesOff)("$condition, a walk of kudos, App Home and every website read after links written while it was on leaves what the same walk leaves without team pages, apart from the company rows and the flag's exposure", async ({ flag, turnOff, linkAnsweredWhileOff }) => {
    teamPagesRemoved.removed = true;
    const withoutTeamPages = await walkIn(await everyoneInTheWorkspace(flag, { turnOff }));
    freshFakes();
    teamPagesRemoved.removed = false;

    const walk = await walkIn(await everyoneInTheWorkspace(flag, { turnOff }));

    expect(walk.seen).toEqual(withoutTeamPages.seen);
    expect(leftAfterRemoving(withoutTeamPages.deliveryJobs, walk.deliveryJobs)).toEqual([]);
    expect(leftAfterRemoving(walk.deliveryJobs, withoutTeamPages.deliveryJobs).every(({ name }) => deliveringMore.includes(name))).toBe(true);
    expect(JSON.stringify(walk.seen.answers)).not.toMatch(/"teams"|"companyProfile"|"admin"|Robert|Pat Quill/);
    expect(walk.links).toEqual([
      { by: "admin", member: "<member U_CAROL>", profile: null },
      { by: "admin", member: "<member U_DANA>", profile: patProfile.id },
      { by: "self", member: "<member U_BOB>", profile: robertProfile.id },
    ]);
    expect(walk.linkAnswers).toEqual([...Array(3).fill({ kind: "linked" }), ...Array(2).fill(linkAnsweredWhileOff)]);
    expect(teamPagesDecisions.every(({ inAQuery, inALinkCommand }) => inAQuery || inALinkCommand)).toBe(true);
    expect(await decidedWithoutTheWebsite(dana)).toBe(false);
  });

  test("with team-pages on, the same walk shows each member team pages in place of albums and crests, the profile part of Settings, and faces that follow the links", async () => {
    const walk = await walkIn(await everyoneInTheWorkspace([onForEveryone(teamPages)]));
    const { answers } = walk.seen;

    expect(answers.U_ALICE!.collection).not.toHaveProperty("albums");
    expect(answers.U_ALICE!.collection).not.toHaveProperty("crests");
    expect(teamsOn(answers.U_ALICE!.collection)).toEqual([
      { team: "hedgerow", mine: true, people: [carol.name] },
      { team: "lantern", mine: false, people: [dana.name] },
    ]);
    expect(teamsOn(answers.U_DANA!.collection)).toEqual([
      { team: "lantern", mine: true, people: [] },
      { team: "hedgerow", mine: false, people: [alice.name, carol.name] },
    ]);
    expect(answers.U_BOB!.face).toMatchObject({ kind: "initials" });
    expect(answers.U_CAROL!.face).toMatchObject({ kind: "company-profile", image: expect.stringContaining("carol") });
    expect(answers.U_DANA!.face).toMatchObject({ kind: "company-profile", image: expect.stringContaining("pat") });
    expect(answers.U_BOB!.settings).toMatchObject({ companyProfile: { mine: null } });
    expect(walk.links).toEqual([{ by: "admin", member: "<member U_DANA>", profile: patProfile.id }]);
    expect(answers.U_ALICE!.settings).toHaveProperty("admin");
    expect(answers.U_BOB!.settings).not.toHaveProperty("admin");
    expect(walk.linkAnswers).toEqual(Array(5).fill({ kind: "linked" }));
  });

  test("with team-pages on for one member's email only, only that member's answers change, and only that member's links are written and cleared", async () => {
    const off = await walkIn(await everyoneInTheWorkspace([offForEveryone(teamPages)], { linksWhile: [offForEveryone(teamPages)] }));
    freshFakes();

    const onForAlice = await walkIn(await everyoneInTheWorkspace([onForEmails(teamPages, alice.email)], { linksWhile: [onForEmails(teamPages, alice.email)] }));

    expect(onForAlice.seen.answers.U_ALICE).not.toEqual(off.seen.answers.U_ALICE);
    expect(teamsOn(onForAlice.seen.answers.U_ALICE!.collection).map(({ team }) => team)).toEqual(["hedgerow", "lantern"]);
    expect(withoutTheAnswersOf(alice, onForAlice.seen)).toEqual(withoutTheAnswersOf(alice, off.seen));
    expect(onForAlice.linkAnswers).toEqual([{ kind: "refused", reason: null }, { kind: "linked" }, { kind: "linked" }, { kind: "refused", reason: null }, { kind: "linked" }]);
    expect(onForAlice.links).toEqual([{ by: "admin", member: "<member U_DANA>", profile: patProfile.id }]);
  });

  test("team-pages's exposure goes only from the two link commands, never from App Home, a kudos, a Slack click naming a link command or a website read", async () => {
    await everyoneInTheWorkspace([onForEveryone(teamPages)], { linksWhile: null });
    namedIds = await idsNamedByTheirMember();
    for (const { user } of members) await openHome(user);
    await kudosOfTheWalk();
    await clickInSlack(bob.user, { type: "linkMyCompanyProfile", profile: robertProfile.id });
    for (const member of members) await onTheWebsite(member);
    await settleInTimeOrder(t);
    expect(teamPagesExposures()).toEqual({});
    expect(teamPagesDecisions.length).toBeGreaterThan(0);
    expect(teamPagesDecisions.every(({ inAQuery }) => inAQuery)).toBe(true);

    await linksWritten();
    await settleInTimeOrder(t);

    expect(teamPagesExposures()).toEqual({ [await analyticsIdOf(alice)]: [true], [await analyticsIdOf(bob)]: [true] });
    expect(teamPagesDecisions.filter(({ inAQuery }) => !inAQuery).every(({ inALinkCommand }) => inALinkCommand)).toBe(true);
  });
});

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: teamPages,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

type Setup = { linksWhile?: FlagDefinition[] | null; turnOff?: () => void };

async function everyoneInTheWorkspace(flag: FlagDefinition[], { linksWhile = [onForEveryone(teamPages)], turnOff }: Setup = {}): Promise<Backend> {
  vi.useFakeTimers({ now: tuesday });
  spotlightPositionsFromTheStart();
  steps = 0;
  linkAnswers = [];
  keyOf = () => "an unknown teammate";
  namedIds = new Map();
  teamPagesFlagged = flag;
  t = await flagsFromPostHog(testBackend(), postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...(linksWhile ?? flag));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  for (const person of members) {
    await memberChanged(t, "team_join", { id: person.user, is_admin: person === alice, profile: { display_name: person.name, real_name: person.name, email: person.email } });
    await settleInTimeOrder(t);
    const member = await memberOf(person);
    namedIds.set(member, `<member ${person.user}>`);
    await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(5), pointsSpent: 0 }));
    for (const level of [4, 5]) await reachesLevel(t, member, level);
    for (const feature of ["book", "leaderboard", "quests", "skillTree"] as const) await t.run((ctx) => openUnlock(ctx, member, feature));
  }
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", ants)));
  await settleInTimeOrder(t);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  namedIds = await idsNamedByTheirMember();
  if (linksWhile !== null) await linksWritten();
  await flagsFromPostHog(t, postHog, ...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...teamPagesFlagged);
  turnOff?.();
  return t;
}

async function linksWritten() {
  nextStep();
  const asBob = await signedIn(bob);
  const asAlice = await signedIn(alice);
  keyOf = await teammateKeysFor(asAlice);
  await linking(() => asBob.mutation(api.website.commands.linkMyCompanyProfile, { profile: robertProfile.id }));
  await linking(() => asAlice.mutation(api.website.commands.linkCompanyProfile, { member: keyOf(carol), profile: "none" }));
  await linking(() => asAlice.mutation(api.website.commands.linkCompanyProfile, { member: keyOf(dana), profile: patProfile.id }));
  await settleInTimeOrder(t);
}

async function linksClearedInTheWalk() {
  nextStep();
  const asBob = await signedIn(bob);
  const asAlice = await signedIn(alice);
  await linking(() => asBob.mutation(api.website.commands.linkMyCompanyProfile, { profile: null }));
  await linking(() => asAlice.mutation(api.website.commands.linkCompanyProfile, { member: keyOf(carol), profile: null }));
  await settleInTimeOrder(t);
}

async function linking(command: () => Promise<unknown>) {
  if (teamPagesRemoved.removed) return;
  linkCommandRunning.running = true;
  try {
    linkAnswers.push(await command());
  } finally {
    linkCommandRunning.running = false;
  }
}

async function teammateKeysFor(admin: Reader) {
  const settings = await admin.query(api.website.settings.getSettings, {});
  const keys = new Map(settings.kind === "settings" && settings.admin !== undefined ? settings.admin.members.map(({ name, key }) => [name, key]) : []);
  return (person: Person) => keys.get(person.name) ?? "an unknown teammate";
}

async function walkIn(backend: Backend) {
  t = backend;
  namedIds = await idsNamedByTheirMember();
  for (const { user } of members) await openHome(user);
  await kudosOfTheWalk();
  await clickInSlack(bob.user, { type: "linkMyCompanyProfile", profile: null });
  await linksClearedInTheWalk();
  for (const { user } of members) await openHome(user);
  const answers: Record<string, Awaited<ReturnType<typeof onTheWebsite>>> = {};
  for (const member of members) answers[member.user] = await onTheWebsite(member);
  const seen = {
    homes: Object.fromEntries(members.map(({ user }) => [user, publishedHome(slack, user)])),
    answers,
    slackCallsTo: Object.fromEntries(members.map(({ user }) => [user, slackCallsAbout(user)])),
    slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort(),
    postHogEvents: orderFree(withStableIds(postHog.events().filter(({ properties }) => properties.$feature_flag !== teamPages).map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsWrittenApartFromTheCompanyRows(),
    jobs: await jobsInContentOrder({ delivering: false }),
  };
  const deliveryJobs = (await jobsInContentOrder({ delivering: true })).map(({ name, state }) => ({ name, state }));
  return { seen, deliveryJobs, links: await storedLinks(), linkAnswers };
}

async function kudosOfTheWalk() {
  await thanks(alice, "Thanks for the calm rollback of the billing service", bob, carol);
  await thanks(bob, "Thanks for reviewing the incident write-up so quickly", alice);
  await thanks(carol, "Thanks for pairing on the flaky deploy", dana);
  await thanks(dana, "ty", alice);
}

async function decidedWithoutTheWebsite(person: Person) {
  const member = await memberOf(person);
  return t.run(async (ctx) => {
    const decided = await teamPagesShownTo(ctx, member);
    expect(teamPagesFlag.safeDefault).toBe(decided);
    return decided;
  });
}

async function onTheWebsite(person: Person) {
  nextStep();
  const asSignedIn = await signedIn(person);
  const read = async <T>(answer: Promise<T>) => withStableIds(await answer);
  return {
    collection: await read(asSignedIn.query(api.website.collection.getCollection, {})),
    book: await read(asSignedIn.query(api.website.book.getBook, {})),
    profile: await read(asSignedIn.query(api.website.profile.getMyProfile, {})),
    face: await read(asSignedIn.query(api.website.face.getMyFace, {})),
    card: await read(asSignedIn.query(api.website.profileCard.getProfileCard, {})),
    quests: await read(asSignedIn.query(api.website.quests.getQuests, {})),
    settings: await read(asSignedIn.query(api.website.settings.getSettings, {})),
    skillTree: await read(asSignedIn.query(api.website.skillTree.getSkillTree, {})),
    activity: await read(asSignedIn.query(api.website.activity.getActivity, { filter: "all", cursor: null })),
    recentKudos: await read(asSignedIn.query(api.website.activity.getRecentKudos, { direction: "received" })),
    spotlight: await read(asSignedIn.query(api.website.activity.getSpotlight, { seed: 0 })),
    leaderboard: await read(asSignedIn.query(api.website.leaderboard.getLeaderboard, { period: "week" })),
    groupBoards: await read(asSignedIn.query(api.website.groupBoards.getGroupBoards, { period: "week" })),
    frontDoor: await read(t.query(internal.website.link.frontDoorLinksOf, { workspace: "T1", user: person.user })),
  };
}

function teamsOn(collection: unknown) {
  const { teams = [] } = collection as { teams?: Array<{ team: string; mine: boolean; people: Array<{ name: string }> }> };
  return teams.map(({ team, mine, people }) => ({ team, mine, people: people.map(({ name }) => name) }));
}

type Seen = Awaited<ReturnType<typeof walkIn>>["seen"];

function withoutTheAnswersOf(person: Person, seen: Seen) {
  const { [person.user]: _answers, ...answers } = seen.answers;
  const { [person.user]: _home, ...homes } = seen.homes;
  const { [person.user]: _calls, ...slackCallsTo } = seen.slackCallsTo;
  const slackCalls = seen.slackCalls.filter((call) => !addresses(person, JSON.parse(call) as { args?: Record<string, unknown> }));
  return { ...seen, answers, homes, slackCallsTo, slackCalls };
}

function addresses(person: Person, { args = {} }: { args?: Record<string, unknown> }) {
  return [args.user_id, args.user, args.channel].includes(person.user);
}

async function signedIn(person: Person) {
  const identity = { user: person.user, name: person.name };
  const { asSignedIn } = await aSignedInSession(t, identity).catch(() => aSession(t, identity));
  return asSignedIn;
}

function teamPagesExposures() {
  const exposures = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === teamPages);
  const asPostHogKeepsThem = new Map(exposures.map((exposure) => [exposure.uuid, exposure]));
  const byMember: Record<string, unknown[]> = {};
  for (const { distinct_id, properties } of asPostHogKeepsThem.values()) (byMember[distinct_id] ??= []).push(properties.$feature_flag_response);
  return byMember;
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
    if (opaque.has(key) && typeof field === "string") return stable(key, field);
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (namedWithin(field) !== field) return namedWithin(field);
    if (createdInTheSameMillisecond.test(field)) return field.replace(createdInTheSameMillisecond, "$1.<tie>");
    if (convexTestId.test(field)) return stable("document", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

function namedWithin(text: string) {
  let named = text;
  for (const [id, name] of namedIds) named = named.replaceAll(id, name);
  return named;
}

async function rowsWrittenApartFromTheCompanyRows() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Record<string, unknown>[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) if (!(companyTables as readonly string[]).includes(table)) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  const written = withoutExposureOf(teamPages, tables);
  const inContentOrder = Object.fromEntries(Object.entries(written).map(([table, rows]) => [table, rows.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b)))]));
  return withStableIds(inContentOrder);
}

async function jobsInContentOrder({ delivering }: { delivering: boolean }) {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const jobs = scheduled.filter(({ name }) => delivering === exposureDelivery.includes(name)).map(({ name, args, scheduledTime, state }) => ({ name, args, scheduledTime, state: state.kind }));
  return withStableIds(jobs.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b))));
}

function leftAfterRemoving<T>(rows: T[], removed: T[]): T[] {
  const left = rows.map((row) => JSON.stringify(row));
  for (const row of removed.map((each) => JSON.stringify(each))) {
    const at = left.indexOf(row);
    if (at !== -1) left.splice(at, 1);
  }
  return left.map((row) => JSON.parse(row) as T);
}

function contentOf(row: Record<string, unknown>) {
  return JSON.stringify(withStableIds(row), (key, field) => (opaque.has(key) || convexTestId.test(String(field)) ? undefined : field));
}

async function storedLinks() {
  const links = await t.run(async (ctx) => (await ctx.db.query("companyProfileLinks").collect()).map(({ member, profile, by }) => ({ member, profile, by })));
  return orderFree(links.map((link) => ({ ...link, member: namedIds.get(link.member) ?? link.member })));
}

async function idsNamedByTheirMember() {
  const named = new Map<string, string>();
  for (const person of members) {
    const member = await memberOf(person);
    named.set(member, `<member ${person.user}>`);
    const analytics = await t.run((ctx) =>
      ctx.db
        .query("analyticsIds")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique(),
    );
    if (analytics !== null) named.set(analytics.analyticsId, `<analytics ID of ${person.user}>`);
  }
  return named;
}

function slackCallsAbout(user: string) {
  return slack.calls
    .filter((call) => JSON.stringify(call).includes(user))
    .map((call) => JSON.stringify(call))
    .sort();
}

function spotlightPositionsFromTheStart() {
  let drawn = 0;
  vi.spyOn(Math, "random").mockImplementation(() => ((drawn += 1) * 0.618_033_988_7) % 1);
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(tuesday + steps * minuteMs);
}

async function thanks(giver: Person, why: string, ...recipients: Person[]) {
  nextStep();
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(steps).padStart(6, "0")}` });
  await settleInTimeOrder(t);
}

async function openHome(user: string) {
  nextStep();
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
}

async function clickInSlack(user: string, command: Command) {
  nextStep();
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, staleMenuOptionOf(command)), form));
  await settleInTimeOrder(t);
}

async function memberOf(person: Person) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row!._id;
}

async function analyticsIdOf(person: Person) {
  const member = await memberOf(person);
  const row = await t.run((ctx) =>
    ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique(),
  );
  return row!.analyticsId;
}

function freshFakes() {
  slack = new FakeSlack();
  for (const person of members) slack.withMember(person.user, { is_admin: person === alice, profile: { display_name: person.name, real_name: person.name, email: person.email } });
  slack.withUserGroup(ants, { name: "Ants", users: [alice.user, carol.user] });
  postHog = postHogDeciding();
  postHogCom = new FakePostHogCom().withTeams(hedgerow, lantern);
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
}

function urlOf(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input);
}
