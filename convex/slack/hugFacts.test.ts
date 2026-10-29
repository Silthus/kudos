import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { post, react, settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, type ReactionOptions } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { DomainEvent } from "../bus/events";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";

const published = vi.hoisted(() => [] as Array<{ type: string }>);

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return {
    ...actual,
    publish: async (...args: Parameters<typeof actual.publish>) => {
      published.push(args[1]);
      return actual.publish(...args);
    },
  };
});

const now = new Date("2026-10-13T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const messageTs = slackTs(now.getTime() - hourMs);
const message = { workspace: "T1", conversation: "C1", message: messageTs };

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL", { tz: "Pacific/Kiritimati" }).withMember("U_DANA", { tz: "Pacific/Pago_Pago" });
  postHog = flagsOnForEveryone(slack.fetch, "hugs");
  published.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH19: a recipient's hug on the kudos they received hugs it back to its author", () => {
  test("Carol's hug on Alice's kudos to her and Dana pays Alice and Carol, and Dana nothing", async () => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"]);
    const before = await xpOfEveryone(t);

    await hug(t, { user: "U_CAROL", itemUser: "U_ALICE" });

    expect(await xpOfEveryone(t)).toEqual({ ...before, U_ALICE: before.U_ALICE + 1, U_CAROL: before.U_CAROL + 1 });
    expect(factsOf("hugGiven")).toEqual([expect.objectContaining({ giver: await memberOf(t, "U_CAROL"), author: await memberOf(t, "U_ALICE"), onKudos: false })]);
    expect(hugsGiven()).toHaveLength(1);
  });

  test("the author's own reaction on their kudos still does nothing", async () => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL"]);
    const before = await xpOfEveryone(t);

    await hug(t, { user: "U_ALICE", itemUser: "U_ALICE" });

    expect(await xpOfEveryone(t)).toEqual(before);
    expect(factsOf("hugGiven")).toEqual([]);
  });
});

describe("HH19 HH21: a member's hype emoji the giver doesn't hold is a hype reaction", () => {
  test("Bob's :carol-hype: on Alice's message hugs nobody and publishes who reacted with whose emoji on whose message", async () => {
    const t = await workspace();
    const carol = await hypeEmojiOf(t, "U_CAROL", "carol-hype");

    const eventTs = "1791885600.000200";
    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: "carol-hype::skin-tone-2", eventTs });

    expect(await xpOfEveryone(t)).toEqual({ U_ALICE: 0, U_BOB: 0, U_CAROL: 0, U_DANA: 0 });
    expect(hugsGiven()).toEqual([]);
    expect(factsOf("hugGiven")).toEqual([]);
    expect(factsOf("hypeReacted")).toEqual([
      { type: "hypeReacted", workspace: "T1", giver: await memberOf(t, "U_BOB"), owner: carol, author: await memberOf(t, "U_ALICE"), emoji: "carol-hype", message, at: Number(eventTs) * 1000 },
    ]);
  });

  test("a hype emoji whose owner reacts with it does nothing", async () => {
    const t = await workspace();
    await hypeEmojiOf(t, "U_BOB", "bob-hype");

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: "bob-hype" });

    expect(factsOf("hypeReacted")).toEqual([]);
    expect(factsOf("hugGiven")).toEqual([]);
  });

  test.each<[string, ReactionOptions]>([
    ["more than 24 hours after the message", { ts: slackTs(now.getTime() - 24 * hourMs) }],
    ["on one's own message", { itemUser: "U_BOB" }],
  ])("a hype reaction %s does nothing", async (_, options) => {
    const t = await workspace();
    await hypeEmojiOf(t, "U_CAROL", "carol-hype");

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: "carol-hype", ...options });

    expect(factsOf("hypeReacted")).toEqual([]);
  });

  test("while hugs is off for the giver, a hype reaction publishes nothing", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, offForEveryone("hugs"));
    await hypeEmojiOf(t, "U_CAROL", "carol-hype");

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: "carol-hype" });

    expect(factsOf("hypeReacted")).toEqual([]);
  });

  test("an emoji no member owns, ending in -hype, is no hype reaction", async () => {
    const t = await workspace();

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: "nobody-hype" });

    expect(factsOf("hypeReacted")).toEqual([]);
  });
});

