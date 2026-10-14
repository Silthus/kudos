import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, onInTheSandboxOnly, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { publish } from "../bus/publish";
import { replyPrivately } from "../feedback/replies";
import { questsLiveIn } from "../quests/flag";
import type { QuestId } from "../quests/pool";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const thisWeek = "2026-10-12";
const saysWhy = "thanks for untangling the release notes today";
const thoughtful = { gate: { version: 1, thoughtful: true, words: 7 } };
const form = { contentType: "application/x-www-form-urlencoded" };
const quests = "quests";
const todaysReplies = [["<@U_BOB> got 1 kudos from you. You have 9 kudos left today."], ["<@U_BOB> got 1 kudos from you. You have 8 kudos left today."]];
const questTables = ["journeyLaunches", "journeySteps", "rewardRecords", "questDraws", "questSwaps", "questProgress", "crateOpenings"] as const;

type SliceTurnedOff = { reason: string; flags: FlagDefinition[] };

const sliceTurnedOff: SliceTurnedOff[] = [
  { reason: "quests turned off", flags: [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(quests)] },
  { reason: "unlocks turned off", flags: [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(quests)] },
  { reason: "xp-levels turned off", flags: [offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(quests)] },
];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the slice applies only where quests, xp-levels and unlocks all apply", () => {
  test.each<[string, () => Promise<Backend>]>([
    ["quests turned off", () => launchedWorkspaceDeciding("sandbox", onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(quests))],
    ["quests not created in PostHog", () => launchedWorkspaceDeciding("sandbox", onForEveryone("xp-levels"), onForEveryone("unlocks"))],
    ["the flags key missing", () => flagsKeyMissing(launchedWorkspaceDeciding("sandbox", ...allOn()))],
    ["quests on but unlocks off", () => workspaceDeciding("sandbox", onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(quests))],
    ["quests on but xp-levels off", () => launchedWorkspaceDeciding("sandbox", offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(quests))],
    ["all three on in the sandbox only, read in production", () => workspaceDeciding("production", ...["xp-levels", "unlocks", quests].map(onInTheSandboxOnly))],
  ])("%s: kudos that say why get today's success reply at once, and no DM, App Home, sweep or record names a quest or the Journey", async (_, workspace) => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await sendKudos(t, "U_ALICE", "U_BOB", saysWhy);
    const deliveredByTheKudos = await pendingDeliveries(t);
    await settleInTimeOrder(t);
    await openHome(t, "U_ALICE");
    await openHome(t, "U_BOB");
    await sweeps(t);

    expect(deliveredByTheKudos).toEqual(["slack/delivery:deliverPrivateReply"]);
    expect(successRepliesTo("U_ALICE")).toEqual(todaysReplies);
    expect([...everyDmLine(), ...publishedHome(slack, "U_ALICE"), ...publishedHome(slack, "U_BOB")].filter(namesTheSlice)).toEqual([]);
    expect(await questRows(t)).toEqual(nothingRecorded());
    expect(exposures()).not.toContainEqual([quests, true]);
  });

  test.each(sliceTurnedOff)("$reason before Slack took a success reply that named a quest: the reply that goes out is today's", async ({ flags }) => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    await openedQuests(t, "U_ALICE", ["say-why", "say-why-twice", "say-why-three-times"]);
    slack.holdingBack("chat.postEphemeral", "U_ALICE", async () => {
      await flagsFromPostHog(t, postHog, ...flags);
      slack.answering("chat.postEphemeral", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);

    expect((await questRows(t)).rewardRecords).toContainEqual({ user: "U_ALICE", key: `weekly:${thisWeek}:0` });
    expect(successRepliesTo("U_ALICE").at(-1)).toEqual(["<@U_CAROL> got 1 kudos from you. You have 8 kudos left today."]);
  });

  test("in a workspace Unlocks hasn't launched yet, a kudos that says why records nothing for Quests and ships no Journey", async () => {
    const t = await workspaceDeciding("sandbox", ...allOn());
    const { alice, bob } = await membersInserted(t);
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: thoughtful, at: now.getTime() }));

    await t.mutation(internal.quests.quests.followKudosGiven, { event });

    expect(await questRows(t)).toEqual(nothingRecorded());
  });
});

