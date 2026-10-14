import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, publishedHomeBlocks, staleButtonOf, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import { recordReward, standingOf } from "../progression/progression";
import { isCoinPerk, perkOf, type PerkId } from "../progression/tree";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const alicesEmail = "alice@example.com";
const coinsEarnedOnTheWay = 8;

const sparkCopy = "+5 XP the first time each day you thank someone and say why.";
const rhythmCopy = "+2 XP each time you thank someone and say why, once per person a day.";
const circleCopy = "+5 XP the first time each week you thank a person and say why.";
const flameCopy = "Spark gives +8 XP instead of +5.";
const cadenceCopy = "Rhythm gives +3 XP instead of +2.";
const bridgeCopy = "Circle gives +8 XP instead of +5 when the person isn't in your primary group. Without a primary group, everyone counts.";
const treasurerCopy = "+2 🪙 each time you thank someone and say why, once per person a day.";
const bankerCopy = "Treasurer gives +4 🪙 instead of +2.";

const treeOn = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("skill-tree")];
const previewedByAlice = [...treeOn, onForEmails("coins", alicesEmail)];
const coinsOff = [...treeOn, offForEveryone("coins")];

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

describe("CO22 CO23 CO24: a level-7 member with Coins open buys flame with a skill point and coins", { timeout: 30_000 }, () => {
  test("Buy on flame with 150 🪙 debits both and grants it; the next kudos that says why pays flame 8 and no spark line", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 150 });
    await openSkillTreeTab(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain(`section: *Flame* · 1 skill point · 150 🪙\n${flameCopy} [button: Buy]`);

    await click(t, "U_ALICE", buyButtonOf("flame"));

    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 0 });
    expect(await standing(t, "U_ALICE")).toMatchObject({ level: 7, skillPoints: 1 });
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["spark", "flame"]);
    expect(publishedHome(slack, "U_ALICE")).toContain(`section: ✅ *Flame* · Owned\n${flameCopy}`);

    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP · +4 🪙 · Flame bonus (+8 XP)"]);
    expect((await giverRecordsOf(t, "U_ALICE")).at(-1)?.bonus).toEqual([{ source: "flame", xp: 8 }]);
  });

  test("the Skill tree tab lists the upgrades and the coin perks with their prices", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark", "rhythm", "circle"], coins: 200 });

    await openSkillTreeTab(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").slice(4, -1)).toEqual([
      `section: ✅ *Spark* · Owned\n${sparkCopy}`,
      `section: ✅ *Rhythm* · Owned\n${rhythmCopy}`,
      `section: ✅ *Circle* · Owned\n${circleCopy}`,
      `section: *Flame* · 1 skill point · 150 🪙\n${flameCopy}`,
      "context: You need 1 skill point.",
      `section: *Cadence* · 1 skill point · 200 🪙\n${cadenceCopy}`,
      "context: You need 1 skill point.",
      `section: *Bridge* · 1 skill point · 150 🪙\n${bridgeCopy}`,
      "context: You need 1 skill point.",
      `section: *Treasurer* · 1 skill point\n${treasurerCopy}`,
      "context: You need 1 skill point.",
      `section: *Banker* · 2 skill points · 250 🪙\n${bankerCopy}`,
      "context: It opens at level 9.",
    ]);
  });

  test("the confirmation names both prices", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 150 });

    await openSkillTreeTab(t, "U_ALICE");

    expect(buyButtonElementOf("flame")).toMatchObject({ confirm: { text: { type: "plain_text", text: "This spends 1 skill point and 150 🪙. Skill points and coins are never refunded." } } });
  });

  test("without enough coins, Buy on flame answers no-coins and changes nothing", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 149 });
    await openSkillTreeTab(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain(`section: *Flame* · 1 skill point · 150 🪙\n${flameCopy}`);
    const before = await treeTables(t);

    await click(t, "U_ALICE", buyButtonOf("flame"));

    expect(await purchasesOf(t)).toEqual([{ kind: "refused", perk: "flame", reason: "no-coins" }]);
    expect(await treeTables(t)).toEqual(before);
    expect(linesOf("Flame")).toEqual([`section: *Flame* · 1 skill point · 150 🪙\n${flameCopy}`, "context: You need 150 🪙."]);
  });

  test("with Coins not opened yet, a stale Buy on flame answers coins-not-open and changes nothing", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 150, coinsOpen: false });
    const before = await treeTables(t);

    await click(t, "U_ALICE", buyButtonOf("flame"));

    expect(await purchasesOf(t)).toEqual([{ kind: "refused", perk: "flame", reason: "coins-not-open" }]);
    expect(await treeTables(t)).toEqual(before);
  });

  test("a Buy from the level-up DM that Coins isn't open for says so in the conversation", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 150, coinsOpen: false });

    await send(t, blockActions("U_ALICE", buyButtonOf("flame"), { inMessage: { channel: "D_ALICE", ts: "1760349700.000100" } }));

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "D_ALICE").map(({ text }) => text)).toEqual(["I couldn't buy Flame. Open Coins first."]);
  });
});

