import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { everythingStored, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, readBlocks, staleButtonOf, staleMenuOptionOf, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { achievementsLiveIn } from "../achievements/flag";
import { activityOf } from "../activity/activity";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { xpToReach } from "../progression/levels";
import { recordReward } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const store = "store";
const alicesEmail = "alice@example.com";
const savedUp = 400;
const ribbon = "kudos-emoji-ribbon";
const rocket = "kudos-emoji-rocket";
const yourEmojiGoal = "Give a kudos that says why with one of your kudos emoji.";
const generousSoul = "🏅 You earned Generous Soul (Generosity, silver).";

const everyOtherFeature = ["xp-levels", "unlocks", "skill-tree", "quests", "achievements", "coins"];
const featuresOn = (...keys: string[]) => keys.map(onForEveryone);
const featuresOnBut = (off: string) => [...featuresOn(...everyOtherFeature.filter((key) => key !== off)), offForEveryone(off)];

const previewedByAlice = [...featuresOn(...everyOtherFeature), onForEmails(store, alicesEmail)];
const storeOff = [...featuresOn(...everyOtherFeature), offForEveryone(store)];
const storeNotCreated = featuresOn(...everyOtherFeature);
const storeOnForEveryone = [...featuresOn(...everyOtherFeature), onForEveryone(store)];
const onWithoutCoins = [...featuresOnBut("coins"), onForEveryone(store)];
const onWithoutXpLevels = [...featuresOnBut("xp-levels"), onForEveryone(store)];
const onWithoutUnlocks = [...featuresOnBut("unlocks"), onForEveryone(store)];

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

describe("ST20 ST22 ST23: the store is dark wherever it isn't shown", { timeout: 120_000 }, () => {
  test("with store on for Alice, her walk reaches every store path: Coins and inventory, the Inventory tab, the tier emoji line, your-emoji and her loadout's kudos", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    const { loadoutKudos } = await walkEveryStorePath(t, "U_ALICE");

    const told = slackCallsAbout("U_ALICE").flatMap(readCall).join("\n");
    expect(told).toContain("*Coins and inventory* is ready.");
    expect(told).toContain("Coins and inventory are open.");
    expect(told).toContain(`${generousSoul} + :ribbon: Ribbon for your kudos emoji slots`);
    expect(told).toContain("Quest done: Give a kudos that says why with one of your kudos emoji (+40 XP, +20 🪙)");
    expect(publishedHome(slack, "U_ALICE")).toEqual(expect.arrayContaining(["header: Inventory", "section: Slot 1 · 🦔 Hedgehog [button: Take off]", "section: Slot 2 · 🎀 Ribbon [button: Take off]"]));
    expect(await kudosMessagesOf(t, "U_ALICE")).toContain(loadoutKudos);
    expect(await goalsInActivityOf(t, "U_ALICE")).toContain(yourEmojiGoal);
    expect(await inventoryOf(t, "U_ALICE")).not.toBeNull();
    expect(await storeRowsOf(t, "U_ALICE")).toMatchObject({ purchases: [{ outcome: { kind: "bought", item: rocket } }], yourEmoji: ["activated", "rewarded"] });
    expect(eventsPublishedSince(0)).toContain("itemBought");
  });

  test.each([
    ["off", storeOff, { flagsKeySet: true, coinsNamed: true, silverEarned: true, tierTold: true }],
    ["not created", storeNotCreated, { flagsKeySet: true, coinsNamed: true, silverEarned: true, tierTold: true }],
    ["on but the flags key missing", storeOnForEveryone, { flagsKeySet: false, coinsNamed: false, silverEarned: true, tierTold: false }],
    ["on but coins off", onWithoutCoins, { flagsKeySet: true, coinsNamed: false, silverEarned: true, tierTold: true }],
    ["on but xp-levels off", onWithoutXpLevels, { flagsKeySet: true, coinsNamed: false, silverEarned: false, tierTold: false }],
    ["on but unlocks off", onWithoutUnlocks, { flagsKeySet: true, coinsNamed: false, silverEarned: false, tierTold: false }],
  ])("with store %s, the same walk shows nothing of the store anywhere, the loadout claims nothing, and a silver tier earned still grants its emoji", async (_, definitions, { flagsKeySet, coinsNamed, silverEarned, tierTold }) => {
    const t = await workspaceDeciding(...definitions);
    if (!flagsKeySet) vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");

    const { loadoutKudos } = await walkEveryStorePath(t, "U_ALICE");

    const told = slack.calls.flatMap(readCall);
    expect(told.filter(namesTheStore)).toEqual([]);
    if (coinsNamed) expect(told).toEqual(expect.arrayContaining(["section: *Coins* is ready. It opens your wallet and the coin perks. [button: Open]", expect.stringMatching(/^Coins are open\. You already have \d+ 🪙\.$/)]));
    if (tierTold) expect(told.join("\n")).toContain(`${generousSoul}\n`);
    expect(await kudosMessagesOf(t, "U_ALICE")).not.toContain(loadoutKudos);
    expect(await goalsInActivityOf(t, "U_ALICE")).not.toContain(yourEmojiGoal);
    expect(await inventoryOf(t, "U_ALICE")).toBeNull();
    expect(await storeRowsOf(t, "U_ALICE")).toEqual({ collection: silverEarned ? [{ item: ribbon, source: "tier" }] : [], loadouts: [], purchases: [], yourEmoji: [] });
    expect(eventsPublishedSince(0)).not.toContain("itemBought");
  });

  test("with store on for Alice's email only, every other member's Slack calls, and which of their messages are kudos, equal those with store off, and nothing public names the store", async () => {
    const whilePreviewed = await othersSideOfBothWalks(previewedByAlice);
    vi.clearAllTimers();
    vi.mocked(publish).mockClear();
    const whileOff = await othersSideOfBothWalks(storeOff);

    expect(whilePreviewed.told.filter(namesTheStore)).toEqual([]);
    expect(whilePreviewed.saidInPublic.filter(namesTheStore)).toEqual([]);
    expect(whilePreviewed.saidInPublic).toEqual(expect.arrayContaining(["🏅 <@U_ALICE> earned Generous Soul and Friendly Face."]));
    expect(whilePreviewed.calls).toEqual(whileOff.calls);
    expect(whilePreviewed.kudos).toEqual(whileOff.kudos);
    expect(whilePreviewed.collection).toEqual([{ item: ribbon, source: "tier" }]);
  });

  test.each(["coins", "xp-levels", "unlocks"])("once Alice's store was shown and her slots filled, turning %s off hides it again: nothing names the store, inventoryOf answers null, her loadout claims nothing and stale clicks write nothing", async (off) => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryStorePath(t, "U_ALICE");
    const before = slack.calls.length;

    await flagsFromPostHog(t, postHog, ...featuresOnBut(off), onForEmails(store, alicesEmail));
    vi.setSystemTime(tuesday + 2 * dayMs);
    const loadoutKudos = await giveKudos(t, "U_ALICE", ["U_DANA"], saysWhy, ["hedgehog", "ribbon"]);
    await openHome(t, "U_ALICE");
    const stored = await everythingStoredButExposures(t);
    const published = vi.mocked(publish).mock.calls.length;
    await click(t, "U_ALICE", { type: "buyItem", item: "kudos-emoji-gem" });
    await pick(t, "U_ALICE", { type: "equip", item: ribbon, slot: "emoji-3" });
    await click(t, "U_ALICE", { type: "takeOff", slot: "emoji-1" });

    expect(slack.calls.slice(before).flatMap(readCall).filter(namesTheStore)).toEqual([]);
    expect(await kudosMessagesOf(t, "U_ALICE")).not.toContain(loadoutKudos);
    expect(await inventoryOf(t, "U_ALICE")).toBeNull();
    expect(await everythingStoredButExposures(t)).toEqual(stored);
    expect(eventsPublishedSince(published)).toEqual([]);
  });
});

