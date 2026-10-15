import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { offForEveryone, onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import {
  blockActions,
  buttonIn,
  buttonInHome,
  optionNamed,
  optionsOf,
  publishedHome,
  publishedHomeBlocks,
  readBlocks,
  selectIn,
  staleButtonOf,
  type Block,
  type BlockAction,
  type ClickedMessage,
} from "../../testing/slackInteractions";
import { settleInTimeOrder, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section, userGroupEvent } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import { primaryGroupOf, type GroupId } from "../groups/groups";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const welcomeLine = "Welcome to HedgeHug, where we thank each other for the help that usually goes unnoticed.";
const sayWhy = "Say why you're thanking them: it means more.";
const greetingOf = {
  U_ANN: ["🎉 *Your first kudos just landed with <@U_BOB>!*", welcomeLine, `👉 *Next step:* thank two more teammates this week. ${sayWhy}`],
  U_BOB: ["🎉 *<@U_ANN> just thanked you with a kudos!*", welcomeLine, `👉 *Your first step:* thank someone who helped you lately. Mention them and add :taco: to your message in any channel I'm in. ${sayWhy}`],
  U_DAN: ["🎉 *<@U_ANN> just thanked you with a kudos!*", welcomeLine, `👉 *Your first step:* thank someone who helped you lately. Mention them and add :taco: to your message in any channel I'm in. ${sayWhy}`],
};
type Welcomed = keyof typeof greetingOf;
const allowance = "You have 3 kudos a day, and they refill at midnight your time.";
const openAppHome = "<slack://app?team=T1&id=A_KUDOS&tab=home|Open App Home>";
const pickQuestion = "Which group do you count for on the leaderboard?";

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ANN").withMember("U_BOB").withMember("U_DAN");
  slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_ANN", "U_BOB", "U_CAROL"] }).withUserGroup("S_ZEBRA", { name: "Zebras", users: ["U_ANN"] });
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GB19: the welcome message's group block", () => {
  test("a new member in two groups gets the dropdown preselected with their primary group, and Save stores the pick and says so in place", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"));

    await giveKudos(t, "U_ANN", "U_BOB");

    expect(readBlocks(welcomeTo("U_ANN"))).toEqual(welcomeBlocksOf("U_ANN", `section: ${pickQuestion}`, "actions: [select: Zebras of Gardeners, Zebras] | Save"));
    expect(welcomeTextTo("U_ANN")).toBe(welcomeTextOf("U_ANN", pickQuestion));

    await saveInWelcome(t, "U_ANN", "Gardeners");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Gardeners");
    expect(welcomeUpdatesTo("U_ANN")).toEqual([welcomeBlocksOf("U_ANN", "section: Saved. You count for Gardeners on the leaderboard. You can change it in App Home.")]);
  });

  test("a member in one group reads which group they count for, with nothing to pick", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"));

    await giveKudos(t, "U_ANN", "U_BOB");

    expect(readBlocks(welcomeTo("U_BOB"))).toEqual(welcomeBlocksOf("U_BOB", "section: You count for Gardeners on the leaderboard."));
  });

  test("GB34: a group named with &, < and > reads as written in the welcome message", async () => {
    slack.withUserGroup("S_GARDEN", { name: "R&D <core>", users: ["U_ANN", "U_BOB", "U_CAROL"] });
    const t = await workspaceWithGroups(onForEveryone("groups"));

    await giveKudos(t, "U_ANN", "U_BOB");

    expect(readBlocks(welcomeTo("U_BOB"))).toContain("section: You count for R&amp;D &lt;core&gt; on the leaderboard.");
  });

  test("a member in no group gets the welcome message as before", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"));

    await giveKudos(t, "U_ANN", "U_DAN");

    expect(readBlocks(welcomeTo("U_DAN"))).toEqual(welcomeBlocksOf("U_DAN"));
    expect(welcomeTextTo("U_DAN")).toBe(welcomeTextOf("U_DAN"));
  });

  test("saving a group the member left meanwhile stores nothing and asks for another one", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"));
    await giveKudos(t, "U_ANN", "U_BOB");
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_BOB", "U_CAROL"] });
    await userGroupChanged(t, "S_GARDEN");

    await saveInWelcome(t, "U_ANN", "Gardeners");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(welcomeUpdatesTo("U_ANN")).toEqual([welcomeBlocksOf("U_ANN", "section: Gardeners isn't one of your groups anymore. Pick another one.\nYou count for Zebras on the leaderboard.")]);
  });

  test("a pick reconciles the member first, so a membership the copy dropped before any page reached them is refused", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"));
    await giveKudos(t, "U_ANN", "U_BOB");
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("userGroupMembers")
        .withIndex("by_group", (q) => q.eq("workspace", "T1").eq("group", "S_GARDEN").eq("user", "U_ANN"))
        .unique();
      await ctx.db.delete(membership!._id);
    });

    await saveInWelcome(t, "U_ANN", "Gardeners");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(welcomeUpdatesTo("U_ANN")[0]).toContain("section: Gardeners isn't one of your groups anymore. Pick another one.\nYou count for Zebras on the leaderboard.");
    expect(await causesOf(t, "U_ANN")).not.toContain("picked");
    expect(picksSent()).toEqual([]);
  });

  test("saving the primary group again keeps it and says so", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"));
    await giveKudos(t, "U_ANN", "U_BOB");

    await saveInWelcome(t, "U_ANN", "Zebras");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(welcomeUpdatesTo("U_ANN")[0]).toContain("section: Saved. You count for Zebras on the leaderboard. You can change it in App Home.");
  });
});

