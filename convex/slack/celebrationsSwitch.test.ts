import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, optionPickedInHome, publishedHome, publishedHomeBlocks, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const now = new Date("2026-10-22T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const celebrationsSwitch = "celebrations-switch";
const levelUpPost = "🎉 <@U_ALICE> reached level 2.";
const switchedOn = "section: I celebrate teammates' level ups in the announcement channel. [button: Switch off]";
const switchedOff = "section: I don't celebrate anyone's level ups in public. Each teammate still hears about their own. [button: Switch on]";
const celebrationsRow = "section: *Public celebrations* — Your level ups in the announcement channel. [select: In the announcement channel]";
const celebrationsRowOff = "section: *Public celebrations* · Off — Your level ups in the announcement channel. [select: None]";
const muteNotices = "section: I celebrate your level ups in public. [button: Mute notices]";
const turnOffDms = "section: I send you a DM when you reach a level. [button: Turn off DMs]";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_ADMIN", { is_admin: true });
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public celebrations stop while the workspace switches them off", { timeout: 60_000 }, () => {
  test("the switch shows on until an admin switches it, and Switch off and Switch on flip it", async () => {
    const t = await workspaceWith([celebrationsSwitch, "xp-levels"]);
    await adminTabOpen(t, "U_ADMIN");
    const shownOn = publishedHome(slack, "U_ADMIN");

    await click(t, "U_ADMIN", "Switch off");
    const shownOff = publishedHome(slack, "U_ADMIN");
    await click(t, "U_ADMIN", "Switch on");

    expect(shownOn).toEqual(expect.arrayContaining(["section: *Public celebrations*", switchedOn]));
    expect(shownOff).toEqual(expect.arrayContaining(["section: *Public celebrations*", switchedOff]));
    expect(publishedHome(slack, "U_ADMIN")).toContain(switchedOn);
  });

  test("a member who isn't an admin can't switch it off with a forged command", async () => {
    const t = await workspaceWith([celebrationsSwitch, "xp-levels"]);
    await giveKudos(t, "U_BOB", "U_ALICE", 1);

    await command(t, "U_BOB", { type: "setPublicCelebrations", on: false });
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(await storedSwitches(t)).toEqual([]);
    expect(postsIn("C_NEWS")).toEqual([expect.stringContaining(levelUpPost)]);
  });

  test("with celebrations-switch off the Admin tab has no switch, a forged command writes nothing, and level ups are celebrated as today", async () => {
    const t = await workspaceWith(["xp-levels"]);
    await adminTabOpen(t, "U_ADMIN");

    await command(t, "U_ADMIN", { type: "setPublicCelebrations", on: false });
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(publishedHome(slack, "U_ADMIN")).not.toContain("section: *Public celebrations*");
    expect(await storedSwitches(t)).toEqual([]);
    expect(postsIn("C_NEWS")).toEqual([levelUpPost]);
  });

  test("with no announcement channel picked, the Admin tab offers no switch, since nothing is celebrated in public", async () => {
    const t = await workspaceWith([celebrationsSwitch, "xp-levels"], { announcementChannel: null });

    await adminTabOpen(t, "U_ADMIN");

    expect(publishedHome(slack, "U_ADMIN")).not.toContain("section: *Public celebrations*");
  });

  test("a level up through a kudos posts nothing in the announcement channel, and the level-up DM still arrives", async () => {
    const t = await workspaceWith([celebrationsSwitch, "xp-levels"]);
    await adminTabOpen(t, "U_ADMIN");

    await click(t, "U_ADMIN", "Switch off");
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(postsIn("C_NEWS")).toEqual([]);
    expect(levelUpDmsTo("U_ALICE")).toEqual([expect.stringContaining("🎉 You reached level 2!")]);
  });

  test("switched on again, the next level up is celebrated again", async () => {
    const t = await workspaceWith([celebrationsSwitch, "xp-levels"]);
    await adminTabOpen(t, "U_ADMIN");
    await click(t, "U_ADMIN", "Switch off");

    await click(t, "U_ADMIN", "Switch on");
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(postsIn("C_NEWS")).toEqual([levelUpPost]);
  });

  test("a celebration written before the switch-off and taken by Slack after it is not posted", async () => {
    const t = await workspaceWith([celebrationsSwitch, "xp-levels"]);
    await adminTabOpen(t, "U_ADMIN");
    const switchOff = buttonInHome(slack, "U_ADMIN", "Switch off");
    slack.holdingBack("chat.postMessage", "C_NEWS", async () => {
      await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ADMIN", switchOff), form));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(postsIn("C_NEWS")).toEqual([]);
  });

  test("the Settings tab lists no Public celebrations row while it is off, and a member's own choice shows again once it is on", async () => {
    const t = await settingsOpen([celebrationsSwitch, "message-settings", "xp-levels"]);
    await turn(t, "U_ALICE", "Public celebrations");
    await adminTabOpen(t, "U_ADMIN");

    await click(t, "U_ADMIN", "Switch off");
    await openSettings(t, "U_ALICE");
    const shownOff = publishedHome(slack, "U_ALICE");
    await click(t, "U_ADMIN", "Switch on");
    await openSettings(t, "U_ALICE");

    expect(shownOff.filter((line) => line.includes("*Public celebrations*"))).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")).toContain(celebrationsRowOff);
  });

  test("a stale Public celebrations pick from a tab published while it was on writes nothing", async () => {
    const t = await settingsOpen([celebrationsSwitch, "message-settings", "xp-levels"]);
    const stalePick = optionPickedInHome(slack, "U_ALICE", "Public celebrations", "None");
    await adminTabOpen(t, "U_ADMIN");
    await click(t, "U_ADMIN", "Switch off");

    await interact(t, "U_ALICE", stalePick);
    await click(t, "U_ADMIN", "Switch on");
    await openSettings(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain(celebrationsRow);
  });

  test("without message settings, Mute notices is gone while it is off and Turn off DMs stays, and a stale Mute notices writes nothing", async () => {
    const t = await settingsOpen([celebrationsSwitch, "xp-levels"]);
    const staleMute = buttonInHome(slack, "U_ALICE", "Mute notices");
    await adminTabOpen(t, "U_ADMIN");

    await click(t, "U_ADMIN", "Switch off");
    await openSettings(t, "U_ALICE");
    const shownOff = publishedHome(slack, "U_ALICE");
    await interact(t, "U_ALICE", staleMute);
    await click(t, "U_ADMIN", "Switch on");
    await openSettings(t, "U_ALICE");

    expect(shownOff).toContain(turnOffDms);
    expect(shownOff.filter((line) => line.includes("notices"))).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")).toContain(muteNotices);
  });
});

async function workspaceWith(flags: string[], { announcementChannel = "C_NEWS" }: { announcementChannel?: string | null } = {}) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags.map(onForEveryone));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, ...(announcementChannel !== null && { announcementChannel }) }));
  return t;
}

