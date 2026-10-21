import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack, networkFailure, rateLimitedFor, slackError, type SlackUser } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { post, react, settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, type ReactionOptions } from "../../testing/slackMessages";
import { standingOf } from "../progression/progression";

const now = new Date("2026-10-13T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const alicesMessage = slackTs(now.getTime() - hourMs);
const alicesOtherMessage = slackTs(now.getTime() - 2 * hourMs);
const onboardingOn = ["hugs", "hidden-items", "onboarding"];
const toTheAuthor = (name: string) => `That was a hug: +1 XP for you and ${name}. Thank them in a message and say why to earn an item.`;
const toThePeopleThanked = "That was a hug: +1 XP for you and the people thanked. Thank them in a message and say why to earn an item.";

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE", { profile: { display_name: "Alice", real_name: "Alice Lee" } }).withMember("U_BOB").withMember("U_CAROL").withMember("U_DANA");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP73: a member's first hug ever gets one first-hug reply", () => {
  test("Bob's first hug on Alice's message tells only Bob, in its conversation and without a thread, what it did and how to earn an item", async () => {
    const t = await workspace(onboardingOn);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(slack.callsTo("chat.postEphemeral")).toEqual([{ channel: "C1", user: "U_BOB", text: toTheAuthor("Alice") }]);
    expect(slack.callsTo("chat.postMessage")).toEqual([]);
  });

  test.each<[string, Partial<SlackUser>, string]>([
    ["their display name", { profile: { display_name: "Ally", real_name: "Alice Lee" } }, "Ally"],
    ["their real name without a display name", { profile: { display_name: "", real_name: "Alice Lee" } }, "Alice Lee"],
    ["the author with only a Slack handle", { name: "alice" }, "the author"],
  ])("names the author by %s", async (_, alice, named) => {
    slack.withMember("U_ALICE", alice);
    const t = await workspace(onboardingOn);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(slack.ephemeralsTo("U_BOB").map(({ text }) => text)).toEqual([toTheAuthor(named)]);
  });

  test("Bob's first hug on a Given kudos message thanks the people thanked", async () => {
    const t = await workspace(onboardingOn);
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(slack.ephemeralsTo("U_BOB")).toEqual([{ channel: "C1", user: "U_BOB", text: toThePeopleThanked }]);
  });

  test.each<[string, (eventId: string) => ReactionOptions[]]>([
    ["a second hug on another message", () => [{}, { ts: alicesOtherMessage }]],
    ["a redelivered reaction", (eventId) => [{ eventId }, { eventId }]],
    ["the reaction removed and added again", () => [{}, { type: "reaction_removed" }, {}]],
  ])("%s sends nothing more", async (_, reactions) => {
    const t = await workspace(onboardingOn);

    for (const options of reactions("Ev-first-hug")) await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ...options });

    expect(slack.ephemeralsTo("U_BOB")).toHaveLength(1);
  });

  test("a member who hugged before onboarding was on for them gets none for their next hug", async () => {
    const t = await workspace(["hugs", "hidden-items"]);
    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ts: alicesOtherMessage });
    await flagsOn(t, onboardingOn);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(slack.callsTo("chat.postEphemeral")).toEqual([]);
  });

  test("Alice, hugged, gets no reply: only the giver's first hug answers", async () => {
    const t = await workspace(onboardingOn);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(slack.ephemeralsTo("U_ALICE")).toEqual([]);
  });

  test.each([
    ["Bob not in the channel", slackError("user_not_in_channel")],
    ["the channel gone", slackError("channel_not_found")],
    ["an unknown answer", networkFailure],
  ])("with %s it is tried once and sends nothing else, ever", async (_, answer) => {
    slack.answering("chat.postEphemeral", answer);
    const t = await workspace(onboardingOn);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });
    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ts: alicesOtherMessage });

    expect(slack.callsTo("chat.postEphemeral")).toHaveLength(1);
    expect(slack.callsTo("chat.postMessage")).toEqual([]);
  });

  test("a rate limit holds it, and it goes out once the limit lifts", async () => {
    slack.answering("chat.postEphemeral", rateLimitedFor(30));
    const t = await workspace(onboardingOn);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(slack.callsTo("chat.postEphemeral")).toHaveLength(2);
    expect(slack.ephemeralsTo("U_BOB").at(-1)).toEqual({ channel: "C1", user: "U_BOB", text: toTheAuthor("Alice") });
    expect(slack.timesOf("chat.postEphemeral")[1]! - slack.timesOf("chat.postEphemeral")[0]!).toBeGreaterThanOrEqual(30_000);
  });

  test.each([
    ["onboarding is off", ["hugs", "hidden-items"]],
    ["hidden-items is off", ["hugs", "onboarding"]],
  ])("while %s, a first hug is given and sends nothing, as before", async (_, flags) => {
    const t = await workspace(flags);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(await xpOf(t, "U_BOB")).toBe(1);
    expect(await xpOf(t, "U_ALICE")).toBe(1);
    expect(slack.callsTo("chat.postEphemeral")).toEqual([]);
    expect(slack.callsTo("chat.postMessage")).toEqual([]);
  });
});

async function workspace(flags: string[]) {
  const t = testBackend();
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  return flagsOn(t, flags);
}

function flagsOn(t: Backend, flags: string[]) {
  flagsOnForEveryone(slack.fetch, ...flags);
  return flagsLoaded(t);
}

async function hug(t: Backend, options: ReactionOptions) {
  await react(t, { ts: alicesMessage, ...options });
  await settle(t);
}

async function kudos(t: Backend, giver: string, recipients: string[]) {
  await post(t, [section(...recipients.map((user) => mention(user)), emoji("taco"))], { user: giver, ts: alicesMessage });
  await settle(t);
}

async function xpOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member === null ? 0 : (await standingOf(ctx, member._id)).xp;
  });
}

function slackTs(at: number) {
  return `${Math.floor(at / 1000)}.000100`;
}
