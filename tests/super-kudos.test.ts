import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { signSlackRequest } from "../convex/lib/slack";
import { goldenLeaves } from "../convex/superKudos";
import { all, NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/**
 * Super kudos (#98, #55 §G7 Herald): `:taco-super:` gives the usual amount. With the Super kudos
 * skill, a use left this month, one person, a 12+ word note and not the same person twice in a
 * quarter, it's a Super kudos: the receiver gets a celebration of their own. Otherwise it's a normal
 * kudos and the giver hears why, privately.
 */

type SlackCall = { method: string; params: Record<string, string> };
let calls: SlackCall[];
let t: ReturnType<typeof setupConvex>;
let team: Team;

function stubSlackApi() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(url).split("/api/")[1];
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      if (method === "conversations.info") {
        if (params.channel === "CFAIL") return Response.json({ ok: false, error: "ratelimited" });
        const secret = params.channel === "G9" || params.channel === "CPRIV";
        return Response.json({ ok: true, channel: secret ? { name: "secret", is_private: true } : { name: "general", is_private: false } });
      }
      if (method === "chat.postMessage" || method === "chat.postEphemeral") return Response.json({ ok: true, ts: "99.9" });
      return Response.json({ ok: true });
    }),
  );
}

const SECRET = "test-signing-secret";
let eventIds = 0;
let tsCounter = 1;

