import { getFunctionName, makeFunctionReference } from "convex/server";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type CapturedEvent, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, unlocksShippedBeforeAnyoneJoined, offForEveryone, onForEveryone, postHogDeciding } from "../../testing/flags";
import { blockActions, type Block } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { appHomeOpened, emoji, mention, messageEvent, reactionEvent, section, text } from "../../testing/slackMessages";
import { api, internal } from "../_generated/api";
import { publish, subscribers } from "../bus/publish";
import type { Command } from "../commands/commands";
import schema from "../schema";
import { exposed, memberDecision, workspaceDecision } from "./flags";
import { record } from "./outbox";

vi.mock("./outbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./outbox")>();
  return { ...actual, record: vi.fn(actual.record) };
});

vi.mock("./flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./flags")>();
  return { ...actual, memberDecision: vi.fn(actual.memberDecision), workspaceDecision: vi.fn(actual.workspaceDecision), exposed: vi.fn(actual.exposed) };
});

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

type Table = keyof typeof schema.tables;
type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type Capture = "on" | "off" | "failing";
type Setup = { name: string; flags: FlagDefinition[] | "no flags key"; boardShown: boolean };

const now = new Date("2026-10-13T10:00:00Z");
const stepMs = 10 * 60_000;
const dayMs = 24 * 60 * 60_000;
const stepWindowMs = 9 * 60_000;
const aTotalityOverEveryRecorderWalksSevenTimesMs = 56_000;
const mondayNine = Date.parse("2026-10-19T09:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const members = ["U_ALICE", "U_BOB"];
const everyFlag = ["xp-levels", "unlocks", "quests", "everyone-board", "collection"];
const notMemberFacing: Table[] = ["analyticsIds", "workspaceKeys", "analyticsOutbox", "recordedFacts", "analyticsDrain", "errorSweep", "watchedJobs", "reportedJobs", "flagExposures"];
const recordingJobs = ["analytics/drain:drain", "analytics/person:identifyNewPeople"];
const mondayPathRecorders = ["analytics/isolatedUsage:recordWelcomeDmSent", "analytics/isolatedUsage:recordDmLinkClicked", "analytics/isolatedUsage:recordQuestsViewed", "analytics/isolatedUsage:recordMondayDmSent"];
const mondayPathFlags = ["website", "album", "packs", "hidden-items", "welcome-item", "onboarding", "hugs", "message-settings", "monday-quest"];
const recordingWrites: Table[] = ["analyticsOutbox", "analyticsIds", "workspaceKeys", "analyticsDrain", "recordedFacts"];
const darkFeatureTables: Table[] = ["unlocks", "unlockLaunches", "questDraws", "questProgress", "rewardRecords", "leaderboardSettings"];

const everyFlagOff: Setup = { name: "every flag off", flags: everyFlag.map(offForEveryone), boardShown: false };
const flagsKeyMissing: Setup = { name: "the flags key missing", flags: "no flags key", boardShown: false };
const questsOnUnlocksOff: Setup = {
  name: "quests on and unlocks off",
  flags: [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone("quests"), onForEveryone("everyone-board")],
  boardShown: true,
};
const everyFlagOn: Setup = { name: "every flag on", flags: everyFlag.map(onForEveryone), boardShown: true };
const leaderboardRequests = ["leaderboard viewed week app home", "leaderboard viewed month app home", "leaderboard viewed all command", "leaderboard left", "leaderboard joined"];
const setups = [everyFlagOff, flagsKeyMissing, questsOnUnlocksOff, everyFlagOn];

let slack: FakeSlack;
let postHog: FakePostHog;
let actualRecord: typeof record;
let sentMessages = 0;
let steps = 0;

beforeAll(async () => {
  actualRecord = (await vi.importActual<typeof import("./outbox")>("./outbox")).record;
});

beforeEach(() => {
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.mocked(record).mockImplementation(actualRecord);
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E9 E10: analytics sends exactly the facts the features stored, whatever the flags", () => {
  test.each(setups.map((setup) => [setup.name, setup] as const))("with %s, a member's whole walk through the slice", async (_, setup) => {
    const { t, answers } = await walk(setup, "on");

    expect(answers.every(({ status }) => status === 200)).toBe(true);
    expect(await factsSent(t)).toEqual(await factsStored(t));
    expect(kudosGiven().map(({ properties }) => properties.thoughtful)).toEqual([true, true]);
    expect(eventsNamed("level reached").map(({ distinct_id, properties }) => `${distinct_id === giver() ? "giver" : "recipient"} ${String(properties.level)}`)).toEqual(["giver 2", "giver 3", "recipient 2"]);
    expect(leaderboardEvents()).toEqual(setup.boardShown ? leaderboardRequests : []);
  });

  test.each([everyFlagOff, flagsKeyMissing].map((setup) => [setup.name, setup] as const))("with %s, nothing from unlocks, quests or the board is stored or sent", async (_, setup) => {
    const { t } = await walk(setup, "on");

    expect(new Set(productEvents().map(({ event }) => event))).toEqual(new Set(["app home opened", "member welcomed", "kudos given", "kudos received", "person collected", "packs earned", "level reached", "command used"]));
    for (const table of darkFeatureTables) expect(await rowsOf(t, table), table).toEqual([]);
  });

  test("with quests on and unlocks off, readiness is sent, and nothing from quests", async () => {
    const { t } = await walk(questsOnUnlocksOff, "on");

    expect(eventsNamed("unlock made ready").map(({ distinct_id, properties }) => `${distinct_id === giver() ? "giver" : "recipient"} ${String(properties.feature)}`)).toEqual(["giver leaderboard", "giver quests", "recipient leaderboard"]);
    for (const table of ["questDraws", "rewardRecords"] as const) expect(await rowsOf(t, table), table).toEqual([]);
  });

  test("with every flag on, every event of the slice is sent", async () => {
    await walk(everyFlagOn, "on");

    expect(new Set(productEvents().map(({ event }) => event))).toEqual(
      new Set([
        "app home opened",
        "member welcomed",
        "kudos given",
        "kudos received",
        "person collected",
        "packs earned",
        "level reached",
        "unlock made ready",
        "unlock opened",
        "hoggie dropped",
        "leaderboard viewed",
        "leaderboard left",
        "leaderboard joined",
      ]),
    );
  });
});

describe("E11 O15: with capture on, off or failing, every member gets the same Slack calls, answers and changes", () => {
  test.each(setups.map((setup) => [setup.name, setup] as const))("with %s, capture off sends nothing", async (_, setup) => {
    const off = await seenWithCaptureOff(setup);

    expect(off.sent).toEqual([]);
    expect(Object.keys(off.seen.slackCalls)).toEqual(expect.arrayContaining(["U_ALICE", "U_ALICE in C1", "App Home of U_ALICE"]));
  });

  test.each(setups.map((setup) => [setup.name, setup] as const))("with %s, capture on sends events and members see what capture off shows", async (_, setup) => {
    const off = await seenWithCaptureOff(setup);
    const on = await seenAfterWalk(setup, "on");

    expect(on.sent.length).toBeGreaterThan(0);
    expect(on.seen).toEqual(off.seen);
  });

  test.each(setups.map((setup) => [setup.name, setup] as const))("with %s, failing capture sends nothing and members see what capture off shows", async (_, setup) => {
    const off = await seenWithCaptureOff(setup);
    const failing = await seenAfterWalk(setup, "failing");

    expect(failing.sent).toEqual([]);
    expect(failing.seen).toEqual(off.seen);
  });
});

describe("E11: recording a product event writes only analytics' own rows and schedules only the drain and the identify job", () => {
  test("re-running every recording job of seven whole walks with every flag on, one of new members, one over members there before the launch, one through the skill tree and the Book, one through groups whose team page completes, one through the album's tray and one through the item board ending an XP moment and closing the how-it-works card, and one down the Monday path from the welcome to the Monday DM, each with no analytics ID or workspace key yet", async () => {
    const reRun = new Set<string>();

    for (const walked of [() => walk(everyFlagOn, "on"), walkOverMembersThereBeforeTheLaunch, walkThroughTheSkillTreeAndTheBook, walkThroughGroupsToACompletedTeamPage, walkThroughTheAlbumsTray, walkThroughTheItemBoard, walkThroughTheMondayPath]) {
      const { t } = await walked();
      for (const spy of [memberDecision, workspaceDecision, exposed, publish]) expect(vi.mocked(spy), "the walk reaches the spied seams").toHaveBeenCalled();
      for (const job of [...(await recordingJobsOf(t)), commandsLeaderboardView()]) {
        await expectOnlyObserving(t, job);
        reRun.add(job.name);
      }
    }

    expect([...reRun].sort()).toEqual(everyRecorder().sort());
  }, aTotalityOverEveryRecorderWalksSevenTimesMs);
});

async function expectOnlyObserving(t: Backend, { name, args }: { name: string; args: Record<string, unknown> }) {
  await forgetWhatAnalyticsKnows(t);
  const before = await everythingByTable(t);
  const scheduledBefore = await scheduledJobIds(t);
  const slackCallsBefore = slack.calls.length;
  for (const spy of [memberDecision, workspaceDecision, exposed, publish]) vi.mocked(spy).mockClear();

  await t.mutation(makeFunctionReference<"mutation">(name), args);

  const changed = changedTables(before, await everythingByTable(t));
  expect(changed, name).toContain("analyticsOutbox");
  expect(changed.filter((table) => !recordingWrites.includes(table)), name).toEqual([]);
  expect((await newJobNames(t, scheduledBefore)).filter((job) => !recordingJobs.includes(job)), name).toEqual([]);
  expect(slack.calls.length, name).toBe(slackCallsBefore);
  expect(vi.mocked(memberDecision), `${name} read a member decision`).not.toHaveBeenCalled();
  expect(vi.mocked(workspaceDecision), `${name} read a workspace decision`).not.toHaveBeenCalled();
  expect(vi.mocked(exposed), `${name} sent an exposure`).not.toHaveBeenCalled();
  expect(vi.mocked(publish), `${name} published a domain event`).not.toHaveBeenCalled();
}

async function walkOverMembersThereBeforeTheLaunch() {
  start("on", "flags key set");
  const t = await flagsFromPostHog(testBackend(), postHog, ...everyFlag.map(onForEveryone));
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
    for (const user of ["U_ALICE", "U_BOB"]) await ctx.db.insert("members", { workspace: "T1", user, kind: "member" });
  });

  await openHome(t, "U_ALICE");
  await giveKudos(t, "U_ALICE", 11);

  expect(eventsNamed("unlock opened").map(({ properties }) => properties.by)).toContain("launch");
  expect(eventsNamed("attempt failed")).toHaveLength(1);
  return { t };
}

