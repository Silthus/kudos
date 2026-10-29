import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type FakePostHog, type FlagDefinition, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, journeyShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, text, userGroupEvent } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { Command } from "../commands/commands";
import crons from "../crons";
import { xpToReach } from "../progression/levels";
import { recordReward } from "../progression/progression";
import type { Quest } from "../quests/step";
import schema from "../schema";
import type { Feature } from "../unlocks/feature";
import { keepOpen } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";

const thePacks = vi.hoisted(() => ({ removed: false }));

vi.mock("../album/hoggies/flag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../album/hoggies/flag")>();
  return {
    ...actual,
    packsShownTo: vi.fn((...args: Parameters<typeof actual.packsShownTo>) => (thePacks.removed ? Promise.resolve(false) : actual.packsShownTo(...args))),
    packsPayFor: vi.fn((...args: Parameters<typeof actual.packsPayFor>) => (thePacks.removed ? Promise.resolve(false) : actual.packsPayFor(...args))),
  };
});

vi.mock("../quests/rank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../quests/rank")>();
  return { ...actual, drawRank: vi.fn((key: string) => actual.drawRank(key.replace(/^[^:]+/, (member) => namedIds.get(member) ?? member))) };
});

vi.mock("../website/seen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../website/seen")>();
  return { ...actual, seenKeyOf: vi.fn((member: Parameters<typeof actual.seenKeyOf>[0], crate: string) => actual.seenKeyOf((namedIds.get(member) ?? member) as typeof member, crate)) };
});

vi.mock("../album/hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../album/hoggies/draw")>();
  const named = <T extends { member: string; crate: string }>(input: T): T => ({ ...input, member: namedIds.get(input.member) ?? input.member, crate: withNamedIds(input.crate) });
  return {
    ...actual,
    drawOf: vi.fn((input: Parameters<typeof actual.drawOf>[0]) => actual.drawOf(named(input))),
    packBonusOf: vi.fn((input: Parameters<typeof actual.packBonusOf>[0]) => actual.packBonusOf(named(input))),
  };
});

const groupsSynced = Date.parse("2026-10-06T10:00:00Z");
const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const mondaySweep = Date.parse("2026-10-19T00:10:00Z");
const tuesday = Date.parse("2026-10-20T10:00:00Z");
const wednesday = Date.parse("2026-10-21T10:00:00Z");
const thisWeek = "2026-10-19";
const minuteMs = 60_000;
const siteUrl = "https://kudos-site.test";
const packs = "packs";
const everyOtherFlag = ["xp-levels", "unlocks", "achievements", "collection", "crests", "crate-store", "crate-rewards", "coins", "quests", "groups", "group-quest", "everyone-board", "skill-tree", "activity"];
const outboxDelivery = "analytics/drain:";
const alice = { user: "U_ALICE", name: "Alice Moreau", email: "alice@example.com" };
const bob = { user: "U_BOB", name: "Bob Okafor", email: "bob@example.com" };
const carol = { user: "U_CAROL", name: "Carol Diaz", email: "carol@example.com" };
const dana = { user: "U_DANA", name: "Dana Lindqvist", email: "dana@example.com" };
const openers = [alice, bob];
const ants = [alice, bob, carol, dana];
const antsGroup = "S_ANTS";
const firstThanks: Quest = { kind: "journey", step: "first-thanks" };
const firstSlot: Quest = { kind: "weekly", week: thisWeek, slot: 0 };
const secondSlot: Quest = { kind: "weekly", week: thisWeek, slot: 1 };
const bandV1 = { xp: [5, 10, 15, 20, 25], coins: [1, 2, 3, 4, 5] };

type Person = typeof alice;
type TableName = keyof typeof schema.tables;
type Row = Record<string, unknown>;

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let namedIds = new Map<string, string>();
let phase = wednesday;
let steps = 0;

