import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { dayKeyFor } from "../convex/lib/time";
import { all, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/** Gardens (#55 §G8, G15): plants for teammates, growth, dormancy and fruit. */

let t: ReturnType<typeof setupConvex>;
let team: Team & { dan: Id<"members">; eve: Id<"members"> };

const DAY = 24 * 3_600_000;
const WEEK = 7 * DAY;
const STORY = "thanks for staying late to fix the release pipeline, it saved our whole demo today"; // 12+ words

beforeEach(async () => {
  t = setupConvex();
  const base = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  const extra = (slackUserId: string, name: string) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: base.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
  team = { ...base, dan: await extra("UDAN", "Dan"), eve: await extra("UEVE", "Eve") };
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

const today = () => dayKeyFor(Date.now(), "Europe/Berlin");
let signedIn = new Map<string, Awaited<ReturnType<typeof signInAs>>>();
beforeEach(() => {
  signedIn = new Map();
});
async function as(memberId: Id<"members">) {
  if (!signedIn.has(memberId)) signedIn.set(memberId, await signInAs(t, memberId));
  return signedIn.get(memberId)!;
}
async function garden(memberId: Id<"members">) {
  return await (await as(memberId)).query(api.gardens.mine, { today: today() });
}

/** Ana thanks four new people with a story on two days: level 3, 8 coins from kudos + 20 from level-ups. */
async function anaReachesLevel3() {
  await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
  vi.setSystemTime(Date.now() + DAY);
  await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
}

describe("the garden opens at level 3 with one plot", () => {
  test("locked below level 3, then empty with one plot", async () => {
    await message("UANA", `<@UBEN> :taco: ${STORY}`);
    expect(await garden(team.ana)).toMatchObject({ open: false, opensAt: 3 });
    vi.setSystemTime(Date.now() + DAY);
    await anaReachesLevel3();
    expect(await garden(team.ana)).toMatchObject({ open: true, plots: 1, plants: [], memories: [], cost: 10 });
  });

  test("nothing while the game is off or hidden", async () => {
    await anaReachesLevel3();
    await (await as(team.ana)).mutation(api.game.setHidden, { hidden: true });
    expect(await garden(team.ana)).toBeNull();
  });
});

describe("planting: 10 Hog coins and a qualifying kudos to them", () => {
  test("offers the teammates thanked thoughtfully in the last 7 days, and plants for one", async () => {
    await anaReachesLevel3();
    const before = await garden(team.ana);
    expect(before!.candidates.map((c) => c.name).sort()).toEqual(["Ben", "Cleo", "Dan", "Eve"]);
    await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.ben });
    const after = await garden(team.ana);
    expect(after!.plants).toEqual([expect.objectContaining({ forName: "Ben", stage: "seed", waterings: 0, dormant: false })]);
    expect(after!.candidates.map((c) => c.name)).not.toContain("Ben");
    const { wallet } = await (await as(team.ana)).query(api.game.mine, {});
    expect(wallet).toMatchObject({ balance: 28 - 10, spent: 10 });
  });

  test("a kudos without a reason, a thank-back or one older than 7 days doesn't let you plant", async () => {
    await message("UDAN", `<@UANA> :taco: ${STORY}`);
    await anaReachesLevel3(); // Ana's kudos to Dan is a thank-back
    expect((await garden(team.ana))!.candidates.map((c) => c.name).sort()).toEqual(["Ben", "Cleo", "Eve"]);
    vi.setSystemTime(Date.now() + 8 * DAY);
    await message("UANA", "<@UBEN> :taco:");
    const ana = await as(team.ana);
    expect((await garden(team.ana))!.candidates).toEqual([]);
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.ben })).rejects.toThrow(/thoughtful kudos to Ben in the last 7 days/);
  });

  test("needs a free plot and the coins; one plant per teammate", async () => {
    await anaReachesLevel3();
    const ana = await as(team.ana);
    await ana.mutation(api.gardens.plant, { teammateId: team.ben });
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.ben })).rejects.toThrow(/already growing/);
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.cleo })).rejects.toThrow(/no free plot/);
    await t.run((ctx) => ctx.db.patch(team.ana, { coinsSpent: 25 })); // 3 left
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { skills: { more_plots: 1 } });
    });
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.cleo })).rejects.toThrow(/costs 10 Hog coins; you have 3/);
  });

  test("never for yourself, a bot or someone deactivated", async () => {
    await anaReachesLevel3();
    const ana = await as(team.ana);
    await t.run((ctx) => ctx.db.patch(team.eve, { deactivated: true }));
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.ana })).rejects.toThrow();
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.bot })).rejects.toThrow();
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.eve })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("plants").collect())).toEqual([]);
  });
});

