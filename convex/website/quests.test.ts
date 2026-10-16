import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { journeyShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { allowanceDay } from "../engine/allowance";
import { rewardKeyOf } from "../quests/crates";
import { activated, activateJourneyOf, journey } from "../quests/journey";
import { openQuestCrate } from "../quests/open";
import { questOf, type QuestId } from "../quests/pool";
import { featureOpening, type JourneyStep as JourneyStepId, type Quest } from "../quests/step";
import { rerollQuest } from "../quests/weekly";
import { workspaceLink } from "../slack/workspaceLink";
import type { MemberId } from "../workspace/directory";
import type { MemberProfile } from "./profile";
import type { QuestsAnswer } from "./quests";

const now = new Date("2026-10-14T10:00:00Z");
const thisWeek = "2026-10-12";
const nextMonday = new Date("2026-10-19T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const rowan = { user: "U_ROWAN", name: "Rowan Pike" };
const questsFlags = ["xp-levels", "unlocks", "quests"];
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };
const firstThanks = { kind: "journey", step: "first-thanks" } as const;
const firstThanksCopy = { goal: "Give a kudos that says why.", hint: "It counts when your message has 5 or more words besides mentions and emoji." };

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

async function questsApply() {
  await flagsOn(...questsFlags);
  await journeyShippedBeforeAnyoneJoined(t);
}

async function signedIn(person = juno) {
  const member = await aMember(t, person.user);
  const { asSignedIn } = await aSession(t, person, { endsIn: 30 * 24 * 60 * 60 * 1000 });
  return { member, asSignedIn };
}

async function aTeam() {
  const me = await signedIn(juno);
  const teammate = await signedIn(rowan);
  return { ...me, teammate };
}

async function questsOpenFor(member: MemberId, ...drawn: QuestId[]) {
  await reachesLevel(t, member, 2);
  await opens(t, member, "quests");
  if (drawn.length > 0) await drawnIn(member, thisWeek, drawn);
}

function drawnIn(member: MemberId, week: string, quests: QuestId[], coins = 0) {
  const slots = quests.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  return t.run((ctx) => ctx.db.insert("questDraws", { member, week, drawnAt: Date.now(), slots }));
}

async function thanks(giver: MemberId, recipient: MemberId) {
  const at = Date.now();
  const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { annotations: saysWhy, day: allowanceDay(at, undefined), at }));
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
}

async function aLongHistory(giver: MemberId, recipient: MemberId, awards: number) {
  const longAgo = Date.parse("2025-01-01T10:00:00Z");
  for (let batch = 0; batch * 8000 < awards; batch++) {
    await t.run(async (ctx) => {
      for (let index = batch * 8000; index < Math.min(awards, (batch + 1) * 8000); index++) {
        await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: `history-${index}`, giver, recipient, kudos: 1, day: "2025-01-01", at: longAgo });
      }
    });
  }
}

async function openedCratesIn(member: MemberId, week: string, crates: number) {
  const at = Date.parse("2026-10-07T10:00:00Z");
  for (let batch = 0; batch * 2100 < crates; batch++) {
    await t.run(async (ctx) => {
      for (let slot = batch * 2100; slot < Math.min(crates, (batch + 1) * 2100); slot++) {
        const key = `weekly:${week}:${slot}`;
        await ctx.db.insert("rewardRecords", { member, key, xp: 20, coins: 0, item: null, catalogueVersion: "1", at });
        await ctx.db.insert("crateOpenings", { member, key, at });
      }
    });
  }
}

async function opensCrate(member: MemberId, quest: Quest) {
  expect(await t.run((ctx) => openQuestCrate(ctx, member, quest))).toBe("done");
}

async function swaps(member: MemberId, slot: number) {
  expect(await t.run((ctx) => rerollQuest(ctx, member, { kind: "weekly", week: thisWeek, slot }))).toBe("swapped");
}