async function walkThroughTheSkillTreeAndTheBook() {
  start("on", "flags key set");
  const t = await flagsFromPostHog(testBackend(), postHog, ...[...everyFlag, "skill-tree", "achievements", "hugs"].map(onForEveryone));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);

  await openHome(t, "U_ALICE");
  await giveKudos(t, "U_ALICE", 1);
  await skillTreeOpenAtLevelFive(t, "U_ALICE");
  await act(t, "U_ALICE", { type: "buyPerk", perk: "spark" });
  await hug(t, "U_BOB", "U_ALICE");

  expect(eventsNamed("perk bought")).toHaveLength(1);
  expect(eventsNamed("hug given")).toHaveLength(1);
  expect(eventsNamed("achievement earned")).not.toHaveLength(0);
  return { t };
}

async function walkThroughGroupsToACompletedTeamPage() {
  start("on", "flags key set");
  const t = await flagsFromPostHog(testBackend(), postHog, ...[...everyFlag, "groups", "sticker-book", "team-pages", "team-spirit"].map(onForEveryone));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);
  for (const user of members) await openHome(t, user);
  await t.run(async (ctx) => {
    await ctx.db.insert("userGroups", { workspace: "T1", group: "S_ANTS", handle: "ants", name: "Ants", enabled: true, automatic: false, members: members.length, asOf: Date.now(), changedAt: Date.now() });
    for (const user of members) await ctx.db.insert("userGroupMembers", { workspace: "T1", group: "S_ANTS", user });
  });
  await t.mutation(internal.groups.reconcile.reconcileWorkspace, { workspace: "T1" });

  await everyoneOnOneTeam(t);
  await giveKudos(t, "U_ALICE", 1);
  expect(eventsNamed("team page completed")).toHaveLength(members.length);
  return { t };
}

