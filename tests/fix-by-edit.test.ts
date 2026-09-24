import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { signSlackRequest } from "../convex/lib/slack";
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
      const defaults: Record<string, unknown> = { "conversations.info": { ok: true, channel: { name: "general" } } };
      return Response.json(responses[method]?.(params) ?? defaults[method] ?? { ok: true });
    }),
  );
}

/** Ana (or someone else) posts `text` in #general as message `ts`. */
async function post(ts: string, text: string, user = "UANA", extra: Record<string, unknown> = {}) {
  await t.action(internal.slack.processEvent, { teamId: "T1", event: { type: "message", user, text, channel: "C1", ts, ...extra } });
  await t.finishAllScheduledFunctions(vi.runAllTimers); // e.g. the App Home refresh
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

let edits = 500;
/** The author edits message `ts` from `before` to `after`, as Slack reports it (`message_changed`). */
const editEvent = (ts: string, before: string, after: string, { user = "UANA", editTs = `${edits++}.000100`, extra = {} } = {}) => ({
  type: "message",
  subtype: "message_changed",
  hidden: true,
  channel: "C1",
  channel_type: "channel",
  ts: editTs,
  event_ts: editTs,
  message: { type: "message", user, text: after, ts, edited: { user, ts: editTs }, ...extra },
  previous_message: { type: "message", user, text: before, ts },
});
const edit = (ts: string, before: string, after: string, options?: Parameters<typeof editEvent>[3] & { eventId?: string }) =>
  deliverEvent(editEvent(ts, before, after, options), options?.eventId);

const reactionCalls = () =>
  calls.filter((c) => c.method.startsWith("reactions.")).map((c) => `${c.method.slice("reactions.".length)} ${c.params.name}`);
const ephemerals = () => calls.filter((c) => c.method === "chat.postEphemeral").map((c) => c.params);
const dms = () => calls.filter((c) => c.method === "chat.postMessage").map((c) => c.params.channel).sort();
const attempts = () => t.run((ctx) => ctx.db.query("kudosAttempts").collect());

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t);
  vi.stubEnv("SITE_URL", "https://kudos.example");
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  stubSlackApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("editing a failed kudos message fixes it", () => {
  test("over the allowance → edited down → given: ⏳ swapped for the kudos emoji, recipients hear about it", async () => {
    await post("1.1", "<@UCLEO> :taco::taco: thanks"); // 3 of 5 left
    const over = "<@UBEN> <@UCLEO> :taco::taco: great release";
    await post("2.2", over);
    calls = [];

    await edit("2.2", over, "<@UBEN> <@UCLEO> :taco: great release");

    expect(reactionCalls()).toEqual(["remove hourglass_flowing_sand", "remove x", "add taco"]);
    expect(calls.find((c) => c.method === "reactions.remove")?.params).toMatchObject({ channel: "C1", timestamp: "2.2" });
    expect(ephemerals()).toEqual([]);
    expect(dms()).toEqual(["UANA", "UBEN", "UCLEO"]); // as usual: the recipients, and Ana's confirmation
    const fixed = (await all(t, "kudos")).filter((k) => k.messageTs === "2.2");
    expect(fixed.map((k) => [k.receiverId, k.amount])).toEqual([
      [team.ben, 1],
      [team.cleo, 1],
    ]);
    const attempt = (await attempts()).find((a) => a.messageTs === "2.2")!;
    expect(attempt).toMatchObject({ outcome: "given", reaction: "taco", batchId: fixed[0].batchId });
    expect(await t.run((ctx) => ctx.db.query("kudosAttempts").collect())).toHaveLength(2); // patched, never a second row
  });

  test("invalid → edited to mention someone → given: ❌ swapped for the kudos emoji", async () => {
    await post("3.1", ":taco: great job");
    calls = [];
    await edit("3.1", ":taco: great job", "<@UBEN> :taco: great job");
    expect(reactionCalls()).toEqual(["remove hourglass_flowing_sand", "remove x", "add taco"]);
    expect(ephemerals()).toEqual([]);
    expect((await all(t, "kudos")).map((k) => [k.receiverId, k.messageTs])).toEqual([[team.ben, "3.1"]]);
    const [attempt] = await attempts();
    expect(attempt).toMatchObject({ outcome: "given", reaction: "taco" });
    expect(attempt.reason).toBeUndefined(); // no stale "no_mention"
  });

  test("the fix is a fresh attempt against today's allowance, dated at the edit", async () => {
    await post("4.1", "<@UCLEO> :taco::taco::taco::taco::taco:"); // all 5 used on Wednesday
    await post("4.2", "<@UBEN> :taco: thanks");
    vi.setSystemTime(new Date("2026-09-24T09:00:00Z")); // Thursday
    await edit("4.2", "<@UBEN> :taco: thanks", "<@UBEN> :taco: thanks for yesterday");
    const fixed = (await all(t, "kudos")).find((k) => k.messageTs === "4.2")!;
    expect(fixed).toMatchObject({ dayKey: "2026-09-24", at: Date.parse("2026-09-24T09:00:00Z") });
    expect((await attempts()).find((a) => a.messageTs === "4.2")).toMatchObject({ outcome: "given", at: Date.parse("2026-09-24T09:00:00Z") });
  });

  test("still failing after the edit: the reaction swaps to match and the guidance comes again", async () => {
    await post("5.1", ":taco: nobody");
    calls = [];
    await edit("5.1", ":taco: nobody", "<@UBEN> <@UCLEO> :taco::taco::taco: heroes");
    expect(reactionCalls()).toEqual(["remove x", "add hourglass_flowing_sand"]);
    expect(ephemerals()).toHaveLength(1);
    expect(ephemerals()[0]).toMatchObject({ channel: "C1", user: "UANA" });
    expect(ephemerals()[0].text).toContain("2 people × 3 :taco: = 6 :taco:, but you have 5 left today.");
    expect((await attempts())[0]).toMatchObject({ outcome: "limit", reaction: "hourglass_flowing_sand" });

    calls = [];
    await edit("5.1", "<@UBEN> <@UCLEO> :taco::taco::taco: heroes", "<@UANA> :taco: me");
    expect(reactionCalls()).toEqual(["remove hourglass_flowing_sand", "add x"]);
    expect(ephemerals()[0].text).toContain("You can't give :taco: to yourself");
    expect((await attempts())[0]).toMatchObject({ outcome: "invalid", reason: "self" });

    calls = [];
    await edit("5.1", "<@UANA> :taco: me", ":taco: still nobody");
    expect(reactionCalls()).toEqual(["remove hourglass_flowing_sand", "add x"]); // whatever else might still show comes off
    expect(ephemerals()[0].text).toContain("Nobody was mentioned");
    expect(await all(t, "kudos")).toHaveLength(0);
  });

  test("the guidance for a failed attempt says editing the message fixes it", async () => {
    await post("5.5", ":taco: nobody");
    expect(ephemerals()[0].text).toContain("Edit your message to fix it.");
  });

  test("in a thread, the guidance after an edit shows up in the thread", async () => {
    await post("6.2", ":taco: nobody", "UANA", { thread_ts: "6.1" });
    calls = [];
    await edit("6.2", ":taco: nobody", ":taco: still nobody", { extra: { thread_ts: "6.1" } });
    expect(ephemerals()[0]).toMatchObject({ channel: "C1", user: "UANA", thread_ts: "6.1" });
  });

  test("a thread's parent message gets its guidance in the channel, like when it was posted", async () => {
    await post("6.5", ":taco: nobody");
    calls = [];
    await edit("6.5", ":taco: nobody", ":taco: still nobody", { extra: { thread_ts: "6.5", reply_count: 2 } });
    expect(ephemerals()).toHaveLength(1);
    expect(ephemerals()[0].thread_ts).toBeUndefined();
  });

  test("a sent kudos in a thread gets its note in the thread", async () => {
    await post("6.7", "<@UBEN> :taco:", "UANA", { thread_ts: "6.6" });
    calls = [];
    await edit("6.7", "<@UBEN> :taco:", "<@UCLEO> :taco:", { extra: { thread_ts: "6.6" } });
    expect(ephemerals()[0]).toMatchObject({ user: "UANA", thread_ts: "6.6" });
    expect(ephemerals()[0].text).toContain("already sent");
  });

  test("a swap that Slack only half did is cleaned up by the next edit", async () => {
    await post("6.9", "<@UBEN> <@UCLEO> :taco::taco::taco: heroes"); // ⏳ shown and recorded
    stubSlackApi({ "reactions.add": () => ({ ok: false, error: "ratelimited" }) });
    await edit("6.9", "<@UBEN> <@UCLEO> :taco::taco::taco: heroes", ":taco: heroes"); // ⏳ taken off, ❌ never shown
    stubSlackApi();
    await edit("6.9", ":taco: heroes", "<@UANA> :taco: heroes"); // still invalid
    expect(reactionCalls()).toEqual(["remove hourglass_flowing_sand", "add x"]);
    expect((await attempts())[0].reaction).toBe("x");
  });
});

