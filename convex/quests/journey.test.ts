import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { standingOf } from "../progression/progression";

const now = new Date("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
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
  test("a level 1 member's first kudos that says why pays 10 XP on top of its 10 base XP, reaches level 2 and sends one level-up DM naming Quests", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    expect(await standing(t, "U_ALICE")).toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(levelUpDmsTo("U_ALICE")).toEqual(["🎉 You reached level 2!\nLevel 3 is 80 XP away.\n*Quests* is ready. It opens your weekly quests."]);
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

    expect(journeyIn(publishedHome(slack, "U_ALICE"))).toEqual(["section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*."]);
  });

  test("a kudos that doesn't say why records nothing for the Journey, and the step stays active", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", "thanks");
    await openHome(t, "U_ALICE");

    expect(await standing(t, "U_ALICE")).toEqual({ xp: 10, level: 1, skillPoints: 0 });
    expect(journeyIn(publishedHome(slack, "U_ALICE"))[0]).toBe("section: *Journey:* Give a kudos that says why. It pays *10 XP*.");
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
