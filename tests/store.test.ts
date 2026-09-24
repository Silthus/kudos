import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { grantBalance, requestRedemption, transitionRedemption } from "../convex/store";
import { all, DEMO_TIMEOUT, NOW, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

let t: ReturnType<typeof setupConvex>;
let team: Team;

const settings = {
  emojiName: "taco",
  emojiGlyph: "🌮",
  unitSingular: "kudos",
  unitPlural: "kudos",
  dailyLimit: 5,
  timezone: "Europe/Berlin",
  receivedVisibility: "self" as const,
  reactionsEnabled: true,
  notifyGiver: true,
  notifyReceiver: true,
};

const coffee = { name: "Coffee on us", emoji: "☕", cost: 3 };

const give = (text: string, giverSlackId = "UANA") =>
  t.mutation(internal.kudos.ingestMessage, { workspaceId: team.workspaceId, botUserId: "UBOT", giverSlackId, text, channelId: "C1", messageTs: `${Math.random()}` });

const setWorkspace = (patch: { storeEnabled?: boolean; receivedVisibility?: "hidden" | "self" | "everyone" }) =>
  t.run((ctx) => ctx.db.patch(team.workspaceId, patch));

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
});
afterEach(() => vi.useRealTimers());

describe("opening the store", () => {
  test("is off by default and admins can switch it on", async () => {
    const ana = await signInAs(t, team.ana);
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ enabled: false });
    await ana.mutation(api.storeAdmin.setStoreEnabled, { enabled: true });
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ enabled: true });
    await ana.mutation(api.storeAdmin.setStoreEnabled, { enabled: false });
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ enabled: false });
  });

  test("is blocked while received kudos are hidden", async () => {
    await setWorkspace({ receivedVisibility: "hidden" });
    const ana = await signInAs(t, team.ana);
    // The copy names the options the way the Settings form labels them.
    await expect(ana.mutation(api.storeAdmin.setStoreEnabled, { enabled: true })).rejects.toThrow(/Switch received visibility to “Only me” or “Everyone” first/);
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ enabled: false, receivedVisibility: "hidden" });
  });

  test("keeps received kudos from being hidden while it's open", async () => {
    await setWorkspace({ storeEnabled: true });
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.admin.updateSettings, { ...settings, receivedVisibility: "hidden" })).rejects.toThrow(/Turn off the store/);
    await ana.mutation(api.storeAdmin.setStoreEnabled, { enabled: false });
    await ana.mutation(api.admin.updateSettings, { ...settings, receivedVisibility: "hidden" });
    expect(await t.run((ctx) => ctx.db.get(team.workspaceId))).toMatchObject({ receivedVisibility: "hidden" });
  });

  test("still lets admins save the regular settings payload while it's open", async () => {
    await setWorkspace({ storeEnabled: true });
    const ana = await signInAs(t, team.ana);
    const { settings: current } = await ana.query(api.admin.overview, {});
    await ana.mutation(api.admin.updateSettings, { ...current, dailyLimit: 7, receivedVisibility: "everyone" });
    expect(await t.run((ctx) => ctx.db.get(team.workspaceId))).toMatchObject({ dailyLimit: 7, receivedVisibility: "everyone", storeEnabled: true });
  });

  test("is exposed to the web app through the session", async () => {
    const ben = await signInAs(t, team.ben);
    expect(await ben.query(api.session.viewer, {})).toMatchObject({ workspace: { storeEnabled: false } });
    await setWorkspace({ storeEnabled: true });
    expect(await ben.query(api.session.viewer, {})).toMatchObject({ workspace: { storeEnabled: true } });
  });
});

describe("the catalog", () => {
  test("admins create, edit, archive and restore rewards", async () => {
    const ana = await signInAs(t, team.ana);
    const id = await ana.mutation(api.storeAdmin.createReward, { ...coffee, name: "  Coffee on us ", description: " ", stock: 10 });
    await ana.mutation(api.storeAdmin.createReward, { name: "Hoodie", emoji: "🧥", cost: 60, maxPerMember: 1, prompt: "Size?" });
    expect((await ana.query(api.storeAdmin.rewards, {})).map((r) => [r.name, r.cost, r.status])).toEqual([
      ["Coffee on us", 3, "active"],
      ["Hoodie", 60, "active"],
    ]);

    await ana.mutation(api.storeAdmin.updateReward, { rewardId: id, name: "Big coffee", emoji: "☕", cost: 80, description: "Any size" });
    await ana.mutation(api.storeAdmin.setRewardStatus, { rewardId: id, status: "archived" });
    const rewards = await ana.query(api.storeAdmin.rewards, {});
    expect(rewards.map((r) => [r.name, r.status])).toEqual([
      ["Hoodie", "active"],
      ["Big coffee", "archived"],
    ]);
    // Editing without touching stock keeps the live remaining stock.
    expect(rewards[1]).toMatchObject({ cost: 80, description: "Any size", stock: 10 });

    await ana.mutation(api.storeAdmin.setRewardStatus, { rewardId: id, status: "active" });
    expect((await ana.query(api.storeAdmin.rewards, {})).every((r) => r.status === "active")).toBe(true);
  });

  test("editing clears optional fields the admin emptied", async () => {
    const ana = await signInAs(t, team.ana);
    const id = await ana.mutation(api.storeAdmin.createReward, { ...coffee, description: "Flat white", prompt: "Oat?", maxPerMember: 2 });
    await ana.mutation(api.storeAdmin.updateReward, { rewardId: id, ...coffee });
    const [reward] = await ana.query(api.storeAdmin.rewards, {});
    expect([reward.description, reward.prompt, reward.maxPerMember]).toEqual([undefined, undefined, undefined]);
  });

  test("restocking never clobbers stock that moved while the editor was open", async () => {
    const ana = await signInAs(t, team.ana);
    const id = await ana.mutation(api.storeAdmin.createReward, { ...coffee, stock: 4 });
    // A redemption (next slice) takes one while the admin is editing.
    await t.run((ctx) => ctx.db.patch(id, { stock: 3 }));
    await ana.mutation(api.storeAdmin.updateReward, { rewardId: id, ...coffee, name: "Coffee" });
    expect((await ana.query(api.storeAdmin.rewards, {}))[0]).toMatchObject({ name: "Coffee", stock: 3 });

    await expect(ana.mutation(api.storeAdmin.updateReward, { rewardId: id, ...coffee, stock: { from: 4, to: 10 } })).rejects.toThrow(/Stock changed/);
    await ana.mutation(api.storeAdmin.updateReward, { rewardId: id, ...coffee, stock: { from: 3, to: 10 } });
    expect((await ana.query(api.storeAdmin.rewards, {}))[0].stock).toBe(10);
    await ana.mutation(api.storeAdmin.updateReward, { rewardId: id, ...coffee, stock: { from: 10, to: "unlimited" } });
    expect((await ana.query(api.storeAdmin.rewards, {}))[0].stock).toBeUndefined();
    await expect(ana.mutation(api.storeAdmin.updateReward, { rewardId: id, ...coffee, stock: { from: "unlimited", to: -1 } })).rejects.toThrow(/Stock must be/);
  });

  test("rejects invalid rewards with readable copy", async () => {
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.storeAdmin.createReward, { ...coffee, cost: 0 })).rejects.toThrow(/Cost must be/);
    await expect(ana.mutation(api.storeAdmin.createReward, { ...coffee, name: "" })).rejects.toThrow(/name/);
  });

  test("holds at most 100 active rewards", async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++) {
        await ctx.db.insert("rewards", { workspaceId: team.workspaceId, ...coffee, status: "active", createdBy: team.ana, updatedAt: 0 });
      }
    });
    const archived = await t.run((ctx) =>
      ctx.db.insert("rewards", { workspaceId: team.workspaceId, ...coffee, status: "archived", createdBy: team.ana, updatedAt: 0 }),
    );
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.storeAdmin.createReward, coffee)).rejects.toThrow(/100 active rewards/);
    await expect(ana.mutation(api.storeAdmin.setRewardStatus, { rewardId: archived, status: "active" })).rejects.toThrow(/100 active rewards/);
    // Restoring a reward that's already active is a no-op, even at the cap.
    const [active] = await ana.query(api.storeAdmin.rewards, {});
    await ana.mutation(api.storeAdmin.setRewardStatus, { rewardId: active._id, status: "active" });
  });

  test("members see active rewards sorted by cost with what they can afford", async () => {
    await setWorkspace({ storeEnabled: true });
    await give("<@UBEN> :taco::taco::taco::taco: great demo");
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.storeAdmin.createReward, { name: "Hoodie", emoji: "🧥", cost: 60 });
    await ana.mutation(api.storeAdmin.createReward, { ...coffee, maxPerMember: 1 });
    await ana.mutation(api.storeAdmin.createReward, { name: "Sticker", emoji: "🌟", cost: 1, stock: 0 });
    const old = await ana.mutation(api.storeAdmin.createReward, { name: "Old mug", emoji: "🍵", cost: 2 });
    await ana.mutation(api.storeAdmin.setRewardStatus, { rewardId: old, status: "archived" });

    const ben = await signInAs(t, team.ben);
    const catalog = await ben.query(api.store.catalog, {});
    if (!catalog.enabled) throw new Error("store should be open");
    expect(catalog).toMatchObject({ balance: 4, openCount: 0, maxOpen: 5 });
    expect(catalog.rewards.map((r) => [r.name, r.affordable, r.soldOut, r.limitReached, r.yourCount])).toEqual([
      // Only capped rewards count what you already redeemed.
      ["Sticker", true, true, false, null],
      ["Coffee on us", true, false, false, 0],
      ["Hoodie", false, false, false, null],
    ]);
  });

  test("tells members when the store is closed", async () => {
    await ana_createCoffee();
    const ben = await signInAs(t, team.ben);
    expect(await ben.query(api.store.catalog, {})).toEqual({ enabled: false });
    // Belt and braces: a store flag that survived a switch to "hidden" never shows a balance.
    await setWorkspace({ storeEnabled: true, receivedVisibility: "hidden" });
    expect(await ben.query(api.store.catalog, {})).toEqual({ enabled: false });
    expect(await ben.query(api.session.viewer, {})).toMatchObject({ workspace: { storeEnabled: false } });
  });
});

