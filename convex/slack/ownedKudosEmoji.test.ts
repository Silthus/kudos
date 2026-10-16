import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, publishedHomeBlocks, staleButtonOf, staleMenuOptionOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import type { KudosGivenEvent } from "../bus/events";
import { recordReward } from "../progression/progression";
import { grantItem } from "../store/inventory";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const alicesEmail = "alice@example.com";
const carolsEmail = "carol@example.com";
const xpBelowLevelSix = 990;
const rocket = "kudos-emoji-rocket";
const ribbon = "kudos-emoji-ribbon";
const shipit = "custom:shipit";
const shipitArt = "https://emoji.slack-edge.com/T1/shipit/0a1b2c.png";
const partyArt = "https://emoji.slack-edge.com/T1/partyparrot/3c4d5e.gif";

const storeShown = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEmails("coins", alicesEmail, carolsEmail), onForEmails("store", alicesEmail, carolsEmail)];

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

describe("ST8: every kudos emoji the giver owns counts while the store is visible to them", { timeout: 60_000 }, () => {
  test("Alice owns 🚀, and a message with a mention and 🚀 gives kudos that names it as one she owns", async () => {
    const t = await aliceAndCarolWhoOpenedCoins(storeShown, { owning: [rocket] });

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["rocket"]);

    expect(successRepliesTo("U_ALICE").at(-1)?.[0]).toBe("<@U_BOB> got 1 kudos from you. You have 9 kudos left today.");
    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ kudosEmoji: "rocket", ownedEmoji: ["rocket"], awards: [{ kudos: 1 }] });
  });

  test("the starter 🦔 and a tier's 🎀 count side by side", async () => {
    const t = await aliceAndCarolWhoOpenedCoins(storeShown, { owning: [ribbon] });

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["hedgehog", "ribbon"]);

    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ ownedEmoji: ["hedgehog", "ribbon"], awards: [{ kudos: 2 }] });
  });

  test("a custom kudos emoji Alice owns counts while custom-kudos-emoji is on for her, after it left the store, and not while it is off", async () => {
    const t = await aliceAndCarolWhoOpenedCoins([...storeShown, onForEmails("custom-kudos-emoji", alicesEmail)], { owning: [shipit] });
    await t.run((ctx) => ctx.db.insert("customKudosEmoji", { workspace: "T1", name: "shipit", url: shipitArt, pickedAt: tuesday, unpickedAt: tuesday }));

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["shipit"]);
    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ kudosEmoji: "shipit", ownedEmoji: ["shipit"] });

    await flagsFromPostHog(t, postHog, ...storeShown, offForEveryone("custom-kudos-emoji"));
    const before = (await kudosGivenEvents(t)).length;
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["shipit"]);
    expect(await kudosGivenEvents(t)).toHaveLength(before);
  });

  test("an emoji counts for nobody who doesn't own it", async () => {
    const t = await aliceAndCarolWhoOpenedCoins(storeShown, { owning: [rocket] });
    const before = (await kudosGivenEvents(t)).length;

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["sunflower", "ribbon"]);
    await giveKudos(t, "U_BOB", ["U_ALICE"], saysWhy, ["rocket"]);
    await giveKudos(t, "U_CAROL", ["U_ALICE"], saysWhy, ["rocket"]);

    expect(await kudosGivenEvents(t), "a kudos from an emoji its giver doesn't own").toHaveLength(before);
  });

  test.each([
    ["the store off", [...storeShown.slice(0, 3), offForEveryone("store")]],
    ["coins off", [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("coins"), onForEveryone("store")]],
  ])("with %s, an owned emoji claims nothing", async (_, definitions) => {
    const t = await aliceAndCarolWhoOpenedCoins(storeShown, { owning: [rocket] });
    await flagsFromPostHog(t, postHog, ...definitions);
    const before = (await kudosGivenEvents(t)).length;

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["hedgehog", "rocket"]);

    expect(await kudosGivenEvents(t)).toHaveLength(before);
  });
});

