import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, journeyShippedBeforeAnyoneJoined, onForEmails, onForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { everythingStored, memberChanged, post, react, settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, kudosAppBotUser, mention, section, type ReactionOptions } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import schema from "../schema";
import { recordReward, standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const messageTs = slackTs(now.getTime() - hourMs);

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL").withMember("U_DANA").withMember("U_BOT", { is_bot: true });
  postHog = flagsOnForEveryone(slack.fetch, "stars");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SR1 SR8: a kudos emoji reaction on a teammate's message is a star", () => {
  test("Bob's :taco: on Alice's message gives Alice 1 XP and Bob 1 XP, and sends nothing to Slack", async () => {
    const t = await workspace();

    const response = await star(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(response.status).toBe(200);
    expect(await xpOf(t, "U_ALICE")).toBe(1);
    expect(await xpOf(t, "U_BOB")).toBe(1);
    expect(slackWrites()).toEqual([]);
  });

  test.each<[string, ReactionOptions]>([
    ["a skin-tone suffix", { reaction: "taco::skin-tone-3" }],
    ["a thread reply", { ts: slackTs(now.getTime() - 2 * hourMs + 5_000) }],
  ])("%s still counts", async (_, options) => {
    const t = await workspace();

    await star(t, { user: "U_BOB", itemUser: "U_ALICE", ...options });

    expect(await xpOf(t, "U_ALICE")).toBe(1);
    expect(await xpOf(t, "U_BOB")).toBe(1);
  });

  test("P13: the star's XP takes Alice to level 2, and the level reached follows as for any reward", async () => {
    const t = await workspace();
    await star(t, { user: "U_BOB", itemUser: "U_ALICE", ts: slackTs(now.getTime() - 2 * hourMs) });
    await givenXp(t, "U_ALICE", 18);

    await star(t, { user: "U_CAROL", itemUser: "U_ALICE" });

    expect(await standing(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(levelsReached()).toEqual([2]);
  });

  test("SR3: on a Given kudos message the star is for its recipients still members, not its author", async () => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);
    const before = await xpOfEveryone(t);
    await memberLeft(t, "U_DANA");

    await star(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(await xpOfEveryone(t)).toEqual({ ...before, U_BOB: before.U_BOB + 1, U_CAROL: before.U_CAROL + 1 });
  });

  test("SR8: a star pays its people whatever their own flag says, the giver's flag alone decides", async () => {
    const t = await workspace();
    await withStarsOnOnlyFor(t, "U_BOB");

    await star(t, { user: "U_BOB", itemUser: "U_ALICE" });
    await star(t, { user: "U_ALICE", itemUser: "U_BOB", ts: slackTs(now.getTime() - 2 * hourMs) });

    expect(await xpOf(t, "U_ALICE")).toBe(1);
    expect(await xpOf(t, "U_BOB")).toBe(1);
  });
});

describe("SR1 SR18: every other reaction does nothing", () => {
  test.each<[string, ReactionOptions]>([
    ["on one's own message", { user: "U_ALICE", itemUser: "U_ALICE" }],
    ["on a bot's message", { itemUser: "U_BOT" }],
    ["on the app's message", { itemUser: kudosAppBotUser }],
    ["by the app", { user: kudosAppBotUser }],
    ["by a bot", { user: "U_BOT" }],
    ["with another emoji", { reaction: "tada" }],
    ["with another emoji that carries a skin tone", { reaction: "thumbsup::skin-tone-2" }],
    ["more than 24 hours after the message", { ts: slackTs(now.getTime() - 24 * hourMs) }],
    ["on a message posted after the reaction", { ts: slackTs(now.getTime() + 60_000) }],
    ["in a one-to-one DM", { channel: "D1" }],
    ["on a file", { itemType: "file" }],
    ["without the message's author", { itemUser: null }],
    ["removed", { type: "reaction_removed" }],
  ])("a reaction %s gives no XP and calls Slack for nothing but its people", async (_, options) => {
    const t = await workspace();

    const response = await star(t, { user: "U_BOB", itemUser: "U_ALICE", ...options });

    expect(response.status).toBe(200);
    expect(await xpOfEveryone(t)).toEqual({ U_ALICE: 0, U_BOB: 0, U_CAROL: 0, U_DANA: 0, U_BOT: 0 });
    expect(slackWrites()).toEqual([]);
    expect(starsGiven()).toEqual([]);
  });

  test("SR4: a star on a Given kudos message whose author has left gives no XP", async () => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);
    await memberChanged(t, "user_change", { id: "U_ALICE", deleted: true });
    const before = await xpOfEveryone(t);

    await star(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(await xpOfEveryone(t)).toEqual(before);
    expect(starsGiven()).toEqual([]);
  });

  test.each([
    ["its author", "U_ALICE"],
    ["one of its recipients", "U_CAROL"],
  ])("a reaction by %s on a Given kudos message gives no XP", async (_, user) => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);
    const before = await xpOfEveryone(t);

    await star(t, { user, itemUser: "U_ALICE" });

    expect(await xpOfEveryone(t)).toEqual(before);
    expect(starsGiven()).toEqual([]);
  });
});