describe("CO24 CO30: a purchase spends once per idempotency key", { timeout: 30_000 }, () => {
  test("the same Buy delivered twice buys flame once and replays its outcome", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 300 });
    const buyFlame = blockActions("U_ALICE", buyButtonOf("flame"));

    await send(t, buyFlame);
    await send(t, buyFlame);

    expect(await purchasesOf(t)).toEqual([{ kind: "bought", perk: "flame" }]);
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 150 });
    expect(await standing(t, "U_ALICE")).toMatchObject({ skillPoints: 1 });
  });

  test("two Buys with coins for one purchase buy one: flame, then bridge refused for coins", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark", "circle"], coins: 150, level: 8 });

    await click(t, "U_ALICE", buyButtonOf("flame"));
    await click(t, "U_ALICE", buyButtonOf("bridge"));

    expect(await purchasesOf(t)).toEqual([
      { kind: "bought", perk: "flame" },
      { kind: "refused", perk: "bridge", reason: "no-coins" },
    ]);
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["spark", "circle", "flame"]);
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 0 });
    expect(await standing(t, "U_ALICE")).toMatchObject({ skillPoints: 1 });
  });
});

describe("CO14 CO22 CO25: upgrades exist only where coins are visible, and owned ones keep paying", { timeout: 30_000 }, () => {
  test.each([
    ["coins off", coinsOff, true],
    ["Coins not opened", previewedByAlice, false],
  ])("with %s, the Skill tree tab lists no upgrade and no 🪙", async (_, flags, coinsOpen) => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 150, coinsOpen, flags });

    await openSkillTreeTab(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/Flame|Cadence|Bridge|🪙/);
  });

  test("a purchase reply Slack takes after coins turned off names no upgrade and no 🪙", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 149 });

    slack.holdingBack("chat.postMessage", "D_ALICE", async () => {
      await flagsFromPostHog(t, postHog, ...coinsOff);
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await send(t, blockActions("U_ALICE", buyButtonOf("flame"), { inMessage: { channel: "D_ALICE", ts: "1760349700.000100" } }));

    expect(await purchasesOf(t)).toEqual([{ kind: "refused", perk: "flame", reason: "no-coins" }]);
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "D_ALICE").map(({ text }) => text)).toEqual(["I couldn't buy Flame. You need 150 🪙."]);
  });

  test("with coins off, a stale Buy on flame owns nothing, spends nothing and stores no outcome", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 150, flags: coinsOff });
    const before = await treeTables(t);

    await click(t, "U_ALICE", buyButtonOf("flame"));

    expect(await purchasesOf(t)).toEqual([]);
    expect(await treeTables(t)).toEqual(before);
    expect(await balanceRecordedFor(t, "U_ALICE")).toBe(150);
  });

  test("once coins turn off, an owned flame stays listed as owned without its price and keeps paying 8", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["spark"], coins: 150 });
    await click(t, "U_ALICE", buyButtonOf("flame"));

    await flagsFromPostHog(t, postHog, ...coinsOff);
    await openSkillTreeTab(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect(publishedHome(slack, "U_ALICE")).toContain(`section: ✅ *Flame* · Owned\n${flameCopy}`);
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/Cadence|Bridge|🪙/);
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP · Flame bonus (+8 XP)"]);
  });
});