async function deliverEvent(event: object) {
  const body = JSON.stringify({ type: "event_callback", team_id: "T1", event_id: `Ev${eventIds++}`, event });
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await t.fetch("/slack/events", {
    method: "POST",
    headers: { "content-type": "application/json", "x-slack-request-timestamp": ts, "x-slack-signature": await signSlackRequest(SECRET, ts, body) },
    body,
  });
  expect(res.status).toBe(200);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** Ana posts `text`; returns the Slack calls it caused. */
async function anaPosts(text: string, channel = "C1") {
  calls = [];
  await deliverEvent({ type: "message", user: "UANA", text, channel, channel_type: "channel", ts: `${tsCounter++}.1` });
  return calls;
}

const WHY = "for untangling the flaky release pipeline and writing up every step so the rest of us could follow"; // 18 words
const blocksOf = (c: SlackCall) => c.params.blocks ?? "";
const dmTo = (cs: SlackCall[], user: string) => cs.find((c) => c.method === "chat.postMessage" && c.params.channel === user);
const replyTo = (cs: SlackCall[], user: string) => cs.find((c) => c.method === "chat.postEphemeral" && c.params.user === user);
const superRows = () => t.run((ctx) => ctx.db.query("superKudos").collect());

async function herald(memberId: Id<"members">, skills: Record<string, number> = { emoji_variants: 1, super_kudos: 1 }) {
  await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: NOW.getTime(), xp: 600, level: 6, coins: 0, skills }));
}

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false, dailyLimit: 20 });
  vi.stubEnv("SITE_URL", "https://kudos.example");
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a Super kudos", () => {
  test("gives the usual amount, celebrates the receiver in their DM and tells the giver what's left", async () => {
    await herald(team.ana);
    const cs = await anaPosts(`<@UBEN> :taco-super: ${WHY}`);

    const [row] = await all(t, "kudos");
    expect(row).toMatchObject({ receiverId: team.ben, amount: 1, superKudos: true });
    expect(await superRows()).toMatchObject([{ giverId: team.ana, receiverId: team.ben, kudosId: row._id, month: "2026-09", quarter: "q:2026-Q3" }]);

    const dm = dmTo(cs, "UBEN")!;
    expect(dm.params.text).toContain("Super kudos from <@UANA>");
    expect(blocksOf(dm)).toContain("untangling the flaky release pipeline");
    expect(replyTo(cs, "UANA")!.params.text).toMatch(/Super kudos sent.*0 of 1 left this month/s);
    expect(calls.filter((c) => c.method === "reactions.add").map((c) => c.params.name)).toEqual(["taco-super"]);
  });

  test("without the skill it's a normal kudos, and the giver gets a private how-to", async () => {
    await herald(team.ana, {});
    const cs = await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    const [row] = await all(t, "kudos");
    expect(row.amount).toBe(1);
    expect(row.superKudos).toBeUndefined();
    expect(await superRows()).toEqual([]);
    expect(dmTo(cs, "UBEN")!.params.text).not.toContain("Super kudos");
    expect(replyTo(cs, "UANA")!.params.text).toContain("counted as a normal kudos");
    expect(replyTo(cs, "UANA")!.params.text).toContain("Herald skill");
    expect(calls.filter((c) => c.method === "reactions.add").map((c) => c.params.name)).toEqual(["taco"]);
  });

  test("with a short note, or for two people, it's normal and the use stays", async () => {
    await herald(team.ana);
    let cs = await anaPosts("<@UBEN> :taco-super: thanks for the help today");
    expect(replyTo(cs, "UANA")!.params.text).toContain("12 words or more");
    cs = await anaPosts(`<@UBEN> <@UCLEO> :taco-super: ${WHY}`);
    expect(replyTo(cs, "UANA")!.params.text).toContain("for one person");
    expect((await all(t, "kudos")).map((k) => k.amount)).toEqual([1, 1, 1]);
    expect(await superRows()).toEqual([]);
    await anaPosts(`<@UCLEO> :taco-super: ${WHY}`);
    expect(await superRows()).toHaveLength(1);
  });

  test("one a month, two with Encore; the month after, they're back", async () => {
    await herald(team.ana);
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    const cs = await anaPosts(`<@UCLEO> :taco-super: ${WHY}`);
    expect(replyTo(cs, "UANA")!.params.text).toContain("used your Super kudos this month");
    expect(await superRows()).toHaveLength(1);

    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").collect())[0];
      await ctx.db.patch(p._id, { skills: { emoji_variants: 1, super_kudos: 1, encore: 1 } });
    });
    await anaPosts(`<@UCLEO> :taco-super: ${WHY}`);
    expect(await superRows()).toHaveLength(2);

    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    await anaPosts(`<@UCLEO> :taco-super: ${WHY}`); // a new quarter too
    expect((await superRows()).map((r) => r.month)).toEqual(["2026-09", "2026-09", "2026-10"]);
  });

  test("never to the same person twice in a quarter", async () => {
    await herald(team.ana);
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    vi.setSystemTime(new Date("2026-09-30T10:00:00Z")); // same month and quarter, but Encore's second use
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").collect())[0];
      await ctx.db.patch(p._id, { skills: { emoji_variants: 1, super_kudos: 1, encore: 1 } });
    });
    const cs = await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    expect(replyTo(cs, "UANA")!.params.text).toContain("this quarter");
    expect(await superRows()).toHaveLength(1);
    vi.setSystemTime(new Date("2026-11-02T10:00:00Z")); // Q4
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    expect(await superRows()).toHaveLength(2);
  });

  test("a revoked Super kudos is gone, and its use comes back", async () => {
    await herald(team.ana);
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    const [row] = await all(t, "kudos");
    await (await signInAs(t, team.ana)).mutation(api.admin.revoke, { kudosId: row._id });
    expect(await superRows()).toEqual([]);
    await anaPosts(`<@UCLEO> :taco-super: ${WHY}`);
    expect(await superRows()).toHaveLength(1);
  });

  test("is only an emoji while the game is off", async () => {
    await herald(team.ana);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    expect(await all(t, "kudos")).toEqual([]);
  });
});

