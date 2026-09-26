import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { CREW } from "../convex/lib/crewCatalogue";
import { DAY_MS } from "../convex/lib/time";
import { TREE_STAGE_BY_ID, type TreeStageId } from "../convex/lib/tree";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * Crew quests (#161, design plan #152 S6): the crew pools Hog coins on a part of the tree from the
 * catalogue (`lib/crewCatalogue.ts`). Admins, or players from level 8 (an admin setting), propose;
 * two at most are open at once. Contributions are spent at once and never refunded; the one that
 * reaches the goal funds it, and three days later on the workspace clock the part is built: written
 * once into the tree's cosmetics, a tree event, a DM to each contributor and a post in the
 * announcement channel (as the funding is). Contributors' names stay on the plaque.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  await treeAt("elder");
  for (const m of [team.ana, team.ben, team.cleo]) await playerAt(m, 9, 1000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The workspace's tree at `stage` (its peak growth). */
const treeAt = (stage: TreeStageId) =>
  t.run(async (ctx) => {
    const growth = TREE_STAGE_BY_ID[stage].growth;
    const tree = await ctx.db.query("trees").withIndex("by_workspace", (q) => q.eq("workspaceId", team.workspaceId)).unique();
    if (tree) await ctx.db.patch(tree._id, { sap: growth, peakGrowth: growth });
    else await ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: growth, fuel: 0, peakGrowth: growth, plantings: 0, plantedAt: Date.now() });
  });
/** A player at `level` with `coins` earned (their balance is those plus 10 a level above 1). */
const playerAt = (memberId: Id<"members">, level: number, coins: number) =>
  t.run(async (ctx) => {
    const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
    if (p) await ctx.db.patch(p._id, { level, coins });
    else await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: Date.now(), xp: 5000, level, coins });
  });

const as = (memberId: Id<"members">) => signInAs(t, memberId);
const propose = async (memberId: Id<"members">, args: { partId: string; option?: string; text?: string }) => (await as(memberId)).mutation(api.crew.propose, args);
const contribute = async (memberId: Id<"members">, questId: Id<"crewQuests">, coins: number) => (await as(memberId)).mutation(api.crew.contribute, { questId, coins });
const open = async (memberId: Id<"members">) => (await as(memberId)).query(api.crew.open, {});
const plaque = async (memberId: Id<"members">) => (await (await as(memberId)).query(api.crew.built, { paginationOpts: { numItems: 20, cursor: null } })).page;
const balance = async (memberId: Id<"members">) => (await (await as(memberId)).query(api.game.mine, {})).wallet?.balance;
const quest = (id: Id<"crewQuests">) => t.run((ctx) => ctx.db.get(id));
const cosmetics = () => t.run(async (ctx) => (await ctx.db.query("trees").withIndex("by_workspace", (q) => q.eq("workspaceId", team.workspaceId)).unique())?.cosmetics);
const crewEvents = () => t.run(async (ctx) => (await ctx.db.query("treeEvents").collect()).filter((e) => e.kind === "crew_funded" || e.kind === "crew_built"));
const crewGains = () =>
  t.run(async (ctx) => (await ctx.db.query("notifications").collect()).filter((n) => n.gains?.some((g) => g.kind === "crew_built")));
/** Runs everything scheduled (the build, DMs, posts). */
const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers, 5_000);

function stubSlack() {
  const calls: { method: string; params: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: String(url).split("/api/")[1], params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
      return Response.json({ ok: true });
    }),
  );
  return calls;
}

