import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { everythingStored, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, readBlocks, staleButtonOf, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { xpToReach } from "../progression/levels";
import { recordReward } from "../progression/progression";
import { questOf, questPool, type QuestId } from "../quests/pool";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const thisWeek = "2026-10-12";
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const coins = "coins";
const alicesEmail = "alice@example.com";
const savedUp = 400;

const everyOtherFeature = ["xp-levels", "unlocks", "skill-tree", "quests", "achievements"];
const featuresOn = (...keys: string[]) => keys.map(onForEveryone);
const featuresOnBut = (off: string) => [...featuresOn(...everyOtherFeature.filter((key) => key !== off)), offForEveryone(off)];

const previewedByAlice = [...featuresOn(...everyOtherFeature), onForEmails(coins, alicesEmail)];
const coinsOff = [...featuresOn(...everyOtherFeature), offForEveryone(coins)];
const coinsNotCreated = featuresOn(...everyOtherFeature);
const onWithoutXpLevels = [...featuresOnBut("xp-levels"), onForEveryone(coins)];
const onWithoutUnlocks = [...featuresOnBut("unlocks"), onForEveryone(coins)];

const sayWhyDrawnFromTheDeployOn = { quest: "say-why" as QuestId, reward: questOf("say-why").reward, catalogueVersion: questPool.version };
const questsOneKudosLeavesOpen: QuestId[] = ["say-why-three-times", "say-why-three-days"];
const friendsOf: Record<string, [string, string, string]> = { U_ALICE: ["U_BOB", "U_CAROL", "U_DANA"], U_BOB: ["U_ALICE", "U_CAROL", "U_DANA"] };

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

describe("CO14 P78: coins are dark where they aren't shown, and still recorded", { timeout: 60_000 }, () => {
  test("with coins on for Alice, her walk reaches every coins path: readiness, the Coins DM, the balance, the coin perks and prices, and the reply, quest and tier coins", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await walkEveryCoinsPath(t, "U_ALICE");

    const told = slackCallsAbout("U_ALICE").flatMap(readCall).join("\n");
    expect(told).toContain("*Coins* is ready.");
    expect(told).toMatch(/Coins are open\. You already have \d+ 🪙\./);
    expect(told).toMatch(/\*Coins\*\n\*\d+ 🪙\*/);
    expect(told).toContain("*Treasurer* · 1 skill point");
    expect(told).toContain("*Flame* · 1 skill point · 150 🪙");
    expect(told).toContain("+10 XP · +6 🪙 · Quest done: Thank someone and say why (+20 XP, +10 🪙) · Quest done: Finish a weekly quest (+20 XP) · Flame bonus (+8 XP)");
    expect(told).toMatch(/🏅 You earned [^\n]+, bronze\)\. \+10 🪙/);
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["spark", "flame", "treasurer"]);
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: await balanceRecordedFor(t, "U_ALICE") });
  });

  test.each([
    ["off", coinsOff, true],
    ["not created", coinsNotCreated, true],
    ["on but the flags key missing", [...featuresOn(...everyOtherFeature), onForEveryone(coins)], false],
    ["on but xp-levels off", onWithoutXpLevels, true],
    ["on but unlocks off", onWithoutUnlocks, true],
  ])("with coins %s, the same walk shows nothing of coins anywhere, and coins are still recorded", async (_, definitions, flagsKeySet) => {
    const t = await workspaceDeciding(...definitions);
    if (!flagsKeySet) vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");

    await walkEveryCoinsPath(t, "U_ALICE");

    expect(slack.calls.flatMap(readCall).filter(namesCoins)).toEqual([]);
    expect(await walletOf(t, "U_ALICE")).toBeNull();
    expect(await coinsOpenings(t)).toEqual([]);
    expect(await coinSpends(t)).toEqual([]);
    expect(await perksOwnedBy(t, "U_ALICE")).not.toContain("flame");
    expect(await perksOwnedBy(t, "U_ALICE")).not.toContain("treasurer");
    expect(await balanceRecordedFor(t, "U_ALICE")).toBeGreaterThan(savedUp);
  });

  test.each([
    ["off", coinsOff],
    ["on but xp-levels off", onWithoutXpLevels],
    ["on but unlocks off", onWithoutUnlocks],
  ])("with coins %s, a stale Open for Coins and a stale Buy for each coin perk write nothing and publish nothing", async (_, definitions) => {
    const t = await workspaceDeciding(...definitions);
    await walkEveryCoinsPath(t, "U_ALICE");
    await click(t, "U_ALICE", { type: "showHomeTab", tab: "profile" });
    const stored = await everythingStored(t, { except: ["slackReceipts"] });
    const published = vi.mocked(publish).mock.calls.length;

    await click(t, "U_ALICE", { type: "openUnlock", feature: "coins" });
    for (const perk of ["flame", "cadence", "bridge", "treasurer", "banker"]) await click(t, "U_ALICE", { type: "buyPerk", perk });

    expect(await everythingStored(t, { except: ["slackReceipts"] })).toEqual(stored);
    expect(eventsPublishedSince(published)).toEqual([]);
  });

  test.each([
    ["xp-levels", featuresOnBut("xp-levels")],
    ["unlocks", featuresOnBut("unlocks")],
  ])("once Alice opened Coins, turning %s off hides every coins path again, though coins are on for her", async (_, others) => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryCoinsPath(t, "U_ALICE");
    const before = slack.calls.length;

    await flagsFromPostHog(t, postHog, ...others, onForEmails(coins, alicesEmail));
    vi.setSystemTime(tuesday + 2 * dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB", "U_CAROL"], saysWhy);
    await openSkillTreeTab(t, "U_ALICE");

    expect(slack.calls.slice(before).flatMap(readCall).filter(namesCoins)).toEqual([]);
    expect(await walletOf(t, "U_ALICE")).toBeNull();
  });

  test("with coins on for Alice's email only, every other member's Slack calls equal those with coins off, though they earn coins", async () => {
    const whilePreviewed = await bobsSideOfBothWalks(previewedByAlice);
    vi.clearAllTimers();
    vi.mocked(publish).mockClear();
    const whileOff = await bobsSideOfBothWalks(coinsOff);

    expect(whilePreviewed.calls.filter(namesCoins)).toEqual([]);
    expect(whilePreviewed.calls).toEqual(whileOff.calls);
    expect(whilePreviewed.balance).toEqual(whileOff.balance);
    expect(whilePreviewed.balance).toBeGreaterThan(savedUp);
  });

});