describe("SR4: people the directory doesn't know are looked up first", () => {
  test("an unknown giver's first star counts once users.info answers, after a failed try", async () => {
    const t = await workspace();
    slack.answering("users.info", httpStatus(500));

    await star(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(await xpOf(t, "U_BOB")).toBe(1);
    expect(await xpOf(t, "U_ALICE")).toBe(1);
  });

  test("a giver who isn't a member does nothing", async () => {
    const t = await workspace();
    slack.withMember("U_GONE", { deleted: true });

    await star(t, { user: "U_GONE", itemUser: "U_ALICE" });

    expect(await xpOf(t, "U_ALICE")).toBe(0);
    expect(starsGiven()).toEqual([]);
  });

  test("an author whose lookup fails 3 times makes the star do nothing, and Slack is asked no more", async () => {
    const t = await workspace();
    slack.answering("users.info", ...Array.from({ length: 3 }, () => httpStatus(500)));
    await star(t, { user: "U_BOB", itemUser: "U_EVE" });

    expect(slack.callsTo("users.info").filter(({ user }) => user === "U_EVE")).toHaveLength(3);
    expect(await xpOf(t, "U_BOB")).toBe(0);
    expect(starsGiven()).toEqual([]);
  });
});

describe("SR16: a star reaches PostHog as star given, with only whether it was on a kudos message", () => {
  test.each([
    ["an ordinary message", false],
    ["a Given kudos message", true],
  ])("on %s", async (_, onKudos) => {
    const t = await workspace();
    if (onKudos) await kudos(t, "U_ALICE", ["U_CAROL"]);

    await star(t, { user: "U_BOB", itemUser: "U_ALICE" });

    const given = starsGiven();
    const shared = { environment: "sandbox", workspace_key: expect.any(String), taxonomy_version: expect.any(Number) };
    expect(given.map(({ properties }) => properties)).toEqual([{ ...shared, on_kudos: onKudos }]);
    expect(JSON.stringify(given)).not.toMatch(new RegExp(`U_ALICE|U_BOB|C1|${secondsOf(messageTs)}`));
  });
});

describe("SR6 SR23: a star never passes the star budget", { timeout: 60_000 }, () => {
  test("two reactions at once can't both be the 10th star", async () => {
    const t = await workspace();
    for (let index = 0; index < 9; index += 1) await star(t, { user: "U_BOB", itemUser: "U_ALICE", ts: slackTs(now.getTime() - (index + 1) * 60_000) });

    for (const user of ["U_CAROL", "U_DANA"]) await memberChanged(t, "team_join", { id: user });
    await settle(t);

    await Promise.all([
      react(t, { user: "U_BOB", itemUser: "U_CAROL", ts: slackTs(now.getTime() - 20 * 60_000) }),
      react(t, { user: "U_BOB", itemUser: "U_DANA", ts: slackTs(now.getTime() - 21 * 60_000) }),
    ]);
    await settle(t);

    expect(await xpOf(t, "U_BOB")).toBe(10);
    expect((await xpOf(t, "U_CAROL")) + (await xpOf(t, "U_DANA"))).toBe(1);
  });

  test("the 11th star on the giver's day writes and says nothing, and the next day it counts", async () => {
    const t = await workspace();

    for (let index = 0; index < 11; index += 1) await star(t, { user: "U_BOB", itemUser: "U_ALICE", ts: slackTs(now.getTime() - (index + 1) * 60_000) });

    expect(await xpOf(t, "U_BOB")).toBe(10);
    expect(await xpOf(t, "U_ALICE")).toBe(10);
    expect(slackWrites()).toEqual([]);

    vi.setSystemTime(now.getTime() + 15 * hourMs);
    await star(t, { user: "U_BOB", itemUser: "U_ALICE", ts: slackTs(now.getTime() - 11 * 60_000) });

    expect(await xpOf(t, "U_BOB")).toBe(11);
  });

  test("a workspace's starBudget changes the number", async () => {
    const t = await workspace();
    await t.mutation(internal.workspace.settings.setStarBudget, { workspace: "T1", starBudget: 2 });

    for (let index = 0; index < 3; index += 1) await star(t, { user: "U_BOB", itemUser: "U_ALICE", ts: slackTs(now.getTime() - (index + 1) * 60_000) });

    expect(await xpOf(t, "U_BOB")).toBe(2);
  });

  test("a star budget for a workspace Kudos doesn't know is refused, and the known workspace keeps 10", async () => {
    const t = await workspace();

    await expect(t.mutation(internal.workspace.settings.setStarBudget, { workspace: "T_TYPO", starBudget: 2 })).rejects.toThrow("Kudos knows no workspace T_TYPO");

    for (let index = 0; index < 3; index += 1) await star(t, { user: "U_BOB", itemUser: "U_ALICE", ts: slackTs(now.getTime() - (index + 1) * 60_000) });
    expect(await xpOf(t, "U_BOB")).toBe(3);
  });
});

describe("SR5 SR23: a member stars a message at most once", { timeout: 60_000 }, () => {
  test.each<[string, (eventId: string) => ReactionOptions[]]>([
    ["a redelivered event", (eventId) => [{ eventId }, { eventId }]],
    ["a removed and re-added reaction", () => [{}, { type: "reaction_removed" }, {}]],
    ["a second skin tone", () => [{ reaction: "taco::skin-tone-2" }, { reaction: "taco::skin-tone-5" }]],
  ])("%s pays the author and the giver once", async (_, reactions) => {
    const t = await workspace();

    for (const options of reactions("Ev-once")) await star(t, { user: "U_BOB", itemUser: "U_ALICE", ...options });

    expect(await xpOf(t, "U_ALICE")).toBe(1);
    expect(await xpOf(t, "U_BOB")).toBe(1);
    expect(starsGiven()).toHaveLength(1);
  });

  test("a redelivered star on a Given kudos message pays each recipient once", async () => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);
    const before = await xpOfEveryone(t);

    await star(t, { user: "U_BOB", itemUser: "U_ALICE", eventId: "Ev-once" });
    await star(t, { user: "U_BOB", itemUser: "U_ALICE", eventId: "Ev-again" });

    expect(await xpOfEveryone(t)).toEqual({ ...before, U_BOB: before.U_BOB + 1, U_CAROL: before.U_CAROL + 1, U_DANA: before.U_DANA + 1 });
  });
});

