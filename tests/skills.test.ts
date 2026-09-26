import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { resetSkills } from "../convex/skills";
import { claimAtTree, member, seedTeam, setupConvex, signInAs, type Team, TODAY } from "./helpers";

/** The skill tree (#55 §G7): points from levels, taking skills, the paid reset and the Scout branch. */

let t: ReturnType<typeof setupConvex>;
let team: Team & { dan: Id<"members"> };

const DAY = 24 * 3_600_000;

beforeEach(async () => {
  t = setupConvex();
  const base = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  const dan = await t.run((ctx) =>
    ctx.db.insert("members", { workspaceId: base.workspaceId, slackUserId: "UDAN", name: "Dan", isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
  );
  team = { ...base, dan };
});
afterEach(() => vi.useRealTimers());

let ts = 1000;
async function message(giver: string, text: string) {
  const result = await t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: "CGENERAL",
    channelName: "general",
    messageTs: `${ts++}.0001`,
  });
  vi.setSystemTime(Date.now() + 60_000);
  return result;
}

/** A member's player row, once they have claimed the coins waiting for them at the tree (#157). */
async function player(memberId: Id<"members">) {
  await claimAtTree(t, memberId);
  return await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());
}

/** Lifts Ana straight to `level` (setup only: levels come from XP). */
async function setLevel(level: number) {
  const p = (await player(team.ana))!;
  await t.run((ctx) => ctx.db.patch(p._id, { level }));
}

/** Ana becomes a player with a first kudos to Dan, then is lifted straight to `level` (setup only). */
async function anaAtLevel(level: number) {
  await message("UANA", "<@UDAN> :taco: thanks for the thorough review");
  await setLevel(level);
  return await signInAs(t, team.ana);
}

describe("the viewer's tree", () => {
  test("shows the level, the points to spend and the reset price; nothing while the game is off or hidden", async () => {
    const ana = await anaAtLevel(4);
    expect(await ana.query(api.skills.mine, {})).toMatchObject({ level: 4, skills: {}, resets: 0, resetCost: 50 });
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect(await ana.query(api.skills.mine, {})).toBeNull();
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: undefined }));
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(await ana.query(api.skills.mine, {})).toBeNull();
  });

  test("is null for a member who isn't a player yet", async () => {
    const ben = await signInAs(t, team.ben);
    expect(await ben.query(api.skills.mine, {})).toBeNull();
  });
});

describe("taking a skill", () => {
  test("spends a point on one rank and records the change", async () => {
    const ana = await anaAtLevel(3);
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    expect(await ana.query(api.skills.mine, {})).toMatchObject({ skills: { pathfinder: 2 } });
    const changes = await t.run((ctx) => ctx.db.query("skillChanges").collect());
    expect(changes.map((c) => [c.kind, c.skill])).toEqual([
      ["take", "pathfinder"],
      ["take", "pathfinder"],
    ]);
  });

  test("refuses without points, below the tier's level, without the parent, past the last rank or before its system ships", async () => {
    const ana = await anaAtLevel(2);
    await ana.mutation(api.skills.take, { skill: "lookout" });
    await expect(ana.mutation(api.skills.take, { skill: "pathfinder" })).rejects.toThrow(/needs 1 skill point; you have 0/);
    await setLevel(4);
    await expect(ana.mutation(api.skills.take, { skill: "rekindler" })).rejects.toThrow(/Rekindler opens at level 5/);
    await setLevel(12);
    await expect(ana.mutation(api.skills.take, { skill: "good_neighbour" })).rejects.toThrow(/Good neighbour arrives with the team garden\./);
    await expect(ana.mutation(api.skills.take, { skill: "lookout" })).rejects.toThrow(/You have every rank of Lookout/);
    await expect(ana.mutation(api.skills.take, { skill: "nonsense" })).rejects.toThrow(/no such skill/);
    await ana.mutation(api.skills.take, { skill: "rekindler" });
    expect(await ana.query(api.skills.mine, {})).toMatchObject({ skills: { lookout: 1, rekindler: 1 } });
  });

  test("the Herald's Signature emoji, Super kudos, Encore and Spotlight are live (#98)", async () => {
    const ana = await anaAtLevel(21);
    for (const skill of ["emoji_variants", "emoji_variants", "super_kudos", "encore", "spotlight"]) await ana.mutation(api.skills.take, { skill });
    expect(await ana.query(api.skills.mine, {})).toMatchObject({ skills: { emoji_variants: 2, super_kudos: 1, encore: 1, spotlight: 1 } });
  });

  test("needs the game shown: a member who hides it can't take skills or pay for a reset", async () => {
    const ana = await anaAtLevel(6);
    await ana.mutation(api.skills.take, { skill: "lookout" });
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await expect(ana.mutation(api.skills.take, { skill: "pathfinder" })).rejects.toThrow(/hidden/);
    await expect(ana.mutation(api.skills.reset, { cost: 50 })).rejects.toThrow(/hidden/);
    expect((await member(t, team.ana)).coinsSpent).toBeUndefined();
  });

  test("needs the game on and a player", async () => {
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.skills.take, { skill: "pathfinder" })).rejects.toThrow(/first kudos/);
    const ana = await anaAtLevel(3);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await expect(ana.mutation(api.skills.take, { skill: "pathfinder" })).rejects.toThrow(/game is off/);
  });
});

