import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import type { QuestId } from "./pool";

const now = new Date("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const questsReady = "section: *Quests* is ready. It opens your weekly quests. [button: Open]";
const goalsFeasibleWithOneTeammateAlreadyThanked = [
  "section: Thank someone and say why. *0/1* · *20 XP*",
  "section: Thank someone and say why, 2 times. *0/2* · *20 XP*",
  "section: Thank someone and say why, 3 times. *0/3* · *20 XP*",
  "section: Thank someone and say why on 2 different days. *0/2* · *20 XP*",
  "section: Thank someone and say why on 3 different days. *0/3* · *20 XP*",
];

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
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

describe("P80 P76: a member who opens Quests gets 3 quests for this week on App Home", () => {
  test("below level 2, App Home names Quests only as next, with no weekly quest anywhere", async () => {
    const t = await workspace();

    await openHome(t, "U_ALICE");

    const home = publishedHome(slack, "U_ALICE");
    expect(home).toContain("section: Next: Quests at level 2.");
    expect(questsIn(home)).toEqual([]);
  });

  test("at level 2, Quests is ready with Open and no weekly quest shows; opening it shows 3 different quests this week, each at 0 with its 20 XP", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain(questsReady);
    expect(questsIn(publishedHome(slack, "U_ALICE"))).toEqual([]);

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));

    const [title, ...rest] = questsIn(publishedHome(slack, "U_ALICE"));
    const goals = rest.slice(0, -1);
    expect(title).toBe("section: *Quests this week*");
    expect(goals).toHaveLength(3);
    expect(new Set(goals).size).toBe(3);
    for (const goal of goals) expect(goalsFeasibleWithOneTeammateAlreadyThanked.map((line) => `${line} [button: Swap]`)).toContain(goal);
    expect(rest.at(-1)).toBe("context: Saying why counts when your message has 5 or more words besides mentions and emoji.");
    expect(publishedHome(slack, "U_ALICE")).not.toContain(questsReady);
  });

  test("while quests is off, a level 2 member sees no Quests crate, next line or weekly quest", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks");
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").filter((line) => /Quests|quests/.test(line))).toEqual([]);
  });
});

describe("P84 P85 P63: a member's kudos finish a weekly quest, recorded at once with its crate", () => {
  const twoDays = "Thank someone and say why on 2 different days.";
  const threeTimes = "Thank someone and say why, 3 times.";
  const notIn30Days = "Thank someone you haven't thanked in the last 30 days.";
  const finishedDm = `✅ You finished a quest: ${twoDays} You earned *20 XP*.`;
  const wednesday = now.getTime() + 24 * 60 * 60 * 1000;

  test("two kudos that say why on two different days finish it with one 20 XP reward record, one DM with Open and App Home updated, and a kudos that doesn't say why doesn't count", async () => {
    const t = await openedQuests(["say-why-two-days", "say-why-three-times", "not-in-30-days"]);

    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    expect(questsIn(publishedHome(slack, "U_ALICE")).slice(1, 4)).toEqual([
      `section: ${twoDays} *0/2* · *20 XP* [button: Swap]`,
      `section: ${threeTimes} *0/3* · *20 XP* [button: Swap]`,
      `section: ${notIn30Days} *0/1* · *20 XP* [button: Swap]`,
    ]);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    expect(questsIn(publishedHome(slack, "U_ALICE")).slice(1, 3)).toEqual([`section: ${twoDays} *1/2* · *20 XP* [button: Swap]`, `section: ${threeTimes} *1/3* · *20 XP* [button: Swap]`]);

    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy, wednesday);

    expect(await rewardRecordsOf(t)).toEqual([{ key: "weekly:2026-10-12:0", xp: 20 }]);
    expect(questDmsTo("U_ALICE").map(({ text }) => text)).toEqual([finishedDm]);
    expect(readBlocks(questDmsTo("U_ALICE")[0]!.blocks as Block[])).toEqual([`section: ${finishedDm} [button: Open]`]);
    expect(questsIn(publishedHome(slack, "U_ALICE")).slice(1, 3)).toEqual([
      `section: ✅ ${twoDays} You earned *20 XP*. [button: Open]`,
      `section: ${threeTimes} *2/3* · *20 XP* [button: Swap]`,
    ]);
  });

  test("clicking Open in the finished DM opens the quest's crate, and App Home shows it opened", async () => {
    const t = await openedQuests(["say-why-two-days", "say-why-three-times", "not-in-30-days"]);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    vi.setSystemTime(wednesday);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy, wednesday);

    await send(t, blockActions("U_ALICE", buttonIn(questDmsTo("U_ALICE")[0]!.blocks as Block[], "Open"), { inMessage: { channel: "U_ALICE", ts: "1760436000.000100" } }));

    expect(await t.run(async (ctx) => (await ctx.db.query("crateOpenings").collect()).map(({ key, at }) => ({ key, at })))).toEqual([
      { key: "weekly:2026-10-12:0", at: expect.any(Number) },
    ]);
    expect(questsIn(publishedHome(slack, "U_ALICE"))[1]).toBe(`section: ✅ ${twoDays} You earned *20 XP*.`);
  });

  async function openedQuests(quests: QuestId[]) {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    await drawFor(t, "U_ALICE", quests);
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));
    return t;
  }
});

async function drawFor(t: Backend, user: string, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    await ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: now.getTime(), slots });
  });
}

async function rewardRecordsOf(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("rewardRecords").collect()).filter(({ key }) => key.startsWith("weekly:")).map(({ key, xp }) => ({ key, xp })));
}

function questDmsTo(user: string): Array<{ text?: unknown; blocks?: unknown }> {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished a quest"));
}

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string, at = now.getTime()) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${at / 1000 + sentMessages}.000100` })));
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
