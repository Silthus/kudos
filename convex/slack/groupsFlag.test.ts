import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { type FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, onInTheSandboxOnly, postHogDeciding, testBackendServing } from "../../testing/flags";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks, readBlocks, staleButtonOf, type Block, type BlockAction, type ClickedMessage } from "../../testing/slackInteractions";
import { memberChanged, settle, settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const tuesday = new Date("2026-10-13T10:00:00Z");
const lastTuesday = "2026-10-06T10:00:00Z";
const groupsSyncedAt = new Date("2026-09-01T10:00:00Z");
const groupsFlag = "groups";
const form = { contentType: "application/x-www-form-urlencoded" };

const slices = [onForEveryone("everyone-board"), onForEveryone("xp-levels")];
const groups = { Ants: ["U_ANN", "U_AL", "U_AMY", "U_ABE", "U_ACE"], Bees: ["U_AL", "U_BOB"] };
const emails: Record<string, string> = { U_ANN: "ann@example.com" };

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_REC");
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type GroupsOff = { condition: string; flags: FlagDefinition[]; turnOff?: () => void };

const groupsOff: GroupsOff[] = [
  { condition: "with groups off", flags: [offForEveryone(groupsFlag)] },
  { condition: "while PostHog has no groups flag", flags: [] },
  { condition: "without the flags key, even when PostHog turned groups on", flags: [onForEveryone(groupsFlag)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "") },
  { condition: "in production, while groups is on in the sandbox only", flags: [onInTheSandboxOnly(groupsFlag)], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
];

describe("GB29: slice 1 is invisible where groups doesn't apply", { timeout: 120_000 }, () => {
  test.each(groupsOff)("$condition, the welcome messages, every App Home tab and /hedgehug leaderboard read as in a workspace without groups", async ({ flags, turnOff }) => {
    const baseline = await workspaceOf({}, slices);
    turnOff?.();
    const withoutGroups = await storyIn(baseline);
    resetFakes();

    const t = await workspaceOf(groups, [...slices, ...flags]);
    turnOff?.();

    expect(await storyIn(t)).toEqual(withoutGroups);
  });

  test("with groups on the same story shows the welcome block, the Settings dropdown, the group mode and the group boards with the peer line", async () => {
    const story = await storyIn(await workspaceOf(groups, [...slices, onForEveryone(groupsFlag)]));

    expect(story.welcomes.U_ANN).toContain("You count for Ants on the leaderboard.");
    expect(story.welcomes.U_AL).toContain("Which group do you count for on the leaderboard?");
    expect(story.homes.U_AL.Settings!).toContainEqual(expect.stringContaining("[select: "));
    expect(story.homes.U_ANN.Admin!).toContain("section: *Groups that count*");
    expect(story.homes.U_ANN.Leaderboard!.join("\n")).toContain("*Groups*");
    expect(story.homes.U_ANN.Leaderboard!.join("\n")).toContain("*Ants*");
    expect(story.replies.week).toContain("You improved more than");
  });

  test.each(groupsOff)("$condition, a stale welcome Save, Settings pick or group mode click changes nothing and sends nothing", async ({ flags, turnOff }) => {
    const t = await workspaceOf(groups, [...slices, ...flags]);
    turnOff?.();
    await storyIn(t);
    const before = await groupFacts(t);
    const homesBefore = { U_ANN: publishedHome(slack, "U_ANN"), U_AL: publishedHome(slack, "U_AL") };
    const bees = await groupIdNamed(t, "Bees");

    await interact(t, "U_AL", staleButtonOf({ type: "pickPrimaryGroup", group: bees, surface: "welcome" }), { inMessage: welcomeMessageTo("U_AL") });
    await interact(t, "U_AL", { type: "static_select", action_id: JSON.stringify({ type: "pickPrimaryGroup", surface: "settings" }), selected_option: { value: bees } });
    await interact(t, "U_ANN", staleButtonOf({ type: "setGroupMode", mode: "allowlist" }));
    await interact(t, "U_ANN", { type: "multi_static_select", action_id: "setGroupMode", selected_options: [{ text: { type: "plain_text", text: "Bees" }, value: bees }] });

    expect(await groupFacts(t)).toEqual(before);
    expect(slack.callsTo("chat.update")).toEqual([]);
    expect({ U_ANN: publishedHome(slack, "U_ANN"), U_AL: publishedHome(slack, "U_AL") }).toEqual(homesBefore);
    expect(postHog.productEvents().filter(({ event }) => event === "primary group picked")).toEqual([]);
  });
});

describe("GB11, GB29: facts record while groups is off", { timeout: 120_000 }, () => {
  test("kudos given while it was off show on the boards once it is on, as if it had been on all along, and turning it off and on again rewrites nothing", async () => {
    const alwaysOn = (await storyIn(await workspaceOf(groups, [...slices, onForEveryone(groupsFlag)]))).replies;
    resetFakes();
    const t = await workspaceOf(groups, [...slices, offForEveryone(groupsFlag)]);
    await storyIn(t);
    const recordedWhileOff = await groupFacts(t);

    await flagsFromPostHog(t, postHog, ...slices, onForEveryone(groupsFlag));
    const shown = await repliesTo(t, "U_ANN");
    await flagsFromPostHog(t, postHog, ...slices, offForEveryone(groupsFlag));
    await openHome(t, "U_ANN");
    await flagsFromPostHog(t, postHog, ...slices, onForEveryone(groupsFlag));

    expect(recordedWhileOff.attributions).toHaveLength(storyKudos.length);
    expect(shown).toEqual(alwaysOn);
    expect(await repliesTo(t, "U_ANN")).toEqual(shown);
    expect(await groupFacts(t)).toEqual(recordedWhileOff);
  });
});

describe("O36: the groups exposure", { timeout: 120_000 }, () => {
  test("is sent once per member and value, wherever the member meets groups", async () => {
    const t = await workspaceOf(groups, [...slices, onForEveryone(groupsFlag)]);
    await storyIn(t);
    const ann = await analyticsIdOf(t, "U_ANN");
    const metWhileOn = exposuresOf(ann);
    await meetGroupsEverywhere(t, "U_ANN");
    const metAgainWhileOn = exposuresOf(ann);

    await flagsFromPostHog(t, postHog, ...slices, offForEveryone(groupsFlag));
    await meetGroupsEverywhere(t, "U_ANN");
    await meetGroupsEverywhere(t, "U_ANN");

    expect(new Set(metWhileOn.map(({ $feature_flag_response }) => $feature_flag_response))).toEqual(new Set([true]));
    expect(metAgainWhileOn).toEqual(metWhileOn);
    expect(exposuresOf(ann)).toEqual([...metWhileOn, exposureOf(ann, false)]);
  });

  test("the member decision turns groups on for the member whose email it names, and for nobody else", async () => {
    const t = await workspaceOf(groups, [...slices, onForEmails(groupsFlag, emails.U_ANN!)]);

    const story = await storyIn(t);

    expect(story.replies.week).toContain("*Groups*");
    expect(story.welcomes.U_ANN).toContain("You count for Ants on the leaderboard.");
    expect(story.welcomes.U_AL).not.toContain("Which group do you count for on the leaderboard?");
    expect((await command(t, "U_AL", "leaderboard")).text).not.toContain("*Groups*");
    expect(story.homes.U_AL.Settings!.join("\n")).not.toContain("count for");
    const [ann, al] = [await analyticsIdOf(t, "U_ANN"), await analyticsIdOf(t, "U_AL")];
    expect(new Set(exposuresOf(ann).map(({ $feature_flag_response }) => $feature_flag_response))).toEqual(new Set([true]));
    expect(new Set(exposuresOf(al).map(({ $feature_flag_response }) => $feature_flag_response))).toEqual(new Set([false]));
  });
});

const storyKudos: Array<[string, string, number]> = [
  [lastTuesday, "U_AL", 1],
  [lastTuesday, "U_AMY", 1],
  [lastTuesday, "U_BOB", 2],
  ["now", "U_ANN", 3],
  ["now", "U_AL", 2],
  ["now", "U_AMY", 1],
  ["now", "U_ABE", 1],
  ["now", "U_BOB", 1],
];

type Tabs = { Profile: string[]; Leaderboard?: string[]; Settings?: string[]; Admin?: string[] };

type Story = { welcomes: Record<"U_ANN" | "U_AL", string>; homes: Record<"U_ANN" | "U_AL", Tabs>; replies: Replies };

type Replies = { week: string; month: string; all: string };

async function storyIn(t: Backend): Promise<Story> {
  for (const [at, giver, kudos] of storyKudos) await giveKudosOn(t, at, giver, kudos);
  const welcomes = { U_ANN: welcomeLinesTo("U_ANN"), U_AL: welcomeLinesTo("U_AL") };
  const homes = { U_ANN: await everyTabOf(t, "U_ANN"), U_AL: await everyTabOf(t, "U_AL") };
  return { welcomes, homes, replies: await repliesTo(t, "U_ANN") };
}

async function everyTabOf(t: Backend, user: string): Promise<Tabs> {
  await openHome(t, user);
  const tabs: Tabs = { Profile: publishedHome(slack, user) };
  for (const tab of ["Leaderboard", "Settings", "Admin"] as const) {
    if (!publishedHome(slack, user)[0]?.includes(tab)) continue;
    await interact(t, user, buttonIn(publishedHomeBlocks(slack, user), tab));
    tabs[tab] = publishedHome(slack, user);
  }
  return tabs;
}

async function repliesTo(t: Backend, user: string): Promise<Replies> {
  return { week: (await command(t, user, "leaderboard")).text, month: (await command(t, user, "leaderboard month")).text, all: (await command(t, user, "leaderboard all")).text };
}

async function workspaceOf(memberships: Record<string, string[]>, flags: FlagDefinition[]) {
  vi.setSystemTime(groupsSyncedAt);
  const t = await testBackendServing(postHog, ...flags);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 20 }));
  const users = [...new Set(Object.values(groups).flat())];
  for (const user of users) slack.withMember(user, profileOf(user));
  for (const [name, members] of Object.entries(memberships)) slack.withUserGroup(`S_${name.toUpperCase()}`, { name, users: members });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  for (const user of users) {
    await memberChanged(t, "team_join", { id: user, ...profileOf(user) });
    await settle(t);
  }
  vi.setSystemTime(tuesday);
  return t;
}

