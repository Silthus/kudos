import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { FakeSlack, httpStatus } from "../../testing/fakeSlack";
import { buttonInHome, channelPickerInHome, publishedHome, publishedViews } from "../../testing/homeView";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import { appHomeOpened, blockActions, emoji, mention, messageEvent, section, type BlockAction } from "../../testing/slackMessages";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  flagsOnForEveryone(slack.fetch, "xp-levels");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P67: the Profile tab", () => {
  test("shows the member's level and the XP to the next level beside the core loop's contents, and no skill points below level 5", async () => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "header: Your kudos",
      "actions: [Profile] | Settings",
      "section: You have *8* kudos left today. You get *10* more at midnight.",
      "divider",
      "section fields: *Level*\n*2* | *XP to level 3*\n*80*",
      "divider",
      "section fields: *Given this week*\n*2* | *Received this week*\n*0* | *Given in total*\n*2* | *Received in total*\n*0*",
      "divider",
      "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
      "context: To add me to a channel, type `/hedgehug` there.",
    ]);
  });

  test.each([
    ["level 4 still leaves skill points out", 300, ["section fields: *Level*\n*4* | *XP to level 5*\n*300*"]],
    ["level 5 shows the first skill point, saved for the skill tree", 600, ["section fields: *Level*\n*5* | *XP to level 6*\n*400*", "section: You have *1 skill point* saved for the skill tree."]],
    ["level 7 shows every saved skill point", 1500, ["section fields: *Level*\n*7* | *XP to level 8*\n*600*", "section: You have *3 skill points* saved for the skill tree."]],
  ])("P4: %s", async (_, xp, progress) => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await withXp(t, "U_ALICE", xp);

    await openHome(t, "U_ALICE");

    expect(progressionOf(publishedHome(slack, "U_ALICE"))).toEqual(progress);
  });
});

describe("P67: the Settings tab", () => {
  test("clicking Settings is acknowledged at once and republishes App Home on the Settings tab with the member's progression settings", async () => {
    const t = await workspaceWithAllowance(10);
    await openHome(t, "U_ALICE");

    const response = await click(t, "U_ALICE", "Settings");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "header: Your kudos",
      "actions: Profile | [Settings]",
      "section: I celebrate your level ups in public. [button: Mute notices]",
      "section: I send you a DM when you reach a level. [button: Turn off DMs]",
    ]);
  });
});