beforeEach(() => {
  thePacks.removed = false;
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  freshFakes();
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Exposure = { member: string; value: boolean };

const aDrop = expect.objectContaining({ hoggie: expect.any(String), copy: expect.any(Number) });
const heldRewardsOf = [{ xp: 10, coins: 0 }, { xp: 20, coins: 0 }, { xp: 0, coins: 15 }];

const packsOff: Array<{ condition: string; packsFlag: FlagDefinition[]; turnOff?: () => void; exposed: Exposure[]; drops: number; reopenedOnTheWebsite: "with the held rewards alone" | "closed" }> = [
  { condition: "with packs off", packsFlag: [offForEveryone(packs)], exposed: firstOpensExposing(false), drops: 14, reopenedOnTheWebsite: "with the held rewards alone" },
  { condition: "while PostHog has no packs flag", packsFlag: [], exposed: firstOpensExposing(false), drops: 14, reopenedOnTheWebsite: "with the held rewards alone" },
  { condition: "without the flags key, even when PostHog turned packs on", packsFlag: [onForEveryone(packs)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", ""), exposed: [], drops: 0, reopenedOnTheWebsite: "closed" },
  {
    condition: "in production, while packs is on in the sandbox and for the product owner's email only",
    packsFlag: [asTheShipCreatesIt()],
    turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production"),
    exposed: firstOpensExposing(false),
    drops: 14,
    reopenedOnTheWebsite: "with the held rewards alone",
  },
];

describe("CV13: packs are dark where packs is off, pay only the members it is on for, take nothing back, and only a first open exposes it", { timeout: 300_000 }, () => {
  test.each(packsOff)("$condition, a walk opening every crate kind in Slack and on the website leaves what the same walk leaves without packs, apart from the flag's own exposure", async ({ packsFlag, turnOff, exposed, drops }) => {
    thePacks.removed = true;
    const withoutPacks = await walkIn(await antsWithEveryKindWaiting(packsFlag, turnOff));
    freshFakes();
    thePacks.removed = false;

    const walk = await walkIn(await antsWithEveryKindWaiting(packsFlag, turnOff));

    expect(apartFromTheExposure(walk.seen)).toEqual(apartFromTheExposure(withoutPacks.seen));
    expect(JSON.stringify(walk.seen.answers)).not.toMatch(/"packs?"|morePacks/);
    expect(walk.seen.tables.drops).toHaveLength(drops);
    expect(walk.seen.tables.drops).toEqual(walk.seen.tables.drops.map(() => expect.not.objectContaining({ pack: expect.anything() })));
    expect(packsExposures(walk)).toEqual(exposed);
  });

  test("with packs on, the same walk pays a bonus inside band v1 for every crate kind each member opens, so the comparison above can tell", async () => {
    thePacks.removed = true;
    const withoutPacks = await walkIn(await antsWithEveryKindWaiting([offForEveryone(packs)]));
    freshFakes();
    thePacks.removed = false;

    const walk = await walkIn(await antsWithEveryKindWaiting([onForEveryone(packs)]));

    expect(apartFromTheExposure(walk.seen)).not.toEqual(apartFromTheExposure(withoutPacks.seen));
    for (const { user } of openers) {
      expect(bonusesOf(walk, user).map(({ crate }) => crate).sort(), `${user}'s paid packs`).toEqual(everyKindOpened);
      for (const { xp, coins } of bonusesOf(walk, user)) {
        expect(bandV1.xp).toContain(xp);
        expect(bandV1.coins).toContain(coins);
      }
      expect(walk.seen.answers[user]!.before.collection, `${user}'s stack before the opens`).toMatchObject({ packs: expect.arrayContaining([expect.objectContaining({ kind: "group" }), expect.objectContaining({ kind: "weekly" }), expect.objectContaining({ kind: "journey" }), expect.objectContaining({ kind: "unlock" })]) });
    }
    expect(walk.xp.U_ALICE).toBe(withoutPacks.xp.U_ALICE! + bonusesOf(walk, alice.user).reduce((sum, { xp }) => sum + xp, 0));
    expect(packsExposures(walk)).toEqual(firstOpensExposing(true));
  });

  test("with packs on for one member's email only, only that member's opens pay bonuses and answer them, and every other member's Slack calls, answers and events equal those with it off", async () => {
    const off = await walkIn(await antsWithEveryKindWaiting([offForEveryone(packs)]));
    freshFakes();

    const onForAlice = await walkIn(await antsWithEveryKindWaiting([onForEmails(packs, alice.email)]));

    expect(bonusesOf(onForAlice, alice.user)).toHaveLength(everyKindOpened.length);
    expect(bonusesOf(onForAlice, bob.user)).toEqual([]);
    const alicesBonus = Object.fromEntries(bonusesOf(onForAlice, alice.user).map(({ crate, ...bonus }) => [crate, bonus]));
    const [skillTree, , boughtTwo] = onForAlice.seen.answers.U_ALICE!.opens;
    expect(skillTree, "Alice's first open of the Skill tree on the website").toEqual({ kind: "opened", applied: alicesBonus["unlock:skillTree"], drop: aDrop });
    expect(boughtTwo, "Alice's first open of bought:2 on the website").toEqual({ kind: "opened", applied: alicesBonus["bought:2"], drop: aDrop });
    expect(onForAlice.seen.answers.U_ALICE!.before.collection).toMatchObject({ packs: expect.any(Array), morePacks: false });
    for (const user of [bob.user, carol.user, dana.user]) {
      expect(onForAlice.seen.homes[user], `${user}'s App Home`).toEqual(off.seen.homes[user]);
      expect(slackCallsTo(onForAlice, user), `${user}'s Slack calls`).toEqual(slackCallsTo(off, user));
    }
    expect(onForAlice.seen.answers.U_BOB).toEqual(off.seen.answers.U_BOB);
    expect(postHogEventsOf(onForAlice, bob.user)).toEqual(postHogEventsOf(off, bob.user));
    expect(onForAlice.xp.U_BOB).toBe(off.xp.U_BOB);
    expect(onForAlice.seen.homes[alice.user]).not.toEqual(off.seen.homes[alice.user]);
    expect(packsExposures(onForAlice)).toEqual([
      { member: alice.user, value: true },
      { member: bob.user, value: false },
    ]);
  });

  test.each(packsOff)("$condition after bonuses were paid, nothing paid is taken back: every XP, wallet and drop record stays, and the website answers the held rewards alone", async ({ packsFlag, turnOff, reopenedOnTheWebsite }) => {
    const walk = await walkIn(await antsWithEveryKindWaiting([onForEveryone(packs)]));
    const paid = await whatWasPaid();
    expect(bonusesOf(walk, alice.user)).toHaveLength(everyKindOpened.length);

    await flagsFromPostHog(t, postHog, ...everyFlagWith(...packsFlag));
    turnOff?.();
    const afterwards = await repeatsOfTheWalk();

    expect(await whatWasPaid()).toEqual(paid);
    expect(JSON.stringify(afterwards)).not.toMatch(/"packs?"|morePacks/);
    for (const { user } of openers) {
      const expected = reopenedOnTheWebsite === "closed" ? Array.from({ length: 7 }, () => ({ kind: "closed" })) : reopenedWithTheHeldRewardsAlone(walk, user);
      expect(afterwards[user]!.opens, `${user}'s website opens of every crate again`).toEqual(expected);
    }
  });

  test("packs' exposure is sent once per member and value, only by a crate's first successful open while collection is on, never by App Home, the Book's collection, a refused open or a repeat", async () => {
    t = await antsWithEveryKindWaiting([onForEveryone(packs)]);
    namedIds = await idsNamedByTheirMember();
    for (const person of openers) {
      await openHome(person.user);
      const asSignedIn = await signedIn(person);
      await asSignedIn.query(api.website.collection.getCollection, {});
      expect(await asSignedIn.mutation(api.website.commands.openCrate, { crate: "bought:1" }), "a bought crate not bought yet").toEqual({ kind: "refused" });
      expect(await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: secondSlot }), "a weekly quest not finished").toEqual({ kind: "refused" });
    }
    await settled();
    expect(await exposuresSoFar(), "before any open").toEqual([]);

    await packsAre(onForEveryone(packs), offForEveryone("collection"));
    await clickInSlack(alice.user, { type: "openQuestCrate", quest: firstThanks });
    expect(await exposuresSoFar(), "after an open with collection off").toEqual([]);

    await packsAre(onForEveryone(packs));
    await clickInSlack(alice.user, { type: "openQuestCrate", quest: firstSlot });
    await clickInSlack(alice.user, { type: "openQuestCrate", quest: firstSlot });
    await clickInSlack(alice.user, { type: "openUnlock", feature: "leaderboard" });
    expect(await exposuresSoFar(), "after Alice's first opens and a repeat").toEqual([{ member: alice.user, value: true }]);

    await packsAre(offForEveryone(packs));
    await clickInSlack(alice.user, { type: "openQuestCrate", quest: firstSlot });
    expect(await (await signedIn(alice)).mutation(api.website.commands.openFeature, { feature: "leaderboard" }), "Alice's repeat on the website").toMatchObject({ kind: "opened" });
    expect(await exposuresSoFar(), "after Alice's repeats with packs turned off").toEqual([{ member: alice.user, value: true }]);
    await clickInSlack(alice.user, { type: "openUnlock", feature: "skillTree" });
    await (await signedIn(bob)).mutation(api.website.commands.openFeature, { feature: "leaderboard" });
    await packsAre(onForEveryone(packs));
    await (await signedIn(bob)).mutation(api.website.commands.openFeature, { feature: "skillTree" });
    await (await signedIn(bob)).mutation(api.website.commands.openFeature, { feature: "skillTree" });
    await settled();

    expect(await exposuresSoFar()).toEqual([
      { member: alice.user, value: false },
      { member: alice.user, value: true },
      { member: bob.user, value: false },
      { member: bob.user, value: true },
    ]);
  });
});

const everyKindOpened = ["bought:1", "bought:2", `group:<group Ants>:${thisWeek}`, "journey:first-thanks", "unlock:leaderboard", "unlock:skillTree", `weekly:${thisWeek}:0`].sort();

function firstOpensExposing(value: boolean): Exposure[] {
  return openers.map(({ user }) => ({ member: user, value }));
}

function asTheShipCreatesIt(): FlagDefinition {
  return {
    key: packs,
    filters: {
      groups: [
        { properties: [{ key: "environment", type: "person", value: ["sandbox"], operator: "exact" }], rollout_percentage: 100 },
        { properties: [{ key: "email", type: "person", value: ["product-owner@example.com"], operator: "exact" }], rollout_percentage: 100 },
      ],
    },
  };
}

function everyFlagWith(...flags: FlagDefinition[]) {
  return [...everyOtherFlag.map(onForEveryone), onForEveryone("website"), ...flags];
}

async function packsAre(...flags: FlagDefinition[]) {
  const others = new Set(flags.map(({ key }) => key));
  await flagsFromPostHog(t, postHog, ...everyFlagWith().filter(({ key }) => !others.has(key)), ...flags);
}

async function antsWithEveryKindWaiting(packsFlag: FlagDefinition[], turnOff?: () => void): Promise<Backend> {
  vi.useFakeTimers({ now: groupsSynced });
  spotlightPositionsFromTheStart();
  namedIds = new Map();
  steps = 0;
  t = await flagsFromPostHog(testBackend(), postHog, ...everyFlagWith(...packsFlag));
  turnOff?.();
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, url: "https://t1.slack.com/" }));
  await unlocksShippedBeforeAnyoneJoined(t);
  await journeyShippedBeforeAnyoneJoined(t);
  await bookShippedBeforeAnyoneJoined(t);
  for (const person of ants) {
    await memberChanged(t, "team_join", { id: person.user, profile: { display_name: person.name, email: person.email } });
    await settled();
    namedIds.set((await memberOf(person.user))!, `<member ${person.user}>`);
  }
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_created", antsGroup)));
  await settled();
  namedIds.set(await antsId(), "<group Ants>");
  for (const { user } of openers) await atLevelSixWithCoins((await memberOf(user))!);
  vi.setSystemTime(lastTuesday);
  for (const { user } of ants) {
    const member = (await memberOf(user))!;
    await t.run((ctx) => keepOpen(ctx, { workspace: "T1", member, at: lastTuesday }, "quests"));
  }
  await groupQuestSweepAt(lastTuesday);
  await groupQuestSweepAt(mondaySweep);
  for (const { user } of openers) await aWeeklyDrawFor((await memberOf(user))!);
  vi.setSystemTime(tuesday);
  await thanks(alice, "Thanks for untangling the release notes today", bob);
  await thanks(bob, "Thanks for pairing on the flaky deploy this morning", carol);
  await thanks(carol, "Thanks for reviewing the incident write-up so quickly", alice);
  return t;
}

