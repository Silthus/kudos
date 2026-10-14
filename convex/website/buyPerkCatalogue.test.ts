import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { PerkId } from "../progression/tree";

vi.mock("../progression/tree", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../progression/tree")>();
  const tree = actual.tree.map((perk) => {
    if (perk.perk === "circle") return { ...perk, row: 6, requires: "rhythm" };
    if (perk.perk === "spark") return { ...perk, retired: true };
    return perk;
  });
  return { ...actual, tree, perkOf: (id: PerkId) => tree.find(({ perk }) => perk === id)! };
});

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const request = "0d6f2c1e-8a4b-4c3d-9e2f-1a2b3c4d5e6f";

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

async function aMemberWithTheTreeOpenAt(level: number, xp: number) {
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSession(t, juno);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 }));
  await reachesLevel(t, member, level);
  await opens(t, member, "skillTree");
  return asSignedIn;
}

describe("a website command is a D17 command", () => {
  test.each([
    { condition: "a perk in a row above the member's level", level: 5, xp: 600, perk: "circle", reason: "level" },
    { condition: "a perk whose prerequisite the member doesn't own", level: 6, xp: 1000, perk: "circle", reason: "requires" },
    { condition: "a retired perk", level: 5, xp: 600, perk: "spark", reason: null },
  ] as const)("WS88: $condition is refused with progression's reason kind, never words", async ({ level, xp, perk, reason }) => {
    const asSignedIn = await aMemberWithTheTreeOpenAt(level, xp);

    expect(await asSignedIn.mutation(api.website.commands.buyPerk, { perk, request })).toEqual({ kind: "refused", reason });
  });
});
