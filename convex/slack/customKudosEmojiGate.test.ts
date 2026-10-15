import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import {
  blockActions,
  blockSuggestion,
  buttonInHome,
  publishedHome,
  publishedHomeBlocks,
  readBlocks,
  staleButtonOf,
  staleMenuOptionOf,
  stalePicksOf,
  type Block,
} from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { recordReward } from "../progression/progression";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const customKudosEmoji = "custom-kudos-emoji";
const danasEmail = "dana@example.com";
const shipit = "custom:shipit";
const partyparrot = "custom:partyparrot";
const picker = "setCustomKudosEmoji";
const xpBelowLevelSix = 990;
const savedUp = 300;

const storeOnFor = (...emails: string[]) => [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("coins"), emails.length === 0 ? onForEveryone("store") : onForEmails("store", ...emails)];
const storeOn = storeOnFor();
const onForEveryoneDeciding = [...storeOn, onForEveryone(customKudosEmoji)];
const previewedByDana = [...storeOn, onForEmails(customKudosEmoji, danasEmail)];
const customOff = [...storeOn, offForEveryone(customKudosEmoji)];
const storeOffForAliceAndBob = [...storeOnFor(danasEmail), onForEveryone(customKudosEmoji)];
const coinsOffForAliceAndBob = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEmails("coins", danasEmail), onForEveryone("store"), onForEveryone(customKudosEmoji)];

const friendOf: Record<string, string> = { U_ALICE: "U_BOB", U_DANA: "U_FRANK", U_BOB: "U_ALICE" };

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

