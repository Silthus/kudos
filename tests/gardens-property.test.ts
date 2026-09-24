import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { mulberry32 } from "../convex/lib/random";
import { seedTeam, setupConvex, signInAs } from "./helpers";

/**
 * Gardens property test: random timelines of thoughtful, thin and thank-back kudos, admin revokes and
 * fruit picking go through the real Slack and web paths. After every step each plant's waterings and
 * stage must match an independent recompute written straight from the spec's G8 table, a plant never
 * is dormant exactly 60 days after its last watering, holds more fruit than it may, fruit never pays more than 14 Hog coins and 21 XP in a quest week,
 * and the ledger adds up (stored coins = the events' coins, fruit coins = the harvests' coins). A
 * game rebuild keeps every fruit picked. (That a dormant spell adds at most 60 days to the age only
 * matters for Ancient, a year away; the unit test in lib/garden.test.ts pins it.)
 */

afterEach(() => vi.useRealTimers());

const DAY = 24 * 3_600_000;
const STORY = "thanks for the careful review of the release notes";
/** The spec's table (#55 §G8): waterings and minimum days for each stage. */
const TABLE: [string, number, number][] = [
  ["seed", 0, 0],
  ["sprout", 1, 3],
  ["sapling", 2, 7],
  ["young", 4, 21],
  ["grown", 6, 45],
  ["blossoming", 10, 90],
  ["ancient", 20, 365],
];

const dayNumber = (dayKey: string) => Date.parse(`${dayKey}T00:00:00Z`) / DAY;
/** Monday of a day, as a day number (1970-01-01 was a Thursday). */
const weekOf = (dayKey: string) => {
  const n = dayNumber(dayKey);
  return n - ((n + 3) % 7);
};

/** Waterings straight from the rule: the first thoughtful non-thank-back kudos in each later week. */
function expectedWaterings(plant: Doc<"plants">, kudos: Doc<"kudos">[]) {
  const given = kudos.filter((k) => k.giverId === plant.ownerId && k.receiverId === plant.forId && k.at > plant.plantedAt).sort((a, b) => a.at - b.at);
  const back = kudos.filter((k) => k.giverId === plant.forId && k.receiverId === plant.ownerId);
  const weeks = new Map<number, string>();
  for (const k of given) {
    const week = weekOf(k.dayKey);
    if (week <= weekOf(plant.plantedDay) || weeks.has(week)) continue;
    if ((k.noteWords ?? 0) < 3) continue;
    if (back.some((b) => b.at < k.at && b.at > k.at - 72 * 3_600_000)) continue;
    weeks.set(week, k.dayKey);
  }
  return [...weeks.values()].sort();
}

/** The stage straight from the table: waterings so far and days awake (a gap counts at most 60). */
function expectedStage(plantedDay: string, waterings: string[], today: string) {
  let awake = 0;
  let prev = dayNumber(plantedDay);
  for (const w of waterings) {
    awake += Math.min(dayNumber(w) - prev, 60);
    prev = dayNumber(w);
  }
  awake += Math.min(dayNumber(today) - prev, 60);
  let stage = "seed";
  for (const [key, need, days] of TABLE) if (waterings.length >= need && awake >= days) stage = key;
  return stage;
}

