import { describe, expect, test } from "vitest";
import type { KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { projectKudosGiven } from "./projections";

const alice = "alice" as MemberId;
const bob = "bob" as MemberId;
const carol = "carol" as MemberId;
const at = Date.parse("2026-10-13T10:00:00Z");

function kudosGiven(overrides: Partial<KudosGivenEvent> = {}): KudosGivenEvent {
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" },
    giver: alice,
    awards: [{ giver: alice, recipient: bob, kudos: 1 }],
    kudosEmoji: "taco",
    annotations: { note: "thanks for the quokka migration" },
    allowance: { dailyOpening: 3, dailyLeft: 2 },
    skippedMentions: 0,
    retry: false,
    inThread: false,
    day: "2026-10-13",
    at,
    ...overrides,
  };
}

describe("O3: kudos given", () => {
  test.each<[string, Partial<KudosGivenEvent>, Record<string, unknown>]>([
    ["one recipient, one kudos", {}, { recipients: 1, kudos_per_recipient: 1, kudos_total: 1, daily_allowance_left: 2 }],
    [
      "two recipients, two kudos each",
      { awards: [{ giver: alice, recipient: bob, kudos: 2 }, { giver: alice, recipient: carol, kudos: 2 }], allowance: { dailyOpening: 5, dailyLeft: 1 } },
      { recipients: 2, kudos_per_recipient: 2, kudos_total: 4, daily_allowance_opening: 5, daily_allowance_left: 1 },
    ],
    ["skipped mentions", { skippedMentions: 3 }, { skipped_mentions: 3 }],
    ["a retry in a thread", { retry: true, inThread: true }, { retry: true, in_thread: true }],
    ["the default kudos emoji", { kudosEmoji: "taco" }, { default_kudos_emoji: true }],
    ["a workspace's own kudos emoji", { kudosEmoji: "pizza" }, { default_kudos_emoji: false }],
  ])("%s", (_, overrides, expected) => {
    const [given] = projectKudosGiven(kudosGiven(overrides));

    expect(given).toMatchObject({ event: "kudos given", subject: { member: alice }, at, properties: expected });
  });

  test("O11: kudos given lists exactly O3's properties", () => {
    const [given] = projectKudosGiven(kudosGiven());

    expect(Object.keys(given!.properties).sort()).toEqual(
      ["daily_allowance_left", "daily_allowance_opening", "default_kudos_emoji", "in_thread", "kudos_per_recipient", "kudos_total", "recipients", "retry", "skipped_mentions"].sort(),
    );
  });
});

describe("O3: kudos received", () => {
  test("one per award, on the recipient, with its kudos and whether the attempt was a retry", () => {
    const event = kudosGiven({ awards: [{ giver: alice, recipient: bob, kudos: 2 }, { giver: alice, recipient: carol, kudos: 2 }], retry: true });

    expect(projectKudosGiven(event).slice(1)).toEqual([
      { event: "kudos received", subject: { member: bob }, at, properties: { kudos: 2, retry: true } },
      { event: "kudos received", subject: { member: carol }, at, properties: { kudos: 2, retry: true } },
    ]);
  });
});