describe("CO13 O35 O36: the coins flag turned off and on, and its exposure", { timeout: 60_000 }, () => {
  test("O35 F24: turning coins off and on again rewrites nothing and shows the same balance and perks", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryCoinsPath(t, "U_ALICE");
    await openSkillTreeTab(t, "U_ALICE");
    const shown = { home: await homeShownTo(t, "U_ALICE"), wallet: await walletOf(t, "U_ALICE") };
    const recorded = await coinsRecords(t);

    await flagsFromPostHog(t, postHog, ...coinsOff);
    const hidden = await homeShownTo(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...previewedByAlice);

    expect(hidden.join("\n")).not.toMatch(/🪙|Coins|Cadence|Bridge|Banker/);
    expect(await coinsRecords(t)).toEqual(recorded);
    expect({ home: await homeShownTo(t, "U_ALICE"), wallet: await walletOf(t, "U_ALICE") }).toEqual(shown);
  });

  test("O36 F25: the coins exposure goes once per member and value, and only where the flag decides anything", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryCoinsPath(t, "U_ALICE");
    await walkEveryCoinsPath(t, "U_BOB");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([false]);

    await flagsFromPostHog(t, postHog, ...coinsOff);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
    await openSkillTreeTab(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_DANA"], saysWhy);
    await openSkillTreeTab(t, "U_ALICE");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true, false]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([false]);
  });

  test.each([
    ["xp-levels off", onWithoutXpLevels],
    ["unlocks off", onWithoutUnlocks],
  ])("with coins on but %s, no coins exposure is sent", async (_, definitions) => {
    const t = await workspaceDeciding(...definitions);

    await walkEveryCoinsPath(t, "U_ALICE");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([]);
  });
});

async function walkEveryCoinsPath(t: Backend, user: string) {
  const [first, second, third] = friendsOf[user]!;
  await giveKudos(t, user, [first], saysWhy);
  await openHome(t, user);
  await xpOf(t, user, xpToReach(9) - 10);
  await sayWhyDrawnFor(t, user);
  await giveKudos(t, user, [second], "thanks");
  for (const feature of ["skillTree", "coins", "book", "quests"]) await click(t, user, { type: "openUnlock", feature });
  await savings(t, user, savedUp);
  await openSkillTreeTab(t, user);
  for (const perk of ["spark", "flame", "treasurer"]) await click(t, user, { type: "buyPerk", perk });
  vi.setSystemTime(Date.now() + dayMs);
  await giveKudos(t, user, [third], saysWhy);
  await openHome(t, user);
  vi.setSystemTime(tuesday);
}

