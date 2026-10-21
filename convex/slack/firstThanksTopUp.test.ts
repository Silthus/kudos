import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { edit, post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const onboardingOn = ["xp-levels", "hidden-items", "onboarding"];
const levelTwoDm = "🎉 You reached level 2!\nLevel 3 is 80 XP away.";

const deliverForReal = vi.mocked(publish).getMockImplementation()!;

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.mocked(publish).mockImplementation(deliverForReal);
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP70: the first-thanks top-up", { timeout: 60_000 }, () => {
  test.each([
    ["that says why", saysWhy],
    ["that doesn't say why", "thanks"],
  ])("a first kudos %s takes the giver to exactly level 2 with one level-up DM, and the recipient gets only the kudos' XP", async (_, words) => {
    const t = await workspaceWith(onboardingOn);

    await thank(t, "U_ALICE", ["U_BOB"], words);

    expect(await standing(t, "U_ALICE"), "the giver's standing after their first kudos").toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(await standing(t, "U_BOB"), "the recipient's standing").toEqual({ xp: 5, level: 1, skillPoints: 0 });
    expect(levelUpDms(), "the level-up DMs sent").toEqual([{ channel: "U_ALICE", text: levelTwoDm }]);
  });

  test("a redelivered kudosGiven and a retried subscriber pay the top-up once and send one level-up DM", async () => {
    const t = await workspaceWith(onboardingOn);
    const held = holdingKudosGiven();
    await thank(t, "U_ALICE", ["U_BOB"], saysWhy);
    vi.mocked(publish).mockImplementation(deliverForReal);

    for (let delivery = 0; delivery < 3; delivery += 1) {
      await t.mutation(internal.progression.progression.recordEffects, { event: held[0]! });
      await settle(t);
    }

    expect(await standing(t, "U_ALICE"), "the giver's standing after three deliveries").toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(levelUpDms(), "the level-up DMs sent").toEqual([{ channel: "U_ALICE", text: levelTwoDm }]);
  });

  test("a first kudos to more people than one recipient page reaches its level on its own XP, so the giver gets one level-up DM and no top-up on top", async () => {
    const recipients = Array.from({ length: 101 }, (_, index) => `U_R${index + 1}`);
    const t = await workspaceWith(onboardingOn, recipients);

    await thank(t, "U_ALICE", recipients, saysWhy);

    expect(await standing(t, "U_ALICE"), "the giver's standing after 101 awards").toEqual({ xp: 1010, level: 6, skillPoints: 2 });
    expect(levelUpDms().filter(({ channel }) => channel === "U_ALICE"), "the giver's level-up DMs").toHaveLength(1);
    expect(await firstThanksTopUpsOf(t, "U_ALICE"), "the first-thanks top-ups recorded").toEqual([]);
  });

  test("a giver already at level 2 when they give their first kudos records nothing on top of its XP", async () => {
    const t = await workspaceWith(onboardingOn);
    for (let kudos = 0; kudos < 4; kudos += 1) await thank(t, "U_BOB", ["U_ALICE"], saysWhy);

    await thank(t, "U_ALICE", ["U_CAROL"], saysWhy);

    expect(await standing(t, "U_ALICE"), "the giver's standing").toEqual({ xp: 30, level: 2, skillPoints: 0 });
    expect(levelUpDms().filter(({ channel }) => channel === "U_ALICE"), "the giver's level-up DMs").toEqual([{ channel: "U_ALICE", text: levelTwoDm }]);
    expect(await firstThanksTopUpsOf(t, "U_ALICE"), "the first-thanks top-ups recorded").toEqual([]);
  });

  test("a giver who received kudos first is topped up by only what they still lack of level 2", async () => {
    const t = await workspaceWith(onboardingOn);
    await thank(t, "U_BOB", ["U_ALICE"], saysWhy);

    await thank(t, "U_ALICE", ["U_CAROL"], saysWhy);

    expect(await standing(t, "U_ALICE"), "the giver's standing").toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(await firstThanksTopUpsOf(t, "U_ALICE"), "the first-thanks top-ups recorded").toEqual([{ xp: 5, coins: 0, item: null, catalogueVersion: "onboarding-1" }]);
  });

  test("a giver who gave before onboarding was on for them gets no top-up once it turns on, however they give again", async () => {
    const t = await workspaceWith(["xp-levels", "hidden-items"]);
    const first = await thank(t, "U_ALICE", ["U_BOB"], saysWhy);
    await flagsOnFor(t, onboardingOn);

    await editTo(t, "U_ALICE", first, ["U_BOB", "U_CAROL"]);
    await thank(t, "U_ALICE", ["U_CAROL"], saysWhy);

    expect(await standing(t, "U_ALICE"), "the giver's standing").toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(await firstThanksTopUpsOf(t, "U_ALICE"), "the first-thanks top-ups recorded").toEqual([]);
  });

  test("an edit of the first kudos message pays no second top-up", async () => {
    const t = await workspaceWith(onboardingOn);
    const first = await thank(t, "U_ALICE", ["U_BOB"], saysWhy);

    await editTo(t, "U_ALICE", first, ["U_BOB", "U_CAROL"]);

    expect(await standing(t, "U_ALICE"), "the giver's standing").toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(levelUpDms(), "the level-up DMs sent").toEqual([{ channel: "U_ALICE", text: levelTwoDm }]);
    expect(await firstThanksTopUpsOf(t, "U_ALICE"), "the first-thanks top-ups recorded").toEqual([{ xp: 10, coins: 0, item: null, catalogueVersion: "onboarding-1" }]);
  });

  test.each([
    ["onboarding is off", ["xp-levels", "hidden-items"]],
    ["hidden-items is off", ["xp-levels", "onboarding"]],
  ])("while %s, a first kudos pays its 10 XP as today and sends no level-up DM", async (_, flags) => {
    const t = await workspaceWith(flags);

    await thank(t, "U_ALICE", ["U_BOB"], saysWhy);

    expect(await standing(t, "U_ALICE"), "the giver's standing").toEqual({ xp: 10, level: 1, skillPoints: 0 });
    expect(levelUpDms(), "the level-up DMs sent").toEqual([]);
    expect(await firstThanksTopUpsOf(t, "U_ALICE"), "the first-thanks top-ups recorded").toEqual([]);
  });
});