async function ana_createCoffee() {
  const ana = await signInAs(t, team.ana);
  return await ana.mutation(api.storeAdmin.createReward, coffee);
}

describe("balances", () => {
  test("come from received kudos: giving raises them, revoking lowers them", async () => {
    await setWorkspace({ storeEnabled: true });
    const ben = await signInAs(t, team.ben);
    const balance = async () => {
      const c = await ben.query(api.store.catalog, {});
      return c.enabled ? c.balance : null;
    };
    expect(await balance()).toBe(0);
    await give("<@UBEN> :taco::taco::taco: thanks");
    expect(await balance()).toBe(3);

    const [row] = await all(t, "kudos");
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.admin.revoke, { kudosId: row._id });
    expect(await balance()).toBe(0);
  });

  test("subtract spending and add grants, and may go negative", async () => {
    await setWorkspace({ storeEnabled: true });
    await give("<@UBEN> :taco::taco: thanks");
    await t.run((ctx) => ctx.db.patch(team.ben, { storeSpent: 5, storeGranted: 1 }));
    const ben = await signInAs(t, team.ben);
    const catalog = await ben.query(api.store.catalog, {});
    expect(catalog).toMatchObject({ enabled: true, balance: -2 });
  });

  test("give admins pricing context across the workspace", async () => {
    await give("<@UBEN> :taco::taco::taco::taco: thanks");
    await give("<@UCLEO> :taco: thanks");
    const ana = await signInAs(t, team.ana);
    // Ana 0, Ben 4, Cleo 1; the bot doesn't count.
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ totalBalance: 5, medianBalance: 1 });
    // People who left the workspace don't count either.
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ totalBalance: 1, medianBalance: 0.5 });
  });

  test("stay out of the pricing context while received kudos are hidden", async () => {
    await give("<@UBEN> :taco::taco::taco::taco: thanks");
    await setWorkspace({ receivedVisibility: "hidden" });
    const ana = await signInAs(t, team.ana);
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ totalBalance: null, medianBalance: null });
  });
});

describe("store access", () => {
  test("members can't use storeAdmin functions", async () => {
    const rewardId = await ana_createCoffee();
    const ben = await signInAs(t, team.ben);
    await expect(ben.query(api.storeAdmin.overview, {})).rejects.toThrow(/admins/);
    await expect(ben.query(api.storeAdmin.rewards, {})).rejects.toThrow(/admins/);
    await expect(ben.mutation(api.storeAdmin.setStoreEnabled, { enabled: true })).rejects.toThrow(/admins/);
    await expect(ben.mutation(api.storeAdmin.createReward, coffee)).rejects.toThrow(/admins/);
    await expect(ben.mutation(api.storeAdmin.updateReward, { rewardId, ...coffee })).rejects.toThrow(/admins/);
    await expect(ben.mutation(api.storeAdmin.setRewardStatus, { rewardId, status: "archived" })).rejects.toThrow(/admins/);
  });

  test("signed-out visitors can't read the catalog", async () => {
    await expect(t.query(api.store.catalog, {})).rejects.toThrow(/Sign in/);
  });

  test("admins can't touch another workspace's rewards", async () => {
    const other = await seedTeam(t, { storeEnabled: true }, "T2");
    const foreign: Id<"rewards"> = await t.run((ctx) =>
      ctx.db.insert("rewards", { workspaceId: other.workspaceId, ...coffee, status: "active", createdBy: other.ana, updatedAt: 0 }),
    );
    await setWorkspace({ storeEnabled: true });
    const ana = await signInAs(t, team.ana);
    expect(await ana.query(api.storeAdmin.rewards, {})).toEqual([]);
    await expect(ana.mutation(api.storeAdmin.updateReward, { rewardId: foreign, ...coffee })).rejects.toThrow(/not found/);
    await expect(ana.mutation(api.storeAdmin.setRewardStatus, { rewardId: foreign, status: "archived" })).rejects.toThrow(/not found/);
    const catalog = await ana.query(api.store.catalog, {});
    expect(catalog.enabled && catalog.rewards).toEqual([]);
  });

  test("admins' redemption functions refuse members", async () => {
    const ben = await signInAs(t, team.ben);
    await expect(ben.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page })).rejects.toThrow(/admins/);
    await expect(ben.query(api.storeAdmin.openCount, {})).rejects.toThrow(/admins/);
  });

  test("the shared demo catalog is read-only", async () => {
    const userId = await t.mutation(internal.demo.ensureDemoUser, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000); // seeding, then the rollup rebuild
    const demo = t.withIdentity({ subject: `${userId}|s` });
    const rewardId = await t.run(async (ctx) => {
      const ws = (await ctx.db.query("workspaces").collect()).find((w) => w.isDemo)!;
      const alex = (await ctx.db.query("members").collect()).find((m) => m.workspaceId === ws._id && m.isAdmin)!;
      return await ctx.db.insert("rewards", { workspaceId: ws._id, ...coffee, status: "active", createdBy: alex._id, updatedAt: 0 });
    });
    await expect(demo.mutation(api.storeAdmin.setStoreEnabled, { enabled: false })).rejects.toThrow(/demo/);
    await expect(demo.mutation(api.storeAdmin.setStoreEnabled, { enabled: true })).rejects.toThrow(/demo/);
    await expect(demo.mutation(api.storeAdmin.createReward, coffee)).rejects.toThrow(/demo/);
    await expect(demo.mutation(api.storeAdmin.updateReward, { rewardId, ...coffee })).rejects.toThrow(/demo/);
    await expect(demo.mutation(api.storeAdmin.setRewardStatus, { rewardId, status: "archived" })).rejects.toThrow(/demo/);
    expect(await demo.query(api.storeAdmin.rewards, {})).toHaveLength(1);
  }, DEMO_TIMEOUT);
});

