import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack, httpStatus, landsButTimesOut, rateLimitedFor, slackError, timesOut, type ScriptedAnswer } from "../../testing/fakeSlack";
import { kudosReceived, kudosSpent, postMessage, settle, settleUntil, testBackend, type Backend } from "../../testing/kudosBackend";
import { signingSecret } from "../../testing/signedSlack";
import { emoji, mention, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { setIndicator as setDesiredIndicator, type Indicator } from "../feedback/indicator";

const now = new Date("2026-10-13T10:00:00Z");
const firstTs = "1760349600.000100";
const secondTs = "1760349601.000100";

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("R35: Retry-After", () => {
  test("a 429 on reactions.add holds the next reaction until Retry-After has passed, while private replies go on", async () => {
    const t = testBackend();
    slack.answering("reactions.add", rateLimitedFor(30));
    await giveKudos(t, firstTs);
    await settleUntil(t, new Date(now.getTime() + 10_000));

    await giveKudos(t, secondTs);
    await settleUntil(t, new Date(now.getTime() + 60_000));

    const [limited, ...later] = slack.timesOf("reactions.add");
    const replies = slack.timesOf("chat.postEphemeral");
    expect(later).toHaveLength(2);
    expect(later.every((at) => at >= limited! + 30_000)).toBe(true);
    expect(replies).toHaveLength(2);
    expect(replies.every((at) => at < limited! + 30_000)).toBe(true);
    expect(slack.reactionsOn("C1", firstTs)).toEqual(["taco"]);
    expect(slack.reactionsOn("C1", secondTs)).toEqual(["taco"]);
  });
});

describe("R32 R35: the indicator is retried until the message shows it", () => {
  test.each<[string, ScriptedAnswer]>([
    ["an error", slackError("internal_error")],
    ["an HTTP 500", httpStatus(500)],
    ["a timeout", timesOut],
  ])("reactions.add failing with %s three times still ends with exactly :taco:", async (_, failure) => {
    const t = testBackend();
    slack.answering("reactions.add", ...repeated(3, failure));

    await giveKudos(t, firstTs);
    await settle(t);

    expect(slack.callsTo("reactions.add")).toHaveLength(4);
    expect(slack.reactionsOn("C1", firstTs)).toEqual(["taco"]);
  });

  test("a timed-out reaction that landed anyway is taken off when the indicator changes", async () => {
    const t = testBackend();
    slack.answering("reactions.add", landsButTimesOut);
    await giveKudos(t, firstTs);
    await settle(t);

    await setIndicator(t, firstTs, { emoji: "x" });
    await settle(t);

    expect(slack.reactionsOn("C1", firstTs)).toEqual(["x"]);
  });

  test("the message shows only the latest indicator after a failed removal is retried", async () => {
    const t = testBackend();
    await giveKudos(t, firstTs);
    await settle(t);
    slack.answering("reactions.remove", httpStatus(503), httpStatus(503));

    await setIndicator(t, firstTs, { emoji: "hourglass_flowing_sand" });
    await setIndicator(t, firstTs, null);
    await settle(t);

    expect(slack.reactionsOn("C1", firstTs)).toEqual([]);
  });

  test("a stale add that lands after a newer delivery finished is taken off again", async () => {
    const t = testBackend();
    const ref = { workspace: "T1", conversation: "C1", message: firstTs };
    await setIndicator(t, firstTs, { emoji: "taco" });
    const staleAdd = slack.holdNext("reactions.add");
    const staleDelivery = t.action(internal.slack.delivery.deliverIndicator, ref);
    await staleAdd.reached;

    await setIndicator(t, firstTs, { emoji: "x" });
    await t.action(internal.slack.delivery.deliverIndicator, ref);
    staleAdd.release();
    await staleDelivery;
    await settle(t);

    expect(slack.reactionsOn("C1", firstTs)).toEqual(["x"]);
  });

  test("no_reaction counts as removed and already_reacted as added", async () => {
    const t = testBackend();
    await giveKudos(t, firstTs);
    await settle(t);
    slack.removeReaction("C1", firstTs, "taco");

    await setIndicator(t, firstTs, { emoji: "x" });
    await settle(t);
    await setIndicator(t, firstTs, { emoji: "x" });
    await settle(t);

    expect(slack.reactionsOn("C1", firstTs)).toEqual(["x"]);
    expect(slack.callsTo("reactions.remove").map((args) => args.name)).toEqual(["taco", "taco"]);
    expect(slack.callsTo("reactions.add").filter((args) => args.name === "x")).toHaveLength(2);
  });
});

describe("R35: a private reply is tried at most 3 times", () => {
  test.each<[string, ScriptedAnswer]>([
    ["an error", slackError("internal_error")],
    ["an HTTP 500", httpStatus(500)],
    ["a 429", rateLimitedFor(5)],
    ["an unknown result", landsButTimesOut],
  ])("a reply failing with %s every time is sent 3 times and then given up", async (_, failure) => {
    const t = testBackend();
    slack.answering("chat.postEphemeral", ...repeated(10, failure));

    await giveKudos(t, firstTs);
    await settle(t);

    expect(slack.ephemeralsTo("U_ALICE")).toHaveLength(3);
    expect(slack.reactionsOn("C1", firstTs)).toEqual(["taco"]);
  });

  test("a reply that fails twice is delivered on the third try, after the Retry-After Slack asked for", async () => {
    const t = testBackend();
    slack.answering("chat.postEphemeral", httpStatus(502), rateLimitedFor(20));

    await giveKudos(t, firstTs);
    await settleUntil(t, new Date(now.getTime() + 60_000));

    const [, limited, delivered] = slack.timesOf("chat.postEphemeral");
    expect(slack.ephemeralsTo("U_ALICE")).toHaveLength(3);
    expect(delivered).toBeGreaterThanOrEqual(limited! + 20_000);
  });
});

describe("R34: feedback is separate from awards", () => {
  test("failing and repeated deliveries never evaluate again and never change awards or allowance", async () => {
    const t = testBackend();
    slack.answering("reactions.add", timesOut, timesOut).answering("chat.postEphemeral", slackError("internal_error"), slackError("internal_error"));

    await giveKudos(t, firstTs);
    await settle(t);
    await t.action(internal.slack.delivery.deliverIndicator, { workspace: "T1", conversation: "C1", message: firstTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await kudosSpent(t)).toBe(1);
    expect(slack.ephemeralsTo("U_ALICE")).toHaveLength(3);
    expect(slack.reactionsOn("C1", firstTs)).toEqual(["taco"]);
  });
});

describe("R35: a delivery whose message or channel is gone stops for good", () => {
  test.each(["message_not_found", "channel_not_found", "not_in_channel"])("reactions.add answering %s is not retried, and awards and spending stay", async (error) => {
    const t = testBackend();
    slack.answering("reactions.add", ...repeated(10, slackError(error)));

    await giveKudos(t, firstTs);
    await settle(t);

    expect(slack.callsTo("reactions.add")).toHaveLength(1);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await kudosSpent(t)).toBe(1);
  });

  test.each(["message_not_found", "channel_not_found", "not_in_channel"])("chat.postEphemeral answering %s is not retried, and awards and spending stay", async (error) => {
    const t = testBackend();
    slack.answering("chat.postEphemeral", ...repeated(10, slackError(error)));

    await giveKudos(t, firstTs);
    await settle(t);

    expect(slack.callsTo("chat.postEphemeral")).toHaveLength(1);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await kudosSpent(t)).toBe(1);
  });
});

function setIndicator(t: Backend, ts: string, indicator: Indicator) {
  return t.run((ctx) => setDesiredIndicator(ctx, { workspace: "T1", conversation: "C1", message: ts }, indicator));
}

function repeated(times: number, answer: ScriptedAnswer) {
  return Array.from({ length: times }, () => answer);
}

function giveKudos(t: Backend, ts: string) {
  return postMessage(t, [section(mention("U_BOB"), emoji("taco"))], { ts });
}
