import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CapturedEvent, FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { QuestId } from "../quests/pool";

const now = new Date("2026-10-13T10:00:00Z");
const wednesday = now.getTime() + 24 * 60 * 60 * 1000;
const week = "2026-10-12";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const rewardOf20Xp = { xp: 20, coins: 0, item: null };
const feasibleBecause = { peopleLeft: 1, recognitionsLeft: 18 };

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E1 E5: crate opened", () => {
  test("P85 P92: Open on first-thanks's crate sends crate opened on the member at the click, with kind journey and the step", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", saysWhy);
    const openedAt = now.getTime() + 60_000;
    vi.setSystemTime(openedAt);

    await openCrateFromDm(t, journeyStepDm());

    const [given] = kudosGiven();
    expect(cratesOpened()).toEqual([
      {
        event: "crate opened",
        distinct_id: given!.distinct_id,
        uuid: expect.stringMatching(uuid),
        timestamp: new Date(openedAt).toISOString(),
        properties: { ...shared, kind: "journey", quest: "first-thanks" },
      },
    ]);
  });

  test("P85 P92: Open on a weekly quest's crate sends kind weekly and the pool ID of the quest that finished", async () => {
    const t = await openedQuests(["say-why-two-days", "say-why-three-times", "not-in-30-days"]);
    await finishSayWhyTwoDays(t);

    await openCrateFromDm(t, weeklyQuestDm());

    expect(cratesOpened().map(({ properties }) => properties)).toEqual([{ ...shared, kind: "weekly", quest: "say-why-two-days" }]);
  });

  test("P81 P87: a swapped-in quest's crate sends the pool ID of the quest swapped in, not the one it replaced", async () => {
    const t = await openedQuests(["say-why-three-days", "say-why-three-times", "not-in-30-days"]);
    await swapFirstSlotFor(t, "say-why-three-days", "say-why-two-days");
    await finishSayWhyTwoDays(t);

    await openCrateFromDm(t, weeklyQuestDm());

    expect(cratesOpened().map(({ properties }) => properties)).toEqual([{ ...shared, kind: "weekly", quest: "say-why-two-days" }]);
  });
});

describe("E7: exactly once", () => {
  test("a second Open on the same crate sends nothing more", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", saysWhy);
    await openCrateFromDm(t, journeyStepDm());
    vi.setSystemTime(now.getTime() + 120_000);

    await openCrateFromDm(t, journeyStepDm());

    expect(cratesOpened()).toHaveLength(1);
  });

  test("E10: a stale Open while quests is off sends nothing", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", saysWhy);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"));

    await openCrateFromDm(t, journeyStepDm());

    expect(cratesOpened()).toEqual([]);
  });
});

describe("E5: a questOpened queued before the deploy", () => {
  test("without poolQuest, a weekly crate still sends its kind and leaves out the quest", async () => {
    const t = await workspace();
    const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));
    const quest = { kind: "weekly", week, slot: 1 } as const;

    await t.mutation(internal.analytics.subscribers.recordQuestOpened, { event: { type: "questOpened", workspace: "T1", member, quest, at: now.getTime() } });
    await settle(t);

    expect(cratesOpened().map(({ properties }) => properties)).toEqual([{ ...shared, kind: "weekly" }]);
  });
});

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function openedQuests(quests: QuestId[]) {
  const t = await workspace();
  await giveKudos(t, "U_ALICE", saysWhy);
  await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_ALICE")));
  await settle(t);
  const member = await memberOf(t, "U_ALICE");
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: rewardOf20Xp, catalogueVersion: "1", feasibleBecause }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week, drawnAt: now.getTime(), slots }));
  await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")), form));
  await settle(t);
  return t;
}

async function swapFirstSlotFor(t: Backend, replaced: QuestId, quest: QuestId) {
  const member = await memberOf(t, "U_ALICE");
  const swappedIn = { slot: 0, quest, reward: rewardOf20Xp, catalogueVersion: "1", feasibleBecause };
  await t.run((ctx) => ctx.db.insert("questSwaps", { member, week, swappedAt: now.getTime(), replaced, swappedIn }));
}

async function finishSayWhyTwoDays(t: Backend) {
  await giveKudos(t, "U_ALICE", saysWhy);
  vi.setSystemTime(wednesday);
  await giveKudos(t, "U_ALICE", saysWhy, wednesday);
}

function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id);
}

async function giveKudos(t: Backend, giver: string, words: string, at = Date.now()) {
  sentMessages += 1;
  const body = messageEvent([section(mention("U_BOB"), text(` ${words} `), emoji("taco"))], { user: giver, ts: `${Math.floor(at / 1000) + sentMessages}.000100` });
  await t.fetch("/slack/events", await signedRequest(body));
  await settleInTimeOrder(t);
}

type PostedDm = { channel?: unknown; text?: unknown; blocks?: unknown };

async function openCrateFromDm(t: Backend, dm: PostedDm) {
  const open = buttonIn(dm.blocks as Block[], "Open");
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ALICE", open, { inMessage: { channel: "U_ALICE", ts: "1760349700.000100" } }), form));
  expect(response.status).toBe(200);
  await settleInTimeOrder(t);
}

function journeyStepDm(): PostedDm {
  return dmStartingWith("✅ You finished a Journey step");
}

function weeklyQuestDm(): PostedDm {
  return dmStartingWith("✅ You finished a quest");
}

function dmStartingWith(start: string): PostedDm {
  const dm = slack.callsTo("chat.postMessage").find(({ channel, text }) => channel === "U_ALICE" && String(text).startsWith(start));
  expect(dm, `a DM to U_ALICE starting "${start}"`).toBeDefined();
  return dm!;
}

function kudosGiven(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event === "kudos given");
}

function cratesOpened(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event === "crate opened");
}