async function atLevelSixWithCoins(member: MemberId) {
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(6), pointsSpent: 0 }));
  for (const level of [2, 3, 4, 5, 6]) await reachesLevel(t, member, level);
  for (const feature of ["book", "quests", "coins"] as const) await t.run((ctx) => keepOpen(ctx, { workspace: "T1", member, at: Date.now() }, feature));
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:earned:120", xp: 0, coins: 120, item: null, catalogueVersion: "2", at: 0 }));
  await settled();
}

async function aWeeklyDrawFor(member: MemberId) {
  const drawn = await t.run((ctx) =>
    ctx.db
      .query("questDraws")
      .withIndex("by_member_week", (q) => q.eq("member", member).eq("week", thisWeek))
      .unique(),
  );
  if (drawn !== null) throw new Error("the weekly quests were drawn before the walk could draw them");
  const slots = (["say-why", "say-why-three-times"] as const).map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 1, recognitionsLeft: 15 } }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots }));
}

async function walkIn(backend: Backend) {
  t = backend;
  phase = wednesday;
  steps = 0;
  namedIds = await idsNamedByTheirMember();
  const group: Quest = { kind: "group", group: await antsId(), week: thisWeek };
  const before: Record<string, Awaited<ReturnType<typeof readsOf>>> = {};
  for (const person of openers) {
    await openHome(person.user);
    before[person.user] = await readsOf(person);
  }
  for (const { user } of openers) await clickInSlack(user, { type: "buyCrate", next: 1 });
  for (const quest of [firstThanks, firstSlot, group]) await clickInSlack(alice.user, { type: "openQuestCrate", quest });
  await clickInSlack(alice.user, { type: "openUnlock", feature: "leaderboard" });
  await clickInSlack(alice.user, { type: "openCrate", crate: "bought:1" });
  await clickInSlack(bob.user, { type: "openUnlock", feature: "skillTree" });
  await clickInSlack(bob.user, { type: "openCrate", crate: "bought:1" });
  const opens: Record<string, unknown[]> = {};
  opens[alice.user] = await onTheWebsite(alice, [{ feature: "skillTree" }, { buy: 2 }, { crate: "bought:2" }, { quest: firstThanks }, { crate: "journey:first-thanks" }, { crate: `group:${await antsId()}:${thisWeek}` }]);
  opens[bob.user] = await onTheWebsite(bob, [{ quest: firstThanks }, { quest: firstSlot }, { quest: group }, { feature: "leaderboard" }, { buy: 2 }, { crate: "bought:2" }, { crate: "journey:first-thanks" }, { crate: "unlock:skillTree" }]);
  await clickInSlack(bob.user, { type: "openQuestCrate", quest: firstThanks });
  await clickInSlack(alice.user, { type: "openUnlock", feature: "leaderboard" });
  const answers: Record<string, { before: Awaited<ReturnType<typeof readsOf>>; opens: unknown[]; after: Awaited<ReturnType<typeof readsOf>> }> = {};
  for (const person of openers) answers[person.user] = { before: before[person.user]!, opens: opens[person.user]!, after: await readsOf(person) };
  for (const { user } of ants) await openHome(user);
  const seen = {
    homes: Object.fromEntries(ants.map(({ user }) => [user, withStableIds(publishedHome(slack, user))])),
    answers,
    slackCalls: withStableIds(slack.calls.map((call) => JSON.stringify(call))).sort(),
    postHogEvents: orderFree(withStableIds(postHog.events().map(({ event, distinct_id, properties }) => ({ event, distinct_id, properties })))),
    tables: await rowsInContentOrder(),
    jobs: await jobsInContentOrder({ apartFrom: [outboxDelivery] }),
    deliveryJobKinds: await kindsOfJobs(outboxDelivery),
  };
  return { seen, xp: await xpOfTheOpeners(), exposures: exposuresAsPostHogKeepsThem() };
}

