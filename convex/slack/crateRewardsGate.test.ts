import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, unlocksShippedBeforeAnyoneJoined, offForEveryone, onForEmails, onForEveryone } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { everythingStored, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHomeBlocks, readBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import { standingOf } from "../progression/progression";
import type { QuestId } from "../quests/pool";
import type { Quest } from "../quests/step";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";

const flagRead = vi.hoisted(() => ({ never: false }));

const crateRewardsEvaluations = vi.hoisted(() => ({ count: 0 }));

vi.mock("../analytics/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../analytics/flags")>();
  return {
    ...actual,
    memberDecision: (...args: Parameters<typeof actual.memberDecision>) => {
      if (args[1].key === "crate-rewards") crateRewardsEvaluations.count += 1;
      return actual.memberDecision(...args);
    },
  };
});

vi.mock("../quests/crateRewardsFlag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../quests/crateRewardsFlag")>();
  return { ...actual, rewardHeldFor: (...args: Parameters<typeof actual.rewardHeldFor>) => (flagRead.never ? Promise.resolve(false) : actual.rewardHeldFor(...args)) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const hour = 60 * 60_000;
const thisWeek = "2026-10-12";
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const crateRewards = "crate-rewards";
const alicesEmail = "alice@example.com";
const bobsEmail = "bob@example.com";
const firstSlot: Quest = { kind: "weekly", week: thisWeek, slot: 0 };
const secondSlot: Quest = { kind: "weekly", week: thisWeek, slot: 1 };
const firstQuest: Quest = { kind: "journey", step: "first-quest" };
const weeklyReward = { xp: 300, coins: 10 };
const everyCrateFinished = ["journey:first-quest", "journey:first-thanks", `weekly:${thisWeek}:0`];

const everythingElse = ["xp-levels", "unlocks", "quests", "website", "activity"].map(onForEveryone);
const crateRewardsOff = [...everythingElse, offForEveryone(crateRewards)];
const crateRewardsNotCreated = everythingElse;
const crateRewardsOnForEveryone = [...everythingElse, onForEveryone(crateRewards)];
const previewedByAlice = [...everythingElse, onForEmails(crateRewards, alicesEmail)];
const previewedByBob = [...everythingElse, onForEmails(crateRewards, bobsEmail)];

const friendsOf: Record<string, [string, string]> = { U_ALICE: ["U_BOB", "U_CAROL"], U_BOB: ["U_CAROL", "U_DANA"] };

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  flagRead.never = false;
  crateRewardsEvaluations.count = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CR15: crate-rewards is dark wherever it is off", { timeout: 120_000 }, () => {
  test.each([
    ["off", crateRewardsOff, { flagsKeySet: true }],
    ["not created", crateRewardsNotCreated, { flagsKeySet: true }],
    ["on for another member's email only", previewedByBob, { flagsKeySet: true }],
    ["on but the flags key missing", crateRewardsOnForEveryone, { flagsKeySet: false }],
  ])("with crate-rewards %s, every Slack call, website answer, stored row and product event of a walk through every crate equals the same walk where the flag is never read", async (_, definitions, { flagsKeySet }) => {
    const whereNeverRead = await walkOnAFreshBackend(definitions, { flagsKeySet, flagNeverRead: true });
    const whereRead = await walkOnAFreshBackend(definitions, { flagsKeySet, flagNeverRead: false });

    expect(whereRead.rewards).toEqual(flagsKeySet ? everyCrateFinished.map((key) => ({ key, held: false })) : []);
    expect(whereRead.standings).toEqual(flagsKeySet ? { atTheFinishes: { xp: 350, balance: 18 }, afterEveryOpen: { xp: 350, balance: 18 } } : { atTheFinishes: { xp: 20, balance: 8 }, afterEveryOpen: { xp: 20, balance: 8 } });
    expect(whereRead.crateRewardsEvaluations).toBe(flagsKeySet ? everyCrateFinished.length : 0);
    expect(whereRead.everyWaitingRead).toEqual(flagsKeySet ? Array(11).fill(false) : []);
    expect(whereRead.answers).toEqual(flagsKeySet ? [...Array(3).fill({ kind: "opened", applied: null }), { kind: "refused" }] : Array(4).fill({ kind: "closed" }));
    expect(heldOrWaitingIn(whereRead.observed)).toEqual([]);
    expect(comparable(whereRead.observed)).toEqual(comparable(whereNeverRead.observed));
  });

  test("with crate-rewards on for Alice's email only, only Alice's rewards are held, and Bob's Slack calls, website answers and rewards equal those with it off", async () => {
    const previewed = await bothWalksOnAFreshBackend(previewedByAlice);
    const off = await bothWalksOnAFreshBackend(crateRewardsOff);

    expect(previewed.alicesRewards).toEqual(everyCrateFinished.map((key) => ({ key, held: true })));
    expect(previewed.alicesWaitingReads).toContain(true);
    expect(off.alicesRewards).toEqual(everyCrateFinished.map((key) => ({ key, held: false })));
    expect(previewed.bobsRewards).toEqual(everyCrateFinished.map((key) => ({ key, held: false })));
    expect(comparable(previewed.bobsSide)).toEqual(comparable(off.bobsSide));
  });

  test("crate-rewards' exposure goes to PostHog once per member and value, only for members whose quest rewards were written", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await walkEveryCratePath(t, "U_ALICE");
    await walkEveryCratePath(t, "U_BOB", tuesday + 4 * hour);

    expect(exposuresSentTo(await analyticsIdOf(t, "U_ALICE"))).toEqual([true]);
    expect(exposuresSentTo(await analyticsIdOf(t, "U_BOB"))).toEqual([false]);
    expect(exposuresSentTo(await analyticsIdOf(t, "U_CAROL"))).toEqual([]);

    await flagsFromPostHog(t, postHog, ...crateRewardsOff);
    await aWhileLater(() => giveKudos(t, "U_ALICE", "U_DANA"));
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await aWhileLater(() => giveKudos(t, "U_ALICE", "U_CAROL"));
    await aWhileLater(() => giveKudos(t, "U_ALICE", "U_BOB"));

    expect((await rewardsOf(t, "U_ALICE")).map(({ key }) => key)).toEqual(expect.arrayContaining([`weekly:${thisWeek}:1`, `weekly:${thisWeek}:2`]));
    expect(exposuresSentTo(await analyticsIdOf(t, "U_ALICE"))).toEqual([true, false]);
    expect(exposuresSentTo(await analyticsIdOf(t, "U_BOB"))).toEqual([false]);
    expect(crateRewardsEvaluations.count).toBe((await rewardsOf(t, "U_ALICE")).length + (await rewardsOf(t, "U_BOB")).length);
  });
});

