import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/** The garden boosters (#97, §G10): the Sunlamp and the Lantern, bought in the Store and used in gardens. */

let t: ReturnType<typeof setupConvex>;
let team: Team;

const SUNDAY = new Date("2026-09-20T10:00:00Z");
const MONDAY = new Date("2026-09-21T10:00:00Z");
const DAY = 24 * 3_600_000;

beforeEach(async () => {
  t = setupConvex();
  vi.setSystemTime(SUNDAY);
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
});
afterEach(() => vi.useRealTimers());

const today = () => new Date(Date.now()).toISOString().slice(0, 10); // Berlin is UTC+2: same day at 10:00 UTC
const as = (memberId: Id<"members">) => signInAs(t, memberId);

/** `memberId` at level 5 with `balance` Hog coins to spend. */
async function playerWith(memberId: Id<"members">, balance: number) {
  await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: SUNDAY.getTime() - DAY, xp: 350, level: 5, coins: balance - 40 }));
}

/** Ana's plant for Ben, planted on Sunday: a watering on Monday (the next quest week) makes it wait on age alone. */
async function anasPlantForBen() {
  return await t.run((ctx) =>
    ctx.db.insert("plants", {
      workspaceId: team.workspaceId,
      ownerId: team.ana,
      forId: team.ben,
      species: "helpful_oak",
      plantedAt: SUNDAY.getTime(),
      plantedDay: "2026-09-20",
      pickedThrough: "2026-09-20",
      announced: 0,
    }),
  );
}

async function water() {
  await t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: "UANA",
    text: "<@UBEN> :taco: thanks for the thorough review",
    channelId: "CGENERAL",
    messageTs: `${Date.now() / 1000}`,
  });
}

async function buy(memberId: Id<"members">, item: string) {
  const member = await as(memberId);
  const shop = await member.query(api.store.shop, { today: today() });
  if (shop.access !== "open") throw new Error(shop.access);
  const { price } = shop.items.find((i) => i.key === item)!;
  return await member.mutation(api.store.buyItem, { item, expectedPrice: price });
}

const myPlant = async (memberId: Id<"members">) => (await (await as(memberId)).query(api.gardens.mine, { today: today() }))!;

describe("the Sunlamp", () => {
  test("is bought in the Store and kept until it's used", async () => {
    await playerWith(team.ana, 100);
    expect(await buy(team.ana, "sunlamp")).toEqual({ balance: 85 });
    expect(await (await as(team.ana)).query(api.game.mine, {})).toMatchObject({ sunlamps: 1 });
  });

  test("skips 5 days of a plant's minimum-age wait: a Seed waiting on age sprouts at once", async () => {
    await playerWith(team.ana, 100);
    const plantId = await anasPlantForBen();
    vi.setSystemTime(MONDAY);
    await water(); // one watering, one day old: a Sprout needs 3 days
    await buy(team.ana, "sunlamp");
    let garden = await myPlant(team.ana);
    if (!garden.open) throw new Error("closed");
    expect(garden.plants[0]).toMatchObject({ plantId, stage: "seed", sunlamp: true });
    await (await as(team.ana)).mutation(api.gardens.useSunlamp, { plantId });
    garden = await myPlant(team.ana);
    if (!garden.open) throw new Error("closed");
    expect(garden.plants[0]).toMatchObject({ stage: "sprout", sunlamp: false, awakeDays: 6 }); // 1 day + 5 from the lamp (review #3)
    expect(await (await as(team.ana)).query(api.game.mine, {})).toMatchObject({ sunlamps: 0 });
  });

  test("never stands in for a watering, and only works in your own garden", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.cleo, 100);
    const plantId = await anasPlantForBen(); // no watering yet
    await buy(team.ana, "sunlamp");
    await expect((await as(team.ana)).mutation(api.gardens.useSunlamp, { plantId })).rejects.toThrow(/watering/);
    await buy(team.cleo, "sunlamp");
    await expect((await as(team.cleo)).mutation(api.gardens.useSunlamp, { plantId })).rejects.toThrow(/your garden/);
    expect(await (await as(team.ana)).query(api.game.mine, {})).toMatchObject({ sunlamps: 1 });
  });

  test("needs one bought first", async () => {
    await playerWith(team.ana, 100);
    const plantId = await anasPlantForBen();
    vi.setSystemTime(MONDAY);
    await water();
    await expect((await as(team.ana)).mutation(api.gardens.useSunlamp, { plantId })).rejects.toThrow(/Sunlamp/);
  });
});

