import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { LevelReachedEvent } from "../bus/events";
import { xpToReach } from "../progression/levels";

const now = new Date("2026-10-13T10:00:00Z");
const firstMessageAt = now.getTime() + 1000;
const form = { contentType: "application/x-www-form-urlencoded" };
const leaderboardReady = "section: *Leaderboard* is ready. It opens the boards. [button: Open]";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "everyone-board");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P74 P73: App Home's Profile tab lists each ready feature with Open", () => {
  test("a member whose kudos lift them to level 3 sees the Leaderboard ready, with what it opens, beside their level", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 10);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual([
      "actions: [Profile] | Settings",
      "header: Your kudos",
      "section: You've used all your kudos for today. You get *10* more at midnight.",
      "divider",
      "section fields: *Level*\n*3* | *XP to level 4*\n*200*",
      leaderboardReady,
      "divider",
      "section fields: *Given this week*\n*10* | *Received this week*\n*0* | *Given in total*\n*10* | *Received in total*\n*0*",
      "divider",
      "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
      "context: To add me to a channel, type `/hedgehug` there.",
    ]);
  });

  test("clicking Open opens the Leaderboard for good and republishes App Home without its line; replaying the click or clicking the stale button again opens nothing", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await openHome(t, "U_ALICE");
    const openButton = buttonInHome(slack, "U_ALICE", "Open");
    const openClick = blockActions("U_ALICE", openButton);

    const response = await send(t, openClick);

    expect(response.status).toBe(200);
    expect(unlockLinesOf(publishedHome(slack, "U_ALICE"))).toEqual([]);
    const opened = await unlockRows(t);
    expect(opened).toEqual([{ feature: "leaderboard", readyAt: firstMessageAt, openedAt: expect.any(Number) }]);

    vi.setSystemTime(now.getTime() + 60_000);
    const publishesBefore = slack.callsTo("views.publish").length;
    await send(t, openClick);
    await send(t, blockActions("U_ALICE", openButton));

    expect(await unlockRows(t)).toEqual(opened);
    expect(slack.callsTo("views.publish").length).toBe(publishesBefore + 1);
    expect(unlockLinesOf(publishedHome(slack, "U_ALICE"))).toEqual([]);
  });

  test("a stale Open clicked after everyone-board went off opens nothing, and App Home republishes without the Leaderboard", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await openHome(t, "U_ALICE");
    const openButton = buttonInHome(slack, "U_ALICE", "Open");
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("everyone-board"));

    await send(t, blockActions("U_ALICE", openButton));

    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: firstMessageAt }]);
    expect(unlockLinesOf(publishedHome(slack, "U_ALICE"))).toEqual([]);
  });
});

describe("P74: App Home republishes once readiness commits", () => {
  test("when the XP refresh publishes App Home before the Leaderboard's readiness commits, readiness republishes it with Open, without the member reopening it", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    const reached = await levelReachedBy(t, "U_ALICE", 2);

    await t.mutation(internal.feedback.homes.refreshHomeOnXp, { event: { type: "xpRecorded", workspace: "T1", member: reached.member, at: reached.at } });
    await settle(t);
    expect(unlockLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(["section: Next: Leaderboard at level 2."]);
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: reached });
    await settle(t);

    expect(unlockLinesOf(publishedHome(slack, "U_ALICE"))).toEqual([leaderboardReady]);
  });
});

describe("P74 P78: the Next line names the lowest shipped feature still locked", () => {
  test("a member at level 1 sees `Next: Leaderboard at level 2.`", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    await openHome(t, "U_ALICE");

    expect(unlockLinesOf(publishedHome(slack, "U_ALICE"))).toEqual(["section: Next: Leaderboard at level 2."]);
  });

  test("with everyone-board off, no feature is ready, named or teased at any level", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("everyone-board"));
    await giveKudos(t, "U_ALICE", "U_BOB", 10);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").filter((line) => /Leaderboard|Quests|Book|Skill tree|Coins|Hedgehogs|Next:|Open/.test(line))).toEqual([]);
  });
});

function unlockLinesOf(home: string[]) {
  return home.filter((line) => line.includes("is ready.") || line.includes("Next:"));
}

async function unlockRows(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("unlocks").collect()).map(({ feature, readyAt, openedAt }) => ({ feature, readyAt, ...(openedAt !== undefined && { openedAt }) })));
}

async function levelReachedBy(t: Backend, user: string, level: number): Promise<LevelReachedEvent> {
  const member = await t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", row!._id))
      .unique();
    await ctx.db.patch(progress!._id, { xp: xpToReach(level) });
    return row!._id;
  });
  const message = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };
  return { type: "levelReached", workspace: "T1", member, level, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: xpToReach(level + 1) - xpToReach(level), message, at: Date.now() };
}

async function workspace() {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(t);
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

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}
