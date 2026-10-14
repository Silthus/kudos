import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import { whyNotOf } from "../feedback/home";
import type { MemberId } from "../workspace/directory";
import { buyPerk } from "./perks";
import { perkOf, type PerkId } from "./tree";

vi.mock("./tree", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tree")>();
  const tree = actual.tree.map((perk) => (perk.perk === "spark" ? { ...perk, retired: true } : perk));
  return { ...actual, tree, perkOf: (id: PerkId) => tree.find(({ perk }) => perk === id)! };
});

const now = new Date("2026-10-13T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now });
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "skill-tree");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P5: a perk retired from the tree keeps working for its owners", () => {
  test("its owner still earns its bonus line when they thank someone and say why", async () => {
    const { t, alice, bob } = await members();
    await owning(t, alice, "spark");

    await t.mutation(internal.progression.progression.recordEffects, {
      event: await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: { gate: { version: 1, thoughtful: true, words: 6 } } })),
    });

    const [giverRecord] = await t.run((ctx) => ctx.db.query("effectsRecords").collect());
    expect(giverRecord?.bonus).toEqual([{ source: "spark", xp: 5 }]);
  });

  test("nobody else can buy it, and the reason says it is no longer sold", async () => {
    const { t, bob } = await members();
    await owning(t, bob);

    expect(await t.run((ctx) => buyPerk(ctx, bob, "spark", "slack:trigger-1"))).toEqual({ kind: "refused", perk: "spark", reason: "retired" });
    expect(whyNotOf({ ...perkOf("spark"), state: "retired" })).toBe("It's no longer sold.");
    expect(await t.run((ctx) => ctx.db.query("perksOwned").collect())).toEqual([]);
  });
});

async function members() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const { alice, bob } = await t.run(async (ctx) => ({
    alice: await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", timeZone: "UTC" }),
    bob: await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member", timeZone: "UTC" }),
  }));
  return { t, alice, bob };
}

async function owning(t: Backend, member: MemberId, ...perks: PerkId[]) {
  await t.run(async (ctx) => {
    await ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: perks.length });
    await ctx.db.insert("unlocks", { member, feature: "skillTree", readyAt: 0, openedAt: 0 });
    for (const perk of perks) await ctx.db.insert("perksOwned", { member, perk, boughtAt: 0, catalogueVersion: "1" });
  });
}
