import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { observe } from "./engine";
import { homeFacts } from "./home";

const now = new Date("2026-10-13T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("R45 R46: homeFacts reads what App Home shows", () => {
  test("a member's facts are the allowance left of the base, the kudos emoji, and the kudos given and received this week and in total", async () => {
    const t = await withDirectory({ U_ALICE: "member", U_BOB: "member", U_CAROL: "member" });
    await give(t, "U_ALICE", "U_BOB", 2, "1");
    await give(t, "U_BOB", "U_CAROL", 1, "2");

    expect(await factsOf(t, "U_BOB")).toEqual({
      kind: "member",
      left: 2,
      base: 3,
      kudosEmoji: "taco",
      givenWeek: 1,
      receivedWeek: 2,
      given: 1,
      received: 2,
    });
  });

  test("a person the directory knows as not a member is told so", async () => {
    const t = await withDirectory({ U_GUEST: "not-a-member" });

    expect(await factsOf(t, "U_GUEST")).toEqual({ kind: "not-a-member" });
  });

  test("a person the directory doesn't know yet has no facts", async () => {
    const t = await withDirectory({});

    expect(await factsOf(t, "U_STRANGER")).toBeNull();
  });
});

async function withDirectory(people: Record<string, "member" | "not-a-member">) {
  const t = testBackend();
  await t.run(async (ctx) => {
    for (const [user, kind] of Object.entries(people)) await ctx.db.insert("members", { workspace: "T1", user, kind });
  });
  return t;
}

async function give(t: Backend, giver: string, recipient: string, kudos: number, message: string) {
  await t.run((ctx) =>
    observe(ctx, {
      kind: "posted",
      ref: { workspace: "T1", conversation: "C1", message },
      author: giver,
      revision: BigInt(now.getTime()) * 1000n,
      at: now.getTime(),
      content: { mentions: [{ kind: "person", user: recipient }], emoji: Array(kudos).fill("taco"), text: "thanks" },
    }),
  );
}

function factsOf(t: Backend, user: string) {
  return t.run((ctx) => homeFacts(ctx, "T1", user));
}
