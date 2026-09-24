import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Gains, sendGains } from "../convex/gains";
import type { Gain } from "../convex/lib/gains";
import { CATALOG, type Category } from "../convex/lib/messages";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * Gain DMs (#55 §G13, #99): discovering or gaining something is a DM, and everything one kudos
 * event gained a member arrives in one DM, never a stream. Game switch and Hide the game respected.
 */

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

function stubSlackApi(responses: Record<string, unknown> = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      if (method in responses) return Response.json(responses[method]);
      if (method === "conversations.info") return Response.json({ ok: true, channel: { name: "general" } });
      return Response.json({ ok: true });
    }),
  );
}

let ts = 100;
async function post(text: string, user = "UANA") {
  await t.action(internal.slack.processEvent, {
    teamId: "T1",
    event: { type: "message", user, text, channel: "C1", ts: `${ts++}.0001` },
  });
  vi.setSystemTime(Date.now() + 60_000);
}

const dmsTo = (user: string) => calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === user).map((c) => c.params);
const blocksOf = (dm: Record<string, string>) => JSON.parse(dm.blocks) as { type: string; text?: { text: string } }[];
const ephemerals = () => calls.filter((c) => c.method === "chat.postEphemeral").map((c) => c.params);

/** `memberId` has already collected every message of `category`: nothing they roll there is new. */
const collectedAll = (memberId: Id<"members">, category: Category) =>
  t.run(async (ctx) => {
    for (const tpl of CATALOG.filter((x) => x.category === category)) {
      await ctx.db.insert("discoveries", {
        workspaceId: team.workspaceId,
        memberId,
        templateKey: tpl.key,
        rarity: tpl.rarity,
        category,
        timesSeen: 1,
        firstSeenAt: 0,
        lastSeenAt: 0,
      });
    }
  });

/** `memberId` already plays with `xp` (level from it). */
const playing = (memberId: Id<"members">, xp: number, level: number) =>
  t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: 0, xp, level, coins: 0 }));

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  vi.stubEnv("SITE_URL", "https://kudos.example");
  stubSlackApi();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Every roll lands on this rarity (lib/messages `rollRarity`: 55/25/12/6/2 out of 100). */
const rolls = (rarity: "common" | "rare") => vi.spyOn(Math, "random").mockReturnValue(rarity === "rare" ? 0.85 : 0.1);

describe("a new Rare-or-better message discovered where only you saw it is a DM", () => {
  test("your reply was new to you: a DM quotes it, with its rarity, your collection and the gallery", async () => {
    rolls("rare");
    await post("<@UBEN> :taco: thanks for the thorough review");
    const [reply] = ephemerals();
    const [dm] = dmsTo("UANA");
    expect(dm.text).toContain("New message discovered");
    const [section, context] = blocksOf(dm);
    expect(section.text!.text).toContain(`>${reply.text.split("\n")[0]}`);
    expect(JSON.stringify(context)).toContain("🔵 Rare  ·  1 of 72 collected");
    expect(JSON.stringify(context)).toContain("https://kudos.example/discoveries?ws=T1");
  });

  test("a Common or Uncommon discovery stays in the reply, marked there: a DM for each would be a stream", async () => {
    rolls("common");
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(ephemerals()[0].blocks).toContain("New discovery");
    expect(dmsTo("UANA")).toEqual([]);
  });

  test("a message you'd already collected: no DM", async () => {
    rolls("rare");
    await collectedAll(team.ana, "giver_success");
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(dmsTo("UANA")).toEqual([]);
  });

  test("a new message in an over-the-limit reply is a discovery too", async () => {
    rolls("rare");
    await playing(team.ana, 0, 1);
    await post("<@UBEN> :taco::taco::taco::taco::taco::taco: way too many for the review");
    expect(ephemerals()).toHaveLength(1);
    expect(dmsTo("UANA").map((d) => d.text)).toEqual([expect.stringContaining("New message discovered")]);
  });

  test("nothing for someone who doesn't play yet: the game starts with their first kudos", async () => {
    rolls("rare");
    await post("<@UBEN> :taco::taco::taco::taco::taco::taco: way too many for the review");
    await t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: "UCLEO", text: "me" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(calls.filter((c) => c.method === "chat.postMessage")).toEqual([]);
  });

  test("if Slack can't show the reply where you gave and it comes as a DM, that DM is the discovery: no second one", async () => {
    rolls("rare");
    stubSlackApi({ "chat.postEphemeral": { ok: false, error: "channel_not_found" } });
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(dmsTo("UANA")).toHaveLength(1);
    expect(dmsTo("UANA")[0].text).not.toContain("New message discovered");
  });

  test("…but anything else it gained still comes", async () => {
    rolls("rare");
    await playing(team.ana, 25, 1);
    stubSlackApi({ "chat.postEphemeral": { ok: false, error: "channel_not_found" } });
    await post("<@UBEN> :taco: thanks for the thorough review");
    const texts = dmsTo("UANA").map((d) => d.text);
    expect(texts).toHaveLength(2);
    expect(texts[1]).toContain("Level 2: Seedling");
    expect(texts[1]).not.toContain("New message discovered");
  });

  test("never while you hide the game or the game is off: then the reply shows it, as before", async () => {
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await post("<@UBEN> :taco: thanks for the thorough review");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await post("<@UBEN> :taco: thanks for the thorough review", "UCLEO");
    expect(dmsTo("UANA")).toEqual([]);
    expect(dmsTo("UCLEO")).toEqual([]);
  });

  test("with 'Reply to givers' off nothing is rolled, so nothing is discovered", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: false }));
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(dmsTo("UANA")).toEqual([]);
  });
});

