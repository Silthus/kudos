import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, memberEvent, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { standingOf } from "../progression/progression";
import type { Feature } from "../unlocks/feature";
import type { MemberId } from "../workspace/directory";
import type { QuestId } from "./pool";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const firstThanksDone = "section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*. [button: Open]";
const firstThanksActive = "section: *Journey:* Give a kudos that says why. It pays *10 XP*.";
const firstQuestActive = "section: *Journey:* Finish a weekly quest. It pays *20 XP*.";
const firstQuestDone = "section: *Journey:* ✅ Finish a weekly quest. You earned *20 XP*. [button: Open]";
const someoneNewActive = "section: *Journey:* Thank someone you haven't thanked before. It pays *30 XP*.";
const someoneNewDone = "section: *Journey:* ✅ Thank someone you haven't thanked before. You earned *30 XP*. [button: Open]";
const finishedFirstQuest = "✅ You finished a Journey step: Finish a weekly quest. You earned *20 XP*.";
const finishedSomeoneNew = "✅ You finished a Journey step: Thank someone you haven't thanked before. You earned *30 XP*.";

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests", "everyone-board");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P88 P89: opening Quests or the Leaderboard shows its Journey step, and finishing it pays its promised reward with a crate", () => {
  test("opening Quests shows first-quest in the Journey, and finishing a weekly quest finishes it with one 20 XP reward record, one DM with Open and its crate in App Home", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([firstThanksDone]);
    await drawFor(t, "U_ALICE", ["say-why", "say-why-twice", "say-why-three-times"]);

    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));

    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([firstThanksDone, firstQuestActive]);

    const later = aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await rewardRecordsOf(t, "journey:first-quest")).toEqual([{ key: "journey:first-quest", xp: 20, catalogueVersion: "2", at: later }]);
    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([expect.stringContaining("Give a kudos that says why"), finishedFirstQuest]);
    expect(readBlocks(journeyDmsTo("U_ALICE")[1]!.blocks as Block[])).toEqual([`section: ${finishedFirstQuest} [button: Open]`]);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([firstThanksDone, firstQuestDone]);
  });

  test("opening the Leaderboard shows someone-new in the Journey, and a kudos to someone new finishes it with 30 XP, one DM with Open and its crate in App Home", async () => {
    const t = await workspace();
    await directoryKnows(t, "U_BOB");
    await leaderboardReady(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));

    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([firstThanksActive, expect.stringContaining("context:"), someoneNewActive]);

    const later = aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([{ key: "journey:someone-new", xp: 30, catalogueVersion: "2", at: later }]);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 40, level: 2, skillPoints: 0 });
    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([finishedSomeoneNew]);
    expect(readBlocks(journeyDmsTo("U_ALICE")[0]!.blocks as Block[])).toEqual([`section: ${finishedSomeoneNew} [button: Open]`]);
    expect(journeyIn(publishedHome(slack, "U_ALICE")).at(-1)).toBe(someoneNewDone);
  });

  test("P71: a kudos that finishes the weekly someone-new and the Journey's someone-new names that goal for each quest, with each one's own reward", async () => {
    const t = await workspace();
    await directoryKnows(t, "U_BOB");
    await leaderboardReady(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));
    const alice = await memberOf(t, "U_ALICE");
    await t.run((ctx) => ctx.db.insert("unlocks", { member: alice, feature: "quests", readyAt: now.getTime(), openedAt: now.getTime() }));
    await drawFor(t, "U_ALICE", ["someone-new", "say-why-twice", "say-why-three-times"]);

    aMinuteLater();
    await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention("U_BOB"), text(" thanks "), emoji("taco"))], { user: "U_ALICE", ts: `${Date.now() / 1000}.000100` })));
    await settleInTimeOrder(t);

    expect(slack.ephemeralsTo("U_ALICE").map(({ text }) => String(text).split("\n"))).toEqual([
      ["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP · Quest done: Thank someone you haven't thanked before (+20 XP) · Quest done: Thank someone you haven't thanked before (+30 XP)"],
    ]);
  });

  test("questsOf gives each next step's activation time, promised reward, catalogue version and finish time", async () => {
    const { t, alice, bob } = await membersInDirectory();
    await opened(t, alice, "quests", now.getTime());
    await opened(t, alice, "leaderboard", now.getTime() + minuteMs);
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: now.getTime() + 2 * minuteMs }));
    await t.mutation(internal.quests.quests.followKudosGiven, { event });

    const journey = (await t.query(internal.quests.quests.questsOf, { member: alice }))!.journey;

    expect(journey.filter(({ step }) => step !== "first-thanks")).toEqual([
      { step: "first-quest", activatedAt: now.getTime(), reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "2", finishedAt: null, openedAt: null },
      { step: "someone-new", activatedAt: now.getTime() + minuteMs, reward: { xp: 30, coins: 0, item: null }, catalogueVersion: "2", finishedAt: now.getTime() + 2 * minuteMs, openedAt: null },
    ]);
  });

  test("the Leaderboard opened by the unlocks launch schedules nothing for the Journey", async () => {
    const t = await flagsLoaded(testBackend());
    await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));

    await unlocksShippedBeforeAnyoneJoined(t);

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.filter(({ name }) => name.includes("activateJourney"))).toEqual([]);
  });
});