describe("the Lantern", () => {
  const NOTE = "This oak looks great, keep it up!";

  test("hangs a one-line note on a teammate's plant, for everyone who sees it, with who hung it", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.cleo, 100);
    const plantId = await anasPlantForBen();
    await buy(team.cleo, "lantern");
    await (await as(team.cleo)).mutation(api.gardens.hangLantern, { plantId, note: `  ${NOTE}\n` });
    const lantern = { note: NOTE, by: "Cleo" };
    expect((await (await as(team.cleo)).query(api.gardens.of, { memberId: team.ana }))?.plants[0]).toMatchObject({ lantern });
    const mine = await myPlant(team.ana);
    if (!mine.open) throw new Error("closed");
    expect(mine.plants[0]).toMatchObject({ lantern });
    expect((await (await as(team.ben)).query(api.gardens.forMe, { today: today() }))?.[0]).toMatchObject({ lantern });
    expect(await (await as(team.cleo)).query(api.game.mine, {})).toMatchObject({ lanterns: 0 });
  });

  test("one line, 80 characters at most, never on your own plant, and one lit lantern a plant", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.ben, 100);
    await playerWith(team.cleo, 100);
    const plantId = await anasPlantForBen();
    await buy(team.ana, "lantern");
    await expect((await as(team.ana)).mutation(api.gardens.hangLantern, { plantId, note: NOTE })).rejects.toThrow(/teammate's plant/);
    await buy(team.cleo, "lantern");
    await buy(team.cleo, "lantern");
    const cleo = await as(team.cleo);
    await expect(cleo.mutation(api.gardens.hangLantern, { plantId, note: "   " })).rejects.toThrow(/note/);
    await expect(cleo.mutation(api.gardens.hangLantern, { plantId, note: "x".repeat(81) })).rejects.toThrow(/80/);
    await cleo.mutation(api.gardens.hangLantern, { plantId, note: NOTE });
    await expect(cleo.mutation(api.gardens.hangLantern, { plantId, note: "another" })).rejects.toThrow(/lantern glows/);
    // A lantern glows for 7 days; then the plant can take another.
    vi.setSystemTime(SUNDAY.getTime() + 7 * DAY);
    expect((await cleo.query(api.gardens.of, { memberId: team.ana }))?.plants[0].lantern).toBeNull();
    await cleo.mutation(api.gardens.hangLantern, { plantId, note: "another" });
  });

  test("the teammate it's for and admins can take a lantern down too, and it can't go straight back up (review #1)", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.cleo, 100);
    const dan = await t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: "UDAN", name: "Dan", isAdmin: true, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
    const plantId = await anasPlantForBen();
    await buy(team.cleo, "lantern");
    await buy(team.cleo, "lantern");
    const cleo = await as(team.cleo);
    await cleo.mutation(api.gardens.hangLantern, { plantId, note: NOTE });
    await (await as(team.ben)).mutation(api.gardens.takeDownLantern, { plantId });
    await expect(cleo.mutation(api.gardens.hangLantern, { plantId, note: "again" })).rejects.toThrow(/taken down/);
    vi.setSystemTime(SUNDAY.getTime() + 7 * DAY);
    await cleo.mutation(api.gardens.hangLantern, { plantId, note: "again" });
    expect((await (await as(dan)).query(api.gardens.of, { memberId: team.ana }))?.plants[0]).toMatchObject({ lantern: { note: "again" }, canTakeDown: true });
    await (await as(dan)).mutation(api.gardens.takeDownLantern, { plantId });
    expect((await cleo.query(api.gardens.of, { memberId: team.ana }))?.plants[0]).toMatchObject({ lantern: null, canTakeDown: false });
  });

  test("never from the teammate the plant is for (it would give away whose it is), nor on a plant for someone who left (review #2, #4)", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.ben, 100);
    await playerWith(team.cleo, 100);
    const plantId = await anasPlantForBen();
    await buy(team.ben, "lantern");
    await expect((await as(team.ben)).mutation(api.gardens.hangLantern, { plantId, note: NOTE })).rejects.toThrow(/grown for you/);
    await buy(team.cleo, "lantern");
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
    await expect((await as(team.cleo)).mutation(api.gardens.hangLantern, { plantId, note: NOTE })).rejects.toThrow(/isn't growing/);
  });

  test("a note of invisible characters is no note (review #6), and a lantern from someone deactivated goes out", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.cleo, 100);
    const plantId = await anasPlantForBen();
    await buy(team.cleo, "lantern");
    const cleo = await as(team.cleo);
    await expect(cleo.mutation(api.gardens.hangLantern, { plantId, note: "​‮ ​" })).rejects.toThrow(/note/);
    await cleo.mutation(api.gardens.hangLantern, { plantId, note: `hi‮ there` });
    expect((await (await as(team.ana)).query(api.gardens.of, { memberId: team.ana }))?.plants[0].lantern).toEqual({ note: "hi there", by: "Cleo" });
    await t.run((ctx) => ctx.db.patch(team.cleo, { deactivated: true }));
    expect((await (await as(team.ana)).query(api.gardens.of, { memberId: team.ana }))?.plants[0].lantern).toBeNull();
  });

  test("the plant's owner can take a lantern down", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.cleo, 100);
    const plantId = await anasPlantForBen();
    await buy(team.cleo, "lantern");
    await (await as(team.cleo)).mutation(api.gardens.hangLantern, { plantId, note: NOTE });
    await expect((await as(team.cleo)).mutation(api.gardens.takeDownLantern, { plantId })).rejects.toThrow(); // not the one who hung it
    await (await as(team.ana)).mutation(api.gardens.takeDownLantern, { plantId });
    expect((await (await as(team.cleo)).query(api.gardens.of, { memberId: team.ana }))?.plants[0].lantern).toBeNull();
  });

  test("goes out when the member who hung it is removed", async () => {
    await playerWith(team.ana, 100);
    await playerWith(team.cleo, 100);
    const plantId = await anasPlantForBen();
    await buy(team.cleo, "lantern");
    await (await as(team.cleo)).mutation(api.gardens.hangLantern, { plantId, note: NOTE });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UCLEO" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    const plant = await t.run((ctx) => ctx.db.get(plantId));
    expect(plant?.lantern).toBeUndefined();
    expect(plant?.lanternBy).toBeUndefined();
  });
});
