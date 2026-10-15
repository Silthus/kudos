import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsKey, routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { everythingStored, memberChanged, settle, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, menuOptionInHome, publishedHome, readBlocks, staleButtonOf, staleMenuOptionOf, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";

const wednesday = Date.parse("2026-10-14T10:00:00Z");
const nextMonday = Date.parse("2026-10-19T07:00:00Z");
const mondayAfter = Date.parse("2026-10-26T08:00:00Z");
const twoWeeksLater = wednesday + 14 * 24 * 60 * 60 * 1000;
const minute = 60_000;
const form = { contentType: "application/x-www-form-urlencoded" };
const announcementChannel = "C_ANNOUNCE";
const mondayPost = "monday-post";
const alicesEmail = "alice@example.com";
const admins = ["U_ALICE", "U_SAM"];
const owls = ["U_ANN", "U_BOB", "U_CARL"];
const zebras = ["U_DORA", "U_EVE", "U_FRED"];

const itsPrerequisitesOn = ["xp-levels", "groups"].map(onForEveryone);
const postOn = [...itsPrerequisitesOn, onForEveryone(mondayPost)];
const postOff = [...itsPrerequisitesOn, offForEveryone(mondayPost)];
const postNotCreated = itsPrerequisitesOn;
const previewedByAlice = [...itsPrerequisitesOn, onForEmails(mondayPost, alicesEmail)];

const adminTabHint = "context: Only workspace admins and owners see this tab.";
const switchedOn = "section: Every Monday I post last week's top groups in <#C_ANNOUNCE>. [button: Switch off]";
const timeZonePicked = "I post it at 9:00 in this time zone.";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: wednesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GB28: the Monday post is dark wherever monday-post is off", { timeout: 120_000 }, () => {
  test("with monday-post off or not created, no Admin tab shows the Monday post, a forged switch schedules nothing, and every Slack call equals those with it off", async () => {
    const whileOff = await adminsWalk(postOff);
    const whileNotCreated = await adminsWalk(postNotCreated);

    expect(whileOff.adminTab).toContain(adminTabHint);
    expect(whileOff.lines.filter(namesTheMondayPost)).toEqual([]);
    expect(whileOff.mondayPostRows).toEqual({ settings: [], claims: [], jobs: [] });
    expect(whileNotCreated.mondayPostRows).toEqual({ settings: [], claims: [], jobs: [] });
    expect(whileNotCreated.calls).toEqual(whileOff.calls);
  });

  test("with monday-post on but the flags key missing, nothing names the Monday post, nothing is scheduled and no exposure goes", async () => {
    const walked = await adminsWalk(postOn, { withFlagsKey: false });

    expect(walked.lines.filter(namesTheMondayPost)).toEqual([]);
    expect(walked.mondayPostRows).toEqual({ settings: [], claims: [], jobs: [] });
    expect(await exposuresOf(walked.t, "U_ALICE")).toEqual([]);
  });

  test("with monday-post on for Alice's email only, Alice sees the switch, Sam's Slack calls equal those with it off, and her switch posts nothing in the workspace", async () => {
    const whilePreviewed = await adminsWalk(previewedByAlice);
    const whileOff = await adminsWalk(postOff);

    expect(whilePreviewed.adminTab).toContain(switchedOn);
    expect(whilePreviewed.mondayPostRows.settings).toEqual([{ on: true, timeZone: "America/New_York" }]);
    expect(whilePreviewed.posts).toEqual([]);
    expect(whilePreviewed.samsCalls.filter(namesTheMondayPost)).toEqual([]);
    expect(distinct(whilePreviewed.samsCalls)).toEqual(distinct(whileOff.samsCalls));
  });
});