// ── Redeeming (S2) ────────────────────────────────────────────────────────────

const page = { numItems: 50, cursor: null };

/** Opens the store and gives `memberId` a balance without going through the engine. */
async function fund(memberId: Id<"members">, totalReceived: number) {
  await t.run(async (ctx) => {
    await ctx.db.patch(team.workspaceId, { storeEnabled: true });
    await ctx.db.patch(memberId, { totalReceived });
  });
}

async function addReward(extra: Partial<{ stock: number; maxPerMember: number; prompt: string; cost: number; name: string }> = {}) {
  const ana = await signInAs(t, team.ana);
  return await ana.mutation(api.storeAdmin.createReward, { ...coffee, ...extra });
}

const rewardDoc = (id: Id<"rewards">) => t.run((ctx) => ctx.db.get(id));
const spentBy = async (id: Id<"members">) => (await t.run((ctx) => ctx.db.get(id)))!.storeSpent ?? 0;

describe("redeeming", () => {
  test("holds the cost and takes one from stock", async () => {
    const rewardId = await addReward({ stock: 2 });
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    const { redemptionId, balance } = await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    expect(balance).toBe(7);
    expect(await ben.query(api.store.catalog, {})).toMatchObject({ balance: 7, openCount: 1 });
    expect((await rewardDoc(rewardId))!.stock).toBe(1);

    const mine = await ben.query(api.store.myRedemptions, { paginationOpts: page });
    expect(mine.page).toHaveLength(1);
    expect(mine.page[0]).toMatchObject({ _id: redemptionId, rewardName: "Coffee on us", rewardEmoji: "☕", cost: 3, status: "pending" });
    expect(mine.page[0].history).toEqual([{ status: "pending", at: NOW.getTime(), by: expect.objectContaining({ name: "Ben" }) }]);
  });

  test("shows members their own balance for the chip on Me, only while the store is open", async () => {
    const rewardId = await addReward();
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    expect(await ben.query(api.store.balance, {})).toBe(10);
    await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    expect(await ben.query(api.store.balance, {})).toBe(7);
    await setWorkspace({ storeEnabled: false });
    expect(await ben.query(api.store.balance, {})).toBeNull();
  });

  test("refuses when the store is closed", async () => {
    const rewardId = await addReward();
    await fund(team.ben, 10);
    await setWorkspace({ storeEnabled: false });
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).rejects.toThrow(/store isn't open/);
  });

  test("refuses archived rewards and rewards from another workspace", async () => {
    const rewardId = await addReward();
    await (await signInAs(t, team.ana)).mutation(api.storeAdmin.setRewardStatus, { rewardId, status: "archived" });
    const other = await seedTeam(t, { storeEnabled: true }, "T2");
    const foreign = await t.run((ctx) =>
      ctx.db.insert("rewards", { workspaceId: other.workspaceId, ...coffee, status: "active", createdBy: other.ana, updatedAt: 0 }),
    );
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).rejects.toThrow(/isn't in the store any more/);
    await expect(ben.mutation(api.store.redeem, { rewardId: foreign, expectedCost: 3 })).rejects.toThrow(/Reward not found/);
  });

  test("refuses when the price changed since the page rendered", async () => {
    const rewardId = await addReward();
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 2 })).rejects.toThrow(/price changed/);
    expect(await spentBy(team.ben)).toBe(0);
  });

  test("refuses sold-out rewards: the last one goes to whoever asks first", async () => {
    const rewardId = await addReward({ stock: 1 });
    await fund(team.ben, 10);
    await t.run((ctx) => ctx.db.patch(team.cleo, { totalReceived: 10 }));
    await (await signInAs(t, team.ben)).mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    await expect((await signInAs(t, team.cleo)).mutation(api.store.redeem, { rewardId, expectedCost: 3 })).rejects.toThrow(/Sold out/);
    expect((await rewardDoc(rewardId))!.stock).toBe(0);
  });

  test("refuses past the per-person limit, counting only requests that weren't refunded", async () => {
    const rewardId = await addReward({ maxPerMember: 1 });
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    const { redemptionId } = await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    const catalog = await ben.query(api.store.catalog, {});
    expect(catalog.enabled && catalog.rewards[0]).toMatchObject({ yourCount: 1, limitReached: true });
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).rejects.toThrow(/already redeemed this/);

    await ben.mutation(api.store.cancel, { redemptionId });
    const after = await ben.query(api.store.catalog, {});
    expect(after.enabled && after.rewards[0]).toMatchObject({ yourCount: 0, limitReached: false });
    await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
  });

  test("refuses a sixth open request", async () => {
    const rewardId = await addReward({ cost: 1 });
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    for (let i = 0; i < 5; i++) await ben.mutation(api.store.redeem, { rewardId, expectedCost: 1 });
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 1 })).rejects.toThrow(/5 open requests/);
    expect(await spentBy(team.ben)).toBe(5);
  });

  test("needs an answer when the reward asks a question, within 280 characters", async () => {
    const rewardId = await addReward({ prompt: "Oat or dairy?" });
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).rejects.toThrow(/Answer “Oat or dairy\?”/);
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 3, answer: "   " })).rejects.toThrow(/Answer/);
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 3, answer: "x".repeat(281) })).rejects.toThrow(/280 characters/);
    await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3, answer: "  Oat, please " });
    const [row] = (await ben.query(api.store.myRedemptions, { paginationOpts: page })).page;
    expect(row).toMatchObject({ prompt: "Oat or dairy?", answer: "Oat, please" });
  });

  test("refuses when the balance doesn't cover the cost", async () => {
    const rewardId = await addReward({ cost: 5 });
    await fund(team.ben, 4);
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 5 })).rejects.toThrow(/need 1 more 🌮/);
  });
});

/** Ben redeems a 3-kudos coffee (stock 5) from a balance of 10; Ana and Cleo are around to decide. */
async function benRequests(extra: Parameters<typeof addReward>[0] = {}) {
  const rewardId = await addReward({ stock: 5, ...extra });
  await fund(team.ben, 10);
  const ben = await signInAs(t, team.ben);
  const { redemptionId } = await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
  return { rewardId, redemptionId, ben, ana: await signInAs(t, team.ana) };
}

const statusOf = async (id: Id<"redemptions">) => (await t.run((ctx) => ctx.db.get(id)))!.status;

