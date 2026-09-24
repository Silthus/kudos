import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { all, seedTeam, setupConvex, type Team } from "./helpers";

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

/** Fake Slack Web API: records calls and answers like Slack would (override per method). */
function stubSlackApi(responses: Record<string, (params: Record<string, string>) => unknown> = {}) {
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
      return Response.json(responses[method]?.(params) ?? defaults[method] ?? { ok: true });
    }),
  );
}

let ts = 100;
/** Ana (or someone else) posts `text` in #general. */
const post = (text: string, user = "UANA", messageTs = `${ts++}.0001`) =>
  t.action(internal.slack.processEvent, {
    teamId: "T1",
    event: { type: "message", user, text, channel: "C1", ts: messageTs },
  });

const reactions = () => calls.filter((c) => c.method === "reactions.add").map((c) => c.params);
const ephemerals = () => calls.filter((c) => c.method === "chat.postEphemeral").map((c) => c.params);

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  vi.stubEnv("SITE_URL", "https://kudos.example");
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the bot reacts to every kudos attempt on the message itself", () => {
  test("kudos given: the workspace's kudos emoji, and no guidance", async () => {
    await post("<@UBEN> :taco: thanks for the review", "UANA", "1.1");
    expect(reactions()).toEqual([{ channel: "C1", timestamp: "1.1", name: "taco" }]);
    expect(ephemerals()).toEqual([]);
  });

  test("over the allowance: ⏳, and the guidance shows the multiplication that pushed it over", async () => {
    await post("<@UCLEO> :taco::taco: thanks"); // 3 of 5 left
    calls = [];
    await post("<@UBEN> <@UCLEO> :taco::taco: great release", "UANA", "2.2");

    expect(reactions()).toEqual([{ channel: "C1", timestamp: "2.2", name: "hourglass_flowing_sand" }]);
    const [reply] = ephemerals();
    expect(reply).toMatchObject({ channel: "C1", user: "UANA" });
    expect(reply.text).toContain("Every :taco: goes to every person you mention: 2 people × 2 :taco: = 4 :taco:, but you have 3 left today.");
    expect(reply.text).toContain("use 1 :taco: so each of them gets 1 (2 in total), or mention just 1 person");
    // One ephemeral: the rolled "limit reached" reply with the guidance as its own section.
    expect(ephemerals()).toHaveLength(1);
    expect(JSON.parse(reply.blocks).map((b: { type: string }) => b.type)).toEqual(["section", "section", "context"]);
    expect(await all(t, "kudos")).toHaveLength(1); // all or nothing: only the first message gave
  });

  test("with nothing left today: ⏳, and when the allowance comes back", async () => {
    await post("<@UBEN> :taco::taco::taco::taco::taco:");
    calls = [];
    await post("<@UBEN> :taco:");
    expect(reactions().map((r) => r.name)).toEqual(["hourglass_flowing_sand"]);
    expect(ephemerals()[0].text).toContain("You've given all 5 :taco: you have for today, so nothing was sent. Your allowance resets at midnight.");
  });

  describe("invalid attempts get ❌ and a valid example, only for the giver", () => {
    test.each([
      ["nobody is mentioned", ":taco: great job everyone", "Nobody was mentioned"],
      ["only yourself", "<@UANA> :taco: I deserve this", "You can't give :taco: to yourself"],
      ["only the Kudos app", "<@UBOT> :taco: good bot", "Bots and apps can't receive :taco:"],
    ])("%s", async (_case, text, why) => {
      await post(text, "UANA", "3.3");
      expect(reactions()).toEqual([{ channel: "C1", timestamp: "3.3", name: "x" }]);
      const replies = ephemerals();
      expect(replies).toHaveLength(1);
      expect(replies[0]).toMatchObject({ channel: "C1", user: "UANA" });
      expect(replies[0].text).toContain(why);
      expect(replies[0].text).toContain("“@alex :taco: thanks for the review!”");
      expect(calls.some((c) => c.method === "chat.postMessage")).toBe(false);
      expect(await all(t, "kudos")).toHaveLength(0);
    });

    test("only other bots", async () => {
      await t.run((ctx) => ctx.db.patch(team.cleo, { isBot: true }));
      await post("<@UCLEO> :taco:");
      expect(reactions().map((r) => r.name)).toEqual(["x"]);
      expect(ephemerals()[0].text).toContain("Bots and apps can't receive :taco:");
    });

    test("only deactivated people", async () => {
      await t.run((ctx) => ctx.db.patch(team.ben, { deactivated: true }));
      await post("<@UBEN> :taco: thanks for everything");
      expect(reactions().map((r) => r.name)).toEqual(["x"]);
      expect(ephemerals()[0].text).toContain("Only active teammates can receive :taco:");
    });
  });

  test("messages without the kudos emoji never get a reaction", async () => {
    await post("<@UBEN> thanks for the review :pizza:");
    await post("lunch?");
    expect(reactions()).toEqual([]);
    expect(ephemerals()).toEqual([]);
  });

  test("a redelivered message never reacts, explains or gives twice", async () => {
    for (const text of ["<@UBEN> :taco:", ":taco: nobody"]) {
      const messageTs = `${ts++}.0001`;
      await post(text, "UANA", messageTs);
      await post(text, "UANA", messageTs);
    }
    expect(reactions().map((r) => r.name)).toEqual(["taco", "x"]);
    expect(ephemerals()).toHaveLength(1);
    expect(await all(t, "kudos")).toHaveLength(1);
  });

  test("a custom kudos emoji the workspace lacks falls back to ✅, and the attempt remembers it", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { emojiName: "kudos-coin" }));
    stubSlackApi({ "reactions.add": (p) => (p.name === "kudos-coin" ? { ok: false, error: "invalid_name" } : { ok: true }) });
    await post("<@UBEN> :kudos-coin: thanks", "UANA", "4.4");
    expect(reactions().map((r) => r.name)).toEqual(["kudos-coin", "white_check_mark"]);
    const [attempt] = await t.run((ctx) => ctx.db.query("kudosAttempts").collect());
    expect(attempt).toMatchObject({ channelId: "C1", messageTs: "4.4", giverId: team.ana, outcome: "given", reaction: "white_check_mark" });
  });

  test("a reaction Slack already shows, or can't add, never blocks the kudos or the DMs", async () => {
    stubSlackApi({ "reactions.add": () => ({ ok: false, error: "missing_scope" }) });
    await post("<@UBEN> :taco:");
    expect(reactions()).toHaveLength(1); // no ✅ fallback for errors other than an unknown emoji
    expect(calls.filter((c) => c.method === "chat.postMessage").map((c) => c.params.channel).sort()).toEqual(["UANA", "UBEN"]);
    stubSlackApi({ "reactions.add": () => ({ ok: false, error: "already_reacted" }) });
    await post(":taco:");
    expect(ephemerals()).toHaveLength(1);
  });
});

