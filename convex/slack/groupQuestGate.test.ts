import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { type FakePostHog, flagsKey, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, onInTheSandboxOnly, postHogDeciding, testBackendServing, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { blockActions, publishedHome, staleButtonOf, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import crons from "../crons";
import { keepOpen } from "../unlocks/unlocks";

const groupsSyncedAt = Date.parse("2026-10-06T10:00:00Z");
const lastTuesday = Date.parse("2026-10-13T10:00:00Z");
const mondaySweep = Date.parse("2026-10-19T00:10:00Z");
const tuesday = Date.parse("2026-10-20T10:00:00Z");
const wednesday = Date.parse("2026-10-21T10:00:00Z");
const nextMondaySweep = Date.parse("2026-10-26T00:10:00Z");
const nextTuesday = Date.parse("2026-10-27T10:00:00Z");
const thisWeek = "2026-10-19";
const ants = ["U_ANN", "U_AL", "U_AMY", "U_ABE"];
const saysWhy = "thanks for untangling the release notes today";
const groupQuestDoneLine = "section: Ants quest: Thank someone and say why. · 3 of 3 took part · ✅";
const groupQuest = "group-quest";
const everyOtherFlag = ["xp-levels", "unlocks", "quests", "groups"];

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  freshFakes();
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type GroupQuestOff = { condition: string; flags: FlagDefinition[]; turnOff?: () => void; setUp?: (t: Backend) => Promise<void> };

const everyFlagBut = (off: string, ...instead: FlagDefinition[]) => [...[...everyOtherFlag, groupQuest].filter((flag) => flag !== off).map(onForEveryone), ...instead];

const withGroupQuestOffAnd = (off: string) => [...everyOtherFlag.filter((flag) => flag !== off).map(onForEveryone), offForEveryone(off), offForEveryone(groupQuest)];

const groupQuestOff: GroupQuestOff[] = [
  { condition: "with group-quest off", flags: everyFlagBut(groupQuest, offForEveryone(groupQuest)) },
  { condition: "while PostHog has no group-quest flag", flags: everyFlagBut(groupQuest) },
  { condition: "without the flags key, even when PostHog turned group-quest on", flags: everyFlagBut(""), turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while group-quest is on in the sandbox only", flags: everyFlagBut(groupQuest, onInTheSandboxOnly(groupQuest)), turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
  { condition: "with group-quest on but groups off", flags: everyFlagBut("groups", offForEveryone("groups")) },
  { condition: "with group-quest on but quests off", flags: everyFlagBut("quests", offForEveryone("quests")) },
  { condition: "with every flag on but no group that counts", flags: everyFlagBut(""), setUp: noGroupCounts },
];

describe("GB25 GB29: the group quest is invisible and records nothing where it doesn't apply", { timeout: 120_000 }, () => {
  test.each(groupQuestOff)("$condition, a week of sweeps, kudos that say why and a stale Open records no group quest and sends Slack exactly what the same week sends with no group quest sweep at all", async ({ flags, turnOff, setUp }) => {
    const withoutGroupQuest = await weekIn(await antsOpenedQuests(flags, turnOff, setUp), { sweeps: false });
    freshFakes();

    const t = await antsOpenedQuests(flags, turnOff, setUp);
    const week = await weekIn(t, { sweeps: true });

    expect(week).toEqual(withoutGroupQuest);
    expect(JSON.stringify(week)).not.toContain("Ants quest");
    expect(await groupQuestFacts(t)).toEqual(noGroupQuestFacts);
    expect(groupQuestEvents()).toEqual([]);
  });

  test("with every flag on, the same week draws the quest, finishes it and shows it done", async () => {
    const t = await antsOpenedQuests(everyFlagBut(""));

    const week = await weekIn(t, { sweeps: true });

    expect(week.homes.U_ANN).toContain(`${groupQuestDoneLine} [button: Open]`);
    expect(await groupQuestFacts(t)).toMatchObject({ quests: expect.arrayContaining([expect.objectContaining({ week: thisWeek })]), contributions: expect.arrayContaining([expect.anything()]), crateOpenings: [expect.anything()] });
    expect(groupQuestEvents().map(({ event }) => event)).toEqual(expect.arrayContaining(["quest drawn", "quest finished", "crate opened"]));
  });
});

describe("GB29 GB36: turning a flag the group quest needs off hides it and rewrites nothing; on again shows it unchanged", { timeout: 120_000 }, () => {
  test.each(turningOff)("with $state, App Home hides the line and the crate, groupQuestOf answers nothing, a stale Open and a kudos record nothing, and on again shows the same App Home", async ({ off, on }) => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient);
    vi.setSystemTime(wednesday);
    await openHome(t, "U_ANN");
    const shownWhileOn = publishedHome(slack, "U_ANN");
    const recordedWhileOn = await groupQuestFacts(t);
    expect(shownWhileOn).toContain(`${groupQuestDoneLine} [button: Open]`);

    await off(t);
    await openHome(t, "U_ANN");
    const shownWhileOff = publishedHome(slack, "U_ANN").join("\n");
    await click(t, "U_ANN", staleOpenOf(await antsOf(t)));
    await giveKudos(t, "U_ABE", "U_AL");

    expect(shownWhileOff).not.toContain("Ants quest:");
    expect(await t.query(internal.quests.groupQuest.groupQuestOf, { member: await t.run((ctx) => memberOf(ctx, "U_ANN")) })).toBeNull();
    expect(await groupQuestFacts(t)).toEqual(recordedWhileOn);

    await on(t);
    await openHome(t, "U_ANN");
    expect(publishedHome(slack, "U_ANN")).toEqual(shownWhileOn);
  });

  test.each(turningOff)("with $state, an unopened group crate of an earlier week doesn't wait in App Home and a stale Open leaves it unopened", async ({ off }) => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient);
    const recordedWhileOn = await groupQuestFacts(t);

    await off(t);
    vi.setSystemTime(nextTuesday);
    await openHome(t, "U_ANN");
    await click(t, "U_ANN", staleOpenOf(await antsOf(t)));

    expect(publishedHome(slack, "U_ANN").join("\n")).not.toContain("Ants quest:");
    expect(await groupQuestFacts(t)).toEqual(recordedWhileOn);
    expect(groupQuestEvents().filter(({ event }) => event === "crate opened")).toEqual([]);
  });

  test.each(turningOff)("with $state at Monday's sweep after the launch, that week draws no group quest, also once it is on again mid-week, and the next Monday draws one", async ({ off, on }) => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    await off(t);

    await sweepAt(t, mondaySweep);
    await openHome(t, "U_ANN");
    expect(publishedHome(slack, "U_ANN").join("\n")).not.toContain("Ants quest:");
    expect(await groupQuestFacts(t)).toMatchObject({ launches: [expect.anything()], weeks: [expect.objectContaining({ week: thisWeek })], quests: [] });
    expect(groupQuestEvents()).toEqual([]);

    await on(t);
    await sweepAt(t, wednesday);
    expect((await groupQuestFacts(t)).quests).toEqual([]);

    await sweepAt(t, nextMondaySweep);
    expect((await groupQuestFacts(t)).quests.map(({ week }) => week)).toEqual(["2026-10-26"]);
  });
});

