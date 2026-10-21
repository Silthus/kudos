import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { edit, kudosReceived, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { xpToReach } from "../progression/levels";
import { recordReward, standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const messageTs = `${Math.floor(now.getTime() / 1000) - 3600}.000100`;
const carolsMessageTs = `${Math.floor(now.getTime() / 1000) - 1800}.000100`;
const teamEmoji = "team-workflows";
const levelEmoji = "level-5";
const randomEmoji = "party-parrot";
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
    await memberOf(t, "U_ALICE");
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
    await memberOf(t, "U_BOB");
    await unlockedTeamEmoji(t, "U_CAROL");

    await react(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: teamEmoji, ts: messageTs });
    await settle(t);

    expect(await xpOf(t, "U_ALICE")).toBe(0);
    expect(await xpOf(t, "U_BOB")).toBe(0);
  });

  test("with random-emojis off, a held random emoji still gives kudos and a hug", async () => {
    const t = await workspaceWithEmojiNames();
    await droppedRandomEmoji(t, "U_ALICE");

    await post(t, [section(text(saysWhy), mention("U_BOB"), text(" "), emoji(randomEmoji))], { user: "U_ALICE", ts: messageTs });
    await react(t, { user: "U_ALICE", itemUser: "U_CAROL", reaction: randomEmoji, ts: carolsMessageTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await xpOf(t, "U_CAROL")).toBe(1);
  });

  test("a held random emoji the maintainer mapped to a level emoji the holder hasn't reached still gives kudos and a hug", async () => {
    const t = await workspaceWithEmojiNames();
    await droppedRandomEmoji(t, "U_ALICE");
    await t.run(async (ctx) => {
      await ctx.db.insert("emojiNames", { workspace: "T1", emoji: "level:25", name: randomEmoji });
      for (const row of await ctx.db.query("emojiClasses").collect()) await ctx.db.delete(row._id);
    });

    await post(t, [section(text(saysWhy), mention("U_BOB"), text(" "), emoji(randomEmoji))], { user: "U_ALICE", ts: messageTs });
    await react(t, { user: "U_ALICE", itemUser: "U_CAROL", reaction: randomEmoji, ts: carolsMessageTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await xpOf(t, "U_CAROL")).toBe(1);
  });

  test("an edit to a kudos with the workspace emoji and 700 other emoji keeps its kudos", { timeout: 60_000 }, async () => {
    const t = await workspaceWithEmojiNames({ transactionLimits: true });
    await unlockedTeamEmoji(t, "U_ALICE");
    const manyEmoji = Array.from({ length: 700 }, (_, index) => emoji(`other-${index}`));
    const blocks = [section(text(saysWhy), mention("U_BOB"), text(" "), emoji("taco"), ...manyEmoji)];
    await post(t, blocks, { user: "U_ALICE", ts: messageTs });
    await settle(t);

    const response = await edit(t, [section(text(`${saysWhy} again`), mention("U_BOB"), text(" "), emoji("taco"), ...manyEmoji)], { user: "U_ALICE", ts: messageTs, editedTs: `${Number(messageTs.split(".")[0]) + 60}.000100` });
    await settle(t);

    expect(response.status).toBe(200);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("a held random emoji past the album's 200 shown still gives kudos in a message with 60 other emoji", { timeout: 60_000 }, async () => {
    const t = await workspaceWithEmojiNames();
    await droppedRandomEmoji(t, "U_ALICE", Array.from({ length: 200 }, (_, index) => `a-held-${String(index).padStart(3, "0")}`));
    const others = Array.from({ length: 60 }, (_, index) => emoji(`other-${index}`));

    await post(t, [section(text(saysWhy), mention("U_BOB"), text(" "), ...others, emoji(randomEmoji))], { user: "U_ALICE", ts: messageTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("an edit to a plain kudos in a workspace whose registry holds 11,000 names keeps its kudos", { timeout: 120_000 }, async () => {
    const t = await workspaceWithEmojiNames({ transactionLimits: true });
    await t.run(async (ctx) => {
      for (let index = 0; index < 11_000; index += 1) await ctx.db.insert("emojiNames", { workspace: "T1", emoji: `team:filler-${index}`, name: `team-filler-${index}` });
    });
    await post(t, [section(text(saysWhy), mention("U_BOB"), text(" "), emoji("taco"))], { user: "U_ALICE", ts: messageTs });
    await settle(t);

    const response = await edit(t, [section(text(`${saysWhy} again`), mention("U_BOB"), text(" "), emoji("taco"))], { user: "U_ALICE", ts: messageTs, editedTs: `${Number(messageTs.split(".")[0]) + 60}.000100` });
    await settle(t);

    expect(response.status).toBe(200);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });
});

describe("a message gives each recipient as many kudos as its most repeated kudos emoji", () => {
  test.each([
    ["the workspace's kudos emoji beside their team emoji", ["taco", teamEmoji], 1],
    ["the workspace's kudos emoji twice beside their team emoji", ["taco", teamEmoji, "taco"], 2],
    ["their team emoji three times beside the workspace's kudos emoji", [teamEmoji, "taco", teamEmoji, teamEmoji], 3],
  ])("a kudos message with %s", async (_, names, kudos) => {
    const t = await workspaceWithEmojiNames();
    await unlockedTeamEmoji(t, "U_ALICE");

    await post(t, [section(text(saysWhy), mention("U_BOB"), text(" "), ...names.map((name) => emoji(name)))], { user: "U_ALICE", ts: messageTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(kudos);
  });
});

describe("the app reacts with the kudos emoji closest after the recipient's mention", () => {
  test.each([
    ["one before the mention and one after it", [emoji("taco"), mention("U_BOB"), text(" "), emoji(teamEmoji)], teamEmoji],
    ["two after the mention", [mention("U_BOB"), text(" thanks "), emoji(teamEmoji), text(" and "), emoji("taco")], teamEmoji],
    ["one after the giver's own mention and one after the recipient's", [mention("U_ALICE"), emoji("taco"), text(" and "), mention("U_BOB"), emoji(teamEmoji)], teamEmoji],
    ["none after the mention, the closest before it", [emoji(teamEmoji), text(" "), emoji("taco"), text(" "), mention("U_BOB")], "taco"],
  ])("a kudos message with %s", async (_, elements, reaction) => {
    const t = await workspaceWithEmojiNames();
    await unlockedTeamEmoji(t, "U_ALICE");

    await post(t, [section(text(saysWhy), ...elements)], { user: "U_ALICE", ts: messageTs });
    await settle(t);

    expect(slack.reactionsOn("C1", messageTs)).toEqual([reaction]);
  });
});

async function workspaceWithEmojiNames({ transactionLimits = false } = {}) {
  const t = testBackend({ transactionLimits });
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

async function droppedRandomEmoji(t: Backend, user: string, heldBefore: string[] = []) {
  const member = await memberOf(t, user);
  const recipient = await memberOf(t, "U_BOB");
  await t.run(async (ctx) => {
    const pack = await ctx.db.insert("thoughtfulPacks", { workspace: "T1", giver: member, recipient, week: "2026-10-12", message: { workspace: "T1", conversation: "C1", message: "1760000000.000100" }, holdsSticker: false, at: now.getTime() });
    await ctx.db.insert("emojiClasses", { workspace: "T1", name: randomEmoji, class: "random" });
    for (const name of [...heldBefore, randomEmoji]) await ctx.db.insert("randomEmojiDrops", { member, name, pack, at: now.getTime() });
  });
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