describe("proposing", () => {
  test("a player from level 8 proposes a part from the catalogue: its goal is the part's cost", async () => {
    const id = await propose(team.ben, { partId: "structure_lantern_bridge" });
    expect(await quest(id)).toMatchObject({ part: "structure_lantern_bridge", goal: 400, contributed: 0, contributors: 0, status: "proposed", proposedBy: team.ben });
    const view = await open(team.cleo);
    expect(view.quests).toEqual([expect.objectContaining({ _id: id, name: "Lantern bridge", goal: 400, contributed: 0, status: "proposed", proposedBy: "Ben", mine: 0 })]);
    // An open part isn't in the catalogue again.
    expect(view.available.map((p) => p.id)).not.toContain("structure_lantern_bridge");
  });

  test("below level 8 only admins propose, and an admin setting can make it admins only", async () => {
    await playerAt(team.ben, 7, 1000);
    await expect(propose(team.ben, { partId: "structure_bell" })).rejects.toThrow(/level 8/);
    expect((await open(team.ben)).canPropose).toMatchObject({ ok: false });
    await playerAt(team.ana, 1, 0);
    await propose(team.ana, { partId: "structure_bell" });

    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "admins", bannerModeration: false });
    await expect(propose(team.cleo, { partId: "structure_windmill" })).rejects.toThrow(/admins/);
    await expect((await as(team.ben)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: false })).rejects.toThrow(/admins/);
  });

  test("two quests at most are open at once", async () => {
    await propose(team.ben, { partId: "structure_bell" });
    await propose(team.cleo, { partId: "structure_windmill" });
    await expect(propose(team.ana, { partId: "structure_market_awnings" })).rejects.toThrow(/2 crew quests/);
    expect((await open(team.ana)).canPropose).toMatchObject({ ok: false });
  });

  test("the tree must be great for the crew's plaque, and each part needs its own stage", async () => {
    await treeAt("grown");
    await expect(propose(team.ben, { partId: "structure_bell" })).rejects.toThrow(/great tree/);
    expect(await open(team.ben)).toMatchObject({ enabled: false });
    await treeAt("great");
    await expect(propose(team.ben, { partId: "structure_root_stair" })).rejects.toThrow(/isn't in the catalogue/);
    await expect(propose(team.ben, { partId: "no_such_part" })).rejects.toThrow(/isn't in the catalogue/);
  });

  test("options must be the part's own; a banner's saying is one short line of plain text", async () => {
    await expect(propose(team.ben, { partId: "style_stall" })).rejects.toThrow(/Pick/);
    await expect(propose(team.ben, { partId: "style_stall", option: "neon" })).rejects.toThrow(/Pick/);
    await expect(propose(team.ben, { partId: "structure_bell", option: "mossy" })).rejects.toThrow(/Pick/);
    await expect(propose(team.ben, { partId: "banner", text: "<b>hi</b>" })).rejects.toThrow(/saying/);
    await expect(propose(team.ben, { partId: "banner", text: "x".repeat(61) })).rejects.toThrow(/saying/);
    const id = await propose(team.ben, { partId: "banner", text: "  Thanks make the tree grow  " });
    expect(await quest(id)).toMatchObject({ text: "Thanks make the tree grow" });
    const style = await propose(team.cleo, { partId: "style_stall", option: "blossom" });
    expect(await quest(style)).toMatchObject({ option: "blossom", goal: 350 });
  });

  test("nothing while the game is off or hidden from the member", async () => {
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    await expect(propose(team.ben, { partId: "structure_bell" })).rejects.toThrow(/game/);
    await expect(open(team.ben)).resolves.toMatchObject({ enabled: false, quests: [] });
  });
});

