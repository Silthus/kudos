import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, readBlocks, staleButtonOf, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import type { KudosGivenEvent } from "../bus/events";
import { grantItem } from "../store/inventory";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const alicesEmail = "alice@example.com";
const carolsEmail = "carol@example.com";
const xpBelowLevelSix = 990;
const store = "store";
const storeEmoji = ["sunflower", "rocket", "glowing-star", "gem", "rainbow", "clover", "doughnut", "cookie", "crown", "balloon", "cactus", "trophy"].map((name) => `kudos-emoji-${name}`);

const xpAndUnlocksOn = [onForEveryone("xp-levels"), onForEveryone("unlocks")];
const coinsForAliceAndCarol = onForEmails("coins", alicesEmail, carolsEmail);
const previewedByAlice = [...xpAndUnlocksOn, coinsForAliceAndCarol, onForEmails(store, alicesEmail)];
const storeOff = [...xpAndUnlocksOn, coinsForAliceAndCarol, offForEveryone(store)];
const storeNotCreated = [...xpAndUnlocksOn, coinsForAliceAndCarol];
const coinsOff = [...xpAndUnlocksOn, offForEveryone("coins"), onForEveryone(store)];

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

describe("ST20 ST21 ST24 ST25: opening Coins opens the inventory, previewed by one member's email", { timeout: 30_000 }, () => {
  test("Coins is ready as Coins and inventory, opening your wallet, the store and your kudos emoji, and opening it says 🦔 is one of your kudos emoji", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await openHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain("section: Next: Coins and inventory at level 6.");
    await xpOf(t, "U_ALICE", xpBelowLevelSix);

    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);
    expect(readDm(levelUpDmTo("U_ALICE", 6))).toContain("section: *Coins and inventory* is ready. It opens your wallet, the store and your kudos emoji. [button: Open]");
    await send(t, blockActions("U_ALICE", buttonIn(blocksOf(levelUpDmTo("U_ALICE", 6)), "Open"), { inMessage: { channel: "U_ALICE", ts: "1760349700.000100" } }));

    expect(textsOfDmsTo("U_ALICE").at(-1)).toBe("Coins and inventory are open. You already have 8 🪙, and 🦔 is one of your kudos emoji: use it in a kudos like :taco:.");
  });

  test("App Home's ready Coins and inventory opens your wallet, the store and your kudos emoji", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await xpOf(t, "U_ALICE", xpBelowLevelSix);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: *Coins and inventory* is ready. It opens your wallet, the store and your kudos emoji. [button: Open]");
  });

  test("with nothing earned yet, the opening DM leaves the balance out", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await coinsOpenedBy(t, "U_ALICE", "thanks");

    expect(textsOfDmsTo("U_ALICE").at(-1)).toBe("Coins and inventory are open. 🦔 is one of your kudos emoji: use it in a kudos like :taco:.");
  });

  test("App Home's Inventory tab, after Skill tree, shows the balance, the starter among your kudos emoji, and nothing for sale", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");

    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Inventory");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | [Inventory] | Settings",
      "header: Inventory",
      "section: 4 🪙",
      "divider",
      "section: *Your kudos emoji*",
      "section: 🦔 Hedgehog",
      "context: Each of your kudos emoji counts as a kudos, like :taco:.",
      "divider",
      "section: *Store*",
      "context: Nothing for sale right now.",
    ]);
  });

  test("an owned emoji is listed after the starter among your kudos emoji", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    const member = await memberOf(t, "U_ALICE");
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-ribbon", source: "tier", arrivedAt: Date.now() }));

    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Inventory");

    expect(publishedHome(slack, "U_ALICE").slice(4, 8)).toEqual(["section: *Your kudos emoji*", "section: 🦔 Hedgehog", "section: 🎀 Ribbon", "context: Each of your kudos emoji counts as a kudos, like :taco:."]);
  });

  test("F25: the store exposure carries true for the previewer and false for a member with Coins shown but not the store", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await coinsOpenedBy(t, "U_ALICE");
    await coinsOpenedBy(t, "U_CAROL");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([[store, true]]);
    expect(await exposuresOf(t, "U_CAROL")).toEqual([[store, false]]);
  });

  test("F25: once the store turns off, the previewer's next message with 🦔 sends the false exposure, without App Home", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...storeOff);
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["hedgehog"]);

    expect(await exposuresOf(t, "U_ALICE")).toEqual([
      [store, true],
      [store, false],
    ]);
  });
});

