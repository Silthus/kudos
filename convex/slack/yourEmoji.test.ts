import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const alicesEmail = "alice@example.com";
const carolsEmail = "carol@example.com";
const xpBelowLevelSix = 990;
const store = "store";
const yourEmojiKey = "journey:your-emoji";
const yourEmojiActive = "section: *Journey:* Give a kudos that says why with one of your kudos emoji. It pays *40 XP*.";
const hedgehogHint = "context: :hedgehog: is in your slots: use it in a kudos like :taco:. It counts when your message has 5 or more words besides mentions and emoji.";
const emptySlotsHint = "context: Put one of your kudos emoji in a slot in the Inventory tab first.";
const yourEmojiDone = "section: *Journey:* ✅ Give a kudos that says why with one of your kudos emoji. You earned *40 XP*. [button: Open]";
const questDone = "Quest done: Give a kudos that says why with one of your kudos emoji (+40 XP, +20 🪙)";

const questsOn = [onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("quests")];
const coinsForAliceAndCarol = onForEmails("coins", alicesEmail, carolsEmail);
const previewedByAlice = [...questsOn, coinsForAliceAndCarol, onForEmails(store, alicesEmail)];
const previewedByAliceAndCarol = [...questsOn, coinsForAliceAndCarol, onForEmails(store, alicesEmail, carolsEmail)];
const storeOff = [...questsOn, coinsForAliceAndCarol, offForEveryone(store)];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ST19: your-emoji, the Journey's last step", { timeout: 60_000 }, () => {
  test("after opening Coins, App Home lists the step with 🦔 in the hint, and a kudos that says why with 🦔 finishes it once, with 40 XP and 20 🪙 in its reply", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");

    await openHome(t, "U_ALICE");
    expect(journeyStepOf(publishedHome(slack, "U_ALICE"), yourEmojiActive)).toEqual([yourEmojiActive, hedgehogHint]);

    vi.setSystemTime(tuesday + dayMs);
    const before = await balanceOfUser(t, "U_ALICE");
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy, ["hedgehog"]);
    const afterFinish = await balanceOfUser(t, "U_ALICE");
    const given = await lastKudosGiven(t);
    await t.mutation(internal.quests.quests.followKudosGiven, { event: given });

    expect(gainsLineTo("U_ALICE")).toContain(questDone);
    expect(await rewardRecordsOf(t, "U_ALICE")).toEqual([{ xp: 40, coins: 20, item: null, catalogueVersion: "2", at: given.at }]);
    expect(afterFinish - before).toBeGreaterThanOrEqual(20);
    expect(await balanceOfUser(t, "U_ALICE")).toBe(afterFinish);
    await openHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain(yourEmojiDone);
  });

  test("a kudos that says why with only the workspace's emoji doesn't finish it, and neither does a 🦔 kudos that doesn't say why", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);

    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy, ["taco"]);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], "thanks", ["hedgehog"]);

    expect(await rewardRecordsOf(t, "U_ALICE")).toEqual([]);
    expect(slack.ephemeralsTo("U_ALICE").map(({ text }) => String(text)).join("\n")).not.toContain("with one of your kudos emoji");
  });

  test("with every slot empty, the hint asks to put an emoji in a slot first", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "takeOff", slot: "emoji-1" })));

    await openHome(t, "U_ALICE");

    expect(journeyStepOf(publishedHome(slack, "U_ALICE"), yourEmojiActive)).toEqual([yourEmojiActive, emptySlotsHint]);
  });

  test("a kudos with 🦔 processed before the Coins opening's activation still finishes the step, activated at that kudos", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    await activationForgotten(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);

    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy, ["hedgehog"]);

    const { at } = await lastKudosGiven(t);
    expect(gainsLineTo("U_ALICE")).toContain(questDone);
    expect(await yourEmojiFactsOf(t, "U_ALICE")).toMatchObject({ activatedAt: at, finishedAt: at });
  });

  test("a member who opened Coins before the store was on for them gets the step at the App Home publish after it turns on, with no DM", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_CAROL");
    await openHome(t, "U_CAROL");
    expect(publishedHome(slack, "U_CAROL")).not.toContain(yourEmojiActive);
    const dmsBefore = dmsTo("U_CAROL").length;

    await flagsFromPostHog(t, postHog, ...previewedByAliceAndCarol);
    vi.setSystemTime(tuesday + dayMs);
    await openHome(t, "U_CAROL");

    expect(journeyStepOf(publishedHome(slack, "U_CAROL"), yourEmojiActive)).toEqual([yourEmojiActive, hedgehogHint]);
    const facts = await yourEmojiFactsOf(t, "U_CAROL");
    expect(facts?.activatedAt).toBeGreaterThanOrEqual(tuesday + dayMs);
    expect(facts?.finishedAt).toBeNull();
    expect(dmsTo("U_CAROL")).toHaveLength(dmsBefore);
  });
});