describe("cancelling", () => {
  test("refunds the cost and restocks the reward", async () => {
    const { rewardId, redemptionId, ben } = await benRequests();
    await ben.mutation(api.store.cancel, { redemptionId });
    expect(await statusOf(redemptionId)).toBe("cancelled");
    expect(await spentBy(team.ben)).toBe(0);
    expect((await rewardDoc(rewardId))!.stock).toBe(5);
    expect(await ben.query(api.store.catalog, {})).toMatchObject({ balance: 10, openCount: 0 });
    await expect(ben.mutation(api.store.cancel, { redemptionId })).rejects.toThrow("Already cancelled by you.");
  });

  test("is only for the requester", async () => {
    const { redemptionId } = await benRequests();
    await t.run((ctx) => ctx.db.patch(team.cleo, { totalReceived: 10 }));
    await expect((await signInAs(t, team.cleo)).mutation(api.store.cancel, { redemptionId })).rejects.toThrow(/Request not found/);
    // Admins decline instead; cancelling is the requester's own call.
    await expect((await signInAs(t, team.ana)).mutation(api.store.cancel, { redemptionId })).rejects.toThrow(/Request not found/);
    expect(await statusOf(redemptionId)).toBe("pending");
  });

  test("is only possible while the request is pending", async () => {
    const { redemptionId, ben, ana } = await benRequests();
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    await expect(ben.mutation(api.store.cancel, { redemptionId })).rejects.toThrow(/already approved, so ask an admin/);
    expect(await spentBy(team.ben)).toBe(3);
  });
});

describe("deciding", () => {
  test("declining refunds and restocks, from pending and from approved", async () => {
    const { rewardId, redemptionId, ben, ana } = await benRequests();
    const second = (await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).redemptionId;
    expect(await spentBy(team.ben)).toBe(6);

    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline", note: "  Out of oat milk " });
    await ana.mutation(api.storeAdmin.decide, { redemptionId: second, action: "approve" });
    await ana.mutation(api.storeAdmin.decide, { redemptionId: second, action: "decline" });
    expect([await statusOf(redemptionId), await statusOf(second)]).toEqual(["declined", "declined"]);
    expect(await spentBy(team.ben)).toBe(0);
    expect((await rewardDoc(rewardId))!.stock).toBe(5);

    const [, first] = (await ben.query(api.store.myRedemptions, { paginationOpts: page })).page;
    expect(first).toMatchObject({ status: "declined", adminNote: "Out of oat milk" });
  });

  test("fulfilling is final and keeps the cost spent", async () => {
    const { rewardId, redemptionId, ana } = await benRequests();
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill", note: "Enjoy!" });
    expect(await statusOf(redemptionId)).toBe("fulfilled");
    for (const action of ["approve", "fulfill", "decline"] as const) {
      await expect(ana.mutation(api.storeAdmin.decide, { redemptionId, action })).rejects.toThrow("Already fulfilled by you.");
    }
    await t.run((ctx) => ctx.db.patch(team.cleo, { isAdmin: true }));
    await expect((await signInAs(t, team.cleo)).mutation(api.storeAdmin.decide, { redemptionId, action: "decline" })).rejects.toThrow("Already fulfilled by Ana.");
    expect(await spentBy(team.ben)).toBe(3);
    expect(await rewardDoc(rewardId)).toMatchObject({ stock: 4, openCount: 0, fulfilledCount: 1 });
  });

  test("records every step with who decided and their note", async () => {
    const { redemptionId, ben, ana } = await benRequests();
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    vi.setSystemTime(NOW.getTime() + 60_000);
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill", note: "On your desk" });
    const [row] = (await ben.query(api.store.myRedemptions, { paginationOpts: page })).page;
    expect(row.history.map((h) => [h.status, h.by?.name, h.note, h.at - NOW.getTime()])).toEqual([
      ["pending", "Ben", undefined, 0],
      ["approved", "Ana", undefined, 0],
      ["fulfilled", "Ana", "On your desk", 60_000],
    ]);
    expect(row.adminNote).toBe("On your desk");
  });

  test("caps the note at 500 characters", async () => {
    const { redemptionId, ana } = await benRequests();
    await expect(ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline", note: "x".repeat(501) })).rejects.toThrow(/500 characters/);
  });

  test("members can't decide", async () => {
    const { redemptionId, ben } = await benRequests();
    await expect(ben.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" })).rejects.toThrow(/admins/);
  });

  test("admins can't decide on their own request while another admin is around", async () => {
    await t.run((ctx) => ctx.db.patch(team.cleo, { isAdmin: true }));
    const cleo = await signInAs(t, team.cleo);
    const rewardId = await addReward();
    await fund(team.ana, 10);
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await ana.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    for (const action of ["approve", "fulfill", "decline"] as const) {
      await expect(ana.mutation(api.storeAdmin.decide, { redemptionId, action })).rejects.toThrow(/Another admin decides on your own requests/);
    }
    const [row] = (await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page })).page;
    expect(row).toMatchObject({ isOwn: true, canDecide: false });

    await cleo.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    expect(await statusOf(redemptionId)).toBe("approved");
  });

  test("admins who never opened Kudos, bots and people who left don't count as the other admin", async () => {
    // Slack sync makes every workspace admin a Kudos admin, signed in or not; they can't act on the queue.
    await t.run(async (ctx) => {
      await ctx.db.patch(team.cleo, { isAdmin: true });
      await ctx.db.patch(team.bot, { isAdmin: true });
      await ctx.db.patch(team.ben, { isAdmin: true, deactivated: true });
    });
    const rewardId = await addReward();
    await fund(team.ana, 10);
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await ana.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    expect(await statusOf(redemptionId)).toBe("approved");
  });

  test("can't be dodged by demoting the other admin after asking", async () => {
    await t.run((ctx) => ctx.db.patch(team.cleo, { isAdmin: true }));
    const cleo = await signInAs(t, team.cleo);
    const rewardId = await addReward();
    await fund(team.ana, 10);
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await ana.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    // The loophole #14 left open: demote Cleo, become the sole admin, approve your own request.
    // Demoting stays allowed (admins manage admins), but Cleo still counts for Ana's requests.
    await ana.mutation(api.admin.setAdmin, { memberId: team.cleo, isAdmin: false });
    await expect(ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" })).rejects.toThrow(/You removed Cleo's admin role/);
    const [row] = (await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page })).page;
    expect(row).toMatchObject({ isOwn: true, canDecide: false });

    // Promoted again, Cleo decides as usual.
    await ana.mutation(api.admin.setAdmin, { memberId: team.cleo, isAdmin: true });
    await cleo.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" });
    expect(await statusOf(redemptionId)).toBe("fulfilled");
  });

  test("can't be dodged by demoting the other admin before the store even opened", async () => {
    await t.run((ctx) => ctx.db.patch(team.cleo, { isAdmin: true }));
    await signInAs(t, team.cleo);
    const rewardId = await addReward();
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.admin.setAdmin, { memberId: team.cleo, isAdmin: false });
    await fund(team.ana, 10);
    const { redemptionId } = await ana.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    for (const action of ["approve", "fulfill", "decline"] as const) {
      await expect(ana.mutation(api.storeAdmin.decide, { redemptionId, action })).rejects.toThrow(/another admin decides on your own requests/);
    }
    // Someone else can still decide on it: a new admin.
    await signInAs(t, team.ben);
    await ana.mutation(api.admin.setAdmin, { memberId: team.ben, isAdmin: true });
    const ben = await signInAs(t, team.ben);
    await ben.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    expect(await statusOf(redemptionId)).toBe("approved");
  });

  test("only counts people you demoted who could decide: signed in and still here", async () => {
    // Cleo never opened Kudos and Ben left: demoting them doesn't hold up Ana's own requests.
    await t.run(async (ctx) => {
      await ctx.db.patch(team.cleo, { isAdmin: true });
      await ctx.db.patch(team.ben, { isAdmin: true, deactivated: true });
    });
    const rewardId = await addReward();
    await fund(team.ana, 10);
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.admin.setAdmin, { memberId: team.cleo, isAdmin: false });
    await ana.mutation(api.admin.setAdmin, { memberId: team.ben, isAdmin: false });
    const first = (await ana.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).redemptionId;
    await ana.mutation(api.storeAdmin.decide, { redemptionId: first, action: "fulfill" });
    // Once Cleo signs in she could have decided, so she counts again.
    await signInAs(t, team.cleo);
    const second = (await ana.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).redemptionId;
    await expect(ana.mutation(api.storeAdmin.decide, { redemptionId: second, action: "fulfill" })).rejects.toThrow(/You removed Cleo's admin role/);
  });

  test("a sole admin decides on their own requests", async () => {
    // Cleo is an admin too, but she left, so Ana is the only active admin.
    await t.run((ctx) => ctx.db.patch(team.cleo, { isAdmin: true, deactivated: true }));
    const rewardId = await addReward();
    await fund(team.ana, 10);
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await ana.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    const [row] = (await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page })).page;
    expect(row).toMatchObject({ isOwn: true, canDecide: true });
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" });
    expect(await statusOf(redemptionId)).toBe("fulfilled");
  });

  test("a refund only restocks what the request took from stock", async () => {
    const rewardId = await addReward(); // unlimited when Ben asks
    await fund(team.ben, 10);
    const ben = await signInAs(t, team.ben);
    const { redemptionId } = await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.storeAdmin.updateReward, { rewardId, ...coffee, stock: { from: "unlimited", to: 1 } });
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    expect((await rewardDoc(rewardId))!.stock).toBe(1);
  });

  test("works in the shared demo, where the queue is meant to be played with", async () => {
    const userId = await t.mutation(internal.demo.ensureDemoUser, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000); // seeding, then the rollup rebuild
    const demo = t.withIdentity({ subject: `${userId}|s` });
    const redemptionId = await t.run(async (ctx) => {
      const workspace = (await ctx.db.query("workspaces").collect()).find((w) => w.isDemo)!;
      await ctx.db.patch(workspace._id, { storeEnabled: true });
      const ws = (await ctx.db.get(workspace._id))!;
      const people = (await ctx.db.query("members").collect()).filter((m) => m.workspaceId === ws._id && !m.isAdmin && !m.isBot);
      const member = people.find((m) => m.totalReceived >= 3)!;
      const rewardId = await ctx.db.insert("rewards", { workspaceId: ws._id, ...coffee, status: "active", createdBy: member._id, updatedAt: 0 });
      return (await requestRedemption(ctx, { workspace: ws, member, rewardId, expectedCost: 3, now: NOW.getTime() })).redemptionId;
    });
    await demo.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" });
    expect(await statusOf(redemptionId)).toBe("fulfilled");
  }, DEMO_TIMEOUT);

  test("the core helper refuses actors and requests from another workspace", async () => {
    const { redemptionId } = await benRequests();
    const other = await seedTeam(t, {}, "T2");
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const redemption = (await ctx.db.get(redemptionId))!;
      const outsider = (await ctx.db.get(other.ana))!;
      await expect(transitionRedemption(ctx, { workspace, redemption, actor: outsider, action: "decline", now: 0 })).rejects.toThrow(/not found/);
      const foreignWorkspace = (await ctx.db.get(other.workspaceId))!;
      const ana = (await ctx.db.get(team.ana))!;
      await expect(transitionRedemption(ctx, { workspace: foreignWorkspace, redemption, actor: ana, action: "decline", now: 0 })).rejects.toThrow(/not found/);
      await ctx.db.patch(team.ana, { deactivated: true });
      const gone = (await ctx.db.get(team.ana))!;
      await expect(transitionRedemption(ctx, { workspace, redemption, actor: gone, action: "decline", now: 0 })).rejects.toThrow(/not found/);
    });
    expect(await statusOf(redemptionId)).toBe("pending");
  });

  test("still works after the reward was archived or the store closed", async () => {
    const { rewardId, redemptionId, ana } = await benRequests();
    await ana.mutation(api.storeAdmin.setRewardStatus, { rewardId, status: "archived" });
    await ana.mutation(api.storeAdmin.setStoreEnabled, { enabled: false });
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    expect(await spentBy(team.ben)).toBe(0);
    expect((await rewardDoc(rewardId))!.stock).toBe(5);
  });
});

