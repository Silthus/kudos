import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type CapturedEvent, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { insertAwards } from "../engine/awards";

const now = new Date("2026-10-13T10:00:00Z");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };
const saysWhy = "thanks for untangling the release notes today";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL").withMember("U_DAN");
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E1 O3: level reached", () => {
  test.each<[string, FlagDefinition]>([
    ["off (E10)", offForEveryone("xp-levels")],
    ["on", onForEveryone("xp-levels")],
  ])("with xp-levels %s, a kudos that takes the giver from 0 to 20 XP sends one level reached on them at the spend instant, via kudos", async (_, xpLevels) => {
    const t = await flagsFromPostHog(testBackend(), postHog, xpLevels);

    await giveKudos(t, "U_ALICE", ["U_BOB"], 2);

    const [award] = await t.run((ctx) => ctx.db.query("awards").collect());
    const given = productEvents().find((event) => event.event === "kudos given")!;
    expect(levelsReached()).toEqual([
      {
        event: "level reached",
        distinct_id: given.distinct_id,
        uuid: expect.stringMatching(uuid),
        timestamp: new Date(award!.at).toISOString(),
        properties: { ...shared, level: 2, skill_points_gained: 0, via: "kudos" },
      },
    ]);
  });

  test("P64 P87: a level crossed by the Journey's first-thanks reward is sent via reward", async () => {
    const t = await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(testBackend(), postHog, ...["xp-levels", "unlocks", "quests"].map(onForEveryone)));
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));

    await giveKudos(t, "U_ALICE", ["U_BOB"], 1, saysWhy);

    const given = productEvents().find((event) => event.event === "kudos given")!;
    expect(levelsReached().map(({ distinct_id, properties }) => ({ distinct_id, properties }))).toEqual([
      { distinct_id: given.distinct_id, properties: { ...shared, level: 2, skill_points_gained: 0, via: "reward" } },
    ]);
  });

  test("P6: one kudos message sends one level reached per member who crosses a level, for the highest level they reach", async () => {
    const t = await flagsFromPostHog(testBackend(), postHog);
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 12 }));

    await giveKudos(t, "U_ALICE", ["U_BOB", "U_CAROL", "U_DAN"], 4);

    const [given, ...received] = productEvents().filter((event) => event.event === "kudos given" || event.event === "kudos received");
    const levelOn = ({ distinct_id, properties }: CapturedEvent) => `${distinct_id} level ${String(properties.level)}`;
    expect(levelsReached().map(levelOn).sort()).toEqual([`${given!.distinct_id} level 3`, ...received.map((event) => `${event.distinct_id} level 2`)].sort());
  });
});

describe("E7 E8: exactly once, and no history", () => {
  test("redelivering the Slack event sends no second level reached", async () => {
    const t = await flagsFromPostHog(testBackend(), postHog);
    const body = messageEvent(kudosBlocks(["U_BOB"], 2), { user: "U_ALICE" });

    await t.fetch("/slack/events", await signedRequest(body));
    await t.fetch("/slack/events", await signedRequest(body));
    await settle(t);

    expect(levelsReached()).toHaveLength(1);
  });

  test("the progression backfill sends no level reached for the levels earlier awards reach", async () => {
    const t = testBackend();
    await t.run(async (ctx) => {
      const [giver, recipient] = await Promise.all(
        ["U_ALICE", "U_BOB"].map((user) => ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" })),
      );
      await insertAwards(ctx, { workspace: "T1", conversation: "C1", message: "earlier" }, [{ giver: giver!, recipient: recipient!, kudos: 3 }], "2026-09-01", Date.parse("2026-09-01"));
    });

    await t.action(internal.progression.backfill.backfillEffects, {});
    await settle(t);

    expect(levelsReached()).toEqual([]);
  });
});

describe("O26: capture is off", () => {
  test("a kudos that reaches a level records nothing", async () => {
    vi.stubEnv("KUDOS_ENVIRONMENT", "");
    const t = testBackend();

    await giveKudos(t, "U_ALICE", ["U_BOB"], 2);

    expect(await t.run((ctx) => ctx.db.query("analyticsOutbox").collect())).toEqual([]);
    expect(postHog.requests).toEqual([]);
  });
});

function kudosBlocks(recipients: string[], tacos: number, words = "thanks") {
  return [section(...recipients.map((recipient) => mention(recipient)), text(` ${words} `), ...Array.from({ length: tacos }, () => emoji("taco")))];
}

async function giveKudos(t: Backend, giver: string, recipients: string[], tacos: number, words?: string) {
  sentMessages += 1;
  await t.fetch("/slack/events", await signedRequest(messageEvent(kudosBlocks(recipients, tacos, words), { user: giver, ts: `1760349600.00010${sentMessages}` })));
  await settleInTimeOrder(t);
}

function productEvents(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event !== "$feature_flag_called");
}

function levelsReached() {
  return productEvents().filter((event) => event.event === "level reached");
}
