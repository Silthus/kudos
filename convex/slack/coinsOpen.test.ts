import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, readBlocks, staleButtonOf, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { replyPrivately, type Given } from "../feedback/replies";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const siteUrl = "https://kudos-site.test";
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const coins = "coins";
const alicesEmail = "alice@example.com";
const xpBelowLevelSix = 990;
const coinsReady = "section: *Coins* is ready. It opens your wallet and the coin perks. [button: Open]";
const coinsNext = "section: Next: Coins at level 6.";

const xpAndUnlocksOn = [onForEveryone("xp-levels"), onForEveryone("unlocks")];
const previewedByAlice = [...xpAndUnlocksOn, onForEmails(coins, alicesEmail)];
const offForEveryoneElse = [...xpAndUnlocksOn, offForEveryone(coins)];
const notCreated = xpAndUnlocksOn;
const unsentMessage = { workspace: "T1", conversation: "C1", message: "1760349999.000100" };
const givenToBob: Given = { recipients: ["U_BOB"], perRecipient: 1, left: 9, skipped: [], awards: [{ kudos: 1 }] };

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CO13 CO16 CO17 CO18 CO26: coins previewed by one member's email", { timeout: 30_000 }, () => {
  test("the previewer reaches level 6, opens Coins from its ready DM and is told what their earlier kudos earned; App Home and the success reply show coins from then on", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await xpOf(t, "U_ALICE", xpBelowLevelSix);

    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
    await send(t, blockActions("U_ALICE", buttonIn(blocksOf(levelUpDmTo("U_ALICE", 6)), "Open"), { inMessage: { channel: "U_ALICE", ts: "1760349700.000100" } }));

    expect(textsOfDmsTo("U_ALICE").at(-1)).toBe("Coins are open. You already have 8 🪙.");
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 8 });
    await openHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain("section fields: *Level*\n*6* | *XP to level 7*\n*500* | *Coins*\n*8 🪙*");

    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB", "U_CAROL"], saysWhy);

    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> and <@U_CAROL> got 1 kudos from you. You have 8 kudos left today.", "+20 XP · +8 🪙"]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section fields: *Level*\n*6* | *XP to level 7*\n*480* | *Coins*\n*16 🪙*");
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 16 });
  });

  test("before the previewer opens Coins: no balance, no coins part and no coin DM; Coins is next before level 6 and ready at it", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await openHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain(coinsNext);
    await xpOf(t, "U_ALICE", xpBelowLevelSix);

    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain(coinsReady);
    expect(slackCallsAbout("U_ALICE").flatMap(readCall).filter(namesCoinsBeyondTheirUnlock)).toEqual([]);
    expect(successRepliesTo("U_ALICE").flat().filter((line) => line.includes("🪙"))).toEqual([]);
    expect(await walletOf(t, "U_ALICE")).toBeNull();
    expect(await balanceRecordedFor(t, "U_ALICE")).toBe(8);
  });

  test("with nothing earned yet, opening Coins tells the previewer how to earn them", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], "thanks");
    await xpOf(t, "U_ALICE", xpBelowLevelSix);

    await giveKudos(t, "U_ALICE", ["U_CAROL"], "thanks");
    await send(t, blockActions("U_ALICE", buttonIn(blocksOf(levelUpDmTo("U_ALICE", 6)), "Open"), { inMessage: { channel: "U_ALICE", ts: "1760349700.000100" } }));

    expect(textsOfDmsTo("U_ALICE").at(-1)).toBe("Coins are open. You earn 🪙 when you thank someone and say why.");
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 0 });
  });

  test("with progression DMs off, opening Coins sends no DM", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await xpOf(t, "U_ALICE", xpBelowLevelSix);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
    const openCoins = buttonIn(blocksOf(levelUpDmTo("U_ALICE", 6)), "Open");
    await dmsTurnedOff(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", openCoins, { inMessage: { channel: "U_ALICE", ts: "1760349700.000100" } }));

    expect(textsOfDmsTo("U_ALICE").filter((dm) => dm.startsWith("Coins are open"))).toEqual([]);
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 8 });
  });

  test("CO21: once Coins is open, a kudos that doesn't say why asks the previewer to say why", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], "thanks");
    await xpOf(t, "U_ALICE", xpBelowLevelSix);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], "thanks");
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_CAROL> got 1 kudos from you. You have 8 kudos left today.", "+10 XP"]);
    await send(t, blockActions("U_ALICE", buttonIn(blocksOf(levelUpDmTo("U_ALICE", 6)), "Open"), { inMessage: { channel: "U_ALICE", ts: "1760349700.000100" } }));

    await giveKudos(t, "U_ALICE", ["U_BOB"], "thanks");

    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 7 kudos left today.", "+10 XP · Add why they earned it to earn more."]);
  });

  test("CO14 CO21: with the skill tree on and no perk owned, a hint written while Coins was open is left out when coins turn off before Slack takes the reply", async () => {
    const t = await workspaceDeciding(...previewedByAlice, onForEveryone("skill-tree"));
    await coinsOpenedBy(t, "U_ALICE");
    const earlier = successRepliesTo("U_ALICE").length;
    await t.run((ctx) => replyPrivately(ctx, unsentMessage, undefined, "U_ALICE", { kind: "given", outcome: givenToBob, base: 10, annotations: { gate: { version: 1, thoughtful: false } } }));

    await flagsFromPostHog(t, postHog, ...offForEveryoneElse, onForEveryone("skill-tree"));
    await settle(t);

    expect(successRepliesTo("U_ALICE").slice(earlier)).toEqual([["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP"]]);
  });

  test("F25: the coins exposure carries true for the previewer and false for the other member", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await giveKudos(t, "U_BOB", ["U_ALICE"], saysWhy);

    expect(await exposuresOf(t, "U_ALICE")).toEqual([[coins, true]]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([[coins, false]]);
  });

  test("the other member's Slack calls are exactly those with coins off for everyone, though they earn coins", async () => {
    const whilePreviewed = await bobsSideOf(previewedByAlice);
    vi.clearAllTimers();
    const whileOff = await bobsSideOf(offForEveryoneElse);

    expect(whilePreviewed.calls.flatMap(readCall).filter(namesCoins)).toEqual([]);
    expect(whilePreviewed).toEqual(whileOff);
    expect(whilePreviewed.balance).toBe(8);
  });
});