async function settingsOpen(flags: string[]) {
  const t = await workspaceWith(flags);
  await giveKudos(t, "U_BOB", "U_ALICE", 1);
  await openSettings(t, "U_ALICE");
  return t;
}

async function openSettings(t: Backend, user: string) {
  await openHome(t, user);
  await click(t, user, "Settings");
}

async function adminTabOpen(t: Backend, user: string) {
  await openHome(t, user);
  await click(t, user, "Admin");
}

async function storedSwitches(t: Backend) {
  return t.run((ctx) => ctx.db.query("celebrationsSwitches").collect());
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  await post(t, giver, [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))]);
}

async function post(t: Backend, giver: string, blocks: ReturnType<typeof section>[]) {
  sentMessages += 1;
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  return interact(t, user, buttonInHome(slack, user, label));
}

async function turn(t: Backend, user: string, label: string) {
  const picker = publishedHomeBlocks(slack, user).find((block) => block.text?.text.startsWith(`*${label}*`))?.accessory;
  expect(picker, `the ${label} row in ${user}'s App Home`).toBeDefined();
  const turnedOff = picker!.initial_option?.text.text === "None";
  return interact(t, user, optionPickedInHome(slack, user, label, turnedOff ? picker!.options![0]!.text.text : "None"));
}

async function command(t: Backend, user: string, value: Record<string, unknown>) {
  const json = JSON.stringify(value);
  return interact(t, user, { type: "button", action_id: json, value: json });
}

async function interact(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
  return response;
}

function levelUpDmsTo(user: string) {
  return slack
    .messagesIn(user)
    .map(({ text }) => String(text))
    .filter((text) => text.startsWith("🎉 You reached level"));
}

function postsIn(channel: string) {
  return slack.messagesIn(channel).map(({ text }) => String(text));
}
