import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import type { FakePostHog } from "../../testing/fakePostHog";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import { publish } from "../bus/publish";
import { whyNotOf } from "../feedback/home";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";
import { buyPerk } from "./perks";
import { standingOf } from "./progression";
import { perkOf, type PerkId } from "./tree";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const levelFive = 600;
const allFlags = ["xp-levels", "unlocks", "skill-tree"] as const;

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  postHog = flagsOnForEveryone(new FakeSlack().fetch, ...allFlags);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P19 P93: buyPerk spends the skill points and grants the perk in one step", () => {
  test("a level-5 member with the Skill tree open buys spark: they own it with its time and catalogue version, have 0 points, and perkBought is published once", async () => {
    const { t, alice } = await memberWithOpenTree(levelFive);

    const outcome = await buy(t, alice, "spark", "trigger-1");

    expect(outcome).toEqual({ kind: "bought", perk: "spark" });
    expect(await ownedRows(t)).toEqual([{ member: alice, perk: "spark", boughtAt: now.getTime(), catalogueVersion: "1" }]);
    expect(await standing(t, alice)).toEqual({ xp: levelFive, level: 5, skillPoints: 0 });
    expect(published("perkBought")).toEqual([{ type: "perkBought", workspace: "T1", member: alice, perk: "spark", at: now.getTime() }]);
  });
});

describe("P19 P76: a refused purchase changes nothing, publishes nothing, and returns the reason", () => {
  test.each([
    ["the Skill tree is ready but not opened", { xp: levelFive, tree: "ready" }, "tree-ready", "Skill tree is ready for you. Open it in App Home."],
    ["the Skill tree isn't ready yet", { xp: 300, tree: "locked" }, "tree-locked", "Skill tree opens at level 5."],
    ["the level is below the perk's row", { xp: 300, tree: "open" }, "below-row", "It opens at level 5."],
    ["there are no skill points left", { xp: levelFive, tree: "open", owns: "rhythm" }, "no-skill-points", "You need 1 skill point."],
    ["the perk is owned", { xp: 1000, tree: "open", owns: "spark" }, "owned", "You own it."],
  ] as const)("when %s", async (_, setup, reason, reply) => {
    const { t, alice } = await memberWith(setup);
    const before = await everyTable(t);

    const outcome = await buy(t, alice, "spark", "trigger-1");

    expect(outcome).toEqual({ kind: "refused", perk: "spark", reason });
    expect(whyNotOf({ ...perkOf("spark"), state: reason })).toBe(reply);
    expect(withoutPurchases(await everyTable(t))).toEqual(withoutPurchases(before));
    expect(published("perkBought")).toEqual([]);
  });
});

describe("P4 P19: a skill point is spent once and never refunded", () => {
  test("the same command twice with one key buys once and returns the first outcome both times", async () => {
    const { t, alice } = await memberWithOpenTree(1000);

    const first = await buy(t, alice, "spark", "trigger-1");
    const again = await buy(t, alice, "spark", "trigger-1");

    expect([first, again]).toEqual([
      { kind: "bought", perk: "spark" },
      { kind: "bought", perk: "spark" },
    ]);
    expect(await standing(t, alice)).toEqual({ xp: 1000, level: 6, skillPoints: 1 });
    expect(published("perkBought")).toHaveLength(1);
  });

  test("a repeated key returns its first refusal even after the refusal no longer holds", async () => {
    const { t, alice } = await memberWithOpenTree(300);
    const refused = await buy(t, alice, "spark", "trigger-1");
    await withXp(t, alice, levelFive);

    const again = await buy(t, alice, "spark", "trigger-1");

    expect(again).toEqual(refused);
    expect(await ownedRows(t)).toEqual([]);
  });

  test("two clicks for two perks with one skill point buy the first and refuse the second", async () => {
    const { t, alice } = await memberWithOpenTree(levelFive);

    const outcomes = await Promise.all([buy(t, alice, "spark", "trigger-1"), buy(t, alice, "circle", "trigger-2")]);

    expect(outcomes).toEqual([
      { kind: "bought", perk: "spark" },
      { kind: "refused", perk: "circle", reason: "no-skill-points" },
    ]);
    expect((await ownedRows(t)).map(({ perk }) => perk)).toEqual(["spark"]);
    expect(await standing(t, alice)).toEqual({ xp: levelFive, level: 5, skillPoints: 0 });
  });

  test("a later level up adds its point on top of what was spent", async () => {
    const { t, alice, bob } = await memberWithOpenTree(990);
    await buy(t, alice, "spark", "trigger-1");

    await t.mutation(internal.progression.progression.recordEffects, { event: await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob)) });

    expect(await standing(t, alice)).toEqual({ xp: 1000, level: 6, skillPoints: 1 });
    expect(await buy(t, alice, "rhythm", "trigger-2")).toEqual({ kind: "bought", perk: "rhythm" });
    expect(await standing(t, alice)).toEqual({ xp: 1000, level: 6, skillPoints: 0 });
  });
});