async function walkThroughTheAlbumsTray() {
  start("on", "flags key set");
  aDeploymentForWorkspace();
  const t = await flagsFromPostHog(testBackend(), postHog, ...[...everyFlag, "website", "album"].map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);

  await openHome(t, "U_ALICE");
  await giveKudos(t, "U_ALICE", 1);
  const { asSignedIn } = await aSignedInSession(t, { user: "U_ALICE" });
  const album = await asSignedIn.query(api.website.album.getAlbum, {});
  for (const { pack } of "packs" in album ? album.packs : []) await asSignedIn.mutation(api.website.album.openThoughtfulPack, { pack });
  await asSignedIn.mutation(api.website.album.putAllIn, {});
  await settled(t);

  expect(eventsNamed("album sticker collected")).toHaveLength(1);
  return { t };
}

async function walkThroughTheItemBoard() {
  start("on", "flags key set");
  aDeploymentForWorkspace();
  const t = await flagsFromPostHog(testBackend(), postHog, ...[...everyFlag, "website", "album", "hidden-items", "xp-moments", "onboarding"].map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);

  await openHome(t, "U_ALICE");
  await giveKudos(t, "U_ALICE", 1);
  const { asSignedIn } = await aSignedInSession(t, { user: "U_ALICE" });
  const album = await asSignedIn.query(api.website.album.getAlbum, {});
  const waiting = "board" in album && album.board !== undefined ? album.board.items : [];
  for (const { item } of waiting) await asSignedIn.mutation(api.website.album.turnItem, { item });
  await settled(t);

  expect(waiting.length, "items waiting on the board").toBeGreaterThan(0);
  expect(eventsNamed("item turned")).toHaveLength(waiting.length);
  expect(new Set(eventsNamed("item turned").map(({ properties }) => properties.source))).toEqual(new Set(["hoggie", "sticker"]));
  await endAnXpMoment(t, asSignedIn);
  await closeTheHowItWorksCard(t);
  return { t };
}

