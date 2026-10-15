import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, isWelcome, type SlackCall } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { everythingStored, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, publishedHomeBlocks, readBlocks, staleButtonOf, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { levelOf, xpToReach } from "../progression/levels";
import { recordReward } from "../progression/progression";
import { questOf, questPool, type QuestId } from "../quests/pool";
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
const messageSettings = "message-settings";
const alicesEmail = "alice@example.com";

const everyOtherFeature = ["xp-levels", "everyone-board", "unlocks", "skill-tree", "quests", "achievements", "coins"];
const everyOtherFeatureOn = everyOtherFeature.map(onForEveryone);

const previewedByAlice = [...everyOtherFeatureOn, onForEmails(messageSettings, alicesEmail)];
const settingsOff = [...everyOtherFeatureOn, offForEveryone(messageSettings)];
const settingsNotCreated = everyOtherFeatureOn;

const sayWhyDrawnFromTheDeployOn = { quest: "say-why" as QuestId, reward: questOf("say-why").reward, catalogueVersion: questPool.version };
const questsOneKudosLeavesOpen: QuestId[] = ["say-why-three-times", "say-why-three-days"];
const friendsOf: Record<string, [string, string, string]> = { U_ALICE: ["U_BOB", "U_CAROL", "U_DANA"], U_BOB: ["U_ALICE", "U_CAROL", "U_DANA"] };

const settingsTab = "header: Settings";
const whatISendYou = "section: *What I send you*";
const footer = "Change what I send you";

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

describe("QM22 QM30: message settings are dark wherever message-settings is off", { timeout: 120_000 }, () => {
  test("with message-settings on for Alice, her walk shows the rows in the Settings tab and the footer on her reply and every DM", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await walkEveryMessagePath(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain(whatISendYou);
    const privateMessages = privateCallsTo("U_ALICE");
    expect(privateMessages.length).toBeGreaterThan(5);
    expect(privateMessages.filter((call) => !isWelcome(call.args) && !readCall(call).some(namesSettings)).map(readCall)).toEqual([]);
    expect(slack.calls.filter(isPublic).flatMap(readCall).filter(namesSettings)).toEqual([]);
  });

  test("with message-settings not created, every Slack call of the same walk equals those with it off, and none names a message setting", async () => {
    const whileOff = await bothWalks(settingsOff);
    const whileNotCreated = await bothWalks(settingsNotCreated);

    expect(whileOff.lines.filter(namesSettings)).toEqual([]);
    expect(whileOff.settingsTab).toContain(settingsTab);
    expect(whileNotCreated.calls).toEqual(whileOff.calls);
  });

  test("with message-settings on but the flags key missing, the same walk names no message setting and sends no exposure", async () => {
    const t = await workspaceDeciding(...everyOtherFeatureOn, onForEveryone(messageSettings));
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");

    await walkEveryMessagePath(t, "U_ALICE");
    await walkEveryMessagePath(t, "U_BOB");

    expect(slack.calls.flatMap(readCall).filter(namesSettings)).toEqual([]);
    expect(await exposuresOf(t, "U_ALICE")).toEqual([]);
  });

  test("with message-settings on for Alice's email only, every other member's Slack calls equal those with it off", async () => {
    const whilePreviewed = await bothWalks(previewedByAlice);
    const whileOff = await bothWalks(settingsOff);

    expect(whilePreviewed.aliceSees.filter(namesSettings)).not.toEqual([]);
    expect(whilePreviewed.bobsCalls.filter(namesSettings)).toEqual([]);
    expect(whilePreviewed.bobsCalls).toEqual(whileOff.bobsCalls);
  });
});

describe("QM22: the message-settings flag turned off and on, its stale clicks and its exposure", { timeout: 120_000 }, () => {
  test("turning message-settings off and on again rewrites nothing, and the settings Alice stored hold throughout", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryMessagePath(t, "U_ALICE");
    for (const label of ["Level ups", "Public celebrations", "After-kudos reply"]) await turn(t, "U_ALICE", label);
    const stored = await storedMessageSettings(t);
    const rows = publishedHome(slack, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...settingsOff);
    const before = slack.calls.length;
    await aLevelUpFor(t, "U_ALICE");
    const whileOff = slack.calls.slice(before);
    await openSettingsTab(t, "U_ALICE");
    const switchesWhileOff = publishedHome(slack, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await openSettingsTab(t, "U_ALICE");

    expect(whileOff.flatMap(readCall).filter((line) => line.includes("reached level"))).toEqual([]);
    expect(whileOff.filter(({ method, args }) => method === "chat.postEphemeral" && args.user === "U_ALICE")).toEqual([]);
    expect(switchesWhileOff).toContain("section: I don't post public notices about you. [button: Unmute notices]");
    expect(await storedMessageSettings(t)).toEqual(stored);
    expect(publishedHome(slack, "U_ALICE")).toEqual(rows);
  });

  test("a Turn off from the Settings tab published while message-settings was on, clicked after it turned off, writes nothing and publishes nothing", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryMessagePath(t, "U_ALICE");
    const turnOffLevelUps = rowButton("U_ALICE", "Level ups");
    await flagsFromPostHog(t, postHog, ...settingsOff);
    await openSettingsTab(t, "U_ALICE");
    const todaysTab = publishedHome(slack, "U_ALICE");
    const stored = await everythingStored(t, { except: ["slackReceipts"] });
    const published = vi.mocked(publish).mock.calls.length;

    await interact(t, "U_ALICE", turnOffLevelUps);
    await click(t, "U_ALICE", { type: "setMessageSetting", kind: "celebrations", on: false });

    expect(await everythingStored(t, { except: ["slackReceipts"] })).toEqual(stored);
    expect(eventsPublishedSince(published)).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")).toEqual(todaysTab);
  });

  test("a stale Turn off clicked before App Home shows today's tab again stores no setting and records no change, and the click shows today's tab", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryMessagePath(t, "U_ALICE");
    const turnOffLevelUps = rowButton("U_ALICE", "Level ups");
    await flagsFromPostHog(t, postHog, ...settingsOff);

    await interact(t, "U_ALICE", turnOffLevelUps);

    expect(await storedMessageSettings(t)).toEqual([]);
    expect(postHog.productEvents().filter(({ event }) => event === "message setting changed")).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: I send you a DM when you reach a level or earn an achievement. [button: Turn off DMs]");
  });

  test("the exposure goes once per member and value, through the flag turned off and on again", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryMessagePath(t, "U_ALICE");
    await walkEveryMessagePath(t, "U_BOB");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([false]);

    await flagsFromPostHog(t, postHog, ...settingsOff);
    await aLevelUpFor(t, "U_ALICE");
    await openSettingsTab(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await aLevelUpFor(t, "U_ALICE");
    await openSettingsTab(t, "U_ALICE");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true, false]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([false]);
  });
});

