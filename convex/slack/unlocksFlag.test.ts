import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, onInTheSandboxOnly, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, readBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const firstMessageAt = now.getTime() + 1000;
const form = { contentType: "application/x-www-form-urlencoded" };
const unlocks = "unlocks";
const leaderboardReady = "section: *Leaderboard* is ready. It opens the boards. [button: Open]";
const skillTreeReady = "section: *Skill tree* is ready. It opens the tree and your first skill point. [button: Open]";
const everyoneBoardTabs = "actions: [Profile] | Leaderboard | Settings";
const levelTwoDm = ["🎉 You reached level 2!", "Level 3 is 80 XP away."];
const levelThreeDm = ["🎉 You reached level 3!", "Level 4 is 200 XP away."];

type Turned = "on" | "off";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
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

describe("the unlocks slice is dark while unlocks is off", () => {
  test.each<[string, () => Promise<Backend>]>([
    ["turned off in PostHog", () => workspaceDeciding("sandbox", ...beside(offForEveryone(unlocks)))],
    ["not created in PostHog", () => workspaceDeciding("sandbox", ...beside())],
    ["on in the sandbox only, read in production", () => workspaceDeciding("production", ...beside(onInTheSandboxOnly(unlocks)))],
  ])("%s: the Everyone board is shown as it was built, the level-up DMs are #80's, and nothing is ready, opened or next", async (_, workspace) => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const atLevelTwo = await leaderboardCommand(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    const homeAtLevelTwo = publishedHome(slack, "U_ALICE");
    await giveKudos(t, "U_ALICE", "U_BOB", 8);
    await openHome(t, "U_ALICE");

    expect(rowsOf(atLevelTwo.text)).toEqual(["🥇 <@U_ALICE> · 2 kudos"]);
    expect(homeAtLevelTwo[0]).toBe(everyoneBoardTabs);
    expect(publishedHome(slack, "U_ALICE")[0]).toBe(everyoneBoardTabs);
    expect(dmsTo("U_ALICE").map(readDm)).toEqual([levelTwoDm, levelThreeDm]);
    expect([...homeAtLevelTwo, ...publishedHome(slack, "U_ALICE")].filter(namesAnUnlock)).toEqual([]);
  });

  test("with the flags key missing, App Home is the core loop's and nothing names a feature", async () => {
    const t = await workspaceDeciding("sandbox", ...beside(onForEveryone(unlocks)));
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");

    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").filter((line) => line.startsWith("actions:") || namesAnUnlock(line))).toEqual([]);
    expect(dmsTo("U_ALICE")).toEqual([]);
  });

  test("XP and levels are told as #80 ships them: level 5 names the skill points saved for the skill tree, and no crate", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone("xp-levels"), onForEveryone("skill-tree"), offForEveryone(unlocks));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await xpOf(t, "U_ALICE", 590);

    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    expect(dmsTo("U_ALICE").map(readDm).at(-1)).toEqual(["🎉 You reached level 5! You have 1 skill point saved for the skill tree.", "Level 6 is 400 XP away."]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: You have *1 skill point* saved for the skill tree.");
    expect(publishedHome(slack, "U_ALICE").filter(namesAnUnlock)).toEqual([]);
  });

  test("a level-up DM Slack held back while unlocks was on is told as #80 tells it once unlocks is off: the saved skill points, and no crate", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone("xp-levels"), onForEveryone("skill-tree"), onForEveryone(unlocks));
    await unlocksShippedBeforeAnyoneJoined(t);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await xpOf(t, "U_ALICE", 590);
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("skill-tree"), offForEveryone(unlocks));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(dmsTo("U_ALICE").map(readDm).at(-1)).toEqual(["🎉 You reached level 5! You have 1 skill point saved for the skill tree.", "Level 6 is 400 XP away."]);
  });

  test("a stale Open from the level-up DM, clicked while unlocks is off, opens nothing, and the readiness already stored survives", async () => {
    const t = await workspaceShippedBeforeAnyoneJoined();
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    const openInDm = blockActions("U_ALICE", openButtonIn(dmsTo("U_ALICE").at(-1)!), { inMessage: { channel: "U_ALICE", ts: "1760349700.000100" } });
    const stored = await unlockRows(t);
    await unlocksTurned(t, "off");

    const response = await send(t, openInDm);

    expect(response.status).toBe(200);
    expect(stored).toEqual([{ user: "U_ALICE", feature: "leaderboard", readyAt: firstMessageAt }]);
    expect(await unlockRows(t)).toEqual(stored);
    expect(publishedHome(slack, "U_ALICE")[0]).toBe(everyoneBoardTabs);
    expect(publishedHome(slack, "U_ALICE").filter(namesAnUnlock)).toEqual([]);
  });

  test("O35: turning unlocks off hides what is ready and opened and rewrites nothing, and turning it on again shows it all unchanged", async () => {
    const t = await workspaceShippedBeforeAnyoneJoined();
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await giveKudos(t, "U_BOB", "U_ALICE", 10);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", openButtonIn(homeBlocksOf("U_ALICE"))));
    await openHome(t, "U_BOB");
    const stored = await unlockRows(t);
    const shown = { alice: publishedHome(slack, "U_ALICE"), bob: publishedHome(slack, "U_BOB") };

    await unlocksTurned(t, "off");
    await openHome(t, "U_ALICE");
    await openHome(t, "U_BOB");
    const whileOff = publishedHome(slack, "U_BOB");
    await unlocksTurned(t, "on");
    await openHome(t, "U_ALICE");
    await openHome(t, "U_BOB");

    expect(stored).toEqual([
      { user: "U_ALICE", feature: "leaderboard", readyAt: firstMessageAt, openedAt: expect.any(Number) },
      { user: "U_BOB", feature: "leaderboard", readyAt: firstMessageAt + 1000 },
    ]);
    expect(shown.bob).toContain(leaderboardReady);
    expect(whileOff[0]).toBe(everyoneBoardTabs);
    expect(whileOff.filter(namesAnUnlock)).toEqual([]);
    expect(await unlockRows(t)).toEqual(stored);
    expect({ alice: publishedHome(slack, "U_ALICE"), bob: publishedHome(slack, "U_BOB") }).toEqual(shown);
  });
});