describe("ST19 ST22: dark where the store isn't shown", { timeout: 60_000 }, () => {
  test("with store off, no member has the step and questsOf lists the Journey without it", async () => {
    const t = await workspaceDeciding(...storeOff);
    await coinsOpenedBy(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy, ["hedgehog", "taco"]);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toContain("with one of your kudos emoji");
    expect((await questsOfUser(t, "U_ALICE"))!.journey.map(({ step }) => step)).not.toContain("your-emoji");
    expect(await activationsOf(t, "U_ALICE")).not.toContain("your-emoji");
    expect(await rewardRecordsOf(t, "U_ALICE")).toEqual([]);
  });

  test("turning store off after the step finished hides its line and crate, refuses a stale Open, and keeps its reward recorded", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await coinsOpenedBy(t, "U_ALICE");
    vi.setSystemTime(tuesday + dayMs);
    await giveKudos(t, "U_ALICE", ["U_CAROL"], saysWhy, ["hedgehog"]);
    const { at } = await lastKudosGiven(t);

    await flagsFromPostHog(t, postHog, ...storeOff);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", staleButtonOf({ type: "openQuestCrate", quest: { kind: "journey", step: "your-emoji" } })));

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toContain("with one of your kudos emoji");
    expect((await questsOfUser(t, "U_ALICE"))!.journey.map(({ step }) => step)).not.toContain("your-emoji");
    expect(await crateOpeningsOf(t, "U_ALICE")).toEqual([]);
    expect(await rewardRecordsOf(t, "U_ALICE")).toEqual([{ xp: 40, coins: 20, item: null, catalogueVersion: "2", at }]);
  });
});

async function coinsOpenedBy(t: Backend, user: string) {
  await giveKudos(t, user, ["U_BOB"], saysWhy);
  await xpOf(t, user, xpBelowLevelSix);
  await giveKudos(t, user, ["U_BOB"], saysWhy);
  await send(t, blockActions(user, staleButtonOf({ type: "openUnlock", feature: "coins" })));
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_ALICE", { profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withMember("U_CAROL", { profile: { email: carolsEmail } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function giveKudos(t: Backend, giver: string, recipients: string[], words: string, emojiNames = ["taco"]) {
  sentMessages += 1;
  const blocks = [section(...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), text(`${words} `), ...emojiNames.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}

async function xpOf(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function activationForgotten(t: Backend, user: string) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const activation = await ctx.db
      .query("journeySteps")
      .withIndex("by_member_step", (q) => q.eq("member", member).eq("step", "your-emoji"))
      .unique();
    await ctx.db.delete(activation!._id);
  });
}

async function activationsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("journeySteps").collect()).filter((row) => row.member === member).map(({ step }) => step));
}

async function rewardRecordsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) =>
    (await ctx.db.query("rewardRecords").collect())
      .filter((record) => record.member === member && record.key === yourEmojiKey)
      .map(({ xp, coins, item, catalogueVersion, at }) => ({ xp, coins, item, catalogueVersion, at })),
  );
}

async function crateOpeningsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("crateOpenings").collect()).filter((opening) => opening.member === member && opening.key === yourEmojiKey));
}

async function questsOfUser(t: Backend, user: string) {
  return t.query(internal.quests.quests.questsOf, { member: await memberOf(t, user) });
}

async function yourEmojiFactsOf(t: Backend, user: string) {
  return (await questsOfUser(t, user))?.journey.find(({ step }) => step === "your-emoji");
}

async function balanceOfUser(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => balanceOf(ctx, member));
}

async function lastKudosGiven(t: Backend): Promise<KudosGivenEvent> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name.endsWith(":recordKudosGiven")).map(({ args }) => (args[0] as { event: KudosGivenEvent }).event).at(-1)!;
}

function journeyStepOf(home: string[], line: string) {
  const start = home.indexOf(line);
  return start === -1 ? [] : home.slice(start, start + 2);
}

function dmsTo(user: string) {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && !String(text).startsWith("👋 Welcome"));
}

function gainsLineTo(user: string) {
  return String(slack.ephemeralsTo(user).at(-1)?.text).split("\n").at(-1);
}