describe("P79: perksOf tells the website what the member owns and what each perk's state is", () => {
  test("it returns the owned perks with their times, the unspent skill points and each first-row perk's state and copy", async () => {
    const { t, alice } = await memberWithOpenTree(1000);
    await buy(t, alice, "circle", "trigger-1");

    expect(await t.query(internal.progression.perks.perksOf, { member: alice })).toEqual({
      skillPoints: 1,
      owned: [{ perk: "circle", boughtAt: now.getTime() }],
      perks: [
        { perk: "spark", name: "Spark", row: 5, skillPoints: 1, requires: null, copy: "+5 XP the first time each day you thank someone and say why.", state: "buyable" },
        { perk: "rhythm", name: "Rhythm", row: 5, skillPoints: 1, requires: null, copy: "+2 XP each time you thank someone and say why, once per person a day.", state: "buyable" },
        { perk: "circle", name: "Circle", row: 5, skillPoints: 1, requires: null, copy: "+5 XP the first time each week you thank a person and say why.", state: "owned" },
      ],
    });
  });

  test("before the member opens the Skill tree, every perk says so", async () => {
    const { t, alice } = await memberWith({ xp: levelFive, tree: "ready" });

    const perks = await t.query(internal.progression.perks.perksOf, { member: alice });

    expect(perks?.perks.map(({ state }) => state)).toEqual(["tree-ready", "tree-ready", "tree-ready"]);
  });
});

describe("the skill tree applies only where skill-tree, xp-levels and unlocks all apply", () => {
  test.each(allFlags)("with %s off, buyPerk writes nothing and perksOf shows nothing", async (off) => {
    const { t, alice } = await memberWithOpenTree(levelFive);
    await flagsFromPostHog(t, postHog, ...allFlags.map((key) => (key === off ? offForEveryone : onForEveryone)(key)));
    const before = await treeTables(t);

    expect(await buy(t, alice, "spark", "trigger-1")).toBeNull();
    expect(await t.query(internal.progression.perks.perksOf, { member: alice })).toBeNull();
    expect(await treeTables(t)).toEqual(before);
    expect(published("perkBought")).toEqual([]);
  });

  test("before unlocks launched in the workspace, buyPerk writes nothing", async () => {
    const t = await flagsLoaded(testBackend());
    const { alice } = await members(t);
    await seed(t, alice, { xp: levelFive, tree: "open" });
    const before = await treeTables(t);

    expect(await buy(t, alice, "spark", "trigger-1")).toBeNull();
    expect(await treeTables(t)).toEqual(before);
    expect(published("perkBought")).toEqual([]);
  });
});

type Setup = { xp: number; tree: "locked" | "ready" | "open"; owns?: PerkId };

async function memberWithOpenTree(xp: number) {
  return memberWith({ xp, tree: "open" });
}

async function memberWith(setup: Setup) {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const { alice, bob } = await members(t);
  await seed(t, alice, setup);
  return { t, alice, bob };
}

async function members(t: Backend) {
  return t.run(async (ctx) => {
    const alice = await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", timeZone: "UTC" });
    const bob = await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member", timeZone: "UTC" });
    return { alice, bob };
  });
}

async function seed(t: Backend, member: MemberId, { xp, tree, owns }: Setup) {
  await t.run(async (ctx) => {
    await ctx.db.insert("memberProgress", { member, xp, pointsSpent: owns === undefined ? 0 : 1 });
    if (tree !== "locked") await ctx.db.insert("unlocks", { member, feature: "skillTree", readyAt: 0, ...(tree === "open" && { openedAt: 0 }) });
    if (owns !== undefined) await ctx.db.insert("perksOwned", { member, perk: owns, boughtAt: 0, catalogueVersion: "1" });
  });
}

async function withXp(t: Backend, member: MemberId, xp: number) {
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

function buy(t: Backend, member: MemberId, perk: PerkId, key: string) {
  return t.run((ctx) => buyPerk(ctx, member, perk, key));
}

function standing(t: Backend, member: MemberId) {
  return t.run((ctx) => standingOf(ctx, member));
}

function ownedRows(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("perksOwned").collect()).map(({ member, perk, boughtAt, catalogueVersion }) => ({ member, perk, boughtAt, catalogueVersion })));
}

function published(type: "perkBought") {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event) => event.type === type);
}

function withoutPurchases(tables: Record<string, unknown[]>) {
  const { perkPurchases: _, ...rest } = tables;
  return rest;
}

function treeTables(t: Backend) {
  return t.run(async (ctx) => ({
    perksOwned: await ctx.db.query("perksOwned").collect(),
    perkPurchases: await ctx.db.query("perkPurchases").collect(),
    memberProgress: await ctx.db.query("memberProgress").collect(),
  }));
}

async function everyTable(t: Backend) {
  return t.run(async (ctx) => {
    const tables: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) tables[table] = await ctx.db.query(table).collect();
    return tables;
  });
}