describe("the admin queue", () => {
  test("lists open requests oldest first, pending and approved together", async () => {
    const { rewardId, redemptionId, ben, ana } = await benRequests();
    vi.setSystemTime(NOW.getTime() + 1000);
    const second = (await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).redemptionId;
    vi.setSystemTime(NOW.getTime() + 2000);
    const third = (await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).redemptionId;
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    await ana.mutation(api.storeAdmin.decide, { redemptionId: third, action: "decline", note: "Once a day" });

    const open = await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page });
    expect(open.page.map((r) => [r._id, r.status])).toEqual([
      [redemptionId, "approved"],
      [second, "pending"],
    ]);
    expect(open.page[0]).toMatchObject({
      requester: { name: "Ben", deactivated: false },
      rewardName: "Coffee on us",
      cost: 3,
      balance: 4,
      negativeBalance: false,
      isOwn: false,
      canDecide: true,
    });
    expect(open.page[0].history.map((h) => h.by?.name)).toEqual(["Ben", "Ana"]);
    const declined = await ana.query(api.storeAdmin.redemptions, { filter: "declined", paginationOpts: page });
    expect(declined.page.map((r) => [r._id, r.adminNote])).toEqual([[third, "Once a day"]]);
    expect((await ana.query(api.storeAdmin.redemptions, { filter: "fulfilled", paginationOpts: page })).page).toEqual([]);
    expect(await ana.query(api.storeAdmin.openCount, {})).toBe(2);
    expect(await ana.query(api.storeAdmin.overview, {})).toMatchObject({ openCount: 2 });
    expect((await ana.query(api.storeAdmin.rewards, {}))[0]).toMatchObject({ openCount: 2, fulfilledCount: 0 });
  });

  test("keeps requests from people who left, flagged", async () => {
    const { ana } = await benRequests();
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
    const [row] = (await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page })).page;
    expect(row.requester).toMatchObject({ name: "Ben", deactivated: true });
  });

  test("is scoped to the admin's workspace", async () => {
    const other = await seedTeam(t, { storeEnabled: true }, "T2");
    const foreignReward = await t.run((ctx) =>
      ctx.db.insert("rewards", { workspaceId: other.workspaceId, ...coffee, status: "active", createdBy: other.ana, updatedAt: 0 }),
    );
    await t.run((ctx) => ctx.db.patch(other.ben, { totalReceived: 10 }));
    const otherBen = await signInAs(t, other.ben);
    const { redemptionId: foreign } = await otherBen.mutation(api.store.redeem, { rewardId: foreignReward, expectedCost: 3 });

    const { ana } = await benRequests();
    const open = await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page });
    expect(open.page.every((r) => r.requester.name === "Ben" && r._id !== foreign)).toBe(true);
    expect(open.page).toHaveLength(1);
    expect(await ana.query(api.storeAdmin.openCount, {})).toBe(1);
    await expect(ana.mutation(api.storeAdmin.decide, { redemptionId: foreign, action: "decline" })).rejects.toThrow(/Request not found/);
    await expect((await signInAs(t, team.ben)).mutation(api.store.cancel, { redemptionId: foreign })).rejects.toThrow(/Request not found/);
    // Ben only ever sees his own requests.
    expect((await otherBen.query(api.store.myRedemptions, { paginationOpts: page })).page.map((r) => r._id)).toEqual([foreign]);
  });
});

