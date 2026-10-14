import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type CapturedEvent, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonIn, type Block } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Feature } from "../unlocks/feature";

const now = new Date("2026-10-13T10:00:00Z");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const form = { contentType: "application/x-www-form-urlencoded" };

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E1 P73: a level up makes a feature ready, and Open opens it", () => {
  test("with xp-levels and unlocks on and Quests shipped, reaching level 2 sends unlock made ready for quests; Open in the level-up DM sends unlock opened by member", async () => {
    const t = await unlocksLaunchedBeforeAnyoneJoined("quests");

    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const madeReady = await unlockRowOf(t, "U_ALICE", "quests");

    const alice = givenBy();
    expect(unlockEvents()).toEqual([
      { event: "unlock made ready", distinct_id: alice, uuid: expect.stringMatching(uuid), timestamp: new Date(madeReady.readyAt).toISOString(), properties: { ...shared, feature: "quests" } },
    ]);

    vi.setSystemTime(now.getTime() + 60_000);
    const response = await click(t, openInLevelUpDm("U_ALICE"));

    expect(response.status).toBe(200);
    const opened = await unlockRowOf(t, "U_ALICE", "quests");
    expect(opened.openedAt).toBe(now.getTime() + 60_000);
    expect(unlockEvents().slice(1)).toEqual([
      { event: "unlock opened", distinct_id: alice, uuid: expect.stringMatching(uuid), timestamp: new Date(opened.openedAt!).toISOString(), properties: { ...shared, feature: "quests", by: "member" } },
    ]);
  });
});

describe("E7: exactly once", () => {
  test("the Open interaction redelivered, and a second click on Open, send no second unlock opened", async () => {
    const t = await unlocksLaunchedBeforeAnyoneJoined("quests");
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const open = openInLevelUpDm("U_ALICE");

    await click(t, open);
    await click(t, open);
    await click(t, openInLevelUpDm("U_ALICE"));

    expect(unlockEvents().map(({ event }) => event)).toEqual(["unlock made ready", "unlock opened"]);
  });
});

describe("E1 P78: the ship sweep makes a shipped feature ready", () => {
  test("a Leaderboard that ships after a member passed level 3 is made ready by the sweep, which sends unlock made ready once, at the sweep's time", async () => {
    const t = await unlocksLaunchedBeforeAnyoneJoined();
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    expect(unlockEvents()).toEqual([]);

    await flagsFromPostHog(t, postHog, ...flagsOn("leaderboard"));
    vi.setSystemTime(now.getTime() + 60 * 60_000);
    await sweep(t);
    await sweep(t);

    const madeReady = await unlockRowOf(t, "U_ALICE", "leaderboard");
    expect(madeReady.readyAt).toBe(now.getTime() + 60 * 60_000);
    expect(unlockEvents().map(({ event, distinct_id, timestamp, properties }) => ({ event, distinct_id, timestamp, properties }))).toEqual([
      { event: "unlock made ready", distinct_id: givenBy(), timestamp: new Date(madeReady.readyAt).toISOString(), properties: { ...shared, feature: "leaderboard" } },
    ]);
  });
});

describe("E1 P77: the launch's openings", () => {
  test("the first switch-on's launch sends one unlock opened by launch per existing member and shipped feature, at its moment, and still draws no weekly quest and activates no Journey step", async () => {
    const t = await flagsFromPostHog(testBackend(), postHog, ...flagsOn("quests", "leaderboard"));
    await membersExist(t, "U_ALICE", "U_BOB");
    vi.setSystemTime(now.getTime() + 60_000);

    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_ALICE")));
    await settleInTimeOrder(t);

    const launch = await t.run(async (ctx) => (await ctx.db.query("unlockLaunches").unique())!);
    const openings = unlockEvents().map(({ event, distinct_id, timestamp, properties }) => ({ event, distinct_id, timestamp, feature: properties.feature, by: properties.by }));
    const members = [...new Set(openings.map(({ distinct_id }) => distinct_id))];
    expect(members).toHaveLength(2);
    expect(openings).toEqual(
      expect.arrayContaining(
        members.flatMap((member) =>
          ["quests", "leaderboard"].map((feature) => ({ event: "unlock opened", distinct_id: member, timestamp: new Date(launch.at).toISOString(), feature, by: "launch" })),
        ),
      ),
    );
    expect(openings).toHaveLength(4);
    expect(await jobsNamed(t, "drawWeeklyQuests", "activateJourney")).toEqual([]);
  });

  test("a launch over 600 members schedules fewer than 1000 jobs, and every opening is sent", async () => {
    const t = await flagsFromPostHog(testBackend(), postHog, ...flagsOn("quests", "leaderboard"));
    await membersExist(t, ...Array.from({ length: 600 }, (_, index) => `U_${index}`));

    await t.mutation(internal.unlocks.sweep.sweep, {});

    expect(await pendingJobs(t)).toBeLessThan(1000);
    await settle(t);
    expect(unlockEvents().filter(({ properties }) => properties.by === "launch")).toHaveLength(1200);
  }, 60_000);
});