describe("GB19: the welcome's Save reply", () => {
  test("a Save whose update Slack rate-limits still reads Saved after the member picked another group in Settings meanwhile", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"), onForEveryone("everyone-board"));
    await giveKudos(t, "U_ANN", "U_BOB");
    const zebras = await groupIdNamed(t, "Zebras");
    slack.answering("chat.update", rateLimitedFor(1));
    slack.holdingBack("chat.update", "U_ANN", async () => {
      await t.mutation(internal.slack.receipts.receiveHomeClick, { workspace: "T1", eventId: "meanwhile", user: "U_ANN", commands: [{ type: "pickPrimaryGroup", group: zebras, surface: "settings" }] });
    });

    await saveInWelcome(t, "U_ANN", "Gardeners");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(welcomeUpdatesTo("U_ANN").at(-1)).toContain("section: Saved. You count for Gardeners on the leaderboard. You can change it in App Home.");
  });
});

describe("GB20: the primary group in Settings", () => {
  test("with only groups on, Settings is there to pick in", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"));
    await openSettings(t, "U_ANN");

    expect(publishedHome(slack, "U_ANN")).toContain(`section: ${pickQuestion} [select: Zebras]`);
    expect(settingsOptionsOf("U_ANN")).toEqual(["Gardeners", "Zebras"]);
  });

  test("a member in several groups picks from a dropdown, and App Home republishes with the pick selected", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"), onForEveryone("everyone-board"));
    await openSettings(t, "U_ANN");

    expect(publishedHome(slack, "U_ANN")).toContain(`section: ${pickQuestion} [select: Zebras]`);

    await chooseInSettings(t, "U_ANN", "Gardeners");

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Gardeners");
    expect(publishedHome(slack, "U_ANN")).toContain(`section: ${pickQuestion} [select: Gardeners]`);
    expect(settingsOptionsOf("U_ANN")).toEqual(["Gardeners", "Zebras"]);
  });

  test("a member in one group reads which group they count for, and a member in none sees nothing of groups", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"), onForEveryone("everyone-board"));
    await openSettings(t, "U_BOB");
    await openSettings(t, "U_DAN");

    expect(publishedHome(slack, "U_BOB")).toContain("section: You count for Gardeners on the leaderboard.");
    expect(groupLinesIn(publishedHome(slack, "U_DAN"))).toEqual([]);
  });
});