describe("HH20: the hug facts", () => {
  test("a hug on an ordinary message names its author, the reaction without its skin tone, and whether it is the giver's first", async () => {
    const t = await workspace();

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", reaction: "taco::skin-tone-3" });
    await hug(t, { user: "U_BOB", itemUser: "U_CAROL", ts: slackTs(now.getTime() - 2 * hourMs) });

    const alice = await memberOf(t, "U_ALICE");
    expect(factsOf("hugGiven").map(({ author, reaction, first }) => ({ author, reaction, first }))).toEqual([
      { author: alice, reaction: "taco", first: true },
      { author: await memberOf(t, "U_CAROL"), reaction: "taco", first: false },
    ]);
  });

  test("a hug on a Given kudos message names no author", async () => {
    const t = await workspace();
    await kudos(t, "U_ALICE", ["U_CAROL"]);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE" });

    expect(factsOf("hugGiven")).toEqual([expect.not.objectContaining({ author: expect.anything() })]);
  });

  test("each paid person is published once as hugReceived, in their own week, even when the hug is delivered again", async () => {
    vi.setSystemTime(mondayMorningInKiritimati);
    const t = await workspace();
    const ts = slackTs(mondayMorningInKiritimati - hourMs);
    await kudos(t, "U_ALICE", ["U_CAROL", "U_DANA"], ts);

    await hug(t, { user: "U_BOB", itemUser: "U_ALICE", ts });
    await t.mutation(internal.hugs.people.payHugPeople, { event: factsOf("hugGiven")[0]! });
    await settle(t);

    const giver = await memberOf(t, "U_BOB");
    const hugged = { ...message, message: ts };
    const { at } = factsOf("hugGiven")[0]!;
    expect(factsOf("hugReceived").toSorted((a, b) => a.week.localeCompare(b.week))).toEqual([
      { type: "hugReceived", workspace: "T1", giver, person: await memberOf(t, "U_DANA"), message: hugged, at, week: "2026-10-12" },
      { type: "hugReceived", workspace: "T1", giver, person: await memberOf(t, "U_CAROL"), message: hugged, at, week: "2026-10-19" },
    ]);
  });
});

const mondayMorningInKiritimati = new Date("2026-10-18T12:00:00Z").getTime();

async function workspace() {
  const t = testBackend();
  await setWorkspaceSettings(t, { kudosEmoji: "taco" });
  return flagsLoaded(t);
}

async function hug(t: Backend, options: ReactionOptions) {
  const response = await react(t, { ts: messageTs, ...options });
  await settle(t);
  return response;
}

async function kudos(t: Backend, giver: string, recipients: string[], ts = messageTs) {
  await post(t, [section(...recipients.map((user) => mention(user)), emoji("taco"))], { user: giver, ts });
  await settle(t);
}

async function hypeEmojiOf(t: Backend, user: string, name: string) {
  const person = await t.run(async (ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
  await t.run((ctx) => ctx.db.insert("emojiNames", { workspace: "T1", emoji: "hype", person, name }));
  return person;
}

function factsOf<T extends DomainEvent["type"]>(type: T) {
  return published.filter((event): event is Extract<DomainEvent, { type: T }> => event.type === type);
}

const everyone = ["U_ALICE", "U_BOB", "U_CAROL", "U_DANA"] as const;

async function xpOfEveryone(t: Backend): Promise<Record<(typeof everyone)[number], number>> {
  const [U_ALICE, U_BOB, U_CAROL, U_DANA] = await Promise.all(everyone.map((user) => xpOf(t, user)));
  return { U_ALICE: U_ALICE!, U_BOB: U_BOB!, U_CAROL: U_CAROL!, U_DANA: U_DANA! };
}

async function xpOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return member === null ? 0 : (await t.run((ctx) => standingOf(ctx, member))).xp;
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

function hugsGiven() {
  return postHog.events().filter(({ event }) => event === "hug given");
}

function slackTs(at: number) {
  return `${Math.floor(at / 1000)}.000100`;
}
