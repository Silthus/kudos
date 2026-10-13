import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { publish } from "../bus/publish";
import schema from "../schema";
import { modules } from "../test.setup";
import { observe } from "./engine";
import type { Mention, MessageEvent } from "./messageEvent";

vi.mock("../bus/publish", () => ({ publish: vi.fn(async () => {}) }));

const now = new Date("2026-10-13T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Given", () => {
  test("R4 R8 R11 R15 R18: one award per recipient with n kudos each, paid from the daily allowance", async () => {
    const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC", U_CAROL: "UTC" });

    const observation = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB"), person("U_CAROL")], ["taco"])));

    expect(observation).toMatchObject({ kind: "evaluated", outcome: { kind: "given", kudosEmoji: "taco", left: 1 } });
    expect(await awardsOf(t)).toEqual([
      { giver: "U_ALICE", recipient: "U_BOB", kudos: 1, day: "2026-10-13" },
      { giver: "U_ALICE", recipient: "U_CAROL", kudos: 1, day: "2026-10-13" },
    ]);
  });

  test("R4: every kudos emoji occurrence gives each recipient one more kudos, and the cost is recipients × n", async () => {
    const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC" });

    const observation = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], ["taco", "taco", "taco"])));

    expect(observation).toMatchObject({ outcome: { kind: "given", left: 0 } });
    expect(await awardsOf(t)).toEqual([{ giver: "U_ALICE", recipient: "U_BOB", kudos: 3, day: "2026-10-13" }]);
  });

  test("R8: recipients are other members in the order they first appear, each receiving once", async () => {
    const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC", U_CAROL: "UTC" });

    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_CAROL"), person("U_ALICE"), person("U_BOB"), person("U_CAROL")], ["taco"])));

    expect((await awardsOf(t)).map((award) => award.recipient)).toEqual(["U_CAROL", "U_BOB"]);
  });

  test("R15: a message costing more than the daily allowance left gives nothing and spends nothing", async () => {
    const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC", U_CAROL: "UTC" });

    const observation = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB"), person("U_CAROL")], ["taco", "taco"])));
    const after = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], ["taco", "taco", "taco"], { message: "2" })));

    expect(observation).toMatchObject({ outcome: { kind: "over-allowance", cost: 4, recipients: 2, perRecipient: 2, left: 3 } });
    expect(after).toMatchObject({ outcome: { kind: "given", left: 0 } });
    expect(await awardsOf(t)).toEqual([{ giver: "U_ALICE", recipient: "U_BOB", kudos: 3, day: "2026-10-13" }]);
  });

  test("R11: the daily allowance opens at the workspace base", async () => {
    const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC" });
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", baseAllowance: 5 }));

    const observation = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], ["taco", "taco", "taco", "taco"])));

    expect(observation).toMatchObject({ outcome: { kind: "given", left: 1 } });
  });

  test("R10: a kudos message whose mentions are all skipped gives nothing", async () => {
    const t = await withDirectory({ U_ALICE: "UTC" });

    const observation = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_ALICE"), { kind: "broadcast" }], ["taco"])));

    expect(observation).toMatchObject({ outcome: { kind: "invalid" } });
    expect(await awardsOf(t)).toEqual([]);
  });
});

describe("R12 R13: the allowance day follows the giver's time zone", () => {
  test.each([
    ["east of UTC", "Asia/Tokyo", "2026-10-13T14:59:00Z", "2026-10-13"],
    ["east of UTC, after local midnight", "Asia/Tokyo", "2026-10-13T15:01:00Z", "2026-10-14"],
    ["west of UTC, before local midnight", "America/Los_Angeles", "2026-10-14T06:59:00Z", "2026-10-13"],
    ["without a time zone, in UTC", undefined, "2026-10-13T23:59:00Z", "2026-10-13"],
  ])("%s", async (_, timeZone, postedAt, day) => {
    const t = await withDirectory({ U_ALICE: timeZone, U_BOB: "UTC" });

    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], ["taco"], { at: Date.parse(postedAt) })));

    expect((await awardsOf(t)).map((award) => award.day)).toEqual([day]);
  });

  test("a new allowance day opens the full base again", async () => {
    const t = await withDirectory({ U_ALICE: "America/Los_Angeles", U_BOB: "UTC" });
    const threeTacos = ["taco", "taco", "taco"];

    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], threeTacos, { message: "1", at: Date.parse("2026-10-14T06:58:00Z") })));
    const nextDay = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], threeTacos, { message: "2", at: Date.parse("2026-10-14T07:01:00Z") })));

    expect(nextDay).toMatchObject({ outcome: { kind: "given", left: 0 } });
  });
});