type Walk = Awaited<ReturnType<typeof walkIn>>;
type Seen = Walk["seen"];
type WebsiteStep = { feature: Feature } | { quest: Quest } | { crate: string } | { buy: number };

async function onTheWebsite(person: Person, steps: WebsiteStep[]) {
  const asSignedIn = await signedIn(person);
  const answers: unknown[] = [];
  for (const step of steps) {
    nextStep();
    if ("feature" in step) answers.push(await asSignedIn.mutation(api.website.commands.openFeature, { feature: step.feature }));
    if ("quest" in step) answers.push(await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest: step.quest }));
    if ("crate" in step) answers.push(await asSignedIn.mutation(api.website.commands.openCrate, { crate: step.crate }));
    if ("buy" in step) answers.push(await asSignedIn.mutation(api.website.commands.buyCrate, { next: step.buy }));
    await settled();
  }
  return withStableIds(answers);
}

async function readsOf(person: Person) {
  nextStep();
  const asSignedIn = await signedIn(person);
  const read = async <T>(answer: Promise<T>) => withStableIds(await answer);
  return {
    collection: await read(asSignedIn.query(api.website.collection.getCollection, {})),
    book: await read(asSignedIn.query(api.website.book.getBook, {})),
    profile: await read(asSignedIn.query(api.website.profile.getMyProfile, {})),
    quests: await read(asSignedIn.query(api.website.quests.getQuests, {})),
    activity: await read(asSignedIn.query(api.website.activity.getActivity, { filter: "all", cursor: null, limit: 50 })),
  };
}