describe("P90: a Journey step that opens with a feature counts only what follows its activation", () => {
  test("a kudos to someone new before the Leaderboard was opened doesn't finish someone-new, nor does thanking them again after", async () => {
    const t = await workspace();
    await directoryKnows(t, "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    await leaderboardReady(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));

    aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([]);
    expect(journeyIn(publishedHome(slack, "U_ALICE")).at(-1)).toBe(someoneNewActive);
  });

  test("someone-new: App Home's publish that runs before the opening's subscriber activates it at the opening and finishes it with what followed", async () => {
    const t = await workspace();
    await directoryKnows(t, "U_BOB");
    await directoryKnows(t, "U_CAROL");
    await leaderboardReady(t, "U_ALICE");
    const alice = await memberOf(t, "U_ALICE");
    const openedAt = aMinuteLater();
    await t.run(async (ctx) => {
      const unlock = (await ctx.db.query("unlocks").collect()).find((row) => row.member === alice && row.feature === "leaderboard")!;
      await ctx.db.patch(unlock._id, { openedAt });
    });
    const thanked = aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");

    aMinuteLater();
    await openHome(t, "U_ALICE");

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([{ key: "journey:someone-new", xp: 30, catalogueVersion: "2", at: thanked }]);
    expect(await t.run(async (ctx) => (await ctx.db.query("journeySteps").collect()).find((row) => row.member === alice && row.step === "someone-new")?.activatedAt)).toBe(openedAt);
  });

  test("someone-new: a kudosGiven for a kudos to someone new made before the Leaderboard opened, delivered after, doesn't finish it", async () => {
    const { t, alice, bob } = await membersInDirectory();
    const madeBefore = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: now.getTime() - minuteMs }));
    await opened(t, alice, "leaderboard", now.getTime());

    await t.mutation(internal.quests.quests.followKudosGiven, { event: madeBefore });

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([]);
  });

  test.each([
    ["first-quest", "quests", (t: Backend, alice: MemberId) => t.mutation(internal.quests.journey.finishFirstQuest, { event: { type: "questFinished", workspace: "T1", member: alice, quest: { kind: "weekly", week: "2026-10-12", slot: 0 }, at: now.getTime() + minuteMs } })],
    [
      "someone-new",
      "leaderboard",
      async (t: Backend, alice: MemberId, bob: MemberId) => t.mutation(internal.quests.quests.followKudosGiven, { event: await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: now.getTime() + minuteMs })) }),
    ],
  ] as const)("%s: what finishes it after the opening still counts when its event is read before the activation's subscriber runs", async (step, feature, finishing) => {
    const { t, alice, bob } = await membersInDirectory();
    await t.run((ctx) => ctx.db.insert("rewardRecords", { member: alice, key: "weekly:2026-10-12:0", xp: 20, coins: 0, item: null, catalogueVersion: "1", at: now.getTime() + minuteMs }));
    await finishing(t, alice, bob);

    await opened(t, alice, feature, now.getTime());

    expect(await rewardRecordsOf(t, `journey:${step}`)).toEqual([{ key: `journey:${step}`, xp: step === "first-quest" ? 20 : 30, catalogueVersion: "2", at: now.getTime() + minuteMs }]);
  });

  test("first-quest: a weekly quest finished before the step became active doesn't finish it", async () => {
    const { t, alice } = await membersInDirectory();
    await opened(t, alice, "quests", now.getTime());
    const finishedEarlier = { type: "questFinished", workspace: "T1", member: alice, quest: { kind: "weekly", week: "2026-10-12", slot: 0 }, at: now.getTime() - minuteMs } as const;

    await t.mutation(internal.quests.journey.finishFirstQuest, { event: finishedEarlier });

    expect(await rewardRecordsOf(t, "journey:first-quest")).toEqual([]);
  });
});

