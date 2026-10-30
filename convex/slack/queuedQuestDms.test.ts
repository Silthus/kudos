import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Notification } from "../feedback/notify";

const now = new Date("2026-10-14T10:00:00Z");
const aKudosMessage = { workspace: "T1", conversation: "C1", message: "1760436000.999900" };

const queuedByTheUnlockPath: Record<string, Notification> = {
  "a Journey quest finished": { kind: "quest-finished", quest: { kind: "journey", step: "first-thanks" }, xp: 50 },
  "the Journey joined": { kind: "journey-joined", finished: [{ quest: { kind: "journey", step: "first-thanks" }, xp: 50 }] },
  "a weekly quest finished": { kind: "weekly-quest-finished", quest: { kind: "weekly", week: "2026-10-12", slot: 0 }, goal: "Say why in 3 kudos", xp: 40 },
};

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  flagsOnForEveryone(slack.fetch, "xp-levels", "monday-quest");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a quest DM the unlock path queued before the deploy sends nothing and is never retried", () => {
  test.each(Object.entries(queuedByTheUnlockPath))("%s, as a DM", async (_, notification) => {
    const t = await workspaceWithAlice();

    expect(await deliveringToAlice(t, { notification })).toEqual({ posted: [], retries: 0 });
  });

  test.each(Object.entries(queuedByTheUnlockPath))("%s, beside the kudos", async (_, notification) => {
    const t = await workspaceWithAlice();

    expect(await deliveringToAlice(t, { notification, kudos: aKudosMessage })).toEqual({ posted: [], retries: 0 });
  });
});

async function workspaceWithAlice() {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  const blocks = [section(mention("U_BOB"), text(" thanks for untangling the release notes today "), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: "U_ALICE" })));
  await settle(t);
  return t;
}

async function deliveringToAlice(t: Backend, message: { notification: Notification; kudos?: typeof aKudosMessage }) {
  const callsBefore = slack.calls.length;
  const deliveriesBefore = await scheduledDeliveries(t);
  const member = await t.run(async (ctx) => (await ctx.db.query("members").withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", "U_ALICE")).unique())!._id);
  await t.action(internal.slack.directMessages.deliverDirectMessage, { member, workspace: "T1", user: "U_ALICE", ...message });
  await settle(t);
  return {
    posted: slack.calls.slice(callsBefore).filter(({ method }) => method === "chat.postMessage" || method === "chat.update"),
    retries: (await scheduledDeliveries(t)) - deliveriesBefore,
  };
}

async function scheduledDeliveries(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ name }) => name === "slack/directMessages:deliverDirectMessage").length;
}
