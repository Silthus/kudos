import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, slackError } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import {
  blockActions,
  blockSuggestion,
  buttonInHome,
  externalPickerInHome,
  externalPicksInHome,
  menuOptionInHome,
  publishedHome,
  publishedHomeBlocks,
  stalePicksOf,
  staleButtonOf,
  staleMenuOptionOf,
} from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { recordReward } from "../progression/progression";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const shipitArt = "https://emoji.slack-edge.com/T1/shipit/0a1b2c.png";
const remadeShipitArt = "https://emoji.slack-edge.com/T1/shipit/9f8e7d.png";
const partyArt = "https://emoji.slack-edge.com/T1/partyparrot/3c4d5e.gif";
const shipit = "custom:shipit";
const picker = "setCustomKudosEmoji";
const reinstall = "Reinstall the app to pick custom emoji.";
const xpBelowLevelSix = 990;

const storeOn = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("coins"), onForEveryone("store")];
const everyoneDeciding = [...storeOn, onForEveryone("custom-kudos-emoji")];

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

describe("ST31 ST32: an admin picks custom kudos emoji that join the store", { timeout: 60_000 }, () => {
  test("an admin picks :shipit:, and a member sees it in the store at 100 🪙, buys it, puts it in a slot and thanks Bob with it", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await aliceOpensCoinsWith(t, 100);

    await openAdmin(t, "U_DANA");
    expect(adminSection(publishedHome(slack, "U_DANA"))).toEqual(["section: *Custom kudos emoji*", "section: Pick custom emoji members can buy as kudos emoji for 100 🪙. [multi_external_select: none]"]);
    expect(await suggested(t, "U_DANA", "ship")).toEqual([":shipit:"]);
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "shipit")));
    expect(adminSection(publishedHome(slack, "U_DANA"))).toContain("section: Pick custom emoji members can buy as kudos emoji for 100 🪙. [multi_external_select: :shipit:]");

    await openInventory(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE").at(-1)).toBe("section: :shipit: · 100 🪙 [button: Buy]");
    await send(t, blockActions("U_ALICE", buyButtonBeside(":shipit: · 100 🪙")));
    expect(await coinsOf(t, "U_ALICE")).toBe(0);
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", ":shipit:", "Slot 2")));
    expect(publishedHome(slack, "U_ALICE")).toContain("section: Slot 2 · :shipit: [button: Take off]");

    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["shipit"]);

    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ kudosEmoji: "shipit", loadoutEmoji: ["shipit"], awards: [{ kudos: 1 }] });
    expect((await kudosGivenEvents(t)).at(-1)?.awards.map(({ recipient }) => recipient)).toEqual([await memberOf(t, "U_BOB")]);
  });

  test("an alias resolves to the emoji it aliases, in the picker's options and in what is picked", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await openAdmin(t, "U_DANA");

    expect(await suggested(t, "U_DANA", "s")).toEqual([":shipit:"]);
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "ship", "shipit")));

    expect((await pickedRowsOf(t)).map(({ name, url }) => ({ name, url }))).toEqual([{ name: "shipit", url: shipitArt }]);
  });

  test("the same picks twice leave the same picked emoji", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await openAdmin(t, "U_DANA");
    const picks = externalPicksInHome(slack, "U_DANA", "shipit", "partyparrot");

    await send(t, blockActions("U_DANA", picks));
    const once = await pickedRowsOf(t);
    vi.advanceTimersByTime(60_000);
    await send(t, blockActions("U_DANA", picks));

    expect(await pickedRowsOf(t)).toEqual(once);
    expect(once.map(({ name }) => name)).toEqual(["partyparrot", "shipit"]);
  });

  test("an admin picks at most 20, which the picker says and a longer stale pick keeps to its first 20", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    const names = Array.from({ length: 21 }, (_, index) => `team${String(index).padStart(2, "0")}`);
    for (const name of names) slack.withCustomEmoji(name, `https://emoji.slack-edge.com/T1/${name}/1.png`);
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await openAdmin(t, "U_DANA");

    await send(t, blockActions("U_DANA", stalePicksOf(picker, ...names)));

    expect(externalPickerInHome(slack, "U_DANA")).toMatchObject({ max_selected_items: 20 });
    expect((await pickedRowsOf(t)).map(({ name }) => name)).toEqual(names.slice(0, 20));
  });

  test("a custom emoji with an 80-character name keeps every Slack label within Slack's limits", async () => {
    const long = `ship_${"a".repeat(75)}`;
    const t = await workspaceDeciding(...everyoneDeciding);
    slack.withCustomEmoji(long, shipitArt);
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await aliceOpensCoinsWith(t, 100);
    await openAdmin(t, "U_DANA");

    const [option] = await suggestedOptions(t, "U_DANA", "ship_");
    await send(t, blockActions("U_DANA", stalePicksOf(picker, long)));
    await openInventory(t, "U_ALICE");
    const buy = accessoryBeside("U_ALICE", `:${long}: · 100 🪙`);
    await send(t, blockActions("U_ALICE", { type: "button", action_id: String(buy.action_id), value: String(buy.value) }));
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", `:${long}:`, "Slot 2")));
    const takeOff = accessoryBeside("U_ALICE", `Slot 2 · :${long}:`);

    expect(option).toEqual({ text: { type: "plain_text", text: `:${long.slice(0, 73)}…` }, value: long });
    expect(String(buy.accessibility_label).length).toBeLessThanOrEqual(75);
    expect((buy.confirm as { title: { text: string } }).title.text.length).toBeLessThanOrEqual(100);
    expect(String(takeOff.accessibility_label).length).toBeLessThanOrEqual(75);
    expect(await coinsOf(t, "U_ALICE")).toBe(0);
  });

  test("a name that isn't one of the workspace's custom emoji is not picked", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await openAdmin(t, "U_DANA");

    await send(t, blockActions("U_DANA", stalePicksOf(picker, "rocket", "nothere", "shipit")));

    expect((await pickedRowsOf(t)).map(({ name }) => name)).toEqual(["shipit"]);
  });
});

