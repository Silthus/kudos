import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor, slackError, type SlackArgs } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonIn, buttonInHome, optionPickedInHome, publishedHome, staleButtonOf, type Block, type BlockAction, type ClickedMessage } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import type { Notification } from "../feedback/notify";
import type { MessageKind, MessagePlace } from "../messageSettings/kinds";
import { setMessageSetting } from "../messageSettings/messageSettings";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const messageSettings = "message-settings";
const footer = "<slack://app?team=T1&id=A_KUDOS&tab=home|Change what I send you> in App Home's Settings tab.";
const levelUp = "🎉 You reached level 2!\nLevel 3 is 80 XP away.";
const givenToBob = "<@U_BOB> got 1 kudos from you.";
const threadRoot = "1760436000.000050";
const refusals = ["user_not_in_channel", "channel_not_found", "not_in_channel"];

const pickers = {
  kudosReply: (place: string) => `section: *After-kudos reply* — What a kudos you gave earned you, right after you send it. [select: ${place}]`,
  levelUps: (place: string) => `section: *Level ups* — When you reach a level, with what it opens for you. [select: ${place}]`,
  celebrations: "section: *Public celebrations* — Your level ups and tiers in the announcement channel. [select: In the announcement channel]",
};

const noKudosBehind: Array<[string, Notification]> = [
  ["a level a reward reaches", { kind: "level-reached", level: 2, skillPoints: null, xpToNextLevel: 80, ready: [] }],
  ["a Journey join", { kind: "journey-joined", finished: [{ quest: { kind: "journey", step: "first-thanks" }, xp: 20 }] }],
  ["a tier summary", { kind: "tiers-earned", tiers: [{ ladder: "generosity", tier: "bronze" }] }],
];

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

describe("QM23: each kind is one choice of place", () => {
  test("the Settings rows pick where each kind arrives, today's place first, and the celebrations stay in the announcement channel", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);

    expect(publishedHome(slack, "U_ALICE").slice(-3)).toEqual([pickers.kudosReply("In the channel"), pickers.levelUps("As a DM"), pickers.celebrations]);
    expect(placesOffered("U_ALICE", "Level ups")).toEqual(["As a DM", "In the channel", "None"]);

    await pick(t, "U_ALICE", "Level ups", "In the channel");
    await pick(t, "U_ALICE", "After-kudos reply", "As a DM");

    expect(publishedHome(slack, "U_ALICE").slice(-3)).toEqual([pickers.kudosReply("As a DM"), pickers.levelUps("In the channel"), pickers.celebrations]);
    expect(settingChanges()).toEqual([
      { kind: "level-ups", on: true, place: "channel" },
      { kind: "kudos-reply", on: true, place: "dm" },
    ]);
  });

  test("picking None turns a kind off, and picking the place it already has changes nothing", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);

    await pick(t, "U_ALICE", "Level ups", "None");
    await pick(t, "U_ALICE", "Level ups", "None");
    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: *Level ups* · Off — When you reach a level, with what it opens for you. [select: None]");
    expect(settingChanges()).toEqual([{ kind: "level-ups", on: false, place: "none" }]);
    expect(levelUpsTo("U_ALICE")).toEqual([]);
  });

  test("a place a kind doesn't offer is refused, and a stale Turn on still sends the kind to its default place", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);

    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "celebrations", place: "dm" });
    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "level-ups", on: false });
    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "level-ups", on: true });

    expect(settingChanges()).toEqual([
      { kind: "level-ups", on: false, place: "none" },
      { kind: "level-ups", on: true, place: "dm" },
    ]);
  });
});

describe("QM23: tips follow their reply", () => {
  test("a stale Turn on for tips, while the reply arrives as a DM, turns tips on beside that DM", async () => {
    const t = await unlocksShippedBeforeAnyoneJoined(await settingsOpen([messageSettings, "xp-levels", "unlocks", "skill-tree"]));

    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "kudos-reply", place: "dm" });
    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "tips", on: false });
    await command(t, "U_ALICE", { type: "setMessageSetting", kind: "tips", on: true });

    expect(settingChanges()).toEqual([
      { kind: "kudos-reply", on: true, place: "dm" },
      { kind: "tips", on: false, place: "none" },
      { kind: "tips", on: true, place: "dm" },
    ]);
    expect(placesOffered("U_ALICE", "Tips")).toEqual(["As a DM", "None"]);
  });
});