async function questsOf(asSignedIn: Pick<Backend, "query">): Promise<QuestsAnswer> {
  const answer = await asSignedIn.query(api.website.quests.getQuests, {});
  if ("kind" in answer && ["closed", "signed-out", "verifying", "unverified", "not-a-member"].includes(answer.kind)) throw new Error(`expected an answer, got ${answer.kind}`);
  return answer as QuestsAnswer;
}

async function openQuests(asSignedIn: Pick<Backend, "query">) {
  const answer = await questsOf(asSignedIn);
  if (answer.kind !== "quests") throw new Error(`expected quests, got ${answer.kind}`);
  return answer;
}

async function myProfile(asSignedIn: Pick<Backend, "query">): Promise<MemberProfile> {
  const profile = await asSignedIn.query(api.website.profile.getMyProfile, {});
  if (profile.kind !== "member") throw new Error(`expected a member, got ${profile.kind}`);
  return profile;
}

async function journeyOf(asSignedIn: Pick<Backend, "query">) {
  return (await myProfile(asSignedIn)).journey;
}

function domainFactsOf(member: MemberId) {
  return t.query(internal.quests.quests.questsOf, { member });
}

describe("website reads pass one guard", () => {
  test("getQuests reads closed while the website flag is off, even with quests on", async () => {
    await questsApply();
    const { asSignedIn } = await signedIn();
    await switchWebsite(t, postHog, false, ...questsFlags);

    expect(await asSignedIn.query(api.website.quests.getQuests, {})).toEqual({ kind: "closed" });
  });

  test("getQuests reads signed out without a session", async () => {
    await questsApply();

    expect(await t.query(api.website.quests.getQuests, {})).toEqual({ kind: "signed-out" });
  });

  test("getQuests reads not-a-member for a former member with a live session", async () => {
    await questsApply();
    await aMember(t, juno.user, "not-a-member");
    const { asSignedIn } = await aSession(t, juno);

    expect(await asSignedIn.query(api.website.quests.getQuests, {})).toEqual({ kind: "not-a-member" });
  });

  test("an argument that names another member is rejected by the validator", async () => {
    await questsApply();
    const { asSignedIn } = await signedIn();
    const withAnotherMember = { user: rowan.user } as unknown as Record<string, never>;

    await expect(asSignedIn.query(api.website.quests.getQuests, withAnotherMember)).rejects.toThrow(/user/);
  });
});

describe("quests are invisible where they don't apply", () => {
  const switchedOff = [
    { condition: "quests switched off", stillOn: ["xp-levels", "unlocks"] },
    { condition: "xp-levels switched off", stillOn: ["unlocks", "quests"] },
    { condition: "unlocks switched off", stillOn: ["xp-levels", "quests"] },
  ];

  test.each(switchedOff)("WS69 WS70 WS71: with $condition after a member finished a quest and a Journey step, getQuests answers not-found and journey is null", async ({ stillOn }) => {
    await questsApply();
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why");
    await thanks(member, teammate.member);

    await flagsOn(...stillOn);

    expect(await questsOf(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await journeyOf(asSignedIn)).toBeNull();
  });

  test("WS69 WS55: with every flag on and nothing launched, a website read answers not-found and runs neither launch", async () => {
    await flagsOn(...questsFlags);
    const { asSignedIn } = await signedIn();

    expect(await questsOf(asSignedIn)).toEqual({ kind: "not-found" });
    expect(await journeyOf(asSignedIn)).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("unlockLaunches").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("journeyLaunches").collect())).toEqual([]);
  });
});