async function repeatsOfTheWalk() {
  phase = wednesday + 120 * minuteMs;
  steps = 0;
  const group: Quest = { kind: "group", group: await antsId(), week: thisWeek };
  const answers: Record<string, { opens: Row[]; reads: Awaited<ReturnType<typeof readsOf>> }> = {};
  for (const person of openers) {
    await openHome(person.user);
    for (const quest of [firstThanks, firstSlot, group]) await clickInSlack(person.user, { type: "openQuestCrate", quest });
    const opens = (await onTheWebsite(person, [{ quest: firstThanks }, { quest: firstSlot }, { quest: group }, { feature: "leaderboard" }, { feature: "skillTree" }, { crate: "bought:1" }, { crate: "bought:2" }])) as Row[];
    answers[person.user] = { opens, reads: await readsOf(person) };
  }
  return answers;
}

async function whatWasPaid() {
  const paid = await t.run(async (ctx) => ({
    memberProgress: await ctx.db.query("memberProgress").collect(),
    drops: await ctx.db.query("drops").collect(),
    rewardRecords: await ctx.db.query("rewardRecords").collect(),
    coinSpends: await ctx.db.query("coinSpends").collect(),
    wallets: await ctx.db.query("wallets").collect(),
  }));
  return withStableIds(paid);
}