describe("ST31: only an admin who sees the picker picks custom kudos emoji", { timeout: 60_000 }, () => {
  test("a non-admin's setCustomKudosEmoji changes nothing, and their picker search finds nothing", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await aliceOpensCoinsWith(t, 100);

    await send(t, blockActions("U_ALICE", stalePicksOf(picker, "shipit")));

    expect(await customRowsOf(t)).toEqual([]);
    expect(await suggested(t, "U_ALICE", "ship")).toEqual([]);
    await openInventory(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toContain("shipit");
  });

  test.each([
    ["custom-kudos-emoji off for the admin", [...storeOn, offForEveryone("custom-kudos-emoji")]],
    ["custom-kudos-emoji not created", storeOn],
    ["the store off for the admin", [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("coins"), offForEveryone("store"), onForEveryone("custom-kudos-emoji")]],
  ])("with %s, the Admin tab has no picker, a stale pick changes nothing and the search finds nothing", async (_, definitions) => {
    const t = await workspaceDeciding(...definitions);

    await openAdmin(t, "U_DANA");
    await send(t, blockActions("U_DANA", stalePicksOf(picker, "shipit")));

    expect(publishedHome(slack, "U_DANA").join("\n")).not.toContain("Custom kudos emoji");
    expect(await customRowsOf(t)).toEqual([]);
    expect(await suggested(t, "U_DANA", "ship")).toEqual([]);
  });
});

describe("ST33: unpicking takes a custom emoji off sale and nothing from its owners", { timeout: 60_000 }, () => {
  test("after unpicking :shipit:, it leaves the store, and Alice keeps it in her slot, where it still counts", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await aliceOpensCoinsWith(t, 100);
    await openAdmin(t, "U_DANA");
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "shipit", "partyparrot")));
    await openInventory(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buyButtonBeside(":shipit: · 100 🪙")));
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", ":shipit:", "Slot 2")));

    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "partyparrot")));
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Inventory")));
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["shipit"]);

    const home = publishedHome(slack, "U_ALICE");
    expect(home).toContain("section: Slot 2 · :shipit: [button: Take off]");
    expect(home.at(-1)).toBe("section: :partyparrot: · 100 🪙 [button: Buy]");
    expect(home.filter((line) => line.includes("· 100 🪙")).join("\n")).not.toContain(":shipit:");
    expect((await kudosGivenEvents(t)).at(-1)).toMatchObject({ kudosEmoji: "shipit", loadoutEmoji: ["shipit"], awards: [{ kudos: 1 }] });
  });

  test("a stale Buy of an unpicked emoji says It isn't for sale. and spends nothing", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await aliceOpensCoinsWith(t, 100);
    await openAdmin(t, "U_DANA");
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "shipit")));
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA")));
    await openInventory(t, "U_ALICE");

    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "buyItem", item: shipit })));

    expect(publishedHome(slack, "U_ALICE").at(-1)).toBe("context: It isn't for sale.");
    expect(await coinsOf(t, "U_ALICE")).toBe(100);
  });
});