test("R17: a giver's next message sees what the previous one spent", async () => {
  const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC" });
  const twoTacos = ["taco", "taco"];

  const first = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], twoTacos, { message: "1" })));
  const second = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], twoTacos, { message: "2" })));

  expect(first).toMatchObject({ outcome: { kind: "given", left: 1 } });
  expect(second).toMatchObject({ outcome: { kind: "over-allowance", cost: 2, left: 1 } });
  expect((await awardsOf(t)).reduce((sum, award) => sum + award.kudos, 0)).toBe(2);
});

describe("R20: kudosGiven", () => {
  test("exactly one kudosGiven per Given outcome, with the awards and the allowance facts", async () => {
    const t = await withDirectory({ U_ALICE: "Asia/Tokyo", U_BOB: "UTC", U_CAROL: "UTC" });
    const at = Date.parse("2026-10-13T15:30:00Z");

    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB"), person("U_CAROL")], ["taco"], { at })));

    expect(publish).toHaveBeenCalledOnce();
    const [, event] = vi.mocked(publish).mock.calls[0]!;
    const ids = await memberIds(t);
    expect(event).toEqual({
      type: "kudosGiven",
      workspace: "T1",
      message: { workspace: "T1", conversation: "C1", message: "1" },
      giver: ids.U_ALICE,
      awards: [
        { giver: ids.U_ALICE, recipient: ids.U_BOB, kudos: 1 },
        { giver: ids.U_ALICE, recipient: ids.U_CAROL, kudos: 1 },
      ],
      kudosEmoji: "taco",
      annotations: {},
      allowance: { dailyOpening: 3, dailyLeft: 1 },
      day: "2026-10-14",
      at,
    });
  });

  test("no kudosGiven for an outcome that is not Given", async () => {
    const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC" });

    await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], ["taco", "taco", "taco", "taco"])));

    expect(publish).not.toHaveBeenCalled();
  });

  test("kudosGiven is published in the awards' transaction", async () => {
    const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC" });
    vi.mocked(publish).mockRejectedValueOnce(new Error("publishing failed"));

    await expect(t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB")], ["taco"])))).rejects.toThrow("publishing failed");

    expect(await awardsOf(t)).toEqual([]);
  });
});

test("R29: a message whose author or recipients the directory doesn't know waits for a lookup and spends nothing", async () => {
  const t = await withDirectory({ U_ALICE: "UTC" });

  const observation = await t.run((ctx) => observe(ctx, kudosMessage("U_ALICE", [person("U_BOB"), person("U_CAROL")], ["taco"])));

  expect(observation).toEqual({ kind: "awaiting-directory", users: ["U_BOB", "U_CAROL"], retryInMs: 0 });
  expect(await awardsOf(t)).toEqual([]);
});

test("R19: a message gives at most once", async () => {
  const t = await withDirectory({ U_ALICE: "UTC", U_BOB: "UTC" });
  const message = kudosMessage("U_ALICE", [person("U_BOB")], ["taco"]);

  await t.run((ctx) => observe(ctx, message));
  const again = await t.run((ctx) => observe(ctx, message));

  expect(again).toEqual({ kind: "ignored", why: "unchanged" });
  expect(await awardsOf(t)).toHaveLength(1);
});

type Backend = ReturnType<typeof testBackend>;

function testBackend() {
  return convexTest(schema, modules);
}

async function withDirectory(people: Record<string, string | undefined>) {
  const t = testBackend();
  await t.run(async (ctx) => {
    for (const [user, timeZone] of Object.entries(people)) {
      await ctx.db.insert("members", { workspace: "T1", user, kind: "member", ...(timeZone && { timeZone }) });
    }
  });
  return t;
}

function person(user: string): Mention {
  return { kind: "person", user };
}

function kudosMessage(author: string, mentions: Mention[], emoji: string[], options: { message?: string; at?: number } = {}): MessageEvent {
  const at = options.at ?? now.getTime();
  return {
    kind: "posted",
    ref: { workspace: "T1", conversation: "C1", message: options.message ?? "1" },
    author,
    revision: BigInt(at) * 1000n,
    at,
    content: { mentions, emoji, text: "thanks" },
  };
}

async function memberIds(t: Backend) {
  const members = await t.run((ctx) => ctx.db.query("members").collect());
  return Object.fromEntries(members.map((member) => [member.user, member._id]));
}

async function awardsOf(t: Backend) {
  return t.run(async (ctx) => {
    const awards = await ctx.db.query("awards").collect();
    const userOf = async (id: (typeof awards)[number]["giver"]) => (await ctx.db.get(id))?.user;
    return Promise.all(
      awards.map(async (award) => ({ giver: await userOf(award.giver), recipient: await userOf(award.recipient), kudos: award.kudos, day: award.day })),
    );
  });
}
