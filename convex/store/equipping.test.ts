import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { internal } from "../_generated/api";
import { runCommand, type Command } from "../commands/commands";
import { lookup, type MemberId } from "../workspace/directory";
import { grantItem } from "./inventory";
import type { Slot } from "./rows";

const openedAt = Date.parse("2026-10-14T10:00:00Z");
const hedgehog = "kudos-emoji-hedgehog";
const rocket = "kudos-emoji-rocket";
const ribbon = "kudos-emoji-ribbon";
const gem = "kudos-emoji-gem";
const storeOn = ["xp-levels", "unlocks", "coins", "store"].map(onForEveryone);

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: openedAt });
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ST7 ST27: equip and takeOff through D17, as the website calls them", () => {
  test("equip puts an owned emoji in a slot, replacing what was there, and answers equipped", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { owning: [rocket] });

    expect(await run(t, member, { type: "equip", item: rocket, slot: "emoji-1" })).toEqual({ kind: "equipped", slot: "emoji-1", item: rocket });

    expect(await slotsOf(t, member)).toEqual([rocket, null, null]);
  });

  test("takeOff empties the slot, and the first change writes all three slots, so a taken-out starter stays out", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn);

    expect(await run(t, member, { type: "takeOff", slot: "emoji-1" })).toEqual({ kind: "takenOff", slot: "emoji-1" });

    expect(await slotsOf(t, member)).toEqual([null, null, null]);
    expect(await loadoutRowsOf(t, member)).toEqual([
      { slot: "emoji-1", item: null },
      { slot: "emoji-2", item: null },
      { slot: "emoji-3", item: null },
    ]);
  });

  test("an emoji already in another slot moves, so the slot it left is empty", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn);

    expect(await run(t, member, { type: "equip", item: hedgehog, slot: "emoji-3" })).toEqual({ kind: "equipped", slot: "emoji-3", item: hedgehog });

    expect(await slotsOf(t, member)).toEqual([null, null, hedgehog]);
  });

  test("the same command twice leaves the same loadout and answers the same", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { owning: [rocket] });
    const equipRocket: Command = { type: "equip", item: rocket, slot: "emoji-2" };
    const takeOffFirst: Command = { type: "takeOff", slot: "emoji-1" };

    const answers = [await run(t, member, equipRocket), await run(t, member, equipRocket), await run(t, member, takeOffFirst), await run(t, member, takeOffFirst)];

    expect(answers).toEqual([
      { kind: "equipped", slot: "emoji-2", item: rocket },
      { kind: "equipped", slot: "emoji-2", item: rocket },
      { kind: "takenOff", slot: "emoji-1" },
      { kind: "takenOff", slot: "emoji-1" },
    ]);
    expect(await loadoutRowsOf(t, member)).toEqual([
      { slot: "emoji-1", item: null },
      { slot: "emoji-2", item: rocket },
      { slot: "emoji-3", item: null },
    ]);
  });

  test("a command that changes nothing writes no loadout", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn);

    await run(t, member, { type: "equip", item: hedgehog, slot: "emoji-1" });
    await run(t, member, { type: "takeOff", slot: "emoji-2" });

    expect(await loadoutRowsOf(t, member)).toEqual([]);
  });

  test.each([
    ["a store emoji they haven't bought", rocket],
    ["a silver tier's emoji they haven't earned", ribbon],
    ["an unknown ID", "kudos-emoji-unicorn"],
  ])("equip of %s is refused not-owned and changes nothing", async (_, item) => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { owning: [gem] });

    expect(await run(t, member, { type: "equip", item, slot: "emoji-2" })).toEqual({ kind: "refused", reason: "not-owned" });

    expect(await loadoutRowsOf(t, member)).toEqual([]);
  });

  test.each<[string, Command]>([
    ["equip", { type: "equip", item: hedgehog, slot: "emoji-2" }],
    ["takeOff", { type: "takeOff", slot: "emoji-1" }],
  ])("with the store shown and Coins unopened, %s is refused coins-not-open, first of all, and changes nothing", async (_, command) => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { opening: [] });

    expect(await run(t, member, command)).toEqual({ kind: "refused", reason: "coins-not-open" });

    expect(await loadoutRowsOf(t, member)).toEqual([]);
  });

  test.each([
    ["the store is off", [...["xp-levels", "unlocks", "coins"].map(onForEveryone), offForEveryone("store")]],
    ["the store isn't created", ["xp-levels", "unlocks", "coins"].map(onForEveryone)],
    ["coins are off", [...["xp-levels", "unlocks", "store"].map(onForEveryone), offForEveryone("coins")]],
  ])("where %s, equip and takeOff answer null and write nothing", async (_, definitions) => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { owning: [rocket] });
    await flagsFromPostHog(t, postHog, ...definitions);

    expect(await run(t, member, { type: "equip", item: rocket, slot: "emoji-2" })).toBeNull();
    expect(await run(t, member, { type: "takeOff", slot: "emoji-1" })).toBeNull();

    expect(await loadoutRowsOf(t, member)).toEqual([]);
  });

  test("turning the store off and on again shows the same loadout", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { owning: [rocket] });
    await run(t, member, { type: "equip", item: rocket, slot: "emoji-3" });

    await flagsFromPostHog(t, postHog, ...["xp-levels", "unlocks", "coins"].map(onForEveryone), offForEveryone("store"));
    expect(await t.query(internal.store.inventory.inventoryOf, { member })).toBeNull();
    await flagsFromPostHog(t, postHog, ...storeOn);

    expect(await slotsOf(t, member)).toEqual([hedgehog, null, rocket]);
  });
});