describe("WS70: getQuests reads the quests module's facts", () => {
  beforeEach(questsApply);

  test("a member at level 1 reads Quests locked at level 2, with no quest fact", async () => {
    const { asSignedIn } = await signedIn();

    expect(await questsOf(asSignedIn)).toEqual({ kind: "locked", level: 2 });
  });

  test("a member at level 2 reads Quests ready, with no quest fact", async () => {
    const { member, asSignedIn } = await signedIn();
    await reachesLevel(t, member, 2);

    expect(await questsOf(asSignedIn)).toEqual({ kind: "ready" });
  });

  test("P80: with Quests open and nothing drawn, slots and waiting are empty, beside the link to Slack", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);

    expect(await questsOf(asSignedIn)).toEqual({ kind: "quests", slots: [], swap: { used: false, available: false }, group: null, waiting: [], bonus: null, chatUrl: workspaceLink("T1") });
  });

  test("P80: fewer than three drawn quests read as that many slots, in slot order, each in progress at 0", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member, "say-why-twice", "not-in-30-days");

    expect((await openQuests(asSignedIn)).slots).toEqual([
      { slot: 0, quest: { kind: "weekly", week: thisWeek, slot: 0 }, kind: "Say why", goal: "Thank someone and say why, 2 times.", progress: { done: 0, target: 2 }, reward: { xp: 20 }, state: "in-progress", swapped: false, crate: null, seen: null, waiting: false },
      { slot: 1, quest: { kind: "weekly", week: thisWeek, slot: 1 }, kind: "Reach out", goal: "Thank someone you haven't thanked in the last 30 days.", progress: { done: 0, target: 1 }, reward: { xp: 20 }, state: "in-progress", swapped: false, crate: null, seen: null, waiting: false },
    ]);
  });

  test("P84 P85: a slot in progress, a finished slot with its crate, and an opened slot without one", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why", "someone-new", "say-why-three-times");
    await thanks(member, teammate.member);
    await opensCrate(member, { kind: "weekly", week: thisWeek, slot: 0 });

    expect((await openQuests(asSignedIn)).slots).toEqual([
      { slot: 0, quest: { kind: "weekly", week: thisWeek, slot: 0 }, kind: "Say why", goal: "Thank someone and say why.", progress: { done: 1, target: 1 }, reward: { xp: 20 }, state: "opened", swapped: false, crate: null, seen: expect.any(String), waiting: false },
      {
        slot: 1,
        quest: { kind: "weekly", week: thisWeek, slot: 1 },
        kind: "Reach out",
        goal: "Thank someone you haven't thanked before.",
        progress: { done: 1, target: 1 },
        reward: { xp: 20 },
        state: "finished",
        swapped: false,
        crate: { kind: "weekly", week: thisWeek, slot: 1 },
        seen: expect.any(String),
        waiting: false,
      },
      { slot: 2, quest: { kind: "weekly", week: thisWeek, slot: 2 }, kind: "Say why", goal: "Thank someone and say why, 3 times.", progress: { done: 1, target: 3 }, reward: { xp: 20 }, state: "in-progress", swapped: false, crate: null, seen: null, waiting: false },
    ]);
  });

  test("P81: a swapped slot reads swapped, with the quest swapped in at 0", async () => {
    const { member, asSignedIn } = await aTeam();
    await questsOpenFor(member, "say-why-twice", "someone-new", "say-why-three-times");
    await swaps(member, 2);

    const { slots } = await openQuests(asSignedIn);
    const swappedIn = questOf((await domainFactsOf(member))!.week!.swap!.quest);

    expect(slots.map(({ swapped }) => swapped)).toEqual([false, false, true]);
    expect(slots[2]).toEqual({
      slot: 2,
      quest: { kind: "weekly", week: thisWeek, slot: 2 },
      kind: swappedIn.kind === "breadth" ? "Reach out" : "Say why",
      goal: swappedIn.goal,
      progress: { done: 0, target: swappedIn.progress.target },
      reward: { xp: 20 },
      state: "in-progress",
      swapped: true,
      crate: null,
      seen: null,
      waiting: false,
    });
  });

  test("every slot's value is the quests module's fact read directly", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why", "two-new", "say-why-two-days");
    await swaps(member, 2);
    await thanks(member, teammate.member);
    await opensCrate(member, { kind: "weekly", week: thisWeek, slot: 0 });

    const { slots } = await openQuests(asSignedIn);
    const { week } = (await domainFactsOf(member))!;

    expect(
      slots.map(({ slot, goal, progress, reward, swapped }) => ({ slot, goal, progress, reward, swapped })),
    ).toEqual(
      week!.slots.map(({ slot, goal, progress, target, reward }) => ({ slot, goal, progress: { done: progress, target }, reward: { xp: reward.xp }, swapped: week!.swap?.slot === slot })),
    );
    expect(slots.map(({ state }) => state)).toEqual(week!.slots.map(({ finishedAt, openedAt }) => (finishedAt === null ? "in-progress" : openedAt === null ? "finished" : "opened")));
  });

  describe("WS319: the week's swap", () => {
    test("before the swap, it is available and unused, as the quests module offers it", async () => {
      const { member, asSignedIn } = await aTeam();
      await questsOpenFor(member, "say-why", "say-why-twice", "say-why-three-times");

      expect((await openQuests(asSignedIn)).swap).toEqual({ used: false, available: true });
      expect((await domainFactsOf(member))!.week).toMatchObject({ swap: null, swapAvailable: true });
    });

    test("after the swap, it is used and no longer available", async () => {
      const { member, asSignedIn } = await aTeam();
      await questsOpenFor(member, "say-why", "say-why-twice", "say-why-three-times");
      await swaps(member, 1);

      expect((await openQuests(asSignedIn)).swap).toEqual({ used: true, available: false });
    });

    test("with every slot finished, it is neither used nor available", async () => {
      const { member, asSignedIn, teammate } = await aTeam();
      await questsOpenFor(member, "say-why", "someone-new");
      await thanks(member, teammate.member);

      expect((await openQuests(asSignedIn)).swap).toEqual({ used: false, available: false });
    });

    test("each slot's quest is the whole weekly quest the swap command takes", async () => {
      const { member, asSignedIn } = await aTeam();
      await questsOpenFor(member, "say-why", "say-why-twice", "say-why-three-times");
      const { slots } = await openQuests(asSignedIn);

      expect(await t.run((ctx) => rerollQuest(ctx, member, slots[1]!.quest))).toBe("swapped");
      expect((await domainFactsOf(member))!.week!.swap).toMatchObject({ slot: 1, replaced: "say-why-twice" });
    });
  });

  test("a member with a long history of kudos still reads this week's slots and swap within Convex's read limits", async () => {
    t = testBackend({ transactionLimits: true });
    await questsApply();
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why-twice");
    await aLongHistory(member, teammate.member, 33_000);

    const { slots, swap } = await openQuests(asSignedIn);
    expect(slots).toEqual([expect.objectContaining({ slot: 0, state: "in-progress" })]);
    expect(swap).toEqual({ used: false, available: true });
  });

  test("P85: after the Monday turn, last week's finished, unopened crate waits, and leaves once opened", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why", "someone-new", "say-why-three-times");
    await thanks(member, teammate.member);
    await opensCrate(member, { kind: "weekly", week: thisWeek, slot: 1 });
    vi.setSystemTime(nextMonday);

    const afterTheTurn = await openQuests(asSignedIn);

    expect(afterTheTurn.slots).toEqual([]);
    expect(afterTheTurn.waiting).toEqual([{ goal: "Thank someone and say why.", group: null, week: thisWeek, reward: { xp: 20 }, crate: { kind: "weekly", week: thisWeek, slot: 0 }, seen: expect.any(String), waiting: false }]);

    await opensCrate(member, afterTheTurn.waiting[0]!.crate);

    expect((await openQuests(asSignedIn)).waiting).toEqual([]);
  });

  test("P85: crates of two earlier weeks wait oldest first", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
    await questsOpenFor(member);
    await drawnIn(member, "2026-10-05", ["say-why-twice", "say-why"]);
    await thanks(member, teammate.member);
    vi.setSystemTime(now);
    await drawnIn(member, thisWeek, ["say-why-three-times", "say-why"]);
    await thanks(member, teammate.member);
    vi.setSystemTime(nextMonday);

    expect((await openQuests(asSignedIn)).waiting.map(({ crate }) => crate)).toEqual([
      { kind: "weekly", week: "2026-10-05", slot: 1 },
      { kind: "weekly", week: thisWeek, slot: 1 },
    ]);
  });

  test("WS70: two earlier weeks that finished the same quest each wait with their own week", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
    await questsOpenFor(member);
    await drawnIn(member, "2026-10-05", ["say-why"]);
    await thanks(member, teammate.member);
    vi.setSystemTime(now);
    await drawnIn(member, thisWeek, ["say-why"]);
    await thanks(member, teammate.member);
    vi.setSystemTime(nextMonday);

    expect((await openQuests(asSignedIn)).waiting.map(({ goal, week }) => ({ goal, week }))).toEqual([
      { goal: "Thank someone and say why.", week: "2026-10-05" },
      { goal: "Thank someone and say why.", week: thisWeek },
    ]);
  });

  test("WS66: a crate keeps its seen key from finished to waiting", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why");
    await thanks(member, teammate.member);
    const finished = (await openQuests(asSignedIn)).slots[0]!.seen;
    vi.setSystemTime(nextMonday);

    expect((await openQuests(asSignedIn)).waiting[0]!.seen).toBe(finished);
  });
});