describe("R33: replies reach only the giver", () => {
  test("QM23: a Given reply its giver chose as a DM arrives in their DM alone, with its gains line and footer, and no ephemeral", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);
    await pick(t, "U_ALICE", "After-kudos reply", "As a DM");
    const ephemeralsBefore = slack.ephemeralsTo("U_ALICE").length;

    await giveKudos(t, "U_ALICE", "U_BOB");

    const [reply, ...others] = postsTo("U_ALICE").filter((text) => text.startsWith(givenToBob));
    expect(others).toEqual([]);
    expect(reply).toMatch(/^<@U_BOB> got 1 kudos from you\. You have 8 kudos left today\.\n\+\d+ XP/);
    expect(reply!.endsWith(`\n${footer}`)).toBe(true);
    expect(slack.ephemeralsTo("U_ALICE")).toHaveLength(ephemeralsBefore);
    expect(postsTo("U_BOB").filter((text) => text.startsWith(givenToBob))).toEqual([]);
  });
});

describe("QM24: in the channel, beside the kudos message that caused it", () => {
  test("a level up arrives as an ephemeral beside a top-level kudos, with its footer", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"], "U_CAROL");
    await pick(t, "U_ALICE", "Level ups", "In the channel");

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(levelUpsTo("U_ALICE")).toEqual([]);
    expect(levelUpEphemeralsTo("U_ALICE")).toEqual([{ channel: "C1", text: `${levelUp}\n${footer}` }]);
  });

  test("a level up Slack held back as a DM arrives beside its kudos once the member picks In the channel", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"], "U_CAROL");
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await place(t, "U_ALICE", "level-ups", "channel");
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", { threadTs: threadRoot });

    expect(levelUpsTo("U_ALICE")).toHaveLength(1);
    expect(slack.messagesIn("U_ALICE").filter(({ text }) => String(text).startsWith("🎉 You reached level"))).toEqual([]);
    expect(levelUpEphemeralsTo("U_ALICE")).toEqual([{ channel: "C1", thread_ts: threadRoot, text: `${levelUp}\n${footer}` }]);
  });

  test("a level up reached by a kudos in a thread arrives in that thread", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"], "U_CAROL");
    await pick(t, "U_ALICE", "Level ups", "In the channel");

    await giveKudos(t, "U_ALICE", "U_BOB", { threadTs: threadRoot });

    expect(levelUpEphemeralsTo("U_ALICE")).toEqual([{ channel: "C1", thread_ts: threadRoot, text: `${levelUp}\n${footer}` }]);
  });

  test("a tier earned through a kudos arrives beside it", async () => {
    const t = await bookOpenedBy("U_BOB");
    await place(t, "U_BOB", "achievements", "channel");

    await giveKudos(t, "U_ALICE", "U_BOB", { threadTs: threadRoot });

    const tiers = slack.ephemeralsTo("U_BOB").filter(({ text }) => String(text).startsWith("🏅"));
    expect(tiers.map(({ channel, thread_ts, text }) => ({ channel, thread_ts, text }))).toEqual([
      { channel: "C1", thread_ts: threadRoot, text: `🏅 You earned Noticed (Recognition, bronze).\nNext: Appreciated at 25 kudos received.\n${footer}` },
    ]);
    expect(postsTo("U_BOB").filter((text) => text.startsWith("🏅"))).toEqual([]);
  });

  test("a weekly quest finished by a kudos arrives beside it, and the Journey step it finishes too", async () => {
    const t = await questsOpenedBy("U_ALICE");
    await place(t, "U_ALICE", "quests", "channel");
    const before = slack.ephemeralsTo("U_ALICE").length;

    await giveKudos(t, "U_ALICE", "U_BOB", { words: "thanks for untangling the release notes today" });

    const crates = slack.ephemeralsTo("U_ALICE").slice(before).filter(({ text }) => String(text).startsWith("✅"));
    expect(crates.map(({ channel }) => channel)).toEqual(["C1", "C1"]);
    expect(postsTo("U_ALICE").filter((text) => text.startsWith("✅"))).toEqual([]);
  });
});

