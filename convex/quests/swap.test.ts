import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import type { QuestId } from "./pool";

const dayMs = 24 * 60 * 60 * 1000;
const tuesday = Date.parse("2026-10-13T10:00:00Z");
const wednesday = tuesday + dayMs;
const saturday = Date.parse("2026-10-17T10:00:00Z");
const sunday = saturday + dayMs;
const nextMonday = sunday + dayMs;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const sayWhy = "Thank someone and say why.";
const twice = "Thank someone and say why, 2 times.";
const threeTimes = "Thank someone and say why, 3 times.";
const twoDays = "Thank someone and say why on 2 different days.";
const sayingWhyThreeWays: QuestId[] = ["say-why", "say-why-twice", "say-why-three-times"];

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P81: once a week, a member swaps one unfinished quest for a feasible quest not in the draw", () => {
  test("App Home shows Swap on each unfinished quest; Swap replaces the clicked quest with the one feasible quest left outside the draw, and Swap is gone for the rest of the week", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    expect(questsIn(publishedHome(slack, "U_ALICE")).slice(1, 4)).toEqual([
      `section: ${sayWhy} *0/1* · *20 XP* [button: Swap]`,
      `section: ${twice} *0/2* · *20 XP* [button: Swap]`,
      `section: ${threeTimes} *0/3* · *20 XP* [button: Swap]`,
    ]);
    vi.setSystemTime(saturday);

    await send(t, blockActions("U_ALICE", swapIn(publishedHomeBlocks(slack, "U_ALICE"), twice)));

    expect(questsIn(publishedHome(slack, "U_ALICE")).slice(1, 4)).toEqual([
      `section: ${sayWhy} *0/1* · *20 XP*`,
      `section: ${twoDays} *0/2* · *20 XP*`,
      `section: ${threeTimes} *0/3* · *20 XP*`,
    ]);
    vi.setSystemTime(sunday);
    await openHome(t, "U_ALICE");
    expect(questsIn(publishedHome(slack, "U_ALICE")).filter((line) => line.includes("[button: Swap]"))).toEqual([]);
  });

  test("questsOf gives the swap with its time, no swap available, and the slot's new quest with the reward and the facts at the swap", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    vi.setSystemTime(saturday);
    expect((await questsOf(t))?.week).toMatchObject({ swap: null, swapAvailable: true });

    await send(t, blockActions("U_ALICE", swapIn(publishedHomeBlocks(slack, "U_ALICE"), twice)));

    const week = (await questsOf(t))!.week!;
    expect(week).toMatchObject({ week: "2026-10-12", swap: { slot: 1, replaced: "say-why-twice", quest: "say-why-two-days", swappedAt: saturday }, swapAvailable: false });
    expect(week.slots[1]).toEqual({
      slot: 1,
      quest: "say-why-two-days",
      goal: twoDays,
      reward: { xp: 20, coins: 0, item: null },
      catalogueVersion: "1",
      feasibleBecause: { peopleLeft: 1, recognitionsLeft: 20, daysLeft: 2 },
      progress: 0,
      target: 2,
      finishedAt: null,
      openedAt: null,
    });
  });

  test("the new quest counts kudos from the swap on and finishes under the slot's own key, with its 20 XP and one DM", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(saturday);
    await send(t, blockActions("U_ALICE", swapIn(publishedHomeBlocks(slack, "U_ALICE"), twice)));
    expect(questsIn(publishedHome(slack, "U_ALICE"))[2]).toBe(`section: ${twoDays} *0/2* · *20 XP*`);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    expect(questsIn(publishedHome(slack, "U_ALICE"))[2]).toBe(`section: ${twoDays} *1/2* · *20 XP*`);
    vi.setSystemTime(sunday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await rewardRecordsOf(t)).toEqual(expect.arrayContaining([{ key: "weekly:2026-10-12:1", xp: 20 }]));
    expect(questDmsTo("U_ALICE").map(({ text }) => text)).toContain(`✅ You finished a quest: ${twoDays} You earned *20 XP*.`);
    expect(questsIn(publishedHome(slack, "U_ALICE"))[2]).toBe(`section: ✅ ${twoDays} You earned *20 XP*. [button: Open]`);
  });

  test("a kudos made before the swap and delivered after it doesn't count toward the new quest", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    vi.setSystemTime(saturday);
    await send(t, blockActions("U_ALICE", swapIn(publishedHomeBlocks(slack, "U_ALICE"), twice)));
    const [alice, bob] = await membersOf(t, "U_ALICE", "U_BOB");
    const lateDelivery = await t.run((ctx) =>
      kudosGivenEventWithAward(ctx, alice!, bob!, { annotations: { gate: { version: 1, thoughtful: true, words: 7 } }, day: "2026-10-14", at: wednesday }),
    );

    await t.mutation(internal.quests.weekly.advanceWeeklyQuests, { event: lateDelivery });

    expect((await questsOf(t))!.week!.slots[1]).toMatchObject({ quest: "say-why-two-days", progress: 0 });
  });

  test("with no feasible quest left outside the draw, no quest shows Swap", async () => {
    vi.setSystemTime(sunday);

    const t = await openedQuests(sayingWhyThreeWays);

    expect(questsIn(publishedHome(slack, "U_ALICE")).slice(1, 4)).toEqual([`section: ${sayWhy} *0/1* · *20 XP*`, `section: ${twice} *0/2* · *20 XP*`, `section: ${threeTimes} *0/3* · *20 XP*`]);
    expect((await questsOf(t))?.week).toMatchObject({ swap: null, swapAvailable: false });
  });

  test("a finished quest never shows Swap, while the unfinished ones still do", async () => {
    const t = await openedQuests(sayingWhyThreeWays);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(questsIn(publishedHome(slack, "U_ALICE")).slice(1, 4)).toEqual([
      `section: ✅ ${sayWhy} You earned *20 XP*. [button: Open]`,
      `section: ${twice} *1/2* · *20 XP* [button: Swap]`,
      `section: ${threeTimes} *1/3* · *20 XP* [button: Swap]`,
    ]);
  });

  test("while quests is off, a Swap button left on App Home writes nothing", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    const stale = publishedHomeBlocks(slack, "U_ALICE");
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks");
    await flagsLoaded(t);
    const before = await questState(t);

    await send(t, blockActions("U_ALICE", swapIn(stale, twice)));

    expect(await questState(t)).toEqual(before);
  });
});