describe("contributing", () => {
  test("coins are spent at once, and only what the goal still needs", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" }); // 300
    const before = await balance(team.cleo);
    expect(await contribute(team.cleo, id, 200)).toEqual({ added: 200, funded: false });
    expect(await balance(team.cleo)).toBe(before! - 200);
    expect(await contribute(team.ana, id, 500)).toEqual({ added: 100, funded: true });
    expect(await quest(id)).toMatchObject({ contributed: 300, contributors: 2, status: "funded" });
    expect((await open(team.cleo)).quests[0]).toMatchObject({ mine: 200, status: "funded" });
  });

  test("a contribution the wallet can't cover is refused, and nothing is spent", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    await playerAt(team.cleo, 3, 0); // 20 coins
    await expect(contribute(team.cleo, id, 25)).rejects.toThrow(/you have 20/);
    expect(await quest(id)).toMatchObject({ contributed: 0, contributors: 0 });
    await expect(contribute(team.cleo, id, 0)).rejects.toThrow(/whole number/);
    await expect(contribute(team.cleo, id, 2.5)).rejects.toThrow(/whole number/);
  });

  test("below level 3 the wallet isn't open, so there's nothing to give yet", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    await playerAt(team.cleo, 2, 500);
    await expect(contribute(team.cleo, id, 5)).rejects.toThrow(/level 3/);
  });

  test("the same member's contributions add up on one line of the ledger", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.cleo, id, 5);
    await contribute(team.cleo, id, 20);
    const rows = await t.run((ctx) => ctx.db.query("crewContributions").collect());
    expect(rows).toEqual([expect.objectContaining({ memberId: team.cleo, amount: 25 })]);
    expect(await quest(id)).toMatchObject({ contributed: 25, contributors: 1 });
  });

  test("a member's first contribution ever is their crew game event (the tutorial's Together), once", async () => {
    const a = await propose(team.ben, { partId: "structure_bell" });
    const b = await propose(team.ben, { partId: "structure_windmill" });
    await contribute(team.cleo, a, 5);
    await contribute(team.cleo, a, 5);
    await contribute(team.cleo, b, 5);
    const events = await t.run((ctx) => ctx.db.query("gameEvents").withIndex("by_member_kind", (q) => q.eq("memberId", team.cleo).eq("kind", "crew")).collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ batchId: `crew:${team.cleo}`, xp: 0 });
  });

  test("contributions racing for the last coins fund the quest exactly once", async () => {
    const calls = stubSlack();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { announceChannel: { id: "CANNOUNCE", name: "announcements" } }));
    const id = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.ana, id, 290);
    const results = await Promise.allSettled([contribute(team.ben, id, 10), contribute(team.cleo, id, 10)]);
    // One funds it; the other finds it funded and spends nothing.
    expect(results.filter((r) => r.status === "fulfilled").map((r) => r.value)).toEqual([{ added: 10, funded: true }]);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await quest(id)).toMatchObject({ contributed: 300, status: "funded" });
    expect((await crewEvents()).filter((e) => e.kind === "crew_funded")).toHaveLength(1);
    await settle();
    expect(calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === "CANNOUNCE" && c.params.text.startsWith("The crew funded"))).toHaveLength(1);
  });

  test("a funded quest takes no more coins", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.ana, id, 300);
    await expect(contribute(team.cleo, id, 5)).rejects.toThrow(/funded/);
  });

  test("another workspace's quest can't be found", async () => {
    const other = await seedTeam(t, { gameEnabled: true }, "T2");
    const id = await propose(team.ben, { partId: "structure_bell" });
    await t.run((ctx) => ctx.db.insert("players", { workspaceId: other.workspaceId, memberId: other.ben, since: Date.now(), xp: 5000, level: 9, coins: 500 }));
    await expect(contribute(other.ben, id, 5)).rejects.toThrow(/isn't open/);
  });
});