describe("gains outside a Slack event (a skill picked or an item bought on the web)", () => {
  const give = (memberId: Id<"members">, gains: Gain[]) =>
    t.run(async (ctx) => {
      await sendGains(ctx, (await ctx.db.get(team.workspaceId))!, memberId, gains);
    });

  test("one DM with everything, sent right after", async () => {
    await playing(team.ana, 900, 7);
    await give(team.ana, [
      { kind: "skill", name: "Lucky charm", branch: "Herald" },
      { kind: "item", name: "Golden frame" },
    ]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const toAna = dmsTo("UANA");
    expect(toAna).toHaveLength(1);
    expect(toAna[0].text).toContain("New skill: Lucky charm");
    expect(toAna[0].text).toContain("Golden frame is yours");
    const [note] = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(note).toMatchObject({ category: "gains", delivery: "sent" });
  });

  test("nothing for a member who hides the game, or while the game is off", async () => {
    await playing(team.ana, 900, 7);
    await playing(team.ben, 900, 7);
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await give(team.ana, [{ kind: "item", name: "Golden frame" }]);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await give(team.ben, [{ kind: "item", name: "Golden frame" }]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(calls.filter((c) => c.method === "chat.postMessage")).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("notifications").collect())).toEqual([]);
  });

  test("taking a skill (#92) DMs the skill gained, with what it does", async () => {
    await playing(team.ana, 900, 7);
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [dm] = dmsTo("UANA");
    expect(dm.text).toMatch(/^🌱 \*New skill: Pathfinder\*\nScout branch\. /);
    expect(dm.blocks).toContain("https://kudos.example/skills?ws=T1");
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(dmsTo("UANA")[1].text).toMatch(/^🌱 \*New skill: Pathfinder, rank 2\*/);
  });

  test("coins a spree paid stay silent below level 3, like every coin before the wallet opens", async () => {
    await playing(team.ana, 40, 2);
    const spree: Gain = { kind: "spree_tier", tier: 5, role: "joined", giver: { slackUserId: "UBEN", name: "Ben" }, receivers: [{ slackUserId: "UCLEO", name: "Cleo" }], xp: 10, coins: 1 };
    await give(team.ana, [spree]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(dmsTo("UANA")[0].text).toContain("+10 XP");
    expect(dmsTo("UANA")[0].text).not.toMatch(/coin/i);
  });

  test("an event's gains are written once: adding after the flush is a bug, not a lost DM", async () => {
    await expect(
      t.run(async (ctx) => {
        const gains = new Gains(ctx, (await ctx.db.get(team.workspaceId))!);
        await gains.flush();
        gains.add(team.ana, { kind: "item", name: "Golden frame" });
      }),
    ).rejects.toThrow(/flushed/);
  });

  test("names in gains can't ping or link in Slack", async () => {
    await playing(team.ana, 900, 7);
    await give(team.ana, [{ kind: "skill", name: "<!here>", branch: "Herald", description: "<https://x.test|y>" }]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(dmsTo("UANA")[0].text).toContain("&lt;!here&gt;");
    expect(dmsTo("UANA")[0].text).not.toContain("<!here>");
    expect(dmsTo("UANA")[0].text).not.toContain("<https://x.test");
  });
});

describe("/kudos me", () => {
  test("a new Rare-or-better message discovered in the reply comes as a DM too", async () => {
    rolls("rare");
    await playing(team.ana, 0, 1);
    await t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: "UANA", text: "me" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(dmsTo("UANA").map((d) => d.text)).toEqual([expect.stringContaining("New message discovered")]);
  });
});

describe("one DM per member per kudos event", () => {
  test("a level-up and a discovery in the same kudos arrive together, level first", async () => {
    rolls("rare");
    await playing(team.ana, 25, 1);
    await post("<@UBEN> :taco: thanks for the thorough review"); // +20 XP: level 2, and a first reply
    const toAna = dmsTo("UANA");
    expect(toAna).toHaveLength(1);
    const texts = blocksOf(toAna[0]).filter((b) => b.type === "section").map((b) => b.text!.text);
    expect(texts[0]).toContain("*Level 2: Seedling*");
    expect(texts[1]).toContain("New message discovered");
  });

  test("a receiver's level-up rides in their kudos DM instead of a second DM", async () => {
    await playing(team.ben, 28, 1);
    await post("<@UBEN> :taco: thanks for the thorough review"); // Ben +5 XP: level 2
    const toBen = dmsTo("UBEN");
    expect(toBen).toHaveLength(1);
    expect(toBen[0].text).toContain("Level 2: Seedling");
    const sections = blocksOf(toBen[0]).filter((b) => b.type === "section");
    expect(sections.at(-1)!.text!.text).toContain("*Level 2: Seedling*");
  });

  test("a receiver who hides the game gets their kudos DM without it", async () => {
    await playing(team.ben, 28, 1);
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(dmsTo("UBEN")).toHaveLength(1);
    expect(dmsTo("UBEN")[0].text).not.toContain("Level");
  });

  test("with receiver DMs off, a receiver's level-up still comes, on its own", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyReceiver: false }));
    await playing(team.ben, 28, 1);
    await post("<@UBEN> :taco: thanks for the thorough review");
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual([expect.stringContaining("Level 2: Seedling")]);
  });

  test("gains never ride in a DM the workspace keeps quiet (a quest DM with 'Reply to givers' off): they get their own", async () => {
    await playing(team.ana, 25, 1);
    const ids = await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const quiet = await ctx.db.insert("notifications", {
        workspaceId: workspace._id,
        memberId: team.ana,
        category: "quest_complete",
        templateKey: "q",
        rarity: "rare",
        isNewDiscovery: false,
        slackText: "Quest done",
        webText: "Quest done",
        delivery: "skipped",
      });
      const gains = new Gains(ctx, workspace);
      gains.add(team.ana, { kind: "level_up", level: 2, from: 1 });
      return { quiet, written: await gains.flush([quiet]) };
    });
    expect(ids.written).toHaveLength(1);
    const quiet = await t.run((ctx) => ctx.db.get(ids.quiet));
    expect(quiet?.gains).toBeUndefined();
  });

  test("two receivers leveling up each get it in their own kudos DM", async () => {
    await playing(team.ben, 28, 1);
    await playing(team.cleo, 70, 2);
    await post("<@UBEN> <@UCLEO> :taco: thanks for the thorough review");
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual([expect.stringContaining("Level 2: Seedling")]);
    expect(dmsTo("UCLEO").map((d) => d.text)).toEqual([expect.stringContaining("Level 3: Sprout")]);
  });

  test("a giver's level-up rides in the quest DM the same kudos earned", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { questsEnabled: true }));
    await collectedAll(team.ana, "giver_success");
    await playing(team.ana, 25, 1);
    await post("<@UBEN> :taco: thanks for the thorough review"); // a new connection completes a quest
    const toAna = dmsTo("UANA");
    expect(toAna).toHaveLength(1);
    expect(toAna[0].blocks).toContain("quests this week");
    expect(toAna[0].text).toContain("Level 2: Seedling");
  });

  test("a reaction's kudos DMs gains the same way", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { reactionsEnabled: true }));
    await playing(team.ana, 29, 1); // a bare kudos earns 2 XP: level 2
    await t.action(internal.slack.processEvent, {
      teamId: "T1",
      event: { type: "reaction_added", user: "UANA", item_user: "UBEN", reaction: "taco", item: { type: "message", channel: "C1", ts: "1.0001" } },
    });
    expect(dmsTo("UANA").map((d) => d.text)).toEqual([expect.stringContaining("Level 2: Seedling")]);
  });

  test("XP and coins alone never DM", async () => {
    await collectedAll(team.ana, "giver_success");
    await playing(team.ana, 100, 3);
    await post("<@UBEN> :taco::taco: thanks for the thorough review"); // +20 XP, +2 coins, no level
    expect(dmsTo("UANA")).toEqual([]);
  });
});
