import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone } from "../../testing/flags";
import { FakeSlack, landsButTimesOut, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { type BlockAction, blockActions, buttonInHome, channelPickerInHome, groupPickerInHome, menuOptionInHome, publishedHome, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const wednesday = new Date("2026-10-14T10:00:00Z");
const announcementChannel = "C_ANNOUNCE";
const slackBoundaryTimeoutMs = 30_000;
const form = { contentType: "application/x-www-form-urlencoded" };
const owls = ["U_ANN", "U_BOB", "U_CARL"];
const zebras = ["U_DORA", "U_EVE", "U_FRED"];
const everyone = ["U_ALICE", "U_SAM", ...owls, ...zebras];
const minute = 60_000;
const week = 7 * 24 * 60 * minute;

const switchedOff = ["section: *Monday post*", "section: I can post last week's top groups in <#C_ANNOUNCE> every Monday at 9:00. [button: Switch on]"];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: wednesday });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack();
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GB28: an admin switches on the Monday post in the Admin tab", { timeout: slackBoundaryTimeoutMs }, () => {
  test("once groups are available and an announcement channel is set, the switch shows, and switching on shows the switching admin's time zone", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    expect(mondayPostLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(switchedOff);

    await click(t, "U_ALICE", "Switch on");

    expect(mondayPostLinesOf(publishedHome(slack, "U_ALICE"))).toEqual([
      "section: *Monday post*",
      "section: Every Monday I post last week's top groups in <#C_ANNOUNCE>. [button: Switch off]",
      "section: I post it at 9:00 in this time zone. [select: Europe/Berlin]",
    ]);
  });

  test("switching off shows the switch off again", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");

    await click(t, "U_ALICE", "Switch off");

    expect(mondayPostLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(switchedOff);
  });

  test("without an announcement channel there is no switch", async () => {
    const t = await workspaceWithGroups({ channel: null });

    await adminTabOpen(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).not.toContain("section: *Monday post*");
  });

  test("where no group counts there is no switch", async () => {
    const t = await workspaceWithGroups({ groups: false });

    await adminTabOpen(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).not.toContain("section: *Monday post*");
  });

  test("where `monday-post` doesn't apply there is no switch, and a forged switch changes nothing", async () => {
    const t = await workspaceWithGroups({ flags: ["xp-levels", "groups"] });
    await adminTabOpen(t, "U_ALICE");

    await interact(t, "U_ALICE", staleButtonOf({ type: "setMondayPost", on: true }));

    expect(publishedHome(slack, "U_ALICE")).not.toContain("section: *Monday post*");
    expect(await mondayPostJobs(t)).toEqual([]);
  });

  test("a member who isn't an admin can't switch it on with a forged command", async () => {
    const t = await workspaceWithGroups();
    await giveKudos(t, "U_ANN", "U_BOB", 1);
    await openHome(t, "U_ANN");

    await interact(t, "U_ANN", staleButtonOf({ type: "setMondayPost", on: true, timeZone: "Asia/Kolkata" }));

    expect(await mondayPostJobs(t)).toEqual([]);
    await giveKudosInWeek(t);
    await settleUpTo(t, wednesday.getTime() + 2 * week);
    expect(mondayPosts()).toEqual([]);
  });
});

