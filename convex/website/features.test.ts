import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import type { MemberProfile } from "./profile";

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const allFlags = ["everyone-board", "xp-levels", "unlocks"];

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

async function launchedThen(...keys: string[]) {
  await flagsOn(...allFlags);
  await unlocksShippedBeforeAnyoneJoined(t);
  await flagsOn(...keys);
}

async function signedInMember() {
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSession(t, juno);
  return { member, asSignedIn };
}

async function myProfile(asSignedIn: Pick<Backend, "query">): Promise<MemberProfile> {
  const profile = await asSignedIn.query(api.website.profile.getMyProfile, {});
  if (profile.kind !== "member") throw new Error(`expected a member, got ${profile.kind}`);
  return profile;
}

function leaderboardEntryOf({ features }: MemberProfile) {
  return features?.find((card) => card.feature === "leaderboard");
}

describe("the website's feature states are Unlocks' facts", () => {
  type UnlocksDontApply = { condition: string; turnOn: () => Promise<unknown> };

  const unlocksDontApply: UnlocksDontApply[] = [
    { condition: "with xp-levels and unlocks off, before any launch", turnOn: () => flagsOn("everyone-board") },
    { condition: "with xp-levels on and unlocks off, before any launch", turnOn: () => flagsOn("everyone-board", "xp-levels") },
    { condition: "with unlocks on and xp-levels off, before the launch", turnOn: () => flagsOn("everyone-board", "unlocks") },
    { condition: "with xp-levels and unlocks on, before the launch", turnOn: () => flagsOn(...allFlags) },
    { condition: "with xp-levels and unlocks switched off after the launch", turnOn: () => launchedThen("everyone-board") },
    { condition: "with xp-levels on and unlocks switched off after the launch", turnOn: () => launchedThen("everyone-board", "xp-levels") },
    { condition: "with unlocks on and xp-levels switched off after the launch", turnOn: () => launchedThen("everyone-board", "unlocks") },
  ];

  test.each(unlocksDontApply)("WS55 WS56: $condition, features is null and the leaderboard is WS30's", async ({ turnOn }) => {
    await turnOn();
    const { asSignedIn } = await signedInMember();

    expect(await myProfile(asSignedIn)).toMatchObject({ features: null, leaderboard: { kind: "open" } });
  });

  test("WS55: a website read never runs the P77 launch, though xp-levels and unlocks are on", async () => {
    await flagsOn(...allFlags);
    const { asSignedIn } = await signedInMember();

    expect(await myProfile(asSignedIn)).toMatchObject({ features: null });
    expect(await t.run((ctx) => ctx.db.query("unlockLaunches").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("unlocks").collect())).toEqual([]);
  });

  describe("while unlocks apply", () => {
    beforeEach(() => launchedThen(...allFlags));

    test("WS56 WS57: a member at level 1 reads the shipped Leaderboard locked at level 2, with its name and what it opens", async () => {
      const { asSignedIn } = await signedInMember();

      const profile = await myProfile(asSignedIn);

      expect(profile.features).toEqual([
        { feature: "leaderboard", name: "Leaderboard", opens: "the boards", level: 2, state: "locked", readyAt: null, openedAt: null, seen: expect.any(String) },
      ]);
      expect(profile.leaderboard).toEqual({ kind: "locked", level: 2 });
    });

    test("WS56 WS57: a member at level 2 reads it ready since the moment their level made it ready", async () => {
      const { member, asSignedIn } = await signedInMember();
      const readyAt = Date.parse("2026-10-14T09:00:00Z");
      await reachesLevel(t, member, 2, readyAt);

      const profile = await myProfile(asSignedIn);

      expect(leaderboardEntryOf(profile)).toMatchObject({ state: "ready", readyAt, openedAt: null });
      expect(profile.leaderboard).toEqual({ kind: "ready" });
    });

    test("WS56 WS57: a member who opened it reads it open, with when", async () => {
      const { member, asSignedIn } = await signedInMember();
      await reachesLevel(t, member, 2, Date.parse("2026-10-14T09:00:00Z"));
      await opens(t, member, "leaderboard");

      const profile = await myProfile(asSignedIn);

      expect(leaderboardEntryOf(profile)).toMatchObject({ state: "open", readyAt: Date.parse("2026-10-14T09:00:00Z"), openedAt: now.getTime() });
      expect(profile.leaderboard).toEqual({ kind: "open" });
    });
  });

  test("P77: a member who was there at the launch reads the Leaderboard open from the launch", async () => {
    await flagsOn(...allFlags);
    const { asSignedIn } = await signedInMember();
    await unlocksShippedBeforeAnyoneJoined(t);

    const profile = await myProfile(asSignedIn);

    expect(leaderboardEntryOf(profile)).toMatchObject({ state: "open", readyAt: now.getTime(), openedAt: now.getTime() });
    expect(profile.leaderboard).toEqual({ kind: "open" });
  });

  describe("RS6: the Coins card is named as Slack names it for the member's store", () => {
    type StoreCase = { store: string; flags: string[]; name: string; opens: string };

    const storeCases: StoreCase[] = [
      { store: "with the store off", flags: ["coins"], name: "Coins", opens: "your wallet and the coin perks" },
      { store: "with the store on and slots kept", flags: ["coins", "store"], name: "Coins and inventory", opens: "your wallet, the store's kudos emoji and your emoji slots" },
      { store: "with the store on and slots retired", flags: ["coins", "store", "slots-retired"], name: "Coins and inventory", opens: "your wallet, the store and your kudos emoji" },
    ];

    test.each(storeCases)("$store, a member at level 6 reads Coins ready as $name, opening $opens", async ({ flags, name, opens }) => {
      await launchedThen(...allFlags, ...flags);
      const { member, asSignedIn } = await signedInMember();
      await reachesLevel(t, member, 6);

      const coins = (await myProfile(asSignedIn)).features?.find((card) => card.feature === "coins");

      expect(coins).toMatchObject({ state: "ready", name, opens, level: 6 });
    });
  });
});

