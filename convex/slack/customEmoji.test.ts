import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from "vitest";
import { internal } from "../_generated/api";
import { FakeSlack, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emojiChangedEvent, type EmojiChange } from "../../testing/slackMessages";
import { customEmojiImageOf } from "../workspace/customEmoji";

const now = new Date("2026-10-14T10:00:00Z");

const parrotGif = "https://emoji.slack-edge.com/T1/partyparrot/1a2b3c.gif";
const fasterParrotGif = "https://emoji.slack-edge.com/T1/partyparrot/4d5e6f.gif";
const tacoPng = "https://emoji.slack-edge.com/T1/taco/7a8b9c.png";

let slack: FakeSlack;
let logged: MockInstance[];

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack();
  vi.stubGlobal("fetch", slack.fetch);
  logged = (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the custom emoji sync keeps the workspace's custom emoji in the directory", () => {
  test("it keeps each custom emoji's image, and an alias with its original's image", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif).withCustomEmoji("parrot", "alias:partyparrot").withCustomEmoji("taco", tacoPng);

    await sync(t);

    expect(await imagesOf(t, "partyparrot", "parrot", "taco", "tada")).toEqual({ partyparrot: parrotGif, parrot: parrotGif, taco: tacoPng, tada: undefined });
  });

  test("an alias of an alias gets the original's image, and aliases that only name each other get none", async () => {
    const t = testBackend();
    slack
      .withCustomEmoji("partyparrot", parrotGif)
      .withCustomEmoji("parrot", "alias:partyparrot")
      .withCustomEmoji("birb", "alias:parrot")
      .withCustomEmoji("ping", "alias:pong")
      .withCustomEmoji("pong", "alias:ping");

    await sync(t);

    expect(await imagesOf(t, "birb", "ping", "pong")).toEqual({ birb: parrotGif, ping: undefined, pong: undefined });
  });

  test("it keeps only https images: an http image, a data image, an alias of a standard emoji and an alias of an unknown one get none", async () => {
    const t = testBackend();
    slack
      .withCustomEmoji("plain", "http://emoji.slack-edge.com/T1/plain/1.png")
      .withCustomEmoji("inline", "data:image/png;base64,iVBORw0KGgo=")
      .withCustomEmoji("thumbs", "alias:thumbsup")
      .withCustomEmoji("dangling", "alias:gone")
      .withCustomEmoji("insecure", "alias:plain");

    await sync(t);

    expect(await imagesOf(t, "plain", "inline", "thumbs", "dangling", "insecure")).toEqual({ plain: undefined, inline: undefined, thumbs: undefined, dangling: undefined, insecure: undefined });
  });

  test("running it again follows Slack: a changed image, a removed emoji and a new one", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif).withCustomEmoji("parrot", "alias:partyparrot").withCustomEmoji("blob", "https://emoji.slack-edge.com/T1/blob/1.png");
    await sync(t);

    slack.withCustomEmoji("partyparrot", fasterParrotGif).withoutCustomEmoji("blob").withCustomEmoji("taco", tacoPng);
    await sync(t);

    expect(await imagesOf(t, "partyparrot", "parrot", "blob", "taco")).toEqual({ partyparrot: fasterParrotGif, parrot: fasterParrotGif, blob: undefined, taco: tacoPng });
  });

  test("it keeps a whole list longer than one write takes, and forgets all of it once Slack lists none", async () => {
    const t = testBackend();
    const names = Array.from({ length: 1_200 }, (_, index) => `emoji_${index}`);
    for (const name of names) slack.withCustomEmoji(name, `https://emoji.slack-edge.com/T1/${name}/1.png`);
    await sync(t);

    expect(await storedCount(t)).toBe(1_200);
    expect(await imagesOf(t, "emoji_0", "emoji_1199")).toEqual({ emoji_0: "https://emoji.slack-edge.com/T1/emoji_0/1.png", emoji_1199: "https://emoji.slack-edge.com/T1/emoji_1199/1.png" });

    for (const name of names) slack.withoutCustomEmoji(name);
    await sync(t);

    expect(await storedCount(t)).toBe(0);
  });

  test("an app without the emoji:read scope keeps none, fails nothing and logs nothing", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif).answering("emoji.list", slackError("missing_scope"));

    await sync(t);

    expect(await imagesOf(t, "partyparrot")).toEqual({ partyparrot: undefined });
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
  });

  test("a rate-limited listing asks again after the Retry-After Slack gave", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif).answering("emoji.list", rateLimitedFor(30));

    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await settleInTimeOrder(t);

    const [first, second] = slack.timesOf("emoji.list");
    expect(second! - first!).toBe(30_000);
    expect(await imagesOf(t, "partyparrot")).toEqual({ partyparrot: parrotGif });
  });

  test("a listing Slack answered earlier changes nothing a listing asked for later already wrote", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif);
    const earlier = answeredNowReturnedLater();
    slack.answering("emoji.list", earlier.answer);
    const earlierSync = t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await earlier.reached;

    slack.withCustomEmoji("partyparrot", fasterParrotGif).withCustomEmoji("taco", tacoPng);
    await sync(t);
    earlier.release();
    await earlierSync;
    await settle(t);

    expect(await imagesOf(t, "partyparrot", "taco")).toEqual({ partyparrot: fasterParrotGif, taco: tacoPng });
  });
});

