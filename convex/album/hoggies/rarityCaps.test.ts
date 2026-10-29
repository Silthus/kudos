import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../../testing/fakePostHog";
import { FakeSlack } from "../../../testing/fakeSlack";
import { testBackend, type Backend } from "../../../testing/slackBackend";
import { aDeploymentForWorkspace, aMember, switchWebsite } from "../../../testing/website";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { finishMondayQuest } from "../../quests/finish";
import { onboardingReward } from "../../quests/onboarding";
import { mondayCatalogueVersion } from "../../quests/mondayCatalogue";
import type { MemberId } from "../../workspace/directory";
import { earnTeamItem, earnTierItem } from "../items/achievements";
import { earnWelcomeItem } from "../items/welcome";
import { dropLevelUpHoggies } from "../levelUpHoggies";
import { openThoughtfulPack } from "../opening";
import { crateKeyOf, earnPackItemsOf } from "../packs";
import { boughtCrateKeyOf, openCrate } from "./boughtCrates";
import { catalogue, type Rarity, type WeightsName } from "./catalogue";
import { drawOf, type Drawn } from "./draw";

const now = new Date("2026-10-29T10:00:00Z");
const collecting = ["collection", "packs", "achievement-hoggies"];
const itemsOn = [...collecting, "hidden-items", "welcome-item"];
const exactlyRare = { floor: "rare", cap: "rare", weights: "base" } as const;
const cappedAtRare = { cap: "rare", weights: "base" } as const;

type Range = { floor?: Rarity; cap?: Rarity; weights?: WeightsName };
type Stored = Range & { key: string };
type ItemSource = { earns: (ctx: MutationCtx, member: MemberId) => Promise<unknown>; capped: Stored[]; today: Stored[] };

let postHog: FakePostHog;
let t: Backend;
let people = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const itemSources: Record<string, ItemSource> = {
  "a kudos pack": {
    earns: async (ctx, member) => earnPackItemsOf(ctx, (await ctx.db.get(await aPackGivenBy(ctx, member)))!),
    capped: [{ key: "thoughtful:", weights: "kudos" }],
    today: [{ key: "thoughtful:" }],
  },
  "the welcome item": {
    earns: (ctx, member) => earnWelcomeItem(ctx, "T1", member, Date.now()),
    capped: [{ key: "welcome:first", ...exactlyRare }],
    today: [{ key: "welcome:first", floor: "rare" }],
  },
  "a level up": {
    earns: (ctx, member) => dropLevelUpHoggies(ctx, { workspace: "T1", member, level: 2, at: Date.now() }),
    capped: [{ key: "level:2:1", ...cappedAtRare }, { key: "level:2:2", ...cappedAtRare }, { key: "level:2:3", ...exactlyRare }],
    today: [{ key: "level:2:1" }, { key: "level:2:2" }, { key: "level:2:3", floor: "rare" }],
  },
  "a completed team": {
    earns: (ctx, member) => earnTeamItem(ctx, { workspace: "T1", member }, { team: "hogs", name: "Hogs" }, Date.now()),
    capped: [{ key: "team:hogs", ...exactlyRare }],
    today: [{ key: "team:hogs", floor: "rare" }],
  },
  "the four milestone tiers": {
    earns: async (ctx, member) => {
      for (const tier of ["bronze", "silver", "gold", "diamond"] as const) await earnTierItem(ctx, { workspace: "T1", member }, { milestone: "people", tier }, Date.now());
    },
    capped: [
      { key: "milestone:people:bronze", floor: "uncommon", cap: "rare", weights: "base" },
      { key: "milestone:people:diamond", ...exactlyRare },
      { key: "milestone:people:gold", ...exactlyRare },
      { key: "milestone:people:silver", ...exactlyRare },
    ],
    today: [
      { key: "milestone:people:bronze", floor: "uncommon" },
      { key: "milestone:people:diamond", floor: "legendary" },
      { key: "milestone:people:gold", floor: "epic" },
      { key: "milestone:people:silver", floor: "rare" },
    ],
  },
  "an onboarding quest's hoggie": {
    earns: (ctx, member) => finishMondayQuest(ctx, "T1", member, { kind: "journey", step: "first-thanks" }, { reward: onboardingReward, catalogueVersion: mondayCatalogueVersion }, Date.now()),
    capped: [{ key: "quest:", ...cappedAtRare }],
    today: [{ key: "quest:" }],
  },
};

