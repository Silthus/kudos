import { makeFunctionReference } from "convex/server";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type CapturedEvent, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEveryone, postHogDeciding } from "../../testing/flags";
import { blockActions } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Command } from "../commands/commands";
import schema from "../schema";
import { record } from "./outbox";

vi.mock("./outbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./outbox")>();
  return { ...actual, record: vi.fn(actual.record) };
});

type Table = keyof typeof schema.tables;
type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type Capture = "on" | "off" | "failing";
type Setup = { name: string; flags: FlagDefinition[] | "no flags key" };

const now = new Date("2026-10-13T10:00:00Z");
const realSetTimeout = globalThis.setTimeout;
const idleAfterMs = 200;
const stepMs = 10 * 60_000;
const stepWindowMs = 9 * 60_000;
const week = "2026-10-12";
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const everyFlag = ["xp-levels", "unlocks", "quests", "everyone-board"];
const notMemberFacing: Table[] = ["slackReceipts", "analyticsIds", "workspaceKeys", "analyticsOutbox", "analyticsDrain", "errorSweep", "watchedJobs", "reportedJobs", "flagExposures"];
const recordingWrites: Table[] = ["analyticsOutbox", "analyticsIds", "workspaceKeys", "analyticsDrain"];
const darkFeatureTables: Table[] = ["unlocks", "unlockLaunches", "journeyLaunches", "journeySteps", "questDraws", "questSwaps", "questProgress", "rewardRecords", "crateOpenings", "leaderboardSettings"];

const everyFlagOff: Setup = { name: "every flag off", flags: everyFlag.map(offForEveryone) };
const flagsKeyMissing: Setup = { name: "the flags key missing", flags: "no flags key" };
const questsOnUnlocksOff: Setup = { name: "quests on and unlocks off", flags: [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone("quests"), onForEveryone("everyone-board")] };
const everyFlagOn: Setup = { name: "every flag on", flags: everyFlag.map(onForEveryone) };
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
  });

  test.each([everyFlagOff, flagsKeyMissing].map((setup) => [setup.name, setup] as const))("with %s, nothing from unlocks, quests or the board is stored or sent", async (_, setup) => {
    const { t } = await walk(setup, "on");

    expect(new Set(productEvents().map(({ event }) => event))).toEqual(new Set(["app home opened", "member welcomed", "kudos given", "kudos received", "level reached", "command used"]));
    for (const table of darkFeatureTables) expect(await rowsOf(t, table), table).toEqual([]);
  });

  test("with quests on and unlocks off, readiness and the board are sent, and nothing from quests", async () => {
    const { t } = await walk(questsOnUnlocksOff, "on");

    expect(eventsNamed("unlock made ready").map(({ distinct_id, properties }) => `${distinct_id === giver() ? "giver" : "recipient"} ${String(properties.feature)}`)).toEqual(["giver quests", "giver leaderboard", "recipient quests"]);
    expect(eventsNamed("leaderboard viewed").map(({ properties }) => `${String(properties.period)} ${String(properties.surface)}`)).toEqual(["week app home", "month app home", "all command"]);
    expect(eventsNamed("leaderboard left", "leaderboard joined").map(({ event }) => event)).toEqual(["leaderboard left", "leaderboard joined"]);
    for (const table of ["journeySteps", "questDraws", "questSwaps", "rewardRecords", "crateOpenings"] as const) expect(await rowsOf(t, table), table).toEqual([]);
  });

  test("with every flag on, every event of the slice is sent", async () => {
    await walk(everyFlagOn, "on");

    expect(new Set(productEvents().map(({ event }) => event))).toEqual(
      new Set([
        "app home opened",
        "member welcomed",
        "kudos given",
        "kudos received",
        "level reached",
        "unlock made ready",
        "unlock opened",
        "journey step activated",
        "quest drawn",
        "quest swapped",
        "quest finished",
        "crate opened",
        "leaderboard viewed",
        "leaderboard left",
        "leaderboard joined",
      ]),
    );
  });

  test("the Journey's join, queued before quests is switched off, still runs and sends exactly the steps it stores", async () => {
    start("on", "flags key set");
    const t = await flagsFromPostHog(testBackend(), postHog, ...["xp-levels", "unlocks", "everyone-board"].map(onForEveryone));
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
    await giveKudos(t, "U_ALICE", 2);

    await flagsFromPostHog(t, postHog, ...everyFlag.map(onForEveryone));
    await t.mutation(internal.quests.newWeek.sweep, {});
    await flagsFromPostHog(t, postHog, ...everyFlag.filter((flag) => flag !== "quests").map(onForEveryone), offForEveryone("quests"));
    await settled(t);

    expect((await rowsOf(t, "journeySteps")).length).toBeGreaterThan(0);
    expect(eventsNamed("journey step activated").length).toBeGreaterThan(0);
    expect(await factsSent(t)).toEqual(await factsStored(t));
  });
});

