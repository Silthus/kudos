import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus } from "../../testing/fakeSlack";
import { offForEveryone, onForEveryone, postHogDeciding, testBackendServing, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonInHome, publishedHome, type BlockAction } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Command } from "../commands/commands";
import { recordUsage } from "./usage";

vi.mock("./usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./usage")>();
  return { ...actual, recordUsage: vi.fn(actual.recordUsage) };
});

const now = new Date("2026-10-13T10:00:00Z");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const form = { contentType: "application/x-www-form-urlencoded" };

let slack: FakeSlack;
let postHog: FakePostHog;
let actualRecordUsage: typeof recordUsage;
let sentMessages = 0;

beforeAll(async () => {
  actualRecordUsage = (await vi.importActual<typeof import("./usage")>("./usage")).recordUsage;
});

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.mocked(recordUsage).mockImplementation(actualRecordUsage);
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E2 E6: leaderboard viewed", () => {
  test("choosing the Leaderboard tab sends leaderboard viewed on the member, for this week, from App Home, at the click", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");
    const clickedAt = new Date(now.getTime() + 60_000);
    vi.setSystemTime(clickedAt);

    await click(t, "U_ALICE", "Leaderboard");

    const opened = productEvents().find((event) => event.event === "app home opened")!;
    expect(views()).toEqual([
      {
        event: "leaderboard viewed",
        distinct_id: opened.distinct_id,
        uuid: expect.stringMatching(uuid),
        timestamp: clickedAt.toISOString(),
        properties: { ...shared, board: "everyone", period: "week", surface: "app home" },
      },
    ]);
  });

  test("choosing This month on the tab sends a view for the month, and All time one for all time", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Leaderboard");

    await click(t, "U_ALICE", "This month");
    await click(t, "U_ALICE", "All time");

    expect(views().map(({ properties }) => [properties.period, properties.surface])).toEqual([
      ["week", "app home"],
      ["month", "app home"],
      ["all", "app home"],
    ]);
  });

  test("/hedgehug leaderboard all sends a view for all time from the command, at the time the command arrived", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");
    const arrivedAt = new Date();

    await leaderboardCommand(t, "U_ALICE", "leaderboard all");

    const opened = productEvents().find((event) => event.event === "app home opened")!;
    expect(views()).toEqual([
      {
        event: "leaderboard viewed",
        distinct_id: opened.distinct_id,
        uuid: expect.stringMatching(uuid),
        timestamp: arrivedAt.toISOString(),
        properties: { ...shared, board: "everyone", period: "all", surface: "command" },
      },
    ]);
  });

  test("O36: a teammate the directory doesn't know yet sends their view, looked up once with their exposure", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));

    await leaderboardCommand(t, "U_BOB", "leaderboard month");

    expect(slack.callsTo("users.info")).toEqual([{ user: "U_BOB" }]);
    const [exposure] = postHog.events().filter((event) => event.event === "$feature_flag_called");
    expect(views().map(({ distinct_id, properties }) => [distinct_id, properties.period, properties.surface])).toEqual([[exposure!.distinct_id, "month", "command"]]);
  });

  test("P76: with unlocks applying, a member who opened the Leaderboard sends a view for its tab, a period and /hedgehug leaderboard all", async () => {
    const t = await leaderboardReadyForAlice(onForEveryone("unlocks"));
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Open");

    await click(t, "U_ALICE", "Leaderboard");
    await click(t, "U_ALICE", "This month");
    await leaderboardCommand(t, "U_ALICE", "leaderboard all");

    expect(views().map(({ properties }) => [properties.period, properties.surface])).toEqual([
      ["week", "app home"],
      ["month", "app home"],
      ["all", "command"],
    ]);
  });

  test("E7: asking twice is two requests and sends two views, from the tab and from the command", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Leaderboard");
    await click(t, "U_ALICE", "Leaderboard");
    await leaderboardCommand(t, "U_ALICE", "leaderboard");
    await leaderboardCommand(t, "U_ALICE", "leaderboard");

    expect(views().map(({ properties }) => [properties.period, properties.surface])).toEqual([
      ["week", "app home"],
      ["week", "app home"],
      ["week", "command"],
      ["week", "command"],
    ]);
  });

  test("opening App Home onto the Leaderboard tab sends app home opened only, through a failed and retried publish", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", "Leaderboard");
    const before = productEvents().length;
    slack.answering("views.publish", httpStatus(500));

    await openHome(t, "U_ALICE");

    expect(slack.callsTo("views.publish").length).toBeGreaterThanOrEqual(4);
    expect(publishedHome(slack, "U_ALICE")[1]).toBe("header: Leaderboard");
    expect(productEvents().slice(before).map((event) => event.event)).toEqual(["app home opened"]);
  });

  test("O19: /hedgehug leaderboard never sent command used, and still doesn't", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");

    await leaderboardCommand(t, "U_ALICE", "leaderboard month");

    expect(productEvents().map((event) => event.event)).toEqual(["app home opened", "leaderboard viewed"]);
  });
});