describe("the Spotlight capstone", () => {
  const announced = () => calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === "CNEWS");

  test("features a Super kudos from a public channel in the announcement channel", async () => {
    await herald(team.ana, { emoji_variants: 1, super_kudos: 1, encore: 1, spotlight: 1 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { announceChannel: { id: "CNEWS", name: "news" } }));
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    expect(announced()).toHaveLength(1);
    expect(announced()[0].params.text).toContain("<@UANA> sent <@UBEN> a Super kudos");
    expect((await superRows())[0].spotlight).toBe(true);
  });

  test("never features one from a private channel, without the skill, or without an announcement channel", async () => {
    await herald(team.ana, { emoji_variants: 1, super_kudos: 1, encore: 1, spotlight: 1 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { announceChannel: { id: "CNEWS", name: "news" } }));
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`, "G9");
    expect(announced()).toEqual([]);

    await t.run((ctx) => ctx.db.patch(team.workspaceId, { announceChannel: undefined }));
    await anaPosts(`<@UCLEO> :taco-super: ${WHY}`);
    expect(announced()).toEqual([]);
    expect((await superRows()).map((r) => r.spotlight)).toEqual([undefined, undefined]);
  });

  test("fails closed: never from a private channel with a C id, nor when Slack can't say the channel is public (review #1)", async () => {
    await herald(team.ana, { emoji_variants: 1, super_kudos: 1, encore: 1, spotlight: 1 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { announceChannel: { id: "CNEWS", name: "news" } }));
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`, "CPRIV");
    await anaPosts(`<@UCLEO> :taco-super: ${WHY}`, "CFAIL");
    expect(await superRows()).toHaveLength(2);
    expect(announced()).toEqual([]);
  });

  test("never names someone who hides the game, and nothing goes out once the game is off (review #2)", async () => {
    await herald(team.ana, { emoji_variants: 1, super_kudos: 1, encore: 1, spotlight: 1 });
    await t.run(async (ctx) => {
      await ctx.db.patch(team.workspaceId, { announceChannel: { id: "CNEWS", name: "news" } });
      await ctx.db.patch(team.ben, { gameHidden: true });
    });
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    expect(announced()).toEqual([]);
    expect((await superRows())[0].spotlight).toBeUndefined();
  });
});

describe("the notes when notifications are off (review #4)", () => {
  test("with giver replies off, the how-to still reaches the giver, privately", async () => {
    await herald(team.ana, {});
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyGiver: false }));
    const cs = await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    expect(replyTo(cs, "UANA")?.params.text).toContain("counted as a normal kudos");
  });
});

describe("edits and reactions", () => {
  test("swapping the kudos emoji for the Super kudos emoji on a sent kudos gets the 'already sent' note (review #5)", async () => {
    await herald(team.ana);
    await anaPosts(`<@UBEN> :taco: ${WHY}`);
    calls = [];
    const ts = `${tsCounter - 1}.1`;
    await deliverEvent({
      type: "message",
      subtype: "message_changed",
      hidden: true,
      channel: "C1",
      channel_type: "channel",
      ts: "900.1",
      message: { type: "message", user: "UANA", text: `<@UBEN> :taco-super: ${WHY}`, ts, edited: { user: "UANA", ts: "900.1" } },
      previous_message: { type: "message", user: "UANA", text: `<@UBEN> :taco: ${WHY}`, ts },
    });
    expect(replyTo(calls, "UANA")?.params.text).toMatch(/already/i);
    expect(await superRows()).toEqual([]);
  });

  test("a failed attempt fixed by an edit can become a Super kudos", async () => {
    await herald(team.ana);
    await anaPosts(`:taco-super: ${WHY}`); // nobody mentioned
    const ts = `${tsCounter - 1}.1`;
    await deliverEvent({
      type: "message",
      subtype: "message_changed",
      hidden: true,
      channel: "C1",
      channel_type: "channel",
      ts: "901.1",
      message: { type: "message", user: "UANA", text: `<@UBEN> :taco-super: ${WHY}`, ts, edited: { user: "UANA", ts: "901.1" } },
      previous_message: { type: "message", user: "UANA", text: `:taco-super: ${WHY}`, ts },
    });
    expect(await superRows()).toMatchObject([{ receiverId: team.ben }]);
  });

  test("reacting with the Super kudos emoji gives a normal kudos, never a Super kudos", async () => {
    await herald(team.ben);
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { reactionsEnabled: true }));
    await deliverEvent({ type: "reaction_added", user: "UBEN", reaction: "taco-super", item_user: "UANA", item: { type: "message", channel: "C1", ts: "77.7" } });
    expect((await all(t, "kudos")).map((k) => [k.giverId, k.receiverId, k.amount, k.superKudos])).toEqual([[team.ben, team.ana, 1, undefined]]);
    expect(await superRows()).toEqual([]);
  });
});