describe("CR13: waiting says a finished crate's reward still waits in it", () => {
  beforeEach(async () => {
    await flagsOn(...questsFlags, "crate-rewards");
    await journeyShippedBeforeAnyoneJoined(t);
  });

  test("a finished weekly quest waits until its crate is opened, and an earlier week's unopened crate still waits after the turn", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why", "someone-new", "say-why-three-times");
    await thanks(member, teammate.member);

    expect((await openQuests(asSignedIn)).slots.map(({ state, waiting }) => ({ state, waiting }))).toEqual([
      { state: "finished", waiting: true },
      { state: "finished", waiting: true },
      { state: "in-progress", waiting: false },
    ]);

    await opensCrate(member, { kind: "weekly", week: thisWeek, slot: 0 });

    expect((await openQuests(asSignedIn)).slots.map(({ state, waiting }) => ({ state, waiting }))).toEqual([
      { state: "opened", waiting: false },
      { state: "finished", waiting: true },
      { state: "in-progress", waiting: false },
    ]);

    vi.setSystemTime(nextMonday);

    expect((await openQuests(asSignedIn)).waiting).toEqual([
      { goal: "Thank someone you haven't thanked before.", group: null, week: thisWeek, reward: { xp: 20 }, crate: { kind: "weekly", week: thisWeek, slot: 1 }, seen: expect.any(String), waiting: true },
    ]);
  });

  test("a finished Journey step waits in getMyProfile's journey and getQuests' bonus until its crate is opened", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member);
    await thanks(member, teammate.member);

    expect(await journeyOf(asSignedIn)).toEqual([expect.objectContaining({ step: "first-thanks", state: "finished", waiting: true })]);
    expect((await openQuests(asSignedIn)).bonus).toMatchObject({ step: "first-thanks", state: "finished", waiting: true });

    await opensCrate(member, firstThanks);

    expect(await journeyOf(asSignedIn)).toEqual([expect.objectContaining({ step: "first-thanks", state: "opened", waiting: false })]);
  });

  test("CR4: a reward finished while crate-rewards was off counted at its finish, so its crates never wait", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await flagsOn(...questsFlags);
    await questsOpenFor(member, "say-why");
    await thanks(member, teammate.member);
    await flagsOn(...questsFlags, "crate-rewards");

    expect((await openQuests(asSignedIn)).slots.map(({ state, waiting }) => ({ state, waiting }))).toEqual([{ state: "finished", waiting: false }]);
    expect(await journeyOf(asSignedIn)).toEqual([expect.objectContaining({ state: "finished", waiting: false })]);

    vi.setSystemTime(nextMonday);

    expect((await openQuests(asSignedIn)).waiting.map(({ waiting }) => waiting)).toEqual([false]);
  });
});

