import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus, slackError } from "../../testing/fakeSlack";
import { signedRequest } from "../../testing/signedSlack";
import { memberChanged, settle, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome, staleButtonOf } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const wednesday = new Date("2026-10-14T10:00:00Z");
const mondayAtNineInBerlin = Date.parse("2026-10-19T07:00:00Z");
const maintainer = "U_MAINTAINER";
const announcementChannel = "C_ANNOUNCE";
const owls = ["U_ANN", "U_BOB"];
const week = 7 * 24 * 60 * 60 * 1000;
const form = { contentType: "application/x-www-form-urlencoded" };
const everyFlag = ["workspace-settings", "monday-post", "xp-levels", "groups"];

const switchedOff = { on: false, timeZone: "Europe/Berlin", channelLink: "https://hedgehug.slack.com/archives/C_ANNOUNCE", cantPost: false, posts: "groups" };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: wednesday });
  aDeploymentForWorkspace();
  vi.stubEnv("KUDOS_EMOJI", "");
  vi.stubEnv("KUDOS_MAINTAINER", maintainer);
  postHog = new FakePostHog();
  slack = new FakeSlack().withMember(maintainer, { tz: "Europe/Berlin" }).withMember("U_ADMIN", { is_admin: true, tz: "America/New_York" });
  for (const user of owls) slack.withMember(user);
  slack.withUserGroup("S_OWL", { name: "Owls", users: owls });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the maintainer switches the weekly post on and off from Settings", { timeout: 60_000 }, () => {
  test("the maintainer's Settings show the weekly post switched off, with the announcement channel it posts in and their own time zone", async () => {
    const owner = await aWorkspaceWithGroups();

    expect(await owner.weeklyPost()).toEqual(switchedOff);
  });

  test("before Slack has told me the workspace's address, the channel has no link", async () => {
    const owner = await aWorkspaceWithGroups({ url: null });

    expect(await owner.weeklyPost()).toEqual({ ...switchedOff, channelLink: null });
  });

  test("a post an admin switched off in another time zone shows the maintainer's own zone, which switching on books", async () => {
    const owner = await aWorkspaceWithGroups();
    await t.run((ctx) => ctx.db.insert("mondayPostSettings", { workspace: "T1", on: false, timeZone: "America/New_York", generation: 2 }));

    expect(await owner.weeklyPost()).toEqual(switchedOff);
    await owner.switchWeeklyPost(true);
    expect(await mondayPostSettings()).toMatchObject({ on: true, timeZone: "Europe/Berlin", nextPostAt: mondayAtNineInBerlin });
  });

  test("switching on books the post for next Monday 9:00 in the maintainer's time zone, the read shows it on, and the post goes out then", async () => {
    const owner = await aWorkspaceWithGroups();

    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "set" });

    expect(await owner.weeklyPost()).toEqual({ ...switchedOff, on: true });
    expect(await mondayPostSettings()).toMatchObject({ on: true, timeZone: "Europe/Berlin", nextPostAt: mondayAtNineInBerlin });
    await giveKudos("U_ANN", "U_BOB");
    await settleUpTo(t, mondayAtNineInBerlin);
    expect(weeklyPostTimes()).toEqual([mondayAtNineInBerlin]);
  });

  test("switching off stops the booked post, and the read shows it off", async () => {
    const owner = await aWorkspaceWithGroups();
    await owner.switchWeeklyPost(true);

    expect(await owner.switchWeeklyPost(false)).toEqual({ kind: "set" });

    expect(await owner.weeklyPost()).toEqual(switchedOff);
    await giveKudos("U_ANN", "U_BOB");
    await settleUpTo(t, mondayAtNineInBerlin + 60_000);
    expect(weeklyPostTimes()).toEqual([]);
  });

  test("switching on what is already on answers on and books no second post", async () => {
    const owner = await aWorkspaceWithGroups();
    await owner.switchWeeklyPost(true);

    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "set" });

    expect(await weeklyPostJobs()).toHaveLength(1);
  });

  test("the command decides workspace-settings and monday-post with exposure for the maintainer, and the read decides them without", async () => {
    const owner = await aWorkspaceWithGroups();
    await owner.weeklyPost();
    expect(await exposuresOf("workspace-settings", "monday-post")).toEqual([]);

    await owner.switchWeeklyPost(true);

    expect(await exposuresOf("workspace-settings", "monday-post")).toEqual([
      { flag: "workspace-settings", member: owner.member, value: true },
      { flag: "monday-post", member: owner.member, value: true },
    ]);
  });
});

