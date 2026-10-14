import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, staleButtonOf } from "../../testing/slackInteractions";
import { emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { questOf, questPool, type QuestId } from "../quests/pool";
import { unopenedCratesOf } from "../quests/weekly";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const thisWeek = "2026-10-12";
const saysWhy = "thanks for untangling the release notes today";
const coins = "coins";
const alicesEmail = "alice@example.com";
const xpBelowLevelSix = 990;
const sayWhyDone = "Quest done: Thank someone and say why";

const questsOn = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("quests")];
const previewedByAlice = [...questsOn, onForEmails(coins, alicesEmail)];
const coinsOff = [...questsOn, offForEveryone(coins)];

const drawnFromTheDeployOn = { reward: questOf("say-why").reward, catalogueVersion: questPool.version };
const drawnBeforeTheDeploy = { reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1" };
const questsThatOneKudosLeavesOpen: QuestId[] = ["say-why-three-times", "say-why-three-days"];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CO6 CO1: a personal quest drawn from the deploy on pays 10 coins, whatever the flags say", { timeout: 30_000 }, () => {
  test.each([
    ["previewed by Alice", previewedByAlice],
    ["off", coinsOff],
  ])("with coins %s, finishing it records 10 coins and credits the wallet once, also when the finish is delivered twice", async (_, definitions) => {
    const t = await workspaceDeciding(...definitions);
    await questsOpenedBy(t, "U_ALICE", drawnFromTheDeployOn);
    const before = await balanceRecordedFor(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
    const afterFinish = await balanceRecordedFor(t, "U_ALICE");
    await t.mutation(internal.quests.quests.followKudosGiven, { event: lastKudosGiven() });

    expect(await weeklyRewardsOf(t, "U_ALICE")).toEqual([{ key: `weekly:${thisWeek}:0`, xp: 20, coins: 10, catalogueVersion: "2" }]);
    expect(afterFinish - before).toBe(10 + givingCoinsFor(1));
    expect(await balanceRecordedFor(t, "U_ALICE")).toBe(afterFinish);
    expect(await cratesWaitingNextWeekFor(t, "U_ALICE")).toEqual([{ xp: 20, coins: 10, item: null }]);
  });

  test("a quest drawn before the deploy and finished after it keeps its drawn reward and records 0 coins", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await questsOpenedBy(t, "U_ALICE", drawnBeforeTheDeploy);
    const before = await balanceRecordedFor(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);

    expect(await weeklyRewardsOf(t, "U_ALICE")).toEqual([{ key: `weekly:${thisWeek}:0`, xp: 20, coins: 0, catalogueVersion: "1" }]);
    expect((await balanceRecordedFor(t, "U_ALICE")) - before).toBe(givingCoinsFor(1));
  });
});

