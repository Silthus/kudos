import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEveryone, postHogDeciding } from "../../testing/flags";
import { blockActions, publishedHome, publishedHomeBlocks, type BlockAction } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import { notify, type Notification } from "../feedback/notify";
import { messageKinds, type MessageKind } from "../messageSettings/kinds";
import { setMessageSetting } from "../messageSettings/messageSettings";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const messageSettings = "message-settings";

const rows = {
  kudosReply: "section: *After-kudos reply* — What a kudos you gave earned you, right after you send it. [button: Turn off]",
  tips: "section: *Tips* — Short tips on earning more, like saying why you're thanking someone. [button: Turn off]",
  levelUps: "section: *Level ups* — When you reach a level, with what it opens for you. [button: Turn off]",
  newFeatures: "section: *New features* — When a new feature is ready for you to open. [button: Turn off]",
  quests: "section: *Quests and Journey* — When you finish a quest or a Journey step. [button: Turn off]",
  achievements: "section: *Book tiers* — When you earn an achievement tier. [button: Turn off]",
  celebrations: "section: *Public celebrations* — Your level ups and tiers in the announcement channel. [button: Turn off]",
};

const offRows = {
  levelUps: "section: *Level ups* · Off — When you reach a level, with what it opens for you. [button: Turn on]",
  newFeatures: "section: *New features* · Off — When a new feature is ready for you to open. [button: Turn on]",
  quests: "section: *Quests and Journey* · Off — When you finish a quest or a Journey step. [button: Turn on]",
  achievements: "section: *Book tiers* · Off — When you earn an achievement tier. [button: Turn on]",
  celebrations: "section: *Public celebrations* · Off — Your level ups and tiers in the announcement channel. [button: Turn on]",
};

const whatISendYou = "section: *What I send you*";
const levelUpDm = "🎉 You reached level 2!\nLevel 3 is 80 XP away.";
const levelUpPost = "🎉 <@U_ALICE> reached level 2.";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("QM20: the Settings tab lists what I send you while message-settings is on", () => {
  test("a member with only the core loop gets the Settings tab, with the after-kudos reply as its one row", async () => {
    const t = await workspaceWith([messageSettings]);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    const tabBar = publishedHome(slack, "U_ALICE")[0];

    await click(t, "U_ALICE", "Settings");

    expect(tabBar).toBe("actions: [Profile] | Settings");
    expect(publishedHome(slack, "U_ALICE")).toEqual(["actions: Profile | [Settings]", "header: Settings", whatISendYou, rows.kudosReply]);
  });

  test("with xp-levels on, level ups and public celebrations join the rows, and the notification switches give way", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);

    expect(publishedHome(slack, "U_ALICE")).toEqual(["actions: Profile | [Settings]", "header: Settings", whatISendYou, rows.kudosReply, rows.levelUps, rows.celebrations]);
  });

  test("every kind shows while its feature applies to the member, in the catalogue's order, below the leaderboard switch", async () => {
    const t = await everythingShipped();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await bookOpenedBy(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Settings");

    expect(publishedHome(slack, "U_ALICE").slice(publishedHome(slack, "U_ALICE").indexOf(whatISendYou))).toEqual([
      whatISendYou,
      rows.kudosReply,
      rows.tips,
      rows.levelUps,
      rows.newFeatures,
      rows.quests,
      rows.achievements,
      rows.celebrations,
    ]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: *Show me on the leaderboards*");
  });

  test("a kind turned off says Off and offers to turn it on again", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);

    await turn(t, "U_ALICE", "Level ups");

    expect(publishedHome(slack, "U_ALICE")).toEqual(["actions: Profile | [Settings]", "header: Settings", whatISendYou, rows.kudosReply, offRows.levelUps, rows.celebrations]);
  });
});