describe("the website switch exposes workspace-settings for the maintainer", { timeout: 60_000 }, () => {
  test("a maintainer who is also a workspace admin is exposed to workspace-settings by the website switch", async () => {
    vi.stubEnv("KUDOS_MAINTAINER", "U_ADMIN");
    await aWorkspaceWithGroups();
    const admin = await signedIn("U_ADMIN");

    await admin.switchWeeklyPost(true);

    expect(await exposuresOf("workspace-settings")).toEqual([{ flag: "workspace-settings", member: admin.member, value: true }]);
  });
});

describe("only an admin or the maintainer switches the Monday post", { timeout: 60_000 }, () => {
  test("the maintainer's switch shows in an admin's App Home, and the admin's Switch off there shows in the maintainer's Settings", async () => {
    const owner = await aWorkspaceWithGroups();
    await adminTabOpen("U_ADMIN");

    await owner.switchWeeklyPost(true);
    await settleUpTo(t, Date.now() + 60_000);

    expect(publishedHome(slack, "U_ADMIN")).toContain("section: Every Monday I post last week's top groups in <#C_ANNOUNCE>. [button: Switch off]");
    await clickInHome("U_ADMIN", "Switch off");
    expect(await owner.weeklyPost()).toEqual(switchedOff);
  });

  test("while monday-post is off for the maintainer, switching off what is already off is refused too", async () => {
    const owner = await aWorkspaceWithGroups({ flags: ["workspace-settings", "xp-levels", "groups"] });

    expect(await owner.switchWeeklyPost(false)).toEqual({ kind: "refused" });
  });

  test("once the announcement channel is gone, switching on a post that is still stored on is refused", async () => {
    const owner = await aWorkspaceWithGroups();
    await owner.switchWeeklyPost(true);
    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("workspaces").unique())!._id, { announcementChannel: undefined }));

    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "refused" });
  });

  test("once the announcement channel is gone, switching off a post that is still stored on is refused and writes nothing", async () => {
    const owner = await aWorkspaceWithGroups();
    await owner.switchWeeklyPost(true);
    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("workspaces").unique())!._id, { announcementChannel: undefined }));
    const stored = await mondayPostSettings();

    expect(await owner.switchWeeklyPost(false)).toEqual({ kind: "refused" });
    expect(await mondayPostSettings()).toEqual(stored);
  });

  test("a workspace admin who isn't the maintainer sees no weekly post in Settings, and their switch is refused and writes nothing", async () => {
    await aWorkspaceWithGroups();
    const admin = await signedIn("U_ADMIN");

    expect(await admin.weeklyPost()).toBeUndefined();
    expect(await admin.switchWeeklyPost(true)).toEqual({ kind: "refused" });
    expect(await mondayPostSettings()).toBeNull();
  });

  test("while workspace-settings is off for the maintainer, there is no weekly post in Settings, and the switch is refused and writes nothing", async () => {
    const owner = await aWorkspaceWithGroups({ flags: ["monday-post", "xp-levels", "groups"] });

    expect(await owner.weeklyPost()).toBeUndefined();
    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "refused" });
    expect(await mondayPostSettings()).toBeNull();
  });

  test("while monday-post is off for the maintainer, there is no weekly post in Settings, and the switch is refused and writes nothing", async () => {
    const owner = await aWorkspaceWithGroups({ flags: ["workspace-settings", "xp-levels", "groups"] });

    expect(await owner.weeklyPost()).toBeUndefined();
    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "refused" });
    expect(await mondayPostSettings()).toBeNull();
  });

  test("without an announcement channel there is no weekly post in Settings, and switching on is refused", async () => {
    const owner = await aWorkspaceWithGroups({ channel: null });

    expect(await owner.weeklyPost()).toBeUndefined();
    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "refused" });
    expect(await mondayPostSettings()).toBeNull();
  });

});

const withPicker = [...everyFlag, "weekly-post-channel"];
const pickedChannel = "C0PICKED1";
const pickedLink = `https://hedgehug.slack.com/archives/${pickedChannel}`;
const unpicked = { ...switchedOff, channelPick: { picked: null, check: null } };