describe("GB28: the Monday post goes out every Monday at 9:00 in the admin's time zone", { timeout: slackBoundaryTimeoutMs }, () => {
  test("switched on by an admin in Berlin, last week's top groups are posted Monday 9:00 Berlin time", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);

    await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:00:00Z")]);
    expect(mondayPosts()).toEqual([
      ["🏆 Last week in kudos", "🥇 Owls · 1.0 per person", "🥈 Zebras · 0.3 per person", "📈 Most improved: Owls", "4 people gave kudos last week. Thank you!"].join("\n"),
    ]);
  });

  test("in a half-hour zone it goes out at 9:00 there", async () => {
    const t = await workspaceWithGroups({ adminZone: "Asia/Kolkata" });
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);

    await settleUpTo(t, Date.parse("2026-10-19T03:30:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T03:30:00Z")]);
  });

  test("across a daylight-saving change it still goes out at 9:00 Berlin time, an hour later in UTC", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-21T10:00:00Z"));
    await giveKudosInWeek(t);

    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:00:00Z"), Date.parse("2026-10-26T08:00:00Z")]);
  });

  test("an admin who picks another time zone moves the post to 9:00 there, and the job from before the change posts nothing", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");

    await interact(t, "U_ALICE", menuOptionInHome(slack, "U_ALICE", "I post it at 9:00 in this time zone.", "America/New York"));
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-19T13:00:00Z"));

    expect(mondayPostLinesOf(publishedHome(slack, "U_ALICE"))).toContain("section: I post it at 9:00 in this time zone. [select: America/New York]");
    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T13:00:00Z")]);
  });
  test("an admin who picks another time zone after this week's post gets next week's post at 9:00 there", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-19T08:00:00Z"));

    await interact(t, "U_ALICE", menuOptionInHome(slack, "U_ALICE", "I post it at 9:00 in this time zone.", "America/New York"));
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-26T13:00:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:00:00Z"), Date.parse("2026-10-26T13:00:00Z")]);
  });

  test("a job that runs before 9:00 on Monday posts nothing, and the post goes out at 9:00", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-19T06:00:00Z"));

    await t.action(internal.slack.mondayPost.postMondayPost, { workspace: "T1", generation: await generationOf(t) });
    expect(mondayPosts()).toEqual([]);

    await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z"));
    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:00:00Z")]);
  });
});

describe("GB28: the Monday post goes out at most once a week", { timeout: slackBoundaryTimeoutMs }, () => {
  test("the job from before a switch-off posts nothing", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await click(t, "U_ALICE", "Switch off");
    await giveKudosInWeek(t);

    await settleUpTo(t, wednesday.getTime() + 2 * week);

    expect(mondayPosts()).toEqual([]);
  });

  test("two jobs for one week post once", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z"));

    await t.action(internal.slack.mondayPost.postMondayPost, { workspace: "T1", generation: await generationOf(t) });

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:00:00Z")]);
    expect((await mondayPostJobs(t)).map(({ scheduledTime }) => scheduledTime)).toEqual([Date.parse("2026-10-26T08:00:00Z")]);
  });

  test("with `xp-levels` off in the workspace, which hides the Admin tab, the job posts nothing", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);

    await flagsFromPostHog(t, postHog, offForEveryone("xp-levels"), onForEveryone("groups"), onForEveryone("monday-post"));
    await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z"));

    expect(mondayPosts()).toEqual([]);
  });

  test("a post whose answer is lost isn't sent again that week, and next week's goes out", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    slack.answering("chat.postMessage", landsButTimesOut);
    await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z"));

    await t.action(internal.slack.mondayPost.postMondayPost, { workspace: "T1", generation: await generationOf(t) });
    await settleUpTo(t, Date.parse("2026-10-21T10:00:00Z"));
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:00:00Z"), Date.parse("2026-10-26T08:00:00Z")]);
  });

  test("a post Slack rate-limits goes out once, after the Retry-After", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    slack.answering("chat.postMessage", rateLimitedFor(30));

    await settleUpTo(t, Date.parse("2026-10-19T08:00:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:00:00Z"), Date.parse("2026-10-19T07:00:30Z")]);
    expect(mondayPosts()).toHaveLength(1);
  });

  test("a post waiting on a rate-limit hold from an earlier message goes out once the hold ends", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-19T06:59:00Z"));
    await t.mutation(internal.slack.rateLimits.hold, { workspace: "T1", method: "chat.postMessage", until: Date.parse("2026-10-19T07:02:00Z") });

    await settleUpTo(t, Date.parse("2026-10-19T08:00:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:02:00Z")]);
    expect(mondayPosts()).toHaveLength(1);
  });

  test("a hold that other messages keep extending uses up no try, and the post goes out once it ends", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-19T06:59:00Z"));

    for (const minutes of [1, 2, 3, 4]) {
      await t.mutation(internal.slack.rateLimits.hold, { workspace: "T1", method: "chat.postMessage", until: Date.parse("2026-10-19T07:00:00Z") + minutes * minute });
      await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z") + minutes * minute - 30_000);
    }
    await settleUpTo(t, Date.parse("2026-10-19T08:00:00Z"));

    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-19T07:04:00Z")]);
    expect(mondayPosts()).toHaveLength(1);
  });

  test("a post Slack keeps rate-limiting is given up after three tries that week, and next week's goes out", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    slack.answering("chat.postMessage", rateLimitedFor(30), rateLimitedFor(30), rateLimitedFor(30));

    await settleUpTo(t, Date.parse("2026-10-21T10:00:00Z"));
    expect(mondayPostTimes()).toHaveLength(3);
    expect(mondayPosts()).toEqual([]);

    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));
    expect(mondayPosts()).toHaveLength(1);
  });
});

