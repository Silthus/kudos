import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, menuOptionInHome, menuOptionsInHome, publishedHome, publishedHomeBlocks, staleButtonOf, staleMenuOptionOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageChangedEvent, messageEvent, section, text } from "../../testing/slackMessages";
import type { KudosGivenEvent } from "../bus/events";
import { grantItem } from "../store/inventory";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const alicesEmail = "alice@example.com";
const xpBelowLevelSix = 990;
const hedgehog = "kudos-emoji-hedgehog";
const rocket = "kudos-emoji-rocket";

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

describe("ST25: the Inventory tab's slots and Collection", { timeout: 30_000 }, () => {
  test("a filled slot has Take off, and each emoji in the Collection has a Put in slot menu of the three slots", async () => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });

    await openInventory(t, "U_ALICE");

    const home = publishedHome(slack, "U_ALICE");
    expect(home.slice(home.indexOf("section: *Your kudos emoji*"), home.indexOf("section: *Store*"))).toEqual([
      "section: *Your kudos emoji*",
      "section: Slot 1 · 🦔 Hedgehog [button: Take off]",
      "section: Slot 2 · empty",
      "section: Slot 3 · empty",
      "context: Each emoji in a slot counts as a kudos, like :taco:.",
      "divider",
      "section: *Collection*",
      "section: 🚀 Rocket [static_select: Put in slot]",
      "divider",
    ]);
    expect(menuOptionsInHome(slack, "U_ALICE", "🚀 Rocket")).toEqual(["Slot 1", "Slot 2", "Slot 3"]);
    expect(takeOffButtonBeside("Slot 1 · 🦔 Hedgehog")).toMatchObject({ accessibility_label: "Take Hedgehog out of slot 1" });
  });
});

describe("ST7 ST8: Take off and Put in slot change which emoji count", { timeout: 30_000 }, () => {
  test("taking 🦔 out of slot 1 makes :hedgehog: an ordinary emoji in the next message, and putting it back makes it count again", async () => {
    const t = await aliceWhoOpenedCoins();
    await openInventory(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Take off")));
    expect(publishedHome(slack, "U_ALICE")).toEqual(expect.arrayContaining(["section: Slot 1 · empty", "section: *Collection*", "section: 🦔 Hedgehog [static_select: Put in slot]"]));
    const before = (await kudosGivenEvents(t)).length;
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["hedgehog"]);
    expect(await kudosGivenEvents(t)).toHaveLength(before);

    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", "🦔 Hedgehog", "Slot 1")));
    expect(publishedHome(slack, "U_ALICE")).toContain("section: Slot 1 · 🦔 Hedgehog [button: Take off]");
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["hedgehog"]);
    expect((await kudosGivenEvents(t)).slice(before)).toMatchObject([{ kudosEmoji: "hedgehog", loadoutEmoji: ["hedgehog"], awards: [{ kudos: 1 }] }]);
  });

  test("a bought emoji put in slot 2 counts as a kudos beside 🦔", async () => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });
    await openInventory(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", "🚀 Rocket", "Slot 2")));
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["rocket"]);

    expect(publishedHome(slack, "U_ALICE")).toEqual(expect.arrayContaining(["section: Slot 1 · 🦔 Hedgehog [button: Take off]", "section: Slot 2 · 🚀 Rocket [button: Take off]"]));
    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ kudosEmoji: "rocket", loadoutEmoji: ["rocket"], awards: [{ kudos: 1 }] });
  });

  test("putting the emoji in slot 1 into slot 3 moves it, and slot 1 is empty", async () => {
    const t = await aliceWhoOpenedCoins();
    await openInventory(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: hedgehog, slot: "emoji-3" })));

    expect(slotLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(["section: Slot 1 · empty", "section: Slot 2 · empty", "section: Slot 3 · 🦔 Hedgehog [button: Take off]"]);
  });

  test("the same Put in slot twice leaves the same loadout", async () => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });
    await openInventory(t, "U_ALICE");
    const putRocketInSlot3 = menuOptionInHome(slack, "U_ALICE", "🚀 Rocket", "Slot 3");

    await send(t, blockActions("U_ALICE", putRocketInSlot3));
    const once = await loadoutRowsOf(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", putRocketInSlot3));

    expect(await loadoutRowsOf(t, "U_ALICE")).toEqual(once);
    expect(once).toEqual([
      { slot: "emoji-1", item: hedgehog },
      { slot: "emoji-2", item: null },
      { slot: "emoji-3", item: rocket },
    ]);
  });

  test("a stale Put in slot of an emoji Alice doesn't own changes nothing", async () => {
    const t = await aliceWhoOpenedCoins();
    await openInventory(t, "U_ALICE");
    const slotsBefore = slotLinesOf(publishedHome(slack, "U_ALICE"));

    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: rocket, slot: "emoji-2" })));

    expect(await loadoutRowsOf(t, "U_ALICE")).toEqual([]);
    expect(slotLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(slotsBefore);
  });
});

