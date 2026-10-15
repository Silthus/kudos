import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, publishedHomeBlocks, staleButtonOf, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { recordReward } from "../progression/progression";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const alicesEmail = "alice@example.com";
const xpBelowLevelSix = 990;
const rocket = "kudos-emoji-rocket";
const storeLines = [
  "section: 🌻 Sunflower · 100 🪙 [button: Buy]",
  "section: 🚀 Rocket · 100 🪙 [button: Buy]",
  "section: 🌟 Glowing Star · 100 🪙 [button: Buy]",
  "section: 💎 Gem · 100 🪙 [button: Buy]",
  "section: 🌈 Rainbow · 100 🪙 [button: Buy]",
  "section: 🍀 Clover · 100 🪙 [button: Buy]",
  "section: 🍩 Doughnut · 100 🪙 [button: Buy]",
  "section: 🍪 Cookie · 100 🪙 [button: Buy]",
  "section: 👑 Crown · 100 🪙 [button: Buy]",
  "section: 🎈 Balloon · 100 🪙 [button: Buy]",
  "section: 🌵 Cactus · 100 🪙 [button: Buy]",
  "section: 🏆 Trophy · 100 🪙 [button: Buy]",
];

const xpAndUnlocksOn = [onForEveryone("xp-levels"), onForEveryone("unlocks")];
const coinsForAlice = onForEmails("coins", alicesEmail);
const previewedByAlice = [...xpAndUnlocksOn, coinsForAlice, onForEmails("store", alicesEmail)];

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

describe("ST12 ST25: the Inventory tab's Store sells kudos emoji for 100 🪙", { timeout: 30_000 }, () => {
  test("each store emoji is listed with its price and Buy, whether or not the member can afford it", async () => {
    const t = await aliceWithCoins(40);

    await openInventory(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").slice(-14)).toEqual(["divider", "section: *Store*", ...storeLines]);
  });

  test("Buy asks before it runs, and names the emoji for screen readers", async () => {
    const t = await aliceWithCoins(100);

    await openInventory(t, "U_ALICE");

    expect(buyButtonOf("🚀 Rocket")).toMatchObject({
      accessibility_label: "Buy Rocket",
      confirm: {
        title: { type: "plain_text", text: "Buy 🚀 Rocket for 100 🪙?" },
        text: { type: "plain_text", text: "Coins are never refunded." },
        confirm: { type: "plain_text", text: "Buy" },
        deny: { type: "plain_text", text: "Cancel" },
      },
    });
  });

  test("the workspace's own emoji isn't listed", async () => {
    const t = await aliceWithCoins(100, { kudosEmoji: "rocket" });

    await openInventory(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toContain("Rocket");
  });
});

describe("ST13 ST25: buying a kudos emoji in App Home", { timeout: 30_000 }, () => {
  test("Buy with 100 🪙 spends them and lists the emoji in the Collection, out of the Store", async () => {
    const t = await aliceWithCoins(100);
    await openInventory(t, "U_ALICE");

    await buy(t, "U_ALICE", "🚀 Rocket");

    const home = publishedHome(slack, "U_ALICE");
    expect(home).toContain("section: 0 🪙");
    expect(home).toEqual(expect.arrayContaining(["section: *Collection*", "section: 🚀 Rocket"]));
    expect(home.slice(-11)).toEqual(storeLines.filter((line) => !line.includes("Rocket")));
    expect(await coinsOf(t, "U_ALICE")).toBe(0);
  });

  test("Buy with 60 🪙 shows You need 40 more 🪙. under the emoji and changes nothing", async () => {
    const t = await aliceWithCoins(60);
    await openInventory(t, "U_ALICE");
    const before = await storedRowsOf(t);

    await buy(t, "U_ALICE", "🚀 Rocket");

    const home = publishedHome(slack, "U_ALICE");
    expect(home.slice(home.indexOf("section: 🚀 Rocket · 100 🪙 [button: Buy]"), home.indexOf("section: 🌟 Glowing Star · 100 🪙 [button: Buy]"))).toEqual([
      "section: 🚀 Rocket · 100 🪙 [button: Buy]",
      "context: You need 40 more 🪙.",
    ]);
    const { itemPurchases, ...after } = await storedRowsOf(t);
    expect(itemPurchases.map(({ outcome }) => outcome)).toEqual([{ kind: "refused", item: rocket, reason: "no-coins" }]);
    expect(after).toEqual(withoutPurchases(before));
  });

  test("a second Buy of an emoji already bought says You already own it. and spends nothing", async () => {
    const t = await aliceWithCoins(200);
    await openInventory(t, "U_ALICE");
    const staleBuy = buttonInHome(slack, "U_ALICE", "Buy");

    await send(t, blockActions("U_ALICE", staleBuy));
    await send(t, blockActions("U_ALICE", staleBuy));

    const home = publishedHome(slack, "U_ALICE");
    expect(home.slice(home.indexOf("section: *Collection*"))).toEqual(["section: *Collection*", "section: 🌻 Sunflower", "context: You already own it.", "divider", "section: *Store*", ...storeLines.slice(1)]);
    expect(await coinsOf(t, "U_ALICE")).toBe(100);
  });

  test("a stale Buy of the workspace's own emoji says It isn't for sale.", async () => {
    const t = await aliceWithCoins(100, { kudosEmoji: "rocket" });
    await openInventory(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "buyItem", item: rocket })));

    expect(publishedHome(slack, "U_ALICE").slice(-2)).toEqual([storeLines.at(-1), "context: It isn't for sale."]);
    expect(await coinsOf(t, "U_ALICE")).toBe(100);
  });

  test("the same click delivered twice buys once", async () => {
    const t = await aliceWithCoins(200);
    await openInventory(t, "U_ALICE");
    const buyRocket = blockActions("U_ALICE", buyButtonActionOf("🚀 Rocket"));

    await send(t, buyRocket);
    await send(t, buyRocket);

    expect(await coinsOf(t, "U_ALICE")).toBe(100);
  });
});