describe("GB28, GB31: the Monday post names groups, never a person", { timeout: slackBoundaryTimeoutMs }, () => {
  test("the post names no member, by mention or by name", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);

    await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z"));

    const [post] = mondayPosts();
    expect(post).toBeDefined();
    expect(post).not.toMatch(/<@|<!/);
    for (const user of everyone) expect(post).not.toContain(nameOf(user));
  });

  test("a week nobody gave kudos posts nothing, and the next week with kudos posts", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await settleUpTo(t, Date.parse("2026-10-19T00:00:00Z"));
    await click(t, "U_ALICE", "Switch on");

    await settleUpTo(t, Date.parse("2026-10-19T07:00:00Z"));
    expect(mondayPosts()).toEqual([]);

    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));
    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-26T08:00:00Z")]);
  });

  test("one giver is one person", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await settleUpTo(t, Date.parse("2026-10-19T00:00:00Z"));
    await click(t, "U_ALICE", "Switch on");
    await giveKudos(t, "U_ANN", "U_BOB", 1);

    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));

    expect(mondayPosts()).toEqual([["🏆 Last week in kudos", "🥇 Owls · 0.3 per person", "📈 Most improved: Owls", "1 person gave kudos last week. Thank you!"].join("\n")]);
  });

  test("when I'm not in the announcement channel, the Admin tab says so and the week is skipped", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    slack.answering("chat.postMessage", slackError("not_in_channel"));

    await settleUpTo(t, Date.parse("2026-10-19T07:01:00Z"));

    expect(mondayPostLinesOf(publishedHome(slack, "U_ALICE"))).toContain("section: I can't post in <#C_ANNOUNCE>. Add me to it or pick another channel.");
    expect(slack.callsTo("chat.postMessage").filter(isMondayPost)).toHaveLength(1);
  });

  test.each(["no_permission", "restricted_action", "restricted_action_read_only_channel", "restricted_action_thread_only_channel", "ekm_access_denied"])(
    "when Slack refuses my post in the announcement channel with %s, the Admin tab says I can't post there and the week is skipped",
    async (refusal) => {
      const t = await workspaceWithGroups();
      await adminTabOpen(t, "U_ALICE");
      await click(t, "U_ALICE", "Switch on");
      await giveKudosInWeek(t);
      slack.answering("chat.postMessage", slackError(refusal));

      await settleUpTo(t, Date.parse("2026-10-19T08:00:00Z"));

      expect(mondayPostLinesOf(publishedHome(slack, "U_ALICE"))).toContain("section: I can't post in <#C_ANNOUNCE>. Add me to it or pick another channel.");
      expect(slack.callsTo("chat.postMessage").filter(isMondayPost)).toHaveLength(1);
    },
  );
});

describe("GB28: the job rechecks the channel and groups before posting", { timeout: slackBoundaryTimeoutMs }, () => {
  test("after an admin stops posting in the announcement channel, no post goes out; after they pick a channel again, it does", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);

    await click(t, "U_ALICE", "Stop posting");
    await settleUpTo(t, Date.parse("2026-10-21T10:00:00Z"));
    expect(mondayPosts()).toEqual([]);

    await interact(t, "U_ALICE", channelPickerInHome(slack, "U_ALICE", announcementChannel));
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));
    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-26T08:00:00Z")]);
  });

  test("while no group counts, no post goes out; once every group counts again, it does", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);

    await click(t, "U_ALICE", "Only these groups");
    await interact(t, "U_ALICE", groupPickerInHome(slack, "U_ALICE"));
    await settleUpTo(t, Date.parse("2026-10-21T10:00:00Z"));
    expect(mondayPosts()).toEqual([]);

    await click(t, "U_ALICE", "Every group");
    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));
    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-26T08:00:00Z")]);
  });
});