describe("golden leaves in the garden (#95)", () => {
  test("the giver's plant for the receiver shows them, to the giver and to the receiver", async () => {
    await herald(team.ana);
    await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ben, since: NOW.getTime(), xp: 100, level: 3, coins: 0 }));
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    const ana = await signInAs(t, team.ana);
    await ana.mutation(api.gardens.plant, { teammateId: team.ben });
    const garden = await ana.query(api.gardens.mine, { today: TODAY });
    if (!garden?.open) throw new Error("garden closed");
    expect(garden.plants.map((p) => [p.forId, p.goldenLeaves])).toEqual([[team.ben, 1]]);
    const forBen = await (await signInAs(t, team.ben)).query(api.gardens.forMe, { today: TODAY });
    expect(forBen!.map((p) => p.goldenLeaves)).toEqual([1]);
  });
});

describe("golden leaves (the hook for gardens, #95)", () => {
  test("one per Super kudos the giver sent that teammate, revoked ones gone", async () => {
    await herald(team.ana, { emoji_variants: 1, super_kudos: 1, encore: 1 });
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    const leaves = () => t.run((ctx) => goldenLeaves(ctx, team.ana, team.ben));
    expect(await leaves()).toBe(2);
    expect(await t.run((ctx) => goldenLeaves(ctx, team.ben, team.ana))).toBe(0);
    const [first] = await all(t, "kudos");
    await (await signInAs(t, team.ana)).mutation(api.admin.revoke, { kudosId: first._id });
    expect(await leaves()).toBe(1);
  });
});

describe("the receiver's celebration on the web", () => {
  test("shows once, until they've seen it; only to the receiver", async () => {
    await herald(team.ana);
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    const ben = await signInAs(t, team.ben);
    const celebration = await ben.query(api.superKudos.celebration, { today: TODAY });
    expect(celebration).toMatchObject({ from: "Ana" });
    expect(celebration!.note).toContain("untangling the flaky release pipeline");
    expect(await (await signInAs(t, team.cleo)).query(api.superKudos.celebration, { today: TODAY })).toBeNull();

    await ben.mutation(api.superKudos.seen, { id: celebration!.id });
    expect(await ben.query(api.superKudos.celebration, { today: TODAY })).toBeNull();
  });

  test("nothing for a receiver who hides the game, not even once they show it again (review #3)", async () => {
    await herald(team.ana);
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    const cs = await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    expect(dmTo(cs, "UBEN")!.params.text).not.toContain("Super kudos");
    expect(await (await signInAs(t, team.ben)).query(api.superKudos.celebration, { today: TODAY })).toBeNull();
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: undefined }));
    expect(await (await signInAs(t, team.ben)).query(api.superKudos.celebration, { today: TODAY })).toBeNull();
  });
});

describe("removing a member", () => {
  test("deletes the Super kudos they gave and received", async () => {
    await herald(team.ana);
    await anaPosts(`<@UBEN> :taco-super: ${WHY}`);
    // A row revoking can't reach (its kudos lost the mark): the removal's own phase clears it.
    await t.run(async (ctx) => {
      const [row] = await ctx.db.query("kudos").collect();
      await ctx.db.patch(row._id, { superKudos: undefined });
    });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    expect(await superRows()).toEqual([]);
  });
});