describe("negative balances", () => {
  test("appear when spent kudos are revoked, block new requests and flag the queue", async () => {
    await setWorkspace({ storeEnabled: true });
    await give("<@UBEN> :taco::taco::taco: thanks");
    const rewardId = await addReward();
    const ben = await signInAs(t, team.ben);
    await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.admin.revoke, { kudosId: (await all(t, "kudos"))[0]._id });

    expect(await ben.query(api.store.catalog, {})).toMatchObject({ balance: -3 });
    await give("<@UBEN> :taco::taco::taco: again");
    // Back to 0: still not enough for a 3-kudos coffee.
    await expect(ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).rejects.toThrow(/need 3 more/);
    await ana.mutation(api.admin.revoke, { kudosId: (await all(t, "kudos")).find((k) => k.text.includes("again"))!._id });

    const [row] = (await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page })).page;
    expect(row).toMatchObject({ balance: -3, negativeBalance: true });
    // Nothing is cancelled automatically.
    expect(row.status).toBe("pending");
    const members = await ana.query(api.admin.members, {});
    expect(members.find((m) => m.name === "Ben")).toMatchObject({ balance: -3 });
  });

  test("show admins balances only while the store is open", async () => {
    await fund(team.ben, 7);
    const ana = await signInAs(t, team.ana);
    const benRow = async () => (await ana.query(api.admin.members, {})).find((m) => m.name === "Ben")!;
    // "Only me" hides received counts from admins; the store's balance is the documented exception (D4).
    expect(await benRow()).toMatchObject({ totalReceived: null, balance: 7 });
    await setWorkspace({ receivedVisibility: "everyone" });
    expect(await benRow()).toMatchObject({ totalReceived: 7, balance: 7 });
    // A closed store must not turn the admin table into a received-count leak under "Only me".
    await setWorkspace({ storeEnabled: false, receivedVisibility: "self" });
    expect(await benRow()).toMatchObject({ totalReceived: null, balance: null });
  });

  test("stay private while received kudos are hidden", async () => {
    const { ana } = await benRequests();
    await ana.mutation(api.storeAdmin.setStoreEnabled, { enabled: false });
    await setWorkspace({ receivedVisibility: "hidden" });
    const [row] = (await ana.query(api.storeAdmin.redemptions, { filter: "open", paginationOpts: page })).page;
    expect(row).toMatchObject({ balance: null, negativeBalance: null });
    expect((await ana.query(api.admin.members, {})).every((m) => m.balance === null)).toBe(true);
  });
});

describe("the balance invariant", () => {
  test("spent always equals the cost of requests that weren't refunded", async () => {
    await t.run((ctx) => ctx.db.patch(team.cleo, { isAdmin: true }));
    const rewards = [await addReward({ cost: 1, stock: 3 }), await addReward({ cost: 2, maxPerMember: 2 }), await addReward({ cost: 5 })];
    const costs = [1, 2, 5];
    await fund(team.ben, 40);
    await t.run((ctx) => ctx.db.patch(team.ana, { totalReceived: 40 }));
    const people = { ben: await signInAs(t, team.ben), ana: await signInAs(t, team.ana), cleo: await signInAs(t, team.cleo) };
    const ids: { id: Id<"redemptions">; by: "ben" | "ana" }[] = [];

    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return Math.floor(seed / 2 ** 16) % n; // the low bits of an LCG cycle too quickly
    };
    for (let step = 0; step < 80; step++) {
      const move = rand(5);
      try {
        if (move === 4) {
          // Adjustments (S6) move the same balances; never your own.
          const [admin, memberId] = rand(2) ? (["ana", team.ben] as const) : (["cleo", team.ana] as const);
          await people[admin].mutation(api.storeAdmin.adjustBalance, { memberId, amount: rand(7) - 3, reason: "Fuzz grant" });
        } else if (move === 0 || ids.length === 0) {
          const who = rand(2) ? "ben" : "ana";
          const i = rand(3);
          const { redemptionId } = await people[who].mutation(api.store.redeem, { rewardId: rewards[i], expectedCost: costs[i] });
          ids.push({ id: redemptionId, by: who });
        } else {
          const { id, by } = ids[rand(ids.length)];
          if (move === 1) await people[by].mutation(api.store.cancel, { redemptionId: id });
          else {
            const action = (["approve", "decline", "fulfill"] as const)[rand(3)];
            await people[rand(2) ? "ana" : "cleo"].mutation(api.storeAdmin.decide, { redemptionId: id, action });
          }
        }
      } catch {
        // Refusals (sold out, already decided, four eyes…) must leave everything untouched.
      }
    }

    const { redemptions, members, stock, rewardDocs, adjustments } = await t.run(async (ctx) => ({
      adjustments: await ctx.db.query("balanceAdjustments").collect(),
      redemptions: await ctx.db.query("redemptions").collect(),
      members: await ctx.db.query("members").collect(),
      stock: (await ctx.db.get(rewards[0]))!.stock,
      rewardDocs: await Promise.all(rewards.map((id) => ctx.db.get(id))),
    }));
    // The walk went through every step of the lifecycle.
    expect(new Set(redemptions.flatMap((r) => r.history.map((h) => h.status))).size).toBe(5);
    for (const reward of rewardDocs) {
      const mine = redemptions.filter((r) => r.rewardId === reward!._id);
      expect(reward!.openCount ?? 0).toBe(mine.filter((r) => r.isOpen).length);
      expect(reward!.fulfilledCount ?? 0).toBe(mine.filter((r) => r.status === "fulfilled").length);
    }
    expect(redemptions.length).toBeGreaterThan(5);
    for (const m of members) {
      const held = redemptions.filter((r) => r.memberId === m._id && r.status !== "declined" && r.status !== "cancelled");
      expect(m.storeSpent ?? 0).toBe(held.reduce((sum, r) => sum + r.cost, 0));
      expect(m.storeGranted ?? 0).toBe(adjustments.filter((a) => a.memberId === m._id).reduce((sum, a) => sum + a.amount, 0));
    }
    // Zero amounts were refused and left no trace; the rest were recorded.
    expect(adjustments.length).toBeGreaterThan(3);
    expect(adjustments.every((a) => a.amount !== 0)).toBe(true);
    const heldCheap = redemptions.filter((r) => r.rewardId === rewards[0] && r.status !== "declined" && r.status !== "cancelled").length;
    expect(stock).toBe(3 - heldCheap);
    for (const r of redemptions) expect(r.isOpen).toBe(r.status === "pending" || r.status === "approved");
  });
});

// ── Balance adjustments and review aids (S6) ──────────────────────────────────

type Session = Awaited<ReturnType<typeof signInAs>>;
const myAdjustments = async (who: Session) => (await who.query(api.store.myAdjustments, { paginationOpts: page })).page;
const balanceFor = async (who: Session) => {
  const c = await who.query(api.store.catalog, {});
  return c.enabled ? c.balance : null;
};