describe("the website shows only shipped features", () => {
  test("WS56 P78: with skill-tree off, a member past level 5 reads no Skill tree entry", async () => {
    await launchedThen(...allFlags);
    const { member, asSignedIn } = await signedInMember();
    await reachesLevel(t, member, 5);

    expect((await myProfile(asSignedIn)).features?.map((card) => card.feature)).toEqual(["leaderboard"]);
  });

  test("WS56: with skill-tree on, a member at level 5 reads the Leaderboard and the Skill tree ready, in the schedule's order", async () => {
    await launchedThen(...allFlags, "skill-tree");
    const { member, asSignedIn } = await signedInMember();
    await reachesLevel(t, member, 5);

    const features = (await myProfile(asSignedIn)).features;

    expect(features?.map(({ feature, name, level, state }) => ({ feature, name, level, state }))).toEqual([
      { feature: "leaderboard", name: "Leaderboard", level: 2, state: "ready" },
      { feature: "skillTree", name: "Skill tree", level: 5, state: "ready" },
    ]);
  });

  test("WS57: with everyone-board off, there is no Leaderboard entry and the leaderboard reads off", async () => {
    await launchedThen("xp-levels", "unlocks", "skill-tree");
    const { asSignedIn } = await signedInMember();

    const profile = await myProfile(asSignedIn);

    expect(profile.features?.map((card) => card.feature)).toEqual(["skillTree"]);
    expect(profile.leaderboard).toEqual({ kind: "off" });
  });

  test("WS56 P78: with no feature shipped, features is an empty list, never the plain cards", async () => {
    await launchedThen("xp-levels", "unlocks");
    const { asSignedIn } = await signedInMember();

    expect(await myProfile(asSignedIn)).toMatchObject({ features: [], leaderboard: { kind: "off" } });
  });
});

describe("WS79: a feature page follows its entry, beside an unchanged leaderboard", () => {
  function pagesOf({ features, leaderboard }: MemberProfile) {
    const skillTree = features?.find((card) => card.feature === "skillTree");
    return { skillTree: skillTree && { state: skillTree.state, level: skillTree.level }, leaderboard };
  }

  test("with skill-tree on and unlocks not applying, there is no Skill tree entry and the leaderboard is WS30's", async () => {
    await flagsOn("everyone-board", "xp-levels", "skill-tree");
    const { asSignedIn } = await signedInMember();

    expect(pagesOf(await myProfile(asSignedIn))).toEqual({ skillTree: undefined, leaderboard: { kind: "open" } });
  });

  describe("while unlocks apply and skill-tree is on", () => {
    beforeEach(() => launchedThen(...allFlags, "skill-tree"));

    test("a member at level 1 reads the Skill tree locked at level 5 and the leaderboard locked at level 2", async () => {
      const { asSignedIn } = await signedInMember();

      expect(pagesOf(await myProfile(asSignedIn))).toEqual({ skillTree: { state: "locked", level: 5 }, leaderboard: { kind: "locked", level: 2 } });
    });

    test("a member at level 5 reads both ready", async () => {
      const { member, asSignedIn } = await signedInMember();
      await reachesLevel(t, member, 5);

      expect(pagesOf(await myProfile(asSignedIn))).toEqual({ skillTree: { state: "ready", level: 5 }, leaderboard: { kind: "ready" } });
    });

    test("a member who opened the Skill tree reads it open, and the unopened leaderboard still ready", async () => {
      const { member, asSignedIn } = await signedInMember();
      await reachesLevel(t, member, 5);
      await opens(t, member, "skillTree");

      expect(pagesOf(await myProfile(asSignedIn))).toEqual({ skillTree: { state: "open", level: 5 }, leaderboard: { kind: "ready" } });
    });
  });
});

describe("WS66: a crate's seen key is opaque and per member", () => {
  test("two members' keys for the same crate differ, stay the same across reads, and carry no ID", async () => {
    await launchedThen(...allFlags);
    const { member, asSignedIn } = await signedInMember();
    const bob = await aMember(t, "U_BOB");
    const { asSignedIn: asBob } = await aSession(t, { user: "U_BOB", name: "Bob" });

    const junoSeen = leaderboardEntryOf(await myProfile(asSignedIn))!.seen;
    const bobSeen = leaderboardEntryOf(await myProfile(asBob))!.seen;

    expect(junoSeen).not.toBe(bobSeen);
    expect(leaderboardEntryOf(await myProfile(asSignedIn))!.seen).toBe(junoSeen);
    for (const id of [member, bob, juno.user, "U_BOB", "T1"]) {
      expect(junoSeen).not.toContain(id);
      expect(bobSeen).not.toContain(id);
    }
  });
});