async function walkThroughTheMondayPath() {
  start("on", "flags key set");
  aDeploymentForWorkspace();
  const t = await flagsFromPostHog(testBackend(), postHog, ...[...everyFlag, ...mondayPathFlags].map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));

  await giveKudos(t, "U_ALICE", 1);
  await pressAWelcomeLink(t, "U_ALICE");
  await viewTheQuestsPanel(t, "U_ALICE");
  await finishOnboardingAndDrawTheWeek(t, "U_ALICE");
  await mondayArrives(t);

  expect(new Set(eventsNamed("dm sent").map(({ properties }) => properties.kind))).toEqual(new Set(["welcome", "monday"]));
  expect(eventsNamed("dm link clicked").map(({ properties }) => properties.kind)).toEqual(["welcome"]);
  expect(eventsNamed("quests viewed").map(({ properties }) => properties.surface)).toEqual(["panel"]);
  expect(eventsNamed("quest drawn")).not.toHaveLength(0);
  return { t };
}

async function finishOnboardingAndDrawTheWeek(t: Backend, user: string) {
  steps += dayMs / stepMs;
  await giveKudos(t, user, 1, "now");
  await giveKudos(t, user, 1, "now");
}

async function pressAWelcomeLink(t: Backend, user: string) {
  const welcome = slack.messagesShownIn(user).find(({ blocks }) => welcomeLinksIn(blocks as Block[]).length > 0);
  if (welcome === undefined) throw new Error(`no welcome with links shown to ${user}`);
  const [link] = welcomeLinksIn(welcome.blocks as Block[]);
  nextStep();
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, { type: "button", action_id: link! }, { inMessage: welcome }), form));
  await settled(t);
}