describe("balance adjustments", () => {
  test("change the balance and are audited", async () => {
    await fund(team.ben, 5);
    const ana = await signInAs(t, team.ana);
    expect(await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 10, reason: "  Hackathon winner " })).toEqual({ balance: 15 });
    vi.advanceTimersByTime(1000);
    expect(await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: -4, reason: "Took back a hoodie" })).toEqual({ balance: 11 });

    const ben = await signInAs(t, team.ben);
    expect(await balanceFor(ben)).toBe(11);
    // Newest first, naming the admin, so the member sees who changed their balance and why.
    expect(await myAdjustments(ben)).toMatchObject([
      { amount: -4, reason: "Took back a hoodie", source: "admin", by: { name: "Ana" }, at: NOW.getTime() + 1000 },
      { amount: 10, reason: "Hackathon winner", source: "admin", by: { name: "Ana" }, at: NOW.getTime() },
    ]);
    // Grants never count as recognition.
    expect(await t.run((ctx) => ctx.db.get(team.ben))).toMatchObject({ totalReceived: 5, storeGranted: 6 });
  });

  test("can't touch your own balance, even as the only admin", async () => {
    await fund(team.ana, 5);
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ana, amount: 10, reason: "Treat myself" })).rejects.toThrow(/your own balance/);
    expect(await balanceFor(ana)).toBe(5);
  });

  test("refuse amounts out of bounds and reasons that are too short", async () => {
    await fund(team.ben, 5);
    const ana = await signInAs(t, team.ana);
    for (const amount of [0, 2.5, 10_001, -10_001]) {
      await expect(ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount, reason: "Hackathon winner" })).rejects.toThrow(/whole number/);
    }
    await expect(ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 5, reason: " ok " })).rejects.toThrow(/reason/);
    expect(await balanceFor(await signInAs(t, team.ben))).toBe(5);
  });

  test("are for admins, and only for people in their own workspace", async () => {
    await fund(team.ben, 5);
    const other = await seedTeam(t, { storeEnabled: true }, "T2");
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.storeAdmin.adjustBalance, { memberId: team.cleo, amount: 5, reason: "Nice work" })).rejects.toThrow(/admins/);
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.storeAdmin.adjustBalance, { memberId: other.ben, amount: 5, reason: "Nice work" })).rejects.toThrow(/not found/);
    await expect(ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.bot, amount: 5, reason: "Nice work" })).rejects.toThrow(/not found/);
  });

  test("need the store open: a closed store shows no balances", async () => {
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 5, reason: "Nice work" })).rejects.toThrow(/Open the store/);
  });

  test("are read-only in the shared demo", async () => {
    const userId = await t.mutation(internal.demo.ensureDemoUser, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000); // seeding, then the rollup rebuild
    const demo = t.withIdentity({ subject: `${userId}|s` });
    const lena = await t.run(async (ctx) => (await ctx.db.query("members").collect()).find((m) => m.slackUserId === "UDEMOLENA")!._id);
    await expect(demo.mutation(api.storeAdmin.adjustBalance, { memberId: lena, amount: 5, reason: "Nice work" })).rejects.toThrow(/demo/);
  }, DEMO_TIMEOUT);

  test("come from automations too, through grantBalance with source “system”", async () => {
    await fund(team.ben, 1);
    const { balance } = await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const member = (await ctx.db.get(team.ben))!;
      return await grantBalance(ctx, { workspace, member, amount: 5, reason: "Quest sweep", source: "system", now: NOW.getTime() });
    });
    expect(balance).toBe(6);
    const ben = await signInAs(t, team.ben);
    expect(await myAdjustments(ben)).toMatchObject([{ amount: 5, reason: "Quest sweep", source: "system", by: null }]);
    // The helper checks the workspace itself, like the redemption helpers.
    const other = await seedTeam(t, {}, "T2");
    await expect(
      t.run(async (ctx) =>
        grantBalance(ctx, { workspace: (await ctx.db.get(other.workspaceId))!, member: (await ctx.db.get(team.ben))!, amount: 5, reason: "Quest sweep", source: "system", now: 0 }),
      ),
    ).rejects.toThrow(/not found/);
  });

  test("are private: members see only their own, and only while the store is open", async () => {
    await fund(team.ben, 5);
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 10, reason: "Hackathon winner" });
    expect(await myAdjustments(await signInAs(t, team.cleo))).toEqual([]);
    const ben = await signInAs(t, team.ben);
    expect(await myAdjustments(ben)).toHaveLength(1);
    await setWorkspace({ storeEnabled: false });
    expect(await myAdjustments(ben)).toEqual([]);
  });
});

describe("a member's ledger", () => {
  test("reconciles: received + granted − spent is the balance", async () => {
    await setWorkspace({ storeEnabled: true, receivedVisibility: "everyone" });
    await give("<@UBEN> :taco::taco::taco::taco::taco: thanks", "UCLEO");
    await give("<@UBEN> :taco::taco: thanks");
    const rewardId = await addReward();
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 10, reason: "Hackathon winner" });
    await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: -2, reason: "Double-counted" });
    const ben = await signInAs(t, team.ben);
    const kept = (await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).redemptionId;
    const refunded = (await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 })).redemptionId;
    await ana.mutation(api.storeAdmin.decide, { redemptionId: kept, action: "fulfill" });
    await ana.mutation(api.storeAdmin.decide, { redemptionId: refunded, action: "decline" });

    const ledger = (await ana.query(api.storeAdmin.memberLedger, { memberId: team.ben }))!;
    // 7 received, +10 −2 granted, 3 spent (the declined coffee was refunded).
    expect(ledger).toMatchObject({ member: { name: "Ben" }, received: 7, granted: 8, spent: 3, balance: 12 });
    expect(ledger.adjustments.map((a) => [a.amount, a.reason, a.by?.name])).toEqual([
      [-2, "Double-counted", "Ana"],
      [10, "Hackathon winner", "Ana"],
    ]);
    expect(ledger.redemptions.map((r) => r.status).sort()).toEqual(["declined", "fulfilled"]);
    expect(await balanceFor(ben)).toBe(ledger.balance);
  });

  test("lists the latest 20 adjustments and requests while the totals cover everything", async () => {
    await fund(team.ben, 0);
    await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      for (let i = 1; i <= 25; i++) {
        const member = (await ctx.db.get(team.ben))!;
        await grantBalance(ctx, { workspace, member, amount: i, reason: `Grant ${i}`, source: "system", now: NOW.getTime() + i });
      }
    });
    const ana = await signInAs(t, team.ana);
    const ledger = (await ana.query(api.storeAdmin.memberLedger, { memberId: team.ben }))!;
    expect(ledger.adjustments).toHaveLength(20);
    expect(ledger.adjustments[0]).toMatchObject({ amount: 25, source: "system", by: null });
    expect(ledger.granted).toBe((25 * 26) / 2);
  });

  test("is for admins, in their own workspace, and only while the store is open", async () => {
    await fund(team.ben, 4);
    const other = await seedTeam(t, { storeEnabled: true }, "T2");
    const ben = await signInAs(t, team.ben);
    await expect(ben.query(api.storeAdmin.memberLedger, { memberId: team.ben })).rejects.toThrow(/admins/);
    const ana = await signInAs(t, team.ana);
    await expect(ana.query(api.storeAdmin.memberLedger, { memberId: other.ben })).rejects.toThrow(/not found/);
    // Closed (or hidden), a ledger would just be a received count in disguise.
    await setWorkspace({ storeEnabled: false });
    expect(await ana.query(api.storeAdmin.memberLedger, { memberId: team.ben })).toBeNull();
  });
});

