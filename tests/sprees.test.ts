import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { signSlackRequest } from "../convex/lib/slack";
import { coinBalance } from "../convex/lib/coins";
import { all, claimAtTree, member, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/**
 * Kudos sprees in Slack (#94, game spec §G6): clicking the bot's reaction on a thoughtful kudos
 * offers Join / Not now; joins reserve today's kudos and wait for a tier (5, 10, 20, 50, 100
 * distinct joiners), which pays them out to the receivers as real kudos. Slack is a stubbed `fetch`.
 */

const SECRET = "test-signing-secret";
const RESPONSE_URL = "https://hooks.slack.com/actions/T1/1/abc";

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;
/** Teammates beyond Ana, Ben and Cleo: enough to reach two tiers. */
let crowd: { id: Id<"members">; slackUserId: string }[];

function stubSlackApi() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const api = String(url).split("https://slack.com/api/")[1];
      const body = String(init?.body ?? "");
      const params = api ? Object.fromEntries(new URLSearchParams(body)) : JSON.parse(body || "{}");
      calls.push({ method: api ?? String(url), params });
      if (api === "conversations.info") return Response.json({ ok: true, channel: { name: "general" } });
      if (api === "conversations.history") return Response.json({ ok: true, messages: [] });
      return Response.json({ ok: true });
    }),
  );
}

/** Runs what's due now (never a spree's 24 h deadline, unlike `finishAllScheduledFunctions`). */
async function settle() {
  for (let i = 0; i < 6; i++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }
}

let ts = 100;
const post = async (text: string, user = "UANA", messageTs = `${ts++}.0001`, extra: object = {}) => {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user, text, channel: "C1", ts: messageTs, ...extra } });
  await settle();
  return messageTs;
};
const react = async (user: string, messageTs: string, reaction = "taco", itemUser = "UANA") => {
  await t.action(internal.slack.processEvent, {
    teamId: "T1",
    event: { type: "reaction_added", user, reaction, item_user: itemUser, item: { type: "message", channel: "C1", ts: messageTs } },
  });
  await settle();
};
const unreact = async (user: string, messageTs: string, reaction = "taco", itemUser = "UANA") => {
  await t.action(internal.slack.processEvent, {
    teamId: "T1",
    event: { type: "reaction_removed", user, reaction, item_user: itemUser, item: { type: "message", channel: "C1", ts: messageTs } },
  });
  await settle();
};

const ephemerals = (user?: string) =>
  calls.filter((c) => c.method === "chat.postEphemeral" && (!user || c.params.user === user)).map((c) => ({ ...c.params, blocks: JSON.parse(c.params.blocks ?? "[]") }));
const posts = () => calls.filter((c) => c.method === "chat.postMessage").map((c) => ({ ...c.params, blocks: JSON.parse(c.params.blocks ?? "[]") }));
const responses = () => calls.filter((c) => c.method === RESPONSE_URL).map((c) => c.params);

/** The Join button of the last prompt `user` saw. */
function lastPrompt(user: string) {
  const prompt = ephemerals(user).findLast((e) => e.blocks.some((b: { type: string }) => b.type === "actions"));
  if (!prompt) throw new Error(`${user} saw no spree prompt`);
  const buttons = prompt.blocks.find((b: { type: string }) => b.type === "actions").elements as { action_id: string; value: string; text: { text: string } }[];
  return { text: prompt.text as string, thread: prompt.thread_ts as string | undefined, buttons };
}

async function click(user: string, actionId: string, value: string) {
  const payload = JSON.stringify({
    type: "block_actions",
    team: { id: "T1" },
    user: { id: user, team_id: "T1" },
    response_url: RESPONSE_URL,
    actions: [{ type: "button", action_id: actionId, value }],
  });
  const body = new URLSearchParams({ payload }).toString();
  const stamp = String(Math.floor(Date.now() / 1000));
  const res = await t.fetch("/slack/interactions", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": stamp,
      "x-slack-signature": await signSlackRequest(SECRET, stamp, body),
    },
    body,
  });
  expect(res.status).toBe(200);
  await settle();
}

/** `user` clicks the bot's reaction on Ana's kudos, then Join. */
async function join(user: string, messageTs: string) {
  await react(user, messageTs);
  const join = lastPrompt(user).buttons.find((b) => b.action_id === "spree_join")!;
  await click(user, "spree_join", join.value);
}