describe("ST32 ST36: the store sells only the picked custom emoji, and owners keep theirs", { timeout: 60_000 }, () => {
  test("the Inventory tab lists every owned emoji, and its Store only the picked custom emoji", async () => {
    const t = await aliceAndCarolWhoOpenedCoins([...storeShown, onForEmails("custom-kudos-emoji", alicesEmail)], { owning: [rocket, ribbon] });
    await t.run((ctx) => ctx.db.insert("customKudosEmoji", { workspace: "T1", name: "shipit", url: shipitArt, pickedAt: tuesday }));

    await openInventory(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | [Inventory] | Settings",
      "header: Inventory",
      "section: 4 🪙",
      "divider",
      "section: *Your kudos emoji*",
      "section: 🦔 Hedgehog",
      "section: 🚀 Rocket",
      "section: 🎀 Ribbon",
      "context: Each of your kudos emoji counts as a kudos, like :taco:.",
      "divider",
      "section: *Store*",
      "section: :shipit: · 100 🪙 [button: Buy]",
    ]);
  });

  test("a stale Buy of a standard emoji is refused as not for sale and spends nothing, and a picked custom emoji is still sold", async () => {
    const t = await aliceAndCarolWhoOpenedCoins([...storeShown, onForEmails("custom-kudos-emoji", alicesEmail)]);
    await t.run((ctx) => ctx.db.insert("customKudosEmoji", { workspace: "T1", name: "shipit", url: shipitArt, pickedAt: tuesday }));
    await earns(t, "U_ALICE", 200);
    await openInventory(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "buyItem", item: "kudos-emoji-sunflower" })));
    expect(await coinsOf(t, "U_ALICE")).toBe(204);
    expect(publishedHome(slack, "U_ALICE").slice(-3)).toEqual(["section: *Store*", "section: :shipit: · 100 🪙 [button: Buy]", "context: 🌻 Sunflower isn't for sale."]);

    await send(t, blockActions("U_ALICE", buyButtonBeside(":shipit: · 100 🪙")));
    expect(await coinsOf(t, "U_ALICE")).toBe(104);
    expect(await collectionOf(t, "U_ALICE")).toEqual([shipit]);
  });

  test("a stale Buy of a custom emoji that left the store names it, not the one still for sale", async () => {
    const t = await aliceAndCarolWhoOpenedCoins([...storeShown, onForEmails("custom-kudos-emoji", alicesEmail)]);
    await t.run(async (ctx) => {
      await ctx.db.insert("customKudosEmoji", { workspace: "T1", name: "shipit", url: shipitArt, pickedAt: tuesday, unpickedAt: tuesday });
      await ctx.db.insert("customKudosEmoji", { workspace: "T1", name: "partyparrot", url: partyArt, pickedAt: tuesday });
    });
    await earns(t, "U_ALICE", 200);
    await openInventory(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "buyItem", item: shipit })));

    expect(publishedHome(slack, "U_ALICE").slice(-3)).toEqual(["section: *Store*", "section: :partyparrot: · 100 🪙 [button: Buy]", "context: :shipit: isn't for sale."]);
  });

  test("with nothing picked for the store, the Store says there is nothing for sale", async () => {
    const t = await aliceAndCarolWhoOpenedCoins(storeShown, { owning: [rocket] });

    await openInventory(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").slice(-3)).toEqual(["divider", "section: *Store*", "context: Nothing for sale right now."]);
  });
});

describe("a click on a Put in slot or Take off that an old App Home still shows is ignored", { timeout: 30_000 }, () => {
  test("it answers Slack, writes nothing and calls Slack for nothing", async () => {
    const t = await aliceAndCarolWhoOpenedCoins(storeShown, { owning: [rocket] });
    await openInventory(t, "U_ALICE");
    const calls = slack.calls.length;
    const receipts = await receiptsIn(t);

    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: rocket, slot: "emoji-2" })));
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "takeOff", slot: "emoji-1" })));

    expect(slack.calls.slice(calls)).toEqual([]);
    expect(await receiptsIn(t)).toBe(receipts);
  });
});

type Owning = { owning?: string[] };

async function aliceAndCarolWhoOpenedCoins(definitions: FlagDefinition[], { owning = [] }: Owning = {}) {
  const t = await workspaceDeciding(...definitions);
  await coinsOpenedBy(t, "U_ALICE");
  await coinsOpenedBy(t, "U_CAROL");
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, "U_ALICE");
    for (const [index, item] of owning.entries()) await grantItem(ctx, { member, item, source: item === ribbon ? "tier" : "store", arrivedAt: Date.now() + index });
  });
  vi.setSystemTime(tuesday + dayMs);
  return t;
}

async function coinsOpenedBy(t: Backend, user: string) {
  await giveKudos(t, user, ["U_BOB"], saysWhy);
  await xpOf(t, user, xpBelowLevelSix);
  await giveKudos(t, user, ["U_BOB"], saysWhy);
  await send(t, blockActions(user, staleButtonOf({ type: "openUnlock", feature: "coins" })));
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_ALICE", { profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withMember("U_CAROL", { profile: { email: carolsEmail } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
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

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

function buyButtonBeside(line: string, user = "U_ALICE") {
  const block = publishedHomeBlocks(slack, user).find((each) => each.text?.text === line);
  const button = block?.accessory;
  expect(button, `a Buy button beside ${line}`).toBeDefined();
  return { type: "button", action_id: button!.action_id!, value: button!.value, block_id: block!.block_id } as Parameters<typeof blockActions>[1];
}

async function memberIn(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], user: string): Promise<MemberId> {
  const row = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return row!._id;
}

function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run((ctx) => memberIn(ctx, user));
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

async function earns(t: Backend, user: string, coins: number) {
  const member = await memberOf(t, user);
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins, item: null, catalogueVersion: "2", at: 0 }));
}

async function coinsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}


async function collectionOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const rows = await t.run((ctx) =>
    ctx.db
      .query("collection")
      .withIndex("by_member_item", (q) => q.eq("member", member))
      .collect(),
  );
  return rows.map(({ item }) => item);
}

async function kudosGivenEvents(t: Backend): Promise<KudosGivenEvent[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name.endsWith(":recordKudosGiven")).map(({ args }) => (args[0] as { event: KudosGivenEvent }).event);
}


function receiptsIn(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("slackReceipts").collect()).length);
}

function successRepliesTo(user: string) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n"));
}