async function workspaceWith(flags: string[], extraMembers: string[] = []) {
  for (const user of extraMembers) slack.withMember(user);
  flagsOnForEveryone(slack.fetch, ...flags);
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 1_000 }));
  return t;
}

async function flagsOnFor(t: Backend, flags: string[]) {
  flagsOnForEveryone(slack.fetch, ...flags);
  await flagsLoaded(t);
}

type Sent = { ts: string };

async function thank(t: Backend, giver: string, recipients: string[], words: string): Promise<Sent> {
  sentMessages += 1;
  vi.setSystemTime(Date.now() + 60_000);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(sentMessages).padStart(6, "0")}`;
  await post(t, blocksThanking(recipients, words), { user: giver, ts });
  await settleInTimeOrder(t);
  return { ts };
}

async function editTo(t: Backend, giver: string, { ts }: Sent, recipients: string[]) {
  vi.setSystemTime(Date.now() + 60_000);
  await edit(t, blocksThanking(recipients, saysWhy), { user: giver, ts, editedTs: `${Math.floor(Date.now() / 1000)}.000100` });
  await settleInTimeOrder(t);
}

function blocksThanking(recipients: string[], words: string) {
  return [section(text(`${words} `), ...recipients.flatMap((recipient) => [mention(recipient), text(" ")]), emoji("taco"))];
}

function holdingKudosGiven() {
  const held: KudosGivenEvent[] = [];
  vi.mocked(publish).mockImplementation(async (ctx, event) => {
    if (event.type === "kudosGiven") held.push(event);
    else await deliverForReal(ctx, event);
  });
  return held;
}

function levelUpDms() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ text }) => String(text).startsWith("🎉 You reached level"))
    .map(({ channel, text }) => ({ channel, text }));
}

async function standing(t: Backend, user: string) {
  return t.run(async (ctx) => standingOf(ctx, await memberOf(ctx, user)));
}

async function firstThanksTopUpsOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberOf(ctx, user);
    const rewards = await ctx.db
      .query("rewardRecords")
      .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", "first-thanks"))
      .collect();
    return rewards.map(({ xp, coins, item, catalogueVersion }) => ({ xp, coins, item, catalogueVersion }));
  });
}

async function memberOf(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}