describe("CR5: a held reward waits for its open whatever crate-rewards says later", { timeout: 120_000 }, () => {
  test.each([
    ["App Home", "slack"],
    ["the website", "website"],
  ] as const)("rewards held while crate-rewards was on are paid once at their first open from %s after the flag turns off, and every repeat open from either surface pays nothing", async (_, surface) => {
    const t = await workspaceDeciding(...previewedByAlice);
    await heldCratesOf(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...crateRewardsOff);
    const before = await standingAndBalanceOf(t, "U_ALICE");
    const levelUpsBefore = levelUpDmsTo("U_ALICE").length;
    const site = await websiteOf(t, "U_ALICE");
    const weeklyOpen = openButtonBeside("U_ALICE", "Thank someone and say why.");
    const journeyOpen = openButtonBeside("U_ALICE", "*Journey:* ✅ Finish a weekly quest.");
    const openFirst = (quest: Quest, slackOpen: BlockAction) => (surface === "slack" ? click(t, "U_ALICE", slackOpen) : site.open(quest));

    await openFirst(firstSlot, weeklyOpen);
    const afterTheWeeklyOpen = await standingAndBalanceOf(t, "U_ALICE");
    await openFirst(firstQuest, journeyOpen);
    const afterBothOpens = await standingAndBalanceOf(t, "U_ALICE");
    const levelUps = levelUpDmsTo("U_ALICE").slice(levelUpsBefore);
    for (const repeat of [() => click(t, "U_ALICE", weeklyOpen), () => site.open(firstSlot), () => click(t, "U_ALICE", journeyOpen), () => site.open(firstQuest)]) await repeat();

    expect(afterTheWeeklyOpen).toEqual({ xp: before.xp + weeklyReward.xp, level: 4, skillPoints: 0, balance: before.balance + weeklyReward.coins });
    expect(afterBothOpens).toEqual({ ...afterTheWeeklyOpen, xp: afterTheWeeklyOpen.xp + 20 });
    expect(levelUps).toEqual([expect.stringMatching(/^🎉 You reached level 4!/)]);
    expect(await standingAndBalanceOf(t, "U_ALICE")).toEqual(afterBothOpens);
    expect(levelUpDmsTo("U_ALICE").slice(levelUpsBefore)).toEqual(levelUps);
    expect(await site.open(firstSlot)).toEqual({ kind: "opened", applied: { xp: 300, coins: 0, from: { xp: before.xp, level: before.level, skillPoints: 0, coins: 0 }, to: { xp: before.xp + 300, level: 4, skillPoints: 0, coins: 0 } } });
    expect(await site.open(firstQuest)).toEqual({ kind: "opened", applied: { xp: 20, coins: 0, from: { xp: before.xp + 300, level: 4, skillPoints: 0, coins: 0 }, to: { xp: before.xp + 320, level: 4, skillPoints: 0, coins: 0 } } });
  });

  test("while crate-rewards is off, a reward finished afterwards counts at its finish, beside one still held from while it was on", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await heldCratesOf(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...crateRewardsOff);
    const before = await standingAndBalanceOf(t, "U_ALICE");

    await aWhileLater(() => giveKudos(t, "U_ALICE", "U_DANA"));

    expect(await rewardsOf(t, "U_ALICE")).toContainEqual({ key: `weekly:${thisWeek}:1`, held: false });
    expect(await standingAndBalanceOf(t, "U_ALICE")).toMatchObject({ xp: before.xp + 10 + weeklyReward.xp, balance: before.balance + 4 + weeklyReward.coins });
    expect((await (await websiteOf(t, "U_ALICE")).reads()).waiting).toEqual({ slots: [true, false, false], journey: [false, true] });
  });

  test("turning crate-rewards off and on again rewrites nothing, and Slack and the website show the same held crates", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await heldCratesOf(t, "U_ALICE");
    const site = await websiteOf(t, "U_ALICE");
    await openHome(t, "U_ALICE");
    const shown = { home: homeOf("U_ALICE"), reads: await site.reads() };
    const stored = await everythingStoredButExposuresAndDirectory(t);

    await flagsFromPostHog(t, postHog, ...crateRewardsOff);
    await openHome(t, "U_ALICE");
    const whileOff = { home: homeOf("U_ALICE"), reads: await site.reads() };
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await openHome(t, "U_ALICE");

    expect(whileOff).toEqual(shown);
    expect({ home: homeOf("U_ALICE"), reads: await site.reads() }).toEqual(shown);
    expect(await everythingStoredButExposuresAndDirectory(t)).toEqual(stored);
  });
});