const spreeOf = async (messageTs: string) =>
  await t.run(async (ctx) => {
    const spree = await ctx.db.query("sprees").withIndex("by_message", (q) => q.eq("workspaceId", team.workspaceId).eq("channelId", "C1").eq("messageTs", messageTs)).unique();
    const joins = spree ? await ctx.db.query("spreeJoins").withIndex("by_spree_member", (q) => q.eq("spreeId", spree._id)).collect() : [];
    return { spree, joins };
  });

const THOUGHTFUL = "<@UBEN> :taco: thanks for the thorough review today";

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { spreesEnabled: true, gameEnabled: true });
  crowd = await t.run(async (ctx) => {
    const out = [];
    for (const name of ["Dev", "Eli", "Fay", "Gus", "Hal", "Ida", "Jo", "Kai", "Lou", "Max", "Ned"]) {
      const slackUserId = `U${name.toUpperCase()}`;
      const id = await ctx.db.insert("members", {
        workspaceId: team.workspaceId,
        slackUserId,
        name,
        isAdmin: false,
        isBot: false,
        deactivated: false,
        totalGiven: 0,
        totalReceived: 0,
        totalMaxedDays: 0,
      });
      out.push({ id, slackUserId });
    }
    return out;
  });
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://kudos.example");
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("admin settings (§G6, §G14)", () => {
  test("a new workspace starts with reaction-giving and sprees off; a reinstall keeps what the admins chose", async () => {
    const install = () =>
      t.mutation(internal.slackData.saveInstallation, { teamId: "TNEW", teamName: "New", botToken: "x", botUserId: "UB", appId: "A", installerSlackId: "UFIRST", scope: "" });
    const id = await install();
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ reactionsEnabled: false, spreesEnabled: false });
    await t.run((ctx) => ctx.db.patch(id, { reactionsEnabled: true, spreesEnabled: true }));
    await install();
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ reactionsEnabled: true, spreesEnabled: true });
  });

  test("admins switch sprees on and off; everyone's settings say whether they're on", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { spreesEnabled: undefined }));
    const ana = await signInAs(t, team.ana);
    const overview = await ana.query(api.admin.overview, {});
    expect(overview.settings).toMatchObject({ spreesEnabled: false });
    const { spreesEnabled: _, ...settings } = overview.settings;
    await ana.mutation(api.admin.updateSettings, { ...settings, spreesEnabled: true });
    expect((await ana.query(api.admin.overview, {})).settings).toMatchObject({ spreesEnabled: true });
    const viewer = await ana.query(api.session.viewer, {});
    expect(viewer.status === "ready" && viewer.workspace.spreesEnabled).toBe(true);
    const ben = await signInAs(t, team.ben);
    await expect(ben.mutation(api.admin.updateSettings, { ...settings, spreesEnabled: false })).rejects.toThrow();
  });
});