function profileOf(user: string) {
  return { is_admin: user === "U_ANN", profile: { display_name: user.slice(2), ...(emails[user] && { email: emails[user] }) } };
}

function resetFakes() {
  slack = new FakeSlack().withMember("U_REC");
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
}

let messagesGiven = 0;

async function giveKudosOn(t: Backend, at: string, giver: string, kudos: number) {
  if (at !== "now") vi.setSystemTime(new Date(at));
  const blocks = [section(mention("U_REC"), ...Array.from({ length: kudos }, () => emoji("taco")))];
  const ts = `${Math.floor(Date.now() / 1000) + messagesGiven++}.000100`;
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts })));
  await settle(t);
  vi.setSystemTime(tuesday);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function interact(t: Backend, user: string, action: BlockAction, options: Parameters<typeof blockActions>[2] = {}) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action, options), form));
  expect(response.status).toBe(200);
  await settleInTimeOrder(t);
}

async function command(t: Backend, user: string, text: string) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text,
    response_url: "https://hooks.slack.com/commands/T1/1/abc",
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, form));
  expect(response.status).toBe(200);
  const answer = await response.text();
  await settle(t);
  return answer === "" ? { text: "" } : (JSON.parse(answer) as { response_type: string; text: string });
}

function welcomeLinesTo(user: string) {
  const welcome = slack.callsTo("chat.postMessage").find(({ channel }) => channel === user);
  expect(welcome, `a welcome to ${user}`).toBeDefined();
  return [...readBlocks(welcome!.blocks as Block[]), String(welcome!.text)].join("\n");
}