describe("SR2 SR23: a star is never an award", { timeout: 120_000 }, () => {
  test("with every feature on, stars change nothing but their own records, XP and the flag's exposure: boards, kudos totals, coins, quests, the Journey and the allowance stay as they were", async () => {
    const t = await everyFeatureOn();
    await kudos(t, "U_ALICE", ["U_CAROL"]);
    await kudos(t, "U_BOB", ["U_ALICE"], slackTs(now.getTime() - hourMs + 1_000));
    await kudos(t, "U_CAROL", ["U_DANA"], slackTs(now.getTime() - hourMs + 2_000));
    await kudos(t, "U_DANA", ["U_BOB"], slackTs(now.getTime() - hourMs + 3_000));
    vi.setSystemTime(now);
    const withoutStars = await everythingStored(t, { except: writtenByAStar });

    await star(t, { user: "U_BOB", itemUser: "U_ALICE" });
    await star(t, { user: "U_DANA", itemUser: "U_BOB", ts: slackTs(now.getTime() - hourMs + 1_000) });
    await star(t, { user: "U_ALICE", itemUser: "U_DANA", ts: slackTs(now.getTime() - 2 * hourMs) });

    expect(starsGiven()).toHaveLength(3);
    expect(await everythingStored(t, { except: writtenByAStar })).toEqual(withoutStars);
  });
});