describe("clicking the bot's reaction on a thoughtful kudos offers to join its spree", () => {
  test("a teammate sees Join / Not now with what it costs and how far the spree is", async () => {
    const msg = await post(THOUGHTFUL);
    calls = [];
    await react("UCLEO", msg);
    const prompt = lastPrompt("UCLEO");
    expect(prompt.text).toBe("Join <@UANA>'s kudos for <@UBEN>? Uses 1 kudos today + 1 of your 5 spree joins this month · 0/5 joined");
    expect(prompt.buttons.map((b) => [b.action_id, b.text.text])).toEqual([
      ["spree_join", "Join"],
      ["spree_dismiss", "Not now"],
    ]);
    // A click is not a kudos: nothing was given for the reaction.
    expect((await all(t, "kudos")).map((k) => k.source)).toEqual(["message"]);
  });

  test("the prompt goes into the kudos' thread when the kudos was a thread reply", async () => {
    const msg = await post(THOUGHTFUL, "UANA", "300.0001", { thread_ts: "299.0001" });
    await react("UCLEO", msg);
    expect(lastPrompt("UCLEO").thread).toBe("299.0001");
  });

  test("no spree without the switch: the bot's reaction is plain reaction-giving then", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { spreesEnabled: false, reactionsEnabled: true }));
    const msg = await post(THOUGHTFUL);
    await react("UCLEO", msg);
    expect(ephemerals("UCLEO").some((e) => e.blocks.some((b: { type: string }) => b.type === "actions"))).toBe(false);
    expect((await all(t, "kudos")).map((k) => k.source).sort()).toEqual(["message", "reaction"]);
  });

  test("with sprees on, clicking the bot's kudos emoji never also gives a reaction kudos", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { reactionsEnabled: true }));
    const msg = await post(THOUGHTFUL);
    await react("UCLEO", msg);
    expect((await all(t, "kudos")).map((k) => k.source)).toEqual(["message"]);
  });

  test("the ✅ fallback reaction is the bot's reaction too", async () => {
    const msg = await post(THOUGHTFUL);
    await t.run(async (ctx) => {
      const attempt = (await ctx.db.query("kudosAttempts").collect())[0];
      await ctx.db.patch(attempt._id, { reaction: "white_check_mark" });
    });
    await react("UCLEO", msg, "white_check_mark");
    expect(lastPrompt("UCLEO").text).toContain("0/5 joined");
  });

  test("only thoughtful kudos the bot confirmed can spree", async () => {
    const thin = await post("<@UBEN> :taco:");
    await react("UCLEO", thin);
    // Unconfirmed: Slack never showed the bot's reaction.
    const unconfirmed = await post(THOUGHTFUL.replace("today", "yesterday"));
    await t.run(async (ctx) => {
      for (const a of await ctx.db.query("kudosAttempts").collect()) if (a.messageTs === unconfirmed) await ctx.db.patch(a._id, { reaction: undefined });
    });
    await react("UCLEO", unconfirmed);
    // A thank-back within 72 h doesn't qualify either.
    await post("<@UANA> :taco: thanks for all the help this week", "UBEN");
    const back = await post("<@UBEN> :taco: right back at you, friend", "UANA");
    await react("UCLEO", back);
    expect(ephemerals("UCLEO").some((e) => e.blocks.some((b: { type: string }) => b.type === "actions"))).toBe(false);
  });

  test("a kudos for more than 5 people doesn't spree (a tier must fit one transaction)", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 10 }));
    const msg = await post("<@UBEN> <@UDEV> <@UELI> <@UFAY> <@UGUS> <@UHAL> :taco: thanks for carrying the launch together");
    await react("UCLEO", msg);
    expect(ephemerals("UCLEO").some((e) => e.blocks.some((b: { type: string }) => b.type === "actions"))).toBe(false);
  });

  test("review: a ✅ or kudos-emoji reaction that isn't a spree gesture creates no member", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { spreesEnabled: false, reactionsEnabled: false }));
    const msg = await post(THOUGHTFUL);
    const count = async () => (await t.run((ctx) => ctx.db.query("members").collect())).length;
    const before = await count();
    await react("USTRANGER", msg, "white_check_mark", "UANA");
    await react("USTRANGER", msg, "taco", "UANA");
    expect(await count()).toBe(before);
  });

  test("review: a thoughtful kudos older than 24 h that nobody joined is no spree; its reaction gives as before", async () => {
    const msg = await post(THOUGHTFUL);
    vi.advanceTimersByTime(25 * 3_600_000);
    calls = [];
    await react("UCLEO", msg);
    expect(ephemerals("UCLEO").map((e) => e.text)).not.toContain("This spree is over.");
    expect((await all(t, "kudos")).map((k) => k.source).sort()).toEqual(["message", "reaction"]);
  });

  test("the giver and the receivers get no prompt; others who can't join are told why", async () => {
    const msg = await post(THOUGHTFUL);
    calls = [];
    await react("UANA", msg);
    await react("UBEN", msg);
    expect(ephemerals()).toEqual([]);
  });
});