describe("ST10: edits and rechecks parse with the loadout at the time", { timeout: 30_000 }, () => {
  test("a message the engine stored doesn't become a kudos when it is edited in prose only after its emoji went into a slot", async () => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });
    await openInventory(t, "U_ALICE");
    const message = await postMessage(t, saysWhy, ["rocket"]);
    await editMessage(t, message, 1, `${saysWhy}, really`, ["rocket"]);
    const before = (await kudosGivenEvents(t)).length;

    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", "🚀 Rocket", "Slot 2")));
    await editMessage(t, message, 2, `${saysWhy}, really and truly`, ["rocket"]);

    expect(await kudosGivenEvents(t)).toHaveLength(before);
  });

  test("an edit that adds a slotted emoji to a message the engine stored gives with the loadout at the edit", async () => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });
    await openInventory(t, "U_ALICE");
    const message = await postMessage(t, saysWhy, []);
    await editMessage(t, message, 1, `${saysWhy}, really`, []);
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", "🚀 Rocket", "Slot 2")));

    await editMessage(t, message, 2, `${saysWhy}, really`, ["rocket"]);

    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ kudosEmoji: "rocket", loadoutEmoji: ["rocket"], awards: [{ kudos: 1 }] });
  });

  test("an edit of a message the engine never stored is its first revision, so after Put in slot a prose-only edit gives (accepted)", async () => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });
    await openInventory(t, "U_ALICE");
    const message = await postMessage(t, saysWhy, ["rocket"]);
    const before = (await kudosGivenEvents(t)).length;
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", "🚀 Rocket", "Slot 2")));

    await editMessage(t, message, 1, `${saysWhy}, really`, ["rocket"]);

    expect((await kudosGivenEvents(t)).slice(before)).toMatchObject([{ kudosEmoji: "rocket", loadoutEmoji: ["rocket"], awards: [{ kudos: 1 }] }]);
  });

  test("an attempt waiting for a directory recheck costs what the loadout claims when it is evaluated", async () => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });
    await openInventory(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", "🚀 Rocket", "Slot 2")));
    slack.joiningAt("U_DAVE", new Date(Date.now() + 5 * 60_000));
    const before = (await kudosGivenEvents(t)).length;

    await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention("U_DAVE"), text(` ${saysWhy} `), emoji("taco"), emoji("rocket"))], { user: "U_ALICE", ts: nextTs() })));
    await t.finishInProgressScheduledFunctions();
    await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ALICE", buttonBeside("Slot 2 · 🚀 Rocket")), form));
    await t.finishInProgressScheduledFunctions();
    await settleInTimeOrder(t);

    expect((await kudosGivenEvents(t)).slice(before)).toMatchObject([{ kudosEmoji: "taco", awards: [{ kudos: 1 }] }]);
    expect((await kudosGivenEvents(t)).at(-1)).not.toHaveProperty("loadoutEmoji");
  });
});

