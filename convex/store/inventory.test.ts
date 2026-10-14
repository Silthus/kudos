import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import { grantItem } from "./inventory";

const openedAt = Date.parse("2026-10-14T10:00:00Z");
const hour = 60 * 60 * 1000;
const storeEmoji = ["sunflower", "rocket", "glowing-star", "gem", "rainbow", "clover", "doughnut", "cookie", "crown", "balloon", "cactus", "trophy"].map((id) => `kudos-emoji-${id}`);
const tierEmoji = ["ribbon", "sparkling-heart", "jigsaw", "anchor", "confetti", "maple-leaf", "teddy-bear"].map((id) => `kudos-emoji-${id}`);
const hedgehog = "kudos-emoji-hedgehog";
const storeOn = ["xp-levels", "unlocks", "coins", "store"].map(onForEveryone);

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now: openedAt });
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ST26: inventoryOf, as the website reads it", () => {
  test("after opening Coins, the starter is owned since the opening and fills slot 1, and the store lists its twelve emoji for sale", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn);

    const inventory = await t.query(internal.store.inventory.inventoryOf, { member });

    expect(inventory?.slots).toEqual([
      { slot: "emoji-1", item: hedgehog },
      { slot: "emoji-2", item: null },
      { slot: "emoji-3", item: null },
    ]);
    expect(inventory?.owned).toEqual([{ item: hedgehog, arrivedAt: openedAt }]);
    expect(onSaleOf(inventory!.catalogue)).toEqual([[hedgehog, false], ...storeEmoji.map((item) => [item, true])]);
    expect(inventory?.catalogue[0]).toEqual({
      item: hedgehog,
      kind: "kudosEmoji",
      name: "Hedgehog",
      emoji: "hedgehog",
      art: { kind: "unicode", glyph: "🦔" },
      source: { kind: "starter" },
      onSale: false,
    });
    expect(inventory?.catalogue[1]).toMatchObject({ name: "Sunflower", emoji: "sunflower", art: { kind: "unicode", glyph: "🌻" }, source: { kind: "store", price: 100 } });
  });

  test("granted items arrive in order, are never for sale, and the workspace's own emoji isn't listed", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { kudosEmoji: "rocket" });
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-ribbon", source: "tier", arrivedAt: openedAt + 2 * hour }));
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-sunflower", source: "store", arrivedAt: openedAt + hour }));

    const inventory = await t.query(internal.store.inventory.inventoryOf, { member });

    expect(inventory?.owned).toEqual([
      { item: hedgehog, arrivedAt: openedAt },
      { item: "kudos-emoji-sunflower", arrivedAt: openedAt + hour },
      { item: "kudos-emoji-ribbon", arrivedAt: openedAt + 2 * hour },
    ]);
    const forSale = storeEmoji.filter((item) => item !== "kudos-emoji-sunflower" && item !== "kudos-emoji-rocket");
    expect(onSaleOf(inventory!.catalogue)).toEqual([[hedgehog, false], ["kudos-emoji-sunflower", false], ...forSale.map((item) => [item, true]), ["kudos-emoji-ribbon", false]]);
  });

  test("while the Book is open, the tier emoji not owned are listed, never for sale", async () => {
    const { t, member } = await memberWhoOpenedCoins([...storeOn, onForEveryone("achievements")], { opening: ["book", "coins"] });

    const inventory = await t.query(internal.store.inventory.inventoryOf, { member });

    expect(onSaleOf(inventory!.catalogue)).toEqual([[hedgehog, false], ...storeEmoji.map((item) => [item, true]), ...tierEmoji.map((item) => [item, false])]);
  });

  test.each([
    ["the store is turned off", [...["xp-levels", "unlocks", "coins"].map(onForEveryone), offForEveryone("store")]],
    ["coins are turned off", [...["xp-levels", "unlocks", "store"].map(onForEveryone), offForEveryone("coins")]],
  ])("answers null once %s after the opening", async (_, definitions) => {
    const { t, member } = await memberWhoOpenedCoins(storeOn);

    await flagsFromPostHog(t, postHog, ...definitions);

    expect(await t.query(internal.store.inventory.inventoryOf, { member })).toBeNull();
  });

  test("answers null while Coins is only ready", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { opening: [] });

    expect(await t.query(internal.store.inventory.inventoryOf, { member })).toBeNull();
  });
});

describe("ST5: an item is granted to a member at most once", () => {
  test("an item is granted to a member at most once", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn);
    const ribbon = { member, item: "kudos-emoji-ribbon", source: "tier" as const };

    expect(await t.run((ctx) => grantItem(ctx, { ...ribbon, arrivedAt: openedAt }))).toBe(true);
    expect(await t.run((ctx) => grantItem(ctx, { ...ribbon, arrivedAt: openedAt + hour }))).toBe(false);

    expect((await t.query(internal.store.inventory.inventoryOf, { member }))?.owned).toEqual([
      { item: hedgehog, arrivedAt: openedAt },
      { item: "kudos-emoji-ribbon", arrivedAt: openedAt },
    ]);
  });
});

function onSaleOf(catalogue: Array<{ item: string; onSale: boolean }>) {
  return catalogue.map(({ item, onSale }) => [item, onSale]);
}

async function memberWhoOpenedCoins(definitions: FlagDefinition[], { kudosEmoji = "taco", opening = ["coins"] as Array<"coins" | "book"> } = {}): Promise<{ t: Backend; member: MemberId }> {
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji, baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
  const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_JUNO", kind: "member", asOf: 0 }));
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  for (const feature of opening) await opens(t, member, feature);
  return { t, member };
}