describe("AL35: group quest draws obey group-quest whatever was launched", { timeout: 120_000 }, () => {
  test("after the launch, with group-quest off in the workspace decision but on for three Ants by their email, Monday's sweep tallies and draws nothing, also once it is on again mid-week, and the next Monday draws one", async () => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    await previewedByThreeAnts(t);
    const jobsBefore = (await groupQuestJobsOf(t)).length;

    await sweepAt(t, mondaySweep);
    expect(await groupQuestFacts(t)).toMatchObject({ launches: [expect.anything()], quests: [] });
    expect((await groupQuestJobsOf(t)).slice(jobsBefore)).toEqual([]);
    expect(groupQuestEvents()).toEqual([]);

    await everyFlagOn(t);
    await sweepAt(t, wednesday);
    expect((await groupQuestFacts(t)).quests).toEqual([]);

    await sweepAt(t, nextMondaySweep);
    expect((await groupQuestFacts(t)).quests.map(({ week }) => week)).toEqual(["2026-10-26"]);
  });

  test.each(["tallyParticipants", "drawGroupQuests"] as const)("a %s job queued while group-quest was on and run once it is off in the workspace decision, still on for three Ants by their email, draws nothing and marks the week passed", async (job) => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    const queued = { tallyParticipants: { workspace: "T1", week: thisWeek, members: 0, tally: [] }, drawGroupQuests: { workspace: "T1", week: thisWeek, members: ants.length, tally: [{ group: await antsOf(t), membersInside: ants.length, participants: await membersOf(t, "U_ANN", "U_AL", "U_AMY") }] } }[job];
    await previewedByThreeAnts(t);

    vi.setSystemTime(mondaySweep);
    await t.mutation(makeFunctionReference<"mutation">(`quests/groupQuest:${job}`), queued);
    await settle(t);

    expect(await groupQuestFacts(t), "the group quest's facts after the queued job ran").toMatchObject({ weeks: [expect.objectContaining({ week: thisWeek })], quests: [] });
    expect(groupQuestEvents()).toEqual([]);
  });

  test("a catch-up queued for a quest drawn while group-quest was on, run once it is off in the workspace decision, counts no contribution, even for Ants it is still on for by their email", async () => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    await flagsFromPostHog(t, postHog, ...everyFlagBut(groupQuest, offForEveryone(groupQuest)));
    vi.setSystemTime(tuesday);
    await giveKudos(t, "U_ANN", "U_AL");
    await previewedByThreeAnts(t);
    const [drawn] = (await groupQuestFacts(t)).quests;

    await t.mutation(makeFunctionReference<"mutation">("quests/groupQuest:catchUpContributions"), { quest: drawn!._id, cursor: null });
    await settle(t);

    expect((await groupQuestFacts(t)).contributions, "contributions the catch-up counted").toEqual([]);
  });

  test("a kudos that says why, given once group-quest is off in the workspace decision, counts no contribution to the week's quest drawn while it was on, even from an Ant it is still on for by their email", async () => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    await sweepAt(t, mondaySweep);
    await previewedByThreeAnts(t);

    vi.setSystemTime(tuesday);
    await giveKudos(t, "U_ANN", "U_AL");

    expect((await groupQuestFacts(t)).contributions, "contributions counted while group-quest is off in the workspace decision").toEqual([]);
  });

  test("a tally queued while group-quest was on draws nothing once a later sweep marked the week passed with it off, also when it is on again before the tally runs", async () => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, lastTuesday);
    vi.setSystemTime(mondaySweep);
    await t.mutation(sweepJob(), {});
    await flagsFromPostHog(t, postHog, ...everyFlagBut(groupQuest, offForEveryone(groupQuest)));
    vi.setSystemTime(mondaySweep + 60 * 60 * 1000);
    await t.mutation(sweepJob(), {});
    await everyFlagOn(t);

    await settle(t);

    expect((await groupQuestFacts(t)).quests, "quests drawn in a week a sweep marked passed").toEqual([]);
  });
});