describe("building", () => {
  test("three days after funding on the workspace clock the part is built, written once into the tree", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.ana, id, 300);
    expect(await cosmetics()).toBeFalsy();
    await t.finishInProgressScheduledFunctions();
    vi.setSystemTime(Date.now() + CREW.buildDays * DAY_MS - 60_000);
    await t.mutation(internal.crew.build, { questId: id });
    expect(await quest(id)).toMatchObject({ status: "funded" });
    await settle();
    expect(await quest(id)).toMatchObject({ status: "built" });
    expect(await cosmetics()).toEqual([expect.objectContaining({ part: "structure_bell", questId: id })]);
    // Building again changes nothing.
    await t.mutation(internal.crew.build, { questId: id });
    expect(await cosmetics()).toHaveLength(1);
    expect((await crewEvents()).map((e) => e.kind).sort()).toEqual(["crew_built", "crew_funded"]);
  });

  test("a simulator's clock running ahead builds it as its days go by", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.ana, id, 300);
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { clockOffsetMs: CREW.buildDays * DAY_MS + 1 });
      const { settleCrew } = await import("../convex/crew");
      await settleCrew(ctx, (await ctx.db.get(team.workspaceId))!);
    });
    expect(await quest(id)).toMatchObject({ status: "built" });
  });

  test("a style, the canopy colour or the banner proposed again replaces the one built", async () => {
    for (const option of ["mossy", "crystal"]) {
      const id = await propose(team.ben, { partId: "style_stall", option });
      await contribute(team.ana, id, 350);
      vi.setSystemTime(Date.now() + CREW.buildDays * DAY_MS);
      await settle();
    }
    expect(await cosmetics()).toEqual([expect.objectContaining({ part: "style_stall", option: "crystal" })]);
    // A structure is built once: it leaves the catalogue.
    const bell = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.ana, bell, 300);
    vi.setSystemTime(Date.now() + CREW.buildDays * DAY_MS);
    await settle();
    expect((await open(team.ana)).available.map((p) => p.id)).toContain("style_stall");
    expect((await open(team.ana)).available.map((p) => p.id)).not.toContain("structure_bell");
    await expect(propose(team.ben, { partId: "structure_bell" })).rejects.toThrow(/isn't in the catalogue/);
    // Paying to build what's already there changes nothing: refused.
    await expect(propose(team.ben, { partId: "style_stall", option: "crystal" })).rejects.toThrow(/already/);
  });

  test("each contributor gets one DM when it's built; funding and building are posted once each", async () => {
    const calls = stubSlack();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { announceChannel: { id: "CANNOUNCE", name: "announcements" } }));
    const id = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.cleo, id, 100);
    await contribute(team.cleo, id, 100);
    await contribute(team.ana, id, 100);
    vi.setSystemTime(Date.now() + CREW.buildDays * DAY_MS);
    await settle();
    const dms = await crewGains();
    expect(dms.map((n) => n.memberId).sort()).toEqual([team.ana, team.cleo].sort());
    expect(dms[0].gains).toEqual([{ kind: "crew_built", part: "The bell", contributors: 2 }]);
    const posts = calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === "CANNOUNCE").map((c) => c.params.text);
    expect(posts).toEqual([
      "The crew funded the bell: 300 Hog coins from 2 teammates. It will be built in 3 days.",
      "The crew built the bell at the Ancient Tree. 2 teammates made it happen.",
    ]);
    await t.mutation(internal.crew.build, { questId: id });
    await settle();
    expect(await crewGains()).toHaveLength(2);
  });

  test("the plaque pages through everything the crew built, newest built first", async () => {
    for (const option of ["mossy", "lantern", "blossom"]) {
      const id = await propose(team.ben, { partId: "style_stall", option });
      await contribute(team.ana, id, 350);
      vi.setSystemTime(Date.now() + CREW.buildDays * DAY_MS);
      await settle();
    }
    const first = await (await as(team.cleo)).query(api.crew.built, { paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page.map((b) => b.option)).toEqual(["blossom", "lantern"]);
    const rest = await (await as(team.cleo)).query(api.crew.built, { paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    expect(rest.page.map((b) => b.option)).toEqual(["mossy"]);
  });

  test("the plaque lists what the crew built with the names of everyone who gave", async () => {
    const id = await propose(team.ben, { partId: "banner", text: "Thanks make the tree grow" });
    await contribute(team.cleo, id, 150);
    await contribute(team.ana, id, 50);
    vi.setSystemTime(Date.now() + CREW.buildDays * DAY_MS);
    await settle();
    expect(await plaque(team.ben)).toEqual([
      expect.objectContaining({ part: "banner", name: "Banner", text: "Thanks make the tree grow", proposedBy: "Ben", contributors: ["Cleo", "Ana"] }),
    ]);
  });
});

describe("banner moderation", () => {
  test("with moderation on, a banner waits for an admin's approval before it takes coins", async () => {
    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: true });
    const id = await propose(team.ben, { partId: "banner", text: "Onwards and upwards" });
    expect((await open(team.cleo)).quests[0]).toMatchObject({ awaitingApproval: true });
    await expect(contribute(team.cleo, id, 5)).rejects.toThrow(/approv/);
    await expect((await as(team.ben)).mutation(api.crew.approveBanner, { questId: id })).rejects.toThrow(/admins/);
    await (await as(team.ana)).mutation(api.crew.approveBanner, { questId: id });
    expect(await contribute(team.cleo, id, 5)).toMatchObject({ added: 5 });
  });

  test("an admin's own banner needs no second look", async () => {
    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: true });
    const own = await propose(team.ana, { partId: "banner", text: "Onwards and upwards" });
    expect(await quest(own)).not.toHaveProperty("awaitingApproval");
  });

  test("a saying waiting for approval is shown only to admins and whoever proposed it", async () => {
    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: true });
    await propose(team.ben, { partId: "banner", text: "Onwards and upwards" });
    expect((await open(team.cleo)).quests[0]).toMatchObject({ awaitingApproval: true, text: null });
    expect((await open(team.ben)).quests[0]).toMatchObject({ text: "Onwards and upwards" });
    expect((await open(team.ana)).quests[0]).toMatchObject({ text: "Onwards and upwards" });
  });

  test("switching moderation off lets a waiting banner take coins", async () => {
    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: true });
    const id = await propose(team.ben, { partId: "banner", text: "Onwards and upwards" });
    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: false });
    expect((await open(team.cleo)).quests[0]).toMatchObject({ awaitingApproval: false, text: "Onwards and upwards" });
    expect(await contribute(team.cleo, id, 5)).toMatchObject({ added: 5 });
  });

  test("in the shared demo nobody writes on the tree: banners aren't proposed there", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { isDemo: true }));
    await expect(propose(team.ana, { partId: "banner", text: "Anything at all" })).rejects.toThrow(/shared demo/);
    expect((await open(team.ana)).available.map((p) => p.id)).not.toContain("banner");
  });

  test("an admin can call off a quest the crew has given to, and every coin goes back", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    const before = { ben: await balance(team.ben), cleo: await balance(team.cleo) };
    await contribute(team.ben, id, 40);
    await contribute(team.cleo, id, 60);
    await expect((await as(team.ben)).mutation(api.crew.withdraw, { questId: id })).rejects.toThrow(/given/);
    await (await as(team.ana)).mutation(api.crew.withdraw, { questId: id });
    expect(await quest(id)).toBeNull();
    expect(await balance(team.ben)).toBe(before.ben);
    expect(await balance(team.cleo)).toBe(before.cleo);
    expect(await t.run((ctx) => ctx.db.query("crewContributions").collect())).toEqual([]);
    // A funded one is being built: nobody calls it off.
    const bell = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.ana, bell, 300);
    await expect((await as(team.ana)).mutation(api.crew.withdraw, { questId: bell })).rejects.toThrow(/isn't open/);
  });

  test("another workspace's admin can neither approve nor withdraw", async () => {
    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: true });
    const id = await propose(team.ben, { partId: "banner", text: "Onwards and upwards" });
    const other = await seedTeam(t, { gameEnabled: true }, "T2");
    await expect((await as(other.ana)).mutation(api.crew.approveBanner, { questId: id })).rejects.toThrow(/isn't waiting/);
    await expect((await as(other.ana)).mutation(api.crew.withdraw, { questId: id })).rejects.toThrow(/isn't open/);
  });

  test("an admin can turn down a waiting banner, and a proposal nobody has given to can be withdrawn", async () => {
    await (await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "level", bannerModeration: true });
    const banner = await propose(team.ben, { partId: "banner", text: "Onwards and upwards" });
    await (await as(team.ana)).mutation(api.crew.withdraw, { questId: banner });
    expect(await quest(banner)).toBeNull();
    const bell = await propose(team.ben, { partId: "structure_bell" });
    await expect((await as(team.cleo)).mutation(api.crew.withdraw, { questId: bell })).rejects.toThrow(/proposed it/);
    await contribute(team.cleo, bell, 5);
    await expect((await as(team.ben)).mutation(api.crew.withdraw, { questId: bell })).rejects.toThrow(/given/);
  });

  test("settings are admins' and read-only in the shared demo", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { isDemo: true }));
    await expect((await as(team.ana)).mutation(api.crew.updateSettings, { proposers: "admins", bannerModeration: true })).rejects.toThrow(/read-only/);
  });
});

