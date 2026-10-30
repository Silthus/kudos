import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CapturedEvent, FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { settle, testBackend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const week = "2026-10-12";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E5: a questOpened queued before the deploy", () => {
  test("without poolQuest, a weekly crate still sends its kind and leaves out the quest", async () => {
    const t = await workspace();
    const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));
    const quest = { kind: "weekly", week, slot: 1 } as const;

    await t.mutation(internal.analytics.subscribers.recordQuestOpened, { event: { type: "questOpened", workspace: "T1", member, quest, at: now.getTime() } });
    await settle(t);

    expect(cratesOpened().map(({ properties }) => properties)).toEqual([{ ...shared, kind: "weekly" }]);
  });
});

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

function cratesOpened(): CapturedEvent[] {
  return postHog.events().filter((event) => event.event === "crate opened");
}
