import { beforeEach, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * The neighbours' ring round your garden (#129): one bed per teammate with plants, the teammates you
 * exchanged the most kudos with nearest. A light read: all-time pair totals, then each teammate's
 * growing plants, never whom they're for.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team & Record<"dan" | "eve" | "fay" | "gus" | "hal", Id<"members">>;

beforeEach(async () => {
  t = setupConvex();
  const base = await seedTeam(t, { gameEnabled: true });
  const extra = (slackUserId: string, name: string, more: Partial<Doc<"members">> = {}) =>
    t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: base.workspaceId, slackUserId, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0, ...more }),
    );
  team = {
    ...base,
    dan: await extra("UDAN", "Dan"),
    eve: await extra("UEVE", "Eve"),
    fay: await extra("UFAY", "Fay", { gameHidden: true }),
    gus: await extra("UGUS", "Gus", { deactivated: true }),
    hal: await extra("UHAL", "Hal"),
  };
});

async function exchanged(giverId: Id<"members">, receiverId: Id<"members">, amount: number) {
  await t.run((ctx) => ctx.db.insert("pairStats", { workspaceId: team.workspaceId, bucket: "all", giverId, receiverId, amount }));
}
async function plant(ownerId: Id<"members">, forId: Id<"members">, species: string, announced: number, memoryAt?: number) {
  await t.run((ctx) =>
    ctx.db.insert("plants", { workspaceId: team.workspaceId, ownerId, forId, species, plantedAt: 1, plantedDay: "2026-01-01", pickedThrough: "2026-01-01", announced, memoryAt }),
  );
}

test("teammates with plants, most kudos exchanged first (both ways), each with their tallest plant; never whom it's for", async () => {
  await exchanged(team.ana, team.ben, 2);
  await exchanged(team.cleo, team.ana, 5);
  await exchanged(team.ana, team.dan, 1);
  await exchanged(team.dan, team.ana, 1);
  await exchanged(team.ana, team.fay, 9); // hides the game
  await exchanged(team.gus, team.ana, 9); // left
  await exchanged(team.ana, team.hal, 9); // nothing planted
  await plant(team.ben, team.ana, "patient_pine", 1);
  await plant(team.ben, team.cleo, "kind_maple", 4);
  await plant(team.cleo, team.dan, "helpful_oak", 2);
  await plant(team.cleo, team.ben, "golden_willow", 6, 1000); // a memory
  await plant(team.dan, team.eve, "curious_fern", 0);
  await plant(team.eve, team.ana, "helpful_oak", 3); // no kudos between Ana and Eve
  await plant(team.fay, team.ana, "helpful_oak", 3);
  await plant(team.gus, team.ana, "helpful_oak", 3);

  const ana = await signInAs(t, team.ana);
  const ring = await ana.query(api.gardens.neighbours, {});
  expect(ring).toEqual([
    { memberId: team.cleo, name: "Cleo", plants: 1, top: { species: "helpful_oak", stage: "sapling" } },
    { memberId: team.ben, name: "Ben", plants: 2, top: { species: "kind_maple", stage: "grown" } },
    { memberId: team.dan, name: "Dan", plants: 1, top: { species: "curious_fern", stage: "seed" } },
  ]);
});

test("never a bot, nor anyone from another workspace", async () => {
  const other = await seedTeam(t, { gameEnabled: true }, "T2");
  await exchanged(team.ana, team.bot, 9);
  await exchanged(team.ana, other.ben, 9);
  await plant(team.bot, team.ben, "helpful_oak", 1);
  await t.run((ctx) =>
    ctx.db.insert("plants", { workspaceId: other.workspaceId, ownerId: other.ben, forId: other.cleo, species: "helpful_oak", plantedAt: 1, plantedDay: "2026-01-01", pickedThrough: "2026-01-01", announced: 1 }),
  );
  expect(await (await signInAs(t, team.ana)).query(api.gardens.neighbours, {})).toEqual([]);
});

test("only the closest sixty teammates are looked at: the ring stays a light read at any size", async () => {
  for (let i = 0; i < 70; i++) {
    const id = await t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: `U${i}`, name: `Mate ${String(i).padStart(2, "0")}`, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
    await exchanged(team.ana, id, 200 - i);
    if (i >= 65) await plant(id, team.ben, "helpful_oak", 1); // only the least close have gardens
  }
  expect(await (await signInAs(t, team.ana)).query(api.gardens.neighbours, {})).toEqual([]);
});

test("nobody while the game is off or hidden for you", async () => {
  await exchanged(team.ana, team.ben, 2);
  await plant(team.ben, team.cleo, "kind_maple", 4);
  await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
  expect(await (await signInAs(t, team.ana)).query(api.gardens.neighbours, {})).toEqual([]);
});

test("at most twenty beds", async () => {
  for (let i = 0; i < 24; i++) {
    const id = await t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: `U${i}`, name: `Mate ${String(i).padStart(2, "0")}`, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
    await exchanged(team.ana, id, 100 - i);
    await plant(id, team.ben, "helpful_oak", 1);
  }
  const ring = await (await signInAs(t, team.ana)).query(api.gardens.neighbours, {});
  expect(ring).toHaveLength(20);
  expect(ring[0].name).toBe("Mate 00");
  expect(ring[19].name).toBe("Mate 19");
});
