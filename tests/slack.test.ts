import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { signSlackRequest } from "../convex/lib/slack";
import { all, member, seedTeam, setupConvex, type Team } from "./helpers";

const SECRET = "test-signing-secret";

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

/** Fake Slack Web API: records calls and answers like Slack would. */
function stubSlackApi(responses: Record<string, unknown> = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      const defaults: Record<string, unknown> = {
        "conversations.info": { ok: true, channel: { name: "general" } },
        "conversations.history": { ok: true, messages: [{ ts: "9.9", text: "shipped it" }] },
      };
      return Response.json(responses[method] ?? defaults[method] ?? { ok: true });
    }),
  );
}

async function signedPost(path: string, body: string, contentType = "application/json") {
  const ts = String(Math.floor(Date.now() / 1000));
  return await t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-slack-request-timestamp": ts,
      "x-slack-signature": await signSlackRequest(SECRET, ts, body),
    },
    body,
  });
}

const eventCallback = (eventId: string, event: object) =>
  JSON.stringify({ type: "event_callback", team_id: "T1", event_id: eventId, event });

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://kudos.example");
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("POST /slack/events", () => {
  test("answers Slack's URL verification challenge", async () => {
    const res = await signedPost("/slack/events", JSON.stringify({ type: "url_verification", challenge: "c-123" }));
    expect(await res.json()).toEqual({ challenge: "c-123" });
  });

  test("rejects requests that aren't signed by Slack", async () => {
    const res = await t.fetch("/slack/events", { method: "POST", body: eventCallback("Ev1", { type: "message" }) });
    expect(res.status).toBe(401);
  });

  test("turns a signed message event into kudos and DMs, even when Slack retries it", async () => {
    const body = eventCallback("Ev1", { type: "message", user: "UANA", text: "<@UBEN> :taco:", channel: "C1", ts: "1.1" });
    expect((await signedPost("/slack/events", body)).status).toBe(200);
    expect((await signedPost("/slack/events", body)).status).toBe(200); // retry
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await all(t, "slackEvents")).toHaveLength(1);
    expect(await all(t, "kudos")).toHaveLength(1);
    const dms = calls.filter((c) => c.method === "chat.postMessage").map((c) => c.params.channel);
    expect(dms.sort()).toEqual(["UANA", "UBEN"]);
  });
});

describe("event filtering", () => {
  test("ordinary chatter without any emoji isn't stored or processed", async () => {
    await signedPost("/slack/events", eventCallback("Ev2", { type: "message", user: "UANA", text: "lunch?", channel: "C1", ts: "2.2" }));
    await signedPost("/slack/events", eventCallback("Ev3", { type: "channel_created", channel: { id: "C9" } }));
    expect(await all(t, "slackEvents")).toHaveLength(0);
  });

  test("old event ids are pruned in batches until none are left", async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < 1200; i++) await ctx.db.insert("slackEvents", { eventId: `old-${i}` });
    });
    vi.setSystemTime(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await t.mutation(internal.slackData.pruneEvents, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await all(t, "slackEvents")).toHaveLength(0);
  });
});

describe("processing Slack events", () => {
  const process = (event: object) => t.action(internal.slack.processEvent, { teamId: "T1", event });

  test("bot DMs carry the rolled rarity and link to the gallery", async () => {
    await process({ type: "message", user: "UANA", text: "<@UBEN> :taco:", channel: "C1", ts: "1.1" });
    const dm = calls.find((c) => c.method === "chat.postMessage" && c.params.channel === "UANA")!;
    const blocks = JSON.parse(dm.params.blocks);
    expect(blocks[1].elements[0].text).toMatch(/(Common|Uncommon|Rare|Epic|LEGENDARY).*kudos\.example\/discoveries/);
    expect(await all(t, "notifications")).toEqual(expect.arrayContaining([expect.objectContaining({ delivery: "sent" })]));
  });

  test("stores the channel name and mention-free message text", async () => {
    await process({ type: "message", user: "UANA", text: "<@UBEN> :taco: thanks", channel: "C1", ts: "1.1" });
    expect((await all(t, "kudos"))[0]).toMatchObject({ channelId: "C1", channelName: "general", text: "@Ben :taco: thanks" });
  });

  test("'not allowed' replies are shown ephemerally in the channel instead of a DM", async () => {
    await process({ type: "message", user: "UANA", text: "<@UANA> :taco:", channel: "C1", ts: "1.1" });
    expect(calls.find((c) => c.method === "chat.postEphemeral")?.params).toMatchObject({ channel: "C1", user: "UANA" });
    expect(calls.some((c) => c.method === "chat.postMessage")).toBe(false);
  });

  test("ignores edits, bot posts and direct messages", async () => {
    await process({ type: "message", subtype: "message_changed", user: "UANA", text: "<@UBEN> :taco:", channel: "C1", ts: "1.1" });
    await process({ type: "message", bot_id: "B1", user: "UBOT", text: "<@UBEN> :taco:", channel: "C1", ts: "1.2" });
    await process({ type: "message", channel_type: "im", user: "UANA", text: "<@UBEN> :taco:", channel: "D1", ts: "1.3" });
    expect(await all(t, "kudos")).toHaveLength(0);
  });

  test("a kudos-emoji reaction gives the author one kudos", async () => {
    await process({ type: "reaction_added", user: "UANA", reaction: "taco::skin-tone-2", item_user: "UBEN", item: { type: "message", channel: "C1", ts: "9.9" } });
    expect(await member(t, team.ben)).toMatchObject({ totalReceived: 1 });
  });

  test("opening the App Home publishes the personal home tab", async () => {
    await process({ type: "app_home_opened", tab: "home", user: "UANA" });
    const publish = calls.find((c) => c.method === "views.publish")!;
    expect(publish.params.user_id).toBe("UANA");
    expect(JSON.parse(publish.params.view).type).toBe("home");
  });

  test("uninstalling the app disconnects the workspace and forgets the token", async () => {
    await process({ type: "app_uninstalled" });
    const [workspace, installs] = await t.run(async (ctx) => [
      await ctx.db.get(team.workspaceId),
      await ctx.db.query("slackInstallations").collect(),
    ]);
    expect(workspace?.status).toBe("uninstalled");
    expect(installs).toHaveLength(0);
  });
});

describe("POST /slack/commands", () => {
  const command = (text: string) =>
    signedPost("/slack/commands", new URLSearchParams({ team_id: "T1", user_id: "UANA", command: "/kudos", text }).toString(), "application/x-www-form-urlencoded");

  test("/kudos me shows the balance with a rarity-rolled message", async () => {
    const body = await (await command("me")).json();
    expect(body.response_type).toBe("ephemeral");
    expect(JSON.stringify(body.blocks)).toContain("*Left today*\\n5 / 5 :taco:");
  });

  test("/kudos me answers inline, so its bot message counts as delivered", async () => {
    await command("me");
    expect((await all(t, "notifications")).map((n) => [n.category, n.delivery])).toEqual([["allowance_status", "sent"]]);
  });

  test("/kudos top lists this week's most generous people", async () => {
    await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user: "UBEN", text: "<@UANA> :taco::taco:", channel: "C1", ts: "1.1" } });
    const body = await (await command("top")).json();
    expect(JSON.stringify(body.blocks)).toContain("🥇 <@UBEN> · 2 :taco:");
  });

  test("anything else explains how Kudos works", async () => {
    const body = await (await command("help")).json();
    expect(body.text).toContain("How Kudos works");
  });
});