async function bobsSideOfBothWalks(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await walkEveryCoinsPath(t, "U_ALICE");
  await walkEveryCoinsPath(t, "U_BOB");
  const calls = slackCallsAbout("U_BOB").map(withoutTimestamps);
  return { calls: calls.map((call) => JSON.stringify(call)).sort(), balance: await balanceRecordedFor(t, "U_BOB") };
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_ALICE", { profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withMember("U_CAROL", { profile: { email: "carol@example.com" } })
    .withMember("U_DANA", { profile: { email: "dana@example.com" } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, announcementChannel: "C_NEWS" }));
  return bookShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string) {
  sentMessages += 1;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function openSkillTreeTab(t: Backend, user: string) {
  await openHome(t, user);
  if (publishedHome(slack, user).some((line) => line.includes("[button: Skill tree]"))) await send(t, blockActions(user, buttonInHome(slack, user, "Skill tree")));
}

async function homeShownTo(t: Backend, user: string) {
  await openSkillTreeTab(t, user);
  return publishedHome(slack, user);
}

async function click(t: Backend, user: string, command: unknown) {
  await send(t, blockActions(user, staleButtonOf(command)));
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

async function sayWhyDrawnFor(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const quests = [sayWhyDrawnFromTheDeployOn.quest, ...questsOneKudosLeavesOpen];
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: sayWhyDrawnFromTheDeployOn.reward, catalogueVersion: sayWhyDrawnFromTheDeployOn.catalogueVersion, feasibleBecause: { peopleLeft: 2, recognitionsLeft: 18 } }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots }));
}

async function savings(t: Backend, user: string, saved: number) {
  const member = await memberOf(t, user);
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins: saved, item: null, catalogueVersion: "2", at: Date.now() }));
  await settle(t);
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

async function walletOf(t: Backend, user: string) {
  return t.query(internal.wallet.wallet.walletOf, { member: await memberOf(t, user) });
}

async function balanceRecordedFor(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}

async function perksOwnedBy(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("perksOwned").collect()).filter((row) => row.member === member).map(({ perk }) => perk));
}

async function coinsOpenings(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("unlocks").collect()).filter(({ feature, openedAt }) => feature === "coins" && openedAt !== undefined));
}

async function coinSpends(t: Backend) {
  return t.run((ctx) => ctx.db.query("coinSpends").collect());
}

async function coinsRecords(t: Backend) {
  return t.run(async (ctx) => ({
    effectsRecords: await ctx.db.query("effectsRecords").collect(),
    rewardRecords: await ctx.db.query("rewardRecords").collect(),
    wallets: await ctx.db.query("wallets").collect(),
    coinSpends: await ctx.db.query("coinSpends").collect(),
    receivingGivers: await ctx.db.query("receivingGivers").collect(),
    perksOwned: await ctx.db.query("perksOwned").collect(),
    perkPurchases: await ctx.db.query("perkPurchases").collect(),
    memberProgress: await ctx.db.query("memberProgress").collect(),
    unlocks: await ctx.db.query("unlocks").collect(),
  }));
}

function eventsPublishedSince(count: number): DomainEvent["type"][] {
  return vi
    .mocked(publish)
    .mock.calls.slice(count)
    .map(([, event]) => event.type);
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === coins);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => properties.$feature_flag_response);
}

function slackCallsAbout(user: string) {
  return slack.calls.filter(({ args }) => [args.channel, args.user, args.user_id].includes(user));
}

function readCall({ args }: SlackCall): string[] {
  const texts = [args.text, ...(Array.isArray(args.blocks) ? readBlocks(args.blocks as Block[]) : [])];
  const view = args.view as { blocks?: Block[] } | undefined;
  return [...texts, ...(view?.blocks === undefined ? [] : readBlocks(view.blocks))].filter((line): line is string => typeof line === "string");
}

function withoutTimestamps(call: SlackCall) {
  return JSON.parse(JSON.stringify(call).replace(/\d{10}\.\d{6}/g, "<ts>"));
}

function namesCoins(line: string) {
  return line.includes("🪙") || /coin/i.test(line);
}
