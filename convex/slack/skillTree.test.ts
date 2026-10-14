import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, type BlockAction } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { standingOf } from "../progression/progression";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };

const sparkCopy = "+5 XP the first time each day you thank someone and say why.";
const rhythmCopy = "+2 XP each time you thank someone and say why, once per person a day.";
const circleCopy = "+5 XP the first time each week you thank a person and say why.";
const condition = "context: Bonuses count when your message has 5 or more words besides mentions and emoji.";

let slack: FakeSlack;
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

describe("P19 P67 P94: a level-5 member buys a first-row perk from App Home's Skill tree tab", () => {
  test("after opening the Skill tree, its tab lists spark, rhythm and circle with P94's copy and 1 skill point each, and Buy spends the point on spark for good", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const t = await levelFiveMember("U_ALICE");
    await click(t, "U_ALICE", "Open");

    await click(t, "U_ALICE", "Skill tree");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | [Skill tree] | Settings",
      "header: Skill tree",
      "section: You have *1 skill point* to spend.",
      "divider",
      `section: *Spark* · 1 skill point\n${sparkCopy} [button: Buy]`,
      `section: *Rhythm* · 1 skill point\n${rhythmCopy} [button: Buy]`,
      `section: *Circle* · 1 skill point\n${circleCopy} [button: Buy]`,
      condition,
    ]);

    await clickButton(t, "U_ALICE", buyButtonOf("spark"));

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: Profile | [Skill tree] | Settings",
      "header: Skill tree",
      "section: You have *0 skill points* to spend.",
      "divider",
      `section: ✅ *Spark* · Owned\n${sparkCopy}`,
      `section: *Rhythm* · 1 skill point\n${rhythmCopy}`,
      "context: You need 1 skill point.",
      `section: *Circle* · 1 skill point\n${circleCopy}`,
      "context: You need 1 skill point.",
      condition,
    ]);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 600, level: 5, skillPoints: 0 });
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["spark"]);
  });

  test("the Profile tab's skill point line says where to spend them", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const t = await levelFiveMember("U_ALICE");

    await click(t, "U_ALICE", "Open");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: You have *1 skill point* to spend in the *Skill tree* tab.");
  });
});

describe("P19 D17: Slack's Buy keys its purchase in a space no other entrance shares", () => {
  test("a Buy click stores its outcome under slack: and the click's trigger, apart from the website's website:{member}:{request} keys", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const t = await levelFiveMember("U_ALICE");
    await click(t, "U_ALICE", "Open");
    await click(t, "U_ALICE", "Skill tree");
    const buySpark = buyButtonOf("spark");

    await clickButton(t, "U_ALICE", buySpark);

    const trigger = JSON.parse(new URLSearchParams(blockActionsSent.at(-1)!).get("payload")!).trigger_id;
    expect(await t.run(async (ctx) => (await ctx.db.query("perkPurchases").collect()).map(({ key }) => key))).toEqual([`slack:${trigger}`]);
  });
});

describe("P19: a refused Buy republishes App Home with the reason on that perk", () => {
  test("Buy on spark and then a Buy on circle left from before it, with one skill point, buys spark and shows why circle wasn't bought", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const t = await levelFiveMember("U_ALICE");
    await click(t, "U_ALICE", "Open");
    await click(t, "U_ALICE", "Skill tree");
    const buyCircle = buyButtonOf("circle");

    await clickButton(t, "U_ALICE", buyButtonOf("spark"));
    await clickButton(t, "U_ALICE", buyCircle);

    expect(await perksOwnedBy(t, "U_ALICE")).toEqual(["spark"]);
    expect(publishedHome(slack, "U_ALICE").slice(-3)).toEqual([`section: *Circle* · 1 skill point\n${circleCopy}`, "context: You need 1 skill point.", condition]);
  });

  test("a Buy left on the Skill tree tab, clicked after the member moved to Profile and spent the point, shows the Skill tree tab with why", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const t = await levelFiveMember("U_ALICE");
    await click(t, "U_ALICE", "Open");
    await click(t, "U_ALICE", "Skill tree");
    const buyCircle = buyButtonOf("circle");
    await clickButton(t, "U_ALICE", buyButtonOf("spark"));
    await click(t, "U_ALICE", "Profile");

    await clickButton(t, "U_ALICE", buyCircle);

    expect(publishedHome(slack, "U_ALICE").slice(0, 2)).toEqual(["actions: Profile | [Skill tree] | Settings", "header: Skill tree"]);
    expect(publishedHome(slack, "U_ALICE").slice(-3)).toEqual([`section: *Circle* · 1 skill point\n${circleCopy}`, "context: You need 1 skill point.", condition]);
  });
});

describe("P78 P95: where the skill tree doesn't apply, nothing of it shows, and its copy never judges a kudos", () => {
  test("with skill-tree off, App Home has no Skill tree tab or perk, and a Buy left from when it was on buys nothing", async () => {
    const postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const t = await levelFiveMember("U_ALICE");
    await click(t, "U_ALICE", "Open");
    await click(t, "U_ALICE", "Skill tree");
    const staleBuy = buyButtonOf("spark");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("skill-tree"));

    await clickButton(t, "U_ALICE", staleBuy);

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/Skill tree|Spark|Rhythm|Circle|skill point/);
    expect(await perksOwnedBy(t, "U_ALICE")).toEqual([]);
    expect(await standing(t, "U_ALICE")).toEqual({ xp: 600, level: 5, skillPoints: 1 });
  });

  test("the Skill tree tab never calls a kudos thoughtful", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "skill-tree");
    const t = await levelFiveMember("U_ALICE");
    await click(t, "U_ALICE", "Open");

    await click(t, "U_ALICE", "Skill tree");

    expect(publishedHome(slack, "U_ALICE").join("\n")).not.toMatch(/thoughtful/i);
  });
});

function buyButtonOf(perk: string): BlockAction {
  const blocks = publishedHomeBlocks(slack, "U_ALICE");
  const block = blocks.find((candidate) => candidate.accessory?.value === JSON.stringify({ type: "buyPerk", perk }));
  expect(block, `a Buy button for ${perk}`).toBeDefined();
  return buttonIn([block!], "Buy");
}

async function levelFiveMember(user: string) {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(t);
  await giveKudos(t, user, "U_BOB", 1);
  await withXp(t, user, 590);
  await giveKudos(t, user, "U_BOB", 1);
  await openHome(t, user);
  return t;
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

async function click(t: Backend, user: string, label: string) {
  await clickButton(t, user, buttonInHome(slack, user, label));
}

const blockActionsSent: string[] = [];

async function clickButton(t: Backend, user: string, button: BlockAction) {
  const interaction = blockActions(user, button);
  blockActionsSent.push(interaction);
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  expect(response.status).toBe(200);
  await settle(t);
}

async function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

async function withXp(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}

async function perksOwnedBy(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("perksOwned").collect()).filter((row) => row.member === member).map(({ perk }) => perk));
}
