import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageChangedEvent, messageEvent, section, text } from "../../testing/slackMessages";
import { replyPrivately, type Reply } from "../feedback/replies";
import type { PerkId } from "../progression/tree";
import type { QuestId } from "../quests/pool";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-14T10:00:00Z");
const ts = `${now.getTime() / 1000}.000100`;
const aMinuteLater = `${now.getTime() / 1000 + 60}.000100`;
const saysWhy = "thanks for untangling the release notes today";
const given = "<@U_BOB> got 1 kudos from you. You have 9 kudos left today.";
const hint = "Add why they earned it to earn more.";
const ref = { workspace: "T1", conversation: "C1", message: ts };
const givenWithoutWhy: Reply = { kind: "given", outcome: { recipients: ["U_BOB"], perRecipient: 1, left: 9, skipped: [] }, base: 10, annotations: { gate: { version: 1, thoughtful: false, words: 1 } } };

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P15 P71 P95: the success reply asks a giver who owns a perk to say why", () => {
  test("a giver who owns spark sends a kudos that doesn't say why, and the success reply ends with the hint", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns("spark");

    await giveKudos(t, "thanks");

    expect(successRepliesToAlice()).toEqual([[given, hint]]);
  });

  test("with a quest finished by the same kudos, the hint follows the Quest done part on the extras line", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree", "quests");
    const { t, alice } = await workspaceWhereAliceOwns("spark");
    await questsOpenedWith(t, alice, ["someone-new", "say-why-twice", "say-why-three-times"]);

    await giveKudos(t, "thanks");

    expect(successRepliesToAlice()).toEqual([[given, `Quest done: Thank someone you haven't thanked before · ${hint}`]]);
  });

  test("a retry decides again: a kudos that said why over the allowance, edited into one that doesn't, gets the hint", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns("spark");
    await send(t, messageEvent([section(mention("U_BOB"), text(` ${saysWhy} `), ...Array.from({ length: 11 }, () => emoji("taco")))], { user: "U_ALICE", ts }));

    await send(t, messageChangedEvent([section(mention("U_BOB"), text(" thanks "), emoji("taco"))], { user: "U_ALICE", ts, editedTs: aMinuteLater }));

    expect(successRepliesToAlice()).toEqual([[given, hint]]);
  });
});

describe("P15: the hint adds no wait and shows only while the skill tree applies", () => {
  test("where Quests doesn't apply, a reply with the hint is scheduled for delivery at once and never held", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns("spark");

    await t.run((ctx) => replyPrivately(ctx, ref, undefined, "U_ALICE", givenWithoutWhy));

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const forReplies = scheduled.filter(({ name }) => name.startsWith("slack/delivery:") || name.startsWith("feedback/replies:"));
    expect(forReplies.map(({ name, scheduledTime }) => ({ name, inMs: scheduledTime - Date.now() }))).toEqual([{ name: "slack/delivery:deliverPrivateReply", inMs: 0 }]);
    expect(await t.run(async (ctx) => (await ctx.db.query("privateReplies").collect()).map(({ held, hint }) => ({ held, hint })))).toEqual([{ held: undefined, hint: [{ text: hint }] }]);
  });

  test("a reply written with the hint is sent without it once the skill tree stops applying before Slack takes it", async () => {
    const postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns("spark");
    await t.run((ctx) => replyPrivately(ctx, ref, undefined, "U_ALICE", givenWithoutWhy));

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("skill-tree"));
    await settle(t);

    expect(successRepliesToAlice()).toEqual([[given]]);
  });
});

describe("P15: no hint, and today's reply, otherwise", () => {
  test("a kudos that says why", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns("spark");

    await giveKudos(t, saysWhy);

    expect(successRepliesToAlice()).toEqual([[given]]);
  });

  test("a giver who owns no perk", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns();

    await giveKudos(t, "thanks");

    expect(successRepliesToAlice()).toEqual([[given]]);
  });

  test("a workspace where the skill tree doesn't apply", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks");
    const { t } = await workspaceWhereAliceOwns("spark");

    await giveKudos(t, "thanks");

    expect(successRepliesToAlice()).toEqual([[given]]);
  });
});

async function workspaceWhereAliceOwns(...perks: PerkId[]) {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const alice = await t.run(async (ctx) => {
    await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
    const alice = await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" });
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" });
    for (const perk of perks) await ctx.db.insert("perksOwned", { member: alice, perk, boughtAt: now.getTime(), catalogueVersion: "1" });
    return alice;
  });
  return { t, alice };
}

async function questsOpenedWith(t: Backend, alice: MemberId, quests: QuestId[]) {
  await t.run(async (ctx) => {
    await ctx.db.insert("unlocks", { member: alice, feature: "quests", readyAt: now.getTime(), openedAt: now.getTime() });
    const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 } }));
    await ctx.db.insert("questDraws", { member: alice, week: "2026-10-12", drawnAt: now.getTime(), slots });
  });
}

async function giveKudos(t: Backend, words: string) {
  await send(t, messageEvent([section(mention("U_BOB"), text(` ${words} `), emoji("taco"))], { user: "U_ALICE", ts }));
}

async function send(t: Backend, event: Parameters<typeof signedRequest>[0]) {
  const response = await t.fetch("/slack/events", await signedRequest(event));
  expect(response.status).toBe(200);
  await settleInTimeOrder(t);
  await settle(t);
}

function successRepliesToAlice() {
  return slack
    .ephemeralsTo("U_ALICE")
    .map(({ text }) => String(text).split("\n"))
    .filter(([first]) => first!.includes("got 1 kudos from you"));
}