describe("ST8 ST11: 🦔, the giver's starter, counts as a kudos", { timeout: 30_000 }, () => {
  test("after opening Coins, a message with 🦔 is a kudos for its recipient and costs one, and kudosGiven names the owned emoji", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["hedgehog"]);

    expect(successRepliesTo("U_ALICE").at(-1)?.[0]).toBe("<@U_BOB> got 1 kudos from you. You have 9 kudos left today.");
    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ kudosEmoji: "hedgehog", ownedEmoji: ["hedgehog"], awards: [{ kudos: 1 }] });
  });

  test("the workspace emoji and 🦔 cost one per recipient, and a message with only the workspace emoji names no owned emoji", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);

    await giveKudos(t, "U_ALICE", ["U_BOB", "U_CAROL"], saysWhy, ["taco", "hedgehog"]);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["taco"]);

    expect(successRepliesTo("U_ALICE").slice(-2).map(([reply]) => reply)).toEqual([
      "<@U_BOB> and <@U_CAROL> got 1 kudos from you. You have 8 kudos left today.",
      "<@U_BOB> got 1 kudos from you. You have 7 kudos left today.",
    ]);
    const [both, workspaceOnly] = (await kudosGivenEvents(t)).slice(-2);
    expect(both).toMatchObject({ ownedEmoji: ["hedgehog"], awards: [{ kudos: 1 }, { kudos: 1 }] });
    expect(workspaceOnly!.ownedEmoji ?? []).toEqual([]);
  });
});

describe("ST8 limits: the owned kudos emoji hook reads a fixed handful per message", () => {
  test("a kudos with the workspace emoji and an owned emoji to 700 recipients, from a member owning every store emoji, stays inside the giving mutation's budget", { timeout: 300_000 }, async () => {
    const recipients = Array.from({ length: 700 }, (_, index) => `U_R${String(index).padStart(3, "0")}`);
    const t = await workspaceDeciding(...previewedByAlice, { transactionLimits: true, baseAllowance: 1400 });
    await coinsOpenedBy(t, "U_ALICE");
    await membersExist(t, recipients);
    const member = await memberOf(t, "U_ALICE");
    await t.run(async (ctx) => {
      for (const item of storeEmoji) await grantItem(ctx, { member, item, source: "store", arrivedAt: Date.now() });
    });
    vi.setSystemTime(tuesday + dayMs);
    const before = (await kudosGivenEvents(t)).length;

    await postKudos(t, "U_ALICE", recipients, saysWhy, ["taco", "rocket"]);
    const given = await kudosGivenAfter(t, before);

    expect(given.ownedEmoji).toEqual(["rocket"]);
    expect(given.awards).toHaveLength(700);
    expect(new Set(given.awards.map(({ kudos }) => kudos))).toEqual(new Set([1]));
  });
});

describe("ST8 ST9 ST22 AL34: an owned kudos emoji counts only for its owner, whether the store is shown to them or not", { timeout: 30_000 }, () => {
  test("🦔 in someone else's message counts for nobody", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);
    const kudosBefore = (await kudosGivenEvents(t)).length;

    await giveKudos(t, "U_BOB", ["U_ALICE"], saysWhy, ["hedgehog"]);
    await giveKudos(t, "U_BOB", ["U_ALICE"], saysWhy, ["taco", "hedgehog"]);

    expect(successRepliesTo("U_BOB").at(-1)?.[0]).toBe("<@U_ALICE> got 1 kudos from you. You have 9 kudos left today.");
    const given = (await kudosGivenEvents(t)).slice(kudosBefore);
    expect(given).toHaveLength(1);
    expect(given[0]!.ownedEmoji ?? []).toEqual([]);
  });

  test("the same message from a member who opened Coins but isn't shown the store is a kudos", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_CAROL");
    vi.setSystemTime(tuesday + dayMs);
    const kudosBefore = (await kudosGivenEvents(t)).length;

    await giveKudos(t, "U_CAROL", ["U_BOB"], saysWhy, ["hedgehog"]);

    expect((await kudosGivenEvents(t)).slice(kudosBefore)).toMatchObject([{ ownedEmoji: ["hedgehog"], awards: [{ kudos: 1 }] }]);
  });

  test.each([
    ["store off", storeOff, ["hedgehog"]],
    ["store not created", storeNotCreated, ["hedgehog"]],
    ["coins off", coinsOff, []],
  ])("with %s, the previewer sees nothing of the inventory, and 🦔 is a kudos once she opened Coins", async (_, definitions, claimed) => {
    const t = await workspaceDeciding(...definitions);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await openHome(t, "U_ALICE");
    await coinsOpenedBy(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);
    const kudosBefore = (await kudosGivenEvents(t)).length;

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["hedgehog"]);

    expect(slackCallsAbout("U_ALICE").flatMap(readCall).filter(namesTheInventory)).toEqual([]);
    expect((await kudosGivenEvents(t)).slice(kudosBefore).map(({ ownedEmoji }) => ownedEmoji)).toEqual(claimed.length === 0 ? [] : [claimed]);
  });
});

describe("ST22 ST23: a preview changes nothing for anyone else", { timeout: 30_000 }, () => {
  test("the other members' Slack calls are exactly those with the store off for everyone, while the previewer thanks them with the workspace emoji", async () => {
    const whilePreviewed = await everyoneElseOf(previewedByAlice);
    vi.clearAllTimers();
    const whileOff = await everyoneElseOf(storeOff);

    expect(whilePreviewed).toEqual(whileOff);
  });
});

