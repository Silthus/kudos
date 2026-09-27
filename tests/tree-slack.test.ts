import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";
import { xpForLevel } from "../convex/lib/xp";

/** The Ancient Tree in Slack (#154, design plan #152 S9): the receiver's DM, App Home and `/kudos tree`. */

type SlackCall = { method: string; params: Record<string, string> };
type Block = { type: string; text?: { text: string }; fields?: { text: string }[]; elements?: { text: string }[] };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  vi.stubEnv("SITE_URL", "https://kudos.example");
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      calls.push({ method, params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
      if (method === "conversations.info") return Response.json({ ok: true, channel: { name: "general" } });
      return Response.json({ ok: true });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

let ts = 100;
async function post(text: string, user = "UANA") {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user, text, channel: "C1", ts: `${ts++}.0001` } });
  vi.setSystemTime(Date.now() + 60_000);
}

const dmsTo = (user: string) => calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === user).map((c) => c.params);
const textOf = (blocks: Block[]) => JSON.stringify(blocks);

async function home(user: string): Promise<Block[]> {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "app_home_opened", tab: "home", user } });
  const view = calls.filter((c) => c.method === "views.publish" && c.params.user_id === user).at(-1)!;
  return JSON.parse(view.params.view).blocks;
}
const slash = (text: string, user: string) => t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: user, text });

describe("the receiver's kudos DM", () => {
  test("says how many seeds they have to plant at the tree", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    await post("<@UBEN> :taco: great pairing session today", "UCLEO");
    const [first, second] = dmsTo("UBEN");
    expect(first.text).toContain("1 seed to plant at the tree");
    expect(second.text).toContain("2 seeds to plant at the tree");
    expect(first.blocks).toContain("1 seed to plant at the tree");
  });

  test("never says how many where nobody sees received counts", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "hidden" }));
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(dmsTo("UBEN")[0].text).toContain("Seeds to plant at the tree");
    expect(dmsTo("UBEN")[0].text).not.toMatch(/\d seeds? to plant/);
    const text = textOf(await home("UBEN"));
    expect(text).toContain("*Seeds to plant*\\nWaiting at the tree");
    expect(text).not.toMatch(/Plant your \d/);
  });

  test("counts to 100 and no further", async () => {
    await t.run(async (ctx) => {
      const k = await ctx.db.insert("kudos", { workspaceId: team.workspaceId, batchId: "b", giverId: team.cleo, receiverId: team.ben, amount: 1, dayKey: "2026-09-01", source: "seed", channelId: "C1", text: "x", at: 0 });
      for (let i = 0; i < 120; i++) await ctx.db.insert("seeds", { workspaceId: team.workspaceId, kudosId: k, giverId: team.cleo, receiverId: team.ben, sownAt: i });
    });
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(dmsTo("UBEN")[0].text).toContain("100+ seeds to plant at the tree");
  });

  test("says nothing of seeds for a kudos without a reason, or when the game is hidden from them", async () => {
    await post("<@UBEN> :taco:");
    await t.run((ctx) => ctx.db.patch(team.cleo, { gameHidden: true }));
    await post("<@UCLEO> :taco: great pairing session today");
    expect(dmsTo("UBEN")[0].text).not.toContain("seed");
    expect(dmsTo("UCLEO")[0].text).not.toContain("seed");
  });
});