describe("joining", () => {
  test("a join reserves today's kudos per person named and one spree join; the prompt turns into the result", async () => {
    const msg = await post("<@UBEN> <@UDEV> :taco: thanks for the thorough review today");
    calls = [];
    await join("UCLEO", msg);
    expect(responses()).toEqual([
      expect.objectContaining({ replace_original: true, text: "You joined <@UANA>'s kudos for <@UBEN> and <@UDEV> · 1/5 joined. It pays out when 5 have joined." }),
    ]);
    const { spree, joins } = await spreeOf(msg);
    expect(spree).toMatchObject({ joiners: 1, tier: 0, status: "open" });
    expect(joins).toMatchObject([{ memberId: team.cleo, status: "waiting", amount: 2 }]);
    // 2 of Cleo's 5 are reserved: nothing given yet, but only 3 left.
    expect(await all(t, "kudos")).toHaveLength(2);
    await post("<@UANA> <@UBEN> <@UDEV> <@UELI> :taco: great sprint planning session", "UCLEO");
    expect((await all(t, "kudos")).filter((k) => k.giverId === team.cleo)).toHaveLength(0);
  });

  test("review: the web app's allowance counts the kudos a waiting join reserves", async () => {
    const msg = await post("<@UBEN> <@UDEV> :taco: thanks for the thorough review today");
    await join("UCLEO", msg);
    const cleo = await signInAs(t, team.cleo);
    expect(await cleo.query(api.me.today, { today: TODAY })).toMatchObject({ used: 2, remaining: 3 });
    expect((await cleo.query(api.me.overview, { today: TODAY, period: "month" })).today).toMatchObject({ used: 2, remaining: 3 });
  });

  test("Join twice (a double click or a Slack retry) joins once", async () => {
    const msg = await post(THOUGHTFUL);
    await react("UCLEO", msg);
    const value = lastPrompt("UCLEO").buttons[0].value;
    await click("UCLEO", "spree_join", value);
    await click("UCLEO", "spree_join", value);
    const { spree, joins } = await spreeOf(msg);
    expect(spree?.joiners).toBe(1);
    expect(joins).toHaveLength(1);
    expect(responses().at(-1)?.text).toBe("You're already in this spree.");
  });

  test("Not now just closes the prompt", async () => {
    const msg = await post(THOUGHTFUL);
    await react("UCLEO", msg);
    await click("UCLEO", "spree_dismiss", lastPrompt("UCLEO").buttons[1].value);
    expect(responses()).toEqual([expect.objectContaining({ delete_original: true })]);
    expect((await spreeOf(msg)).spree).toBeNull();
  });

  test("without enough kudos left today, or with no spree joins left this month, you're told why", async () => {
    const msg = await post(THOUGHTFUL);
    await post("<@UANA> :taco::taco::taco::taco::taco: wonderful mentoring all week long", "UCLEO");
    calls = [];
    await react("UCLEO", msg);
    expect(ephemerals("UCLEO").map((e) => e.text)).toEqual(["Joining takes 1 kudos from today, and you have 0 left."]);

    // Dev used all 5 joins this month on earlier sprees.
    const dev = crowd[0];
    await t.run(async (ctx) => {
      const spreeId = await ctx.db.insert("sprees", {
        workspaceId: team.workspaceId, batchId: "old", channelId: "C0", messageTs: "1.0", giverId: team.ana, receiverIds: [team.ben], text: "", kudosAt: Date.now(),
        status: "lapsed", tier: 0, joiners: 0, deadline: Date.now(), tiers: [],
      });
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("spreeJoins", { workspaceId: team.workspaceId, spreeId, memberId: dev.id, status: "paid", at: Date.now(), dayKey: "2026-09-01", month: "2026-09", amount: 1 });
      }
    });
    await react(dev.slackUserId, msg);
    expect(ephemerals(dev.slackUserId).map((e) => e.text)).toEqual(["You've used all 5 of your spree joins this month. They come back on the 1st."]);
  });
});

describe("spree joins a month", () => {
  const cleoPlays = (skills: Record<string, number> = {}) =>
    t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.cleo, since: Date.now() - 1000, xp: 700, level: 6, coins: 0, skills }));
  const buyJoin = () =>
    t.run((ctx) => ctx.db.insert("itemPurchases", { workspaceId: team.workspaceId, memberId: team.cleo, item: "spreeJoin", price: 8, month: "2026-09", at: Date.now() }));

  test("the Wanderer skill adds 2, and every extra spree join bought this month 1", async () => {
    await cleoPlays({ pathfinder: 1, wanderer: 1 });
    await buyJoin();
    const msg = await post(THOUGHTFUL);
    await react("UCLEO", msg);
    expect(lastPrompt("UCLEO").text).toContain("1 of your 8 spree joins this month");
  });

  test("Wanderer can be taken now that sprees exist", async () => {
    await cleoPlays({ pathfinder: 1 });
    const cleo = await signInAs(t, team.cleo);
    await cleo.mutation(api.skills.take, { skill: "wanderer" });
    expect(await cleo.query(api.skills.mine, {})).toMatchObject({ skills: { pathfinder: 1, wanderer: 1 } });
  });

  test("a bought join can't be handed back once this month's joins need it", async () => {
    await cleoPlays();
    const purchaseId = await buyJoin();
    const handBack = () =>
      t.run(async (ctx) => {
        const { undoPurchase } = await import("../convex/store");
        return await undoPurchase(ctx, (await ctx.db.get(purchaseId))!);
      });
    await t.run(async (ctx) => {
      const spreeId = await ctx.db.insert("sprees", {
        workspaceId: team.workspaceId, batchId: "old", channelId: "C0", messageTs: "1.0", giverId: team.ana, receiverIds: [team.ben], text: "", kudosAt: Date.now(),
        status: "complete", tier: 1, joiners: 5, deadline: Date.now(), tiers: [],
      });
      for (let i = 0; i < 6; i++) {
        await ctx.db.insert("spreeJoins", { workspaceId: team.workspaceId, spreeId, memberId: team.cleo, status: "paid", at: Date.now(), dayKey: "2026-09-01", month: "2026-09", amount: 1 });
      }
    });
    expect(await handBack()).toBe(false);
    expect(await t.run((ctx) => ctx.db.get(purchaseId))).not.toBeNull();
    await t.run(async (ctx) => {
      const one = (await ctx.db.query("spreeJoins").collect())[0];
      await ctx.db.patch(one._id, { status: "lapsed" });
    });
    expect(await handBack()).toBe(true);
  });
});