describe("ST32: a custom item's art follows Slack's list", { timeout: 60_000 }, () => {
  test("inventoryOf lists a picked emoji with its custom art, refreshed when an admin opens the Admin tab after the emoji was remade", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await aliceOpensCoinsWith(t, 100);
    await openAdmin(t, "U_DANA");
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "shipit")));
    const alice = await memberOf(t, "U_ALICE");
    expect((await t.query(internal.store.inventory.inventoryOf, { member: alice }))?.catalogue.at(-1)).toEqual({
      item: shipit,
      kind: "kudosEmoji",
      name: ":shipit:",
      emoji: "shipit",
      art: { kind: "custom", url: shipitArt },
      source: { kind: "store", price: 100 },
      onSale: true,
    });

    slack.withCustomEmoji("shipit", remadeShipitArt);
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await openAdmin(t, "U_DANA");

    expect((await t.query(internal.store.inventory.inventoryOf, { member: alice }))?.catalogue.at(-1)?.art).toEqual({ kind: "custom", url: remadeShipitArt });
  });
});

describe("ST34: without emoji:read the picker asks for a reinstall", { timeout: 60_000 }, () => {
  test("the Admin tab says ST34's line instead of the picker, and nothing else in it changes", async () => {
    const t = await workspaceDeciding(...everyoneDeciding);
    await openAdmin(t, "U_DANA");
    const withScope = publishedHome(slack, "U_DANA");

    slack.answering("emoji.list", slackError("missing_scope"));
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await send(t, blockActions("U_DANA", buttonInHome(slack, "U_DANA", "Admin")));

    const withoutScope = publishedHome(slack, "U_DANA");
    expect(adminSection(withoutScope)).toEqual(["section: *Custom kudos emoji*", `section: ${reinstall}`]);
    expect(withoutScope.filter((line) => !adminSection(withoutScope).includes(line))).toEqual(withScope.filter((line) => !adminSection(withScope).includes(line)));
  });
});