async function walkOnAFreshBackend(definitions: FlagDefinition[], { flagsKeySet, flagNeverRead }: { flagsKeySet: boolean; flagNeverRead: boolean }) {
  vi.clearAllTimers();
  vi.setSystemTime(tuesday);
  flagRead.never = flagNeverRead;
  const t = await workspaceDeciding(...definitions);
  if (!flagsKeySet) vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  const walk = await walkEveryCratePath(t, "U_ALICE");
  await settle(t);
  return {
    rewards: await rewardsOf(t, "U_ALICE"),
    standings: { atTheFinishes: walk.standingAtTheFinishes, afterEveryOpen: await xpAndBalanceOf(t, "U_ALICE") },
    crateRewardsEvaluations: crateRewardsEvaluations.count,
    everyWaitingRead: walk.reads.flatMap(({ waiting }) => [...waiting.slots, ...waiting.journey]),
    answers: walk.answers,
    observed: { calls: slack.calls, walk, stored: withoutSpotlightPositions(await everythingStoredButExposures(t)), scheduled: await jobsScheduledButAnalytics(t), events: eventsSentButExposures() },
  };
}

async function bothWalksOnAFreshBackend(definitions: FlagDefinition[]) {
  vi.clearAllTimers();
  vi.setSystemTime(tuesday);
  const t = await workspaceDeciding(...definitions);
  const alicesWalk = await walkEveryCratePath(t, "U_ALICE");
  const bobStarts = slack.calls.length;
  const bobsWalk = await walkEveryCratePath(t, "U_BOB", tuesday + 4 * hour);
  await settle(t);
  const bobsRewards = await rewardsOf(t, "U_BOB");
  const toBobWhileAliceWalked = slack.calls.slice(0, bobStarts).filter(({ args }) => [args.channel, args.user, args.user_id].includes("U_BOB"));
  const bobsCalls = [...toBobWhileAliceWalked, ...slack.calls.slice(bobStarts)];
  return {
    alicesRewards: await rewardsOf(t, "U_ALICE"),
    alicesWaitingReads: alicesWalk.reads.flatMap(({ waiting }) => [...waiting.slots, ...waiting.journey]),
    bobsRewards,
    bobsSide: { calls: bobsCalls, walk: bobsWalk, rewards: bobsRewards, standing: await standingAndBalanceOf(t, "U_BOB") },
  };
}

