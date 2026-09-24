import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { signSlackRequest } from "../convex/lib/slack";
import { NOW, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * The Store in Slack (spec #4 §7, slice S3; in Hog coins since #91): DMs on every step of a redemption, the
 * App Home "Rewards store" section and `/kudos store`. Slack is a stubbed `fetch`.
 */

const SECRET = "test-signing-secret";

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

type SlackReply = unknown | ((params: Record<string, string>) => unknown);

/** Fake Slack: Web API calls are recorded by method; anything else (a `response_url`) by its URL, with the JSON body. */
function stubSlackApi(responses: Record<string, SlackReply> = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const api = String(url).split("https://slack.com/api/")[1];
      const body = String(init?.body ?? "");
      const params = api ? Object.fromEntries(new URLSearchParams(body)) : JSON.parse(body || "{}");
      const method = api ?? String(url);
      calls.push({ method, params });
      const reply = responses[method];
      const value = typeof reply === "function" ? await reply(params) : reply;
      return value instanceof Response ? value : Response.json(value ?? { ok: true });
    }),
  );
}

const dms = () =>
  calls
    .filter((c) => c.method === "chat.postMessage")
    .map((c) => ({ channel: c.params.channel, text: c.params.text, blocks: JSON.parse(c.params.blocks ?? "[]") }));
const dmsTo = (slackUserId: string) => dms().filter((d) => d.channel === slackUserId);
const published = () =>
  calls.filter((c) => c.method === "views.publish").map((c) => ({ user: c.params.user_id, view: JSON.parse(c.params.view) }));

const drain = () => t.finishAllScheduledFunctions(vi.runAllTimers);

async function addReward(reward: Partial<Doc<"rewards">> = {}) {
  return await t.run((ctx) =>
    ctx.db.insert("rewards", {
      workspaceId: team.workspaceId,
      name: "Coffee on us",
      emoji: "☕",
      cost: 15,
      unit: "coins",
      status: "active",
      createdBy: team.ana,
      updatedAt: Date.now(),
      ...reward,
    }),
  );
}

const setMember = (id: Id<"members">, patch: Partial<Doc<"members">>) => t.run((ctx) => ctx.db.patch(id, patch));

async function redeemAsBen(rewardId: Id<"rewards">, answer?: string) {
  const ben = await signInAs(t, team.ben);
  const res = await ben.mutation(api.store.redeem, { rewardId, expectedCost: 15, answer });
  return { ben, ...res };
}

/** Makes a member a level-5 player (the Store opens there) with `balance` Hog coins, 40 of them from level-ups. */
async function fund(memberId: Id<"members">, balance: number) {
  await t.run(async (ctx) => {
    const m = (await ctx.db.get(memberId))!;
    const existing = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
    if (existing) await ctx.db.patch(existing._id, { coins: balance - 40 });
    else await ctx.db.insert("players", { workspaceId: m.workspaceId, memberId, since: 0, xp: 350, level: 5, coins: balance - 40 });
  });
}

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false, realRewardsEnabled: true, emojiGlyph: "🌮" });
  await fund(team.ben, 42);
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://kudos.example");
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("redeeming a reward", () => {
  test("DMs the requester a confirmation and each admin a request to review", async () => {
    await signInAs(t, team.ana);
    await redeemAsBen(await addReward());
    await drain();

    const [mine] = dmsTo("UBEN");
    expect(mine.text).toBe("🎁 Your request for *☕ Coffee on us* (15 Hog coins) is in. An admin will take it from here. Balance: 27 Hog coins.");
    expect(JSON.stringify(mine.blocks)).toContain("<https://kudos.example/store?ws=T1#my-requests|My requests>");

    const [review] = dmsTo("UANA");
    expect(review.text).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). Balance after: 27 Hog coins.");
    const button = review.blocks.find((b: { type: string }) => b.type === "actions").elements.find((e: { action_id: string }) => e.action_id === "store_review");
    expect(button).toMatchObject({ type: "button", text: { text: "Review in Kudos" }, url: "https://kudos.example/admin?tab=store&ws=T1" });
    expect(dms()).toHaveLength(2);
  });
});

