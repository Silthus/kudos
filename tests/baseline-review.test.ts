import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { all, member, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// Findings from the adversarial review of the v1 baseline (Silthus/kudos#2).

let t: ReturnType<typeof setupConvex>;
let team: Team;
let ts = 1;
const give = (text: string, giver = "UANA") =>
  t.mutation(internal.kudos.ingestMessage, { workspaceId: team.workspaceId, botUserId: "UBOT", giverSlackId: giver, text, channelId: "C1", messageTs: `${ts++}.0` });
const processEvent = (event: object) => t.action(internal.slack.processEvent, { teamId: "T1", event });

/** Fake Slack Web API answering per method. */
function stubSlackApi(responses: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const method = String(url).split("/api/")[1];
      return Response.json(responses[method] ?? { ok: true });
    }),
  );
}

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("people deactivated in Slack", () => {
  const slackUser = (id: string, extra: object = {}) => ({ id, name: id.toLowerCase(), profile: { display_name: id }, ...extra });

  test("lose dashboard access as soon as Slack reports the deactivation", async () => {
    const ben = await signInAs(t, team.ben);
    expect((await ben.query(api.session.viewer, {})).status).toBe("ready");
    await processEvent({ type: "user_change", user: slackUser("UBEN", { deleted: true }) });
    expect(await member(t, team.ben)).toMatchObject({ deactivated: true });
    expect((await ben.query(api.session.viewer, {})).status).not.toBe("ready");
  });

  test("new teammates joining Slack become members", async () => {
    await processEvent({ type: "team_join", user: slackUser("UNEW") });
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    expect(members.find((m) => m.slackUserId === "UNEW")).toMatchObject({ deactivated: false, isAdmin: false });
  });

  test("external people from shared channels don't become members", async () => {
    await processEvent({ type: "user_change", user: slackUser("UEXT", { team_id: "TOTHER" }) });
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    expect(members.find((m) => m.slackUserId === "UEXT")).toBeUndefined();
  });

  test("are also caught by the daily directory resync", async () => {
    stubSlackApi({ "users.list": { ok: true, members: [slackUser("UBEN", { deleted: true })] } });
    await t.mutation(internal.slackData.scheduleDirectorySync, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await member(t, team.ben)).toMatchObject({ deactivated: true });
  });

  test("the Slack app subscribes to directory events", async () => {
    const { BOT_EVENTS } = await import("../convex/lib/slack");
    expect(BOT_EVENTS).toEqual(expect.arrayContaining(["user_change", "team_join"]));
  });
});

describe("private channels", () => {
  test("don't reveal their names in workspace analytics", async () => {
    stubSlackApi({ "conversations.info": { ok: true, channel: { name: "layoffs-q4", is_private: true } } });
    await processEvent({ type: "message", user: "UANA", text: "<@UBEN> :taco:", channel: "G123", ts: "77.0" });
    const cleo = await signInAs(t, team.cleo);
    const { channels } = await cleo.query(api.analytics.overview, { period: "week", today: TODAY });
    expect(channels.length).toBe(1);
    expect(JSON.stringify(channels)).not.toContain("layoffs-q4");
  });

  test("public channel names still show", async () => {
    stubSlackApi({ "conversations.info": { ok: true, channel: { name: "general", is_private: false } } });
    await processEvent({ type: "message", user: "UANA", text: "<@UBEN> :taco:", channel: "C1", ts: "78.0" });
    const cleo = await signInAs(t, team.cleo);
    const { channels } = await cleo.query(api.analytics.overview, { period: "week", today: TODAY });
    expect(channels).toEqual([{ name: "general", value: 1 }]);
  });
});

describe("reactions", () => {
  test("give at most once per person and message, even on messages with 100+ kudos", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 100 }));
    const mentions = Array.from({ length: 100 }, (_, i) => `<@UX${i}>`).join(" ");
    const mass = await t.mutation(internal.kudos.ingestMessage, { workspaceId: team.workspaceId, botUserId: "UBOT", giverSlackId: "UANA", text: `${mentions} :taco:`, channelId: "C1", messageTs: "900.0" });
    expect(mass?.status).toBe("given");
    const react = () => t.mutation(internal.kudos.ingestReaction, { workspaceId: team.workspaceId, botUserId: "UBOT", reactorSlackId: "UBEN", authorSlackId: "UANA", channelId: "C1", messageTs: "900.0" });
    await react();
    await react();
    expect(await member(t, team.ana)).toMatchObject({ totalReceived: 1 });
  });

  test("on a thread reply quote the reply, not the message before it in the channel", async () => {
    stubSlackApi({
      "conversations.info": { ok: true, channel: { name: "general" } },
      "conversations.history": { ok: true, messages: [{ ts: "8.0", text: "someone else's parent message" }] },
      "conversations.replies": { ok: true, messages: [{ ts: "8.0", text: "someone else's parent message" }, { ts: "9.9", text: "Ben's reply" }] },
    });
    await processEvent({ type: "reaction_added", user: "UANA", reaction: "taco", item_user: "UBEN", item: { type: "message", channel: "C1", ts: "9.9" } });
    const [row] = await all(t, "kudos");
    expect(row.text).toContain("Ben's reply");
    expect(row.text).not.toContain("parent");
  });
});

describe("maxed days", () => {
  test("a revoke after lowering the limit doesn't mark the day maxed", async () => {
    for (let i = 0; i < 4; i++) await give("<@UBEN> :taco:");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 3 }));
    const ana = await signInAs(t, team.ana);
    const [first] = await all(t, "kudos");
    await ana.mutation(api.admin.revoke, { kudosId: first._id });
    const day = (await all(t, "memberDays")).find((d) => d.memberId === team.ana)!;
    expect(day).toMatchObject({ given: 3, maxed: false });
    expect(await member(t, team.ana)).toMatchObject({ totalMaxedDays: 0 });
  });
});

describe("received visibility", () => {
  test("admins' member list respects a hidden setting", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "hidden" }));
    await give("<@UBEN> :taco::taco:");
    const ana = await signInAs(t, team.ana);
    const rows = await ana.query(api.admin.members, {});
    expect(rows.find((m) => m.slackUserId === "UBEN")?.totalReceived).toBeNull();
  });

  test("and still shows counts when everyone may see them", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "everyone" }));
    await give("<@UBEN> :taco::taco:");
    const ana = await signInAs(t, team.ana);
    const rows = await ana.query(api.admin.members, {});
    expect(rows.find((m) => m.slackUserId === "UBEN")?.totalReceived).toBe(2);
  });
});