describe("HH41 HH42: each source stores its cap under rarity-caps", { timeout: 120_000 }, () => {
  test.each(Object.entries(itemSources))("with rarity-caps on, %s stores the numbers table's floor, cap and weights", async (_, { earns, capped }) => {
    const member = await aMemberWith(...itemsOn, "rarity-caps");

    await t.run((ctx) => earns(ctx, member));

    expect(await storedRangesOf(member), "the stored items").toEqual(capped);
  });

  test.each(Object.entries(itemSources))("with rarity-caps off, %s stores today's floor and no cap or weights", async (_, { earns, today }) => {
    const member = await aMemberWith(...itemsOn);

    await t.run((ctx) => earns(ctx, member));

    expect(await storedRangesOf(member), "the stored items").toEqual(today);
  });

  test("with rarity-caps on, a bought crate whose draw today would be above rare drops within the cap", async () => {
    const member = await aMemberWith(...collecting, "rarity-caps");
    const n = await firstBoughtCrateDrawingAboveRare(member);

    await openBoughtCrate(member, n);

    expect(await dropIn(member, boughtCrateKeyOf(n)), "the bought crate's drop").toEqual(await drawn(member, boughtCrateKeyOf(n), cappedAtRare));
  });

  test("with rarity-caps off, a bought crate drops as today, above rare when its draw lands there", async () => {
    const member = await aMemberWith(...collecting);
    const n = await firstBoughtCrateDrawingAboveRare(member);

    await openBoughtCrate(member, n);

    expect(await dropIn(member, boughtCrateKeyOf(n)), "the bought crate's drop").toEqual(await drawn(member, boughtCrateKeyOf(n), {}));
  });

  test.each([
    ["on", [...collecting, "rarity-caps"], [cappedAtRare, cappedAtRare, exactlyRare]],
    ["off", collecting, [{}, {}, { floor: "rare" }]],
  ] as const)("with rarity-caps %s, the old level-up reveal draws each slot within the range its item stored", async (_, flags, ranges) => {
    const member = await aMemberWith(...flags, "level-up-reveal");

    await t.run((ctx) => dropLevelUpHoggies(ctx, { workspace: "T1", member, level: 2, at: Date.now() }));

    for (const [index, range] of ranges.entries()) expect(await dropIn(member, `level:2:${index + 1}`), `slot ${index + 1}'s drop`).toEqual(await drawn(member, `level:2:${index + 1}`, range));
  });

  test.each([
    ["on", [...collecting, "rarity-caps"], { weights: "kudos" }],
    ["off", collecting, {}],
  ] as const)("with rarity-caps %s when the pack was given, opening it draws with the weights its item stored", async (_, flags, range) => {
    const member = await aMemberWith(...flags);
    const pack = await t.run(async (ctx) => {
      const given = await aPackGivenBy(ctx, member);
      await earnPackItemsOf(ctx, (await ctx.db.get(given))!);
      return given;
    });
    await switchWebsite(t, postHog, true, ...collecting);

    await t.run((ctx) => openThoughtfulPack(ctx, member, pack, Date.now()));

    expect(await dropIn(member, crateKeyOf(pack)), "the pack's drop").toEqual(await drawn(member, crateKeyOf(pack), range));
  });

  test("over 10,000 crate keys, a kudos-weighted draw lands on each rarity within one percentage point of the numbers table", async () => {
    const counts = new Map<Rarity, number>();
    for (let n = 0; n < 10_000; n++) {
      const { rarity } = await drawOf({ secret: "kudos-weights", member: "m", crate: `thoughtful:${n}`, version: catalogue.version, weights: "kudos" });
      counts.set(rarity, (counts.get(rarity) ?? 0) + 1);
    }

    const shares = Object.fromEntries([...counts].map(([rarity, count]) => [rarity, count / 100]));
    for (const [rarity, percent] of Object.entries({ common: 50, uncommon: 28, rare: 18, epic: 3.5, legendary: 0.5 })) expect(Math.abs((shares[rarity] ?? 0) - percent), `${rarity}'s share`).toBeLessThanOrEqual(1);
  });
});

async function aMemberWith(...flags: string[]) {
  await switchWebsite(t, postHog, true, ...flags);
  people += 1;
  const member = await aMember(t, `U_${people}`);
  await aMember(t, `U_THANKED_${people}`);
  return member;
}

async function aPackGivenBy(ctx: MutationCtx, giver: MemberId): Promise<Id<"thoughtfulPacks">> {
  const recipient = (await ctx.db.query("members").collect()).find(({ _id }) => _id !== giver)!._id;
  return ctx.db.insert("thoughtfulPacks", { workspace: "T1", giver, recipient, week: "2026-W44", message: { workspace: "T1", conversation: "C1", message: "1761732000.000100" }, holdsSticker: false, at: Date.now() });
}

async function storedRangesOf(member: MemberId): Promise<Stored[]> {
  const items = await t.run((ctx) => ctx.db.query("items").withIndex("by_member_turned", (q) => q.eq("member", member)).collect());
  return items
    .filter(({ source }) => source === "hoggie")
    .map(({ key, floor, cap, weights }) => ({ key: key.replace(/^(thoughtful:|quest:).*/, "$1"), ...(floor && { floor }), ...(cap && { cap }), ...(weights && { weights }) }))
    .sort((one, other) => one.key.localeCompare(other.key, undefined, { numeric: true }));
}

async function firstBoughtCrateDrawingAboveRare(member: MemberId): Promise<number> {
  for (let n = 1; ; n++) if (["epic", "legendary"].includes((await drawn(member, boughtCrateKeyOf(n), {})).rarity)) return n;
}

async function openBoughtCrate(member: MemberId, n: number) {
  await t.run(async (ctx) => {
    await ctx.db.insert("boughtCrates", { member, crate: `crate-${n}`, n, boughtAt: Date.now() });
    await openCrate(ctx, member, `crate-${n}`, Date.now(), "website");
  });
}

function drawn(member: MemberId, crate: string, range: Range): Promise<Drawn> {
  return drawOf({ secret: process.env.HOGGIE_DRAW_SECRET ?? "", member, crate, version: catalogue.version, ...range });
}

async function dropIn(member: MemberId, crate: string) {
  const drop = await t.run((ctx) =>
    ctx.db
      .query("drops")
      .withIndex("by_member_crate", (q) => q.eq("member", member).eq("crate", crate))
      .unique(),
  );
  return drop && { rarity: drop.rarity, hoggie: drop.hoggie };
}