describe("QM25: when in-channel can't be, it arrives as a DM", () => {
  test.each(noKudosBehind)("a DM job with no kudos message behind it, as %s schedules, arrives as a DM", async (_, notification) => {
    const t = await everythingOpen();
    for (const kind of ["level-ups", "quests", "achievements"] as const) await place(t, "U_ALICE", kind, "channel");
    const [ephemerals, dms] = [slack.ephemeralsTo("U_ALICE").length, postsTo("U_ALICE").length];

    await deliver(t, "U_ALICE", notification);

    expect(slack.ephemeralsTo("U_ALICE")).toHaveLength(ephemerals);
    expect(postsTo("U_ALICE")).toHaveLength(dms + 1);
  });

  test.each(refusals)("Slack refusing the ephemeral with %s sends the same lines as a DM, once", async (error) => {
    const t = await settingsOpen([messageSettings, "xp-levels"], "U_CAROL");
    await pick(t, "U_ALICE", "Level ups", "In the channel");
    await pick(t, "U_ALICE", "After-kudos reply", "As a DM");
    slack.answering("chat.postEphemeral", slackError(error));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(levelUpsTo("U_ALICE")).toEqual([`${levelUp}\n${footer}`]);
    expect(levelUpEphemeralsTo("U_ALICE")).toHaveLength(1);
  });

  test.each([
    ["user_not_in_channel", 3],
    ["channel_not_found", 1],
    ["not_in_channel", 1],
  ])("the success reply refused with %s is tried %i times, as today, and never sent as a DM", async (error, tries) => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);
    const before = slack.ephemeralsTo("U_ALICE").length;
    slack.answering("chat.postEphemeral", ...Array.from({ length: tries }, () => slackError(error)));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(slack.ephemeralsTo("U_ALICE").slice(before).filter(({ text }) => String(text).startsWith(givenToBob))).toHaveLength(tries);
    expect(postsTo("U_ALICE").filter((text) => text.startsWith(givenToBob))).toEqual([]);
  });
});

describe("QM16: a message a member turned off is never sent", () => {
  test("a level up beside a kudos whose member has since picked None is withheld, not sent as a DM", async () => {
    const t = await settingsOpen([messageSettings, "xp-levels"]);
    await place(t, "U_ALICE", "level-ups", "none");
    const member = await t.run((ctx) => memberIn(ctx, "U_ALICE"));

    const destination = await t.query(internal.feedback.beside.placeBesideTheKudos, {
      member,
      notification: { kind: "level-reached", level: 2, skillPoints: null, xpToNextLevel: 80, ready: [] },
      kudos: { workspace: "T1", conversation: "C1", message: "1760436000.000100" },
    });

    expect(destination).toBe("none");
  });
});

describe("QM30: a member who never chose a place leaves main's shapes behind", () => {
  test("today's DM switch stores no place, and a level up's DM job carries no kudos", async () => {
    const t = await settingsOpen(["xp-levels"]);
    await command(t, "U_ALICE", { type: "setProgressSettings", dms: false });
    await command(t, "U_ALICE", { type: "setProgressSettings", dms: true });

    await giveKudos(t, "U_ALICE", "U_BOB");

    const rows = await t.run((ctx) => ctx.db.query("messageSettings").collect());
    expect(rows.map(({ kind, on, ...rest }) => ({ kind, on, stored: Object.keys(rest).sort() }))).toEqual(
      ["level-ups", "new-features", "quests", "achievements"].map((kind) => ({ kind, on: true, stored: ["_creationTime", "_id", "member"] })),
    );
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const levelUpJobs = jobs.filter(({ name, args }) => name.includes("deliverDirectMessage") && (args[0] as { notification: Notification }).notification.kind === "level-reached");
    expect(levelUpJobs.map(({ args }) => Object.keys(args[0] as object).sort())).toEqual([["member", "notification", "user", "workspace"]]);
    expect(levelUpsTo("U_ALICE")).toHaveLength(1);
  });
});

