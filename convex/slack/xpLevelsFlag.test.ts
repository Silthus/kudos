import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, onInTheSandboxOnly, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { type BlockAction, blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import type { FlagDefinition } from "../../testing/fakePostHog";
import { standingOf } from "../progression/progression";
import { progressSettingsOf } from "../progression/settings";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const xpLevels = "xp-levels";

const coreHome = [
  "header: Your kudos",
  "section: You have *8* kudos left today. You get *10* more at midnight.",
  "divider",
  "section fields: *Given this week*\n*2* | *Received this week*\n*0* | *Given in total*\n*2* | *Received in total*\n*0*",
  "divider",
  "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
  "context: To add me to a channel, type `/hedgehug` there.",
];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the xp-levels flag hides the slice while it is off", () => {
  test.each<[string, () => Promise<Backend>]>([
    ["turned off in PostHog", () => workspaceDeciding("sandbox", offForEveryone(xpLevels))],
    ["not created in PostHog", () => workspaceDeciding("sandbox")],
    ["on in the sandbox only, read in production", () => workspaceDeciding("production", onInTheSandboxOnly(xpLevels))],
    ["unreadable because the flags key is missing", () => workspaceWithoutFlagsKey()],
  ])("%s: a level reached sends no DM and no public notice, a recipient's App Home isn't published, and App Home shows only the core loop", async (_, workspace) => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const lookUpsBeforeOpening = slack.callsTo("users.info").length;
    await openHome(t, "U_ALICE");

    expect(slack.callsTo("views.publish").filter(({ user_id }) => user_id === "U_BOB")).toEqual([]);
    expect(slack.callsTo("chat.postMessage").map(({ channel }) => channel).sort()).toEqual(["U_ALICE", "U_BOB"]);
    expect(slack.callsTo("users.info")).toHaveLength(lookUpsBeforeOpening);
    expect(publishedHome(slack, "U_ALICE")).toEqual(coreHome);
  });

  test("O35: XP is still recorded while the flag is off, so turning it on shows the level already earned", async () => {
    const t = await workspaceDeciding("sandbox", offForEveryone(xpLevels));
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    await flagsFromPostHog(t, postHog, onForEveryone(xpLevels));
    await openHome(t, "U_ALICE");

    expect(await standing(t, "U_ALICE")).toMatchObject({ level: 2 });
    expect(publishedHome(slack, "U_ALICE")).toContain("section fields: *Level*\n*2* | *XP to level 3*\n*80*");
  });

  test("O35: turning the flag off hides the level again and rewrites nothing earned", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone(xpLevels));
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const earned = await standing(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, offForEveryone(xpLevels));
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual(coreHome);
    expect(await standing(t, "U_ALICE")).toEqual(earned);
  });

  test("a public level notice Slack held back while the flag was on is not posted once it is off", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone(xpLevels));
    await setWorkspaceSettings(t, { announcementChannel: "C_NEWS" });
    slack.holdingBack("chat.postMessage", "C_NEWS", async () => {
      await flagsFromPostHog(t, postHog, offForEveryone(xpLevels));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C_NEWS")).toHaveLength(1);
    expect(slack.messagesIn("C_NEWS")).toEqual([]);
  });

  test("a level-up DM Slack held back while the flag was on is not sent once it is off", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone(xpLevels));
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await flagsFromPostHog(t, postHog, offForEveryone(xpLevels));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    expect(slack.messagesIn("U_ALICE").filter(({ text }) => String(text).startsWith("🎉 You reached level"))).toEqual([]);
  });

  test("a click on a button from an App Home published while the flag was on changes nothing once it is off", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone(xpLevels));
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Settings"));
    const turnOffDms = buttonInHome(slack, "U_ALICE", "Turn off DMs");

    await flagsFromPostHog(t, postHog, offForEveryone(xpLevels));
    const response = await click(t, "U_ALICE", turnOffDms);

    expect(response.status).toBe(200);
    expect(await dmSetting(t, "U_ALICE")).toBe(true);
    expect(publishedHome(slack, "U_ALICE")).toEqual(coreHome);
  });
});

describe("O36: exposure", () => {
  test("is sent once per member and value, from the mutations a member enters the slice through, a recipient's refreshed App Home included", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone(xpLevels));
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, offForEveryone(xpLevels));
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([
      [xpLevels, true, true],
      [xpLevels, true, true],
      [xpLevels, false, true],
    ]);
  });

  test("is sent for a member's first App Home opening, before the directory knows them", async () => {
    const t = await workspaceDeciding("sandbox", onForEveryone(xpLevels));

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toContain("actions: [Profile] | Settings");
    expect(exposures()).toEqual([[xpLevels, true, true]]);
  });
});

async function workspaceDeciding(environment: "sandbox" | "production", ...definitions: FlagDefinition[]) {
  postHog = postHogDeciding(environment);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  return flagsFromPostHog(await workspace(), postHog, ...definitions);
}

async function workspaceWithoutFlagsKey() {
  const t = await workspaceDeciding("sandbox", onForEveryone(xpLevels));
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  return t;
}

async function workspace() {
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

function exposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === xpLevels);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response, properties.locally_evaluated]);
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
  return response;
}

async function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}

async function dmSetting(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return (await t.run((ctx) => progressSettingsOf(ctx, member))).dms;
}
