import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { PerkId } from "../progression/tree";
import type { QuestId } from "../quests/pool";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-14T10:00:00Z");
const ts = `${now.getTime() / 1000}.000100`;
const given = "<@U_BOB> got 1 kudos from you. You have 9 kudos left today.";
const hint = "Add why they earned it to earn more.";
const ref = { workspace: "T1", conversation: "C1", message: ts };

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

describe("HH6 HH8: a short kudos earns what any kudos earns, and no success reply asks to say why", () => {
  test("a giver who owns spark sends a short kudos, and the success reply shows its bonus", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns("spark");

    await giveKudos(t, "thanks");

    expect(successRepliesToAlice()).toEqual([[given, "+10 XP · Spark bonus (+5 XP)"]]);
  });

  test("with a quest finished by the same short kudos, the extras line names the bonus and the quest", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree", "quests");
    const { t, alice } = await workspaceWhereAliceOwns("spark");
    await questsOpenedWith(t, alice, ["someone-new", "say-why-twice", "say-why-three-times"]);

    await giveKudos(t, "thanks");

    expect(successRepliesToAlice()).toEqual([[given, "+10 XP · Quest done: Thank someone you haven't thanked before (+20 XP) · Spark bonus (+5 XP)"]]);
  });

  test("a reply stored with the hint before is sent without it", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const { t } = await workspaceWhereAliceOwns("spark");
    const reply = await t.run((ctx) => ctx.db.insert("privateReplies", { ...ref, to: "U_ALICE", given: [{ text: given }], lines: [], hint: [{ text: hint }], gains: { xp: 10 } }));

    await t.action(internal.slack.delivery.deliverPrivateReply, { reply });

    expect(successRepliesToAlice()).toEqual([[given, "+10 XP"]]);
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
