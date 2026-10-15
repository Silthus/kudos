import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { buyPerk } from "../progression/perks";
import { xpToReach } from "../progression/levels";
import { recordReward } from "../progression/progression";
import type { PerkId } from "../progression/tree";
import { workspaceLink } from "../slack/workspaceLink";
import type { MemberId } from "../workspace/directory";
import type { MemberProfile } from "./profile";
import type { MySkillTree } from "./skillTree";

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const treeFlags = ["xp-levels", "unlocks", "skill-tree"];
const levelFive = 600;
const levelSix = 1000;
const levelSeven = 1500;
const levelNine = xpToReach(9);

const spark = { perk: "spark", name: "Spark", copy: "+5 XP the first time each day you thank someone and say why.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;
const rhythm = { perk: "rhythm", name: "Rhythm", copy: "+2 XP each time you thank someone and say why, once per person a day.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;
const circle = { perk: "circle", name: "Circle", copy: "+5 XP the first time each week you thank a person and say why.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;
const flame = { perk: "flame", name: "Flame", copy: "Spark gives +8 XP instead of +5.", cost: { skillPoints: 1, coins: 150 }, requires: "Spark", upgrades: "spark" } as const;
const cadence = { perk: "cadence", name: "Cadence", copy: "Rhythm gives +3 XP instead of +2.", cost: { skillPoints: 1, coins: 200 }, requires: "Rhythm", upgrades: "rhythm" } as const;
const bridge = {
  perk: "bridge",
  name: "Bridge",
  copy: "Circle gives +8 XP instead of +5 when the person isn't in your primary group. Without a primary group, everyone counts.",
  cost: { skillPoints: 1, coins: 150 },
  requires: "Circle",
  upgrades: "circle",
} as const;
const treasurer = { perk: "treasurer", name: "Treasurer", copy: "+2 🪙 each time you thank someone and say why, once per person a day.", cost: { skillPoints: 1, coins: 0 }, requires: null, upgrades: null } as const;
const banker = { perk: "banker", name: "Banker", copy: "Treasurer gives +4 🪙 instead of +2.", cost: { skillPoints: 2, coins: 250 }, requires: "Treasurer", upgrades: "treasurer" } as const;
const available = { state: "available", reason: null, ownedAt: null } as const;

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function flagsOn(...keys: string[]) {
  return switchWebsite(t, postHog, true, ...keys);
}

async function treeShipped() {
  await flagsOn(...treeFlags);
  await unlocksShippedBeforeAnyoneJoined(t);
}

async function signedInMember() {
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSession(t, juno);
  return { member, asSignedIn };
}

async function withXp(member: MemberId, xp: number) {
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 }));
}

async function treeOpenFor(member: MemberId, xp: number) {
  await withXp(member, xp);
  await reachesLevel(t, member, 5);
  await opens(t, member, "skillTree");
}

async function buys(member: MemberId, perk: PerkId) {
  expect(await t.run((ctx) => buyPerk(ctx, member, perk, `test:${perk}`))).toEqual({ kind: "bought", perk });
}

function skillTreeOf(asSignedIn: Pick<Backend, "query">): Promise<MySkillTree> {
  return asSignedIn.query(api.website.skillTree.getSkillTree, {});
}

async function skillPointsIn(asSignedIn: Pick<Backend, "query">): Promise<MemberProfile["skillPoints"]> {
  const profile = await asSignedIn.query(api.website.profile.getMyProfile, {});
  if (profile.kind !== "member") throw new Error(`expected a member, got ${profile.kind}`);
  return profile.skillPoints;
}

async function expectProgressionsFacts(member: MemberId, tree: MySkillTree) {
  const perks = await t.query(internal.progression.perks.perksOf, { member });
  if (tree.kind !== "tree" || perks === null) throw new Error(`expected a tree beside perksOf, got ${tree.kind}`);
  expect(tree.skillPoints).toBe(perks.skillPoints);
  const nodes = tree.rows.flatMap((row) => row.perks.map((node) => ({ ...node, row: row.level })));
  expect(nodes.map(({ perk, name, copy, cost, upgrades, row }) => ({ perk, name, copy, skillPoints: cost.skillPoints, coins: cost.coins, upgrades, row }))).toEqual(
    perks.perks.map(({ perk, name, copy, skillPoints, coins, upgrades, row }) => ({ perk, name, copy, skillPoints, coins, upgrades, row })),
  );
  expect(nodes.map(({ perk, ownedAt }) => ({ perk, ownedAt }))).toEqual(perks.perks.map(({ perk, boughtAt }) => ({ perk, ownedAt: boughtAt })));
}