describe("resetting the tree", () => {
  test("returns every point and charges Hog coins in the same transaction, more each time", async () => {
    const ana = await anaAtLevel(6); // 50 coins from levels
    await ana.mutation(api.skills.take, { skill: "lookout" });
    await ana.mutation(api.skills.take, { skill: "rekindler" });
    expect(await ana.mutation(api.skills.reset, { cost: 50 })).toEqual({ cost: 50 });
    expect(await ana.query(api.skills.mine, {})).toMatchObject({ skills: {}, resets: 1, resetCost: 100 });
    expect(await member(t, team.ana)).toMatchObject({ coinsSpent: 50 });
    expect((await ana.query(api.game.mine, {})).wallet).toMatchObject({ balance: 1, spent: 50 }); // 1 from the kudos + 50 − 50
    const reset = await t.run((ctx) => ctx.db.query("skillChanges").filter((q) => q.eq(q.field("kind"), "reset")).collect());
    expect(reset).toMatchObject([{ coins: 50 }]);
  });

  test("resetSkills (the Store's reset item, #91) reads the member fresh: coins spent earlier in the same transaction stay spent", async () => {
    const ana = await anaAtLevel(6);
    await ana.mutation(api.skills.take, { skill: "lookout" });
    await t.run(async (ctx) => {
      const before = (await ctx.db.get(team.ana))!;
      await ctx.db.patch(team.ana, { coinsSpent: 1 }); // something else bought first
      await resetSkills(ctx, before._id, 50);
    });
    expect(await member(t, team.ana)).toMatchObject({ coinsSpent: 51 });
  });

  test("refuses without enough coins, with nothing to reset, below the wallet or at a changed price, and charges nothing", async () => {
    const ana = await anaAtLevel(2);
    await ana.mutation(api.skills.take, { skill: "lookout" });
    await expect(ana.mutation(api.skills.reset, { cost: 50 })).rejects.toThrow(/wallet opens at level 3/);
    await setLevel(4); // 1 + 30 coins
    await expect(ana.mutation(api.skills.reset, { cost: 50 })).rejects.toThrow(/costs 50 Hog coins; you have 31/);
    await setLevel(6);
    await expect(ana.mutation(api.skills.reset, { cost: 40 })).rejects.toThrow(/price is now 50 Hog coins/);
    await ana.mutation(api.skills.reset, { cost: 50 });
    await expect(ana.mutation(api.skills.reset, { cost: 100 })).rejects.toThrow(/no skills to reset/);
    expect(await member(t, team.ana)).toMatchObject({ coinsSpent: 50 });
  });
});

describe("Scout skills on the give path", () => {
  test("Pathfinder makes a new connection worth more, in the ledger and in the earnings reply", async () => {
    const ana = await anaAtLevel(3);
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    const before = (await player(team.ana))!.xp;
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect((await player(team.ana))!.xp - before).toBe(10 + 15);
    const reply = await t.run((ctx) => ctx.db.query("notifications").order("desc").filter((q) => q.neq(q.field("earnings"), undefined)).first());
    expect(reply?.earnings?.bonuses).toContainEqual({ kind: "new_connection", xp: 15 });
  });

  test("a rebuild replays the skills as they stood when each kudos was given", async () => {
    const ana = await anaAtLevel(6);
    vi.setSystemTime(Date.now() + DAY);
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review"); // no skill yet: +10
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    await message("UANA", "<@UCLEO> :taco: great pairing session today"); // Pathfinder: +15
    await ana.mutation(api.skills.reset, { cost: 50 });
    vi.setSystemTime(Date.now() + DAY);
    await message("UANA", "<@UBOT> <@UBEN> :taco: thanks again for the help"); // Ben: a repeat within the week
    const live = (await player(team.ana))!;
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    expect((await player(team.ana))!).toMatchObject({ xp: live.xp, coins: live.coins, skillResets: 1 });
    expect((await player(team.ana))!.skills).toBeUndefined();
    expect(live.xp).toBe(20 + 20 + 25 + 8); // Dan, Ben, Cleo with Pathfinder, Ben again on another day
  });
});