describe("the maintainer picks the weekly post's channel", { timeout: 60_000 }, () => {
  test("while no channel is picked, the read offers the picker beside the announcement channel, and the post goes to the announcement channel", async () => {
    const owner = await aWorkspaceWithGroups({ flags: withPicker });

    expect(await owner.weeklyPost()).toEqual(unpicked);
    await owner.switchWeeklyPost(true);
    await giveKudos("U_ANN", "U_BOB");
    await settleUpTo(t, mondayAtNineInBerlin);
    expect(weeklyPostChannels()).toEqual([announcementChannel]);
  });

  test("a pasted link to a public channel is checked by joining it, then the read names it and links it, and the post goes there", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" });
    const owner = await aWorkspaceWithGroups({ flags: withPicker });

    expect(await owner.pickChannel(pickedLink)).toEqual({ kind: "checking" });
    expect(await owner.weeklyPost()).toEqual({ ...unpicked, channelPick: { picked: null, check: "checking" } });
    await settle(t);

    expect(slack.callsTo("conversations.join")).toEqual([{ channel: pickedChannel }]);
    expect(await owner.weeklyPost()).toEqual({ ...unpicked, channelLink: pickedLink, channelPick: { picked: "kudos-weekly", check: "picked" } });
    await owner.switchWeeklyPost(true);
    await giveKudos("U_ANN", "U_BOB");
    await settleUpTo(t, mondayAtNineInBerlin);
    expect(weeklyPostChannels()).toEqual([pickedChannel]);
  });

  test("an admin's App Home names the picked channel for the post, and the announcement channel stays the one for level-ups", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" });
    const owner = await aWorkspaceWithGroups({ flags: withPicker });
    await adminTabOpen("U_ADMIN");

    await owner.pickChannel(pickedLink);
    await settleUpTo(t, Date.now() + 60_000);

    expect(publishedHome(slack, "U_ADMIN")).toContain(`section: I can post last week's top groups in <#${pickedChannel}> every Monday at 9:00. [button: Switch on]`);
    expect(await t.run(async (ctx) => (await ctx.db.query("workspaces").unique())?.announcementChannel)).toBe(announcementChannel);
  });

  test.each([
    ["private", { name: "secret-plans", kind: "private" as const }],
    ["archived", { name: "old-news", kind: "archived" as const }],
    ["shared", { name: "partners", kind: "shared" as const }],
  ])("a %s channel is refused with why, nothing is picked, and the post stays in the announcement channel", async (check, channel) => {
    slack.withChannel(pickedChannel, channel);
    const owner = await aWorkspaceWithGroups({ flags: withPicker });

    await owner.pickChannel(pickedLink);
    await settle(t);

    expect(await owner.weeklyPost()).toEqual({ ...unpicked, channelPick: { picked: null, check } });
    await owner.switchWeeklyPost(true);
    await giveKudos("U_ANN", "U_BOB");
    await settleUpTo(t, mondayAtNineInBerlin);
    expect(weeklyPostChannels()).toEqual([announcementChannel]);
  });

  test("a channel Slack can't find for me reads not-found, and one Slack gave no answer about reads failed, both keeping the channel picked before", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" }).answering("conversations.join", (answerAsSlackWould) => answerAsSlackWould(), slackError("channel_not_found"), httpStatus(500));
    const owner = await aWorkspaceWithGroups({ flags: withPicker });
    await owner.pickChannel(pickedLink);
    await settle(t);

    await owner.pickChannel("https://hedgehug.slack.com/archives/C0GONE");
    await settle(t);
    expect(await owner.weeklyPost()).toMatchObject({ channelLink: pickedLink, channelPick: { picked: "kudos-weekly", check: "not-found" } });

    await owner.pickChannel("https://hedgehug.slack.com/archives/C0FLAKY");
    await settle(t);
    expect(await owner.weeklyPost()).toMatchObject({ channelLink: pickedLink, channelPick: { picked: "kudos-weekly", check: "failed" } });
  });

  test("of two picks in a row, the later one wins, even when the earlier one's check answers last", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" }).withChannel("C0SECOND", { name: "shout-outs" });
    const owner = await aWorkspaceWithGroups({ flags: withPicker });
    await owner.pickChannel(pickedLink);
    const earlierJoin = slack.holdNext("conversations.join");
    const earlierCheck = t.action(internal.slack.mondayPost.checkPickedChannel, { workspace: "T1", channel: pickedChannel, pick: 1 });
    await earlierJoin.reached;

    await owner.pickChannel("https://app.slack.com/client/T1/C0SECOND");
    await settle(t);
    expect(await owner.weeklyPost()).toMatchObject({ channelPick: { picked: "shout-outs", check: "picked" } });
    earlierJoin.release();
    await earlierCheck;

    expect(await owner.weeklyPost()).toMatchObject({ channelLink: "https://hedgehug.slack.com/archives/C0SECOND", channelPick: { picked: "shout-outs", check: "picked" } });
  });

  test("of two picks of the same channel, the later one's check wins even when the earlier one's fails first", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" }).answering("conversations.join", slackError("internal_error"));
    const owner = await aWorkspaceWithGroups({ flags: withPicker });

    await owner.pickChannel(pickedLink);
    await owner.pickChannel(pickedLink);
    await settle(t);

    expect(slack.callsTo("conversations.join")).toEqual([{ channel: pickedChannel }, { channel: pickedChannel }]);
    expect(await owner.weeklyPost()).toMatchObject({ channelLink: pickedLink, channelPick: { picked: "kudos-weekly", check: "picked" } });
  });

  test("when the post can't go to a picked channel, an admin's App Home sends them to the maintainer rather than to the announcement channel's picker", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" });
    await aWorkspaceWithGroups({ flags: withPicker });
    const owner = await signedIn(maintainer, { endsIn: week });
    await owner.pickChannel(pickedLink);
    await settle(t);
    await owner.switchWeeklyPost(true);
    await adminTabOpen("U_ADMIN");
    await giveKudos("U_ANN", "U_BOB");
    slack.answering("chat.postMessage", slackError("is_archived"));
    await settleUpTo(t, mondayAtNineInBerlin + 60_000);

    expect(publishedHome(slack, "U_ADMIN")).toContain(`section: I can't post in <#${pickedChannel}>. Ask HedgeHug's maintainer to pick another channel in the website's Settings.`);
  });

  test.each(["#kudos-weekly", "https://example.com/archives/C0PICKED1", "http://hedgehug.slack.com/archives/C0PICKED1", "https://hedgehug.slack.com/team/U_ANN", ""])("%j isn't a channel link: refused as such, and nothing is picked or asked of Slack", async (link) => {
    const owner = await aWorkspaceWithGroups({ flags: withPicker });

    expect(await owner.pickChannel(link)).toEqual({ kind: "refused", reason: "not-a-channel-link" });

    expect(await mondayPostSettings()).toBeNull();
    expect(slack.callsTo("conversations.join")).toEqual([]);
  });

  test("a channel ID pasted on its own is checked like its link", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" });
    const owner = await aWorkspaceWithGroups({ flags: withPicker });

    await owner.pickChannel(` ${pickedChannel} `);
    await settle(t);

    expect(await owner.weeklyPost()).toMatchObject({ channelPick: { picked: "kudos-weekly", check: "picked" } });
  });

  test("when I can't post in the picked channel, the read says so for it, and picking another channel clears it", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" }).withChannel("C0SECOND", { name: "shout-outs" });
    await aWorkspaceWithGroups({ flags: withPicker });
    const owner = await signedIn(maintainer, { endsIn: week });
    await owner.pickChannel(pickedLink);
    await settle(t);
    await owner.switchWeeklyPost(true);
    await giveKudos("U_ANN", "U_BOB");
    slack.answering("chat.postMessage", slackError("not_in_channel"));
    await settleUpTo(t, mondayAtNineInBerlin);

    expect(await owner.weeklyPost()).toMatchObject({ cantPost: true, channelPick: { picked: "kudos-weekly", check: "picked" } });
    await owner.pickChannel("https://hedgehug.slack.com/archives/C0SECOND");
    await settleUpTo(t, Date.now() + 60_000);
    expect(await owner.weeklyPost()).toMatchObject({ cantPost: false, channelPick: { picked: "shout-outs", check: "picked" } });
  });

  test("picking decides weekly-post-channel with exposure for the maintainer, and the read decides it without", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" });
    const owner = await aWorkspaceWithGroups({ flags: withPicker });
    await owner.weeklyPost();
    expect(await exposuresOf("weekly-post-channel")).toEqual([]);

    await owner.pickChannel(pickedLink);

    expect(await exposuresOf("weekly-post-channel")).toEqual([{ flag: "weekly-post-channel", member: owner.member, value: true }]);
  });
});