describe("P77: unlocks launch once per workspace, opening what had shipped for every member who existed then", () => {
  test("the first mutation that sees unlocks on opens the Leaderboard, at that moment, for every member at any level, and DMs nobody about it", async () => {
    const t = await workspaceDeciding("sandbox", ...beside(offForEveryone(unlocks)));
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    const dmsBefore = sentDms();
    const firstOn = now.getTime() + 60_000;
    vi.setSystemTime(firstOn);
    await unlocksTurned(t, "on");

    await openHome(t, "U_BOB");
    const aliceReply = await leaderboardCommand(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    const moment = await launchMoment(t);
    expect(moment).toBeGreaterThanOrEqual(firstOn);
    expect(await unlockRows(t)).toEqual([
      { user: "U_ALICE", feature: "leaderboard", readyAt: firstMessageAt, openedAt: moment },
      { user: "U_BOB", feature: "leaderboard", readyAt: moment, openedAt: moment },
    ]);
    expect(sentDms()).toEqual(dmsBefore);
    expect(publishedHome(slack, "U_BOB")[0]).toBe(everyoneBoardTabs);
    expect(publishedHome(slack, "U_ALICE").filter(namesAnUnlock)).toEqual([]);
    expect(rowsOf(aliceReply.text)).toEqual(["🥇 <@U_ALICE> · 10 kudos"]);
  });

  test("a member who joins afterwards follows the schedule: told the Leaderboard opens at level 3, then sent it ready with Open", async () => {
    const t = await workspaceDeciding("sandbox", ...beside(offForEveryone(unlocks)));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await unlocksTurned(t, "on");
    await openHome(t, "U_ALICE");

    await giveKudos(t, "U_CAROL", "U_ALICE", 2);
    const atLevelTwo = await leaderboardCommand(t, "U_CAROL");
    await giveKudos(t, "U_CAROL", "U_ALICE", 8);

    expect(atLevelTwo).toEqual({ response_type: "ephemeral", text: "Leaderboard opens at level 3." });
    expect(dmsTo("U_CAROL").map(readDm).at(-1)).toEqual(["section: 🎉 You reached level 3!", "section: Level 4 is 200 XP away.", leaderboardReady]);
  });

  test("turning unlocks off and on again moves neither the moment nor the snapshot: a member who joined in between follows the schedule", async () => {
    const t = await workspaceDeciding("sandbox", ...beside(offForEveryone(unlocks)));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await unlocksTurned(t, "on");
    await openHome(t, "U_ALICE");
    const launched = await unlockRows(t);
    await unlocksTurned(t, "off");
    vi.setSystemTime(now.getTime() + 60_000);
    await giveKudos(t, "U_CAROL", "U_ALICE", 2);

    await unlocksTurned(t, "on");
    await openHome(t, "U_CAROL");
    const carolReply = await leaderboardCommand(t, "U_CAROL");

    expect(await unlockRows(t)).toEqual(launched);
    expect(carolReply).toEqual({ response_type: "ephemeral", text: "Leaderboard opens at level 3." });
    expect(publishedHome(slack, "U_CAROL")).toContain("section: Next: Leaderboard at level 3.");
  });

  test("P78: a feature that ships after the moment becomes ready with one DM, also for a member who existed before it", async () => {
    const t = await workspaceDeciding("sandbox", ...beside(offForEveryone(unlocks)));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await xpOf(t, "U_ALICE", 600);
    await unlocksTurned(t, "on");
    await openHome(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...beside(onForEveryone(unlocks)), onForEveryone("skill-tree"));
    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settle(t);

    expect(dmsTo("U_ALICE").map(readDm).at(-1)).toEqual([skillTreeReady]);
    const moment = await launchMoment(t);
    expect((await unlockRows(t)).filter(({ user }) => user === "U_ALICE")).toEqual([
      { user: "U_ALICE", feature: "leaderboard", readyAt: moment, openedAt: moment },
      { user: "U_ALICE", feature: "skillTree", readyAt: expect.toSatisfy((readyAt: number) => readyAt > moment) },
    ]);
  });

  test("the launch and the ship sweep can't race: a sweep that runs first after unlocks turns on opens the Leaderboard for a level 4 member who existed then, and DMs nothing", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone("xp-levels"), offForEveryone("everyone-board"), offForEveryone(unlocks));
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await xpOf(t, "U_ALICE", 300);
    const dmsBefore = sentDms();
    await flagsFromPostHog(t, postHog, ...beside(onForEveryone(unlocks)));

    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settle(t);

    const moment = await launchMoment(t);
    expect(sentDms()).toEqual(dmsBefore);
    expect((await unlockRows(t)).filter(({ user }) => user === "U_ALICE")).toEqual([{ user: "U_ALICE", feature: "leaderboard", readyAt: moment, openedAt: moment }]);
  });

  test("the launch and a level up can't race: a level up that runs first after unlocks turns on names no feature the launch opened", async () => {
    const t = await workspaceDeciding("sandbox", ...beside(offForEveryone(unlocks)));
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await unlocksTurned(t, "on");

    await giveKudos(t, "U_ALICE", "U_BOB", 8);

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([levelTwoDm, levelThreeDm]);
    const moment = await launchMoment(t);
    expect((await unlockRows(t)).filter(({ user }) => user === "U_ALICE")).toEqual([{ user: "U_ALICE", feature: "leaderboard", readyAt: moment, openedAt: moment }]);
  });
});

