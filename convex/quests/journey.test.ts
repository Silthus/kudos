import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, buttonInHome, publishedHome, readBlocks, type Block, type BlockAction } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { publish } from "../bus/publish";
import { standingOf } from "../progression/progression";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const finishedStep = "✅ You finished a Journey step: Give a kudos that says why. You earned *10 XP*.";
const crateInHome = "section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*. [button: Open]";
const openedInHome = "section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*.";

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P90: a first kudos that says why finishes the Journey's first step", () => {
  test("a level 1 member's first kudos that says why pays 10 XP on top of its 10 base XP, reaches level 2 and sends one level-up DM", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await standing(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(levelUpDmsTo("U_ALICE")).toEqual(["🎉 You reached level 2!\nLevel 3 is 80 XP away."]);
  });

  test("P64: the level the reward record crosses posts no public notice under the kudos message, since no kudos message reached it", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(slack.messagesIn("C1").map(({ text }) => text)).not.toContainEqual(expect.stringContaining("reached level"));
  });
});

describe("P67 P89: App Home's Profile tab shows the Journey", () => {
  test("before any kudos, it shows the active first step with its goal, its reward and the condition in words", async () => {
    const t = await workspace();

    await openHome(t, "U_ALICE");

    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([
      "section: *Journey:* Give a kudos that says why. It pays *10 XP*.",
      "context: It counts when your message has 5 or more words besides mentions and emoji.",
    ]);
  });

  test("after a kudos that says why, it shows the step as done", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([crateInHome]);
  });

  test("a kudos that doesn't say why records nothing for the Journey, and the step stays active", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    await openHome(t, "U_ALICE");

    expect(await standing(t, "U_ALICE")).toEqual({ xp: 10, level: 1, skillPoints: 0 });
    expect(journeyIn(publishedHome(slack, "U_ALICE"))[0]).toBe("section: *Journey:* Give a kudos that says why. It pays *10 XP*.");
  });
});

describe("P63 P85: a finished Journey step's crate opens from its DM or App Home", () => {
  test("finishing the step sends one DM naming it and what it earned, with Open, and its text says the same", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(questDmsTo("U_ALICE").map(readDm)).toEqual([[`section: ${finishedStep} [button: Open]`]]);
    expect(questDmsTo("U_ALICE")[0]?.text).toBe(finishedStep);
  });

  test("clicking Open in the DM stores one crate opening, publishes questOpened and shows the step as opened in App Home; a second click changes nothing", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    const openButton = buttonIn(blocksOf(questDmsTo("U_ALICE")[0]!), "Open");
    const inDm = { channel: "U_ALICE", ts: "1760349700.000100" };
    vi.setSystemTime(now.getTime() + 60_000);

    expect((await click(t, "U_ALICE", openButton, inDm)).status).toBe(200);

    const opened = await crateOpenings(t);
    expect(opened).toEqual([{ user: "U_ALICE", key: "journey:first-thanks", at: now.getTime() + 60_000 }]);
    expect(questOpenedEvents()).toHaveLength(1);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([openedInHome]);

    vi.setSystemTime(now.getTime() + 120_000);
    await click(t, "U_ALICE", openButton, inDm);

    expect(await crateOpenings(t)).toEqual(opened);
    expect(questOpenedEvents()).toHaveLength(1);
  });

  test("clicking Open in App Home opens the crate the same way", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Open"));

    expect(await crateOpenings(t)).toEqual([{ user: "U_ALICE", key: "journey:first-thanks", at: expect.any(Number) }]);
    expect(questOpenedEvents()).toHaveLength(1);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([openedInHome]);
  });

  test("a member who turned DMs off gets no DM for the finished step, and App Home still shows its crate", async () => {
    const t = await workspace();
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Settings"));
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Turn off DMs"));
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Profile"));

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");

    expect(questDmsTo("U_ALICE")).toEqual([]);
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([crateInHome]);
  });

  test("another member clicking the same Open opens nothing, since a click only ever names the member who clicked", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    const openButton = buttonIn(blocksOf(questDmsTo("U_ALICE")[0]!), "Open");

    await click(t, "U_BOB", openButton);

    expect(await crateOpenings(t)).toEqual([]);
    expect(questOpenedEvents()).toEqual([]);
  });

  test.each([
    ["an unknown step", { type: "openQuestCrate", quest: { kind: "journey", step: "first-quest" } }],
    ["a reward key with a member in it", { type: "openQuestCrate", quest: { kind: "journey", step: "first-thanks", member: "U_ALICE" } }],
    ["a bare string for a reward key", { type: "openQuestCrate", quest: "journey:first-thanks" }],
  ])("a click carrying %s opens nothing", async (_, command) => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    await click(t, "U_ALICE", { type: "button", action_id: "openQuestCrate", value: JSON.stringify(command) });

    expect(await crateOpenings(t)).toEqual([]);
    expect(questOpenedEvents()).toEqual([]);
  });
});

describe("the slice applies only where quests, xp-levels and unlocks all apply", () => {
  test("while quests is off, a kudos that says why pays only its base XP and App Home shows no Journey", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks");
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");

    expect(await standing(t, "U_ALICE")).toEqual({ xp: 10, level: 1, skillPoints: 0 });
    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual([]);
  });
});

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `1760349600.00010${sentMessages}` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

function journeyIn(home: string[]) {
  const start = home.findIndex((line) => line.includes("*Journey:*"));
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}

async function click(t: Backend, user: string, action: BlockAction, inMessage?: { channel: string; ts: string }) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action, inMessage === undefined ? {} : { inMessage }), form));
  await settle(t);
  return response;
}

type PostedDm = { text?: unknown; blocks?: unknown };

function questDmsTo(user: string): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished"));
}

function blocksOf(dm: PostedDm) {
  expect(dm.blocks, "the DM's blocks").toBeDefined();
  return dm.blocks as Block[];
}

function readDm(dm: PostedDm) {
  return readBlocks(blocksOf(dm));
}

async function crateOpenings(t: Backend) {
  return t.run(async (ctx) => {
    const openings = await ctx.db.query("crateOpenings").collect();
    return Promise.all(openings.map(async ({ member, key, at }) => ({ user: (await ctx.db.get(member))!.user, key, at })));
  });
}

function questOpenedEvents() {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event) => event.type === "questOpened");
}

function levelUpDmsTo(user: string) {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => channel === user && String(text).startsWith("🎉 You reached level"))
    .map(({ text }) => text);
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
