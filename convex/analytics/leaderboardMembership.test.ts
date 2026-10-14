import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { offForEveryone, onForEveryone, postHogDeciding, testBackendServing } from "../../testing/flags";
import { blockActions, buttonInHome, publishedHome, type BlockAction } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, type Backend } from "../../testing/slackBackend";
import { appHomeOpened } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Command } from "../commands/commands";
import { recordUsage } from "./usage";

vi.mock("./usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./usage")>();
  return { ...actual, recordUsage: vi.fn(actual.recordUsage) };
});

const now = new Date("2026-10-14T10:00:00Z");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const form = { contentType: "application/x-www-form-urlencoded" };

let slack: FakeSlack;
let postHog: FakePostHog;
let actualRecordUsage: typeof recordUsage;

beforeAll(async () => {
  actualRecordUsage = (await vi.importActual<typeof import("./usage")>("./usage")).recordUsage;
});

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE");
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.mocked(recordUsage).mockImplementation(actualRecordUsage);
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E2 E6 G22: leaderboard left and leaderboard joined", () => {
  test("unticking Show me on the leaderboards sends one leaderboard left on the member at the click, and ticking it again one leaderboard joined", async () => {
    const t = await inSettings(onForEveryone("everyone-board"));
    const leftAt = new Date(now.getTime() + 60_000);
    vi.setSystemTime(leftAt);
    await click(t, "U_ALICE", "Off");
    const joinedAt = new Date(now.getTime() + 120_000);
    vi.setSystemTime(joinedAt);

    await click(t, "U_ALICE", "On");

    const opened = productEvents().find((event) => event.event === "app home opened")!;
    expect(membershipChanges()).toEqual([
      { event: "leaderboard left", distinct_id: opened.distinct_id, uuid: expect.stringMatching(uuid), timestamp: leftAt.toISOString(), properties: shared },
      { event: "leaderboard joined", distinct_id: opened.distinct_id, uuid: expect.stringMatching(uuid), timestamp: joinedAt.toISOString(), properties: shared },
    ]);
  });

  test("setting it to what it already is sends nothing: On at the default, then Off twice and On twice", async () => {
    const t = await inSettings(onForEveryone("everyone-board"));

    await click(t, "U_ALICE", "On");
    await click(t, "U_ALICE", "Off");
    await click(t, "U_ALICE", "Off");
    await click(t, "U_ALICE", "On");
    await click(t, "U_ALICE", "On");

    expect(await storedSettings(t)).toEqual([true]);
    expect(membershipChanges().map((event) => event.event)).toEqual(["leaderboard left", "leaderboard joined"]);
  });

  test("with the Everyone board dark, a stale toggle changes nothing and sends nothing", async () => {
    const t = await inSettings(offForEveryone("everyone-board"));

    await act(t, "U_ALICE", { type: "setLeaderboardVisibility", visible: false });
    await act(t, "U_ALICE", { type: "setLeaderboardVisibility", visible: true });

    expect(await storedSettings(t)).toEqual([]);
    expect(membershipChanges()).toEqual([]);
  });
});

describe("E6 O15 O20: a setting change whose recording fails", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("still changes the setting and answers the interaction, logging a fixed code and reporting no exception", async () => {
    const t = await inSettings(onForEveryone("everyone-board"));
    vi.mocked(recordUsage).mockRejectedValue(new Error("recording failed"));

    const response = await click(t, "U_ALICE", "Off");
    await sweepFailedJobs(t);

    expect(response.status).toBe(200);
    expect(await storedSettings(t)).toEqual([false]);
    expect(publishedHome(slack, "U_ALICE")).toContain("actions: On | [Off]");
    expect(console.error).toHaveBeenCalledWith("analytics.usage_not_recorded", { error: "Error" });
    expect(productEvents().map((event) => event.event)).toEqual(["app home opened"]);
  });
});

async function inSettings(everyoneBoard: ReturnType<typeof onForEveryone>) {
  const t = await testBackendServing(postHog, everyoneBoard);
  await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_ALICE")));
  await settle(t);
  if (publishedHome(slack, "U_ALICE").some((line) => line.includes("Settings"))) await click(t, "U_ALICE", "Settings");
  return t;
}

async function click(t: Backend, user: string, label: string) {
  return interact(t, user, buttonInHome(slack, user, label));
}

async function act(t: Backend, user: string, command: Command) {
  const value = JSON.stringify(command);
  return interact(t, user, { type: "button", action_id: value, value });
}

async function interact(t: Backend, user: string, action: BlockAction) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settle(t);
  return response;
}

async function sweepFailedJobs(t: Backend) {
  vi.advanceTimersByTime(2 * 60_000);
  await t.mutation(internal.analytics.sweep.sweep, {});
  await settle(t);
}

async function storedSettings(t: Backend) {
  return (await t.run((ctx) => ctx.db.query("leaderboardSettings").collect())).map((setting) => setting.visible);
}

function productEvents() {
  return postHog.productEvents().filter((event) => event.event !== "$feature_flag_called");
}

function membershipChanges() {
  return productEvents().filter((event) => event.event === "leaderboard left" || event.event === "leaderboard joined");
}