describe("WS80 WS83: the skill tree read waits for the Skill tree's unlock", () => {
  beforeEach(treeShipped);

  test("a member at level 1 reads it locked at level 5, with no facts, and no skill points", async () => {
    const { asSignedIn } = await signedInMember();

    expect(await skillTreeOf(asSignedIn)).toEqual({ kind: "locked", level: 5 });
    expect(await skillPointsIn(asSignedIn)).toBeNull();
  });

  test("a member at level 5 who hasn't opened the Skill tree reads it ready, with no facts, and no skill points", async () => {
    const { member, asSignedIn } = await signedInMember();
    await withXp(member, levelFive);
    await reachesLevel(t, member, 5);

    expect(await skillTreeOf(asSignedIn)).toEqual({ kind: "ready" });
    expect(await skillPointsIn(asSignedIn)).toBeNull();
  });
});

describe("WS83 WS84: the skill tree read projects progression's perksOf", () => {
  beforeEach(treeShipped);

  test("a member with points and no perks reads every first-row perk available, and the HUD's points equal the tree's", async () => {
    const { member, asSignedIn } = await signedInMember();
    await treeOpenFor(member, levelSix);

    const tree = await skillTreeOf(asSignedIn);

    expect(tree).toEqual({
      kind: "tree",
      skillPoints: 2,
      coins: null,
      rows: [{ level: 5, perks: [{ ...spark, ...available }, { ...rhythm, ...available }, { ...circle, ...available }] }],
      chatUrl: workspaceLink("T1"),
    });
    await expectProgressionsFacts(member, tree);
    expect(await skillPointsIn(asSignedIn)).toBe(2);
  });

  test("a member who owns spark reads it owned since they bought it, and the rest still available", async () => {
    const { member, asSignedIn } = await signedInMember();
    await treeOpenFor(member, levelSix);
    await buys(member, "spark");

    const tree = await skillTreeOf(asSignedIn);

    expect(tree).toMatchObject({
      skillPoints: 1,
      rows: [{ level: 5, perks: [{ ...spark, state: "owned", reason: null, ownedAt: now.getTime() }, { ...rhythm, ...available }, { ...circle, ...available }] }],
    });
    await expectProgressionsFacts(member, tree);
    expect(await skillPointsIn(asSignedIn)).toBe(1);
  });

  test("a member with no points left reads the perks they don't own unavailable for points, and the HUD shows 0", async () => {
    const { member, asSignedIn } = await signedInMember();
    await treeOpenFor(member, levelFive);
    await buys(member, "rhythm");

    const tree = await skillTreeOf(asSignedIn);

    const forPoints = { state: "unavailable", reason: "points", ownedAt: null } as const;
    expect(tree).toMatchObject({
      skillPoints: 0,
      rows: [{ level: 5, perks: [{ ...spark, ...forPoints }, { ...rhythm, state: "owned", reason: null, ownedAt: now.getTime() }, { ...circle, ...forPoints }] }],
    });
    await expectProgressionsFacts(member, tree);
    expect(await skillPointsIn(asSignedIn)).toBe(0);
  });
});

describe("P77 WS83: the launch opens the Skill tree for a member who was there", () => {
  test("a member the launch opened the Skill tree for below level 5 reads every perk unavailable for its level", async () => {
    await flagsOn(...treeFlags);
    const { member, asSignedIn } = await signedInMember();
    await unlocksShippedBeforeAnyoneJoined(t);

    const tree = await skillTreeOf(asSignedIn);

    const forLevel = { state: "unavailable", reason: "level", ownedAt: null } as const;
    expect(tree).toMatchObject({ skillPoints: 0, rows: [{ level: 5, perks: [{ ...spark, ...forLevel }, { ...rhythm, ...forLevel }, { ...circle, ...forLevel }] }] });
    await expectProgressionsFacts(member, tree);
    expect(await skillPointsIn(asSignedIn)).toBe(0);
  });
});

describe("the website shows only shipped features", () => {
  test("WS80 WS84 P78: with skill-tree off, a member who owns spark reads the skill tree not-found and no skill points", async () => {
    await treeShipped();
    const { member, asSignedIn } = await signedInMember();
    await treeOpenFor(member, levelSix);
    await buys(member, "spark");
    await flagsOn("xp-levels", "unlocks");

    expect(await skillTreeOf(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await skillPointsIn(asSignedIn)).toBeNull();
  });

  test("WS79 WS80: while unlocks don't apply, the skill tree is not-found though skill-tree is on", async () => {
    await flagsOn(...treeFlags);
    const { asSignedIn } = await signedInMember();

    expect(await skillTreeOf(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await skillPointsIn(asSignedIn)).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("unlockLaunches").collect())).toEqual([]);
  });
});