describe("where a balance came from", () => {
  const DAY = 86_400_000;
  const tacos = (n: number) => ":taco:".repeat(n);

  /** Ben receives from each giver (Slack id → amount), then asks for a 3-kudos coffee. */
  async function benReceivesThenRequests(gifts: Record<string, number>) {
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { storeEnabled: true, dailyLimit: 100 });
      await ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: "UDAN", name: "Dan", isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 });
    });
    for (const [giver, amount] of Object.entries(gifts)) await give(`<@UBEN> ${tacos(amount)} thanks`, giver);
    const rewardId = await addReward();
    const ben = await signInAs(t, team.ben);
    const { redemptionId } = await ben.mutation(api.store.redeem, { rewardId, expectedCost: 3 });
    return { redemptionId, ana: await signInAs(t, team.ana) };
  }

  test("names the top givers with their share and flags one who brought most of it", async () => {
    const { redemptionId, ana } = await benReceivesThenRequests({ UCLEO: 24, UANA: 4, UDAN: 2 });
    const context = (await ana.query(api.storeAdmin.redemptionContext, { redemptionId }))!;
    expect(context).toMatchObject({ windowDays: 90, total: 30, concentrated: true, otherGivers: 0 });
    expect(context.givers.map((g) => [g.member.name, g.amount, g.share])).toEqual([
      ["Cleo", 24, 0.8],
      ["Ana", 4, 4 / 30],
      ["Dan", 2, 2 / 30],
    ]);
  });

  test("doesn't flag a balance spread across teammates", async () => {
    const { redemptionId, ana } = await benReceivesThenRequests({ UCLEO: 15, UANA: 15, UDAN: 10 });
    const context = (await ana.query(api.storeAdmin.redemptionContext, { redemptionId }))!;
    expect(context).toMatchObject({ total: 40, concentrated: false });
  });

  test("only counts the 90 days before the request", async () => {
    vi.setSystemTime(NOW.getTime() - 91 * DAY);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 100 }));
    await give(`<@UBEN> ${tacos(40)} long ago`, "UCLEO");
    vi.setSystemTime(NOW);
    const { redemptionId, ana } = await benReceivesThenRequests({ UANA: 5 });
    // Kudos after the request don't change what the admin saw when it came in.
    vi.advanceTimersByTime(DAY);
    await give(`<@UBEN> ${tacos(30)} later`, "UCLEO");
    const context = (await ana.query(api.storeAdmin.redemptionContext, { redemptionId }))!;
    expect(context).toMatchObject({ total: 5, concentrated: false });
    expect(context.givers.map((g) => g.member.name)).toEqual(["Ana"]);
  });

  test("counts givers beyond the top 3", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: "UEVE", name: "Eve", isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 });
    });
    const { redemptionId, ana } = await benReceivesThenRequests({ UCLEO: 4, UANA: 3, UDAN: 2, UEVE: 1 });
    const context = (await ana.query(api.storeAdmin.redemptionContext, { redemptionId }))!;
    expect(context).toMatchObject({ total: 10, otherGivers: 1 });
    expect(context.givers).toHaveLength(3);
  });

  test("is for admins in the request's workspace, and stays private while received kudos are hidden", async () => {
    const { redemptionId, ana } = await benReceivesThenRequests({ UCLEO: 5 });
    const ben = await signInAs(t, team.ben);
    await expect(ben.query(api.storeAdmin.redemptionContext, { redemptionId })).rejects.toThrow(/admins/);
    const other = await seedTeam(t, {}, "T2");
    const otherAna = await signInAs(t, other.ana);
    await expect(otherAna.query(api.storeAdmin.redemptionContext, { redemptionId })).rejects.toThrow(/not found/);
    await ana.mutation(api.storeAdmin.setStoreEnabled, { enabled: false });
    await setWorkspace({ receivedVisibility: "hidden" });
    expect(await ana.query(api.storeAdmin.redemptionContext, { redemptionId })).toBeNull();
  });
});

describe("the grantBalance helper", () => {
  const grant = (args: { memberId?: Id<"members">; amount?: number; source?: "admin" | "system"; by?: Id<"members"> | null }) =>
    t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const member = (await ctx.db.get(args.memberId ?? team.ben))!;
      const by = args.by ? (await ctx.db.get(args.by))! : undefined;
      return await grantBalance(ctx, { workspace, member, amount: args.amount ?? 5, reason: "Quest sweep", source: args.source ?? "admin", by, now: NOW.getTime() });
    });

  test("never loses a grant when a caller reuses a stale member document", async () => {
    await fund(team.ben, 1);
    const balances = await t.run(async (ctx) => {
      const workspace = (await ctx.db.get(team.workspaceId))!;
      const member = (await ctx.db.get(team.ben))!; // read once, as a quest loop might
      const a = await grantBalance(ctx, { workspace, member, amount: 5, reason: "Quest one", source: "system", now: 1 });
      const b = await grantBalance(ctx, { workspace, member, amount: 7, reason: "Quest two", source: "system", now: 2 });
      return [a.balance, b.balance];
    });
    expect(balances).toEqual([6, 13]);
    expect(await t.run((ctx) => ctx.db.get(team.ben))).toMatchObject({ storeGranted: 12 });
  });

  test("names an admin for admin adjustments, never for system grants, and never yourself", async () => {
    await fund(team.ben, 1);
    await expect(grant({ source: "admin" })).rejects.toThrow(/admin who made it/);
    await expect(grant({ source: "admin", by: team.cleo })).rejects.toThrow(/admin who made it/);
    await expect(grant({ source: "admin", by: team.ben })).rejects.toThrow(/your own balance/);
    await expect(grant({ source: "system", by: team.ana })).rejects.toThrow(/System grants/);
    expect((await grant({ source: "admin", by: team.ana })).balance).toBe(6);
  });
});

describe("adjustment privacy and edges", () => {
  test("ledgers and the member's history stay empty while received kudos are hidden", async () => {
    await fund(team.ben, 5);
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 10, reason: "Hackathon winner" });
    const ben = await signInAs(t, team.ben);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "hidden" }));
    expect(await ana.query(api.storeAdmin.memberLedger, { memberId: team.ben })).toBeNull();
    expect(await myAdjustments(ben)).toEqual([]);
    await expect(ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 1, reason: "Hackathon winner" })).rejects.toThrow(/Open the store/);
  });

  test("ledgers hide the received count under “Only me”, like Admin → Members", async () => {
    await fund(team.ben, 5);
    const ana = await signInAs(t, team.ana);
    expect(await ana.query(api.storeAdmin.memberLedger, { memberId: team.ben })).toMatchObject({ received: null, balance: 5 });
    await setWorkspace({ receivedVisibility: "everyone" });
    expect(await ana.query(api.storeAdmin.memberLedger, { memberId: team.ben })).toMatchObject({ received: 5, balance: 5 });
  });

  test("ledgers refuse bots like any other id that isn't a member", async () => {
    await fund(team.ben, 5);
    const ana = await signInAs(t, team.ana);
    await expect(ana.query(api.storeAdmin.memberLedger, { memberId: team.bot })).rejects.toThrow(/not found/);
  });

  test("admins can still settle the balance of someone who left", async () => {
    await fund(team.ben, 5);
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
    const ana = await signInAs(t, team.ana);
    expect(await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: -5, reason: "Left the company" })).toEqual({ balance: 0 });
    expect(await ana.query(api.storeAdmin.memberLedger, { memberId: team.ben })).toMatchObject({ member: { deactivated: true }, balance: 0 });
  });
});