type Standing = { xp: number; level: number; coins: number; skillPoints: number };
type PackPaid = { xp: number; coins: number; from: Standing; to: Standing };

function bonusesOf(walk: Walk, user: string) {
  return (walk.seen.tables.drops as Row[]).filter(({ member, pack }) => member === `<member ${user}>` && pack !== undefined).map(({ crate, pack }) => ({ crate: String(crate), ...(pack as PackPaid) }));
}

function reopenedWithTheHeldRewardsAlone(walk: Walk, user: string) {
  const beforeTheBonus = new Map(bonusesOf(walk, user).map(({ crate, from }) => [crate, from]));
  const questCrates = ["journey:first-thanks", `weekly:${thisWeek}:0`, `group:<group Ants>:${thisWeek}`];
  const quests = heldRewardsOf.map((held, index) => {
    const to = beforeTheBonus.get(questCrates[index]!)!;
    return { kind: "opened", applied: { ...held, from: { ...to, xp: to.xp - held.xp, coins: to.coins - held.coins }, to }, drop: aDrop };
  });
  return [...quests, ...Array.from({ length: 4 }, () => ({ kind: "opened", drop: aDrop }))];
}

function apartFromTheExposure(seen: Seen) {
  const { flagExposures, analyticsOutbox, ...tables } = seen.tables as Record<string, Row[]>;
  return {
    ...seen,
    postHogEvents: seen.postHogEvents.filter((event) => !isPacksExposure(event)),
    tables: {
      ...tables,
      flagExposures: flagExposures!.filter(({ flag }) => flag !== packs),
      analyticsOutbox: analyticsOutbox!.filter(({ event, properties }) => !(event === "$feature_flag_called" && (properties as Row).feature_flag === packs)),
    },
  };
}