describe("GB3, GB29: where groups don't apply nothing changes", () => {
  test.each([
    { name: "with groups off", flag: offForEveryone("groups"), groups: true },
    { name: "with groups unavailable", flag: onForEveryone("groups"), groups: false },
  ])("$name the welcome message and Settings are as before, and a stale Save or dropdown click changes nothing", async ({ flag, groups }) => {
    if (!groups) slack.withoutUserGroup("S_GARDEN").withoutUserGroup("S_ZEBRA").withUserGroup("S_ADMINS", { name: "Admins", users: ["U_ANN"], autoType: "admin" });
    const t = await workspaceWithGroups(flag, onForEveryone("everyone-board"));
    await giveKudos(t, "U_ANN", "U_BOB");
    await openSettings(t, "U_ANN");
    const before = await primaryGroupNameOf(t, "U_ANN");

    await interact(t, "U_ANN", staleButtonOf({ type: "pickPrimaryGroup", group: await anyGroupId(t), surface: "welcome" }), { inMessage: welcomeMessageTo("U_ANN") });
    await interact(t, "U_ANN", { type: "static_select", action_id: JSON.stringify({ type: "pickPrimaryGroup", surface: "settings" }), selected_option: { value: await anyGroupId(t) } });

    expect(readBlocks(welcomeTo("U_ANN"))).toEqual(welcomeBlocksOf("U_ANN"));
    expect(welcomeTextTo("U_ANN")).toBe(welcomeTextOf("U_ANN"));
    expect(groupLinesIn(publishedHome(slack, "U_ANN"))).toEqual([]);
    expect(await primaryGroupNameOf(t, "U_ANN")).toBe(before);
    expect(slack.callsTo("chat.update")).toEqual([]);
    expect(picksSent()).toEqual([]);
  });
});

describe("D17: a pick that names no group", () => {
  test("a dropdown value that isn't a group ID stores nothing and fails no job", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"), onForEveryone("everyone-board"));
    await openSettings(t, "U_ANN");
    const select = selectIn(publishedHomeBlocks(slack, "U_ANN"));

    await interact(t, "U_ANN", { type: "static_select", action_id: select.action_id, selected_option: { value: "not-a-group-id" } });

    expect(await primaryGroupNameOf(t, "U_ANN")).toBe("Zebras");
    expect(await failedJobs(t)).toEqual([]);
  });
});

describe("GB33: primary group picked", () => {
  test("one event per stored change, with its surface and nothing about the group, and none for a refused or repeated pick", async () => {
    const t = await workspaceWithGroups(onForEveryone("groups"), onForEveryone("everyone-board"));
    await giveKudos(t, "U_ANN", "U_BOB");
    await openSettings(t, "U_ANN");

    const savedAt = hoursAfterNow(1);
    vi.setSystemTime(savedAt);
    await saveInWelcome(t, "U_ANN", "Gardeners");
    await saveInWelcome(t, "U_ANN", "Gardeners");
    const chosenAt = hoursAfterNow(2);
    vi.setSystemTime(chosenAt);
    await chooseInSettings(t, "U_ANN", "Zebras");
    await chooseInSettings(t, "U_ANN", "Zebras");
    slack.withUserGroup("S_GARDEN", { name: "Gardeners", users: ["U_BOB", "U_CAROL"] });
    await userGroupChanged(t, "S_GARDEN");
    await saveInWelcome(t, "U_ANN", "Gardeners");

    const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
    expect(picksSent()).toEqual([
      { event: "primary group picked", distinct_id: expect.stringMatching(uuid), uuid: expect.stringMatching(uuid), timestamp: savedAt.toISOString(), properties: { ...shared, surface: "welcome" } },
      { event: "primary group picked", distinct_id: expect.stringMatching(uuid), uuid: expect.stringMatching(uuid), timestamp: chosenAt.toISOString(), properties: { ...shared, surface: "settings" } },
    ]);
  });
});

function welcomeBlocksOf(user: Welcomed, ...groupBlocks: string[]) {
  return [...greetingOf[user].map((line) => `section: ${line}`), `section: ${allowance}`, ...groupBlocks, "actions: Open App Home"];
}