describe("each step of a request", () => {
  async function requestThen(...steps: { action: "approve" | "fulfill" | "decline"; note?: string }[]) {
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await drain();
    calls = [];
    for (const step of steps) await ana.mutation(api.storeAdmin.decide, { redemptionId, ...step });
    await drain();
    return redemptionId;
  }

  test("approving tells the requester who approved it", async () => {
    await requestThen({ action: "approve" });
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual(["✅ <@UANA> approved *☕ Coffee on us*. It's on its way."]);
  });

  test("fulfilling tells the requester it's theirs, with the decider's note", async () => {
    await requestThen({ action: "approve" }, { action: "fulfill", note: "It's on <!channel> the desk" });
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual([
      "✅ <@UANA> approved *☕ Coffee on us*. It's on its way.",
      "🎉 *☕ Coffee on us* is yours! Note from <@UANA>: It's on &lt;!channel&gt; the desk",
    ]);
  });

  test("declining tells the requester why and that the cost is back in their balance", async () => {
    await requestThen({ action: "decline", note: "Out of beans" });
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual([
      "*☕ Coffee on us* was declined by <@UANA>: “Out of beans”. 15 Hog coins are back in your balance (42 Hog coins).",
    ]);
  });

  test("a note that ends a sentence isn't followed by a second full stop", async () => {
    await requestThen({ action: "decline", note: "We're out of beans this week." });
    expect(dmsTo("UBEN")[0].text).toContain("“We're out of beans this week.” 15 Hog coins are back");
  });

  test("cancelling sends no DM, since the requester did it themselves", async () => {
    const { ben, redemptionId } = await redeemAsBen(await addReward());
    await drain();
    calls = [];
    await ben.mutation(api.store.cancel, { redemptionId });
    await drain();
    expect(dms()).toEqual([]);
  });

  test("refreshes the requester's App Home after every step", async () => {
    await requestThen({ action: "approve" }, { action: "fulfill" });
    expect(published().map((p) => p.user)).toEqual(["UBEN", "UBEN"]);
  });

  test("a deactivated requester gets no DMs and no Home refresh", async () => {
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await setMember(team.ben, { deactivated: true });
    await drain();
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(calls.filter((c) => c.params.channel === "UBEN" || c.params.user_id === "UBEN")).toEqual([]);
  });

  test("a failed DM doesn't undo the step", async () => {
    stubSlackApi({ "chat.postMessage": { ok: false, error: "channel_not_found" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { redemptionId } = await redeemAsBen(await addReward());
    await drain();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("channel_not_found"));
    expect(await t.run((ctx) => ctx.db.get(redemptionId))).toMatchObject({ status: "pending" });
  });
});

describe("who hears about a request", () => {
  test("every active admin gets the review DM, and the requester never gets a second copy", async () => {
    await setMember(team.cleo, { isAdmin: true });
    await setMember(team.ben, { isAdmin: true });
    await signInAs(t, team.ana);
    await redeemAsBen(await addReward());
    await drain();
    expect(dms().map((d) => d.channel).sort()).toEqual(["UANA", "UBEN", "UCLEO"]);
    expect(dmsTo("UBEN")[0].text).toMatch(/^🎁/);
  });

  test("an admin who is the only one who can decide gets their own request to review", async () => {
    const ana = await signInAs(t, team.ana);
    await fund(team.ana, 42);
    await ana.mutation(api.store.redeem, { rewardId: await addReward(), expectedCost: 15 });
    await drain();
    const [confirmation, review] = dmsTo("UANA");
    expect(confirmation.text).toMatch(/^🎁/);
    expect(review.text).toMatch(/^🛎️ <@UANA> wants/);
    expect(JSON.stringify(review.blocks)).toContain("Your own request");
  });

  test("the admin DM carries the requester's answer, verbatim so Slack doesn't auto-link it", async () => {
    await signInAs(t, team.ana);
    const rewardId = await addReward({ prompt: "Oat or <b>dairy</b>?" });
    await redeemAsBen(rewardId, "Oat <please> see acme-payroll.com/login");
    await drain();
    const answer = dmsTo("UANA")[0].blocks.find((b: { text?: { text: string } }) => b.text?.text.startsWith("Answer"));
    expect(answer.text).toEqual({
      type: "mrkdwn",
      verbatim: true,
      text: "Answer to “Oat or &lt;b&gt;dairy&lt;/b&gt;?”: Oat &lt;please&gt; see acme-payroll.com/login",
    });
  });

  test("DMs describe the request as it was when it was made, even if more happened before they went out", async () => {
    await signInAs(t, team.ana);
    const coffee = await addReward();
    const ben = await signInAs(t, team.ben);
    await ben.mutation(api.store.redeem, { rewardId: coffee, expectedCost: 15 });
    const second = await ben.mutation(api.store.redeem, { rewardId: coffee, expectedCost: 15 });
    await ben.mutation(api.store.cancel, { redemptionId: second.redemptionId }); // a quick change of mind
    await drain();
    // The first request left 27, and nobody is asked to review the cancelled one.
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual([
      "🎁 Your request for *☕ Coffee on us* (15 Hog coins) is in. An admin will take it from here. Balance: 27 Hog coins.",
    ]);
    expect(dmsTo("UANA").map((d) => d.text)).toEqual(["🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). Balance after: 27 Hog coins."]);
  });

  test("bots, deactivated admins and plain members never get the review DM; signed-in admins come first, 20 at most", async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert("members", {
          workspaceId: team.workspaceId,
          slackUserId: `UADM${String(i).padStart(2, "0")}`,
          name: `Admin ${i}`,
          isAdmin: true,
          isBot: false,
          deactivated: false,
          totalGiven: 0,
          totalReceived: 0,
          totalMaxedDays: 0,
        });
      }
    });
    await setMember(team.bot, { isAdmin: true });
    await setMember(team.cleo, { isAdmin: true, deactivated: true });
    await signInAs(t, team.ana);
    await redeemAsBen(await addReward());
    await drain();
    const reviewers = dms().filter((d) => d.text.startsWith("🛎️")).map((d) => d.channel);
    expect(reviewers).toHaveLength(20);
    expect(reviewers[0]).toBe("UANA");
    expect(reviewers).not.toContain("UBOT");
    expect(reviewers).not.toContain("UCLEO");
  });

  test("an uninstalled workspace hears nothing", async () => {
    await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { status: "uninstalled" }));
    await drain();
    expect(calls).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(redemptionId))).toMatchObject({ status: "pending" });
  });

  test("approving passes the decider's note on", async () => {
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve", note: "Pick it up at reception on Friday" });
    await drain();
    expect(dmsTo("UBEN")[1].text).toBe("✅ <@UANA> approved *☕ Coffee on us*. It's on its way. Note from <@UANA>: Pick it up at reception on Friday");
  });

  test("with real rewards off, DMs still link to My requests, which stay in the Store", async () => {
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await drain();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { realRewardsEnabled: false }));
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(JSON.stringify(dmsTo("UBEN")[0].blocks)).toContain("/store?ws=T1#my-requests");
  });

  test("while the game is off, DMs don't link to a Store page that isn't there", async () => {
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await drain();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(JSON.stringify(dmsTo("UBEN")[0].blocks)).not.toContain("/store");
  });

  test("without a site URL the DMs still go out, just without links", async () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("CONVEX_SITE_URL", "");
    await signInAs(t, team.ana);
    await redeemAsBen(await addReward());
    await drain();
    const all = JSON.stringify(dms());
    expect(dms()).toHaveLength(2);
    expect(all).not.toContain('"url"');
    expect(all).not.toContain("</store");
  });

  test("Hog coin balances stay in DMs while received kudos are hidden: they come from giving (ADR 0002)", async () => {
    await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    // Switching real rewards off and hiding received kudos leaves open requests actionable.
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { realRewardsEnabled: false, receivedVisibility: "hidden" }));
    await drain();
    expect(dmsTo("UBEN")[0].text).toContain("Balance: 27 Hog coins.");
    const ana = await signInAs(t, team.ana);
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual(["*☕ Coffee on us* was declined by <@UANA>. 15 Hog coins are back in your balance (42 Hog coins)."]);
  });

  test("the balance stays out of DMs to someone whose wallet isn't shown: hidden game, or below level 3", async () => {
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await setMember(team.ben, { gameHidden: true });
    await drain();
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual(["*☕ Coffee on us* was declined by <@UANA>. 15 Hog coins are back in your balance."]);
  });

  test("declining a request from the received-kudos Store says no coins come back, and admins see it was priced in kudos", async () => {
    const ana = await signInAs(t, team.ana);
    const rewardId = await addReward();
    const redemptionId = await t.run((ctx) =>
      ctx.db.insert("redemptions", {
        workspaceId: team.workspaceId, memberId: team.ben, rewardId, rewardName: "Coffee on us", rewardEmoji: "☕", cost: 15,
        status: "pending", isOpen: true, history: [{ status: "pending", at: 1, by: team.ben }], requestedAt: 1, updatedAt: 1,
        adminMessages: [{ channel: "DUANA", ts: "1.1" }],
      }),
    );
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual([
      "*☕ Coffee on us* was declined by <@UANA>. It was a request from the old kudos Store, so no Hog coins come back.",
    ]);
    const update = calls.find((c) => c.method === "chat.update")!;
    expect(update.params.text).toContain("wants *☕ Coffee on us* (15 kudos, old Store)");
  });

  test("a 1-coin refund reads in the singular", async () => {
    const ana = await signInAs(t, team.ana);
    const ben = await signInAs(t, team.ben);
    const { redemptionId } = await ben.mutation(api.store.redeem, { rewardId: await addReward({ cost: 1 }), expectedCost: 1 });
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(dmsTo("UBEN").at(-1)!.text).toBe("*☕ Coffee on us* was declined by <@UANA>. 1 Hog coin is back in your balance (42 Hog coins).");
  });

  test("the demo workspace sends nothing to Slack", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { isDemo: true }));
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" });
    // Only the demo's teammate admin is scheduled, to decide on the request live (tests/demo.test.ts).
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((f) => f.name)).toEqual(["demo:storeTeammateDecision"]);
  });
});