describe("P90: someone-new never strands a member", () => {
  test("a member who left, and comes back after the last member they hadn't thanked left too, finishes someone-new on their return", async () => {
    const t = await workspace();
    await directoryKnows(t, "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    await leaderboardReady(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));
    aMinuteLater();
    await t.fetch("/slack/events", await signedRequest(memberEvent("user_change", { id: "U_ALICE", deleted: true })));
    await t.fetch("/slack/events", await signedRequest(memberEvent("user_change", { id: "U_CAROL", deleted: true })));
    await settle(t);
    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([]);

    const later = aMinuteLater();
    await t.fetch("/slack/events", await signedRequest(memberEvent("user_change", { id: "U_ALICE" })));
    await settle(t);

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([{ key: "journey:someone-new", xp: 30, catalogueVersion: "2", at: later }]);
  });

  test("a leave rechecks every member with someone-new active within Convex's limits, and finishes the one who has now thanked everyone", async () => {
    const t = await flagsLoaded(testBackend({ transactionLimits: true }));
    await unlocksShippedBeforeAnyoneJoined(t);
    const [alice, leaving] = await t.run(async (ctx) => {
      const members: MemberId[] = [];
      for (let index = 0; index < 400; index += 1) members.push(await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member" }));
      for (const member of members) await ctx.db.insert("journeySteps", { member, step: "someone-new", activatedAt: now.getTime(), reward: { xp: 30, coins: 0, item: null }, catalogueVersion: "1" });
      return members;
    });
    await t.run(async (ctx) => {
      const members = await ctx.db.query("members").collect();
      for (const { _id: recipient } of members) if (recipient !== alice && recipient !== leaving) await kudosGivenEventWithAward(ctx, alice!, recipient, { at: now.getTime() + minuteMs });
    });
    await t.run((ctx) => ctx.db.patch(leaving!, { kind: "not-a-member" }));

    await t.mutation(internal.quests.journey.recheckSomeoneNew, { event: { type: "memberLeft", workspace: "T1", member: leaving!, at: now.getTime() + 2 * minuteMs } });
    await settle(t);

    const finished = await t.run(async (ctx) => (await ctx.db.query("rewardRecords").collect()).filter(({ key }) => key === "journey:someone-new").map(({ member }) => member));
    expect(finished).toEqual([alice]);
  }, 120_000);

  test("a member who already thanked every other member finishes someone-new when the Leaderboard opens", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    await leaderboardReady(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    const later = aMinuteLater();
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([{ key: "journey:someone-new", xp: 30, catalogueVersion: "2", at: later }]);
    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([finishedSomeoneNew]);
    expect(journeyIn(publishedHome(slack, "U_ALICE")).at(-1)).toBe(someoneNewDone);
  });

  test("someone-new finishes when the last member the member hadn't thanked leaves the workspace", async () => {
    const t = await workspace();
    await directoryKnows(t, "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    await leaderboardReady(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));
    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([]);

    const later = aMinuteLater();
    await t.fetch("/slack/events", await signedRequest(memberEvent("user_change", { id: "U_CAROL", deleted: true })));
    await settle(t);

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([{ key: "journey:someone-new", xp: 30, catalogueVersion: "2", at: later }]);
    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([finishedSomeoneNew]);
  });
});

describe("P87 P90: a Journey step that opens with a feature finishes once", () => {
  test("first-quest: the opening and every weekly questFinished delivered twice record one reward record and one questFinished for the step", async () => {
    const { t, alice } = await membersInDirectory();
    await opened(t, alice, "quests", now.getTime());
    await opened(t, alice, "quests", now.getTime());
    const weeklyFinished = { type: "questFinished", workspace: "T1", member: alice, quest: { kind: "weekly", week: "2026-10-12", slot: 0 }, at: now.getTime() + minuteMs } as const;
    const nextWeekly = { ...weeklyFinished, quest: { ...weeklyFinished.quest, slot: 1 }, at: now.getTime() + 2 * minuteMs };

    for (const event of [weeklyFinished, weeklyFinished, nextWeekly]) await t.mutation(internal.quests.journey.finishFirstQuest, { event });
    await settle(t);

    expect(await rewardRecordsOf(t, "journey:first-quest")).toEqual([{ key: "journey:first-quest", xp: 20, catalogueVersion: "2", at: now.getTime() + minuteMs }]);
    expect(journeyFinished("first-quest")).toHaveLength(1);
    expect(await t.run((ctx) => standingOf(ctx, alice))).toEqual({ xp: 20, level: 2, skillPoints: 0 });
  });

  test("someone-new: a kudos to someone new delivered twice, an opening delivered twice and a leave delivered twice record one reward record and one questFinished for the step", async () => {
    const { t, alice, bob, carol } = await membersInDirectory();
    await opened(t, alice, "leaderboard", now.getTime());
    await opened(t, alice, "leaderboard", now.getTime());
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: now.getTime() + minuteMs }));

    for (const delivery of [1, 2]) await t.mutation(internal.quests.quests.followKudosGiven, { event });
    await t.run((ctx) => ctx.db.patch(carol, { kind: "not-a-member" }));
    const left = { type: "memberLeft", workspace: "T1", member: carol, at: now.getTime() + 2 * minuteMs } as const;
    for (const delivery of [1, 2]) await t.mutation(internal.quests.journey.recheckSomeoneNew, { event: left });
    await settle(t);

    expect(await rewardRecordsOf(t, "journey:someone-new")).toEqual([{ key: "journey:someone-new", xp: 30, catalogueVersion: "2", at: now.getTime() + minuteMs }]);
    expect(journeyFinished("someone-new")).toHaveLength(1);
  });
});