describe("GB28: next Monday's post is booked even when this week's claim fails", { timeout: slackBoundaryTimeoutMs }, () => {
  test("a claim that throws, on two claims stored for one week, leaves next Monday's job in place, and next week's post goes out", async () => {
    const t = await workspaceWithGroups();
    await adminTabOpen(t, "U_ALICE");
    await click(t, "U_ALICE", "Switch on");
    await giveKudosInWeek(t);
    await t.run(async (ctx) => {
      const unreadable = { workspace: "T1", week: "2026-10-19", claimedAt: Date.now(), channel: announcementChannel, outcome: "claimed" as const };
      await ctx.db.insert("mondayPostClaims", unreadable);
      await ctx.db.insert("mondayPostClaims", unreadable);
    });

    await settleUpTo(t, Date.parse("2026-10-19T08:00:00Z"));
    expect(mondayPosts()).toEqual([]);

    await giveKudosInWeek(t);
    await settleUpTo(t, Date.parse("2026-10-26T08:00:00Z"));
    expect(mondayPostTimes()).toEqual([Date.parse("2026-10-26T08:00:00Z")]);
  });
});

type Setup = { channel?: string | null; groups?: boolean; adminZone?: string; flags?: string[] };

async function workspaceWithGroups({ channel = announcementChannel, groups = true, adminZone = "Europe/Berlin", flags = ["xp-levels", "groups", "monday-post"] }: Setup = {}) {
  postHog = flagsOnForEveryone(slack.fetch, ...flags);
  slack.withMember("U_ALICE", { is_admin: true, tz: adminZone, real_name: nameOf("U_ALICE") });
  for (const user of everyone.slice(1)) slack.withMember(user, { real_name: nameOf(user) });
  if (groups) slack.withUserGroup("S_OWL", { name: "Owls", users: owls }).withUserGroup("S_ZEBRA", { name: "Zebras", users: zebras });
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, ...(channel !== null && { announcementChannel: channel }) }));
  await memberChanged(t, "team_join", { id: "U_ALICE", is_admin: true, tz: adminZone, real_name: nameOf("U_ALICE") });
  for (const user of everyone.slice(1)) await memberChanged(t, "team_join", { id: user, real_name: nameOf(user) });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  return t;
}

function nameOf(user: string) {
  return `${user.slice(2, 3)}${user.slice(3).toLowerCase()} Example`;
}

async function giveKudosInWeek(t: Backend) {
  await giveKudos(t, "U_ANN", "U_BOB", 2);
  await giveKudos(t, "U_BOB", "U_ANN", 1);
  await giveKudos(t, "U_DORA", "U_EVE", 1);
  await giveKudos(t, "U_ALICE", "U_ANN", 1);
}

async function adminTabOpen(t: Backend, user: string) {
  await openHome(t, user);
  await click(t, user, "Admin");
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleAMinute(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleAMinute(t);
}

async function click(t: Backend, user: string, label: string) {
  return interact(t, user, buttonInHome(slack, user, label));
}

async function interact(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settleAMinute(t);
  return response;
}

function settleAMinute(t: Backend) {
  return settleUpTo(t, Date.now() + minute);
}

async function mondayPostJobs(t: Backend) {
  const jobs = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name, state }) => name.includes("mondayPost") && state.kind === "pending");
}

async function generationOf(t: Backend) {
  const settings = await t.run((ctx) => ctx.db.query("mondayPostSettings").unique());
  if (settings === null) throw new Error("the Monday post was never switched on");
  return settings.generation;
}

function isMondayPost(args: Record<string, unknown>) {
  return args.channel === announcementChannel && String(args.text).startsWith("🏆 Last week in kudos");
}

function mondayPosts() {
  return slack.messagesIn(announcementChannel).filter(({ text }) => text.startsWith("🏆 Last week in kudos")).map(({ text }) => text);
}

function mondayPostTimes() {
  return slack.timesOf("chat.postMessage", isMondayPost);
}

function mondayPostLinesOf(home: string[]) {
  const start = home.indexOf("section: *Monday post*");
  if (start === -1) return [];
  const end = home.indexOf("divider", start);
  return home.slice(start, end === -1 ? undefined : end);
}