describe("ST35: custom-kudos-emoji is the member's own decision", { timeout: 60_000 }, () => {
  test("where it is off for Alice, her :shipit: is hidden and claims nothing, its slot reads empty, and it comes back when it is on again", async () => {
    const t = await workspaceDeciding(...storeOn, onForEmails("custom-kudos-emoji", "dana@example.com", "alice@example.com"));
    await aliceOpensCoinsWith(t, 100);
    await openAdmin(t, "U_DANA");
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "shipit")));
    await openInventory(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buyButtonBeside(":shipit: · 100 🪙")));
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", ":shipit:", "Slot 2")));

    await flagsFromPostHog(t, postHog, ...storeOn, onForEmails("custom-kudos-emoji", "dana@example.com"));
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Inventory")));
    const before = (await kudosGivenEvents(t)).length;
    await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy, ["shipit"]);

    expect(publishedHome(slack, "U_ALICE")).toContain("section: Slot 2 · empty");
    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toContain("shipit");
    expect(await kudosGivenEvents(t)).toHaveLength(before);
    expect((await t.query(internal.store.inventory.inventoryOf, { member: await memberOf(t, "U_ALICE") }))?.catalogue.map(({ item }) => item)).not.toContain(shipit);

    await flagsFromPostHog(t, postHog, ...storeOn, onForEmails("custom-kudos-emoji", "dana@example.com", "alice@example.com"));
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Inventory")));
    expect(publishedHome(slack, "U_ALICE")).toContain("section: Slot 2 · :shipit: [button: Take off]");
  });

  test("where it is off for Alice, equipping into the slot holding her hidden :shipit: replaces it, the other slots keep theirs, and a stale Put in slot of :shipit: is refused", async () => {
    const t = await workspaceDeciding(...storeOn, onForEmails("custom-kudos-emoji", "dana@example.com", "alice@example.com"));
    await aliceOpensCoinsWith(t, 100);
    await openAdmin(t, "U_DANA");
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "shipit")));
    await openInventory(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buyButtonBeside(":shipit: · 100 🪙")));
    await send(t, blockActions("U_ALICE", menuOptionInHome(slack, "U_ALICE", ":shipit:", "Slot 2")));
    await flagsFromPostHog(t, postHog, ...storeOn, onForEmails("custom-kudos-emoji", "dana@example.com"));

    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: "kudos-emoji-hedgehog", slot: "emoji-3" })));
    expect(await loadoutRowsOf(t, "U_ALICE")).toEqual([
      { slot: "emoji-1", item: null },
      { slot: "emoji-2", item: shipit },
      { slot: "emoji-3", item: "kudos-emoji-hedgehog" },
    ]);
    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: shipit, slot: "emoji-1" })));
    expect((await loadoutRowsOf(t, "U_ALICE"))[0]).toEqual({ slot: "emoji-1", item: null });
    await send(t, blockActions("U_ALICE", staleMenuOptionOf({ type: "equip", item: "kudos-emoji-hedgehog", slot: "emoji-2" })));

    expect(await loadoutRowsOf(t, "U_ALICE")).toEqual([
      { slot: "emoji-1", item: null },
      { slot: "emoji-2", item: "kudos-emoji-hedgehog" },
      { slot: "emoji-3", item: null },
    ]);
  });

  test("an admin previewing alone can pick and buy, and nobody else sees a custom item", async () => {
    const t = await workspaceDeciding(...storeOn, onForEmails("custom-kudos-emoji", "dana@example.com"));
    await aliceOpensCoinsWith(t, 100);
    await openAdmin(t, "U_DANA");
    await send(t, blockActions("U_DANA", externalPicksInHome(slack, "U_DANA", "shipit")));

    await openInventory(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "buyItem", item: shipit })));

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toContain(":shipit: ·");
    expect(publishedHome(slack, "U_ALICE").at(-1)).toBe("context: It isn't for sale.");
    expect(await coinsOf(t, "U_ALICE")).toBe(100);
    expect(externalPickerInHome(slack, "U_DANA")).toBeDefined();
  });
});

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_DANA", { is_admin: true, profile: { email: "dana@example.com" } })
    .withMember("U_ALICE", { profile: { email: "alice@example.com" } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withCustomEmoji("shipit", shipitArt)
    .withCustomEmoji("ship", "alias:shipit")
    .withCustomEmoji("partyparrot", partyArt);
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function aliceOpensCoinsWith(t: Backend, coins: number) {
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
  await xpOf(t, "U_ALICE", xpBelowLevelSix);
  await giveKudos(t, "U_ALICE", ["U_BOB"], saysWhy);
  await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openUnlock", feature: "coins" })));
  const member = await memberOf(t, "U_ALICE");
  const top = coins - (await t.run((ctx) => balanceOf(ctx, member)));
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins: top, item: null, catalogueVersion: "2", at: Date.now() }));
  await settle(t);
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string, emojiNames = ["taco"]) {
  sentMessages += 1;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), ...emojiNames.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

async function openAdmin(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
  await send(t, blockActions(user, buttonInHome(slack, user, "Admin")));
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

async function suggested(t: Backend, user: string, typed: string): Promise<string[]> {
  return (await suggestedOptions(t, user, typed)).map(({ text }) => text.text);
}

async function suggestedOptions(t: Backend, user: string, typed: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockSuggestion(user, picker, typed), form));
  expect(response.status).toBe(200);
  const { options } = (await response.json()) as { options: Array<{ text: { type: string; text: string }; value: string }> };
  return options;
}

function adminSection(home: string[]) {
  const start = home.indexOf("section: *Custom kudos emoji*");
  return start < 0 ? [] : home.slice(start, start + 2);
}

function accessoryBeside(user: string, line: string) {
  const block = publishedHomeBlocks(slack, user).find((each) => each.text?.text === line);
  expect(block?.accessory, `an accessory beside ${line}`).toBeDefined();
  return block!.accessory as Record<string, unknown>;
}

function buyButtonBeside(line: string) {
  const block = publishedHomeBlocks(slack, "U_ALICE").find((each) => each.text?.text === line);
  expect(block?.accessory, `a Buy button beside ${line}`).toBeDefined();
  return { type: "button" as const, action_id: String(block!.accessory!.action_id), value: String(block!.accessory!.value) };
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

async function coinsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}

async function customRowsOf(t: Backend) {
  return t.run((ctx) => ctx.db.query("customKudosEmoji").collect());
}

async function pickedRowsOf(t: Backend) {
  const rows = await customRowsOf(t);
  return rows
    .filter(({ unpickedAt }) => unpickedAt === undefined)
    .map(({ name, url, pickedAt }) => ({ name, url, pickedAt }))
    .toSorted((first, second) => first.name.localeCompare(second.name));
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