describe("QM26: a Buy never answers in public", () => {
  test("a Buy clicked in an in-channel level up is answered as an ephemeral to the clicker, never posted to the channel", async () => {
    const t = await skillTreeOpenAtLevelFive("U_ALICE");
    await place(t, "U_ALICE", "level-ups", "channel");
    await reachLevelSix(t, "U_ALICE");

    await clickIn(t, "U_ALICE", buyButtonIn(lastLevelUpEphemeral("U_ALICE"), "rhythm"), { channel: "C1", ts: "1760349700.000100", ephemeral: true, threadTs: threadRoot });

    expect(slack.ephemeralsTo("U_ALICE").at(-1)).toMatchObject({ channel: "C1", user: "U_ALICE", thread_ts: threadRoot, text: "You bought Rhythm." });
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toEqual([]);
  });

  test("when Slack refuses that ephemeral, the answer goes to the clicker's DM", async () => {
    const t = await skillTreeOpenAtLevelFive("U_ALICE");
    await place(t, "U_ALICE", "level-ups", "channel");
    await reachLevelSix(t, "U_ALICE");
    slack.answering("chat.postEphemeral", slackError("channel_not_found"));

    await clickIn(t, "U_ALICE", buyButtonIn(lastLevelUpEphemeral("U_ALICE"), "rhythm"), { channel: "C1", ts: "1760349700.000100", ephemeral: true });

    expect(postsTo("U_ALICE")).toContain("You bought Rhythm.");
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toEqual([]);
  });

  test("a Buy clicked in a DM answers in the DM, as today", async () => {
    const t = await skillTreeOpenAtLevelFive("U_ALICE");
    await reachLevelSix(t, "U_ALICE");

    await clickIn(t, "U_ALICE", buyButtonIn(lastLevelUpDm("U_ALICE"), "rhythm"), { channel: "D_ALICE", ts: "1760349700.000200" });

    expect(slack.messagesIn("D_ALICE").map(({ text }) => text)).toEqual(["You bought Rhythm."]);
  });
});

async function workspaceWith(flags: string[]) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags.map(onForEveryone));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function settingsOpen(flags: string[], firstThanked = "U_BOB") {
  const t = await workspaceWith(flags);
  slack.withMember("U_CAROL");
  await giveKudos(t, "U_ALICE", firstThanked);
  await openHome(t, "U_ALICE");
  await clickHome(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Settings"));
  return t;
}

async function everythingOpen() {
  const t = await workspaceWith([messageSettings, "xp-levels", "unlocks", "quests", "achievements"]);
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  await giveKudos(t, "U_ALICE", "U_BOB");
  await bookOpened(t, "U_ALICE");
  return t;
}

async function bookOpenedBy(user: string) {
  const t = await workspaceWith([messageSettings, "xp-levels", "unlocks", "achievements"]);
  await bookShippedBeforeAnyoneJoined(t);
  slack.withMember("U_CAROL");
  await giveKudos(t, user, "U_CAROL");
  await bookOpened(t, user);
  return t;
}

async function bookOpened(t: Backend, user: string) {
  await t.run(async (ctx) => ctx.db.insert("unlocks", { member: await memberIn(ctx, user), feature: "book", readyAt: Date.now(), openedAt: Date.now() }));
}

async function questsOpenedBy(user: string) {
  const t = await unlocksShippedBeforeAnyoneJoined(await workspaceWith([messageSettings, "xp-levels", "unlocks", "quests"]));
  slack.withMember("U_CAROL");
  await giveKudos(t, user, "U_CAROL");
  const member = await t.run((ctx) => memberIn(ctx, user));
  const drawn = { reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 2, recognitionsLeft: 18 } };
  const slots = (["say-why", "say-why-three-times", "say-why-three-days"] as const).map((quest, slot) => ({ slot, quest, ...drawn }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: Date.now(), slots }));
  await openUnlock(t, user, "quests");
  vi.setSystemTime(Date.now() + 60 * 60 * 1000);
  return t;
}