describe("ST22 O35 O36: the store flag turned off and on, its stale clicks and its exposure", { timeout: 120_000 }, () => {
  test("O35 F24: turning store off and on again rewrites nothing and shows the same collection and loadout", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryStorePath(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    const shown = { home: publishedHome(slack, "U_ALICE"), inventory: await inventoryOf(t, "U_ALICE"), goals: await goalsInActivityOf(t, "U_ALICE") };
    const recorded = await everythingStoredButExposures(t);

    await flagsFromPostHog(t, postHog, ...storeOff);
    await openHome(t, "U_ALICE");
    const hidden = { home: publishedHome(slack, "U_ALICE"), goals: await goalsInActivityOf(t, "U_ALICE") };
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await openHome(t, "U_ALICE");

    expect(shown.goals).toContain(yourEmojiGoal);
    expect(hidden.home.filter(namesTheStore)).toEqual([]);
    expect(hidden.goals).not.toContain(yourEmojiGoal);
    expect(await everythingStoredButExposures(t)).toEqual(recorded);
    expect({ home: publishedHome(slack, "U_ALICE"), inventory: await inventoryOf(t, "U_ALICE"), goals: await goalsInActivityOf(t, "U_ALICE") }).toEqual(shown);
  });

  test.each([
    ["off", storeOff],
    ["on but coins off", onWithoutCoins],
    ["on but xp-levels off", onWithoutXpLevels],
    ["on but unlocks off", onWithoutUnlocks],
  ])("with store %s, a stale Buy, Put in slot and Take off write nothing, spend nothing and publish nothing", async (_, definitions) => {
    const t = await workspaceDeciding(...definitions);
    await walkEveryStorePath(t, "U_ALICE");
    const stored = await everythingStoredButExposures(t);
    const published = vi.mocked(publish).mock.calls.length;

    await click(t, "U_ALICE", { type: "buyItem", item: "kudos-emoji-gem" });
    await pick(t, "U_ALICE", { type: "equip", item: ribbon, slot: "emoji-3" });
    await click(t, "U_ALICE", { type: "takeOff", slot: "emoji-1" });

    expect(await everythingStoredButExposures(t)).toEqual(stored);
    expect(eventsPublishedSince(published)).toEqual([]);
  });

  test("a stale click from a store published while it was on writes nothing once it is off for the member", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryStorePath(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...storeOff);
    const stored = await everythingStoredButExposures(t);
    const published = vi.mocked(publish).mock.calls.length;

    await click(t, "U_ALICE", { type: "buyItem", item: "kudos-emoji-gem" });
    await pick(t, "U_ALICE", { type: "equip", item: rocket, slot: "emoji-1" });
    await click(t, "U_ALICE", { type: "takeOff", slot: "emoji-2" });

    expect(await everythingStoredButExposures(t)).toEqual(stored);
    expect(eventsPublishedSince(published)).toEqual([]);
    expect(publishedHome(slack, "U_ALICE").filter(namesTheStore)).toEqual([]);
  });

  test("O36 F25: the store exposure goes once per member and value, and only where the flag decides anything", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryStorePath(t, "U_ALICE");
    await walkEveryStorePath(t, "U_BOB");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([false]);

    await flagsFromPostHog(t, postHog, ...storeOff);
    vi.setSystemTime(tuesday + 3 * dayMs);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy, ["hedgehog"]);
    await openHome(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await giveKudos(t, "U_ALICE", ["U_DANA"], saysWhy, ["hedgehog"]);
    await openHome(t, "U_ALICE");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true, false]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([false]);
  });

  test.each([
    ["coins off", onWithoutCoins],
    ["xp-levels off", onWithoutXpLevels],
    ["unlocks off", onWithoutUnlocks],
  ])("with store on but %s, no store exposure is sent", async (_, definitions) => {
    const t = await workspaceDeciding(...definitions);

    await walkEveryStorePath(t, "U_ALICE");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([]);
  });
});