describe("ST22: a stale Put in slot or Take off where the store is dark", { timeout: 30_000 }, () => {
  test.each([
    ["store off", [...xpAndUnlocksOn, coinsForAlice, offForEveryone("store")]],
    ["store not created", [...xpAndUnlocksOn, coinsForAlice]],
    ["coins off", [...xpAndUnlocksOn, offForEveryone("coins"), onForEveryone("store")]],
  ])("with %s, writes nothing and shows nothing of the slots", async (_, definitions) => {
    const t = await aliceWhoOpenedCoins({ owning: [rocket] });
    await flagsFromPostHog(t, postHog, ...definitions);

    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: rocket, slot: "emoji-2" })));
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "takeOff", slot: "emoji-1" })));

    expect(await loadoutRowsOf(t, "U_ALICE")).toEqual([]);
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/Slot|Rocket|Hedgehog|Inventory/);
  });

  test("with the store shown and Coins unopened, they are refused and write nothing", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);

    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: hedgehog, slot: "emoji-2" })));
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "takeOff", slot: "emoji-1" })));

    expect(await loadoutRowsOf(t, "U_ALICE")).toEqual([]);
  });
});

async function aliceWhoOpenedCoins({ owning = [] as string[] } = {}) {
  const t = await workspaceDeciding(...previewedByAlice);
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
  await xpOf(t, "U_ALICE", xpBelowLevelSix);
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
  await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openUnlock", feature: "coins" })));
  const member = await memberOf(t, "U_ALICE");
  for (const item of owning) await t.run((ctx) => grantItem(ctx, { member, item, source: "store", arrivedAt: Date.now() }));
  return t;
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack().withMember("U_ALICE", { profile: { email: alicesEmail } }).withMember("U_BOB", { profile: { email: "bob@example.com" } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string, emojiNames = ["taco"]) {
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocksOf(recipients, words, emojiNames), { user: giver, ts: nextTs() })));
  await settleInTimeOrder(t);
}

async function postMessage(t: Backend, words: string, emojiNames: string[]) {
  const ts = nextTs();
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocksOf(["U_BOB"], words, emojiNames), { user: "U_ALICE", ts })));
  await settleInTimeOrder(t);
  return ts;
}

async function editMessage(t: Backend, ts: string, edit: number, words: string, emojiNames: string[]) {
  const editedTs = `${Math.floor(Date.now() / 1000) + 60 * edit}.000200`;
  await t.fetch("/slack/events", await signedRequest(messageChangedEvent(blocksOf(["U_BOB"], words, emojiNames), { user: "U_ALICE", ts, editedTs })));
  await settleInTimeOrder(t);
}

function blocksOf(recipients: string[], words: string, emojiNames: string[]) {
  return [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), ...emojiNames.map((name) => emoji(name)))];
}

function nextTs() {
  sentMessages += 1;
  return `${Math.floor(Date.now() / 1000) + sentMessages}.000100`;
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

function slotLinesOf(home: string[]) {
  return home.filter((line) => line.startsWith("section: Slot "));
}

function buttonBeside(line: string) {
  const block = publishedHomeBlocks(slack, "U_ALICE").find((each) => each.text?.text === line);
  const button = block?.accessory;
  expect(button, `a button beside ${line}`).toBeDefined();
  return { type: "button", action_id: button!.action_id!, value: button!.value, block_id: block!.block_id } as Parameters<typeof blockActions>[1];
}

function takeOffButtonBeside(line: string) {
  const block = publishedHomeBlocks(slack, "U_ALICE").find((each) => each.text?.text === line);
  expect(block?.accessory, `a Take off button beside ${line}`).toBeDefined();
  return block!.accessory as Record<string, unknown>;
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

async function loadoutRowsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const rows = await t.run((ctx) =>
    ctx.db
      .query("loadouts")
      .withIndex("by_member_slot", (q) => q.eq("member", member))
      .collect(),
  );
  return rows.map(({ slot, item }) => ({ slot, item }));
}

async function kudosGivenEvents(t: Backend): Promise<KudosGivenEvent[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name.endsWith(":recordKudosGiven")).map(({ args }) => (args[0] as { event: KudosGivenEvent }).event);
}
