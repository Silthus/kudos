import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, postHogHost, projectToken, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const stickerJob = "stickers/stickers:recordStickers";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MS10: collecting a person's sticker sends person collected", () => {
  test("a kudos between two members who never exchanged one sends one person collected for each, via gave for the giver and received for the recipient, naming no one else", async () => {
    await thanks("U_ALICE", "U_BOB");
    await settle(t);

    expect(personCollected()).toEqual([
      { distinct_id: givenBy("U_ALICE"), properties: { ...shared, via: "gave" } },
      { distinct_id: receivedBy("U_BOB"), properties: { ...shared, via: "received" } },
    ]);
  });

  test("a second kudos between the same two, and a thanks back, collect no one again", async () => {
    await thanks("U_ALICE", "U_BOB");
    await settle(t);
    const once = personCollected();
    expect(once).toHaveLength(2);

    await thanks("U_ALICE", "U_BOB");
    await thanks("U_BOB", "U_ALICE");
    await settle(t);

    expect(personCollected()).toEqual(once);
  });

  test("via follows who gave the pair's first award, not the kudos that collected the sticker", async () => {
    await thanksBeforeStickersShipped("U_BOB", "U_ALICE");

    await thanks("U_ALICE", "U_BOB");
    await settle(t);

    expect(personCollected()).toEqual([
      { distinct_id: givenBy("U_ALICE"), properties: { ...shared, via: "received" } },
      { distinct_id: receivedBy("U_BOB"), properties: { ...shared, via: "gave" } },
    ]);
  });

  test("the backfill records the stickers of earlier kudos and sends no person collected for them", async () => {
    await thanksBeforeStickersShipped("U_ALICE", "U_BOB");

    await t.mutation(internal.stickers.backfill.startStickerBackfill, { workspace: "T1" });
    await settle(t);
    expect(await t.run((ctx) => ctx.db.query("stickers").collect())).toHaveLength(2);
    await thanks("U_CAROL", "U_ALICE");
    await settle(t);

    expect(personCollected()).toEqual([
      { distinct_id: givenBy("U_CAROL"), properties: { ...shared, via: "gave" } },
      { distinct_id: receivedBy("U_ALICE"), properties: { ...shared, via: "received" } },
    ]);
  });
});

async function thanks(giver: string, recipient: string) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(mention(recipient), emoji("taco"))], { user: giver, ts: `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}` });
}

async function thanksBeforeStickersShipped(giver: string, recipient: string) {
  await thanks(giver, recipient);
  for (let fired = 0; fired < 200; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    await cancelPendingStickerJobs();
    if (vi.getTimerCount() === 0) return;
    vi.advanceTimersToNextTimer();
  }
  throw new Error("the kudos never settled");
}

function cancelPendingStickerJobs() {
  return t.run(async (ctx) => {
    for (const job of await ctx.db.system.query("_scheduled_functions").collect()) if (job.name === stickerJob && job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
  });
}

function personCollected() {
  return postHog
    .events()
    .filter((event) => event.event === "person collected")
    .map(({ distinct_id, properties }) => ({ distinct_id, properties }));
}

function givenBy(user: string) {
  return distinctIdOf("kudos given", user);
}

function receivedBy(user: string) {
  return distinctIdOf("kudos received", user);
}

function distinctIdOf(event: "kudos given" | "kudos received", user: string) {
  const ids = new Set(postHog.events().filter((sent) => sent.event === event).map(({ distinct_id }) => distinct_id));
  const id = [...ids].find((candidate) => postHog.personOf(candidate)?.slack_user_id === user);
  if (id === undefined) throw new Error(`no ${event} for ${user}`);
  return id;
}