describe("only the maintainer picks the weekly post's channel, and only while weekly-post-channel is on", { timeout: 60_000 }, () => {
  test("a workspace admin who isn't the maintainer is refused, and nothing is written or asked of Slack", async () => {
    await aWorkspaceWithGroups({ flags: withPicker });
    const admin = await signedIn("U_ADMIN");
    const before = await everyTable();

    expect(await admin.pickChannel(pickedLink)).toEqual({ kind: "refused", reason: null });

    expect(await everyTable()).toEqual(before);
    expect(slack.callsTo("conversations.join")).toEqual([]);
  });

  test("a Slack click naming the pick, even from a maintainer who is a workspace admin, is no command at all: nothing is picked or asked of Slack", async () => {
    vi.stubEnv("KUDOS_MAINTAINER", "U_ADMIN");
    await aWorkspaceWithGroups({ flags: withPicker });

    await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ADMIN", staleButtonOf({ type: "pickMondayPostChannel", channel: pickedChannel })), form));
    await settleUpTo(t, Date.now() + 60_000);

    expect(await mondayPostSettings()).toBeNull();
    expect(slack.callsTo("conversations.join")).toEqual([]);
  });

  test("while workspace-settings is off for the maintainer, the pick is refused, and nothing is picked or asked of Slack", async () => {
    const owner = await aWorkspaceWithGroups({ flags: ["monday-post", "xp-levels", "groups", "weekly-post-channel"] });

    expect(await owner.pickChannel(pickedLink)).toEqual({ kind: "refused", reason: null });

    expect(await mondayPostSettings()).toBeNull();
    expect(slack.callsTo("conversations.join")).toEqual([]);
  });

  test("while weekly-post-channel is off, the read has no picker, the pick is refused storing nothing, and a channel picked while it was on gets no post: the announcement channel does", async () => {
    slack.withChannel(pickedChannel, { name: "kudos-weekly" });
    const owner = await aWorkspaceWithGroups({ flags: withPicker });
    await owner.pickChannel(pickedLink);
    await settle(t);
    await switchWebsite(t, postHog, true, ...everyFlag);
    const stored = await mondayPostSettings();

    expect(await owner.weeklyPost()).toEqual(switchedOff);
    expect(await owner.pickChannel("https://hedgehug.slack.com/archives/C0SECOND")).toEqual({ kind: "refused", reason: null });
    expect(await mondayPostSettings()).toEqual(stored);
    expect(slack.callsTo("conversations.join")).toEqual([{ channel: pickedChannel }]);
    await owner.switchWeeklyPost(true);
    await giveKudos("U_ANN", "U_BOB");
    await settleUpTo(t, mondayAtNineInBerlin);
    expect(weeklyPostChannels()).toEqual([announcementChannel]);
  });

  test("without an announcement channel there is no weekly post to pick a channel for, and the pick is refused", async () => {
    const owner = await aWorkspaceWithGroups({ flags: withPicker, channel: null });

    expect(await owner.pickChannel(pickedLink)).toEqual({ kind: "refused", reason: null });
    expect(await mondayPostSettings()).toBeNull();
  });
});