async function walkEveryStorePath(t: Backend, user: string) {
  const [first, second, third] = friendsOf[user]!;
  await giveKudos(t, user, [first], saysWhy);
  await openHome(t, user);
  await xpOf(t, user, xpToReach(9) - 10);
  await giveKudos(t, user, [second], "thanks");
  for (const feature of ["skillTree", "coins", "book", "quests"]) await click(t, user, { type: "openUnlock", feature });
  await savings(t, user, savedUp);
  await kudosGivenSoFar(t, user, 24);
  await giveKudos(t, user, [third], saysWhy);
  await openHome(t, user);
  await click(t, user, { type: "showHomeTab", tab: "inventory" });
  await click(t, user, { type: "buyItem", item: rocket });
  await pick(t, user, { type: "equip", item: ribbon, slot: "emoji-2" });
  await pick(t, user, { type: "equip", item: rocket, slot: "emoji-3" });
  await click(t, user, { type: "takeOff", slot: "emoji-3" });
  vi.setSystemTime(tuesday + dayMs);
  const loadoutKudos = await giveKudos(t, user, [third], saysWhy, ["hedgehog", "ribbon"]);
  await openHome(t, user);
  vi.setSystemTime(tuesday);
  return { loadoutKudos };
}

async function othersSideOfBothWalks(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await walkEveryStorePath(t, "U_ALICE");
  await walkEveryStorePath(t, "U_BOB");
  const calls = [...slackCallsAbout("U_BOB"), ...slackCallsAbout("U_CAROL")];
  const saidInPublic = slack.calls.filter(({ method, args }) => method === "chat.postMessage" && String(args.channel).startsWith("C")).flatMap(readCall);
  return { calls: calls.map((call) => JSON.stringify(withoutTimestamps(call))).sort(), told: calls.flatMap(readCall), saidInPublic, kudos: await kudosMessagesOf(t, "U_BOB"), collection: (await storeRowsOf(t, "U_BOB")).collection };
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
  await journeyShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
  await t.run((ctx) => achievementsLiveIn(ctx, "T1"));
  await settle(t);
  return t;
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string, emojiNames = ["taco"]) {
  sentMessages += 1;
  const ts = `${Math.floor(Date.now() / 1000) + sentMessages}.000100`;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), ...emojiNames.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settleInTimeOrder(t);
  return ts;
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
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

