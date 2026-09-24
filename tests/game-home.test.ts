import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { slackManifest } from "../convex/lib/slack";
import { DAILY_QUEST_BY_KEY, dailyQuestKey } from "../convex/lib/quests";
import { seedTeam, setupConvex, TODAY, type Team } from "./helpers";

/** "Your game" on App Home and `/kudos level` (#55 §G13, #99). */

type SlackCall = { method: string; params: Record<string, string> };
type Block = { type: string; text?: { text: string }; fields?: { text: string }[] };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true });
  vi.stubEnv("SITE_URL", "https://kudos.example");
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: String(url).split("/api/")[1], params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
      return Response.json({ ok: true });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const playing = (memberId: Id<"members">, xp: number, level: number, coins = 0) =>
  t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: 0, xp, level, coins }));

async function home(user = "UANA"): Promise<Block[]> {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "app_home_opened", tab: "home", user } });
  const view = calls.filter((c) => c.method === "views.publish" && c.params.user_id === user).at(-1)!;
  return JSON.parse(view.params.view).blocks;
}
const headers = (blocks: Block[]) => blocks.filter((b) => b.type === "header").map((b) => b.text!.text);
/** The blocks from the "Your game" header up to the next divider. */
const gameSection = (blocks: Block[]) => {
  const start = blocks.findIndex((b) => b.type === "header" && b.text!.text === "Your game");
  if (start < 0) return null;
  const end = blocks.findIndex((b, i) => i > start && b.type === "divider");
  return blocks.slice(start, end < 0 ? undefined : end);
};
const slash = (text: string, user = "UANA") => t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: user, text });

describe("App Home: your game", () => {
  test("right after your kudos: your level, the XP to the next one and, from level 3, your Hog coins", async () => {
    await playing(team.ana, 200, 4, 6); // 6 coins from kudos + 30 from levels
    const blocks = await home();
    expect(headers(blocks).slice(0, 2)).toEqual(["Your kudos", "Your game"]);
    const fields = gameSection(blocks)!.find((b) => b.type === "section")!.fields!.map((f) => f.text);
    expect(fields).toEqual(["*Level 4 · Sprout*\n200 XP", "*Next level*\n150 XP to go", "*Hog coins*\n36"]);
    expect(JSON.stringify(gameSection(blocks))).toContain("https://kudos.example/me?ws=T1");
    expect(blocks.length).toBeLessThanOrEqual(100);
  });

  test("from level 5, today's daily quest, ticked once it's done (#93); /kudos level says the same", async () => {
    await playing(team.ana, 400, 5);
    const title = DAILY_QUEST_BY_KEY[dailyQuestKey(team.workspaceId, TODAY)].title;
    expect(JSON.stringify(gameSection(await home()))).toContain(`*Today's quest*\\n▫️ ${title}`);
    await t.run((ctx) =>
      ctx.db.insert("dailyQuestCompletions", { workspaceId: team.workspaceId, memberId: team.ana, dayKey: TODAY, questKey: dailyQuestKey(team.workspaceId, TODAY), completedAt: Date.now() }),
    );
    const blocks = gameSection(await home());
    expect(JSON.stringify(blocks)).toContain(`*Today's quest*\\n✅ ${title}`);
    expect((await slash("level")).blocks).toEqual(blocks);
  });

  test("no daily quest below level 5, or while quests are off", async () => {
    await playing(team.ana, 200, 4);
    expect(JSON.stringify(gameSection(await home()))).not.toContain("Today's quest");

    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { xp: 400, level: 5 });
      await ctx.db.patch(team.workspaceId, { questsEnabled: false });
    });
    expect(JSON.stringify(gameSection(await home()))).not.toContain("Today's quest");
  });

  test("below level 3 not even the amount of coins is shown; the wallet is a locked area", async () => {
    await playing(team.ana, 40, 2, 3);
    const section = JSON.stringify(gameSection(await home()));
    expect(section).not.toContain("*Hog coins*");
    expect(section).toContain("🔒 Level 3: Hog coins");
  });

  test("nothing while you hide the game or the game is off, and not before your first kudos", async () => {
    await playing(team.ana, 120, 4);
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect(gameSection(await home())).toBeNull();
    expect(gameSection(await home("UBEN"))).toBeNull(); // not a player yet: the invitation instead
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: undefined }));
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(gameSection(await home())).toBeNull();
  });
});

describe("/kudos level", () => {
  test("answers only you, with the same blocks as your App Home", async () => {
    await playing(team.ana, 200, 4, 6);
    const reply = await slash("level");
    expect(reply.response_type).toBe("ephemeral");
    expect(reply.text).toBe("Level 4 · Sprout: 150 XP to level 5.");
    expect(reply.blocks).toEqual(gameSection(await home()));
    expect((await slash("xp")).blocks).toEqual(reply.blocks);
    expect((await slash("LVL")).blocks).toEqual(reply.blocks);
  });

  test("its text writes numbers as the blocks do", async () => {
    await playing(team.ana, 0, 24); // a revoke took the XP back: level 24 stays, 14,000-odd XP to go
    const reply = await slash("level");
    expect(reply.text).toMatch(/^Level 24 · Elder hog: \d{2},\d{3} XP to level 25\.$/);
    expect(JSON.stringify(reply.blocks)).toContain(reply.text.split(": ")[1].split(" XP")[0]);
  });

  test("before your first kudos it says how to start", async () => {
    expect((await slash("level", "UBEN")).text).toBe("You don't have a level yet. Give your first kudos with a few words on why to start one.");
  });

  test("while hidden or off it says so", async () => {
    await playing(team.ana, 120, 4);
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect((await slash("level")).text).toBe("You've hidden the game. Show it again on your Me page to see your level.");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect((await slash("level")).text).toBe("The game isn't on in this workspace.");
  });

  test("the help lists /kudos level next to /kudos coins, only for members who see the game", async () => {
    expect((await slash("help")).text).toContain("`/kudos level` your level · `/kudos coins` your Hog coins");
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect((await slash("help")).text).not.toContain("/kudos level");
  });

  test("the manifest's usage hint names level and coins", () => {
    expect(slackManifest("https://kudos.example").features.slash_commands[0].usage_hint).toBe("[me | top | quests | level | coins | store | help]");
  });
});