async function walkEveryCratePath(t: Backend, user: string, startingAt = tuesday) {
  const [first, second] = friendsOf[user]!;
  const site = await websiteOf(t, user);
  const steps = stepsFrom(startingAt);
  await steps.next(() => giveKudos(t, user, first));
  await steps.next(() => openHome(t, user));
  const reads = [await site.reads()];
  await steps.next(() => clickIfShown(t, user, "*Journey:* ✅"));
  await questsDrawnFor(t, user);
  await steps.next(() => clickIfShown(t, user, "*Quests* is ready"));
  await steps.next(() => giveKudos(t, user, second));
  const standingAtTheFinishes = await xpAndBalanceOf(t, user);
  await steps.next(() => openHome(t, user));
  reads.push(await site.reads());
  const answers = [await steps.next(() => site.open(firstSlot))];
  await steps.next(() => openHome(t, user));
  await steps.next(() => clickIfShown(t, user, "*Journey:* ✅"));
  for (const quest of [firstQuest, firstSlot, secondSlot]) answers.push(await steps.next(() => site.open(quest)));
  reads.push(await site.reads());
  return { reads, answers, standingAtTheFinishes };
}

function stepsFrom(start: number) {
  const stepMs = 10 * 60_000;
  let taken = 0;
  return {
    next<Done>(step: () => Promise<Done>): Promise<Done> {
      taken += 1;
      vi.setSystemTime(start + taken * stepMs);
      return step();
    },
  };
}

async function heldCratesOf(t: Backend, user: string) {
  const [first, second] = friendsOf[user]!;
  await aWhileLater(() => giveKudos(t, user, first));
  await openHome(t, user);
  await click(t, user, openButtonBeside(user, "*Journey:* ✅"));
  await questsDrawnFor(t, user);
  await click(t, user, openButtonBeside(user, "*Quests* is ready"));
  await aWhileLater(() => giveKudos(t, user, second));
  await openHome(t, user);
  expect(await rewardsOf(t, user)).toEqual(everyCrateFinished.map((key) => ({ key, held: true })));
}

function aWhileLater<Done>(step: () => Promise<Done>) {
  return stepsFrom(Date.now()).next(step);
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  aDeploymentForWorkspace();
  slack = new FakeSlack()
    .withMember("U_ALICE", { profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: bobsEmail } })
    .withMember("U_CAROL", { profile: { email: "carol@example.com" } })
    .withMember("U_DANA", { profile: { email: "dana@example.com" } });
  sentMessages = 0;
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, announcementChannel: "C_NEWS" }));
  await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return t;
}

async function questsDrawnFor(t: Backend, user: string) {
  await t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const slots = (["say-why", "say-why-twice", "say-why-three-times"] as QuestId[]).map((quest, slot) => ({
      slot,
      quest,
      reward: { ...weeklyReward, item: null },
      catalogueVersion: "1",
      feasibleBecause: { peopleLeft: 2, recognitionsLeft: 18 },
    }));
    await ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots });
  });
}

async function websiteOf(t: Backend, user: string) {
  const { asSignedIn } = await aSession(t, { user, name: user }, { endsIn: 24 * hour });
  const answered = <Answer>(answer: Answer) => settle(t).then(() => answer);
  return {
    open: async (quest: Quest) => answered(await asSignedIn.mutation(api.website.commands.openQuestCrate, { quest })),
    reads: async () => {
      const profile = await asSignedIn.query(api.website.profile.getMyProfile, {});
      const quests = await asSignedIn.query(api.website.quests.getQuests, {});
      const activity = await asSignedIn.query(api.website.activity.getActivity, { filter: "given", cursor: null });
      const journey = "journey" in profile && profile.journey !== null ? profile.journey : [];
      const slots = quests.kind === "quests" ? quests.slots : [];
      return { profile, quests, activity, waiting: { slots: slots.map(({ waiting }) => waiting), journey: journey.map(({ waiting }) => waiting) } };
    },
  };
}