describe("P81: a week swaps one unfinished quest at most", () => {
  test("a second swap in the same week, from a Swap left on an earlier App Home, writes nothing", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    const earlier = publishedHomeBlocks(slack, "U_ALICE");
    vi.setSystemTime(saturday);
    await send(t, blockActions("U_ALICE", swapIn(earlier, twice)));
    const before = await questState(t);

    await send(t, blockActions("U_ALICE", swapIn(earlier, threeTimes)));
    await send(t, blockActions("U_ALICE", swapIn(earlier, twice)));

    expect(await questState(t)).toEqual(before);
    expect(before.questSwaps).toHaveLength(1);
  });

  test("a Swap left on a quest that has since finished writes nothing", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    const stale = publishedHomeBlocks(slack, "U_ALICE");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    const before = await questState(t);

    await send(t, blockActions("U_ALICE", swapIn(stale, sayWhy)));

    expect(await questState(t)).toEqual(before);
    expect(before.questSwaps).toEqual([]);
  });

  test("a Swap left on last week's App Home writes nothing in the new week", async () => {
    const t = await openedQuests(sayingWhyThreeWays);
    const lastWeek = publishedHomeBlocks(slack, "U_ALICE");
    vi.setSystemTime(nextMonday);
    const before = await questState(t);

    await send(t, blockActions("U_ALICE", swapIn(lastWeek, twice)));

    expect(await questState(t)).toEqual(before);
    expect(before.questSwaps).toEqual([]);
  });
});

async function openedQuests(quests: QuestId[]) {
  const t = await workspace();
  await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
  await openHome(t, "U_ALICE");
  await drawFor(t, "U_ALICE", quests);
  await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));
  return t;
}

async function drawFor(t: Backend, user: string, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  const [member] = await membersOf(t, user);
  await t.run((ctx) => ctx.db.insert("questDraws", { member: member!, week: "2026-10-12", drawnAt: Date.now(), slots }));
}

function swapIn(blocks: Block[], goal: string) {
  return buttonIn(
    blocks.filter((block) => readBlocks([block]).some((line) => line.includes(goal))),
    "Swap",
  );
}

async function membersOf(t: Backend, ...users: string[]): Promise<MemberId[]> {
  const members = await t.run((ctx) => ctx.db.query("members").collect());
  return users.map((user) => members.find((row) => row.user === user)!._id);
}

async function questsOf(t: Backend) {
  const [alice] = await membersOf(t, "U_ALICE");
  return t.query(internal.quests.quests.questsOf, { member: alice! });
}

async function questState(t: Backend) {
  return t.run(async (ctx) => ({
    questDraws: await ctx.db.query("questDraws").collect(),
    questSwaps: await ctx.db.query("questSwaps").collect(),
    questProgress: await ctx.db.query("questProgress").collect(),
    rewardRecords: await ctx.db.query("rewardRecords").collect(),
  }));
}

async function rewardRecordsOf(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("rewardRecords").collect()).filter(({ key }) => key.startsWith("weekly:")).map(({ key, xp }) => ({ key, xp })));
}

function questDmsTo(user: string): Array<{ text?: unknown }> {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished a quest"));
}

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}

function questsIn(home: string[]) {
  const start = home.findIndex((line) => line.includes("*Quests this week*"));
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}
