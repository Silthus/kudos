import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, onInTheSandboxOnly, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, publishedHomeBlocks, readBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { publish } from "../bus/publish";
import type { PerkId } from "../progression/tree";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-14T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const saysNothing = "thanks";
const form = { contentType: "application/x-www-form-urlencoded" };
const skillTree = "skill-tree";
const inDm = { channel: "D_ALICE", ts: "1760435000.000200" };

type TreeTurnedOff = { reason: string; flags: FlagDefinition[] };

const treeTurnedOff: TreeTurnedOff[] = [
  { reason: "skill-tree turned off", flags: [onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone(skillTree), onForEveryone("achievements")] },
  { reason: "unlocks turned off", flags: [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(skillTree)] },
  { reason: "xp-levels turned off", flags: [offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(skillTree)] },
];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the skill tree applies only where skill-tree, xp-levels and unlocks all apply, whatever achievements says", () => {
  test.each<[string, () => Promise<Backend>]>([
    ["skill-tree turned off, achievements on", () => launchedWorkspaceDeciding("sandbox", ...allOn(offForEveryone(skillTree)), onForEveryone("achievements"))],
    ["skill-tree not created in PostHog", () => launchedWorkspaceDeciding("sandbox", onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"))],
    ["the flags key missing", () => flagsKeyMissing(launchedWorkspaceDeciding("sandbox", ...allOn()))],
    ["skill-tree on but unlocks off and never launched", () => workspaceDeciding("sandbox", onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(skillTree))],
    ["skill-tree on but unlocks turned off after its launch", () => turnedTo(launchedWorkspaceDeciding("sandbox", ...allOn()), onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(skillTree))],
    ["skill-tree on but xp-levels off", () => launchedWorkspaceDeciding("sandbox", offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(skillTree))],
    ["all three on in the sandbox only, read in production", () => workspaceDeciding("production", ...["xp-levels", "unlocks", skillTree].map(onInTheSandboxOnly))],
  ])("%s: a member who owns spark earns no bonus line and no hint, and no DM, success reply or App Home names the tree or offers Buy", async (_, workspace) => {
    const t = await workspace();
    await membersWithHistory(t);

    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);
    await giveKudos(t, "U_ALICE", "U_BOB", saysNothing);
    await giveKudos(t, "U_CAROL", "U_BOB", saysWhy);
    for (const user of ["U_ALICE", "U_BOB", "U_CAROL"]) await openHome(t, user);
    await t.mutation(internal.unlocks.sweep.sweep, {});
    await settle(t);

    expect(await bonusLinesOf(t, "U_ALICE")).toEqual([[], []]);
    expect(everyLineShown().filter(namesTheTree)).toEqual([]);
    expect(await treeRows(t)).toEqual({ perksOwned: [{ user: "U_ALICE", perk: "spark" }], perkPurchases: [], pointsSpent: [{ user: "U_ALICE", pointsSpent: 1 }] });
    expect(publishedTypes()).toEqual([]);
    expect(exposures()).not.toContainEqual([skillTree, true]);
  }, 30_000);
});

describe("a stale purchase button from when the skill tree applied writes nothing and publishes nothing", () => {
  test.each(treeTurnedOff)("$reason: Buy in the level-up DM and Buy on the Skill tree tab buy nothing and answer nothing", async ({ flags }) => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    await membersWithHistory(t);
    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Skill tree")));
    const buyInDm = buyButtonAmong(blocksOf(levelUpDmsTo("U_ALICE").at(-1)!), "rhythm");
    const buyInHome = buyButtonAmong(publishedHomeBlocks(slack, "U_ALICE"), "circle");
    const stored = await treeRows(t);
    const repliedInDm = slack.messagesIn(inDm.channel).length;
    vi.mocked(publish).mockClear();
    await flagsFromPostHog(t, postHog, ...flags);

    const responses = [await send(t, blockActions("U_ALICE", buyInDm, { inMessage: inDm })), await send(t, blockActions("U_ALICE", buyInHome))];

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(stored.pointsSpent).toEqual([{ user: "U_ALICE", pointsSpent: 1 }]);
    expect(await treeRows(t)).toEqual(stored);
    expect(publishedTypes()).toEqual([]);
    expect(slack.messagesIn(inDm.channel)).toHaveLength(repliedInDm);
    expect(publishedHome(slack, "U_ALICE").filter(namesTheTree)).toEqual([]);
  }, 30_000);
});