describe("a stage reached", () => {
  test("is a DM to every player who sees the game, once (#165, S9); never to someone who hid it", async () => {
    for (let i = 0; i < 5; i++) await post(`<@UBEN> :taco: thanks for the thorough review number ${i}`);
    await post("<@UCLEO> :taco: thanks for pairing on the flaky test", "UBEN");
    await t.run((ctx) => ctx.db.patch(team.cleo, { gameHidden: true }));
    await (await signInAs(t, team.ben)).mutation(api.tree.plantSeeds, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const stageDm = (user: string) => dmsTo(user).filter((dm) => dm.text.includes("The Ancient Tree is now a sprout"));
    expect(stageDm("UANA")).toHaveLength(1);
    expect(stageDm("UBEN")).toHaveLength(1);
    expect(stageDm("UANA")[0].text).toContain("New on the tree: the signpost and the notice board.");
    expect(stageDm("UCLEO")).toEqual([]);
    // The next day's planting grows it on, but it's still a sprout: nothing more to tell.
    vi.setSystemTime(Date.now() + 86_400_000);
    await post("<@UBEN> :taco: thanks for the thorough review again");
    await (await signInAs(t, team.ben)).mutation(api.tree.plantSeeds, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(stageDm("UANA")).toHaveLength(1);
  });
});

describe("App Home and /kudos tree", () => {
  test("say a blight is at the tree while one is (#164): how worn down it is, until when, and your part", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: 2000, fuel: 0, peakGrowth: 2000, plantings: 1, plantedAt: Date.now() - 1 });
      const at = Date.now() - 60_000;
      const blightId = await ctx.db.insert("blights", {
        workspaceId: team.workspaceId,
        number: 1,
        status: "active",
        arrivesAt: at,
        endsAt: at + 5 * 86_400_000,
        announcedAt: at - 2 * 86_400_000,
        hp: 120,
        damage: 42,
        contributors: 2,
        defeatedBefore: false,
        tier: 1,
        source: "schedule",
      });
      await ctx.db.insert("blightContributors", { workspaceId: team.workspaceId, blightId, memberId: team.ana, damage: 12, at });
    });
    const blocks = textOf(await home("UANA"));
    expect(blocks).toContain("A blight is at the tree: 42 of 120 worn down, until Monday, 28 September. You dealt it 12.");
    expect(textOf(await home("UBEN"))).toContain("A blight is at the tree: 42 of 120 worn down, until Monday, 28 September. Every thoughtful kudos strikes it.");
  });

  test("show the desert before the seed moment, with the seeds to plant", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    const blocks = await home("UBEN");
    expect(textOf(blocks)).toContain("The Ancient Tree");
    expect(textOf(blocks)).toContain("A desert");
    expect(textOf(blocks)).toContain("*Seeds to plant*\\n1");
  });

  test("show the stage, the way to the next one and the districts open", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    await (await signInAs(t, team.ben)).mutation(api.tree.plantSeeds, {});
    const reply = await slash("tree", "UANA");
    expect(reply.text).toBe("The Ancient Tree is a seed: 4 growth to a sprout.");
    const text = textOf(reply.blocks);
    expect(text).toContain("*A seed*\\n1 growth");
    expect(text).toContain("*Next*\\n4 growth to a sprout");
    expect(text).toContain("*Districts open*\\n1 of 18");
    expect(text).toContain("*Seeds to plant*\\n0");
    expect(textOf(await home("UANA"))).toContain("*Districts open*\\n1 of 18");
  });

  test("say what the crew is pooling for and how far it got, or that it is being built (#165, S9)", async () => {
    await t.run((ctx) => ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: 900, fuel: 0, peakGrowth: 900, plantings: 1, plantedAt: Date.now() - 1 }));
    const questId = await t.mutation(internal.crew.seedStory, { workspaceId: team.workspaceId, part: "structure_market_awnings", built: false, share: 0.6 });
    const line = "The crew is pooling Hog coins for the market awnings: 300 of 500.";
    expect(textOf(await home("UANA"))).toContain(line);
    expect(textOf((await slash("tree", "UBEN")).blocks)).toContain(line);
    await t.run((ctx) => ctx.db.patch(questId, { status: "funded", contributed: 500, fundedAt: Date.now() }));
    expect(textOf(await home("UANA"))).toContain("The crew funded the market awnings, and building has begun.");
  });

  test("App Home's game shows the stamina for the ruins from level 6 (#165, S9)", async () => {
    await post("<@UBEN> :taco: thanks for the thorough review");
    const player = await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique());
    expect(textOf(await home("UANA"))).not.toContain("Stamina");
    await t.run((ctx) => ctx.db.patch(player!._id, { level: 6, xp: xpForLevel(6), stamina: 2 }));
    expect(textOf(await home("UANA"))).toContain("*Stamina*\\n2 of 5");
  });

  test("/kudos tree says so when the game is off or hidden", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect((await slash("tree", "UANA")).text).toBe("The game isn't on in this workspace.");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: true }));
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect((await slash("tree", "UANA")).text).toMatch(/hidden the game/);
    expect(textOf(await home("UANA"))).not.toContain("The Ancient Tree");
  });
});