describe("website reads pass one guard", () => {
  test("getSkillTree reads closed while the website flag is off, even with the Skill tree open", async () => {
    await treeShipped();
    const { member, asSignedIn } = await signedInMember();
    await treeOpenFor(member, levelSix);
    await switchWebsite(t, postHog, false, ...treeFlags);

    expect(await skillTreeOf(asSignedIn)).toEqual({ kind: "closed" });
  });

  test("getSkillTree reads signed out without a session", async () => {
    await treeShipped();

    expect(await skillTreeOf(t)).toEqual({ kind: "signed-out" });
  });

  test("getSkillTree reads not-a-member for a former member with a live session", async () => {
    await treeShipped();
    await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await skillTreeOf(asSignedIn)).toEqual({ kind: "not-a-member" });
  });

  test("an argument that names another member is rejected by the validator", async () => {
    await treeShipped();
    const { asSignedIn } = await signedInMember();
    const withAnotherMember = { user: "U_ROWAN" } as unknown as Record<string, never>;

    await expect(asSignedIn.query(api.website.skillTree.getSkillTree, withAnotherMember)).rejects.toThrow(/user/);
  });
});

describe("WS345 CO22 CO25 CO26: the tree draws every row perksOf lists, with coin costs, upgrade links and the wallet", { timeout: 30_000 }, () => {
  async function coinsOpenAtLevelNine(coins: number, ...owned: PerkId[]) {
    await flagsOn(...treeFlags, "coins");
    await unlocksShippedBeforeAnyoneJoined(t);
    const { member, asSignedIn } = await signedInMember();
    await treeOpenFor(member, levelNine);
    await reachesLevel(t, member, 9);
    await opens(t, member, "coins");
    await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins, item: null, catalogueVersion: "2", at: 0 }));
    for (const perk of owned) await buys(member, perk);
    return { member, asSignedIn };
  }

  test("with Coins open, a member reads rows 5, 7 and 9, each upgrade with the perk it replaces and its coin price, and their balance", async () => {
    const { member, asSignedIn } = await coinsOpenAtLevelNine(150, "spark");

    const tree = await skillTreeOf(asSignedIn);

    const forRequires = { state: "unavailable", reason: "requires", ownedAt: null } as const;
    expect(tree).toEqual({
      kind: "tree",
      skillPoints: 4,
      coins: 150,
      rows: [
        { level: 5, perks: [{ ...spark, state: "owned", reason: null, ownedAt: now.getTime() }, { ...rhythm, ...available }, { ...circle, ...available }] },
        { level: 7, perks: [{ ...flame, ...available }, { ...cadence, ...forRequires }, { ...bridge, ...forRequires }, { ...treasurer, ...available }] },
        { level: 9, perks: [{ ...banker, ...forRequires }] },
      ],
      chatUrl: workspaceLink("T1"),
    });
    await expectProgressionsFacts(member, tree);
  });

  test("an upgrade the member can't pay for in coins reads unavailable for coins", async () => {
    const { asSignedIn } = await coinsOpenAtLevelNine(149, "spark");

    expect(await nodeIn(asSignedIn, "flame")).toMatchObject({ state: "unavailable", reason: "coins" });
  });

  test("while coins aren't visible, the tree reads no wallet and lists an owned upgrade without its price", async () => {
    const { member, asSignedIn } = await coinsOpenAtLevelNine(150, "spark", "flame");
    await flagsOn(...treeFlags);

    const tree = await skillTreeOf(asSignedIn);

    expect(tree).toMatchObject({ coins: null });
    expect(await perksIn(asSignedIn)).toEqual(["spark", "rhythm", "circle", "flame"]);
    expect(await nodeIn(asSignedIn, "flame")).toMatchObject({ cost: { skillPoints: 1, coins: 0 }, upgrades: "spark", state: "owned" });
    await expectProgressionsFacts(member, tree);
  });
});

async function nodeIn(asSignedIn: Pick<Backend, "query">, perk: PerkId) {
  const tree = await skillTreeOf(asSignedIn);
  if (tree.kind !== "tree") throw new Error(`expected a tree, got ${tree.kind}`);
  return tree.rows.flatMap((row) => row.perks).find((node) => node.perk === perk);
}

async function perksIn(asSignedIn: Pick<Backend, "query">) {
  const tree = await skillTreeOf(asSignedIn);
  if (tree.kind !== "tree") throw new Error(`expected a tree, got ${tree.kind}`);
  return tree.rows.flatMap((row) => row.perks.map(({ perk }) => perk));
}