describe("O35: turning the skill tree off and on again loses nothing", () => {
  test.each(treeTurnedOff)("$reason hides the tree and pays no bonus while off, rewrites no purchase or effects record, and turning it back on shows the same tree", async ({ flags }) => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    await membersWithHistory(t);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Skill tree")));
    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);
    await send(t, blockActions("U_ALICE", buyButtonAmong(publishedHomeBlocks(slack, "U_ALICE"), "rhythm")));
    const shown = publishedHome(slack, "U_ALICE");
    const stored = { ...(await treeRows(t)), effects: await effectsRecords(t) };

    await flagsFromPostHog(t, postHog, ...flags);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    const whileOff = publishedHome(slack, "U_ALICE");
    const storedWhileOff = { ...(await treeRows(t)), effects: await effectsRecords(t) };
    await flagsFromPostHog(t, postHog, ...allOn());
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Skill tree")));

    expect(stored.perksOwned).toEqual([{ user: "U_ALICE", perk: "rhythm" }, { user: "U_ALICE", perk: "spark" }]);
    expect(stored.effects.filter(({ side }) => side === "giver").map(({ bonus }) => bonus.map(({ source }) => source))).toEqual([["spark"]]);
    expect(whileOff.filter(namesTheTree)).toEqual([]);
    expect(storedWhileOff.effects.slice(0, stored.effects.length)).toEqual(stored.effects);
    expect(storedWhileOff.effects.slice(stored.effects.length).map(({ bonus }) => bonus)).toEqual([[], []]);
    expect(await treeRows(t)).toEqual({ perksOwned: stored.perksOwned, perkPurchases: stored.perkPurchases, pointsSpent: stored.pointsSpent });
    expect(await effectsRecords(t)).toEqual(storedWhileOff.effects);
    expect(publishedHome(slack, "U_ALICE")).toEqual(shown);
  }, 30_000);
});

describe("O36: skill-tree exposure", () => {
  test("is sent once per member and value, from the App Home opening", async () => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...allOn(offForEveryone(skillTree)));
    await openHome(t, "U_ALICE");
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([
      [skillTree, true],
      [skillTree, false],
    ]);
  });

  test("is sent once for each member of a kudos who never opened App Home, from App Home's republish after their XP, where the flag decides the giver's bonus line and hint", async () => {
    const t = await launchedWorkspaceDeciding("sandbox", ...allOn());

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await giveKudos(t, "U_ALICE", "U_BOB", saysNothing);

    expect(await exposedIn(t)).toEqual([
      { user: "U_ALICE", value: true },
      { user: "U_BOB", value: true },
    ]);
    expect(exposures()).toEqual([
      [skillTree, true],
      [skillTree, true],
    ]);
  });

  test.each([
    ["xp-levels is off", [offForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone(skillTree)]],
    ["unlocks is off", [onForEveryone("xp-levels"), offForEveryone("unlocks"), onForEveryone(skillTree)]],
  ])("is never sent while %s, since skill-tree then decides nothing", async (_, flags) => {
    const t = await launchedWorkspaceDeciding("sandbox", ...flags);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");

    expect(exposures()).toEqual([]);
  });
});

function allOn(tree: FlagDefinition = onForEveryone(skillTree)) {
  return [onForEveryone("xp-levels"), onForEveryone("unlocks"), tree];
}

async function workspaceDeciding(environment: "sandbox" | "production", ...definitions: FlagDefinition[]) {
  postHog = postHogDeciding(environment);
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return flagsFromPostHog(t, postHog, ...definitions);
}

async function launchedWorkspaceDeciding(environment: "sandbox" | "production", ...definitions: FlagDefinition[]) {
  return unlocksShippedBeforeAnyoneJoined(await workspaceDeciding(environment, ...definitions));
}

async function turnedTo(workspace: Promise<Backend>, ...definitions: FlagDefinition[]) {
  return flagsFromPostHog(await workspace, postHog, ...definitions);
}