describe("App Home", () => {
  async function openHome(slackUserId: string) {
    calls = [];
    await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "app_home_opened", tab: "home", user: slackUserId } });
    return JSON.stringify(published()[0].view.blocks);
  }

  test("shows the Rewards store with the balance, 3 rewards and Open store", async () => {
    await addReward({ name: "Coffee on us", emoji: "☕", cost: 15 });
    await addReward({ name: "Lunch", emoji: "🥪", cost: 40 });
    await addReward({ name: "Hoodie", emoji: "🧥", cost: 60 });
    await addReward({ name: "Headphones", emoji: "🎧", cost: 200 });
    await addReward({ name: "Sold out mug", emoji: "☕", cost: 10, stock: 0 });
    const home = await openHome("UBEN");
    expect(home).toContain("Rewards store");
    expect(home).toContain("*Balance*\\n42 Hog coins");
    // The dearest you can afford now, topped up with the next goal.
    expect(home).toContain("🥪 Lunch · 40 Hog coins\\n☕ Coffee on us · 15 Hog coins\\n🧥 Hoodie · 60 Hog coins  _18 more to go_");
    expect(home).not.toContain("Sold out mug");
    expect(home).not.toContain("Headphones");
    await addReward({ name: "Sticker pack", emoji: "🏷️", cost: 5 });
    expect(await openHome("UBEN")).toContain("🥪 Lunch · 40 Hog coins\\n☕ Coffee on us · 15 Hog coins\\n🏷️ Sticker pack · 5 Hog coins");
    expect(home).toContain('"url":"https://kudos.example/store?ws=T1"');
  });

  test("members don't see the admin line, even with requests waiting", async () => {
    await signInAs(t, team.ana);
    await redeemAsBen(await addReward());
    await fund(team.cleo, 5);
    const home = await openHome("UCLEO");
    expect(home).toContain("Rewards store");
    expect(home).not.toContain("waiting");
    expect(home).not.toContain("Review requests");
  });

  test("leaves the store out below level 5, where the Store is still locked", async () => {
    await addReward();
    await fund(team.cleo, 30);
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.cleo)).unique())!;
      await ctx.db.patch(p._id, { level: 4, xp: 175 });
    });
    expect(await openHome("UCLEO")).not.toContain("Rewards store");
  });

  test("admins also see how many requests are waiting and a Review requests button", async () => {
    await signInAs(t, team.ana);
    const rewardId = await addReward();
    await redeemAsBen(rewardId);
    await fund(team.ana, 5);
    const home = await openHome("UANA");
    expect(home).toContain("1 request waiting");
    expect(home).toContain('"url":"https://kudos.example/admin?tab=store&ws=T1"');
  });

  test("admins below level 5 still see the requests waiting, without a balance or rewards of their own", async () => {
    await signInAs(t, team.ana);
    await redeemAsBen(await addReward());
    const home = await openHome("UANA"); // Ana isn't a player yet: level 1
    expect(home).toContain("1 request waiting");
    expect(home).toContain("Review requests");
    expect(home).not.toContain("*Balance*");
    expect(home).not.toContain("Coffee on us");
  });

  test("buying a game item DMs the item gained (#99), linking to the Store", async () => {
    const ben = await signInAs(t, team.ben);
    calls = [];
    await ben.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });
    await drain();
    const [dm] = dmsTo("UBEN");
    expect(dm.text).toMatch(/^🎁 \*Extra spree join is yours\*\nOne more kudos spree to join this month/);
    expect(JSON.stringify(dm.blocks)).toContain("https://kudos.example/store?ws=T1");
  });

  test("buying a game item refreshes the buyer's App Home", async () => {
    const ben = await signInAs(t, team.ben);
    await ben.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });
    calls = [];
    await drain();
    expect(published().map((p) => p.user)).toEqual(["UBEN"]);
  });

  test("leaves the store out while real rewards are off, or the game is", async () => {
    await addReward();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { realRewardsEnabled: false }));
    expect(await openHome("UBEN")).not.toContain("Rewards store");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { realRewardsEnabled: true, gameEnabled: false }));
    expect(await openHome("UBEN")).not.toContain("Rewards store");
  });

  test("an empty catalog says the shelves are still being stocked", async () => {
    expect(await openHome("UBEN")).toContain("The shelves are empty");
  });
});

