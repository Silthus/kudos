import { describe, expect, test } from "vitest";
import { awardId, kudosGivenEvent } from "../../testing/busEvents";
import type { AttemptFailedEvent, KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { projectAttemptFailed, projectKudosGiven, projectMemberWelcomed, projectUsage } from "./projections";

const alice = "alice" as MemberId;
const bob = "bob" as MemberId;
const carol = "carol" as MemberId;
const at = Date.parse("2026-10-13T10:00:00Z");

function kudosGiven(overrides: Partial<KudosGivenEvent> = {}): KudosGivenEvent {
  return kudosGivenEvent(alice, bob, { annotations: { note: "thanks for the quokka migration" }, at, ...overrides });
}

describe("O3: kudos given", () => {
  test.each<[string, Partial<KudosGivenEvent>, Record<string, unknown>]>([
    ["one recipient, one kudos", {}, { recipients: 1, kudos_per_recipient: 1, kudos_total: 1, daily_allowance_left: 2 }],
    [
      "two recipients, two kudos each",
      { awards: [{ award: awardId(bob), giver: alice, recipient: bob, kudos: 2 }, { award: awardId(carol), giver: alice, recipient: carol, kudos: 2 }], allowance: { dailyOpening: 5, dailyLeft: 1 } },
      { recipients: 2, kudos_per_recipient: 2, kudos_total: 4, daily_allowance_opening: 5, daily_allowance_left: 1 },
    ],
    ["skipped mentions", { skippedMentions: 3 }, { skipped_mentions: 3 }],
    ["a retry in a thread", { retry: true, inThread: true }, { retry: true, in_thread: true }],
    ["the default kudos emoji", { kudosEmoji: "taco" }, { default_kudos_emoji: true }],
    ["a workspace's own kudos emoji", { kudosEmoji: "pizza" }, { default_kudos_emoji: false }],
    ["E3: a gate decision that says why", { annotations: { gate: { version: 1, thoughtful: true, words: 7 } } }, { thoughtful: true }],
    ["E3: a gate decision that doesn't say why", { annotations: { gate: { version: 1, thoughtful: false, words: 2 } } }, { thoughtful: false }],
    ["E3: no gate decision", { annotations: { note: "thanks for the quokka migration" } }, { thoughtful: false }],
  ])("%s", (_, overrides, expected) => {
    const [given] = projectKudosGiven(kudosGiven(overrides));

    expect(given).toMatchObject({ event: "kudos given", subject: { member: alice }, at, properties: expected });
  });

  test("O11 E3: kudos given lists exactly O3's properties and thoughtful, never the gate's word count", () => {
    const [given] = projectKudosGiven(kudosGiven({ annotations: { gate: { version: 1, thoughtful: true, words: 7 } } }));

    expect(Object.keys(given!.properties).sort()).toEqual(
      ["daily_allowance_left", "daily_allowance_opening", "default_kudos_emoji", "in_thread", "kudos_per_recipient", "kudos_total", "recipients", "retry", "skipped_mentions", "thoughtful"].sort(),
    );
    expect(Object.values(given!.properties)).not.toContain(7);
  });
});

describe("O3: kudos received", () => {
  test("one per award, on the recipient, with its kudos and whether the attempt was a retry", () => {
    const event = kudosGiven({ awards: [{ award: awardId(bob), giver: alice, recipient: bob, kudos: 2 }, { award: awardId(carol), giver: alice, recipient: carol, kudos: 2 }], retry: true });

    expect(projectKudosGiven(event).slice(1)).toEqual([
      { event: "kudos received", subject: { member: bob }, at, properties: { kudos: 2, retry: true } },
      { event: "kudos received", subject: { member: carol }, at, properties: { kudos: 2, retry: true } },
    ]);
  });
});

function attemptFailed(overrides: Partial<AttemptFailedEvent> = {}): AttemptFailedEvent {
  return {
    type: "attemptFailed",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" },
    giver: alice,
    outcome: "over-allowance",
    recipients: 2,
    perRecipient: 2,
    cost: 4,
    skippedMentions: 1,
    retry: true,
    inThread: true,
    allowance: { dailyLeft: 3 },
    day: "2026-10-13",
    at,
    ...overrides,
  };
}

describe("O3: attempt failed", () => {
  test.each<[string, Partial<AttemptFailedEvent>, Record<string, unknown>]>([
    [
      "Over allowance",
      {},
      { outcome: "over allowance", recipients: 2, kudos_per_recipient: 2, kudos_total: 4, skipped_mentions: 1, retry: true, in_thread: true, daily_allowance_left: 3 },
    ],
    [
      "Invalid",
      { outcome: "invalid", recipients: 0, perRecipient: 1, cost: 0, retry: false, inThread: false },
      { outcome: "invalid", recipients: 0, kudos_per_recipient: 1, kudos_total: 0, skipped_mentions: 1, retry: false, in_thread: false, daily_allowance_left: 3 },
    ],
  ])("%s lists exactly O3's properties, on the giver at the spend instant", (_, overrides, properties) => {
    expect(projectAttemptFailed(attemptFailed(overrides))).toEqual({ event: "attempt failed", subject: { member: alice }, at, properties });
  });
});

describe("O3: member welcomed", () => {
  test.each(["giver", "recipient"] as const)("as %s", (as) => {
    expect(projectMemberWelcomed({ type: "memberWelcomed", workspace: "T1", member: bob, as, at })).toEqual({
      event: "member welcomed",
      subject: { member: bob },
      at,
      properties: { as },
    });
  });
});

describe("O3: usage facts", () => {
  test("app home opened carries no properties of its own", () => {
    expect(projectUsage({ kind: "appHomeOpened", workspace: "T1", member: bob, at })).toEqual({ event: "app home opened", subject: { member: bob }, at, properties: {} });
  });

  test.each([
    ["joined", false, "joined"],
    ["already-in", true, "already in"],
    ["private-channel", false, "private channel"],
    ["direct-message", true, "direct message"],
  ] as const)("command used that ended %s, alias %s", (result, alias, name) => {
    expect(projectUsage({ kind: "commandUsed", workspace: "T1", member: bob, alias, result, at })).toEqual({
      event: "command used",
      subject: { member: bob },
      at,
      properties: { command: "hedgehug", alias, result: name },
    });
  });
});
