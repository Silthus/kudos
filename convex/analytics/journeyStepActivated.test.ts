import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { onForEveryone, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { routedFetch, type CapturedEvent, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHomeBlocks, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { internal } from "../_generated/api";
import { publish } from "../bus/publish";
import type { QuestId } from "../quests/pool";
import type { Feature } from "../unlocks/feature";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const everyFlag = ["xp-levels", "unlocks", "quests", "everyone-board"];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E1 P88: a new member's Journey steps send journey step activated as they become active", () => {
  test("a new member's first App Home publish activates first-thanks and sends it once, on them at the publish; opening App Home again sends nothing", async () => {
    const t = await newMembersWith(...everyFlag);

    await openHome(t, "U_ALICE");
    vi.setSystemTime(now.getTime() + minuteMs);
    await openHome(t, "U_ALICE");

    expect(stepsActivated()).toEqual([
      {
        event: "journey step activated",
        distinct_id: homeOpenerId(),
        uuid: expect.stringMatching(uuid),
        timestamp: now.toISOString(),
        properties: { ...shared, step: "first-thanks" },
      },
    ]);
  });

  test("E7: a new member's first kudos activates first-thanks at the kudos and sends it once, even when Slack redelivers the message", async () => {
    const t = await newMembersWith(...everyFlag);
    const body = kudosMessage("U_ALICE", "U_BOB", saysWhy);

    await t.fetch("/slack/events", await signedRequest(body));
    await t.fetch("/slack/events", await signedRequest(body));
    await settleInTimeOrder(t);

    const [award] = await t.run((ctx) => ctx.db.query("awards").collect());
    expect(stepsActivatedOn(giverId()).map(({ timestamp, properties }) => ({ timestamp, properties }))).toEqual([
      { timestamp: new Date(award!.at).toISOString(), properties: { ...shared, step: "first-thanks" } },
    ]);
  });

  test("opening Quests sends first-quest at the opening", async () => {
    const t = await newMembersWith(...everyFlag);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await reachesLevel(t, await memberOf(t, "U_ALICE"), 3);
    await openHome(t, "U_ALICE");
    await drawFor(t, "U_ALICE", ["say-why", "say-why-twice", "say-why-three-times"]);
    const openedAt = aMinuteLater();

    await click(t, "U_ALICE", openButtonInHome("U_ALICE", "quests"));

    expect(stepsActivatedOn(giverId()).map(stepAndTime)).toEqual([
      { step: "first-thanks", timestamp: now.toISOString() },
      { step: "first-quest", timestamp: new Date(openedAt).toISOString() },
    ]);
  });

  test("opening the Leaderboard sends someone-new at the opening, and a replayed opening, which finds it active, sends nothing more", async () => {
    const t = await newMembersWith(...everyFlag);
    await directoryKnows(t, "U_BOB");
    await leaderboardReady(t, "U_ALICE");
    const openedAt = aMinuteLater();

    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));
    await replayLeaderboardOpened(t, "U_ALICE", openedAt);

    expect(stepsActivatedOn(homeOpenerId()).map(stepAndTime)).toEqual([
      { step: "first-thanks", timestamp: now.toISOString() },
      { step: "someone-new", timestamp: new Date(openedAt).toISOString() },
    ]);
  });
});

describe("E1 P91: the Journey's join for members already playing", () => {
  test("sends one journey step activated per step it activates, at the ship, including steps it finishes at once", async () => {
    const t = await workspaceWith("xp-levels", "unlocks", "everyone-board");
    await directoryKnows(t, "U_ALICE");
    await directoryKnows(t, "U_BOB");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await unlocksShippedBeforeAnyoneJoined(t);

    await flagsFromPostHog(t, postHog, ...everyFlag.map(onForEveryone));
    const shipped = aMinuteLater();
    await hourlySweep(t);

    const activations = stepsActivated().map(({ distinct_id, timestamp, properties }) => `${distinct_id} ${properties.step as string} ${timestamp}`);
    const at = new Date(shipped).toISOString();
    expect(activations.sort()).toEqual(
      [`${giverId()} first-thanks ${at}`, `${giverId()} someone-new ${at}`, `${recipientId()} first-thanks ${at}`, `${recipientId()} someone-new ${at}`].sort(),
    );
    expect(await rewardTimesOf(t, "U_ALICE")).toEqual({ "journey:first-thanks": shipped, "journey:someone-new": shipped });
  });

  test("a step the join finishes at once sends journey step activated before its quest finished", async () => {
    const t = await workspaceWith("xp-levels", "unlocks", "everyone-board");
    await directoryKnows(t, "U_ALICE");
    await directoryKnows(t, "U_BOB");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await unlocksShippedBeforeAnyoneJoined(t);

    await flagsFromPostHog(t, postHog, ...everyFlag.map(onForEveryone));
    await hourlySweep(t);

    expect(journeyFactsPublishedFor(await memberOf(t, "U_ALICE"))).toEqual([
      "journeyStepActivated first-thanks",
      "questFinished first-thanks",
      "journeyStepActivated someone-new",
      "questFinished someone-new",
    ]);
    const alice = giverId();
    expect(journeyEventsSentOn(alice)).toEqual(["journey step activated first-thanks", "quest finished first-thanks", "journey step activated someone-new", "quest finished someone-new"]);
  });
});