describe("a stale button from when the slice applied writes nothing and publishes nothing", () => {
  test.each(sliceTurnedOff)("$reason: Open on a finished Journey step's DM, Swap on App Home and Open on the Quests crate change nothing", async ({ flags }) => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    await giveKudos(t, "U_BOB", "U_ALICE", saysWhy);
    await openHome(t, "U_BOB");
    const openQuests = buttonBeside(publishedHomeBlocks(slack, "U_BOB"), "*Quests* is ready", "Open");
    const openFirstThanks = buttonIn(questDmsTo("U_BOB")[0]!.blocks as Block[], "Open");
    const swap = await openedQuests(t, "U_ALICE", ["say-why", "say-why-twice", "say-why-three-times"]);
    const stored = await questRows(t);
    const openedBefore = await questsOpenedBy(t);
    vi.mocked(publish).mockClear();
    await flagsFromPostHog(t, postHog, ...flags);

    const responses = [
      await send(t, blockActions("U_BOB", openFirstThanks, { inMessage: { channel: "U_BOB", ts: "1760349700.000100" } })),
      await send(t, blockActions("U_ALICE", swap)),
      await send(t, blockActions("U_BOB", openQuests)),
    ];

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
    expect(stored.rewardRecords).toEqual([{ user: "U_ALICE", key: "journey:first-thanks" }, { user: "U_BOB", key: "journey:first-thanks" }]);
    expect(await questRows(t)).toEqual(stored);
    expect(await questsOpenedBy(t)).toEqual(openedBefore);
    expect(publishedTypes()).toEqual([]);
    expect([...publishedHome(slack, "U_ALICE"), ...publishedHome(slack, "U_BOB")].filter(namesTheSlice)).toEqual([]);
  });
});

describe("O35: turning the slice off and on again loses nothing", () => {
  test.each(sliceTurnedOff)("$reason hides the Journey, the week's quests and their crates and rewrites no record; turning it back on shows them unchanged, with the Journey joined once", async ({ flags }) => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    await openedQuests(t, "U_ALICE", ["say-why", "say-why-twice", "say-why-three-times"]);
    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);
    await send(t, blockActions("U_ALICE", buttonIn(weeklyQuestDmsTo("U_ALICE")[0]!.blocks as Block[], "Open"), { inMessage: { channel: "U_ALICE", ts: "1760349800.000100" } }));
    await openHome(t, "U_ALICE");
    const stored = await questRows(t);
    const shown = publishedHome(slack, "U_ALICE");
    const dms = questDmsTo("U_ALICE").length;

    await flagsFromPostHog(t, postHog, ...flags);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    await sweeps(t);
    const whileOff = publishedHome(slack, "U_ALICE");
    const storedWhileOff = await questRows(t);
    await flagsFromPostHog(t, postHog, ...allOn());
    await openHome(t, "U_ALICE");

    expect(shown.filter(namesTheSlice).length).toBeGreaterThan(0);
    expect(stored.crateOpenings).toEqual([{ user: "U_ALICE", key: `weekly:${thisWeek}:0` }]);
    expect(whileOff.filter(namesTheSlice)).toEqual([]);
    expect(storedWhileOff).toEqual(stored);
    expect(await questRows(t)).toEqual(stored);
    expect(publishedHome(slack, "U_ALICE").filter(namesTheSlice)).toEqual(shown.filter(namesTheSlice));
    expect(questDmsTo("U_ALICE")).toHaveLength(dms);
  });
});

describe("P88 O35: a feature opened while quests is off", () => {
  test("activates its Journey step once quests is back, counting from then", async () => {
    const withBoard = [...allOn(), onForEveryone("everyone-board")];
    const t = await launchedWorkspaceDeciding("sandbox", ...withBoard);
    await t.run((ctx) => questsLiveIn(ctx, "T1"));
    await openHome(t, "U_BOB");
    await openHome(t, "U_ALICE");
    await t.run(async (ctx) => {
      const alice = (await ctx.db.query("members").collect()).find((row) => row.user === "U_ALICE")!._id;
      await ctx.db.insert("unlocks", { member: alice, feature: "leaderboard", readyAt: Date.now() });
    });
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(quests), onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonBeside(publishedHomeBlocks(slack, "U_ALICE"), "*Leaderboard* is ready", "Open")));

    await flagsFromPostHog(t, postHog, ...withBoard);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: *Journey:* Thank someone you haven't thanked before. It pays *30 XP*.");
  });
});

describe("P91 O35: the Journey's join belongs to its ship moment", () => {
  test("a join that runs after quests turned off again still joins as of the moment; nothing is sent or shown while quests is off, and the finished step is there once it's back", async () => {
    const questsOff = [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(quests)];
    const t = await launchedWorkspaceDeciding("sandbox", ...questsOff);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await flagsFromPostHog(t, postHog, ...allOn());
    await t.run((ctx) => questsLiveIn(ctx, "T1"));
    await flagsFromPostHog(t, postHog, ...questsOff);

    await settle(t);
    await openHome(t, "U_ALICE");
    const whileOff = { home: publishedHome(slack, "U_ALICE"), stored: await questRows(t) };
    await flagsFromPostHog(t, postHog, ...allOn());
    await openHome(t, "U_ALICE");

    expect(whileOff.stored.journeyLaunches).toHaveLength(1);
    expect(whileOff.stored.rewardRecords).toEqual([{ user: "U_ALICE", key: "journey:first-thanks" }]);
    expect(whileOff.home.filter(namesTheSlice)).toEqual([]);
    expect(questDmsTo("U_ALICE")).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*. [button: Open]");
    expect(await questRows(t)).toEqual(whileOff.stored);
  });
});