describe("E11 O15: with capture on, off or failing, every member gets the same Slack calls, answers and changes", () => {
  test.each(setups.map((setup) => [setup.name, setup] as const))("with %s", async (_, setup) => {
    const off = await seenByMembers(await walk(setup, "off"));
    const offSent = productEvents();
    const on = await seenByMembers(await walk(setup, "on"));
    const onSent = productEvents();
    const failing = await seenByMembers(await walk(setup, "failing"));
    const failingSent = productEvents();

    expect(offSent).toEqual([]);
    expect(failingSent).toEqual([]);
    expect(onSent.length).toBeGreaterThan(0);
    expect(on).toEqual(off);
    expect(failing).toEqual(off);
    expect(Object.keys(off.slackCalls)).toEqual(expect.arrayContaining(["U_ALICE", "U_ALICE in C1", "App Home of U_ALICE"]));
  });
});

describe("E11: recording a product event writes only analytics' own rows and schedules only the drain", () => {
  test("re-running every recording job of a whole walk with every flag on, each with no analytics ID or workspace key yet", async () => {
    const { t } = await walk(everyFlagOn, "on");
    const jobs = [...(await recordingJobsOf(t)), commandsLeaderboardView()];
    expect(new Set(jobs.map(({ name }) => name))).toEqual(
      new Set([
        "analytics/subscribers:recordKudosGiven",
        "analytics/subscribers:recordMemberWelcomed",
        "analytics/subscribers:recordLevelReached",
        "analytics/subscribers:recordUnlockReady",
        "analytics/subscribers:recordUnlockOpened",
        "analytics/subscribers:recordJourneyStepActivated",
        "analytics/subscribers:recordQuestsDrawn",
        "analytics/subscribers:recordQuestSwapped",
        "analytics/subscribers:recordQuestFinished",
        "analytics/subscribers:recordQuestOpened",
        "analytics/isolatedUsage:recordLeaderboardViewed",
        "analytics/isolatedUsage:recordLeaderboardVisibilityChanged",
        "slack/commands:recordLeaderboardViewed",
      ]),
    );

    for (const { name, args } of jobs) {
      await forgetAnalyticsIdentities(t);
      const before = await everythingByTable(t);
      const scheduledBefore = await scheduledJobIds(t);
      const slackCallsBefore = slack.calls.length;

      await t.mutation(makeFunctionReference<"mutation">(name), args);

      const after = await everythingByTable(t);
      expect(changedTables(before, after), name).toEqual(expect.arrayContaining(["analyticsOutbox"]));
      expect(changedTables(before, after).filter((table) => !recordingWrites.includes(table)), name).toEqual([]);
      expect((await newJobNames(t, scheduledBefore)).filter((job) => job !== "analytics/drain:drain"), name).toEqual([]);
      expect(slack.calls.length, name).toBe(slackCallsBefore);
    }
  });
});