describe("emoji_changed brings the custom emoji up to date", () => {
  test("an added, renamed or removed custom emoji follows Slack once its change arrives", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif);
    await sync(t);

    slack.withCustomEmoji("taco", tacoPng);
    expect((await emojiChanged(t, { subtype: "add", name: "taco", value: tacoPng })).status).toBe(200);
    await settle(t);
    expect(await imagesOf(t, "taco")).toEqual({ taco: tacoPng });

    slack.withoutCustomEmoji("partyparrot").withCustomEmoji("party_parrot", parrotGif);
    await emojiChanged(t, { subtype: "rename", old_name: "partyparrot", new_name: "party_parrot", value: parrotGif });
    await settle(t);
    expect(await imagesOf(t, "partyparrot", "party_parrot")).toEqual({ partyparrot: undefined, party_parrot: parrotGif });

    slack.withoutCustomEmoji("taco");
    await emojiChanged(t, { subtype: "remove", names: ["taco"] });
    await settle(t);
    expect(await imagesOf(t, "taco")).toEqual({ taco: undefined });
  });

  test("a burst of changes, and a change Slack delivers again, list the emoji once", async () => {
    const t = testBackend();
    for (const name of ["one", "two", "three", "four", "five"]) {
      slack.withCustomEmoji(name, `https://emoji.slack-edge.com/T1/${name}/1.png`);
      await emojiChanged(t, { subtype: "add", name, value: `https://emoji.slack-edge.com/T1/${name}/1.png` }, { eventId: `Ev_${name}` });
    }
    await emojiChanged(t, { subtype: "add", name: "five", value: "https://emoji.slack-edge.com/T1/five/1.png" }, { eventId: "Ev_five" });
    await settle(t);

    expect(slack.callsTo("emoji.list")).toHaveLength(1);
    expect(await imagesOf(t, "one", "five")).toEqual({ one: "https://emoji.slack-edge.com/T1/one/1.png", five: "https://emoji.slack-edge.com/T1/five/1.png" });
  });

  test("a change after a refresh that failed lists the emoji again once that refresh was due", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif).answering("auth.test", slackError("internal_error"));
    await emojiChanged(t, { subtype: "add", name: "partyparrot", value: parrotGif });
    await settle(t);
    expect(await imagesOf(t, "partyparrot")).toEqual({ partyparrot: undefined });

    await emojiChanged(t, { subtype: "add", name: "taco", value: tacoPng });
    slack.withCustomEmoji("taco", tacoPng);
    await settle(t);

    expect(await imagesOf(t, "partyparrot", "taco")).toEqual({ partyparrot: parrotGif, taco: tacoPng });
  });

  test("a change that arrives while a listing is under way lists the emoji again", async () => {
    const t = testBackend();
    slack.withCustomEmoji("partyparrot", parrotGif);
    const underWay = answeredNowReturnedLater();
    slack.answering("emoji.list", underWay.answer);
    await emojiChanged(t, { subtype: "add", name: "partyparrot", value: parrotGif });
    vi.runOnlyPendingTimers();
    await underWay.reached;

    slack.withCustomEmoji("taco", tacoPng);
    await emojiChanged(t, { subtype: "add", name: "taco", value: tacoPng });
    underWay.release();
    await settle(t);

    expect(await imagesOf(t, "partyparrot", "taco")).toEqual({ partyparrot: parrotGif, taco: tacoPng });
  });
});

async function sync(t: Backend) {
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  await settle(t);
}

async function emojiChanged(t: Backend, change: EmojiChange, options: { eventId?: string } = {}) {
  return t.fetch("/slack/events", await signedRequest(emojiChangedEvent(change, options)));
}

function answeredNowReturnedLater() {
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  let signalReached = () => {};
  const reached = new Promise<void>((resolve) => (signalReached = resolve));
  const answer = async (answerAsSlackWould: () => Response) => {
    const answered = answerAsSlackWould();
    signalReached();
    await released;
    return answered;
  };
  return { answer, reached, release };
}

async function imagesOf(t: Backend, ...names: string[]) {
  const images = await t.run((ctx) => Promise.all(names.map(async (name) => (await customEmojiImageOf(ctx, "T1", name)) ?? null)));
  return Object.fromEntries(names.map((name, index) => [name, images[index] ?? undefined]));
}

function storedCount(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("customEmoji").collect()).length);
}