describe("QM16: a message a member turned off is never sent", () => {
  test("level ups off: the next level up sends no DM, and the public celebration still posts", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"], { announcementChannel: "C_NEWS" });

    await turn(t, "U_ALICE", "Level ups");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDmsTo("U_ALICE")).toEqual([]);
    expect(postsIn("C_NEWS")).toEqual([levelUpPost]);
  });

  test("public celebrations off: the next level up posts nothing in the announcement channel, and the DM still arrives", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"], { announcementChannel: "C_NEWS" });

    await turn(t, "U_ALICE", "Public celebrations");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(postsIn("C_NEWS")).toEqual([]);
    expect(levelUpDmsTo("U_ALICE")).toEqual([levelUpDm]);
  });

  test("a level-up DM Slack held back is not sent once the member turned level ups off", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);
    const turnOff = rowButton("U_ALICE", "Level ups");
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ALICE", turnOff), form));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDmsTo("U_ALICE")).toEqual([]);
  });

  const queued: Array<[string, string, Notification]> = [
    ["level-reached", "Level ups", { kind: "level-reached", level: 2, skillPoints: null, xpToNextLevel: 80, ready: [] }],
    ["features-shipped", "New features", { kind: "features-shipped", ready: ["leaderboard"] }],
    ["quest-finished", "Quests and Journey", { kind: "quest-finished", quest: { kind: "journey", step: "first-thanks" }, xp: 20 }],
    ["journey-joined", "Quests and Journey", { kind: "journey-joined", finished: [{ quest: { kind: "journey", step: "first-thanks" }, xp: 20 }] }],
    ["weekly-quest-finished", "Quests and Journey", { kind: "weekly-quest-finished", quest: { kind: "weekly", week: "2026-10-12", slot: 0 }, goal: "Thank 3 teammates", xp: 30 }],
    ["tiers-earned", "Book tiers", { kind: "tiers-earned", tiers: [{ ladder: "generosity", tier: "bronze" }] }],
  ];

  test.each(queued)("a %s DM already on its way is sent while %s is on, and not once it is off", async (_, label, notification) => {
    const t = await everythingShipped();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await bookOpenedBy(t, "U_ALICE");
    await leaderboardReadyFor(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Settings");
    const before = slack.messagesIn("U_ALICE").length;

    await deliver(t, "U_ALICE", notification);
    const whileOn = slack.messagesIn("U_ALICE").length - before;
    await turn(t, "U_ALICE", label);
    await deliver(t, "U_ALICE", notification);

    expect(whileOn).toBe(1);
    expect(slack.messagesIn("U_ALICE").length - before).toBe(1);
  });

  test.each(queued)("a %s DM written while %s is off is not sent, even once it is on again before Slack would take it", async (_, label, notification) => {
    const t = await everythingShipped();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await bookOpenedBy(t, "U_ALICE");
    await leaderboardReadyFor(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Settings");
    await turn(t, "U_ALICE", label);
    const before = slack.messagesIn("U_ALICE").length;

    await t.run(async (ctx) => {
      const member = await memberIn(ctx, "U_ALICE");
      await notify(ctx, member, notification);
      await setMessageSetting(ctx, member, messageKindOf(label), true);
    });
    await settle(t);

    expect(slack.messagesIn("U_ALICE").length - before).toBe(0);
  });
});

describe("QM13: errors that need action are never silenced", () => {
  test("with every kind turned off, a kudos over the allowance and one naming nobody valid still get their replies", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"], { announcementChannel: "C_NEWS" });
    for (const label of ["After-kudos reply", "Level ups", "Public celebrations"]) await turn(t, "U_ALICE", label);

    await giveKudos(t, "U_ALICE", "U_BOB", 11);
    await giveKudos(t, "U_ALICE", "U_ALICE", 1);

    expect(ephemeralsTo("U_ALICE").slice(-2)).toEqual([
      expect.stringMatching(/^This needs 11 kudos/),
      expect.stringMatching(/^Nobody in this message can receive kudos/),
    ]);
  });
});