describe("GB29 O36: the group-quest exposure", { timeout: 120_000 }, () => {
  test("is sent once per member and value from App Home, on again included, and not where groups or quests is off, which leaves group-quest nothing to decide", async () => {
    const t = await antsOpenedQuests(everyFlagBut(""));
    await sweepAt(t, mondaySweep);
    vi.setSystemTime(tuesday);
    const [ann, abe] = [await analyticsIdOf(t, "U_ANN"), await analyticsIdOf(t, "U_ABE")];

    await meetTheGroupQuest(t, "U_ANN");
    await meetTheGroupQuest(t, "U_ANN");
    await flagsFromPostHog(t, postHog, ...everyFlagBut(groupQuest, offForEveryone(groupQuest)));
    await meetTheGroupQuest(t, "U_ANN");
    await meetTheGroupQuest(t, "U_ANN");
    await flagsFromPostHog(t, postHog, ...everyFlagBut(""));
    await meetTheGroupQuest(t, "U_ANN");
    await flagsFromPostHog(t, postHog, ...everyFlagBut(groupQuest, offForEveryone(groupQuest)));
    await flagsFromPostHog(t, postHog, ...withGroupQuestOffAnd("groups"));
    await meetTheGroupQuest(t, "U_ABE");
    await flagsFromPostHog(t, postHog, ...withGroupQuestOffAnd("quests"));
    await meetTheGroupQuest(t, "U_ABE");

    expect(groupQuestExposuresOf(ann)).toEqual([true, false]);
    expect(groupQuestExposuresOf(abe)).toEqual([true]);
  });
});

type TurningOff = { state: string; off: (t: Backend) => Promise<unknown>; on: (t: Backend) => Promise<unknown> };

const everyFlagOn = (t: Backend) => flagsFromPostHog(t, postHog, ...everyFlagBut(""));