describe("O36: unlocks exposure", () => {
  test("is sent once per member and value, from the App Home opening", async () => {
    const t = await workspaceShippedBeforeAnyoneJoined();
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await unlocksTurned(t, "off");
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([
      [unlocks, true],
      [unlocks, false],
    ]);
  });

  test("is sent for a /hedgehug leaderboard caller the directory doesn't know yet, with the value their reply was decided by", async () => {
    const t = await workspaceShippedBeforeAnyoneJoined();

    const reply = await leaderboardCommand(t, "U_CAROL");

    expect(reply).toEqual({ response_type: "ephemeral", text: "Leaderboard opens at level 3." });
    expect(exposures()).toEqual([[unlocks, true]]);
  });
});

function beside(...unlocksFlag: FlagDefinition[]) {
  return [onForEveryone("xp-levels"), onForEveryone("everyone-board"), ...unlocksFlag];
}

function unlocksTurned(t: Backend, value: Turned) {
  return flagsFromPostHog(t, postHog, ...beside((value === "on" ? onForEveryone : offForEveryone)(unlocks)));
}

async function workspaceShippedBeforeAnyoneJoined() {
  return unlocksShippedBeforeAnyoneJoined(await workspaceDeciding("sandbox", ...beside(onForEveryone(unlocks))));
}

async function workspaceDeciding(environment: "sandbox" | "production", ...definitions: FlagDefinition[]) {
  postHog = postHogDeciding(environment);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return flagsFromPostHog(t, postHog, ...definitions);
}

function namesAnUnlock(line: string) {
  return /is ready|Next:|Open|opens at level/.test(line);
}

function exposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === unlocks);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}

type PostedDm = Record<string, unknown>;

function sentDms(): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => String(channel).startsWith("U_") && !String(text).startsWith("👋 Welcome"));
}

function dmsTo(user: string): PostedDm[] {
  return sentDms().filter(({ channel }) => channel === user);
}

function readDm(dm: PostedDm) {
  return dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(dm.blocks as Block[]);
}

function openButtonIn(dmOrBlocks: PostedDm | Block[]): BlockAction {
  const blocks = Array.isArray(dmOrBlocks) ? dmOrBlocks : (dmOrBlocks.blocks as Block[]);
  return buttonIn(blocks, "Open");
}

function homeBlocksOf(user: string) {
  return (slack.homeShownTo(user) as { blocks: Block[] }).blocks;
}

function rowsOf(text: string | undefined) {
  return (text ?? "").split("\n").filter((line) => line.includes("<@"));
}

async function unlockRows(t: Backend) {
  return t.run(async (ctx) => {
    const rows = await ctx.db.query("unlocks").collect();
    const withUsers = await Promise.all(
      rows.map(async ({ member, feature, readyAt, openedAt }) => ({ user: (await ctx.db.get(member))!.user, feature, readyAt, ...(openedAt !== undefined && { openedAt }) })),
    );
    return withUsers.sort((a, b) => a.user.localeCompare(b.user) || a.feature.localeCompare(b.feature));
  });
}

async function launchMoment(t: Backend) {
  return t.run(async (ctx) => {
    const launched = await ctx.db
      .query("unlockLaunches")
      .withIndex("by_workspace", (q) => q.eq("workspace", "T1"))
      .unique();
    return launched!.at;
  });
}

async function xpOf(t: Backend, user: string, xp: number) {
  await t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function leaderboardCommand(t: Backend, user: string) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text: "leaderboard",
    response_url: "https://hooks.slack.com/commands/T1/1/abc",
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, form));
  await settle(t);
  const text = await response.text();
  return text === "" ? null : JSON.parse(text);
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