describe("E10: with quests off", () => {
  test("nothing activates and no journey step activated is sent", async () => {
    const t = await newMembersWith("xp-levels", "unlocks", "everyone-board");

    await openHome(t, "U_ALICE");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await t.run((ctx) => ctx.db.query("journeySteps").collect())).toEqual([]);
    expect(productEvents().map(({ event }) => event)).toContain("kudos given");
    expect(stepsActivated()).toEqual([]);
  });
});

async function newMembersWith(...flags: string[]) {
  return journeyShippedBeforeAnyoneJoined(await workspaceWith(...flags));
}

async function workspaceWith(...flags: string[]) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags.map(onForEveryone));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

function kudosMessage(giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  return messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000}.00010${sentMessages}` });
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  await t.fetch("/slack/events", await signedRequest(kudosMessage(giver, recipient, words)));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settleInTimeOrder(t);
}

function openButtonInHome(user: string, feature: Feature) {
  const command = JSON.stringify({ type: "openUnlock", feature });
  const block = publishedHomeBlocks(slack, user).find((candidate) => candidate.accessory?.value === command);
  return buttonIn([block!], "Open");
}

async function hourlySweep(t: Backend) {
  await t.mutation(internal.quests.newWeek.sweep, {});
  await settleInTimeOrder(t);
}

function aMinuteLater() {
  vi.setSystemTime(Date.now() + minuteMs);
  return Date.now();
}

async function directoryKnows(t: Backend, user: string) {
  await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
}

async function leaderboardReady(t: Backend, user: string) {
  await openHome(t, user);
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("unlocks", { member, feature: "leaderboard", readyAt: Date.now() }));
  await openHome(t, user);
}

async function replayLeaderboardOpened(t: Backend, user: string, at: number) {
  await t.mutation(internal.quests.journey.activateJourney, { event: { type: "unlockOpened", workspace: "T1", member: await memberOf(t, user), feature: "leaderboard", at } });
  await settleInTimeOrder(t);
}

async function drawFor(t: Backend, user: string, quests: QuestId[]) {
  const member = await memberOf(t, user);
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: Date.now(), slots }));
}

async function rewardTimesOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const records = await t.run(async (ctx) => (await ctx.db.query("rewardRecords").collect()).filter((record) => record.member === member));
  return Object.fromEntries(records.map(({ key, at }) => [key, at]));
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}

function journeyFactsPublishedFor(member: MemberId) {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .flatMap((event) => {
      if (event.type === "journeyStepActivated" && event.member === member) return [`${event.type} ${event.step}`];
      if (event.type === "questFinished" && event.member === member && event.quest.kind === "journey") return [`${event.type} ${event.quest.step}`];
      return [];
    });
}

function journeyEventsSentOn(distinctId: string) {
  return productEvents()
    .filter((event) => event.distinct_id === distinctId && (event.event === "journey step activated" || event.properties.kind === "journey"))
    .map(({ event, properties }) => `${event} ${String(properties.step ?? properties.quest)}`);
}

function productEvents(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event !== "$feature_flag_called");
}

function stepsActivated() {
  return productEvents().filter((event) => event.event === "journey step activated");
}

function stepsActivatedOn(distinctId: string) {
  return stepsActivated().filter((event) => event.distinct_id === distinctId);
}

function stepAndTime({ properties, timestamp }: CapturedEvent) {
  return { step: properties.step, timestamp };
}

function homeOpenerId() {
  return productEvents().find((event) => event.event === "app home opened")!.distinct_id;
}

function giverId() {
  return productEvents().find((event) => event.event === "kudos given")!.distinct_id;
}

function recipientId() {
  return productEvents().find((event) => event.event === "kudos received")!.distinct_id;
}