function welcomeMessageTo(user: string): ClickedMessage {
  const [welcome] = slack.messagesIn(user);
  return { channel: user, ts: welcome!.ts };
}

function groupFacts(t: Backend) {
  return t.run(async (ctx) => ({
    memberGroups: await ctx.db.query("memberGroups").collect(),
    groupSettings: await ctx.db.query("groupSettings").collect(),
    history: await ctx.db.query("primaryGroupHistory").collect(),
    attributions: await ctx.db.query("attributions").collect(),
    attributedTotals: await ctx.db.query("attributedTotals").collect(),
    attributedGroupTotals: await ctx.db.query("attributedGroupTotals").collect(),
  }));
}

async function groupIdNamed(t: Backend, name: string) {
  return t.run(async (ctx) => (await ctx.db.query("userGroups").collect()).find((group) => group.name === name)!._id);
}

function exposures() {
  return postHog
    .events()
    .filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === groupsFlag)
    .map(({ distinct_id, properties }) => exposureOf(distinct_id, properties.$feature_flag_response as boolean));
}

function exposuresOf(distinctId: string | undefined) {
  return exposures().filter(({ distinct_id }) => distinct_id === distinctId);
}

async function meetGroupsEverywhere(t: Backend, user: string) {
  await everyTabOf(t, user);
  await repliesTo(t, user);
}

function exposureOf(distinctId: string | undefined, response: boolean) {
  return { distinct_id: distinctId, $feature_flag: groupsFlag, $feature_flag_response: response, locally_evaluated: true };
}

async function analyticsIdOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    const row = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    return row?.analyticsId;
  });
}
