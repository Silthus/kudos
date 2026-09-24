import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { QuestKey } from "../convex/lib/quests";
import { RARITY_SLACK_BADGE } from "../convex/lib/messages";
import { signSlackRequest } from "../convex/lib/slack";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * Quests in Slack (spec #5 §13, ticket #22): the App Home "This week's quests" section and
 * `/kudos quests`. Slack is a stubbed `fetch`; NOW (Wed 2026-09-23) is in the week of Monday 2026-09-21.
 */

const SECRET = "test-signing-secret";
const WEEK = "2026-09-21";

type SlackCall = { method: string; params: Record<string, string> };
type Block = { type: string; text?: { text: string }; elements?: { text?: string | { text: string }; url?: string; action_id?: string }[] };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://kudos.example");
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: String(url).split("/api/")[1], params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
      return Response.json({ ok: true, channel: { name: "general" } });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Pins this week's board so a test doesn't depend on the seeded draw. */
const setBoard = (questKeys: QuestKey[]) =>
  t.run((ctx) => ctx.db.insert("questBoards", { workspaceId: team.workspaceId, weekKey: WEEK, questKeys }));

let ts = 1000;
/** A kudos message in Slack, the way the Events API delivers it (then everything it scheduled). */
async function post(user: string, text: string, channel = "CGENERAL") {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user, text, channel, ts: `${ts++}.0001` } });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** The blocks of the last App Home published for `slackUserId`. */
function lastHome(slackUserId: string): Block[] {
  const views = calls.filter((c) => c.method === "views.publish" && c.params.user_id === slackUserId);
  return JSON.parse(views.at(-1)!.params.view).blocks;
}

async function openHome(slackUserId: string) {
  calls = [];
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "app_home_opened", tab: "home", user: slackUserId } });
  return lastHome(slackUserId);
}

/** The blocks from the "This week's quests" header up to the next divider. */
function questSection(blocks: Block[]) {
  const start = blocks.findIndex((b) => b.type === "header" && b.text?.text === "This week's quests");
  if (start < 0) return null;
  const end = blocks.findIndex((b, i) => i > start && b.type === "divider");
  return blocks.slice(start, end < 0 ? undefined : end);
}

describe("App Home", () => {
  test("shows this week's quests after the stats: one line each, how they count, and the quest log", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await post("UANA", "<@UBEN> :taco: thanks for the quick review");
    const home = await openHome("UANA");
    const headers = home.filter((b) => b.type === "header").map((b) => b.text!.text);
    expect(headers.slice(0, 3)).toEqual(["Your kudos", "This week's quests", "This week's most generous"]);
    const section = questSection(home);
    expect(section).not.toBeNull();
    const [, lines, context, actions] = section!;
    // The Quest message's rarity is rolled; the line shows whichever badge it rolled (no flaky pattern).
    const rolled = (await t.run((ctx) => ctx.db.query("notifications").collect())).find((n) => n.category === "quest_complete")!;
    expect(lines.text!.text).toBe(
      [
        `✅ *New connection* · 1/1 · ${RARITY_SLACK_BADGE[rolled.rarity]}`,
        "Recognize someone you've never recognized before",
        "➖ *Spread the love* · not available",
        "Recognize 3 different teammates, each in their own message",
        "▫️ *Channel hopper* · 1/2",
        "Give thoughtful kudos in 2 different channels",
      ].join("\n"),
    );
    expect(context).toMatchObject({ type: "context", elements: [{ type: "mrkdwn", text: "1 of 2 done · Resets Monday · only thoughtful kudos count" }] });
    expect(actions).toMatchObject({
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: "Open quest log" }, url: "https://kudos.example/quests?ws=T1", action_id: "open_quest_log" }],
    });
  });

  test("the Home refreshed after a kudos already shows the quest it completed", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await post("UANA", "<@UBEN> :taco: thanks for the quick review", "CGENERAL");
    await post("UANA", "<@UCLEO> :taco: loved your demo this morning", "CRANDOM");
    const [, lines, context] = questSection(lastHome("UANA"))!;
    expect(lines.text!.text).toContain("✅ *Channel hopper* · 2/2");
    expect(context.elements![0].text).toBe("🧹 Clean sweep! · Resets Monday · only thoughtful kudos count");
  });

  test("Unsung hero is not available once received counts are hidden", async () => {
    await setBoard(["unsung", "steady", "story"]);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "hidden" }));
    const [, lines] = questSection(await openHome("UANA"))!;
    expect(lines.text!.text.split("\n")[0]).toBe("➖ *Unsung hero* · not available");
  });

  test("the week turns over at Monday 00:00 in the workspace timezone, same as the web board", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await post("UANA", "<@UBEN> :taco: thanks for the quick review");
    vi.setSystemTime(new Date("2026-09-27T21:59:00Z")); // Sunday 23:59 in Berlin
    expect(JSON.stringify(questSection(await openHome("UANA")))).toContain("✅ *New connection* · 1/1");
    vi.setSystemTime(new Date("2026-09-27T22:00:00Z")); // Monday 00:00 in Berlin, still Sunday in UTC
    const board = await (await signInAs(t, team.ana)).query(api.quests.mine, { today: "2026-09-28" });
    if (!board.enabled) throw new Error("quests are off");
    const [, lines] = questSection(await openHome("UANA"))!;
    expect(lines.text!.text).not.toContain("✅");
    expect(lines.text!.text.match(/\*([^*]+)\*/g)).toEqual(board.quests.map((q) => `*${q.title}*`));
  });

  test("someone Kudos doesn't know yet gets their Home without a quest section", async () => {
    const home = await openHome("UNEWBIE");
    expect(home[0]).toMatchObject({ type: "header", text: { text: "Your kudos" } });
    expect(questSection(home)).toBeNull();
  });

  test("has no quest section while an admin has quests switched off", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { questsEnabled: false }));
    const home = await openHome("UANA");
    expect(home[0]).toMatchObject({ type: "header", text: { text: "Your kudos" } });
    expect(questSection(home)).toBeNull();
  });

  test("stays well within Slack's 100-block limit with every section on", async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { gameEnabled: true, realRewardsEnabled: true });
      await ctx.db.patch(team.ana, { isAdmin: true });
      // Real rewards show on App Home from level 5, where the Store opens.
      await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ana, since: 0, xp: 350, level: 5, coins: 0 });
      for (const cost of [5, 10, 20, 40, 80]) {
        await ctx.db.insert("rewards", { workspaceId: team.workspaceId, name: `Reward ${cost}`, emoji: "🎁", cost, unit: "coins", status: "active", createdBy: team.ana, updatedAt: Date.now() });
      }
    });
    await post("UANA", "<@UBEN> :taco: thanks for the quick review");
    const home = await openHome("UANA");
    // Every section on: real rewards need the game (#91), so the game section (#99) is on too.
    expect(home.filter((b) => b.type === "header").map((b) => b.text!.text)).toEqual([
      "Your kudos",
      "Your game",
      "This week's quests",
      "This week's most generous",
      "Rewards store",
    ]);
    expect(home.length).toBeLessThanOrEqual(30);
  });
});