describe("ST35 O36: custom kudos emoji are dark wherever custom-kudos-emoji isn't on for the member, and its exposure goes once per member and value", { timeout: 120_000 }, () => {
  test.each([
    ["off", customOff, true],
    ["not created", storeOn, true],
    ["on but the flags key missing", onForEveryoneDeciding, false],
  ])("with custom-kudos-emoji %s after Alice slotted :shipit:, no picker, no custom item and no claim reach Slack or inventoryOf, nothing is picked, bought or slotted, and it all returns when it is on again", async (_, definitions, flagsKeySet) => {
    const t = await workspaceDeciding(...onForEveryoneDeciding);
    await danaPicksAndAliceSlotsShipit(t);
    const shown = await customSideOf(t, "U_ALICE");
    const stored = await storeStateOf(t);
    const before = slack.calls.length;
    const flagsKey = process.env.POSTHOG_PERSONAL_API_KEY!;

    await flagsFromPostHog(t, postHog, ...definitions);
    if (!flagsKeySet) vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
    const { claimed, searched } = await walkEveryCustomPath(t);

    expect(slack.calls.slice(before).flatMap(readCall).filter(namesCustomEmoji)).toEqual([]);
    expect(searched).toEqual({ U_DANA: [], U_ERIN: [] });
    expect(claimed).toEqual([]);
    expect(await customItemsInInventoryOf(t, "U_ALICE")).toEqual(flagsKeySet ? [] : null);
    expect(await customItemsInInventoryOf(t, "U_BOB")).toEqual(flagsKeySet ? [] : null);
    expect(await storeStateOf(t)).toEqual(stored);

    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
    await flagsFromPostHog(t, postHog, ...onForEveryoneDeciding);
    expect(await customSideOf(t, "U_ALICE")).toEqual(shown);
  });

  test.each([
    ["store off", storeOffForAliceAndBob],
    ["coins off", coinsOffForAliceAndBob],
  ])("with custom-kudos-emoji on but %s for Alice, Bob and the admin Erin, they see no picker and no custom item, her :shipit: claims nothing, their stale clicks pick, buy and slot nothing, and no new custom-kudos-emoji exposure is sent for them", async (_, definitions) => {
    const t = await workspaceDeciding(...onForEveryoneDeciding);
    await danaPicksAndAliceSlotsShipit(t);
    const exposed = { alice: await exposuresOf(t, "U_ALICE"), bob: await exposuresOf(t, "U_BOB") };
    const stored = await storeStateOf(t);
    const before = slack.calls.length;

    await flagsFromPostHog(t, postHog, ...definitions);
    const { claimed, searched } = await walkEveryCustomPath(t);

    expect(["U_ALICE", "U_BOB", "U_ERIN"].flatMap((user) => slackCallsAbout(user, before)).flatMap(readCall).filter(namesCustomEmoji)).toEqual([]);
    expect(searched.U_ERIN).toEqual([]);
    expect(claimed).toEqual([]);
    expect(await customItemsInInventoryOf(t, "U_ALICE")).toBeNull();
    expect(await customItemsInInventoryOf(t, "U_BOB")).toBeNull();
    expect(await storeStateOf(t)).toEqual(stored);
    expect({ alice: await exposuresOf(t, "U_ALICE"), bob: await exposuresOf(t, "U_BOB"), erin: await exposuresOf(t, "U_ERIN") }).toEqual({ ...exposed, erin: [] });
  });

  test("with custom-kudos-emoji on for Dana's email only, she picks, buys and thanks Frank with :shipit:, and nobody else sees or claims it: Alice's, Bob's and the other admin Erin's distinct Slack calls and kudos equal those with it off, and nothing public names where her emoji came from", async () => {
    const whilePreviewed = await othersSideOfDanasWalk(previewedByDana);
    vi.clearAllTimers();
    vi.setSystemTime(tuesday);
    const whileOff = await othersSideOfDanasWalk(customOff);

    expect(whilePreviewed.danaThanked).toMatchObject({ kudosEmoji: "shipit", loadoutEmoji: ["shipit"], awards: [{ kudos: 1 }] });
    expect(whilePreviewed.danaBought).toEqual([{ kind: "bought", item: shipit }]);
    expect(whilePreviewed.told.filter(namesCustomEmoji)).toEqual([]);
    expect(whilePreviewed.saidInPublic.filter(namesTheSource)).toEqual([]);
    expect(whilePreviewed.calls).toEqual(whileOff.calls);
    expect(whilePreviewed.kudos).toEqual(whileOff.kudos);
    expect(whilePreviewed.aliceInventory).toEqual(whileOff.aliceInventory);
    expect(whileOff.danaThanked).toBeUndefined();
    expect(whileOff.danaBought).toEqual([]);
  });

  test("O36 F25: the custom-kudos-emoji exposure goes once per member and value, again for a value that changed, and never for a member the store isn't shown to", async () => {
    const t = await workspaceDeciding(...[...storeOnFor(danasEmail, "alice@example.com"), onForEmails(customKudosEmoji, danasEmail)]);
    await opensCoinsWith(t, "U_ALICE", 100);
    await danaPicksBuysAndSlots(t);
    await walkEveryCustomPath(t);
    await walkEveryCustomPath(t);

    expect(await exposuresOf(t, "U_DANA")).toEqual([true]);
    expect(await exposuresOf(t, "U_ALICE")).toEqual([false]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([]);
    expect(await exposuresOf(t, "U_ERIN")).toEqual([]);

    await flagsFromPostHog(t, postHog, ...[...storeOnFor(danasEmail, "alice@example.com"), onForEmails(customKudosEmoji, danasEmail, "alice@example.com")]);
    vi.setSystemTime(tuesday + dayMs);
    await walkEveryCustomPath(t);
    await walkEveryCustomPath(t);

    expect(await exposuresOf(t, "U_DANA")).toEqual([true]);
    expect(await exposuresOf(t, "U_ALICE")).toEqual([false, true]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([]);
    expect(await exposuresOf(t, "U_ERIN")).toEqual([]);
  });
});

async function danaPicksAndAliceSlotsShipit(t: Backend) {
  await opensCoinsWith(t, "U_ALICE", 100);
  await opensCoinsWith(t, "U_BOB", 100);
  await openAdmin(t, "U_DANA");
  await send(t, blockActions("U_DANA", stalePicksOf(picker, "shipit", "partyparrot")));
  await openInventory(t, "U_ALICE");
  await click(t, "U_ALICE", { type: "buyItem", item: shipit });
  await pick(t, "U_ALICE", { type: "equip", item: shipit, slot: "emoji-2" });
  vi.setSystemTime(Date.now() + dayMs);
}

async function danaPicksBuysAndSlots(t: Backend) {
  await opensCoinsWith(t, "U_DANA", savedUp);
  await openAdmin(t, "U_DANA");
  await send(t, blockActions("U_DANA", stalePicksOf(picker, "shipit", "partyparrot")));
  await openInventory(t, "U_DANA");
  await click(t, "U_DANA", { type: "buyItem", item: shipit });
  await pick(t, "U_DANA", { type: "equip", item: shipit, slot: "emoji-2" });
  vi.setSystemTime(Date.now() + dayMs);
}

async function walkEveryCustomPath(t: Backend) {
  await openAdmin(t, "U_DANA");
  await openAdmin(t, "U_ERIN");
  const searched = { U_DANA: await suggested(t, "U_DANA", "ship"), U_ERIN: await suggested(t, "U_ERIN", "ship") };
  await send(t, blockActions("U_ERIN", stalePicksOf(picker, "shipit")));
  for (const user of ["U_ALICE", "U_BOB"]) {
    await openInventory(t, user);
    await click(t, user, { type: "buyItem", item: partyparrot });
    await pick(t, user, { type: "equip", item: shipit, slot: "emoji-3" });
  }
  const before = (await kudosGivenEvents(t)).length;
  await giveKudos(t, "U_ALICE", [friendOf.U_ALICE!], saysWhy, ["shipit"]);
  await giveKudos(t, "U_BOB", [friendOf.U_BOB!], saysWhy, ["shipit"]);
  await openInventory(t, "U_ALICE");
  return { searched, claimed: (await kudosGivenEvents(t)).slice(before) };
}

async function othersSideOfDanasWalk(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await opensCoinsWith(t, "U_ALICE", 100);
  await danaPicksBuysAndSlots(t);
  await walkEveryCustomPath(t);
  const before = (await kudosGivenEvents(t)).length;
  await giveKudos(t, "U_DANA", [friendOf.U_DANA!], saysWhy, ["shipit"]);
  const calls = ["U_ALICE", "U_BOB", "U_ERIN"].flatMap((user) => slackCallsAbout(user));
  return {
    calls: [...new Set(calls.map((call) => JSON.stringify(withoutTimestamps(call))))].sort(),
    told: calls.flatMap(readCall),
    saidInPublic: slack.calls.filter(({ method, args }) => method !== "chat.postEphemeral" && String(args.channel).startsWith("C")).flatMap(readCall),
    kudos: [...(await kudosMessagesOf(t, "U_ALICE")), ...(await kudosMessagesOf(t, "U_BOB"))],
    aliceInventory: await t.query(internal.store.inventory.inventoryOf, { member: await memberOf(t, "U_ALICE") }),
    danaThanked: (await kudosGivenEvents(t)).slice(before).at(0),
    danaBought: (await storeStateOf(t)).bought.map(({ outcome }) => outcome),
  };
}

async function customSideOf(t: Backend, user: string) {
  await openInventory(t, user);
  return { home: publishedHome(slack, user).filter(namesCustomEmoji), inventory: await customItemsInInventoryOf(t, user) };
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_DANA", { is_admin: true, profile: { email: danasEmail } })
    .withMember("U_ERIN", { is_admin: true, profile: { email: "erin@example.com" } })
    .withMember("U_ALICE", { profile: { email: "alice@example.com" } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withMember("U_FRANK", { profile: { email: "frank@example.com" } })
    .withCustomEmoji("shipit", "https://emoji.slack-edge.com/T1/shipit/0a1b2c.png")
    .withCustomEmoji("ship", "alias:shipit")
    .withCustomEmoji("partyparrot", "https://emoji.slack-edge.com/T1/partyparrot/3c4d5e.gif");
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function opensCoinsWith(t: Backend, user: string, coins: number) {
  await giveKudos(t, user, [friendOf[user]!], saysWhy);
  await xpOf(t, user, xpBelowLevelSix);
  await giveKudos(t, user, [friendOf[user]!], saysWhy);
  await click(t, user, { type: "openUnlock", feature: "coins" });
  const member = await memberOf(t, user);
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
  if (publishedHomeBlocks(slack, user).length > 0) await click(t, user, { type: "showHomeTab", tab: "admin" });
}

async function openInventory(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
  await click(t, user, { type: "showHomeTab", tab: "inventory" });
}

async function click(t: Backend, user: string, command: unknown) {
  await send(t, blockActions(user, staleButtonOf(command)));
}

async function pick(t: Backend, user: string, command: unknown) {
  await send(t, blockActions(user, staleMenuOptionOf(command)));
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

async function suggested(t: Backend, user: string, typed: string): Promise<string[]> {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockSuggestion(user, picker, typed), form));
  expect(response.status).toBe(200);
  const { options } = (await response.json()) as { options: Array<{ text: { text: string } }> };
  return options.map(({ text }) => text.text);
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

async function customItemsInInventoryOf(t: Backend, user: string) {
  const inventory = await t.query(internal.store.inventory.inventoryOf, { member: await memberOf(t, user) });
  if (inventory === null) return null;
  const custom = (item: string | null) => item?.startsWith("custom:") === true;
  return [...inventory.slots.map(({ item }) => item), ...inventory.owned.map(({ item }) => item), ...inventory.catalogue.map(({ item }) => item)].filter(custom);
}

function storeStateOf(t: Backend) {
  return t.run(async (ctx) => ({
    customKudosEmoji: await ctx.db.query("customKudosEmoji").collect(),
    collection: await ctx.db.query("collection").collect(),
    loadouts: await ctx.db.query("loadouts").collect(),
    bought: (await ctx.db.query("itemPurchases").collect()).filter(({ outcome }) => outcome.kind === "bought"),
    wallets: await ctx.db.query("wallets").collect(),
    coinSpends: await ctx.db.query("coinSpends").collect(),
  }));
}

async function kudosGivenEvents(t: Backend): Promise<KudosGivenEvent[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name.endsWith(":recordKudosGiven")).map(({ args }) => (args[0] as { event: KudosGivenEvent }).event);
}

async function kudosMessagesOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const awards = await t.run(async (ctx) => (await ctx.db.query("awards").collect()).filter(({ giver }) => giver === member));
  return [...new Set(awards.map(({ message }) => message))].sort();
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === customKudosEmoji);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => properties.$feature_flag_response);
}

function slackCallsAbout(user: string, from = 0) {
  return slack.calls.slice(from).filter(({ args }) => [args.channel, args.user, args.user_id].includes(user));
}

function readCall({ args }: SlackCall): string[] {
  const texts = [args.text, args.name, ...(Array.isArray(args.blocks) ? readBlocks(args.blocks as Block[]) : [])];
  const view = args.view as { blocks?: Block[] } | undefined;
  return [...texts, ...(view?.blocks === undefined ? [] : readBlocks(view.blocks))].filter((line): line is string => typeof line === "string");
}

function withoutTimestamps(call: SlackCall) {
  return JSON.parse(JSON.stringify(call).replace(/\d{10}\.\d{6}/g, "<ts>"));
}

function namesTheSource(line: string) {
  return /store|inventory|slot|bought|custom kudos emoji|🪙/i.test(line);
}

function namesCustomEmoji(line: string) {
  return /shipit|partyparrot|custom kudos emoji|custom emoji/i.test(line);
}
