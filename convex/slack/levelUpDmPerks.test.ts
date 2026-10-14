import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonIn, buttonInHome, publishedHomeBlocks, readBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { standingOf } from "../progression/progression";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const inDm = { channel: "D_ALICE", ts: "1760349700.000200" };

const sparkLine = "section: *Spark* · 1 skill point\n+5 XP the first time each day you thank someone and say why. [button: Buy]";
const rhythmLine = "section: *Rhythm* · 1 skill point\n+2 XP each time you thank someone and say why, once per person a day. [button: Buy]";
const circleLine = "section: *Circle* · 1 skill point\n+5 XP the first time each week you thank a person and say why. [button: Buy]";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P19 P74: once the Skill tree is open, the level-up DM offers each perk the member can buy, with Buy", () => {
  test("reaching level 6 with 2 skill points offers spark, rhythm and circle, and Buy on rhythm buys it and says so in the DM conversation", async () => {
    const t = await skillTreeOpenedAtLevelFive("U_ALICE");

    await reachLevelSix(t, "U_ALICE");

    expect(readBlocks(blocksOf(lastDmTo("U_ALICE")))).toEqual([
      "section: 🎉 You reached level 6! You have 2 skill points saved for the skill tree.",
      "section: Level 7 is 500 XP away.",
      sparkLine,
      rhythmLine,
      circleLine,
    ]);

    await clickInDm(t, "U_ALICE", buyButtonInDm("rhythm"));

    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["rhythm"]);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 1000, level: 6, skillPoints: 1 });
    expect(repliesIn(inDm.channel)).toEqual(["You bought Rhythm."]);
  });

  test("a perk owned before the level up is left out, and a second Buy from the same DM after the point is spent changes nothing and says why", async () => {
    const t = await skillTreeOpenedAtLevelFive("U_ALICE");
    await clickInHome(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Skill tree"));
    await clickInHome(t, "U_ALICE", buyButtonInHome("spark"));

    await reachLevelSix(t, "U_ALICE");
    const buyRhythm = buyButtonInDm("rhythm");
    const buyCircle = buyButtonInDm("circle");
    await clickInDm(t, "U_ALICE", buyRhythm);
    await clickInDm(t, "U_ALICE", buyCircle);
    await clickInDm(t, "U_ALICE", buyRhythm);

    expect(readBlocks(blocksOf(lastDmTo("U_ALICE"))).slice(2)).toEqual([rhythmLine, circleLine]);
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["spark", "rhythm"]);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 1000, level: 6, skillPoints: 0 });
    expect(repliesIn(inDm.channel)).toEqual(["You bought Rhythm.", "I couldn't buy Circle. You need 1 skill point.", "I couldn't buy Rhythm. You own it."]);
  });

  test("a level-up DM Slack held back leaves out a perk the member bought in App Home meanwhile", async () => {
    const t = await skillTreeOpenedAtLevelFive("U_ALICE");
    await clickInHome(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Skill tree"));
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ALICE", buyButtonInHome("rhythm")), form));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await reachLevelSix(t, "U_ALICE");

    expect(readBlocks(blocksOf(lastDmTo("U_ALICE"))).slice(2)).toEqual([sparkLine, circleLine]);
  });
});

describe("P76: before the Skill tree is opened, the level-up DM is today's", () => {
  test("a member who hasn't opened the Skill tree reaches level 6 and gets a DM with no skill points and no Buy", async () => {
    const t = await levelFiveMember("U_ALICE");

    await reachLevelSix(t, "U_ALICE");

    expect(lastDmTo("U_ALICE")).toMatchObject({ text: "🎉 You reached level 6!\nLevel 7 is 500 XP away." });
    expect(lastDmTo("U_ALICE").blocks).toBeUndefined();
  });
});

describe("P78: where the skill tree doesn't apply, the level-up DM offers nothing and its Buy buys nothing", () => {
  test("with skill-tree off, reaching level 6 offers no perk, and a Buy left in an earlier DM writes nothing and replies nothing", async () => {
    const t = await skillTreeOpenedAtLevelFive("U_ALICE");
    await reachLevelSix(t, "U_ALICE");
    const staleBuy = buyButtonInDm("spark");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("skill-tree"));

    await withXp(t, "U_ALICE", 1490);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await clickInDm(t, "U_ALICE", staleBuy);

    expect(lastDmTo("U_ALICE").text).toMatch(/^🎉 You reached level 7!/);
    expect(JSON.stringify(lastDmTo("U_ALICE"))).not.toMatch(/Buy|Spark|Rhythm|Circle/);
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual([]);
    expect(repliesIn(inDm.channel)).toEqual([]);
  });
});

describe("P78 R34: the line a Buy answers with is checked again before each try", () => {
  test("a reply Slack held back is not sent once skill-tree went off before its retry, and the purchase stands", async () => {
    const t = await skillTreeOpenedAtLevelFive("U_ALICE");
    await reachLevelSix(t, "U_ALICE");
    slack.holdingBack("chat.postMessage", inDm.channel, async () => {
      await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("skill-tree"));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await clickInDm(t, "U_ALICE", buyButtonInDm("rhythm"));

    expect(repliesIn(inDm.channel)).toEqual(["You bought Rhythm."]);
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["rhythm"]);
  });
});

type PostedDm = Record<string, unknown>;

async function skillTreeOpenedAtLevelFive(user: string) {
  const t = await levelFiveMember(user);
  await clickInHome(t, user, buttonInHome(slack, user, "Open"));
  return t;
}

async function levelFiveMember(user: string) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);
  await giveKudos(t, user, "U_BOB", 1);
  await withXp(t, user, 590);
  await giveKudos(t, user, "U_BOB", 1);
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
  return t;
}

async function reachLevelSix(t: Backend, user: string) {
  await withXp(t, user, 990);
  await giveKudos(t, user, "U_BOB", 1);
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

function dmsTo(user: string): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("🎉 You reached level"));
}

function lastDmTo(user: string) {
  const dm = dmsTo(user).at(-1);
  expect(dm, `a level-up DM to ${user}`).toBeDefined();
  return dm!;
}

function blocksOf(dm: PostedDm) {
  expect(dm.blocks, "the DM's blocks").toBeDefined();
  return dm.blocks as Block[];
}

function repliesIn(channel: string) {
  return slack.callsTo("chat.postMessage").filter((args) => args.channel === channel).map(({ text }) => text);
}

function buyButtonInDm(perk: string): BlockAction {
  return buyButtonAmong(blocksOf(lastDmTo("U_ALICE")), perk);
}

function buyButtonInHome(perk: string): BlockAction {
  return buyButtonAmong(publishedHomeBlocks(slack, "U_ALICE"), perk);
}

function buyButtonAmong(blocks: Block[], perk: string): BlockAction {
  const block = blocks.find((candidate) => isBuyCommandFor(candidate.accessory?.value, perk));
  expect(block, `a Buy button for ${perk}`).toBeDefined();
  return buttonIn([block!], "Buy");
}

function isBuyCommandFor(value: string | undefined, perk: string) {
  if (value === undefined) return false;
  const command = JSON.parse(value);
  return command.type === "buyPerk" && command.perk === perk;
}

async function clickInDm(t: Backend, user: string, button: BlockAction) {
  await send(t, blockActions(user, button, { inMessage: inDm }));
}

async function clickInHome(t: Backend, user: string, button: BlockAction) {
  await send(t, blockActions(user, button));
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

async function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

async function withXp(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}

async function perksOwnedBy(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("perksOwned").collect()).filter((row) => row.member === member).map(({ perk }) => perk));
}