describe("QM14: today's settings are read as defaults, and today's switches show and set the effective values", () => {
  test("a member who turned DMs off has the four DM kinds off, with no new setting stored", async () => {
    const t = await everythingShipped();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await bookOpenedBy(t, "U_ALICE");
    await legacySettings(t, "U_ALICE", { dms: false });
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Settings");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(publishedHome(slack, "U_ALICE")).toEqual(expect.arrayContaining([offRows.levelUps, offRows.newFeatures, offRows.quests, offRows.achievements, rows.celebrations]));
    expect(levelUpDmsTo("U_ALICE")).toEqual([]);
    expect(await storedMessageSettings(t)).toEqual([]);
  });

  test("a member who muted public notices has public celebrations off, with no new setting stored", async () => {
    const t = await workspaceWith([messageSettings, "xp-levels"], { announcementChannel: "C_NEWS" });
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await legacySettings(t, "U_ALICE", { muteNotices: true });
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Settings");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(publishedHome(slack, "U_ALICE")).toContain(offRows.celebrations);
    expect(postsIn("C_NEWS")).toEqual([]);
    expect(await storedMessageSettings(t)).toEqual([]);
  });

  test("with the flag turned off after a member turned public celebrations back on, the switch shows them on and Mute notices mutes them", async () => {
    const t = await workspaceWith([messageSettings, "xp-levels"], { announcementChannel: "C_NEWS" });
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await legacySettings(t, "U_ALICE", { muteNotices: true });
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Settings");
    await turn(t, "U_ALICE", "Public celebrations");

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), offForEveryone(messageSettings));
    await openHome(t, "U_ALICE");
    const shownWhileOn = publishedHome(slack, "U_ALICE");
    await click(t, "U_ALICE", "Mute notices");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(shownWhileOn).toContain("section: I celebrate your level ups in public. [button: Mute notices]");
    expect(publishedHome(slack, "U_ALICE")).toContain("section: I don't post public notices about you. [button: Unmute notices]");
    expect(postsIn("C_NEWS")).toEqual([]);
  });

  test("with the flag turned off, Turn off DMs turns every DM kind off, over a level ups setting stored while it was on", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);
    await turn(t, "U_ALICE", "Level ups");
    await turn(t, "U_ALICE", "Level ups");

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), offForEveryone(messageSettings));
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Turn off DMs");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(publishedHome(slack, "U_ALICE")).toContain("section: I don't send you DMs. [button: Turn on DMs]");
    expect(levelUpDmsTo("U_ALICE")).toEqual([]);
  });
});

describe("QM15 QM28: setting a message setting is safe to repeat, and a real change records message setting changed", () => {
  test("Turn off sent twice changes nothing the second time and records one event, and Turn on records the next", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);
    const turnOff = rowButton("U_ALICE", "Level ups");

    await interact(t, "U_ALICE", turnOff);
    await interact(t, "U_ALICE", turnOff);
    await turn(t, "U_ALICE", "Level ups");

    expect(publishedHome(slack, "U_ALICE")).toContain(rows.levelUps);
    expect(settingChanges()).toEqual([
      { kind: "level-ups", on: false },
      { kind: "level-ups", on: true },
    ]);
  });

  test("a setMessageSetting click while message-settings is off for the member changes nothing and records nothing", async () => {
    const t = await workspaceWith(["xp-levels"]);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "level-ups", on: false });
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDmsTo("U_ALICE")).toEqual([levelUpDm]);
    expect(settingChanges()).toEqual([]);
  });

  test("a setMessageSetting click for a kind that doesn't apply to the member changes nothing and records nothing", async () => {
    const t = await settingsOpen([messageSettings]);

    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "level-ups", on: false });

    expect(await storedMessageSettings(t)).toEqual([]);
    expect(settingChanges()).toEqual([]);
  });
});

describe("QM22: the message-settings flag", () => {
  test("a setting stored while the flag was on is honoured after it is turned off", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);
    await turn(t, "U_ALICE", "Level ups");

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), offForEveryone(messageSettings));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDmsTo("U_ALICE")).toEqual([]);
  });

  test("with the flag off, the Settings tab is today's", async () => {
    const t = await settingsOpen(["xp-levels"], { announcementChannel: "C_NEWS" });

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | [Settings]",
      "header: Settings",
      "section: I celebrate your level ups in public. [button: Mute notices]",
      "section: I send you a DM when you reach a level. [button: Turn off DMs]",
    ]);
  });

  test("exposure is sent once per member and value, from App Home", async () => {
    const t = await workspaceWith([messageSettings]);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, offForEveryone(messageSettings));
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([
      [messageSettings, true],
      [messageSettings, false],
    ]);
  });
});