async function walk(setup: Setup, capture: Capture) {
  start(capture, setup.flags === "no flags key" ? "no flags key" : "flags key set");
  const t = setup.flags === "no flags key" ? testBackend() : await flagsFromPostHog(testBackend(), postHog, ...setup.flags);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await journeyShippedBeforeAnyoneJoined(t);
  const answers: Array<{ status: number; body: string }> = [];
  const answered = async (response: Response) => answers.push({ status: response.status, body: await response.text() });

  await answered(await openHome(t, "U_ALICE"));
  await answered(await giveKudos(t, "U_ALICE", 2));
  await answered(await act(t, "U_ALICE", { type: "openUnlock", feature: "quests" }));
  await answered(await act(t, "U_ALICE", { type: "rerollQuest", quest: { kind: "weekly", week, slot: 0 } }));
  await answered(await act(t, "U_ALICE", { type: "openQuestCrate", quest: { kind: "journey", step: "first-thanks" } }));
  await answered(await giveKudos(t, "U_ALICE", 8));
  await answered(await act(t, "U_ALICE", { type: "openUnlock", feature: "leaderboard" }));
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
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
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

async function seenByMembers({ t, answers }: Awaited<ReturnType<typeof walk>>) {
  const stored = await everythingByTable(t);
  const memberFacing = Object.fromEntries(Object.entries(stored).filter(([table]) => !notMemberFacing.includes(table as Table)));
  return { answers, slackCalls: callsByConversation(), stored: withStableIds(memberFacing) };
}

function callsByConversation() {
  const conversations: Record<string, Array<{ method: string; args: Record<string, unknown> }>> = {};
  for (const { method, args } of slack.calls) {
    const conversation = conversationOf(method, args);
    (conversations[conversation] ??= []).push({ method, args });
  }
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

async function giveKudos(t: Backend, giver: string, kudos: number) {
  nextStep();
  sentMessages += 1;
  const blocks = [section(mention("U_BOB"), text(` ${saysWhy} `), ...Array.from({ length: kudos }, () => emoji("taco")))];
  const response = await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
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

async function settled(t: Backend) {
  const until = Date.now() + stepWindowMs;
  for (let fired = 0; fired < 500; fired += 1) {
    await Promise.race([t.finishInProgressScheduledFunctions(), new Promise((resolve) => realSetTimeout(resolve, idleAfterMs))]);
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
  const facts = [
    ...(await rowsOf(t, "levelUps")).map((row) => `${String(row.member)} level reached ${String(row.level)}`),
    ...(await rowsOf(t, "unlocks")).flatMap((row) => [
      ...(row.readyAt === row.openedAt ? [] : [`${String(row.member)} unlock made ready ${String(row.feature)}`]),
      ...(row.openedAt === undefined ? [] : [`${String(row.member)} unlock opened ${String(row.feature)}`]),
    ]),
    ...(await rowsOf(t, "journeySteps")).map((row) => `${String(row.member)} journey step activated ${String(row.step)}`),
    ...(await rowsOf(t, "questDraws")).flatMap((row) => (row.slots as Array<{ quest: string }>).map(({ quest }) => `${String(row.member)} quest drawn ${quest}`)),
    ...(await rowsOf(t, "questSwaps")).map((row) => `${String(row.member)} quest swapped ${String(row.replaced)} ${(row.swappedIn as { quest: string }).quest}`),
    ...(await rowsOf(t, "rewardRecords")).map((row) => `${String(row.member)} quest finished ${kindOfKey(row.key)} ${String(row.xp)} ${String(row.coins)}`),
    ...(await rowsOf(t, "crateOpenings")).map((row) => `${String(row.member)} crate opened ${kindOfKey(row.key)}`),
  ];
  return facts.sort();
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
      case "journey step activated":
        return [`${on} ${String(properties.step)}`];
      case "quest drawn":
        return [`${on} ${String(properties.quest)}`];
      case "quest swapped":
        return [`${on} ${String(properties.replaced)} ${String(properties.quest)}`];
      case "quest finished":
        return [`${on} ${String(properties.kind)} ${String(properties.xp)} ${String(properties.coins)}`];
      case "crate opened":
        return [`${on} ${String(properties.kind)}`];
      default:
        return [];
    }
  };
  return productEvents().flatMap(fact).sort();
}

function kindOfKey(key: unknown) {
  return String(key).split(":")[0];
}

async function recordingJobsOf(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name.startsWith("analytics/subscribers:") || name.startsWith("analytics/isolatedUsage:")).map(({ name, args }) => ({ name, args: args[0] as Record<string, unknown> }));
}

function commandsLeaderboardView() {
  return { name: "slack/commands:recordLeaderboardViewed", args: { workspace: "T1", user: "U_ALICE", period: "all", arrivedAt: Date.now() } };
}

async function forgetAnalyticsIdentities(t: Backend) {
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("analyticsIds").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("workspaceKeys").collect()) await ctx.db.delete(row._id);
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
  return Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await rowsOf(t, table)] as const))) as Record<Table, Row[]>;
}

function changedTables(before: Record<Table, Row[]>, after: Record<Table, Row[]>) {
  return (Object.keys(after) as Table[]).filter((table) => serialized(before[table]) !== serialized(after[table]));
}

function serialized(rows: Row[]) {
  return JSON.stringify(rows, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value));
}

async function rowsOf(t: Backend, table: Table): Promise<Row[]> {
  return t.run(async (ctx) => (await ctx.db.query(table).collect()) as unknown as Row[]);
}

function withStableIds(stored: Record<string, Row[]>) {
  const labels = new Map<string, string>();
  for (const [table, rows] of Object.entries(stored)) rows.forEach((row, index) => labels.set(row._id, `${table}#${index}`));
  const relabelled = (value: unknown): unknown => {
    if (typeof value === "string") return labels.get(value) ?? value;
    if (Array.isArray(value)) return value.map(relabelled);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "_creationTime").map(([key, inner]) => [key, relabelled(inner)]));
    return value;
  };
  return relabelled(stored);
}

function productEvents(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event !== "$feature_flag_called");
}

function eventsNamed(...names: string[]) {
  return productEvents().filter(({ event }) => names.includes(event));
}

function giver() {
  return kudosGiven()[0]!.distinct_id;
}

function kudosGiven() {
  return eventsNamed("kudos given");
}