describe("CO4 CO22: treasurer and banker pay more coins on every thank-you that says why", { timeout: 30_000 }, () => {
  const giving = { source: "giving", coins: 4 };

  test("with treasurer, a kudos that says why records 4 + 2 coins and replies +6 🪙", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["treasurer"], coins: coinsEarnedOnTheWay });
    const before = await balanceRecordedFor(t, "U_ALICE");

    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect((await giverRecordsOf(t, "U_ALICE")).at(-1)?.coins).toEqual([giving, { source: "treasurer", coins: 2 }]);
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP · +6 🪙"]);
    expect(await balanceRecordedFor(t, "U_ALICE")).toBe(before + 6);
  });

  test("with banker, a kudos that says why records 4 + 4 coins, no treasurer line, and replies +8 🪙", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["treasurer", "banker"], coins: 250, level: 9 });
    const before = await balanceRecordedFor(t, "U_ALICE");

    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect((await giverRecordsOf(t, "U_ALICE")).at(-1)?.coins).toEqual([giving, { source: "banker", coins: 4 }]);
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP · +8 🪙"]);
    expect(await balanceRecordedFor(t, "U_ALICE")).toBe(before + 8);
  });

  test("a second kudos to the same person that day earns no perk coins", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["treasurer"], coins: coinsEarnedOnTheWay });
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    const before = await balanceRecordedFor(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect((await giverRecordsOf(t, "U_ALICE")).at(-1)?.coins).toBeUndefined();
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 8 kudos left today.", "+10 XP"]);
    expect(await balanceRecordedFor(t, "U_ALICE")).toBe(before);
  });

  test("Buy on treasurer spends a skill point and no coins", async () => {
    const t = await aliceWithTheTreeOpen({ coins: coinsEarnedOnTheWay });
    await openSkillTreeTab(t, "U_ALICE");

    await click(t, "U_ALICE", buyButtonOf("treasurer"));

    expect(await purchasesOf(t)).toEqual([{ kind: "bought", perk: "treasurer" }]);
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: coinsEarnedOnTheWay });
    expect(await standing(t, "U_ALICE")).toMatchObject({ skillPoints: 2 });
    expect(buyButtonElementOf("treasurer")).toBeUndefined();
  });

  test("Buy on banker with treasurer, two skill points and 250 🪙 debits both and grants it", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["treasurer"], coins: 250, level: 9 });

    await click(t, "U_ALICE", buyButtonOf("banker"));

    expect(await purchasesOf(t)).toEqual([{ kind: "bought", perk: "treasurer" }, { kind: "bought", perk: "banker" }]);
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["treasurer", "banker"]);
    expect(await walletOf(t, "U_ALICE")).toEqual({ balance: 0 });
    expect(await standing(t, "U_ALICE")).toMatchObject({ level: 9, skillPoints: 2 });
  });

  test.each([
    ["without treasurer", { owns: [], coins: 250 }, "needs-prerequisite"],
    ["with too few coins", { owns: ["treasurer"], coins: 249 }, "no-coins"],
  ] satisfies Array<[string, Pick<Alice, "owns" | "coins">, string]>)("Buy on banker %s is refused and changes nothing", async (_, alice, reason) => {
    const t = await aliceWithTheTreeOpen({ ...alice, level: 9 });
    const before = await treeTables(t);

    await click(t, "U_ALICE", buyButtonOf("banker"));

    expect((await purchasesOf(t)).at(-1)).toEqual({ kind: "refused", perk: "banker", reason });
    expect(await treeTables(t)).toEqual(before);
  });

  test("with Coins not opened yet, a stale Buy on treasurer answers coins-not-open and changes nothing", async () => {
    const t = await aliceWithTheTreeOpen({ coins: coinsEarnedOnTheWay, coinsOpen: false });
    const before = await treeTables(t);

    await click(t, "U_ALICE", buyButtonOf("treasurer"));

    expect(await purchasesOf(t)).toEqual([{ kind: "refused", perk: "treasurer", reason: "coins-not-open" }]);
    expect(await treeTables(t)).toEqual(before);
  });

  test("with coins off, the Skill tree tab lists neither, and a stale Buy on treasurer owns nothing and stores no outcome", async () => {
    const t = await aliceWithTheTreeOpen({ coins: coinsEarnedOnTheWay, flags: coinsOff });
    const before = await treeTables(t);

    await click(t, "U_ALICE", buyButtonOf("treasurer"));
    await openSkillTreeTab(t, "U_ALICE");

    expect(await purchasesOf(t)).toEqual([]);
    expect(await treeTables(t)).toEqual(before);
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/Treasurer|Banker|🪙/);
  });

  test("once coins turn off, an owned treasurer stays listed as owned without a 🪙 and keeps paying 2 coins", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["treasurer"], coins: coinsEarnedOnTheWay });

    await flagsFromPostHog(t, postHog, ...coinsOff);
    await openSkillTreeTab(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect(publishedHome(slack, "U_ALICE")).toContain("section: ✅ *Treasurer* · Owned");
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/🪙|Banker/);
    expect((await giverRecordsOf(t, "U_ALICE")).at(-1)?.coins).toEqual([giving, { source: "treasurer", coins: 2 }]);
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP"]);
  });

  test("once coins turn off, owning only treasurer doesn't ask a kudos to say why", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["treasurer"], coins: coinsEarnedOnTheWay });

    await flagsFromPostHog(t, postHog, ...coinsOff);
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], "ty");

    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP"]);
  });

  test("where the skill tree doesn't apply, an owned treasurer writes no perk coin line", async () => {
    const t = await aliceWithTheTreeOpen({ owns: ["treasurer"], coins: coinsEarnedOnTheWay });

    await flagsFromPostHog(t, postHog, ...previewedByAlice.filter(({ key }) => key !== "skill-tree"), offForEveryone("skill-tree"));
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect((await giverRecordsOf(t, "U_ALICE")).at(-1)?.coins).toEqual([giving]);
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP · +4 🪙"]);
  });
});