describe("O36: quests exposure", () => {
  test("is sent from the kudos' own mutation, with the value that decided whether its success reply waits for Quests", async () => {
    const t = await launchedWorkspaceDeciding("sandbox", onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(quests));
    const { alice } = await membersInserted(t);
    const ref = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };

    await t.run((ctx) => replyPrivately(ctx, ref, undefined, "U_ALICE", { kind: "given", outcome: { recipients: ["U_BOB"], perRecipient: 1, left: 9, skipped: [] }, base: 10 }));

    expect(await exposedIn(t)).toEqual([{ member: alice, flag: quests, value: false }]);
  });

  test("is sent once per member and value, from the App Home opening", async () => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(quests));
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([
      [quests, true],
      [quests, false],
    ]);
  });

  test("is sent for a giver whose App Home was never published, from Quests' kudosGiven subscriber", async () => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    const { alice, bob } = await membersInserted(t);
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: thoughtful, at: now.getTime() }));

    await t.mutation(internal.quests.quests.followKudosGiven, { event });
    await t.mutation(internal.quests.quests.followKudosGiven, { event });

    expect(await exposedIn(t)).toEqual([{ member: alice, flag: quests, value: true }]);
  });

  test.each([
    ["xp-levels is off", [offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(quests)]],
    ["unlocks is off", [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(quests)]],
  ])("is never sent while %s, since quests then decides nothing", async (_, flags) => {
    const t = await launchedWorkspaceDeciding("sandbox", ...flags);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([]);
  });
});

function allOn() {
  return [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(quests)];
}

async function workspaceDeciding(environment: "sandbox" | "production", ...definitions: FlagDefinition[]) {
  postHog = postHogDeciding(environment);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return flagsFromPostHog(t, postHog, ...definitions);
}

async function launchedWorkspaceDeciding(environment: "sandbox" | "production", ...definitions: FlagDefinition[]) {
  return unlocksShippedBeforeAnyoneJoined(await workspaceDeciding(environment, ...definitions));
}

async function membersInserted(t: Backend) {
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  return { alice: alice!, bob: bob! };
}

async function flagsKeyMissing(workspace: Promise<Backend>) {
  const t = await workspace;
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  return t;
}

async function openedQuests(t: Backend, user: string, drawn: QuestId[]) {
  await giveKudos(t, user, "U_BOB", saysWhy);
  await openHome(t, user);
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    const slots = drawn.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 2, recognitionsLeft: 18 } }));
    await ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots });
  });
  await send(t, blockActions(user, buttonBeside(publishedHomeBlocks(slack, user), "*Quests* is ready", "Open")));
  return buttonIn(publishedHomeBlocks(slack, user), "Swap");
}

async function sweeps(t: Backend) {
  await t.mutation(internal.quests.newWeek.sweep, {});
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
}

function buttonBeside(blocks: Block[], beside: string, label: string) {
  return buttonIn(
    blocks.filter((block) => readBlocks([block])[0]!.includes(beside)),
    label,
  );
}

function namesTheSlice(line: string) {
  return /Quest|quest|Journey|Swap/.test(line);
}

function nothingRecorded() {
  return Object.fromEntries(questTables.map((table) => [table, []]));
}

async function questRows(t: Backend) {
  return t.run(async (ctx) => {
    const userOf = async (member: unknown) => (member === undefined ? null : (await ctx.db.get(member as never) as { user: string } | null)?.user);
    const rows: Record<string, unknown[]> = {};
    for (const table of questTables) {
      const stored = await ctx.db.query(table).collect();
      const read = await Promise.all(
        stored.map(async (row) => {
          const { _id, _creationTime, member, ...rest } = row as Record<string, unknown>;
          return table === "rewardRecords" || table === "crateOpenings" ? { user: await userOf(member), key: rest.key } : { user: await userOf(member), ...rest };
        }),
      );
      rows[table] = read.sort((one, other) => JSON.stringify(one).localeCompare(JSON.stringify(other)));
    }
    return rows;
  });
}

async function questsOpenedBy(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("unlocks").collect()).filter(({ feature }) => feature === "quests").map(({ member, readyAt, openedAt }) => ({ member, readyAt, openedAt })));
}

function publishedTypes() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event.type).filter((type) => type === "questOpened" || type === "questFinished" || type === "unlockOpened");
}

async function exposedIn(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === quests).map(({ member, flag, value }) => ({ member, flag, value })));
}

function exposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === quests);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}

type PostedDm = Record<string, unknown>;

function sentDms(): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => String(channel).startsWith("U_") && !String(text).startsWith("👋 Welcome"));
}

function everyDmLine() {
  return sentDms().flatMap((dm) => (dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(dm.blocks as Block[])));
}

function questDmsTo(user: string) {
  return sentDms().filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished"));
}

function weeklyQuestDmsTo(user: string) {
  return questDmsTo(user).filter(({ text }) => String(text).startsWith("✅ You finished a quest"));
}

function successRepliesTo(user: string) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n"));
}

async function pendingDeliveries(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name, state }) => name.startsWith("slack/delivery:deliverPrivate") && state.kind === "pending").map(({ name }) => name);
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  await sendKudos(t, giver, recipient, words);
  await settleInTimeOrder(t);
}

async function sendKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}