describe("/kudos quests", () => {
  let triggers = 0;
  async function command(text: string, userId = "UANA") {
    // Like Slack, every command carries its own trigger id: identical requests are replays.
    const body = new URLSearchParams({ team_id: "T1", user_id: userId, command: "/kudos", text, trigger_id: `q${++triggers}` }).toString();
    const stamp = String(Math.floor(Date.now() / 1000));
    const res = await t.fetch("/slack/commands", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": stamp,
        "x-slack-signature": await signSlackRequest(SECRET, stamp, body),
      },
      body,
    });
    return await res.json();
  }

  test("answers only you, with the same quest blocks as your App Home", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await post("UANA", "<@UBEN> :taco: thanks for the quick review");
    const reply = await command("quests");
    expect(reply.response_type).toBe("ephemeral");
    expect(reply.blocks).toEqual(questSection(await openHome("UANA")));
    expect(JSON.stringify(reply.blocks)).toContain("✅ *New connection* · 1/1");
  });

  test("shows your own progress, not someone else's", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    await post("UANA", "<@UBEN> :taco: thanks for the quick review");
    const text = JSON.stringify((await command("quests", "UBEN")).blocks);
    expect(text).toContain("▫️ *New connection* · 0/1");
    expect(text).toContain("0 of 2 done");
  });

  test("someone Kudos doesn't know yet gets a fresh board, and is added like with /kudos me", async () => {
    await setBoard(["fresh", "spread", "channels"]);
    const text = JSON.stringify((await command("quests", "UNEWBIE")).blocks);
    expect(text).toContain("▫️ *New connection* · 0/1");
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    expect(members.filter((m) => m.slackUserId === "UNEWBIE")).toHaveLength(1);
  });

  test("`quest` works too, and the help lists the command", async () => {
    expect((await command("quest")).blocks[0]).toMatchObject({ type: "header", text: { text: "This week's quests" } });
    expect((await command("help")).text).toContain("`/kudos quests` your weekly quests");
  });

  test("while quests are switched off, says so and leaves the command out of the help", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { questsEnabled: false }));
    expect(await command("quests")).toEqual({ response_type: "ephemeral", text: "Weekly quests aren't on in this workspace." });
    expect((await command("help")).text).not.toContain("/kudos quests");
  });

  describe("with the game on (#93)", () => {
    const playerAt = (memberId: Team["ana"], level: number, xp: number) =>
      t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: Date.now() - 1000, xp, level, coins: 0 }));

    test("below level 5 the board is listed locked, in the App Home and the command alike", async () => {
      await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: true }));
      await setBoard(["fresh", "spread", "channels"]);
      await playerAt(team.ana, 3, 80);
      const reply = await command("quests");
      expect(JSON.stringify(reply.blocks)).toContain("🔒 *Quests open at level 5* · you're level 3");
      expect(reply.blocks).toEqual(questSection(await openHome("UANA")));
    });

    test("from level 5 the App Home shows today's daily quest, done by a thoughtful kudos", async () => {
      await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: true }));
      await setBoard(["fresh", "spread", "channels"]);
      await playerAt(team.ana, 5, 400);
      await post("UANA", "<@UBEN> <@UCLEO> :taco: thanks for staying late to fix the release pipeline, it saved our whole demo today");
      const [, , today] = questSection(await openHome("UANA"))!;
      expect(today.text!.text).toMatch(/^\*Today's quest\*\n✅ \*.+\* · (1\/1|2\/2)\n/);
    });

    test("a member who hides the game is told where quests went", async () => {
      await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: true }));
      await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
      expect(await command("quests")).toEqual({
        response_type: "ephemeral",
        text: "Quests are part of the game, which you've hidden. Show it again on your Me page to see them.",
      });
    });
  });
});