describe("P63 P65: a setting takes effect on the next notice or DM, and repeating the same click changes nothing", () => {
  test("muted notices: the next level up posts no public notice, the member still gets their DM, and Settings offers to unmute", async () => {
    const t = await settingsOpen("U_ALICE");
    const mute = buttonInHome(slack, "U_ALICE", "Mute notices");

    await interact(t, "U_ALICE", mute);
    await interact(t, "U_ALICE", mute);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(slack.messagesIn("C1")).toEqual([]);
    expect(dmsTo("U_ALICE")).toEqual(["🎉 You reached level 2!\nLevel 3 is 80 XP away."]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: I don't post public notices about you. [button: Unmute notices]");
  });

  test("DMs turned off: the next level up sends no DM, the public notice still goes out, and Settings offers to turn them on", async () => {
    const t = await settingsOpen("U_ALICE");
    const turnOff = buttonInHome(slack, "U_ALICE", "Turn off DMs");

    await interact(t, "U_ALICE", turnOff);
    await interact(t, "U_ALICE", turnOff);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(dmsTo("U_ALICE")).toEqual([]);
    expect(slack.messagesIn("C1").map(({ text }) => text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: I don't send you DMs. [button: Turn on DMs]");
  });

  test("a click Slack sends again after a later click changes nothing", async () => {
    const t = await settingsOpen("U_ALICE");
    const mute = blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Mute notices"));
    await send(t, mute);
    await click(t, "U_ALICE", "Unmute notices");

    const replayed = await send(t, mute);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(replayed.status).toBe(200);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: I celebrate your level ups in public. [button: Mute notices]");
    expect(slack.messagesIn("C1").map(({ text }) => text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

describe("P65: levels are public, so a Hide level click from an App Home published before the switch was removed changes nothing", () => {
  test.each([
    ["Hide level", { hideLevel: true }],
    ["Hide achievements", { hideAchievements: true }],
  ])("%s is acknowledged, Settings still shows mute and DMs only, and the next level notice posts", async (_, removedSetting) => {
    const t = await settingsOpen("U_ALICE");

    const response = await interact(t, "U_ALICE", { type: "button", action_id: "x", value: JSON.stringify({ type: "setProgressSettings", ...removedSetting }) });
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(response.status).toBe(200);
    expect(publishedHome(slack, "U_ALICE").slice(2)).toEqual([
      "section: I celebrate your level ups in public. [button: Mute notices]",
      "section: I send you a DM when you reach a level. [button: Turn off DMs]",
    ]);
    expect(slack.messagesIn("C1").map(({ text }) => text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

describe("P68: App Home is republished after a change, the latest version wins, and a failed publish is retried", () => {
  test("a level up republishes the member's App Home with the new level, without them opening it again", async () => {
    const t = await workspaceWithAllowance(10);
    await openHome(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(publishedHome(slack, "U_ALICE")).toContain("section fields: *Level*\n*2* | *XP to level 3*\n*80*");
  });

  test("a republish that fails is tried again until the new level shows", async () => {
    const t = await workspaceWithAllowance(10);
    await openHome(t, "U_ALICE");
    slack.answering("views.publish", httpStatus(500));

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(publishedViews(slack, "U_ALICE")).toHaveLength(3);
    expect(publishedHome(slack, "U_ALICE")).toContain("section fields: *Level*\n*2* | *XP to level 3*\n*80*");
  });

  test("a publish that lands after a newer change is followed by the latest App Home", async () => {
    const t = await settingsOpen("U_ALICE");
    const stale = slack.holdNext("views.publish");
    const stalePublish = t.action(internal.slack.appHome.publishHome, { workspace: "T1", user: "U_ALICE" });
    await stale.reached;

    await click(t, "U_ALICE", "Mute notices");
    stale.release();
    await stalePublish;
    await settle(t);

    expect(publishedHome(slack, "U_ALICE")).toContain("section: I don't post public notices about you. [button: Unmute notices]");
  });
});

describe("P69: the Admin tab", () => {
  test.each([
    ["a workspace admin", { is_admin: true }],
    ["a workspace owner", { is_owner: true }],
  ])("%s sees the Admin tab with the announcement channel picker", async (_, role) => {
    const t = await workspaceWithAllowance(10);
    slack.withMember("U_ALICE", role);
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Admin");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "header: Your kudos",
      "actions: Profile | Settings | [Admin]",
      "section: I celebrate level ups in a thread under each kudos message. Pick a channel to post them there instead. [channels_select: none]",
      "divider",
      "context: Only workspace admins and owners see this tab.",
    ]);
  });

  test("a member who isn't an admin sees no Admin tab", async () => {
    const t = await workspaceWithAllowance(10);

    await openHome(t, "U_BOB");

    expect(publishedHome(slack, "U_BOB")[1]).toBe("actions: [Profile] | Settings");
  });

  test("a member made an admin in Slack sees the Admin tab the next time they open App Home", async () => {
    const t = await workspaceWithAllowance(10);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    slack.withMember("U_ALICE", { is_admin: true });

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")[1]).toBe("actions: [Profile] | Settings | Admin");
  });

  test("picking a channel sends the next level-up notice there and shows it picked with a way back to threads", async () => {
    const t = await adminTabOpen("U_ALICE");

    await interact(t, "U_ALICE", channelPickerInHome(slack, "U_ALICE", "C_NEWS"));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(slack.messagesIn("C_NEWS").map(({ text }) => text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
    expect(slack.messagesIn("C1")).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "header: Your kudos",
      "actions: Profile | Settings | [Admin]",
      "section: I celebrate level ups in this channel. [channels_select: C_NEWS]",
      "section: Or celebrate them in a thread under each kudos message again. [button: Use threads]",
      "divider",
      "context: Only workspace admins and owners see this tab.",
    ]);
  });

  test("going back to threads sends the next level-up notice under its kudos message again", async () => {
    const t = await adminTabOpen("U_ALICE");
    await interact(t, "U_ALICE", channelPickerInHome(slack, "U_ALICE", "C_NEWS"));

    await click(t, "U_ALICE", "Use threads");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(slack.messagesIn("C_NEWS")).toEqual([]);
    expect(slack.messagesIn("C1").map(({ text }) => text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });

  test("an admin removed in Slack while an Admin tab publish is in flight is left without the Admin tab", async () => {
    const t = await adminTabOpen("U_ALICE");
    const stale = slack.holdNext("views.publish");
    const stalePublish = t.action(internal.slack.appHome.publishHome, { workspace: "T1", user: "U_ALICE" });
    await stale.reached;

    await memberChanged(t, "user_change", { id: "U_ALICE" });
    await settle(t);
    stale.release();
    await stalePublish;
    await settle(t);

    expect(publishedHome(slack, "U_ALICE")[1]).toBe("actions: [Profile] | Settings");
  });
});

describe("P69: only workspace admins and owners set the announcement channel", () => {
  test("a member who isn't an admin can't set the announcement channel, even with a crafted click", async () => {
    const t = await adminTabOpen("U_ALICE");
    await openHome(t, "U_BOB");

    await interact(t, "U_BOB", { type: "channels_select", action_id: "setAnnouncementChannel", selected_channel: "C_NEWS" });
    await interact(t, "U_BOB", { type: "button", action_id: "x", value: JSON.stringify({ type: "setAnnouncementChannel", channel: "C_NEWS" }) });
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(slack.messagesIn("C_NEWS")).toEqual([]);
    expect(slack.messagesIn("C1").map(({ text }) => text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });

  test("an admin removed in Slack can no longer set the announcement channel", async () => {
    const t = await adminTabOpen("U_ALICE");
    const picker = channelPickerInHome(slack, "U_ALICE", "C_NEWS");
    await memberChanged(t, "user_change", { id: "U_ALICE" });

    await interact(t, "U_ALICE", picker);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(slack.messagesIn("C_NEWS")).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")[1]).toBe("actions: [Profile] | Settings");
  });
});

describe("P68: App Home follows a member leaving and coming back", () => {
  test("a member deactivated and then reactivated in Slack sees the members-only line, then their App Home again", async () => {
    const t = await workspaceWithAllowance(10);
    await openHome(t, "U_BOB");

    await memberChanged(t, "user_change", { id: "U_BOB", deleted: true });
    await settle(t);
    const whileDeactivated = publishedHome(slack, "U_BOB");
    await memberChanged(t, "user_change", { id: "U_BOB" });
    await settle(t);

    expect(whileDeactivated).toEqual(["header: HedgeHug", "section: HedgeHug is for active members of this workspace."]);
    expect(publishedHome(slack, "U_BOB")[0]).toBe("header: Your kudos");
  });

  test("a members-only publish that lands after the member came back is followed by their App Home", async () => {
    const t = await workspaceWithAllowance(10);
    await openHome(t, "U_BOB");
    await memberChanged(t, "user_change", { id: "U_BOB", deleted: true });
    await settle(t);
    const stale = slack.holdNext("views.publish");
    const stalePublish = t.action(internal.slack.appHome.publishHome, { workspace: "T1", user: "U_BOB" });
    await stale.reached;

    await memberChanged(t, "user_change", { id: "U_BOB" });
    await settle(t);
    stale.release();
    await stalePublish;
    await settle(t);

    expect(publishedHome(slack, "U_BOB")[0]).toBe("header: Your kudos");
  });
});

describe("R42: an interaction Slack did not sign gets 401 and does nothing", () => {
  test.each([
    ["signed with another secret", (body: string) => signedRequest(body, { ...form, secret: "someone-elses-secret" })],
    ["unsigned", async (body: string) => ({ method: "POST", headers: { "content-type": form.contentType }, body })],
    ["with a body changed after signing", async (body: string) => ({ ...(await signedRequest(body, form)), body: body.replace("muteNotices", "dms") })],
    ["signed more than 5 minutes ago", (body: string) => signedRequest(body, { ...form, signedAt: new Date(now.getTime() - 6 * 60 * 1000) })],
  ])("%s", async (_, request) => {
    const t = await settingsOpen("U_ALICE");
    const forged = blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Mute notices"));
    const callsBefore = slack.calls.length;

    const response = await t.fetch("/slack/interactivity", await request(forged));
    await settle(t);

    expect(response.status).toBe(401);
    expect(slack.calls.slice(callsBefore)).toEqual([]);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    expect(slack.messagesIn("C1").map(({ text }) => text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

async function settingsOpen(user: string) {
  const t = await workspaceWithAllowance(10);
  await giveKudos(t, user, "U_BOB", 1);
  await openHome(t, user);
  await click(t, user, "Settings");
  return t;
}

async function withXp(t: Backend, user: string, xp: number) {
  await t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function adminTabOpen(user: string) {
  const t = await workspaceWithAllowance(10);
  slack.withMember(user, { is_admin: true });
  await giveKudos(t, user, "U_BOB", 1);
  await openHome(t, user);
  await click(t, user, "Admin");
  return t;
}

function progressionOf(home: string[]) {
  const start = home.indexOf("divider") + 1;
  return home.slice(start, home.indexOf("divider", start));
}

function dmsTo(user: string) {
  return slack.callsTo("chat.postMessage").filter(({ channel }) => channel === `D_${user}`).map(({ text }) => text);
}

async function workspaceWithAllowance(baseAllowance: number) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance }));
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  const response = await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
  return response;
}

async function click(t: Backend, user: string, label: string) {
  return interact(t, user, buttonInHome(slack, user, label));
}

async function interact(t: Backend, user: string, action: BlockAction) {
  return send(t, blockActions(user, action));
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}