async function run(seed: number) {
  const rnd = mulberry32(seed);
  const t = setupConvex();
  const team = await seedTeam(t, { gameEnabled: true, questsEnabled: false, dailyLimit: 20 });
  const extra = (slackUserId: string, name: string) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
  const dan = await extra("UDAN", "Dan");
  const people = [
    { id: team.ben, slack: "UBEN" },
    { id: team.cleo, slack: "UCLEO" },
    { id: dan, slack: "UDAN" },
  ];
  let ts = 1;
  const message = async (giver: string, text: string) => {
    await t.mutation(internal.kudos.ingestMessage, {
      workspaceId: team.workspaceId,
      botUserId: "UBOT",
      giverSlackId: giver,
      text,
      channelId: "CGENERAL",
      channelName: "general",
      messageTs: `${ts++}.0001`,
    });
    vi.setSystemTime(Date.now() + 60_000);
  };
  const ana = await signInAs(t, team.ana);
  let todayKey = "2026-09-23";
  const today = () => todayKey; // every step runs at 10:00 UTC: the same day in Berlin

  // Ana plays, has room for three plants (and maybe holds four fruit), and plants for everyone.
  await message("UANA", `<@UBEN> <@UCLEO> <@UDAN> :taco: ${STORY}`);
  await t.run(async (ctx) => {
    const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
    await ctx.db.patch(p!._id, { level: 12, skills: { more_plots: 2, ...(rnd() < 0.5 ? { good_harvest: 1 } : {}) } });
    await ctx.db.patch(team.ana, { coinsAdjusted: 100 });
  });
  const hold = (await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique()))!.skills?.good_harvest ? 4 : 3;
  for (const p of people) await ana.mutation(api.gardens.plant, { teammateId: p.id });
  let revoked = 0;
  let sawDormant = false;
  // One teammate goes unthanked for 70 to 90 days somewhere in the middle: their plant falls dormant.
  const quiet = { who: people[Math.floor(rnd() * people.length)].slack, from: 40 + Math.floor(rnd() * 20), days: 70 + Math.floor(rnd() * 20) };

  for (let day = 0; day < 160; day++) {
    todayKey = new Date(Date.UTC(2026, 8, 24 + day)).toISOString().slice(0, 10);
    vi.setSystemTime(new Date(`${todayKey}T10:00:00Z`));
    for (const p of people) {
      const r = rnd();
      if (p.slack === quiet.who && day >= quiet.from && day < quiet.from + quiet.days) continue;
      if (r < 0.12) await message("UANA", `<@${p.slack}> :taco: ${STORY}`);
      else if (r < 0.16) await message("UANA", `<@${p.slack}> :taco:`); // no reason: never waters
      else if (r < 0.19) await message(p.slack, `<@UANA> :taco: ${STORY}`); // makes Ana's next one a thank-back
    }
    if (rnd() < 0.05) {
      const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
      const mine = rows.filter((k) => k.giverId === team.ana);
      if (mine.length > 0) {
        await ana.mutation(api.admin.revoke, { kudosId: mine[Math.floor(rnd() * mine.length)]._id });
        revoked++;
      }
    }
    if (rnd() < 0.3) await ana.mutation(api.gardens.pick, {});

    const garden = await ana.query(api.gardens.mine, { today: today() });
    if (!garden?.open) throw new Error("the garden should be open");
    const [plants, kudos] = await t.run(async (ctx) => [await ctx.db.query("plants").collect(), await ctx.db.query("kudos").collect()] as const);
    for (const shown of garden.plants) {
      const plant = plants.find((p) => p._id === shown.plantId)!;
      const waterings = expectedWaterings(plant, kudos);
      expect(shown.waterings).toBe(waterings.length);
      expect(shown.stage).toBe(expectedStage(plant.plantedDay, waterings, today()));
      expect(shown.dormant).toBe(dayNumber(today()) - dayNumber(waterings.at(-1) ?? plant.plantedDay) >= 60);
      if (shown.dormant) sawDormant = true;
      expect(shown.fruit.length).toBeLessThanOrEqual(hold);
      expect(shown.fruit.every((f) => f.coins === 1 || f.coins === 2)).toBe(true);
    }
  }

  // Fruit never paid more than its weekly caps, and the ledger adds up.
  const events = await t.run((ctx) => ctx.db.query("gameEvents").collect());
  const harvests = events.filter((e) => e.kind === "harvest");
  const byWeek = new Map<number, { coins: number; xp: number }>();
  for (const h of harvests) {
    const w = byWeek.get(weekOf(h.dayKey)) ?? { coins: 0, xp: 0 };
    byWeek.set(weekOf(h.dayKey), { coins: w.coins + (h.coins ?? 0), xp: w.xp + h.xp });
  }
  for (const w of byWeek.values()) {
    expect(w.coins).toBeLessThanOrEqual(14);
    expect(w.xp).toBeLessThanOrEqual(21);
  }
  const player = (await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique()))!;
  const fruitCoins = harvests.reduce((s, h) => s + (h.coins ?? 0), 0);
  expect(player.fruitCoins ?? 0).toBe(fruitCoins);
  const verify = await t.query(internal.game.verifyMember, { memberId: team.ana as Id<"members"> });
  expect(verify.coins).toBe(verify.eventCoins);
  expect(verify.stored).toBe(verify.events);

  // A rebuild replays the kudos and keeps every fruit picked.
  await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
  const rebuilt = (await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique()))!;
  expect(rebuilt.fruitCoins ?? 0).toBe(fruitCoins);
  const after = await t.run((ctx) => ctx.db.query("gameEvents").collect());
  expect(after.filter((e) => e.kind === "harvest")).toHaveLength(harvests.length);
  if (revoked === 0) expect(rebuilt).toMatchObject({ xp: player.xp, coins: player.coins });
  return { harvests: harvests.length, fruitCoins, revoked, sawDormant };
}

describe("gardens under random watering, revoke and picking timelines", () => {
  test.each([1, 2, 3, 4, 5])("seed %i", async (seed) => {
    const outcome = await run(seed);
    // The timelines are long enough that fruit is actually picked.
    expect(outcome.harvests).toBeGreaterThan(0);
    expect(outcome.sawDormant).toBe(true);
  }, 120_000);
});