function welcomeTextOf(user: Welcomed, ...groupLines: string[]) {
  return [...greetingOf[user], allowance, ...groupLines, openAppHome].join("\n");
}

function hoursAfterNow(hours: number) {
  return new Date(now.getTime() + hours * 3_600_000);
}

async function workspaceWithGroups(...flags: FlagDefinition[]) {
  const t = await testBackendServing(postHog, ...flags);
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settleInTimeOrder(t);
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string) {
  await t.fetch("/slack/events", await signedRequest(messageEvent([section(mention(recipient), emoji("taco"))], { user: giver })));
  await settleInTimeOrder(t);
}

async function userGroupChanged(t: Backend, group: string) {
  await t.fetch("/slack/events", await signedRequest(userGroupEvent("subteam_members_changed", group)));
  await settleInTimeOrder(t);
}

async function openSettings(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
  if (publishedHome(slack, user).some((line) => line.includes("Settings"))) await interact(t, user, buttonInHome(slack, user, "Settings"));
}

async function chooseInSettings(t: Backend, user: string, group: string) {
  const select = selectIn(publishedHomeBlocks(slack, user));
  await interact(t, user, { type: "static_select", action_id: select.action_id, selected_option: { value: optionNamed(select, group) } });
}

async function saveInWelcome(t: Backend, user: string, group: string) {
  const blocks = welcomeTo(user);
  const select = selectIn(blocks);
  const state = { [select.block_id!]: { [select.action_id]: { type: "static_select" as const, selected_option: { value: optionNamed(select, group) } } } };
  await interact(t, user, buttonIn(blocks, "Save"), { inMessage: welcomeMessageTo(user), state });
}

async function interact(t: Backend, user: string, action: BlockAction, options: Parameters<typeof blockActions>[2] = {}) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action, options), form));
  expect(response.status).toBe(200);
  await settleInTimeOrder(t);
}

function welcomeTo(user: string): Block[] {
  const welcome = slack.callsTo("chat.postMessage").find(({ channel }) => channel === user);
  expect(welcome?.blocks, `a welcome with blocks to ${user}`).toBeDefined();
  return welcome!.blocks as Block[];
}

function welcomeTextTo(user: string) {
  return slack.callsTo("chat.postMessage").find(({ channel }) => channel === user)?.text;
}

function welcomeMessageTo(user: string): ClickedMessage {
  const [welcome] = slack.messagesIn(user);
  return { channel: user, ts: welcome!.ts };
}

function welcomeUpdatesTo(user: string) {
  const { ts } = welcomeMessageTo(user);
  return slack
    .callsTo("chat.update")
    .filter((update) => update.channel === user && update.ts === ts)
    .map((update) => readBlocks(update.blocks as Block[]));
}

function settingsOptionsOf(user: string) {
  return optionsOf(selectIn(publishedHomeBlocks(slack, user))).map(({ text }) => text.text);
}

function groupLinesIn(home: unknown[]) {
  return home.filter((line) => String(line).includes("count for"));
}

function picksSent() {
  return postHog.productEvents().filter((event) => event.event === "primary group picked");
}

async function primaryGroupNameOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await primaryGroupOf(ctx, member))?.name ?? null);
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    if (row === null) throw new Error(`the directory doesn't know ${user}`);
    return row._id;
  });
}

async function causesOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const history = await t.run((ctx) =>
    ctx.db
      .query("primaryGroupHistory")
      .withIndex("by_member_at", (q) => q.eq("member", member))
      .collect(),
  );
  return history.map(({ cause }) => cause);
}

async function groupIdNamed(t: Backend, name: string): Promise<GroupId> {
  return t.run(async (ctx) => (await ctx.db.query("userGroups").collect()).find((group) => group.name === name)!._id);
}

async function failedJobs(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ state }) => state.kind === "failed").map(({ name }) => name);
}

async function anyGroupId(t: Backend): Promise<GroupId> {
  return t.run(async (ctx) => (await ctx.db.query("userGroups").first())!._id);
}