describe("the attempt record, per Slack message", () => {
  test("stores who tried, how it ended and why", async () => {
    await post("<@UBEN> :taco:", "UANA", "5.1");
    await post("<@UANA> :taco:", "UANA", "5.2");
    await post("<@UBEN> <@UCLEO> :taco::taco::taco:", "UANA", "5.3");
    const attempts = await t.run((ctx) => ctx.db.query("kudosAttempts").collect());
    expect(attempts.map((a) => [a.messageTs, a.outcome, a.reason, a.reaction, a.giverId])).toEqual([
      ["5.1", "given", undefined, "taco", team.ana],
      ["5.2", "invalid", "self", "x", team.ana],
      ["5.3", "limit", undefined, "hourglass_flowing_sand", team.ana],
    ]);
    expect(attempts[0].batchId).toBe((await all(t, "kudos"))[0].batchId);
  });
});

describe("reaction-based giving keeps its private reply", () => {
  test("over the allowance, the reply says the allowance is used up and when it comes back", async () => {
    await post("<@UBEN> :taco::taco::taco::taco::taco:");
    calls = [];
    await t.action(internal.slack.processEvent, {
      teamId: "T1",
      event: { type: "reaction_added", user: "UANA", reaction: "taco", item_user: "UCLEO", item: { type: "message", channel: "C1", ts: "9.9" } },
    });
    expect(reactions()).toEqual([]);
    const replies = ephemerals();
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toContain("You've given all 5 :taco: you have for today, so nothing was sent. Your allowance resets at midnight.");
  });
});