function welcomeLinksIn(blocks: Block[] = []) {
  const buttons = blocks.flatMap((block) => [block.accessory, ...(block.elements ?? [])]) as Array<{ action_id?: string } | undefined>;
  return buttons.flatMap((button) => (button?.action_id?.startsWith("dm-link:welcome:") ? [button.action_id] : []));
}

async function viewTheQuestsPanel(t: Backend, user: string) {
  const { asSignedIn } = await aSignedInSession(t, { user });
  expect(await asSignedIn.mutation(api.website.quests.viewQuests, { surface: "panel" })).toEqual({ kind: "viewed" });
  await settled(t);
}

async function mondayArrives(t: Backend) {
  await t.mutation(internal.mondayDm.mondayDm.ensureMondayDms, {});
  await settled(t, mondayNine + stepWindowMs);
}

async function closeTheHowItWorksCard(t: Backend) {
  const { asSignedIn } = await aSignedInSession(t, { user: "U_BOB" });
  await asSignedIn.mutation(api.website.onboarding.closeHowItWorks, { triedSlack: true });
  await settled(t);
  expect(eventsNamed("onboarding card closed").map(({ properties }) => properties.tried_slack)).toEqual([true]);
}

async function endAnXpMoment(t: Backend, asSignedIn: Pick<Backend, "query" | "mutation">) {
  await asSignedIn.mutation(api.website.lastVisit.arrive, { from: null });
  await giveKudos(t, "U_ALICE", 1);
  const moment = await asSignedIn.query(api.website.xpMoment.getXpMoment, {});
  if (moment.kind !== "moment") throw new Error(`expected an XP moment, got ${moment.kind}`);
  await asSignedIn.mutation(api.website.xpMoment.endXpMoment, { from: moment.since, until: moment.until, skipped: false });
  await settled(t);
  expect(eventsNamed("xp moment ended")).toHaveLength(1);
}

async function everyoneOnOneTeam(t: Backend) {
  await t.run(async (ctx) => {
    const profiles = members.map((_, index) => 10_000 + index);
    for (const [index, user] of members.entries()) {
      const member = (await ctx.db
        .query("members")
        .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
        .unique())!._id;
      await ctx.db.insert("companyProfiles", { profile: profiles[index]!, firstName: "Profile", lastName: `Person${index}`, normalisedName: `profile person${index}`, colour: "#8567FF", teams: ["lantern"], asOf: Date.now() });
      await ctx.db.insert("companyProfileLinks", { workspace: "T1", member, profile: profiles[index]!, by: "self", setBy: member, at: Date.now() });
    }
    await ctx.db.insert("companyTeams", { team: "lantern", name: "Lantern", leads: [], people: profiles, asOf: Date.now() });
  });
}

async function skillTreeOpenAtLevelFive(t: Backend, user: string) {
  await t.run(async (ctx) => {
    const member = (await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique())!._id;
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp: 600 });
    await ctx.db.insert("unlocks", { member, feature: "skillTree", readyAt: Date.now(), openedAt: Date.now() });
  });
}

function everyRecorder() {
  const subscribed = Object.values(subscribers)
    .flat()
    .map((subscription) => getFunctionName("subscriber" in subscription ? subscription.subscriber : subscription))
    .filter((name) => name.startsWith("analytics/"));
  return [...new Set(subscribed), "analytics/isolatedUsage:recordLeaderboardViewed", "analytics/isolatedUsage:recordLeaderboardVisibilityChanged", "analytics/isolatedUsage:recordXpMomentEnded", "analytics/isolatedUsage:recordHowItWorksClosed", ...mondayPathRecorders, "slack/commands:recordLeaderboardViewed"];
}