describe("tiers", () => {
  test("the 5th joiner reaches tier 1: waiting joins become real kudos for the receiver, a thread reply, and rewards", async () => {
    await post("<@UDEV> :taco: thanks for the lovely team lunch", "UBEN"); // Ben plays: receiving earns him XP
    const msg = await post(THOUGHTFUL);
    const joiners = ["UCLEO", ...crowd.slice(0, 4).map((c) => c.slackUserId)];
    for (const u of joiners.slice(0, 4)) await join(u, msg);
    expect((await all(t, "kudos")).filter((k) => k.source === "spree")).toEqual([]); // nothing pays before the tier
    calls = [];
    await join(joiners[4], msg);

    const pooled = (await all(t, "kudos")).filter((k) => k.source === "spree");
    expect(pooled).toHaveLength(5);
    expect(new Set(pooled.map((k) => k.receiverId))).toEqual(new Set([team.ben]));
    expect((await member(t, team.ben)).totalReceived).toBe(6);
    const { spree, joins } = await spreeOf(msg);
    expect(spree).toMatchObject({ tier: 1, joiners: 5, status: "open" });
    expect(joins.every((j) => j.status === "paid" && j.tier === 1)).toBe(true);

    // A public reply in the kudos' thread.
    const reply = posts().find((p) => p.channel === "C1");
    expect(reply).toMatchObject({ thread_ts: msg });
    expect(reply!.text).toBe("🎉 <@UANA>'s kudos for <@UBEN> became a spree of 5! Next: 10 within 24 hours.");

    // XP and coins: joiners 10 XP + 1 coin, the giver 20 XP + 5 coins, the receiver 5 XP.
    const events = (await all(t, "gameEvents")).filter((e) => e.kind === "spree");
    const byMember = new Map(events.map((e) => [e.memberId, [e.role, e.xp, e.coins ?? 0]]));
    expect(byMember.get(team.cleo)).toEqual(["joined", 10, 1]);
    expect(byMember.get(team.ana)).toEqual(["started", 20, 5]);
    expect(byMember.get(team.ben)).toEqual(["received", 5, 0]);

    // The receiver's DM is rolled at Uncommon or rarer (tier 1).
    const benDm = (await all(t, "notifications")).find((n) => n.memberId === team.ben && n.category === "receiver_success" && n.slackText.includes("spree"));
    expect(benDm?.rarity).not.toBe("common");
  });

  test("later joiners wait for the next tier; earlier joiners get +1 coin + 5 XP when it's reached", async () => {
    const msg = await post(THOUGHTFUL);
    const people = ["UCLEO", ...crowd.map((c) => c.slackUserId)];
    for (const u of people.slice(0, 7)) await join(u, msg);
    expect((await all(t, "kudos")).filter((k) => k.source === "spree")).toHaveLength(5);
    expect((await spreeOf(msg)).joins.filter((j) => j.status === "waiting")).toHaveLength(2);
    for (const u of people.slice(7, 10)) await join(u, msg);
    const { spree } = await spreeOf(msg);
    expect(spree).toMatchObject({ tier: 2, joiners: 10 });
    const cleo = (await all(t, "gameEvents")).filter((e) => e.kind === "spree" && e.memberId === team.cleo).map((e) => [e.tier, e.xp, e.coins]);
    expect(cleo).toEqual([[1, 10, 1], [2, 5, 1]]);
  });

  test("spree coins are their own source in the wallet (players.spreeCoins, like fruit), and a revoke takes the giver's back", async () => {
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(0, 4).map((c) => c.slackUserId)]) await join(u, msg);
    const wallet = async (id: Id<"members">) => {
      await claimAtTree(t, id); // her kudos' coin, offered at the tree (#157)
      const player = (await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", id)).unique()))!;
      return { spreeCoins: player.spreeCoins, coins: player.coins ?? 0, ...coinBalance(player) };
    };
    const ana = await wallet(team.ana);
    expect(ana).toMatchObject({ spreeCoins: 5, fromSprees: 5, fromKudos: 1 }); // 1 coin for her kudos, 5 for the spree
    expect(ana.balance).toBe(ana.coins + ana.fromLevels); // every coin counted once
    expect(await wallet(team.cleo)).toMatchObject({ spreeCoins: 1, fromSprees: 1, fromKudos: 0 });
    await t.run(async (ctx) => {
      const { revokeKudosRow } = await import("../convex/engine");
      const original = (await ctx.db.query("kudos").collect()).find((k) => k.source === "message")!;
      await revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, original);
    });
    expect(await wallet(team.ana)).toMatchObject({ fromSprees: 0, fromKudos: 0 });
  });

  test("a game rebuild (switching on, the repair tool) keeps exactly what the spree paid", async () => {
    await post("<@UDEV> :taco: thanks for the lovely team lunch", "UBEN");
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(0, 6).map((c) => c.slackUserId)]) await join(u, msg);
    const snapshot = async () =>
      (await all(t, "players")).map((p) => [p.memberId, p.xp, p.coins ?? 0, p.level]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const events = async () => (await all(t, "gameEvents")).map((e) => [e.memberId, e.kind, e.xp, e.coins ?? 0, e.kudosId ?? null]).sort();
    const live = { players: await snapshot(), events: await events() };
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await settle();
    expect(await snapshot()).toEqual(live.players);
    expect(await events()).toEqual(live.events);
  });

  test("review: a give between a join and its payout keeps what it earned through a rebuild", async () => {
    await post("<@UDEV> :taco: thanks for the lovely team lunch", "UBEN");
    const msg = await post(THOUGHTFUL);
    await join("UCLEO", msg);
    vi.advanceTimersByTime(60_000);
    await post("<@UBEN> :taco: your demo prep saved the whole afternoon", "UCLEO"); // Cleo's first to Ben: a new connection
    vi.advanceTimersByTime(60_000);
    for (const u of crowd.slice(0, 4).map((c) => c.slackUserId)) await join(u, msg);
    const events = async () => (await all(t, "gameEvents")).map((e) => [e.memberId, e.kind, e.xp, e.coins ?? 0, e.kudosId ?? null, JSON.stringify(e.lines ?? [])]).sort();
    const live = await events();
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await settle();
    expect(await events()).toEqual(live);
  });

  test("with the game off, sprees still pay out the kudos, without XP or coins", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(0, 4).map((c) => c.slackUserId)]) await join(u, msg);
    expect((await all(t, "kudos")).filter((k) => k.source === "spree")).toHaveLength(5);
    expect((await all(t, "gameEvents")).filter((e) => e.kind === "spree")).toEqual([]);
  });

  test("review: a joiner who left meanwhile doesn't count toward the tier; their join lapses (§G15)", async () => {
    await post("<@UDEV> :taco: thanks for the lovely team lunch", "UBEN");
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(1, 4).map((c) => c.slackUserId)]) await join(u, msg);
    await t.run((ctx) => ctx.db.patch(team.cleo, { deactivated: true }));
    await join(crowd[4].slackUserId, msg); // 5 joins, one of them gone: no tier yet
    let state = await spreeOf(msg);
    expect(state.spree).toMatchObject({ tier: 0, joiners: 4 });
    expect(state.joins.find((j) => j.memberId === team.cleo)?.status).toBe("lapsed");
    calls = [];
    await join(crowd[5].slackUserId, msg);
    state = await spreeOf(msg);
    expect(state.spree).toMatchObject({ tier: 1, joiners: 5 });
    expect((await all(t, "kudos")).filter((k) => k.source === "spree")).toHaveLength(5);
    expect(posts().find((p) => p.channel === "C1")?.text).toContain("became a spree of 5!");
  });

  test("review: a spree whose receivers all left is over", async () => {
    const msg = await post(THOUGHTFUL);
    await join("UCLEO", msg);
    await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
    calls = [];
    await react(crowd[0].slackUserId, msg);
    expect(ephemerals(crowd[0].slackUserId).map((e) => e.text)).toEqual(["This spree is over."]);
  });

  test("a missed tier lapses the waiting joins and refunds the spree join and the reservation", async () => {
    const msg = await post(THOUGHTFUL);
    await join("UCLEO", msg);
    vi.advanceTimersByTime(24 * 3_600_000 + 1000);
    await t.finishInProgressScheduledFunctions();
    const { spree, joins } = await spreeOf(msg);
    expect(spree?.status).toBe("lapsed");
    expect(joins.map((j) => j.status)).toEqual(["lapsed"]);
    // Too late to join now.
    calls = [];
    await react(crowd[0].slackUserId, msg);
    expect(ephemerals(crowd[0].slackUserId).map((e) => e.text)).toEqual(["This spree is over."]);
  });
});

