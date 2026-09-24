import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { signSlackRequest } from "../convex/lib/slack";
import { all, NOW, seedTeam, setupConvex, type Team } from "./helpers";

/**
 * Kudos-emoji variants (#98, #55 §G5, §G7 Signature emoji) in every Slack flow: a variant gives
 * like the kudos emoji, but only for the member who owns it. For anyone else it's just an emoji.
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
      if (method === "conversations.info") return Response.json({ ok: true, channel: { name: "general" } });
      if (method === "conversations.history") return Response.json({ ok: true, messages: [{ ts: params.latest, text: "shipped the release" }] });
      return Response.json({ ok: true });
    }),
  );
}

const SECRET = "test-signing-secret";
let eventIds = 0;

/** Delivers an event the way Slack does: a signed webhook, then whatever it scheduled runs. */
async function deliverEvent(event: object, eventId = `Ev${eventIds++}`) {
  const body = JSON.stringify({ type: "event_callback", team_id: "T1", event_id: eventId, event });
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await t.fetch("/slack/events", {
    method: "POST",
    headers: { "content-type": "application/json", "x-slack-request-timestamp": ts, "x-slack-signature": await signSlackRequest(SECRET, ts, body) },
    body,
  });
  expect(res.status).toBe(200);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

const message = (ts: string, text: string, user = "UANA") => ({ type: "message", user, text, channel: "C1", channel_type: "channel", ts });
let edits = 500;
const editEvent = (ts: string, before: string, after: string, user = "UANA") => {
  const editTs = `${edits++}.000100`;
  return {
    type: "message",
    subtype: "message_changed",
    hidden: true,
    channel: "C1",
    channel_type: "channel",
    ts: editTs,
    event_ts: editTs,
    message: { type: "message", user, text: after, ts, edited: { user, ts: editTs } },
    previous_message: { type: "message", user, text: before, ts },
  };
};
const reaction = (reactionName: string, user: string, itemUser: string, ts: string) => ({
  type: "reaction_added",
  user,
  reaction: reactionName,
  item_user: itemUser,
  item: { type: "message", channel: "C1", ts },
});

const kudos = () => all(t, "kudos");
const attempts = () => t.run((ctx) => ctx.db.query("kudosAttempts").collect());
const botReactions = () => calls.filter((c) => c.method === "reactions.add").map((c) => c.params.name);

/** A player who bought `item` in the Store (or holds `skills`). */
async function owns(memberId: Id<"members">, { items = [], skills }: { items?: string[]; skills?: Record<string, number> }) {
  await t.run(async (ctx) => {
    await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: NOW.getTime(), xp: 600, level: 6, coins: 0, ...(skills ? { skills } : {}) });
    for (const item of items) await ctx.db.insert("itemPurchases", { workspaceId: team.workspaceId, memberId, item, price: 60, month: "2026-09", at: NOW.getTime() });
  });
}

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  vi.stubEnv("SITE_URL", "https://kudos.example");
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a message with a kudos-emoji variant", () => {
  test("gives like the kudos emoji when the giver owns the variant, and remembers which one", async () => {
    await owns(team.ana, { items: ["emojiGolden"] });
    await deliverEvent(message("1.1", "<@UBEN> :taco-golden: :taco-golden: thanks for the careful review"));
    expect((await kudos()).map((k) => [k.receiverId, k.amount, k.variant])).toEqual([[team.ben, 2, "golden"]]);
    expect((await attempts()).map((a) => a.outcome)).toEqual(["given"]);
    expect(botReactions()).toEqual(["taco"]);
  });

  test("is only an emoji for someone who doesn't own it: no kudos, no attempt, no reaction", async () => {
    await owns(team.ana, { items: ["emojiRainbow"] });
    await deliverEvent(message("2.1", "<@UBEN> :taco-golden: thanks for the careful review"));
    expect(await kudos()).toEqual([]);
    expect(await attempts()).toEqual([]);
    expect(botReactions()).toEqual([]);
  });

  test("only counts the owner's variants next to the kudos emoji", async () => {
    await owns(team.ana, { items: ["emojiGolden"] });
    await deliverEvent(message("3.1", "<@UBEN> :taco: :taco-rainbow: :taco-golden: thanks"));
    expect((await kudos()).map((k) => [k.amount, k.variant])).toEqual([[2, "golden"]]);
  });

  test("Signature emoji variants count for the member holding the skill", async () => {
    await owns(team.ana, { skills: { emoji_variants: 1 } });
    await deliverEvent(message("4.1", "<@UBEN> :taco-sparkle: thanks for the careful review"));
    expect((await kudos()).map((k) => [k.amount, k.variant])).toEqual([[1, "sparkle"]]);
    await deliverEvent(message("4.2", "<@UBEN> :taco-heart: thanks again")); // rank 2's variant: not held
    expect(await kudos()).toHaveLength(1);
  });

  test("is only an emoji while the game is off, even for its owner", async () => {
    await owns(team.ana, { items: ["emojiGolden"] });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await deliverEvent(message("5.1", "<@UBEN> :taco-golden: thanks"));
    expect(await kudos()).toEqual([]);
  });

  test("a redelivery never gives twice", async () => {
    await owns(team.ana, { items: ["emojiGolden"] });
    const event = message("6.1", "<@UBEN> :taco-golden: thanks for the careful review");
    await deliverEvent(event, "EvSame");
    await deliverEvent(event, "EvOther"); // Slack retries with a new event id sometimes
    expect(await kudos()).toHaveLength(1);
    expect(await attempts()).toHaveLength(1);
  });
});

