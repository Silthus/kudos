import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { kudosReceived, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { xpToReach } from "../progression/levels";
import { recordReward, standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const messageTs = `${Math.floor(now.getTime() / 1000) - 3600}.000100`;
const teamEmoji = "team-workflows";
const levelEmoji = "level-5";
const saysWhy = "thanks for untangling the release notes today ";

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  flagsOnForEveryone(slack.fetch, "hugs");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("an emoji the giver unlocked in the album counts like the workspace's kudos emoji", () => {
  test.each([
    ["their team emoji", teamEmoji, unlockedTeamEmoji],
    ["their level emoji", levelEmoji, reachedLevelFive],
  ])("a kudos message with %s gives kudos", async (_, name, unlock) => {
    const t = await workspaceWithEmojiNames();
    await unlock(t, "U_ALICE");

    await post(t, [section(text(saysWhy), mention("U_BOB"), text(" "), emoji(name))], { user: "U_ALICE", ts: messageTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("a kudos message with an emoji only someone else unlocked gives nothing", async () => {
    const t = await workspaceWithEmojiNames();
    await unlockedTeamEmoji(t, "U_CAROL");

    await post(t, [section(text(saysWhy), mention("U_BOB"), text(" "), emoji(teamEmoji))], { user: "U_ALICE", ts: messageTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(0);
  });

  test("a reaction with their team emoji is a hug", async () => {
    const t = await workspaceWithEmojiNames();
    await unlockedTeamEmoji(t, "U_BOB");

    await react(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: teamEmoji, ts: messageTs });
    await settle(t);

    expect(await xpOf(t, "U_ALICE")).toBe(1);
    expect(await xpOf(t, "U_BOB")).toBe(1);
  });

  test("a reaction with an emoji only someone else unlocked is no hug", async () => {
    const t = await workspaceWithEmojiNames();
    await unlockedTeamEmoji(t, "U_CAROL");

    await react(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: teamEmoji, ts: messageTs });
    await settle(t);

    expect(await xpOf(t, "U_ALICE")).toBe(0);
    expect(await xpOf(t, "U_BOB")).toBe(0);
  });
});

async function workspaceWithEmojiNames() {
  const t = testBackend();
  await t.run(async (ctx) => {
    await ctx.db.insert("emojiNames", { workspace: "T1", emoji: "team:workflows", name: teamEmoji });
    await ctx.db.insert("emojiNames", { workspace: "T1", emoji: "level:5", name: levelEmoji });
  });
  return flagsLoaded(t);
}

async function unlockedTeamEmoji(t: Backend, user: string) {
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("teamStickers", { member, workspace: "T1", team: "workflows", at: now.getTime(), name: "Workflows", art: null, emoji: teamEmoji }));
}

async function reachedLevelFive(t: Backend, user: string) {
  const member = await memberOf(t, user);
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:level-5", xp: xpToReach(5), coins: 0, item: null, catalogueVersion: "test", at: now.getTime() }));
  await settle(t);
}

async function xpOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await standingOf(ctx, member)).xp);
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row?._id ?? (await ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
  });
}