describe("/kudos store", () => {
  let triggers = 0;
  async function command(text: string, userId = "UBEN") {
    // Like Slack, every command carries its own trigger id: identical requests are replays.
    const body = new URLSearchParams({ team_id: "T1", user_id: userId, command: "/kudos", text, trigger_id: `${++triggers}` }).toString();
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await t.fetch("/slack/commands", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": await signSlackRequest(SECRET, ts, body),
      },
      body,
    });
    return await res.json();
  }

  test("shows your balance, the game items, the 5 cheapest rewards and a link to the store", async () => {
    for (const [name, cost] of [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5], ["F", 6]] as const) await addReward({ name, emoji: "🎁", cost });
    const body = await command("store");
    expect(body.response_type).toBe("ephemeral");
    const text = JSON.stringify(body.blocks);
    expect(text).toContain("*Balance*\\n42 Hog coins");
    expect(text).toContain("Extra spree join · 8 Hog coins");
    expect(text).toContain("🎁 A · 1 Hog coin\\n🎁 B · 2 Hog coins\\n🎁 C · 3 Hog coins\\n🎁 D · 4 Hog coins\\n🎁 E · 5 Hog coins");
    expect(text).not.toContain("🎁 F");
    expect(text).toContain("<https://kudos.example/store?ws=T1|Open the store>");
  });

  test("balance shows your Hog coins now, like /kudos coins (the received-kudos balance is gone)", async () => {
    const body = await command("balance");
    expect(body.text).toBe("You have 42 Hog coins.");
    expect(JSON.stringify(body.blocks)).toContain("*Balance*\\n42 Hog coins");
  });

  test("says which game items aren't for sale, the way the web Store does", async () => {
    const ben = await signInAs(t, team.ben);
    for (let i = 0; i < 5; i++) await ben.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });
    const text = JSON.stringify((await command("store")).blocks);
    expect(text).toContain("Extra spree join · 8 Hog coins  _5 a month: you have them all. More next month._");
    expect(text).toContain("Skill-tree reset · 50 Hog coins  _Your tree has no skills to reset._");
  });

  test("with real rewards off, lists only the game items", async () => {
    await addReward({ name: "A", emoji: "🎁", cost: 1 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { realRewardsEnabled: false }));
    const text = JSON.stringify((await command("store")).blocks);
    expect(text).toContain("Extra spree join · 8 Hog coins");
    expect(text).not.toContain("🎁 A");
    expect(text).not.toContain("Open requests");
  });

  test("says when the Store is locked, off or hidden, without the balance", async () => {
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ben)).unique())!;
      await ctx.db.patch(p._id, { level: 4, xp: 175 });
    });
    const locked = await command("store");
    expect(locked.text).toBe("The Store opens at level 5. You're level 4: thoughtful kudos get you there.");
    expect(JSON.stringify(locked)).not.toContain("Hog coins");
    await setMember(team.ben, { gameHidden: true });
    expect((await command("store")).text).toBe("You've hidden the game. Show it again on your Me page to shop.");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect((await command("store")).text).toBe("The game isn't on in this workspace, so there's no Store.");
  });

  test("the help mentions /kudos store only while the game is shown to you", async () => {
    expect((await command("help")).text).toContain("`/kudos store`");
    await setMember(team.ben, { gameHidden: true });
    expect((await command("help")).text).not.toContain("`/kudos store`");
  });
});