describe("kudos already sent never change", () => {
  test("an edit that changes the kudos only gets a private note; totals stay the same", async () => {
    await post("7.1", "<@UBEN> :taco::taco: thanks");
    calls = [];
    await edit("7.1", "<@UBEN> :taco::taco: thanks", "<@UBEN> :taco: thanks");
    expect(reactionCalls()).toEqual([]);
    expect(dms()).toEqual([]);
    expect(ephemerals()).toHaveLength(1);
    expect(ephemerals()[0]).toMatchObject({ channel: "C1", user: "UANA" });
    expect(ephemerals()[0].text).toBe("Your edit didn't change anything, because the kudos in this message were already sent.");
    expect((await all(t, "kudos")).map((k) => k.amount)).toEqual([2]);
    expect((await attempts())[0]).toMatchObject({ outcome: "given", reaction: "taco" });
  });

  test("fixing a typo in a sent kudos message stays silent", async () => {
    await post("7.2", "<@UBEN> :taco: thansk");
    calls = [];
    await edit("7.2", "<@UBEN> :taco: thansk", "<@UBEN> :taco: thanks");
    expect(calls.filter((c) => c.method !== "conversations.info")).toEqual([]);
  });

  test("a failed attempt fixed by an edit is given at most once; later edits only get the note", async () => {
    await post("7.3", ":taco: nobody");
    await edit("7.3", ":taco: nobody", "<@UBEN> :taco: nobody");
    calls = [];
    await edit("7.3", "<@UBEN> :taco: nobody", "<@UBEN> <@UCLEO> :taco: nobody");
    expect(reactionCalls()).toEqual([]);
    expect(ephemerals()[0].text).toContain("already sent");
    expect(await all(t, "kudos")).toHaveLength(1);
  });
});