describe("withdrawing", () => {
  test("removing your reaction the same day withdraws a waiting join and gives both back", async () => {
    const msg = await post(THOUGHTFUL);
    await join("UCLEO", msg);
    await unreact("UCLEO", msg);
    const { spree, joins } = await spreeOf(msg);
    expect(spree?.joiners).toBe(0);
    expect(joins.map((j) => j.status)).toEqual(["withdrawn"]);
    expect(ephemerals("UCLEO").at(-1)?.text).toBe("You left <@UANA>'s kudos for <@UBEN>. Your kudos and spree join are back.");
    // …and may join again.
    await join("UCLEO", msg);
    expect((await spreeOf(msg)).spree?.joiners).toBe(1);
  });

  test("a paid join stays when the reaction comes off", async () => {
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(0, 4).map((c) => c.slackUserId)]) await join(u, msg);
    await unreact("UCLEO", msg);
    expect((await spreeOf(msg)).joins.find((j) => j.memberId === team.cleo)?.status).toBe("paid");
  });

  test("a redelivered reaction event is handled once", async () => {
    const msg = await post(THOUGHTFUL);
    await join("UCLEO", msg);
    await unreact("UCLEO", msg);
    await unreact("UCLEO", msg);
    expect((await spreeOf(msg)).spree?.joiners).toBe(0);
  });
});