async function walk(setup: Setup, capture: Capture) {
  start(capture, setup.flags === "no flags key" ? "no flags key" : "flags key set");
  const t = setup.flags === "no flags key" ? testBackend() : await flagsFromPostHog(testBackend(), postHog, ...setup.flags);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);
  const answers: Array<{ status: number; body: string }> = [];
  const answered = async (response: Response) => answers.push({ status: response.status, body: await response.text() });

  await answered(await openHome(t, "U_ALICE"));
  await answered(await giveKudos(t, "U_ALICE", 2));
  await answered(await act(t, "U_ALICE", { type: "openUnlock", feature: "leaderboard" }));
  await answered(await giveKudos(t, "U_ALICE", 8));
  await answered(await act(t, "U_ALICE", { type: "openUnlock", feature: "quests" }));
  await answered(await act(t, "U_ALICE", { type: "showHomeTab", tab: "leaderboard" }));
  await answered(await act(t, "U_ALICE", { type: "showLeaderboard", period: "month" }));
  await answered(await hedgehug(t, "U_ALICE", "leaderboard all"));
  await answered(await act(t, "U_ALICE", { type: "setLeaderboardVisibility", visible: false }));
  await answered(await act(t, "U_ALICE", { type: "setLeaderboardVisibility", visible: true }));

  return { t, answers };
}

function start(capture: Capture, flagsKey: "flags key set" | "no flags key") {
  vi.useFakeTimers({ now });
  sentMessages = 0;
  steps = 0;
  slack = members.reduce((fake, user) => fake.withMember(user), new FakeSlack());
  postHog = postHogDeciding("sandbox");
  if (flagsKey === "no flags key") vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  if (capture === "off") vi.stubEnv("KUDOS_ENVIRONMENT", "");
  vi.mocked(record).mockImplementation(capture === "failing" ? failingForProductEvents : actualRecord);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}

const failingForProductEvents: typeof record = async (ctx, workspace, events) => {
  if (events.every(({ event }) => event === "$feature_flag_called")) return actualRecord(ctx, workspace, events);
  throw new Error("recording failed");
};

const walkedWithCaptureOff = new Map<Setup, ReturnType<typeof seenAfterWalk>>();

function seenWithCaptureOff(setup: Setup) {
  if (!walkedWithCaptureOff.has(setup)) walkedWithCaptureOff.set(setup, seenAfterWalk(setup, "off"));
  return walkedWithCaptureOff.get(setup)!;
}

async function seenAfterWalk(setup: Setup, capture: Capture) {
  const seen = await seenByMembers(await walk(setup, capture));
  return { seen, sent: productEvents() };
}

async function seenByMembers({ t, answers }: Awaited<ReturnType<typeof walk>>) {
  const stored = await everythingByTable(t);
  const memberFacing = Object.fromEntries(Object.entries(stored).filter(([table]) => !notMemberFacing.includes(table as Table)));
  memberFacing.slackReceipts = stored.slackReceipts.map(({ eventId: _numberedPerProcess, ...receipt }) => receipt as Row);
  return { answers, slackCalls: callsByConversationInAnyOrder(), appHomesShown: appHomesShown(), stored: withStableIds(memberFacing) };
}

function appHomesShown() {
  return Object.fromEntries(members.map((user) => [user, slack.homeShownTo(user)]));
}

function callsByConversationInAnyOrder() {
  const conversations: Record<string, Array<{ method: string; args: Record<string, unknown> }>> = {};
  for (const { method, args } of slack.calls) {
    const conversation = conversationOf(method, args);
    (conversations[conversation] ??= []).push({ method, args });
  }
  for (const calls of Object.values(conversations)) calls.sort((one, other) => serialized(one).localeCompare(serialized(other)));
  return conversations;
}

function conversationOf(method: string, args: Record<string, unknown>) {
  if (method === "views.publish") return `App Home of ${String(args.user_id)}`;
  if (method === "chat.postEphemeral") return `${String(args.user)} in ${String(args.channel)}`;
  return typeof args.channel === "string" ? args.channel : method;
}

async function openHome(t: Backend, user: string) {
  nextStep();
  const response = await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settled(t);
  return response;
}