describe("website commands pass one guard", { timeout: 60_000 }, () => {
  test("WS61: with the website flag off setWeeklyPost answers closed, without a session signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    const owner = await aWorkspaceWithGroups();
    await switchWebsite(t, postHog, false, ...everyFlag);
    const closed = await everyTable();
    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(closed);
    await switchWebsite(t, postHog, true, ...everyFlag);
    const open = await everyTable();
    expect(await t.mutation(api.website.commands.setWeeklyPost, { on: true })).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(open);
    await memberChanged(t, "user_change", { id: maintainer, team_id: "T1", deleted: true });
    await settleUpTo(t, Date.now() + 60_000);
    const left = await everyTable();
    expect(await owner.switchWeeklyPost(true)).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: with the website flag off pickWeeklyPostChannel answers closed, without a session signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    const owner = await aWorkspaceWithGroups({ flags: withPicker });
    await switchWebsite(t, postHog, false, ...withPicker);
    const closed = await everyTable();
    expect(await owner.pickChannel(pickedLink)).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(closed);
    await switchWebsite(t, postHog, true, ...withPicker);
    const open = await everyTable();
    expect(await t.mutation(api.website.commands.pickWeeklyPostChannel, { link: pickedLink })).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(open);
    await memberChanged(t, "user_change", { id: maintainer, team_id: "T1", deleted: true });
    await settleUpTo(t, Date.now() + 60_000);
    const left = await everyTable();
    expect(await owner.pickChannel(pickedLink)).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: link is pickWeeklyPostChannel's only argument, so no call names a member or a workspace", async () => {
    const owner = await aWorkspaceWithGroups({ flags: withPicker });
    const before = await everyTable();

    await expect(owner.pickChannel(pickedLink, { member: owner.member })).rejects.toThrow(/member/);
    await expect(owner.pickChannel(pickedLink, { workspace: "T2" })).rejects.toThrow(/workspace/);
    expect(await everyTable()).toEqual(before);
  });

  test("WS61: on is setWeeklyPost's only argument, so no call names a member", async () => {
    const owner = await aWorkspaceWithGroups();
    const before = await everyTable();

    await expect(owner.switchWeeklyPost(true, { member: owner.member })).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

type Setup = { channel?: string | null; url?: string | null; flags?: string[] };

async function aWorkspaceWithGroups({ channel = announcementChannel, url = "https://hedgehug.slack.com/", flags = everyFlag }: Setup = {}) {
  await switchWebsite(t, postHog, true, ...flags);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, ...(channel !== null && { announcementChannel: channel }), ...(url !== null && { url }) }));
  await memberChanged(t, "team_join", { id: maintainer, tz: "Europe/Berlin", real_name: "Mae Maintainer" });
  await memberChanged(t, "team_join", { id: "U_ADMIN", is_admin: true, tz: "America/New_York", real_name: "Ada Admin" });
  for (const user of owls) await memberChanged(t, "team_join", { id: user, real_name: `${user} Example` });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  return signedIn(maintainer);
}