async function savings(t: Backend, user: string, saved: number) {
  const member = await memberOf(t, user);
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins: saved, item: null, catalogueVersion: "2", at: Date.now() }));
  await settle(t);
}

async function kudosGivenSoFar(t: Backend, user: string, count: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const counted = await ctx.db
      .query("ladderCounts")
      .withIndex("by_member_ladder", (q) => q.eq("member", member).eq("ladder", "generosity"))
      .unique();
    if (counted === null) await ctx.db.insert("ladderCounts", { member, ladder: "generosity", count });
    else await ctx.db.patch(counted._id, { count });
  });
}

function everythingStoredButExposures(t: Backend) {
  return everythingStored(t, { except: ["slackReceipts", "flagExposures"] });
}

async function inventoryOf(t: Backend, user: string) {
  return t.query(internal.store.inventory.inventoryOf, { member: await memberOf(t, user) });
}

async function kudosMessagesOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const awards = await t.run(async (ctx) => (await ctx.db.query("awards").collect()).filter(({ giver }) => giver === member));
  return [...new Set(awards.map(({ message }) => message))].sort();
}

async function goalsInActivityOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const { entries } = await t.run((ctx) => activityOf(ctx, member, { filter: "given", cursor: null }));
  return entries.flatMap((entry) => (entry.kind === "kudosGiven" ? (entry.earned?.questsDone ?? []).map(({ goal }) => goal) : []));
}

async function storeRowsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const ofMember = <Row extends { member: MemberId }>(rows: Row[]) => rows.filter((row) => row.member === member);
    return {
      collection: ofMember(await ctx.db.query("collection").collect()).map(({ item, source }) => ({ item, source })),
      loadouts: ofMember(await ctx.db.query("loadouts").collect()).map(({ slot, item }) => ({ slot, item })),
      purchases: ofMember(await ctx.db.query("itemPurchases").collect()).map(({ outcome }) => ({ outcome })),
      yourEmoji: [
        ...ofMember(await ctx.db.query("journeySteps").collect()).flatMap(({ step }) => (step === "your-emoji" ? ["activated"] : [])),
        ...ofMember(await ctx.db.query("rewardRecords").collect()).flatMap(({ key }) => (key === "journey:your-emoji" ? ["rewarded"] : [])),
      ],
    };
  });
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
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === store);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => properties.$feature_flag_response);
}

function slackCallsAbout(user: string) {
  return slack.calls.filter(({ args }) => [args.channel, args.user, args.user_id].includes(user));
}

function readCall({ args }: SlackCall): string[] {
  const texts = [args.text, args.name, ...(Array.isArray(args.blocks) ? readBlocks(args.blocks as Block[]) : [])];
  const view = args.view as { blocks?: Block[] } | undefined;
  return [...texts, ...(view?.blocks === undefined ? [] : readBlocks(view.blocks))].filter((line): line is string => typeof line === "string");
}

function withoutTimestamps(call: SlackCall) {
  return JSON.parse(JSON.stringify(call).replace(/\d{10}\.\d{6}/g, "<ts>"));
}

function namesTheStore(line: string) {
  return /inventory|kudos emoji|slot|store|🦔|hedgehog|🎀|ribbon|🚀|rocket|not yours yet|put in slot|take off/i.test(line);
}