describe("E10: analytics follows the stored facts, never the flags", () => {
  test("with every flag off, levelling up sends level reached and nothing from unlocks, because nothing is made ready", async () => {
    const t = await flagsFromPostHog(testBackend(), postHog);

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(productEvents().filter(({ event }) => event === "level reached")).toHaveLength(1);
    expect(unlockEvents()).toEqual([]);
  });

  test("with quests on and unlocks off, the readiness unlocks still stores is sent, and nothing is opened", async () => {
    const t = await flagsFromPostHog(testBackend(), postHog, onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone("quests"));

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    await unlockRowOf(t, "U_ALICE", "quests");
    expect(unlockEvents().map(({ event, distinct_id, properties }) => ({ event, distinct_id, feature: properties.feature }))).toEqual([
      { event: "unlock made ready", distinct_id: givenBy(), feature: "quests" },
    ]);
  });
});

const shipFlags: Record<"quests" | "leaderboard", string> = { quests: "quests", leaderboard: "everyone-board" };

function flagsOn(...shipped: Array<keyof typeof shipFlags>): FlagDefinition[] {
  return [
    onForEveryone("xp-levels"),
    onForEveryone("unlocks"),
    ...Object.entries(shipFlags).map(([feature, key]) => (shipped.includes(feature as keyof typeof shipFlags) ? onForEveryone : offForEveryone)(key)),
  ];
}

async function unlocksLaunchedBeforeAnyoneJoined(...shipped: Array<keyof typeof shipFlags>) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flagsOn(...shipped));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function membersExist(t: Backend, ...users: string[]) {
  await t.run(async (ctx) => {
    for (const user of users) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
  });
}

async function giveKudos(t: Backend, giver: string, recipient: string, tacos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(" thanks "), ...Array.from({ length: tacos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `1760349600.00010${sentMessages}` })));
  await settleInTimeOrder(t);
}

function openInLevelUpDm(user: string) {
  const dm = slack.callsTo("chat.postMessage").find(({ channel, blocks }) => channel === user && JSON.stringify(blocks ?? []).includes("openUnlock"));
  expect(dm, `a level-up DM to ${user} with Open`).toBeDefined();
  return blockActions(user, buttonIn(dm!.blocks as Block[], "Open"), { inMessage: { channel: user, ts: "1760349700.000100" } });
}

async function click(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settleInTimeOrder(t);
  return response;
}

async function sweep(t: Backend) {
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settleInTimeOrder(t);
}

async function unlockRowOf(t: Backend, user: string, feature: Feature) {
  const row = await t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member!._id).eq("feature", feature))
      .unique();
  });
  expect(row, `${feature} stored for ${user}`).not.toBeNull();
  return row!;
}

async function jobsNamed(t: Backend, ...names: string[]) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((job) => names.some((name) => job.name.endsWith(`:${name}`)));
}

async function pendingJobs(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ state }) => state.kind === "pending").length;
}

function productEvents(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event !== "$feature_flag_called");
}

function givenBy() {
  return productEvents().find((event) => event.event === "kudos given")!.distinct_id;
}

function unlockEvents() {
  return productEvents().filter((event) => event.event === "unlock made ready" || event.event === "unlock opened");
}