describe("GB28: the monday-post flag turned off and on, its stale clicks and its exposure", { timeout: 120_000 }, () => {
  const turnedOff = {
    "turned off": (t: Backend) => flagsFromPostHog(t, postHog, ...postOff),
    deleted: (t: Backend) => flagsFromPostHog(t, postHog, ...postNotCreated),
    "left without the flags key": () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", ""),
  };

  test.each(Object.entries(turnedOff))("a job scheduled while monday-post was on, run after it was %s, posts nothing and claims no week, and on again it posts the next Monday", async (_, turnOff) => {
    const t = await workspaceDeciding(...postOn);
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    const switchShown = mondayPostLinesOf(publishedHome(slack, "U_ALICE"));
    await giveKudosInWeek(t);

    await turnOff(t);
    await settleUpTo(t, nextMonday);

    expect(mondayPostTimes()).toEqual([]);
    expect((await mondayPostRowsOf(t)).claims).toEqual([]);
    expect((await mondayPostRowsOf(t)).jobs).toEqual([mondayAfter]);

    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", flagsKey);
    await flagsFromPostHog(t, postHog, ...postOn);
    await adminTabOpen(t, "U_ALICE");
    await giveKudosInWeek(t);
    await settleUpTo(t, mondayAfter);

    expect(mondayPostLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(switchShown);
    expect(mondayPostTimes()).toEqual([mondayAfter]);
  });

  test("a Switch on from an Admin tab published while monday-post was on, clicked after it turned off, writes nothing and schedules nothing", async () => {
    const t = await workspaceDeciding(...postOn);
    await adminTabOpen(t, "U_ALICE");
    const switchOn = buttonInHome(slack, "U_ALICE", "Switch on");
    await flagsFromPostHog(t, postHog, ...postOff);
    const stored = await everythingButReceiptsAndExposures(t);

    await interact(t, "U_ALICE", switchOn);

    expect(await everythingButReceiptsAndExposures(t)).toEqual(stored);
    expect(await mondayPostRowsOf(t)).toEqual({ settings: [], claims: [], jobs: [] });
  });

  test("a Switch off or a time zone from an Admin tab published while monday-post was on, clicked after it turned off, changes nothing", async () => {
    const t = await workspaceDeciding(...postOn);
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    const switchOff = buttonInHome(slack, "U_ALICE", "Switch off");
    const newYork = menuOptionInHome(slack, "U_ALICE", timeZonePicked, "America/New York");
    await flagsFromPostHog(t, postHog, ...postOff);
    const stored = await everythingButReceiptsAndExposures(t);

    await interact(t, "U_ALICE", switchOff);
    await interact(t, "U_ALICE", newYork);

    expect(await everythingButReceiptsAndExposures(t)).toEqual(stored);
    expect(await mondayPostRowsOf(t)).toEqual({ settings: [{ on: true, timeZone: "Europe/Berlin" }], claims: [], jobs: [nextMonday] });
  });

  test("the exposure goes once per admin and value through the flag turned off and on again, and none to a member who isn't an admin", async () => {
    const t = await workspaceDeciding(...postOn);
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await adminTabOpen(t, "U_ALICE");
    await adminTabOpen(t, "U_SAM");
    await giveKudos(t, "U_ANN", "U_BOB", 1);
    await openHome(t, "U_ANN");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true]);
    expect(await exposuresOf(t, "U_SAM")).toEqual([true]);

    await flagsFromPostHog(t, postHog, ...postOff);
    await adminTabOpen(t, "U_ALICE");
    await settleUpTo(t, nextMonday);
    await flagsFromPostHog(t, postHog, ...postOn);
    await adminTabOpen(t, "U_ALICE");
    await settleUpTo(t, mondayAfter);

    expect(await exposuresOf(t, "U_ALICE")).toEqual([true, false]);
    expect(await exposuresOf(t, "U_SAM")).toEqual([true]);
    expect(await exposuresOf(t, "U_ANN")).toEqual([]);
  });
});