async function giveKudos(t: Backend, giver: string, kudos: number, postedFrom: "the walk's start" | "now" = "the walk's start") {
  nextStep();
  sentMessages += 1;
  const blocks = [section(mention("U_BOB"), text(` ${saysWhy} `), ...Array.from({ length: kudos }, () => emoji("taco")))];
  const postedAfter = postedFrom === "now" ? Date.now() : now.getTime();
  const response = await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${postedAfter / 1000 + sentMessages}.000100` })));
  await settled(t);
  return response;
}

async function hug(t: Backend, giver: string, author: string) {
  nextStep();
  const response = await t.fetch("/slack/events", await signedRequest(reactionEvent({ user: giver, itemUser: author, ts: `${Math.floor(Date.now() / 1000) - 60}.000100` })));
  await settled(t);
  return response;
}

async function act(t: Backend, user: string, command: Command) {
  nextStep();
  const value = JSON.stringify(command);
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, { type: "button", action_id: value, value }), form));
  await settled(t);
  return response;
}

async function hedgehug(t: Backend, user: string, words: string) {
  nextStep();
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text: words,
    response_url: "https://hooks.slack.com/commands/T1/1/abc",
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, form));
  await settled(t);
  return response;
}

async function settled(t: Backend, until = Date.now() + stepWindowMs) {
  for (let fired = 0; fired < 500; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    const next = await nextJobAt(t);
    if (next === null || next > until) return;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("settled: more than 500 timers fired");
}

async function nextJobAt(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const waiting = jobs.filter(({ state }) => state.kind === "pending" || state.kind === "inProgress");
  return waiting.length === 0 ? null : Math.min(...waiting.map(({ scheduledTime }) => scheduledTime));
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(now.getTime() + steps * stepMs);
}

async function factsStored(t: Backend) {
  const draws = (await rowsOf(t, "questDraws")) as unknown as Array<{ week: string; slots: Array<{ slot: number; quest: string }> }>;
  const facts = [
    ...(await rowsOf(t, "levelUps")).map((row) => `${String(row.member)} level reached ${String(row.level)}`),
    ...(await rowsOf(t, "unlocks")).flatMap((row) => [
      ...(row.readyAt === row.openedAt ? [] : [`${String(row.member)} unlock made ready ${String(row.feature)}`]),
      ...(row.openedAt === undefined ? [] : [`${String(row.member)} unlock opened ${String(row.feature)}`]),
    ]),
    ...(await rowsOf(t, "questDraws")).flatMap((row) => (row.slots as Array<{ quest: string }>).map(({ quest }) => `${String(row.member)} quest drawn ${quest}`)),
    ...(await rowsOf(t, "rewardRecords")).map((row) => `${String(row.member)} quest finished ${questOfKey(row.key)} ${String(row.xp)} ${String(row.coins)}`),
  ];
  return facts.sort();

  function questOfKey(key: unknown) {
    const [kind, weekOrStep, slot] = String(key).split(":");
    if (kind === "journey") return `journey ${weekOrStep}`;
    const drawn = draws.find((draw) => draw.week === weekOrStep)?.slots.find((drawnSlot) => drawnSlot.slot === Number(slot));
    return `weekly ${drawn?.quest}`;
  }
}

async function factsSent(t: Backend) {
  const memberOf = new Map((await rowsOf(t, "analyticsIds")).map((row) => [row.analyticsId as string, String(row.member)]));
  const fact = ({ event, distinct_id, properties }: CapturedEvent) => {
    const on = `${memberOf.get(distinct_id)} ${event}`;
    switch (event) {
      case "level reached":
        return [`${on} ${String(properties.level)}`];
      case "unlock made ready":
      case "unlock opened":
        return [`${on} ${String(properties.feature)}`];
      case "quest drawn":
        return [`${on} ${String(properties.quest)}`];
      case "quest finished":
        return [`${on} ${String(properties.kind)} ${String(properties.quest)} ${String(properties.xp)} ${String(properties.coins)}`];
      default:
        return [];
    }
  };
  return productEvents().flatMap(fact).sort();
}

async function recordingJobsOf(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name.startsWith("analytics/subscribers:") || name.startsWith("analytics/isolatedUsage:")).map(({ name, args }) => ({ name, args: args[0] as Record<string, unknown> }));
}

function commandsLeaderboardView() {
  return { name: "slack/commands:recordLeaderboardViewed", args: { workspace: "T1", user: "U_ALICE", period: "all", arrivedAt: Date.now() } };
}

async function forgetWhatAnalyticsKnows(t: Backend) {
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("analyticsIds").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("workspaceKeys").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("recordedFacts").collect()) await ctx.db.delete(row._id);
  });
}

async function scheduledJobIds(t: Backend) {
  return new Set((await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).map(({ _id }) => _id));
}

async function newJobNames(t: Backend, before: Set<string>) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ _id }) => !before.has(_id)).map(({ name }) => name);
}

async function everythingByTable(t: Backend): Promise<Record<Table, Row[]>> {
  const tables = Object.keys(schema.tables) as Table[];
  return t.run(async (ctx) => Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await ctx.db.query(table).collect()] as const))) as unknown as Record<Table, Row[]>);
}

function changedTables(before: Record<Table, Row[]>, after: Record<Table, Row[]>) {
  return (Object.keys(after) as Table[]).filter((table) => serialized(before[table]) !== serialized(after[table]));
}

function serialized(value: unknown) {
  return JSON.stringify(value, (_, inner: unknown) => (typeof inner === "bigint" ? inner.toString() : inner));
}

async function rowsOf(t: Backend, table: Table): Promise<Row[]> {
  return t.run(async (ctx) => (await ctx.db.query(table).collect()) as unknown as Row[]);
}

const writtenByConcurrentFollowers: Table[] = ["items", "levelUps"];

function withStableIds(stored: Record<string, Row[]>) {
  return withLabelledIds(withDrawPositionsHidden(withConcurrentWritesInContentOrder(stored)));
}

function withConcurrentWritesInContentOrder(stored: Record<string, Row[]>): Record<string, Row[]> {
  const content = ({ _id: _labelled, _creationTime: _timed, ...row }: Row) => serialized(row);
  return { ...stored, ...Object.fromEntries(writtenByConcurrentFollowers.filter((table) => stored[table]).map((table) => [table, stored[table]!.toSorted((one, other) => content(one).localeCompare(content(other)))])) };
}

function withDrawPositionsHidden(stored: Record<string, Row[]>): Record<string, Row[]> {
  const hidden = (row: Row) => ({ ...row, position: typeof row.position === "number" && row.position >= 0 && row.position < 1 ? "random in [0, 1)" : row.position });
  return { ...stored, ...(stored.spotlightDraws && { spotlightDraws: stored.spotlightDraws.map(hidden) }) };
}

function withLabelledIds(stored: Record<string, Row[]>) {
  const labels = new Map<string, string>();
  for (const [table, rows] of Object.entries(stored)) rows.forEach((row, index) => labels.set(row._id, `${table}#${index}`));
  const relabelled = (value: unknown): unknown => {
    if (typeof value === "string") return labels.get(value) ?? withKeyedIdLabelled(value, labels);
    if (Array.isArray(value)) return value.map(relabelled);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "_creationTime").map(([key, inner]) => [key, relabelled(inner)]));
    return value;
  };
  return relabelled(stored);
}

function withKeyedIdLabelled(value: string, labels: Map<string, string>) {
  const [kind, id] = value.split(":");
  const label = id === undefined ? undefined : labels.get(id);
  return label === undefined ? value : `${kind}:${label}`;
}

function productEvents(): CapturedEvent[] {
  return postHog.productEvents().filter((event) => event.event !== "$feature_flag_called");
}

function eventsNamed(...names: string[]) {
  return productEvents().filter(({ event }) => names.includes(event));
}

function leaderboardEvents() {
  return eventsNamed("leaderboard viewed", "leaderboard left", "leaderboard joined").map(({ event, properties }) =>
    event === "leaderboard viewed" ? `${event} ${String(properties.period)} ${String(properties.surface)}` : event,
  );
}

function giver() {
  return kudosGiven()[0]!.distinct_id;
}

function kudosGiven() {
  return eventsNamed("kudos given");
}