describe("CO19: the quest-done part says its coins only while coins are visible to the giver", { timeout: 30_000 }, () => {
  test("once the previewer opened Coins, finishing a quest drawn from the deploy on says +20 XP and +10 🪙", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    await questsOpenedBy(t, "U_ALICE", drawnFromTheDeployOn);

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect(questPartsOf(lastSuccessReplyTo("U_ALICE"))).toEqual([`${sayWhyDone} (+20 XP, +10 🪙)`]);
  });

  test("once the previewer opened Coins, a quest drawn before the deploy says only its XP", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    await questsOpenedBy(t, "U_ALICE", drawnBeforeTheDeploy);

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect(questPartsOf(lastSuccessReplyTo("U_ALICE"))).toEqual([`${sayWhyDone} (+20 XP)`]);
  });

  test.each([
    ["coins are off", coinsOff, true],
    ["the previewer hasn't opened Coins", previewedByAlice, false],
    ["coins are previewed by someone else", [...questsOn, onForEmails(coins, "bob@example.com")], true],
  ])("while %s, the quest-done part says only its XP and the reply names no coins", async (_, definitions, reachesCoins) => {
    const t = await workspaceDeciding(...definitions);
    if (reachesCoins) await coinsOpenedBy(t, "U_ALICE");
    await questsOpenedBy(t, "U_ALICE", drawnFromTheDeployOn);

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    const reply = lastSuccessReplyTo("U_ALICE");
    expect(questPartsOf(reply)).toEqual([`${sayWhyDone} (+20 XP)`]);
    expect(reply.filter((line) => line.includes("🪙"))).toEqual([]);
  });

  test("SW5: coins turned off after the quest finished but before Slack takes the reply leave its coins out", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    await questsOpenedBy(t, "U_ALICE", drawnFromTheDeployOn);
    const earlier = slack.ephemeralsTo("U_ALICE").length;

    await sendKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await untilAReplyIsReleasedWithQuestCoins(t);
    expect(slack.ephemeralsTo("U_ALICE")).toHaveLength(earlier);
    await flagsFromPostHog(t, postHog, ...coinsOff);
    await settleInTimeOrder(t);

    const [reply] = successRepliesTo("U_ALICE").slice(earlier);
    expect(questPartsOf(reply!)).toEqual([`${sayWhyDone} (+20 XP)`]);
    expect(reply!.filter((line) => line.includes("🪙"))).toEqual([]);
  });
});

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_ALICE", { profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withMember("U_CAROL", { profile: { email: "carol@example.com" } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function coinsOpenedBy(t: Backend, user: string) {
  await giveKudos(t, user, ["U_BOB"], saysWhy);
  await xpOf(t, user, xpBelowLevelSix);
  await giveKudos(t, user, ["U_CAROL"], saysWhy);
  await openUnlock(t, user, "coins");
  vi.setSystemTime(Date.now() + 24 * hourMs);
}

async function questsOpenedBy(t: Backend, user: string, drawn: { reward: { xp: number; coins: number; item: null }; catalogueVersion: string }) {
  await giveKudos(t, user, ["U_BOB"], "thanks");
  const quests: QuestId[] = ["say-why", ...questsThatOneKudosLeavesOpen];
  const slots = quests.map((quest, slot) => ({ slot, quest, ...drawn, feasibleBecause: { peopleLeft: 2, recognitionsLeft: 18 } }));
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots }));
  await openUnlock(t, user, "quests");
  vi.setSystemTime(Date.now() + hourMs);
}

async function openUnlock(t: Backend, user: string, feature: "coins" | "quests") {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, staleButtonOf({ type: "openUnlock", feature })), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string) {
  await sendKudos(t, giver, recipients, words);
  await settleInTimeOrder(t);
}

async function sendKudos(t: Backend, giver: string, recipients: string[], words: string) {
  sentMessages += 1;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
}

async function untilAReplyIsReleasedWithQuestCoins(t: Backend) {
  for (let fired = 0; fired < 100; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    if (await aReplyReleasedWithQuestCoins(t)) return;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("no success reply was released with a quest's coins");
}

async function aReplyReleasedWithQuestCoins(t: Backend) {
  const replies = await t.run((ctx) => ctx.db.query("privateReplies").collect());
  return replies.some(({ held, gains }) => held === undefined && (gains?.questsDone ?? []).some(({ coins }) => coins === 10));
}

function lastKudosGiven(): KudosGivenEvent {
  const given = vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is KudosGivenEvent => event.type === "kudosGiven");
  return given.at(-1)!;
}

function givingCoinsFor(recognitions: number) {
  return 4 * recognitions;
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}

async function xpOf(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function balanceRecordedFor(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}

async function weeklyRewardsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const records = await t.run((ctx) => ctx.db.query("rewardRecords").collect());
  return records.filter((record) => record.member === member && record.key.startsWith("weekly:")).map(({ key, xp, coins, catalogueVersion }) => ({ key, xp, coins, catalogueVersion }));
}

async function cratesWaitingNextWeekFor(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const crates = await t.run((ctx) => unopenedCratesOf(ctx, member, Date.parse("2026-10-20T10:00:00Z")));
  return crates.map(({ reward }) => reward);
}

function successRepliesTo(user: string) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n"));
}

function lastSuccessReplyTo(user: string) {
  return successRepliesTo(user).at(-1)!;
}

function questPartsOf(reply: string[]) {
  return reply.flatMap((line) => line.split(" · ")).filter((part) => part.startsWith(sayWhyDone));
}