describe("removing a member (removal.ts PHASES)", () => {
  async function removeMember(slackUserId: string) {
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId, force: true });
    for (let i = 0; i < 100; i++) await settle(); // every removal step, but not the spree's deadline
  }
  const ids = async () => {
    const sprees = await t.run((ctx) => ctx.db.query("sprees").collect());
    const joins = await t.run((ctx) => ctx.db.query("spreeJoins").collect());
    return JSON.stringify([...sprees, ...joins]);
  };

  test("the giver: the spree and every join of it go; the joiners' paid kudos to the receiver stay", async () => {
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(0, 5).map((c) => c.slackUserId)]) await join(u, msg);
    await removeMember("UANA");
    expect(await t.run((ctx) => ctx.db.query("sprees").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("spreeJoins").collect())).toEqual([]);
    expect((await all(t, "kudos")).filter((k) => k.source === "spree")).toHaveLength(5);
  });

  test("a joiner: their join leaves the spree and their pooled kudos are revoked", async () => {
    const msg = await post(THOUGHTFUL);
    await join("UCLEO", msg);
    await join(crowd[0].slackUserId, msg);
    await removeMember("UCLEO");
    const { spree, joins } = await spreeOf(msg);
    expect(spree?.joiners).toBe(1);
    expect(joins.map((j) => j.memberId)).toEqual([crowd[0].id]);
    expect(await ids()).not.toContain(team.cleo);
  });

  test("review: a paid joiner leaves the count too, so the next tier still needs distinct joiners", async () => {
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(0, 4).map((c) => c.slackUserId)]) await join(u, msg);
    await removeMember("UCLEO");
    const { spree, joins } = await spreeOf(msg);
    expect(joins).toHaveLength(4);
    expect(spree?.joiners).toBe(4);
  });

  test("a receiver: the spree is cancelled and no longer names them", async () => {
    const msg = await post(THOUGHTFUL);
    for (const u of ["UCLEO", ...crowd.slice(0, 5).map((c) => c.slackUserId)]) await join(u, msg);
    await removeMember("UBEN");
    expect((await spreeOf(msg)).spree?.status).toBe("cancelled");
    expect(await ids()).not.toContain(team.ben);
    expect((await all(t, "kudos")).filter((k) => k.receiverId === team.ben)).toEqual([]);
  });
});

describe("revoking the kudos a spree grew on", () => {
  test("cancels the spree: waiting joins are refunded and the giver's spree bonus is taken back", async () => {
    const msg = await post(THOUGHTFUL);
    const people = ["UCLEO", ...crowd.map((c) => c.slackUserId)];
    for (const u of people.slice(0, 6)) await join(u, msg);
    const anaXp = async () => (await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique()))!;
    const before = await anaXp();
    await t.run(async (ctx) => {
      const { revokeKudosRow } = await import("../convex/engine");
      const workspace = (await ctx.db.get(team.workspaceId)) as Doc<"workspaces">;
      const original = (await ctx.db.query("kudos").collect()).find((k) => k.source === "message")!;
      await revokeKudosRow(ctx, workspace, original);
    });
    const { spree, joins } = await spreeOf(msg);
    expect(spree?.status).toBe("cancelled");
    expect(joins.filter((j) => j.status === "waiting")).toEqual([]);
    expect(joins.filter((j) => j.status === "paid")).toHaveLength(5);
    const after = await anaXp();
    expect(before.xp - after.xp).toBeGreaterThanOrEqual(20);
    expect((await all(t, "gameEvents")).filter((e) => e.kind === "spree" && e.memberId === team.ana)).toEqual([]);
  });
});