async function signedIn(user: string, session: { endsIn?: number } = {}) {
  const { asSignedIn } = await aSignedInSession(t, { user, name: user }, session);
  const member = await t.run(async (ctx) => (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id);
  return {
    member,
    weeklyPost: async () => ((await asSignedIn.query(api.website.settings.getSettings, {})) as { weeklyPost?: unknown }).weeklyPost,
    switchWeeklyPost: (on: boolean, extra = {}) => asSignedIn.mutation(api.website.commands.setWeeklyPost, { on, ...extra } as { on: boolean }),
    pickChannel: (link: string, extra = {}) => asSignedIn.mutation(api.website.commands.pickWeeklyPostChannel, { link, ...extra } as { link: string }),
  };
}

async function giveKudos(giver: string, recipient: string) {
  sentMessages += 1;
  await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention(recipient), emoji("taco"))], { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleUpTo(t, Date.now() + 60_000);
}

async function adminTabOpen(user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleUpTo(t, Date.now() + 60_000);
  await clickInHome(user, "Admin");
}

async function clickInHome(user: string, label: string) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonInHome(slack, user, label)), form));
  await settleUpTo(t, Date.now() + 60_000);
}

function mondayPostSettings() {
  return t.run((ctx) => ctx.db.query("mondayPostSettings").unique());
}

async function weeklyPostJobs() {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name, state }) => name.includes("mondayPost") && state.kind === "pending");
}

function weeklyPostTimes() {
  return slack.timesOf("chat.postMessage", (args) => args.channel === announcementChannel && String(args.text).startsWith("🏆 Last week in kudos"));
}

function weeklyPostChannels() {
  return slack.callsTo("chat.postMessage").filter((args) => String(args.text).startsWith("🏆 Last week in kudos")).map((args) => args.channel);
}

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

function exposuresOf(...flags: string[]) {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flags.includes(flag)).map(({ flag, member, value }) => ({ flag, member, value })));
}