async function giveKudos(t: Backend, giver: string, recipient: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${saysWhy} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000)}.00010${sentMessages}` })));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  expect(response.status).toBe(200);
  await settle(t);
}

async function clickIfShown(t: Backend, user: string, beside: string) {
  const blocks = besideOf(user, beside);
  if (blocks.length > 0) await click(t, user, buttonIn(blocks, "Open"));
}

function openButtonBeside(user: string, beside: string) {
  return buttonIn(besideOf(user, beside), "Open");
}

function besideOf(user: string, beside: string): Block[] {
  return publishedHomeBlocks(slack, user).filter((block) => readBlocks([block])[0]!.includes(beside) && readBlocks([block])[0]!.includes("[button: Open]"));
}

function homeOf(user: string) {
  return readBlocks(publishedHomeBlocks(slack, user));
}

function levelUpDmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && String(text).startsWith("🎉 You reached level"))
    .map(({ text }) => String(text));
}

async function memberIn(ctx: QueryCtx, user: string): Promise<MemberId> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function standingAndBalanceOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const { xp, level, skillPoints } = await standingOf(ctx, member);
    return { xp, level, skillPoints, balance: await balanceOf(ctx, member) };
  });
}

async function rewardsOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    const records = (await ctx.db.query("rewardRecords").collect()).filter((record) => record.member === member);
    return records.map(({ key, held }) => ({ key, held: held === true })).sort((a, b) => a.key.localeCompare(b.key));
  });
}

async function analyticsIdOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberIn(ctx, user);
    return (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId;
  });
}

async function everythingStoredButExposures(t: Backend) {
  const stored = await everythingStored(t, { except: ["slackReceipts"] });
  return stored.filter((row) => !isCrateRewardsExposure(row));
}

function isCrateRewardsExposure(row: Record<string, unknown>) {
  if ("flag" in row && "value" in row) return row.flag === crateRewards;
  return "event" in row && row.event === "$feature_flag_called" && (row.properties as { feature_flag?: string }).feature_flag === crateRewards;
}

async function everythingStoredButExposuresAndDirectory(t: Backend) {
  return (await everythingStoredButExposures(t)).map((row) => ("asOf" in row ? { ...row, asOf: "refreshed" } : row));
}

function eventsSentButExposures() {
  const sent = postHog.events().filter(({ event, properties }) => event !== "$feature_flag_called" || properties.$feature_flag !== crateRewards);
  return sent.map(({ uuid: _, ...event }) => event);
}

async function jobsScheduledButAnalytics(t: Backend) {
  const jobs = (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).filter(({ name }) => !name.startsWith("analytics/"));
  return jobs.map(({ name, args, scheduledTime, state }) => ({ name, args, scheduledTime, state: state.kind }));
}

async function xpAndBalanceOf(t: Backend, user: string) {
  const { xp, balance } = await standingAndBalanceOf(t, user);
  return { xp, balance };
}

function withoutSpotlightPositions(rows: Awaited<ReturnType<typeof everythingStoredButExposures>>) {
  return rows.map((row) => ("position" in row && "conversation" in row ? { ...row, position: "random" } : row));
}

function exposuresSentTo(analyticsId: string | undefined) {
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === crateRewards);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => properties.$feature_flag_response);
}

function comparable({ calls, events = [], scheduled = [], ...observed }: { calls: unknown[]; events?: unknown[]; scheduled?: unknown[] }) {
  const ranked = withGeneratedIdsRanked({ ...observed, calls, events, scheduled });
  return { ...ranked, calls: inAnyOrder(ranked.calls), events: inAnyOrder(ranked.events), scheduled: inAnyOrder(ranked.scheduled) };
}

function heldOrWaitingIn(observed: unknown) {
  return jsonOf(observed).match(/waits in your crate|waiting in your crate|\\?"waiting\\?":true|\\?"held\\?":true|\\?"applied\\?":\{/g) ?? [];
}

function inAnyOrder(items: unknown[]) {
  return items.map((item) => JSON.stringify(item).replace(/\d+\.\d+\.trigger/g, "<trigger>")).sort();
}

function withGeneratedIdsRanked<Observed>(observed: Observed): Observed {
  const json = jsonOf(observed, { except: "_creationTime" });
  const ids = [...new Set(json.match(/"\d+[A-Za-z]+"/g) ?? [])].filter((id) => id.length === 34);
  const ranks = new Map<string, string>();
  for (const table of new Set(ids.map(tableOf))) {
    const ofTable = ids.filter((id) => tableOf(id) === table).sort((a, b) => counterOf(a) - counterOf(b));
    ofTable.forEach((id, rank) => ranks.set(id, `"${table}#${rank}"`));
  }
  const uuids = [...new Set(json.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? [])];
  const idsRanked = json.replace(/"\d+[A-Za-z]+"/g, (id) => ranks.get(id) ?? id);
  return JSON.parse(uuids.reduce((ranked, uuid, rank) => ranked.replaceAll(uuid, `uuid#${rank}`), idsRanked));
}

function jsonOf(value: unknown, { except }: { except?: string } = {}) {
  return JSON.stringify(value, (key, field: unknown) => (key === except ? undefined : typeof field === "bigint" ? `${field}n` : field));
}

function tableOf(quotedId: string) {
  return quotedId.replace(/^"\d+|"$/g, "");
}

function counterOf(quotedId: string) {
  return Number(quotedId.match(/^"(\d+)/)![1]);
}
