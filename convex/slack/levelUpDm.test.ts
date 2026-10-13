import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { FakeSlack, httpStatus, networkFailure, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { standingOf } from "../progression/progression";

const now = new Date("2026-10-13T10:00:00Z");

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  flagsOnForEveryone(slack.fetch, "xp-levels");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P63: the level-up DM", () => {
  test("reaching a level sends that member, and only them, a DM with the XP to the next level", async () => {
    const t = await workspaceWithAllowance(10);

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(slack.callsTo("conversations.open")).toEqual([]);
    expect(levelUpDms()).toEqual([
      { channel: "U_ALICE", text: "🎉 You reached level 2!\nLevel 3 is 80 XP away." },
    ]);
  });

  test("P6: an award that crosses several levels sends one DM for the highest", async () => {
    const t = await workspaceWithAllowance(10);

    await giveKudos(t, "U_ALICE", "U_BOB", 10);

    expect(levelUpDms().filter(({ channel }) => channel === "U_ALICE")).toEqual([
      { channel: "U_ALICE", text: "🎉 You reached level 3!\nLevel 4 is 200 XP away." },
    ]);
  });

  test.each([
    ["level 4 names no skill points", 290, "🎉 You reached level 4!\nLevel 5 is 300 XP away."],
    ["level 5 names the first skill point, saved for the skill tree", 590, "🎉 You reached level 5! You have 1 skill point saved for the skill tree.\nLevel 6 is 400 XP away."],
    ["level 6 names every saved skill point", 990, "🎉 You reached level 6! You have 2 skill points saved for the skill tree.\nLevel 7 is 500 XP away."],
  ])("P4: %s", async (_, xp, text) => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", xp);

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDms().filter(({ channel }) => channel === "U_ALICE").map((dm) => dm.text)).toEqual([text]);
  });

  test("a recipient who reaches a level gets the DM, and a giver who stays on their level gets none", async () => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(levelUpDms().map(({ channel }) => channel)).toEqual(["U_ALICE", "U_BOB"]);
    expect(levelUpDms()[1]?.text).toBe("🎉 You reached level 2!\nLevel 3 is 80 XP away.");
  });

  test("a member whose DM setting is off gets no DM while the other side of the same award gets theirs, and their XP, level and welcome stay as they were", async () => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await turnDmsOff(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", "U_BOB", 3);

    expect(levelUpDms().map(({ channel }) => channel)).toEqual(["U_BOB"]);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 40, level: 2, skillPoints: 0 });
    expect(slack.callsTo("chat.postMessage").map(({ channel }) => channel).sort()).toEqual(["C1", "U_ALICE", "U_BOB", "U_BOB"]);
  });
});

describe("R34 R35: a level-up DM is tried at most 3 times", () => {
  test("a DM that keeps failing is tried 3 times and never again, and the XP and level stand", async () => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    slack.answering("chat.postMessage", networkFailure, httpStatus(500), slackError("internal_error"), networkFailure);

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDms()).toHaveLength(3);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0 });
  });

  test("a rate-limited DM is tried again after Slack's Retry-After, and then not again once it arrived", async () => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    slack.answering("chat.postMessage", rateLimitedFor(30));

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    const [first, retry] = slack.timesOf("chat.postMessage", isLevelUpDm);
    expect(levelUpDms()).toHaveLength(2);
    expect(retry! - first!).toBeGreaterThanOrEqual(30_000);
  });
  test("a DM Slack held back is not sent once the member turned DMs off", async () => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await turnDmsOff(t, "U_ALICE");
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(levelUpDms()).toHaveLength(1);
    expect(slack.messagesIn("U_ALICE").filter(isLevelUpDm)).toEqual([]);
  });
});

async function workspaceWithAllowance(baseAllowance: number) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance }));
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `1760349600.00010${sentMessages}` })));
  await settle(t);
}

function levelUpDms() {
  return slack.callsTo("chat.postMessage").filter(isLevelUpDm);
}

function isLevelUpDm({ text }: { text?: unknown }) {
  return String(text).startsWith("🎉 You reached level");
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

async function turnDmsOff(t: Backend, user: string) {
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("progressSettings", { member, dms: false }));
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}
