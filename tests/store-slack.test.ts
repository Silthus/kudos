import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { signSlackRequest } from "../convex/lib/slack";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * The Store in Slack (spec #4 §7, slice S3): DMs on every step of a redemption, the
 * App Home "Rewards store" section and `/kudos store`. Slack is a stubbed `fetch`.
 */

const SECRET = "test-signing-secret";

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

function stubSlackApi(responses: Record<string, unknown> = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      return Response.json(responses[method] ?? { ok: true });
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

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { storeEnabled: true, emojiGlyph: "🌮" });
  await setMember(team.ben, { totalReceived: 42 });
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
    expect(mine.text).toBe("🎁 Your request for *☕ Coffee on us* (15 :taco:) is in. An admin will take it from here. Balance: 27 :taco:.");
    expect(JSON.stringify(mine.blocks)).toContain("<https://kudos.example/store#my-requests|My requests>");

    const [review] = dmsTo("UANA");
    expect(review.text).toBe("🛎️ <@UBEN> wants *☕ Coffee on us* (15 :taco:). Balance after: 27 :taco:.");
    const button = review.blocks.find((b: { type: string }) => b.type === "actions").elements[0];
    expect(button).toMatchObject({ type: "button", text: { text: "Review in Kudos" }, url: "https://kudos.example/admin?tab=store" });
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
      "*☕ Coffee on us* was declined by <@UANA>: “Out of beans”. 15 :taco: are back in your balance (42 :taco:).",
    ]);
  });

  test("a note that ends a sentence isn't followed by a second full stop", async () => {
    await requestThen({ action: "decline", note: "We're out of beans this week." });
    expect(dmsTo("UBEN")[0].text).toContain("“We're out of beans this week.” 15 :taco: are back");
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
    await setMember(team.ana, { totalReceived: 42 });
    await ana.mutation(api.store.redeem, { rewardId: await addReward(), expectedCost: 15 });
    await drain();
    const [confirmation, review] = dmsTo("UANA");
    expect(confirmation.text).toMatch(/^🎁/);
    expect(review.text).toMatch(/^🛎️ <@UANA> wants/);
    expect(JSON.stringify(review.blocks)).toContain("Your own request");
  });

  test("the admin DM carries the requester's answer and flags a negative balance", async () => {
    await signInAs(t, team.ana);
    const rewardId = await addReward({ prompt: "Oat or <b>dairy</b>?" });
    await redeemAsBen(rewardId, "Oat <please>");
    await setMember(team.ben, { totalReceived: 10 }); // kudos revoked after the request
    await drain();
    const text = JSON.stringify(dmsTo("UANA")[0].blocks);
    expect(text).toContain("Answer to “Oat or &lt;b&gt;dairy&lt;/b&gt;?”: Oat &lt;please&gt;");
    expect(text).toContain("Negative balance");
  });

  test("balances stay out of DMs while received kudos are hidden", async () => {
    await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    // Closing the store and hiding received kudos leaves open requests actionable.
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { storeEnabled: false, receivedVisibility: "hidden" }));
    await drain();
    expect(dms().map((d) => d.text).join("\n")).not.toMatch(/[Bb]alance/);
    const ana = await signInAs(t, team.ana);
    calls = [];
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "decline" });
    await drain();
    expect(dmsTo("UBEN").map((d) => d.text)).toEqual(["*☕ Coffee on us* was declined by <@UANA>. 15 :taco: are back in your balance."]);
  });

  test("the demo workspace schedules nothing", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { isDemo: true }));
    const ana = await signInAs(t, team.ana);
    const { redemptionId } = await redeemAsBen(await addReward());
    await ana.mutation(api.storeAdmin.decide, { redemptionId, action: "fulfill" });
    expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
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
    expect(home).toContain("*Balance*\\n42 :taco:");
    // The dearest you can afford now, topped up with the next goal.
    expect(home).toContain("🥪 Lunch · 40 :taco:\\n☕ Coffee on us · 15 :taco:\\n🧥 Hoodie · 60 :taco:  _18 more to go_");
    expect(home).not.toContain("Sold out mug");
    expect(home).not.toContain("Headphones");
    await addReward({ name: "Sticker pack", emoji: "🏷️", cost: 5 });
    expect(await openHome("UBEN")).toContain("🥪 Lunch · 40 :taco:\\n☕ Coffee on us · 15 :taco:\\n🏷️ Sticker pack · 5 :taco:");
    expect(home).toContain('"url":"https://kudos.example/store"');
    expect(home).not.toContain("Review requests");
  });

  test("admins also see how many requests are waiting and a Review requests button", async () => {
    await signInAs(t, team.ana);
    const rewardId = await addReward();
    await redeemAsBen(rewardId);
    const home = await openHome("UANA");
    expect(home).toContain("1 request waiting");
    expect(home).toContain('"url":"https://kudos.example/admin?tab=store"');
  });

  test("leaves the store out while it's closed", async () => {
    await addReward();
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { storeEnabled: false }));
    expect(await openHome("UANA")).not.toContain("Rewards store");
  });

  test("an empty catalog says the shelves are still being stocked", async () => {
    expect(await openHome("UBEN")).toContain("The shelves are empty");
  });
});

describe("/kudos store", () => {
  async function command(text: string, userId = "UBEN") {
    const body = new URLSearchParams({ team_id: "T1", user_id: userId, command: "/kudos", text }).toString();
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

  test("shows your balance, the 5 cheapest rewards and a link to the store", async () => {
    for (const [name, cost] of [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5], ["F", 6]] as const) await addReward({ name, emoji: "🎁", cost });
    const body = await command("store");
    expect(body.response_type).toBe("ephemeral");
    const text = JSON.stringify(body.blocks);
    expect(text).toContain("*Balance*\\n42 :taco:");
    expect(text).toContain("🎁 A · 1 :taco:\\n🎁 B · 2 :taco:\\n🎁 C · 3 :taco:\\n🎁 D · 4 :taco:\\n🎁 E · 5 :taco:");
    expect(text).not.toContain("🎁 F");
    expect(text).toContain("<https://kudos.example/store|Open the store>");
  });

  test("balance is an alias", async () => {
    expect(JSON.stringify((await command("balance")).blocks)).toContain("*Balance*\\n42 :taco:");
  });

  test("says so when the store isn't open", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { storeEnabled: false }));
    expect((await command("store")).text).toBe("The rewards store isn't open in this workspace.");
  });

  test("the help mentions /kudos store only while the store is open", async () => {
    expect((await command("help")).text).toContain("`/kudos store`");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { storeEnabled: false }));
    expect((await command("help")).text).not.toContain("`/kudos store`");
  });
});
