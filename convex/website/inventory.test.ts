import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { recordReward } from "../progression/progression";
import { grantItem } from "../store/inventory";
import type { MemberId } from "../workspace/directory";
import type { MemberProfile } from "./profile";

const now = new Date("2026-10-14T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock" };
const storeFlags = ["xp-levels", "unlocks", "coins", "store"];
const levelSix = 1000;

let postHog: FakePostHog;
let t: Backend;

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

async function signedInAtLevelSix(...flags: string[]) {
  await switchWebsite(t, postHog, true, ...flags);
  await unlocksShippedBeforeAnyoneJoined(t);
  const member = await aMember(t, juno.user);
  const { asSignedIn } = await aSession(t, juno);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: levelSix, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  return { member, asSignedIn };
}

async function earnsCoins(member: MemberId, coins: number) {
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: "test:savings", xp: 0, coins, item: null, catalogueVersion: "2", at: 0 }));
}

async function profileOf(asSignedIn: Pick<Backend, "query">): Promise<MemberProfile> {
  const profile = await asSignedIn.query(api.website.profile.getMyProfile, {});
  if (profile.kind !== "member") throw new Error(`expected a member, got ${profile.kind}`);
  return profile;
}

describe("ST32 ST36: inventoryOf sells no standard emoji, and an owned one stays owned", { timeout: 30_000 }, () => {
  test("it answers owned items and the catalogue only, an owned standard emoji stays owned and listed but not on sale, an unowned one isn't listed, and a picked custom emoji is on sale", async () => {
    const { member, asSignedIn } = await signedInAtLevelSix(...storeFlags, "custom-kudos-emoji");
    await opens(t, member, "coins");
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-rocket", source: "store", arrivedAt: now.getTime() + 1 }));
    await t.run((ctx) => ctx.db.insert("customKudosEmoji", { workspace: "T1", name: "shipit", url: "https://emoji.slack-edge.com/T1/shipit/0a1b2c.png", pickedAt: now.getTime() }));

    const inventory = (await profileOf(asSignedIn)).inventory;

    expect(inventory).toEqual(await t.query(internal.store.inventory.inventoryOf, { member }));
    expect(Object.keys(inventory ?? {}).sort()).toEqual(["catalogue", "owned"]);
    expect(inventory?.owned.map(({ item }) => item)).toEqual(["kudos-emoji-hedgehog", "kudos-emoji-rocket"]);
    expect(inventory?.catalogue.map(({ item, onSale }) => [item, onSale])).toEqual([
      ["kudos-emoji-hedgehog", false],
      ["kudos-emoji-rocket", false],
      ["custom:shipit", true],
    ]);
  });
});

describe("WS341 CO26 ST26: getMyProfile carries the wallet and the inventory exactly while map #1's reads answer them", { timeout: 30_000 }, () => {
  test("with Coins open, the profile carries walletOf's balance and inventoryOf's owned items and catalogue", async () => {
    const { member, asSignedIn } = await signedInAtLevelSix(...storeFlags);
    await opens(t, member, "coins");
    await earnsCoins(member, 140);
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-rocket", source: "store", arrivedAt: now.getTime() + 1 }));

    const profile = await profileOf(asSignedIn);

    expect(profile.coins).toBe((await t.query(internal.wallet.wallet.walletOf, { member }))?.balance);
    expect(profile.coins).toBe(140);
    expect(profile.inventory).toEqual(await t.query(internal.store.inventory.inventoryOf, { member }));
    expect(profile.inventory?.owned.map(({ item }) => item)).toEqual(["kudos-emoji-hedgehog", "kudos-emoji-rocket"]);
  });

  test("while the Book is open, a tier emoji not yet owned names its ladder, as Slack's Inventory tab does", async () => {
    const { member, asSignedIn } = await signedInAtLevelSix(...storeFlags, "achievements");
    await opens(t, member, "book");
    await opens(t, member, "coins");

    const ribbon = (await profileOf(asSignedIn)).inventory?.catalogue.find(({ item }) => item === "kudos-emoji-ribbon");

    expect(ribbon).toMatchObject({ name: "Ribbon", onSale: false, source: { kind: "tier", ladder: "generosity", tier: "silver", ladderName: "Generosity" } });
  });

  test("before Coins opens, the profile carries neither coins nor an inventory", async () => {
    const { member, asSignedIn } = await signedInAtLevelSix(...storeFlags);
    await earnsCoins(member, 140);

    const profile = await profileOf(asSignedIn);

    expect(profile).toMatchObject({ coins: null, inventory: null });
  });

  test("with coins shown but the store flag off, the profile carries the balance and no inventory", async () => {
    const { member, asSignedIn } = await signedInAtLevelSix("xp-levels", "unlocks", "coins");
    await opens(t, member, "coins");
    await earnsCoins(member, 30);

    const profile = await profileOf(asSignedIn);

    expect(profile).toMatchObject({ coins: 30, inventory: null });
  });
});