/**
 * Acting on requests from Slack (spec #4 §6/§7, slice S4): the admin DMs carry Approve and
 * Mark fulfilled, and every admin's copy is rewritten after any step, from the web or Slack.
 */
describe("admin copies in Slack", () => {
  let posted: number;

  /** Slack answers each DM with its DM channel and a fresh ts, which is what `chat.update` needs. */
  function stubWithMessageIds(extra: Record<string, SlackReply> = {}) {
    posted = 0;
    stubSlackApi({
      "chat.postMessage": (params: Record<string, string>) => ({ ok: true, channel: `D${params.channel}`, ts: `1700000000.00000${++posted}` }),
      ...extra,
    });
  }

  const updates = () =>
    calls
      .filter((c) => c.method === "chat.update")
      .map((c) => ({ channel: c.params.channel, ts: c.params.ts, text: c.params.text, blocks: JSON.parse(c.params.blocks ?? "[]") }));
  const buttonsOf = (blocks: { type: string; elements?: { action_id: string }[] }[]) =>
    blocks.filter((b) => b.type === "actions").flatMap((b) => b.elements!.map((e) => e.action_id));

  /** Ana and Cleo are admins who can decide; Ben asks for a coffee. */
  async function requestWithTwoAdmins() {
    await setMember(team.cleo, { isAdmin: true });
    await signInAs(t, team.cleo);
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await drain();
    return { ana, redemptionId };
  }

  beforeEach(() => stubWithMessageIds());

  test("the review DM has Approve and Mark fulfilled buttons for this request, next to the web link", async () => {
    const { redemptionId } = await requestWithTwoAdmins();
    const [review] = dmsTo("UANA");
    const actions = review.blocks.find((b: { type: string }) => b.type === "actions").elements;
    expect(actions).toEqual([
      { type: "button", style: "primary", text: { type: "plain_text", text: "Approve" }, action_id: "store_approve", value: redemptionId },
      {
        type: "button",
        text: { type: "plain_text", text: "Mark fulfilled" },
        action_id: "store_fulfill",
        value: redemptionId,
        // Fulfilled is final, so a stray click deserves a second look.
        confirm: {
          title: { type: "plain_text", text: "Mark as fulfilled?" },
          text: { type: "plain_text", text: "Ben is told it's theirs, and this can't be undone." },
          confirm: { type: "plain_text", text: "Mark fulfilled" },
          deny: { type: "plain_text", text: "Not yet" },
        },
      },
      { type: "button", text: { type: "plain_text", text: "Review in Kudos" }, url: "https://kudos.example/admin?tab=store&ws=T1", action_id: "store_review" },
    ]);
  });

  test("without a site URL the action buttons still work; only the web link is left out", async () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("CONVEX_SITE_URL", "");
    await requestWithTwoAdmins();
    expect(buttonsOf(dmsTo("UANA")[0].blocks)).toEqual(["store_approve", "store_fulfill"]);
  });

  test("fulfilling on the web rewrites every admin's copy: who did it, when, and no buttons", async () => {
    const { ana, redemptionId } = await requestWithTwoAdmins();
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill", note: "On <!here> your desk" });
    await drain();
    const copies = updates();
    expect(copies.map((u) => `${u.channel} ${u.ts}`).sort()).toEqual(["DUANA 1700000000.000002", "DUCLEO 1700000000.000003"]);
    for (const copy of copies) {
      expect(copy.text).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✔ Fulfilled by <@UANA>");
      expect(buttonsOf(copy.blocks)).toEqual([]);
      const status = JSON.stringify(copy.blocks);
      expect(status).toContain(`✔ Fulfilled by <@UANA> · <!date^${Math.floor(NOW.getTime() / 1000)}^{ago}|`);
      expect(status).toContain("On &lt;!here&gt; your desk");
      expect(status).not.toContain("Balance after");
    }
  });

  test("an approved copy still offers Mark fulfilled and the web link, but not Approve", async () => {
    const { ana, redemptionId } = await requestWithTwoAdmins();
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    await drain();
    expect(updates()).toHaveLength(2);
    for (const copy of updates()) {
      expect(copy.text).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✅ Approved by <@UANA>");
      expect(buttonsOf(copy.blocks)).toEqual(["store_fulfill", "store_review"]);
    }
  });

  test("a declined or cancelled request's copies say so, without buttons", async () => {
    const { ana, redemptionId } = await requestWithTwoAdmins();
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline", note: "Out of beans" });
    await drain();
    expect(updates().map((u) => u.text)).toEqual(Array(2).fill("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✖ Declined by <@UANA>"));

    const second = await redeemAsBen(await addReward({ name: "Tea" }));
    await drain();
    calls = [];
    await second.ben.mutation(api.store.cancel, { redemptionId: second.redemptionId });
    await drain();
    expect(updates().map((u) => u.text)).toEqual(Array(2).fill("🛎️ <@UBEN> wants *☕ Tea* (15 Hog coins). ↩ Cancelled by <@UBEN>"));
    expect(updates().flatMap((u) => buttonsOf(u.blocks))).toEqual([]);
  });

  test("a rate-limited update is tried again later, so the copies still end up truthful", async () => {
    let limited = 2;
    stubWithMessageIds({
      "chat.update": () =>
        limited-- > 0 ? new Response(JSON.stringify({ ok: false, error: "ratelimited" }), { status: 429, headers: { "retry-after": "5" } }) : { ok: true },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ana, redemptionId } = await requestWithTwoAdmins();
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" });
    await drain();
    const last = (channel: string) => updates().filter((u) => u.channel === channel).at(-1)?.text;
    expect(updates().length).toBeGreaterThan(2);
    expect(last("DUANA")).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✔ Fulfilled by <@UANA>");
    expect(last("DUCLEO")).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✔ Fulfilled by <@UANA>");
  });

  test("a failed update is logged and doesn't undo the step", async () => {
    stubWithMessageIds({ "chat.update": { ok: false, error: "message_not_found" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ana, redemptionId } = await requestWithTwoAdmins();
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" });
    await drain();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("message_not_found"));
    expect(await t.run((ctx) => ctx.db.get(redemptionId))).toMatchObject({ status: "fulfilled" });
  });
});

describe("Approve and Mark fulfilled in Slack", () => {
  const RESPONSE_URL = "https://hooks.slack.com/actions/T1/1/secret";

  function blockAction(actionId: string, value: string, { user = "UANA", team = "T1", userTeam = team, responseUrl = RESPONSE_URL } = {}) {
    return JSON.stringify({
      type: "block_actions",
      api_app_id: "A1",
      team: { id: team, domain: "acme" },
      user: { id: user, team_id: userTeam },
      container: { type: "message", channel_id: `D${user}`, message_ts: "1700000000.000002" },
      response_url: responseUrl,
      actions: [{ type: "button", action_id: actionId, block_id: "b1", value, action_ts: "1700000001.000001" }],
    });
  }

  async function click(payload: string, sign = true) {
    const body = new URLSearchParams({ payload }).toString();
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await t.fetch("/slack/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sign ? await signSlackRequest(SECRET, ts, body) : "v0=forged",
      },
      body,
    });
    await drain();
    return res;
  }

  const ephemerals = () => calls.filter((c) => c.method.startsWith("https://")).map((c) => ({ url: c.method, ...c.params }));
  const statusOf = async (id: Id<"redemptions">) => (await t.run((ctx) => ctx.db.get(id)))!;

  async function request() {
    let n = 0;
    stubSlackApi({ "chat.postMessage": (p: Record<string, string>) => ({ ok: true, channel: `D${p.channel}`, ts: `1700000000.00000${++n}` }) });
    await setMember(team.cleo, { isAdmin: true });
    await signInAs(t, team.cleo);
    await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await drain();
    calls = [];
    return redemptionId;
  }

  test("Mark fulfilled fulfils the request, tells the requester and rewrites every admin's copy", async () => {
    const id = await request();
    const res = await click(blockAction("store_fulfill", id));
    expect(res.status).toBe(200);
    expect(await statusOf(id)).toMatchObject({ status: "fulfilled" });
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual(["🎉 *☕ Coffee on us* is yours!"]);
    const updated = calls.filter((c) => c.method === "chat.update");
    expect(updated.map((c) => c.params.channel).sort()).toEqual(["DUANA", "DUCLEO"]);
    expect(updated.map((c) => c.params.text)).toEqual(Array(2).fill("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✔ Fulfilled by <@UANA>"));
    expect(ephemerals()).toEqual([]);
  });

  test("Approve approves", async () => {
    const id = await request();
    await click(blockAction("store_approve", id, { user: "UCLEO" }));
    expect(await statusOf(id)).toMatchObject({ status: "approved" });
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual(["✅ <@UCLEO> approved *☕ Coffee on us*. It's on its way."]);
  });

  test("an admin who never signed in to Kudos can't decide from Slack, so they can't be the four-eyes loophole", async () => {
    const id = await request();
    await setMember(team.cleo, { userId: undefined });
    await click(blockAction("store_fulfill", id, { user: "UCLEO" }));
    expect(ephemerals().map((e) => e.text)).toEqual(["Sign in to Kudos once before you decide requests from Slack."]);
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
  });

  test("a sole admin decides their own request from Slack, and their copy still says it's their own", async () => {
    let n = 0;
    stubSlackApi({ "chat.postMessage": (p: Record<string, string>) => ({ ok: true, channel: `D${p.channel}`, ts: `1700000000.00000${++n}` }) });
    const ana = await signInAs(t, team.ana);
    await fund(team.ana, 42);
    const { redemptionId } = await ana.mutation(api.store.redeem, { rewardId: await addReward(), expectedCost: 15 });
    await drain();
    calls = [];
    await click(blockAction("store_approve", redemptionId));
    expect(await statusOf(redemptionId)).toMatchObject({ status: "approved" });
    const [copy] = calls.filter((c) => c.method === "chat.update");
    expect(copy.params.text).toBe("🛎️ <@UANA> wants *☕ Coffee on us* (15 Hog coins). ✅ Approved by <@UANA>");
    expect(copy.params.blocks).toContain("Your own request");
  });

  test("an Enterprise Grid payload without a team names the workspace through the user", async () => {
    const id = await request();
    const payload = JSON.parse(blockAction("store_fulfill", id));
    await click(JSON.stringify({ ...payload, team: null, enterprise: { id: "E1" } }));
    expect(await statusOf(id)).toMatchObject({ status: "fulfilled" });
  });

  test("malformed payloads are turned away without a server error", async () => {
    const id = await request();
    expect((await click("null")).status).toBe(400);
    expect((await click("{not json")).status).toBe(400);
    expect((await click(blockAction("constructor", id))).status).toBe(200);
    expect((await click(blockAction("store_fulfill", id).replace(`"value":"${id}"`, '"value":{"$gt":""}'))).status).toBe(200);
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
  });

  test("a stale button says who got there first, and a retried click changes nothing", async () => {
    const id = await request();
    const cleo = await signInAs(t, team.cleo);
    await cleo.mutation(api.storeAdmin.decide, { redemptionId: id, action: "fulfill" });
    await drain();
    calls = [];
    await click(blockAction("store_approve", id));
    expect(ephemerals()).toEqual([{ url: RESPONSE_URL, response_type: "ephemeral", replace_original: false, text: "Already fulfilled by Cleo." }]);

    const again = await request();
    await click(blockAction("store_fulfill", again));
    await click(blockAction("store_fulfill", again));
    expect((await statusOf(again)).history.map((h) => h.status)).toEqual(["pending", "fulfilled"]);
    expect(ephemerals().map((e) => e.text)).toEqual(["Already fulfilled by you."]);
  });

  test("someone who isn't an admin gets an ephemeral no, and nothing changes", async () => {
    const id = await request();
    await setMember(team.bot, { isAdmin: true });
    for (const user of ["UBEN", "UNOBODY", "UBOT"]) await click(blockAction("store_fulfill", id, { user }));
    await setMember(team.cleo, { deactivated: true });
    await click(blockAction("store_fulfill", id, { user: "UCLEO" }));
    expect(ephemerals().map((e) => e.text)).toEqual(Array(4).fill("Only workspace admins can do that."));
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
    expect(calls.filter((c) => c.method === "chat.update" || c.method === "chat.postMessage")).toEqual([]);
  });

  test("the four-eyes rule holds in Slack: an admin can't approve their own request while another admin can", async () => {
    await setMember(team.ben, { isAdmin: true });
    const id = await request();
    await click(blockAction("store_approve", id, { user: "UBEN" }));
    expect(ephemerals().map((e) => e.text)).toEqual(["Another admin decides on your own requests."]);
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
  });

  test("a request from another workspace, or an id that isn't one, is not found", async () => {
    const id = await request();
    await signInAs(t, (await seedTeam(t, { storeEnabled: true }, "T2")).ana); // Ana is a signed-in admin there too, as UANA
    await click(blockAction("store_fulfill", id, { team: "T2" }));
    await click(blockAction("store_fulfill", "not-an-id"));
    await click(blockAction("store_fulfill", team.ben)); // a real id, of the wrong table
    expect(ephemerals().map((e) => e.text)).toEqual(Array(3).fill("Request not found."));
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
  });

  test("a user from another team, or a team without Kudos, is turned away", async () => {
    const id = await request();
    await click(blockAction("store_fulfill", id, { userTeam: "TEXTERNAL" }));
    await click(blockAction("store_fulfill", id, { team: "TUNKNOWN" }));
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { status: "uninstalled" }));
    await click(blockAction("store_fulfill", id));
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { status: "active", isDemo: true }));
    await click(blockAction("store_fulfill", id));
    expect(ephemerals().map((e) => e.text)).toEqual([
      "Only workspace admins can do that.",
      ...Array(3).fill("Kudos isn't installed in this workspace yet."),
    ]);
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
  });

  test("an unsigned or tampered request is rejected before anything is read", async () => {
    const id = await request();
    expect((await click(blockAction("store_fulfill", id), false)).status).toBe(401);
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
    expect(calls).toEqual([]);
  });

  test("other buttons (links in App Home and DMs) are just acknowledged", async () => {
    const id = await request();
    expect((await click(blockAction("store_review", id))).status).toBe(200);
    expect((await click(blockAction("open_dashboard", ""))).status).toBe(200);
    expect(calls).toEqual([]);
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
  });

  test("answers only ever go to Slack's own response URL", async () => {
    const id = await request();
    for (const responseUrl of ["https://evil.example/hook", "http://hooks.slack.com/x", "https://hooks.slack.com.evil.example/x", "https://u:p@hooks.slack.com/x"]) {
      await click(blockAction("store_fulfill", id, { user: "UBEN", responseUrl }));
    }
    expect(calls).toEqual([]);
    expect(await statusOf(id)).toMatchObject({ status: "pending" });
    await click(blockAction("store_fulfill", id, { user: "UBEN" }));
    expect(ephemerals()).toHaveLength(1); // the same refusal, sent to Slack's own URL
  });
});