describe("edits that change nothing are ignored", () => {
  test("a redelivered edit never swaps, gives or explains twice", async () => {
    await post("8.1", ":taco: nobody");
    await post("8.2", "<@UBEN> :taco:");
    calls = [];
    const fix = { editTs: "900.1", eventId: "EvFix" };
    await edit("8.1", ":taco: nobody", "<@UBEN> :taco: nobody", fix);
    await edit("8.1", ":taco: nobody", "<@UBEN> :taco: nobody", fix); // Slack's retry
    await edit("8.1", ":taco: nobody", "<@UBEN> :taco: nobody", { editTs: "900.1" }); // same edit, new envelope
    const note = { editTs: "900.2" };
    await edit("8.2", "<@UBEN> :taco:", "<@UBEN> <@UCLEO> :taco:", note);
    await edit("8.2", "<@UBEN> :taco:", "<@UBEN> <@UCLEO> :taco:", note);
    expect(reactionCalls()).toEqual(["remove hourglass_flowing_sand", "remove x", "add taco"]);
    expect(ephemerals()).toHaveLength(1); // the note, once
    expect(await all(t, "kudos")).toHaveLength(2);
  });

  test("an older edit arriving after a newer one never wins", async () => {
    await post("8.5", ":taco: nobody");
    await edit("8.5", "<@UBEN> :taco: nobody", ":taco: never mind", { editTs: "1790000002.000100" });
    calls = [];
    await edit("8.5", ":taco: nobody", "<@UBEN> :taco: nobody", { editTs: "1790000001.000100" });
    expect(reactionCalls()).toEqual([]);
    expect(await all(t, "kudos")).toEqual([]);
    expect((await attempts())[0]).toMatchObject({ outcome: "invalid", editTs: "1790000002.000100" });
  });

  test("changes that aren't edits (no `edited`: unfurls, reply counts) are ignored, even without the previous text", async () => {
    await post("8.6", ":taco: nobody");
    await post("8.7", "<@UBEN> :taco:");
    calls = [];
    for (const [ts, text] of [["8.6", ":taco: nobody"], ["8.7", "<@UBEN> :taco:"]]) {
      await deliverEvent({ type: "message", subtype: "message_changed", channel: "C1", ts: "950.1", message: { type: "message", user: "UANA", text, ts, reply_count: 1 } });
    }
    expect(reactionCalls()).toEqual([]);
    expect(ephemerals()).toEqual([]);
  });

  test("without the previous text, a failed attempt is still fixed, but a sent one gets no note", async () => {
    await post("8.8", ":taco: nobody");
    await post("8.9", "<@UBEN> :taco:");
    calls = [];
    for (const [ts, text] of [["8.8", "<@UBEN> :taco: nobody"], ["8.9", "<@UBEN> <@UCLEO> :taco:"]]) {
      const { previous_message: _, ...event } = editEvent(ts, "", text);
      await deliverEvent(event);
    }
    expect(reactionCalls()).toEqual(["remove hourglass_flowing_sand", "remove x", "add taco"]);
    expect(ephemerals()).toEqual([]);
    expect((await all(t, "kudos")).map((k) => k.messageTs)).toEqual(["8.9", "8.8"]);
  });

  test("edits in DMs and by people from other workspaces are ignored", async () => {
    await post("8.10", ":taco: nobody");
    calls = [];
    await deliverEvent({ ...editEvent("8.10", ":taco: nobody", "<@UBEN> :taco:"), channel_type: "im" });
    await edit("8.10", ":taco: nobody", "<@UBEN> :taco:", { extra: { user_team: "T2" } });
    expect(reactionCalls()).toEqual([]);
    expect(await all(t, "kudos")).toEqual([]);
  });

  test("an edit of a message that never carried the kudos emoji is ignored", async () => {
    await post("8.3", "lunch?");
    calls = [];
    await edit("8.3", "lunch?", "<@UBEN> :taco: lunch?");
    expect(reactionCalls()).toEqual([]);
    expect(ephemerals()).toEqual([]);
    expect(await all(t, "kudos")).toEqual([]);
    expect(await attempts()).toEqual([]);
  });

  test("edits by bots, by someone else, or that leave the text as it was", async () => {
    await post("8.4", ":taco: nobody");
    calls = [];
    await edit("8.4", ":taco: nobody", "<@UBEN> :taco:", { extra: { bot_id: "B1" } });
    await edit("8.4", ":taco: nobody", "<@UBEN> :taco:", { user: "UCLEO" });
    await edit("8.4", ":taco: nobody", ":taco: nobody"); // an unfurl or a new thread reply
    expect(reactionCalls()).toEqual([]);
    expect(ephemerals()).toEqual([]);
    expect(await all(t, "kudos")).toEqual([]);
  });
});
