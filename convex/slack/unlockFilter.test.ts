import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { blockActions, buttonInHome, publishedHome, readBlocks, type Block } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { standingOf } from "../progression/progression";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const leaderboardReady = "section: *Leaderboard* is ready. It opens the boards. [button: Open]";
const skillTreeReady = "section: *Skill tree* is ready. It opens the tree and your first skill point. [button: Open]";

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P76: a feature's lines wait for its opening", () => {
  test("a member who reaches level 5 while the skill tree is unshipped is told nothing of skill points or perks, and still has the point stored", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 590);

    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    expect(dmsTo("U_ALICE").at(-1)).toEqual(["🎉 You reached level 5!", "Level 6 is 400 XP away."]);
    expect(progressionOf(publishedHome(slack, "U_ALICE"))).toEqual(["section fields: *Level*\n*5* | *XP to level 6*\n*400*"]);
    expect(everythingToldTo("U_ALICE")).not.toMatch(/skill|perk/i);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 600, level: 5, skillPoints: 1 });
  });

  test("a member whose skill tree is ready but not opened sees its crate and no skill point line, in the DM and in App Home", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "skill-tree");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 590);

    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    expect(dmsTo("U_ALICE").at(-1)).toEqual(["section: 🎉 You reached level 5!", "section: Level 6 is 400 XP away.", skillTreeReady]);
    expect(progressionOf(publishedHome(slack, "U_ALICE"))).toEqual(["section fields: *Level*\n*5* | *XP to level 6*\n*400*", skillTreeReady]);
  });

  test("a member below level 5 sees the shipped skill tree as Next, not yet ready", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "skill-tree");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    await openHome(t, "U_ALICE");

    expect(progressionOf(publishedHome(slack, "U_ALICE"))).toEqual(["section fields: *Level*\n*2* | *XP to level 3*\n*80*", "section: Next: Skill tree at level 5."]);
  });

  test("once the member opens the skill tree, the level-up DM and App Home name their saved skill points", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "skill-tree");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", 590);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Open");

    const opened = progressionOf(publishedHome(slack, "U_ALICE"));
    await withXp(t, "U_ALICE", 990);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(opened).toEqual(["section fields: *Level*\n*5* | *XP to level 6*\n*400*", "section: You have *1 skill point* saved for the skill tree."]);
    expect(dmsTo("U_ALICE").at(-1)).toEqual(["🎉 You reached level 6! You have 2 skill points saved for the skill tree.", "Level 7 is 500 XP away."]);
    expect(progressionOf(publishedHome(slack, "U_ALICE"))).toEqual(["section fields: *Level*\n*6* | *XP to level 7*\n*500*", "section: You have *2 skill points* saved for the skill tree."]);
  });

  test("with everyone-board on, a level 1 member is told the Leaderboard opens at level 3, by /hedgehug leaderboard, and App Home has no Leaderboard tab", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "everyone-board");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    const reply = await leaderboardCommand(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(reply).toEqual({ response_type: "ephemeral", text: "Leaderboard opens at level 3." });
    expect(publishedHome(slack, "U_ALICE")[0]).toBe("actions: [Profile] | Settings");
    expect(publishedHome(slack, "U_ALICE")).toContain("section: Next: Leaderboard at level 3.");
  });

  test("at level 3, before opening, /hedgehug leaderboard says the Leaderboard is ready, and App Home shows its crate but no Leaderboard tab", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "everyone-board");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 10);

    const reply = await leaderboardCommand(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(reply).toEqual({ response_type: "ephemeral", text: "Leaderboard is ready for you. Open it in App Home." });
    expect(publishedHome(slack, "U_ALICE")[0]).toBe("actions: [Profile] | Settings");
    expect(publishedHome(slack, "U_ALICE")).toContain(leaderboardReady);
  });

  test("once the member opens the Leaderboard, its tab and /hedgehug leaderboard show the board, with members who haven't opened it on it", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "everyone-board");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_BOB", "U_ALICE", 1);
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Open");
    const tabBar = publishedHome(slack, "U_ALICE")[0];
    await click(t, "U_ALICE", "Leaderboard");
    const reply = await leaderboardCommand(t, "U_ALICE");

    expect(tabBar).toBe("actions: [Profile] | Leaderboard | Settings");
    const boardRows = ["🥇 <@U_ALICE> · 10 kudos", "🥈 <@U_BOB> · 1 kudos"];
    expect(rowsOf(publishedHome(slack, "U_ALICE").find((line) => line.startsWith("section: 🥇"))?.slice("section: ".length))).toEqual(boardRows);
    expect(rowsOf(reply.text)).toEqual(boardRows);
  });

  test("with everyone-board off, a level 3 member's /hedgehug leaderboard answers as /hedgehug, and nothing names the Leaderboard", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels");
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 10);

    const reply = await leaderboardCommand(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(reply).toBeNull();
    expect(slack.callsTo("conversations.join")).toEqual([{ channel: "C1" }]);
    expect(everythingToldTo("U_ALICE")).not.toMatch(/leaderboard/i);
  });
});

function dmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && !String(text).startsWith("👋 Welcome"))
    .map((dm) => (dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(dm.blocks as Block[])));
}

function everythingToldTo(user: string) {
  const publishes = slack.callsTo("views.publish").filter((args) => args.user_id === user);
  return JSON.stringify([...dmsTo(user), ...publishes]);
}

function progressionOf(home: string[]) {
  const start = home.indexOf("divider") + 1;
  return home.slice(start, home.indexOf("divider", start));
}

async function workspaceWithAllowance(baseAllowance: number) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance }));
  return t;
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
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonInHome(slack, user, label)), form));
  await settle(t);
}

function rowsOf(board: string | undefined) {
  return (board ?? "").split("\n").filter((line) => line.includes("<@"));
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

async function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}

async function withXp(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}