describe("editing a message with a variant", () => {
  test("a failed attempt fixed with the owner's variant gives", async () => {
    await owns(team.ana, { items: ["emojiGolden"] });
    await deliverEvent(message("7.1", ":taco-golden: thanks for the careful review")); // nobody mentioned: ❌
    expect((await attempts()).map((a) => a.outcome)).toEqual(["invalid"]);
    await deliverEvent(editEvent("7.1", ":taco-golden: thanks for the careful review", "<@UBEN> :taco-golden: thanks for the careful review"));
    expect((await kudos()).map((k) => [k.receiverId, k.variant])).toEqual([[team.ben, "golden"]]);
    expect((await attempts()).map((a) => a.outcome)).toEqual(["given"]);
  });

  test("adding a variant you don't own to a message changes nothing", async () => {
    await owns(team.ana, { items: [] });
    await deliverEvent(message("8.1", "<@UBEN> great work"));
    await deliverEvent(editEvent("8.1", "<@UBEN> great work", "<@UBEN> :taco-golden: great work"));
    expect(await kudos()).toEqual([]);
    expect(await attempts()).toEqual([]);
  });

  test("changing the variant count on a sent kudos gets the private 'already sent' note", async () => {
    await owns(team.ana, { items: ["emojiGolden"] });
    await deliverEvent(message("9.1", "<@UBEN> :taco-golden: thanks"));
    calls = [];
    await deliverEvent(editEvent("9.1", "<@UBEN> :taco-golden: thanks", "<@UBEN> :taco-golden: :taco-golden: thanks"));
    const notes = calls.filter((c) => c.method === "chat.postEphemeral").map((c) => c.params.text);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/already/i);
    expect((await kudos()).map((k) => k.amount)).toEqual([1]);
  });
});

describe("reacting with a variant", () => {
  beforeEach(() => t.run((ctx) => ctx.db.patch(team.workspaceId, { reactionsEnabled: true })));

  test("gives the author a kudos when the reactor owns the variant", async () => {
    await owns(team.ben, { items: ["emojiGolden"] });
    await deliverEvent(reaction("taco-golden", "UBEN", "UANA", "10.1"));
    expect((await kudos()).map((k) => [k.giverId, k.receiverId, k.source, k.variant])).toEqual([[team.ben, team.ana, "reaction", "golden"]]);
  });

  test("is only a reaction for someone who doesn't own it", async () => {
    await owns(team.ben, { items: [] });
    await deliverEvent(reaction("taco-golden", "UBEN", "UANA", "11.1"));
    await deliverEvent(reaction("taco-golden::skin-tone-2", "UBEN", "UANA", "11.1"));
    expect(await kudos()).toEqual([]);
  });
});
