import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { PerkId } from "../progression/tree";

const { ember } = vi.hoisted(() => ({ ember: { perk: "ember", name: "Ember", row: 6, skillPoints: 2, requires: "rhythm", copy: "Ember's copy." } }));

vi.mock("../progression/tree", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../progression/tree")>();
  const tree = [ember, ...actual.tree.map((perk) => (perk.perk === "spark" || perk.perk === "circle" ? { ...perk, retired: true } : perk))];
  return { ...actual, tree, perkOf: (id: PerkId) => tree.find(({ perk }) => perk === id)! };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };

let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  const postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
  await switchWebsite(t, postHog, true, "xp-levels", "unlocks", "skill-tree");
  await unlocksShippedBeforeAnyoneJoined(t);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("WS83 P5 P78: the skill tree read shows the catalogue's rows as perksOf gives them", () => {
  test("rows come in level order, a prerequisite carries its perk's name, and a retired perk shows only to its owner", async () => {
    const member = await aMember(t, juno.user);
    const { asSignedIn } = await aSession(t, juno);
    await t.run(async (ctx) => {
      await ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: 1 });
      await ctx.db.insert("perksOwned", { member, perk: "spark", boughtAt: 0, catalogueVersion: "1" });
    });
    await reachesLevel(t, member, 5);
    await opens(t, member, "skillTree");

    const tree = await asSignedIn.query(api.website.skillTree.getSkillTree, {});

    expect(tree).toMatchObject({
      skillPoints: 1,
      rows: [
        {
          level: 5,
          perks: [
            { perk: "spark", state: "owned", reason: null, ownedAt: 0 },
            { perk: "rhythm", state: "available", reason: null, ownedAt: null },
          ],
        },
        { level: 6, perks: [{ perk: "ember", name: "Ember", cost: { skillPoints: 2 }, requires: "Rhythm", state: "unavailable", reason: "requires", ownedAt: null }] },
      ],
    });
  });
});