function isPacksExposure({ event, properties }: { event?: unknown; properties?: unknown }) {
  return event === "$feature_flag_called" && (properties as Row).$feature_flag === packs;
}

function packsExposures(walk: Walk): Exposure[] {
  return walk.exposures;
}

async function exposuresSoFar() {
  namedIds = await idsNamedByTheirMember();
  return exposuresAsPostHogKeepsThem();
}

function exposuresAsPostHogKeepsThem(): Exposure[] {
  const keptByUuid = new Map(postHog.events().filter(isPacksExposure).map((exposure) => [exposure.uuid, exposure]));
  const exposures = [...keptByUuid.values()].map(({ distinct_id, properties }) => ({ member: withNamedIds(String(distinct_id)).replace(/^<analytics ID of (\w+)>$/, "$1"), value: properties.$feature_flag_response as boolean }));
  return exposures.toSorted((a, b) => a.member.localeCompare(b.member) || Number(a.value) - Number(b.value));
}

function slackCallsTo(walk: Walk, user: string) {
  return walk.seen.slackCalls.filter((call) => call.includes(user));
}

function postHogEventsOf(walk: Walk, user: string) {
  return walk.seen.postHogEvents.filter((event) => event.distinct_id === `<analytics ID of ${user}>` && !isPacksExposure(event));
}

async function signedIn(person: Person) {
  const identity = { user: person.user, name: person.name };
  const { asSignedIn } = await aSignedInSession(t, identity).catch(() => aSession(t, identity));
  return asSignedIn;
}

function orderFree<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const convexTestId = /^\d+[a-zA-Z_]+$/;
const keyedId = /^([a-z]+):(\d+[a-zA-Z_]+)$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const createdInTheSameMillisecond = /(\d{13})\.\d+$/;
const opaque = new Set(["cursor", "eventId"]);

function withStableIds<T>(value: T): T {
  const seen = new Map<string, string>();
  const stable = (kind: string, id: string) => seen.get(id) ?? seen.set(id, `<${kind} ${seen.size + 1}>`).get(id)!;
  return JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (key, field) => {
    if (key === "_id" || key === "_creationTime" || key === "uuid") return undefined;
    if (opaque.has(key) && typeof field === "string") return stable(key, field);
    if (typeof field !== "string") return field;
    if (namedIds.has(field)) return namedIds.get(field);
    if (containsANamedId(field)) return withNamedIds(field);
    if (createdInTheSameMillisecond.test(field)) return field.replace(createdInTheSameMillisecond, "$1.<tie>");
    if (keyedId.test(field)) return field.replace(keyedId, (_, kind: string, id: string) => `${kind}:${stable("document", id)}`);
    if (convexTestId.test(field)) return stable("document", field);
    return uuid.test(field) ? stable("uuid", field) : field;
  });
}

function containsANamedId(field: string) {
  return [...namedIds.keys()].some((id) => field.includes(id));
}

function withNamedIds(field: string) {
  return [...namedIds].reduce((named, [id, name]) => named.replaceAll(id, name), field);
}