describe("ST25: Not yours yet lists each tier emoji the member doesn't own, while the Book is open", { timeout: 30_000 }, () => {
  test("with the Book open, the tab ends with each silver emoji not earned yet and its tier, and the earned one is among your kudos emoji", async () => {
    const t = await workspaceDeciding(...previewedByAlice, onForEveryone("achievements"));
    await coinsOpenedBy(t, "U_ALICE");
    await bookOpenFor(t, "U_ALICE");
    const member = await memberOf(t, "U_ALICE");
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-ribbon", source: "tier", arrivedAt: Date.now() }));

    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Inventory");

    const tab = publishedHome(slack, "U_ALICE");
    expect(tab).toContain("section: 🎀 Ribbon");
    expect(tab.slice(tab.indexOf("section: *Not yours yet*") - 1)).toEqual([
      "divider",
      "section: *Not yours yet*",
      "section: 💖 Sparkling Heart · Silver in Recognition",
      "section: 🧩 Jigsaw · Silver in Connections",
      "section: ⚓ Anchor · Silver in Dependability",
      "section: 🎊 Confetti · Silver in Applause",
      "section: 🍁 Maple Leaf · Silver in Seasons",
      "section: 🧸 Teddy Bear · Silver in Old Friends",
    ]);
  });

  test("with the Book not open, the tab has no Not yours yet", async () => {
    const t = await workspaceDeciding(...previewedByAlice, onForEveryone("achievements"));
    await coinsOpenedBy(t, "U_ALICE");

    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Inventory");

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/Not yours yet|Silver in/);
  });
});

async function everyoneElseOf(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await coinsOpenedBy(t, "U_ALICE");
  await coinsOpenedBy(t, "U_CAROL");
  await openHome(t, "U_CAROL");
  vi.setSystemTime(tuesday + dayMs);
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["taco"]);
  await giveKudos(t, "U_CAROL", ["U_BOB"], saysWhy, ["taco", "hedgehog"]);
  await giveKudos(t, "U_BOB", ["U_ALICE"], saysWhy, ["hedgehog"]);
  vi.setSystemTime(tuesday);
  return slack.calls.filter(({ args }) => ![args.channel, args.user, args.user_id].includes("U_ALICE")).map(withoutTimestamps);
}

async function coinsOpenedBy(t: Backend, user: string, words = saysWhy) {
  await giveKudos(t, user, ["U_BOB"], words);
  await xpOf(t, user, xpBelowLevelSix);
  await giveKudos(t, user, ["U_BOB"], words);
  await send(t, blockActions(user, staleButtonOf({ type: "openUnlock", feature: "coins" })));
}

type Limits = { transactionLimits: boolean; baseAllowance: number };

async function workspaceDeciding(...decided: Array<FlagDefinition | Limits>) {
  const definitions = decided.filter((entry): entry is FlagDefinition => "key" in entry);
  const { transactionLimits, baseAllowance } = decided.find((entry): entry is Limits => "transactionLimits" in entry) ?? { transactionLimits: false, baseAllowance: 10 };
  slack = new FakeSlack()
    .withMember("U_ALICE", { profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withMember("U_CAROL", { profile: { email: carolsEmail } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend({ transactionLimits });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function postKudos(t: Backend, giver: string, recipients: string[], words: string, emojiNames: string[]) {
  sentMessages += 1;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), ...emojiNames.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
}

async function kudosGivenAfter(t: Backend, before: number): Promise<KudosGivenEvent> {
  for (let fired = 0; fired < 100; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    const given = (await kudosGivenEvents(t)).slice(before);
    if (given.length > 0) return given[0]!;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("the kudos was never given");
}

async function membersExist(t: Backend, users: string[]) {
  await t.run(async (ctx) => {
    for (const user of users) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", asOf: Date.now() });
  });
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string, emojiNames = ["taco"]) {
  sentMessages += 1;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), ...emojiNames.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  await send(t, blockActions(user, buttonInHome(slack, user, label)));
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
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

async function bookOpenFor(t: Backend, user: string) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member).eq("feature", "book"))
      .unique();
    if (row === null) await ctx.db.insert("unlocks", { member, feature: "book", readyAt: Date.now(), openedAt: Date.now() });
    else await ctx.db.patch(row._id, { openedAt: Date.now() });
  });
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

async function kudosGivenEvents(t: Backend): Promise<KudosGivenEvent[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name.endsWith(":recordKudosGiven")).map(({ args }) => (args[0] as { event: KudosGivenEvent }).event);
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === store);
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

function readDm(dm: PostedDm) {
  return readBlocks(blocksOf(dm));
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

function namesTheInventory(line: string) {
  return /inventory|kudos emoji|🦔|hedgehog/i.test(line);
}