type Alice = { owns?: PerkId[]; coins: number; coinsOpen?: boolean; flags?: FlagDefinition[]; level?: number };

async function aliceWithTheTreeOpen({ owns = [], coins, coinsOpen = true, flags = previewedByAlice, level = 7 }: Alice) {
  const t = await workspaceDeciding(...flags);
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
  await xpOf(t, "U_ALICE", xpToReach(level) - 10);
  await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
  await click(t, "U_ALICE", staleButtonOf({ type: "openUnlock", feature: "skillTree" }));
  if (coinsOpen) await click(t, "U_ALICE", staleButtonOf({ type: "openUnlock", feature: "coins" }));
  await savings(t, "U_ALICE", coins - coinsEarnedOnTheWay);
  for (const perk of owns) await click(t, "U_ALICE", staleButtonOf({ type: "buyPerk", perk }));
  return t;
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

async function openSkillTreeTab(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
  await click(t, user, buttonInHome(slack, user, "Skill tree"));
}

async function click(t: Backend, user: string, button: BlockAction) {
  await send(t, blockActions(user, button));
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

function buyButtonOf(perk: PerkId): BlockAction {
  return staleButtonOf({ type: "buyPerk", perk });
}

function linesOf(perkName: string) {
  const home = publishedHome(slack, "U_ALICE");
  const at = home.findIndex((line) => line.startsWith(`section: *${perkName}*`));
  return home.slice(at, at + 2);
}

function buyButtonElementOf(perk: PerkId) {
  return publishedHomeBlocks(slack, "U_ALICE").find((candidate) => candidate.accessory?.value === JSON.stringify({ type: "buyPerk", perk }))?.accessory;
}

async function purchasesOf(t: Backend) {
  const purchases = await t.run((ctx) => ctx.db.query("perkPurchases").collect());
  return purchases.map(({ outcome }) => outcome).filter(({ perk }) => isCoinPerk(perkOf(perk)));
}

async function treeTables(t: Backend) {
  return t.run(async (ctx) => ({
    memberProgress: await ctx.db.query("memberProgress").collect(),
    perksOwned: await ctx.db.query("perksOwned").collect(),
    wallets: await ctx.db.query("wallets").collect(),
    coinSpends: await ctx.db.query("coinSpends").collect(),
  }));
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

async function savings(t: Backend, user: string, coins: number) {
  const member = await memberOf(t, user);
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins, item: null, catalogueVersion: "2", at: Date.now() }));
  await settle(t);
}

async function walletOf(t: Backend, user: string) {
  return t.query(internal.wallet.wallet.walletOf, { member: await memberOf(t, user) });
}

async function balanceRecordedFor(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}

async function perksOwnedBy(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("perksOwned").collect()).filter((row) => row.member === member).map(({ perk }) => perk));
}

async function giverRecordsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("effectsRecords").collect()).filter((record) => record.member === member && record.side === "giver"));
}

function successRepliesTo(user: string) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n"));
}