async function rowsInContentOrder() {
  const tables = await t.run(async (ctx) => {
    const rows = {} as Record<TableName, Row[]>;
    for (const table of Object.keys(schema.tables) as TableName[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
  const ids = new Map(Object.entries(tables).flatMap(([table, rows]) => rows.toSorted((a, b) => contentOf(a).localeCompare(contentOf(b))).map((row, index) => [String(row._id), `<${table} ${index + 1}>`] as const)));
  const labelled = JSON.parse(JSON.stringify(tables, (_, field) => (typeof field === "bigint" ? `${field}n` : field)), (_, field) => (typeof field === "string" && ids.has(field) && !namedIds.has(field) ? ids.get(field) : field)) as typeof tables;
  return Object.fromEntries(Object.entries(withStableIds(labelled)).map(([table, rows]) => [table, orderFree(rows as Row[])])) as Record<TableName, Row[]>;
}

function contentOf(row: Row) {
  return JSON.stringify(withStableIds(row), (key, field) => (opaque.has(key) || convexTestId.test(String(field)) ? undefined : field));
}

async function kindsOfJobs(prefix: string) {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return [...new Set(scheduled.filter(({ name }) => name.startsWith(prefix)).map(({ name, state }) => `${name} ${state.kind}`))].sort();
}

async function jobsInContentOrder({ apartFrom }: { apartFrom: string[] }) {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const jobs = scheduled.filter(({ name }) => !apartFrom.some((left) => name.startsWith(left))).map(({ name, args, scheduledTime, state }) => ({ name, args, scheduledTime, state: state.kind }));
  return withStableIds(jobs).toSorted((a, b) => contentOf(a).localeCompare(contentOf(b)));
}

async function xpOfTheOpeners() {
  const xp: Record<string, number> = {};
  for (const { user } of openers) {
    const member = (await memberOf(user))!;
    const progress = await t.run((ctx) =>
      ctx.db
        .query("memberProgress")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique(),
    );
    xp[user] = progress?.xp ?? 0;
  }
  return xp;
}

async function idsNamedByTheirMember() {
  const named = new Map<string, string>();
  for (const { user } of ants) {
    const member = await memberOf(user);
    if (member === undefined) continue;
    named.set(member, `<member ${user}>`);
    const analytics = await t.run((ctx) =>
      ctx.db
        .query("analyticsIds")
        .withIndex("by_member", (q) => q.eq("member", member))
        .unique(),
    );
    if (analytics !== null) named.set(analytics.analyticsId, `<analytics ID of ${user}>`);
  }
  const group = await t.run(async (ctx) => (await ctx.db.query("userGroups").collect()).find(({ group }) => group === antsGroup));
  if (group) named.set(group._id, "<group Ants>");
  return named;
}

async function antsId() {
  const group = await t.run(async (ctx) => (await ctx.db.query("userGroups").collect()).find(({ group }) => group === antsGroup));
  return group!._id;
}

async function groupQuestSweepAt(at: number) {
  vi.setSystemTime(at);
  const job = crons.crons["draw each group's weekly group quest"];
  if (job === undefined) throw new Error("no cron job draws each group's weekly group quest");
  await t.mutation(makeFunctionReference<"mutation">(job.name), {});
  await settled();
}

function spotlightPositionsFromTheStart() {
  let drawn = 0;
  vi.spyOn(Math, "random").mockImplementation(() => ((drawn += 1) * 0.618_033_988_7) % 1);
}

function nextStep() {
  steps += 1;
  vi.setSystemTime(phase + steps * minuteMs);
}

async function settled() {
  await settleUpTo(t, Date.now());
}

let sentMessages = 0;

async function thanks(giver: Person, why: string, ...recipients: Person[]) {
  sentMessages += 1;
  vi.setSystemTime(tuesday + sentMessages * minuteMs);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(sentMessages).padStart(6, "0")}`;
  await post(t, [section(text(`${why} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settled();
}

async function clickInSlack(user: string, command: Command) {
  nextStep();
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, staleButtonOf(command)), { contentType: "application/x-www-form-urlencoded" }));
  await settled();
}

async function openHome(user: string) {
  nextStep();
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settled();
}

async function memberOf(user: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row?._id;
}

function freshFakes() {
  sentMessages = 0;
  slack = new FakeSlack();
  for (const person of ants) slack.withMember(person.user, { profile: { display_name: person.name, email: person.email } });
  slack.withUserGroup(antsGroup, { name: "Ants", users: ants.map(({ user }) => user) });
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}