describe("removal", () => {
  test("a departed member's contributions and proposals stay, as a former teammate", async () => {
    const id = await propose(team.ben, { partId: "structure_bell" });
    await contribute(team.ben, id, 100);
    await contribute(team.cleo, id, 200);
    vi.setSystemTime(Date.now() + CREW.buildDays * DAY_MS);
    await settle();
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await settle();
    expect(await t.run((ctx) => ctx.db.get(team.ben))).toBeNull();
    expect(await plaque(team.cleo)).toEqual([expect.objectContaining({ proposedBy: "a former teammate", contributors: ["a former teammate", "Cleo"] })]);
    expect(await quest(id)).toMatchObject({ contributed: 300, contributors: 2 });
    const rows: Doc<"crewContributions">[] = await t.run((ctx) => ctx.db.query("crewContributions").collect());
    expect(rows.every((r) => r.memberId !== team.ben)).toBe(true);
  });
});

describe("stories (the demo, #165)", () => {
  test("a story's quest is history: built onto the tree, on the plaque, with no DM, post or game event", async () => {
    await t.mutation(internal.crew.seedStory, { workspaceId: team.workspaceId, part: "canopy_colour", option: "rose", built: true });
    await t.mutation(internal.crew.seedStory, { workspaceId: team.workspaceId, part: "structure_windmill", built: false, share: 0.6 });
    await settle();
    expect(await cosmetics()).toEqual([expect.objectContaining({ part: "canopy_colour", option: "rose" })]);
    expect(await plaque(team.ana)).toEqual([expect.objectContaining({ part: "canopy_colour", contributed: 1500, contributors: ["Ana", "Ben", "Cleo"] })]);
    expect((await open(team.ana)).quests).toEqual([expect.objectContaining({ part: "structure_windmill", contributed: 360, status: "proposed" })]);
    expect(await crewGains()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("gameEvents").collect())).toEqual([]);
  });
});
