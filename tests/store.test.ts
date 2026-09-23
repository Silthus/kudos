import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { all, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

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
      ["Sticker", true, true, false, 0],
      ["Coffee on us", true, false, false, 0],
      ["Hoodie", false, false, false, 0],
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

  test("the shared demo catalog is read-only", async () => {
    const userId = await t.mutation(internal.demo.ensureDemoUser, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
  });
});
