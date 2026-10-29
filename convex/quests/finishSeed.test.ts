import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { RewardRecord } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";

const at = new Date("2026-10-13T10:00:00Z").getTime();
const cause = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };

beforeEach(() => {
  vi.useFakeTimers({ now: at });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HH24: a one-off seed writes Quests' finish record for every Monday-path quest already finished", () => {
  test("each Monday-path finish gets its finish row, in pages, and nothing else does", async () => {
    const t = testBackend();
    const alice = await member(t, "U_ALICE");
    const bob = await member(t, "U_BOB");
    await rewards(t, [
      { member: alice, key: "journey:first-thanks", xp: 50, catalogueVersion: "monday-1", cause },
      { member: alice, key: "weekly:2026-10-12:0", xp: 20, catalogueVersion: "monday-1" },
      { member: bob, key: "journey:someone-new", xp: 50, catalogueVersion: "monday-1" },
      { member: bob, key: "weekly:2026-10-05:1", xp: 20, catalogueVersion: "1" },
      { member: bob, key: "group:somegroup:2026-10-12", xp: 30, catalogueVersion: "monday-1" },
      { member: bob, key: "hug-given:C1:1760349600.000100", xp: 1, catalogueVersion: "hugs-1" },
    ]);

    const pages = await seedAll(t, 2);

    expect(pages, "the pages and what each seeded").toEqual([2, 1, 0]);
    expect(await finishesOf(t)).toEqual([
      { member: alice, key: "journey:first-thanks", xp: 50, catalogueVersion: "monday-1", at, cause },
      { member: alice, key: "weekly:2026-10-12:0", xp: 20, catalogueVersion: "monday-1", at },
      { member: bob, key: "journey:someone-new", xp: 50, catalogueVersion: "monday-1", at },
    ]);
  });

  test("publishes nothing, leaves a finish the finisher already recorded as it is, and seeds nothing on a second run", async () => {
    const t = testBackend();
    const alice = await member(t, "U_ALICE");
    await rewards(t, [{ member: alice, key: "journey:first-thanks", xp: 50, catalogueVersion: "monday-1" }]);
    await t.run((ctx) => ctx.db.insert("questFinishes", { member: alice, key: "journey:first-thanks", xp: 50, catalogueVersion: "monday-1", at: at - 1 }));

    expect(await seedAll(t, 100), "the first run").toEqual([0]);
    expect(await seedAll(t, 100), "the second run").toEqual([0]);

    expect(await finishesOf(t)).toEqual([{ member: alice, key: "journey:first-thanks", xp: 50, catalogueVersion: "monday-1", at: at - 1 }]);
    expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()), "the jobs scheduled").toEqual([]);
  });
});

async function seedAll(t: Backend, numItems: number) {
  const seeded: number[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: { seeded: number; cursor: string; isDone: boolean } = await t.mutation(internal.quests.finishSeed.seedQuestFinishes, { cursor, numItems });
    seeded.push(page.seeded);
    if (page.isDone) return seeded;
    cursor = page.cursor;
  }
}

function member(t: Backend, user: string) {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
}

type Earned = Pick<RewardRecord, "key" | "xp" | "catalogueVersion" | "cause"> & { member: MemberId };

function rewards(t: Backend, earned: Earned[]) {
  return t.run(async (ctx) => {
    for (const reward of earned) await ctx.db.insert("rewardRecords", { ...reward, coins: 0, item: null, at });
  });
}

async function finishesOf(t: Backend) {
  const rows = await t.run((ctx) => ctx.db.query("questFinishes").collect());
  return rows.map(({ _id, _creationTime, ...finish }) => finish);
}