const turningOff: TurningOff[] = [
  ...[groupQuest, "groups", "quests"].map((flag) => ({ state: `${flag} off`, off: (t: Backend) => flagsFromPostHog(t, postHog, ...everyFlagBut(flag, offForEveryone(flag))), on: everyFlagOn })),
  { state: "group-quest missing in PostHog", off: (t: Backend) => flagsFromPostHog(t, postHog, ...everyFlagBut(groupQuest)), on: everyFlagOn },
  { state: "the flags key unset", off: async () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", ""), on: async () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey) },
];

const noGroupQuestFacts = { launches: [], weeks: [], quests: [], contributions: [], rewards: [], pendingCrates: [], crateOpenings: [] };

type Week = { homes: Record<string, string[]>; nextWeeksHome: string[]; slackCalls: string[] };

async function weekIn(t: Backend, { sweeps }: { sweeps: boolean }): Promise<Week> {
  await sweepAt(t, lastTuesday, sweeps);
  await sweepAt(t, mondaySweep, sweeps);
  vi.setSystemTime(tuesday);
  for (const [giver, recipient] of [["U_ANN", "U_AL"], ["U_AL", "U_AMY"], ["U_AMY", "U_ANN"]] as const) await giveKudos(t, giver, recipient);
  for (const user of ants) await openHome(t, user);
  const homes = Object.fromEntries(ants.map((user) => [user, publishedHome(slack, user)]));
  await click(t, "U_ANN", staleOpenOf(await antsOf(t)));
  await sweepAt(t, nextTuesday, sweeps);
  await openHome(t, "U_ANN");
  return { homes, nextWeeksHome: publishedHome(slack, "U_ANN"), slackCalls: slack.calls.map((call) => JSON.stringify(call)).sort() };
}

async function antsOpenedQuests(flags: FlagDefinition[], turnOff?: () => void, setUp?: (t: Backend) => Promise<void>): Promise<Backend> {
  vi.useFakeTimers({ now: groupsSyncedAt });
  sentMessages = 0;
  const t = await testBackendServing(postHog, ...flags);
  turnOff?.();
  await setUp?.(t);
  await unlocksShippedBeforeAnyoneJoined(t);
  for (const user of ants) slack.withMember(user, { profile: profileOf(user) });
  slack.withUserGroup("S_ANTS", { name: "Ants", users: ants });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  for (const user of ants) {
    await memberChanged(t, "team_join", { id: user, profile: profileOf(user) });
    await settle(t);
  }
  vi.setSystemTime(lastTuesday);
  await t.run(async (ctx) => {
    for (const user of ants) await keepOpen(ctx, { workspace: "T1", member: await memberOf(ctx, user), at: lastTuesday }, "quests");
  });
  await settle(t);
  return t;
}

function previewedByThreeAnts(t: Backend) {
  return flagsFromPostHog(t, postHog, ...everyFlagBut(groupQuest, onForEmails(groupQuest, ...["U_ANN", "U_AL", "U_AMY"].map(emailOf))));
}

function membersOf(t: Backend, ...users: string[]) {
  return t.run((ctx) => Promise.all(users.map((user) => memberOf(ctx, user))));
}

function profileOf(user: string) {
  return { display_name: user.slice(2), email: emailOf(user) };
}

function emailOf(user: string) {
  return `${user.slice(2).toLowerCase()}@example.com`;
}

async function noGroupCounts(t: Backend) {
  await t.run(async (ctx) => {
    await ctx.db.insert("groupSettings", { workspace: "T1", mode: "allowlist", allowlist: [] });
  });
}

function groupQuestFacts(t: Backend) {
  return t.run(async (ctx) => ({
    launches: await ctx.db.query("groupQuestLaunches").collect(),
    weeks: await ctx.db.query("groupQuestWeeks").collect(),
    quests: await ctx.db.query("groupQuests").collect(),
    contributions: await ctx.db.query("groupQuestContributions").collect(),
    rewards: (await ctx.db.query("rewardRecords").collect()).filter(({ key }) => key.startsWith("group:")),
    pendingCrates: (await ctx.db.query("pendingCrates").collect()).filter(({ key }) => key.startsWith("group:")),
    crateOpenings: (await ctx.db.query("crateOpenings").collect()).filter(({ key }) => key.startsWith("group:")),
  }));
}

async function groupQuestJobsOf(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.map(({ name }) => name).filter((name) => /groupQuest(\.js)?:(tallyParticipants|drawGroupQuests|catchUpContributions)$/.test(name));
}

function groupQuestEvents() {
  return postHog.productEvents().filter(({ properties }) => properties.kind === "group");
}

function groupQuestExposuresOf(distinctId: string | undefined) {
  const exposures = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === distinctId && properties.$feature_flag === groupQuest);
  const asPostHogKeepsThem = new Map(exposures.map((exposure) => [exposure.uuid, exposure.properties.$feature_flag_response]));
  return [...asPostHogKeepsThem.values()];
}

async function meetTheGroupQuest(t: Backend, user: string) {
  await openHome(t, user);
}

async function sweepAt(t: Backend, at: number, sweeps = true) {
  vi.setSystemTime(at);
  if (!sweeps) return;
  await t.mutation(sweepJob(), {});
  await settle(t);
}

function sweepJob() {
  const job = crons.crons["draw each group's weekly group quest"];
  if (job === undefined) throw new Error("no cron job draws each group's weekly group quest");
  return makeFunctionReference<"mutation">(job.name);
}

let sentMessages = 0;

async function giveKudos(t: Backend, giver: string, recipient: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${saysWhy} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

function staleOpenOf(group: string): BlockAction {
  return staleButtonOf({ type: "openQuestCrate", quest: { kind: "group", group, week: thisWeek } });
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

function antsOf(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("userGroups").collect()).find(({ name }) => name === "Ants")!._id as string);
}

async function memberOf(ctx: MutationCtx, user: string) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function analyticsIdOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await memberOf(ctx, user);
    const row = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    return row?.analyticsId;
  });
}

function freshFakes() {
  slack = new FakeSlack();
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}