describe("ST7: every slot holds an owned item", () => {
  test("after any sequence of grants, equips and take-offs", async () => {
    await afterEachStepOfASequence(({ slotted, owned }, step) => {
      expect(slotted.filter((item) => !owned.has(item)), `a slot holding an item not owned after step ${step}`).toEqual([]);
    });
  });
});

describe("ST7: an item fills at most one slot", () => {
  test("after any sequence of grants, equips and take-offs", async () => {
    await afterEachStepOfASequence(({ slotted }, step) => {
      expect(slotted.filter((item, index) => slotted.indexOf(item) !== index), `an item in two slots after step ${step}`).toEqual([]);
    });
  });
});

type LoadoutAfterStep = { slotted: string[]; owned: Set<string> };

async function afterEachStepOfASequence(check: (loadout: LoadoutAfterStep, step: number) => void) {
  const { t, member } = await memberWhoOpenedCoins(storeOn);
  const items = [hedgehog, rocket, gem, ribbon, "kudos-emoji-unicorn"];
  const slots: Slot[] = ["emoji-1", "emoji-2", "emoji-3"];
  const random = seeded(343);
  const pick = <T>(from: readonly T[]) => from[Math.floor(random() * from.length)]!;

  for (let step = 0; step < 60; step += 1) {
    const roll = random();
    if (roll < 0.15) await t.run((ctx) => grantItem(ctx, { member, item: pick([rocket, gem, ribbon]), source: "store", arrivedAt: openedAt }));
    else if (roll < 0.75) await run(t, member, { type: "equip", item: pick(items), slot: pick(slots) });
    else await run(t, member, { type: "takeOff", slot: pick(slots) });

    const inventory = (await t.query(internal.store.inventory.inventoryOf, { member }))!;
    check({ slotted: inventory.slots.flatMap(({ item }) => (item === null ? [] : [item])), owned: new Set(inventory.owned.map(({ item }) => item)) }, step);
  }
}

async function run(t: Backend, member: MemberId, command: Command) {
  return t.run(async (ctx) => {
    const person = await lookup(ctx, "T1", (await ctx.db.get(member))!.user);
    if (person?.kind !== "member") throw new Error("not a member");
    return runCommand(ctx, "T1", person, command, "website:juno:1");
  });
}

async function slotsOf(t: Backend, member: MemberId) {
  const inventory = await t.query(internal.store.inventory.inventoryOf, { member });
  return inventory?.slots.map(({ item }) => item);
}

async function loadoutRowsOf(t: Backend, member: MemberId) {
  const rows = (await t.run((ctx) => ctx.db.query("loadouts").collect())).filter((row) => row.member === member);
  return rows.map(({ slot, item }) => ({ slot, item })).sort((a, b) => a.slot.localeCompare(b.slot));
}

async function memberWhoOpenedCoins(definitions: FlagDefinition[], { owning = [] as string[], opening = ["coins"] as Array<"coins"> } = {}) {
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
  const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_JUNO", kind: "member", asOf: 0 }));
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  for (const feature of opening) await opens(t, member, feature);
  for (const item of owning) await t.run((ctx) => grantItem(ctx, { member, item, source: "store", arrivedAt: openedAt }));
  return { t, member };
}

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
}