describe("the Settings tab without an announcement channel", () => {
  test("says level ups are celebrated in public only once the workspace picks a channel", async () => {
    await settingsOpen(["xp-levels"]);

    expect(publishedHome(slack, "U_ALICE")).toContain("section: I'll celebrate your level ups in public once your workspace picks a channel. [button: Mute notices]");
  });
});

async function workspaceWith(flags: string[], settings: { announcementChannel?: string } = {}) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags.map(onForEveryone));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, ...settings }));
  return t;
}

async function settingsOpen(flags: string[], settings: { announcementChannel?: string } = {}) {
  const t = await workspaceWith(flags, settings);
  await giveKudos(t, "U_ALICE", "U_BOB", 1);
  await openHome(t, "U_ALICE");
  await click(t, "U_ALICE", "Settings");
  return t;
}

async function everythingShipped() {
  const t = await workspaceWith([messageSettings, "xp-levels", "everyone-board", "unlocks", "quests", "achievements", "skill-tree"]);
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  return t;
}

async function bookOpenedBy(t: Backend, user: string) {
  await t.run(async (ctx) => ctx.db.insert("unlocks", { member: await memberIn(ctx, user), feature: "book", readyAt: Date.now(), openedAt: Date.now() }));
}

async function leaderboardReadyFor(t: Backend, user: string) {
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const row = await ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member).eq("feature", "leaderboard"))
      .unique();
    if (row === null) await ctx.db.insert("unlocks", { member, feature: "leaderboard", readyAt: Date.now() });
    else await ctx.db.replace(row._id, { member, feature: "leaderboard", readyAt: row.readyAt });
  });
}

async function legacySettings(t: Backend, user: string, settings: { dms?: boolean; muteNotices?: boolean }) {
  await t.run(async (ctx) => ctx.db.insert("progressSettings", { member: await memberIn(ctx, user), ...settings }));
}

async function storedMessageSettings(t: Backend) {
  return t.run((ctx) => ctx.db.query("messageSettings").collect());
}

async function deliver(t: Backend, user: string, notification: Notification) {
  const member = await t.run((ctx) => memberIn(ctx, user));
  await t.action(internal.slack.directMessages.deliverDirectMessage, { member, workspace: "T1", user, notification });
  await settle(t);
}

async function memberIn(ctx: QueryCtx, user: string) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  const button = publishedHomeBlocks(slack, user)
    .flatMap((block) => [...(block.type === "actions" ? (block.elements as BlockAction[]) : []), ...(block.accessory ? [block.accessory as BlockAction] : [])])
    .find((element) => "text" in element && (element.text as { text: string }).text === label);
  expect(button, `${label} in ${user}'s App Home`).toBeDefined();
  return interact(t, user, button!);
}

function rowButton(user: string, label: string): BlockAction {
  const row = publishedHomeBlocks(slack, user).find((block) => block.text?.text.startsWith(`*${label}*`));
  expect(row?.accessory, `the ${label} row in ${user}'s App Home`).toBeDefined();
  return row!.accessory as BlockAction;
}

async function turn(t: Backend, user: string, label: string) {
  return interact(t, user, rowButton(user, label));
}

async function command(t: Backend, user: string, value: Record<string, unknown>) {
  const json = JSON.stringify(value);
  return interact(t, user, { type: "button", action_id: json, value: json });
}

async function interact(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
  return response;
}

function messageKindOf(label: string): MessageKind {
  return messageKinds.find((entry) => entry.label === label)!.kind;
}

function levelUpDmsTo(user: string) {
  return slack
    .messagesIn(user)
    .map(({ text }) => String(text))
    .filter((text) => text.startsWith("🎉 You reached level"));
}

function ephemeralsTo(user: string) {
  return slack
    .callsTo("chat.postEphemeral")
    .filter((call) => call.user === user)
    .map(({ text }) => String(text));
}

function postsIn(channel: string) {
  return slack.messagesIn(channel).map(({ text }) => String(text));
}

function settingChanges() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "message setting changed")
    .map(({ properties }) => ({ kind: properties.kind, on: properties.on }));
}

function exposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === messageSettings);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}