/** Moves the clock to 10:00 UTC (noon in Berlin) on `day`. */
const jumpTo = (day: string, hour = 10) => vi.setSystemTime(new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`));
const thank = (who: string) => message("UANA", `<@${who}> :taco: ${STORY}`);
async function anasPlant() {
  return (await garden(team.ana)) as Extract<Awaited<ReturnType<typeof garden>>, { open: true }>;
}
/** Ana (level 3) plants for Ben on Thursday 2026-09-24, in the quest week of Monday 09-21. */
async function anaPlantsForBen() {
  await anaReachesLevel3();
  await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.ben });
}
/** The "planted for you" DMs a member got. */
const gardenDms = async (memberId: Id<"members">) =>
  (await all(t, "notifications")).filter((n) => n.memberId === memberId && n.category === "garden");
/** The DMs that told a member about a plant's new stage (#99's gain pipeline). */
const stageDms = async (memberId: Id<"members">) =>
  (await all(t, "notifications")).filter((n) => n.memberId === memberId && (n.gains ?? []).some((g) => g.kind === "plant_stage"));

describe("watering: once per quest week, by a qualifying kudos to their teammate", () => {
  test("the planting week never waters; each later week's first thoughtful kudos does", async () => {
    await anaPlantsForBen();
    await thank("UBEN"); // still the planting week
    expect((await anasPlant()).plants[0]).toMatchObject({ waterings: 0, stage: "seed" });
    jumpTo("2026-09-28");
    await thank("UBEN");
    await thank("UBEN"); // the same week: no second watering
    expect((await anasPlant()).plants[0]).toMatchObject({ waterings: 1, stage: "sprout", lastWatered: "2026-09-28" });
  });

  test("a kudos without a reason and a thank-back never water", async () => {
    await anaPlantsForBen();
    jumpTo("2026-09-28");
    await message("UANA", "<@UBEN> :taco:");
    await message("UBEN", `<@UANA> :taco: ${STORY}`);
    await thank("UBEN"); // a thank-back within 72 h
    expect((await anasPlant()).plants[0]).toMatchObject({ waterings: 0 });
    jumpTo("2026-10-05");
    await thank("UBEN");
    expect((await anasPlant()).plants[0]).toMatchObject({ waterings: 1 });
  });

  test("a revoked watering un-grows the plant; a later thoughtful kudos that week takes its place", async () => {
    await anaPlantsForBen();
    jumpTo("2026-09-28");
    await thank("UBEN");
    await thank("UBEN");
    const [first, second] = (await all(t, "kudos")).filter((k) => k.dayKey === "2026-09-28");
    const admin = await as(team.ana);
    await admin.mutation(api.admin.revoke, { kudosId: first._id });
    expect((await anasPlant()).plants[0]).toMatchObject({ waterings: 1, stage: "sprout" });
    await admin.mutation(api.admin.revoke, { kudosId: second._id });
    expect((await anasPlant()).plants[0]).toMatchObject({ waterings: 0, stage: "seed" });
  });

  test("dormant after 60 days without watering; one qualifying kudos wakes it", async () => {
    await anaPlantsForBen();
    jumpTo("2026-09-28");
    await thank("UBEN");
    jumpTo("2026-11-26"); // 59 days
    expect((await anasPlant()).plants[0]).toMatchObject({ dormant: false });
    jumpTo("2026-11-27");
    expect((await anasPlant()).plants[0]).toMatchObject({ dormant: true, stage: "sprout" });
    await thank("UBEN");
    expect((await anasPlant()).plants[0]).toMatchObject({ dormant: false, waterings: 2, stage: "sapling" });
  });
});

describe("a plant reaching a new stage: a DM to its owner", () => {
  test("sent with the watering that grew it, and never twice for a stage", async () => {
    await anaPlantsForBen();
    const species = (await anasPlant()).plants[0].speciesName;
    jumpTo("2026-09-28");
    const result = await thank("UBEN");
    const [dm] = await stageDms(team.ana);
    expect(dm.gains).toContainEqual({ kind: "plant_stage", species, stage: "Sprout", teammate: { slackUserId: "UBEN", name: "Ben" } });
    expect(dm.webText).toContain(`Your ${species} for Ben is now a Sprout`);
    expect(result.notificationIds).toContain(dm._id);
    const watering = (await all(t, "kudos")).find((k) => k.dayKey === "2026-09-28")!;
    await (await as(team.ana)).mutation(api.admin.revoke, { kudosId: watering._id });
    jumpTo("2026-10-05");
    await thank("UBEN");
    expect(await stageDms(team.ana)).toHaveLength(1);
  });

  test("when only the age was missing, it arrives on the day the plant is old enough", async () => {
    await anaReachesLevel3();
    jumpTo("2026-09-27"); // a Sunday: Monday's watering comes a day later
    await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.ben });
    jumpTo("2026-09-28");
    await thank("UBEN");
    expect((await anasPlant()).plants[0]).toMatchObject({ waterings: 1, stage: "seed" });
    expect(await stageDms(team.ana)).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(dayKeyFor(Date.now(), "Europe/Berlin")).toBe("2026-09-30");
    const [dm] = await stageDms(team.ana);
    expect(dm.gains).toContainEqual(expect.objectContaining({ kind: "plant_stage", stage: "Sprout" }));
    expect(dm.delivery).not.toBe("skipped"); // handed to Slack (no Slack in tests: "failed")
  });

  test("never while the owner hides the game", async () => {
    await anaPlantsForBen();
    await (await as(team.ana)).mutation(api.game.setHidden, { hidden: true });
    jumpTo("2026-09-28");
    await thank("UBEN");
    expect(await stageDms(team.ana)).toEqual([]);
  });
});

describe("only the teammate sees a plant is for them", () => {
  test("Ben sees Ana's plant for him, with its stage, even before his own garden opens", async () => {
    await anaPlantsForBen();
    jumpTo("2026-09-28");
    await thank("UBEN");
    const forBen = await (await as(team.ben)).query(api.gardens.forMe, { today: today() });
    expect(forBen).toEqual([expect.objectContaining({ ownerId: team.ana, ownerName: "Ana", stage: "sprout" })]);
    expect(await (await as(team.cleo)).query(api.gardens.forMe, { today: today() })).toEqual([]);
  });

  test("anyone may look at Ana's garden but only Ben learns which plant is his", async () => {
    await anaPlantsForBen();
    const ben = await (await as(team.ben)).query(api.gardens.of, { memberId: team.ana });
    const cleo = await (await as(team.cleo)).query(api.gardens.of, { memberId: team.ana });
    expect(ben).toMatchObject({ name: "Ana", plants: [expect.objectContaining({ forYou: true, stage: "seed" })] });
    expect(cleo).toMatchObject({ name: "Ana", plants: [expect.objectContaining({ forYou: false })] });
    expect(JSON.stringify(cleo)).not.toContain(team.ben);
    expect(JSON.stringify(cleo)).not.toContain("Ben");
  });

  test("a DM tells Ben when a plant is planted for him, unless receivers get no DMs or he hides the game", async () => {
    await anaPlantsForBen();
    const [dm] = await gardenDms(team.ben);
    const species = (await anasPlant()).plants[0].speciesName;
    expect(dm).toMatchObject({ garden: { kind: "planted", owner: "Ana" }, webText: expect.stringContaining(`Ana is growing a ${species} for you`) });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyReceiver: false }));
    await (await as(team.ana)).mutation(api.gardens.uproot, { plantId: (await anasPlant()).plants[0].plantId });
    await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.cleo });
    expect(await gardenDms(team.cleo)).toEqual([]);
  });
});

describe("uprooting frees the plot and keeps a memory", () => {
  test("the plant becomes a memory with the stage it had", async () => {
    await anaPlantsForBen();
    jumpTo("2026-09-28");
    await thank("UBEN");
    const ana = await as(team.ana);
    await ana.mutation(api.gardens.uproot, { plantId: (await anasPlant()).plants[0].plantId });
    const after = await anasPlant();
    expect(after.plants).toEqual([]);
    expect(after.memories).toEqual([expect.objectContaining({ forName: "Ben", stageName: "Sprout", reason: "uprooted" })]);
    await ana.mutation(api.gardens.plant, { teammateId: team.ben }); // the plot is free again
    expect((await anasPlant()).plants).toHaveLength(1);
  });

  test("only the owner can uproot", async () => {
    await anaPlantsForBen();
    const plantId = (await anasPlant()).plants[0].plantId;
    await expect((await as(team.ben)).mutation(api.gardens.uproot, { plantId })).rejects.toThrow();
  });
});

/** Ana waters her plant for Ben six Mondays running (09-28 … 11-02): Grown on Sunday 11-08. */
async function anaGrowsBensPlant() {
  await anaPlantsForBen();
  for (const day of ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]) {
    jumpTo(day);
    await thank("UBEN");
  }
}
const anaPlayer = () => t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique());

describe("fruit: Grown plants watered in the last 14 days", () => {
  test("a Grown plant holds up to three fruit, 1 or 2 Hog coins each; picking pays them and 3 XP a fruit", async () => {
    await anaGrowsBensPlant();
    jumpTo("2026-11-07");
    expect((await anasPlant()).plants[0]).toMatchObject({ stage: "young", fruit: [] });
    jumpTo("2026-11-12");
    const plant = (await anasPlant()).plants[0];
    expect(plant).toMatchObject({ stage: "grown" });
    const days = ["2026-11-08", "2026-11-09", "2026-11-10"];
    expect(plant.fruit.map((f) => f.day)).toEqual(days);
    expect(plant.fruit.every((f) => f.coins === 1 || f.coins === 2)).toBe(true);
    const coins = plant.fruit.reduce((s, f) => s + f.coins, 0);

    const before = await anaPlayer();
    const picked = await (await as(team.ana)).mutation(api.gardens.pick, {});
    expect(picked).toEqual({ coins, xp: 9, fruit: 3 });
    expect(await anaPlayer()).toMatchObject({ coins: before!.coins! + coins, xp: before!.xp + 9, fruitCoins: coins });
    expect((await (await as(team.ana)).query(api.game.mine, {})).wallet).toMatchObject({ fromFruit: coins, fromKudos: before!.coins });
    expect((await anasPlant()).plants[0].fruit).toEqual([]);
    jumpTo("2026-11-13");
    expect((await anasPlant()).plants[0].fruit.map((f) => f.day)).toEqual(["2026-11-13"]);
  });

  test("/kudos coins names the fruit picked as its own source", async () => {
    await anaGrowsBensPlant();
    jumpTo("2026-11-12");
    const { coins } = await (await as(team.ana)).mutation(api.gardens.pick, {});
    const reply = await t.mutation(internal.slackData.slashCommand, { teamId: "T1", slackUserId: "UANA", text: "coins" });
    expect(JSON.stringify(reply)).toContain(`*From garden fruit*\\n${coins}`);
  });

  test("no fruit two weeks after the last watering", async () => {
    await anaGrowsBensPlant();
    jumpTo("2026-11-20");
    expect((await anasPlant()).plants[0].fruit.map((f) => f.day)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    await (await as(team.ana)).mutation(api.gardens.pick, {});
    expect((await anasPlant()).plants[0].fruit).toEqual([]); // the last fruiting day was 11-15
  });

  test("picking pays at most 14 Hog coins and 21 XP a quest week; the rest waits on the plants", async () => {
    await anaReachesLevel3();
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { skills: { more_plots: 2, wide_beds: 1 } });
      await ctx.db.patch(team.ana, { coinsAdjusted: 100 });
    });
    const ana = await as(team.ana);
    for (const teammateId of [team.ben, team.cleo, team.dan, team.eve]) await ana.mutation(api.gardens.plant, { teammateId });
    for (const day of ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]) {
      jumpTo(day);
      await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
    }
    jumpTo("2026-11-12"); // Thursday: 12 fruit waiting
    const waiting = (await anasPlant()).plants.flatMap((p) => p.fruit);
    expect(waiting).toHaveLength(12);
    const first = await ana.mutation(api.gardens.pick, {});
    expect(first.coins).toBeLessThanOrEqual(14);
    expect(first.coins).toBeGreaterThanOrEqual(13);
    expect(first.xp).toBe(21);
    expect((await anasPlant()).plants.flatMap((p) => p.fruit).length).toBeGreaterThan(0);
    expect((await ana.mutation(api.gardens.pick, {})).coins).toBeLessThanOrEqual(14 - first.coins);
    jumpTo("2026-11-16"); // a new quest week
    expect((await ana.mutation(api.gardens.pick, {})).coins).toBeGreaterThan(0);
  });

  test("a revoked watering can un-grow the plant, but fruit already picked stays picked", async () => {
    await anaGrowsBensPlant();
    jumpTo("2026-11-12");
    const picked = await (await as(team.ana)).mutation(api.gardens.pick, {});
    const before = await anaPlayer();
    const watering = (await all(t, "kudos")).find((k) => k.dayKey === "2026-11-02")!;
    await (await as(team.ana)).mutation(api.admin.revoke, { kudosId: watering._id });
    expect((await anasPlant()).plants[0]).toMatchObject({ stage: "young", waterings: 5, fruit: [] });
    // Only the revoked kudos' own coin goes; the fruit stays.
    expect(await anaPlayer()).toMatchObject({ coins: before!.coins! - 1, fruitCoins: picked.coins });
    const verify = await t.query(internal.game.verifyMember, { memberId: team.ana });
    expect(verify.coins).toBe(verify.eventCoins);
  });

  test("a game rebuild keeps the fruit picked", async () => {
    await anaGrowsBensPlant();
    jumpTo("2026-11-12");
    await (await as(team.ana)).mutation(api.gardens.pick, {});
    const before = await anaPlayer();
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    expect(await anaPlayer()).toMatchObject({ xp: before!.xp, coins: before!.coins, fruitCoins: before!.fruitCoins, level: before!.level });
  });

  test("nothing to pick while the game is off", async () => {
    await anaGrowsBensPlant();
    jumpTo("2026-11-12");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await expect((await as(team.ana)).mutation(api.gardens.pick, {})).rejects.toThrow(/off or hidden/);
  });
});

describe("leavers (§G15)", () => {
  test("a plant for a teammate who left becomes a memory and frees its plot; it grows on if they come back", async () => {
    await anaPlantsForBen();
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
    const after = await anasPlant();
    expect(after.plants).toEqual([]);
    expect(after.memories).toEqual([expect.objectContaining({ forName: "Ben", reason: "left" })]);
    await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.cleo });
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: false }));
    // Back again: both plants grow, and the garden takes no new one until there's room.
    expect((await anasPlant()).plants.map((p) => p.forName).sort()).toEqual(["Ben", "Cleo"]);
    await expect((await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.dan })).rejects.toThrow(/no free plot/);
  });

  test("the plants of someone who left disappear from other people's views", async () => {
    await anaPlantsForBen();
    await t.run((ctx) => ctx.db.patch(team.ana, { deactivated: true }));
    expect(await (await as(team.ben)).query(api.gardens.forMe, { today: today() })).toEqual([]);
    expect(await (await as(team.cleo)).query(api.gardens.of, { memberId: team.ana })).toBeNull();
  });

  test("removing a member deletes their garden; plants grown for them become memories", async () => {
    await anaPlantsForBen();
    await message("UBEN", `<@UCLEO> :taco: ${STORY}`); // Ben plays too
    await t.run(async (ctx) => {
      // Ben's own garden, straight into the table: his level doesn't matter here.
      await ctx.db.insert("plants", { workspaceId: team.workspaceId, ownerId: team.ben, forId: team.cleo, species: "kind_maple", plantedAt: Date.now(), plantedDay: today(), pickedThrough: today(), announced: 0 });
    });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    const plants = await t.run((ctx) => ctx.db.query("plants").collect());
    expect(plants).toEqual([expect.objectContaining({ ownerId: team.ana, memoryReason: "left" })]);
    expect((await anasPlant()).memories).toEqual([expect.objectContaining({ forName: "a teammate who left", reason: "left" })]);
  });
});

describe("Gardener skills", () => {
  test("can be taken now, and More plots opens a second plot", async () => {
    await anaReachesLevel3();
    const ana = await as(team.ana);
    await ana.mutation(api.skills.take, { skill: "more_plots" });
    expect(await anasPlant()).toMatchObject({ plots: 2 });
    await ana.mutation(api.gardens.plant, { teammateId: team.ben });
    await ana.mutation(api.gardens.plant, { teammateId: team.cleo });
    expect((await anasPlant()).plants).toHaveLength(2);
  });

  test("after a reset shrinks the garden, the plants stay until uprooted, and nothing new is planted until there's room", async () => {
    await anaReachesLevel3();
    const ana = await as(team.ana);
    await ana.mutation(api.skills.take, { skill: "more_plots" });
    await ana.mutation(api.gardens.plant, { teammateId: team.ben });
    await ana.mutation(api.gardens.plant, { teammateId: team.cleo });
    await t.run((ctx) => ctx.db.patch(team.ana, { coinsAdjusted: 100 }));
    await ana.mutation(api.skills.reset, { cost: 50 });
    expect(await anasPlant()).toMatchObject({ plots: 1, plants: [expect.anything(), expect.anything()] });
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.dan })).rejects.toThrow(/no free plot/);
  });

  test("Plant picker lets you choose among the common species; Rare species isn't in it without the skill", async () => {
    await anaReachesLevel3();
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { skills: { more_plots: 1, plant_picker: 1 } });
    });
    const ana = await as(team.ana);
    expect((await anasPlant()).species.map((s) => s.id)).toContain("helpful_oak");
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.ben, species: "golden_willow" })).rejects.toThrow(/plant picker/);
    await ana.mutation(api.gardens.plant, { teammateId: team.ben, species: "helpful_oak" });
    expect((await anasPlant()).plants[0]).toMatchObject({ speciesName: "Helpful oak" });
  });
});

describe("App Home and /kudos level: a garden summary", () => {
  test("how many plants grow and how many are dormant", async () => {
    await anaPlantsForBen();
    const home = () => t.query(internal.slackData.homeData, { workspaceId: team.workspaceId, slackUserId: "UANA" });
    expect((await home())!.game).toMatchObject({ garden: { plants: 1, dormant: 0 } });
    jumpTo("2027-01-10");
    expect((await home())!.game).toMatchObject({ garden: { plants: 1, dormant: 1 } });
  });
});

describe("review fixes", () => {
  test("a teammate's garden shows no dates or counts, and takes no day to ask about", async () => {
    await anaPlantsForBen();
    jumpTo("2026-09-28");
    await thank("UBEN");
    const cleo = await as(team.cleo);
    const now = await cleo.query(api.gardens.of, { memberId: team.ana });
    for (const plant of now!.plants) expect(Object.keys(plant).sort()).toEqual(["canTakeDown", "dormant", "forYou", "lantern", "plantId", "species", "speciesName", "stage", "stageName"]);
    expect(JSON.stringify(now)).not.toMatch(/2026-/); // no day of any kind
  });

  test("a teammate who leaves doesn't give their plant away: others still see it in the garden", async () => {
    await anaPlantsForBen();
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
    const seen = await (await as(team.cleo)).query(api.gardens.of, { memberId: team.ana });
    expect(seen!.plants).toHaveLength(1);
  });

  test("someone who hides the game hides their garden from others too", async () => {
    await anaPlantsForBen();
    await (await as(team.ana)).mutation(api.game.setHidden, { hidden: true });
    expect(await (await as(team.cleo)).query(api.gardens.of, { memberId: team.ana })).toBeNull();
    expect(await (await as(team.ben)).query(api.gardens.forMe, { today: today() })).toEqual([]);
  });

  test("with Early bloom a seed sprouts at 3 days on its own, and the owner hears of it", async () => {
    await anaReachesLevel3();
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { skills: { more_plots: 1, early_bloom: 1 } });
    });
    await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.ben });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(dayKeyFor(Date.now(), "Europe/Berlin")).toBe("2026-09-27");
    const [dm] = await stageDms(team.ana);
    expect(dm.gains).toContainEqual(expect.objectContaining({ kind: "plant_stage", stage: "Sprout" }));
  });

  test("kudos while a plant waits on its age schedule one look, not one each", async () => {
    await anaReachesLevel3();
    jumpTo("2026-09-27");
    await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.ben });
    jumpTo("2026-09-28");
    for (let i = 0; i < 4; i++) await thank("UBEN");
    const looks = (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).filter((f) => f.name.includes("checkGrowth") && f.state.kind === "pending");
    expect(looks).toHaveLength(1);
  });

  test("the planting window is the same in the picker and when planting: from the start of the day 7 days ago", async () => {
    jumpTo("2026-09-16", 22); // 00:00 in Berlin on the 17th is 22:00 UTC on the 16th
    await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
    jumpTo("2026-09-17");
    await message("UANA", `<@UCLEO> <@UDAN> <@UEVE> :taco: ${STORY}`);
    jumpTo("2026-09-24", 20); // 7 days and ~22 hours after the kudos to Ben, the same day 7 days on
    await message("UANA", `<@UCLEO> <@UDAN> :taco: ${STORY}`); // level 3 now
    const offered = (await anasPlant()).candidates.map((c) => c.name);
    expect(offered).toContain("Ben");
    await (await as(team.ana)).mutation(api.gardens.plant, { teammateId: team.ben });
  });

  test("the planted-for-you DM is game UI on the web: labelled Garden, and gone while the game is hidden", async () => {
    await anaPlantsForBen();
    const ben = await as(team.ben);
    const shown = (await ben.query(api.me.overview, { period: "month", today: today() })).botMessages;
    expect(shown).toContainEqual(expect.objectContaining({ category: "garden", gainLabel: "Garden" }));
    await ben.mutation(api.game.setHidden, { hidden: true });
    const hidden = (await ben.query(api.me.overview, { period: "month", today: today() })).botMessages;
    expect(hidden.some((m) => m.category === "garden")).toBe(false);
  });

  test("a second pick right after the first finds nothing", async () => {
    await anaGrowsBensPlant();
    jumpTo("2026-11-12");
    const ana = await as(team.ana);
    expect((await ana.mutation(api.gardens.pick, {})).fruit).toBe(3);
    expect(await ana.mutation(api.gardens.pick, {})).toEqual({ coins: 0, xp: 0, fruit: 0 });
  });

  test("never across workspaces", async () => {
    await anaPlantsForBen();
    const other = await seedTeam(t, { gameEnabled: true }, "T2");
    await expect((await as(team.ana)).mutation(api.gardens.plant, { teammateId: other.ben })).rejects.toThrow();
    expect(await (await as(other.cleo)).query(api.gardens.of, { memberId: team.ana })).toBeNull();
  });
});

describe("plots: each plant keeps its key bed on the map (#129)", () => {
  test("uprooting one leaves the others where they stand, and the next plant takes the free plot", async () => {
    await anaReachesLevel3();
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { skills: { more_plots: 2 } });
      await ctx.db.patch(team.ana, { coinsAdjusted: 50 });
    });
    const ana = await as(team.ana);
    await ana.mutation(api.gardens.plant, { teammateId: team.ben });
    await ana.mutation(api.gardens.plant, { teammateId: team.cleo });
    const plots = async () => Object.fromEntries((await garden(team.ana))!.plants.map((p) => [p.forName, p.plot]));
    expect(await plots()).toEqual({ Ben: 0, Cleo: 1 });
    const ben = (await garden(team.ana))!.plants.find((p) => p.forName === "Ben")!;
    await ana.mutation(api.gardens.uproot, { plantId: ben.plantId });
    expect(await plots()).toEqual({ Cleo: 1 });
    await ana.mutation(api.gardens.plant, { teammateId: team.dan });
    expect(await plots()).toEqual({ Cleo: 1, Dan: 0 });
  });

  test("planting in the plot you opened: it grows there; a taken or missing plot is refused (review #1)", async () => {
    await anaReachesLevel3();
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { skills: { more_plots: 2 } }); // 3 plots
      await ctx.db.patch(team.ana, { coinsAdjusted: 50 });
    });
    const ana = await as(team.ana);
    await ana.mutation(api.gardens.plant, { teammateId: team.ben, plot: 2 });
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.cleo, plot: 2 })).rejects.toThrow(/already growing in that plot/);
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.cleo, plot: 3 })).rejects.toThrow(/isn't one of your plots/);
    await expect(ana.mutation(api.gardens.plant, { teammateId: team.cleo, plot: 0.5 })).rejects.toThrow(/isn't one of your plots/);
    await ana.mutation(api.gardens.plant, { teammateId: team.cleo, plot: 0 });
    expect(Object.fromEntries((await garden(team.ana))!.plants.map((p) => [p.forName, p.plot]))).toEqual({ Ben: 2, Cleo: 0 });
  });

  test("plants from before plots were kept get their plot written down on the next change, so they don't move (review #4)", async () => {
    await anaReachesLevel3();
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { skills: { more_plots: 2 } });
      await ctx.db.patch(team.ana, { coinsAdjusted: 50 });
    });
    const ana = await as(team.ana);
    await ana.mutation(api.gardens.plant, { teammateId: team.ben });
    await ana.mutation(api.gardens.plant, { teammateId: team.cleo });
    // As if planted before #129: no plot stored.
    await t.run(async (ctx) => {
      for (const p of await ctx.db.query("plants").collect()) await ctx.db.patch(p._id, { plot: undefined });
    });
    const ben = (await garden(team.ana))!.plants.find((p) => p.forName === "Ben")!;
    await ana.mutation(api.gardens.uproot, { plantId: ben.plantId });
    expect((await garden(team.ana))!.plants.map((p) => [p.forName, p.plot])).toEqual([["Cleo", 1]]);
  });
});