async function flagsKeyMissing(workspace: Promise<Backend>) {
  const t = await workspace;
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  return t;
}

async function membersWithHistory(t: Backend) {
  await t.run(async (ctx) => {
    const insertMember = (user: string) => ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
    const [alice, bob, carol] = [await insertMember("U_ALICE"), await insertMember("U_BOB"), await insertMember("U_CAROL")];
    await ctx.db.insert("memberProgress", { member: alice, xp: 990, pointsSpent: 1 });
    await ctx.db.insert("memberProgress", { member: bob, xp: 0, pointsSpent: 0 });
    await ctx.db.insert("memberProgress", { member: carol, xp: 595, pointsSpent: 0 });
    await ctx.db.insert("unlocks", { member: alice, feature: "skillTree", readyAt: 0, openedAt: 0 });
    await ctx.db.insert("perksOwned", { member: alice, perk: "spark", boughtAt: 0, catalogueVersion: "1" });
  });
}

function namesTheTree(line: string) {
  return /Skill tree|Spark|Rhythm|Circle|Buy|to spend|earn more/.test(line);
}

function everyLineShown() {
  const dms = slack.callsTo("chat.postMessage").flatMap((dm) => (dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(dm.blocks as Block[])));
  const replies = slack.callsTo("chat.postEphemeral").flatMap(({ text }) => String(text).split("\n"));
  const homes = ["U_ALICE", "U_BOB", "U_CAROL"].flatMap((user) => (slack.homeShownTo(user) === undefined ? [] : publishedHome(slack, user)));
  return [...dms, ...replies, ...homes];
}

function levelUpDmsTo(user: string) {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("🎉"));
}

function blocksOf(dm: Record<string, unknown>) {
  expect(dm.blocks, "the DM's blocks").toBeDefined();
  return dm.blocks as Block[];
}

function buyButtonAmong(blocks: Block[], perk: PerkId): BlockAction {
  const block = blocks.find((candidate) => candidate.accessory?.value !== undefined && JSON.parse(candidate.accessory.value).perk === perk);
  expect(block, `a Buy button for ${perk}`).toBeDefined();
  return buttonIn([block!], "Buy");
}

async function treeRows(t: Backend) {
  return t.run(async (ctx) => {
    const userOf = async (member: MemberId) => (await ctx.db.get(member))!.user;
    const perksOwned = await Promise.all((await ctx.db.query("perksOwned").collect()).map(async ({ member, perk }) => ({ user: await userOf(member), perk })));
    const perkPurchases = await Promise.all((await ctx.db.query("perkPurchases").collect()).map(async ({ member, key, outcome }) => ({ user: await userOf(member), key, outcome })));
    const pointsSpent = await Promise.all((await ctx.db.query("memberProgress").collect()).filter((row) => row.pointsSpent > 0).map(async ({ member, pointsSpent }) => ({ user: await userOf(member), pointsSpent })));
    const byJson = (one: unknown, other: unknown) => JSON.stringify(one).localeCompare(JSON.stringify(other));
    return { perksOwned: perksOwned.sort(byJson), perkPurchases: perkPurchases.sort(byJson), pointsSpent: pointsSpent.sort(byJson) };
  });
}

async function effectsRecords(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("effectsRecords").collect()).map(({ _id, _creationTime, ...record }) => ({ ...record, bonus: record.bonus ?? [] })));
}

async function bonusLinesOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    return (await ctx.db.query("effectsRecords").collect()).filter((record) => record.member === member && record.side === "giver").map(({ bonus }) => bonus ?? []);
  });
}

function publishedTypes() {
  return vi.mocked(publish).mock.calls.map(([, event]) => event.type).filter((type) => type === "perkBought");
}

async function exposedIn(t: Backend) {
  return t.run(async (ctx) => {
    const rows = (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === skillTree);
    return Promise.all(rows.map(async ({ member, value }) => ({ user: (await ctx.db.get(member))!.user, value })));
  });
}

function exposures() {
  const sent = postHog.events().filter(({ event, properties }) => event === "$feature_flag_called" && properties.$feature_flag === skillTree);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}