function aMinuteLater() {
  vi.setSystemTime(Date.now() + minuteMs);
  return Date.now();
}

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function membersInDirectory() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const [alice, bob, carol] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob!, carol: carol! };
}

async function opened(t: Backend, member: MemberId, feature: Feature, at: number) {
  await t.mutation(internal.quests.journey.activateJourney, { event: { type: "unlockOpened", workspace: "T1", member, feature, at } });
}

async function directoryKnows(t: Backend, user: string) {
  await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
}

async function leaderboardReady(t: Backend, user: string) {
  await openHome(t, user);
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("unlocks", { member, feature: "leaderboard", readyAt: now.getTime() }));
}

async function drawFor(t: Backend, user: string, quests: QuestId[]) {
  const member = await memberOf(t, user);
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: now.getTime(), slots }));
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000}.00010${sentMessages}` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, action: ReturnType<typeof buttonIn>) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
}

function journeyIn(home: string[]) {
  const start = home.findIndex((line) => line.includes("*Journey:*"));
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}

function journeyDmsTo(user: string): Array<{ text?: unknown; blocks?: unknown }> {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished a Journey step"));
}

async function rewardRecordsOf(t: Backend, key: string) {
  return t.run(async (ctx) =>
    (await ctx.db.query("rewardRecords").collect()).filter((record) => record.key === key).map(({ key, xp, catalogueVersion, at }) => ({ key, xp, catalogueVersion, at })),
  );
}

function journeyFinished(step: string) {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is Extract<DomainEvent, { type: "questFinished" }> => event.type === "questFinished" && event.quest.kind === "journey" && event.quest.step === step);
}

async function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}