describe("the rebuild and a skill taken in the same millisecond as a kudos", () => {
  test("replays them in the order they happened", async () => {
    const ana = await anaAtLevel(6);
    vi.setSystemTime(Date.now() + DAY);
    // A kudos, then Pathfinder, without the clock moving: the kudos was scored without it.
    await t.mutation(internal.kudos.ingestMessage, {
      workspaceId: team.workspaceId,
      botUserId: "UBOT",
      giverSlackId: "UANA",
      text: "<@UBEN> :taco: thanks for the thorough review",
      channelId: "CGENERAL",
      channelName: "general",
      messageTs: `${ts++}.0001`,
    });
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    const live = (await player(team.ana))!;
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    expect((await player(team.ana))!.xp).toBe(live.xp);
  });
});

describe("Lookout: teammates you haven't thanked in a while", () => {
  test("is private to the Scout who took it, and lists only teammates thanked 30+ days ago", async () => {
    const ana = await anaAtLevel(3);
    expect(await ana.query(api.skills.hints, { today: TODAY })).toBeNull();
    await ana.mutation(api.skills.take, { skill: "lookout" });
    expect(await ana.query(api.skills.hints, { today: TODAY })).toEqual({ quiet: [], never: null });

    vi.setSystemTime(Date.now() + 31 * DAY);
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const hints = await ana.query(api.skills.hints, { today });
    expect(hints?.quiet.map((h) => h.name)).toEqual(["Dan"]); // Ben was thanked today
    expect(hints?.quiet[0].lastDay).toBe(TODAY);
    const ben = await signInAs(t, team.ben);
    expect(await ben.query(api.skills.hints, { today })).toBeNull();
  });

  test("Wide net adds teammates you've never thanked; never bots, deactivated members or yourself", async () => {
    const ana = await anaAtLevel(10);
    await t.run((ctx) => ctx.db.patch(team.cleo, { deactivated: true }));
    await ana.mutation(api.skills.take, { skill: "lookout" });
    await ana.mutation(api.skills.take, { skill: "wide_net" });
    const hints = await ana.query(api.skills.hints, { today: TODAY });
    expect(hints?.never?.map((h) => h.name)).toEqual(["Ben"]);
  });

  test("Wide net's pick doesn't give away who else has been giving: it only changes with the day", async () => {
    const extra = (slackUserId: string, name: string) =>
      t.run((ctx) => ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }));
    for (const [id, name] of [["UEVE", "Eve"], ["UFIN", "Fin"], ["UGUS", "Gus"], ["UHAL", "Hal"]]) await extra(id, name);
    const ana = await anaAtLevel(10);
    await ana.mutation(api.skills.take, { skill: "lookout" });
    await ana.mutation(api.skills.take, { skill: "wide_net" });
    const pick = async () => (await ana.query(api.skills.hints, { today: TODAY }))?.never?.map((h) => h.name);
    const before = await pick();
    expect(before).toHaveLength(3);
    for (const name of before!) {
      const id = (await t.run((ctx) => ctx.db.query("members").filter((q) => q.eq(q.field("name"), name)).first()))!._id;
      await t.run((ctx) => ctx.db.patch(id, { lastGivenAt: 0 }));
    }
    const others = (await t.run((ctx) => ctx.db.query("members").collect())).filter((m) => !before!.includes(m.name));
    for (const m of others) await t.run((ctx) => ctx.db.patch(m._id, { lastGivenAt: Date.now() }));
    expect(await pick()).toEqual(before);
  });
});

describe("removing a member", () => {
  test("takes their skill changes with them", async () => {
    const ana = await anaAtLevel(3);
    await ana.mutation(api.skills.take, { skill: "pathfinder" });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UANA", force: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    expect(await t.run((ctx) => ctx.db.query("skillChanges").collect())).toHaveLength(0);
  });
});