describe("admin copies stay truthful when steps race the DMs", () => {
  const lastUpdateTo = (channel: string) => calls.filter((c) => c.method === "chat.update" && c.params.channel === channel).at(-1)?.params.text;

  test("a decision made on the web while the review DMs are still going out reaches those DMs too", async () => {
    await setMember(team.cleo, { isAdmin: true });
    await signInAs(t, team.cleo);
    const ana = await signInAs(t, team.ana);
    let redemptionId: Id<"redemptions"> | undefined;
    stubSlackApi({
      "chat.postMessage": async (p: Record<string, string>) => {
        // Ana approves on the web the moment her own copy arrives, before Cleo's is even sent.
        if (p.channel === "UANA") await ana.mutation(api.storeAdmin.decide, { redemptionId: redemptionId!, action: "approve" });
        return { ok: true, channel: `D${p.channel}`, ts: `1700000000.${p.channel}` };
      },
    });
    ({ redemptionId } = await redeemAsBen(await addReward()));
    await drain();
    expect(lastUpdateTo("DUANA")).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✅ Approved by <@UANA>");
    expect(lastUpdateTo("DUCLEO")).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✅ Approved by <@UANA>");
  });

  test("a sync that was overtaken by a later step renders again, so the copies end on the latest state", async () => {
    await setMember(team.cleo, { isAdmin: true });
    await signInAs(t, team.cleo);
    const ana = await signInAs(t, team.ana);
    stubSlackApi({ "chat.postMessage": (p: Record<string, string>) => ({ ok: true, channel: `D${p.channel}`, ts: "1700000000.000001" }) });
    const { redemptionId } = await redeemAsBen(await addReward());
    await drain();
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "approve" });
    let overtaken = false;
    stubSlackApi({
      "chat.update": async () => {
        // While this sync is still writing "Approved", Ana fulfils and that step's own sync finishes first.
        if (!overtaken) {
          overtaken = true;
          await t.run(async (ctx) => {
            const r = (await ctx.db.get(redemptionId))!;
            await ctx.db.patch(redemptionId, { status: "fulfilled", isOpen: false, history: [...r.history, { status: "fulfilled", at: Date.now(), by: team.ana }] });
          });
        }
        return { ok: true };
      },
    });
    await t.action(internal.slack.syncAdminMessages, { redemptionId });
    expect(lastUpdateTo("DUANA")).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✔ Fulfilled by <@UANA>");
    expect(lastUpdateTo("DUCLEO")).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 Hog coins). ✔ Fulfilled by <@UANA>");
  });
});

describe("balance adjustments (S6)", () => {
  test("refresh the member's App Home so its balance isn't stale", async () => {
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.storeAdmin.adjustBalance, { memberId: team.ben, amount: 8, reason: "Hackathon winner" });
    await drain();
    const home = published().filter((p) => p.user === "UBEN");
    expect(home).toHaveLength(1);
    expect(JSON.stringify(home[0].view.blocks)).toContain("50");
    // An adjustment is not a redemption step: no DM.
    expect(dms()).toEqual([]);
  });
});
