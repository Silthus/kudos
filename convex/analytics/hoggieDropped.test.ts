import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, staleButtonOf } from "../../testing/slackInteractions";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Command } from "../commands/commands";
import { recordReward } from "../progression/progression";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const questsFlags = ["xp-levels", "unlocks", "quests", "collection"];
const crateStoreFlags = ["xp-levels", "unlocks", "achievements", "coins", "collection", "crate-store"];

type Caller = Pick<Backend, "mutation">;
type Opener = { asSignedIn: Caller };
type Packs = "packs" | "no packs";

type WaitingCrate = {
  kind: string;
  waitingFor: (packs: Packs) => Promise<Opener>;
  fromAppHome: Command;
  fromItsWebsiteCommand: (caller: Caller) => Promise<unknown>;
  crate: string;
  crateKind: string;
};

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().withMember(juno.user).fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function flagsOn(packs: Packs, ...keys: string[]) {
  return switchWebsite(t, postHog, true, ...keys, ...(packs === "packs" ? ["packs"] : []));
}

async function aTeam() {
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  return { member, asSignedIn };
}

async function aReadyFeature(packs: Packs) {
  await flagsOn(packs, ...questsFlags);
  await unlocksShippedBeforeAnyoneJoined(t);
  const team = await aTeam();
  await reachesLevel(t, team.member, 3);
  return team;
}

async function aBoughtCrate(packs: Packs) {
  await flagsOn(packs, ...crateStoreFlags);
  await bookShippedBeforeAnyoneJoined(t);
  const { member, asSignedIn } = await aTeam();
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  await opens(t, member, "book");
  await opens(t, member, "coins");
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:earned:50", xp: 0, coins: 50, item: null, catalogueVersion: "2", at: 0 }));
  expect(await asSignedIn.mutation(api.website.commands.buyCrate, { next: 1 })).toEqual({ kind: "bought", crate: "bought:1" });
  return { asSignedIn };
}

const waitingCrates: WaitingCrate[] = [
  {
    kind: "a feature's",
    waitingFor: aReadyFeature,
    fromAppHome: { type: "openUnlock", feature: "quests" },
    fromItsWebsiteCommand: (caller) => caller.mutation(api.website.commands.openFeature, { feature: "quests" }),
    crate: "unlock:quests",
    crateKind: "unlock",
  },
  {
    kind: "a bought",
    waitingFor: aBoughtCrate,
    fromAppHome: { type: "openCrate", crate: "bought:1" },
    fromItsWebsiteCommand: (caller) => caller.mutation(api.website.commands.openCrate, { crate: "bought:1" }),
    crate: "bought:1",
    crateKind: "bought",
  },
];

async function clickInAppHome(command: Command) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(juno.user, staleButtonOf(command)), form));
  await settleInTimeOrder(t);
}

function hoggiesDropped() {
  return postHog.productEvents().filter(({ event }) => event === "hoggie dropped");
}

async function droppedWhile(open: () => Promise<unknown>) {
  await settleInTimeOrder(t);
  const before = hoggiesDropped().length;
  await open();
  await settleInTimeOrder(t);
  return hoggiesDropped()
    .slice(before)
    .map(({ properties: { crate_kind, surface } }) => ({ crate_kind, surface }));
}

describe("MS12: every pack open says where it was opened", () => {
  test.each(waitingCrates)("$kind crate opened from App Home drops a hoggie with surface slack", async ({ waitingFor, fromAppHome, crateKind }) => {
    await waitingFor("no packs");

    expect(await droppedWhile(() => clickInAppHome(fromAppHome))).toEqual([{ crate_kind: crateKind, surface: "slack" }]);
  });

  test.each(waitingCrates)("$kind crate opened by its website command drops a hoggie with surface website", async ({ waitingFor, fromItsWebsiteCommand, crateKind }) => {
    const { asSignedIn } = await waitingFor("no packs");

    expect(await droppedWhile(() => fromItsWebsiteCommand(asSignedIn))).toEqual([{ crate_kind: crateKind, surface: "website" }]);
  });

  test.each(waitingCrates)("$kind crate opened as a pack on the website drops a hoggie with surface website", async ({ waitingFor, crate, crateKind }) => {
    const { asSignedIn } = await waitingFor("packs");

    expect(await droppedWhile(() => asSignedIn.mutation(api.website.commands.openCrate, { crate }))).toEqual([{ crate_kind: crateKind, surface: "website" }]);
  });

  test("a hoggieDropped queued before surface existed sends hoggie dropped without it", async () => {
    const member = await aMember(t, juno.user);

    await t.mutation(internal.analytics.subscribers.recordHoggieDropped, { event: { type: "hoggieDropped", workspace: "T1", member, crate: "unlock:quests", hoggie: "builder", rarity: "common", copy: 1, at: Date.now() } });

    await settleInTimeOrder(t);
    const dropped = postHog.productEvents().filter(({ event }) => event === "hoggie dropped");
    expect(dropped).toHaveLength(1);
    expect(Object.keys(dropped[0]!.properties)).not.toContain("surface");
  });
});