describe("SR9: a star's people are paid in pages", () => {
  test("a star on a kudos message with 250 recipients pays every recipient once and the giver once, within Convex's limits", { timeout: 120_000 }, async () => {
    const t = await workspace({ transactionLimits: true });
    const recipients = await kudosSeededFor(t, "U_ALICE", 250);

    await star(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(await xpOf(t, "U_BOB")).toBe(1);
    expect(await xpOf(t, "U_ALICE")).toBe(0);
    expect(new Set(await Promise.all(recipients.map((member) => t.run(async (ctx) => (await standingOf(ctx, member)).xp))))).toEqual(new Set([1]));
  });
});

async function workspace({ transactionLimits = false } = {}) {
  const t = testBackend({ transactionLimits });
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  return flagsLoaded(t);
}

const everyFeature = ["stars", "xp-levels", "unlocks", "quests", "skill-tree", "achievements", "coins", "crate-rewards", "website", "groups", "everyone-board", "activity"];

const writtenByAStar: Array<keyof typeof schema.tables> = ["stars", "starPeople", "starWeeks", "starWeekMessages", "starCounts", "rewardRecords", "memberProgress", "slackReceipts", "analyticsIds", "flagExposures", "analyticsOutbox"];

async function everyFeatureOn() {
  const t = await workspace();
  await flagsFromPostHog(t, postHog, ...everyFeature.map(onForEveryone));
  await journeyShippedBeforeAnyoneJoined(t);
  return bookShippedBeforeAnyoneJoined(t);
}

async function star(t: Backend, options: ReactionOptions) {
  const response = await react(t, { ts: messageTs, ...options });
  await settle(t);
  return response;
}

async function kudos(t: Backend, giver: string, recipients: string[], ts = messageTs) {
  await post(t, [section(...recipients.map((user) => mention(user)), emoji("taco"))], { user: giver, ts });
  await settle(t);
}

async function kudosSeededFor(t: Backend, giver: string, count: number): Promise<MemberId[]> {
  return t.run(async (ctx) => {
    const author = await ctx.db.insert("members", { workspace: "T1", user: giver, kind: "member" });
    const recipients: MemberId[] = [];
    for (let index = 0; index < count; index += 1) {
      const recipient = await ctx.db.insert("members", { workspace: "T1", user: `U_R${index}`, kind: "member" });
      await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: messageTs, giver: author, recipient, kudos: 1, day: "2026-10-13", at: now.getTime() - hourMs });
      recipients.push(recipient);
    }
    return recipients;
  });
}

async function memberLeft(t: Backend, user: string) {
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.patch(member!, { kind: "not-a-member" }));
}

async function withStarsOnOnlyFor(t: Backend, user: string) {
  slack.withMember(user, { profile: { email: emailOf(user) } });
  await flagsFromPostHog(t, postHog, onForEmails("stars", emailOf(user)));
}

function emailOf(user: string) {
  return `${user.toLowerCase()}@example.com`;
}

async function givenXp(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run((ctx) => recordReward(ctx, "T1", { member: member!, key: `test:${xp}`, xp, coins: 0, item: null, catalogueVersion: "test", at: Date.now() }));
  await settle(t);
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member!));
}

async function xpOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return member === null ? 0 : (await t.run((ctx) => standingOf(ctx, member))).xp;
}

const everyone = ["U_ALICE", "U_BOB", "U_CAROL", "U_DANA", "U_BOT"] as const;

async function xpOfEveryone(t: Backend): Promise<Record<(typeof everyone)[number], number>> {
  const [U_ALICE, U_BOB, U_CAROL, U_DANA, U_BOT] = await Promise.all(everyone.map((user) => xpOf(t, user)));
  return { U_ALICE: U_ALICE!, U_BOB: U_BOB!, U_CAROL: U_CAROL!, U_DANA: U_DANA!, U_BOT: U_BOT! };
}

async function memberOf(t: Backend, user: string): Promise<MemberId | null> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row?._id ?? null;
  });
}

function slackWrites() {
  return slack.calls.filter(({ method }) => !["users.info", "views.publish", "auth.test"].includes(method)).map(({ method }) => method);
}

function starsGiven() {
  return postHog.events().filter(({ event }) => event === "star given");
}

function levelsReached() {
  return postHog
    .events()
    .filter(({ event }) => event === "level reached")
    .map(({ properties }) => properties.level);
}

function slackTs(at: number) {
  return `${Math.floor(at / 1000)}.000100`;
}

function secondsOf(slackTimestamp: string) {
  return slackTimestamp.split(".")[0];
}