describe("P85: the pending-crate index lists every crate still waiting, within Convex's limits", () => {
  beforeEach(questsApply);

  test("a member with thousands of crates opened in earlier weeks still reads what waits within Convex's read limits", async () => {
    t = testBackend({ transactionLimits: true });
    await questsApply();
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member, "say-why");
    await thanks(member, teammate.member);
    await openedCratesIn(member, "2026-10-05", 4_200);
    vi.setSystemTime(nextMonday);

    expect((await openQuests(asSignedIn)).waiting.map(({ crate }) => crate)).toEqual([{ kind: "weekly", week: thisWeek, slot: 0 }]);
  });
});

describe("WS71: getMyProfile's journey", () => {
  beforeEach(questsApply);

  test("P88: a website-first member with no stored activation reads first-thanks active, with its copy and the catalogue's reward", async () => {
    const { asSignedIn } = await signedIn();

    expect(await journeyOf(asSignedIn)).toEqual([{ step: "first-thanks", ...firstThanksCopy, reward: { xp: 10 }, state: "active", crate: null, seen: null, feature: null, waiting: false }]);
    expect(await t.run((ctx) => ctx.db.query("journeySteps").collect())).toEqual([]);
  });

  test("the Journey isn't gated by the Quests feature: a member at level 1 reads their step", async () => {
    const { asSignedIn } = await signedIn();

    expect(await questsOf(asSignedIn)).toEqual({ kind: "locked", level: 2 });
    expect(await journeyOf(asSignedIn)).toHaveLength(1);
  });

  test("P85: a finished step carries its crate and seen key; once opened it keeps the key and drops the crate", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await thanks(member, teammate.member);

    const finished = await journeyOf(asSignedIn);
    expect(finished).toEqual([{ step: "first-thanks", ...firstThanksCopy, reward: { xp: 10 }, state: "finished", crate: firstThanks, seen: expect.any(String), feature: null, waiting: false }]);

    await opensCrate(member, firstThanks);

    expect(await journeyOf(asSignedIn)).toEqual([{ ...finished![0], state: "opened", crate: null }]);
  });

  test("P88: a step a feature activated reads active in chain order after first-thanks, with its copy and stored reward", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);
    await t.mutation(internal.quests.journey.activateJourney, { event: { type: "unlockOpened", workspace: "T1", member, feature: "quests", at: Date.now() } });

    expect(await journeyOf(asSignedIn)).toEqual([
      { step: "first-thanks", ...firstThanksCopy, reward: { xp: 10 }, state: "active", crate: null, seen: null, feature: null, waiting: false },
      { step: "first-quest", goal: "Finish a weekly quest.", hint: null, reward: { xp: 20 }, state: "active", crate: null, seen: null, feature: "quests", waiting: false },
    ]);
  });

  test("every step's value is the quests module's fact read directly", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await thanks(member, teammate.member);

    const journey = await journeyOf(asSignedIn);
    const facts = (await domainFactsOf(member))!.journey;

    expect(journey!.map(({ step, reward }) => ({ step, reward }))).toEqual(facts.map(({ step, reward }) => ({ step, reward: { xp: reward.xp } })));
  });
});