describe("CO17: App Home's front door", { timeout: 30_000 }, () => {
  test("the level line ends with the balance once Coins is open from the website's front door", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    vi.stubEnv("SITE_URL", siteUrl);
    const t = await workspaceDeciding(...previewedByAlice, onForEveryone("website"));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await xpOf(t, "U_ALICE", xpBelowLevelSix);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openUnlock", feature: "coins" })));
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: Level 6 · 500 XP to level 7 · 8 🪙");
  });
});

describe("CO14 P78: coins are dark where they aren't shown, and still recorded", { timeout: 30_000 }, () => {
  test.each([
    ["off", offForEveryoneElse, true],
    ["not created", notCreated, true],
    ["missing its flags key", previewedByAlice, false],
  ])("with coins %s, the previewer reaching level 6 sees nothing of coins, Coins is never ready, named or next, and their kudos still earn coins", async (_, definitions, flagsKeySet) => {
    const t = await workspaceDeciding(...definitions);
    if (!flagsKeySet) vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await openHome(t, "U_ALICE");
    await xpOf(t, "U_ALICE", xpBelowLevelSix);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
    await openHome(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], "thanks");

    expect(slackCallsAbout("U_ALICE").flatMap(readCall).filter(namesCoins)).toEqual([]);
    expect(await coinUnlocks(t)).toEqual([]);
    expect(await walletOf(t, "U_ALICE")).toBeNull();
    expect(await balanceRecordedFor(t, "U_ALICE")).toBe(8);
  });

  test("turning coins off after the previewer opened Coins hides the balance again and keeps it", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    const before = slack.calls.length;

    await flagsFromPostHog(t, postHog, ...offForEveryoneElse);
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await openHome(t, "U_ALICE");

    expect(slack.calls.slice(before).flatMap(readCall).filter(namesCoins)).toEqual([]);
    expect(await walletOf(t, "U_ALICE")).toBeNull();
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 12 });
  });
});

async function coinsOpenedBy(t: Backend, user: string) {
  await giveKudos(t, user, ["U_BOB"], saysWhy);
  await xpOf(t, user, xpBelowLevelSix);
  await giveKudos(t, user, ["U_CAROL"], saysWhy);
  await send(t, blockActions(user, staleButtonOf({ type: "openUnlock", feature: "coins" })));
}

async function bobsSideOf(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await giveKudos(t, "U_BOB", ["U_ALICE"], saysWhy);
  await openHome(t, "U_BOB");
  await xpOf(t, "U_BOB", xpBelowLevelSix);
  await giveKudos(t, "U_BOB", ["U_CAROL"], saysWhy);
  await openHome(t, "U_BOB");
  vi.setSystemTime(tuesday + dayMs);
  await giveKudos(t, "U_BOB", ["U_ALICE"], "thanks");
  vi.setSystemTime(tuesday);
  return { calls: slackCallsAbout("U_BOB").map(withoutTimestamps), balance: await balanceRecordedFor(t, "U_BOB") };
}

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

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
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

async function dmsTurnedOff(t: Backend, user: string) {
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("progressSettings", { member, dms: false }));
}

async function walletOf(t: Backend, user: string) {
  return t.query(internal.wallet.wallet.walletOf, { member: await memberOf(t, user) });
}

async function balanceRecordedFor(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}

async function coinUnlocks(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("unlocks").collect()).filter(({ feature }) => feature === "coins"));
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === coins);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}

type PostedDm = Record<string, unknown>;

function dmsTo(user: string): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && !String(text).startsWith("👋 Welcome"));
}

function textsOfDmsTo(user: string) {
  return dmsTo(user).map(({ text }) => String(text));
}

function levelUpDmTo(user: string, level: number) {
  const dm = dmsTo(user).find(({ text }) => String(text).startsWith(`🎉 You reached level ${level}!`));
  expect(dm, `${user}'s level ${level} DM`).toBeDefined();
  return dm!;
}

function blocksOf(dm: PostedDm) {
  expect(dm.blocks, "the DM's blocks").toBeDefined();
  return dm.blocks as Block[];
}

function successRepliesTo(user: string) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n"));
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

function namesCoinsBeyondTheirUnlock(line: string) {
  return line.includes("🪙") || line.includes("Coins are open");
}
