import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CapturedEvent, FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHomeBlocks } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { internal } from "../_generated/api";
import type { QuestId } from "../quests/pool";

const now = new Date("2026-10-13T10:00:00Z");
const wednesday = now.getTime() + 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const saysWhy = "thanks for untangling the release notes today";

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

describe("E1 E5: quest finished", () => {
  test("P87: a member's first kudos that says why finishes the Journey's first-thanks, sent on them at the kudos instant with its 10 XP", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", saysWhy);

    const [given] = kudosGiven();
    expect(questsFinished()).toEqual([
      {
        event: "quest finished",
        distinct_id: given!.distinct_id,
        uuid: expect.stringMatching(uuid),
        timestamp: given!.timestamp,
        properties: { ...shared, kind: "journey", quest: "first-thanks", xp: 10, coins: 0 },
      },
    ]);
  });

  test("P85 P89: finishing a weekly quest sends its pool ID with its 20 XP, and the first-quest step it finishes sends its own", async () => {
    const t = await openedQuests(["say-why-two-days", "say-why-three-times", "not-in-30-days"]);
    await giveKudos(t, "U_ALICE", saysWhy);
    vi.setSystemTime(wednesday);

    await giveKudos(t, "U_ALICE", saysWhy, wednesday);

    const [first, , finishing] = kudosGiven();
    const on = { distinct_id: first!.distinct_id };
    expect(questsFinished().map(({ distinct_id, timestamp, properties }) => ({ distinct_id, timestamp, properties }))).toEqual([
      { ...on, timestamp: first!.timestamp, properties: { ...shared, kind: "journey", quest: "first-thanks", xp: 10, coins: 0 } },
      { ...on, timestamp: finishing!.timestamp, properties: { ...shared, kind: "weekly", quest: "say-why-two-days", xp: 20, coins: 0 } },
      { ...on, timestamp: finishing!.timestamp, properties: { ...shared, kind: "journey", quest: "first-quest", xp: 20, coins: 0 } },
    ]);
  });
});

describe("E7: exactly once", () => {
  test("redelivering the kudos that finished a weekly quest and first-quest sends no second quest finished", async () => {
    const t = await openedQuests(["say-why-two-days", "say-why-three-times", "not-in-30-days"]);
    await giveKudos(t, "U_ALICE", saysWhy);
    vi.setSystemTime(wednesday);
    const finishing = await kudosRequestBody("U_ALICE", saysWhy, wednesday);

    await t.fetch("/slack/events", await signedRequest(finishing));
    await settleInTimeOrder(t);
    await t.fetch("/slack/events", await signedRequest(finishing));
    await settleInTimeOrder(t);

    expect(questsFinished().map(({ properties }) => properties.quest)).toEqual(["first-thanks", "say-why-two-days", "first-quest"]);
  });
});

describe("E5: a questFinished queued before the deploy", () => {
  test.each([
    ["a Journey step still sends its kind and step", { kind: "journey", step: "first-quest" } as const, { kind: "journey", quest: "first-quest" }],
    ["a weekly quest still sends its kind", { kind: "weekly", week: "2026-10-12", slot: 1 } as const, { kind: "weekly" }],
  ])("without poolQuest and reward, %s and leaves out what the event lacks", async (_, quest, properties) => {
    const t = await workspace();
    const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));

    await t.mutation(internal.analytics.subscribers.recordQuestFinished, { event: { type: "questFinished", workspace: "T1", member, quest, at: now.getTime() } });
    await settle(t);

    expect(questsFinished().map((event) => event.properties)).toEqual([{ ...shared, ...properties }]);
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
  await reachesLevel(t, await memberOf(t, "U_ALICE"), 3);
  await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_ALICE")));
  await settle(t);
  await drawFor(t, "U_ALICE", quests);
  await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ALICE", questsOpenInHome()), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
  return t;
}

function questsOpenInHome() {
  const command = JSON.stringify({ type: "openUnlock", feature: "quests" });
  const block = publishedHomeBlocks(slack, "U_ALICE").find((candidate) => candidate.accessory?.value === command);
  return buttonIn([block!], "Open");
}

function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id);
}

async function drawFor(t: Backend, user: string, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: now.getTime(), slots }));
}

async function kudosRequestBody(giver: string, words: string, at = Date.now()) {
  sentMessages += 1;
  return messageEvent([section(mention("U_BOB"), text(` ${words} `), emoji("taco"))], { user: giver, ts: `${Math.floor(at / 1000) + sentMessages}.000100` });
}

async function giveKudos(t: Backend, giver: string, words: string, at = Date.now()) {
  await t.fetch("/slack/events", await signedRequest(await kudosRequestBody(giver, words, at)));
  await settleInTimeOrder(t);
}

function kudosGiven(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event === "kudos given");
}

function questsFinished(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event === "quest finished");
}
