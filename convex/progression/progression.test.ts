import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { channel, emoji, link, list, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { DomainEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { observe, recheck } from "../engine/engine";
import { standingOf } from "./progression";
import type { Mention, MessageEvent } from "../engine/messageEvent";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubGlobal("fetch", new FakeSlack().withMember("U_ALICE").withMember("U_BOB").fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("P1 P7: a Given award writes one giver record with 10 XP per kudos and one recipient record with 5, each with the gate decision and catalogue version", async () => {
  const t = await withDirectory("U_ALICE", "U_BOB", "U_CAROL");

  await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", ["U_BOB", "U_CAROL"], ["taco"], "thanks for untangling the release notes today")));
  await settle(t);

  const thoughtful = { version: 1, thoughtful: true };
  expect(await effectsRecords(t)).toEqual([
    { member: "U_ALICE", side: "giver", baseXp: 10, gate: thoughtful, catalogueVersion: "1", day: "2026-10-13" },
    { member: "U_ALICE", side: "giver", baseXp: 10, gate: thoughtful, catalogueVersion: "1", day: "2026-10-13" },
    { member: "U_BOB", side: "recipient", baseXp: 5, gate: thoughtful, catalogueVersion: "1", day: "2026-10-13" },
    { member: "U_CAROL", side: "recipient", baseXp: 5, gate: thoughtful, catalogueVersion: "1", day: "2026-10-13" },
  ]);
});

test("P8 P6: delivering the same kudosGiven twice, or retrying the subscriber, leaves one record per side, counts the XP once and reaches a level once", async () => {
  const t = await withDirectory("U_ALICE", "U_BOB");
  await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", ["U_BOB"], ["taco", "taco"], "thanks")));
  await settle(t);
  const [kudosGiven] = publishedEvents("kudosGiven");

  await t.mutation(internal.progression.progression.recordEffects, { event: kudosGiven! });
  await t.mutation(internal.progression.progression.recordEffects, { event: kudosGiven! });

  expect((await effectsRecords(t)).map(({ member, side, baseXp }) => ({ member, side, baseXp }))).toEqual([
    { member: "U_ALICE", side: "giver", baseXp: 20 },
    { member: "U_BOB", side: "recipient", baseXp: 10 },
  ]);
  expect(await standings(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: { xp: 20, level: 2, skillPoints: 0 }, U_BOB: { xp: 10, level: 1, skillPoints: 0 } });
  expect(publishedEvents("levelReached")).toEqual([
    {
      type: "levelReached",
      workspace: "T1",
      member: kudosGiven!.giver,
      level: 2,
      skillPointsGained: 0,
      skillPoints: 0,
      xpToNextLevel: 80,
      message: kudosGiven!.message,
      at: kudosGiven!.at,
    },
  ]);
});

test("P11: mentions, emoji, channel links and URLs in a Slack message don't count as words", async () => {
  const t = testBackend();
  const words = [text("thanks "), mention("U_BOB"), text(" for "), link("https://example.com/runbook", "the runbook"), text(" in "), channel("C_OPS"), text(" ")];

  await post(t, [section(...words, emoji("taco"), emoji("tada"))], { user: "U_ALICE" });
  await settle(t);

  const [kudosGiven] = publishedEvents("kudosGiven");
  expect(kudosGiven?.annotations.gate).toEqual({ version: 1, thoughtful: false, words: 3 });
});

test("P11: list items and paragraphs of a Slack message are separate words", async () => {
  const t = testBackend();

  await post(t, [list(section(text("thanks for")), section(text("the great fix"))), section(mention("U_BOB"), emoji("taco"))], { user: "U_ALICE" });
  await settle(t);

  const [kudosGiven] = publishedEvents("kudosGiven");
  expect(kudosGiven?.annotations.gate).toEqual({ version: 1, thoughtful: true, words: 5 });
});

describe("P12: the gate is decided once per revision", () => {
  test("a recheck after a directory wait reuses the decision made from the text", async () => {
    const t = await withDirectory("U_ALICE");
    const message = kudosMessage("U_ALICE", ["U_DANA"], ["taco"], "thanks for covering my on-call shift");
    await t.run((ctx) => observe(ctx, message));
    await withDirectoryEntries(t, "U_DANA");

    await t.run((ctx) => recheck(ctx, message.ref, message.revision));
    await settle(t);

    const [kudosGiven] = publishedEvents("kudosGiven");
    expect(kudosGiven?.annotations.gate).toEqual({ version: 1, thoughtful: true, words: 6 });
  });

  test("a prose edit while the message waits on the directory keeps the decision of the attempt that waits", async () => {
    const t = await withDirectory("U_ALICE");
    const message = kudosMessage("U_ALICE", ["U_DANA"], ["taco"], "thanks");
    await t.run((ctx) => observe(ctx, message));
    await t.run((ctx) => observe(ctx, editOf(kudosMessage("U_ALICE", ["U_DANA"], ["taco"], "thanks for covering my on-call shift"), 60_000)));
    await withDirectoryEntries(t, "U_DANA");

    await t.run((ctx) => recheck(ctx, message.ref, message.revision));
    await settle(t);

    const [kudosGiven] = publishedEvents("kudosGiven");
    expect(kudosGiven?.annotations.gate).toEqual({ version: 1, thoughtful: false, words: 1 });
  });

  test("a retry decides again from its own text", async () => {
    const t = await withDirectory("U_ALICE", "U_BOB");
    const overAllowance = kudosMessage("U_ALICE", ["U_BOB"], ["taco", "taco", "taco", "taco"], "thanks");
    await t.run((ctx) => observe(ctx, overAllowance));

    await t.run((ctx) => observe(ctx, editOf(kudosMessage("U_ALICE", ["U_BOB"], ["taco"], "thanks for pairing on the flaky test"), 60_000)));
    await settle(t);

    const [kudosGiven] = publishedEvents("kudosGiven");
    expect(kudosGiven?.annotations.gate).toEqual({ version: 1, thoughtful: true, words: 7 });
  });

  test("editing a Given message changes neither its records nor the XP it earned", async () => {
    const t = await withDirectory("U_ALICE", "U_BOB");
    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", ["U_BOB"], ["taco"], "thanks")));
    await settle(t);
    const before = await effectsRecords(t);

    await t.run((ctx) => observe(ctx, editOf(kudosMessage("U_ALICE", ["U_BOB"], ["taco"], "thanks for staying late to finish the migration"), 60_000)));
    await settle(t);

    expect(await effectsRecords(t)).toEqual(before);
    expect(before.map(({ gate }) => gate)).toEqual([
      { version: 1, thoughtful: false },
      { version: 1, thoughtful: false },
    ]);
    expect(await standings(t, "U_ALICE", "U_BOB")).toEqual({ U_ALICE: { xp: 10, level: 1, skillPoints: 0 }, U_BOB: { xp: 5, level: 1, skillPoints: 0 } });
  });
});

async function withDirectory(...users: string[]) {
  const t = testBackend();
  await withDirectoryEntries(t, ...users);
  return t;
}

async function withDirectoryEntries(t: Backend, ...users: string[]) {
  await t.run(async (ctx) => {
    for (const user of users) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
  });
}

function kudosMessage(author: string, recipients: string[], emoji: string[], text: string, message = "1"): MessageEvent {
  const mentions: Mention[] = recipients.map((user) => ({ kind: "person", user }));
  return {
    kind: "posted",
    ref: { workspace: "T1", conversation: "C1", message },
    author,
    revision: BigInt(now.getTime()) * 1000n,
    at: now.getTime(),
    content: { mentions, emoji, text },
    words: { segments: [{ kind: "text", text: text }], visibility: "public" },
  };
}

function editOf(event: MessageEvent, laterByMs: number): MessageEvent {
  const at = event.at + laterByMs;
  return { ...event, kind: "edited", revision: BigInt(at) * 1000n, at };
}

async function effectsRecords(t: Backend) {
  return t.run(async (ctx) => {
    const records = await ctx.db.query("effectsRecords").collect();
    const readable = await Promise.all(
      records.map(async ({ member, side, baseXp, gate, catalogueVersion, day }) => ({
        member: (await ctx.db.get(member))?.user,
        side,
        baseXp,
        gate,
        catalogueVersion,
        day,
      })),
    );
    return readable.sort((a, b) => `${a.member}${a.side}`.localeCompare(`${b.member}${b.side}`));
  });
}

function publishedEvents<T extends DomainEvent["type"]>(type: T) {
  const events = vi.mocked(publish).mock.calls.map(([, event]) => event);
  return events.filter((event): event is Extract<DomainEvent, { type: T }> => event.type === type);
}

async function standings(t: Backend, ...users: string[]) {
  return t.run(async (ctx) => {
    const entries = await Promise.all(
      users.map(async (user) => {
        const member = await ctx.db
          .query("members")
          .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
          .unique();
        return [user, await standingOf(ctx, member!._id)] as const;
      }),
    );
    return Object.fromEntries(entries);
  });
}