describe("WS317: getQuests' bonus is the Journey's next step", () => {
  beforeEach(async () => {
    await questsApply();
    vi.advanceTimersByTime(60_000);
  });

  async function joined(member: MemberId) {
    await t.run((ctx) => activateJourneyOf(ctx, member));
  }

  async function finishedAndOpened(member: MemberId, step: JourneyStepId) {
    const at = Date.now();
    const key = rewardKeyOf({ kind: "journey", step });
    await t.run(async (ctx) => {
      await activated(ctx, "T1", member, step, at, journey);
      await ctx.db.insert("rewardRecords", { member, key, xp: 20, coins: 0, item: null, catalogueVersion: journey.version, at });
      await ctx.db.insert("crateOpenings", { member, key, at });
    });
  }

  function scheduledJobs() {
    return t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  }

  async function bonusOf(asSignedIn: Pick<Backend, "query">) {
    return (await openQuests(asSignedIn)).bonus;
  }

  test("a joined member's active first-thanks is the bonus, with no feature", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);
    await joined(member);

    expect(await bonusOf(asSignedIn)).toEqual({ step: "first-thanks", ...firstThanksCopy, reward: { xp: 10 }, state: "active", crate: null, seen: null, feature: null, waiting: false });
  });

  test("P85: a finished step stays the bonus with its crate and seen key until it's opened", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    await questsOpenFor(member);
    await joined(member);
    await thanks(member, teammate.member);

    expect(await bonusOf(asSignedIn)).toEqual({ step: "first-thanks", ...firstThanksCopy, reward: { xp: 10 }, state: "finished", crate: firstThanks, seen: expect.any(String), feature: null, waiting: false });
  });

  test("once a step is opened, the next step is the bonus, with the feature it belongs to", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);
    await joined(member);
    await finishedAndOpened(member, "first-thanks");

    expect(await bonusOf(asSignedIn)).toEqual({ step: "first-quest", goal: "Finish a weekly quest.", hint: null, reward: { xp: 20 }, state: "active", crate: null, seen: null, feature: "quests", waiting: false });
  });

  test("P88: a website-first member who hasn't joined reads no bonus, and the read joins nobody", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);
    const scheduledBefore = await scheduledJobs();

    expect(await bonusOf(asSignedIn)).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("journeySteps").collect())).toEqual([]);
    expect(await scheduledJobs()).toEqual(scheduledBefore);
  });

  test("with every step opened, there is no bonus", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);
    await joined(member);
    for (const step of ["first-thanks", "first-quest", "someone-new"] as const) await finishedAndOpened(member, step);

    expect((await journeyOf(asSignedIn))!.every(({ state }) => state === "opened")).toBe(true);
    expect(await bonusOf(asSignedIn)).toBeNull();
  });

  test("getMyProfile's Journey steps carry the feature each step belongs to, from Quests' own mapping", async () => {
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);
    await joined(member);

    expect((await journeyOf(asSignedIn))!.map(({ step, feature }) => ({ step, feature }))).toEqual([
      { step: "first-thanks", feature: featureOpening("first-thanks") },
      { step: "first-quest", feature: featureOpening("first-quest") },
    ]);
  });
});