async function skillTreeOpenAtLevelFive(user: string) {
  const t = await unlocksShippedBeforeAnyoneJoined(await workspaceWith([messageSettings, "xp-levels", "unlocks", "skill-tree"]));
  await giveKudos(t, user, "U_BOB");
  await withXp(t, user, 590);
  await giveKudos(t, user, "U_BOB");
  await openHome(t, user);
  await clickHome(t, user, buttonInHome(slack, user, "Open"));
  return t;
}

async function reachLevelSix(t: Backend, user: string) {
  await withXp(t, user, 990);
  await giveKudos(t, user, "U_BOB");
}

async function withXp(t: Backend, user: string, xp: number) {
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function openUnlock(t: Backend, user: string, feature: "quests") {
  await clickHome(t, user, staleButtonOf({ type: "openUnlock", feature }));
}

async function place(t: Backend, user: string, kind: MessageKind, where: MessagePlace) {
  await t.run(async (ctx) => {
    await setMessageSetting(ctx, await memberIn(ctx, user), kind, where);
  });
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

async function giveKudos(t: Backend, giver: string, recipient: string, { threadTs, words }: { threadTs?: string; words?: string } = {}) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...(words === undefined ? [] : [text(` ${words} `)]), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100`, ...(threadTs && { threadTs }) })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function pick(t: Backend, user: string, row: string, option: string) {
  await clickHome(t, user, optionPickedInHome(slack, user, row, option));
}

async function command(t: Backend, user: string, value: Record<string, unknown>) {
  await clickHome(t, user, staleButtonOf(value));
}

async function clickHome(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  expect(response.status).toBe(200);
  await settle(t);
}

async function clickIn(t: Backend, user: string, action: BlockAction, inMessage: ClickedMessage) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action, { inMessage }), form));
  expect(response.status).toBe(200);
  await settle(t);
}

function placesOffered(user: string, row: string) {
  const block = (slack.homeShownTo(user) as { blocks: Block[] }).blocks.find((candidate) => candidate.text?.text.startsWith(`*${row}*`));
  return (block?.accessory as { options?: Array<{ text: { text: string } }> } | undefined)?.options?.map(({ text }) => text.text);
}

function postsTo(user: string) {
  return slack.callsTo("chat.postMessage").filter(({ channel }) => channel === user).map(({ text }) => String(text));
}

function levelUpsTo(user: string) {
  return postsTo(user).filter((text) => text.startsWith("🎉 You reached level"));
}

function levelUpEphemeralsTo(user: string) {
  return slack
    .ephemeralsTo(user)
    .filter(({ text }) => String(text).startsWith("🎉 You reached level"))
    .map(({ channel, thread_ts, text }) => ({ channel, ...(thread_ts !== undefined && { thread_ts }), text }));
}

function lastLevelUpEphemeral(user: string) {
  return lastOf(slack.ephemeralsTo(user), user, "ephemeral");
}

function lastLevelUpDm(user: string) {
  return lastOf(
    slack.callsTo("chat.postMessage").filter(({ channel }) => channel === user),
    user,
    "DM",
  );
}

function lastOf(calls: SlackArgs[], user: string, what: string) {
  const call = calls.filter(({ text }) => String(text).startsWith("🎉 You reached level 6")).at(-1);
  expect(call, `a level-up ${what} to ${user}`).toBeDefined();
  return call!;
}

function buyButtonIn(message: SlackArgs, perk: string): BlockAction {
  const blocks = message.blocks as Block[];
  const block = blocks.find((candidate) => candidate.accessory?.value !== undefined && JSON.parse(candidate.accessory.value).perk === perk);
  expect(block, `a Buy button for ${perk}`).toBeDefined();
  return buttonIn([block!], "Buy");
}

function settingChanges() {
  return postHog
    .productEvents()
    .filter(({ event }) => event === "message setting changed")
    .map(({ properties }) => ({ kind: properties.kind, on: properties.on, place: properties.place }));
}
