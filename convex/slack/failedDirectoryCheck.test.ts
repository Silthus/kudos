import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { kudosReceived, kudosSpent, post, settle, testBackend } from "../../testing/slackBackend";
import { emoji, mention, section } from "../../testing/slackMessages";

const recheck = vi.hoisted(() => ({ failuresLeft: 0, tries: 0 }));

vi.mock("../engine/engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("../engine/engine")>();
  return {
    ...original,
    recheck: async (...args: Parameters<typeof original.recheck>) => {
      recheck.tries += 1;
      if (recheck.failuresLeft > 0) {
        recheck.failuresLeft -= 1;
        throw new Error('Documents read from or written to the "kudosTotals" table changed while this mutation was being run and on every subsequent retry.');
      }
      return original.recheck(...args);
    },
  };
});

const now = new Date("2026-10-14T10:00:00Z");
const postedTs = `${Math.floor(now.getTime() / 1000)}.000100`;

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_EVE").withMember("U_BOB");
  vi.stubGlobal("fetch", slack.fetch);
  Object.assign(recheck, { failuresLeft: 0, tries: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a failed directory check is tried again", () => {
  test("a kudos from a giver the directory didn't know still gives when its directory check fails", async () => {
    const t = testBackend();
    recheck.failuresLeft = 1;

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
  }, 30_000);

  test("a directory check that keeps failing stops after four more tries, spending nothing", async () => {
    const t = testBackend();
    recheck.failuresLeft = Infinity;

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settle(t);

    expect(recheck.tries).toBe(5);
    expect(await kudosSpent(t)).toBe(0);
    expect(slack.reactionsOn("C1", postedTs)).toEqual([]);
  }, 30_000);
});