async function adminsWalk(definitions: FlagDefinition[], { withFlagsKey = true } = {}) {
  const t = await workspaceDeciding(...definitions);
  if (!withFlagsKey) vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  await adminTabAskedFor(t, "U_ALICE");
  await interact(t, "U_ALICE", staleButtonOf({ type: "setMondayPost", on: true }));
  await interact(t, "U_ALICE", staleMenuOptionOf({ type: "setMondayPost", on: true, timeZone: "America/New_York" }));
  const adminTab = publishedHome(slack, "U_ALICE");
  await adminTabAskedFor(t, "U_SAM");
  await giveKudosInWeek(t);
  await settleUpTo(t, twoWeeksLater);
  return {
    t,
    adminTab,
    calls: comparable(slack.calls),
    lines: slack.calls.flatMap(readCall),
    samsCalls: comparable(slackCallsAbout("U_SAM")),
    posts: mondayPostTimes(),
    mondayPostRows: await mondayPostRowsOf(t),
  };
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  vi.clearAllTimers();
  sentMessages = 0;
  slack = new FakeSlack()
    .withMember("U_ALICE", { is_admin: true, tz: "Europe/Berlin", profile: { email: alicesEmail } })
    .withMember("U_SAM", { is_admin: true, tz: "Europe/Berlin", profile: { email: "sam@example.com" } })
    .withUserGroup("S_OWL", { name: "Owls", users: owls })
    .withUserGroup("S_ZEBRA", { name: "Zebras", users: zebras });
  for (const user of [...owls, ...zebras]) slack.withMember(user, { profile: { email: `${user.slice(2).toLowerCase()}@example.com` } });
  postHog = postHogDeciding("production");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = await flagsFromPostHog(testBackend(), postHog, ...definitions);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, announcementChannel }));
  for (const admin of admins) await memberChanged(t, "team_join", { id: admin, is_admin: true, tz: "Europe/Berlin" });
  for (const user of [...owls, ...zebras]) await memberChanged(t, "team_join", { id: user });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  return t;
}

async function giveKudosInWeek(t: Backend) {
  await giveKudos(t, "U_ANN", "U_BOB", 2);
  await giveKudos(t, "U_BOB", "U_ANN", 1);
  await giveKudos(t, "U_DORA", "U_EVE", 1);
  await giveKudos(t, "U_ALICE", "U_ANN", 1);
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleAMinute(t);
}

async function adminTabOpen(t: Backend, user: string) {
  await openHome(t, user);
  await click(t, user, "Admin");
}

async function adminTabAskedFor(t: Backend, user: string) {
  await openHome(t, user);
  await interact(t, user, staleButtonOf({ type: "showHomeTab", tab: "admin" }));
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleAMinute(t);
}

async function click(t: Backend, user: string, label: string) {
  await interact(t, user, buttonInHome(slack, user, label));
}

async function interact(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  expect(response.status).toBe(200);
  await settleAMinute(t);
}

function settleAMinute(t: Backend) {
  return settleUpTo(t, Date.now() + minute);
}

async function mondayPostRowsOf(t: Backend) {
  return t.run(async (ctx) => ({
    settings: (await ctx.db.query("mondayPostSettings").collect()).map(({ on, timeZone }) => ({ on, timeZone })),
    claims: await ctx.db.query("mondayPostClaims").collect(),
    jobs: (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ name, state }) => name.includes("mondayPost") && state.kind === "pending").map(({ scheduledTime }) => scheduledTime),
  }));
}

function everythingButReceiptsAndExposures(t: Backend) {
  return everythingStored(t, { except: ["slackReceipts", "flagExposures", "outbox"] });
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === mondayPost);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => properties.$feature_flag_response);
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique(),
  );
  return row!._id;
}

function mondayPostTimes() {
  return slack.timesOf("chat.postMessage", ({ channel, text }) => channel === announcementChannel && String(text).startsWith("🏆 Last week in kudos"));
}

function mondayPostLinesOf(home: string[]) {
  const start = home.indexOf("section: *Monday post*");
  if (start === -1) return [];
  const end = home.indexOf("divider", start);
  return home.slice(start, end === -1 ? undefined : end);
}

function slackCallsAbout(user: string) {
  return slack.calls.filter(({ args }) => [args.channel, args.user, args.user_id].includes(user));
}

function comparable(calls: SlackCall[]) {
  return calls.map((call) => JSON.stringify(call).replace(/\d{10}\.\d{6}/g, "<ts>")).sort();
}

function distinct(calls: string[]) {
  return [...new Set(calls)];
}

function readCall({ args }: SlackCall): string[] {
  const texts = [args.text, ...(Array.isArray(args.blocks) ? readBlocks(args.blocks as Block[]) : [])];
  const view = args.view as { blocks?: Block[] } | undefined;
  return [...texts, ...(view?.blocks === undefined ? [] : readBlocks(view.blocks))].filter((line): line is string => typeof line === "string");
}

function namesTheMondayPost(line: string) {
  return /Monday|setMondayPost|Last week in kudos|time zone/.test(line);
}