describe("WS348 CO26 CO29: a quest's coins show only while the member's wallet answers", () => {
  const coinFlags = [...questsFlags, "coins", "store"];
  const yourEmoji = { kind: "journey", step: "your-emoji" } as const;
  const firstThanksPayingCoins = { version: "test", steps: [{ step: "first-thanks", reward: { xp: 10, coins: 5, item: null } }] } as const;

  async function coinsOpenWithQuestsPaying(coins: number) {
    await flagsOn(...coinFlags);
    await journeyShippedBeforeAnyoneJoined(t);
    const team = await aTeam();
    await questsOpenFor(team.member);
    await drawnIn(team.member, thisWeek, ["say-why", "say-why-three-times"], coins);
    await reachesLevel(t, team.member, 6);
    await opens(t, team.member, "coins");
    await t.run(async (ctx) => {
      await activated(ctx, "T1", team.member, "first-thanks", Date.now(), firstThanksPayingCoins);
      await activateJourneyOf(ctx, team.member);
      await activated(ctx, "T1", team.member, "your-emoji", Date.now(), journey);
    });
    return team;
  }

  function rewardsOf({ slots, waiting, bonus }: Awaited<ReturnType<typeof openQuests>>, journeySteps: MemberProfile["journey"]) {
    return { slots: slots.map(({ reward }) => reward), waiting: waiting.map(({ reward }) => reward), bonus: bonus?.reward, journey: journeySteps?.map(({ step, reward }) => ({ step, reward })) };
  }

  test("with Coins open, every slot, waiting crate, the bonus and the Journey read the coins their reward records", async () => {
    const { member, asSignedIn, teammate } = await coinsOpenWithQuestsPaying(10);
    await thanks(member, teammate.member);
    vi.setSystemTime(nextMonday);
    await drawnIn(member, "2026-10-19", ["say-why-twice"], 10);

    expect(rewardsOf(await openQuests(asSignedIn), await journeyOf(asSignedIn))).toEqual({
      slots: [{ xp: 20, coins: 10 }],
      waiting: [{ xp: 20, coins: 10 }],
      bonus: { xp: 10, coins: 5 },
      journey: [
        { step: "first-thanks", reward: { xp: 10, coins: 5 } },
        { step: "your-emoji", reward: { xp: 40, coins: 20 } },
      ],
    });
  });

  test("a finished Journey step keeps its coins on the crate it waits in", async () => {
    const { member, asSignedIn } = await coinsOpenWithQuestsPaying(10);
    await t.run((ctx) => ctx.db.insert("rewardRecords", { member, key: rewardKeyOf(yourEmoji), xp: 40, coins: 20, item: null, catalogueVersion: journey.version, at: Date.now() }));

    expect((await journeyOf(asSignedIn))?.find(({ step }) => step === "your-emoji")).toMatchObject({ state: "finished", crate: yourEmoji, reward: { xp: 40, coins: 20 } });
  });

  test("while the coins flag is off, the same slots, waiting crate, bonus and Journey read their XP alone", async () => {
    const { member, asSignedIn, teammate } = await coinsOpenWithQuestsPaying(10);
    await thanks(member, teammate.member);
    vi.setSystemTime(nextMonday);
    await drawnIn(member, "2026-10-19", ["say-why-twice"], 10);
    await flagsOn(...questsFlags);

    expect(rewardsOf(await openQuests(asSignedIn), await journeyOf(asSignedIn))).toEqual({ slots: [{ xp: 20 }], waiting: [{ xp: 20 }], bonus: { xp: 10 }, journey: [{ step: "first-thanks", reward: { xp: 10 } }] });
  });

  test("before Coins is open, a quest paying coins reads its XP alone", async () => {
    await flagsOn(...coinFlags);
    await journeyShippedBeforeAnyoneJoined(t);
    const { member, asSignedIn } = await signedIn();
    await questsOpenFor(member);
    await drawnIn(member, thisWeek, ["say-why"], 10);

    expect((await openQuests(asSignedIn)).slots.map(({ reward }) => reward)).toEqual([{ xp: 20 }]);
  });
});

describe("WS66 WS33: seen keys are per member and carry no ID", () => {
  beforeEach(questsApply);

  test("two members who finished the same Journey step and weekly slot read different keys, neither holding a member, Slack or workspace ID", async () => {
    const { member, asSignedIn, teammate } = await aTeam();
    const rowanSignedIn = (await aSession(t, rowan)).asSignedIn;
    await questsOpenFor(member, "say-why");
    await questsOpenFor(teammate.member, "say-why");
    await thanks(member, teammate.member);
    await thanks(teammate.member, member);

    const junoKeys = [(await journeyOf(asSignedIn))![0]!.seen, (await openQuests(asSignedIn)).slots[0]!.seen];
    const rowanKeys = [(await journeyOf(rowanSignedIn))![0]!.seen, (await openQuests(rowanSignedIn)).slots[0]!.seen];

    expect(junoKeys[0]).not.toBe(rowanKeys[0]);
    expect(junoKeys[1]).not.toBe(rowanKeys[1]);
    for (const key of [...junoKeys, ...rowanKeys]) for (const id of [member, teammate.member, juno.user, rowan.user, "T1"]) expect(key).not.toContain(id);
  });
});