describe("E2 G23 P76: no board allowed, no view", () => {
  const askedForTheBoard = (t: Backend) => [
    () => act(t, "U_ALICE", { type: "showHomeTab", tab: "leaderboard" }),
    () => act(t, "U_ALICE", { type: "showLeaderboard", period: "month" }),
    () => leaderboardCommand(t, "U_ALICE", "leaderboard all"),
  ];

  test("with the Everyone board dark, the tab, a period and /hedgehug leaderboard send no view", async () => {
    const t = await testBackendServing(postHog, offForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");

    for (const ask of askedForTheBoard(t)) await ask();

    expect(views()).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")).not.toContain("header: Leaderboard");
  });

  test("with the Leaderboard ready but not opened while unlocks apply, the tab, a period and /hedgehug leaderboard send no view", async () => {
    const t = await leaderboardReadyForAlice(onForEveryone("unlocks"));
    await openHome(t, "U_ALICE");

    for (const ask of askedForTheBoard(t)) await ask();

    expect(await leaderboardCommand(t, "U_ALICE", "leaderboard")).toEqual({ response_type: "ephemeral", text: "Leaderboard is ready for you. Open it in App Home." });
    expect(views()).toEqual([]);
  });

  test("an unknown period gets the usage reply and sends no view", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");

    const reply = await leaderboardCommand(t, "U_ALICE", "leaderboard yesterday");

    expect(reply?.text).not.toContain("<@");
    expect(views()).toEqual([]);
  });
});

describe("E6 O15 O20: a view whose recording fails", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("still selects the tab and the period and answers the interaction, logging a fixed code and reporting no exception", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await openHome(t, "U_ALICE");
    vi.mocked(recordUsage).mockRejectedValue(new Error("recording failed"));

    const tab = await click(t, "U_ALICE", "Leaderboard");
    const period = await click(t, "U_ALICE", "This month");
    await sweepFailedJobs(t);

    expect([tab.status, period.status]).toEqual([200, 200]);
    expect(publishedHome(slack, "U_ALICE").slice(1, 3)).toEqual(["header: Leaderboard", "actions: This week | [This month] | All time"]);
    expect(console.error).toHaveBeenCalledWith("analytics.usage_not_recorded", { error: "Error" });
    expect(productEvents().map((event) => event.event)).toEqual(["app home opened"]);
  });

  test("still sends /hedgehug leaderboard its board, logging a fixed code and reporting no exception", async () => {
    const t = await testBackendServing(postHog, onForEveryone("everyone-board"));
    await giveKudos(t, "U_BOB", "U_ALICE", 1);
    vi.mocked(recordUsage).mockRejectedValue(new Error("recording failed"));

    const reply = await leaderboardCommand(t, "U_ALICE", "leaderboard");

    expect(reply?.text).toContain("🥇 <@U_BOB> · 1 kudos");
    expect(console.error).toHaveBeenCalledWith("analytics.usage_not_recorded", { error: "Error" });
    expect(productEvents().filter((event) => !event.event.startsWith("kudos") && event.event !== "member welcomed")).toEqual([]);
  });
});

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
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

async function leaderboardReadyForAlice(unlocks: ReturnType<typeof onForEveryone>) {
  const t = await unlocksShippedBeforeAnyoneJoined(await testBackendServing(postHog, onForEveryone("everyone-board"), onForEveryone("xp-levels"), unlocks));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await giveKudos(t, "U_ALICE", "U_BOB", 10);
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function leaderboardCommand(t: Backend, user: string, text: string) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text,
    response_url: "https://hooks.slack.com/commands/T1/1/abc",
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, form));
  await settle(t);
  const reply = await response.text();
  return reply === "" ? null : (JSON.parse(reply) as { text: string });
}

function productEvents() {
  return postHog.productEvents().filter((event) => event.event !== "$feature_flag_called");
}

function views() {
  return productEvents().filter((event) => event.event === "leaderboard viewed");
}