describe("ST22: a stale Buy where the store is dark", { timeout: 30_000 }, () => {
  test.each([
    ["store off", [...xpAndUnlocksOn, coinsForAlice, offForEveryone("store")]],
    ["store not created", [...xpAndUnlocksOn, coinsForAlice]],
    ["coins off", [...xpAndUnlocksOn, offForEveryone("coins"), onForEveryone("store")]],
  ])("with %s, writes nothing and shows nothing of the store", async (_, definitions) => {
    const t = await aliceWithCoins(100);
    await flagsFromPostHog(t, postHog, ...definitions);
    const before = await storedRowsOf(t);

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "buyItem", item: rocket })));

    expect(await storedRowsOf(t)).toEqual(before);
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/Store|Rocket|Inventory/);
  });

  test("with the store shown and Coins unopened, it is refused coins-not-open and spends nothing", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
    await savings(t, "U_ALICE", 100);

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "buyItem", item: rocket })));

    expect((await storedRowsOf(t)).itemPurchases.map(({ outcome }) => outcome)).toEqual([{ kind: "refused", item: rocket, reason: "coins-not-open" }]);
    expect((await storedRowsOf(t)).collection).toEqual([]);
  });
});

async function aliceWithCoins(coins: number, { kudosEmoji = "taco" } = {}) {
  const t = await workspaceDeciding(...previewedByAlice, { kudosEmoji });
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, [kudosEmoji]);
  await xpOf(t, "U_ALICE", xpBelowLevelSix);
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, [kudosEmoji]);
  await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openUnlock", feature: "coins" })));
  await savings(t, "U_ALICE", coins - (await coinsOf(t, "U_ALICE")));
  return t;
}

type Workspace = { kudosEmoji: string };

async function workspaceDeciding(...decided: Array<FlagDefinition | Workspace>) {
  const definitions = decided.filter((entry): entry is FlagDefinition => "key" in entry);
  const { kudosEmoji } = decided.find((entry): entry is Workspace => "kudosEmoji" in entry) ?? { kudosEmoji: "taco" };
  slack = new FakeSlack().withMember("U_ALICE", { profile: { email: alicesEmail } }).withMember("U_BOB", { profile: { email: "bob@example.com" } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji, baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string, emojiNames = ["taco"]) {
  sentMessages += 1;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), ...emojiNames.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

async function openInventory(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
  await send(t, blockActions(user, buttonInHome(slack, user, "Inventory")));
}

async function buy(t: Backend, user: string, item: string) {
  await send(t, blockActions(user, buyButtonActionOf(item)));
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

function buyButtonOf(item: string) {
  const block = publishedHomeBlocks(slack, "U_ALICE").find((each: Block) => each.text?.text === `${item} · 100 🪙`);
  expect(block?.accessory, `a Buy button beside ${item}`).toBeDefined();
  return block!.accessory as Record<string, unknown>;
}

function buyButtonActionOf(item: string) {
  const button = buyButtonOf(item);
  return { type: "button" as const, action_id: String(button.action_id), value: String(button.value) };
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

async function coinsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}

function withoutPurchases({ itemPurchases: _, ...rows }: Awaited<ReturnType<typeof storedRowsOf>>) {
  return rows;
}

async function storedRowsOf(t: Backend) {
  return t.run(async (ctx) => ({
    collection: await ctx.db.query("collection").collect(),
    itemPurchases: await ctx.db.query("itemPurchases").collect(),
    coinSpends: await ctx.db.query("coinSpends").collect(),
    wallets: await ctx.db.query("wallets").collect(),
  }));
}