async function walkEveryMessagePath(t: Backend, user: string) {
  const [first, second, third] = friendsOf[user]!;
  await giveKudos(t, user, [first], saysWhy);
  await openHome(t, user);
  await xpOf(t, user, xpToReach(9) - 10);
  await sayWhyDrawnFor(t, user);
  await giveKudos(t, user, [second], "thanks");
  for (const feature of ["skillTree", "coins", "book", "quests"]) await click(t, user, { type: "openUnlock", feature });
  await savings(t, user, 400);
  for (const perk of ["spark", "flame"]) await click(t, user, { type: "buyPerk", perk });
  await giveKudos(t, user, [first], "thanks");
  vi.setSystemTime(Date.now() + dayMs);
  await giveKudos(t, user, [third], saysWhy);
  await openSettingsTab(t, user);
  vi.setSystemTime(tuesday);
}

async function aLevelUpFor(t: Backend, user: string) {
  const level = await levelNow(t, user);
  await xpOf(t, user, xpToReach(level + 1) - 1);
  await giveKudos(t, user, [friendsOf[user]![0]], "thanks");
  expect(await levelNow(t, user)).toBe(level + 1);
}

async function levelNow(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const progress = await t.run((ctx) =>
    ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique(),
  );
  return levelOf(progress!.xp);
}

async function bothWalks(definitions: FlagDefinition[]) {
  vi.clearAllTimers();
  vi.mocked(publish).mockClear();
  const t = await workspaceDeciding(...definitions);
  await walkEveryMessagePath(t, "U_ALICE");
  const settingsTab = publishedHome(slack, "U_ALICE");
  await walkEveryMessagePath(t, "U_BOB");
  return {
    calls: comparable(slack.calls),
    lines: slack.calls.flatMap(readCall),
    settingsTab,
    aliceSees: privateCallsTo("U_ALICE").flatMap(readCall).concat(settingsTab),
    bobsCalls: comparable(slackCallsAbout("U_BOB")),
  };
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

async function openSettingsTab(t: Backend, user: string) {
  await openHome(t, user);
  await click(t, user, { type: "showHomeTab", tab: "settings" });
}

async function click(t: Backend, user: string, command: unknown) {
  await interact(t, user, staleButtonOf(command));
}

async function turn(t: Backend, user: string, label: string) {
  await interact(t, user, rowButton(user, label));
}

function rowButton(user: string, label: string): BlockAction {
  const row = publishedHomeBlocks(slack, user).find((block) => block.text?.text.startsWith(`*${label}*`));
  expect(row?.accessory, `the ${label} row in ${user}'s App Home`).toBeDefined();
  return row!.accessory as BlockAction;
}

async function interact(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
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

async function storedMessageSettings(t: Backend) {
  return t.run((ctx) => ctx.db.query("messageSettings").collect());
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
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === messageSettings);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => properties.$feature_flag_response);
}

function privateCallsTo(user: string) {
  return slack.calls.filter(({ method, args }) => (method === "chat.postEphemeral" && args.user === user) || (method === "chat.postMessage" && args.channel === user));
}

function isPublic({ method, args }: SlackCall) {
  return (method === "chat.postMessage" || method === "chat.update") && typeof args.channel === "string" && args.channel.startsWith("C");
}

function slackCallsAbout(user: string) {
  return slack.calls.filter(({ args }) => [args.channel, args.user, args.user_id].includes(user));
}

function comparable(calls: SlackCall[]) {
  return calls.map((call) => JSON.stringify(call).replace(/\d{10}\.\d{6}/g, "<ts>")).sort();
}

function readCall({ args }: SlackCall): string[] {
  const texts = [args.text, ...(Array.isArray(args.blocks) ? readBlocks(args.blocks as Block[]) : [])];
  const view = args.view as { blocks?: Block[] } | undefined;
  return [...texts, ...(view?.blocks === undefined ? [] : readBlocks(view.blocks))].filter((line): line is string => typeof line === "string");
}

function namesSettings(line: string) {
  return line.includes(footer) || line.includes("What I send you") || line.includes("setMessageSetting");
}
