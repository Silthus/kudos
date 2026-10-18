import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, journeyShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, staleButtonOf } from "../../testing/slackInteractions";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Command } from "../commands/commands";
import { allowanceDay } from "../engine/allowance";
import { recordReward } from "../progression/progression";
import { rewardKeyOf } from "../quests/crates";
import type { Quest } from "../quests/step";

const now = new Date("2026-10-14T10:00:00Z");
const thisWeek = "2026-10-12";
const form = { contentType: "application/x-www-form-urlencoded" };
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const questsFlags = ["xp-levels", "unlocks", "quests", "collection"];
const crateStoreFlags = ["xp-levels", "unlocks", "achievements", "coins", "collection", "crate-store"];
const firstThanks: Quest = { kind: "journey", step: "first-thanks" };
const firstSlot: Quest = { kind: "weekly", week: thisWeek, slot: 0 };

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
  const teammate = await aMember(t, rowan.user);
  const { asSignedIn } = await aSignedInSession(t, juno);
  return { member, teammate, asSignedIn };
}

async function thanks(giver: Awaited<ReturnType<typeof aTeam>>["member"], recipient: typeof giver) {
  const at = Date.now();
  const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { annotations: saysWhy, day: allowanceDay(at, undefined), at }));
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
}

async function aFinishedJourneyStep(packs: Packs) {
  await flagsOn(packs, ...questsFlags);
  await journeyShippedBeforeAnyoneJoined(t);
  const team = await aTeam();
  await thanks(team.member, team.teammate);
  return team;
}

async function aFinishedWeeklyQuest(packs: Packs) {
  await flagsOn(packs, ...questsFlags);
  await journeyShippedBeforeAnyoneJoined(t);
  const team = await aTeam();
  await reachesLevel(t, team.member, 3);
  await opens(t, team.member, "quests");
  const slots = (["say-why", "say-why-three-times"] as const).map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member: team.member, week: thisWeek, drawnAt: Date.now(), slots }));
  await thanks(team.member, team.teammate);
  return team;
}

async function aReadyFeature(packs: Packs) {
  await flagsOn(packs, ...questsFlags);
  await journeyShippedBeforeAnyoneJoined(t);
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
    kind: "a Journey step's",
    waitingFor: aFinishedJourneyStep,
    fromAppHome: { type: "openQuestCrate", quest: firstThanks },
    fromItsWebsiteCommand: (caller) => caller.mutation(api.website.commands.openQuestCrate, { quest: firstThanks }),
    crate: rewardKeyOf(firstThanks),
    crateKind: "journey",
  },
  {
    kind: "a weekly quest's",
    waitingFor: aFinishedWeeklyQuest,
    fromAppHome: { type: "openQuestCrate", quest: firstSlot },
    fromItsWebsiteCommand: (caller) => caller.mutation(api.website.commands.openQuestCrate, { quest: firstSlot }),
    crate: rewardKeyOf(firstSlot),
    crateKind: "weekly",
  },
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