describe("the biggest tier fits in one transaction", () => {
  test("the 100th joiner pays out 51 waiting joins to 5 receivers within Convex's limits, even for joiners with years of history", async () => {
    t = setupConvex({ transactionLimits: true });
    team = await seedTeam(t, { spreesEnabled: true, gameEnabled: true });
    const people = await t.run(async (ctx) => {
      const ids = [];
      for (let i = 0; i < 105; i++) {
        ids.push(
          await ctx.db.insert("members", {
            workspaceId: team.workspaceId, slackUserId: `UP${i}`, name: `P${i}`, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0,
          }),
        );
      }
      return ids;
    });
    // The waiting joiners joined yesterday and have given every day for two years, today too: paying
    // yesterday's kudos recomputes each one's streaks from their whole history.
    const DAY = 86_400_000;
    for (let i = 54; i < 104; i++) {
      await t.run(async (ctx) => {
        for (let d = 0; d < 700; d++) {
          const dayKey = new Date(Date.parse("2026-09-23T12:00:00Z") - (d === 0 ? 0 : (d + 1) * DAY)).toISOString().slice(0, 10);
          await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId: people[i], dayKey, given: 1, received: 0, maxed: false, capped: 1 });
        }
        await ctx.db.patch(people[i], { givenByWeekday: [100, 100, 100, 100, 100, 100, 100], lastActiveDay: "2026-09-23", currentStreak: 1, longestStreak: 698, totalGiven: 700 });
      });
    }
    const msg = await post("<@UBEN> <@UCLEO> <@UP0> <@UP1> <@UP2> :taco: thanks for carrying the launch together this week");
    const { spree } = await t.run(async (ctx) => {
      const attempt = (await ctx.db.query("kudosAttempts").collect())[0];
      const rows = await ctx.db.query("kudos").withIndex("by_batch", (q) => q.eq("batchId", attempt.batchId!)).collect();
      const now = Date.now();
      const spreeId = await ctx.db.insert("sprees", {
        workspaceId: team.workspaceId, batchId: attempt.batchId!, channelId: "C1", messageTs: msg, giverId: team.ana, receiverIds: rows.map((r) => r.receiverId),
        text: rows[0].text, kudosAt: rows[0].at, status: "open", tier: 4, joiners: 99, deadline: now + 3_600_000,
        tiers: [5, 10, 20, 50].map((n, i) => ({ tier: i + 1, at: now, joiners: n })),
      });
      for (let i = 5; i < 104; i++) {
        const paid = i < 54;
        await ctx.db.insert("spreeJoins", {
          workspaceId: team.workspaceId, spreeId, memberId: people[i], status: paid ? "paid" : "waiting", at: now - DAY, dayKey: "2026-09-22", month: "2026-09", amount: 5,
          ...(paid ? { tier: 4 } : {}),
        });
      }
      return { spree: spreeId, attemptId: attempt._id };
    });
    const attemptId = (await t.run(async (ctx) => (await ctx.db.query("kudosAttempts").collect())[0]._id));
    const text = await t.mutation(internal.kudos.spreeInteraction, { teamId: "T1", slackUserId: "UP104", attemptId });
    expect(text).toContain("it's a spree of 100!");
    for (let i = 0; i < 3; i++) await settle(); // the rest of the tier's joins, a batch per transaction
    const after = await t.run((ctx) => ctx.db.get(spree));
    expect(after).toMatchObject({ tier: 5, joiners: 100, status: "complete" });
    const pooled = (await all(t, "kudos")).filter((k) => k.source === "spree");
    expect(pooled).toHaveLength(51 * 5);
    expect(pooled.filter((k) => k.dayKey === "2026-09-22")).toHaveLength(50 * 5); // on the day they were reserved
    expect((await t.run((ctx) => ctx.db.query("spreeJoins").collect())).every((j) => j.status === "paid")).toBe(true);
  }, 180_000); // seeding 35k days of history takes a while
});
